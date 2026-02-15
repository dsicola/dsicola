import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { useNavigate } from "react-router-dom";
import { presencasApi, aulasLancadasApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi, semestreApi, trimestreApi, authApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SmartSearch } from "@/components/common/SmartSearch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, AlertTriangle, Save, Users, Calendar, BookOpen, Info, GraduationCap, AlertCircle, Plus, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AnoLetivoAtivoGuard } from "@/components/academico/AnoLetivoAtivoGuard";
import { AnoLetivoSelect } from "@/components/academico/AnoLetivoSelect";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";

interface ContextType {
  cursoId?: string;
  classeId?: string;
  disciplinaId?: string;
  professorId?: string;
  anoLetivo?: number;
  turmaId?: string;
}

type StatusPresenca = 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO';

interface PresencaAluno {
  id: string | null;
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  numeroIdentificacao?: string;
  numeroIdentificacaoPublica?: string;
  status: StatusPresenca | null;
  observacoes: string | null;
}

interface PresencaData {
  alunoId: string;
  status: StatusPresenca;
  observacoes?: string;
}

interface ControlePresencasTabProps {
  sharedContext?: ContextType;
  onContextChange?: (context: ContextType) => void;
}

export function ControlePresencasTab({ sharedContext, onContextChange }: ControlePresencasTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSecundario } = useInstituicao();
  const { presencas: presencasPermissions, messages, isSecretaria } = useRolePermissions();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();
  const periodoLabel = isSecundario ? 'Trimestre' : 'Semestre';

  // Removido: busca manual de anos letivos - usar AnoLetivoSelect que já faz isso
  
  // Buscar perfil completo com roles
  const { data: profileData } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      try {
        return await authApi.getProfile();
      } catch {
        return null;
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Verificar se o usuário tem permissão para acessar matrículas
  const userRoles = profileData?.roles || (user ? [] : []);
  const canAccessMatriculas = userRoles.some(role => 
    ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN'].includes(role)
  );

  const [context, setContext] = useState<ContextType>(
    sharedContext || {
      cursoId: "",
      classeId: "",
      disciplinaId: "",
      professorId: "",
      anoLetivo: anoLetivoAtivo?.ano || new Date().getFullYear(),
      turmaId: "",
    }
  );

  // Atualizar ano letivo quando ano letivo ativo estiver disponível
  useEffect(() => {
    if (anoLetivoAtivo?.ano && !context.anoLetivo) {
      setContext((prev) => ({ ...prev, anoLetivo: anoLetivoAtivo.ano }));
    }
  }, [anoLetivoAtivo?.ano]);

  const [selectedAulaId, setSelectedAulaId] = useState<string>("");
  const [presencas, setPresencas] = useState<Map<string, PresencaData>>(new Map());
  const [createSemestreDialogOpen, setCreateSemestreDialogOpen] = useSafeDialog(false);
  const [semestreFormData, setSemestreFormData] = useState({
    numero: "1",
    dataInicio: "",
    dataFim: "",
    observacoes: "",
  });

  useEffect(() => {
    if (sharedContext) {
      setContext(sharedContext);
    }
  }, [sharedContext]);

  useEffect(() => {
    if (onContextChange) {
      onContextChange(context);
    }
  }, [context, onContextChange]);

  // Buscar cursos (Ensino Superior) ou classes (Ensino Médio)
  const { data: cursos } = useQuery({
    queryKey: ["cursos-presencas", instituicaoId],
    queryFn: async () => {
      if (!isSecundario) {
        const data = await cursosApi.getAll({ ativo: true });
        return (data || []).filter((c: any) => c.tipo !== "classe");
      }
      return [];
    },
    enabled: !isSecundario && !!instituicaoId,
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-presencas", instituicaoId],
    queryFn: async () => {
      if (isSecundario) {
        return await classesApi.getAll({ ativo: true });
      }
      return [];
    },
    enabled: isSecundario && !!instituicaoId,
  });

  // Buscar disciplinas
  const { data: disciplinas } = useQuery({
    queryKey: ["disciplinas-presencas", context.cursoId, context.classeId],
    queryFn: async () => {
      const params: any = { ativo: true };
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      return await disciplinasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId),
  });

  // Buscar professores (tabela professores - professores.id, NUNCA users.id)
  const { data: professores } = useQuery({
    queryKey: ["professores-presencas", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
  });

  // Buscar turmas
  const { data: turmas } = useQuery({
    queryKey: ["turmas-presencas", context.cursoId, context.classeId, context.disciplinaId],
    queryFn: async () => {
      const params: any = {};
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      if (context.disciplinaId) params.disciplinaId = context.disciplinaId;
      return await turmasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId) && !!context.disciplinaId,
  });

  // Buscar aulas lançadas
  const { data: aulasLancadas = [] } = useQuery({
    queryKey: ["aulas-lancadas-presencas", context],
    queryFn: async () => {
      if (!context.disciplinaId || !context.professorId || !context.anoLetivo) {
        return [];
      }
      return await aulasLancadasApi.getAll({
        cursoId: context.cursoId || undefined,
        classeId: context.classeId || undefined,
        disciplinaId: context.disciplinaId,
        professorId: context.professorId,
        anoLetivo: context.anoLetivo,
        turmaId: context.turmaId || undefined,
      });
    },
    enabled: !!(context.disciplinaId && context.professorId && context.anoLetivo),
  });

  const contextComplete = !!(context.disciplinaId && context.professorId && context.anoLetivo);

  // Buscar semestre atual (Ensino Superior)
  const { data: semestreAtual } = useQuery({
    queryKey: ["semestre-atual", context.anoLetivo],
    queryFn: async () => {
      if (!context.anoLetivo) return null;
      try {
        return await semestreApi.getAtual(context.anoLetivo);
      } catch {
        return null;
      }
    },
    enabled: !!context.anoLetivo && !isSecundario,
  });

  // Buscar trimestre atual (Ensino Secundário)
  const { data: trimestreAtual } = useQuery({
    queryKey: ["trimestre-atual", context.anoLetivo],
    queryFn: async () => {
      if (!context.anoLetivo) return null;
      try {
        return await trimestreApi.getAtual(context.anoLetivo);
      } catch {
        return null;
      }
    },
    enabled: !!context.anoLetivo && isSecundario,
  });

  const periodoAtual = isSecundario ? trimestreAtual : semestreAtual;

  // Mutation para criar semestre ou trimestre
  const createPeriodoMutation = useSafeMutation({
    mutationFn: async (data: {
      anoLetivo: number;
      numero: number;
      dataInicio: string;
      dataFim?: string;
      observacoes?: string;
    }) => {
      if (isSecundario) {
        return await trimestreApi.create(data);
      }
      return await semestreApi.create(data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: `${periodoLabel} criado com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ["semestre-atual"] });
      queryClient.invalidateQueries({ queryKey: ["trimestre-atual"] });
      setCreateSemestreDialogOpen(false);
      setSemestreFormData({
        numero: "1",
        dataInicio: "",
        dataFim: "",
        observacoes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || `Erro ao criar ${periodoLabel.toLowerCase()}.`,
        variant: "destructive",
      });
    },
  });

  const handleCreateSemestre = () => {
    if (!context.anoLetivo) {
      toast({
        title: "Erro",
        description: "Ano letivo é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!semestreFormData.dataInicio) {
      toast({
        title: "Erro",
        description: "Data de início é obrigatória.",
        variant: "destructive",
      });
      return;
    }

    createPeriodoMutation.mutate({
      anoLetivo: context.anoLetivo,
      numero: parseInt(semestreFormData.numero),
      dataInicio: semestreFormData.dataInicio,
      dataFim: semestreFormData.dataFim || undefined,
      observacoes: semestreFormData.observacoes || undefined,
    });
  };

  // Mutation para ativar semestre ou trimestre
  const ativarPeriodoMutation = useSafeMutation({
    mutationFn: async (data: { semestreId?: string; trimestreId?: string; anoLetivo?: number; numero?: number }) => {
      if (isSecundario) {
        return await trimestreApi.ativar({ trimestreId: data.trimestreId, anoLetivo: data.anoLetivo, numero: data.numero });
      }
      return await semestreApi.ativar({ semestreId: data.semestreId, anoLetivo: data.anoLetivo, numero: data.numero });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sucesso!",
        description: `${periodoLabel} ativado com sucesso. ${data.alunosAtualizados || 0} aluno(s) atualizado(s) para "Cursando".`,
      });
      queryClient.invalidateQueries({ queryKey: ["semestre-atual"] });
      queryClient.invalidateQueries({ queryKey: ["trimestre-atual"] });
      queryClient.invalidateQueries({ queryKey: ["presencas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || `Erro ao ativar ${periodoLabel.toLowerCase()}.`,
        variant: "destructive",
      });
    },
  });

  // Buscar presenças da aula selecionada
  const { data: presencasData, isLoading: loadingPresencas, error: presencasError } = useQuery({
    queryKey: ["presencas-aula", selectedAulaId],
    queryFn: async () => {
      if (!selectedAulaId) return null;
      return await presencasApi.getByAula(selectedAulaId);
    },
    enabled: !!selectedAulaId,
  });

  // Processar dados de presenças quando recebidos
  useEffect(() => {
    if (!presencasData) {
      setPresencas(new Map());
      return;
    }

    // Verificar se há alunos matriculados
    if ((presencasData as any)?.hasStudents === false) {
      setPresencas(new Map());
      return;
    }

    if ((presencasData as any)?.presencas) {
      const presencasMap = new Map<string, PresencaData>();
      (presencasData as any).presencas.forEach((p: PresencaAluno) => {
        // Sempre incluir aluno, mesmo sem status (default PRESENTE)
        presencasMap.set(p.alunoId, {
          alunoId: p.alunoId,
          status: p.status || 'PRESENTE',
          observacoes: p.observacoes || undefined,
        });
      });
      setPresencas(presencasMap);
    } else {
      setPresencas(new Map());
    }
  }, [presencasData]);

  // Mutation para salvar presenças
  const savePresencasMutation = useSafeMutation({
    mutationFn: async (data: { aulaLancadaId: string; presencas: PresencaData[] }) => {
      return await presencasApi.createOrUpdate(data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Presenças registradas com sucesso.",
      });
      // Invalidar queries para recarregar dados
      queryClient.invalidateQueries({ queryKey: ["presencas-aula", selectedAulaId] });
      queryClient.invalidateQueries({ queryKey: ["aulas-lancadas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao registrar presenças.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (alunoId: string, status: StatusPresenca) => {
    const newPresencas = new Map(presencas);
    const existing = newPresencas.get(alunoId);
    newPresencas.set(alunoId, {
      alunoId,
      status,
      observacoes: existing?.observacoes,
    });
    setPresencas(newPresencas);
  };

  const handleSave = () => {
    if (!selectedAulaId) {
      toast({
        title: "Erro",
        description: "Selecione uma aula lançada primeiro.",
        variant: "destructive",
      });
      return;
    }

    // Incluir todas as presenças, não filtrar null
    const presencasArray = Array.from(presencas.values());
    
    if (presencasArray.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhum aluno encontrado para esta aula.",
        variant: "destructive",
      });
      return;
    }

    savePresencasMutation.mutate({
      aulaLancadaId: selectedAulaId,
      presencas: presencasArray,
    });
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: StatusPresenca | null) => {
    if (status === 'PRESENTE') return <Badge className="bg-green-500">Presente</Badge>;
    if (status === 'AUSENTE') return <Badge variant="destructive">Ausente</Badge>;
    if (status === 'JUSTIFICADO') return <Badge className="bg-yellow-500">Justificado</Badge>;
    return <Badge variant="outline">Não marcado</Badge>;
  };

  // Calcular estatísticas
  const totalAlunos = presencasData?.presencas?.length || 0;
  const presentes = presencasData?.presencas?.filter((p: PresencaAluno) => {
    const status = presencas.get(p.alunoId)?.status || p.status;
    return status === 'PRESENTE';
  }).length || 0;
  const ausentes = presencasData?.presencas?.filter((p: PresencaAluno) => {
    const status = presencas.get(p.alunoId)?.status || p.status;
    return status === 'AUSENTE';
  }).length || 0;
  const justificados = presencasData?.presencas?.filter((p: PresencaAluno) => {
    const status = presencas.get(p.alunoId)?.status || p.status;
    return status === 'JUSTIFICADO';
  }).length || 0;

  const updateContext = (updates: Partial<ContextType>) => {
    setContext((prev) => ({ ...prev, ...updates }));
    setSelectedAulaId("");
  };

  const searchCursos = (term: string) =>
    Promise.resolve(
      (cursos || [])
        .filter((c: any) => c?.id && (c.nome || "").toLowerCase().includes(term.toLowerCase().trim()))
        .slice(0, 15)
        .map((c: any) => ({ id: c.id, nome: c.nome || "", nomeCompleto: c.nome || "", complemento: c.codigo || "" }))
    );
  const searchClasses = (term: string) =>
    Promise.resolve(
      (classes || [])
        .filter((c: any) => c?.id && (c.nome || "").toLowerCase().includes(term.toLowerCase().trim()))
        .slice(0, 15)
        .map((c: any) => ({ id: c.id, nome: c.nome || "", nomeCompleto: c.nome || "", complemento: c.codigo || "" }))
    );
  const searchDisciplinas = (term: string) =>
    Promise.resolve(
      (disciplinas || [])
        .filter((d: any) => d?.id && (d.nome || "").toLowerCase().includes(term.toLowerCase().trim()))
        .slice(0, 15)
        .map((d: any) => ({ id: d.id, nome: d.nome || "", nomeCompleto: d.nome || "", complemento: d.codigo || "" }))
    );
  const searchProfessores = (term: string) =>
    Promise.resolve(
      (professores || [])
        .filter(
          (p: any) =>
            p?.id &&
            ((p.nome_completo || p.nomeCompleto || p.email || "").toLowerCase().includes(term.toLowerCase().trim()))
        )
        .slice(0, 15)
        .map((p: any) => ({
          id: p.id,
          nome: p.nome_completo || p.nomeCompleto || p.email || "",
          nomeCompleto: p.nome_completo || p.nomeCompleto || p.email || "",
          email: p.email || "",
        }))
    );
  const searchTurmas = (term: string) =>
    Promise.resolve(
      (turmas || [])
        .filter((t: any) => t?.id && (t.nome || "").toLowerCase().includes(term.toLowerCase().trim()))
        .slice(0, 15)
        .map((t: any) => ({ id: t.id, nome: t.nome || "", nomeCompleto: t.nome || "", complemento: "" }))
    );
  const getCursoNome = (id: string) => cursos?.find((c: any) => c.id === id)?.nome || "";
  const getClasseNome = (id: string) => classes?.find((c: any) => c.id === id)?.nome || "";
  const getDisciplinaNome = (id: string) => disciplinas?.find((d: any) => d.id === id)?.nome || "";
  const getProfessorNome = (id: string) =>
    professores?.find((p: any) => p.id === id)?.nome_completo || professores?.find((p: any) => p.id === id)?.nomeCompleto || "";
  const getTurmaNome = (id: string) => turmas?.find((t: any) => t.id === id)?.nome || "";

  return (
    <AnoLetivoAtivoGuard showAlert={true} disableChildren={false}>
      <div className="space-y-6">
      {/* Filtros de Contexto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Contexto da Aula
          </CardTitle>
          <CardDescription>
            Selecione o contexto para filtrar as aulas lançadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {!isSecundario && (
              <div className="space-y-2">
                <Label htmlFor="curso">Curso</Label>
                <SmartSearch
                  placeholder="Digite o nome ou código do curso..."
                  value={getCursoNome(context.cursoId || "")}
                  selectedId={context.cursoId || undefined}
                  onSelect={(item) => updateContext({ cursoId: item ? item.id : "", disciplinaId: "", turmaId: "" })}
                  onClear={() => updateContext({ cursoId: "", disciplinaId: "", turmaId: "" })}
                  searchFn={searchCursos}
                  minSearchLength={1}
                  emptyMessage="Nenhum curso encontrado"
                  silent
                />
              </div>
            )}

            {isSecundario && (
              <div className="space-y-2">
                <Label htmlFor="classe">Classe</Label>
                <SmartSearch
                  placeholder="Digite o nome ou código da classe..."
                  value={getClasseNome(context.classeId || "")}
                  selectedId={context.classeId || undefined}
                  onSelect={(item) => updateContext({ classeId: item ? item.id : "", disciplinaId: "", turmaId: "" })}
                  onClear={() => updateContext({ classeId: "", disciplinaId: "", turmaId: "" })}
                  searchFn={searchClasses}
                  minSearchLength={1}
                  emptyMessage="Nenhuma classe encontrada"
                  silent
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="disciplina">Disciplina *</Label>
              <SmartSearch
                placeholder="Digite o nome ou código da disciplina..."
                value={getDisciplinaNome(context.disciplinaId || "")}
                selectedId={context.disciplinaId || undefined}
                onSelect={(item) => updateContext({ disciplinaId: item ? item.id : "", turmaId: "" })}
                onClear={() => updateContext({ disciplinaId: "", turmaId: "" })}
                searchFn={searchDisciplinas}
                minSearchLength={1}
                emptyMessage="Nenhuma disciplina encontrada"
                disabled={!context.cursoId && !context.classeId}
                silent
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professor">Professor *</Label>
              <SmartSearch
                placeholder="Digite o nome ou email do professor..."
                value={getProfessorNome(context.professorId || "")}
                selectedId={context.professorId || undefined}
                onSelect={(item) => updateContext({ professorId: item ? item.id : "" })}
                onClear={() => updateContext({ professorId: "" })}
                searchFn={searchProfessores}
                minSearchLength={1}
                emptyMessage="Nenhum professor encontrado"
                silent
              />
            </div>

            <AnoLetivoSelect
              value={context.anoLetivo}
              onValueChange={(ano) => updateContext({ anoLetivo: ano })}
              onIdChange={(id) => {
                // Manter o ano atual do contexto
                updateContext({ anoLetivo: context.anoLetivo });
              }}
              label="Ano Letivo"
              required
              showStatus={true}
            />

            <div className="space-y-2">
              <Label htmlFor="turma">Turma (opcional)</Label>
              <SmartSearch
                placeholder="Digite o nome da turma ou deixe vazio para todas..."
                value={context.turmaId ? getTurmaNome(context.turmaId) : ""}
                selectedId={context.turmaId || undefined}
                onSelect={(item) => updateContext({ turmaId: item ? item.id : "" })}
                onClear={() => updateContext({ turmaId: "" })}
                searchFn={searchTurmas}
                minSearchLength={1}
                emptyMessage="Nenhuma turma encontrada"
                disabled={!context.disciplinaId}
                silent
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Aula Lançada */}
      {contextComplete && (
        <Card>
          <CardHeader>
            <CardTitle>Selecionar Aula Lançada</CardTitle>
            <CardDescription>
              Selecione a aula ministrada para registrar as presenças
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aulasLancadas.length === 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  É necessário lançar aulas como "Ministradas" antes de controlar presenças.
                  Acesse a aba "Lançamento de Aulas" e registre as aulas ministradas primeiro.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="aulaLancada">Aula Lançada *</Label>
              <Select
                value={selectedAulaId || ""}
                onValueChange={(value) => {
                  if (value !== "no-aulas") {
                    setSelectedAulaId(value);
                    setPresencas(new Map());
                  }
                }}
                disabled={aulasLancadas.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma aula lançada" />
                </SelectTrigger>
                <SelectContent>
                  {aulasLancadas.length === 0 ? (
                    <SelectItem value="no-aulas" disabled>
                      Nenhuma aula lançada encontrada
                    </SelectItem>
                  ) : (
                    aulasLancadas.filter((aula: any) => aula?.id).map((aula: any) => {
                      const dataFormatada = formatDate(aula.data);
                      const disciplinaNome = aula.planoAula?.planoEnsino?.disciplina?.nome || "N/A";
                      const turmaNome = aula.planoAula?.planoEnsino?.turma?.nome || "N/A";
                      return (
                        <SelectItem key={aula.id} value={String(aula.id)}>
                          {dataFormatada} - {disciplinaNome} - {turmaNome}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Presenças */}
      {selectedAulaId && (
        <>
          {loadingPresencas ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Carregando alunos...
              </CardContent>
            </Card>
          ) : presencasData?.hasStudents === false ? (
            <Card className={`border-blue-200 bg-blue-50/50 ${presencasData?.reason === 'STATUS_MATRICULADO' ? 'border-yellow-200 bg-yellow-50/50' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <div className={`p-3 rounded-full mb-4 ${presencasData?.reason === 'STATUS_MATRICULADO' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                    <Info className={`h-8 w-8 ${presencasData?.reason === 'STATUS_MATRICULADO' ? 'text-yellow-600' : 'text-blue-600'}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {presencasData?.reason === 'STATUS_MATRICULADO' 
                      ? (periodoAtual?.status === 'ATIVO' 
                          ? 'Alunos precisam ser atualizados'
                          : `${periodoLabel} ainda não ativado`)
                      : 'Nenhum aluno matriculado encontrado'}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-6">
                    {presencasData?.message || (
                      presencasData?.reason === 'STATUS_MATRICULADO'
                        ? (periodoAtual?.status === 'ATIVO'
                            ? `O ${periodoLabel.toLowerCase()} está ativo, mas os alunos ainda estão com status "Matriculado". É necessário atualizar o status dos alunos para "Cursando" para poder registrar presenças.`
                            : `É necessário ativar o ${periodoLabel.toLowerCase()} para que os alunos passem a "Cursando" e possam ter presenças registradas.`)
                        : 'Não existem estudantes matriculados nesta disciplina para esta turma. Para lançar presenças, é necessário matricular estudantes primeiro.'
                    )}
                  </p>
                  {presencasData?.reason === 'STATUS_MATRICULADO' ? (
                    <>
                      {periodoAtual?.status === 'ATIVO' ? (
                        <p className="text-xs text-muted-foreground max-w-md mb-4">
                          O {periodoLabel.toLowerCase()} já está ativo. Clique no botão abaixo para atualizar o status dos alunos de "Matriculado" para "Cursando".
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground max-w-md mb-4">
                          Após ativar o {periodoLabel.toLowerCase()}, os alunos com status "Matriculado" serão atualizados para "Cursando" automaticamente.
                        </p>
                      )}
                      
                      {periodoAtual ? (
                        <div className="space-y-3 w-full max-w-md">
                          {/* Informações do Período */}
                          <div className="p-3 bg-white rounded-md border border-gray-200 text-left">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{periodoLabel} {periodoAtual.numero}/{periodoAtual.anoLetivo ?? context.anoLetivo}</span>
                              <Badge variant={periodoAtual.status === 'ATIVO' ? 'default' : 'secondary'}>
                                {periodoAtual.status === 'ATIVO' ? 'Ativo' : periodoAtual.status === 'PLANEJADO' ? 'Planejado' : periodoAtual.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>
                                <strong>Data de Início:</strong> {format(new Date(periodoAtual.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                              {periodoAtual.dataFim && (
                                <p>
                                  <strong>Data de Fim:</strong> {format(new Date(periodoAtual.dataFim), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              )}
                              {periodoAtual.status === 'PLANEJADO' && (
                                <p className="text-yellow-600 mt-2">
                                  <Info className="h-3 w-3 inline mr-1" />
                                  O {periodoLabel.toLowerCase()} será ativado automaticamente em {format(new Date(periodoAtual.dataInicio), "dd/MM/yyyy", { locale: ptBR })}, ou você pode ativar manualmente agora.
                                </p>
                              )}
                              {periodoAtual.status === 'ATIVO' && periodoAtual.ativadoEm && (
                                <p className="text-green-600 mt-2">
                                  <CheckCircle2 className="h-3 w-3 inline mr-1" />
                                  Ativado em {format(new Date(periodoAtual.ativadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  {periodoAtual.usuarioAtivou && ` por ${periodoAtual.usuarioAtivou.nomeCompleto || periodoAtual.usuarioAtivou.email}`}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Botão de Ativar ou Atualizar Alunos */}
                          {periodoAtual.status === 'PLANEJADO' ? (
                            <Button
                              onClick={() => {
                                ativarPeriodoMutation.mutate(isSecundario
                                  ? { trimestreId: periodoAtual.id }
                                  : { semestreId: periodoAtual.id });
                              }}
                              disabled={ativarPeriodoMutation.isPending}
                              className="gap-2 w-full"
                              variant="default"
                            >
                              <Calendar className="h-4 w-4" />
                              {ativarPeriodoMutation.isPending ? 'Ativando...' : `Ativar ${periodoLabel} Manualmente`}
                            </Button>
                          ) : periodoAtual.status === 'ATIVO' ? (
                            <Button
                              onClick={() => {
                                ativarPeriodoMutation.mutate(isSecundario
                                  ? { trimestreId: periodoAtual.id }
                                  : { semestreId: periodoAtual.id });
                              }}
                              disabled={ativarPeriodoMutation.isPending}
                              className="gap-2 w-full"
                              variant="default"
                            >
                              <RefreshCw className={`h-4 w-4 ${ativarPeriodoMutation.isPending ? 'animate-spin' : ''}`} />
                              {ativarPeriodoMutation.isPending ? 'Atualizando alunos...' : 'Atualizar Status dos Alunos'}
                            </Button>
                          ) : null}
                        </div>
                      ) : context.anoLetivo ? (
                        <div className="space-y-3 w-full max-w-md">
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-left">
                            <p className="text-xs text-yellow-800 mb-3">
                              <AlertCircle className="h-3 w-3 inline mr-1" />
                            {periodoLabel} não encontrado para o ano letivo {context.anoLetivo}. 
                            É necessário criar o {periodoLabel.toLowerCase()} primeiro antes de poder ativá-lo.
                            </p>
                            <Button
                              onClick={() => setCreateSemestreDialogOpen(true)}
                              className="gap-2 w-full"
                              variant="default"
                            >
                              <Plus className="h-4 w-4" />
                              Criar {periodoLabel}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : canAccessMatriculas && (
                    <Button
                      onClick={() => {
                        // Navegar para gestão de alunos com tab de matrículas em disciplinas
                        const basePath = userRoles.includes('SECRETARIA') 
                          ? '/secretaria-dashboard/alunos' 
                          : '/admin-dashboard/gestao-alunos';
                        navigate(`${basePath}?tab=matriculas-disciplinas`);
                      }}
                      className="gap-2"
                    >
                      <GraduationCap className="h-4 w-4" />
                      Ir para Matrículas Acadêmicas
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Informações da Aula e Estatísticas */}
              {presencasData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {presencasData.aulaLancada?.disciplina} - {formatDate(presencasData.aulaLancada?.data)}
                    </CardTitle>
                    {presencasData.aulaLancada?.turma && (
                      <CardDescription>
                        Turma: {presencasData.aulaLancada.turma}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="text-2xl font-bold">{totalAlunos}</div>
                          <div className="text-sm text-muted-foreground">Total de Estudantes</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="text-2xl font-bold text-green-600">{presentes}</div>
                          <div className="text-sm text-muted-foreground">Presentes</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <div>
                          <div className="text-2xl font-bold text-red-600">{ausentes}</div>
                          <div className="text-sm text-muted-foreground">Ausentes</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <div>
                          <div className="text-2xl font-bold text-yellow-600">{justificados}</div>
                          <div className="text-sm text-muted-foreground">Justificados</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabela de Alunos */}
              <Card>
                <CardHeader>
                  <CardTitle>Registro de Presenças</CardTitle>
                  <CardDescription>
                    {isSecretaria 
                      ? 'Consulta de presenças. Secretaria não pode alterar presenças lançadas por professores.'
                      : 'Marque a presença de cada aluno. Clique nos botões para alterar o status.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {presencasData?.presencas && presencasData.presencas.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[200px]">Nome do Estudante</TableHead>
                              <TableHead className="w-32">Status Atual</TableHead>
                              <TableHead className="min-w-[300px]">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                        <TableBody>
                          {presencasData.presencas.map((aluno: PresencaAluno) => {
                            const currentStatus = presencas.get(aluno.alunoId)?.status || aluno.status;
                            return (
                              <TableRow key={aluno.alunoId}>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{aluno.alunoNome}</div>
                                    {aluno.numeroIdentificacaoPublica && (
                                      <div className="text-sm text-muted-foreground">
                                        {aluno.numeroIdentificacaoPublica}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(currentStatus)}
                                </TableCell>
                                <TableCell>
                                  {presencasPermissions.canEdit ? (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant={currentStatus === 'PRESENTE' ? 'default' : 'outline'}
                                        className={currentStatus === 'PRESENTE' ? 'bg-green-500 hover:bg-green-600' : ''}
                                        onClick={() => handleStatusChange(aluno.alunoId, 'PRESENTE')}
                                      >
                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                        Presente
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant={currentStatus === 'AUSENTE' ? 'destructive' : 'outline'}
                                        onClick={() => handleStatusChange(aluno.alunoId, 'AUSENTE')}
                                      >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Ausente
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant={currentStatus === 'JUSTIFICADO' ? 'default' : 'outline'}
                                        className={currentStatus === 'JUSTIFICADO' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                                        onClick={() => handleStatusChange(aluno.alunoId, 'JUSTIFICADO')}
                                      >
                                        <AlertTriangle className="h-4 w-4 mr-1" />
                                        Justificado
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">
                                      {messages.secretariaCannotEdit}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum aluno matriculado encontrado para esta aula.
                    </div>
                  )}

                  {presencasData?.presencas && presencasData.presencas.length > 0 && presencasPermissions.canEdit && (
                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={handleSave}
                        disabled={savePresencasMutation.isPending}
                        size="lg"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {savePresencasMutation.isPending ? 'Salvando...' : 'Salvar Presenças'}
                      </Button>
                    </div>
                  )}
                  {isSecretaria && presencasData?.presencas && presencasData.presencas.length > 0 && (
                    <div className="mt-4">
                      <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                        {messages.secretariaCannotEdit}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Dialog para Criar Semestre */}
      <Dialog open={createSemestreDialogOpen} onOpenChange={setCreateSemestreDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar {periodoLabel}</DialogTitle>
            <DialogDescription>
              Crie um novo {periodoLabel.toLowerCase()} para o ano letivo {context.anoLetivo}. 
              O {periodoLabel.toLowerCase()} será ativado automaticamente na data de início configurada, ou você pode ativá-lo manualmente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="semestre-numero">Número do {periodoLabel} *</Label>
              <Input
                id="semestre-numero"
                type="number"
                min="1"
                max={isSecundario ? "3" : "12"}
                value={semestreFormData.numero}
                onChange={(e) => setSemestreFormData({ ...semestreFormData, numero: e.target.value })}
                placeholder={isSecundario ? "1, 2 ou 3" : "1 ou 2"}
                required
              />
              <p className="text-xs text-muted-foreground">
                {isSecundario
                  ? "Informe o número do trimestre (1, 2 ou 3)"
                  : "Informe o número do semestre (1 para 1º Semestre, 2 para 2º Semestre)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="semestre-data-inicio">Data de Início *</Label>
              <Input
                id="semestre-data-inicio"
                type="date"
                value={semestreFormData.dataInicio}
                onChange={(e) => setSemestreFormData({ ...semestreFormData, dataInicio: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                O {periodoLabel.toLowerCase()} será ativado automaticamente nesta data, ou você pode ativá-lo manualmente antes.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="semestre-data-fim">Data de Fim (Opcional)</Label>
              <Input
                id="semestre-data-fim"
                type="date"
                value={semestreFormData.dataFim}
                onChange={(e) => setSemestreFormData({ ...semestreFormData, dataFim: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="semestre-observacoes">Observações (Opcional)</Label>
              <Input
                id="semestre-observacoes"
                value={semestreFormData.observacoes}
                onChange={(e) => setSemestreFormData({ ...semestreFormData, observacoes: e.target.value })}
                placeholder={`Observações sobre o ${periodoLabel.toLowerCase()}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateSemestreDialogOpen(false);
                setSemestreFormData({
                  numero: "1",
                  dataInicio: "",
                  dataFim: "",
                  observacoes: "",
                });
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSemestre}
              disabled={createPeriodoMutation.isPending || !semestreFormData.dataInicio}
            >
              {createPeriodoMutation.isPending ? "Criando..." : `Criar ${periodoLabel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AnoLetivoAtivoGuard>
  );
}

