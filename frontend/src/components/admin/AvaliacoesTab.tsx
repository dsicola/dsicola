import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { avaliacoesApi, notasAvaliacaoApi, turmasApi, planoEnsinoApi, semestreApi, trimestreApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, ClipboardList, Users, Calendar, GraduationCap, BookOpen, School } from 'lucide-react';
import { AnoLetivoAtivoGuard } from '@/components/academico/AnoLetivoAtivoGuard';
import { PeriodoAcademicoSelect } from '@/components/academico/PeriodoAcademicoSelect';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';

interface Avaliacao {
  id: string;
  turmaId: string;
  professorId: string;
  planoEnsinoId?: string; // NOVA FK: Avaliação sempre vinculada a um Plano de Ensino
  tipo: 'PROVA' | 'TESTE' | 'TRABALHO' | 'PROVA_FINAL' | 'RECUPERACAO';
  trimestre: number | null;
  peso: number;
  data: string;
  nome?: string | null;
  descricao?: string | null;
  fechada: boolean;
  turma: {
    id: string;
    nome: string;
    disciplina?: {
      id: string;
      nome: string;
    } | null;
    curso?: {
      id: string;
      nome: string;
    } | null;
    classe?: {
      id: string;
      nome: string;
    } | null;
    anoLetivoRef?: {
      id: string;
      ano: number;
    } | null;
  };
  professor: {
    id: string;
    nomeCompleto: string;
  };
  _count?: {
    notas: number;
  };
}

interface AlunoNota {
  alunoId: string;
  nomeCompleto: string;
  email: string;
  numeroIdentificacao: string | null;
  numeroIdentificacaoPublica: string | null;
  frequencia: {
    totalAulas: number;
    presencas: number;
    ausencias: number;
    justificadas: number;
    percentual: number;
    temFrequenciaMinima: boolean;
  };
  nota: {
    id: string;
    valor: number;
    observacoes: string | null;
  } | null;
  bloqueado: boolean;
}

interface Turma {
  id: string;
  nome: string;
  disciplina?: {
    id: string;
    nome: string;
  } | null;
  curso?: {
    id: string;
    nome: string;
  } | null;
  classe?: {
    id: string;
    nome: string;
  } | null;
  anoLetivoRef?: {
    id: string;
    ano: number;
  } | null;
  semestre?: string | null;
}

export const AvaliacoesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { isSuperior, isSecundario, tipoAcademico } = useInstituicao();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();
  
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>('');
  const [avaliacaoDialogOpen, setAvaliacaoDialogOpen] = useSafeDialog(false);
  const [notasDialogOpen, setNotasDialogOpen] = useSafeDialog(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [editingAvaliacao, setEditingAvaliacao] = useState<Avaliacao | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<Avaliacao | null>(null);
  const [alunosNotas, setAlunosNotas] = useState<AlunoNota[]>([]);
  
  const [formData, setFormData] = useState({
    tipo: 'PROVA' as 'PROVA' | 'TESTE' | 'TRABALHO' | 'PROVA_FINAL' | 'RECUPERACAO',
    trimestre: '' as string,
    semestreId: '' as string, // Para Ensino Superior
    trimestreId: '' as string, // Para Ensino Secundário
    peso: '1',
    data: format(new Date(), 'yyyy-MM-dd'),
    nome: '',
    descricao: '',
  });
  
  const [notasForm, setNotasForm] = useState<{ [alunoId: string]: { valor: string; observacoes: string } }>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Buscar turmas do professor (ou todas se ADMIN)
  const { data: turmas = [], isLoading: isLoadingTurmas } = useQuery({
    queryKey: ['turmas-avaliacoes', instituicaoId],
    queryFn: async () => {
      return await turmasApi.getAll({ instituicaoId });
    },
    enabled: !!instituicaoId,
  });

  // Buscar avaliações do plano de ensino
  const { data: avaliacoes = [], isLoading: isLoadingAvaliacoes, refetch: refetchAvaliacoes } = useQuery({
    queryKey: ['avaliacoes-turma', planoEnsino?.id],
    queryFn: async () => {
      if (!planoEnsino?.id) return [];
      return await avaliacoesApi.getAll({ planoEnsinoId: planoEnsino.id });
    },
    enabled: !!planoEnsino?.id,
  });

  // Buscar turma selecionada para exibir informações
  const { data: turmaSelecionada } = useQuery({
    queryKey: ['turma', selectedTurmaId],
    queryFn: async () => {
      if (!selectedTurmaId) return null;
      return await turmasApi.getById(selectedTurmaId);
    },
    enabled: !!selectedTurmaId,
  });

  // Buscar plano de ensino baseado na turma selecionada
  // REGRA: Buscar por turmaId diretamente (novo padrão - não usar turma.disciplinaId ou turma.professorId)
  const { data: planoEnsino } = useQuery({
    queryKey: ['plano-ensino-turma', selectedTurmaId],
    queryFn: async () => {
      if (!selectedTurmaId) {
        return null;
      }
      try {
        // Buscar planos de ensino por turmaId diretamente
        const planos = await planoEnsinoApi.getByContext({
          turmaId: selectedTurmaId,
        });
        // Backend retorna array ou objeto único
        // Se for array, retornar o primeiro (turma pode ter múltiplos planos teoricamente, mas na prática é 1:1)
        return Array.isArray(planos) ? planos[0] || null : planos;
      } catch {
        return null;
      }
    },
    enabled: !!selectedTurmaId,
  });

  // Buscar alunos e notas para lançamento
  const { data: alunosNotasData, isLoading: isLoadingAlunosNotas } = useQuery({
    queryKey: ['alunos-notas-avaliacao', selectedAvaliacao?.id],
    queryFn: async () => {
      if (!selectedAvaliacao?.id) return null;
      const data = await notasAvaliacaoApi.getAlunosParaLancar(selectedAvaliacao.id);
      return data;
    },
    enabled: !!selectedAvaliacao?.id && notasDialogOpen,
  });

  // Atualizar alunosNotas quando dados chegarem
  React.useEffect(() => {
    if (alunosNotasData?.alunos) {
      setAlunosNotas(alunosNotasData.alunos);
      // Inicializar formulário com notas existentes
      const notasIniciais: { [alunoId: string]: { valor: string; observacoes: string } } = {};
      alunosNotasData.alunos.forEach((aluno: AlunoNota) => {
        if (aluno.nota) {
          notasIniciais[aluno.alunoId] = {
            valor: aluno.nota.valor.toString(),
            observacoes: aluno.nota.observacoes || '',
          };
        } else {
          notasIniciais[aluno.alunoId] = {
            valor: '',
            observacoes: '',
          };
        }
      });
      setNotasForm(notasIniciais);
    }
  }, [alunosNotasData]);

  // Criar/Atualizar avaliação - protegida contra unmount
  const createMutation = useSafeMutation({
    mutationFn: async (data: any) => {
      if (editingAvaliacao) {
        return await avaliacoesApi.update(editingAvaliacao.id, data);
      }
      return await avaliacoesApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avaliacoes-turma'] });
      toast.success(`Avaliação ${editingAvaliacao ? 'atualizada' : 'criada'} com sucesso!`);
      // Fechar modal e resetar formulário APENAS após sucesso confirmado
      setAvaliacaoDialogOpen(false);
      resetForm();
      setEditingAvaliacao(null);
    },
    onError: (error: any) => {
      // NÃO fechar modal em caso de erro - manter estado para correção
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Erro ao salvar avaliação';
      toast.error(errorMessage);
    },
  });

  // Deletar avaliação
  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      return await avaliacoesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avaliacoes-turma'] });
      toast.success('Avaliação excluída com sucesso!');
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao excluir avaliação');
    },
  });

  // Lançar notas em lote
  const lancarNotasMutation = useSafeMutation({
    mutationFn: async (data: { avaliacaoId: string; notas: Array<{ alunoId: string; valor: number; observacoes?: string }> }) => {
      return await notasAvaliacaoApi.createLote(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avaliacoes-turma'] });
      queryClient.invalidateQueries({ queryKey: ['alunos-notas-avaliacao'] });
      toast.success('Notas lançadas com sucesso!');
      setNotasDialogOpen(false);
      setSelectedAvaliacao(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao lançar notas');
    },
  });

  const resetForm = () => {
    setFormData({
      tipo: 'PROVA',
      trimestre: '',
      peso: '1',
      data: format(new Date(), 'yyyy-MM-dd'),
      nome: '',
      descricao: '',
    });
    setEditingAvaliacao(null);
    setErrors({});
  };

  const openAvaliacaoDialog = (avaliacao?: Avaliacao) => {
    if (avaliacao) {
      setEditingAvaliacao(avaliacao);
      setFormData({
        tipo: avaliacao.tipo,
        trimestre: avaliacao.trimestre?.toString() || '',
        peso: avaliacao.peso.toString(),
        data: format(new Date(avaliacao.data), 'yyyy-MM-dd'),
        nome: avaliacao.nome || '',
        descricao: avaliacao.descricao || '',
      });
    } else {
      resetForm();
    }
    setAvaliacaoDialogOpen(true);
  };

  const openNotasDialog = async (avaliacao: Avaliacao) => {
    setSelectedAvaliacao(avaliacao);
    setNotasDialogOpen(true);
  };

  const handleSubmitAvaliacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    // Validações
    const newErrors: Record<string, string> = {};
    
    if (!selectedTurmaId) {
      newErrors.turma = 'Selecione uma turma';
    }
    
    if (!formData.data) {
      newErrors.data = 'Data é obrigatória';
    }
    
    // Validações condicionais por tipo de instituição
    if (isSecundario) {
      if (!formData.trimestre && !formData.trimestreId) {
        newErrors.trimestre = 'Trimestre é obrigatório para Ensino Secundário';
      }
    }
    if (isSuperior) {
      if (!formData.semestreId) {
        newErrors.semestreId = 'Semestre é obrigatório para Ensino Superior';
      }
    }
    
    if (formData.peso && (parseFloat(formData.peso) < 0 || parseFloat(formData.peso) > 10)) {
      newErrors.peso = 'Peso deve estar entre 0 e 10';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitting(false);
      return;
    }

    if (!planoEnsino?.id) {
      setErrors({ plano: 'Plano de ensino não encontrado para esta turma. Crie um Plano de Ensino associando Professor, Disciplina e Ano Letivo antes de criar avaliações.' });
      setSubmitting(false);
      return;
    }

    try {
      const dataToSave: any = {
        planoEnsinoId: planoEnsino.id, // OBRIGATÓRIO: Avaliação sempre vinculada ao Plano de Ensino
        turmaId: selectedTurmaId, // Mantido para compatibilidade, mas será derivado do plano no backend
        tipo: formData.tipo,
        peso: parseFloat(formData.peso) || 1,
        data: formData.data,
        nome: formData.nome || null,
        descricao: formData.descricao || null,
      };

      // Campos condicionais por tipo de instituição
      if (isSecundario) {
        // Ensino Secundário: trimestre obrigatório
        if (formData.trimestreId) {
          dataToSave.trimestreId = formData.trimestreId;
          dataToSave.trimestre = parseInt(formData.trimestre) || null;
        } else if (formData.trimestre) {
          dataToSave.trimestre = parseInt(formData.trimestre);
        }
        // NÃO enviar semestreId para Secundário
        dataToSave.semestreId = null;
      } else if (isSuperior) {
        // Ensino Superior: semestre obrigatório
        if (!formData.semestreId) {
          throw new Error('Semestre é obrigatório para Ensino Superior');
        }
        dataToSave.semestreId = formData.semestreId;
        // NÃO enviar trimestre para Superior
        dataToSave.trimestre = null;
        dataToSave.trimestreId = null;
      }

      await createMutation.mutateAsync(dataToSave);
    } catch (error) {
      // Erro já tratado no mutation
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitNotas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAvaliacao) return;

    setSubmitting(true);
    setErrors({});

    // Validar notas
    const notas: Array<{ alunoId: string; valor: number; observacoes?: string }> = [];
    const newErrors: Record<string, string> = {};

    alunosNotas.forEach((aluno) => {
      // Validar alunoId
      if (!aluno.alunoId || aluno.alunoId.trim() === '') {
        newErrors[aluno.alunoId || 'unknown'] = 'ID do aluno inválido';
        return;
      }

      const notaValue = notasForm[aluno.alunoId]?.valor?.trim();
      
      if (!notaValue) {
        newErrors[aluno.alunoId] = 'Nota é obrigatória';
        return;
      }

      // Tratar vírgula como separador decimal
      const valorStr = notaValue.replace(',', '.');
      const valor = parseFloat(valorStr);
      
      if (isNaN(valor)) {
        newErrors[aluno.alunoId] = 'Nota deve ser um número válido';
        return;
      }

      if (valor < 0 || valor > 20) {
        newErrors[aluno.alunoId] = 'Nota deve estar entre 0 e 20';
        return;
      }

      notas.push({
        alunoId: aluno.alunoId.trim(),
        valor: Math.round(valor * 10) / 10, // Arredondar para 1 casa decimal
        observacoes: notasForm[aluno.alunoId]?.observacoes?.trim() || undefined,
      });
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitting(false);
      return;
    }

    if (notas.length === 0) {
      toast.error('Nenhuma nota válida para lançar');
      setSubmitting(false);
      return;
    }

    // Validar que todas as notas têm alunoId válido
    const notasInvalidas = notas.filter(n => !n.alunoId || n.alunoId.trim() === '');
    if (notasInvalidas.length > 0) {
      toast.error('Algumas notas não possuem alunoId válido. Por favor, recarregue a página e tente novamente.');
      setSubmitting(false);
      return;
    }

    try {
      await lancarNotasMutation.mutateAsync({
        avaliacaoId: selectedAvaliacao.id,
        notas,
      });
    } catch (error: any) {
      // Melhorar mensagem de erro
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.error || 
                          error?.message || 
                          'Erro desconhecido ao lançar notas';
      
      console.error('Erro ao lançar notas:', {
        error,
        response: error?.response?.data,
        status: error?.response?.status,
        notas: notas.map(n => ({ alunoId: n.alunoId, valor: n.valor })),
      });
      
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      PROVA: 'Prova',
      TESTE: 'Teste',
      TRABALHO: 'Trabalho',
      PROVA_FINAL: 'Prova Final',
      RECUPERACAO: 'Recuperação',
    };
    return labels[tipo] || tipo;
  };

  return (
    <AnoLetivoAtivoGuard showAlert={true} disableChildren={false}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Avaliações
              </CardTitle>
              <CardDescription>
                Gerencie avaliações e lance notas por turma
              </CardDescription>
            </div>
            <Button
              onClick={() => openAvaliacaoDialog()}
              disabled={!selectedTurmaId || !planoEnsino?.id}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Avaliação
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Seleção de Turma */}
          <div className="mb-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="turma">Selecione a Turma *</Label>
              <Select
                value={selectedTurmaId}
                onValueChange={setSelectedTurmaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma turma" />
                </SelectTrigger>
                <SelectContent>
                  {turmas.map((turma: Turma) => (
                    <SelectItem key={turma.id} value={turma.id}>
                      {turma.nome}
                      {turma.disciplina && ` - ${turma.disciplina.nome}`}
                      {turma.curso && ` (${turma.curso.nome})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Informações da Turma Selecionada */}
            {turmaSelecionada && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <School className="h-4 w-4" />
                  Informações da Turma
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {turmaSelecionada.disciplina && (
                    <div>
                      <span className="text-muted-foreground">Disciplina:</span>
                      <p className="font-medium">{turmaSelecionada.disciplina.nome}</p>
                    </div>
                  )}
                  {turmaSelecionada.curso && (
                    <div>
                      <span className="text-muted-foreground">Curso:</span>
                      <p className="font-medium">{turmaSelecionada.curso.nome}</p>
                    </div>
                  )}
                  {turmaSelecionada.classe && (
                    <div>
                      <span className="text-muted-foreground">Classe:</span>
                      <p className="font-medium">{turmaSelecionada.classe.nome}</p>
                    </div>
                  )}
                  {turmaSelecionada.anoLetivoRef && (
                    <div>
                      <span className="text-muted-foreground">Ano Letivo:</span>
                      <p className="font-medium">{turmaSelecionada.anoLetivoRef.ano}</p>
                    </div>
                  )}
                  {isSuperior && turmaSelecionada.semestre && (
                    <div>
                      <span className="text-muted-foreground">Semestre:</span>
                      <p className="font-medium">{turmaSelecionada.semestre}</p>
                    </div>
                  )}
                </div>
                {!planoEnsino && turmaSelecionada && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    <strong>Atenção:</strong> Plano de Ensino não encontrado para esta turma. Crie um Plano de Ensino associando Professor, Disciplina e Ano Letivo antes de criar avaliações.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lista de Avaliações */}
          {selectedTurmaId && (
            <>
              {isLoadingAvaliacoes ? (
                <div className="text-center py-8 text-muted-foreground">Carregando avaliações...</div>
              ) : avaliacoes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma avaliação cadastrada para esta turma. Clique em "Nova Avaliação" para adicionar.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Nome</TableHead>
                        {isSecundario && <TableHead>Trimestre</TableHead>}
                        {isSuperior && <TableHead>Semestre</TableHead>}
                        <TableHead>Data</TableHead>
                        <TableHead>Peso</TableHead>
                        <TableHead>Notas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {avaliacoes.map((avaliacao: Avaliacao) => (
                        <TableRow key={avaliacao.id}>
                          <TableCell>
                            <Badge variant="outline">{getTipoLabel(avaliacao.tipo)}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {avaliacao.nome || '-'}
                          </TableCell>
                          {isSecundario && (
                            <TableCell>
                              {avaliacao.trimestre ? `${avaliacao.trimestre}º Trimestre` : '-'}
                            </TableCell>
                          )}
                          {isSuperior && (
                            <TableCell>
                              {avaliacao.turma.anoLetivoRef ? `Semestre ${avaliacao.turma.anoLetivoRef.ano}` : '-'}
                            </TableCell>
                          )}
                          <TableCell>
                            {format(new Date(avaliacao.data), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{avaliacao.peso}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {avaliacao._count?.notas || 0} notas
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={avaliacao.fechada ? 'destructive' : 'default'}>
                              {avaliacao.fechada ? 'Fechada' : 'Aberta'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openNotasDialog(avaliacao)}
                                disabled={avaliacao.fechada}
                                title={avaliacao.fechada ? 'Avaliação fechada' : 'Lançar notas'}
                              >
                                <Users className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openAvaliacaoDialog(avaliacao)}
                                disabled={avaliacao.fechada}
                                title={avaliacao.fechada ? 'Avaliação fechada' : 'Editar'}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(avaliacao.id)}
                                disabled={avaliacao.fechada}
                                title={avaliacao.fechada ? 'Avaliação fechada' : 'Excluir'}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Criar/Editar Avaliação */}
      <Dialog open={avaliacaoDialogOpen} onOpenChange={setAvaliacaoDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAvaliacao ? 'Editar Avaliação' : 'Nova Avaliação'}
            </DialogTitle>
            <DialogDescription>
              {turmaSelecionada && (
                <>
                  Turma: <strong>{turmaSelecionada.nome}</strong>
                  {turmaSelecionada.disciplina && ` - ${turmaSelecionada.disciplina.nome}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAvaliacao}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de Avaliação *</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isSuperior && (
                        <>
                          <SelectItem value="PROVA">Prova (P1, P2, P3)</SelectItem>
                          <SelectItem value="TRABALHO">Trabalho</SelectItem>
                          <SelectItem value="PROVA_FINAL">Exame</SelectItem>
                          <SelectItem value="RECUPERACAO">Recurso</SelectItem>
                        </>
                      )}
                      {isSecundario && (
                        <>
                          <SelectItem value="TESTE">Teste</SelectItem>
                          <SelectItem value="PROVA">Prova</SelectItem>
                          <SelectItem value="TRABALHO">Trabalho</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data">Data *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
                  />
                  {errors.data && (
                    <p className="text-sm text-destructive">{errors.data}</p>
                  )}
                </div>
              </div>

              {isSecundario && (
                <PeriodoAcademicoSelect
                  value={formData.trimestreId || formData.trimestre}
                  onValueChange={(value) => {
                    // Se o valor é um ID (UUID), usar trimestreId, senão usar trimestre (número)
                    if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                      setFormData({ ...formData, trimestreId: value, trimestre: '' });
                    } else {
                      setFormData({ ...formData, trimestre: value, trimestreId: '' });
                    }
                  }}
                  anoLetivo={anoLetivoAtivo?.ano}
                  anoLetivoId={anoLetivoAtivo?.id}
                  label="Trimestre"
                  required
                  useNumericValue={true}
                />
              )}
              {isSuperior && (
                <PeriodoAcademicoSelect
                  value={formData.semestreId}
                  onValueChange={(value) => setFormData({ ...formData, semestreId: value })}
                  anoLetivo={anoLetivoAtivo?.ano}
                  anoLetivoId={anoLetivoAtivo?.id}
                  label="Semestre"
                  required
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="peso">Peso (opcional)</Label>
                  <Input
                    id="peso"
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={formData.peso}
                    onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                    placeholder="1.0"
                  />
                  {errors.peso && (
                    <p className="text-sm text-destructive">{errors.peso}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome (opcional)</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Prova 1, Teste 2"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição (opcional)</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição da avaliação..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAvaliacaoDialogOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : editingAvaliacao ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Lançar Notas */}
      <Dialog open={notasDialogOpen} onOpenChange={setNotasDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançar Notas</DialogTitle>
            <DialogDescription>
              {selectedAvaliacao && (
                <>
                  {selectedAvaliacao.nome || getTipoLabel(selectedAvaliacao.tipo)} - {format(new Date(selectedAvaliacao.data), 'dd/MM/yyyy', { locale: ptBR })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {isLoadingAlunosNotas ? (
            <div className="text-center py-8 text-muted-foreground">Carregando alunos...</div>
          ) : alunosNotas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum aluno encontrado na turma</div>
          ) : (
            <form onSubmit={handleSubmitNotas}>
              <div className="space-y-4 py-4">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Frequência</TableHead>
                        <TableHead className="w-32">Nota *</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alunosNotas.map((aluno) => (
                        <TableRow key={aluno.alunoId} className={aluno.bloqueado ? 'opacity-60' : ''}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{aluno.nomeCompleto}</p>
                              {aluno.numeroIdentificacaoPublica && (
                                <p className="text-xs text-muted-foreground">
                                  {aluno.numeroIdentificacaoPublica}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{aluno.frequencia.percentual.toFixed(1)}%</p>
                              <p className="text-xs text-muted-foreground">
                                {aluno.frequencia.presencas}/{aluno.frequencia.totalAulas} aulas
                              </p>
                              {!aluno.frequencia.temFrequenciaMinima && (
                                <Badge variant="destructive" className="text-xs mt-1">
                                  Frequência insuficiente
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="20"
                              step="0.1"
                              value={notasForm[aluno.alunoId]?.valor || ''}
                              onChange={(e) => {
                                setNotasForm({
                                  ...notasForm,
                                  [aluno.alunoId]: {
                                    ...notasForm[aluno.alunoId],
                                    valor: e.target.value,
                                  },
                                });
                                // Limpar erro ao digitar
                                if (errors[aluno.alunoId]) {
                                  const newErrors = { ...errors };
                                  delete newErrors[aluno.alunoId];
                                  setErrors(newErrors);
                                }
                              }}
                              disabled={aluno.bloqueado}
                              className={errors[aluno.alunoId] ? 'border-destructive' : ''}
                              required
                            />
                            {errors[aluno.alunoId] && (
                              <p className="text-xs text-destructive mt-1">{errors[aluno.alunoId]}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={notasForm[aluno.alunoId]?.observacoes || ''}
                              onChange={(e) => {
                                setNotasForm({
                                  ...notasForm,
                                  [aluno.alunoId]: {
                                    ...notasForm[aluno.alunoId],
                                    observacoes: e.target.value,
                                  },
                                });
                              }}
                              placeholder="Observações..."
                              disabled={aluno.bloqueado}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNotasDialogOpen(false);
                    setSelectedAvaliacao(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Salvar Notas'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita e todas as notas associadas serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AnoLetivoAtivoGuard>
  );
};

