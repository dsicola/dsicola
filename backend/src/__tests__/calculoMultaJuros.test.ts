/**
 * Testes unitários da lógica de negócio: cálculo de multa e juros (mensalidades).
 * Alinhado ao ROADMAP-100 — testes unitários em lógica de negócio.
 *
 * Execute: npx vitest run src/__tests__/calculoMultaJuros.test.ts
 */

import { describe, it, expect } from 'vitest';
import { calcularMultaJurosValores } from '../utils/calculoMultaJuros.js';

describe('calculoMultaJurosValores', () => {
  const configPadrao = {
    multaPercentual: 2,
    jurosDia: 0.033,
    diasTolerancia: 0,
  };

  it('retorna zeros quando diasAtraso <= 0', () => {
    expect(calcularMultaJurosValores(1000, configPadrao, 0)).toEqual({
      valorMulta: 0,
      valorJuros: 0,
      diasAtraso: 0,
      diasComJuros: 0,
    });
    expect(calcularMultaJurosValores(1000, configPadrao, -1)).toEqual({
      valorMulta: 0,
      valorJuros: 0,
      diasAtraso: -1,
      diasComJuros: 0,
    });
  });

  it('dentro da tolerância não aplica multa nem juros', () => {
    const config = { ...configPadrao, diasTolerancia: 5 };
    const r = calcularMultaJurosValores(1000, config, 3);
    expect(r.valorMulta).toBe(0);
    expect(r.valorJuros).toBe(0);
    expect(r.diasAtraso).toBe(3);
    expect(r.diasComJuros).toBe(0);
  });

  it('após tolerância aplica multa (2% sobre valor base)', () => {
    const r = calcularMultaJurosValores(10000, configPadrao, 10);
    expect(r.valorMulta).toBe(200); // 2% de 10000
    expect(r.diasComJuros).toBe(10);
  });

  it('juros por dia: 0.033% sobre valor base × dias após tolerância', () => {
    const r = calcularMultaJurosValores(10000, configPadrao, 10);
    // 0.033% de 10000 = 3.3 por dia; 10 dias = 33
    expect(r.valorJuros).toBeCloseTo(33, 2);
  });

  it('com tolerância 5, 10 dias atraso = 5 dias com juros', () => {
    const config = { ...configPadrao, diasTolerancia: 5 };
    const r = calcularMultaJurosValores(10000, config, 10);
    expect(r.valorMulta).toBe(200);
    expect(r.diasComJuros).toBe(5);
    // 3.3 * 5 = 16.5
    expect(r.valorJuros).toBeCloseTo(16.5, 2);
  });

  it('valor base zero resulta em multa e juros zero', () => {
    const r = calcularMultaJurosValores(0, configPadrao, 30);
    expect(r.valorMulta).toBe(0);
    expect(r.valorJuros).toBe(0);
  });
});
