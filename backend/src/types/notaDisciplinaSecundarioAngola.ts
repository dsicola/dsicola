/**
 * Ensino secundário — modelo de notas por disciplina (Angola / mini-pauta).
 *
 * Modelo oficial (mini-pauta II Ciclo / classe de exame): por trimestre MAC + NPT → MT
 * no I e II; no III trimestre MAC + EN (exame nacional) → MT; MFD = média dos três MT.
 * NPP e "3º Trimestre - NPT" mantêm-se apenas como legado / leitura de dados antigos.
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

export const TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA = '3º Trimestre - EN';

/** Tipos de lançamento por célula na mini-pauta oficial (6 instrumentos + MT/MFD calculados no sistema). */
export function tiposLancamentoMiniPautaTrimestre(trim: 1 | 2 | 3): readonly string[] {
  if (trim === 3) {
    return [`${trim}º Trimestre - MAC`, TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA] as const;
  }
  return [`${trim}º Trimestre - MAC`, `${trim}º Trimestre - NPT`] as const;
}

/** @deprecated Preferir `tiposLancamentoMiniPautaTrimestre` — tuplo legado MAC/NPP/NPT. */
export function tiposComponenteTrimestre(trim: 1 | 2 | 3): readonly [string, string, string] {
  return [`${trim}º Trimestre - MAC`, `${trim}º Trimestre - NPP`, `${trim}º Trimestre - NPT`] as const;
}

export function tipoNppTrimestre(trim: 1 | 2 | 3): string {
  return `${trim}º Trimestre - NPP`;
}

/** Chaves sugeridas ao professor / plano (mini-pauta oficial, 6 tipos). */
export const TIPOS_SECUNDARIO_LANCAMENTO_ANGOLA: readonly string[] = [
  ...tiposLancamentoMiniPautaTrimestre(1),
  ...tiposLancamentoMiniPautaTrimestre(2),
  ...tiposLancamentoMiniPautaTrimestre(3),
];

/** NPP em qualquer trimestre e NPT só no III (modelo antigo) — só para leitura / chaves em `notasPorTipo`. */
export const TIPOS_SECUNDARIO_COMPONENTES_LEGADOS: readonly string[] = [
  tipoNppTrimestre(1),
  tipoNppTrimestre(2),
  tipoNppTrimestre(3),
  '3º Trimestre - NPT',
];

export const TIPOS_SECUNDARIO_TRIMESTRE_LEGADO: readonly string[] = ['1º Trimestre', '2º Trimestre', '3º Trimestre'];

/** Segundo instrumento do III trimestre: EN oficial; NPT/NPP como legado. */
export function valorExameOuProvaTrimestre3(getValor: (componente: string) => number | null): number | null {
  const en = getValor(TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA);
  if (en != null) return en;
  const npt = getValor('3º Trimestre - NPT');
  if (npt != null) return npt;
  return getValor('3º Trimestre - NPP');
}

function mediaMiniPautaDoisComponentes(mac: number | null, prova: number | null): number | null {
  if (mac == null && prova == null) return null;
  return ((mac ?? 0) + (prova ?? 0)) / 2;
}

function mediaMiniPautaTresComponentes(mac: number | null, npp: number | null, npt: number | null): number | null {
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
  /** Exame nacional (III trim.) — oficial; legado pode estar só em npp3/npt3. */
  en3: number | null;
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
    for (const t of tiposLancamentoMiniPautaTrimestre(trim)) {
      if (getValor(t) != null) {
        usaModeloAngola = true;
        break;
      }
    }
    if (usaModeloAngola) break;
    const [a, b, c] = tiposComponenteTrimestre(trim);
    if (getValor(a) != null || getValor(b) != null || getValor(c) != null) {
      usaModeloAngola = true;
      break;
    }
  }

  const mt = (trim: 1 | 2 | 3): number | null => {
    if (usaModeloAngola) {
      const macK = `${trim}º Trimestre - MAC`;
      const nppK = tipoNppTrimestre(trim);
      const nptK = `${trim}º Trimestre - NPT`;
      const mac = getValor(macK);
      const npp = getValor(nppK);
      const npt = getValor(nptK);
      if (trim === 3) {
        const enOuNpt = valorExameOuProvaTrimestre3(getValor);
        if (npp != null && (mac != null || npt != null || getValor(TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA) != null)) {
          const prova =
            npt ?? getValor(TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA) ?? enOuNpt;
          return mediaMiniPautaTresComponentes(mac, npp, prova);
        }
        return mediaMiniPautaDoisComponentes(mac, enOuNpt);
      }
      if (npp != null) {
        return mediaMiniPautaTresComponentes(mac, npp, npt);
      }
      return mediaMiniPautaDoisComponentes(mac, npt);
    }
    return mtDeLegado(getValor, trim);
  };

  const [m1a, m1b, m1c] = tiposComponenteTrimestre(1);
  const [m2a, m2b, m2c] = tiposComponenteTrimestre(2);
  const m3a = `${3}º Trimestre - MAC`;
  const m3en = TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA;
  const m3b = tipoNppTrimestre(3);
  const m3c = `${3}º Trimestre - NPT`;

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
    en3: getValor(m3en),
    npp3: getValor(m3b),
    npt3: getValor(m3c),
    mt3: mt(3),
    mfd,
  };
}
