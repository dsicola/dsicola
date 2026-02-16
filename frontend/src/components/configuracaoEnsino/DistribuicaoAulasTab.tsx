import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { distribuicaoAulasApi, planoEnsinoApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { AnoLetivoAtivoGuard } from "@/components/academico/AnoLetivoAtivoGuard";
import { AnoLetivoSelect } from "@/components/academico/AnoLetivoSelect";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Calendar, CalendarDays, AlertCircle, Play, RefreshCw, Loader2, Trash2, BarChart3, CheckCircle2, Clock, Info } from "lucide-react";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AvisoInstitucional } from "@/components/academico/AvisoInstitucional";

interface ContextType {
  cursoId?: string;
  classeId?: string;
  disciplinaId?: string;
  professorId?: string;
  anoLetivo?: number;
  turmaId?: string;
}

interface AulaDistribuida {
  planoAulaId: string;
  ordem: number;
  titulo: string;
  trimestre: number;
  quantidadeAulas: number;
  datas: string[];
  aulasLancadas?: number; // Número de aulas já lançadas (opcional)
}

interface DistribuicaoAulasTabProps {
  sharedContext?: ContextType;
  onContextChange?: (context: ContextType) => void;
}

export function DistribuicaoAulasTab({ sharedContext, onContextChange }: DistribuicaoAulasTabProps) {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSuperior, isSecundario } = useInstituicao();
  const { calendario, messages, isSecretaria } = useRolePermissions();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();

  // Removido: busca manual de anos letivos - usar AnoLetivoSelect que já faz isso

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

  const [dataInicio, setDataInicio] = useState("");
  const [diasSemana, setDiasSemana] = useState<string[]>([]);

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
    queryKey: ["cursos-distribuicao", instituicaoId],
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
    queryKey: ["classes-distribuicao", instituicaoId],
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
    queryKey: ["disciplinas-distribuicao", context.cursoId, context.classeId],
    queryFn: async () => {
      const params: any = { ativo: true };
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      return await disciplinasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId),
  });

  // Buscar professores (tabela professores - entidade acadêmica)
  // REGRA SIGA/SIGAE: GET /professores - NUNCA usar /users?role=PROFESSOR (value=professores.id)
  const { data: professores } = useQuery({
    queryKey: ["professores-distribuicao", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
  });

  // Buscar turmas
  const { data: turmas } = useQuery({
    queryKey: ["turmas-distribuicao", context.cursoId, context.classeId, context.disciplinaId],
    queryFn: async () => {
      const params: any = {};
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      if (context.disciplinaId) params.disciplinaId = context.disciplinaId;
      return await turmasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId) && !!context.disciplinaId,
  });

  // Buscar plano de ensino
  const { data: planoEnsino } = useQuery({
    queryKey: ["plano-ensino-distribuicao", context],
    queryFn: async () => {
      if (!context.disciplinaId || !context.professorId || !context.anoLetivo) {
        return null;
      }
      try {
        return await planoEnsinoApi.getByContext({
          cursoId: context.cursoId || undefined,
          classeId: context.classeId || undefined,
          disciplinaId: context.disciplinaId,
          professorId: context.professorId,
          anoLetivo: context.anoLetivo,
          turmaId: context.turmaId || undefined,
        });
      } catch {
        return null;
      }
    },
    enabled: !!(context.disciplinaId && context.professorId && context.anoLetivo),
  });

  // Buscar distribuição existente
  const { data: distribuicao = [], isLoading: loadingDistribuicao } = useQuery({
    queryKey: ["distribuicao-aulas", context],
    queryFn: async () => {
      if (!context.disciplinaId || !context.professorId || !context.anoLetivo || !planoEnsino?.id) {
        return [];
      }
      try {
        return await distribuicaoAulasApi.getByPlano(planoEnsino.id);
      } catch {
        return [];
      }
    },
    enabled: !!planoEnsino?.id && !!(context.disciplinaId && context.professorId && context.anoLetivo),
  });

  // Calcular estatísticas da distribuição
  const estatisticasDistribuicao = useMemo(() => {
    if (!distribuicao || distribuicao.length === 0) {
      return {
        totalAulas: 0,
        totalDatas: 0,
        aulasComDistribuicao: 0,
        aulasSemDistribuicao: 0,
      };
    }

    const totalAulas = distribuicao.reduce((sum: number, aula: AulaDistribuida) => sum + aula.quantidadeAulas, 0);
    const totalDatas = distribuicao.reduce((sum: number, aula: AulaDistribuida) => sum + (aula.datas?.length || 0), 0);
    const aulasComDistribuicao = distribuicao.filter((aula: AulaDistribuida) => aula.datas && aula.datas.length > 0).length;
    const aulasSemDistribuicao = distribuicao.filter((aula: AulaDistribuida) => !aula.datas || aula.datas.length === 0).length;

    return {
      totalAulas,
      totalDatas,
      aulasComDistribuicao,
      aulasSemDistribuicao,
    };
  }, [distribuicao]);

  const contextComplete = !!(context.disciplinaId && context.professorId && context.anoLetivo);

  // Mutation para gerar distribuição automática
  const gerarDistribuicaoMutation = useMutation({
    mutationFn: async (params: {
      planoEnsinoId: string;
      dataInicio: string;
      diasSemana: number[];
    }) => {
      return await distribuicaoAulasApi.gerarDistribuicao(params);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["distribuicao-aulas"] });
      toast({
        title: "Distribuição calculada",
        description: `${data.totalDatasSugeridas || 0} datas sugeridas calculadas. Use a aba "Lançamento de Aulas" para registrar as aulas.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.response?.data?.message || "Erro ao gerar distribuição",
        variant: "destructive",
      });
    },
  });

  const handleGerarDistribuicao = () => {
    if (!planoEnsino?.id) {
      toast({
        title: "Erro",
        description: "Plano de ensino não encontrado",
        variant: "destructive",
      });
      return;
    }

    if (!dataInicio) {
      toast({
        title: "Erro",
        description: "Data de início é obrigatória",
        variant: "destructive",
      });
      return;
    }

    if (diasSemana.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um dia da semana",
        variant: "destructive",
      });
      return;
    }

    gerarDistribuicaoMutation.mutate({
      planoEnsinoId: planoEnsino.id,
      dataInicio,
      diasSemana: diasSemana.map(d => parseInt(d)),
    });
  };

  const toggleDiaSemana = (dia: number) => {
    const diaStr = dia.toString();
    if (diasSemana.includes(diaStr)) {
      setDiasSemana(diasSemana.filter(d => d !== diaStr));
    } else {
      setDiasSemana([...diasSemana, diaStr].sort());
    }
  };

  const updateContext = (updates: Partial<ContextType>) => {
    setContext((prev) => ({ ...prev, ...updates }));
  };

  const diasSemanaLabels = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Segunda" },
    { value: 2, label: "Terça" },
    { value: 3, label: "Quarta" },
    { value: 4, label: "Quinta" },
    { value: 5, label: "Sexta" },
    { value: 6, label: "Sábado" },
  ];

  return (
    <AnoLetivoAtivoGuard showAlert={true} disableChildren={false}>
      <div className="space-y-6">
      {isSecretaria && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {messages.secretariaCannotEditCalendar}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Contexto Obrigatório */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Contexto da Distribuição
          </CardTitle>
          <CardDescription>
            {isSecretaria 
              ? 'Consulta de distribuição de aulas. Secretaria não pode gerar ou alterar distribuições.'
              : 'Selecione o contexto e configure a distribuição automática de datas'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Curso (Ensino Superior) ou Classe (Ensino Médio) */}
            {isSecundario ? (
              <div className="space-y-2">
                <Label>Classe / Ano *</Label>
                <Select
                  value={context.classeId || ""}
                  onValueChange={(value) => {
                    updateContext({
                      classeId: value,
                      disciplinaId: "",
                      turmaId: "",
                    });
                  }}
                  disabled={!classes || classes.length === 0}
                >
                  <SelectTrigger className={!classes || classes.length === 0 ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                    <SelectValue placeholder="Selecione a classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes && classes.length > 0 ? (
                      classes.filter((classe: any) => classe?.id).map((classe: any) => (
                        <SelectItem key={classe.id} value={String(classe.id)}>
                          {classe.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma classe disponível</div>
                    )}
                  </SelectContent>
                </Select>
                {(!classes || classes.length === 0) && (
                  <AvisoInstitucional
                    tipo="custom"
                    variant="warning"
                    titulo="Nenhuma classe cadastrada"
                    mensagem="Cadastre uma classe antes de continuar. Acesse Gestão Acadêmica → Classes para criar."
                    ctaLabel="Gerenciar Classes"
                    ctaRoute="/admin-dashboard/gestao-academica?tab=classes"
                  />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Curso *</Label>
                <Select
                  value={context.cursoId || ""}
                  onValueChange={(value) => {
                    updateContext({
                      cursoId: value,
                      disciplinaId: "",
                      turmaId: "",
                    });
                  }}
                  disabled={!cursos || cursos.length === 0}
                >
                  <SelectTrigger className={!cursos || cursos.length === 0 ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                    <SelectValue placeholder="Selecione o curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {cursos && cursos.length > 0 ? (
                      cursos.filter((curso: any) => curso?.id).map((curso: any) => (
                        <SelectItem key={curso.id} value={String(curso.id)}>
                          {curso.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum curso disponível</div>
                    )}
                  </SelectContent>
                </Select>
                {(!cursos || cursos.length === 0) && (
                  <AvisoInstitucional
                    tipo="custom"
                    variant="warning"
                    titulo="Nenhum curso cadastrado"
                    mensagem="Cadastre um curso antes de continuar. Acesse Configuração de Ensino → Cursos para criar."
                    ctaLabel="Gerenciar Cursos"
                    ctaRoute="/admin-dashboard/configuracao-ensino?tab=cursos"
                  />
                )}
              </div>
            )}

            {/* Disciplina */}
            <div className="space-y-2">
              <Label>Disciplina *</Label>
              <Select
                value={context.disciplinaId || ""}
                onValueChange={(value) => {
                  updateContext({
                    disciplinaId: value,
                    turmaId: "",
                  });
                }}
                disabled={(!context.cursoId && !context.classeId) || (!disciplinas || disciplinas.length === 0)}
              >
                <SelectTrigger className={(!disciplinas || disciplinas.length === 0) && (context.cursoId || context.classeId) ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                  <SelectValue placeholder="Selecione a disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {disciplinas && disciplinas.length > 0 ? (
                    disciplinas.filter((disciplina: any) => disciplina?.id).map((disciplina: any) => (
                      <SelectItem key={disciplina.id} value={String(disciplina.id)}>
                        {disciplina.nome}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {!context.cursoId && !context.classeId ? "Selecione um curso/classe primeiro" : "Nenhuma disciplina disponível"}
                    </div>
                  )}
                </SelectContent>
              </Select>
              {(!disciplinas || disciplinas.length === 0) && (context.cursoId || context.classeId) && (
                <AvisoInstitucional
                  tipo="custom"
                  variant="warning"
                  titulo="Nenhuma disciplina cadastrada"
                  mensagem="Cadastre uma disciplina para este curso/classe antes de continuar. Acesse Configuração de Ensino → Disciplinas para criar."
                  ctaLabel="Gerenciar Disciplinas"
                  ctaRoute="/admin-dashboard/configuracao-ensino?tab=disciplinas"
                />
              )}
            </div>

            {/* Professor */}
            <div className="space-y-2">
              <Label>Professor *</Label>
              <Select
                value={context.professorId || ""}
                onValueChange={(value) => {
                  updateContext({ professorId: value });
                }}
                disabled={!professores || professores.length === 0}
              >
                <SelectTrigger className={!professores || professores.length === 0 ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                  <SelectValue placeholder="Selecione o professor" />
                </SelectTrigger>
                <SelectContent>
                  {professores && professores.length > 0 ? (
                    professores.filter((prof: any) => prof?.id).map((prof: any) => (
                      <SelectItem key={prof.id} value={String(prof.id)}>
                        {prof.nome_completo || prof.nomeCompleto || prof.email || String(prof.id)}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum professor disponível</div>
                  )}
                </SelectContent>
              </Select>
              {(!professores || professores.length === 0) && (
                <AvisoInstitucional
                  tipo="custom"
                  variant="warning"
                  titulo="Nenhum professor cadastrado"
                  mensagem="Cadastre um professor antes de continuar. Acesse Gestão de Professores para criar."
                  ctaLabel="Gerenciar Professores"
                  ctaRoute="/admin-dashboard/gestao-professores"
                />
              )}
            </div>

            {/* Ano Letivo */}
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

            {/* Turma (Opcional) */}
            <div className="space-y-2">
              <Label>Turma (Opcional)</Label>
              <Select
                value={context.turmaId || "none"}
                onValueChange={(value) => {
                  updateContext({ turmaId: value === "none" ? "" : value });
                }}
                disabled={!context.disciplinaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma turma específica</SelectItem>
                  {turmas && turmas.length > 0 ? (
                    turmas.filter((turma: any) => turma?.id).map((turma: any) => (
                      <SelectItem key={turma.id} value={String(turma.id)}>
                        {turma.nome}
                      </SelectItem>
                    ))
                  ) : context.disciplinaId ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma turma disponível</div>
                  ) : null}
                </SelectContent>
              </Select>
              {context.disciplinaId && (!turmas || turmas.length === 0) && (
                <AvisoInstitucional
                  tipo="custom"
                  variant="info"
                  titulo="Nenhuma turma cadastrada"
                  mensagem="Não há turmas cadastradas para esta disciplina. Você pode continuar sem selecionar uma turma específica."
                  ctaLabel="Gerenciar Turmas"
                  ctaRoute="/admin-dashboard/gestao-academica?tab=turmas"
                />
              )}
            </div>
          </div>

          {!contextComplete && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Preencha todos os campos obrigatórios para gerar a distribuição
              </p>
            </div>
          )}

          {!planoEnsino && contextComplete && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">
                Plano de Ensino não encontrado. Crie um plano de ensino primeiro.
              </p>
            </div>
          )}

          {planoEnsino && contextComplete && planoEnsino.status !== 'APROVADO' && planoEnsino.estado !== 'APROVADO' && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 mb-1">
                  Plano de Ensino não está aprovado
                </p>
                <p className="text-xs text-yellow-700">
                  O plano precisa estar aprovado antes de distribuir aulas. 
                  Status atual: <strong>{planoEnsino.status || planoEnsino.estado || 'RASCUNHO'}</strong>
                  <br />
                  Acesse a aba "Plano de Ensino" → "5. Finalizar" para aprovar o plano.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração de Distribuição */}
      {contextComplete && planoEnsino && (planoEnsino.status === 'APROVADO' || planoEnsino.estado === 'APROVADO') && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Configurar Distribuição Automática
                </CardTitle>
                <CardDescription className="mt-2">
                  <p className="mb-2">
                    Configure os parâmetros para calcular automaticamente as datas sugeridas respeitando o calendário acadêmico.
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 mt-3">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">📋 Como funciona:</p>
                    <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                      <li>O sistema calcula automaticamente as datas baseado na <strong>data de início</strong> e <strong>dias da semana</strong> selecionados</li>
                      <li>Feriados e eventos do calendário acadêmico são <strong>automaticamente ignorados</strong></li>
                      <li>As datas são apenas <strong>sugeridas</strong> - você precisará lançar as aulas na aba "Lançamento de Aulas"</li>
                      <li>O sistema distribui as aulas sequencialmente, respeitando a ordem e quantidade de cada aula planejada</li>
                    </ol>
                  </div>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Passo 1: Data de Início */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  1
                </div>
                <Label className="text-base font-semibold">Data de Início das Aulas *</Label>
              </div>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Selecione a data em que as aulas desta disciplina começarão a ser ministradas.
              </p>
            </div>

            {/* Passo 2: Dias da Semana */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  2
                </div>
                <Label className="text-base font-semibold">Dias da Semana das Aulas *</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {diasSemanaLabels.map((dia) => (
                  <Button
                    key={dia.value}
                    type="button"
                    variant={diasSemana.includes(dia.value.toString()) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (calendario.canCreate) {
                        toggleDiaSemana(dia.value);
                      } else {
                        toast({
                          title: 'Ação não permitida',
                          description: messages.secretariaCannotEditCalendar,
                          variant: 'destructive',
                        });
                      }
                    }}
                    disabled={!calendario.canCreate}
                    className="min-w-[80px]"
                  >
                    {dia.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione os dias da semana em que as aulas serão ministradas. Clique nos botões para selecionar/desselecionar.
              </p>
              {diasSemana.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 p-2 rounded-md">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    <strong>{diasSemana.length}</strong> dia(s) selecionado(s): {diasSemana.map(d => diasSemanaLabels[parseInt(d)].label).join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Passo 3: Gerar Distribuição */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  3
                </div>
                <Label className="text-base font-semibold">Gerar Distribuição</Label>
              </div>
              
              {calendario.canCreate ? (
                <div className="space-y-2">
                  <Button
                    onClick={handleGerarDistribuicao}
                    disabled={!dataInicio || diasSemana.length === 0 || gerarDistribuicaoMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {gerarDistribuicaoMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando distribuição...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Gerar Distribuição Automática
                      </>
                    )}
                  </Button>
                  {distribuicao.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (confirm('Deseja gerar uma nova distribuição? Isso irá substituir a distribuição atual.')) {
                          handleGerarDistribuicao();
                        }
                      }}
                      disabled={!dataInicio || diasSemana.length === 0 || gerarDistribuicaoMutation.isPending}
                      className="w-full"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Re-gerar Distribuição
                    </Button>
                  )}
                  
                  {/* Validação visual */}
                  {(!dataInicio || diasSemana.length === 0) && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-yellow-800 dark:text-yellow-300">
                          <p className="font-medium mb-1">Preencha todos os campos obrigatórios:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-xs">
                            {!dataInicio && <li>Selecione a <strong>data de início</strong></li>}
                            {diasSemana.length === 0 && <li>Selecione pelo menos um <strong>dia da semana</strong></li>}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {messages.secretariaCannotEditCalendar}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            {/* Resumo da Configuração */}
            {dataInicio && diasSemana.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-300 space-y-2 flex-1">
                    <p className="font-semibold">📅 Resumo da Configuração:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Data de Início:</p>
                        <p className="text-base font-bold">{format(new Date(dataInicio), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Dias da Semana:</p>
                        <div className="flex flex-wrap gap-1">
                          {diasSemana.map(d => (
                            <Badge key={d} variant="secondary" className="text-xs">
                              {diasSemanaLabels[parseInt(d)].label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-blue-200 dark:border-blue-800 mt-2">
                      <p className="text-xs">
                        ✅ A distribuição respeitará automaticamente <strong>feriados</strong> e <strong>eventos do calendário acadêmico</strong>
                      </p>
                      <p className="text-xs mt-1">
                        ℹ️ Após gerar, você poderá visualizar todas as datas sugeridas na tabela abaixo e lançar as aulas na aba "Lançamento de Aulas"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações do Plano de Ensino */}
      {contextComplete && planoEnsino && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Informações do Plano de Ensino
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Carga Horária Total</p>
                <p className="text-lg font-semibold">{planoEnsino.cargaHorariaTotal || planoEnsino.carga_horaria_total || 0}h</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Carga Horária Planejada</p>
                <p className="text-lg font-semibold">{planoEnsino.cargaHorariaPlanejada || planoEnsino.carga_horaria_planejada || 0}h</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total de Aulas Planejadas</p>
                <p className="text-lg font-semibold">
                  {planoEnsino.aulas?.reduce((sum: number, aula: any) => sum + (aula.quantidadeAulas || 0), 0) || 0} aula(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  {planoEnsino.aulas?.length || 0} tópico(s) de conteúdo
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={planoEnsino.status === 'APROVADO' || planoEnsino.estado === 'APROVADO' ? 'default' : 'secondary'}>
                  {planoEnsino.status || planoEnsino.estado || 'RASCUNHO'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas da Distribuição */}
      {contextComplete && planoEnsino && distribuicao.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Estatísticas da Distribuição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{estatisticasDistribuicao.totalAulas}</p>
                  <p className="text-xs text-muted-foreground">Total de Aulas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <CalendarDays className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{estatisticasDistribuicao.totalDatas}</p>
                  <p className="text-xs text-muted-foreground">Datas Distribuídas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{estatisticasDistribuicao.aulasComDistribuicao}</p>
                  <p className="text-xs text-muted-foreground">Aulas com Datas</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{estatisticasDistribuicao.aulasSemDistribuicao}</p>
                  <p className="text-xs text-muted-foreground">Aulas sem Datas</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visualização da Distribuição */}
      {contextComplete && planoEnsino && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Datas Sugeridas Calculadas</CardTitle>
                <CardDescription>
                  Visualize as datas sugeridas calculadas automaticamente para cada aula.
                  <br />
                  <strong>Próximo passo:</strong> Acesse a aba "Lançamento de Aulas" para registrar as aulas como ministradas nestas datas.
                </CardDescription>
              </div>
              {distribuicao.length > 0 && calendario.canCreate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Deseja realmente limpar a distribuição atual? Você precisará gerar uma nova distribuição.')) {
                      // Limpar distribuição (por enquanto apenas invalidar query - backend pode implementar delete)
                      queryClient.invalidateQueries({ queryKey: ["distribuicao-aulas"] });
                      setDataInicio("");
                      setDiasSemana([]);
                      toast({
                        title: "Distribuição limpa",
                        description: "Você pode gerar uma nova distribuição agora.",
                      });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Distribuição
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingDistribuicao ? (
              <div className="text-center py-8 text-muted-foreground">Carregando distribuição...</div>
            ) : distribuicao.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma distribuição encontrada.
                  <br />
                  Configure os parâmetros acima e gere a distribuição automática.
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Ordem</TableHead>
                        <TableHead className="min-w-[200px]">Título</TableHead>
                        <TableHead className="w-24">Trimestre</TableHead>
                        <TableHead className="w-32">Quantidade</TableHead>
                        <TableHead className="w-32">Progresso</TableHead>
                        <TableHead className="min-w-[300px]">Datas Distribuídas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {distribuicao.map((aula: AulaDistribuida) => (
                        <TableRow key={aula.planoAulaId}>
                          <TableCell className="font-medium">{aula.ordem}</TableCell>
                          <TableCell className="font-medium">{aula.titulo}</TableCell>
                          <TableCell>
                            {isSuperior ? (
                              <Badge variant="secondary">{aula.trimestre}º Semestre</Badge>
                            ) : isSecundario ? (
                              <Badge variant="secondary">{aula.trimestre}º Trimestre</Badge>
                            ) : (
                              <Badge variant="secondary">{aula.trimestre}º Período</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{aula.quantidadeAulas} aula(s)</p>
                              {aula.aulasLancadas !== undefined && (
                                <p className="text-xs text-muted-foreground">
                                  {aula.aulasLancadas} lançada(s)
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {aula.datas && aula.datas.length > 0 ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-muted rounded-full h-2">
                                    <div 
                                      className="bg-primary h-2 rounded-full transition-all"
                                      style={{ 
                                        width: `${Math.min(100, (aula.datas.length / aula.quantidadeAulas) * 100)}%` 
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                    {aula.datas.length}/{aula.quantidadeAulas}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-xs">Sem distribuição</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {aula.datas && aula.datas.length > 0 ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-1 max-w-[500px]">
                                  {aula.datas.map((data, idx) => (
                                    <Badge key={`${aula.planoAulaId}-${data}-${idx}`} variant="outline" className="text-xs whitespace-nowrap">
                                      {format(new Date(data), "dd/MM", { locale: ptBR })}
                                    </Badge>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {aula.datas.length} de {aula.quantidadeAulas} data(s) distribuída(s)
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm">Nenhuma data distribuída</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </AnoLetivoAtivoGuard>
  );
}
