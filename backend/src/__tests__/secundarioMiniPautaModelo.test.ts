/**
 * Garante que a escolha do modelo (MAC_NPT vs MAC_NPP_NPT vs automático legado)
 * altera o flag NPP no motor e que o template Angola produz MT coerente.
 *
 * Paridade API/UI: `secundarioUsaNppNaMediaTrimestral` no frontend deve coincidir com
 * `secundarioUsaNppNaMediaTrimestralFromParametros` (teste "Paridade frontend import" abaixo).
 *
 * Execute: npx vitest run src/__tests__/secundarioMiniPautaModelo.test.ts
 */

import { describe, it, expect } from 'vitest';
import { secundarioUsaNppNaMediaTrimestral } from '../../../frontend/src/utils/gestaoNotasCalculo.js';
import { secundarioUsaNppNaMediaTrimestralFromParametros } from '../services/calculoNota.service.js';
import { avaliarPautaTemplate } from '../pauta-engine/engine.js';
import { angolaSecundarioV1Template } from '../pauta-engine/templates/angolaSecundarioV1.js';
import { valoresPorTipoNotasIndividuais } from '../pauta-engine/facade.js';

function normTipoNota(t: string): string {
  return String(t || '').trim().replace(/°/g, 'º');
}

/** Espelho de `stripNppNotasMiniPautaSec` em calculoNota.service (preview/motor). */
function stripNppNotasMiniPautaSec<T extends { tipo: string }>(
  notas: T[],
  keepNpp: boolean,
): T[] {
  if (keepNpp) return notas;
  return notas.filter((n) => !/^[123][º°oO]\s*trimestre\s*-\s*NPP$/i.test(normTipoNota(n.tipo)));
}

describe('secundarioUsaNppNaMediaTrimestralFromParametros (paridade frontend gestaoNotasCalculo)', () => {
  it('MAC_NPP_NPT força uso de NPP no motor', () => {
    expect(
      secundarioUsaNppNaMediaTrimestralFromParametros({
        secundarioMiniPautaModelo: 'MAC_NPP_NPT',
        secundarioPesoNpp: null,
      }),
    ).toBe(true);
  });

  it('MAC_NPT ignora peso NPP legado', () => {
    expect(
      secundarioUsaNppNaMediaTrimestralFromParametros({
        secundarioMiniPautaModelo: 'MAC_NPT',
        secundarioPesoNpp: 0.5,
      }),
    ).toBe(false);
  });

  it('modelo null + peso NPP > 0 mantém legado (strip NPP desligado)', () => {
    expect(
      secundarioUsaNppNaMediaTrimestralFromParametros({
        secundarioMiniPautaModelo: null,
        secundarioPesoNpp: 0.33,
      }),
    ).toBe(true);
  });

  it('modelo null + sem peso não usa NPP no motor', () => {
    expect(
      secundarioUsaNppNaMediaTrimestralFromParametros({
        secundarioMiniPautaModelo: null,
        secundarioPesoNpp: null,
      }),
    ).toBe(false);
  });

  it('aceita casing misto no modelo', () => {
    expect(
      secundarioUsaNppNaMediaTrimestralFromParametros({
        secundarioMiniPautaModelo: 'mac_npt',
      }),
    ).toBe(false);
    expect(
      secundarioUsaNppNaMediaTrimestralFromParametros({
        secundarioMiniPautaModelo: 'mac_npp_npt',
      }),
    ).toBe(true);
  });

  const casosParidade: Array<{
    nome: string;
    param: { secundarioMiniPautaModelo?: string | null; secundarioPesoNpp?: unknown };
  }> = [
    { nome: 'MAC_NPP sem peso', param: { secundarioMiniPautaModelo: 'MAC_NPP_NPT', secundarioPesoNpp: null } },
    { nome: 'MAC_NPT com peso', param: { secundarioMiniPautaModelo: 'MAC_NPT', secundarioPesoNpp: 1 } },
    { nome: 'auto + peso', param: { secundarioMiniPautaModelo: null, secundarioPesoNpp: 0.2 } },
    { nome: 'auto sem peso', param: { secundarioMiniPautaModelo: undefined, secundarioPesoNpp: null } },
    { nome: 'auto peso zero string', param: { secundarioMiniPautaModelo: null, secundarioPesoNpp: '0' } },
  ];

  it.each(casosParidade)('Paridade frontend import: $nome', ({ param }) => {
    expect(secundarioUsaNppNaMediaTrimestralFromParametros(param)).toBe(
      secundarioUsaNppNaMediaTrimestral(param as Record<string, unknown>),
    );
  });
});

describe('Template Angola v1 — MT1 com e sem NPP nos valores canónicos', () => {
  const base = {
    '1º Trimestre - MAC': 10,
    '1º Trimestre - NPT': 11,
    '2º Trimestre - MAC': 12,
    '2º Trimestre - NPT': 16,
    '3º Trimestre - MAC': 12,
    '3º Trimestre - EN': 10,
  };

  it('sem chave NPP: MT1 = (10+11)/2, MT3 = (12+10)/2', () => {
    const r = avaliarPautaTemplate(angolaSecundarioV1Template, { valoresPorTipoCanonico: base });
    expect(r.saidas.MT1).toBeCloseTo(10.5, 5);
    expect(r.saidas.MT2).toBeCloseTo(14, 5);
    expect(r.saidas.MT3).toBeCloseTo(11, 5);
  });

  it('com NPP no I: MT1 = (10+9+11)/3 (média de três)', () => {
    const r = avaliarPautaTemplate(angolaSecundarioV1Template, {
      valoresPorTipoCanonico: { ...base, '1º Trimestre - NPP': 9 },
    });
    expect(r.saidas.MT1).toBeCloseTo(10, 5);
    expect(r.saidas.MT2).toBeCloseTo(14, 5);
  });
});

describe('Fluxo tipo preview: strip NPP conforme parâmetro + template', () => {
  const notasComNppT1 = [
    { tipo: '1º Trimestre - MAC', valor: 10 },
    { tipo: '1º Trimestre - NPP', valor: 9 },
    { tipo: '1º Trimestre - NPT', valor: 11 },
    { tipo: '2º Trimestre - MAC', valor: 12 },
    { tipo: '2º Trimestre - NPT', valor: 16 },
    { tipo: '3º Trimestre - MAC', valor: 12 },
    { tipo: '3º Trimestre - EN', valor: 10 },
  ];

  it('MAC_NPT (usarNpp=false): ignora NPP → MT1 = 10,5 como ecrã só MAC+NPT', () => {
    const usarNpp = secundarioUsaNppNaMediaTrimestralFromParametros({
      secundarioMiniPautaModelo: 'MAC_NPT',
      secundarioPesoNpp: null,
    });
    expect(usarNpp).toBe(false);
    const filtradas = stripNppNotasMiniPautaSec(notasComNppT1, usarNpp);
    const raw = valoresPorTipoNotasIndividuais(filtradas, normTipoNota);
    const r = avaliarPautaTemplate(angolaSecundarioV1Template, { valoresPorTipoCanonico: raw });
    expect(r.saidas.MT1).toBeCloseTo(10.5, 5);
  });

  it('MAC_NPP_NPT (usarNpp=true): mantém NPP → MT1 = 10 (média de três)', () => {
    const usarNpp = secundarioUsaNppNaMediaTrimestralFromParametros({
      secundarioMiniPautaModelo: 'MAC_NPP_NPT',
      secundarioPesoNpp: null,
    });
    expect(usarNpp).toBe(true);
    const filtradas = stripNppNotasMiniPautaSec(notasComNppT1, usarNpp);
    const raw = valoresPorTipoNotasIndividuais(filtradas, normTipoNota);
    const r = avaliarPautaTemplate(angolaSecundarioV1Template, { valoresPorTipoCanonico: raw });
    expect(r.saidas.MT1).toBeCloseTo(10, 5);
  });
});
