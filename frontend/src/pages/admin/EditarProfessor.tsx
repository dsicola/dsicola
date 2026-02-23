import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { profilesApi, storageApi, authApi, professoresApi, departamentosApi, cargosApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { COUNTRIES, getProvincesByCountry, getMunicipiosByProvince } from "@/utils/countries-provinces";

export default function EditarProfessor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { instituicaoId } = useInstituicao();
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch departamentos and cargos
  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos", instituicaoId],
    queryFn: async () => {
      const data = await departamentosApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ["cargos", instituicaoId],
    queryFn: async () => {
      const data = await cargosApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
  });

  const [formData, setFormData] = useState({
    nome_completo: '',
    email: '',
    telefone: '',
    numero_identificacao: '',
    data_nascimento: '',
    morada: '',
    cidade: '',
    pais: '',
    provincia: '',
    municipio: '',
    nome_pai: '',
    nome_mae: '',
    foto_url: '',
    departamento_id: '',
    cargo_id: '',
    salario: 0,
    data_admissao: new Date().toISOString().split('T')[0],
    data_fim_contrato: '',
    tipo_contrato: 'Efetivo',
    carga_horaria: '8h/dia',
    status: 'Ativo',
    observacoes: '',
  });

  const { data: professor, isLoading: isLoadingProfessor } = useQuery({
    queryKey: ["professor", id],
    queryFn: async () => {
      if (!id) throw new Error("ID não fornecido");
      const data = await professoresApi.getById(id);
      return data;
    },
    enabled: !!id,
  });

  // Populate form when professor data is loaded
  useEffect(() => {
    if (professor) {
      setFormData({
        nome_completo: professor.nome_completo || professor.nomeCompleto || '',
        email: professor.email || '',
        telefone: professor.telefone || '',
        numero_identificacao: professor.numero_identificacao || professor.numeroIdentificacao || '',
        data_nascimento: professor.data_nascimento || professor.dataNascimento || '',
        morada: professor.morada || '',
        cidade: professor.cidade || '',
        pais: professor.pais || '',
        provincia: professor.provincia || '',
        municipio: professor.municipio || '',
        nome_pai: professor.nome_pai || professor.nomePai || '',
        nome_mae: professor.nome_mae || professor.nomeMae || '',
        foto_url: professor.foto_url || professor.avatar_url || professor.avatarUrl || '',
        departamento_id: professor.departamento_id || professor.departamentoId || '',
        cargo_id: professor.cargo_id || professor.cargoId || '',
        salario: professor.salario || professor.salarioBase || 0,
        data_admissao: professor.data_admissao || professor.dataAdmissao || new Date().toISOString().split('T')[0],
        data_fim_contrato: professor.data_fim_contrato || professor.dataFimContrato || '',
        tipo_contrato: professor.tipo_contrato || professor.tipoContrato || 'Efetivo',
        carga_horaria: professor.carga_horaria || professor.cargaHoraria || '8h/dia',
        status: professor.status || 'Ativo',
        observacoes: professor.observacoes || '',
      });
      setAvatarPreview(professor.avatar_url || professor.foto_url || null);
    }
  }, [professor]);

  const handleCargoChange = (cargoId: string) => {
    const cargo = cargos.find((c: any) => c.id === cargoId);
    setFormData(prev => ({
      ...prev,
      cargo_id: cargoId,
      salario: cargo?.salario_base || prev.salario,
    }));
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const base64String = reader.result as string;
        setFormData(prev => ({ ...prev, foto_url: base64String }));
        setAvatarPreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFoto = () => {
    setFormData(prev => ({ ...prev, foto_url: '' }));
    setAvatarPreview(null);
    setAvatarFile(null);
    setAvatarError(null); // Limpar erro ao remover foto
  };

  const uploadAvatar = async (userId: string, file: File): Promise<string> => {
    const uploadResult = await storageApi.upload('avatars', `${userId}/avatar`, file);
    return uploadResult.url;
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("ID não fornecido");

      let avatarUrl = professor?.avatar_url || professor?.avatarUrl || professor?.foto_url;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(id, avatarFile);
      } else if (formData.foto_url && formData.foto_url.startsWith('data:')) {
        // Se for base64, precisa fazer upload
        const response = await fetch(formData.foto_url);
        const blob = await response.blob();
        const file = new File([blob], 'avatar.png', { type: 'image/png' });
        avatarUrl = await uploadAvatar(id, file);
      }

      // Prepare update data (only fields that exist in User model)
      const updateData: any = {
        nomeCompleto: formData.nome_completo,
        telefone: formData.telefone || null,
        numeroIdentificacao: formData.numero_identificacao || null,
        dataNascimento: formData.data_nascimento || null,
        morada: formData.morada || null,
        cidade: formData.cidade || null,
        pais: formData.pais || null,
        provincia: formData.provincia || null,
        avatarUrl: avatarUrl || null,
      };

      // Apenas ADMIN pode atualizar email
      if (isAdmin && formData.email) {
        updateData.email = formData.email;
      }

      // Update via users API (professores are users)
      // Note: campos como nome_pai, nome_mae, municipio, departamento_id, cargo_id, 
      // salario, tipo_contrato, carga_horaria, status, observacoes não existem no modelo User,
      // então não são enviados (são campos específicos de Funcionario)
      await professoresApi.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professores"] });
      queryClient.invalidateQueries({ queryKey: ["professor", id] });
      toast.success("Professor atualizado com sucesso!");
      navigate("/admin-dashboard/gestao-professores");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar professor: " + (error.message || error.response?.data?.error || "Erro desconhecido"));
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar foto se houver erro
    if (avatarError) {
      toast.error("Corrija o erro na foto antes de continuar");
      return;
    }
    
    if (!formData.nome_completo.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    if (!formData.numero_identificacao.trim()) {
      toast.error("Número de identificação (BI) é obrigatório");
      return;
    }

    updateMutation.mutate();
  };

  if (isLoadingProfessor) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Professor não encontrado</p>
          <Button className="mt-4" onClick={() => navigate("/admin-dashboard/gestao-professores")}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold">{t('pages.editarProfessor')}</h1>
        </div>
        <div className="text-sm text-muted-foreground">
          Dashboard &gt; Professores &gt; <span className="text-primary">Editar</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Dados do Professor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={formData.nome_completo || ''}
                  onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isAdmin}
                  className={isAdmin ? "" : "bg-muted"}
                  required
                />
                {!isAdmin && (
                  <p className="text-xs text-muted-foreground">Apenas administradores podem alterar o email</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone || ''}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nº de Identificação (BI) *</Label>
                <Input
                  value={formData.numero_identificacao || ''}
                  onChange={(e) => setFormData({ ...formData, numero_identificacao: e.target.value })}
                  placeholder="Ex: 000000000LA000"
                />
              </div>
            </div>

            {/* Additional Personal Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Informações Pessoais Adicionais</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.data_nascimento || ''}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Pai</Label>
                  <Input
                    value={formData.nome_pai || ''}
                    onChange={(e) => setFormData({ ...formData, nome_pai: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome da Mãe</Label>
                  <Input
                    value={formData.nome_mae || ''}
                    onChange={(e) => setFormData({ ...formData, nome_mae: e.target.value })}
                  />
                </div>
              </div>
              
              {/* Address Fields */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    value={formData.morada || ''}
                    onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                    placeholder="Rua, número, bairro"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.cidade || ''}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>País</Label>
                    <Select
                      value={formData.pais ?? ''}
                      onValueChange={(value) => {
                        setFormData({ ...formData, pais: value, provincia: '', municipio: '' });
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
                    <Label>Província</Label>
                    <Select
                      value={formData.provincia ?? ''}
                      onValueChange={(value) => setFormData({ ...formData, provincia: value, municipio: '' })}
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
                    <Label>Município</Label>
                    <Select
                      value={formData.municipio ?? ''}
                      onValueChange={(value) => setFormData({ ...formData, municipio: value })}
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
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Foto</Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={avatarPreview || undefined} alt="Foto" />
                      <AvatarFallback>
                        {formData.nome_completo ? formData.nome_completo.charAt(0).toUpperCase() : 'P'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleFotoChange}
                      className="hidden"
                      id="foto-upload"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('foto-upload')?.click()}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        {avatarPreview ? 'Alterar Foto' : 'Adicionar Foto'}
                      </Button>
                      {avatarPreview && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveFoto}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remover
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Apenas imagens JPEG, PNG e WEBP. Máximo 2MB.
                    </p>
                    {avatarError && (
                      <p className="text-xs text-red-500 mt-1">
                        {avatarError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Employment Info */}
            <div className="space-y-4">
              <h3 className="font-medium">Dados do Vínculo</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={formData.departamento_id || ''} onValueChange={(v) => setFormData({ ...formData, departamento_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {departamentos.map((d: any) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.nome || String(d.id)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select value={formData.cargo_id || ''} onValueChange={handleCargoChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.nome || String(c.id)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Salário</Label>
                  <Input
                    type="number"
                    value={formData.salario ?? 0}
                    onChange={(e) => setFormData({ ...formData, salario: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Admissão</Label>
                  <Input
                    type="date"
                    value={formData.data_admissao || ''}
                    onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Contrato</Label>
                  <Select value={formData.tipo_contrato} onValueChange={(v) => setFormData({ ...formData, tipo_contrato: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efetivo">Efetivo</SelectItem>
                      <SelectItem value="Temporário">Temporário</SelectItem>
                      <SelectItem value="Estágio">Estágio</SelectItem>
                      <SelectItem value="Prestador">Prestador de Serviços</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Carga Horária</Label>
                  <Select value={formData.carga_horaria} onValueChange={(v) => setFormData({ ...formData, carga_horaria: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4h/dia">4h/dia</SelectItem>
                      <SelectItem value="6h/dia">6h/dia</SelectItem>
                      <SelectItem value="8h/dia">8h/dia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data Fim Contrato</Label>
                  <Input
                    type="date"
                    value={formData.data_fim_contrato || ''}
                    onChange={(e) => setFormData({ ...formData, data_fim_contrato: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status || 'Ativo'} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                      <SelectItem value="Afastado">Afastado</SelectItem>
                      <SelectItem value="Férias">Férias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes || ''}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin-dashboard/gestao-professores")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={updateMutation.isPending || !!avatarError}>
            {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </form>
    </div>
  );
}
