import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { profilesApi, matriculasApi, cursosApi, turmasApi, turnosApi, storageApi } from "@/services/api";
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
import { ArrowLeft, Save, Loader2, Sun, Sunset, Moon, Clock, GraduationCap, Camera, User, MapPin, Users, BookOpen, FileText, DollarSign, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Badge } from "@/components/ui/badge";
import { AxiosError } from "axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlunoAcessoAba } from "@/components/admin/AlunoAcessoAba";
import { EmitirDocumentoTab } from "@/components/admin/EmitirDocumentoTab";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COUNTRIES = ["Angola", "Portugal", "Brasil", "Moçambique", "Cabo Verde", "São Tomé e Príncipe"];

interface Turma {
  id: string;
  nome: string;
  ano: number;
  semestre: string;
  turno: string | null;
  curso_id: string;
  curso: { id: string; nome: string } | null;
}

interface Matricula {
  id: string;
  turma_id: string;
  status: string;
  turma: Turma | null;
}

interface Curso {
  id: string;
  nome: string;
  codigo: string;
}

interface Turno {
  id: string;
  nome: string;
  hora_inicio: string | null;
  hora_fim: string | null;
}

export default function EditarAluno() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { role } = useAuth();
  const { isSecundario } = useInstituicao();
  const queryClient = useQueryClient();
  const isSecretaria = role === 'SECRETARIA' || location.pathname.includes('secretaria');
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const backUrl = isSecretaria ? '/secretaria-dashboard/alunos' : '/admin-dashboard/gestao-alunos';
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>("");
  const [selectedCursoId, setSelectedCursoId] = useState<string>("");
  const [selectedTurnoId, setSelectedTurnoId] = useState<string>("");
  
  const [formData, setFormData] = useState({
    nome_completo: "",
    email: "",
    telefone: "",
    numero_identificacao: "",
    data_nascimento: "",
    genero: "Masculino",
    tipo_sanguineo: "",
    nome_pai: "",
    nome_mae: "",
    morada: "",
    cidade: "",
    pais: "",
    codigo_postal: "",
    profissao: "",
    status_aluno: "Ativo",
  });

  const { data: aluno, isLoading } = useQuery({
    queryKey: ["aluno", id],
    queryFn: async () => {
      if (!id) throw new Error("ID do aluno não fornecido");
      const data = await profilesApi.getById(id);
      if (!data) throw new Error("Estudante não encontrado");
      return data;
    },
    enabled: !!id,
  });

  const { data: matriculaAtual, isLoading: isLoadingMatricula } = useQuery({
    queryKey: ["matricula-aluno", id],
    queryFn: async () => {
      if (!id) return null;
      const matriculas = await matriculasApi.getByAlunoId(id);
      const activeMatricula = matriculas.find((m: any) => m.status === "Ativa" || m.status === "ativa");
      return activeMatricula as Matricula | null;
    },
    enabled: !!id,
  });

  const { data: cursos } = useQuery({
    queryKey: ["cursos-select", isSecundario],
    queryFn: async () => {
      const allCursos = await cursosApi.getAll();
      // Para Ensino Médio, filtrar apenas cursos do tipo 'classe'
      if (isSecundario) {
        return allCursos.filter((c: any) => c.tipo === "classe" && c.ativo);
      }
      // Para universidade, filtrar apenas cursos do tipo 'geral' ou null
      return allCursos.filter((c: any) => (c.tipo === "geral" || !c.tipo) && c.ativo);
    },
  });

  const { data: turmas } = useQuery({
    queryKey: ["turmas-select"],
    queryFn: async () => {
      const data = await turmasApi.getAll();
      return data as Turma[];
    },
  });

  const { data: turnos } = useQuery({
    queryKey: ["turnos-ativos"],
    queryFn: async () => {
      const allTurnos = await turnosApi.getAll();
      return allTurnos.filter((t: any) => t.ativo) as Turno[];
    },
  });

  // Filter turmas by selected curso and turno for Ensino Médio
  const filteredTurmas = useMemo(() => {
    if (!turmas) return [];
    let filtered = turmas;
    if (isSecundario && selectedCursoId) {
      filtered = filtered.filter(t => t.curso_id === selectedCursoId);
    }
    if (selectedTurnoId) {
      const selectedTurno = turnos?.find(t => t.id === selectedTurnoId);
      if (selectedTurno) {
        filtered = filtered.filter(t => 
          t.turno?.toLowerCase().includes(selectedTurno.nome.toLowerCase())
        );
      }
    }
    return filtered;
  }, [turmas, isSecundario, selectedCursoId, selectedTurnoId, turnos]);

  useEffect(() => {
    if (aluno) {
      setFormData({
        nome_completo: aluno.nome_completo || "",
        email: aluno.email || "",
        telefone: aluno.telefone || "",
        numero_identificacao: aluno.numero_identificacao || "",
        data_nascimento: aluno.data_nascimento || "",
        genero: aluno.genero || "Masculino",
        tipo_sanguineo: aluno.tipo_sanguineo || "",
        nome_pai: aluno.nome_pai || "",
        nome_mae: aluno.nome_mae || "",
        morada: aluno.morada || "",
        cidade: aluno.cidade || "",
        pais: aluno.pais || "",
        codigo_postal: aluno.codigo_postal || "",
        profissao: aluno.profissao || "",
        status_aluno: aluno.status_aluno || "Ativo",
      });
      if (aluno.avatar_url) {
        setAvatarPreview(aluno.avatar_url);
      }
    }
  }, [aluno]);

  useEffect(() => {
    if (matriculaAtual?.turma_id) {
      setSelectedTurmaId(matriculaAtual.turma_id);
      if (matriculaAtual.turma?.curso_id) {
        setSelectedCursoId(matriculaAtual.turma.curso_id);
      }
      // Set turno based on turma's turno
      if (matriculaAtual.turma?.turno && turnos) {
        const matchingTurno = turnos.find(t => 
          matriculaAtual.turma?.turno?.toLowerCase().includes(t.nome.toLowerCase())
        );
        if (matchingTurno) {
          setSelectedTurnoId(matchingTurno.id);
        }
      }
    }
  }, [matriculaAtual, turnos]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("ID do aluno não fornecido");

      let avatarUrl = aluno?.avatar_url || null;
      if (avatarFile) {
        avatarUrl = await storageApi.uploadAvatar(id, avatarFile);
      }

      // Update profile
      const updatePayload: any = {
        nome_completo: formData.nome_completo,
        telefone: formData.telefone || null,
        numero_identificacao: formData.numero_identificacao || null,
        data_nascimento: formData.data_nascimento || null,
        genero: formData.genero || null,
        tipo_sanguineo: formData.tipo_sanguineo || null,
        nome_pai: formData.nome_pai || null,
        nome_mae: formData.nome_mae || null,
        morada: formData.morada || null,
        cidade: formData.cidade || null,
        pais: formData.pais || null,
        codigo_postal: formData.codigo_postal || null,
        profissao: formData.profissao || null,
        status_aluno: formData.status_aluno,
        avatar_url: avatarUrl,
      };

      // Apenas ADMIN pode atualizar email
      if (isAdmin && formData.email) {
        updatePayload.email = formData.email;
      }

      await profilesApi.update(id, updatePayload);

      // Update enrollment if changed
      if (selectedTurmaId && selectedTurmaId !== matriculaAtual?.turma_id) {
        if (matriculaAtual?.id) {
          // Update existing enrollment
          await matriculasApi.update(matriculaAtual.id, { turmaId: selectedTurmaId });
        } else {
          // Create new enrollment
          await matriculasApi.create({
            alunoId: id,
            turmaId: selectedTurmaId,
            status: "ativa",
          });
        }
      }
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas ao aluno
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      queryClient.invalidateQueries({ queryKey: ["aluno", id] });
      queryClient.invalidateQueries({ queryKey: ["matricula-aluno", id] });
      
      // Invalidar queries usadas nas páginas do aluno
      queryClient.invalidateQueries({ queryKey: ["student-profile", id] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", id] });
      queryClient.invalidateQueries({ queryKey: ["aluno-anos-letivos", id] });
      queryClient.invalidateQueries({ queryKey: ["aluno-matriculas", id] });
      queryClient.invalidateQueries({ queryKey: ["aluno-disciplinas", id] });
      queryClient.invalidateQueries({ queryKey: ["aluno-notas", id] });
      queryClient.invalidateQueries({ queryKey: ["aluno-frequencias", id] });
      queryClient.invalidateQueries({ queryKey: ["student-matriculas", id] });
      queryClient.invalidateQueries({ queryKey: ["student-notas", id] });
      queryClient.invalidateQueries({ queryKey: ["student-frequencias", id] });
      queryClient.invalidateQueries({ queryKey: ["aluno-matricula-info", id] });
      queryClient.invalidateQueries({ queryKey: ["aluno-disciplinas-aproveitamento", id] });
      queryClient.invalidateQueries({ queryKey: ["aluno-matriculas-aproveitamento", id] });
      queryClient.invalidateQueries({ queryKey: ["aluno-notas-aproveitamento", id] });
      queryClient.invalidateQueries({ queryKey: ["minhas-mensalidades", id] });
      queryClient.invalidateQueries({ queryKey: ["aluno-mensalidades-pendentes", id] });
      
      // Invalidar queries que podem usar o ID do aluno como parte da chave
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          // Invalidar qualquer query que contenha o ID do aluno
          return key.some((k) => k === id || (typeof k === 'string' && k.includes(id)));
        }
      });
      
      toast.success("Estudante atualizado com sucesso!");
      navigate(backUrl);
    },
    onError: (error: unknown) => {
      let errorMessage = "Erro ao atualizar estudante. Por favor, tente novamente.";
      
      // Tratar AxiosError
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const responseData = error.response?.data;
        
        // Tratar especificamente o erro 409 (Conflict)
        if (status === 409) {
          errorMessage = responseData?.message || 
            responseData?.error || 
            "Este aluno já está matriculado nesta turma.";
        } else {
          // Para outros erros, tentar extrair a mensagem do backend
          errorMessage = responseData?.message || 
                        responseData?.error || 
                        error.message || 
                        errorMessage;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome_completo) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    updateMutation.mutate();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getTurnoIcon = (turno: string | { nome?: string } | null) => {
    const turnoNome = typeof turno === 'string' ? turno : turno?.nome;
    if (!turnoNome) return <Clock className="h-4 w-4 text-muted-foreground" />;
    const nomeLower = turnoNome.toLowerCase();
    if (nomeLower.includes('manhã') || nomeLower.includes('manha')) return <Sun className="h-4 w-4 text-amber-500" />;
    if (nomeLower.includes('tarde')) return <Sunset className="h-4 w-4 text-orange-500" />;
    if (nomeLower.includes('noite')) return <Moon className="h-4 w-4 text-indigo-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getTurnoBadgeVariant = (turno: string | { nome?: string } | null) => {
    const turnoNome = typeof turno === 'string' ? turno : turno?.nome;
    if (!turnoNome) return "secondary";
    const nomeLower = turnoNome.toLowerCase();
    if (nomeLower.includes('manhã') || nomeLower.includes('manha')) return "default";
    if (nomeLower.includes('tarde')) return "default";
    if (nomeLower.includes('noite')) return "default";
    return "secondary";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const selectedTurma = turmas?.find(t => t.id === selectedTurmaId);

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
              <h1 className="text-3xl font-bold tracking-tight">Editar Estudante</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Atualize as informações do estudante no sistema
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="dados-pessoais" className="space-y-6">
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
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8">
                {/* Avatar Section */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Foto de Perfil</Label>
                  <div className="relative w-32 h-32 mx-auto lg:mx-0">
                    <Avatar className="w-32 h-32 border-4 border-muted shadow-lg">
                      <AvatarImage src={avatarPreview || undefined} />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {getInitials(formData.nome_completo || "A")}
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="avatar"
                      className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2.5 cursor-pointer hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
                    >
                      <Camera className="h-4 w-4" />
                    </label>
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center lg:text-left">
                    JPEG ou PNG<br />Máx. 3MB
                  </p>
                </div>

                {/* Personal Information Fields */}
                <div className="space-y-4">

                  <div className="space-y-2">
                    <Label htmlFor="nome_completo" className="text-sm font-medium">Nome Completo *</Label>
                    <Input
                      id="nome_completo"
                      value={formData.nome_completo}
                      onChange={(e) => handleInputChange("nome_completo", e.target.value)}
                      className="h-10"
                      required
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
                          <RadioGroupItem value="Masculino" id="masculino" />
                          <Label htmlFor="masculino" className="font-normal cursor-pointer">Masculino</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Feminino" id="feminino" />
                          <Label htmlFor="feminino" className="font-normal cursor-pointer">Feminino</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Outro" id="outro" />
                          <Label htmlFor="outro" className="font-normal cursor-pointer">Outro</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipo_sanguineo" className="text-sm font-medium">Tipo Sanguíneo</Label>
                      <Select
                        value={formData.tipo_sanguineo}
                        onValueChange={(value) => handleInputChange("tipo_sanguineo", value)}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecionar" />
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status_aluno" className="text-sm font-medium">Status do Aluno</Label>
                    <Select
                      value={formData.status_aluno}
                      onValueChange={(value) => handleInputChange("status_aluno", value)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                        <SelectItem value="Inativo por inadimplência">Inativo por inadimplência</SelectItem>
                      </SelectContent>
                    </Select>
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
                <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email de Contato</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={!isAdmin}
                    className={isAdmin ? "h-10" : "bg-muted h-10"}
                  />
                  {!isAdmin && (
                    <p className="text-xs text-muted-foreground">
                      Apenas administradores podem alterar o email
                    </p>
                  )}
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
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-base font-semibold mb-4">Endereço</h4>
                <div className="space-y-2">
                  <Label htmlFor="morada" className="text-sm font-medium">Morada</Label>
                  <Input
                    id="morada"
                    value={formData.morada}
                    onChange={(e) => handleInputChange("morada", e.target.value)}
                    placeholder="Rua, número, bairro"
                    className="h-10"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cidade" className="text-sm font-medium">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => handleInputChange("cidade", e.target.value)}
                      placeholder="Nome da cidade"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo_postal" className="text-sm font-medium">Código Postal</Label>
                    <Input
                      id="codigo_postal"
                      value={formData.codigo_postal}
                      onChange={(e) => handleInputChange("codigo_postal", e.target.value)}
                      placeholder="Código postal"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pais" className="text-sm font-medium">País</Label>
                  <Select
                    value={formData.pais}
                    onValueChange={(value) => handleInputChange("pais", value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecionar país" />
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
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_pai" className="text-sm font-medium">Nome do Pai/Encarregado</Label>
                  <Input
                    id="nome_pai"
                    value={formData.nome_pai}
                    onChange={(e) => handleInputChange("nome_pai", e.target.value)}
                    placeholder="Nome completo do pai/encarregado"
                    className="h-10"
                  />
                </div>

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

              <div className="mt-4">
                <div className="space-y-2">
                  <Label htmlFor="profissao" className="text-sm font-medium">Profissão do Encarregado</Label>
                  <Input
                    id="profissao"
                    value={formData.profissao}
                    onChange={(e) => handleInputChange("profissao", e.target.value)}
                    placeholder="Profissão do encarregado"
                    className="h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            {/* Aba: Dados Acadêmicos */}
            <TabsContent value="academicos">
              <Card>
                <CardHeader className="border-b bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Matrícula e Dados Acadêmicos
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {isLoadingMatricula ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      {/* Curso Selector - Only for Ensino Médio */}
                      {isSecundario && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Classe *</Label>
                          <Select
                            value={selectedCursoId}
                            onValueChange={(value) => {
                              setSelectedCursoId(value);
                              setSelectedTurnoId("");
                              setSelectedTurmaId("");
                            }}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Selecionar Classe (ex: 10ª, 11ª, 12ª)" />
                            </SelectTrigger>
                            <SelectContent>
                              {cursos?.map((curso: any) => (
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
                              setSelectedTurmaId("");
                            }}
                            disabled={!selectedCursoId}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder={!selectedCursoId ? "Selecione a classe primeiro" : "Selecionar Turno"} />
                            </SelectTrigger>
                            <SelectContent>
                              {turnos?.map((turno) => (
                                <SelectItem key={turno.id} value={String(turno.id)}>
                                  <div className="flex items-center gap-2">
                                    {getTurnoIcon(turno.nome)}
                                    <span>{turno.nome}</span>
                                    {turno.hora_inicio && turno.hora_fim && (
                                      <span className="text-muted-foreground text-xs">
                                        ({turno.hora_inicio?.slice(0,5)} - {turno.hora_fim?.slice(0,5)})
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="turma" className="text-sm font-medium">Turma {isSecundario ? "*" : ""}</Label>
                        <Select
                          value={selectedTurmaId}
                          onValueChange={setSelectedTurmaId}
                          disabled={isSecundario && (!selectedCursoId || !selectedTurnoId)}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder={
                              isSecundario && !selectedCursoId 
                                ? "Selecione a classe primeiro" 
                                : isSecundario && !selectedTurnoId
                                  ? "Selecione o turno primeiro"
                                  : "Selecionar Turma"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredTurmas && filteredTurmas.length > 0 ? (
                              filteredTurmas.map((turma) => (
                                <SelectItem key={turma.id} value={String(turma.id)}>
                                  <div className="flex items-center gap-2">
                                    {getTurnoIcon(turma.turno)}
                                    <span>
                                      {turma.nome || String(turma.id)} 
                                      {!isSecundario && turma.curso?.nome && ` - ${String(turma.curso.nome)}`} 
                                      {turma.ano && ` (${String(turma.ano)}${!isSecundario && turma.semestre ? `/${String(turma.semestre)}` : ''})`}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
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

                      {selectedTurma && (
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Turno:</span>
                            <div className="flex items-center gap-2">
                              {getTurnoIcon(selectedTurma.turno)}
                              {selectedTurma.turno ? (
                                <Badge variant={getTurnoBadgeVariant(selectedTurma.turno) as "default" | "secondary"}>
                                  {typeof selectedTurma.turno === 'object' ? selectedTurma.turno?.nome : selectedTurma.turno}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">Não definido</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Curso:</span>
                            <span className="text-sm">{selectedTurma.curso?.nome || "-"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{isSecundario ? 'Ano Letivo:' : 'Período:'}</span>
                            <span className="text-sm">
                              {selectedTurma.ano}{!isSecundario && ` / ${selectedTurma.semestre}º Semestre`}
                            </span>
                          </div>
                        </div>
                      )}

                      {!selectedTurmaId && (
                        <p className="text-sm text-muted-foreground italic">
                          O aluno não está matriculado em nenhuma turma. Selecione uma turma para matricular.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Aba: Documentos - Emissão (ADMIN/SECRETARIA) */}
            <TabsContent value="documentos">
              {(isAdmin || isSecretaria) && id ? (
                <EmitirDocumentoTab
                  estudanteId={id}
                  estudanteNome={formData.nome_completo || aluno?.nome_completo}
                />
              ) : (
                <Card>
                  <CardHeader className="border-b bg-muted/50">
                    <CardTitle className="text-xl font-semibold">Documentos</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      Acesso à emissão de documentos é restrito a Secretaria e Admin.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Aba: Acesso ao Sistema (só ADMIN/SECRETARIA) */}
            {(isAdmin || isSecretaria) && (
              <TabsContent value="acesso">
                {id && <AlunoAcessoAba alunoId={id} alunoEmail={formData.email} />}
              </TabsContent>
            )}

            {/* Action Buttons - Aparece em todas as abas */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(backUrl)}
                className="h-10 px-6"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                className="h-10 px-6 bg-primary hover:bg-primary/90"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
