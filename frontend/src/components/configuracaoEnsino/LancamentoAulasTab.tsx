import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { aulasLancadasApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Calendar, CheckCircle2, Clock, AlertCircle, Plus, Trash2 } from "lucide-react";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AnoLetivoAtivoGuard, useAnoLetivoAtivoProps } from "@/components/academico/AnoLetivoAtivoGuard";
import { AnoLetivoSelect } from "@/components/academico/AnoLetivoSelect";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";
import { ConfirmacaoResponsabilidadeDialog } from "@/components/common/ConfirmacaoResponsabilidadeDialog";

interface ContextType {
  cursoId?: string;
  classeId?: string;
  disciplinaId?: string;
  professorId?: string;
  anoLetivo?: number;
  turmaId?: string;
}

interface AulaPlanejada {
  id: string;
  ordem: number;
  titulo: string;
  descricao?: string;
  tipo: string;
  trimestre: number;
  quantidadeAulas: number;
  status: string;
  dataMinistrada?: string;
  totalLancado: number;
  totalDistribuido?: number; // Número de datas distribuídas
  lancamentos: Array<{
    id: string;
    data: string;
    observacoes?: string;
  }>;
  datasDistribuidas?: string[]; // Datas sugeridas da distribuição
}

interface LancamentoAulasTabProps {
  sharedContext?: ContextType;
  onContextChange?: (context: ContextType) => void;
}

export function LancamentoAulasTab({ sharedContext, onContextChange }: LancamentoAulasTabProps) {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSuperior, isSecundario } = useInstituicao();
  const { lancamentoAulas, messages, isSecretaria } = useRolePermissions();
  const { anoLetivoAtivo, hasAnoLetivoAtivo } = useAnoLetivoAtivo();
  const anoLetivoProps = useAnoLetivoAtivoProps();

  // Removido: busca manual de anos letivos - usar AnoLetivoSelect que já faz isso

  // Pré-selecionar ano letivo ativo se disponível
  const anoLetivoInicial = useMemo(() => {
    if (sharedContext?.anoLetivo) return sharedContext.anoLetivo;
    if (anoLetivoAtivo?.ano) return anoLetivoAtivo.ano;
    return new Date().getFullYear();
  }, [sharedContext?.anoLetivo, anoLetivoAtivo?.ano]);

  const [context, setContext] = useState<ContextType>(
    sharedContext || {
      cursoId: "",
      classeId: "",
      disciplinaId: "",
      professorId: "",
      anoLetivo: anoLetivoInicial,
      turmaId: "",
    }
  );

  const updateContext = (updates: Partial<ContextType>) => {
    setContext((prev) => ({ ...prev, ...updates }));
  };

  // Atualizar ano letivo quando ano letivo ativo mudar
  useEffect(() => {
    if (anoLetivoAtivo?.ano && !context.anoLetivo) {
      updateContext({ anoLetivo: anoLetivoAtivo.ano });
    }
  }, [anoLetivoAtivo?.ano]);

  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [selectedAula, setSelectedAula] = useState<AulaPlanejada | null>(null);
  const [dataLancamento, setDataLancamento] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState<string>("1");
  const [conteudoMinistrado, setConteudoMinistrado] = useState("");
  const [observacoes, setObservacoes] = useState("");

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
    queryKey: ["cursos-lancamento", instituicaoId],
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
    queryKey: ["classes-lancamento", instituicaoId],
    queryFn: async () => {
      if (isSecundario) {
        return await classesApi.getAll({ ativo: true });
      }
      return [];
    },
    enabled: isSecundario && !!instituicaoId,
  });

  // Buscar disciplinas baseado no curso/classe selecionado
  const { data: disciplinas } = useQuery({
    queryKey: ["disciplinas-lancamento", context.cursoId, context.classeId],
    queryFn: async () => {
      const params: any = { ativo: true };
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      return await disciplinasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId),
  });

  // Buscar professores (tabela professores - entidade acadêmica)
  // GET /professores - NUNCA usar /users?role=PROFESSOR
  const { data: professores } = useQuery({
    queryKey: ["professores-lancamento", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
  });

  // Buscar turmas
  const { data: turmas } = useQuery({
    queryKey: ["turmas-lancamento", context.cursoId, context.classeId, context.disciplinaId],
    queryFn: async () => {
      const params: any = {};
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      if (context.disciplinaId) params.disciplinaId = context.disciplinaId;
      return await turmasApi.getAll(params);
    },
    enabled: !!(context.cursoId || context.classeId) && !!context.disciplinaId,
  });

  // Buscar aulas planejadas (com distribuição)
  const { data: aulasPlanejadas = [], isLoading: loadingAulas } = useQuery({
    queryKey: ["aulas-planejadas", context],
    queryFn: async () => {
      if (!context.disciplinaId || !context.professorId || !context.anoLetivo) {
        return [];
      }
      // Preparar parâmetros - não enviar turmaId se for undefined ou string vazia
      const params: any = {
        disciplinaId: context.disciplinaId,
        professorId: context.professorId,
        anoLetivo: context.anoLetivo,
      };
      
      // Adicionar cursoId ou classeId apenas se existir
      if (context.cursoId) {
        params.cursoId = context.cursoId;
      }
      if (context.classeId) {
        params.classeId = context.classeId;
      }
      
      // Adicionar turmaId apenas se for fornecido (não undefined nem string vazia)
      if (context.turmaId && context.turmaId.trim() !== '') {
        params.turmaId = context.turmaId;
      }
      
      return await aulasLancadasApi.getAulasPlanejadas(params);
    },
    enabled: !!(context.disciplinaId && context.professorId && context.anoLetivo),
  });

  const contextComplete = !!(context.disciplinaId && context.professorId && context.anoLetivo);

  // Mutation para criar lançamento
  const createLancamentoMutation = useSafeMutation({
    mutationFn: (data: {
      planoAulaId: string;
      data: string;
      conteudoMinistrado: string;
      horaInicio?: string;
      horaFim?: string;
      cargaHoraria?: number;
      observacoes?: string;
    }) => aulasLancadasApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aulas-planejadas"] });
      toast({
        title: "Sucesso",
        description: "Aula lançada com sucesso",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível lançar aula",
        description: error?.response?.data?.message || "Não foi possível lançar a aula. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutation para remover lançamento
  const deleteLancamentoMutation = useSafeMutation({
    mutationFn: (lancamentoId: string) => aulasLancadasApi.delete(lancamentoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aulas-planejadas"] });
      toast({
        title: "Sucesso",
        description: "Lançamento removido com sucesso",
      });
      setCriticoRemoverLancamentoId(null);
    },
    onError: (error: any) => {
      setCriticoRemoverLancamentoId(null);
      toast({
        title: "Não foi possível remover",
        description: error?.response?.data?.message || "Não foi possível remover o lançamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleAbrirDialog = (aula: AulaPlanejada) => {
    setSelectedAula(aula);
    setDataLancamento(new Date().toISOString().split('T')[0]);
    setCargaHoraria(String(aula.quantidadeAulas || 1));
    setConteudoMinistrado("");
    setObservacoes("");
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedAula(null);
    setDataLancamento("");
    setHoraInicio("");
    setHoraFim("");
    setCargaHoraria("1");
    setConteudoMinistrado("");
    setObservacoes("");
  };

  const handleConfirmarLancamento = () => {
    if (!selectedAula || !dataLancamento) {
      toast({
        title: "Atenção",
        description: "A data é obrigatória para lançar a aula.",
        variant: "destructive",
      });
      return;
    }
    if (!conteudoMinistrado.trim()) {
      toast({
        title: "Diário de classe obrigatório",
        description: "Preencha o conteúdo ministrado antes de confirmar o lançamento.",
        variant: "destructive",
      });
      return;
    }

    createLancamentoMutation.mutate({
      planoAulaId: selectedAula.id,
      data: dataLancamento,
      horaInicio: horaInicio || undefined,
      horaFim: horaFim || undefined,
      cargaHoraria: Number(cargaHoraria) || 1,
      conteudoMinistrado: conteudoMinistrado.trim(),
      observacoes: observacoes || undefined,
    });
  };

  const handleRemoverLancamento = (lancamentoId: string) => {
    setCriticoRemoverLancamentoId(lancamentoId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <AnoLetivoAtivoGuard showAlert={true}>
      <div className="space-y-6">
      {isSecretaria && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Consulta de aulas lançadas. Secretaria não pode lançar ou remover aulas.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Contexto Obrigatório */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Contexto do Lançamento
          </CardTitle>
          <CardDescription>
            {isSecretaria 
              ? 'Consulta de aulas lançadas. Secretaria não pode lançar ou remover aulas.'
              : 'Selecione o contexto antes de lançar aulas como "Ministradas"'}
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

            {/* Professor */}
            <div className="space-y-2">
              <Label>Professor *</Label>
              <Select
                value={context.professorId || ""}
                onValueChange={(value) => {
                  updateContext({ professorId: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o professor" />
                </SelectTrigger>
                <SelectContent>
                  {professores?.filter((prof: any) => prof?.id).map((prof: any) => (
                    <SelectItem key={prof.id} value={String(prof.id)}>
                      {prof.nome_completo || prof.nomeCompleto || prof.email || String(prof.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  // Se selecionar "none", limpar turmaId completamente (não enviar undefined)
                  const newTurmaId = value === "none" ? undefined : value;
                  updateContext({ turmaId: newTurmaId });
                }}
                disabled={!context.disciplinaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma turma específica</SelectItem>
                  {turmas?.filter((turma: any) => turma?.id).map((turma: any) => (
                    <SelectItem key={turma.id} value={String(turma.id)}>
                      {turma.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {context.turmaId && (
                <p className="text-xs text-muted-foreground">
                  Buscando aulas apenas para esta turma específica
                </p>
              )}
            </div>
          </div>

          {!contextComplete && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Preencha todos os campos obrigatórios para visualizar as aulas distribuídas
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Aulas Planejadas com Distribuição */}
      {contextComplete && (
        <Card>
          <CardHeader>
            <CardTitle>Lançamento de Aulas</CardTitle>
            <CardDescription>
              {isSecretaria 
                ? 'Consulta de aulas lançadas. Secretaria não pode lançar ou remover aulas.'
                : 'Registe cada execução real com + Lançar Aula: se a coluna Quantidade for 3, são necessários três lançamentos (três datas distintas).'}
              {!isSecretaria && (
                <span className="block mt-1 text-muted-foreground/90">
                  Passo 4 do fluxo: após a Distribuição (passo 3), registe aqui as aulas efectivamente ministradas. O estado
                  &quot;Completa&quot; só aparece quando o número de lançamentos iguala a quantidade planeada.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAulas ? (
              <div className="text-center py-8 text-muted-foreground">Carregando aulas...</div>
            ) : aulasPlanejadas.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="space-y-2">
                  <p className="text-muted-foreground font-medium">
                    Nenhuma aula distribuída encontrada para este contexto.
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-semibold mb-2">Possíveis causas:</p>
                    <ul className="list-disc list-inside space-y-1 text-left max-w-md mx-auto">
                      <li>O Plano de Ensino ainda não foi criado para este contexto</li>
                      <li>As aulas ainda não foram distribuídas na aba "Distribuição de Aulas"</li>
                      <li>O contexto selecionado não corresponde exatamente ao contexto do Plano de Ensino</li>
                      {context.turmaId && (
                        <li className="font-medium text-yellow-700 dark:text-yellow-400">
                          ⚠️ O Plano de Ensino pode ter sido criado <strong>sem turma específica</strong> - tente remover a seleção de turma acima
                        </li>
                      )}
                      {!context.turmaId && (
                        <li className="font-medium text-yellow-700 dark:text-yellow-400">
                          ⚠️ O Plano de Ensino pode ter sido criado para uma <strong>turma específica</strong> - tente selecionar uma turma acima
                        </li>
                      )}
                    </ul>
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md text-left max-w-md mx-auto">
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">💡 Dica:</p>
                      <p className="text-blue-800 dark:text-blue-200 text-xs">
                        Verifique se o contexto selecionado (curso ou classe, disciplina, professor, ano letivo e turma) corresponde exatamente ao contexto usado quando você criou o Plano de Ensino e distribuiu as aulas na aba "Distribuição de Aulas".
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Invalidar query para forçar nova busca
                        queryClient.invalidateQueries({ queryKey: ["aulas-planejadas"] });
                      }}
                    >
                      Tentar Novamente
                    </Button>
                    {context.turmaId && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Remover turmaId e tentar novamente
                          updateContext({ turmaId: undefined });
                          queryClient.invalidateQueries({ queryKey: ["aulas-planejadas"] });
                        }}
                      >
                        Remover Turma e Buscar
                      </Button>
                    )}
                    {!context.turmaId && turmas && turmas.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Tentar com a primeira turma disponível
                          if (turmas.length > 0) {
                            updateContext({ turmaId: turmas[0].id });
                            queryClient.invalidateQueries({ queryKey: ["aulas-planejadas"] });
                          }
                        }}
                      >
                        Tentar com Turma
                      </Button>
                    )}
                  </div>
                </div>
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
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="min-w-[200px]">Lançamentos</TableHead>
                        <TableHead className="w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aulasPlanejadas.map((aula: AulaPlanejada) => (
                        <TableRow key={aula.id}>
                          <TableCell className="font-medium">{aula.ordem}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{aula.titulo}</div>
                              {aula.descricao && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {aula.descricao}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isSuperior ? `${aula.trimestre}º Semestre` : isSecundario ? `${aula.trimestre}º Trimestre` : `${aula.trimestre}º Período`}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{aula.quantidadeAulas} aula(s)</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {typeof aula.totalLancado === "number"
                                ? `${aula.totalLancado}/${aula.quantidadeAulas} lançada(s)`
                                : `${aula.lancamentos?.length ?? 0}/${aula.quantidadeAulas} lançada(s)`}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              {aula.status === "MINISTRADA" ? (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Completa
                                </Badge>
                              ) : aula.status === "LANCAMENTO_PARCIAL" ? (
                                <Badge variant="secondary" className="border-amber-500 text-amber-900 bg-amber-50">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Em curso
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Planejada
                                </Badge>
                              )}
                              {aula.quantidadeAulas > 1 && aula.status !== "MINISTRADA" && (
                                <span className="text-xs text-muted-foreground max-w-[9rem] leading-snug">
                                  Use + Lançar Aula até igualar a quantidade (cada data = 1 aula).
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {aula.lancamentos.length > 0 ? (
                                aula.lancamentos.map((lancamento) => (
                                  <div
                                    key={lancamento.id}
                                    className="flex items-center justify-between text-sm bg-muted p-2 rounded"
                                  >
                                    <div>
                                      <div className="font-medium">{formatDate(lancamento.data)}</div>
                                      {lancamento.observacoes && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {lancamento.observacoes}
                                        </div>
                                      )}
                                    </div>
                                    {lancamentoAulas.canEdit ? (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive"
                                        onClick={() => handleRemoverLancamento(lancamento.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    ) : null}
                                  </div>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">Nenhum lançamento</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lancamentoAulas.canCreate ? (
                              <Button
                                size="sm"
                                onClick={() => handleAbrirDialog(aula)}
                                disabled={aula.lancamentos.length >= aula.quantidadeAulas}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Lançar Aula
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                title="Secretaria não pode lançar aulas"
                              >
                                Consultar apenas
                              </Button>
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

      {/* Dialog para Lançar Aula */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleCloseDialog();
        } else {
          setDialogOpen(open);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Lançar Aula como Ministrada</DialogTitle>
            <DialogDescription>
              {selectedAula ? `Registre a execução real da aula "${selectedAula.titulo}"` : "Registre a execução real da aula"}
            </DialogDescription>
          </DialogHeader>
          {selectedAula && (
            <div className="space-y-4 py-4">
              {/* Layout horizontal: Data, Hora Início, Hora Fim, Carga Horária */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data">Data da Aula *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={dataLancamento}
                    onChange={(e) => setDataLancamento(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horaInicio">Hora Início</Label>
                  <Input
                    id="horaInicio"
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    placeholder="HH:mm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horaFim">Hora Fim</Label>
                  <Input
                    id="horaFim"
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    placeholder="HH:mm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargaHoraria">Carga Horária (horas/aula) *</Label>
                  <Input
                    id="cargaHoraria"
                    type="number"
                    min="1"
                    value={cargaHoraria}
                    onChange={(e) => setCargaHoraria(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="conteudoMinistrado">Conteúdo ministrado (diário de classe) *</Label>
                <Textarea
                  id="conteudoMinistrado"
                  placeholder="Obrigatório: o que foi leccionado nesta execução"
                  value={conteudoMinistrado}
                  onChange={(e) => setConteudoMinistrado(e.target.value)}
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações adicionais sobre a aula ministrada (opcional)"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            {lancamentoAulas.canCreate ? (
              <Button
                onClick={handleConfirmarLancamento}
                disabled={
                  !dataLancamento ||
                  !selectedAula ||
                  !conteudoMinistrado.trim() ||
                  createLancamentoMutation.isPending
                }
              >
                {createLancamentoMutation.isPending ? "Salvando..." : "Confirmar Lançamento"}
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground px-4">
                Secretaria não pode lançar aulas. Apenas consulta é permitida.
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmacaoResponsabilidadeDialog
        open={criticoRemoverLancamentoId !== null}
        onOpenChange={(open) => {
          if (!open) setCriticoRemoverLancamentoId(null);
        }}
        title="Remover lançamento de aula ministrada"
        description="O registo deixa de contar para o progresso lectivo no plano corrente."
        avisoInstitucional="A rectificação da carga realizada deve observar o regulamento académico e o calendário de lançamentos; excepções a bloqueios ou prazos devem estar documentadas e autorizadas pela administração ou coordenação."
        pontosAtencao={[
          "Afecta relatórios de assiduidade e pode impactar documentação para inspecção.",
          "Pode ser bloqueado se o período estiver fechado no sistema.",
        ]}
        confirmLabel="Remover lançamento"
        confirmVariant="destructive"
        checkboxLabel="Confirmo que a remoção é correcta e autorizada."
        isLoading={deleteLancamentoMutation.isPending}
        onConfirm={() => {
          if (criticoRemoverLancamentoId) deleteLancamentoMutation.mutate(criticoRemoverLancamentoId);
        }}
      />
      </div>
    </AnoLetivoAtivoGuard>
  );
}
