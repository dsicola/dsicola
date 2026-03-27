import type { PautaCalculoTemplate } from '../types.js';

/**
 * Mini-pauta secundário Angola — espelho lógico das regras em `calculoNota.service` / `gestaoNotasCalculo`.
 * I/II: MT = (MAC+NPT)/2; com NPP: (MAC+NPP+NPT)/3.
 * III: MT = (MAC+EN)/2 com EN = primeiro não-nulo de EN, NPT, NPP; com NPP + provas: média dos 3.
 * Fallback: nota única "Nº Trimestre" quando não há componentes mini-pauta.
 *
 * Ficheiro JSON espelho: `angola-secundario-v1.json` (mesmo conteúdo para integração externa).
 */
export const angolaSecundarioV1Template: PautaCalculoTemplate = {
  id: 'angola-secundario-v1',
  version: 1,
  bindings: {
    'T1.MAC': '1º Trimestre - MAC',
    'T1.NPP': '1º Trimestre - NPP',
    'T1.NPT': '1º Trimestre - NPT',
    'T2.MAC': '2º Trimestre - MAC',
    'T2.NPP': '2º Trimestre - NPP',
    'T2.NPT': '2º Trimestre - NPT',
    'T3.MAC': '3º Trimestre - MAC',
    'T3.NPP': '3º Trimestre - NPP',
    'T3.NPT': '3º Trimestre - NPT',
    'T3.EN': '3º Trimestre - EN',
  },
  resolvers: [
    /** Exame / prova do III (ordem oficial EN → NPT → NPP) — ramo sem NPP. */
    { id: 'T3.PROVA', op: 'coalesceFirst', keys: ['T3.EN', 'T3.NPT', 'T3.NPP'] },
    /** Com NPP: terceira parcela = NPT ?? EN ?? enOuProv (paridade com calculoNota / gestaoNotasCalculo). */
    { id: 'T3.TERCEIRO_COM_NPP', op: 'coalesceFirst', keys: ['T3.NPT', 'T3.EN', 'T3.PROVA'] },
  ],
  fallbacks: {
    'FALLBACK.MT1': '1º Trimestre',
    'FALLBACK.MT2': '2º Trimestre',
    'FALLBACK.MT3': '3º Trimestre',
  },
  computed: {
    MT1: {
      op: 'if',
      condition: { op: 'anyNotNull', keys: ['T1.MAC', 'T1.NPP', 'T1.NPT'] },
      then: {
        op: 'if',
        condition: { op: 'notNull', key: 'T1.NPP' },
        then: { op: 'div', num: { op: 'sumZero', keys: ['T1.MAC', 'T1.NPP', 'T1.NPT'] }, den: 3 },
        else: { op: 'div', num: { op: 'sumZero', keys: ['T1.MAC', 'T1.NPT'] }, den: 2 },
      },
      else: { op: 'ref', key: 'FALLBACK.MT1' },
    },
    MT2: {
      op: 'if',
      condition: { op: 'anyNotNull', keys: ['T2.MAC', 'T2.NPP', 'T2.NPT'] },
      then: {
        op: 'if',
        condition: { op: 'notNull', key: 'T2.NPP' },
        then: { op: 'div', num: { op: 'sumZero', keys: ['T2.MAC', 'T2.NPP', 'T2.NPT'] }, den: 3 },
        else: { op: 'div', num: { op: 'sumZero', keys: ['T2.MAC', 'T2.NPT'] }, den: 2 },
      },
      else: { op: 'ref', key: 'FALLBACK.MT2' },
    },
    MT3: {
      op: 'if',
      condition: { op: 'anyNotNull', keys: ['T3.MAC', 'T3.NPP', 'T3.PROVA'] },
      then: {
        op: 'if',
        condition: { op: 'notNull', key: 'T3.NPP' },
        then: {
          op: 'div',
          num: { op: 'sumZero', keys: ['T3.MAC', 'T3.NPP', 'T3.TERCEIRO_COM_NPP'] },
          den: 3,
        },
        else: { op: 'div', num: { op: 'sumZero', keys: ['T3.MAC', 'T3.PROVA'] }, den: 2 },
      },
      else: { op: 'ref', key: 'FALLBACK.MT3' },
    },
  },
};
