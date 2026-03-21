import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Plus, CalendarCheck, Loader2, Save, AlertCircle, BookOpen, CheckCircle2, CircleDot, Clock, CalendarDays } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { turmasApi, notasApi, aulasLancadasApi, presencasApi, planoEnsinoApi, horariosApi } from '@/services/api';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Data local YYYY-MM-DD (evita desvio UTC em inputs type="date") */
function localDateYMD(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function weekdayFromYMD(ymd: string): number {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date().getDay();
  const [y, mo, d] = parts;
  return new Date(y, mo - 1, d).getDay();
}

function toTimeInput(s: string | undefined | null): string {
  if (!s) return '';
  const t = String(s).trim();
  return t.length >= 5 ? t.slice(0, 5) : t;
}

/** Prioridade: hoje se estiver na distribuição; senão primeira data ≥ hoje; senão última planejada */
function pickDateFromDistribuicao(dates: string[]): string {
  const today = localDateYMD();
  if (!dates?.length) return today;
  if (dates.includes(today)) return today;
  const future = dates.find((d) => d >= today);
  if (future) return future;
  return dates[dates.length - 1];
}

const DIAS_CURTOS: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

export default function GestaoFrequencia() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const professorId = (user as any)?.professorId as string | undefined;
  const { isSecundario } = useInstituicao();
  const { anoLetivo, anoLetivoId, hasAnoLetivoAtivo } = useAnoLetivoAtivo();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>('');
  const [selectedAulaLancada, setSelectedAulaLancada] = useState<string>('');
  const [selectedPlanoAulaId, setSelectedPlanoAulaId] = useState<string>('');
  const [novaAulaData, setNovaAulaData] = useState('');
  const [novaAulaHoraInicio, setNovaAulaHoraInicio] = useState('');
  const [novaAulaHoraFim, setNovaAulaHoraFim] = useState('');
  const [novaAulaConteudo, setNovaAulaConteudo] = useState('');
  const [novaAulaObservacoes, setNovaAulaObservacoes] = useState('');
  const [presencas, setPresencas] = useState<Record<string, { status: 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO'; observacoes?: string }>>({});

  // REGRA 1: Buscar turmas vinculadas ao professor via plano ativo
  // REGRA ABSOLUTA: Usar GET /turmas/professor SEM enviar professorId, instituicaoId ou anoLetivoId
  // O backend extrai professorId, instituicaoId e tipoAcademico automaticamente do JWT (req.user)
  // IMPORTANTE: Buscar turmas SEMPRE (independente de ano letivo ativo) para o professor ver suas atribuições
  // O ano letivo ativo controla apenas as AÇÕES (disabled no select), não a visibilidade dos dados
  const { data: turmasData, isLoading: turmasLoading } = useQuery({
    queryKey: ['professor-turmas-frequencia', user?.id, anoLetivoId],
    queryFn: async () => {
      if (!user?.id) {
        return { anoLetivo: null, turmas: [], disciplinasSemTurma: [] };
      }
      
      // REGRA ABSOLUTA: NÃO enviar professorId - o backend extrai do JWT
      const params: { incluirPendentes?: boolean; anoLetivoId?: string } = {
        incluirPendentes: true
      };
      if (anoLetivoId) {
        params.anoLetivoId = anoLetivoId;
      }
      
      const data = await turmasApi.getTurmasProfessor(params);
      
      // Backend retorna formato padronizado { anoLetivo, turmas: [], disciplinasSemTurma: [] }
      return data || { anoLetivo: null, turmas: [], disciplinasSemTurma: [] };
    },
    enabled: !!user?.id
  });

  // Filtrar apenas turmas (excluir disciplinas sem turma)
  // REGRA: Ações pedagógicas (aulas, presenças) só podem ser executadas com turmas vinculadas
  // REGRA ABSOLUTA: Backend já retorna turmas e disciplinasSemTurma separados
  // Deduplicar por turmaId (backend retorna turma+disciplina; mesma turma pode vir várias vezes)
  const turmas = useMemo(() => {
    if (!turmasData?.turmas) return [];
    const seen = new Set<string>();
    return (turmasData.turmas || []).filter((t: any) => {
      const id = t.turmaId || t.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [turmasData]);

  // Buscar planos de ensino do professor para a turma selecionada
  // NÃO enviar professorId - o backend resolve automaticamente via middleware resolveProfessor
  // REGRA ABSOLUTA: Plano de Ensino SEMPRE aparece no painel do professor
  // Estado controla AÇÃO, NÃO visibilidade
  // RASCUNHO / EM_REVISAO aparecem (bloqueados)
  // APROVADO aparece (ativo)
  // ENCERRADO aparece (somente leitura)
  // Nunca filtrar planos por estado na query
  const { data: planosEnsino = [] } = useQuery({
    queryKey: ['professor-planos-ensino-turma', user?.id, selectedTurma, anoLetivoId],
    queryFn: async () => {
      if (!selectedTurma || !user?.id) return [];
      try {
        const params: any = { turmaId: selectedTurma };
        // professorId removido - backend resolve automaticamente do JWT
        if (anoLetivoId) {
          params.anoLetivoId = anoLetivoId;
        }
        const data = await planoEnsinoApi.getAll(params);
        // REGRA ABSOLUTA: Filtrar apenas por turmaId - NUNCA filtrar por estado
        // Todos os planos aparecem, independente do estado (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)
        // O estado controla apenas as ações (podeRegistrarAula, podeLancarNota), não a visibilidade
        return (data || []).filter((plano: any) => 
          plano.turmaId === selectedTurma
        );
      } catch (error) {
        console.error('Erro ao buscar planos de ensino:', error);
        return [];
      }
    },
    enabled: !!selectedTurma && !!user?.id && hasAnoLetivoAtivo
  });

  // REGRA 2: Disciplinas do plano (todas aparecem; estado controla ação)
  // RASCUNHO/EM_REVISAO aparecem mas ficam bloqueadas para lançar
  const disciplinasDoPlano = useMemo(() => {
    if (planosEnsino.length === 0) return [];
    return planosEnsino.map((plano: any) => ({
      id: plano.disciplinaId || plano.disciplina?.id,
      nome: plano.disciplina?.nome || 'Disciplina',
      planoEnsinoId: plano.id,
      planoAtivo: plano.estado === 'APROVADO' && !plano.bloqueado,
      motivoBloqueio: !plano.estado || plano.estado !== 'APROVADO'
        ? (plano.estado === 'RASCUNHO' ? 'Plano em RASCUNHO - aguardando aprovação' : plano.estado === 'EM_REVISAO' ? 'Plano em REVISÃO - aguardando aprovação' : plano.estado === 'ENCERRADO' ? 'Plano ENCERRADO' : plano.bloqueado ? 'Plano bloqueado' : 'Plano não ativo')
        : null
    }));
  }, [planosEnsino]);

  const planoEnsinoAtual = useMemo(
    () => planosEnsino.find((p: any) => (p.disciplinaId || p.disciplina?.id) === selectedDisciplina),
    [planosEnsino, selectedDisciplina]
  );

  const { data: gradeProfessorData } = useQuery({
    queryKey: ['professor-grade-frequencia', professorId, user?.id],
    queryFn: async () => horariosApi.getGradeProfessor(professorId!),
    enabled: !!professorId && !!user?.id,
    retry: (failureCount, err: any) => {
      if ([400, 401, 403, 404].includes(err?.response?.status ?? 0)) return false;
      return failureCount < 2;
    },
  });

  /** Horários da instituição para esta turma/disciplina (e plano, quando o registo o tiver) — sem INATIVO */
  const horariosContexto = useMemo(() => {
    const list = gradeProfessorData?.horarios;
    if (!Array.isArray(list) || !selectedTurma || !selectedDisciplina) return [];
    const planoId = planoEnsinoAtual?.id as string | undefined;
    return list.filter((h: any) => {
      if (h.status === 'INATIVO') return false;
      if (h.turmaId !== selectedTurma) return false;
      const hid = h.disciplinaId;
      if (hid && hid !== selectedDisciplina) return false;
      if (!hid && planoId && h.planoEnsinoId && h.planoEnsinoId !== planoId) return false;
      return true;
    });
  }, [gradeProfessorData?.horarios, selectedTurma, selectedDisciplina, planoEnsinoAtual?.id]);

  /** Regra institucional: só horário APROVADO entra em sugestões automáticas e chips (quadro oficial) */
  const horariosQuadroOficial = useMemo(
    () => horariosContexto.filter((h: any) => h.status === 'APROVADO'),
    [horariosContexto]
  );
  const horariosProvisoriosContexto = useMemo(
    () => horariosContexto.filter((h: any) => h.status === 'RASCUNHO'),
    [horariosContexto]
  );

  const slotsParaData = useCallback(
    (ymd: string) => {
      if (!ymd) return [];
      const wd = weekdayFromYMD(ymd);
      return [...horariosQuadroOficial]
        .filter((h: any) => Number(h.diaSemana) === wd)
        .sort((a: any, b: any) => String(a.horaInicio || '').localeCompare(String(b.horaInicio || '')));
    },
    [horariosQuadroOficial]
  );

  // Buscar aulas planejadas do plano de ensino selecionado
  const { data: aulasPlanejadas = [] } = useQuery({
    queryKey: ['aulas-planejadas', selectedDisciplina, user?.id, anoLetivo, selectedTurma],
    queryFn: async () => {
      if (!selectedDisciplina || !user?.id || !anoLetivo) return [];
      
      const plano = planosEnsino.find((p: any) => 
        (p.disciplinaId || p.disciplina?.id) === selectedDisciplina
      );
      
      if (!plano) return [];
      
      try {
        const data = await aulasLancadasApi.getAulasPlanejadas({
          disciplinaId: selectedDisciplina,
          // professorId removido - backend resolve automaticamente do JWT
          anoLetivo: Number(anoLetivo),
          turmaId: selectedTurma
        });
        return data || [];
      } catch (error) {
        console.error('Erro ao buscar aulas planejadas:', error);
        return [];
      }
    },
    enabled: !!selectedDisciplina && !!user?.id && !!anoLetivo && !!selectedTurma && hasAnoLetivoAtivo
  });

  const aulaPlanejadaSelecionada = useMemo(
    () => aulasPlanejadas.find((a: any) => a.id === selectedPlanoAulaId),
    [aulasPlanejadas, selectedPlanoAulaId]
  );

  const handleRegistroDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      setSelectedPlanoAulaId('');
      setNovaAulaData(localDateYMD());
      setNovaAulaHoraInicio('');
      setNovaAulaHoraFim('');
      setNovaAulaConteudo('');
      setNovaAulaObservacoes('');
    }
  };

  /** Ao mudar a data (ou ao abrir o diálogo), alinhar horas ao 1.º bloco do quadro para esse dia da semana */
  useEffect(() => {
    if (!dialogOpen || !novaAulaData) return;
    const slots = slotsParaData(novaAulaData);
    if (slots.length === 0) {
      setNovaAulaHoraInicio('');
      setNovaAulaHoraFim('');
      return;
    }
    setNovaAulaHoraInicio(toTimeInput(slots[0].horaInicio));
    setNovaAulaHoraFim(toTimeInput(slots[0].horaFim));
  }, [dialogOpen, novaAulaData, slotsParaData]);

  // Buscar aulas lançadas (registradas) para a disciplina e turma selecionadas
  const { data: aulasLancadas = [] } = useQuery({
    queryKey: ['aulas-lancadas-frequencia', selectedDisciplina, selectedTurma, anoLetivo],
    queryFn: async () => {
      if (!selectedDisciplina || !selectedTurma || !anoLetivo) return [];
      
      try {
        const data = await aulasLancadasApi.getAll({
          disciplinaId: selectedDisciplina,
          turmaId: selectedTurma,
          anoLetivo: Number(anoLetivo)
        });
        return (data || []).sort((a: any, b: any) => 
          new Date(b.data).getTime() - new Date(a.data).getTime()
        );
      } catch (error) {
        console.error('Erro ao buscar aulas lançadas:', error);
        return [];
      }
    },
    enabled: !!selectedDisciplina && !!selectedTurma && !!anoLetivo && hasAnoLetivoAtivo
  });

  // Lista de alunos da turma: mesma fonte que Pautas/Notas (GET /notas/turma/alunos — matrículas ativas no Prisma)
  const { data: matriculas = [] } = useQuery({
    queryKey: ['turma-alunos-frequencia', selectedTurma],
    queryFn: async () => {
      if (!selectedTurma) return [];
      try {
        const res = await notasApi.getAlunosNotasByTurma(selectedTurma);
        const alunos = Array.isArray(res?.alunos) ? res.alunos : [];
        return alunos.map((a: any) => ({
          id: a.matricula_id,
          alunoId: a.aluno_id,
          status: 'Ativa',
          aluno: {
            id: a.aluno_id,
            nomeCompleto: a.nome_completo ?? '—',
          },
        }));
      } catch (error) {
        console.error('Erro ao buscar alunos da turma:', error);
        return [];
      }
    },
    enabled: !!selectedTurma,
    retry: 2,
  });

  // Limpar estado quando aula lançada muda
  useEffect(() => {
    setPresencas({});
    if (selectedAulaLancada) {
      queryClient.removeQueries({ 
        queryKey: ['presencas-aula'],
        exact: false 
      });
    }
  }, [selectedAulaLancada, queryClient]);

  // Buscar presenças da aula lançada selecionada
  const { data: presencasData = [], isLoading: presencasLoading } = useQuery({
    queryKey: ['presencas-aula', selectedAulaLancada],
    queryFn: async () => {
      if (!selectedAulaLancada) return [];
      
      try {
        const response = await presencasApi.getByAula(selectedAulaLancada);
        
        // O endpoint retorna { hasStudents, aulaLancada, presencas: [...] }
        const presencasArray = response?.presencas || (Array.isArray(response) ? response : []);
        
        // Mapear presenças para o formato esperado
        const presencasMap: Record<string, { status: 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO'; observacoes?: string }> = {};
        
        presencasArray.forEach((p: any) => {
          const alunoId = p.alunoId || p.aluno_id;
          
          if (alunoId) {
            presencasMap[alunoId] = {
              status: (p.status || 'PRESENTE') as 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO',
              observacoes: p.observacoes || ''
            };
          }
        });
        
        setPresencas(presencasMap);
        return presencasArray;
      } catch (error) {
        console.error('Erro ao buscar presenças:', error);
        return [];
      }
    },
    enabled: !!selectedAulaLancada,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true
  });

  // Inicializar presenças para alunos sem registro
  useEffect(() => {
    if (!selectedAulaLancada || presencasLoading || !presencasData || matriculas.length === 0) {
      return;
    }
    
    const timer = setTimeout(() => {
      setPresencas(prev => {
        const newPresencas = { ...prev };
        let hasChanges = false;
        
        matriculas.forEach((m: any) => {
          const alunoId = m.aluno?.id || m.alunoId || m.aluno_id;
          if (!alunoId) return;
          
          if (!newPresencas[alunoId]) {
            newPresencas[alunoId] = { status: 'PRESENTE' };
            hasChanges = true;
          }
        });
        
        return hasChanges ? newPresencas : prev;
      });
    }, 150);
    
    return () => clearTimeout(timer);
  }, [selectedAulaLancada, matriculas, presencasLoading, presencasData]);

  // Mutation para criar aula lançada
  const createAulaLancadaMutation = useMutation({
    mutationFn: async (data: any) => {
      return await aulasLancadasApi.create(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['aulas-lancadas-frequencia'] });
      queryClient.invalidateQueries({ queryKey: ['aulas-planejadas'] });
      toast.success('Aula registrada com sucesso!');
      handleRegistroDialogChange(false);
      setSelectedAulaLancada(data.id);
      setNovaAulaData('');
      setNovaAulaHoraInicio('');
      setNovaAulaHoraFim('');
      setNovaAulaConteudo('');
      setNovaAulaObservacoes('');
      setSelectedPlanoAulaId('');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro desconhecido';
      const isFaltaProfessor =
        error?.response?.status === 403 &&
        typeof errorMessage === 'string' &&
        (errorMessage.toLowerCase().includes('falta registrada') ||
          errorMessage.toLowerCase().includes('professor neste dia'));

      if (isFaltaProfessor) {
        toast.error(
          'Registro bloqueado: existe uma falta registrada para você neste dia. Contacte a coordenação se a falta estiver incorreta.'
        );
      } else {
        toast.error('Erro ao registrar aula: ' + errorMessage);
      }
    }
  });

  // Mutation para salvar presenças
  const savePresencasMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAulaLancada) {
        throw new Error('Selecione uma aula antes de salvar');
      }
      
      const presencasArray = matriculas.map((m: any) => {
        const alunoId = m.aluno?.id || m.alunoId || m.aluno_id;
        if (!alunoId) return null;
        
        const presenca = presencas[alunoId] || { status: 'PRESENTE' as const };
        
        return {
          alunoId,
          status: presenca.status,
          observacoes: presenca.observacoes || undefined
        };
      }).filter(Boolean);
      
      await presencasApi.createOrUpdate({
        aulaLancadaId: selectedAulaLancada,
        presencas: presencasArray as any[]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presencas-aula'] });
      queryClient.invalidateQueries({ queryKey: ['aulas-lancadas-frequencia'] });
      setSelectedAulaLancada('');
      setPresencas({});
      toast.success('Presenças guardadas. A chamada fica registada nesta aula.');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro desconhecido';
      toast.error('Erro ao salvar presenças: ' + errorMessage);
    }
  });

  // Handler para criar nova aula
  const handleNovaAula = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlanoAulaId) {
      toast.error('Selecione uma aula planejada');
      return;
    }
    
    if (!novaAulaData) {
      toast.error('Informe a data da aula');
      return;
    }

    if (!novaAulaConteudo || !novaAulaConteudo.trim()) {
      toast.error('Preencha o conteúdo ministrado (diário de classe). É obrigatório.');
      return;
    }
    
    // Data da aula: o backend valida período académico ativo e intervalo do trimestre/semestre.
    // Professores podem registar datas já decorridas (aula efectivamente ministrada), como no admin.

    // REGRA: Validar que há plano de ensino ativo selecionado
    const planoSelecionado = planosEnsino.find((p: any) => 
      (p.disciplinaId || p.disciplina?.id) === selectedDisciplina
    );
    
    if (!planoSelecionado) {
      toast.error('Plano de Ensino não encontrado. Selecione uma disciplina válida.');
      return;
    }
    
    // REGRA: Validar que o plano está APROVADO e não bloqueado
    if (planoSelecionado.estado !== 'APROVADO' || planoSelecionado.bloqueado) {
      toast.error('Plano de Ensino não está ativo. Apenas planos APROVADOS permitem registro de aulas.');
      return;
    }
    
    // A validação completa de data dentro do período acadêmico será feita no backend
    // O backend valida: ano letivo ativo, período acadêmico ativo, e data dentro do período
    createAulaLancadaMutation.mutate({
      planoAulaId: selectedPlanoAulaId,
      data: novaAulaData,
      horaInicio: novaAulaHoraInicio || undefined,
      horaFim: novaAulaHoraFim || undefined,
      conteudoMinistrado: novaAulaConteudo.trim(),
      observacoes: novaAulaObservacoes || undefined
    });
  };

  // Handler para atualizar status de presença
  const updatePresencaStatus = (alunoId: string, status: 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO') => {
    setPresencas(prev => ({
      ...prev,
      [alunoId]: {
        ...prev[alunoId],
        status
      }
    }));
  };

  // Handler para atualizar observações
  const updateObservacoes = (alunoId: string, observacoes: string) => {
    setPresencas(prev => ({
      ...prev,
      [alunoId]: {
        ...prev[alunoId],
        observacoes
      }
    }));
  };

  // Resetar seleções quando turma muda
  useEffect(() => {
    setSelectedDisciplina('');
    setSelectedAulaLancada('');
    setPresencas({});
  }, [selectedTurma]);

  // Resetar seleção de aula quando disciplina muda
  useEffect(() => {
    setSelectedAulaLancada('');
    setPresencas({});
  }, [selectedDisciplina]);

  const turmaSelecionada = turmas.find((t: any) => (t.id === selectedTurma || t.turmaId === selectedTurma));
  const slotsFormularioDia = useMemo(
    () => (dialogOpen && novaAulaData ? slotsParaData(novaAulaData) : []),
    [dialogOpen, novaAulaData, slotsParaData]
  );
  const disciplinaSelecionada = disciplinasDoPlano.find((d: any) => d.id === selectedDisciplina);
  const aulaLancadaSelecionada = aulasLancadas.find((a: any) => a.id === selectedAulaLancada);
  const podeRegistrarAula = disciplinaSelecionada?.planoAtivo ?? false;

  const alunosListaCount = matriculas.length;

  /** Chamada completa: todas as presenças guardadas (turma sem alunos nunca é “retirada” da lista pendente) */
  const isChamadaCompleta = useCallback(
    (aula: any) => {
      if (alunosListaCount <= 0) return false;
      const n = typeof aula._count?.presencas === 'number' ? aula._count.presencas : 0;
      return n >= alunosListaCount;
    },
    [alunosListaCount]
  );

  const aulasPendentesChamada = useMemo(
    () => (aulasLancadas as any[]).filter((a) => !isChamadaCompleta(a)),
    [aulasLancadas, isChamadaCompleta]
  );

  const aulasChamadaGuardada = useMemo(
    () => (aulasLancadas as any[]).filter((a) => isChamadaCompleta(a)),
    [aulasLancadas, isChamadaCompleta]
  );

  const selectedEstaNaListaPendente = useMemo(
    () => aulasPendentesChamada.some((a: any) => a.id === selectedAulaLancada),
    [aulasPendentesChamada, selectedAulaLancada]
  );

  const contagemPresencasPersistidasSelecionada = useMemo(() => {
    if (!selectedAulaLancada) return 0;
    const fromCount = (aulaLancadaSelecionada as any)?._count?.presencas;
    if (typeof fromCount === 'number') return fromCount;
    return (presencasData as any[]).filter((p) => p?.id != null).length;
  }, [selectedAulaLancada, aulaLancadaSelecionada, presencasData]);

  const estadoChamadaSelecionada = useMemo(() => {
    if (!selectedAulaLancada || alunosListaCount === 0) return null;
    const n = contagemPresencasPersistidasSelecionada;
    if (n >= alunosListaCount) return 'completa' as const;
    if (n > 0) return 'parcial' as const;
    return 'sem' as const;
  }, [selectedAulaLancada, alunosListaCount, contagemPresencasPersistidasSelecionada]);

  const badgeChamadaNaLista = (aula: any) => {
    if (alunosListaCount <= 0) {
      return (
        <Badge variant="secondary" className="ml-1 shrink-0 text-xs">
          Turma sem alunos
        </Badge>
      );
    }
    const n = typeof aula._count?.presencas === 'number' ? aula._count.presencas : 0;
    if (n >= alunosListaCount) {
      return (
        <Badge variant="outline" className="ml-1 shrink-0 border-green-600 text-green-800 bg-green-50 dark:bg-green-950/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Chamada guardada
        </Badge>
      );
    }
    if (n > 0) {
      return (
        <Badge variant="outline" className="ml-1 shrink-0 border-amber-600 text-amber-900 bg-amber-50 text-xs">
          Parcial {n}/{alunosListaCount}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="ml-1 shrink-0 text-xs">
        <CircleDot className="h-3 w-3 mr-1 opacity-70" />
        Sem presenças
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('pages.registroAulasFrequencia')}</h1>
          <p className="text-muted-foreground">
            {t('pages.registroAulasFrequenciaDesc')}
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
            Equivale ao <strong>Lançamento de Aulas</strong> do administrador (após a <strong>Distribuição</strong> no plano):
            use <strong>Registrar Nova Aula</strong> para cada execução real; depois, com essa aula seleccionada,{' '}
            <strong>Salvar Presenças</strong> para todos os alunos da turma.
          </p>
        </div>

        {/* Alerta se não houver ano letivo ativo */}
        {!hasAnoLetivoAtivo && (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-200">Ano Letivo Não Ativo</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              É necessário ter um ano letivo ativo para registrar aulas e frequências.
            </AlertDescription>
          </Alert>
        )}

        {/* Alerta se não houver turmas com plano ativo */}
        {hasAnoLetivoAtivo && turmas.length === 0 && !turmasLoading && (
          <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">Nenhuma Turma Disponível</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Você não possui turmas atribuídas com Plano de Ensino ATIVO (APROVADO) para o ano letivo {anoLetivo}.
              <br />
              <br />
              <strong>Regra Institucional:</strong> Aulas só podem ser registradas quando há:
              <br />
              • Plano de Ensino ATIVO (APROVADO e não bloqueado)
              <br />
              • Vínculo Professor → Disciplina → Turma via Plano de Ensino
              <br />
              <br />
              Contacte a coordenação acadêmica para atribuição de turmas e aprovação do Plano de Ensino.
            </AlertDescription>
          </Alert>
        )}

        {/* Seleção de Turma e Disciplina */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" />
              Seleção de Turma e Disciplina
            </CardTitle>
            <CardDescription>
              Selecione a turma e disciplina vinculadas ao seu Plano de Ensino ATIVO (APROVADO).
              <br />
              <strong>Regra:</strong> Apenas turmas e disciplinas com Plano de Ensino ATIVO estão disponíveis para seleção.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Turma *</Label>
                <Select 
                  value={selectedTurma} 
                  onValueChange={(v) => { 
                    setSelectedTurma(v); 
                    setSelectedDisciplina('');
                    setSelectedAulaLancada('');
                  }}
                  disabled={!hasAnoLetivoAtivo || turmasLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas.map((turma: any) => (
                      <SelectItem key={turma.turmaId || turma.id} value={turma.turmaId || turma.id}>
                        {turma.nome} - {turma.disciplinaNome || turma.disciplina?.nome || (isSecundario ? (turma.classe?.nome || 'Classe') : (turma.curso?.nome || 'Curso'))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {turmaSelecionada && (
                  <p className="text-xs text-muted-foreground">
                    {turmaSelecionada.sala && `Sala: ${turmaSelecionada.sala}`}
                    {turmaSelecionada.horario && ` • Horário: ${turmaSelecionada.horario}`}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Disciplina *</Label>
                <Select 
                  value={selectedDisciplina} 
                  onValueChange={(v) => {
                    setSelectedDisciplina(v);
                    setSelectedAulaLancada('');
                  }}
                  disabled={!selectedTurma || disciplinasDoPlano.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplinasDoPlano.map((disciplina: any) => (
                      <SelectItem key={disciplina.id} value={disciplina.id}>
                        {disciplina.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {disciplinasDoPlano.length === 0 && selectedTurma && (
                  <Alert className="mt-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-xs">
                      <strong>Nenhuma disciplina disponível.</strong>
                      <br />
                      Esta turma não possui Plano de Ensino ATIVO (APROVADO e não bloqueado) vinculado.
                      <br />
                      Contacte a coordenação acadêmica para aprovação do Plano de Ensino.
                    </AlertDescription>
                  </Alert>
                )}
                {disciplinaSelecionada && !podeRegistrarAula && disciplinaSelecionada.motivoBloqueio && (
                  <Alert className="mt-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
                      <strong>Registro bloqueado:</strong> {disciplinaSelecionada.motivoBloqueio}
                      <br />
                      <span className="italic">Regra: só registra aula para plano APROVADO e ativo.</span>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seleção de Aula Lançada */}
        {selectedDisciplina && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Aulas Registradas
              </CardTitle>
              <CardDescription>
                Lançamento efectivo (ministrada): registe cada aula com a data real. Depois escolha uma aula <strong className="font-medium">ainda sem chamada concluída</strong> na lista; após guardar, essa aula deixa de aparecer aqui e passa para &quot;Presenças já registadas&quot;, para não repetir a chamada por engano.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label>Selecione a Aula (chamada pendente)</Label>
                  <Select 
                    value={selectedEstaNaListaPendente ? selectedAulaLancada : ''} 
                    onValueChange={setSelectedAulaLancada}
                    disabled={aulasPendentesChamada.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma aula com chamada por concluir" />
                    </SelectTrigger>
                    <SelectContent>
                      {aulasPendentesChamada.map((aula: any) => (
                        <SelectItem key={aula.id} value={aula.id} className="py-3">
                          <div className="flex flex-col gap-1 items-start w-full pr-2">
                            <div className="flex flex-wrap items-center gap-1 w-full">
                              <span className="font-medium">
                                {format(parseISO(aula.data), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              {badgeChamadaNaLista(aula)}
                            </div>
                            <span className="text-xs text-muted-foreground line-clamp-2 text-left">
                              {aula.conteudoMinistrado || 'Sem conteúdo registado'}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAulaLancada && !selectedEstaNaListaPendente && alunosListaCount > 0 && (
                    <Alert className="border-green-200 bg-green-50/80 dark:bg-green-950/20 dark:border-green-900 py-2">
                      <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-400" />
                      <AlertDescription className="text-sm text-green-900 dark:text-green-100 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          A rever chamada de{' '}
                          <strong>
                            {aulaLancadaSelecionada &&
                              format(parseISO(aulaLancadaSelecionada.data), "dd/MM/yyyy", { locale: ptBR })}
                          </strong>
                          . Esta aula já tinha presenças guardadas.
                        </span>
                        <Button type="button" variant="outline" size="sm" onClick={() => setSelectedAulaLancada('')}>
                          Fechar
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  {aulasLancadas.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Nenhuma aula registrada ainda. Registre uma nova aula abaixo.
                    </p>
                  )}
                  {aulasLancadas.length > 0 && aulasPendentesChamada.length === 0 && alunosListaCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Todas as aulas registadas já têm a chamada guardada para todos os alunos. Para rever ou alterar, use a lista abaixo.
                    </p>
                  )}
                  {aulasChamadaGuardada.length > 0 && alunosListaCount > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium">Presenças já registadas</p>
                      <p className="text-xs text-muted-foreground">
                        Estas aulas não aparecem no menu acima para evitar repetir a chamada. Clique numa data para rever ou corrigir.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {aulasChamadaGuardada.map((aula: any) => (
                          <Button
                            key={aula.id}
                            type="button"
                            variant={selectedAulaLancada === aula.id ? 'default' : 'outline'}
                            size="sm"
                            className="h-auto py-1.5 gap-1.5"
                            onClick={() => setSelectedAulaLancada(aula.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 opacity-90" />
                            {format(parseISO(aula.data), 'dd/MM/yyyy', { locale: ptBR })}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <Dialog open={dialogOpen} onOpenChange={handleRegistroDialogChange}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <DialogTrigger asChild>
                          <Button 
                            disabled={!selectedDisciplina || aulasPlanejadas.length === 0 || !podeRegistrarAula}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Registrar Nova Aula
                          </Button>
                        </DialogTrigger>
                      </span>
                    </TooltipTrigger>
                    {!podeRegistrarAula && disciplinaSelecionada?.motivoBloqueio && (
                      <TooltipContent>
                        <p>{disciplinaSelecionada.motivoBloqueio}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <DialogContent className="max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Registrar Nova Aula</DialogTitle>
                      <p className="text-sm text-muted-foreground font-normal pt-1">
                        A <strong className="font-medium text-foreground">data</strong> pode vir da distribuição no plano; as{' '}
                        <strong className="font-medium text-foreground">horas</strong> são sugeridas apenas a partir do{' '}
                        <strong className="font-medium text-foreground">quadro oficial</strong> (aprovado pela secretaria).
                        Pode alterar se a aula decorreu noutro horário.
                      </p>
                    </DialogHeader>
                    <form onSubmit={handleNovaAula} className="space-y-4">
                      <div
                        className={`rounded-lg border px-3 py-2.5 text-sm flex flex-wrap items-start gap-2 ${
                          horariosQuadroOficial.length > 0
                            ? 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/25 dark:border-emerald-900'
                            : horariosProvisoriosContexto.length > 0
                              ? 'bg-amber-50/80 border-amber-200 dark:bg-amber-950/25 dark:border-amber-900'
                              : 'bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        <CalendarDays
                          className={`h-4 w-4 shrink-0 mt-0.5 ${
                            horariosQuadroOficial.length > 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : horariosProvisoriosContexto.length > 0
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-primary'
                          }`}
                        />
                        {horariosQuadroOficial.length > 0 ? (
                          <span className="text-foreground">
                            <span className="font-medium">Quadro oficial</span>
                            {' — '}
                            Existem blocos <strong>aprovados</strong> para esta turma e disciplina; são usados para preencher
                            início e fim de forma automática (pode corrigir).
                          </span>
                        ) : horariosProvisoriosContexto.length > 0 ? (
                          <span className="text-foreground">
                            <span className="font-medium">Horário ainda não oficial</span>
                            {' — '}
                            Há blocos em <strong>rascunho</strong> aguardando aprovação da secretaria. Não usamos rascunhos
                            como sugestão automática; indique data e horas manualmente (a data da distribuição no plano
                            continua disponível abaixo).
                          </span>
                        ) : (
                          <span>
                            Sem horário cadastrado para esta turma e disciplina — preencha data e horas manualmente.
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Aula Planejada *</Label>
                        <Select 
                          value={selectedPlanoAulaId} 
                          onValueChange={(id) => {
                            setSelectedPlanoAulaId(id);
                            const aula = aulasPlanejadas.find((a: any) => a.id === id);
                            if (aula) {
                              setNovaAulaData(pickDateFromDistribuicao(aula.datasDistribuidas || []));
                              const parts = [aula.titulo, aula.descricao].filter(Boolean);
                              setNovaAulaConteudo(parts.join('\n\n').trim());
                            }
                          }}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma aula planejada" />
                          </SelectTrigger>
                          <SelectContent>
                            {aulasPlanejadas.map((aula: any) => {
                              const feitas =
                                typeof aula.totalLancado === "number"
                                  ? aula.totalLancado
                                  : (aula.lancamentos?.length ?? 0);
                              const precisa = aula.quantidadeAulas ?? 1;
                              const prog = precisa > 1 ? ` — ${feitas}/${precisa} lanç.` : "";
                              return (
                              <SelectItem key={aula.id} value={aula.id}>
                                {aula.ordem}. {aula.titulo} {aula.tipo ? `(${aula.tipo === 'TEORICA' ? 'Teórica' : aula.tipo === 'PRATICA' ? 'Prática' : aula.tipo})` : ''} ({precisa} aula{precisa > 1 ? "s" : ""}
                                necessária{precisa > 1 ? "s" : ""}){prog}
                              </SelectItem>
                            );
                            })}
                          </SelectContent>
                        </Select>
                        {aulasPlanejadas.length === 0 && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            Nenhuma aula planejada disponível. É necessário criar e distribuir aulas no Plano de Ensino primeiro.
                          </p>
                        )}
                      </div>

                      {aulaPlanejadaSelecionada?.datasDistribuidas?.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Datas da distribuição (plano)
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {(aulaPlanejadaSelecionada.datasDistribuidas as string[]).map((ymd: string) => (
                              <Button
                                key={ymd}
                                type="button"
                                size="sm"
                                variant={novaAulaData === ymd ? 'default' : 'outline'}
                                className="h-8 text-xs"
                                onClick={() => setNovaAulaData(ymd)}
                              >
                                {format(parseISO(`${ymd}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                              </Button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Toque para usar a data planejada; as horas sugerem-se só com base no quadro{' '}
                            <strong>oficial</strong> (aprovado) para esse dia da semana, se existir.
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label>Data da Aula *</Label>
                        <Input
                          type="date"
                          value={novaAulaData}
                          onChange={(e) => setNovaAulaData(e.target.value)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Use a data em que a aula foi ministrada. O sistema valida se calha dentro do período académico ativo (trimestre/semestre).
                        </p>
                        {anoLetivo && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Ano Letivo: {anoLetivo} {hasAnoLetivoAtivo ? '(Ativo)' : '(Não ativo)'}
                          </p>
                        )}
                      </div>

                      {slotsFormularioDia.length > 0 && (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            <Clock className="h-3.5 w-3.5" />
                            Quadro oficial — blocos para este dia
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {slotsFormularioDia.map((h: any) => {
                              const ini = toTimeInput(h.horaInicio);
                              const fim = toTimeInput(h.horaFim);
                              const ativo = novaAulaHoraInicio === ini && novaAulaHoraFim === fim;
                              return (
                                <Button
                                  key={`${h.id ?? `${ini}-${fim}`}`}
                                  type="button"
                                  size="sm"
                                  variant={ativo ? 'default' : 'outline'}
                                  className="h-8 text-xs font-normal"
                                  onClick={() => {
                                    setNovaAulaHoraInicio(ini);
                                    setNovaAulaHoraFim(fim);
                                  }}
                                >
                                  {ini} – {fim}
                                  {h.sala ? ` · ${h.sala}` : ''}
                                </Button>
                              );
                            })}
                          </div>
                          <Separator className="my-1" />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Hora de Início</Label>
                          <Input
                            type="time"
                            value={novaAulaHoraInicio}
                            onChange={(e) => setNovaAulaHoraInicio(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Hora de Término</Label>
                          <Input
                            type="time"
                            value={novaAulaHoraFim}
                            onChange={(e) => setNovaAulaHoraFim(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Conteúdo ministrado (diário de classe) *</Label>
                        <Textarea
                          value={novaAulaConteudo}
                          onChange={(e) => setNovaAulaConteudo(e.target.value)}
                          placeholder="Obrigatório: descreva o que foi leccionado (tópicos, actividades…)"
                          rows={3}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Obrigatório para registar a aula — corresponde ao diário de classe.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Observações / Ocorrências</Label>
                        <Textarea
                          value={novaAulaObservacoes}
                          onChange={(e) => setNovaAulaObservacoes(e.target.value)}
                          placeholder="Ocorrências, observações gerais da aula"
                          rows={2}
                        />
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => handleRegistroDialogChange(false)}>
                          Cancelar
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={
                            createAulaLancadaMutation.isPending ||
                            !selectedPlanoAulaId ||
                            !novaAulaConteudo.trim()
                          }
                        >
                          {createAulaLancadaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Registrar Aula
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Chamada */}
        {selectedAulaLancada && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">Lista de Chamada</CardTitle>
                  {estadoChamadaSelecionada === 'completa' && (
                    <Badge className="bg-green-600 hover:bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Presenças activas (guardadas)
                    </Badge>
                  )}
                  {estadoChamadaSelecionada === 'parcial' && (
                    <Badge variant="outline" className="border-amber-600 text-amber-900 bg-amber-50">
                      Parcial {contagemPresencasPersistidasSelecionada}/{alunosListaCount} — guarde para concluir
                    </Badge>
                  )}
                  {estadoChamadaSelecionada === 'sem' && !presencasLoading && (
                    <Badge variant="secondary">Chamada ainda não guardada</Badge>
                  )}
                </div>
                <CardDescription>
                  {aulaLancadaSelecionada && (
                    <>
                      Aula de {format(parseISO(aulaLancadaSelecionada.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {aulaLancadaSelecionada.conteudoMinistrado && ` — ${aulaLancadaSelecionada.conteudoMinistrado}`}
                    </>
                  )}
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    <strong>Importante:</strong> A frequência é calculada automaticamente a partir das aulas registradas.
                    <br />
                    Alunos com frequência abaixo de 75% não poderão receber notas até regularizarem a frequência.
                  </span>
                </CardDescription>
              </div>
              <Button 
                onClick={() => savePresencasMutation.mutate()} 
                disabled={savePresencasMutation.isPending || matriculas.length === 0}
              >
                {savePresencasMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Presenças
              </Button>
            </CardHeader>
            <CardContent>
              {presencasLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : matriculas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum aluno matriculado nesta turma.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead className="w-[150px] text-center">Status</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matriculas.map((m: any) => {
                      const alunoId = m.aluno?.id || m.alunoId || m.aluno_id;
                      const alunoNome = m.aluno?.nomeCompleto || m.aluno?.nome_completo || 'Aluno';
                      const presenca = presencas[alunoId] || { status: 'PRESENTE' as const };
                      
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{alunoNome}</TableCell>
                          <TableCell className="text-center">
                            <Select
                              value={presenca.status}
                              onValueChange={(value: 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO') => 
                                updatePresencaStatus(alunoId, value)
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PRESENTE">
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    Presente
                                  </Badge>
                                </SelectItem>
                                <SelectItem value="AUSENTE">
                                  <Badge variant="outline" className="text-red-600 border-red-600">
                                    Ausente
                                  </Badge>
                                </SelectItem>
                                <SelectItem value="JUSTIFICADO">
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                    Justificado
                                  </Badge>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Observações (opcional)"
                              value={presenca.observacoes || ''}
                              onChange={(e) => updateObservacoes(alunoId, e.target.value)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
