/**
 * Cálculo puro de multa e juros para mensalidades (lógica de negócio).
 * Usado em mensalidade.controller e testado em __tests__/calculoMultaJuros.test.ts.
 *
 * Regras:
 * - Multa: percentual sobre valor base (aplicada uma vez após tolerância).
 * - Juros: percentual por dia sobre valor base, apenas nos dias além da tolerância.
 */

export interface ConfigMultaJuros {
  multaPercentual: number;
  jurosDia: number;
  diasTolerancia: number;
}

export interface ResultadoMultaJuros {
  valorMulta: number;
  valorJuros: number;
  diasAtraso: number;
  diasComJuros: number;
}

/**
 * Calcula valor da multa e dos juros (sem I/O).
 * - valorBase: valor da mensalidade menos descontos
 * - diasAtraso: dias desde dataVencimento até hoje (deve ser > diasTolerancia para aplicar)
 */
export function calcularMultaJurosValores(
  valorBase: number,
  config: ConfigMultaJuros,
  diasAtraso: number
): ResultadoMultaJuros {
  if (diasAtraso <= 0) {
    return { valorMulta: 0, valorJuros: 0, diasAtraso: 0, diasComJuros: 0 };
  }
  if (diasAtraso <= config.diasTolerancia) {
    return {
      valorMulta: 0,
      valorJuros: 0,
      diasAtraso,
      diasComJuros: 0,
    };
  }
  const valorMulta = (valorBase * config.multaPercentual) / 100;
  const diasComJuros = diasAtraso - config.diasTolerancia;
  const jurosPorDia = (valorBase * config.jurosDia) / 100;
  const valorJuros = jurosPorDia * diasComJuros;
  return {
    valorMulta,
    valorJuros,
    diasAtraso,
    diasComJuros,
  };
}
