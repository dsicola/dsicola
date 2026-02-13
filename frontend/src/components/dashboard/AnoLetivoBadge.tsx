import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { anoLetivoApi, matriculasAnuaisApi } from '@/services/api';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AnoLetivoBadgeProps {
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Badge compacto do Ano Letivo para exibir no header do dashboard
 * Variantes:
 * - compact: Apenas ano e status (mobile)
 * - full: Ano, status e datas (desktop)
 */
export function AnoLetivoBadge({ variant = 'compact', className }: AnoLetivoBadgeProps) {
  const { instituicaoId } = useInstituicao();
  const { role, user } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAluno = role === 'ALUNO';

  const { data: anoLetivoAtivo, isLoading } = useQuery({
    queryKey: ['ano-letivo-ativo-badge', instituicaoId],
    queryFn: async () => {
      if (!instituicaoId) return null;
      try {
        return await anoLetivoApi.getAtivo();
      } catch {
        return null;
      }
    },
    enabled: !!instituicaoId && !isSuperAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutos
    refetchInterval: 5 * 60 * 1000, // Atualiza a cada 5 minutos
  });

  // Para alunos, verificar se têm anos letivos (matrículas anuais)
  const { data: anosLetivosAluno = [], isLoading: isLoadingAnosLetivosAluno } = useQuery({
    queryKey: ['aluno-anos-letivos-badge', user?.id],
    queryFn: async () => {
      if (!user?.id || !isAluno) return [];
      try {
        const data = await matriculasAnuaisApi.getMeusAnosLetivos();
        return data || [];
      } catch {
        return [];
      }
    },
    enabled: !!user?.id && isAluno,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  // SUPER_ADMIN não precisa de Ano Letivo - não exibir badge
  if (isSuperAdmin) {
    return null;
  }

  if (isLoading || (isAluno && isLoadingAnosLetivosAluno)) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
      </div>
    );
  }

  // Para alunos: se têm anos letivos, não exibir "Sem Ano Letivo"
  // Mesmo que não haja ano letivo ativo na instituição, o aluno pode estar em um ano letivo específico
  if (!anoLetivoAtivo) {
    // Se é aluno e tem anos letivos, não exibir "Sem Ano Letivo"
    if (isAluno && anosLetivosAluno.length > 0) {
      // Exibir o ano letivo mais recente do aluno
      const anoMaisRecente = Math.max(...anosLetivosAluno.map((a: any) => a.anoLetivo));
      const matriculaAnoMaisRecente = anosLetivosAluno.find((a: any) => a.anoLetivo === anoMaisRecente);
      
      if (variant === 'compact') {
        return (
          <Badge 
            variant="outline" 
            className={cn('gap-1.5', className)}
          >
            <Calendar className="h-3 w-3" />
            <span className="font-semibold">{anoMaisRecente}</span>
            {matriculaAnoMaisRecente?.status === 'ATIVA' && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline text-[10px]">ATIVA</span>
              </>
            )}
          </Badge>
        );
      }
      
      // variant === 'full'
      return (
        <Badge 
          variant="outline" 
          className={cn('gap-2 hidden lg:flex', className)}
        >
          <Calendar className="h-3.5 w-3.5" />
          <div className="flex items-center gap-2">
            <span className="font-semibold">Ano Letivo: {anoMaisRecente}</span>
            {matriculaAnoMaisRecente?.status === 'ATIVA' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-700 dark:text-green-400">
                ATIVA
              </span>
            )}
          </div>
        </Badge>
      );
    }
    
    // Se não é aluno ou não tem anos letivos, exibir "Sem Ano Letivo"
    return (
      <Badge 
        variant="destructive" 
        className={cn('gap-1.5', variant === 'full' && 'hidden md:flex', className)}
      >
        <AlertCircle className="h-3 w-3" />
        <span className="hidden sm:inline">Sem Ano Letivo</span>
        <span className="sm:hidden">Sem Ano</span>
      </Badge>
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

  if (variant === 'compact') {
    return (
      <Badge 
        variant="outline" 
        className={cn('gap-1.5', statusColor, className)}
      >
        <Calendar className="h-3 w-3" />
        <span className="font-semibold">{anoLetivoAtivo.ano}</span>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:inline text-[10px]">{statusLabel}</span>
      </Badge>
    );
  }

  // variant === 'full'
  return (
    <Badge 
      variant="outline" 
      className={cn('gap-2 hidden lg:flex', statusColor, className)}
    >
      <Calendar className="h-3.5 w-3.5" />
      <div className="flex items-center gap-2">
        <span className="font-semibold">Ano Letivo: {anoLetivoAtivo.ano}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-current/20">
          {statusLabel}
        </span>
      </div>
      {anoLetivoAtivo.dataInicio && (
        <span className="text-[10px] text-muted-foreground/80">
          {format(new Date(anoLetivoAtivo.dataInicio), "dd/MM", { locale: ptBR })}
          {anoLetivoAtivo.dataFim && ` - ${format(new Date(anoLetivoAtivo.dataFim), "dd/MM", { locale: ptBR })}`}
        </span>
      )}
    </Badge>
  );
}

