import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { turmasApi, matriculasApi, notasApi, profilesApi, aulasLancadasApi, avaliacoesApi, notasAvaliacaoApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AnoLetivoContextHeader } from '@/components/dashboard/AnoLetivoContextHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Loader2, BookOpen, ClipboardCheck, ClipboardList, Calendar, Clock, 
  ChevronRight, Sun, Sunset, Moon, FileText, TrendingUp,
  AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { safeToFixed } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';

const ProfessorDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isSecundario } = useInstituicao();
  const { hasAnoLetivoAtivo, anoLetivo, anoLetivoId } = useAnoLetivoAtivo();
  const navigate = useNavigate();

  // Fetch professor profile
  const { data: profile } = useQuery({
    queryKey: ['professor-profile', user?.id],
    queryFn: async () => {
      const data = await profilesApi.getById(user!.id);
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch turmas e disciplinas do professor
  // REGRA ABSOLUTA: Usar GET /turmas/professor SEM enviar professorId, instituicaoId ou anoLetivoId
  // O backend extrai professorId, instituicaoId e tipoAcademico automaticamente do JWT (req.user)
  // IMPORTANTE: Backend sempre retorna 200 OK com formato: { anoLetivo, turmas: [], disciplinasSemTurma: [] }
  // Arrays vazios são estados válidos, não erros
  // FRONTEND NÃO DECIDE TIPO ACADÊMICO - Backend já retorna dados prontos
  const { data: turmasData, isLoading: turmasLoading, error: turmasError, refetch: refetchTurmas } = useQuery({
    queryKey: ['professor-turmas-dashboard', user?.id, anoLetivoId, 'incluir-pendentes'],
    queryFn: async () => {
      if (!user?.id) {
        return { anoLetivo: null, turmas: [], disciplinasSemTurma: [] };
      }

      try {
        // REGRA ABSOLUTA: NÃO enviar professorId, instituicaoId ou anoLetivoId - o backend extrai do JWT
        // Backend busca automaticamente o ano letivo ATIVO e resolve tipoAcademico
        const params: { incluirPendentes?: boolean; anoLetivoId?: string } = {
          incluirPendentes: true
        };
        if (anoLetivoId) {
          params.anoLetivoId = anoLetivoId;
        }
        
        // REGRA: Apenas parâmetros opcionais - nunca IDs sensíveis
        const data = await turmasApi.getTurmasProfessor(params);
        
        // Backend retorna formato padronizado { anoLetivo, turmas: [], disciplinasSemTurma: [] }
        // Garantir parsing robusto: suportar data direto ou aninhado (response.data)
        const raw = data && typeof data === 'object' ? data : {};
        const turmas = Array.isArray(raw.turmas) ? raw.turmas : (Array.isArray((raw as any)?.data?.turmas) ? (raw as any).data.turmas : []);
        const disciplinasSemTurma = Array.isArray(raw.disciplinasSemTurma) ? raw.disciplinasSemTurma : (Array.isArray((raw as any)?.data?.disciplinasSemTurma) ? (raw as any).data.disciplinasSemTurma : []);
        
        return {
          anoLetivo: raw.anoLetivo ?? (raw as any)?.data?.anoLetivo ?? null,
          turmas,
          disciplinasSemTurma
        };
      } catch (error: any) {
        // REGRA: Erros 400/403 (Professor não cadastrado) devem ser propagados para exibir CTA
        if ([400, 401, 403].includes(error?.response?.status ?? 0)) {
          throw error;
        }
        
        // 200 com arrays vazios = estado válido; outros erros retornam vazio para não quebrar UX
        return { anoLetivo: null, turmas: [], disciplinasSemTurma: [] };
      }
    },
    enabled: !!user?.id,
    retry: (failureCount, error: any) => {
      // Não retentar em 400, 401, 403
      if ([400, 401, 403].includes(error?.response?.status ?? 0)) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // REGRA ABSOLUTA: Backend já retorna turmas e disciplinasSemTurma separados com todos os campos calculados
  // FRONTEND NÃO DECIDE TIPO ACADÊMICO - Backend já retorna dados prontos
  // Usar dados diretamente do backend sem transformações ou cálculos adicionais
  const turmas = useMemo(() => {
    if (!turmasData) return [];
    // Backend já retorna turmas com todos os campos necessários (planoAtivo, podeLancarAula, etc.)
    return turmasData.turmas || [];
  }, [turmasData]);

  // Disciplinas sem turma (aguardando alocação ou plano em RASCUNHO/EM_REVISAO)
  // REGRA ABSOLUTA: Backend já retorna disciplinasSemTurma separado de turmas com todos os campos calculados
  const disciplinasSemTurma = useMemo(() => {
    if (!turmasData) return [];
    // Backend já retorna disciplinasSemTurma com todos os campos necessários
    return turmasData.disciplinasSemTurma || [];
  }, [turmasData]);

  // Fetch total de alunos nas turmas do professor
  // IMPORTANTE: Buscar sempre que houver turmas (não depende de ano letivo ativo)
  // CORREÇÃO: Usar turmasData diretamente para evitar mudanças no queryKey durante renderização
  const turmaIdsString = useMemo(() => {
    if (!turmasData?.turmas) return '';
    return turmasData.turmas.map((t: any) => t.id || '').filter(Boolean).join(',');
  }, [turmasData]);

  const { data: totalAlunos = 0 } = useQuery({
    queryKey: ['professor-total-alunos', turmaIdsString],
    queryFn: async () => {
      if (!turmasData?.turmas || turmasData.turmas.length === 0) return 0;
      
      let total = 0;
      for (const turma of turmasData.turmas) {
        try {
          const response = await matriculasApi.getAlunosByTurmaProfessor(turma.id);
          total += (response?.alunos || []).length;
        } catch (error) {
          console.error(`Erro ao buscar alunos da turma ${turma.id}:`, error);
        }
      }
      return total;
    },
    enabled: !!turmaIdsString && !turmasLoading, // Não depende de ano letivo ativo
    retry: 1,
  });

  // Fetch aulas registradas (histórico recente)
  // IMPORTANTE: Buscar sempre que houver turmas (ano letivo é opcional)
  // CORREÇÃO: Usar turmasData diretamente para evitar mudanças no queryKey durante renderização
  const { data: aulas = [], isLoading: aulasLoading } = useQuery({
    queryKey: ['professor-aulas-dashboard', turmaIdsString, anoLetivo],
    queryFn: async () => {
      if (!turmasData?.turmas || turmasData.turmas.length === 0) return [];
      
      try {
        const turmaIds = turmasData.turmas.map((t: any) => t.id).filter(Boolean);
        
        // Buscar aulas lançadas de todas as turmas
        const allAulas = await Promise.all(
          turmaIds.map(async (turmaId: string) => {
            try {
              const turma = turmasData.turmas.find((t: any) => t.id === turmaId);
              const disciplinaId = turma?.disciplina?.id || turma?.disciplinaId;
              
              if (!disciplinaId) return [];
              
              const params: any = {
                turmaId: turmaId,
                disciplinaId: disciplinaId,
              };
              
              // Incluir anoLetivo apenas se disponível (não obrigatório)
              if (anoLetivo) {
                params.anoLetivo = Number(anoLetivo);
              }
              
              const aulas = await aulasLancadasApi.getAll(params);
              
              return Array.isArray(aulas) ? aulas : [];
            } catch (error) {
              console.error(`Erro ao buscar aulas da turma ${turmaId}:`, error);
              return [];
            }
          })
        );
        
        // Combinar, ordenar por data e limitar
        return allAulas.flat()
          .filter((aula: any) => aula && aula.id && aula.data)
          .sort((a: any, b: any) => {
            const dateA = new Date(a.data).getTime();
            const dateB = new Date(b.data).getTime();
            return dateB - dateA;
          })
          .slice(0, 10);
      } catch (error) {
        console.error('Erro ao buscar aulas:', error);
        return [];
      }
    },
    enabled: !!turmaIdsString && !turmasLoading, // Não depende de ano letivo ativo
    retry: 1,
  });

  // Não buscar planos de ensino separadamente
  // A fonte da verdade são as turmas retornadas pelo backend, que já incluem:
  // - planoEstado, planoBloqueado, planoAtivo, planoEnsinoId
  // Isso evita inconsistências e duplicação de lógica

  // Fetch aulas previstas para hoje
  // IMPORTANTE: Buscar tanto aulas planejadas quanto aulas lançadas para hoje
  // Se não houver ano letivo, buscar apenas aulas lançadas (sem planejadas)
  // CORREÇÃO: Usar turmasData diretamente para evitar mudanças no queryKey durante renderização
  const { data: aulasHoje = [], isLoading: aulasHojeLoading } = useQuery({
    queryKey: ['professor-aulas-hoje', turmaIdsString, anoLetivo, user?.id],
    queryFn: async () => {
      if (!turmasData?.turmas || turmasData.turmas.length === 0 || !user?.id) return [];
      
      try {
        const hoje = new Date();
        const hojeStr = format(hoje, 'yyyy-MM-dd');
        
        // Buscar aulas planejadas e lançadas para hoje
        const allAulasHoje = await Promise.all(
          turmasData.turmas.map(async (turma: any) => {
            try {
              const disciplinaId = turma.disciplina?.id || turma.disciplinaId;
              if (!disciplinaId) return [];
              
              // Buscar aulas planejadas para hoje (do plano de ensino) - apenas se houver ano letivo
              // REGRA ABSOLUTA: NÃO enviar professorId - o backend resolve automaticamente do JWT
              let aulasPlanejadas = [];
              if (anoLetivo) {
                try {
                  aulasPlanejadas = await aulasLancadasApi.getAulasPlanejadas({
                    disciplinaId: disciplinaId,
                    anoLetivo: Number(anoLetivo),
                    turmaId: turma.id,
                  });
                  aulasPlanejadas = aulasPlanejadas || [];
                } catch (error) {
                  console.error(`Erro ao buscar aulas planejadas da turma ${turma.id}:`, error);
                }
              }
              
              // Buscar aulas lançadas para hoje (já registradas) - sempre buscar, mesmo sem ano letivo
              // REGRA ABSOLUTA: NÃO enviar professorId - o backend resolve automaticamente do JWT
              let aulasLancadas = [];
              try {
                const params: any = {
                  turmaId: turma.id,
                  disciplinaId: disciplinaId,
                  dataInicio: hojeStr,
                  dataFim: hojeStr,
                };
                
                if (anoLetivo) {
                  params.anoLetivo = Number(anoLetivo);
                }
                
                aulasLancadas = await aulasLancadasApi.getAll(params);
                aulasLancadas = aulasLancadas || [];
              } catch (error) {
                console.error(`Erro ao buscar aulas lançadas da turma ${turma.id}:`, error);
              }
              
              // Combinar e adicionar informações da turma
              const todasAulas = [
                ...aulasLancadas.map((aula: any) => ({
                  ...aula,
                  turma: turma,
                  turmaNome: turma.nome,
                  status: 'lançada'
                })),
                // Se não houver aula lançada, mostrar aulas planejadas que deveriam ser hoje (apenas se houver ano letivo)
                ...(aulasLancadas.length === 0 && anoLetivo ? aulasPlanejadas.slice(0, 1).map((aula: any) => ({
                  ...aula,
                  turma: turma,
                  turmaNome: turma.nome,
                  status: 'planejada'
                })) : [])
              ];
              
              return todasAulas;
            } catch (error) {
              console.error(`Erro ao buscar aulas de hoje da turma ${turma.id}:`, error);
              return [];
            }
          })
        );
        
        return allAulasHoje.flat();
      } catch (error) {
        console.error('Erro ao buscar aulas de hoje:', error);
        return [];
      }
    },
    enabled: !!turmaIdsString && !turmasLoading && !!user?.id // Não depende de ano letivo ativo
  });

  // Fetch pendências de lançamento (avaliações sem notas)
  // IMPORTANTE: Buscar sempre que houver turmas (ano letivo é opcional para visualização)
  // CORREÇÃO: Usar turmasData diretamente para evitar mudanças no queryKey durante renderização
  const { data: pendenciasLancamento = [], isLoading: pendenciasLoading } = useQuery({
    queryKey: ['professor-pendencias-lancamento', turmaIdsString, anoLetivo],
    queryFn: async () => {
      if (!turmasData?.turmas || turmasData.turmas.length === 0) return [];
      
      try {
        const turmaIds = turmasData.turmas.map((t: any) => t.id).filter(Boolean);
        
        // Buscar todas as avaliações das turmas do professor
        const allAvaliacoes = await Promise.all(
          turmaIds.map(async (id: string) => {
            try {
              const avaliacoes = await avaliacoesApi.getAll({ turmaId: id });
              return Array.isArray(avaliacoes) ? avaliacoes : [];
            } catch (error) {
              console.error(`Erro ao buscar avaliações da turma ${id}:`, error);
              return [];
            }
          })
        );
        
        const avaliacoes = allAvaliacoes.flat().filter((a: any) => a && a.id);
        
        // Verificar quais avaliações têm pendências de lançamento
        const avaliacoesSemNotas = [];
        
        // Limitar a 20 avaliações para não sobrecarregar
        for (const avaliacao of avaliacoes.slice(0, 20)) {
          try {
            // Se a avaliação estiver fechada, não é pendência
            if (avaliacao.fechada === true || avaliacao.status === 'FECHADA') {
              continue;
            }
            
            // Buscar alunos para lançar notas nesta avaliação
            try {
              const alunosData = await notasAvaliacaoApi.getAlunosParaLancar(avaliacao.id);
              const alunos = Array.isArray(alunosData) 
                ? alunosData 
                : (alunosData?.alunos || []);
              
              // Se houver alunos e algum não tiver nota, é uma pendência
              if (alunos.length > 0) {
                const alunosSemNota = alunos.filter((aluno: any) => {
                  const nota = aluno.nota || aluno.valor;
                  return nota === null || nota === undefined || nota === '';
                });
                
                if (alunosSemNota.length > 0) {
                  avaliacoesSemNotas.push(avaliacao);
                }
              }
            } catch (error: any) {
              // Se o erro for 404 ou similar, pode ser que não há alunos ainda
              // Mas se a avaliação não estiver fechada, ainda pode ser pendência
              if (error?.response?.status !== 404 && !avaliacao.fechada) {
                console.error(`Erro ao verificar pendências da avaliação ${avaliacao.id}:`, error);
              }
            }
          } catch (error) {
            console.error(`Erro ao processar avaliação ${avaliacao.id}:`, error);
          }
        }
        
        return avaliacoesSemNotas;
      } catch (error) {
        console.error('Erro ao buscar pendências:', error);
        return [];
      }
    },
    enabled: !!turmaIdsString && !turmasLoading, // Não depende de ano letivo ativo para visualização
    retry: 1,
  });

  // Fetch notas lançadas recentemente
  // IMPORTANTE: Buscar sempre que houver turmas (ano letivo é opcional para visualização)
  // CORREÇÃO: Usar turmasData diretamente para evitar mudanças no queryKey durante renderização
  const { data: notasRecentes = [], isLoading: notasRecentesLoading } = useQuery({
    queryKey: ['professor-notas-recentes', turmaIdsString, anoLetivo],
    queryFn: async () => {
      if (!turmasData?.turmas || turmasData.turmas.length === 0) return [];
      
      try {
        const turmaIds = turmasData.turmas.map((t: any) => t.id).filter(Boolean);
        
        // Buscar notas diretamente por turmaId (mais eficiente)
        const allNotas = await Promise.all(
          turmaIds.map(async (turmaId: string) => {
            try {
              const notas = await notasApi.getByTurma(turmaId);
              return Array.isArray(notas) ? notas : [];
            } catch (error) {
              console.error(`Erro ao buscar notas da turma ${turmaId}:`, error);
              return [];
            }
          })
        );
        
        // Combinar todas as notas e ordenar por data de criação
        const todasNotas = allNotas.flat()
          .filter((nota: any) => nota && nota.id) // Filtrar notas válidas
          .sort((a: any, b: any) => {
            const dateA = a.createdAt || a.created_at || a.data || 0;
            const dateB = b.createdAt || b.created_at || b.data || 0;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          })
          .slice(0, 10);
        
        return todasNotas;
      } catch (error) {
        console.error('Erro ao buscar notas recentes:', error);
        return [];
      }
    },
    enabled: !!turmaIdsString && !turmasLoading, // Não depende de ano letivo ativo para visualização
    retry: 1,
  });

  const getTurnoIcon = (turno: string | { nome?: string } | null) => {
    // Handle both string and object formats
    const turnoNome = typeof turno === 'string' ? turno : turno?.nome;
    if (!turnoNome) return <Clock className="h-4 w-4 text-muted-foreground" />;
    
    switch (String(turnoNome ?? '').toLowerCase()) {
      case 'manhã':
      case 'manha':
        return <Sun className="h-4 w-4 text-yellow-500" />;
      case 'tarde':
        return <Sunset className="h-4 w-4 text-orange-500" />;
      case 'noite':
        return <Moon className="h-4 w-4 text-indigo-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  // Mapear tipo/título da avaliação para coluna (P1, P2, P3, Trab, Exame)
  const getColunaTipo = (nota: any): string => {
    const t = String(nota.avaliacao?.tipo ?? nota.tipo ?? '').toLowerCase();
    const nome = String(nota.avaliacao?.titulo ?? nota.avaliacao?.nome ?? '').toLowerCase();
    const src = `${t} ${nome}`;
    if (t.includes('trabalho') || nome.includes('trabalho')) return 'trab';
    if (t.includes('recuper') || t.includes('recurso') || t.includes('exame') || nome.includes('exame') || nome.includes('recuper') || nome.includes('recurso')) return 'exame';
    if (t.includes('prova_final') || nome.includes('prova final')) return 'exame';
    if (src.includes('1') && (src.includes('prova') || src.includes('p1') || src.includes('1ª'))) return 'p1';
    if (src.includes('2') && (src.includes('prova') || src.includes('p2') || src.includes('2ª'))) return 'p2';
    if (src.includes('3') && (src.includes('prova') || src.includes('p3') || src.includes('3ª'))) return 'p3';
    if (src.includes('1') && (src.includes('trim') || src.includes('1º'))) return 't1';
    if (src.includes('2') && (src.includes('trim') || src.includes('2º'))) return 't2';
    if (src.includes('3') && (src.includes('trim') || src.includes('3º'))) return 't3';
    if (t === 'prova') {
      if (src.includes('1') || nome.includes('p1')) return 'p1';
      if (src.includes('2') || nome.includes('p2')) return 'p2';
      if (src.includes('3') || nome.includes('p3')) return 'p3';
    }
    return 'outro';
  };

  // Agrupar notas por aluno+turma+disciplina, com colunas P1, P2, P3, Trab, Exame (ou T1, T2, T3 para secundário)
  const notasAgrupadas = useMemo(() => {
    if (!notasRecentes?.length) return [];
    const grupos: Record<string, { alunoNome: string; turmaNome: string; disciplinaNome: string; cols: Record<string, number>; notas: any[] }> = {};
    for (const nota of notasRecentes) {
      const alunoId = nota.matricula?.alunoId || nota.aluno?.id || nota.alunoId || '';
      const turmaId = nota.avaliacao?.turmaId || nota.exame?.turmaId || nota.avaliacao?.turma?.id || '';
      const disciplinaId = nota.avaliacao?.turma?.disciplina?.id || nota.avaliacao?.disciplinaId || '';
      const alunoNome = nota.aluno?.nomeCompleto || nota.aluno?.nome_completo || nota.matricula?.aluno?.nomeCompleto || nota.matricula?.aluno?.nome_completo || 'Aluno';
      const key = `${alunoId || alunoNome}-${turmaId}-${disciplinaId}`;
      const turmaNome = nota.avaliacao?.turma?.nome || turmas.find((t: any) => t.id === turmaId)?.nome || '-';
      const disciplinaNome = nota.avaliacao?.turma?.disciplina?.nome || nota.avaliacao?.disciplina?.nome || '-';
      if (!grupos[key]) {
        grupos[key] = { alunoNome, turmaNome, disciplinaNome, cols: {}, notas: [] };
      }
      const col = getColunaTipo(nota);
      const valor = Number(nota.valor ?? nota.nota ?? 0);
      if (col !== 'outro' && (grupos[key].cols[col] == null || valor > 0)) {
        grupos[key].cols[col] = valor;
      } else if (col === 'outro' && valor > 0) {
        grupos[key].cols.outro = valor;
      }
      grupos[key].notas.push(nota);
    }
    return Object.values(grupos).slice(0, 6);
  }, [notasRecentes, turmas]);

  const colunasExibidas = isSecundario
    ? [{ key: 't1', label: '1º Trim' }, { key: 't2', label: '2º Trim' }, { key: 't3', label: '3º Trim' }, { key: 'exame', label: 'Recup.' }]
    : [{ key: 'p1', label: 'P1' }, { key: 'p2', label: 'P2' }, { key: 'p3', label: 'P3' }, { key: 'trab', label: 'Trab' }, { key: 'exame', label: 'Exame' }];

  const isLoading = turmasLoading;

  // Determinar se pode executar ações acadêmicas
  // FONTE DA VERDADE: Dados retornados pelo backend nas turmas (planoAtivo, planoEstado, planoBloqueado)
  // REGRA: Professor só pode executar ações se houver pelo menos uma turma com Plano de Ensino ATIVO
  // Plano ATIVO = estado === 'APROVADO' && bloqueado === false
  // Turmas só podem existir para Plano ATIVO ou ENCERRADO
  // Plano ENCERRADO permite visualização mas não ações
  // IMPORTANTE: Disciplinas sem turma (semTurma === true) NÃO permitem ações pedagógicas
  const podeExecutarAcoes = useMemo(() => {
    // Verificar se há pelo menos uma turma (não disciplina sem turma) com plano ATIVO
    const temTurmaComPlanoAtivo = turmas.some((turma: any) => {
      // Turma deve ter vínculo completo (não semTurma)
      if (turma.semTurma === true) return false;
      // Plano deve estar ATIVO (APROVADO e não bloqueado)
      // Plano ENCERRADO não permite ações, apenas visualização
      const planoAtivo = turma.planoAtivo === true || 
                         (turma.planoEstado === 'APROVADO' && !turma.planoBloqueado);
      return planoAtivo;
    });
    
    // REGRA: Só pode executar ações se:
    // 1. Há pelo menos uma turma com vínculo completo
    // 2. Essa turma tem plano ATIVO (APROVADO e não bloqueado)
    // 3. Há ano letivo ativo (quando aplicável)
    return temTurmaComPlanoAtivo && (hasAnoLetivoAtivo || !hasAnoLetivoAtivo);
  }, [turmas, hasAnoLetivoAtivo]);

  // Verificar se há plano ATIVO para o ano letivo ativo (para mensagens informativas)
  const temPlanoEnsinoAtivoAnoAtivo = useMemo(() => {
    if (!hasAnoLetivoAtivo || !anoLetivoId) return false;
    
    // Verificar se há turma com plano ATIVO no ano letivo ativo
    return turmas.some((turma: any) => {
      if (turma.semTurma === true) return false;
      const planoAtivo = turma.planoAtivo === true || 
                        (turma.planoEstado === 'APROVADO' && !turma.planoBloqueado);
      // Se o backend retornar anoLetivoId na turma, validar também
      // Caso contrário, assumir que se está no contexto do ano letivo ativo, está correto
      return planoAtivo;
    });
  }, [turmas, hasAnoLetivoAtivo, anoLetivoId]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Ano Letivo Context Header */}
        {/* Passar informações de turmas para evitar banner vermelho quando há turmas ativas */}
        {/* REGRA: Não exibir banner vermelho se houver turmas ativas (contexto acadêmico válido) */}
        <AnoLetivoContextHeader 
          showBannerWhenInactive={true} 
          hasTurmasAtivas={turmas.length > 0}
          userRole="PROFESSOR"
        />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {t('dashboard.welcomeProfessor', { name: profile?.nomeCompleto?.split(' ')[0] || profile?.nome_completo?.split(' ')[0] || 'Professor' })}
            </h1>
            <p className="text-muted-foreground">
              {t('dashboard.pedagogicalPanel')}
            </p>
          </div>
        </div>

        {/* BLOQUEIO UX: Sem Plano de Ensino ATIVO */}
        {/* Professor só pode atuar se houver vínculo via Plano de Ensino ATIVO (APROVADO) */}
        {/* REGRA: Exibir aviso amarelo (pendência administrativa) se houver turmas mas não houver plano de ensino ATIVO */}
        {/* Estado: Amarelo = Pendência administrativa (não é erro crítico) */}
        {!podeExecutarAcoes && turmas.length > 0 && (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-200">Pendência Administrativa - Plano de Ensino</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              <strong>Você possui turmas atribuídas, mas não possui Plano de Ensino ATIVO (APROVADO e não bloqueado) vinculado.</strong>
              <br />
              <br />
              <strong>Regra Institucional:</strong> Professores só podem executar ações acadêmicas (aulas, presenças, avaliações, notas) quando vinculados a um Plano de Ensino ATIVO através de vínculo completo: Plano de Ensino → Disciplina → Turma → Professor.
              <br />
              <br />
              <strong>Ações bloqueadas:</strong> Registrar aulas, marcar presenças, lançar notas, criar avaliações.
              <br />
              <br />
              <strong>Solução:</strong> Contacte a coordenação acadêmica para atribuição e aprovação do Plano de Ensino vinculando você às suas disciplinas e turmas.
            </AlertDescription>
          </Alert>
        )}

        {/* ERRO: Falha ao carregar dados */}
        {/* Exibir erro para 401, 403, 400 - cada um com mensagem e CTA apropriados */}
        {/* 400 = Professor não cadastrado na instituição → CTA "Solicitar cadastro" */}
        {/* 401/403 = Erro de autenticação/autorização → CTA "Tentar novamente" */}
        {turmasError && !turmasLoading && (turmasError as any)?.response?.status && 
         [400, 401, 403].includes((turmasError as any)?.response?.status) && (
          <Alert className="border-red-500 bg-red-50 dark:bg-red-950/20">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-red-800 dark:text-red-200">
              {[400, 403].includes((turmasError as any)?.response?.status) ? 'Professor não cadastrado' : 'Erro de Acesso'}
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-300">
              {[400, 403].includes((turmasError as any)?.response?.status) ? (
                <>
                  Seu usuário possui a role de professor, mas não há um registro correspondente na tabela de professores.
                  <br />
                  <br />
                  <strong>Solução:</strong> Contacte a administração ou coordenação acadêmica para solicitar o cadastro do seu registro de professor na instituição.
                  <br />
                  <br />
                  Após o cadastro, suas turmas e disciplinas atribuídas aparecerão aqui.
                </>
              ) : (
                <>
                  Não foi possível acessar suas turmas e disciplinas. Verifique sua autenticação.
                </>
              )}
              <br />
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => refetchTurmas()}
              >
                {[400, 403].includes((turmasError as any)?.response?.status) ? 'Verificar novamente' : 'Tentar Novamente'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* BLOQUEIO UX: Sem Turmas e Sem Disciplinas */}
        {/* Exibir aviso informativo se não houver turmas nem disciplinas atribuídas */}
        {/* IMPORTANTE: Só exibir após o carregamento estar completo para evitar mensagem falsa durante loading */}
        {/* REGRA ABSOLUTA: Tratar array vazio como estado válido - não é erro */}
        {/* Professor sem turma NÃO é erro - é um estado válido */}
        {!turmasLoading && !turmasError && turmas.length === 0 && disciplinasSemTurma.length === 0 && (
          <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">Nenhuma Atribuição</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Você ainda não possui turmas ou disciplinas atribuídas. Contacte a administração para atribuição.
              <br />
              <br />
              <strong>Como funciona a atribuição:</strong>
              <br />
              A atribuição é feita através de <strong>Planos de Ensino</strong>, que vinculam você a disciplinas e turmas.
              <br />
              <br />
              <strong>O que você precisa fazer:</strong>
              <br />
              1. Contacte a coordenação acadêmica ou administração
              <br />
              2. Solicite a criação de um Plano de Ensino vinculando você às disciplinas e turmas
              <br />
              3. Após a aprovação do Plano de Ensino, suas turmas aparecerão aqui
              <br />
              <br />
              <strong>Regra Institucional:</strong> Professor sem turma atribuída é um estado válido, não um erro.
            </AlertDescription>
          </Alert>
        )}

        {/* BLOQUEIO UX: Sem Ano Letivo Ativo */}
        {/* REMOVIDO: O AnoLetivoContextHeader já exibe o banner quando não há ano letivo ativo */}

        {/* TOPO — STATUS */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ano Letivo</CardDescription>
              <CardTitle className="text-2xl">{anoLetivo || '-'}</CardTitle>
              {!hasAnoLetivoAtivo && turmas.length > 0 && (
                <Badge variant="secondary" className="mt-2">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Não ativo na instituição
                </Badge>
              )}
              {hasAnoLetivoAtivo && !podeExecutarAcoes && turmas.length > 0 && (
                <Badge variant="outline" className="mt-2 border-yellow-500 text-yellow-700 dark:text-yellow-400">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Sem plano de ensino ATIVO
                </Badge>
              )}
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Turmas Atribuídas</CardDescription>
              <CardTitle className="text-2xl">{turmas.length}</CardTitle>
              {disciplinasSemTurma.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  + {disciplinasSemTurma.length} disciplina{disciplinasSemTurma.length > 1 ? 's' : ''} aguardando turma
                </p>
              )}
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Aulas Previstas Hoje</CardDescription>
              <CardTitle className="text-2xl">{aulasHoje.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* AÇÕES RÁPIDAS — Mostrar sempre, mas desabilitar se não houver plano de ensino */}
        {/* REGRA ABSOLUTA: Bloquear todas as ações acadêmicas sem Plano de Ensino */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>Operações pedagógicas do dia</CardDescription>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button 
                        variant="outline" 
                        className="h-auto flex-col items-start p-4 w-full"
                        onClick={() => navigate('/painel-professor/frequencia')}
                        disabled={!podeExecutarAcoes}
                      >
                        <ClipboardCheck className="h-5 w-5 mb-2" />
                        <span className="font-medium">Aulas e Presenças</span>
                        <span className="text-xs text-muted-foreground">Registrar aula e marcar frequência</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!podeExecutarAcoes && (
                    <TooltipContent>
                      <p>Plano de Ensino necessário para registrar aulas e presenças. Contacte a coordenação.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button 
                        variant="outline" 
                        className="h-auto flex-col items-start p-4 w-full"
                        onClick={() => navigate('/painel-professor/notas')}
                        disabled={!podeExecutarAcoes}
                      >
                        <FileText className="h-5 w-5 mb-2" />
                        <span className="font-medium">Lançar Notas</span>
                        <span className="text-xs text-muted-foreground">Avaliações e provas</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!podeExecutarAcoes && (
                    <TooltipContent>
                      <p>Plano de Ensino necessário para lançar notas. Contacte a coordenação.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                  <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button 
                        variant="outline" 
                        className="h-auto flex-col items-start p-4 w-full"
                        onClick={() => navigate('/admin-dashboard/avaliacoes-notas')}
                        disabled={!podeExecutarAcoes}
                      >
                        <TrendingUp className="h-5 w-5 mb-2" />
                        <span className="font-medium">Criar Avaliação</span>
                        <span className="text-xs text-muted-foreground">Criar avaliações</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!podeExecutarAcoes && (
                    <TooltipContent>
                      <p>Plano de Ensino necessário para criar avaliações. Contacte a coordenação.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button 
                        variant="outline" 
                        className="h-auto flex-col items-start p-4 w-full"
                        onClick={() => navigate('/painel-professor/relatorios')}
                        disabled={!podeExecutarAcoes}
                      >
                        <ClipboardList className="h-5 w-5 mb-2" />
                        <span className="font-medium">Relatórios</span>
                        <span className="text-xs text-muted-foreground">Pauta, lista de alunos, boletim - imprimir</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!podeExecutarAcoes && (
                    <TooltipContent>
                      <p>Plano de Ensino necessário para emitir relatórios. Contacte a coordenação.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>

        {isLoading || turmasLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* LISTAS PRINCIPAIS */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Minhas Turmas */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Minhas Turmas</CardTitle>
                    <CardDescription>Turmas atribuídas com vínculo. Clique para expandir e acessar ações rápidas.</CardDescription>
                  </div>
                  {turmas.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => navigate('/painel-professor/turmas')}>
                      Ver todas <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {turmasLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : turmas.length === 0 ? (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Nenhuma turma atribuída no momento.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Contacte a administração para atribuição de turmas.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {turmas.slice(0, 5).map((turma: any) => {
                        const planoAtivo = turma.planoAtivo !== false && (turma.planoEstado === 'APROVADO' && !turma.planoBloqueado);
                        const planoEstado = turma.statusPlano || turma.planoEstado || 'N/A';
                        const planoBloqueado = turma.planoBloqueado || false;
                        const disciplinaNome = turma.disciplina?.nome || turma.disciplinaNome || 'Disciplina não definida';
                        const motivoBloqueio = turma.motivoBloqueio;
                        
                        return (
                          <Collapsible key={turma.id} className="group">
                            <div className="rounded-lg border bg-muted/50 transition-colors hover:bg-muted/70">
                              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3 text-left">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                                  {getTurnoIcon(turma.turno)}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-medium">{turma.nome}</p>
                                      {!planoAtivo && (
                                        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 dark:text-yellow-400">
                                          {planoEstado === 'RASCUNHO' ? 'Rascunho' : 
                                           planoEstado === 'EM_REVISAO' ? 'Em Revisão' : 
                                           planoEstado === 'ENCERRADO' ? 'Encerrado' : 
                                           planoBloqueado ? 'Bloqueado' : 'Pendente'}
                                        </Badge>
                                      )}
                                      {planoAtivo && (
                                        <Badge variant="default" className="text-xs bg-green-500">Ativo</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate">
                                      {disciplinaNome} • {turma.ano}{!isSecundario && turma.semestre && `/${turma.semestre}`}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="secondary" className="shrink-0">{typeof turma.turno === 'object' ? turma.turno?.nome : turma.turno || 'N/A'}</Badge>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="border-t px-3 pb-3 pt-2 space-y-2">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-4">
                                    <span><strong className="text-foreground">Sala:</strong> {turma.sala || 'N/A'}</span>
                                    <span><strong className="text-foreground">Horário:</strong> {turma.horario || 'N/A'}</span>
                                  </div>
                                  {(turma.cargaHorariaPlanejada ?? turma.cargaHorariaTotal ?? turma.cargaHorariaRealizada ?? 0) > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Carga horária: {turma.cargaHorariaRealizada ?? 0}h realizadas de {(turma.cargaHorariaPlanejada ?? turma.cargaHorariaTotal) ?? 0}h planejadas
                                      {(turma.cargaHorariaTotal && turma.cargaHorariaPlanejada && turma.cargaHorariaTotal !== turma.cargaHorariaPlanejada) && (
                                        <span> (total {turma.cargaHorariaTotal}h)</span>
                                      )}
                                    </p>
                                  )}
                                  {!planoAtivo && motivoBloqueio && (
                                    <div className="p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
                                      <AlertCircle className="h-3 w-3 inline mr-1" />
                                      <strong>Status:</strong> {motivoBloqueio}
                                    </div>
                                  )}
                                  <div className="flex gap-2 pt-1">
                                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/painel-professor/notas?turmaId=${turma.id}`); }}>
                                      Lançar Notas
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate('/painel-professor/frequencia'); }}>
                                      Registrar Aula
                                    </Button>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Disciplinas Atribuídas (sem turma) - colapsável por defeito para reduzir scroll */}
              <Card>
                <Collapsible defaultOpen={disciplinasSemTurma.length === 0} className="group">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CollapsibleTrigger className="flex w-full items-start justify-between gap-2 text-left">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                        <div>
                          <CardTitle>Disciplinas Atribuídas</CardTitle>
                          <CardDescription>
                            {disciplinasSemTurma.length > 0
                              ? `${disciplinasSemTurma.length} aguardando turma · Clique para expandir`
                              : 'Aguardando alocação de turma. Clique para expandir detalhes.'}
                          </CardDescription>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                <CardContent>
                  {turmasLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : disciplinasSemTurma.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <p className="text-muted-foreground">
                        Todas as disciplinas atribuídas possuem turma vinculada.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {disciplinasSemTurma.slice(0, 5).map((disciplina: any) => {
                        const planoAtivo = disciplina.planoAtivo !== false && (disciplina.planoEstado === 'APROVADO' && !disciplina.planoBloqueado);
                        const planoEstado = disciplina.statusPlano || disciplina.planoEstado || 'N/A';
                        const planoBloqueado = disciplina.planoBloqueado || false;
                        const disciplinaNome = disciplina.disciplina?.nome || disciplina.disciplinaNome || 'Disciplina não definida';
                        const motivoBloqueio = disciplina.motivoBloqueio;
                        
                        return (
                          <Collapsible key={disciplina.id} className="group">
                            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-950/30">
                              <CollapsibleTrigger className="flex w-full items-center gap-3 p-3 text-left">
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                                <BookOpen className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium">{disciplinaNome}</p>
                                    <Badge variant="outline" className="text-xs border-blue-500 text-blue-700 dark:text-blue-400">
                                      Aguardando turma
                                    </Badge>
                                    {!planoAtivo && (
                                      <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 dark:text-yellow-400">
                                        {planoEstado === 'RASCUNHO' ? 'Rascunho' : 
                                         planoEstado === 'EM_REVISAO' ? 'Em Revisão' : 
                                         planoEstado === 'ENCERRADO' ? 'Encerrado' : 
                                         planoBloqueado ? 'Bloqueado' : 'Pendente'}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground truncate">
                                    Disciplina atribuída - aguardando vinculação a turma
                                  </p>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="border-t border-blue-200/50 dark:border-blue-800/50 px-3 pb-3 pt-2 space-y-2">
                                  {(disciplina.cargaHorariaPlanejada ?? disciplina.cargaHorariaTotal ?? disciplina.cargaHorariaRealizada ?? 0) > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Carga horária: {disciplina.cargaHorariaRealizada ?? 0}h realizadas de {(disciplina.cargaHorariaPlanejada ?? disciplina.cargaHorariaTotal) ?? 0}h planejadas
                                    </p>
                                  )}
                                  {motivoBloqueio && (
                                    <div className="p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
                                      <AlertCircle className="h-3 w-3 inline mr-1" />
                                      <strong>Status:</strong> {motivoBloqueio}
                                    </div>
                                  )}
                                  <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300">
                                    <AlertCircle className="h-3 w-3 inline mr-1" />
                                    <strong>Status: Aguardando alocação de turma</strong>
                                    <br />
                                    Esta disciplina foi atribuída via Plano de Ensino, mas ainda não está vinculada a uma turma. Contacte a coordenação acadêmica.
                                    <br />
                                    <br />
                                    <strong>Regra Institucional:</strong> Professor só pode executar ações acadêmicas quando houver vínculo completo: Plano de Ensino → Disciplina → Turma → Professor.
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Notas Recentes */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Notas Lançadas</CardTitle>
                    <CardDescription>Uma linha por aluno · P1, P2, P3, Trab, Exame. Clique para expandir detalhes.</CardDescription>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => navigate('/painel-professor/notas')}
                          disabled={!podeExecutarAcoes}
                        >
                          Lançar <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!podeExecutarAcoes && (
                      <TooltipContent>
                        <p>Plano de Ensino necessário para lançar notas. Contacte a coordenação.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  {notasRecentesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : notasRecentes.length === 0 ? (
                    <div className="text-center py-8">
                      <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Nenhuma nota registrada recentemente.
                      </p>
                      {podeExecutarAcoes ? (
                        <Button 
                          variant="link" 
                          className="mt-2"
                          onClick={() => navigate('/painel-professor/notas')}
                        >
                          Lançar primeira nota
                        </Button>
                      ) : (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                          Plano de Ensino necessário para lançar notas. Contacte a coordenação.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="max-h-[240px] overflow-y-auto rounded-md border">
                        <div className="flex gap-2 px-3 py-2 bg-muted/50 border-b text-xs font-medium">
                          <div className="flex-1 min-w-0">Aluno</div>
                          {colunasExibidas.map((c) => (
                            <div key={c.key} className="text-center w-10 shrink-0">{c.label}</div>
                          ))}
                        </div>
                        {notasAgrupadas.map((grp, idx) => (
                          <Collapsible key={idx} className="group">
                            <div className="border-b last:border-b-0">
                              <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/40 text-left cursor-pointer">
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{grp.alunoNome.split(' ').slice(0, 2).join(' ')}</p>
                                  <p className="text-xs text-muted-foreground truncate">{grp.disciplinaNome}</p>
                                </div>
                                {colunasExibidas.map((c) => {
                                  const v = grp.cols[c.key];
                                  const hasVal = v != null && v > 0;
                                  return (
                                    <div key={c.key} className="w-10 text-center shrink-0">
                                      {hasVal ? (
                                        <Badge variant={v >= 10 ? "default" : "destructive"} className="text-xs py-0 px-1">
                                          {safeToFixed(v, 1)}
                                        </Badge>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="px-3 pb-2 pt-1 bg-muted/20 text-xs text-muted-foreground space-y-1">
                                  <p><strong className="text-foreground">Turma:</strong> {grp.turmaNome}</p>
                                  <p><strong className="text-foreground">Disciplina:</strong> {grp.disciplinaNome}</p>
                                  {grp.notas.map((n: any, i: number) => {
                                    const d = n.data || n.createdAt || n.created_at;
                                    const tipo = n.avaliacao?.titulo || n.tipo || n.avaliacao?.tipo || 'Nota';
                                    return (
                                      <p key={i}>{tipo}: {safeToFixed(Number(n.valor ?? n.nota ?? 0), 1)} · {formatDate(d)}</p>
                                    );
                                  })}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))}
                      </div>
                      {notasRecentes.length > 0 && (
                        <Button
                          variant="link"
                          className="w-full mt-2 text-sm"
                          onClick={() => navigate('/painel-professor/notas')}
                        >
                          Ver todas / Lançar notas <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Aulas de Hoje */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Aulas de Hoje</CardTitle>
                    <CardDescription>Aulas previstas para hoje</CardDescription>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => navigate('/painel-professor/frequencia')}
                          disabled={!podeExecutarAcoes}
                        >
                          Registrar <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!podeExecutarAcoes && (
                      <TooltipContent>
                        <p>Plano de Ensino necessário para registrar aulas. Contacte a coordenação.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  {aulasHojeLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : aulasHoje.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Nenhuma aula prevista para hoje.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {aulasHoje.slice(0, 5).map((aula: any) => {
                        const turmaNome = aula.turma?.nome || aula.turmaNome || turmas.find((t: any) => t.id === aula.turmaId)?.nome || 'Turma';
                        const conteudo = aula.conteudoMinistrado || aula.conteudo || aula.conteudoPrevisto || aula.planoAula?.titulo || 'Sem conteúdo';
                        const status = aula.status || (aula.data ? 'lançada' : 'planejada');
                        const dataAula = aula.data ? format(new Date(aula.data), "dd/MM/yyyy", { locale: ptBR }) : '-';
                        const sala = aula.turma?.sala || aula.sala || '-';
                        
                        return (
                          <Collapsible key={aula.id || `${aula.planoAulaId}-${aula.turmaId}`} className="group">
                            <div className="rounded-lg border bg-muted/50 transition-colors hover:bg-muted/70">
                              <CollapsibleTrigger className="flex w-full items-center gap-4 p-3 text-left">
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                  <Calendar className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{turmaNome}</p>
                                  <p className="text-xs text-muted-foreground truncate">{conteudo}</p>
                                </div>
                                <Badge variant={status === 'lançada' ? 'default' : 'outline'} className="shrink-0">
                                  {status === 'lançada' ? 'Registrada' : 'Hoje'}
                                </Badge>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="border-t px-3 pb-3 pt-2 space-y-2">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-4">
                                    <span><strong className="text-foreground">Data:</strong> {dataAula}</span>
                                    <span><strong className="text-foreground">Sala:</strong> {sala}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    <strong className="text-foreground">Conteúdo:</strong> {conteudo}
                                  </p>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pendências de Lançamento */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Pendências de Lançamento</CardTitle>
                    <CardDescription>Avaliações sem notas lançadas</CardDescription>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => navigate('/painel-professor/notas')}
                          disabled={!podeExecutarAcoes}
                        >
                          Lançar <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!podeExecutarAcoes && (
                      <TooltipContent>
                        <p>Plano de Ensino necessário para lançar notas. Contacte a coordenação.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  {pendenciasLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : pendenciasLancamento.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <p className="text-muted-foreground">
                        Nenhuma pendência de lançamento.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendenciasLancamento.slice(0, 5).map((avaliacao: any) => {
                        const turmaNome = avaliacao.turma?.nome || '-';
                        const disciplinaNome = avaliacao.turma?.disciplina?.nome || avaliacao.disciplina?.nome || '-';
                        
                        return (
                          <Collapsible key={avaliacao.id} className="group">
                            <div className="rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/20 transition-colors hover:bg-yellow-100/50 dark:hover:bg-yellow-950/30">
                              <CollapsibleTrigger className="flex w-full items-center gap-4 p-3 text-left">
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400">
                                  <AlertCircle className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{avaliacao.titulo || avaliacao.nome || 'Avaliação'}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {turmaNome} • {formatDate(avaliacao.data)}
                                  </p>
                                </div>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => navigate(`/painel-professor/notas?avaliacaoId=${avaliacao.id}`)}
                                        disabled={!podeExecutarAcoes}
                                      >
                                        Lançar
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  {!podeExecutarAcoes && (
                                    <TooltipContent>
                                      <p>Plano de Ensino necessário para lançar notas. Contacte a coordenação.</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="border-t border-yellow-200/50 dark:border-yellow-900/50 px-3 pb-3 pt-2 space-y-2">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-4">
                                    <span><strong className="text-foreground">Turma:</strong> {turmaNome}</span>
                                    <span><strong className="text-foreground">Disciplina:</strong> {disciplinaNome}</span>
                                    <span><strong className="text-foreground">Data:</strong> {formatDate(avaliacao.data)}</span>
                                    <span><strong className="text-foreground">Tipo:</strong> {avaliacao.tipo || '-'}</span>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ProfessorDashboard;