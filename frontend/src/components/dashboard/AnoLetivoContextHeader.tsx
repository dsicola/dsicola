import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { anoLetivoApi, semestreApi, trimestreApi } from '@/services/api';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAuth } from '@/contexts/AuthContext';
import { isStaffWithFallback } from '@/utils/roleLabels';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar, AlertCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AnoLetivoContextHeaderProps {
  showBannerWhenInactive?: boolean;
  /** Se fornecido, verifica se há turmas antes de mostrar banner vermelho */
  hasTurmasAtivas?: boolean;
  /** Role do usuário para lógica específica */
  userRole?: string;
}

/**
 * Componente que exibe o contexto acadêmico atual no topo do dashboard
 * Mostra Ano Letivo ATIVO, período (Semestre/Trimestre) e status
 * 
 * REGRA: Não exibe banner vermelho se:
 * - Usuário é PROFESSOR e possui turmas ativas (mesmo sem ano letivo ativo na instituição)
 * - Isso evita mensagens contraditórias quando professor tem turmas mas ano letivo não está ativo
 */
export function AnoLetivoContextHeader({ 
  showBannerWhenInactive = true,
  hasTurmasAtivas = false,
  userRole
}: AnoLetivoContextHeaderProps) {
  const { instituicaoId, tipoAcademico, isSecundario } = useInstituicao();
  const { role } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const currentRole = userRole || role;
  const isProfessor = currentRole === 'PROFESSOR';

  const { user } = useAuth();
  const { data: anoLetivoAtivo, isLoading } = useQuery({
    queryKey: ['ano-letivo-ativo-header', instituicaoId, role, user?.id],
    queryFn: async () => {
      try {
        return await anoLetivoApi.getAtivo();
      } catch {
        return null;
      }
    },
    // RH, SECRETARIA, FINANCEIRO: backend obtém instituicaoId do JWT - habilitar mesmo sem instituicaoId no contexto
    enabled: (!isSuperAdmin && (!!instituicaoId || (role === 'RH' && !!user?.id) || (role === 'SECRETARIA' && !!user?.id) || (role === 'FINANCEIRO' && !!user?.id))),
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchInterval: 5 * 60 * 1000, // Atualiza a cada 5 minutos
  });

  // Buscar período atual (Semestre ou Trimestre) baseado no ano letivo ativo
  const { data: periodoAtual } = useQuery({
    queryKey: ['periodo-atual', anoLetivoAtivo?.id, anoLetivoAtivo?.ano, tipoAcademico],
    queryFn: async () => {
      if (!anoLetivoAtivo?.ano) return null;

      const hoje = new Date();
      
      try {
        if (tipoAcademico === 'SUPERIOR') {
          // Buscar semestres do ano letivo ativo (usar anoLetivo número ou anoLetivoId)
          const semestres = await semestreApi.getAll({ 
            anoLetivo: anoLetivoAtivo.ano,
            anoLetivoId: anoLetivoAtivo.id 
          });
          const semestreAtivo = semestres?.find((s: any) => {
            if (!s.dataInicio) return false;
            const inicio = new Date(s.dataInicio);
            const fim = s.dataFim ? new Date(s.dataFim) : null;
            return hoje >= inicio && (!fim || hoje <= fim);
          });
          return semestreAtivo ? { 
            tipo: 'semestre', 
            numero: semestreAtivo.numero, 
            nome: `${semestreAtivo.numero}º Semestre` 
          } : null;
        } else {
          // Buscar trimestres do ano letivo ativo (usar anoLetivo número ou anoLetivoId)
          const trimestres = await trimestreApi.getAll({ 
            anoLetivo: anoLetivoAtivo.ano,
            anoLetivoId: anoLetivoAtivo.id 
          });
          const trimestreAtivo = trimestres?.find((t: any) => {
            if (!t.dataInicio) return false;
            const inicio = new Date(t.dataInicio);
            const fim = t.dataFim ? new Date(t.dataFim) : null;
            return hoje >= inicio && (!fim || hoje <= fim);
          });
          return trimestreAtivo ? { 
            tipo: 'trimestre', 
            numero: trimestreAtivo.numero, 
            nome: `${trimestreAtivo.numero}º Trimestre` 
          } : null;
        }
      } catch (error) {
        console.error('[AnoLetivoContextHeader] Erro ao buscar período:', error);
        return null;
      }
    },
    enabled: !!anoLetivoAtivo?.ano && !!tipoAcademico,
    staleTime: 5 * 60 * 1000,
  });

  // SUPER_ADMIN não precisa de Ano Letivo - não exibir header
  if (isSuperAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-48 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!anoLetivoAtivo) {
    if (!showBannerWhenInactive) return null;

    // REGRA CRÍTICA: Professor com turmas ativas NÃO deve ver banner vermelho
    // Se professor tem turmas, significa que há contexto acadêmico válido
    // O banner vermelho só aparece se realmente não houver ano letivo E não houver turmas
    if (isProfessor && hasTurmasAtivas) {
      // Professor tem turmas mas não há ano letivo ativo na instituição
      // Isso é uma situação administrativa, não um erro crítico
      // Não exibir banner vermelho para evitar contradição
      return null;
    }

    // Banner vermelho apenas se realmente não existir ano letivo ativo
    // e não houver contexto acadêmico válido (turmas)
    return (
      <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
        <AlertCircle className="h-5 w-5" />
        <AlertTitle className="font-semibold">Ano Letivo não disponível</AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
          <p className="text-sm">
            Não existe Ano Letivo ativo. Crie ou ative um Ano Letivo para iniciar a gestão acadêmica.
          </p>
          {!isProfessor && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/admin-dashboard/configuracao-ensino?tab=anos-letivos')}
              className="shrink-0 gap-2 border-destructive/50 hover:bg-destructive/20"
            >
              <Calendar className="h-4 w-4" />
              Gerenciar Anos Letivos
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const statusColor =
    anoLetivoAtivo.status === 'ATIVO'
      ? 'bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/20 dark:text-green-400'
      : anoLetivoAtivo.status === 'ENCERRADO'
      ? 'bg-gray-500/10 text-gray-700 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400'
      : 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400';

  const statusLabel =
    anoLetivoAtivo.status === 'ATIVO'
      ? 'ATIVO'
      : anoLetivoAtivo.status === 'ENCERRADO'
      ? 'ENCERRADO'
      : 'PLANEJADO';

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardContent className="p-3 sm:p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          {/* Informações do Ano Letivo - Compacto em mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <div className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 text-primary shrink-0">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground">
                  Ano Letivo: {anoLetivoAtivo.ano}
                </h3>
                <Badge className={cn(statusColor, "text-xs")} variant="outline">
                  {statusLabel}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                <span className="truncate">
                  {anoLetivoAtivo.dataInicio &&
                    format(new Date(anoLetivoAtivo.dataInicio), "dd 'de' MMM", { locale: ptBR })}
                  {anoLetivoAtivo.dataFim &&
                    ` - ${format(new Date(anoLetivoAtivo.dataFim), "dd 'de' MMM", { locale: ptBR })}`}
                </span>
                {periodoAtual && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="font-medium text-foreground truncate">{periodoAtual.nome}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Ação rápida - Compacto em mobile */}
          {!isProfessor && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin-dashboard/configuracao-ensino?tab=anos-letivos')}
              className="shrink-0 gap-2 text-xs sm:text-sm"
            >
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Gerenciar</span>
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:hidden" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

