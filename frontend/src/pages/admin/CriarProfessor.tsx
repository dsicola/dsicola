import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { professoresApi, storageApi, profilesApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Upload, User, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { COUNTRIES, getProvincesByCountry, getMunicipiosByProvince } from "@/utils/countries-provinces";
import { getApiErrorMessage } from "@/utils/apiErrors";
import { PasswordStrengthIndicator, isPasswordStrong } from "@/components/auth/PasswordStrengthIndicator";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function CriarProfessor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    // Personal Details
    genero: "Masculino",
    primeiro_nome: "",
    nome_meio: "",
    ultimo_nome: "",
    data_nascimento: "",
    tipo_sanguineo: "",
    telefone: "",
    qualificacao: "",
    numero_identificacao: "", // BI field
    // Address
    morada: "",
    cidade: "",
    pais: "",
    provincia: "",
    municipio: "",
    codigo_postal: "",
    // Account Information
    email: "",
    senha: "",
    confirmar_senha: "",
    // School Details
    data_admissao: "",
    data_saida: "",
    cargo_atual: "",
    codigo_funcionario: "",
    horas_trabalho: "",
  });

  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const nomeCompleto = [formData.primeiro_nome, formData.nome_meio, formData.ultimo_nome]
        .filter(Boolean)
        .join(" ");

      const response = await professoresApi.create({
        email: formData.email,
        nomeCompleto,
        telefone: formData.telefone || undefined,
        numeroIdentificacao: formData.numero_identificacao || undefined,
        password: formData.senha || undefined,
        // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
        // O backend usa req.user.instituicaoId do JWT token automaticamente
      });

      if (!response?.user_id) {
        throw new Error("Resposta inválida do servidor");
      }

      const userId = response.user_id;

      // Upload avatar if selected
      let avatarUrl = null;
      if (avatarFile && userId) {
        avatarUrl = await storageApi.uploadAvatar(userId, avatarFile);
      }

      // Update profile with additional fields
      await profilesApi.update(userId, {
        avatar_url: avatarUrl,
        genero: formData.genero,
        data_nascimento: formData.data_nascimento || null,
        tipo_sanguineo: formData.tipo_sanguineo || null,
        qualificacao: formData.qualificacao || null,
        morada: formData.morada || null,
        cidade: formData.cidade || null,
        pais: formData.pais || null,
        provincia: formData.provincia || null,
        municipio: formData.municipio || null,
        codigo_postal: formData.codigo_postal || null,
        data_admissao: formData.data_admissao || null,
        data_saida: formData.data_saida || null,
        cargo_atual: formData.cargo_atual || null,
        codigo_funcionario: formData.codigo_funcionario || null,
        horas_trabalho: formData.horas_trabalho || null,
      });

      return { userId, email: formData.email, generatedPassword: response.generated_password };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["professores"] });
      
      if (result.generatedPassword) {
        setCreatedCredentials({ email: result.email, password: result.generatedPassword });
        toast.success("Professor cadastrado com sucesso!");
        // Navigate back after showing credentials
        setTimeout(() => {
          navigate("/admin-dashboard/gestao-professores");
        }, 3000);
      } else {
        toast.success("Professor cadastrado com sucesso!");
        navigate("/admin-dashboard/gestao-professores");
      }
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Erro ao cadastrar professor. Tente novamente."));
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        const errorMsg = "Apenas imagens JPEG, PNG e WEBP são permitidas";
        setAvatarError(errorMsg);
        toast.error(errorMsg);
        e.target.value = ''; // Limpar input
        return;
      }

      // Validar tamanho (2MB máximo)
      const maxSize = 2 * 1024 * 1024; // 2MB em bytes
      if (file.size > maxSize) {
        const errorMsg = "A foto selecionada é muito grande. O tamanho máximo permitido é 2MB.";
        setAvatarError(errorMsg);
        toast.error(errorMsg);
        e.target.value = ''; // Limpar input
        return;
      }

      // Se passar nas validações, limpar erro e processar arquivo
      setAvatarError(null);
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const isFieldInvalid = (field: string, value: string) => {
    return (touched[field] || submitted) && !value.trim();
  };

  const validateStep1 = () => {
    setTouched(prev => ({ 
      ...prev, 
      primeiro_nome: true, 
      ultimo_nome: true,
      numero_identificacao: true 
    }));
    
    if (!formData.primeiro_nome.trim()) {
      toast.error("Primeiro nome é obrigatório");
      return false;
    }
    if (!formData.ultimo_nome.trim()) {
      toast.error("Último nome é obrigatório");
      return false;
    }
    if (!formData.numero_identificacao.trim()) {
      toast.error("Número de BI é obrigatório");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    setTouched(prev => ({ ...prev, email: true }));
    
    if (!formData.email.trim()) {
      toast.error("Email é obrigatório");
      return false;
    }
    if (formData.senha && formData.senha !== formData.confirmar_senha) {
      toast.error("As senhas não coincidem");
      return false;
    }
    // Validar força da senha para PROFESSOR
    if (formData.senha) {
      const isStrong = isPasswordStrong(formData.senha, false, 'PROFESSOR');
      if (!isStrong) {
        toast.error("Senha muito fraca. Utilize letras maiúsculas, números e símbolos.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    
    // Validar foto se houver erro
    if (avatarError) {
      toast.error("Corrija o erro na foto antes de continuar");
      return;
    }
    
    // Validate all required fields
    if (!formData.primeiro_nome.trim() || !formData.ultimo_nome.trim() || 
        !formData.numero_identificacao.trim() || !formData.email.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    
    // Validar força da senha se fornecida (PROFESSOR exige senha forte)
    if (formData.senha) {
      const isStrong = isPasswordStrong(formData.senha, false, 'PROFESSOR');
      if (!isStrong) {
        toast.error("Senha muito fraca. Utilize letras maiúsculas, números e símbolos.");
        return;
      }
    }
    
    createMutation.mutate();
  };

  const getInputClassName = (field: string, value: string) => {
    const baseClass = "";
    if (isFieldInvalid(field, value)) {
      return `${baseClass} border-red-500 focus:border-red-500 focus:ring-red-500`;
    }
    return baseClass;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin-dashboard/gestao-professores")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t('pages.professores')}</h1>
        </div>
        <div className="text-sm text-muted-foreground">
          Dashboard &gt; <span className="text-primary">Professores</span>
        </div>
      </div>

      {/* Success Credentials Display */}
      {createdCredentials && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-4">Professor Cadastrado com Sucesso!</h3>
            <div className="space-y-2">
              <p><strong>Email:</strong> {createdCredentials.email}</p>
              <p><strong>Senha:</strong> {createdCredentials.password}</p>
            </div>
            <Button 
              className="mt-4"
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nSenha: ${createdCredentials.password}`);
                toast.success("Credenciais copiadas!");
              }}
            >
              Copiar Credenciais
            </Button>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: Personal Details */}
        {currentStep >= 1 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>DADOS PESSOAIS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
                {/* Profile Image */}
                <div className="space-y-2">
                  <Label>Foto de Perfil</Label>
                  <div className="relative w-32 h-32 mx-auto lg:mx-0">
                    <Avatar className="w-32 h-32 border-4 border-muted">
                      <AvatarImage src={avatarPreview || undefined} />
                      <AvatarFallback className="bg-muted">
                        <User className="h-16 w-16 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="avatar-upload"
                      className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
                    >
                      <Camera className="h-4 w-4" />
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center lg:text-left">
                    * Apenas JPEG, PNG e WEBP. Máximo 2MB
                  </p>
                  {avatarError && (
                    <p className="text-xs text-red-500 text-center lg:text-left mt-1">
                      {avatarError}
                    </p>
                  )}
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* Gender */}
                  <div className="space-y-2">
                    <Label>Gênero</Label>
                    <RadioGroup
                      value={formData.genero}
                      onValueChange={(value) => handleInputChange("genero", value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Masculino" id="male" />
                        <Label htmlFor="male" className="font-normal">Masculino</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Feminino" id="female" />
                        <Label htmlFor="female" className="font-normal">Feminino</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Outro" id="other" />
                        <Label htmlFor="other" className="font-normal">Outro</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primeiro_nome">Primeiro Nome *</Label>
                      <Input
                        id="primeiro_nome"
                        value={formData.primeiro_nome}
                        onChange={(e) => handleInputChange("primeiro_nome", e.target.value)}
                        onBlur={() => handleBlur("primeiro_nome")}
                        placeholder="Primeiro Nome"
                        className={getInputClassName("primeiro_nome", formData.primeiro_nome)}
                      />
                      {isFieldInvalid("primeiro_nome", formData.primeiro_nome) && (
                        <p className="text-xs text-red-500">Campo obrigatório</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome_meio">Nome do Meio</Label>
                      <Input
                        id="nome_meio"
                        value={formData.nome_meio}
                        onChange={(e) => handleInputChange("nome_meio", e.target.value)}
                        placeholder="Nome do Meio"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ultimo_nome">Último Nome *</Label>
                      <Input
                        id="ultimo_nome"
                        value={formData.ultimo_nome}
                        onChange={(e) => handleInputChange("ultimo_nome", e.target.value)}
                        onBlur={() => handleBlur("ultimo_nome")}
                        placeholder="Último Nome"
                        className={getInputClassName("ultimo_nome", formData.ultimo_nome)}
                      />
                      {isFieldInvalid("ultimo_nome", formData.ultimo_nome) && (
                        <p className="text-xs text-red-500">Campo obrigatório</p>
                      )}
                    </div>
                  </div>

                  {/* BI Field - Important */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numero_identificacao">Número de BI *</Label>
                      <Input
                        id="numero_identificacao"
                        value={formData.numero_identificacao}
                        onChange={(e) => handleInputChange("numero_identificacao", e.target.value)}
                        onBlur={() => handleBlur("numero_identificacao")}
                        placeholder="Ex: 000000000LA000"
                        className={getInputClassName("numero_identificacao", formData.numero_identificacao)}
                      />
                      {isFieldInvalid("numero_identificacao", formData.numero_identificacao) && (
                        <p className="text-xs text-red-500">Campo obrigatório</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) => handleInputChange("telefone", e.target.value)}
                        placeholder="(XXX)-(XXX)-(XXXX)"
                      />
                    </div>
                  </div>

                  {/* Additional Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                      <Input
                        id="data_nascimento"
                        type="date"
                        value={formData.data_nascimento}
                        onChange={(e) => handleInputChange("data_nascimento", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipo_sanguineo">Tipo Sanguíneo</Label>
                      <Select
                        value={formData.tipo_sanguineo}
                        onValueChange={(value) => handleInputChange("tipo_sanguineo", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {BLOOD_GROUPS.map((group) => (
                            <SelectItem key={group} value={group}>
                              {group}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qualificacao">Qualificação</Label>
                      <Input
                        id="qualificacao"
                        value={formData.qualificacao}
                        onChange={(e) => handleInputChange("qualificacao", e.target.value)}
                        placeholder="Ex: Mestrado em Educação"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Account Information */}
        {currentStep >= 2 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>INFORMAÇÕES DA CONTA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    placeholder="professor@email.com"
                    className={getInputClassName("email", formData.email)}
                  />
                  {isFieldInvalid("email", formData.email) && (
                    <p className="text-xs text-red-500">Campo obrigatório</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha (opcional)</Label>
                  <Input
                    id="senha"
                    type="password"
                    value={formData.senha}
                    onChange={(e) => handleInputChange("senha", e.target.value)}
                    placeholder="Deixe em branco para gerar automaticamente"
                  />
                  {formData.senha && (
                    <PasswordStrengthIndicator 
                      password={formData.senha} 
                      userRole="PROFESSOR"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Se não informada, uma senha será gerada automaticamente
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmar_senha">Confirmar Senha</Label>
                  <Input
                    id="confirmar_senha"
                    type="password"
                    value={formData.confirmar_senha}
                    onChange={(e) => handleInputChange("confirmar_senha", e.target.value)}
                    placeholder="Confirme a senha"
                  />
                  {formData.confirmar_senha && formData.senha !== formData.confirmar_senha && (
                    <p className="text-xs text-red-500">As senhas não coincidem</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Address */}
        {currentStep >= 3 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>ENDEREÇO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="morada">Morada</Label>
                <Input
                  id="morada"
                  value={formData.morada}
                  onChange={(e) => handleInputChange("morada", e.target.value)}
                  placeholder="Rua, número, bairro..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => handleInputChange("cidade", e.target.value)}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo_postal">Código Postal</Label>
                  <Input
                    id="codigo_postal"
                    value={formData.codigo_postal}
                    onChange={(e) => handleInputChange("codigo_postal", e.target.value)}
                    placeholder="Código Postal"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pais">País</Label>
                  <Select
                    value={formData.pais || ""}
                    onValueChange={(value) => {
                      handleInputChange("pais", value);
                      handleInputChange("provincia", ""); // Reset provincia when country changes
                      handleInputChange("municipio", ""); // Reset municipio when country changes
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o país" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provincia">Província</Label>
                  <Select
                    value={formData.provincia || ""}
                    onValueChange={(value) => {
                      handleInputChange("provincia", value);
                      handleInputChange("municipio", ""); // Reset municipio when province changes
                    }}
                    disabled={!formData.pais}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.pais ? "Selecione a província" : "Selecione primeiro o país"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.pais && getProvincesByCountry(formData.pais).map((province) => (
                        <SelectItem key={province} value={province}>
                          {province}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="municipio">Município</Label>
                  <Select
                    value={formData.municipio || ""}
                    onValueChange={(value) => handleInputChange("municipio", value)}
                    disabled={!formData.pais || !formData.provincia}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.pais && formData.provincia ? "Selecione o município" : formData.pais ? "Selecione primeiro a província" : "Selecione primeiro o país"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.pais && formData.provincia && getMunicipiosByProvince(formData.pais, formData.provincia).map((municipio) => (
                        <SelectItem key={municipio} value={municipio}>
                          {municipio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: School Details */}
        {currentStep >= 3 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>DETALHES PROFISSIONAIS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_admissao">Data de Admissão</Label>
                  <Input
                    id="data_admissao"
                    type="date"
                    value={formData.data_admissao}
                    onChange={(e) => handleInputChange("data_admissao", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo_atual">Cargo Atual</Label>
                  <Input
                    id="cargo_atual"
                    value={formData.cargo_atual}
                    onChange={(e) => handleInputChange("cargo_atual", e.target.value)}
                    placeholder="Ex: Professor de Matemática"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo_funcionario">Código de Funcionário</Label>
                  <Input
                    id="codigo_funcionario"
                    value={formData.codigo_funcionario}
                    onChange={(e) => handleInputChange("codigo_funcionario", e.target.value)}
                    placeholder="Ex: PROF-001"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="horas_trabalho">Horas de Trabalho</Label>
                <Input
                  id="horas_trabalho"
                  value={formData.horas_trabalho}
                  onChange={(e) => handleInputChange("horas_trabalho", e.target.value)}
                  placeholder="Ex: 40h semanais"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            Voltar
          </Button>
          <div className="flex gap-2">
            {currentStep < 3 ? (
              <Button type="button" onClick={handleNext}>
                Próximo
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={
                  createMutation.isPending || 
                  !!avatarError ||
                  (formData.senha && !isPasswordStrong(formData.senha, false, 'PROFESSOR'))
                }
              >
                {createMutation.isPending ? "Cadastrando..." : "Cadastrar Professor"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
