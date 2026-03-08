/**
 * Hook para formatação de valores monetários no módulo Contabilidade.
 * Usa a moeda da instituição (AOA, USD, EUR, etc.) para exibição profissional.
 */
import { useMemo } from 'react';
import { useInstituicao } from '@/contexts/InstituicaoContext';

const MOEDA_PADRAO = 'AOA';

export function useFormatarMoeda() {
  const { config } = useInstituicao();
  const moeda = useMemo(
    () =>
      (config?.moedaPadrao ?? config?.moeda_faturacao ?? config?.moedaFaturacao ?? MOEDA_PADRAO)
        ?.toString()
        .trim()
        .toUpperCase() || MOEDA_PADRAO,
    [config]
  );

  return useMemo(
    () => ({
      formatar: (valor: number, options?: { compact?: boolean }) => {
        if (options?.compact && Math.abs(valor) >= 1000) {
          return new Intl.NumberFormat('pt-AO', {
            style: 'currency',
            currency: moeda,
            notation: 'compact',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(valor);
        }
        return new Intl.NumberFormat('pt-AO', {
          style: 'currency',
          currency: moeda,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(valor);
      },
      formatarNumero: (valor: number) =>
        new Intl.NumberFormat('pt-AO', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(valor),
      moeda,
    }),
    [moeda]
  );
}
