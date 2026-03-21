/**
 * Módulo Completo de Horários - DSICOLA
 * Integração: Ano Letivo, Turma, Plano de Ensino, Professor, Disciplina
 * RBAC: ADMIN, SECRETARIA (criar, editar, aprovar, excluir) | PROFESSOR (apenas visualizar próprios)
 * Semi-automático: sugestões inteligentes baseadas em planos sem horário
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { turmasApi, horariosApi, planoEnsinoApi, salasApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiErrors';
import { Plus, Clock, Loader2, Edit, Trash2, Calendar, Printer, CheckCircle, Sparkles, ListOrdered, AlertCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { parametrosSistemaApi } from '@/services/api';

// Backend: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
const DIAS_SEMANA_NUM = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_SEMANA_FORM = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

/** Converte dia selecionado no form (Segunda=0) para backend (1=Seg) */
const formIndexToBackendDia = (idx: number): number => (idx === 6 ? 0 : idx + 1);
/** Converte backend dia (1=Seg) para índice no form */
const backendDiaToFormIndex = (dia: number): number => (dia === 0 ? 6 : dia - 1);

/** Gera blocos fixos de horário com intervalo curto e longo (recreio) - manhã + tarde + noite */
function gerarBlocosPadrao(
  duracaoMin: number,
  intervaloMin: number = 15,
  intervaloLongo?: { minutos: number; aposBloco: number } | null
): Array<{ inicio: string; fim: string }> {
  const turnos: Array<{ hIni: number; hFim: number }> = [
    { hIni: 8, hFim: 12 },
    { hIni: 14, hFim: 18 },
    { hIni: 18, hFim: 22 },
  ];
  const result: Array<{ inicio: string; fim: string }> = [];
  for (const { hIni, hFim } of turnos) {
    let minutoAtual = hIni * 60;
    const fimMinutos = hFim * 60;
    let blocoCount = 0;
    while (minutoAtual + duracaoMin <= fimMinutos) {
      blocoCount++;
      const hI = Math.floor(minutoAtual / 60);
      const mI = minutoAtual % 60;
      const minutoFim = minutoAtual + duracaoMin;
      const hF = Math.floor(minutoFim / 60);
      const mF = minutoFim % 60;
      result.push({
        inicio: `${String(hI).padStart(2, '0')}:${String(mI).padStart(2, '0')}`,
        fim: `${String(hF).padStart(2, '0')}:${String(mF).padStart(2, '0')}`,
      });
      if (intervaloLongo && blocoCount === intervaloLongo.aposBloco) {
        minutoAtual += duracaoMin + intervaloLongo.minutos;
      } else {
        minutoAtual += duracaoMin + intervaloMin;
      }
    }
  }
  return result;
}

interface Turma {
  id: string;
  nome: string;
  ano: number;
  semestre?: number | string;
  turno?: string;
  curso_id?: string;
  curso?: { id: string; nome: string };
  cursos?: { id: string; nome: string };
}

interface PlanoEnsino {
  id: string;
  disciplinaId: string;
  professorId: string;
  estado?: string;
  bloqueado?: boolean;
  disciplina?: { nome: string };
  professor?: { user?: { nomeCompleto?: string } };
}

interface Horario {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  sala?: string;
  status?: string;
  planoEnsinoId?: string;
  disciplina?: { nome: string };
  professor?: { user?: { nomeCompleto?: string } };
  turma?: { nome: string };
}

export const HorariosTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { isSecundario } = useInstituicao();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();

  /** Secretaria altera horário → professor vê grade e registo de aula actualizados */
  const invalidateHorariosEmTodoSistema = () => {
    queryClient.invalidateQueries({ queryKey: ['turma-horarios'] });
    queryClient.invalidateQueries({ queryKey: ['horarios-dias-plano'] });
    queryClient.invalidateQueries({ queryKey: ['plano-ensino-resumo-horarios'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['horarios-sugestoes'] });
    queryClient.invalidateQueries({ queryKey: ['professor-grade-horarios'] });
    queryClient.invalidateQueries({ queryKey: ['professor-grade-frequencia'] });
  };

  const { data: parametros } = useQuery({
    queryKey: ['parametros-sistema', instituicaoId],
    queryFn: () => parametrosSistemaApi.get(),
    enabled: !!instituicaoId,
  });

  const { data: salas = [] } = useQuery({
    queryKey: ['salas', instituicaoId],
    queryFn: async () => {
      const r = await salasApi.getAll();
      return Array.isArray(r) ? r : [];
    },
    enabled: !!instituicaoId,
  });
  const duracaoMin = parametros?.duracaoHoraAulaMinutos ?? (isSecundario ? 45 : 60);
  const intervaloMin = parametros?.intervaloEntreDisciplinasMinutos ?? 15;
  const intervaloLongo = parametros?.intervaloLongoMinutos && parametros.intervaloLongoMinutos >= 15 && parametros.intervaloLongoMinutos <= 120
    ? { minutos: parametros.intervaloLongoMinutos, aposBloco: parametros.intervaloLongoAposBloco ?? 2 }
    : null;
  const blocosSecundario = isSecundario ? gerarBlocosPadrao(duracaoMin, intervaloMin, intervaloLongo) : [];
  const printRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [formData, setFormData] = useState({
    dia_semana: '',
    hora_inicio: '',
    hora_fim: '',
    plano_ensino_id: '',
    sala: ''
  });

  const labels = { turma: isSecundario ? 'Classe' : 'Turma' };

  const { data: turmas = [], isLoading: turmasLoading } = useQuery({
    queryKey: ['admin-turmas-horarios', instituicaoId],
    queryFn: async () => {
      const r = await turmasApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(r) ? r : (r?.data || []);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const selectedTurmaData = turmas.find((t: Turma) => t.id === selectedTurma);

  const { data: planosRaw = [], isLoading: planosLoading } = useQuery({
    queryKey: ['planos-por-turma', selectedTurma],
    queryFn: async () => {
      const r = await planoEnsinoApi.getAll({ turmaId: selectedTurma });
      return Array.isArray(r) ? r : [r];
    },
    enabled: !!selectedTurma,
  });

  const planos = Array.isArray(planosRaw) ? planosRaw : [planosRaw];

  /** Regra institucional: horário só para plano APROVADO e não bloqueado (alinhado ao backend e ao painel do professor) */
  const planosAprovadosTurma = useMemo(
    () => planos.filter((p: PlanoEnsino) => p.estado === 'APROVADO' && !p.bloqueado),
    [planos]
  );

  const planosOrdenadosManual = useMemo(
    () =>
      [...planosAprovadosTurma].sort((a: PlanoEnsino, b: PlanoEnsino) => {
        const na = a.disciplina?.nome ?? '';
        const nb = b.disciplina?.nome ?? '';
        return na.localeCompare(nb, 'pt');
      }),
    [planosAprovadosTurma]
  );

  const qtdPlanosSoPendentes =
    planos.length > 0 ? Math.max(0, planos.length - planosAprovadosTurma.length) : 0;

  const { data: horariosResponse, isLoading: horariosLoading } = useQuery({
    queryKey: ['turma-horarios', selectedTurma],
    queryFn: () => horariosApi.getAll({ turmaId: selectedTurma, page: 1, pageSize: 200 }),
    enabled: !!selectedTurma,
  });

  const horarios: Horario[] = Array.isArray(horariosResponse)
    ? horariosResponse
    : (horariosResponse?.data || []);

  const createHorarioMutation = useSafeMutation({
    mutationFn: async (data: { planoEnsinoId: string; turmaId: string; diaSemana: number; horaInicio: string; horaFim: string; sala?: string }) => {
      await horariosApi.create(data);
    },
    onSuccess: (_data, variables) => {
      invalidateHorariosEmTodoSistema();
      if (variables?.planoEnsinoId) {
        queryClient.invalidateQueries({ queryKey: ['horarios-dias-plano', variables.planoEnsinoId] });
      }
      toast.success('Horário adicionado com sucesso!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, 'Erro ao adicionar horário'));
    },
  });

  const updateHorarioMutation = useSafeMutation({
    mutationFn: async ({ id, planoEnsinoId: _planoId, ...data }: { id: string; planoEnsinoId?: string; diaSemana?: number; horaInicio?: string; horaFim?: string; sala?: string }) => {
      await horariosApi.update(id, data);
    },
    onSuccess: (_data, variables) => {
      invalidateHorariosEmTodoSistema();
      if ((variables as any)?.planoEnsinoId) {
        queryClient.invalidateQueries({ queryKey: ['horarios-dias-plano', (variables as any).planoEnsinoId] });
      }
      toast.success('Horário atualizado!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, 'Erro ao atualizar horário'));
    },
  });

  const deleteHorarioMutation = useSafeMutation({
    mutationFn: ({ id, planoEnsinoId }: { id: string; planoEnsinoId?: string }) => horariosApi.delete(id),
    onSuccess: (_data, variables) => {
      invalidateHorariosEmTodoSistema();
      if (variables?.planoEnsinoId) {
        queryClient.invalidateQueries({ queryKey: ['horarios-dias-plano', variables.planoEnsinoId] });
      }
      toast.success('Horário excluído');
    },
    onError: (error: Error) => {
      toast.error(getApiErrorMessage(error, 'Apenas horários em rascunho podem ser excluídos'));
    },
  });

  const aprovarMutation = useSafeMutation({
    mutationFn: (id: string) => horariosApi.aprovar(id),
    onSuccess: () => {
      invalidateHorariosEmTodoSistema();
      toast.success('Horário aprovado — passa a integrar o quadro oficial dos professores.');
    },
  });

  const resetForm = () => {
    setFormData({ dia_semana: '', hora_inicio: '', hora_fim: '', plano_ensino_id: '', sala: '' });
    setEditingHorario(null);
    setDialogOpen(false);
  };

  const prepararNovoHorario = () => {
    setFormData({ dia_semana: '', hora_inicio: '', hora_fim: '', plano_ensino_id: '', sala: '' });
    setEditingHorario(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dia_semana || !formData.hora_inicio || !formData.hora_fim) {
      toast.error('Preencha dia, hora início e hora fim');
      return;
    }
    if (!editingHorario && (!formData.plano_ensino_id || formData.plano_ensino_id === '_')) {
      toast.error('Selecione o Plano de Ensino (Disciplina - Professor)');
      return;
    }

    const idx = DIAS_SEMANA_FORM.indexOf(formData.dia_semana);
    const diaSemana = formIndexToBackendDia(idx >= 0 ? idx : 0);

    if (editingHorario) {
      updateHorarioMutation.mutate({
        id: editingHorario.id,
        planoEnsinoId: editingHorario.planoEnsinoId ?? (editingHorario as any).plano_ensino_id,
        diaSemana,
        horaInicio: formData.hora_inicio,
        horaFim: formData.hora_fim,
        sala: formData.sala || undefined,
      });
    } else {
      createHorarioMutation.mutate({
        planoEnsinoId: formData.plano_ensino_id,
        turmaId: selectedTurma,
        diaSemana,
        horaInicio: formData.hora_inicio,
        horaFim: formData.hora_fim,
        sala: formData.sala || undefined,
      });
    }
  };

  const handleEdit = (horario: Horario) => {
    const idx = backendDiaToFormIndex(horario.diaSemana ?? 1);
    setFormData({
      dia_semana: DIAS_SEMANA_FORM[idx] ?? 'Segunda-feira',
      hora_inicio: (horario.horaInicio || horario.hora_inicio || '').slice(0, 5),
      hora_fim: (horario.horaFim || horario.hora_fim || '').slice(0, 5),
      plano_ensino_id: '',
      sala: horario.sala || '',
    });
    setEditingHorario(horario);
    setDialogOpen(true);
  };

  const getDiaBadgeColor = (dia: string) => {
    const c: Record<string, string> = {
      'Segunda-feira': 'bg-blue-500', 'Terça-feira': 'bg-green-500', 'Quarta-feira': 'bg-yellow-500',
      'Quinta-feira': 'bg-purple-500', 'Sexta-feira': 'bg-pink-500', 'Sábado': 'bg-orange-500', 'Domingo': 'bg-red-500',
    };
    return c[dia] || 'bg-gray-500';
  };

  const horariosByDay = DIAS_SEMANA_NUM.reduce((acc, dia) => {
    acc[dia] = horarios.filter((h: Horario) => {
      const d = h.diaSemana ?? (h as any).dia_semana;
      const diaNum = typeof d === 'number' ? d : parseInt(String(d), 10);
      return DIAS_SEMANA_NUM[diaNum] === dia;
    });
    return acc;
  }, {} as Record<string, Horario[]>);

  const [loadingPrint, setLoadingPrint] = useState(false);
  const [sugestoesOpen, setSugestoesOpen] = useSafeDialog(false);
  const [turnoSugestao, setTurnoSugestao] = useState<'manha' | 'tarde' | 'noite'>('manha');
  const [sugestoesSelecionadas, setSugestoesSelecionadas] = useState<Set<number>>(new Set());

  const { data: sugestoes = [], isLoading: sugestoesLoading } = useQuery({
    queryKey: ['horarios-sugestoes', selectedTurma, turnoSugestao],
    queryFn: () => horariosApi.getSugestoes(selectedTurma, turnoSugestao),
    enabled: !!selectedTurma && sugestoesOpen,
  });

  const mapSugestoesToBulk = (lista: typeof sugestoes) =>
    lista.map((s) => ({
      planoEnsinoId: s.planoEnsinoId,
      turmaId: s.turmaId,
      diaSemana: s.diaSemana,
      horaInicio: s.horaInicio,
      horaFim: s.horaFim,
      sala: s.sala,
    }));

  const aplicarSugestoesMutation = useSafeMutation({
    mutationFn: async (itens: typeof sugestoes) => {
      const horarios = itens
        .filter((_, i) => sugestoesSelecionadas.has(i))
        .map((s) => ({ planoEnsinoId: s.planoEnsinoId, turmaId: s.turmaId, diaSemana: s.diaSemana, horaInicio: s.horaInicio, horaFim: s.horaFim, sala: s.sala }));
      if (horarios.length === 0) throw new Error('Selecione pelo menos um horário');
      return horariosApi.createBulk(horarios);
    },
    onSuccess: (data) => {
      invalidateHorariosEmTodoSistema();
      toast.success(`${data.criados} horário(s) adicionado(s) com sucesso!`);
      if ((data as any).erros > 0) {
        toast.warning(`${(data as any).erros} horário(s) não puderam ser criados (conflito)`);
      }
      setSugestoesOpen(false);
      setSugestoesSelecionadas(new Set());
    },
    onError: (e: Error) => toast.error(getApiErrorMessage(e, 'Erro ao aplicar sugestões')),
  });

  const aplicarTodasSugestoesMutation = useSafeMutation({
    mutationFn: async (itens: typeof sugestoes) => {
      const horarios = mapSugestoesToBulk(itens);
      if (horarios.length === 0) throw new Error('Nenhuma sugestão disponível');
      return horariosApi.createBulk(horarios);
    },
    onSuccess: (data) => {
      invalidateHorariosEmTodoSistema();
      toast.success(`${data.criados} horário(s) criados de uma vez — alinhados aos planos desta turma.`);
      if ((data as any).erros > 0) {
        toast.warning(`${(data as any).erros} bloco(s) não foram criados (conflito de professor, turma ou sala).`);
      }
      setSugestoesOpen(false);
      setSugestoesSelecionadas(new Set());
    },
    onError: (e: Error) => toast.error(getApiErrorMessage(e, 'Erro ao aplicar todas as sugestões')),
  });

  useEffect(() => {
    if (!sugestoesOpen || sugestoesLoading) return;
    if (sugestoes.length === 0) {
      setSugestoesSelecionadas(new Set());
      return;
    }
    setSugestoesSelecionadas(new Set(sugestoes.map((_, i) => i)));
  }, [sugestoesOpen, sugestoesLoading, sugestoes]);

  const handlePrint = async () => {
    if (!selectedTurma) return;
    setLoadingPrint(true);
    try {
      const blob = await horariosApi.imprimirTurma(selectedTurma);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank');
      toast.success('Horário aberto em nova aba');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Erro ao imprimir horário'));
    } finally {
      setLoadingPrint(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Selecione a {labels.turma}
          </CardTitle>
          <CardDescription>
            {labels.turma} = grupo de alunos. Escolha para qual turma está montando o horário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {turmasLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : turmas.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma {labels.turma.toLowerCase()} cadastrada.</p>
          ) : (
            <Select value={selectedTurma} onValueChange={setSelectedTurma}>
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Selecione uma opção..." />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((turma: Turma) => (
                  <SelectItem key={turma.id} value={turma.id}>
                    {turma.nome} - {turma.curso?.nome ?? turma.cursos?.nome ?? '-'} ({isSecundario ? turma.ano : `${turma.semestre ?? '-'}/${turma.ano}`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedTurma && (
        <Card>
          <CardHeader className="space-y-4">
            <Alert className="border-primary/25 bg-muted/50 text-left">
              <ListOrdered className="h-4 w-4 text-primary" />
              <AlertTitle className="text-base">Fluxo em poucos cliques</AlertTitle>
              <AlertDescription className="text-sm text-muted-foreground space-y-2">
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>
                    Só entram planos <strong className="text-foreground">APROVADOS</strong> e{' '}
                    <strong className="text-foreground">não bloqueados</strong> (mesma regra do registo de aulas e do quadro
                    oficial do professor).
                  </li>
                  <li>
                    Os horários nascem de um <strong className="text-foreground">Plano de Ensino</strong> da turma (disciplina
                    + professor já no plano).
                  </li>
                  <li>
                    <strong className="text-foreground">Gerar sugestões</strong>: blocos em falta para planos aprovados; por
                    defeito todas as linhas vêm seleccionadas — «Aplicar todas» ou «Aplicar N seleccionada(s)».
                  </li>
                  <li>
                    <strong className="text-foreground">Adicionar horário</strong>: um único bloco (dia, hora, plano, sala).
                  </li>
                  <li>
                    <strong className="text-foreground">Aprovar</strong> cada linha em rascunho para o quadro ser{' '}
                    <strong className="text-foreground">oficial</strong> no painel do professor e nas sugestões de registo de
                    aula.
                  </li>
                </ol>
              </AlertDescription>
            </Alert>
            {!planosLoading && planos.length > 0 && planosAprovadosTurma.length === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Nenhum plano aprovado nesta turma</AlertTitle>
                <AlertDescription className="text-sm">
                  Existem {planos.length} plano(s) vinculado(s), mas nenhum está em estado <strong>APROVADO</strong> ou há
                  planos bloqueados. Aprove os planos em <strong>Configuração de Ensino</strong> (Plano de Ensino) para
                  habilitar «Gerar sugestões» e «Adicionar horário».
                </AlertDescription>
              </Alert>
            )}
            {!planosLoading && qtdPlanosSoPendentes > 0 && planosAprovadosTurma.length > 0 && (
              <Alert className="border-blue-200 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-900">
                <Info className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <AlertTitle className="text-blue-950 dark:text-blue-100">Planos ainda não aprovados</AlertTitle>
                <AlertDescription className="text-sm text-blue-900/90 dark:text-blue-200/90">
                  {qtdPlanosSoPendentes} plano(s) em rascunho, revisão ou outro estado <strong>não aparecem</strong> aqui nem
                  nas sugestões — só após <strong>APROVAÇÃO</strong>, alinhado ao resto do sistema.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Grade Horária
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-x-2">
                  Quadro da turma. Novos blocos usam apenas planos <strong>APROVADOS</strong> e não bloqueados. Cada aula pode
                  ter sala distinta.
                  <Link
                    to="/admin-dashboard/configuracoes?tab=horarios"
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    Configurar intervalos
                  </Link>
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {horarios.length > 0 && (
                  <Button variant="outline" onClick={handlePrint} disabled={loadingPrint}>
                    {loadingPrint ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                    Imprimir Horário
                  </Button>
                )}
                <TooltipProvider>
                  <Dialog open={sugestoesOpen} onOpenChange={setSugestoesOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block">
                          <Button
                            variant="outline"
                            type="button"
                            disabled={!planosLoading && planosAprovadosTurma.length === 0}
                            onClick={() => {
                              setSugestoesSelecionadas(new Set());
                              setSugestoesOpen(true);
                            }}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Gerar Sugestões
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {planosAprovadosTurma.length === 0 && !planosLoading ? (
                          <p>
                            É necessário pelo menos um Plano de Ensino <strong>APROVADO</strong> e não bloqueado nesta turma.
                          </p>
                        ) : (
                          <p>Sugestões para planos aprovados que ainda não têm horário na turma.</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-amber-500" />
                          Sugestões Automáticas de Horários
                        </DialogTitle>
                        <CardDescription>
                          Apenas planos <strong>APROVADOS</strong> e não bloqueados, sem bloco ainda nesta turma. Blocos de{' '}
                          {duracaoMin} min. Por defeito todas as linhas vêm seleccionadas. O sistema evita conflitos de
                          professor, turma e sala.
                        </CardDescription>
                      </DialogHeader>
                      <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Turno:</Label>
                          <Select value={turnoSugestao} onValueChange={(v: 'manha' | 'tarde' | 'noite') => setTurnoSugestao(v)}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manha">Manhã (08h-12h)</SelectItem>
                              <SelectItem value="tarde">Tarde (14h-18h)</SelectItem>
                              <SelectItem value="noite">Noite (18h-22h)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="border rounded-lg overflow-auto flex-1 min-h-0">
                          {sugestoesLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                          ) : sugestoes.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground space-y-2 px-4">
                              <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p className="font-medium text-foreground">Nada a sugerir neste momento</p>
                              <p className="text-sm">
                                Isto ocorre quando todos os planos <strong>APROVADOS</strong> da turma já têm horário, ou quando
                                não há planos aprovados e não bloqueados. Aprove planos em Configuração de Ensino ou escolha
                                outro turno.
                              </p>
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-10">
                                    <Checkbox
                                      checked={sugestoes.length > 0 && sugestoesSelecionadas.size === sugestoes.length}
                                      onCheckedChange={(c) =>
                                        setSugestoesSelecionadas(c ? new Set(sugestoes.map((_, i) => i)) : new Set())
                                      }
                                    />
                                  </TableHead>
                                  <TableHead>Disciplina</TableHead>
                                  <TableHead>Professor</TableHead>
                                  <TableHead>Dia</TableHead>
                                  <TableHead>Horário</TableHead>
                                  <TableHead>Sala de aula</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sugestoes.map((s, i) => (
                                  <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                                    const next = new Set(sugestoesSelecionadas);
                                    if (next.has(i)) next.delete(i); else next.add(i);
                                    setSugestoesSelecionadas(next);
                                  }}>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                      <Checkbox checked={sugestoesSelecionadas.has(i)} onCheckedChange={(c) => {
                                        const next = new Set(sugestoesSelecionadas);
                                        if (c) next.add(i); else next.delete(i);
                                        setSugestoesSelecionadas(next);
                                      }} />
                                    </TableCell>
                                    <TableCell>{s.disciplinaNome || '-'}</TableCell>
                                    <TableCell>{s.professorNome || '-'}</TableCell>
                                    <TableCell>{DIAS_SEMANA_NUM[s.diaSemana] || '-'}</TableCell>
                                    <TableCell>{s.horaInicio} - {s.horaFim}</TableCell>
                                    <TableCell>{s.sala || '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-2 border-t">
                          <span className="text-sm text-muted-foreground">
                            {sugestoesSelecionadas.size} de {sugestoes.length} seleccionados
                          </span>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" onClick={() => setSugestoesOpen(false)}>
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => aplicarTodasSugestoesMutation.mutate(sugestoes)}
                              disabled={
                                sugestoes.length === 0 ||
                                aplicarTodasSugestoesMutation.isPending ||
                                aplicarSugestoesMutation.isPending ||
                                sugestoesLoading
                              }
                            >
                              {aplicarTodasSugestoesMutation.isPending && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              )}
                              Aplicar todas ({sugestoes.length})
                            </Button>
                            <Button
                              type="button"
                              onClick={() => aplicarSugestoesMutation.mutate(sugestoes)}
                              disabled={
                                sugestoesSelecionadas.size === 0 ||
                                aplicarSugestoesMutation.isPending ||
                                aplicarTodasSugestoesMutation.isPending
                              }
                            >
                              {aplicarSugestoesMutation.isPending && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              )}
                              Aplicar {sugestoesSelecionadas.size} seleccionada(s)
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </TooltipProvider>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            onClick={prepararNovoHorario}
                            disabled={!planosLoading && planosOrdenadosManual.length === 0}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Horário
                          </Button>
                        </DialogTrigger>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {planosOrdenadosManual.length === 0 && !planosLoading ? (
                        <p>
                          Precisa de pelo menos um plano <strong>APROVADO</strong> e não bloqueado para criar um bloco manual.
                        </p>
                      ) : (
                        <p>Adiciona um único bloco (dia, horas, disciplina/professor via plano, sala).</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingHorario ? 'Editar Horário' : 'Adicionar Horário'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Dia da Semana *</Label>
                        <Select value={formData.dia_semana} onValueChange={(v) => setFormData((p) => ({ ...p, dia_semana: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione o dia" /></SelectTrigger>
                          <SelectContent>
                            {DIAS_SEMANA_FORM.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {isSecundario && blocosSecundario.length > 0 ? (
                          <div className="space-y-2 col-span-2">
                            <Label>Bloco de Horário * <span className="text-muted-foreground text-xs">(blocos fixos de {duracaoMin} min)</span></Label>
                            <Select
                              value={formData.hora_inicio && formData.hora_fim ? `${formData.hora_inicio}-${formData.hora_fim}` : ''}
                              onValueChange={(v) => {
                                const [inicio, fim] = v.split('-');
                                if (inicio && fim) setFormData((p) => ({ ...p, hora_inicio: inicio, hora_fim: fim }));
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione o bloco" /></SelectTrigger>
                              <SelectContent>
                                {(() => {
                                  const blocosSet = new Set(blocosSecundario.map((b) => `${b.inicio}-${b.fim}`));
                                  const atual = formData.hora_inicio && formData.hora_fim ? `${formData.hora_inicio}-${formData.hora_fim}` : '';
                                  const lista = [...blocosSecundario];
                                  if (editingHorario && atual && !blocosSet.has(atual)) {
                                    lista.unshift({ inicio: formData.hora_inicio!, fim: formData.hora_fim! });
                                  }
                                  return lista.map((b) => (
                                    <SelectItem key={`${b.inicio}-${b.fim}`} value={`${b.inicio}-${b.fim}`}>
                                      {b.inicio} - {b.fim}
                                    </SelectItem>
                                  ));
                                })()}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <Label>Hora Início *</Label>
                              <Input type="time" value={formData.hora_inicio} onChange={(e) => setFormData((p) => ({ ...p, hora_inicio: e.target.value }))} required />
                            </div>
                            <div className="space-y-2">
                              <Label>Hora Fim *</Label>
                              <Input type="time" value={formData.hora_fim} onChange={(e) => setFormData((p) => ({ ...p, hora_fim: e.target.value }))} required />
                            </div>
                          </>
                        )}
                      </div>
                      {!editingHorario && (
                        <div className="space-y-2">
                          <Label>Plano de Ensino (Disciplina - Professor) *</Label>
                          <Select value={formData.plano_ensino_id} onValueChange={(v) => setFormData((p) => ({ ...p, plano_ensino_id: v }))}>
                            <SelectTrigger><SelectValue placeholder="Selecione disciplina e professor" /></SelectTrigger>
                            <SelectContent>
                              {planosLoading ? (
                                <SelectItem value="_">Carregando...</SelectItem>
                              ) : planosOrdenadosManual.length === 0 ? (
                                <SelectItem value="_" disabled>
                                  {planos.length === 0
                                    ? 'Nenhum plano vinculado a esta turma'
                                    : 'Nenhum plano APROVADO — aprove em Configuração de Ensino'}
                                </SelectItem>
                              ) : (
                                planosOrdenadosManual.map((plano: PlanoEnsino) => (
                                  <SelectItem key={plano.id} value={plano.id}>
                                    {plano.disciplina?.nome ?? 'Disciplina'} — {plano.professor?.user?.nomeCompleto ?? 'Professor'}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          {planosOrdenadosManual.length === 0 && !planosLoading && (
                            <p className="text-xs text-muted-foreground">
                              {planos.length === 0 ? (
                                <>
                                  Crie planos em Configuração de Ensino e associe esta turma. Só planos{' '}
                                  <strong>APROVADOS</strong> e não bloqueados entram no quadro.
                                </>
                              ) : (
                                <>
                                  Esta turma tem {planos.length} plano(s), mas nenhum está <strong>APROVADO</strong> (ou
                                  estão bloqueados). Aprove em Configuração de Ensino para desbloquear horários.
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Sala de aula</Label>
                        <p className="text-xs text-muted-foreground">Espaço físico onde esta aula será ministrada</p>
                        <Select
                          value={formData.sala || '_none'}
                          onValueChange={(v) => setFormData((p) => ({ ...p, sala: v === '_none' ? '' : v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a sala de aula" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Não informada</SelectItem>
                            {salas.map((s: { id: string; nome: string }) => (
                              <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                            ))}
                            {editingHorario && formData.sala && !salas.some((s: { nome: string }) => s.nome === formData.sala) && (
                              <SelectItem value={formData.sala}>{formData.sala} (atual)</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {salas.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            <Link to="/admin-dashboard/gestao-academica?tab=salas" className="text-primary hover:underline">
                              Cadastre salas de aula
                            </Link>
                            {' '}em Gestão Acadêmica → Salas para selecionar.
                          </p>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                        <Button type="submit" disabled={createHorarioMutation.isPending || updateHorarioMutation.isPending}>
                          {(createHorarioMutation.isPending || updateHorarioMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          {editingHorario ? 'Atualizar' : 'Adicionar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {horariosLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : horarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground space-y-4">
                <Clock className="h-12 w-12 mx-auto opacity-50" />
                <p>Nenhum horário cadastrado para esta turma.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="default"
                    disabled={!planosLoading && planosAprovadosTurma.length === 0}
                    onClick={() => {
                      setSugestoesSelecionadas(new Set());
                      setSugestoesOpen(true);
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar sugestões (rápido)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!planosLoading && planosOrdenadosManual.length === 0}
                    onClick={() => {
                      prepararNovoHorario();
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar um horário
                  </Button>
                </div>
                <p className="text-xs max-w-md mx-auto">
                  Com planos <strong>aprovados</strong> na turma, «Gerar sugestões» preenche o que falta; depois{' '}
                  <strong>aprove</strong> cada bloco para o quadro oficial do professor.
                </p>
              </div>
            ) : (
              <div className="space-y-4" ref={printRef}>
                {DIAS_SEMANA_NUM.map((dia) => {
                  const diaHorarios = horariosByDay[dia] || [];
                  if (diaHorarios.length === 0) return null;
                  return (
                    <div key={dia} className="space-y-2">
                      <Badge className={getDiaBadgeColor(dia)}>{dia}</Badge>
                      <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Horário</TableHead>
                                <TableHead>Disciplina</TableHead>
                                <TableHead>Professor</TableHead>
                                <TableHead>Sala de aula</TableHead>
                                <TableHead>Status</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[...diaHorarios].sort((a, b) => (a.horaInicio || a.hora_inicio || '').localeCompare(b.horaInicio || b.hora_fim || '')).map((h: Horario) => (
                              <TableRow key={h.id}>
                                <TableCell>{(h.horaInicio || (h as any).hora_inicio || '').slice(0, 5)} - {(h.horaFim || (h as any).hora_fim || '').slice(0, 5)}</TableCell>
                                <TableCell>{h.disciplina?.nome || (h as any).disciplinas?.nome || '-'}</TableCell>
                                <TableCell>{h.professor?.user?.nomeCompleto || '-'}</TableCell>
                                <TableCell>{h.sala || '-'}</TableCell>
                                <TableCell>
                                  {h.status === 'APROVADO' ? (
                                    <Badge variant="default" className="bg-green-600">Aprovado</Badge>
                                  ) : h.status === 'INATIVO' ? (
                                    <Badge variant="secondary">Inativo</Badge>
                                  ) : (
                                    <Badge variant="outline">Rascunho</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    {h.status === 'RASCUNHO' && (
                                      <Button variant="ghost" size="icon" onClick={() => aprovarMutation.mutate(h.id)} disabled={aprovarMutation.isPending} title="Aprovar">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(h)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={h.status !== 'RASCUNHO'} title={h.status !== 'RASCUNHO' ? 'Apenas rascunhos podem ser excluídos' : 'Excluir'}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir horário?</AlertDialogTitle>
                                          <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteHorarioMutation.mutate({ id: h.id, planoEnsinoId: (h as Horario).planoEnsinoId ?? (h as any).plano_ensino_id })}>Excluir</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
