import React from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Loader2, BookOpen, ClipboardCheck, Calendar, Clock, 
  ChevronRight, Sun, Sunset, Moon, FileText, TrendingUp,
  AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { safeToFixed } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';

const ProfessorDashboard: React.FC = () => {
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
  // REGRA SIGA/SIGAE: Arrays vazios são estados válidos, não erros
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
  const turmas = React.useMemo(() => {
    if (!turmasData) return [];
    // Backend já retorna turmas com todos os campos necessários (planoAtivo, podeLancarAula, etc.)
    return turmasData.turmas || [];
  }, [turmasData]);

  // Disciplinas sem turma (aguardando alocação ou plano em RASCUNHO/EM_REVISAO)
  // REGRA ABSOLUTA: Backend já retorna disciplinasSemTurma separado de turmas com todos os campos calculados
  const disciplinasSemTurma = React.useMemo(() => {
    if (!turmasData) return [];
    // Backend já retorna disciplinasSemTurma com todos os campos necessários
    return turmasData.disciplinasSemTurma || [];
  }, [turmasData]);

  // Fetch total de alunos nas turmas do professor
  // IMPORTANTE: Buscar sempre que houver turmas (não depende de ano letivo ativo)
  // CORREÇÃO: Usar turmasData diretamente para evitar mudanças no queryKey durante renderização
  const turmaIdsString = React.useMemo(() => {
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

  // REGRA SIGA/SIGAE: Não buscar planos de ensino separadamente
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
    
    switch (turnoNome.toLowerCase()) {
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

  const isLoading = turmasLoading;

  // REGRA MESTRA SIGA/SIGAE: Determinar se pode executar ações acadêmicas
  // FONTE DA VERDADE: Dados retornados pelo backend nas turmas (planoAtivo, planoEstado, planoBloqueado)
  // REGRA: Professor só pode executar ações se houver pelo menos uma turma com Plano de Ensino ATIVO
  // Plano ATIVO = estado === 'APROVADO' && bloqueado === false
  // REGRA SIGA/SIGAE: Turmas só podem existir para Plano ATIVO ou ENCERRADO
  // Plano ENCERRADO permite visualização mas não ações
  // IMPORTANTE: Disciplinas sem turma (semTurma === true) NÃO permitem ações pedagógicas
  const podeExecutarAcoes = React.useMemo(() => {
    // Verificar se há pelo menos uma turma (não disciplina sem turma) com plano ATIVO
    const temTurmaComPlanoAtivo = turmas.some((turma: any) => {
      // Turma deve ter vínculo completo (não semTurma)
      if (turma.semTurma === true) return false;
      // REGRA SIGA/SIGAE: Plano deve estar ATIVO (APROVADO e não bloqueado)
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
  const temPlanoEnsinoAtivoAnoAtivo = React.useMemo(() => {
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
              Bem-vindo, {profile?.nomeCompleto?.split(' ')[0] || profile?.nome_completo?.split(' ')[0] || 'Professor'}!
            </h1>
            <p className="text-muted-foreground">
              Painel de atividades pedagógicas
            </p>
          </div>
        </div>

        {/* BLOQUEIO UX: Sem Plano de Ensino ATIVO */}
        {/* REGRA MESTRA SIGA/SIGAE: Professor só pode atuar se houver vínculo via Plano de Ensino ATIVO (APROVADO) */}
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
              <strong>Regra Institucional (SIGA/SIGAE):</strong> Professores só podem executar ações acadêmicas (aulas, presenças, avaliações, notas) quando vinculados a um Plano de Ensino ATIVO através de vínculo completo: Plano de Ensino → Disciplina → Turma → Professor.
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
        {/* REGRA SIGA/SIGAE: Exibir erro para 401, 403, 400 - cada um com mensagem e CTA apropriados */}
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
        {/* REGRA SIGA/SIGAE: Exibir aviso informativo se não houver turmas nem disciplinas atribuídas */}
        {/* IMPORTANTE: Só exibir após o carregamento estar completo para evitar mensagem falsa durante loading */}
        {/* REGRA ABSOLUTA: Tratar array vazio como estado válido - não é erro */}
        {/* REGRA SIGA/SIGAE: Professor sem turma NÃO é erro - é um estado válido */}
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
              <strong>Regra Institucional (SIGA/SIGAE):</strong> Professor sem turma atribuída é um estado válido, não um erro.
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
                        <Calendar className="h-5 w-5 mb-2" />
                        <span className="font-medium">Registrar Aula</span>
                        <span className="text-xs text-muted-foreground">Lançar aula ministrada</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!podeExecutarAcoes && (
                    <TooltipContent>
                      <p>Plano de Ensino necessário para registrar aulas. Contacte a coordenação.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
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
                        <span className="font-medium">Marcar Presenças</span>
                        <span className="text-xs text-muted-foreground">Registrar frequência</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!podeExecutarAcoes && (
                    <TooltipContent>
                      <p>Plano de Ensino necessário para marcar presenças. Contacte a coordenação.</p>
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
                    <CardDescription>Turmas atribuídas com vínculo</CardDescription>
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
                    <div className="space-y-3">
                      {turmas.slice(0, 5).map((turma: any) => {
                        const planoAtivo = turma.planoAtivo !== false && (turma.planoEstado === 'APROVADO' && !turma.planoBloqueado);
                        const planoEstado = turma.statusPlano || turma.planoEstado || 'N/A';
                        const planoBloqueado = turma.planoBloqueado || false;
                        const disciplinaNome = turma.disciplina?.nome || turma.disciplinaNome || 'Disciplina não definida';
                        const motivoBloqueio = turma.motivoBloqueio;
                        
                        return (
                          <div key={turma.id} className="p-4 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getTurnoIcon(turma.turno)}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
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
                                      <Badge variant="default" className="text-xs bg-green-500">
                                        Ativo
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {disciplinaNome} • {turma.ano}{!isSecundario && turma.semestre && `/${turma.semestre}`}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="secondary">{typeof turma.turno === 'object' ? turma.turno?.nome : turma.turno || 'N/A'}</Badge>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Sala: {turma.sala || 'N/A'}</span>
                              <span>Horário: {turma.horario || 'N/A'}</span>
                            </div>
                            {(turma.cargaHorariaPlanejada ?? turma.cargaHorariaTotal ?? turma.cargaHorariaRealizada ?? 0) > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Carga horária: {turma.cargaHorariaRealizada ?? 0}h realizadas de {(turma.cargaHorariaPlanejada ?? turma.cargaHorariaTotal) ?? 0}h planejadas
                                {(turma.cargaHorariaTotal && turma.cargaHorariaPlanejada && turma.cargaHorariaTotal !== turma.cargaHorariaPlanejada) && (
                                  <span> (total {turma.cargaHorariaTotal}h)</span>
                                )}
                              </div>
                            )}
                            {!planoAtivo && motivoBloqueio && (
                              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                <strong>Status:</strong> {motivoBloqueio}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Disciplinas Atribuídas (sem turma) */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Disciplinas Atribuídas</CardTitle>
                    <CardDescription>Aguardando alocação de turma</CardDescription>
                  </div>
                </CardHeader>
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
                    <div className="space-y-3">
                      {disciplinasSemTurma.slice(0, 5).map((disciplina: any) => {
                        const planoAtivo = disciplina.planoAtivo !== false && (disciplina.planoEstado === 'APROVADO' && !disciplina.planoBloqueado);
                        const planoEstado = disciplina.statusPlano || disciplina.planoEstado || 'N/A';
                        const planoBloqueado = disciplina.planoBloqueado || false;
                        const disciplinaNome = disciplina.disciplina?.nome || disciplina.disciplinaNome || 'Disciplina não definida';
                        const motivoBloqueio = disciplina.motivoBloqueio;
                        
                        return (
                          <div key={disciplina.id} className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg space-y-2 border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-3">
                              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
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
                                <p className="text-sm text-muted-foreground mt-1">
                                  Disciplina atribuída - aguardando vinculação a turma
                                </p>
                                {(disciplina.cargaHorariaPlanejada ?? disciplina.cargaHorariaTotal ?? disciplina.cargaHorariaRealizada ?? 0) > 0 && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Carga horária: {disciplina.cargaHorariaRealizada ?? 0}h realizadas de {(disciplina.cargaHorariaPlanejada ?? disciplina.cargaHorariaTotal) ?? 0}h planejadas
                                    {(disciplina.cargaHorariaTotal && disciplina.cargaHorariaPlanejada && disciplina.cargaHorariaTotal !== disciplina.cargaHorariaPlanejada) && (
                                      <span> (total {disciplina.cargaHorariaTotal}h)</span>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                            {motivoBloqueio && (
                              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                <strong>Status:</strong> {motivoBloqueio}
                              </div>
                            )}
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300">
                              <AlertCircle className="h-3 w-3 inline mr-1" />
                              <strong>Status: Aguardando alocação de turma</strong>
                              <br />
                              Esta disciplina foi atribuída a você via Plano de Ensino, mas ainda não está vinculada a uma turma.
                              <br />
                              <br />
                              <strong>Ações pedagógicas desabilitadas:</strong> Registrar aulas, marcar presenças, lançar notas e criar avaliações estarão disponíveis após a vinculação a uma turma.
                              <br />
                              <br />
                              <strong>Regra Institucional (SIGA/SIGAE):</strong> Professor só pode executar ações acadêmicas quando houver vínculo completo: Plano de Ensino → Disciplina → Turma → Professor.
                              <br />
                              <br />
                              <strong>Próximo passo:</strong> Contacte a coordenação acadêmica para vincular esta disciplina a uma turma.
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notas Recentes */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Notas Lançadas</CardTitle>
                    <CardDescription>Últimas notas registradas</CardDescription>
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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aluno</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Nota</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notasRecentes.slice(0, 5).map((nota: any) => {
                          const alunoNome = nota.aluno?.nomeCompleto || 
                                           nota.aluno?.nome_completo || 
                                           nota.matricula?.aluno?.nomeCompleto || 
                                           nota.matricula?.aluno?.nome_completo || 
                                           nota.avaliacao?.titulo || 
                                           'Aluno';
                          const tipo = nota.tipo || nota.avaliacao?.tipo || 'Nota';
                          const valor = nota.valor || nota.nota || 0;
                          const data = nota.data || nota.createdAt || nota.created_at;
                          
                          return (
                            <TableRow key={nota.id}>
                              <TableCell className="font-medium">
                                {alunoNome.split(' ').slice(0, 2).join(' ')}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{tipo}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={valor >= 10 ? "default" : "destructive"}>
                                  {safeToFixed(valor, 1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(data)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
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
                    <div className="space-y-3">
                      {aulasHoje.slice(0, 5).map((aula: any) => {
                        const turmaNome = aula.turma?.nome || aula.turmaNome || turmas.find((t: any) => t.id === aula.turmaId)?.nome || 'Turma';
                        const conteudo = aula.conteudoMinistrado || aula.conteudo || aula.conteudoPrevisto || aula.planoAula?.titulo || 'Sem conteúdo';
                        const status = aula.status || (aula.data ? 'lançada' : 'planejada');
                        
                        return (
                          <div
                            key={aula.id || `${aula.planoAulaId}-${aula.turmaId}`}
                            className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Calendar className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{turmaNome}</p>
                              <p className="text-xs text-muted-foreground">
                                {conteudo}
                              </p>
                            </div>
                            <Badge variant={status === 'lançada' ? 'default' : 'outline'}>
                              {status === 'lançada' ? 'Registrada' : 'Hoje'}
                            </Badge>
                          </div>
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
                    <div className="space-y-3">
                      {pendenciasLancamento.slice(0, 5).map((avaliacao: any) => (
                        <div
                          key={avaliacao.id}
                          className="flex items-center gap-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400">
                            <AlertCircle className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{avaliacao.titulo || avaliacao.nome || 'Avaliação'}</p>
                            <p className="text-xs text-muted-foreground">
                              {avaliacao.turma?.nome || '-'} • {formatDate(avaliacao.data)}
                            </p>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
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
                        </div>
                      ))}
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