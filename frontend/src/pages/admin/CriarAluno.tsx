import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cursosApi, turmasApi, turnosApi, alunosApi, storageApi, documentosAlunoApi, profilesApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, User, Camera, FileText, Upload, X, Sun, Sunset, Moon, Clock, Loader2, MapPin, Users, GraduationCap, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
// REMOVIDO: AnoLetivoAtivoGuard - Aluno é entidade ADMINISTRATIVA, não depende de Ano Letivo

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COUNTRIES = ["Angola", "Portugal", "Brasil", "Moçambique", "Cabo Verde", "São Tomé e Príncipe"];

const TIPOS_DOCUMENTO = [
  { value: "bi_copia", label: "Cópia do BI" },
  { value: "certificado", label: "Certificado" },
  { value: "comprovante_residencia", label: "Comprovante de Residência" },
  { value: "declaracao", label: "Declaração" },
  { value: "outro", label: "Outro" },
];

interface DocumentoUpload {
  file: File;
  tipo: string;
  descricao?: string;
}

interface Turma {
  id: string;
  nome: string;
  ano: number;
  semestre: string;
  turno: string | null;
  curso_id: string;
  curso: { id: string; nome: string } | null;
}

interface Turno {
  id: string;
  nome: string;
  hora_inicio: string | null;
  hora_fim: string | null;
}

interface Curso {
  id: string;
  nome: string;
  codigo: string;
}

export default function CriarAluno() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const { isSecundario } = useInstituicao();
  const queryClient = useQueryClient();
  const isSecretaria = role === 'SECRETARIA' || location.pathname.includes('secretaria');
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const backUrl = isSecretaria ? '/secretaria-dashboard/alunos' : '/admin-dashboard/gestao-alunos';
  const [activeTab, setActiveTab] = useState("dados-pessoais");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [sameAsCurrentAddress, setSameAsCurrentAddress] = useState(false);
  
  // Parent avatar
  const [parentAvatarFile, setParentAvatarFile] = useState<File | null>(null);
  const [parentAvatarPreview, setParentAvatarPreview] = useState<string | null>(null);
  
  // Documents upload
  const [documentos, setDocumentos] = useState<DocumentoUpload[]>([]);
  const [currentDocTipo, setCurrentDocTipo] = useState("");
  const [selectedCursoId, setSelectedCursoId] = useState<string>("");
  const [selectedCursoEstudoId, setSelectedCursoEstudoId] = useState<string>("");
  const [selectedTurnoId, setSelectedTurnoId] = useState<string>("");
  
  const [formData, setFormData] = useState({
    // Personal Details
    genero: "Masculino",
    primeiro_nome: "",
    nome_meio: "",
    ultimo_nome: "",
    data_nascimento: "",
    tipo_sanguineo: "",
    telefone: "",
    // Current Address
    morada: "",
    cidade: "",
    pais: "",
    codigo_postal: "",
    // Permanent Address
    morada_permanente: "",
    cidade_permanente: "",
    pais_permanente: "",
    codigo_postal_permanente: "",
    // Parent Details
    genero_pai: "Masculino",
    nome_pai: "",
    nome_meio_pai: "",
    sobrenome_pai: "",
    profissao_pai: "",
    nome_mae: "",
    // Contact Information (email para contato, não para acesso)
    email: "",
    // School Details
    data_matricula: new Date().toISOString().split('T')[0],
    turma_id: "",
    numero_identificacao: "",
  });


  const { data: cursos } = useQuery({
    queryKey: ["cursos-select", isSecundario],
    queryFn: async () => {
      const data = await cursosApi.getAll({ ativo: true });
      let filtered = data || [];
      
      // Para Ensino Médio, filtrar apenas cursos do tipo 'classe'
      if (isSecundario) {
        filtered = filtered.filter((c: any) => c.tipo === "classe");
      } else {
        // Para universidade, filtrar apenas cursos do tipo 'geral' ou null
        filtered = filtered.filter((c: any) => c.tipo === "geral" || !c.tipo);
      }
      
      return filtered.sort((a: any, b: any) => a.nome.localeCompare(b.nome)) as (Curso & { tipo: string | null })[];
    },
  });

  const { data: turmas } = useQuery({
    queryKey: ["turmas-select"],
    queryFn: async () => {
      const data = await turmasApi.getAll({});
      return (data || []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        ano: t.ano,
        semestre: t.semestre,
        turno: t.turno,
        curso_id: t.cursoId || t.curso_id,
        curso: t.curso ? { id: t.curso.id, nome: t.curso.nome } : null,
      })) as Turma[];
    },
  });

  // Cursos de Estudo (Ciências, Informática, etc.) - apenas para Ensino Médio
  const { data: cursosEstudo } = useQuery({
    queryKey: ["cursos-estudo-select"],
    queryFn: async () => {
      const data = await cursosApi.getAll({ ativo: true });
      return ((data || []).filter((c: any) => c.tipo === "curso_ensino_medio") as Curso[])
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
    enabled: isSecundario,
  });

  const { data: turnos } = useQuery({
    queryKey: ["turnos-ativos"],
    queryFn: async () => {
      const data = await turnosApi.getAll({ ativo: true });
      return (data || []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        hora_inicio: t.horaInicio || t.hora_inicio,
        hora_fim: t.horaFim || t.hora_fim,
      })) as Turno[];
    },
  });

  // Filter turmas by selected curso, curso_estudo and turno for Ensino Médio
  const filteredTurmas = useMemo(() => {
    if (!turmas) return [];
    
    let filtered = turmas;
    
    // Filter by curso (classe) for Ensino Médio
    if (isSecundario && selectedCursoId) {
      filtered = filtered.filter(t => t.curso_id === selectedCursoId);
    }
    
    // Filter by turno if selected
    if (selectedTurnoId) {
      const selectedTurno = turnos?.find(t => t.id === selectedTurnoId);
      if (selectedTurno) {
        filtered = filtered.filter(t => {
          if (!t.turno) return false;
          const turnoStr = String(t.turno);
          return turnoStr.toLowerCase().includes(selectedTurno.nome.toLowerCase());
        });
      }
    }
    
    return filtered;
  }, [turmas, isSecundario, selectedCursoId, selectedTurnoId, turnos]);

  const uploadAvatar = async (userId: string, file: File): Promise<string> => {
    const uploadResult = await storageApi.upload('avatars', `${userId}/avatar`, file);
    return uploadResult.url;
  };

  // REMOVIDO: Aluno é entidade ADMINISTRATIVA - NUNCA depende de Ano Letivo

  const createMutation = useMutation({
    mutationFn: async () => {
      const nome_completo = [formData.primeiro_nome, formData.nome_meio, formData.ultimo_nome]
        .filter(Boolean)
        .join(" ").trim();
      
      // Validação adicional antes de enviar
      if (!nome_completo || nome_completo.length < 2) {
        throw new Error("Nome completo é obrigatório. Preencha pelo menos o primeiro e último nome.");
      }
      
      if (!formData.email || !formData.email.trim()) {
        throw new Error("Email é obrigatório");
      }
      
      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        throw new Error("Email inválido. Verifique o formato do email.");
      }

      const nome_pai_completo = [formData.nome_pai, formData.nome_meio_pai, formData.sobrenome_pai]
        .filter(Boolean)
        .join(" ");

      // Normalizar email antes de enviar
      const emailNormalizado = formData.email.trim().toLowerCase();
      
      // Preparar dados para envio - garantir tipos corretos
      // IMPORTANTE: Enviar apenas campos que o backend aceita no modelo User
      // Campos ignorados pelo backend (não enviar): profissao, tipoSanguineo, codigoPostal, nomePai, nomeMae
      const dadosEnvio: any = {
        email: emailNormalizado,
        nomeCompleto: nome_completo,
        role: 'ALUNO', // Garantir que role ALUNO seja enviada
      };
      
      // Campos opcionais do modelo User (apenas se preenchidos)
      if (formData.telefone?.trim()) {
        dadosEnvio.telefone = formData.telefone.trim();
      }
      
      if (formData.numero_identificacao?.trim()) {
        dadosEnvio.numeroIdentificacao = formData.numero_identificacao.trim();
      }
      
      if (formData.data_nascimento && formData.data_nascimento.trim() !== '') {
        dadosEnvio.dataNascimento = formData.data_nascimento;
      }
      
      if (formData.genero && formData.genero.trim()) {
        dadosEnvio.genero = formData.genero;
      }
      
      if (formData.morada?.trim()) {
        dadosEnvio.morada = formData.morada.trim();
      }
      
      if (formData.cidade?.trim()) {
        dadosEnvio.cidade = formData.cidade.trim();
      }
      
      if (formData.pais && formData.pais.trim()) {
        dadosEnvio.pais = formData.pais;
      }
      
      if (formData.senha?.trim()) {
        dadosEnvio.senha = formData.senha.trim();
      }
      
      // Campos que o backend processa mas não salva no User (enviar para processamento)
      if (formData.turma_id) {
        dadosEnvio.turmaId = formData.turma_id;
      }
      
      // Status do aluno (sempre "Ativo" para novos alunos)
      dadosEnvio.statusAluno = "Ativo";
      
      // Log para debug (apenas em desenvolvimento)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CriarAluno] Dados sendo enviados:', dadosEnvio);
      }
      
      // Create student via API
      // IMPORTANTE: Garantir que role ALUNO seja criada e instituicaoId seja do usuário autenticado (multi-tenant)
      const result = await alunosApi.create(dadosEnvio);

      if (!result.userId) {
        throw new Error("Resposta inválida do servidor");
      }

      const userId = result.userId;

      // Upload avatar if selected
      let avatarUrl = null;
      if (avatarFile && userId) {
        try {
          avatarUrl = await uploadAvatar(userId, avatarFile);
          // Update profile with avatar
          await profilesApi.update(userId, { avatarUrl });
        } catch (err) {
          console.error("Error uploading avatar:", err);
        }
      }

      // Upload documents if any
      for (const doc of documentos) {
        try {
          const fileExt = doc.file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const filePath = `${userId}/${fileName}`;

          const uploadResult = await storageApi.upload('documentos_alunos', filePath, doc.file);

          await documentosAlunoApi.create({
            alunoId: userId,
            nomeArquivo: doc.file.name,
            tipoDocumento: doc.tipo,
            descricao: doc.descricao || null,
            arquivoUrl: uploadResult.path || filePath,
            tamanhoBytes: doc.file.size,
          });
        } catch (docError) {
          console.error("Error saving document:", docError);
        }
      }

      return { userId, email: formData.email };
    },
    onSuccess: (result) => {
      // Invalidar todas as queries relacionadas a alunos
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      // Invalidar queries de listagem que podem incluir o novo aluno
      queryClient.invalidateQueries({ queryKey: ["alunos", undefined] });
      toast.success("Estudante cadastrado com sucesso!");
      navigate(backUrl);
    },
    onError: (error: any) => {
      console.error("[CriarAluno] Erro ao cadastrar:", error);
      
      // Extrair mensagem de erro mais detalhada
      let errorMessage = "Erro ao cadastrar estudante";
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Se houver detalhes de validação, mostrar
      if (error?.response?.data?.details) {
        const details = error.response.data.details;
        if (Array.isArray(details)) {
          const fieldErrors = details.map((d: any) => `${d.field}: ${d.message}`).join(", ");
          errorMessage += ` - ${fieldErrors}`;
        } else if (typeof details === 'string') {
          errorMessage += ` - ${details}`;
        }
      }
      
      toast.error(errorMessage);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error("A imagem deve ter no máximo 3MB");
        return;
      }
      if (!file.type.includes("jpeg") && !file.type.includes("jpg") && !file.type.includes("png")) {
        toast.error("Apenas imagens JPEG e PNG são permitidas");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error("A imagem deve ter no máximo 3MB");
        return;
      }
      setParentAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setParentAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentDocTipo) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("O arquivo deve ter no máximo 10MB");
        return;
      }
      setDocumentos(prev => [...prev, { file, tipo: currentDocTipo }]);
      setCurrentDocTipo("");
      e.target.value = "";
    } else if (file && !currentDocTipo) {
      toast.error("Selecione o tipo de documento primeiro");
      e.target.value = "";
    }
  };

  const removeDocument = (index: number) => {
    setDocumentos(prev => prev.filter((_, i) => i !== index));
  };

  const getTipoLabel = (tipo: string) => {
    return TIPOS_DOCUMENTO.find((t) => t.value === tipo)?.label || tipo;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSameAddressChange = (checked: boolean) => {
    setSameAsCurrentAddress(checked);
    if (checked) {
      setFormData(prev => ({
        ...prev,
        morada_permanente: prev.morada,
        cidade_permanente: prev.cidade,
        pais_permanente: prev.pais,
        codigo_postal_permanente: prev.codigo_postal,
      }));
    }
  };

  // Validações e navegação de steps removidas - agora usando Tabs

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações obrigatórias
    const nome_completo = [formData.primeiro_nome, formData.nome_meio, formData.ultimo_nome]
      .filter(Boolean)
      .join(" ").trim();
    
    if (!nome_completo || nome_completo.length < 2) {
      toast.error("Nome completo é obrigatório. Preencha pelo menos o primeiro e último nome.");
      setActiveTab("dados-pessoais");
      return;
    }
    
    if (!formData.email || !formData.email.trim()) {
      toast.error("Email é obrigatório");
      setActiveTab("acesso");
      return;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast.error("Email inválido. Verifique o formato do email.");
      setActiveTab("acesso");
      return;
    }
    
    if (!formData.numero_identificacao || !formData.numero_identificacao.trim()) {
      toast.error("Número de identificação (BI) é obrigatório");
      setActiveTab("dados-pessoais");
      return;
    }
    
    createMutation.mutate();
  };

  return (
    <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(backUrl)}
                className="hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Cadastrar Estudante</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Preencha as informações do novo estudante
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="dados-pessoais" className="space-y-6" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dados-pessoais" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Dados Pessoais</span>
            </TabsTrigger>
            <TabsTrigger value="endereco" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Endereço</span>
            </TabsTrigger>
            <TabsTrigger value="responsaveis" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Responsáveis</span>
            </TabsTrigger>
            <TabsTrigger value="academicos" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">Acadêmicos</span>
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documentos</span>
            </TabsTrigger>
            {(isAdmin || isSecretaria) && (
              <TabsTrigger value="acesso" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">🔐 Acesso</span>
              </TabsTrigger>
            )}
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Aba: Dados Pessoais */}
            <TabsContent value="dados-pessoais">
              <Card>
            <CardHeader className="border-b bg-muted/50">
              <CardTitle className="text-xl font-semibold">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
                {/* Profile Image */}
                <div className="space-y-2">
                  <Label>Foto de Perfil</Label>
                  <div className="relative w-32 h-32 mx-auto lg:mx-0">
                    <Avatar className="w-32 h-32 border-4 border-muted shadow-lg">
                      <AvatarImage src={avatarPreview || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <User className="h-16 w-16" />
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="avatar-upload"
                      className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2.5 cursor-pointer hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
                    >
                      <Camera className="h-4 w-4" />
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center lg:text-left">
                    * Apenas JPEG e PNG. Max 3 MB
                  </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* Name Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primeiro_nome">Primeiro Nome *</Label>
                      <Input
                        id="primeiro_nome"
                        value={formData.primeiro_nome}
                        onChange={(e) => handleInputChange("primeiro_nome", e.target.value)}
                        placeholder="Primeiro Nome"
                        required
                      />
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
                        placeholder="Último Nome"
                        required
                      />
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numero_identificacao" className="text-sm font-medium">Número de Identificação (BI)</Label>
                      <Input
                        id="numero_identificacao"
                        value={formData.numero_identificacao}
                        onChange={(e) => handleInputChange("numero_identificacao", e.target.value)}
                        placeholder="Ex: 000000000LA000"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_nascimento" className="text-sm font-medium">Data de Nascimento</Label>
                      <Input
                        id="data_nascimento"
                        type="date"
                        value={formData.data_nascimento}
                        onChange={(e) => handleInputChange("data_nascimento", e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Género</Label>
                      <RadioGroup
                        value={formData.genero}
                        onValueChange={(value) => handleInputChange("genero", value)}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Masculino" id="gender-male" />
                          <Label htmlFor="gender-male" className="font-normal cursor-pointer">Masculino</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Feminino" id="gender-female" />
                          <Label htmlFor="gender-female" className="font-normal cursor-pointer">Feminino</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Outro" id="gender-other" />
                          <Label htmlFor="gender-other" className="font-normal cursor-pointer">Outro</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tipo Sanguíneo</Label>
                      <Select
                        value={formData.tipo_sanguineo}
                        onValueChange={(value) => handleInputChange("tipo_sanguineo", value)}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {BLOOD_GROUPS.map((bg) => (
                            <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            {/* Aba: Endereço */}
            <TabsContent value="endereco">
              <Card>
                <CardHeader className="border-b bg-muted/50">
                  <CardTitle className="text-xl font-semibold">Endereço & Contactos</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email de Contato</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="email@exemplo.com"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone" className="text-sm font-medium">Telefone</Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) => handleInputChange("telefone", e.target.value)}
                        placeholder="(+244) XXX-XXX-XXX"
                        className="h-10"
                      />
                    </div>
                  </div>

                  {/* Current Address Section */}
                  <div className="space-y-4 border-t pt-6">
                    <h4 className="text-base font-semibold mb-4">Endereço Atual</h4>
                    <div className="space-y-2">
                      <Label htmlFor="morada" className="text-sm font-medium">Endereço Atual *</Label>
                      <Input
                        id="morada"
                        value={formData.morada}
                        onChange={(e) => handleInputChange("morada", e.target.value)}
                        placeholder="Rua, número, bairro"
                        className="h-10"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cidade" className="text-sm font-medium">Cidade</Label>
                        <Input
                          id="cidade"
                          value={formData.cidade}
                          onChange={(e) => handleInputChange("cidade", e.target.value)}
                          placeholder="Nome da Cidade"
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">País</Label>
                        <Select
                          value={formData.pais}
                          onValueChange={(value) => handleInputChange("pais", value)}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Selecionar País" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
                              <SelectItem key={country} value={country}>{country}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codigo_postal" className="text-sm font-medium">Código Postal</Label>
                        <Input
                          id="codigo_postal"
                          value={formData.codigo_postal}
                          onChange={(e) => handleInputChange("codigo_postal", e.target.value)}
                          placeholder="Código Postal"
                          className="h-10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Same as Above Checkbox */}
                  <div className="flex items-center space-x-2 pt-4 border-t">
                    <Checkbox 
                      id="same-address" 
                      checked={sameAsCurrentAddress}
                      onCheckedChange={handleSameAddressChange}
                    />
                    <Label htmlFor="same-address" className="font-normal text-sm cursor-pointer">
                      Endereço permanente igual ao endereço atual
                    </Label>
                  </div>

                  {/* Permanent Address Section */}
                  <div className="space-y-4 border-t pt-6">
                    <h4 className="text-base font-semibold mb-4">Endereço Permanente</h4>
                    <div className="space-y-2">
                      <Label htmlFor="morada_permanente" className="text-sm font-medium">Endereço Permanente</Label>
                      <Input
                        id="morada_permanente"
                        value={formData.morada_permanente}
                        onChange={(e) => handleInputChange("morada_permanente", e.target.value)}
                        placeholder="Rua, número, bairro"
                        className="h-10"
                        disabled={sameAsCurrentAddress}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cidade_permanente" className="text-sm font-medium">Cidade</Label>
                        <Input
                          id="cidade_permanente"
                          value={formData.cidade_permanente}
                          onChange={(e) => handleInputChange("cidade_permanente", e.target.value)}
                          placeholder="Nome da Cidade"
                          className="h-10"
                          disabled={sameAsCurrentAddress}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">País</Label>
                        <Select
                          value={formData.pais_permanente}
                          onValueChange={(value) => handleInputChange("pais_permanente", value)}
                          disabled={sameAsCurrentAddress}
                        >
                          <SelectTrigger className="h-10" disabled={sameAsCurrentAddress}>
                            <SelectValue placeholder="Selecionar País" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
                              <SelectItem key={country} value={country}>{country}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codigo_postal_permanente" className="text-sm font-medium">Código Postal</Label>
                        <Input
                          id="codigo_postal_permanente"
                          value={formData.codigo_postal_permanente}
                          onChange={(e) => handleInputChange("codigo_postal_permanente", e.target.value)}
                          placeholder="Código Postal"
                          className="h-10"
                          disabled={sameAsCurrentAddress}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aba: Responsáveis */}
            <TabsContent value="responsaveis">
              <Card>
            <CardHeader className="border-b bg-muted/50">
              <CardTitle className="text-xl font-semibold">Dados do Encarregado</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
                {/* Parent Profile Image */}
                <div className="space-y-2">
                  <Label>Foto do Encarregado</Label>
                  <div className="relative w-32 h-32 mx-auto lg:mx-0">
                    <Avatar className="w-32 h-32 border-4 border-muted">
                      <AvatarImage src={parentAvatarPreview || undefined} />
                      <AvatarFallback className="bg-muted">
                        <User className="h-16 w-16 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="parent-avatar-upload"
                      className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
                    >
                      <Camera className="h-4 w-4" />
                    </label>
                    <input
                      id="parent-avatar-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleParentFileChange}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center lg:text-left">
                    * Apenas JPEG e PNG. Max 3 MB
                  </p>
                </div>

                {/* Parent Form Fields */}
                <div className="space-y-4">
                  {/* Gender */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Gênero do Encarregado</Label>
                    <RadioGroup
                      value={formData.genero_pai}
                      onValueChange={(value) => handleInputChange("genero_pai", value)}
                      className="flex gap-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Masculino" id="parent-male" />
                        <Label htmlFor="parent-male" className="font-normal cursor-pointer">Masculino</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Feminino" id="parent-female" />
                        <Label htmlFor="parent-female" className="font-normal cursor-pointer">Feminino</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Outro" id="parent-other" />
                        <Label htmlFor="parent-other" className="font-normal cursor-pointer">Outro</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Parent Name Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome_pai" className="text-sm font-medium">Primeiro Nome</Label>
                      <Input
                        id="nome_pai"
                        value={formData.nome_pai}
                        onChange={(e) => handleInputChange("nome_pai", e.target.value)}
                        placeholder="Primeiro Nome"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome_meio_pai" className="text-sm font-medium">Nome do Meio</Label>
                      <Input
                        id="nome_meio_pai"
                        value={formData.nome_meio_pai}
                        onChange={(e) => handleInputChange("nome_meio_pai", e.target.value)}
                        placeholder="Nome do Meio"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sobrenome_pai" className="text-sm font-medium">Último Nome</Label>
                      <Input
                        id="sobrenome_pai"
                        value={formData.sobrenome_pai}
                        onChange={(e) => handleInputChange("sobrenome_pai", e.target.value)}
                        placeholder="Último Nome"
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profissao_pai" className="text-sm font-medium">Profissão do Encarregado</Label>
                    <Input
                      id="profissao_pai"
                      value={formData.profissao_pai}
                      onChange={(e) => handleInputChange("profissao_pai", e.target.value)}
                      placeholder="Profissão do Encarregado"
                      className="h-10"
                    />
                  </div>

                  {/* Nome da Mãe */}
                  <div className="space-y-2">
                    <Label htmlFor="nome_mae" className="text-sm font-medium">Nome da Mãe</Label>
                    <Input
                      id="nome_mae"
                      value={formData.nome_mae}
                      onChange={(e) => handleInputChange("nome_mae", e.target.value)}
                      placeholder="Nome completo da mãe"
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
            </TabsContent>

            {/* Aba: Acadêmicos */}
            <TabsContent value="academicos">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
              <CardHeader className="border-b bg-muted/50">
                <CardTitle className="text-xl font-semibold">Informações de Contato</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email de Contato</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="aluno@instituicao.com"
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email para contato. A conta de acesso será criada separadamente na aba "Acesso ao Sistema".
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Detalhes Escolares */}
              <Card>
                <CardHeader className="border-b bg-muted/50">
                  <CardTitle className="text-xl font-semibold">Detalhes Escolares</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_matricula" className="text-sm font-medium">Data de Matrícula</Label>
                    <Input
                      id="data_matricula"
                      type="date"
                      value={formData.data_matricula}
                      onChange={(e) => handleInputChange("data_matricula", e.target.value)}
                      className="h-10"
                    />
                  </div>
                  {/* Classe Selector - Only for Ensino Médio */}
                  {isSecundario && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Classe *</Label>
                      <Select
                        value={selectedCursoId}
                        onValueChange={(value) => {
                          setSelectedCursoId(value);
                          setSelectedTurnoId("");
                          handleInputChange("turma_id", "");
                        }}
                      >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecionar Classe (ex: 10ª, 11ª, 12ª)">
                          {selectedCursoId && cursos?.find(c => String(c.id) === selectedCursoId)?.nome}
                        </SelectValue>
                      </SelectTrigger>
                        <SelectContent>
                          {cursos?.map((curso) => (
                            <SelectItem key={curso.id} value={String(curso.id)}>
                              {curso.nome || String(curso.id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Selecione primeiro a classe para ver as turmas disponíveis
                      </p>
                    </div>
                  )}

                  {/* Turno Selector - Only for Ensino Médio */}
                  {isSecundario && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Turno *</Label>
                      <Select
                        value={selectedTurnoId}
                        onValueChange={(value) => {
                          setSelectedTurnoId(value);
                          handleInputChange("turma_id", "");
                        }}
                        disabled={!selectedCursoId}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={!selectedCursoId ? "Selecione a classe primeiro" : "Selecionar Turno"}>
                            {selectedTurnoId && turnos?.find(t => String(t.id) === selectedTurnoId)?.nome}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {turnos?.map((turno) => {
                            const getTurnoIcon = () => {
                              const nomeLower = turno.nome.toLowerCase();
                              if (nomeLower.includes('manhã') || nomeLower.includes('manha')) return <Sun className="h-4 w-4 text-amber-500" />;
                              if (nomeLower.includes('tarde')) return <Sunset className="h-4 w-4 text-orange-500" />;
                              if (nomeLower.includes('noite')) return <Moon className="h-4 w-4 text-indigo-500" />;
                              return <Clock className="h-4 w-4" />;
                            };
                            
                            return (
                              <SelectItem key={turno.id} value={String(turno.id)}>
                                <div className="flex items-center gap-2">
                                  {getTurnoIcon()}
                                  <span>{turno.nome || String(turno.id)}</span>
                                  {turno.hora_inicio && turno.hora_fim && (
                                    <span className="text-muted-foreground text-xs">
                                      ({String(turno.hora_inicio)} - {String(turno.hora_fim)})
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Turma Selector */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Turma {isSecundario ? "*" : ""}</Label>
                    <Select
                      value={formData.turma_id}
                      onValueChange={(value) => handleInputChange("turma_id", value)}
                      disabled={isSecundario && (!selectedCursoId || !selectedTurnoId)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={
                          isSecundario && !selectedCursoId 
                            ? "Selecione a classe primeiro" 
                            : isSecundario && !selectedTurnoId 
                              ? "Selecione o turno primeiro"
                              : "Selecionar Turma"
                        }>
                          {formData.turma_id && filteredTurmas?.find(t => String(t.id) === formData.turma_id)?.nome}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTurmas && filteredTurmas.length > 0 ? (
                          filteredTurmas.map((turma) => {
                            const getTurnoIcon = () => {
                              if (!turma.turno) return null;
                              const turnoStr = String(turma.turno);
                              const nomeLower = turnoStr.toLowerCase();
                              if (nomeLower.includes('manhã') || nomeLower.includes('manha')) return <Sun className="h-4 w-4 text-amber-500" />;
                              if (nomeLower.includes('tarde')) return <Sunset className="h-4 w-4 text-orange-500" />;
                              if (nomeLower.includes('noite')) return <Moon className="h-4 w-4 text-indigo-500" />;
                              return <Clock className="h-4 w-4" />;
                            };
                            
                            return (
                              <SelectItem key={turma.id} value={String(turma.id)}>
                                <div className="flex items-center gap-2">
                                  {getTurnoIcon()}
                                  <span>
                                    {turma.nome || String(turma.id)} 
                                    {!isSecundario && turma.curso?.nome && ` - ${String(turma.curso.nome)}`} 
                                    {turma.ano && ` (${String(turma.ano)})`}
                                  </span>
                                  {!isSecundario && turma.turno && (
                                    <Badge variant="outline" className="ml-1 text-xs">
                                      {String(turma.turno)}
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })
                        ) : (
                          <SelectItem value="no-turmas" disabled>
                            {isSecundario && selectedCursoId && selectedTurnoId
                              ? "Nenhuma turma cadastrada para esta classe e turno" 
                              : "Nenhuma turma disponível"}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {isSecundario && selectedCursoId && selectedTurnoId && filteredTurmas?.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Não há turmas cadastradas para esta classe e turno. Cadastre turmas em Gestão Académica → Turmas.
                      </p>
                    )}
                  </div>

                  {/* Document Upload Section */}
                  <div className="space-y-3 border-t pt-4">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Documentos (Certificados, Cópia BI, etc.)
                    </Label>
                    
                    <div className="flex gap-2">
                      <Select value={currentDocTipo} onValueChange={setCurrentDocTipo}>
                        <SelectTrigger className="w-[180px] h-10">
                          <SelectValue placeholder="Tipo documento" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_DOCUMENTO.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex-1">
                        <Input
                          type="file"
                          onChange={handleDocumentFileChange}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          disabled={!currentDocTipo}
                          className="h-10"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecione o tipo e depois o arquivo. PDF, imagens ou Word. Máx 10MB por arquivo.
                    </p>

                    {documentos.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {documentos.map((doc, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">{doc.file.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {getTipoLabel(doc.tipo)}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDocument(index)}
                              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t">
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending}
                      className="h-10 px-6 bg-primary hover:bg-primary/90"
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Cadastrar Estudante"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            </TabsContent>

            {/* Aba: Documentos */}
            <TabsContent value="documentos">
              <Card>
                <CardHeader className="border-b bg-muted/50">
                  <CardTitle className="text-xl font-semibold">Documentos</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Os documentos podem ser adicionados após o cadastro do estudante.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aba: Acesso (apenas Admin/Secretaria) */}
            {(isAdmin || isSecretaria) && (
              <TabsContent value="acesso">
                <Card>
                  <CardHeader className="border-b bg-muted/50">
                    <CardTitle className="text-xl font-semibold">Acesso ao Sistema</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="senha" className="text-sm font-medium">
                        Senha de Acesso (Opcional)
                      </Label>
                      <Input
                        id="senha"
                        type="password"
                        value={formData.senha}
                        onChange={(e) => handleInputChange("senha", e.target.value)}
                        placeholder="Deixe em branco para criar depois"
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground">
                        Se não fornecer uma senha, a conta será criada sem senha e você poderá definir depois na edição do estudante.
                        O email de acesso será o mesmo informado na aba "Endereço".
                      </p>
                    </div>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Importante:</strong> O aluno será criado com role <strong>ALUNO</strong> automaticamente.
                        Se fornecer senha, o aluno poderá fazer login imediatamente após o cadastro.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </form>
        </Tabs>
        </div>
      </DashboardLayout>
  );
}
