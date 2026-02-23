import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { planoEnsinoApi, anoLetivoApi, turmasApi } from "@/services/api";
import { AxiosError } from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Copy, BookOpen, AlertCircle, Book, Settings2, Zap, Loader2 } from "lucide-react";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useTenantFilter } from "@/hooks/useTenantFilter";
// Período acadêmico é herdado do Plano de Ensino - não usar PeriodoAcademicoSelect no modal

interface PlanejarTabProps {
  context: any;
  plano: any;
  planoId: string | null;
  permiteEdicao?: boolean;
  shouldOpenAulaDialog?: boolean;
  onAulaDialogOpened?: () => void;
  onPlanoCreated: () => void;
}

export function PlanejarTab({ context, plano, planoId, permiteEdicao, shouldOpenAulaDialog, onAulaDialogOpened, onPlanoCreated }: PlanejarTabProps) {
  const queryClient = useQueryClient();
  const { isSuperior, isSecundario } = useInstituicao();
  const { instituicaoId } = useTenantFilter();
  const [showAulaDialog, setShowAulaDialog] = useSafeDialog(false);
  
  // Estado local para garantir re-renderização quando plano for criado
  const [localPlano, setLocalPlano] = useState(plano);
  const [localPlanoId, setLocalPlanoId] = useState(planoId);
  
  // Sincronizar estado local com props
  useEffect(() => {
    setLocalPlano(plano);
    setLocalPlanoId(planoId);
  }, [plano, planoId]);
  
  // Usar estado local para garantir que o plano seja atualizado imediatamente após criação
  const planoAtual = localPlano || plano;
  const planoIdAtual = localPlanoId || planoId;
  
  // Helper para usar o planoId correto em todo o componente
  const getPlanoId = () => planoIdAtual || planoId;
  
  // Buscar anos letivos do banco (SEM valores hardcoded)
  const { data: anosLetivos = [] } = useQuery({
    queryKey: ["anos-letivos-planejar", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });
  
  // REMOVIDO: periodoLabel não é mais necessário - período é herdado automaticamente
  const [showCopiarDialog, setShowCopiarDialog] = useSafeDialog(false);
  const [showBibliografiaDialog, setShowBibliografiaDialog] = useSafeDialog(false);
  const [editingAula, setEditingAula] = useState<any>(null);
  const [deletingAulaId, setDeletingAulaId] = useState<string | null>(null);
  const [deletingBibliografiaId, setDeletingBibliografiaId] = useState<string | null>(null);
  const [mostrarApenasTitulo, setMostrarApenasTitulo] = useState(false);

  const [aulaForm, setAulaForm] = useState({
    titulo: "",
    descricao: "",
    tipo: "TEORICA" as "TEORICA" | "PRATICA",
    quantidadeAulas: "1",
  });

  const [copiarForm, setCopiarForm] = useState({
    novoAnoLetivo: (context.anoLetivo || new Date().getFullYear()) - 1,
  });
  const [showCopiarTurmaDialog, setShowCopiarTurmaDialog] = useState(false);
  const [turmaDestinoId, setTurmaDestinoId] = useState<string>("");

  const [bibliografiaForm, setBibliografiaForm] = useState({
    titulo: "",
    autor: "",
    editora: "",
    ano: "",
    isbn: "",
    tipo: "BIBLIOGRAFIA_BASICA" as "BIBLIOGRAFIA_BASICA" | "BIBLIOGRAFIA_COMPLEMENTAR",
    observacoes: "",
  });

  // Criar plano se não existir
  const createPlanoMutation = useSafeMutation({
    mutationFn: async () => {
      // Validar campos obrigatórios
      if (!context.disciplinaId) {
        throw new Error('Disciplina é obrigatória. Selecione uma disciplina antes de continuar.');
      }
      
      if (!context.professorId || context.professorId.trim() === '') {
        throw new Error('Professor é obrigatório. Selecione um professor antes de continuar.');
      }
      
      if (!context.anoLetivoId && !context.anoLetivo) {
        throw new Error('Ano Letivo é obrigatório. Selecione um Ano Letivo válido.');
      }
      
      // Se anoLetivoId não estiver definido mas anoLetivo estiver, buscar o ID
      let anoLetivoIdToUse = context.anoLetivoId;
      if (!anoLetivoIdToUse && context.anoLetivo) {
        const anosLetivos = await anoLetivoApi.getAll();
        const anoLetivoEncontrado = anosLetivos.find((al: any) => al.ano === context.anoLetivo);
        if (anoLetivoEncontrado) {
          anoLetivoIdToUse = anoLetivoEncontrado.id;
        } else {
          throw new Error('Ano Letivo selecionado não encontrado. Selecione um Ano Letivo válido.');
        }
      }
      
      if (!anoLetivoIdToUse) {
        throw new Error('Ano Letivo é obrigatório. Selecione um Ano Letivo válido.');
      }

      // Validar semestre para Ensino Superior
      if (isSuperior) {
        if (!context.semestre) {
          throw new Error('Semestre é obrigatório no Ensino Superior. Selecione um semestre cadastrado.');
        }
      }

      // Validar classeOuAno para Ensino Secundário (preenchido automaticamente ao selecionar classe)
      if (isSecundario) {
        if (!context.classeId) {
          throw new Error('Classe é obrigatória. Selecione uma classe no contexto do plano de ensino.');
        }
        if (!context.classeOuAno || context.classeOuAno.trim() === '') {
          throw new Error('Selecione novamente a classe no contexto - Classe/Ano será preenchido automaticamente.');
        }
      }
      
      // Log para debug (apenas em desenvolvimento)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[PlanejarTab] Criando plano com professorId:', context.professorId);
      }
      
      return await planoEnsinoApi.createOrGet({
        cursoId: context.cursoId || undefined,
        classeId: context.classeId || undefined,
        disciplinaId: context.disciplinaId,
        professorId: context.professorId, // OBRIGATÓRIO - professores.id (vindo de GET /professores)
        anoLetivo: context.anoLetivo,
        anoLetivoId: anoLetivoIdToUse, // OBRIGATÓRIO
        turmaId: context.turmaId || undefined,
        semestre: context.semestre ? Number(context.semestre) : undefined, // OBRIGATÓRIO apenas para Ensino Superior
        classeOuAno: context.classeOuAno || undefined, // OBRIGATÓRIO apenas para Ensino Secundário
      });
    },
    onSuccess: async (data) => {
      // Atualizar estado local imediatamente para garantir re-renderização
      setLocalPlano(data);
      setLocalPlanoId(data?.id || null);
      // Atualizar o cache diretamente com o plano criado para atualização imediata da UI
      queryClient.setQueryData(["plano-ensino", context], data);
      // Invalidar todas as queries relacionadas ao plano de ensino para garantir sincronização
      await queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      // Forçar refetch da query específica do contexto
      await queryClient.refetchQueries({ 
        queryKey: ["plano-ensino", context],
        exact: true 
      });
      // Chamar callback para atualizar componentes pais
      onPlanoCreated();
      toast({
        title: "Plano criado",
        description: "Plano de ensino criado com sucesso.",
      });
    },
    onError: (error: unknown) => {
      let errorMessage = "Erro ao criar plano de ensino. Por favor, tente novamente.";
      
      // Tratar AxiosError
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const responseData = error.response?.data;
        
        // Tratar especificamente o erro 409 (Conflict)
        if (status === 409) {
          errorMessage = responseData?.message || 
            responseData?.error || 
            "Já existe um plano de ensino para esta disciplina e ano letivo, mas vinculado a outro professor. Não é possível criar múltiplos planos para a mesma disciplina no mesmo ano letivo. Use o plano existente ou entre em contato com o administrador.";
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
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Criar aula
  // Aula herda automaticamente período (semestre/trimestre) do Plano de Ensino
  // Não solicitar período no frontend - backend busca do plano automaticamente
  const createAulaMutation = useSafeMutation({
    mutationFn: async (data: typeof aulaForm) => {
      const idToUse = getPlanoId();
      if (!idToUse) {
        throw new Error("Plano de ensino não encontrado");
      }
      // Validar campos obrigatórios antes de enviar
      if (!data.titulo || !data.titulo.trim()) {
        throw new Error('Título é obrigatório');
      }
      if (!data.quantidadeAulas || Number(data.quantidadeAulas) <= 0) {
        throw new Error('Quantidade de aulas é obrigatória e deve ser maior que zero');
      }

      const quantidadeAulasNum = Number(data.quantidadeAulas);

      if (isNaN(quantidadeAulasNum) || quantidadeAulasNum <= 0) {
        throw new Error('Quantidade de aulas deve ser um número válido maior que zero');
      }

      // Não enviar trimestre/semestre - backend busca do plano automaticamente
      return await planoEnsinoApi.createAula(idToUse, {
        titulo: data.titulo.trim(),
        descricao: data.descricao || undefined,
        tipo: data.tipo,
        quantidadeAulas: quantidadeAulasNum,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      queryClient.invalidateQueries({ queryKey: ["plano-ensino-stats"] });
      // Fechar modal apenas após sucesso
      setShowAulaDialog(false);
      resetAulaForm();
      toast({
        title: "Aula criada",
        description: "Aula planejada criada com sucesso.",
      });
    },
    onError: (error: any) => {
      // Não fechar modal em caso de erro - deixar usuário corrigir
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao criar aula";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Atualizar aula
  const updateAulaMutation = useSafeMutation({
    mutationFn: async ({ aulaId, data }: { aulaId: string; data: any }) => {
      return await planoEnsinoApi.updateAula(aulaId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      queryClient.invalidateQueries({ queryKey: ["plano-ensino-stats"] });
      // Fechar modal apenas após sucesso
      setShowAulaDialog(false);
      setEditingAula(null);
      resetAulaForm();
      toast({
        title: "Aula atualizada",
        description: "Aula planejada atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      // Não fechar modal em caso de erro - deixar usuário corrigir
      const errorMessage = error?.response?.data?.message || error?.message || "Erro ao atualizar aula";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Deletar aula
  const deleteAulaMutation = useSafeMutation({
    mutationFn: async (aulaId: string) => {
      return await planoEnsinoApi.deleteAula(aulaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      setDeletingAulaId(null);
      toast({
        title: "Aula excluída",
        description: "Aula planejada excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir aula",
        variant: "destructive",
      });
    },
  });

  // Reordenar aulas
  const reordenarMutation = useSafeMutation({
    mutationFn: async (novaOrdem: string[]) => {
      const idToUse = getPlanoId();
      if (!idToUse) return;
      return await planoEnsinoApi.reordenarAulas(idToUse, novaOrdem);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao reordenar aulas",
        variant: "destructive",
      });
    },
  });

  // Adicionar bibliografia
  const addBibliografiaMutation = useSafeMutation({
    mutationFn: async (data: typeof bibliografiaForm) => {
      const idToUse = getPlanoId();
      if (!idToUse) {
        throw new Error("Plano de ensino não encontrado");
      }
      return await planoEnsinoApi.addBibliografia(idToUse, {
        titulo: data.titulo,
        autor: data.autor || undefined,
        editora: data.editora || undefined,
        ano: data.ano ? Number(data.ano) : undefined,
        isbn: data.isbn || undefined,
        tipo: data.tipo,
        observacoes: data.observacoes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      setShowBibliografiaDialog(false);
      resetBibliografiaForm();
      toast({
        title: "Bibliografia adicionada",
        description: "Bibliografia adicionada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao adicionar bibliografia",
        variant: "destructive",
      });
    },
  });

  // Remover bibliografia
  const removeBibliografiaMutation = useSafeMutation({
    mutationFn: async (bibliografiaId: string) => {
      return await planoEnsinoApi.removeBibliografia(bibliografiaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      setDeletingBibliografiaId(null);
      toast({
        title: "Bibliografia removida",
        description: "Bibliografia removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover bibliografia",
        variant: "destructive",
      });
    },
  });

  // Ajustar carga horária automaticamente
  const ajustarCargaHorariaAutomaticoMutation = useSafeMutation({
    mutationFn: async () => {
      const idToUse = getPlanoId();
      if (!idToUse) {
        throw new Error("Plano de ensino não encontrado");
      }
      return await planoEnsinoApi.ajustarCargaHorariaAutomatico(idToUse);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      queryClient.invalidateQueries({ queryKey: ["plano-ensino-stats"] });
      toast({
        title: "Carga horária ajustada",
        description: data.message || "Carga horária ajustada automaticamente com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao ajustar carga horária",
        variant: "destructive",
      });
    },
  });

  // REMOVIDO: Atualizar carga horária manualmente
  // Carga horária total não pode ser editada - sempre vem da Disciplina

  // Copiar plano
  const copiarPlanoMutation = useSafeMutation({
    mutationFn: async (novoAnoLetivo: number) => {
      const idToUse = getPlanoId();
      if (!idToUse) {
        throw new Error("Plano de ensino não encontrado");
      }
      return await planoEnsinoApi.copiarPlano(idToUse, novoAnoLetivo);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      setShowCopiarDialog(false);
      toast({
        title: "Plano copiado",
        description: "Plano de ensino copiado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao copiar plano",
        variant: "destructive",
      });
    },
  });

  // Turmas compatíveis para copiar plano (mesmo ano e mesma classe; curso pode ser diferente)
  const { data: turmasParaCopiar = [] } = useQuery({
    queryKey: ["turmas-copiar-plano", planoAtual?.classeId, planoAtual?.anoLetivoId, showCopiarTurmaDialog],
    queryFn: async () => {
      const params: Record<string, string | number | undefined> = {
        anoLetivoId: planoAtual?.anoLetivoId,
        classeId: planoAtual?.classeId ?? undefined,
      };
      const data = await turmasApi.getAll(params);
      const list = Array.isArray(data) ? data : [];
      const mesmoAno = (t: any) => !planoAtual?.anoLetivoId || t.anoLetivoId === planoAtual.anoLetivoId;
      const filtrado = list.filter((t: any) => mesmoAno(t) && t.id !== planoAtual?.turmaId);
      return filtrado;
    },
    enabled: !!planoAtual?.anoLetivoId && showCopiarTurmaDialog,
  });

  // Copiar plano para outra turma
  const copiarParaTurmaMutation = useSafeMutation({
    mutationFn: async (novaTurmaId: string) => {
      const idToUse = getPlanoId();
      if (!idToUse) {
        throw new Error("Plano de ensino não encontrado");
      }
      return await planoEnsinoApi.copiarParaTurma(idToUse, novaTurmaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      setShowCopiarTurmaDialog(false);
      setTurmaDestinoId("");
      toast({
        title: "Plano copiado",
        description: "Plano de ensino copiado para a turma selecionada. Você pode editar o plano na nova turma.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao copiar plano para turma",
        variant: "destructive",
      });
    },
  });

  // Estatísticas de carga horária
  const { data: stats } = useQuery({
    queryKey: ["plano-ensino-stats", planoIdAtual],
    queryFn: async () => {
      const idToUse = getPlanoId();
      if (!idToUse) return null;
      return await planoEnsinoApi.getStats(idToUse);
    },
    enabled: !!planoIdAtual,
  });

  const resetAulaForm = () => {
    setAulaForm({
      titulo: "",
      descricao: "",
      tipo: "TEORICA",
      quantidadeAulas: "1",
    });
    setEditingAula(null);
  };

  // Abrir diálogo de aula quando solicitado
  useEffect(() => {
    const idToUse = getPlanoId();
    if (shouldOpenAulaDialog && idToUse) {
      resetAulaForm();
      setShowAulaDialog(true);
      onAulaDialogOpened?.();
    }
  }, [shouldOpenAulaDialog, planoId]);

  const resetBibliografiaForm = () => {
    setBibliografiaForm({
      titulo: "",
      autor: "",
      editora: "",
      ano: "",
      isbn: "",
      tipo: "BIBLIOGRAFIA_BASICA",
      observacoes: "",
    });
  };

  const handleEditAula = (aula: any) => {
    setEditingAula(aula);
    setAulaForm({
      titulo: aula.titulo,
      descricao: aula.descricao || "",
      tipo: aula.tipo,
      quantidadeAulas: aula.quantidadeAulas.toString(),
    });
    setShowAulaDialog(true);
  };

  const handleMoverAula = (aulaId: string, direcao: "up" | "down") => {
    if (!planoAtual?.aulas) return;
    
    const aulas = [...planoAtual.aulas];
    const index = aulas.findIndex((a) => a.id === aulaId);
    if (index === -1) return;

    if (direcao === "up" && index > 0) {
      [aulas[index], aulas[index - 1]] = [aulas[index - 1], aulas[index]];
    } else if (direcao === "down" && index < aulas.length - 1) {
      [aulas[index], aulas[index + 1]] = [aulas[index + 1], aulas[index]];
    } else {
      return;
    }

    const novaOrdem = aulas.map((a) => a.id);
    reordenarMutation.mutate(novaOrdem);
  };

  const handleSubmitAula = () => {
    // Validar APENAS título, tipo e quantidade
    // Período (semestre/trimestre) é herdado automaticamente do Plano de Ensino - NÃO validar
    
    if (!aulaForm.titulo || !aulaForm.titulo.trim()) {
      toast({
        title: "Erro de validação",
        description: "Título é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!aulaForm.tipo) {
      toast({
        title: "Erro de validação",
        description: "Tipo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!aulaForm.quantidadeAulas || Number(aulaForm.quantidadeAulas) <= 0) {
      toast({
        title: "Erro de validação",
        description: "Quantidade de aulas é obrigatória e deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    const quantidadeAulasNum = Number(aulaForm.quantidadeAulas);

    if (isNaN(quantidadeAulasNum) || quantidadeAulasNum <= 0) {
      toast({
        title: "Erro de validação",
        description: "Quantidade de aulas deve ser um número válido maior que zero",
        variant: "destructive",
      });
      return;
    }

    if (editingAula) {
      // Ao editar, manter o período existente (não enviar trimestre)
      // Período é herdado automaticamente do plano - não enviar no body
      updateAulaMutation.mutate({
        aulaId: editingAula.id,
        data: {
          titulo: aulaForm.titulo.trim(),
          descricao: aulaForm.descricao || undefined,
          tipo: aulaForm.tipo,
          quantidadeAulas: quantidadeAulasNum,
        },
      });
    } else {
      const idToUse = getPlanoId();
      if (!idToUse) {
        createPlanoMutation.mutate();
        setTimeout(() => {
          createAulaMutation.mutate(aulaForm);
        }, 500);
      } else {
        createAulaMutation.mutate(aulaForm);
      }
    }
  };

  // Se não há plano, criar primeiro
  if (!planoAtual) {
    // Validar contexto mínimo necessário para criar plano
    const contextoValido = !!context.disciplinaId && !!context.professorId && !!instituicaoId && (!!context.anoLetivoId || !!context.anoLetivo);
    const contextoCompleto = contextoValido && (
      (isSuperior && !!context.semestre) || 
      (isSecundario && !!context.classeOuAno) || 
      (!isSuperior && !isSecundario) // Se tipo ainda não foi determinado, permitir criar
    );

    return (
      <Card>
        <CardHeader>
          <CardTitle>Planejar Aulas</CardTitle>
          <CardDescription>
            Crie um plano de ensino para começar a planejar as aulas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!contextoValido && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">
                    Complete o contexto do plano de ensino antes de criar
                  </p>
                  <ul className="text-xs text-yellow-700 mt-1 list-disc list-inside space-y-1">
                    {!context.disciplinaId && <li>Selecione uma disciplina</li>}
                    {!context.professorId && <li>Selecione um professor</li>}
                    {!context.anoLetivoId && !context.anoLetivo && <li>Selecione um ano letivo</li>}
                    {!instituicaoId && <li>Instituição não identificada</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}
          {contextoValido && !contextoCompleto && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">
                    {isSuperior && !context.semestre && "Selecione um semestre"}
                    {isSecundario && !context.classeOuAno && "Selecione uma classe no contexto acima"}
                  </p>
                </div>
              </div>
            </div>
          )}
          <Button
            onClick={() => createPlanoMutation.mutate()}
            disabled={createPlanoMutation.isPending || !contextoValido}
            title={!contextoValido ? "Complete o contexto do plano de ensino antes de criar" : undefined}
          >
            {createPlanoMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Criar Plano de Ensino
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Bloquear edição se estado não permitir ou se plano estiver bloqueado
  // Botão "Planejar Aula" SEMPRE habilitado (permite planejamento temporário)
  const bloqueado = permiteEdicao === false || planoAtual?.bloqueado || false;
  const podePlanejarAula = true; // SEMPRE permitir planejar aulas (mesmo se bloqueado)

  return (
    <div className="space-y-4">
      {/* Cabeçalho com ações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Planejar Aulas</CardTitle>
              <CardDescription>
                Crie e organize as aulas planejadas para este plano de ensino
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCopiarTurmaDialog(true)}
                disabled={bloqueado || !planoIdAtual}
                title={
                  bloqueado
                    ? "Plano bloqueado - não é possível copiar"
                    : !planoIdAtual
                    ? "Plano de ensino não encontrado"
                    : "Copiar este plano para outra turma do mesmo ano e classe (curso pode ser diferente)"
                }
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar para Outra Turma
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCopiarDialog(true)}
                disabled={bloqueado || !planoIdAtual || anosLetivos.length === 0}
                title={
                  bloqueado 
                    ? "Plano bloqueado - não é possível copiar" 
                    : !planoIdAtual 
                    ? "Plano de ensino não encontrado" 
                    : anosLetivos.length === 0
                    ? "Nenhum ano letivo disponível para copiar"
                    : "Copiar plano para outro ano letivo"
                }
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar para Ano
              </Button>
              <Button
                onClick={() => {
                  resetAulaForm();
                  setShowAulaDialog(true);
                }}
                disabled={false}
                title="Sempre permitido para planejamento temporário, mesmo com carga horária incompleta/excedente"
              >
                <Plus className="h-4 w-4 mr-2" />
                Planejar Aula
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Estatísticas de carga horária */}
      {stats && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Controle de Carga Horária</CardTitle>
              {!bloqueado && stats && stats.status !== "ok" && planoIdAtual && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => ajustarCargaHorariaAutomaticoMutation.mutate()}
                    disabled={ajustarCargaHorariaAutomaticoMutation.isPending}
                  >
                    {ajustarCargaHorariaAutomaticoMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Ajustando...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Ajustar Automaticamente
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Carga Horária Exigida</label>
                <p className="text-2xl font-bold">{stats.totalExigido}h</p>
                <p className="text-xs text-muted-foreground mt-1">Definida na Disciplina</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Carga Horária Planejada</label>
                <p className="text-2xl font-bold">{stats.totalPlanejado}h</p>
                <p className="text-xs text-muted-foreground mt-1">Soma das aulas</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Diferença</label>
                <p
                  className={`text-2xl font-bold ${
                    stats.status === "ok"
                      ? "text-green-600"
                      : stats.status === "faltando"
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {stats.diferenca > 0 ? "+" : ""}
                  {stats.diferenca}h
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Status</label>
                <div className="mt-1">
                  {stats.status === "ok" ? (
                    <Badge className="bg-green-100 text-green-800">OK</Badge>
                  ) : stats.status === "faltando" ? (
                    <Badge className="bg-yellow-100 text-yellow-800">Incompleto</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800">Excedente</Badge>
                  )}
                </div>
              </div>
            </div>
            {stats.status !== "ok" && (
              <div className={`mt-4 p-3 rounded-md flex items-center gap-2 ${
                stats.status === "faltando"
                  ? "bg-yellow-50 border border-yellow-200"
                  : "bg-red-50 border border-red-200"
              }`}>
                <AlertCircle className={`h-5 w-5 ${
                  stats.status === "faltando" ? "text-yellow-600" : "text-red-600"
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    stats.status === "faltando" ? "text-yellow-800" : "text-red-800"
                  }`}>
                    {stats.status === "faltando"
                      ? `Carga horária incompleta: faltam ${stats.diferenca} horas para completar a carga horária exigida (${stats.totalExigido}h).`
                      : `Carga horária excedente: o planejamento excede a carga horária exigida em ${Math.abs(stats.diferenca)} horas.`}
                  </p>
                  {stats.status === "excedente" && (
                    <p className="text-xs text-red-700 mt-1">
                      Ajuste o planejamento para que a carga horária planejada seja EXATAMENTE igual à carga horária exigida ({stats.totalExigido}h).
                    </p>
                  )}
                  {stats.status === "faltando" && (
                    <p className="text-xs text-yellow-700 mt-1">
                      Adicione mais aulas planejadas para atingir a carga horária exigida ({stats.totalExigido}h). A carga horária planejada deve ser EXATAMENTE igual à carga horária exigida.
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de aulas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Aulas Planejadas</CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                checked={mostrarApenasTitulo}
                onCheckedChange={setMostrarApenasTitulo}
              />
              <Label className="text-sm">Mostrar apenas título</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!planoAtual.aulas || planoAtual.aulas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma aula planejada. Clique em "Planejar Aula" para adicionar.
            </div>
          ) : (
            <div className="space-y-2">
              {planoAtual.aulas.map((aula: any, index: number) => (
                <div
                  key={aula.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {aula.ordem}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium">{aula.titulo}</h4>
                        {!mostrarApenasTitulo && (
                          <>
                            {aula.descricao && (
                              <p className="text-sm text-muted-foreground mt-1">{aula.descricao}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">
                                {aula.tipo === "TEORICA" ? "Teórica" : "Prática"}
                              </Badge>
                              {/* CRÍTICO: Mostrar apenas o período correto baseado no tipo de instituição */}
                              {isSuperior && (
                                <Badge variant="outline">
                                  {aula.trimestre}º Semestre
                                </Badge>
                              )}
                              {isSecundario && (
                                <Badge variant="outline">
                                  {aula.trimestre}º Trimestre
                                </Badge>
                              )}
                              {/* NUNCA mostrar período se tipo não foi determinado */}
                              <Badge variant="outline">
                                {aula.quantidadeAulas} {aula.quantidadeAulas === 1 ? "aula" : "aulas"}
                              </Badge>
                              <Badge
                                variant={aula.status === "MINISTRADA" ? "default" : "secondary"}
                              >
                                {aula.status === "MINISTRADA" ? "Ministrada" : "Planejada"}
                              </Badge>
                            </div>
                          </>
                        )}
                      </div>
                      {!bloqueado && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditAula(aula)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMoverAula(aula.id, "up")}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMoverAula(aula.id, "down")}
                            disabled={index === planoAtual.aulas.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeletingAulaId(aula.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar/Editar Aula */}
      <Dialog 
        open={showAulaDialog} 
        onOpenChange={(open) => {
          // Só fechar se não estiver em processo de mutation
          // Isso previne fechamento acidental durante salvamento
          if (!open && !createAulaMutation.isPending && !updateAulaMutation.isPending) {
            setShowAulaDialog(false);
            // Resetar formulário ao fechar
            if (!open) {
              resetAulaForm();
              setEditingAula(null);
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAula ? "Editar Aula Planejada" : "Nova Aula Planejada"}
            </DialogTitle>
            <DialogDescription>
              {editingAula
                ? "Atualize os dados da aula planejada"
                : "Adicione uma nova aula ao plano de ensino"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={aulaForm.titulo}
                onChange={(e) => setAulaForm((prev) => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ex: Introdução à Matéria"
                disabled={createAulaMutation.isPending || updateAulaMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={aulaForm.descricao}
                onChange={(e) => setAulaForm((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição do conteúdo da aula..."
                rows={4}
                disabled={createAulaMutation.isPending || updateAulaMutation.isPending}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={aulaForm.tipo}
                  onValueChange={(value: "TEORICA" | "PRATICA") =>
                    setAulaForm((prev) => ({ ...prev, tipo: value }))
                  }
                  disabled={createAulaMutation.isPending || updateAulaMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEORICA">Teórica</SelectItem>
                    <SelectItem value="PRATICA">Prática</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade de Aulas *</Label>
                <Input
                  type="number"
                  min="1"
                  value={aulaForm.quantidadeAulas}
                  onChange={(e) =>
                    setAulaForm((prev) => ({ ...prev, quantidadeAulas: e.target.value }))
                  }
                  disabled={createAulaMutation.isPending || updateAulaMutation.isPending}
                />
              </div>
            </div>
            {/* Período (Semestre/Trimestre) é herdado automaticamente do Plano de Ensino */}
            {/* Exibir informação sobre período herdado apenas quando há plano */}
            {planoAtual && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      {isSuperior ? "Semestre" : isSecundario ? "Trimestre" : "Período"} (Herdado do Plano de Ensino)
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      {isSuperior && planoAtual?.semestre 
                        ? `Esta aula será automaticamente vinculada ao ${planoAtual.semestre}º Semestre do plano de ensino.`
                        : isSecundario && planoAtual?.anoLetivo
                        ? `Esta aula será automaticamente vinculada ao trimestre do ano letivo ${planoAtual.anoLetivo} conforme configurado no plano de ensino.`
                        : "O período acadêmico será herdado automaticamente do Plano de Ensino."}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* Exibir erros do backend se houver */}
            {(createAulaMutation.error || updateAulaMutation.error) && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {createAulaMutation.error?.response?.data?.message || 
                 updateAulaMutation.error?.response?.data?.message ||
                 createAulaMutation.error?.message ||
                 updateAulaMutation.error?.message ||
                 "Erro ao salvar aula. Verifique os dados e tente novamente."}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                if (!createAulaMutation.isPending && !updateAulaMutation.isPending) {
                  setShowAulaDialog(false);
                  resetAulaForm();
                  setEditingAula(null);
                }
              }}
              disabled={createAulaMutation.isPending || updateAulaMutation.isPending}
            >
              Cancelar
            </Button>
            {(() => {
              // Validação apenas de título, tipo e quantidade
              // Período (semestre/trimestre) é herdado automaticamente do Plano de Ensino - NÃO validar
              const tituloValido = !!aulaForm.titulo && aulaForm.titulo.trim().length > 0;
              const tipoValido = !!aulaForm.tipo; // Tipo sempre tem valor padrão "TEORICA"
              const quantidadeValida = !!aulaForm.quantidadeAulas && 
                String(aulaForm.quantidadeAulas).trim() !== '' && 
                String(aulaForm.quantidadeAulas) !== '0' &&
                !isNaN(Number(aulaForm.quantidadeAulas)) &&
                Number(aulaForm.quantidadeAulas) > 0;
              const isPending = createAulaMutation.isPending || updateAulaMutation.isPending;
              
              // Botão "Criar" depende APENAS de título, tipo e quantidade
              // Período é herdado automaticamente - não validar
              const isDisabled = !tituloValido || !tipoValido || !quantidadeValida || isPending;
              
              return (
                <Button
                  onClick={handleSubmitAula}
                  disabled={isDisabled}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editingAula ? "Salvando..." : "Criando..."}
                    </>
                  ) : (
                    editingAula ? "Salvar" : "Criar"
                  )}
                </Button>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <AlertDialog
        open={!!deletingAulaId}
        onOpenChange={(open) => !open && setDeletingAulaId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta aula? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingAulaId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingAulaId) {
                  deleteAulaMutation.mutate(deletingAulaId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Seção Bibliografia */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Book className="h-5 w-5" />
                Bibliografia
              </CardTitle>
              <CardDescription>
                Defina a bibliografia básica e complementar do plano
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                resetBibliografiaForm();
                setShowBibliografiaDialog(true);
              }}
              disabled={bloqueado || !planoIdAtual}
              title={bloqueado ? "Plano bloqueado - não é possível adicionar bibliografia" : !planoIdAtual ? "Plano de ensino não encontrado" : undefined}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Bibliografia
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!planoAtual.bibliografias || planoAtual.bibliografias.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma bibliografia adicionada. Clique em "Adicionar Bibliografia" para adicionar.
            </div>
          ) : (
            <div className="space-y-3">
              {planoAtual.bibliografias.map((bib: any) => (
                <div
                  key={bib.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{bib.titulo}</h4>
                      <Badge variant="outline">
                        {bib.tipo === "BIBLIOGRAFIA_BASICA" ? "Básica" : "Complementar"}
                      </Badge>
                    </div>
                    {bib.autor && (
                      <p className="text-sm text-muted-foreground">Autor: {bib.autor}</p>
                    )}
                    {bib.editora && (
                      <p className="text-sm text-muted-foreground">Editora: {bib.editora}</p>
                    )}
                    {bib.ano && (
                      <p className="text-sm text-muted-foreground">Ano: {bib.ano}</p>
                    )}
                    {bib.isbn && (
                      <p className="text-sm text-muted-foreground">ISBN: {bib.isbn}</p>
                    )}
                    {bib.observacoes && (
                      <p className="text-sm text-muted-foreground mt-1">{bib.observacoes}</p>
                    )}
                  </div>
                  {!bloqueado && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeletingBibliografiaId(bib.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Adicionar Bibliografia */}
      <Dialog open={showBibliografiaDialog} onOpenChange={setShowBibliografiaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Bibliografia</DialogTitle>
            <DialogDescription>
              Adicione uma referência bibliográfica ao plano de ensino
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={bibliografiaForm.titulo}
                onChange={(e) =>
                  setBibliografiaForm((prev) => ({ ...prev, titulo: e.target.value }))
                }
                placeholder="Título do livro/artigo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Autor</Label>
                <Input
                  value={bibliografiaForm.autor}
                  onChange={(e) =>
                    setBibliografiaForm((prev) => ({ ...prev, autor: e.target.value }))
                  }
                  placeholder="Nome do autor"
                />
              </div>
              <div className="space-y-2">
                <Label>Editora</Label>
                <Input
                  value={bibliografiaForm.editora}
                  onChange={(e) =>
                    setBibliografiaForm((prev) => ({ ...prev, editora: e.target.value }))
                  }
                  placeholder="Nome da editora"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input
                  type="number"
                  value={bibliografiaForm.ano}
                  onChange={(e) =>
                    setBibliografiaForm((prev) => ({ ...prev, ano: e.target.value }))
                  }
                  placeholder="Ano de publicação"
                />
              </div>
              <div className="space-y-2">
                <Label>ISBN</Label>
                <Input
                  value={bibliografiaForm.isbn}
                  onChange={(e) =>
                    setBibliografiaForm((prev) => ({ ...prev, isbn: e.target.value }))
                  }
                  placeholder="ISBN"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={bibliografiaForm.tipo}
                onValueChange={(value: "BIBLIOGRAFIA_BASICA" | "BIBLIOGRAFIA_COMPLEMENTAR") =>
                  setBibliografiaForm((prev) => ({ ...prev, tipo: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BIBLIOGRAFIA_BASICA">Bibliografia Básica</SelectItem>
                  <SelectItem value="BIBLIOGRAFIA_COMPLEMENTAR">
                    Bibliografia Complementar
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={bibliografiaForm.observacoes}
                onChange={(e) =>
                  setBibliografiaForm((prev) => ({ ...prev, observacoes: e.target.value }))
                }
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowBibliografiaDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!bibliografiaForm.titulo.trim()) {
                  toast({
                    title: "Erro",
                    description: "Título é obrigatório",
                    variant: "destructive",
                  });
                  return;
                }
                addBibliografiaMutation.mutate(bibliografiaForm);
              }}
              disabled={!bibliografiaForm.titulo.trim() || addBibliografiaMutation.isPending}
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Remoção de Bibliografia */}
      <AlertDialog
        open={!!deletingBibliografiaId}
        onOpenChange={(open) => !open && setDeletingBibliografiaId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta bibliografia? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingBibliografiaId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingBibliografiaId) {
                  removeBibliografiaMutation.mutate(deletingBibliografiaId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* REMOVIDO: Dialog Ajustar Carga Horária Manualmente */}
      {/* Carga horária total não pode ser editada - sempre vem da Disciplina */}

      {/* Dialog Copiar Plano */}
      <Dialog open={showCopiarDialog} onOpenChange={setShowCopiarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar Plano de Ensino</DialogTitle>
            <DialogDescription>
              Copie este plano para um ano letivo anterior
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ano Letivo de Origem</Label>
              <Input value={context.anoLetivo} disabled />
            </div>
            <div className="space-y-2">
              <Label>Novo Ano Letivo *</Label>
              <Select
                value={copiarForm.novoAnoLetivo.toString()}
                onValueChange={(value) =>
                  setCopiarForm((prev) => ({ ...prev, novoAnoLetivo: Number(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
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
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCopiarDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => copiarPlanoMutation.mutate(copiarForm.novoAnoLetivo)}
              disabled={copiarPlanoMutation.isPending || !planoIdAtual || anosLetivos.length === 0}
              title={!planoIdAtual ? "Plano de ensino não encontrado" : anosLetivos.length === 0 ? "Nenhum ano letivo disponível" : undefined}
            >
              {copiarPlanoMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Copiando...
                </>
              ) : (
                "Copiar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Copiar para Outra Turma */}
      <Dialog open={showCopiarTurmaDialog} onOpenChange={setShowCopiarTurmaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar para Outra Turma</DialogTitle>
            <DialogDescription>
              Copie este plano (apresentação, aulas e bibliografia) para outra turma do mesmo ano e classe. Curso pode ser diferente — assim pode reutilizar o plano em turmas de outros cursos. A turma atual não aparece na lista.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Turma de destino *</Label>
              <Select
                value={turmaDestinoId}
                onValueChange={setTurmaDestinoId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {turmasParaCopiar.length === 0 ? (
                    <SelectItem value="empty" disabled>Nenhuma turma compatível disponível</SelectItem>
                  ) : (
                    turmasParaCopiar.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome || t.nomeTurma || t.codigo || t.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCopiarTurmaDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (turmaDestinoId && turmaDestinoId !== "empty") {
                  copiarParaTurmaMutation.mutate(turmaDestinoId);
                } else {
                  toast({
                    title: "Selecione uma turma",
                    description: "Escolha a turma de destino para copiar o plano",
                    variant: "destructive",
                  });
                }
              }}
              disabled={copiarParaTurmaMutation.isPending || !turmaDestinoId || turmaDestinoId === "empty"}
              title={!turmaDestinoId || turmaDestinoId === "empty" ? "Selecione uma turma" : undefined}
            >
              {copiarParaTurmaMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Copiando...
                </>
              ) : (
                "Copiar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

