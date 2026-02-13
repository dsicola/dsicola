import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { avaliacoesApi, notasAvaliacaoApi, planoEnsinoApi, cursosApi, classesApi, disciplinasApi, professorsApi, turmasApi, anoLetivoApi, semestreApi, trimestreApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, ClipboardList, CheckCircle, AlertCircle, Users, XCircle } from "lucide-react";
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

interface ContextType {
  cursoId?: string;
  classeId?: string;
  disciplinaId?: string;
  professorId?: string;
  anoLetivo?: number;
  turmaId?: string;
}

interface AvaliacoesNotasTabProps {
  sharedContext?: ContextType;
  onContextChange?: (context: ContextType) => void;
}

export function AvaliacoesNotasTab({ sharedContext, onContextChange }: AvaliacoesNotasTabProps) {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSecundario } = useInstituicao();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();
  const { notas, messages, isSecretaria } = useRolePermissions();

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
  const [showAvaliacaoDialog, setShowAvaliacaoDialog] = useSafeDialog(false);
  const [showDeleteDialog, setShowDeleteDialog] = useSafeDialog(false);
  const [showLancarNotasDialog, setShowLancarNotasDialog] = useSafeDialog(false);
  const [editingAvaliacao, setEditingAvaliacao] = useState<Avaliacao | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<Avaliacao | null>(null);
  const [notasForm, setNotasForm] = useState<{ [alunoId: string]: { valor: string; observacoes: string } }>({});

  const [formData, setFormData] = useState({
    tipo: "PROVA" as const,
    trimestre: "", // Não usar valor padrão hardcoded - será preenchido pelo PeriodoAcademicoSelect
    trimestreId: "",
    semestreId: "",
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
    queryKey: ["cursos-avaliacoes-notas", instituicaoId],
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
    queryKey: ["classes-avaliacoes-notas", instituicaoId],
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
    queryKey: ["disciplinas-avaliacoes-notas", context.cursoId, context.classeId],
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
    queryKey: ["professores-avaliacoes-notas", instituicaoId],
    queryFn: async () => {
      const data = await professorsApi.getAll();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!instituicaoId,
  });

  // Nota: AvaliacoesNotasTab é usado em ConfiguracaoEnsino que bloqueia PROFESSOR
  // Auto-seleção de professor é feita na página standalone AvaliacoesNotas

  // Buscar turmas
  const { data: turmas } = useQuery({
    queryKey: ["turmas-avaliacoes-notas", context.cursoId, context.classeId, context.disciplinaId],
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
    queryKey: ["plano-ensino-avaliacoes-notas", context],
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

  useEffect(() => {
    if (plano?.id) {
      setPlanoId(plano.id);
    } else {
      setPlanoId(null);
    }
  }, [plano]);

  // Buscar semestres (Ensino Superior)
  const { data: semestres = [] } = useQuery({
    queryKey: ["semestres-avaliacoes", plano?.anoLetivoId],
    queryFn: async () => {
      if (!plano?.anoLetivoId || isSecundario) return [];
      return await semestreApi.getAll({ anoLetivoId: plano.anoLetivoId });
    },
    enabled: !!plano?.anoLetivoId && !isSecundario,
  });

  // Buscar trimestres (Ensino Secundário)
  const { data: trimestres = [] } = useQuery({
    queryKey: ["trimestres-avaliacoes", plano?.anoLetivoId],
    queryFn: async () => {
      if (!plano?.anoLetivoId || !isSecundario) return [];
      return await trimestreApi.getAll({ anoLetivoId: plano.anoLetivoId });
    },
    enabled: !!plano?.anoLetivoId && isSecundario,
  });

  // Buscar avaliações
  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["avaliacoes-notas", planoId],
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

  // Mutations
  const createAvaliacaoMutation = useSafeMutation({
    mutationFn: async (data: typeof formData) => {
      if (!planoId) throw new Error("Plano de ensino não encontrado");
      // Turma é obrigatória para criar avaliação, mas pode ser derivada do plano se não estiver no contexto
      const turmaIdFinal = context.turmaId || (plano as any)?.turmaId;
      if (!turmaIdFinal) throw new Error("Turma é obrigatória para criar avaliação. Selecione uma turma no contexto.");
      const payload: any = {
        planoEnsinoId: planoId,
        turmaId: turmaIdFinal,
        tipo: data.tipo,
        peso: parseFloat(data.peso),
        data: data.data,
        nome: data.nome || undefined,
        descricao: data.descricao || undefined,
      };
      if (isSecundario) {
        payload.trimestre = parseInt(data.trimestre);
        payload.trimestreId = data.trimestreId || undefined;
      } else {
        payload.semestreId = data.semestreId || undefined;
      }
      return await avaliacoesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacoes-notas"] });
      toast({ title: "Avaliação criada com sucesso" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar avaliação", description: error?.response?.data?.message, variant: "destructive" });
    },
  });

  const updateAvaliacaoMutation = useSafeMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const payload: any = {
        tipo: data.tipo,
        peso: data.peso ? parseFloat(data.peso) : undefined,
        data: data.data,
        nome: data.nome || undefined,
        descricao: data.descricao || undefined,
      };
      if (isSecundario) {
        payload.trimestre = data.trimestre ? parseInt(data.trimestre) : undefined;
        payload.trimestreId = data.trimestreId || undefined;
      } else {
        payload.semestreId = data.semestreId || undefined;
      }
      return await avaliacoesApi.update(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacoes-notas"] });
      toast({ title: "Avaliação atualizada" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error?.response?.data?.message, variant: "destructive" });
    },
  });

  const deleteAvaliacaoMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      return await avaliacoesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacoes-notas"] });
      toast({ title: "Avaliação excluída" });
      setShowDeleteDialog(false);
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir", description: error?.response?.data?.message, variant: "destructive" });
    },
  });

  const lancarNotasMutation = useSafeMutation({
    mutationFn: async () => {
      if (!selectedAvaliacao?.id) throw new Error("Avaliação não selecionada");

      // Validar e preparar notas
      const notas = Object.entries(notasForm)
        .filter(([alunoId, data]) => {
          // Filtrar apenas notas com valor válido
          if (!data.valor || data.valor.trim() === '') return false;
          
          // Validar alunoId
          if (!alunoId || alunoId.trim() === '') {
            console.warn('Nota sem alunoId válido:', data);
            return false;
          }
          
          // Validar valor numérico
          const valorNum = parseFloat(data.valor.replace(',', '.'));
          if (isNaN(valorNum)) {
            console.warn('Valor de nota inválido (NaN):', data.valor);
            return false;
          }
          
          // Validar range 0-20
          if (valorNum < 0 || valorNum > 20) {
            console.warn('Valor de nota fora do range (0-20):', valorNum);
            return false;
          }
          
          return true;
        })
        .map(([alunoId, data]) => {
          const valorNum = parseFloat(data.valor.replace(',', '.'));
          
          // Garantir que alunoId é string válida
          if (!alunoId || typeof alunoId !== 'string') {
            throw new Error(`alunoId inválido: ${alunoId}`);
          }
          
          // Garantir que valor é número válido entre 0 e 20
          if (isNaN(valorNum) || valorNum < 0 || valorNum > 20) {
            throw new Error(`Valor de nota inválido: ${data.valor} (deve ser entre 0 e 20)`);
          }
          
          return {
            alunoId: alunoId.trim(),
            valor: Math.round(valorNum * 10) / 10, // Arredondar para 1 casa decimal
            observacoes: data.observacoes?.trim() || undefined,
          };
        });

      if (notas.length === 0) {
        throw new Error("Nenhuma nota válida para lançar. Verifique se os valores estão entre 0 e 20.");
      }

      // Validar que todas as notas têm alunoId válido
      const notasInvalidas = notas.filter(n => !n.alunoId || n.alunoId.trim() === '');
      if (notasInvalidas.length > 0) {
        throw new Error(`Algumas notas não possuem alunoId válido. Por favor, recarregue a página e tente novamente.`);
      }

      return await notasAvaliacaoApi.createLote({
        avaliacaoId: selectedAvaliacao.id,
        notas,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alunos-notas"] });
      queryClient.invalidateQueries({ queryKey: ["avaliacoes-notas"] });
      setNotasForm({});
      setShowLancarNotasDialog(false);
      toast({
        title: "Notas lançadas",
        description: "As notas foram lançadas com sucesso.",
      });
    },
    onError: (error: any) => {
      // Extrair mensagem de erro mais detalhada
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.error || 
                          error?.message || 
                          'Erro desconhecido ao lançar notas';
      
      console.error('Erro ao lançar notas:', {
        error,
        response: error?.response?.data,
        status: error?.response?.status,
      });
      
      toast({ 
        title: "Erro ao lançar notas", 
        description: errorMessage, 
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const resetForm = () => {
    setFormData({
      tipo: "PROVA",
      trimestre: "", // Não usar valor padrão hardcoded
      trimestreId: "",
      semestreId: "",
      peso: "1",
      data: new Date().toISOString().split("T")[0],
      nome: "",
      descricao: "",
    });
    setEditingAvaliacao(null);
    setShowAvaliacaoDialog(false);
  };

  const handleEdit = (avaliacao: Avaliacao) => {
    setEditingAvaliacao(avaliacao);
    setFormData({
      tipo: avaliacao.tipo,
      trimestre: avaliacao.trimestre?.toString() || "",
      trimestreId: (avaliacao as any).trimestreId || "",
      semestreId: (avaliacao as any).semestreId || "",
      peso: avaliacao.peso.toString(),
      data: avaliacao.data.split("T")[0],
      nome: avaliacao.nome || "",
      descricao: avaliacao.descricao || "",
    });
    setShowAvaliacaoDialog(true);
  };

  const handleSubmit = () => {
    if (editingAvaliacao) {
      updateAvaliacaoMutation.mutate({ id: editingAvaliacao.id, data: formData });
    } else {
      createAvaliacaoMutation.mutate(formData);
    }
  };

  const handleLancarNotas = (avaliacao: Avaliacao) => {
    setSelectedAvaliacao(avaliacao);
    setShowLancarNotasDialog(true);
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
    <AnoLetivoAtivoGuard showAlert disableChildren>
      <div className="space-y-6">
        {/* Contexto Obrigatório */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Contexto das Avaliações e Notas
          </CardTitle>
          <CardDescription>
            Selecione o contexto antes de criar avaliações e lançar notas
          </CardDescription>
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
                // Manter o ano atual do contexto
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
          <Tabs defaultValue="avaliacoes" className="space-y-4">
            <TabsList>
              <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
              <TabsTrigger value="notas">Lançamento de Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="avaliacoes" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Avaliações</CardTitle>
                    <CardDescription>Gerencie as avaliações do plano de ensino</CardDescription>
                  </div>
                  <Button onClick={() => { resetForm(); setShowAvaliacaoDialog(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Avaliação
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {avaliacoes.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[100px]">Tipo</TableHead>
                            <TableHead className="min-w-[150px]">Nome</TableHead>
                            <TableHead className="w-24">{isSecundario ? "Trimestre" : "Semestre"}</TableHead>
                            <TableHead className="w-32">Data</TableHead>
                            <TableHead className="w-24">Peso</TableHead>
                            <TableHead className="w-32">Status</TableHead>
                            <TableHead className="text-right min-w-[150px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                      <TableBody>
                        {avaliacoes.map((avaliacao: Avaliacao) => (
                          <TableRow key={avaliacao.id}>
                            <TableCell>
                              <Badge variant="outline">{getTipoLabel(avaliacao.tipo)}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{avaliacao.nome || "-"}</TableCell>
                            <TableCell>
                              {isSecundario
                                ? (avaliacao.trimestre != null ? `${avaliacao.trimestre}º Trimestre` : "-")
                                : (() => {
                                    const av = avaliacao as { semestreRef?: { numero: number }; semestre?: number };
                                    const sem = av.semestreRef?.numero ?? av.semestre;
                                    return sem != null ? `${sem}º Semestre` : "-";
                                  })()}
                            </TableCell>
                            <TableCell>{format(new Date(avaliacao.data), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                            <TableCell>{avaliacao.peso}</TableCell>
                            <TableCell>
                              {avaliacao.fechada ? (
                                <Badge variant="destructive">Fechada</Badge>
                              ) : (
                                <Badge variant="outline" className="border-green-500 bg-green-50 text-green-700">Aberta</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleEdit(avaliacao)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setDeletingId(avaliacao.id);
                                    setShowDeleteDialog(true);
                                  }}
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
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nenhuma avaliação cadastrada</p>
                )}
              </CardContent>
            </Card>
            </TabsContent>

            <TabsContent value="notas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lançamento de Notas</CardTitle>
                <CardDescription>Selecione uma avaliação para lançar notas aos estudantes</CardDescription>
              </CardHeader>
              <CardContent>
                {avaliacoes && avaliacoes.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[100px]">Tipo</TableHead>
                            <TableHead className="min-w-[150px]">Nome</TableHead>
                            <TableHead className="w-32">Status</TableHead>
                            <TableHead className="text-right min-w-[150px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {avaliacoes.map((avaliacao: any) => (
                            <TableRow key={avaliacao.id}>
                              <TableCell>
                                <Badge variant="outline">{getTipoLabel(avaliacao.tipo)}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">{avaliacao.nome || "-"}</TableCell>
                              <TableCell>
                                {avaliacao.fechada ? (
                                  <Badge variant="destructive">Fechada</Badge>
                                ) : (
                                  <Badge variant="outline" className="border-green-500 bg-green-50 text-green-700">Aberta</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (notas.canCreate) {
                                      handleLancarNotas(avaliacao);
                                    } else {
                                      toast({
                                        title: 'Ação não permitida',
                                        description: messages.secretariaCannotEdit,
                                        variant: 'destructive',
                                      });
                                    }
                                  }}
                                  disabled={avaliacao.fechada || !notas.canCreate}
                                  variant={notas.canCreate ? 'default' : 'outline'}
                                >
                                  <Users className="h-4 w-4 mr-2" />
                                  {notas.canCreate ? 'Lançar Notas' : 'Consultar Notas'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nenhuma avaliação disponível</p>
                )}
              </CardContent>
            </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Dialog Criar/Editar Avaliação */}
        <Dialog open={showAvaliacaoDialog} onOpenChange={setShowAvaliacaoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAvaliacao ? "Editar Avaliação" : "Nova Avaliação"}</DialogTitle>
              <DialogDescription>
                {editingAvaliacao ? "Atualize os dados da avaliação" : "Preencha os dados para criar uma nova avaliação"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(value: any) => setFormData({ ...formData, tipo: value })}>
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
              <PeriodoAcademicoSelect
                value={isSecundario ? formData.trimestreId || formData.trimestre : formData.semestreId}
                onValueChange={(value) => {
                  if (isSecundario) {
                    // Se o valor é um ID (UUID), usar trimestreId, senão usar trimestre (número)
                    if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                      setFormData({ ...formData, trimestreId: value });
                    } else {
                      setFormData({ ...formData, trimestre: value, trimestreId: "" });
                    }
                  } else {
                    setFormData({ ...formData, semestreId: value });
                  }
                }}
                anoLetivo={context.anoLetivo}
                anoLetivoId={plano?.anoLetivoId}
                label={isSecundario ? "Trimestre" : "Semestre"}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Peso *</Label>
                <Input type="number" step="0.1" min="0.1" value={formData.peso} onChange={(e) => setFormData({ ...formData, peso: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome (opcional)</Label>
              <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Avaliação 1, Prova Bimestral, etc." />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={3} />
            </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createAvaliacaoMutation.isPending || updateAvaliacaoMutation.isPending}>
                {editingAvaliacao ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
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
                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Aluno</TableHead>
                          <TableHead className="w-32">Frequência</TableHead>
                          <TableHead className="w-32">Status</TableHead>
                          <TableHead className="w-24">Nota</TableHead>
                          <TableHead className="min-w-[200px]">Observações</TableHead>
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
                              {`${aluno.frequencia?.presencas || 0}/${aluno.frequencia?.totalAulas || 0}`}
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
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setNotasForm({}); setShowLancarNotasDialog(false); }}>
                    Cancelar
                  </Button>
                  {notas.canCreate ? (
                    <Button
                      onClick={() => lancarNotasMutation.mutate()}
                      disabled={lancarNotasMutation.isPending || selectedAvaliacao?.fechada}
                    >
                      Salvar Notas
                    </Button>
                  ) : (
                    <div className="text-sm text-muted-foreground px-4">
                      {messages.secretariaCannotEdit}
                    </div>
                  )}
                </DialogFooter>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum estudante encontrado</p>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog Confirmar Exclusão */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingId) {
                    deleteAvaliacaoMutation.mutate(deletingId);
                  }
                }}
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
