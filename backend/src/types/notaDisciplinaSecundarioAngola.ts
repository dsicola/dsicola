/**
 * Ensino secundário — modelo de notas por disciplina (Angola / mini-pauta).
 *
 * Persistência: NÃO existe linha única na BD com colunas mac1, npp1, …
 * Cada valor é uma linha `Nota` (ou equivalente) com `componente` semântico,
 * ex.: "1º Trimestre - MAC". O significado vem do identificador, nunca da posição
 * numa grelha ou de "coluna D no Excel".
 *
 * Documentos Excel (modo CELL_MAPPING): cada célula mapeia para um campo
 * semântico (ex.: NPT1 + disciplina). O ficheiro oficial mantém o layout;
 * o sistema só escreve nas coordenadas configuradas.
 */

export function tiposComponenteTrimestre(trim: 1 | 2 | 3): readonly [string, string, string] {
  return [`${trim}º Trimestre - MAC`, `${trim}º Trimestre - NPP`, `${trim}º Trimestre - NPT`] as const;
}

/** Chaves de lançamento Angola (9 componentes + opcional legado por trimestre). */
export const TIPOS_SECUNDARIO_LANCAMENTO_ANGOLA: readonly string[] = [
  ...tiposComponenteTrimestre(1),
  ...tiposComponenteTrimestre(2),
  ...tiposComponenteTrimestre(3),
];

export const TIPOS_SECUNDARIO_TRIMESTRE_LEGADO: readonly string[] = ['1º Trimestre', '2º Trimestre', '3º Trimestre'];

function mediaTrimestral(mac: number | null, npp: number | null, npt: number | null): number | null {
  if (mac == null && npp == null && npt == null) return null;
  return ((mac ?? 0) + (npp ?? 0) + (npt ?? 0)) / 3;
}

function mtDeLegado(getValor: (tipo: string) => number | null, trim: 1 | 2 | 3): number | null {
  return getValor(`${trim}º Trimestre`);
}

/**
 * Vista materializada aluno × disciplina × ano letivo (valores já resolvidos).
 * Útil para exportação, relatórios e testes — não é nome de tabela Prisma.
 */
export interface NotaDisciplinaSecundarioAngola {
  alunoId: string;
  disciplinaId: string;
  turmaId: string;
  anoLetivoId: string;
  mac1: number | null;
  npp1: number | null;
  npt1: number | null;
  mt1: number | null;
  mac2: number | null;
  npp2: number | null;
  npt2: number | null;
  mt2: number | null;
  mac3: number | null;
  npp3: number | null;
  npt3: number | null;
  mt3: number | null;
  mfd: number | null;
}

/**
 * Monta a vista canónica a partir de um getter de valores por chave de componente
 * (como `notasPorTipo` no painel do professor) e média final já calculada no servidor quando existir.
 */
export function montarNotaDisciplinaSecundarioAngola(
  ids: Pick<NotaDisciplinaSecundarioAngola, 'alunoId' | 'disciplinaId' | 'turmaId' | 'anoLetivoId'>,
  getValor: (componente: string) => number | null,
  mfd: number | null
): NotaDisciplinaSecundarioAngola {
  let usaModeloAngola = false;
  for (const trim of [1, 2, 3] as const) {
    const [a, b, c] = tiposComponenteTrimestre(trim);
    if (getValor(a) != null || getValor(b) != null || getValor(c) != null) {
      usaModeloAngola = true;
      break;
    }
  }

  const mt = (trim: 1 | 2 | 3): number | null => {
    if (usaModeloAngola) {
      const [macK, nppK, nptK] = tiposComponenteTrimestre(trim);
      return mediaTrimestral(getValor(macK), getValor(nppK), getValor(nptK));
    }
    return mtDeLegado(getValor, trim);
  };

  const [m1a, m1b, m1c] = tiposComponenteTrimestre(1);
  const [m2a, m2b, m2c] = tiposComponenteTrimestre(2);
  const [m3a, m3b, m3c] = tiposComponenteTrimestre(3);

  return {
    ...ids,
    mac1: getValor(m1a),
    npp1: getValor(m1b),
    npt1: getValor(m1c),
    mt1: mt(1),
    mac2: getValor(m2a),
    npp2: getValor(m2b),
    npt2: getValor(m2c),
    mt2: mt(2),
    mac3: getValor(m3a),
    npp3: getValor(m3b),
    npt3: getValor(m3c),
    mt3: mt(3),
    mfd,
  };
}
