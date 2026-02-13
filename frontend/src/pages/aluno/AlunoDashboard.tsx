import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { 
  matriculasApi, 
  notasApi, 
  frequenciasApi, 
  horariosApi, 
  mensalidadesApi, 
  matriculasDisciplinasApi, 
  matriculasAnuaisApi, 
  eventosApi, 
  bibliotecaApi,
  aulasLancadasApi,
  planoEnsinoApi,
  presencasApi,
  comunicadosApi,
  relatoriosApi
} from '@/services/api';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, FileText, BookOpen, Calendar, TrendingUp, Clock, CheckCircle2, XCircle, LogOut, CreditCard, ClipboardCheck, Users, GraduationCap, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AlunoDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const { isSecundario, tipoAcademico } = useInstituicao();
  const navigate = useNavigate();
  const [anoLetivoSelecionado, setAnoLetivoSelecionado] = useState<number | null>(null);

  // Fetch todos os anos letivos do aluno
  const { data: anosLetivos = [], isLoading: anosLetivosLoading, error: anosLetivosError } = useQuery({
    queryKey: ['aluno-anos-letivos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const data = await matriculasAnuaisApi.getMeusAnosLetivos();
        console.log('[AlunoDashboard] Anos letivos recebidos:', data);
        return data || [];
      } catch (error: any) {
        console.error('[AlunoDashboard] Erro ao buscar anos letivos:', {
          error,
          message: error?.message,
          response: error?.response?.data,
        });
        // Não retornar array vazio silenciosamente - deixar o erro ser tratado pelo React Query
        throw error;
      }
    },
    enabled: !!user?.id,
    retry: 1, // Tentar apenas 1 vez em caso de erro
  });

  // Definir ano letivo selecionado (padrão: mais recente)
  React.useEffect(() => {
    if (anosLetivos.length > 0 && !anoLetivoSelecionado) {
      const anoMaisRecente = Math.max(...anosLetivos.map((a: any) => a.anoLetivo));
      setAnoLetivoSelecionado(anoMaisRecente);
    }
  }, [anosLetivos, anoLetivoSelecionado]);

  // Fetch matrícula anual do ano selecionado
  const { data: matriculaAnual } = useQuery({
    queryKey: ['aluno-matricula-anual', user?.id, anoLetivoSelecionado],
    queryFn: async () => {
      if (!user?.id || !anoLetivoSelecionado) return null;
      try {
        const matriculas = await matriculasAnuaisApi.getByAluno(user.id);
        return matriculas.find((m: any) => m.anoLetivo === anoLetivoSelecionado) || null;
      } catch (error) {
        return null;
      }
    },
    enabled: !!user?.id && !!anoLetivoSelecionado
  });

  // Fetch matriculas do aluno (filtradas por ano letivo se possível)
  const { data: matriculas = [], isLoading: matriculasLoading } = useQuery({
    queryKey: ['aluno-matriculas', user?.id, anoLetivoSelecionado],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        // Usar rota específica para ALUNO (mais segura - usa req.user.userId do token)
        const data = await matriculasApi.getMinhasMatriculas();
        return (data || []).filter((m: any) => m.status === 'Ativa' || m.status === 'ativa');
      } catch (error) {
        console.error('Erro ao buscar matrículas:', error);
        return [];
      }
    },
    enabled: !!user?.id
  });

  // Fetch boletim do aluno (retorna disciplinas com Plano de Ensino, notas e frequência)
  const { data: boletimData, isLoading: boletimLoading, error: boletimError } = useQuery({
    queryKey: ['aluno-boletim', user?.id, anoLetivoSelecionado],
    queryFn: async () => {
      if (!user?.id || !anoLetivoSelecionado) return null;
      try {
        const data = await relatoriosApi.getBoletimAluno(user.id, { 
          anoLetivo: anoLetivoSelecionado 
        });
        console.log('[AlunoDashboard] Boletim recebido:', data);
        return data || null;
      } catch (error: any) {
        console.error('[AlunoDashboard] Erro ao buscar boletim:', {
          error,
          message: error?.message,
          response: error?.response?.data,
        });
        return null;
      }
    },
    enabled: !!user?.id && !!anoLetivoSelecionado,
    retry: 1,
  });

  // Extrair disciplinas do boletim (com Plano de Ensino)
  const disciplinasMatriculadas = boletimData?.disciplinas || [];

  // Notas vêm do boletim (já calculadas e filtradas)
  // Não precisamos buscar separadamente

  // Frequências vêm do boletim (já calculadas por disciplina)
  // Calcular frequência geral consolidada
  const presencasData = useMemo(() => {
    if (!boletimData?.disciplinas || boletimData.disciplinas.length === 0) {
      return null;
    }

    let totalAulas = 0;
    let totalPresencas = 0;
    let totalAusencias = 0;

    boletimData.disciplinas.forEach((disciplina: any) => {
      const freq = disciplina.frequencia || {};
      if (freq.totalAulas !== undefined && freq.totalAulas !== null) {
        totalAulas += freq.totalAulas;
        totalPresencas += freq.presencas || 0;
        totalAusencias += freq.faltas || 0;
      }
    });

    return {
      presencas: totalPresencas,
      ausencias: totalAusencias,
      totalAulas: totalAulas,
      frequencia: totalAulas > 0 ? (totalPresencas / totalAulas) * 100 : null
    };
  }, [boletimData]);

  // Fetch aulas lançadas (filtradas por ano letivo)
  const { data: aulasLancadas = [], isLoading: aulasLancadasLoading, error: aulasLancadasError } = useQuery({
    queryKey: ['aluno-aulas-lancadas', user?.id, anoLetivoSelecionado],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const data = await aulasLancadasApi.getAll({
          anoLetivo: anoLetivoSelecionado || undefined
        });
        console.log('[AlunoDashboard] Aulas lançadas recebidas:', data);
        return Array.isArray(data) ? data : [];
      } catch (error: any) {
        console.error('[AlunoDashboard] Erro ao buscar aulas lançadas:', {
          error,
          message: error?.message,
          response: error?.response?.data,
        });
        return [];
      }
    },
    enabled: !!user?.id && !!anoLetivoSelecionado,
    retry: 1,
  });

  // Fetch horários de hoje
  const { data: horariosHoje = [], isLoading: horariosLoading, error: horariosError } = useQuery({
    queryKey: ['aluno-horarios-hoje', user?.id, matriculas],
    queryFn: async () => {
      const turmaIds = matriculas.map((m: any) => m.turmaId || m.turma?.id || m.turma_id).filter(Boolean);
      if (turmaIds.length === 0) {
        console.log('[AlunoDashboard] Nenhuma turma encontrada para buscar horários');
        return [];
      }

      try {
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const hoje = diasSemana[new Date().getDay()];
        
        const allHorarios = await Promise.all(
          turmaIds.map((id: string) => horariosApi.getAll({ turmaId: id }).catch((err: any) => {
            console.error(`[AlunoDashboard] Erro ao buscar horários da turma ${id}:`, err);
            return [];
          }))
        );
        
        const horariosFiltrados = allHorarios.flat().filter((h: any) => 
          h.diaSemana === hoje || h.dia_semana === hoje
        ).sort((a: any, b: any) => {
          const horaA = a.horaInicio || a.hora_inicio || '';
          const horaB = b.horaInicio || b.hora_inicio || '';
          return horaA.localeCompare(horaB);
        });
        
        console.log('[AlunoDashboard] Horários de hoje recebidos:', horariosFiltrados);
        return horariosFiltrados;
      } catch (error: any) {
        console.error('[AlunoDashboard] Erro ao buscar horários:', {
          error,
          message: error?.message,
          response: error?.response?.data,
        });
        return [];
      }
    },
    enabled: matriculas.length > 0 && !!user?.id,
    retry: 1,
  });

  // Fetch mensalidades (filtradas por ano letivo)
  const { data: mensalidadesPendentes = [], isLoading: mensalidadesLoading, error: mensalidadesError } = useQuery({
    queryKey: ['aluno-mensalidades-pendentes', user?.id, anoLetivoSelecionado],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        // Usar rota específica para ALUNO (mais segura - usa req.user.userId do token)
        const data = await mensalidadesApi.getMinhasMensalidades();
        const mensalidades = Array.isArray(data) ? data : [];
        const pendentes = mensalidades.filter((m: any) => 
          m.status === 'Pendente' || m.status === 'Atrasado' || m.status === 'PENDENTE' || m.status === 'ATRASADO'
        );
        console.log('[AlunoDashboard] Mensalidades pendentes recebidas:', pendentes);
        return pendentes;
      } catch (error: any) {
        console.error('[AlunoDashboard] Erro ao buscar mensalidades:', {
          error,
          message: error?.message,
          response: error?.response?.data,
        });
        return [];
      }
    },
    enabled: !!user?.id,
    retry: 1,
  });

  // Fetch próximos eventos do calendário
  const { data: proximosEventos = [], isLoading: eventosLoading, error: eventosError } = useQuery({
    queryKey: ['aluno-proximos-eventos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const data = await eventosApi.getAll({});
        const eventos = Array.isArray(data) ? data : [];
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const proximos30Dias = new Date();
        proximos30Dias.setDate(hoje.getDate() + 30);
        proximos30Dias.setHours(23, 59, 59, 999);
        
        const eventosFiltrados = eventos.filter((evento: any) => {
          if (!evento.dataInicio && !evento.data_inicio) return false;
          const dataEvento = new Date(evento.dataInicio || evento.data_inicio);
          dataEvento.setHours(0, 0, 0, 0);
          return dataEvento >= hoje && dataEvento <= proximos30Dias;
        }).sort((a: any, b: any) => {
          const dataA = new Date(a.dataInicio || a.data_inicio);
          const dataB = new Date(b.dataInicio || b.data_inicio);
          return dataA.getTime() - dataB.getTime();
        }).slice(0, 5);
        
        console.log('[AlunoDashboard] Próximos eventos recebidos:', eventosFiltrados);
        return eventosFiltrados;
      } catch (error: any) {
        console.error('[AlunoDashboard] Erro ao buscar eventos:', {
          error,
          message: error?.message,
          response: error?.response?.data,
        });
        return [];
      }
    },
    enabled: !!user?.id,
    retry: 1,
  });

  // Fetch meus empréstimos da biblioteca
  const { data: meusEmprestimos = [], isLoading: emprestimosLoading, error: emprestimosError } = useQuery({
    queryKey: ['aluno-meus-emprestimos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const data = await bibliotecaApi.getMeusEmprestimos({ status: 'ATIVO' });
        const emprestimos = Array.isArray(data) ? data : [];
        console.log('[AlunoDashboard] Empréstimos recebidos:', emprestimos);
        return emprestimos;
      } catch (error: any) {
        console.error('[AlunoDashboard] Erro ao buscar empréstimos:', {
          error,
          message: error?.message,
          response: error?.response?.data,
        });
        return [];
      }
    },
    enabled: !!user?.id,
    retry: 1,
  });

  // Fetch comunicados institucionais
  const { data: comunicadosData, isLoading: comunicadosLoading, error: comunicadosError } = useQuery({
    queryKey: ['aluno-comunicados', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        // Usar getUserComunicados para alunos (filtra por role/turma/curso)
        const data = await comunicadosApi.getUserComunicados();
        const comunicados = Array.isArray(data) ? data : [];
        console.log('[AlunoDashboard] Comunicados recebidos:', comunicados);
        return comunicados;
      } catch (error: any) {
        console.error('[AlunoDashboard] Erro ao buscar comunicados:', {
          error,
          message: error?.message,
          response: error?.response?.data,
        });
        return [];
      }
    },
    enabled: !!user?.id,
    retry: 1,
  });

  // Garantir que comunicados esteja sempre definido
  const comunicados = comunicadosData || [];

  // Calcular estatísticas por ano letivo
  const calcularEstatisticas = () => {
    // REGRA ABSOLUTA: Verificar se há disciplinas matriculadas do Plano de Ensino ativo
    const temDisciplinas = disciplinasMatriculadas.length > 0;
    
    // Processar disciplinas do boletim (já vêm com notas e frequência calculadas)
    // REGRA: Apenas disciplinas do Plano de Ensino ativo são exibidas
    const materias = disciplinasMatriculadas.map((disciplina: any) => {
      const notasInfo = disciplina.notas || {};
      
      // REGRA ABSOLUTA: Verificar se há avaliações reais lançadas
      // O backend retorna media_final: 0 quando não há notas, então precisamos verificar
      // se há avaliações reais através dos detalhes do cálculo
      const detalhesNotas = notasInfo.detalhes || {};
      const notasUtilizadas = detalhesNotas.notas_utilizadas || [];
      const temAvaliacoesReais = Array.isArray(notasUtilizadas) && notasUtilizadas.length > 0;
      
      // REGRA ABSOLUTA: mediaFinal só existe se houver avaliações lançadas
      // Se não há avaliações reais, considerar null (nunca exibir 0.0 sem avaliações)
      // Se há avaliações reais, usar mediaFinal mesmo que seja 0 (média real de 0)
      // IMPORTANTE: Verificar também se a fórmula não é "Nenhuma nota lançada" ou similar
      const formulaAplicada = detalhesNotas.formula_aplicada || '';
      const formulaLower = formulaAplicada.toLowerCase();
      const temNotasLancadas = temAvaliacoesReais && 
                                notasUtilizadas.length > 0 &&
                                !formulaLower.includes('nenhuma nota') &&
                                !formulaLower.includes('aguardando') &&
                                !formulaLower.includes('aguardando lançamento');
      
      // REGRA ABSOLUTA: Nunca exibir 0.0 como média sem avaliações
      // Se não há avaliações reais lançadas, mediaFinal deve ser null
      const mediaFinal = temNotasLancadas && 
                         notasInfo.mediaFinal !== undefined && 
                         notasInfo.mediaFinal !== null
        ? Number(notasInfo.mediaFinal)
        : null;
      
      // Obter frequência (pode ser null se não houver aulas)
      const frequencia = disciplina.frequencia || null;
      
      // REGRA ABSOLUTA: Verificar se há aulas lançadas
      // Frequência só existe se houver aulas lançadas (totalAulas > 0)
      // Nunca exibir frequência se totalAulas === 0 (sem aulas lançadas)
      const temAulas = frequencia?.totalAulas !== undefined && 
                       frequencia.totalAulas !== null && 
                       frequencia.totalAulas > 0;
      
      // REGRA ABSOLUTA: Usar situacaoAcademica do backend, mas ajustar se não houver avaliações
      // O backend retorna 'REPROVADO' quando media_final = 0 (sem avaliações), então precisamos verificar
      let situacao = disciplina.situacaoAcademica;
      
      // REGRA ABSOLUTA: Verificar se há aulas lançadas antes de considerar frequência
      const frequenciaIrregular = temAulas && 
                                   frequencia?.situacao === 'IRREGULAR';
      
      // REGRA ABSOLUTA: Se não há avaliações reais lançadas, situação é EM_ANDAMENTO (não REPROVADO)
      if (!temNotasLancadas) {
        // Se frequência irregular (e há aulas), reprovado por falta (mesmo sem avaliações)
        if (frequenciaIrregular) {
          situacao = 'REPROVADO_FALTA';
        } else {
          // Sem avaliações e frequência OK (ou sem aulas) = EM_ANDAMENTO
          situacao = 'EM_ANDAMENTO';
        }
      } else {
        // Há avaliações reais lançadas - usar situação do backend ou calcular
        // Se frequência irregular (e há aulas), reprovado por falta (prioridade sobre notas)
        if (frequenciaIrregular) {
          situacao = 'REPROVADO_FALTA';
        } 
        // Se há nota final, usar status das notas
        else if (mediaFinal !== null && notasInfo.status) {
          situacao = notasInfo.status === 'APROVADO' ? 'APROVADO' : 'REPROVADO';
        }
        // Caso contrário, está em andamento
        else {
          situacao = 'EM_ANDAMENTO';
        }
      }
      
      return {
        id: disciplina.planoEnsinoId || disciplina.disciplina?.id || 'N/A',
        nome: disciplina.disciplina?.nome || 'Disciplina',
        media: mediaFinal, // null se não houver avaliações (nunca 0.0)
        professor: disciplina.professor?.nomeCompleto || '—',
        cargaHoraria: disciplina.disciplina?.cargaHoraria || 0,
        situacao,
        frequencia,
        semestre: disciplina.semestre || null, // REGRA: Semestre vem do Plano de Ensino
        temAvaliacoes: temNotasLancadas, // Flag para verificar se há avaliações reais lançadas
        temAulas // Flag para verificar se há aulas lançadas
      };
    });

    // REGRA ABSOLUTA: Média geral: null quando não há avaliações (nunca exibir 0.0 sem avaliações)
    // IMPORTANTE: Incluir médias de 0.0 se houver avaliações reais (aluno pode ter tirado 0)
    const mediasValidas = materias
      .filter(m => m.temAvaliacoes && m.media !== null && m.media !== undefined)
      .map(m => m.media as number);
    
    const mediaGeral = mediasValidas.length > 0
      ? mediasValidas.reduce((acc, m) => acc + m, 0) / mediasValidas.length 
      : null;

    // REGRA ABSOLUTA: Frequência consolidada - null se não houver aulas lançadas
    // IMPORTANTE: Não exibir frequência se totalAulas === 0 (sem aulas lançadas)
    // Nunca assumir frequência quando não há aulas reais lançadas
    const totalAulas = presencasData?.totalAulas || 0;
    const frequenciaMedia = totalAulas > 0 && 
                           presencasData?.frequencia !== undefined && 
                           presencasData?.frequencia !== null &&
                           Number(presencasData.frequencia) >= 0
      ? Number(presencasData.frequencia)
      : null;
    const totalPresencas = presencasData?.presencas || 0;

    // REGRA ABSOLUTA: Calcular situação acadêmica
    // "Em Curso" APENAS se houver disciplinas matriculadas do Plano de Ensino ativo
    // Caso contrário, usar "Matriculado (aguardando disciplinas)"
    // IMPORTANTE: Se já está em um ano letivo, não mencionar "sem ano letivo" na mensagem
    let situacao: string;
    if (!temDisciplinas) {
      // Sem disciplinas matriculadas - NÃO exibir "Em Curso"
      // Aluno tem matrícula anual ativa, mas ainda não foi matriculado em disciplinas
      // Se já está em um ano letivo, mensagem não deve mencionar "sem ano letivo"
      situacao = 'Matriculado (aguardando disciplinas)';
    } else {
      // Há disciplinas matriculadas do Plano de Ensino ativo
      // Verificar situação das disciplinas
      const disciplinasAprovadas = materias.filter(m => m.situacao === 'APROVADO').length;
      const disciplinasReprovadas = materias.filter(m => m.situacao === 'REPROVADO' || m.situacao === 'REPROVADO_FALTA').length;
      const disciplinasEmAndamento = materias.filter(m => m.situacao === 'EM_ANDAMENTO' || !m.situacao).length;
      
      // REGRA ABSOLUTA: Verificar frequência mínima apenas se houver aulas lançadas
      // Não considerar frequência insuficiente se não houver aulas (frequenciaMedia === null)
      const frequenciaInsuficiente = frequenciaMedia !== null && frequenciaMedia < 75;
      
      // Se todas as disciplinas estão aprovadas e frequência OK (ou sem aulas ainda)
      if (disciplinasAprovadas === materias.length && disciplinasEmAndamento === 0 && 
          (frequenciaMedia === null || frequenciaMedia >= 75)) {
        situacao = 'Aprovado';
      } 
      // Se todas as disciplinas estão reprovadas ou frequência insuficiente (com aulas)
      else if (disciplinasReprovadas === materias.length || 
               (frequenciaInsuficiente && frequenciaMedia !== null)) {
        situacao = 'Reprovado';
      } 
      // Caso contrário, está em curso (há disciplinas matriculadas do Plano de Ensino ativo)
      // Pode ter disciplinas em andamento, aprovadas e reprovadas misturadas
      else {
        situacao = 'Em Curso';
      }
    }

    return { materias, mediaGeral, frequenciaMedia, totalPresencas, totalAulas, situacao, temDisciplinas };
  };

  const { materias, mediaGeral, frequenciaMedia, totalPresencas, totalAulas, situacao, temDisciplinas } = calcularEstatisticas();
  
  // Verificar se há ano letivo ativo e matrícula anual, mas sem disciplinas
  // IMPORTANTE: Não exibir "Sem Ano Letivo" quando houver ano letivo ativo
  const temAnoLetivoAtivo = anoLetivoSelecionado !== null && anosLetivos.length > 0;
  const temMatriculaAnualAtiva = matriculaAnual?.status === 'ATIVA';
  const semDisciplinas = temAnoLetivoAtivo && temMatriculaAnualAtiva && !temDisciplinas;

  const proximaAula = horariosHoje.find((h: any) => {
    const agora = new Date();
    const horaInicio = h.horaInicio || h.hora_inicio || '';
    const [hora, minuto] = horaInicio.split(':');
    const horaAula = new Date();
    horaAula.setHours(parseInt(hora), parseInt(minuto), 0);
    return horaAula > agora;
  });

  const isLoading = anosLetivosLoading || matriculasLoading || boletimLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold">Olá, {user?.nome_completo?.split(' ')[0] || 'Estudante'}!</h1>
            <p className="text-muted-foreground">
              Acompanhe seu desempenho acadêmico
            </p>
          </div>
          
          {/* Seletor de Ano Letivo */}
          {anosLetivos.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Ano Letivo:</label>
              <Select
                value={anoLetivoSelecionado?.toString() || ''}
                onValueChange={(value) => setAnoLetivoSelecionado(Number(value))}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {anosLetivos.map((ano: any) => (
                    <SelectItem key={ano.anoLetivo} value={ano.anoLetivo.toString()}>
                      {ano.anoLetivo}
                      {ano.status === 'ATIVA' && ' (Ativo)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Mensagem de erro ao buscar anos letivos */}
        {anosLetivosError && !anosLetivosLoading && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                <p className="text-lg font-medium text-destructive">
                  Erro ao carregar dados acadêmicos
                </p>
                <p className="text-muted-foreground">
                  Não foi possível carregar suas matrículas anuais. Por favor, tente novamente ou entre em contato com o suporte.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {anosLetivosError instanceof Error ? anosLetivosError.message : 'Erro desconhecido'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mensagem se não houver anos letivos (apenas se não houver erro) */}
        {!anosLetivosError && anosLetivos.length === 0 && !anosLetivosLoading && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                <GraduationCap className="h-12 w-12 mx-auto text-warning mb-4" />
                <p className="text-lg font-medium">
                  Bem-vindo ao seu painel acadêmico!
                </p>
                <p className="text-muted-foreground">
                  Você ainda não possui matrícula anual registrada para nenhum ano letivo.
                  <br />
                  Entre em contato com a secretaria para realizar sua matrícula anual.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Nota:</strong> A matrícula anual é necessária para acessar seus dados acadêmicos, 
                  disciplinas, notas e frequências.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mensagem se não houver ano letivo selecionado mas há anos letivos disponíveis */}
        {!anoLetivoSelecionado && anosLetivos.length > 0 && (
          <Card className="border-muted">
            <CardContent className="p-4">
              <p className="text-center text-muted-foreground">
                Selecione um ano letivo acima para visualizar seus dados acadêmicos.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Banner: Matrícula anual ativa, mas sem disciplinas matriculadas */}
        {semDisciplinas && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Info className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-warning-foreground">
                    Matrícula anual ativa, mas sem disciplinas matriculadas.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sua matrícula anual está ativa, porém você ainda não possui disciplinas matriculadas. 
                    Entre em contato com a secretaria acadêmica para realizar a matrícula nas disciplinas.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TOPO — STATUS */}
        {anoLetivoSelecionado && matriculaAnual && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Ano Letivo</CardDescription>
                <CardTitle className="text-2xl">{anoLetivoSelecionado}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Curso</CardDescription>
                <CardTitle className="text-lg">
                  {matriculaAnual.curso?.nome || matriculaAnual.cursoNome || '-'}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {isSecundario ? 'Classe' : tipoAcademico === 'SUPERIOR' ? 'Semestre' : 'Turma'}
                </CardDescription>
                <CardTitle className="text-lg">
                  {isSecundario ? (
                    matriculaAnual.classeOuAnoCurso || '—'
                  ) : tipoAcademico === 'SUPERIOR' ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1 cursor-help">
                            {disciplinasMatriculadas.length > 0 
                              ? (() => {
                                  // Semestre vem do Plano de Ensino (buscar do boletim ou da primeira disciplina)
                                  const primeiraDisciplina = disciplinasMatriculadas[0];
                                  // Tentar buscar semestre do Plano de Ensino através do boletim
                                  const semestre = primeiraDisciplina?.semestre || 
                                                   boletimData?.disciplinas?.[0]?.semestre ||
                                                   null;
                                  return semestre ? `Semestre ${semestre}` : '—';
                                })()
                              : '—'
                            }
                            {!temDisciplinas && <Info className="h-3 w-3 text-muted-foreground" />}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p className="text-xs">
                            {!temDisciplinas 
                              ? 'O semestre é definido após matrícula nas disciplinas conforme o Plano de Ensino.'
                              : 'Semestre atual conforme o Plano de Ensino ativo.'
                            }
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    matriculas[0]?.turma?.nome || '—'
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* INDICADORES */}
        {anoLetivoSelecionado && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Média Geral</CardDescription>
                  <CardTitle className="text-3xl">
                    {mediaGeral !== null ? mediaGeral.toFixed(1) : '—'}
                  </CardTitle>
                  {mediaGeral === null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Sem avaliações lançadas
                    </p>
                  )}
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Frequência</CardDescription>
                  <CardTitle className="text-3xl">
                    {frequenciaMedia !== null ? `${frequenciaMedia.toFixed(0)}%` : '—'}
                  </CardTitle>
                  {frequenciaMedia !== null ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      {totalPresencas}/{totalAulas} presenças
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalAulas === 0 ? 'Sem aulas lançadas' : 'Sem dados de frequência'}
                    </p>
                  )}
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Situação</CardDescription>
                  <CardTitle className="text-2xl">
                    <Badge 
                      variant={
                        situacao === 'Aprovado' ? 'default' : 
                        situacao === 'Reprovado' ? 'destructive' : 
                        situacao === 'Matriculado (aguardando disciplinas)' ? 'outline' :
                        'secondary'
                      }
                      className="text-lg px-3 py-1"
                    >
                      {situacao}
                    </Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
            
            {/* Mensagem orientativa quando sem disciplinas */}
            {semDisciplinas && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        Próximos Passos
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Sua matrícula anual está ativa, porém você ainda não possui disciplinas matriculadas. 
                        Para iniciar suas atividades acadêmicas, é necessário realizar a matrícula nas disciplinas 
                        do seu curso conforme o Plano de Ensino.
                      </p>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mt-3">
                        Entre em contato com a <strong>secretaria acadêmica</strong> para obter informações sobre o processo de matrícula em disciplinas e o calendário acadêmico.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SEÇÕES PRINCIPAIS */}
            <Tabs defaultValue="notas" className="space-y-4">
              <TabsList>
                <TabsTrigger value="notas">Minhas Notas</TabsTrigger>
                <TabsTrigger value="presencas">Minhas Presenças</TabsTrigger>
                <TabsTrigger value="boletim">Boletim</TabsTrigger>
                <TabsTrigger value="historico">Histórico Acadêmico</TabsTrigger>
                <TabsTrigger value="comunicacao">Comunicação</TabsTrigger>
              </TabsList>

              {/* Minhas Notas */}
              <TabsContent value="notas" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Matrícula Anual */}
                  {matriculaAnual && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Matrícula Anual</CardTitle>
                        <CardDescription>Informações da sua matrícula</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Ano Letivo</p>
                            <p className="font-medium">{matriculaAnual.anoLetivo || matriculaAnual.ano_letivo}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Status</p>
                            <Badge variant={matriculaAnual.status === 'ATIVA' ? 'default' : 'outline'}>
                              {matriculaAnual.status === 'ATIVA' ? 'Ativa' : matriculaAnual.status}
                            </Badge>
                          </div>
                          {matriculaAnual.curso && (
                            <div>
                              <p className="text-sm text-muted-foreground">Curso</p>
                              <p className="font-medium">{matriculaAnual.curso.nome}</p>
                            </div>
                          )}
                          {matriculaAnual.classeOuAnoCurso && (
                            <div>
                              <p className="text-sm text-muted-foreground">Ano/Classe</p>
                              <p className="font-medium">{matriculaAnual.classeOuAnoCurso}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Turmas Matriculadas */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Minhas Turmas</CardTitle>
                      <CardDescription>Turmas matriculadas</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {matriculas.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhuma turma matriculada.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {matriculas.map((matricula: any) => (
                            <div key={matricula.id} className="flex items-center justify-between p-2 rounded border">
                              <div>
                                <p className="font-medium">{matricula.turma?.nome || 'Turma'}</p>
                                <p className="text-sm text-muted-foreground">
                                  {matricula.turma?.curso?.nome || matricula.turma?.classe?.nome || 'Curso'}
                                </p>
                              </div>
                              <Badge variant="default">Ativa</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Disciplinas com Notas */}
                <Card>
                  <CardHeader>
                    <CardTitle>Minhas Disciplinas</CardTitle>
                    <CardDescription>Disciplinas do Plano de Ensino ativo com notas e frequência</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {materias.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        {temDisciplinas 
                          ? 'Nenhuma nota lançada ainda.'
                          : 'Nenhuma disciplina matriculada.'
                        }
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {materias.map((materia) => {
                          // REGRA ABSOLUTA: Nota só existe se houver avaliações reais lançadas
                          // (mesmo que a média seja 0, se houver avaliações, é uma nota real)
                          const temNota = materia.temAvaliacoes && 
                                         materia.media !== null && 
                                         materia.media !== undefined;
                          const isAprovado = temNota && materia.media >= 10;
                          const situacao = materia.situacao;
                          const frequencia = materia.frequencia;
                          
                          // REGRA ABSOLUTA: Frequência só existe se houver aulas lançadas
                          // Verificar se totalAulas > 0 (não apenas se percentual existe)
                          const temAulas = materia.temAulas && 
                                          frequencia?.totalAulas !== undefined && 
                                          frequencia.totalAulas !== null && 
                                          frequencia.totalAulas > 0;
                          const percentualFreq = temAulas && 
                                                 frequencia?.percentualFrequencia !== undefined && 
                                                 frequencia?.percentualFrequencia !== null
                            ? Number(frequencia.percentualFrequencia)
                            : null;
                          
                          // REGRA ABSOLUTA: Verificar bloqueio por frequência (só se houver aulas)
                          const frequenciaMinima = frequencia?.frequenciaMinima || 75;
                          const bloqueadoPorFrequencia = temAulas && 
                                                         percentualFreq !== null && 
                                                         percentualFreq < frequenciaMinima;
                          
                          // REGRA ABSOLUTA: Verificar se situação é reprovado por falta
                          const reprovadoPorFalta = situacao === 'REPROVADO_FALTA';
                          
                          return (
                            <div key={materia.id} className="space-y-3 p-4 rounded-lg border">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-lg">{materia.nome}</p>
                                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                    <p>Professor: {materia.professor}</p>
                                    <p>Carga Horária: {materia.cargaHoraria}h</p>
                                    {materia.semestre && (
                                      <p>Semestre: {materia.semestre}</p>
                                    )}
                                    {/* REGRA ABSOLUTA: Exibir frequência apenas se houver aulas lançadas */}
                                    {temAulas && percentualFreq !== null ? (
                                      <p className={bloqueadoPorFrequencia || reprovadoPorFalta ? 'text-destructive font-medium' : ''}>
                                        Frequência: {percentualFreq.toFixed(1)}%
                                        {bloqueadoPorFrequencia && ` (Abaixo do mínimo de ${frequenciaMinima}%)`}
                                        {reprovadoPorFalta && ' (Reprovado por falta)'}
                                      </p>
                                    ) : (
                                      <p className="text-muted-foreground">Frequência: —</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex items-center gap-2">
                                    {/* REGRA ABSOLUTA: Exibir "—" se não houver avaliações reais (nunca 0.0) */}
                                    <Badge 
                                      variant={
                                        situacao === 'APROVADO' ? 'default' : 
                                        situacao === 'REPROVADO' || situacao === 'REPROVADO_FALTA' ? 'destructive' : 
                                        'secondary'
                                      }
                                      className="text-base px-3 py-1"
                                    >
                                      {temNota ? materia.media.toFixed(1) : '—'}
                                    </Badge>
                                    {temNota && (
                                      isAprovado ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                      ) : (
                                        <XCircle className="h-5 w-5 text-destructive" />
                                      )
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {situacao === 'APROVADO' ? 'Aprovado' :
                                     situacao === 'REPROVADO' ? 'Reprovado' :
                                     situacao === 'REPROVADO_FALTA' ? 'Reprovado por Falta' :
                                     'Em Andamento'}
                                  </Badge>
                                </div>
                              </div>
                              {/* REGRA ABSOLUTA: Progress bar só se houver nota real */}
                              {temNota && (
                                <Progress value={materia.media * 5} className="h-2" />
                              )}
                              {/* REGRA ABSOLUTA: Alertas claros de bloqueio acadêmico (apenas se houver aulas lançadas) */}
                              {bloqueadoPorFrequencia && temAulas && percentualFreq !== null && (
                                <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                                  <div className="flex items-start gap-2">
                                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                      <p className="text-sm text-destructive font-medium">
                                        ⚠️ Bloqueio Acadêmico: Frequência Insuficiente
                                      </p>
                                      <p className="text-xs text-destructive/80 mt-1">
                                        Sua frequência está abaixo do mínimo exigido de {frequenciaMinima}%. 
                                        Você não poderá ser aprovado mesmo com nota suficiente.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {reprovadoPorFalta && temAulas && percentualFreq !== null && !bloqueadoPorFrequencia && (
                                <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                                  <div className="flex items-start gap-2">
                                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                      <p className="text-sm text-destructive font-medium">
                                        Reprovado por Falta
                                      </p>
                                      <p className="text-xs text-destructive/80 mt-1">
                                        Você foi reprovado por não atingir a frequência mínima exigida de {frequenciaMinima}%.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Minhas Presenças */}
              <TabsContent value="presencas" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Minhas Presenças</CardTitle>
                    <CardDescription>Controle de frequência</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {presencasData && presencasData.totalAulas > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {presencasData.presencas || 0}
                            </p>
                            <p className="text-sm text-muted-foreground">Presenças</p>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                              {presencasData.ausencias || 0}
                            </p>
                            <p className="text-sm text-muted-foreground">Ausências</p>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {presencasData.totalAulas || 0}
                            </p>
                            <p className="text-sm text-muted-foreground">Total de Aulas</p>
                          </div>
                        </div>
                        {frequenciaMedia !== null ? (
                          <div className="mt-4">
                            <p className="text-sm text-muted-foreground mb-2">Frequência Geral</p>
                            <Progress value={frequenciaMedia} className="h-3" />
                            <p className="text-sm font-medium mt-2">{frequenciaMedia.toFixed(1)}%</p>
                          </div>
                        ) : (
                          <div className="mt-4">
                            <p className="text-sm text-muted-foreground mb-2">Frequência Geral</p>
                            <p className="text-sm text-muted-foreground">—</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 space-y-2">
                        <p className="text-muted-foreground">
                          {temDisciplinas 
                            ? 'Ainda não há aulas lançadas.'
                            : 'Dados de presença ainda não disponíveis.'
                          }
                        </p>
                        {temDisciplinas && (
                          <p className="text-sm text-muted-foreground">
                            As frequências serão calculadas após o lançamento de aulas pelos professores.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Boletim */}
              <TabsContent value="boletim" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Meu Boletim</CardTitle>
                        <CardDescription>Boletim acadêmico completo</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/painel-aluno/boletim')}>
                        Ver Boletim Completo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {materias.length === 0 ? (
                      <div className="text-center py-8 space-y-2">
                        <p className="text-muted-foreground">
                          {temDisciplinas 
                            ? 'Nenhuma disciplina do Plano de Ensino ativo encontrada.'
                            : 'Nenhuma disciplina matriculada.'
                          }
                        </p>
                        {!temDisciplinas && (
                          <p className="text-sm text-muted-foreground">
                            Entre em contato com a secretaria acadêmica para realizar a matrícula nas disciplinas.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {materias.map((materia) => {
                          // REGRA ABSOLUTA: Nota só existe se houver avaliações reais lançadas
                          // (mesmo que a média seja 0, se houver avaliações, é uma nota real)
                          const temNota = materia.temAvaliacoes && 
                                         materia.media !== null && 
                                         materia.media !== undefined;
                          const isAprovado = temNota && materia.media !== null && materia.media >= 10;
                          const situacao = materia.situacao;
                          
                          return (
                            <div key={materia.id} className="space-y-2 p-3 rounded-lg border">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium">{materia.nome}</p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {materia.professor} • {materia.cargaHoraria}h
                                    {materia.semestre && ` • Semestre ${materia.semestre}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* REGRA ABSOLUTA: Exibir "—" se não houver avaliações reais (nunca 0.0) */}
                                  <Badge 
                                    variant={
                                      situacao === 'APROVADO' ? 'default' : 
                                      situacao === 'REPROVADO' || situacao === 'REPROVADO_FALTA' ? 'destructive' : 
                                      'secondary'
                                    }
                                  >
                                    {temNota && materia.media !== null ? materia.media.toFixed(1) : '—'}
                                  </Badge>
                                  {temNota && materia.media !== null && (
                                    isAprovado ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    )
                                  )}
                                </div>
                              </div>
                              {/* REGRA ABSOLUTA: Progress bar só se houver nota real */}
                              {temNota && materia.media !== null && (
                                <Progress value={materia.media * 5} className="h-2" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Histórico Acadêmico */}
              <TabsContent value="historico" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Histórico Acadêmico</CardTitle>
                        <CardDescription>Seu histórico completo</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/painel-aluno/historico')}>
                        Ver Histórico Completo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center text-muted-foreground py-8">
                      Visualize seu histórico acadêmico completo na página dedicada.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Comunicação */}
              <TabsContent value="comunicacao" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Comunicados Institucionais</CardTitle>
                        <CardDescription>Comunicados e avisos importantes</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/painel-aluno/comunicados')}>
                        Ver Mural Completo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {comunicados.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum comunicado disponível no momento.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {comunicados.map((comunicado: any) => (
                          <div key={comunicado.id} className="p-4 rounded-lg border bg-muted/50">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-medium">{comunicado.titulo || 'Comunicado'}</p>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {comunicado.conteudo || comunicado.mensagem || ''}
                                </p>
                                {comunicado.dataCriacao && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {format(new Date(comunicado.dataCriacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </p>
                                )}
                              </div>
                              {comunicado.tipo && (
                                <Badge variant="outline">{comunicado.tipo}</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AlunoDashboard;
