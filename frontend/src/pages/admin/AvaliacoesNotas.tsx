import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { avaliacoesApi, notasAvaliacaoApi, planoEnsinoApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Plus, Pencil, Trash2, FileText, Users, ClipboardList, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { PeriodoAcademicoSelect } from "@/components/academico/PeriodoAcademicoSelect";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";

interface Avaliacao {
  id: string;
  planoEnsinoId: string;
  tipo: "PROVA" | "TESTE" | "TRABALHO" | "PROVA_FINAL" | "RECUPERACAO";
  trimestre: number;
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

export default function AvaliacoesNotas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSecundario } = useInstituicao();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();

  const isProfessor = role === 'PROFESSOR';

  // Contexto do Plano de Ensino
  const [context, setContext] = useState({
    cursoId: "",
    classeId: "",
    disciplinaId: "",
    professorId: "",
    anoLetivo: new Date().getFullYear(),
    turmaId: "",
  });

  // SIGAE: Para professor, contexto vem do dropdown único (turma/plano do Plano de Ensino)
  const [contextoSigae, setContextoSigae] = useState<{
    turmaId: string;
    planoEnsinoId: string;
    disciplinaId: string;
    cursoId: string | null;
    nomeExibicao: string;
    podeLancarNotas: boolean;
  } | null>(null);

  const [planoId, setPlanoId] = useState<string | null>(null);
  const [showAvaliacaoDialog, setShowAvaliacaoDialog] = useSafeDialog(false);
  const [showLancarNotasDialog, setShowLancarNotasDialog] = useSafeDialog(false);
  const [showDeleteDialog, setShowDeleteDialog] = useSafeDialog(false);
  const [editingAvaliacao, setEditingAvaliacao] = useState<Avaliacao | null>(null);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<Avaliacao | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    tipo: "PROVA" as const,
    trimestre: "", // Não usar valor padrão hardcoded - será preenchido pelo PeriodoAcademicoSelect
    trimestreId: "",
    peso: "1",
    data: new Date().toISOString().split("T")[0],
    nome: "",
    descricao: "",
  });

  // SIGAE: Professor - buscar contextos do Plano de Ensino em UMA chamada
  // Backend retorna { anoLetivoAtivo, turmas, disciplinasSemTurma } - tudo enriquecido
  const { data: turmasProfessorData, isLoading: turmasProfessorLoading } = useQuery({
    queryKey: ["professor-contextos-avaliacoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return { anoLetivo: null, anoLetivoAtivo: null, turmas: [], disciplinasSemTurma: [] };
      const data = await turmasApi.getTurmasProfessor({ incluirPendentes: true });
      return data || { anoLetivo: null, anoLetivoAtivo: null, turmas: [], disciplinasSemTurma: [] };
    },
    enabled: isProfessor && !!user?.id,
  });

  // Contextos unificados: turmas + disciplinas sem turma (SIGAE - exibir todos, ações bloqueadas quando sem turma)
  const contextosDisponiveis = useMemo(() => {
    const turmas = turmasProfessorData?.turmas || [];
    const semTurma = turmasProfessorData?.disciplinasSemTurma || [];
    return [...turmas.map((t: any) => ({ ...t, _key: `${t.turmaId || t.id}:${t.planoEnsinoId}`, _temTurma: true })),
      ...semTurma.map((d: any) => ({ ...d, _key: `sem-turma:${d.planoEnsinoId}`, _temTurma: false }))];
  }, [turmasProfessorData?.turmas, turmasProfessorData?.disciplinasSemTurma]);

  // Buscar cursos/classes (apenas para Admin/Secretaria)
  const { data: cursos } = useQuery({
    queryKey: ["cursos-avaliacoes", instituicaoId],
    queryFn: async () => {
      if (!isSecundario) {
        const data = await cursosApi.getAll({ ativo: true });
        return (data || []).filter((c: any) => c.tipo !== "classe");
      }
      return [];
    },
    enabled: !isProfessor && !isSecundario && !!instituicaoId,
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-avaliacoes", instituicaoId],
    queryFn: async () => {
      if (isSecundario) {
        return await classesApi.getAll({ ativo: true });
      }
      return [];
    },
    enabled: !isProfessor && isSecundario && !!instituicaoId,
  });

  // Buscar disciplinas (apenas para Admin/Secretaria)
  const { data: disciplinas } = useQuery({
    queryKey: ["disciplinas-avaliacoes", context.cursoId, context.classeId],
    queryFn: async () => {
      const params: any = { ativo: true };
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      return await disciplinasApi.getAll(params);
    },
    enabled: !isProfessor && !!(context.cursoId || context.classeId),
  });

  // Buscar professores (apenas para Admin/Secretaria)
  const { data: professores } = useQuery({
    queryKey: ["professores-avaliacoes", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !isProfessor && !!instituicaoId,
  });

  // Buscar turmas (apenas para Admin/Secretaria)
  const { data: turmas } = useQuery({
    queryKey: ["turmas-avaliacoes", context.cursoId, context.classeId, context.disciplinaId],
    queryFn: async () => {
      const params: any = {};
      if (context.cursoId) params.cursoId = context.cursoId;
      if (context.classeId) params.classeId = context.classeId;
      if (context.disciplinaId) params.disciplinaId = context.disciplinaId;
      return await turmasApi.getAll(params);
    },
    enabled: !isProfessor && !!(context.cursoId || context.classeId) && !!context.disciplinaId,
  });

  // Buscar plano de ensino (apenas para Admin/Secretaria)
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
    enabled: !isProfessor && !!(context.disciplinaId && context.professorId && context.anoLetivo),
  });

  // Atualizar planoId: Professor usa contextoSigae, Admin usa plano
  useEffect(() => {
    if (isProfessor && contextoSigae) {
      setPlanoId(contextoSigae.planoEnsinoId);
    } else if (!isProfessor && plano?.id) {
      setPlanoId(plano.id);
    } else {
      setPlanoId(null);
    }
  }, [isProfessor, contextoSigae, plano?.id]);

  // Buscar avaliações
  const { data: avaliacoes, isLoading: loadingAvaliacoes } = useQuery({
    queryKey: ["avaliacoes", planoId],
    queryFn: async () => {
      if (!planoId) return [];
      return await avaliacoesApi.getAll({ planoEnsinoId: planoId });
    },
    enabled: !!planoId,
  });

  // Buscar alunos para lançar notas
  const { data: alunosParaNotas, isLoading: loadingAlunos } = useQuery({
    queryKey: ["alunos-notas", selectedAvaliacao?.id],
    queryFn: async () => {
      if (!selectedAvaliacao?.id) return null;
      return await notasAvaliacaoApi.getAlunosParaLancar(selectedAvaliacao.id);
    },
    enabled: !!selectedAvaliacao?.id,
  });

  // Criar/Atualizar avaliação
  const avaliacaoMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (!planoId) throw new Error("Plano de ensino não selecionado");

      const payload: any = {
        planoEnsinoId: planoId,
        tipo: data.tipo,
        trimestre: Number(data.trimestre),
        peso: Number(data.peso),
        data: data.data,
        nome: data.nome || undefined,
        descricao: data.descricao || undefined,
      };

      if (data.id) {
        return await avaliacoesApi.update(data.id, payload);
      } else {
        // Backend exige turmaId para criar avaliação
        const turmaId = isProfessor ? contextoSigae?.turmaId : context.turmaId;
        if (!turmaId) throw new Error("Turma não selecionada");
        return await avaliacoesApi.create({ ...payload, turmaId });
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
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Lançar notas em lote
  const [notasForm, setNotasForm] = useState<{ [alunoId: string]: { valor: string; observacoes: string } }>({});

  const lancarNotasMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAvaliacao?.id) throw new Error("Avaliação não selecionada");

      const notas = Object.entries(notasForm)
        .filter(([_, data]) => data.valor && parseFloat(data.valor) >= 0)
        .map(([alunoId, data]) => ({
          alunoId,
          valor: parseFloat(data.valor),
          observacoes: data.observacoes || undefined,
        }));

      if (notas.length === 0) {
        throw new Error("Nenhuma nota para lançar");
      }

      return await notasAvaliacaoApi.createLote({
        avaliacaoId: selectedAvaliacao.id,
        notas,
      });
    },
    onSuccess: () => {
      setNotasForm({});
      setSelectedAvaliacao(null);
      setShowLancarNotasDialog(false);
      queryClient.invalidateQueries({ queryKey: ["alunos-notas"] });
      queryClient.invalidateQueries({ queryKey: ["avaliacoes"] });
      toast({
        title: "Notas lançadas",
        description: "As notas foram lançadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Fechar avaliação
  const fecharMutation = useMutation({
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
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Deletar avaliação
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await avaliacoesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacoes"] });
      setShowDeleteDialog(false);
      setDeletingId(null);
      toast({ title: "Avaliação excluída", description: "A avaliação foi excluída com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      tipo: "PROVA",
      trimestre: "", // Não usar valor padrão hardcoded
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
      trimestre: avaliacao.trimestre.toString(),
      peso: avaliacao.peso.toString(),
      data: format(new Date(avaliacao.data), "yyyy-MM-dd"),
      nome: avaliacao.nome || "",
      descricao: avaliacao.descricao || "",
    });
    setShowAvaliacaoDialog(true);
  };

  const handleLancarNotas = (avaliacao: Avaliacao) => {
    setSelectedAvaliacao(avaliacao);
    setShowLancarNotasDialog(true);
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

  const contextComplete = isProfessor
    ? !!(contextoSigae && planoId && contextoSigae.turmaId && (contextoSigae.podeLancarNotas ?? contextoSigae.podeLancarNota))
    : !!(context.disciplinaId && context.professorId && context.anoLetivo && planoId);

  const podeMostrarAvaliacoes = isProfessor
    ? !!(contextoSigae && planoId)
    : contextComplete;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="h-8 w-8" />
              Avaliações e Notas
            </h1>
            <p className="text-muted-foreground">Crie avaliações e lance notas por aluno</p>
          </div>
        </div>

        {/* Contexto Obrigatório */}
        <Card>
          <CardHeader>
            <CardTitle>Contexto do Plano de Ensino</CardTitle>
            <CardDescription>
              {isProfessor ? "Selecione a turma/disciplina do seu Plano de Ensino" : "Selecione o contexto antes de gerenciar avaliações"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isProfessor ? (
              /* SIGAE: Professor - dropdown único, contexto do Plano de Ensino */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Turma / Disciplina (do meu Plano de Ensino)</Label>
                  <Select
                    value={contextoSigae ? (contextoSigae.turmaId ? `${contextoSigae.turmaId}:${contextoSigae.planoEnsinoId}` : `sem-turma:${contextoSigae.planoEnsinoId}`) : ""}
                    onValueChange={(value) => {
                      if (!value) {
                        setContextoSigae(null);
                        return;
                      }
                      const [turmaPart, planoEnsinoId] = value.split(":");
                      const item = contextosDisponiveis.find((c: any) => c._key === value);
                      if (item) {
                        const turmaId = item._temTurma ? (item.turmaId || item.id) : null;
                        setContextoSigae({
                          turmaId: turmaId ?? "",
                          planoEnsinoId: item.planoEnsinoId,
                          disciplinaId: item.disciplinaId,
                          cursoId: item.cursoId || item.curso?.id || null,
                          nomeExibicao: `${item.nome || item.disciplinaNome} - ${item.disciplinaNome || item.disciplina?.nome}`,
                          podeLancarNotas: (item.podeLancarNota ?? item.podeLancarNotas ?? false) && !!turmaId,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full md:w-[400px]">
                      <SelectValue placeholder="Selecione turma ou disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      {turmasProfessorLoading ? (
                        <div className="p-4 flex justify-center text-muted-foreground">Carregando...</div>
                      ) : contextosDisponiveis.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          Sem atribuições no Plano de Ensino
                        </div>
                      ) : (
                        contextosDisponiveis.map((c: any) => (
                          <SelectItem key={c._key} value={c._key}>
                            {c.nome || c.disciplinaNome} - {c.disciplinaNome || c.disciplina?.nome}
                            {!c._temTurma ? " (Aguardando alocação de turma)" : ""}
                            {c._temTurma && !(c.podeLancarNota ?? c.podeLancarNotas) && c.motivoBloqueio ? ` — ${c.motivoBloqueio}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {(turmasProfessorData?.anoLetivo ?? turmasProfessorData?.anoLetivoAtivo?.ano) && (
                  <p className="text-sm text-muted-foreground">Ano letivo ativo: {turmasProfessorData.anoLetivo ?? turmasProfessorData.anoLetivoAtivo?.ano}</p>
                )}
                {!turmasProfessorLoading && contextosDisponiveis.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                    <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Sem atribuições no Plano de Ensino</p>
                    <p className="text-sm mt-1">Entre em contacto com a direção para atribuir turmas/disciplinas ao seu plano.</p>
                  </div>
                )}
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isSecundario ? (
                <div className="space-y-2">
                  <Label>Classe / Ano *</Label>
                  <Select
                    value={context.classeId}
                    onValueChange={(value) => setContext((prev) => ({ ...prev, classeId: value, disciplinaId: "", turmaId: "" }))}
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
                    value={context.cursoId}
                    onValueChange={(value) => setContext((prev) => ({ ...prev, cursoId: value, disciplinaId: "", turmaId: "" }))}
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
                  value={context.disciplinaId}
                  onValueChange={(value) => setContext((prev) => ({ ...prev, disciplinaId: value, turmaId: "" }))}
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
                  value={context.professorId}
                  onValueChange={(value) => setContext((prev) => ({ ...prev, professorId: value }))}
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

              <div className="space-y-2">
                <Label>Ano Letivo *</Label>
                <Input
                  type="number"
                  value={context.anoLetivo}
                  onChange={(e) => setContext((prev) => ({ ...prev, anoLetivo: parseInt(e.target.value) || new Date().getFullYear() }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Turma (opcional)</Label>
                <Select
                  value={context.turmaId || "all"}
                  onValueChange={(value) => setContext((prev) => ({ ...prev, turmaId: value === "all" ? "" : value }))}
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
            )}
          </CardContent>
        </Card>

        {podeMostrarAvaliacoes && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Avaliações</CardTitle>
                  <CardDescription>
                    {isProfessor && contextoSigae && !contextoSigae.podeLancarNotas
                      ? "Plano bloqueado ou não aprovado - apenas consulta"
                      : "Gerencie as avaliações do plano de ensino selecionado"}
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAvaliacaoDialog(true)} disabled={!contextComplete}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Avaliação
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAvaliacoes ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : avaliacoes && avaliacoes.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Trimestre</TableHead>
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
                          <TableCell>{avaliacao.trimestre}º Trimestre</TableCell>
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
                              <Button size="sm" variant="ghost" onClick={() => handleLancarNotas(avaliacao)} disabled={avaliacao.fechada}>
                                <Users className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleEditAvaliacao(avaliacao)} disabled={avaliacao.fechada}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {!avaliacao.fechada && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => fecharMutation.mutate(avaliacao.id)}
                                  disabled={fecharMutation.isPending}
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
                {isSecundario && (
                  <PeriodoAcademicoSelect
                    value={formData.trimestreId || formData.trimestre}
                    onValueChange={(value) => {
                      // Se o valor é um ID (UUID), usar trimestreId, senão usar trimestre (número)
                      if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                        setFormData((prev) => ({ ...prev, trimestreId: value, trimestre: '' }));
                      } else {
                        setFormData((prev) => ({ ...prev, trimestre: value, trimestreId: '' }));
                      }
                    }}
                    anoLetivo={context.anoLetivo || anoLetivoAtivo?.ano}
                    anoLetivoId={plano?.anoLetivoId || anoLetivoAtivo?.id}
                    label="Trimestre"
                    required
                    useNumericValue={true}
                  />
                )}
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
                disabled={!formData.tipo || !formData.trimestre || !formData.data || avaliacaoMutation.isPending}
              >
                {editingAvaliacao ? "Salvar" : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Lançar Notas */}
        <Dialog open={showLancarNotasDialog} onOpenChange={setShowLancarNotasDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lançar Notas</DialogTitle>
              <DialogDescription>
                Lançar notas para a avaliação: {selectedAvaliacao?.nome || getTipoLabel(selectedAvaliacao?.tipo || "")}
              </DialogDescription>
            </DialogHeader>
            {loadingAlunos ? (
              <p className="text-center text-muted-foreground py-8">Carregando alunos...</p>
            ) : alunosParaNotas ? (
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Frequência</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Nota</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alunosParaNotas.alunos?.map((aluno: any) => (
                        <TableRow key={aluno.alunoId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{aluno.nomeCompleto}</p>
                              <p className="text-sm text-muted-foreground">{aluno.numeroIdentificacaoPublica || aluno.numeroIdentificacao}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{aluno.frequencia?.percentual?.toFixed(1) || 0}%</p>
                              <p className="text-muted-foreground">
                                {aluno.frequencia?.presencas || 0}/{aluno.frequencia?.totalAulas || 0}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {aluno.bloqueado ? (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Frequência Insuficiente
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-green-500 bg-green-50 text-green-700">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="20"
                              disabled={aluno.bloqueado}
                              value={notasForm[aluno.alunoId]?.valor || aluno.nota?.valor?.toString() || ""}
                              onChange={(e) =>
                                setNotasForm((prev) => ({
                                  ...prev,
                                  [aluno.alunoId]: { ...prev[aluno.alunoId], valor: e.target.value },
                                }))
                              }
                              placeholder="0.0"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              disabled={aluno.bloqueado}
                              value={notasForm[aluno.alunoId]?.observacoes || aluno.nota?.observacoes || ""}
                              onChange={(e) =>
                                setNotasForm((prev) => ({
                                  ...prev,
                                  [aluno.alunoId]: { ...prev[aluno.alunoId], observacoes: e.target.value },
                                }))
                              }
                              placeholder="Observações..."
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setNotasForm({}); setShowLancarNotasDialog(false); }}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => lancarNotasMutation.mutate()}
                    disabled={lancarNotasMutation.isPending || selectedAvaliacao?.fechada}
                  >
                    Salvar Notas
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum aluno encontrado</p>
            )}
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
    </DashboardLayout>
  );
}

