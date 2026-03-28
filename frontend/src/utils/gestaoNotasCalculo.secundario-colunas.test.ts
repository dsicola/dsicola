import { describe, it, expect } from 'vitest';
import {
  TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA,
  tiposColunasLancamentoSecundarioFlat,
  tiposColunasLancamentoSecundarioPorTrimestre,
  secundarioUsaNppNaMediaTrimestral,
  mediaTrimestralAngola,
} from './gestaoNotasCalculo';

describe('tiposColunasLancamentoSecundarioPorTrimestre', () => {
  it('I e II sem NPP: só MAC e NPT', () => {
    expect(tiposColunasLancamentoSecundarioPorTrimestre(1, false)).toEqual([
      '1º Trimestre - MAC',
      '1º Trimestre - NPT',
    ]);
    expect(tiposColunasLancamentoSecundarioPorTrimestre(2, false)).toEqual([
      '2º Trimestre - MAC',
      '2º Trimestre - NPT',
    ]);
  });

  it('I e II com NPP: MAC, NPP, NPT', () => {
    expect(tiposColunasLancamentoSecundarioPorTrimestre(1, true)).toEqual([
      '1º Trimestre - MAC',
      '1º Trimestre - NPP',
      '1º Trimestre - NPT',
    ]);
  });

  it('III sem NPP: MAC e EN', () => {
    expect(tiposColunasLancamentoSecundarioPorTrimestre(3, false)).toEqual([
      '3º Trimestre - MAC',
      TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA,
    ]);
  });

  it('III com NPP: MAC, NPP, EN, NPT', () => {
    expect(tiposColunasLancamentoSecundarioPorTrimestre(3, true)).toEqual([
      '3º Trimestre - MAC',
      '3º Trimestre - NPP',
      TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA,
      '3º Trimestre - NPT',
    ]);
  });
});

describe('tiposColunasLancamentoSecundarioFlat', () => {
  it('modelo duas notas por trimestre: 6 tipos (2+2+2)', () => {
    const flat = tiposColunasLancamentoSecundarioFlat(false);
    expect(flat).toHaveLength(6);
    expect(flat.filter((t) => t.includes('NPP'))).toHaveLength(0);
  });

  it('modelo três componentes: 10 tipos (3+3+4) com NPP em todos os trimestres', () => {
    const flat = tiposColunasLancamentoSecundarioFlat(true);
    expect(flat).toHaveLength(10);
    expect(flat.filter((t) => t.endsWith('- NPP'))).toEqual([
      '1º Trimestre - NPP',
      '2º Trimestre - NPP',
      '3º Trimestre - NPP',
    ]);
  });
});

describe('secundarioUsaNppNaMediaTrimestral', () => {
  it('MAC_NPP_NPT força uso de NPP no MT', () => {
    expect(secundarioUsaNppNaMediaTrimestral({ secundarioMiniPautaModelo: 'MAC_NPP_NPT' })).toBe(true);
    expect(secundarioUsaNppNaMediaTrimestral({ secundarioMiniPautaModelo: 'mac_npp_npt' })).toBe(true);
  });

  it('MAC_NPT nunca usa NPP no MT', () => {
    expect(secundarioUsaNppNaMediaTrimestral({ secundarioMiniPautaModelo: 'MAC_NPT' })).toBe(false);
    expect(
      secundarioUsaNppNaMediaTrimestral({ secundarioMiniPautaModelo: 'MAC_NPT', secundarioPesoNpp: 1 }),
    ).toBe(false);
  });

  it('automático (null): NPP se peso > 0', () => {
    expect(secundarioUsaNppNaMediaTrimestral({ secundarioMiniPautaModelo: null, secundarioPesoNpp: 0.2 })).toBe(
      true,
    );
    expect(secundarioUsaNppNaMediaTrimestral({ secundarioMiniPautaModelo: null, secundarioPesoNpp: 0 })).toBe(false);
  });
});

describe('mediaTrimestralAngola', () => {
  it('com NPP ativo e NPP lançado: média de três', () => {
    expect(mediaTrimestralAngola(12, 12, 12, null, true)).toBe(12);
    expect(mediaTrimestralAngola(10, 10, 13, null, true)).toBe(11);
  });

  it('com NPP ativo mas NPP ausente: cai no binário MAC+NPT', () => {
    expect(mediaTrimestralAngola(10, null, 14, null, true)).toBe(12);
  });

  it('MAC_NPT behavioural: só MAC e NPT / 2', () => {
    expect(mediaTrimestralAngola(10, 15, 14, null, false)).toBe(12);
  });
});
