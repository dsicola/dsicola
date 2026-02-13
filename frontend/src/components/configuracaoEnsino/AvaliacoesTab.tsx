import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { avaliacoesApi, planoEnsinoApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi, anoLetivoApi, semestreApi, trimestreApi } from "@/services/api";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, ClipboardList, CheckCircle, AlertCircle } from "lucide-react";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { AnoLetivoAtivoGuard } from "@/components/academico/AnoLetivoAtivoGuard";
import { AnoLetivoSelect } from "@/components/academico/AnoLetivoSelect";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";
import { PeriodoAcademicoSelect } from "@/components/academico/PeriodoAcademicoSelect";

interface Avaliacao {
  id: string;
  planoEnsinoId: string;
  tipo: "PROVA" | "TESTE" | "TRABALHO" | "PROVA_FINAL" | "RECUPERACAO";
  trimestre?: number | null;
  semestreId?: string | null;
  trimestreId?: string | null;
  peso: number;
  data: string;
  nome?: string | null;
  descricao?: string | null;
  fechada: boolean;
  planoEnsino?: {
    disciplina: { nome: string };
    turma?: { nome: string } | null;
  };
  _count?: {
    notas: number;
  };
}

interface ContextType {
  cursoId?: string;
  classeId?: string;
  disciplinaId?: string;
  professorId?: string;
  anoLetivo?: number;
  turmaId?: string;
}

interface AvaliacoesTabProps {
  sharedContext?: ContextType;
  onContextChange?: (context: ContextType) => void;
}

export function AvaliacoesTab({ sharedContext, onContextChange }: AvaliacoesTabProps) {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSecundario } = useInstituicao();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();
  const { avaliacoes: permissoesAvaliacoes } = useRolePermissions();

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

  const [planoId, setPlanoId] = useState<string | null>(null);
  const [showAvaliacaoDialog, setShowAvaliacaoDialog, openAvaliacaoDialog, closeAvaliacaoDialog] = useSafeDialog(false);
  const [showDeleteDialog, setShowDeleteDialog] = useSafeDialog(false);
  const [editingAvaliacao, setEditingAvaliacao] = useState<Avaliacao | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    tipo: "PROVA" as const,
    trimestre: "",
    semestreId: "",
    trimestreId: "",
    peso: "1",
    data: new Date().toISOString().split("T")[0],
    nome: "",
    descricao: "",
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

  // Buscar cursos/classes
  const { data: cursos } = useQuery({
    queryKey: ["cursos-avaliacoes", instituicaoId],
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
    queryKey: ["classes-avaliacoes", instituicaoId],
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
    queryKey: ["disciplinas-avaliacoes", context.cursoId, context.classeId],
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
    queryKey: ["professores-avaliacoes", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
  });

  // Buscar turmas
  const { data: turmas } = useQuery({
    queryKey: ["turmas-avaliacoes", context.cursoId, context.classeId, context.disciplinaId],
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
  const { data: plano } = useQuery({
    queryKey: ["plano-ensino-avaliacoes", context],
    queryFn: async () => {
      if (!context.disciplinaId || !context.professorId || !context.anoLetivo) {
        return null;
      }
      return await planoEnsinoApi.getByContext({
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

  useEffect(() => {
    if (plano?.id) {
      setPlanoId(plano.id);
    } else {
      setPlanoId(null);
    }
  }, [plano]);

  // Buscar estatísticas de carga horária para validação
  const { data: cargaHorariaStats } = useQuery({
    queryKey: ["plano-ensino-stats", planoId],
    queryFn: async () => {
      if (!planoId) return null;
      return await planoEnsinoApi.getStats(planoId);
    },
    enabled: !!planoId,
  });

  // Verificar se a carga horária está completa
  const cargaHorariaCompleta = cargaHorariaStats?.status === "ok";

  // Buscar avaliações
  const { data: avaliacoes, isLoading: loadingAvaliacoes } = useQuery({
    queryKey: ["avaliacoes", planoId],
    queryFn: async () => {
      if (!planoId) return [];
      return await avaliacoesApi.getAll({ planoEnsinoId: planoId });
    },
    enabled: !!planoId,
  });

  // Obter anoLetivoId do plano ou contexto
  const anoLetivoId = (plano as any)?.anoLetivoId || (context.anoLetivo ? (anosLetivos.find((al: any) => al.ano === context.anoLetivo)?.id || "") : "");

  // Buscar semestres (Ensino Superior)
  const { data: semestres = [] } = useQuery({
    queryKey: ["semestres-avaliacoes", anoLetivoId],
    queryFn: async () => {
      if (!anoLetivoId) return [];
      return await semestreApi.getAll({ anoLetivoId });
    },
    enabled: !isSecundario && !!anoLetivoId,
  });

  // Buscar trimestres (Ensino Secundário)
  const { data: trimestres = [] } = useQuery({
    queryKey: ["trimestres-avaliacoes", anoLetivoId],
    queryFn: async () => {
      if (!anoLetivoId) return [];
      return await trimestreApi.getAll({ anoLetivoId });
    },
    enabled: isSecundario && !!anoLetivoId,
  });

  // Criar/Atualizar avaliação
  const avaliacaoMutation = useSafeMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (!planoId || !plano) throw new Error("Plano de ensino não selecionado");
      const turmaId = (plano as any)?.turmaId || context.turmaId;
      if (!turmaId) throw new Error("Turma não selecionada. Selecione uma turma no contexto do plano de ensino.");

      const payload: any = {
        planoEnsinoId: planoId,
        turmaId: turmaId,
        tipo: data.tipo,
        peso: Number(data.peso),
        data: data.data,
        nome: data.nome || undefined,
        descricao: data.descricao || undefined,
      };

      // Campos condicionais por tipo de instituição
      if (isSecundario) {
        // Ensino Secundário: trimestre obrigatório
        if (data.trimestreId) {
          payload.trimestreId = data.trimestreId;
          payload.trimestre = parseInt(data.trimestre) || null;
        } else if (data.trimestre) {
          payload.trimestre = parseInt(data.trimestre);
        }
        payload.semestreId = null;
      } else {
        // Ensino Superior: semestre obrigatório
        if (!data.semestreId) {
          throw new Error("Semestre é obrigatório para Ensino Superior");
        }
        payload.semestreId = data.semestreId;
        payload.trimestre = null;
        payload.trimestreId = null;
      }

      if (data.id) {
        return await avaliacoesApi.update(data.id, payload);
      } else {
        return await avaliacoesApi.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacoes"] });
      setShowAvaliacaoDialog(false);
      resetForm();
      toast({
        title: editingAvaliacao ? "Avaliação atualizada" : "Avaliação criada",
        description: editingAvaliacao ? "A avaliação foi atualizada com sucesso." : "A avaliação foi criada com sucesso.",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Erro ao salvar avaliação";
      toast({ title: "Erro", description: errorMessage, variant: "destructive" });
    },
  });

  // Fechar avaliação
  const fecharMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      return await avaliacoesApi.fechar(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacoes"] });
      toast({
        title: "Avaliação fechada",
        description: "A avaliação foi fechada e não pode mais ser alterada.",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao fechar avaliação";
      toast({ title: "Erro", description: errorMessage, variant: "destructive" });
    },
  });

  // Deletar avaliação
  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await avaliacoesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacoes"] });
      setShowDeleteDialog(false);
      setDeletingId(null);
      toast({ title: "Avaliação excluída", description: "A avaliação foi excluída com sucesso." });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao excluir avaliação";
      toast({ title: "Erro", description: errorMessage, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      tipo: "PROVA",
      trimestre: "",
      semestreId: "",
      trimestreId: "",
      peso: "1",
      data: new Date().toISOString().split("T")[0],
      nome: "",
      descricao: "",
    });
    setEditingAvaliacao(null);
  };

  const handleEditAvaliacao = (avaliacao: Avaliacao) => {
    setEditingAvaliacao(avaliacao);
    setFormData({
      tipo: avaliacao.tipo,
      trimestre: avaliacao.trimestre?.toString() || "",
      semestreId: (avaliacao as any).semestreId || "",
      trimestreId: (avaliacao as any).trimestreId || "",
      peso: avaliacao.peso.toString(),
      data: format(new Date(avaliacao.data), "yyyy-MM-dd"),
      nome: avaliacao.nome || "",
      descricao: avaliacao.descricao || "",
    });
    setShowAvaliacaoDialog(true);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const getTipoLabel = (tipo: string) => {
    const labels: { [key: string]: string } = {
      PROVA: "Prova",
      TESTE: "Teste",
      TRABALHO: "Trabalho",
      PROVA_FINAL: "Prova Final",
      RECUPERACAO: "Recuperação",
    };
    return labels[tipo] || tipo;
  };

  const contextComplete = !!(context.disciplinaId && context.professorId && context.anoLetivo && planoId);

  const updateContext = (updates: Partial<ContextType>) => {
    setContext((prev) => ({ ...prev, ...updates }));
  };

  return (
    <AnoLetivoAtivoGuard showAlert={true} disableChildren={false}>
      <div className="space-y-6">
      {/* Contexto Obrigatório */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Contexto do Plano de Ensino
          </CardTitle>
          <CardDescription>Selecione o contexto antes de gerenciar avaliações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isSecundario ? (
              <div className="space-y-2">
                <Label>Classe / Ano *</Label>
                <Select
                  value={context.classeId || ""}
                  onValueChange={(value) => updateContext({ classeId: value, disciplinaId: "", turmaId: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.filter((classe: any) => classe?.id).map((classe: any) => (
                      <SelectItem key={classe.id} value={String(classe.id)}>{classe.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Curso *</Label>
                <Select
                  value={context.cursoId || ""}
                  onValueChange={(value) => updateContext({ cursoId: value, disciplinaId: "", turmaId: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {cursos?.filter((curso: any) => curso?.id).map((curso: any) => (
                      <SelectItem key={curso.id} value={String(curso.id)}>{curso.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Disciplina *</Label>
              <Select
                value={context.disciplinaId || ""}
                onValueChange={(value) => updateContext({ disciplinaId: value, turmaId: "" })}
                disabled={!context.cursoId && !context.classeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {disciplinas?.filter((disciplina: any) => disciplina?.id).map((disciplina: any) => (
                    <SelectItem key={disciplina.id} value={String(disciplina.id)}>{disciplina.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Professor *</Label>
              <Select
                value={context.professorId || ""}
                onValueChange={(value) => updateContext({ professorId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o professor" />
                </SelectTrigger>
                <SelectContent>
                  {professores?.filter((prof: any) => prof?.id).map((prof: any) => (
                    <SelectItem key={prof.id} value={String(prof.id)}>{prof.nome_completo || prof.nomeCompleto || prof.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AnoLetivoSelect
              value={context.anoLetivo}
              onValueChange={(ano) => updateContext({ anoLetivo: ano })}
              onIdChange={(id) => {
                // Buscar o ano do ID se necessário
                updateContext({ anoLetivo: context.anoLetivo });
              }}
              label="Ano Letivo"
              required
              showStatus={true}
            />

            <div className="space-y-2">
              <Label>Turma (opcional)</Label>
              <Select
                value={context.turmaId || "all"}
                onValueChange={(value) => updateContext({ turmaId: value === "all" ? "" : value })}
                disabled={!context.disciplinaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as turmas</SelectItem>
                  {turmas?.filter((turma: any) => turma?.id).map((turma: any) => (
                    <SelectItem key={turma.id} value={String(turma.id)}>{turma.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!contextComplete && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Preencha todos os campos obrigatórios para continuar
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {contextComplete && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Avaliações</CardTitle>
                <CardDescription>Gerencie as avaliações do plano de ensino selecionado</CardDescription>
              </div>
              <Button 
                onClick={() => setShowAvaliacaoDialog(true)} 
                disabled={!contextComplete || !cargaHorariaCompleta}
                title={!cargaHorariaCompleta ? "A carga horária do Plano de Ensino deve estar completa antes de criar avaliações" : undefined}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Avaliação
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Alerta de carga horária incompleta/excedente */}
            {!cargaHorariaCompleta && cargaHorariaStats && (
              <div className={`mb-4 p-3 rounded-md flex items-start gap-2 ${
                cargaHorariaStats.status === "faltando"
                  ? "bg-yellow-50 border border-yellow-200"
                  : "bg-red-50 border border-red-200"
              }`}>
                <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  cargaHorariaStats.status === "faltando" ? "text-yellow-600" : "text-red-600"
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-semibold mb-1 ${
                    cargaHorariaStats.status === "faltando" ? "text-yellow-800" : "text-red-800"
                  }`}>
                    {cargaHorariaStats.status === "faltando" ? "⚠️ Carga horária incompleta" : "❌ Carga horária excedente"}
                  </p>
                  <p className={`text-sm ${
                    cargaHorariaStats.status === "faltando" ? "text-yellow-700" : "text-red-700"
                  }`}>
                    {cargaHorariaStats.status === "faltando"
                      ? `Não é possível criar avaliações. A carga horária do Plano de Ensino está incompleta (faltam ${cargaHorariaStats.diferenca} horas). ` +
                        `Adicione mais aulas na aba "2. Planejar" do Plano de Ensino antes de criar avaliações. ` +
                        `A carga horária planejada deve ser EXATAMENTE igual à carga horária exigida (${cargaHorariaStats.totalExigido}h).`
                      : `Não é possível criar avaliações. A carga horária planejada excede a carga horária exigida em ${Math.abs(cargaHorariaStats.diferenca)} horas. ` +
                        `Ajuste a carga horária na aba "2. Planejar" do Plano de Ensino antes de criar avaliações. ` +
                        `A carga horária planejada deve ser EXATAMENTE igual à carga horária exigida (${cargaHorariaStats.totalExigido}h).`}
                  </p>
                </div>
              </div>
            )}
            {loadingAvaliacoes ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : avaliacoes && avaliacoes.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>{isSecundario ? "Trimestre" : "Semestre"}</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Peso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {avaliacoes.map((avaliacao: Avaliacao) => (
                      <TableRow key={avaliacao.id}>
                        <TableCell>
                          <Badge variant="outline">{getTipoLabel(avaliacao.tipo)}</Badge>
                        </TableCell>
                        <TableCell>
                          {isSecundario
                            ? avaliacao.trimestre
                              ? `${avaliacao.trimestre}º Trimestre`
                              : "-"
                            : (avaliacao as any).semestreId
                            ? "Semestre"
                            : "-"}
                        </TableCell>
                        <TableCell className="font-medium">{avaliacao.nome || "-"}</TableCell>
                        <TableCell>{formatDate(avaliacao.data)}</TableCell>
                        <TableCell>{avaliacao.peso}</TableCell>
                        <TableCell>
                          {avaliacao.fechada ? (
                            <Badge variant="destructive">Fechada</Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500 bg-green-50 text-green-700">Aberta</Badge>
                          )}
                        </TableCell>
                        <TableCell>{avaliacao._count?.notas || 0} notas</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEditAvaliacao(avaliacao)} disabled={avaliacao.fechada || !permissoesAvaliacoes.canEdit(avaliacao.fechada ? 'ENCERRADO' : null)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!avaliacao.fechada && permissoesAvaliacoes.canClose && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => fecharMutation.mutate(avaliacao.id)}
                                disabled={fecharMutation.isPending}
                                title="Fechar avaliação (apenas administradores)"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                setDeletingId(avaliacao.id);
                                setShowDeleteDialog(true);
                              }}
                              disabled={avaliacao.fechada}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhuma avaliação cadastrada</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog Criar/Editar Avaliação */}
      <Dialog open={showAvaliacaoDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowAvaliacaoDialog(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAvaliacao ? "Editar Avaliação" : "Nova Avaliação"}</DialogTitle>
            <DialogDescription>
              {editingAvaliacao ? "Atualize os dados da avaliação" : "Cadastre uma nova avaliação"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData((prev) => ({ ...prev, tipo: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROVA">Prova</SelectItem>
                  <SelectItem value="TESTE">Teste</SelectItem>
                  <SelectItem value="TRABALHO">Trabalho</SelectItem>
                  <SelectItem value="PROVA_FINAL">Prova Final</SelectItem>
                  <SelectItem value="RECUPERACAO">Recuperação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <PeriodoAcademicoSelect
                value={isSecundario ? formData.trimestreId || formData.trimestre : formData.semestreId}
                onValueChange={(value) => {
                  if (isSecundario) {
                    // Se o valor é um ID (UUID), usar trimestreId, senão usar trimestre (número)
                    if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                      setFormData((prev) => ({ ...prev, trimestreId: value }));
                    } else {
                      setFormData((prev) => ({ ...prev, trimestre: value, trimestreId: "" }));
                    }
                  } else {
                    setFormData((prev) => ({ ...prev, semestreId: value }));
                  }
                }}
                anoLetivo={context.anoLetivo}
                anoLetivoId={anoLetivoId}
                label={isSecundario ? "Trimestre" : "Semestre"}
                required
              />
              <div className="space-y-2">
                <Label>Peso *</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={formData.peso}
                  onChange={(e) => setFormData((prev) => ({ ...prev, peso: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData((prev) => ({ ...prev, data: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nome (opcional)</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Prova de Matemática"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição da avaliação..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { resetForm(); setShowAvaliacaoDialog(false); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => avaliacaoMutation.mutate({ ...formData, id: editingAvaliacao?.id })}
              disabled={
                !formData.tipo ||
                !formData.data ||
                (isSecundario ? !formData.trimestre && !formData.trimestreId : !formData.semestreId) ||
                avaliacaoMutation.isPending
              }
            >
              {editingAvaliacao ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AnoLetivoAtivoGuard>
  );
}

