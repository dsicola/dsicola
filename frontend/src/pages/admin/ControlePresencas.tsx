import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { presencasApi, aulasLancadasApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Save, Users, Calendar, BookOpen, Info, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ControlePresencasContext {
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

export default function ControlePresencas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSecundario } = useInstituicao();
  
  // Verificar se o usuário tem permissão para acessar matrículas
  const canAccessMatriculas = user?.roles?.some(role => 
    ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN'].includes(role)
  ) || false;

  const [context, setContext] = useState<ControlePresencasContext>({
    cursoId: "",
    classeId: "",
    disciplinaId: "",
    professorId: "",
    anoLetivo: new Date().getFullYear(),
    turmaId: "",
  });

  const [selectedAulaId, setSelectedAulaId] = useState<string>("");
  const [presencas, setPresencas] = useState<Map<string, PresencaData>>(new Map());

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

  // Buscar anos letivos do banco (SEM valores hardcoded)
  const { data: anosLetivos = [] } = useQuery({
    queryKey: ["anos-letivos-presencas", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
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

  // Buscar presenças da aula selecionada
  const { data: presencasData, isLoading: loadingPresencas } = useQuery({
    queryKey: ["presencas-aula", selectedAulaId],
    queryFn: async () => {
      if (!selectedAulaId) return null;
      return await presencasApi.getByAula(selectedAulaId);
    },
    enabled: !!selectedAulaId,
    onSuccess: (data) => {
      // Verificar se há alunos matriculados
      if (data?.hasStudents === false) {
        setPresencas(new Map());
        // Não mostrar toast de erro - a mensagem será exibida no card
        return;
      }

      if (data?.presencas) {
        const presencasMap = new Map<string, PresencaData>();
        data.presencas.forEach((p: PresencaAluno) => {
          if (p.status) {
            presencasMap.set(p.alunoId, {
              alunoId: p.alunoId,
              status: p.status,
              observacoes: p.observacoes || undefined,
            });
          }
        });
        setPresencas(presencasMap);
      } else {
        setPresencas(new Map());
      }
    },
  });

  // Mutation para salvar presenças
  const savePresencasMutation = useMutation({
    mutationFn: async (data: { aulaLancadaId: string; presencas: PresencaData[] }) => {
      return await presencasApi.createOrUpdate(data);
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Presenças registradas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["presencas-aula", selectedAulaId] });
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

    const presencasArray = Array.from(presencas.values()).filter((p) => p.status !== null);
    
    if (presencasArray.length === 0) {
      toast({
        title: "Aviso",
        description: "Nenhuma presença foi marcada.",
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

  const getStatusIcon = (status: StatusPresenca | null) => {
    if (status === 'PRESENTE') return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (status === 'AUSENTE') return <XCircle className="h-5 w-5 text-red-600" />;
    if (status === 'JUSTIFICADO') return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return null;
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

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Controle de Presenças</h1>
              <p className="text-muted-foreground">
                Registre a presença dos alunos em cada aula ministrada
              </p>
            </div>
          </div>
        </div>

        {/* Filtros de Contexto */}
        <Card>
          <CardHeader>
            <CardTitle>Contexto da Aula</CardTitle>
            <CardDescription>
              Selecione o contexto para filtrar as aulas lançadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {!isSecundario && (
                <div className="space-y-2">
                  <Label htmlFor="curso">Curso</Label>
                  <Select
                    value={context.cursoId || ""}
                    onValueChange={(value) => {
                      setContext({ ...context, cursoId: value, disciplinaId: "", turmaId: "" });
                      setSelectedAulaId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o curso" />
                    </SelectTrigger>
                    <SelectContent>
                      {cursos?.filter((curso: any) => curso?.id).map((curso: any) => (
                        <SelectItem key={curso.id} value={String(curso.id)}>
                          {curso.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isSecundario && (
                <div className="space-y-2">
                  <Label htmlFor="classe">Classe</Label>
                  <Select
                    value={context.classeId || ""}
                    onValueChange={(value) => {
                      setContext({ ...context, classeId: value, disciplinaId: "", turmaId: "" });
                      setSelectedAulaId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.filter((classe: any) => classe?.id).map((classe: any) => (
                        <SelectItem key={classe.id} value={String(classe.id)}>
                          {classe.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="disciplina">Disciplina *</Label>
                <Select
                  value={context.disciplinaId || ""}
                  onValueChange={(value) => {
                    setContext({ ...context, disciplinaId: value, turmaId: "" });
                    setSelectedAulaId("");
                  }}
                  disabled={!context.cursoId && !context.classeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplinas?.filter((disciplina: any) => disciplina?.id).map((disciplina: any) => (
                      <SelectItem key={disciplina.id} value={String(disciplina.id)}>
                        {disciplina.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="professor">Professor *</Label>
                <Select
                  value={context.professorId || ""}
                  onValueChange={(value) => {
                    setContext({ ...context, professorId: value });
                    setSelectedAulaId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o professor" />
                  </SelectTrigger>
                  <SelectContent>
                    {professores?.filter((prof: any) => prof?.id).map((prof: any) => (
                      <SelectItem key={prof.id} value={String(prof.id)}>
                        {prof.nome_completo || prof.nomeCompleto || prof.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anoLetivo">Ano Letivo *</Label>
                <Select
                  value={context.anoLetivo?.toString() || ""}
                  onValueChange={(value) => {
                    setContext({ ...context, anoLetivo: parseInt(value) });
                    setSelectedAulaId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano letivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {anosLetivos.length === 0 ? (
                      <SelectItem value="empty" disabled>Nenhum ano letivo cadastrado</SelectItem>
                    ) : (
                      anosLetivos.map((al: any) => (
                        <SelectItem key={al.id} value={al.ano.toString()}>
                          {al.ano} {al.status === 'ATIVO' && '🟢'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="turma">Turma (opcional)</Label>
                <Select
                  value={context.turmaId || "all"}
                  onValueChange={(value) => {
                    setContext({ ...context, turmaId: value === "all" ? "" : value });
                    setSelectedAulaId("");
                  }}
                  disabled={!context.disciplinaId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as turmas</SelectItem>
                    {turmas?.filter((turma: any) => turma?.id).map((turma: any) => (
                      <SelectItem key={turma.id} value={String(turma.id)}>
                        {turma.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                        ? 'Semestre ainda não iniciado'
                        : 'Nenhum aluno matriculado encontrado'}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md mb-6">
                      {presencasData?.message || (
                        presencasData?.reason === 'STATUS_MATRICULADO'
                          ? 'É necessário iniciar o semestre para que os alunos passem a "Cursando" e possam ter presenças registradas.'
                          : 'Não existem estudantes matriculados nesta disciplina para esta turma. Para lançar presenças, é necessário matricular estudantes primeiro.'
                      )}
                    </p>
                    {presencasData?.reason === 'STATUS_MATRICULADO' ? (
                      <p className="text-xs text-muted-foreground max-w-md mb-4">
                        Após iniciar o semestre, os alunos com status "Matriculado" serão atualizados para "Cursando" automaticamente.
                      </p>
                    ) : canAccessMatriculas && (
                      <Button
                        onClick={() => {
                          // Navegar para gestão de alunos com tab de matrículas em disciplinas
                          const basePath = user?.roles?.includes('SECRETARIA') 
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
                        <Calendar className="h-5 w-5" />
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
                      Marque a presença de cada aluno. Clique nos botões para alterar o status.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {presencasData?.presencas && presencasData.presencas.length > 0 ? (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome do Estudante</TableHead>
                              <TableHead className="w-32">Status Atual</TableHead>
                              <TableHead className="w-64">Ações</TableHead>
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
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum aluno matriculado encontrado para esta aula.
                      </div>
                    )}

                    {presencasData?.presencas && presencasData.presencas.length > 0 && (
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
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

