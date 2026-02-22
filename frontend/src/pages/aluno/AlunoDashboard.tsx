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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, FileText, BookOpen, Calendar, TrendingUp, Clock, CheckCircle2, XCircle, LogOut, CreditCard, ClipboardCheck, Users, GraduationCap, Info, ChevronRight, Printer, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeToFixed } from '@/lib/utils';

const AlunoDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const { isSecundario, tipoAcademico, config: instituicaoConfig } = useInstituicao();
  const navigate = useNavigate();
  const [anoLetivoSelecionado, setAnoLetivoSelecionado] = useState<number | null>(null);
  const [semestreNotasSelecionado, setSemestreNotasSelecionado] = useState<string>('1');
  const [tabAtivo, setTabAtivo] = useState<string>('notas');
  const [imprimindoMedias, setImprimindoMedias] = useState(false);

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
        const diaHoje = new Date().getDay(); // 0=Domingo, 1=Segunda, ...
        
        const allHorarios = await Promise.all(
          turmaIds.map((id: string) => horariosApi.getAll({ turmaId: id }).catch((err: any) => {
            console.error(`[AlunoDashboard] Erro ao buscar horários da turma ${id}:`, err);
            return [];
          }))
        );
        
        const horariosFiltrados = allHorarios.flat().filter((h: any) => 
          (h.diaSemana ?? h.dia_semana) === diaHoje
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

  // Fetch histórico académico (quando aba Histórico ativa ou ao montar se já tem ano)
  const { data: historicoPreview, isLoading: historicoPreviewLoading, error: historicoPreviewError } = useQuery({
    queryKey: ['aluno-historico-preview', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        return await relatoriosApi.getHistoricoEscolar(user.id);
      } catch (err: any) {
        console.error('[AlunoDashboard] Erro ao buscar histórico:', err?.response?.data || err);
        throw err;
      }
    },
    enabled: !!user?.id && (tabAtivo === 'historico' || !!anoLetivoSelecionado),
    retry: 2,
  });

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
      const formulaAplicada = String(detalhesNotas.formula_aplicada ?? '');
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
      
      const turmaNome = disciplina.turma?.nome || '—';
      const cursoOuClasse = isSecundario ? (disciplina.classe?.nome || 'Tronco Comum') : (disciplina.curso?.nome || 'Tronco Comum');
      return {
        id: disciplina.planoEnsinoId || disciplina.disciplina?.id || 'N/A',
        nome: disciplina.disciplina?.nome || 'Disciplina',
        media: mediaFinal, // null se não houver avaliações (nunca 0.0)
        professor: disciplina.professor?.nomeCompleto || '—',
        cargaHoraria: disciplina.disciplina?.cargaHoraria || 0,
        situacao,
        frequencia,
        semestre: disciplina.semestre || null,
        temAvaliacoes: temNotasLancadas,
        temAulas,
        notasIndividuais: notasUtilizadas as Array<{ tipo: string; valor: number; peso?: number }>,
        turmaNome,
        cursoOuClasse,
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

  // Helper: extrair nota por tipo (Universidade - P1, P2, P3/Exame)
  // Backend retorna tipo "P1", "P2", "P3", "Trabalho", "Exame de Recurso"
  const getNotaUniversidade = (notas: Array<{ tipo: string; valor: number }> | undefined, col: 'av1' | 'av2' | 'exame'): number | null => {
    if (!notas?.length) return null;
    const t = (s: string) => String(s ?? '').toLowerCase().trim();
    for (const n of notas) {
      const tipo = t(n.tipo);
      if (col === 'av1' && (tipo === 'p1' || (tipo.includes('1') && (tipo.includes('prova') || tipo.includes('avalia'))))) return n.valor;
      if (col === 'av2' && (tipo === 'p2' || (tipo.includes('2') && (tipo.includes('prova') || tipo.includes('avalia'))))) return n.valor;
      if (col === 'exame' && (tipo === 'p3' || tipo.includes('recurso') || tipo.includes('prova_final') || (tipo.includes('3') && (tipo.includes('prova') || tipo.includes('exame'))))) return n.valor;
    }
    const provas = notas.filter(n => t(n.tipo) === 'prova' || t(n.tipo) === 'p1' || t(n.tipo) === 'p2' || t(n.tipo) === 'p3');
    const extras = notas.filter(n => t(n.tipo).includes('recurso') || t(n.tipo).includes('prova_final'));
    if (col === 'av1') return provas[0]?.valor ?? null;
    if (col === 'av2') return provas[1]?.valor ?? null;
    if (col === 'exame') return provas[2]?.valor ?? extras[0]?.valor ?? null;
    return null;
  };

  // Helper: extrair valor por trimestre (Ensino Secundário)
  // Backend retorna tipo "1º Trimestre", "2º Trimestre", "3º Trimestre"
  const getNotaTrimestre = (notas: Array<{ tipo: string; valor: number }> | undefined, trim: 1 | 2 | 3): number | null => {
    if (!notas?.length) return null;
    for (const n of notas) {
      const t = String(n.tipo ?? '').toLowerCase();
      if (t.startsWith(`${trim}º`) || t.startsWith(`${trim}º trimestre`) || (t.includes('trim') && new RegExp(`(^|\\D)${trim}(\\D|$)`).test(t))) {
        return n.valor;
      }
    }
    const vals: number[] = [];
    const tipoLower = (s: string) => String(s ?? '').toLowerCase();
    for (const n of notas) {
      const t = tipoLower(n.tipo);
      const hasNum = (x: number) => new RegExp(`(^|\\D)${x}(\\D|$)`).test(t);
      if ((t.includes('trim') || t.includes('1t') || t.includes('2t') || t.includes('3t')) && hasNum(trim)) vals.push(n.valor);
    }
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  // Processar disciplina do boletim API para estrutura unificada (usado na impressão)
  const processarDisciplinaBoletim = (disciplina: any) => {
    const notasInfo = disciplina.notas || {};
    const detalhesNotas = notasInfo.detalhes || {};
    const notasUtilizadas = (detalhesNotas.notas_utilizadas || []) as Array<{ tipo: string; valor: number; peso?: number }>;
    const formulaAplicada = String(detalhesNotas.formula_aplicada ?? '').toLowerCase();
    const temNotasLancadas = notasUtilizadas.length > 0 && !formulaAplicada.includes('nenhuma nota') && !formulaAplicada.includes('aguardando');
    const mediaFinal = temNotasLancadas && notasInfo.mediaFinal != null ? Number(notasInfo.mediaFinal) : null;
    const situacao = disciplina.situacaoAcademica || (temNotasLancadas && mediaFinal != null && mediaFinal >= 10 ? 'APROVADO' : 'REPROVADO') || 'EM_ANDAMENTO';
    return { notasUtilizadas, mediaFinal, temNotasLancadas, situacao, turmaNome: disciplina.turma?.nome || '—', cursoOuClasse: isSecundario ? (disciplina.classe?.nome || 'Tronco Comum') : (disciplina.curso?.nome || 'Tronco Comum'), semestre: disciplina.semestre };
  };

  // Imprimir médias de todos os anos (Superior: semestral | Secundário: trimestral)
  const handleImprimirMedias = async () => {
    if (!user?.id || anosLetivos.length === 0) {
      toast.error('Nenhum ano letivo disponível para impressão.');
      return;
    }
    setImprimindoMedias(true);
    try {
      const matriculasAnuais = await matriculasAnuaisApi.getByAluno(user.id);
      const mapaClassePorAno = Object.fromEntries(
        (matriculasAnuais || []).map((m: any) => [m.anoLetivo ?? m.ano_letivo, m.classeOuAnoCurso || m.classe_ou_ano_curso || '—'])
      );
      const boletins = await Promise.all(
        anosLetivos.map(async (ano: any) => {
          const anoNum = ano.anoLetivo ?? ano.ano_letivo ?? 0;
          try {
            const data = await relatoriosApi.getBoletimAluno(user!.id, { anoLetivo: anoNum });
            return { ano: anoNum, disciplinas: (data?.disciplinas || []).map((d: any) => ({ ...processarDisciplinaBoletim(d), nome: d.disciplina?.nome || 'Disciplina' })) };
          } catch {
            return { ano: anoNum, disciplinas: [] };
          }
        })
      );
      const nomeInst = instituicaoConfig?.nome_instituicao || instituicaoConfig?.nomeInstituicao || 'Instituição de Ensino';
      const logoUrl = instituicaoConfig?.logo_url || instituicaoConfig?.logoUrl;
      const alunoNome = user?.nome_completo || user?.nomeCompleto || 'Estudante';
      const tituloSec = isSecundario ? 'Notas por Trimestre (Ensino Secundário)' : 'Notas por Semestre (Ensino Superior)';
      const colunasSec = isSecundario
        ? ['Disciplina', 'Ano', 'Classe', 'Turma', '1º Trim', '2º Trim', '3º Trim', 'Média', 'Situação']
        : ['Disciplina', 'Ano', 'Semestre', 'Turma', 'Aval. 1', 'Aval. 2', 'Exame', 'Média', 'Situação'];
      let tabelasHtml = '';
      boletins.forEach(({ ano, disciplinas }) => {
        if (disciplinas.length === 0) return;
        const classeAno = mapaClassePorAno[ano] || '—';
        let linhas = '';
        disciplinas.forEach((m: any) => {
          const t1 = getNotaTrimestre(m.notasUtilizadas, 1);
          const t2 = getNotaTrimestre(m.notasUtilizadas, 2);
          const t3 = getNotaTrimestre(m.notasUtilizadas, 3);
          const av1 = getNotaUniversidade(m.notasUtilizadas, 'av1');
          const av2 = getNotaUniversidade(m.notasUtilizadas, 'av2');
          const exame = getNotaUniversidade(m.notasUtilizadas, 'exame');
          const mediaStr = m.temNotasLancadas && m.mediaFinal != null ? safeToFixed(m.mediaFinal, 1) : '—';
          const sit = m.situacao === 'APROVADO' ? 'Aprovado' : m.situacao === 'REPROVADO' || m.situacao === 'REPROVADO_FALTA' ? 'Reprovado' : 'Em Andamento';
          const cels = isSecundario
            ? [m.nome, ano, classeAno, m.turmaNome, t1 != null ? safeToFixed(t1, 1) : '—', t2 != null ? safeToFixed(t2, 1) : '—', t3 != null ? safeToFixed(t3, 1) : '—', mediaStr, sit]
            : [m.nome, ano, m.semestre ? `${m.semestre}º Sem` : '—', m.turmaNome, av1 != null ? safeToFixed(av1, 1) : '—', av2 != null ? safeToFixed(av2, 1) : '—', exame != null ? safeToFixed(exame, 1) : '—', mediaStr, sit];
          linhas += `<tr>${cels.map((c) => `<td style="padding:6px;border:1px solid #ccc;">${c}</td>`).join('')}</tr>`;
        });
        const headers = colunasSec.map((h) => `<th style="padding:8px;border:1px solid #333;background:#f0f0f0;font-weight:bold;">${h}</th>`).join('');
        tabelasHtml += `<div style="margin-bottom:24px;"><h3 style="margin:16px 0 8px 0;font-size:14pt;">Ano Letivo ${ano}</h3><table style="width:100%;border-collapse:collapse;font-size:10pt;"><thead><tr>${headers}</tr></thead><tbody>${linhas}</tbody></table></div>`;
      });
      if (!tabelasHtml) {
        toast.info('Nenhum dado de médias disponível para imprimir.');
        return;
      }
      const printWin = window.open('', '_blank');
      if (!printWin) {
        toast.error('Permita pop-ups para imprimir.');
        return;
      }
      const logoImg = logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:48px;margin-bottom:8px;" onerror="this.style.display='none'"/>` : '';
      printWin.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Minhas Médias e Notas - ${alunoNome}</title>
  <style>
    @page { margin: 2cm; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 10pt; line-height: 1.4; padding: 16px; }
    h1 { font-size: 16pt; margin-bottom: 4px; }
    h2 { font-size: 12pt; margin: 8px 0; color: #374151; }
    .header { text-align: center; margin-bottom: 20px; }
    .aluno { font-size: 11pt; margin: 8px 0; }
    .data-emissao { font-size: 9pt; color: #6b7280; margin-top: 12px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">${logoImg}
  <h1>${nomeInst}</h1>
  <h2>${tituloSec}</h2>
  <p class="aluno"><strong>Aluno:</strong> ${alunoNome}</p>
  <p class="data-emissao">Emitido em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
  </div>
  ${tabelasHtml}
</body>
</html>`);
      printWin.document.close();
      setTimeout(() => {
        printWin.print();
      }, 300);
      toast.success('Impressão aberta. Use Ctrl+P para imprimir.');
    } catch (err: any) {
      toast.error('Erro ao gerar impressão: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setImprimindoMedias(false);
    }
  };

  // Filtrar materias por semestre (Universidade)
  const materiasFiltradas = useMemo(() => {
    if (!isSecundario && semestreNotasSelecionado) {
      return materias.filter((m: any) => !m.semestre || String(m.semestre) === semestreNotasSelecionado);
    }
    return materias;
  }, [materias, isSecundario, semestreNotasSelecionado]);

  // Resumo para o rodapé
  const disciplinasAprovadas = materiasFiltradas.filter((m: any) => m.situacao === 'APROVADO').length;
  const disciplinasReprovadas = materiasFiltradas.filter((m: any) => m.situacao === 'REPROVADO' || m.situacao === 'REPROVADO_FALTA').length;
  const mediaFinalResumo = materiasFiltradas
    .filter((m: any) => m.temAvaliacoes && m.media != null)
    .reduce((acc: number, m: any) => acc + m.media, 0);
  const totalComNota = materiasFiltradas.filter((m: any) => m.temAvaliacoes && m.media != null).length;
  const mediaFinalNum = totalComNota > 0 ? mediaFinalResumo / totalComNota : null;
  const statusFinal = disciplinasReprovadas > 0 ? 'Reprovado' : disciplinasAprovadas > 0 ? 'Aprovado' : 'Em Andamento';

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
        {/* Header compacto */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Olá, {user?.nome_completo?.split(' ')[0] || 'Estudante'}!
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Painel acadêmico · Acompanhe seu desempenho
            </p>
          </div>
          {anosLetivos.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground shrink-0">Ano Letivo</label>
              <Select
                value={anoLetivoSelecionado?.toString() || ''}
                onValueChange={(value) => setAnoLetivoSelecionado(Number(value))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {anosLetivos.map((ano: any) => (
                    <SelectItem key={ano.anoLetivo} value={ano.anoLetivo.toString()}>
                      {ano.anoLetivo}
                      {ano.status === 'ATIVA' && ' · Ativo'}
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

        {/* Contexto acadêmico */}
        {anoLetivoSelecionado && matriculaAnual && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 pt-4">
                <CardDescription className="text-xs">Ano Letivo</CardDescription>
                <CardTitle className="text-xl">{anoLetivoSelecionado}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 pt-4">
                <CardDescription className="text-xs">Curso</CardDescription>
                <CardTitle className="text-lg truncate">
                  {matriculaAnual.curso?.nome || matriculaAnual.cursoNome || '-'}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 pt-4">
                <CardDescription className="text-xs">
                  {isSecundario ? 'Classe' : tipoAcademico === 'SUPERIOR' ? 'Ano' : 'Turma'}
                </CardDescription>
                <CardTitle className="text-lg">
                  {isSecundario ? (
                    matriculaAnual.classeOuAnoCurso || '—'
                  ) : tipoAcademico === 'SUPERIOR' ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1 cursor-help">
                            {matriculaAnual.classeOuAnoCurso || '—'}
                            {!temDisciplinas && <Info className="h-3 w-3 text-muted-foreground" />}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p className="text-xs">
                            {disciplinasMatriculadas[0]?.semestre 
                              ? `1º Ano · Semestre ${disciplinasMatriculadas[0].semestre} do Plano de Ensino.`
                              : 'Ano do curso conforme matrícula anual (1º Ano, 2º Ano, etc.).'
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

        {/* Indicadores de desempenho */}
        {anoLetivoSelecionado && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="overflow-hidden">
                <CardHeader className="pb-2 pt-4">
                  <CardDescription className="text-xs">Média Geral</CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl">
                    {mediaGeral !== null ? safeToFixed(mediaGeral, 1) : '—'}
                  </CardTitle>
                  {mediaGeral === null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Sem avaliações lançadas
                    </p>
                  )}
                  {anoLetivoSelecionado && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 -ml-2 h-8 text-xs font-medium text-primary hover:text-primary"
                      onClick={() => setTabAtivo('medias-finais')}
                    >
                      Ver minhas médias →
                    </Button>
                  )}
                </CardHeader>
              </Card>
              <Card className="overflow-hidden">
                <CardHeader className="pb-2 pt-4">
                  <CardDescription className="text-xs">Frequência</CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl">
                    {frequenciaMedia !== null ? `${safeToFixed(frequenciaMedia, 0)}%` : '—'}
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
              <Card className="overflow-hidden">
                <CardHeader className="pb-2 pt-4">
                  <CardDescription className="text-xs">Situação</CardDescription>
                  <CardTitle className="text-xl sm:text-2xl">
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
              <Card className="overflow-hidden">
                <CardHeader className="pb-2 pt-4">
                  <CardDescription className="text-xs">Mensalidades</CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl">
                    {mensalidadesLoading ? '—' : mensalidadesPendentes.length}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {mensalidadesPendentes.length === 0 ? 'Nenhuma pendente' : 'pendente(s)'}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 -ml-2 h-8 text-xs font-medium text-primary hover:text-primary"
                    onClick={() => navigate('/painel-aluno/mensalidades')}
                  >
                    <Wallet className="h-3 w-3 mr-1" />
                    Ver Minhas Mensalidades →
                  </Button>
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

            {/* Aulas de Hoje - priorizado quando houver horários */}
            {horariosHoje.length > 0 && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Aulas de Hoje</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Próximos horários do dia</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {horariosHoje.slice(0, 5).map((h: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-sm">
                        <span className="font-medium">{h.turma?.nome || h.turma?.disciplina?.nome || 'Aula'}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {h.horaInicio || h.hora_inicio || '--:--'} - {h.horaFim || h.hora_fim || '--:--'}
                        </span>
                      </div>
                    ))}
                    {horariosHoje.length > 5 && (
                      <p className="text-xs text-muted-foreground pt-1">+ {horariosHoje.length - 5} mais</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SEÇÕES PRINCIPAIS */}
            <Tabs value={tabAtivo} onValueChange={setTabAtivo} className="space-y-4">
              <TabsList className="flex w-full flex-nowrap overflow-x-auto gap-1">
                <TabsTrigger value="notas" className="shrink-0">Minhas Notas</TabsTrigger>
                <TabsTrigger value="medias-finais" className="shrink-0">Minhas Médias</TabsTrigger>
                <TabsTrigger value="presencas" className="shrink-0">Presenças</TabsTrigger>
                <TabsTrigger value="boletim" className="shrink-0">Boletim</TabsTrigger>
                <TabsTrigger value="historico" className="shrink-0">Histórico</TabsTrigger>
                <TabsTrigger value="comunicacao" className="shrink-0">Comunicação</TabsTrigger>
              </TabsList>

              {/* Minhas Notas */}
              <TabsContent value="notas" className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Matrícula Anual */}
                  {matriculaAnual && (
                    <Card className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Matrícula Anual</CardTitle>
                        <CardDescription className="text-xs">Informações da sua matrícula</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-2 gap-3 text-sm">
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
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Minhas Turmas</CardTitle>
                      <CardDescription className="text-xs">Turmas matriculadas</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {matriculas.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhuma turma matriculada.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {matriculas.map((matricula: any) => (
                            <div key={matricula.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/30 text-sm">
                              <div>
                                <p className="font-medium">{matricula.turma?.nome || 'Turma'}</p>
                                <p className="text-sm text-muted-foreground">
                                  {isSecundario ? (matricula.turma?.classe?.nome || 'Classe') : (matricula.turma?.curso?.nome || 'Curso')}
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

                {/* Disciplinas com Notas - Tabela estilo painel */}
                <Card className="overflow-hidden">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          {isSecundario 
                            ? `Notas do ${matriculaAnual?.classeOuAnoCurso || 'Ano Letivo'}`
                            : materias.some((m: any) => m.semestre) 
                              ? `Notas do ${semestreNotasSelecionado}º Semestre`
                              : 'Minhas Disciplinas'
                          }
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {isSecundario 
                            ? 'Notas por trimestre e situação final'
                            : 'Avaliações, exame e média por disciplina'
                          }
                        </CardDescription>
                      </div>
                      {!isSecundario && materias.some((m: any) => m.semestre) && (
                        <Tabs value={semestreNotasSelecionado} onValueChange={setSemestreNotasSelecionado} className="w-auto">
                          <TabsList className="h-9">
                            <TabsTrigger value="1" className="px-3">1º Semestre</TabsTrigger>
                            <TabsTrigger value="2" className="px-3">2º Semestre</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {materiasFiltradas.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        {temDisciplinas 
                          ? 'Nenhuma nota lançada ainda.'
                          : 'Nenhuma disciplina matriculada.'
                        }
                      </p>
                    ) : (
                      <>
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[180px]">Disciplina</TableHead>
                                <TableHead className="min-w-[120px] hidden sm:table-cell">Professor</TableHead>
                                {isSecundario ? (
                                  <>
                                    <TableHead className="text-center min-w-[90px]">1º Trimestre</TableHead>
                                    <TableHead className="text-center min-w-[90px]">2º Trimestre</TableHead>
                                    <TableHead className="text-center min-w-[90px]">3º Trimestre</TableHead>
                                  </>
                                ) : (
                                  <>
                                    <TableHead className="text-center min-w-[90px]">Avaliação 1</TableHead>
                                    <TableHead className="text-center min-w-[90px]">Avaliação 2</TableHead>
                                    <TableHead className="text-center min-w-[90px]">Exame</TableHead>
                                    <TableHead className="text-center min-w-[90px]">Média</TableHead>
                                  </>
                                )}
                                <TableHead className="text-center min-w-[100px]">Situação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {materiasFiltradas.map((materia: any) => {
                                const statusLabel = materia.situacao === 'APROVADO' ? 'Aprovado' :
                                  materia.situacao === 'REPROVADO' ? 'Reprovado' :
                                  materia.situacao === 'REPROVADO_FALTA' ? 'Reprovado por Falta' : 'Em Andamento';
                                const statusVariant = materia.situacao === 'APROVADO' ? 'default' : 
                                  materia.situacao === 'REPROVADO' || materia.situacao === 'REPROVADO_FALTA' ? 'destructive' : 'secondary';
                                
                                if (isSecundario) {
                                  const t1 = getNotaTrimestre(materia.notasIndividuais, 1);
                                  const t2 = getNotaTrimestre(materia.notasIndividuais, 2);
                                  const t3 = getNotaTrimestre(materia.notasIndividuais, 3);
                                  return (
                                    <TableRow key={materia.id}>
                                      <TableCell>
                                        <div>
                                          <p className="font-medium">{materia.nome}</p>
                                          <p className="text-xs text-muted-foreground sm:hidden">{materia.professor}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{materia.professor}</TableCell>
                                      <TableCell className="text-center">{t1 != null ? safeToFixed(t1, 1) : '—'}</TableCell>
                                      <TableCell className="text-center">{t2 != null ? safeToFixed(t2, 1) : '—'}</TableCell>
                                      <TableCell className="text-center">{t3 != null ? safeToFixed(t3, 1) : '—'}</TableCell>
                                      <TableCell className="text-center">
                                        <Badge variant={statusVariant}>{statusLabel}</Badge>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                const av1 = getNotaUniversidade(materia.notasIndividuais, 'av1');
                                const av2 = getNotaUniversidade(materia.notasIndividuais, 'av2');
                                const exame = getNotaUniversidade(materia.notasIndividuais, 'exame');
                                return (
                                  <TableRow key={materia.id}>
                                    <TableCell>
                                        <div>
                                          <p className="font-medium">{materia.nome}</p>
                                          <p className="text-xs text-muted-foreground sm:hidden">{materia.professor}</p>
                                        </div>
                                      </TableCell>
                                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{materia.professor}</TableCell>
                                    <TableCell className="text-center">{av1 != null ? safeToFixed(av1, 1) : '—'}</TableCell>
                                    <TableCell className="text-center">{av2 != null ? safeToFixed(av2, 1) : '—'}</TableCell>
                                    <TableCell className="text-center">{exame != null ? safeToFixed(exame, 1) : '—'}</TableCell>
                                    <TableCell className="text-center font-medium">
                                      {materia.media != null ? safeToFixed(materia.media, 1) : '—'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        {/* Resumo no rodapé */}
                        {materiasFiltradas.length > 0 && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 mt-4 border-t text-sm">
                            <span>
                              Disciplinas Aprovadas: <span className="font-semibold text-green-600 dark:text-green-400">{disciplinasAprovadas}</span>
                            </span>
                            <span className="text-muted-foreground">|</span>
                            <span>
                              Disciplinas Reprovadas: <span className="font-semibold text-red-600 dark:text-red-400">{disciplinasReprovadas}</span>
                            </span>
                            {mediaFinalNum != null && (
                              <>
                                <span className="text-muted-foreground">|</span>
                                <span>
                                  Média Final: <span className="font-semibold">{safeToFixed(mediaFinalNum, 1)}</span>
                                </span>
                              </>
                            )}
                            <span className="text-muted-foreground">|</span>
                            <span>
                              Status Final: <Badge variant={statusFinal === 'Aprovado' ? 'default' : statusFinal === 'Reprovado' ? 'destructive' : 'secondary'}>{statusFinal}</Badge>
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Médias Finais - vista simplificada (só classificações finais) */}
              <TabsContent value="medias-finais" className="space-y-6">
                <Card className="overflow-hidden">
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-base">Classificações das Médias Finais</CardTitle>
                        <CardDescription className="text-xs">
                          {isSecundario 
                            ? 'Vista resumida das suas médias por disciplina (Ensino Secundário)'
                            : 'Vista resumida das suas médias por disciplina'}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleImprimirMedias}
                        disabled={imprimindoMedias || anosLetivos.length === 0}
                        className="shrink-0"
                      >
                        {imprimindoMedias ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4 mr-2" />
                        )}
                        Imprimir todas as médias
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {materiasFiltradas.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        {temDisciplinas 
                          ? 'Nenhuma nota lançada ainda.'
                          : 'Nenhuma disciplina matriculada.'}
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-primary/10">
                              <TableHead className="min-w-[200px] font-semibold">Disciplina</TableHead>
                              <TableHead className="min-w-[90px]">Ano Lectivo</TableHead>
                              <TableHead className="min-w-[100px]">Turma</TableHead>
                              <TableHead className="min-w-[110px]">
                                {isSecundario ? 'Tipo' : 'Semestre'}
                              </TableHead>
                              <TableHead className="text-center min-w-[100px] font-semibold">Classificação</TableHead>
                              <TableHead className="min-w-[130px]">Especialização</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {materiasFiltradas.map((materia: any) => (
                              <TableRow key={materia.id}>
                                <TableCell className="font-medium">{materia.nome}</TableCell>
                                <TableCell>{anoLetivoSelecionado ?? '—'}</TableCell>
                                <TableCell>{materia.turmaNome || '—'}</TableCell>
                                <TableCell>
                                  {isSecundario 
                                    ? (matriculaAnual?.classeOuAnoCurso || '—')
                                    : (materia.semestre ? `${materia.semestre}º Semestre` : '—')}
                                </TableCell>
                                <TableCell className="text-center font-semibold">
                                  {materia.temAvaliacoes && materia.media != null 
                                    ? safeToFixed(materia.media, 1) 
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {materia.cursoOuClasse || 'Tronco Comum'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {materiasFiltradas.length > 0 && mediaFinalNum != null && (
                      <div className="mt-4 pt-4 border-t text-sm flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          Média Geral: <span className="font-semibold">{safeToFixed(mediaFinalNum, 1)}</span>
                        </span>
                        <span className="text-muted-foreground">|</span>
                        <span>
                          Status: <Badge variant={statusFinal === 'Aprovado' ? 'default' : statusFinal === 'Reprovado' ? 'destructive' : 'secondary'}>{statusFinal}</Badge>
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Minhas Presenças */}
              <TabsContent value="presencas" className="space-y-6">
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-base">Minhas Presenças</CardTitle>
                    <CardDescription className="text-xs">Controle de frequência nas aulas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {presencasData && presencasData.totalAulas > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {presencasData.presencas || 0}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Presenças</p>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                              {presencasData.ausencias || 0}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Ausências</p>
                          </div>
                          <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/20">
                            <p className="text-2xl font-bold text-primary">
                              {presencasData.totalAulas || 0}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Total de Aulas</p>
                          </div>
                        </div>
                        {frequenciaMedia !== null ? (
                          <div className="mt-4">
                            <p className="text-sm text-muted-foreground mb-2">Frequência Geral</p>
                            <Progress value={frequenciaMedia} className="h-3" />
                            <p className="text-sm font-medium mt-2">{safeToFixed(frequenciaMedia, 1)}%</p>
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
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>Meu Boletim</CardTitle>
                        <CardDescription>Visão consolidada das suas notas e médias</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/painel-aluno/boletim')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Ver Boletim Completo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {materias.length === 0 ? (
                      <div className="text-center py-8 space-y-2">
                        <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
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
                      <div className="space-y-3">
                        {materias.map((materia) => {
                          const temNota = materia.temAvaliacoes && 
                                         materia.media !== null && 
                                         materia.media !== undefined;
                          const isAprovado = temNota && materia.media !== null && materia.media >= 10;
                          const situacao = materia.situacao;
                          
                          return (
                            <div key={materia.id} className="rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">{materia.nome}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {materia.professor} • {materia.cargaHoraria}h
                                    {materia.semestre && ` • Semestre ${materia.semestre}`}
                                  </p>
                                  {(materia.notasIndividuais?.length ?? 0) > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {materia.notasIndividuais!.map((n, idx) => (
                                        <span key={idx} className="text-xs text-muted-foreground">
                                          <span className="font-medium">{n.tipo}:</span> {safeToFixed(n.valor, 1)}
                                        </span>
                                      ))}
                                      <span className="text-xs font-semibold text-primary">
                                        Média: {temNota && materia.media !== null ? safeToFixed(materia.media, 1) : '—'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge 
                                    variant={
                                      situacao === 'APROVADO' ? 'default' : 
                                      situacao === 'REPROVADO' || situacao === 'REPROVADO_FALTA' ? 'destructive' : 
                                      'secondary'
                                    }
                                    className="min-w-[2.5rem] justify-center"
                                  >
                                    {temNota && materia.media !== null ? safeToFixed(materia.media, 1) : '—'}
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
                              {temNota && materia.media !== null && (
                                <Progress value={materia.media * 5} className="h-2 mt-2" />
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
                <Card className="overflow-hidden">
                  <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-base">Histórico Acadêmico</CardTitle>
                        <CardDescription className="text-xs">Todas as disciplinas e notas por ano letivo</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/painel-aluno/historico')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Ver Histórico Completo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {historicoPreviewLoading ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">A carregar histórico...</span>
                      </div>
                    ) : historicoPreviewError ? (
                      <div className="py-6 text-center space-y-2">
                        <XCircle className="h-10 w-10 mx-auto text-destructive" />
                        <p className="text-sm font-medium text-destructive">Erro ao carregar histórico</p>
                        <p className="text-xs text-muted-foreground">
                          {(historicoPreviewError as any)?.response?.data?.message || 'Tente novamente ou aceda à página completa.'}
                        </p>
                      </div>
                    ) : historicoPreview?.historico?.length ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {historicoPreview.historico.length} ano(s) letivo(s) no histórico.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Clique em &quot;Ver Histórico Completo&quot; para ver todos os detalhes.
                        </p>
                      </div>
                    ) : materias.length > 0 && anoLetivoSelecionado ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Dados do ano letivo <strong>{anoLetivoSelecionado}</strong> em curso.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          O histórico oficial é gerado quando o ano letivo é encerrado. Abaixo estão as suas disciplinas e classificações actuais.
                        </p>
                        <div className="rounded-md border overflow-x-auto mt-3">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Disciplina</TableHead>
                                <TableHead className="text-center">Média</TableHead>
                                <TableHead className="text-center">Situação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {materias.map((m: any) => {
                                const statusLabel = m.situacao === 'APROVADO' ? 'Aprovado' : m.situacao === 'REPROVADO' || m.situacao === 'REPROVADO_FALTA' ? 'Reprovado' : 'Em Andamento';
                                return (
                                  <TableRow key={m.id}>
                                    <TableCell className="font-medium">{m.nome}</TableCell>
                                    <TableCell className="text-center">
                                      {m.temAvaliacoes && m.media != null ? safeToFixed(m.media, 1) : '—'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={m.situacao === 'APROVADO' ? 'default' : m.situacao === 'REPROVADO' || m.situacao === 'REPROVADO_FALTA' ? 'destructive' : 'secondary'}>
                                        {statusLabel}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center space-y-2">
                        <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          {historicoPreview?.aviso || 'O histórico académico é gerado quando um ano letivo é encerrado.'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {historicoPreviewError ? 'Ocorreu um erro ao carregar. ' : ''}
                          Aceda à página completa para mais informações.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Comunicação */}
              <TabsContent value="comunicacao" className="space-y-6">
                <Card className="overflow-hidden">
                  <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-base">Comunicados Institucionais</CardTitle>
                        <CardDescription className="text-xs">Avisos e comunicados da instituição</CardDescription>
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
                          <div key={comunicado.id} className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
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
