import { useQuery } from '@tanstack/react-query';
import { anoLetivoApi } from '@/services/api';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAuth } from '@/contexts/AuthContext';

interface AnoLetivoAtivo {
  id: string;
  ano: number;
  status: string;
  dataInicio: string;
  dataFim?: string;
}

/**
 * Hook para verificar se existe um Ano Letivo ATIVO
 * Usado em todas as páginas que requerem operações acadêmicas
 * IMPORTANTE: Para PROFESSOR, executar query mesmo sem instituicaoId no contexto -
 * o backend preenche instituicaoId automaticamente via professor.instituicaoId
 */
export function useAnoLetivoAtivo() {
  const { instituicaoId } = useInstituicao();
  const { user, role } = useAuth();

  const {
    data: anoLetivoAtivo,
    isLoading,
    error,
    refetch,
  } = useQuery<AnoLetivoAtivo | null>({
    queryKey: ['ano-letivo-ativo', instituicaoId, role, user?.id],
    queryFn: async () => {
      try {
        const response = await anoLetivoApi.getAtivo();
        // API retorna null quando não há ano letivo ativo (não é erro)
        return response || null;
      } catch (error: any) {
        // Se for 404 ou erro similar, retornar null (não é erro crítico)
        if (error?.response?.status === 404 || error?.response?.status === 400) {
          return null;
        }
        // Para outros erros, relançar
        throw error;
      }
    },
    // Professor: executar mesmo sem instituicaoId - backend usa professor.instituicaoId
    enabled: !!instituicaoId || (role === 'PROFESSOR' && !!user?.id),
    staleTime: 1 * 60 * 1000, // 1 minuto (reduzido para atualização mais rápida)
    retry: 1,
  });

  const hasAnoLetivoAtivo = !!anoLetivoAtivo;
  const anoLetivoId = anoLetivoAtivo?.id || null;
  const anoLetivo = anoLetivoAtivo?.ano || null;

  return {
    anoLetivoAtivo,
    hasAnoLetivoAtivo,
    anoLetivoId,
    anoLetivo,
    isLoading,
    error,
    refetch,
  };
}

