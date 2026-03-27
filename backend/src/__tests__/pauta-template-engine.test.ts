import { describe, it, expect } from 'vitest';
import {
  avaliarMiniPautaSecundarioAngolaV1,
  valoresPorTipoNotasIndividuais,
} from '../pauta-engine/index.js';

function normTipo(t: string): string {
  return String(t || '').trim().replace(/°/g, 'º');
}

describe('pauta-engine angola-secundario-v1', () => {
  it('MT1 e MT2: (MAC+NPT)/2 sem NPP', () => {
    const v: Record<string, number | null | undefined> = {
      '1º Trimestre - MAC': 12,
      '1º Trimestre - NPT': 16,
      '2º Trimestre - MAC': 10,
      '2º Trimestre - NPT': 14,
    };
    const r = avaliarMiniPautaSecundarioAngolaV1(v);
    expect(r.saidas.MT1).toBe(14);
    expect(r.saidas.MT2).toBe(12);
  });

  it('MT1 com NPP legado: média dos três', () => {
    const r = avaliarMiniPautaSecundarioAngolaV1({
      '1º Trimestre - MAC': 10,
      '1º Trimestre - NPP': 8,
      '1º Trimestre - NPT': 16,
    });
    expect(r.saidas.MT1).toBeCloseTo((10 + 8 + 16) / 3, 5);
  });

  it('MT3: (MAC+EN)/2 com exame (EN)', () => {
    const r = avaliarMiniPautaSecundarioAngolaV1({
      '3º Trimestre - MAC': 10,
      '3º Trimestre - EN': 14,
    });
    expect(r.saidas.MT3).toBe(12);
  });

  it('MT3: exame via NPT quando sem EN (PROVA)', () => {
    const r = avaliarMiniPautaSecundarioAngolaV1({
      '3º Trimestre - MAC': 12,
      '3º Trimestre - NPT': 18,
    });
    expect(r.saidas.MT3).toBe(15);
  });

  it('MT3 com NPP: terceira parcela prefere NPT a EN', () => {
    const r = avaliarMiniPautaSecundarioAngolaV1({
      '3º Trimestre - MAC': 10,
      '3º Trimestre - NPP': 8,
      '3º Trimestre - NPT': 16,
      '3º Trimestre - EN': 12,
    });
    expect(r.saidas.MT3).toBeCloseTo((10 + 8 + 16) / 3, 5);
  });

  it('fallback: nota única por trimestre (legado)', () => {
    const r = avaliarMiniPautaSecundarioAngolaV1({
      '1º Trimestre': 11,
      '2º Trimestre': 13,
      '3º Trimestre': 15,
    });
    expect(r.saidas.MT1).toBe(11);
    expect(r.saidas.MT2).toBe(13);
    expect(r.saidas.MT3).toBe(15);
  });

  it('valoresPorTipoNotasIndividuais: primeiro valor por tipo (paridade com find)', () => {
    const notas = [
      { tipo: '1º Trimestre - MAC', valor: 14 },
      { tipo: '1º Trimestre - MAC', valor: 99 },
      { tipo: '1º Trimestre - NPT', valor: 18 },
    ];
    const valores = valoresPorTipoNotasIndividuais(notas, normTipo);
    expect(valores['1º Trimestre - MAC']).toBe(14);
    expect(valores['1º Trimestre - NPT']).toBe(18);
    const r = avaliarMiniPautaSecundarioAngolaV1(valores);
    expect(r.saidas.MT1).toBe(16);
  });
});
