import React, { useState, useMemo, useEffect } from 'react';
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
import { Plus, CalendarCheck, Loader2, Save, AlertCircle, BookOpen } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { turmasApi, matriculasApi, aulasLancadasApi, presencasApi, planoEnsinoApi } from '@/services/api';
import { format, parseISO, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function GestaoFrequencia() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
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

  const isAdmin = role === 'ADMIN';
  const isProfessor = role === 'PROFESSOR';

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

  // Buscar matrículas da turma selecionada
  const { data: matriculas = [] } = useQuery({
    queryKey: ['turma-matriculas-frequencia', selectedTurma],
    queryFn: async () => {
      if (!selectedTurma) return [];
      try {
        const data = await matriculasApi.getAll({ turmaId: selectedTurma });
        return (data || []).filter((m: any) => 
          m.status === 'Ativa' || m.status === 'ativa' || m.status === 'Cursando'
        );
      } catch (error) {
        console.error('Erro ao buscar matrículas:', error);
        return [];
      }
    },
    enabled: !!selectedTurma
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
      setDialogOpen(false);
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
      toast.error('Erro ao registrar aula: ' + errorMessage);
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
      toast.success('Presenças salvas com sucesso!');
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
    
    // REGRA ABSOLUTA: Validar data dentro do ano letivo e período acadêmico
    const dataAula = parseISO(novaAulaData);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Validação básica: não permitir datas muito antigas (exceto para admin)
    if (isBefore(dataAula, hoje) && !isAdmin) {
      toast.error('Não é possível registrar aula em data passada');
      return;
    }
    
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
      conteudoMinistrado: novaAulaConteudo || undefined,
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
  const disciplinaSelecionada = disciplinasDoPlano.find((d: any) => d.id === selectedDisciplina);
  const aulaLancadaSelecionada = aulasLancadas.find((a: any) => a.id === selectedAulaLancada);
  const podeRegistrarAula = disciplinaSelecionada?.planoAtivo ?? false;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('pages.registroAulasFrequencia')}</h1>
          <p className="text-muted-foreground">
            {t('pages.registroAulasFrequenciaDesc')}
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
                Selecione uma aula já registrada para marcar presenças ou registre uma nova aula
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label>Selecione a Aula</Label>
                  <Select 
                    value={selectedAulaLancada} 
                    onValueChange={setSelectedAulaLancada}
                    disabled={aulasLancadas.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma aula registrada" />
                    </SelectTrigger>
                    <SelectContent>
                      {aulasLancadas.map((aula: any) => (
                        <SelectItem key={aula.id} value={aula.id}>
                          {format(parseISO(aula.data), "dd/MM/yyyy", { locale: ptBR })} - {aula.conteudoMinistrado || 'Sem conteúdo'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {aulasLancadas.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Nenhuma aula registrada ainda. Registre uma nova aula abaixo.
                    </p>
                  )}
                </div>
                
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Registrar Nova Aula</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleNovaAula} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Aula Planejada *</Label>
                        <Select 
                          value={selectedPlanoAulaId} 
                          onValueChange={setSelectedPlanoAulaId}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma aula planejada" />
                          </SelectTrigger>
                          <SelectContent>
                            {aulasPlanejadas.map((aula: any) => (
                              <SelectItem key={aula.id} value={aula.id}>
                                {aula.ordem}. {aula.titulo} {aula.tipo ? `(${aula.tipo === 'TEORICA' ? 'Teórica' : aula.tipo === 'PRATICA' ? 'Prática' : aula.tipo})` : ''} ({aula.quantidadeAulas} aula{aula.quantidadeAulas > 1 ? 's' : ''})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {aulasPlanejadas.length === 0 && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            Nenhuma aula planejada disponível. É necessário criar e distribuir aulas no Plano de Ensino primeiro.
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Data da Aula *</Label>
                        <Input
                          type="date"
                          value={novaAulaData}
                          onChange={(e) => setNovaAulaData(e.target.value)}
                          required
                          min={!isAdmin ? format(new Date(), 'yyyy-MM-dd') : undefined}
                        />
                        <p className="text-xs text-muted-foreground">
                          {!isAdmin 
                            ? 'A data deve estar dentro do período acadêmico ativo e não pode ser anterior a hoje'
                            : 'A data deve estar dentro do período acadêmico ativo do ano letivo'
                          }
                        </p>
                        {anoLetivo && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Ano Letivo: {anoLetivo} {hasAnoLetivoAtivo ? '(Ativo)' : '(Não ativo)'}
                          </p>
                        )}
                      </div>
                      
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
                        <Label>Conteúdo Ministrado (diário de classe)</Label>
                        <Textarea
                          value={novaAulaConteudo}
                          onChange={(e) => setNovaAulaConteudo(e.target.value)}
                          placeholder="Tema/conteúdo lecionado na aula"
                          rows={3}
                        />
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
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createAulaLancadaMutation.isPending || !selectedPlanoAulaId}
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Lista de Chamada</CardTitle>
                <CardDescription>
                  {aulaLancadaSelecionada && (
                    <>
                      Aula de {format(parseISO(aulaLancadaSelecionada.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {aulaLancadaSelecionada.conteudoMinistrado && ` - ${aulaLancadaSelecionada.conteudoMinistrado}`}
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
