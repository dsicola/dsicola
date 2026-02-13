import { useQuery } from '@tanstack/react-query';
import { anoLetivoApi, reaberturaAnoLetivoApi } from '@/services/api';
import { useInstituicao } from '@/contexts/InstituicaoContext';

/**
 * Hook para verificar se o ano letivo está ENCERRADO
 * Usado para bloquear mutations acadêmicas após encerramento
 * Também verifica se há reabertura ativa que permite operações
 */
export function useAnoLetivoEncerrado(anoLetivoId?: string | null) {
  const { instituicaoId } = useInstituicao();

  const {
    data: anoLetivoEncerrado,
    isLoading,
    error,
  } = useQuery<{ encerrado: boolean; anoLetivo: any | null; mensagem?: string; reabertura?: any }>({
    queryKey: ['ano-letivo-encerrado', instituicaoId, anoLetivoId],
    queryFn: async () => {
      if (!instituicaoId) {
        return { encerrado: false, anoLetivo: null };
      }

      try {
        // Usar endpoint dedicado do backend
        const verificacao = await anoLetivoApi.verificarEncerrado(anoLetivoId || undefined);
        
        // Se estiver encerrado, verificar se há reabertura ativa
        if (verificacao.encerrado && verificacao.anoLetivo?.id) {
          try {
            const reaberturas = await reaberturaAnoLetivoApi.listar({ 
              anoLetivoId: verificacao.anoLetivo.id,
              ativo: true 
            });
            
            const agora = new Date();
            const reaberturaAtiva = reaberturas.find((r: any) => {
              if (!r.ativo) return false;
              const dataFim = new Date(r.dataFim);
              return dataFim >= agora;
            });
            
            if (reaberturaAtiva) {
              return {
                ...verificacao,
                encerrado: false, // Não bloquear se houver reabertura ativa
                reabertura: reaberturaAtiva,
                mensagem: `Reabertura excepcional ativa até ${new Date(reaberturaAtiva.dataFim).toLocaleDateString('pt-BR')}. Escopo: ${reaberturaAtiva.escopo}`,
              };
            }
          } catch (reaberturaError) {
            // Se falhar ao buscar reabertura, manter status original
            console.warn('[useAnoLetivoEncerrado] Erro ao verificar reabertura:', reaberturaError);
          }
        }
        
        return verificacao;
      } catch (error: any) {
        // Se for 404 ou erro similar, retornar não encerrado (não é erro crítico)
        if (error?.response?.status === 404 || error?.response?.status === 400) {
          return { encerrado: false, anoLetivo: null };
        }
        // Para outros erros, retornar não encerrado (fail-safe)
        return { encerrado: false, anoLetivo: null };
      }
    },
    enabled: !!instituicaoId,
    staleTime: 1 * 60 * 1000, // 1 minuto
    retry: 1,
  });

  return {
    isEncerrado: anoLetivoEncerrado?.encerrado || false,
    anoLetivo: anoLetivoEncerrado?.anoLetivo || null,
    mensagem: anoLetivoEncerrado?.mensagem,
    reaberturaAtiva: anoLetivoEncerrado?.reabertura || null,
    isLoading,
    error,
  };
}

