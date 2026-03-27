/**
 * Pré-visualização de médias no painel do professor (Gestão de Notas).
 * Deve refletir percentualMinimoAprovacao, permitirExameRecurso e a zona mínima de recurso
 * alinhados ao backend (calculoNota.service).
 *
 * Mini-pauta secundário (igual ao backend): MT1=(MAC+NPT)/2, MT2 idem, MT3=(MAC+EN)/2;
 * com NPP: (MAC+NPP+NPT ou prova III)/3 só se a instituição define peso NPP em Parâmetros (`secundarioPesoNpp` > 0).
 * MFD = (MT1+MT2+MT3)/3. O parâmetro `pesosMT` em `obterMediasTrimestraisSecundario` é ignorado (exceto evolução futura).
 */

export const NOTA_MAXIMA_PADRAO = 20;

/** Zona típica 7–9,9 (0–20) para exame/recurso; backend usa o mesmo valor até haver campo em ParametrosSistema. */
export const NOTA_MINIMA_ZONA_RECURSO_PADRAO = 7;

export type GestaoNotasThresholds = {
  notaMinimaAprovacao: number;
  notaMinRecurso: number;
  permitirExameRecurso: boolean;
};

export const DEFAULT_GESTAO_NOTAS_THRESHOLDS: GestaoNotasThresholds = {
  notaMinimaAprovacao: 10,
  notaMinRecurso: NOTA_MINIMA_ZONA_RECURSO_PADRAO,
  permitirExameRecurso: false,
};

export const TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA = '3º Trimestre - EN';

export function tiposLancamentoMiniPautaTrimestre(trim: 1 | 2 | 3): readonly string[] {
  if (trim === 3) {
    return [`${trim}º Trimestre - MAC`, TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA] as const;
  }
  return [`${trim}º Trimestre - MAC`, `${trim}º Trimestre - NPT`] as const;
}

/** @deprecated Tuplo legado MAC/NPP/NPT — preferir `tiposLancamentoMiniPautaTrimestre`. */
export function tiposComponenteTrimestre(trim: 1 | 2 | 3): readonly [string, string, string] {
  return [`${trim}º Trimestre - MAC`, `${trim}º Trimestre - NPP`, `${trim}º Trimestre - NPT`] as const;
}

export function tipoNppTrimestre(trim: 1 | 2 | 3): string {
  return `${trim}º Trimestre - NPP`;
}

/** Seis instrumentos da mini-pauta oficial (sugestão de tipos de avaliação). */
export const TIPOS_SECUNDARIO_LANCAMENTO_ANGOLA: string[] = [
  ...tiposLancamentoMiniPautaTrimestre(1),
  ...tiposLancamentoMiniPautaTrimestre(2),
  ...tiposLancamentoMiniPautaTrimestre(3),
];

const TIPOS_SECUNDARIO_COMPONENTES_LEGADOS: string[] = [
  tipoNppTrimestre(1),
  tipoNppTrimestre(2),
  tipoNppTrimestre(3),
  '3º Trimestre - NPT',
];

/** Inclui chaves legadas (uma nota por trimestre) para leitura mista. */
export const TIPOS_SECUNDARIO_MERGE_KEYS: string[] = [
  ...TIPOS_SECUNDARIO_LANCAMENTO_ANGOLA,
  ...TIPOS_SECUNDARIO_COMPONENTES_LEGADOS,
  '1º Trimestre',
  '2º Trimestre',
  '3º Trimestre',
];

export type PesosMTSecundarioCalc = { mac: number; npp: number; npt: number };

/** Só entra NPP no MT quando o peso NPP está explicitamente configurado (> 0). Evita média /3 por notas NPP legadas na BD sem coluna na grelha. */
export function secundarioUsaNppNaMediaTrimestral(
  param: Record<string, unknown> | null | undefined,
): boolean {
  const v = param?.secundarioPesoNpp;
  return v != null && v !== '' && Number(v) > 0;
}

export type OpcoesMediasTrimestraisSecundario = {
  usarNppNaMediaTrimestral?: boolean;
};

export function valorExameOuProvaTrimestre3(getValor: (tipo: string) => number | null): number | null {
  const en = getValor(TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA);
  if (en != null) return en;
  const npt = getValor('3º Trimestre - NPT');
  if (npt != null) return npt;
  return getValor('3º Trimestre - NPP');
}

/** Normaliza rótulo da avaliação/exame para a chave semântica usada no cálculo (ex.: `1º Trimestre - MAC`). */
export function parseTipoNotaParaComponenteSemantico(tipoBruto: string): string | null {
  const n = String(tipoBruto || '')
    .trim()
    .replace(/°/g, 'º');
  if (!n) return null;
  const mAng =
    n.match(/^([123])[º°oO]\s*trimestre\s*-\s*(MAC|NPP|NPT|EN)\b/i) ||
    n.match(/([123])[º°oO]\s*trimestre\s*-\s*(MAC|NPP|NPT|EN)\b/i);
  if (mAng) return `${mAng[1]}º Trimestre - ${mAng[2].toUpperCase()}`;
  const mLeg = n.match(/^([123])[º°oO]\s*trimestre\b/i);
  if (mLeg && !/\s*-\s*(MAC|NPP|NPT|EN)\b/i.test(n)) return `${mLeg[1]}º Trimestre`;
  return null;
}

/**
 * Liga chaves semânticas (BD) às chaves da grelha admin (`1T-MAC`, `3T-EN`, …).
 */
export function criarGetterSemanticoDasChavesGrid(
  notasAluno: Record<string, { valor?: number } | undefined>,
): (tipo: string) => number | null {
  const g = (k: string) => {
    const v = notasAluno[k]?.valor;
    return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  return (tipo: string) => {
    if (tipo === '1º Trimestre - MAC') return g('1T-MAC');
    if (tipo === '1º Trimestre - NPP') return g('1T-NPP');
    if (tipo === '1º Trimestre - NPT') return g('1T-NPT');
    if (tipo === '2º Trimestre - MAC') return g('2T-MAC');
    if (tipo === '2º Trimestre - NPP') return g('2T-NPP');
    if (tipo === '2º Trimestre - NPT') return g('2T-NPT');
    if (tipo === '3º Trimestre - MAC') return g('3T-MAC');
    if (tipo === '3º Trimestre - NPP') return g('3T-NPP');
    if (tipo === TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA) return g('3T-EN') ?? g('3T-NPT');
    if (tipo === '3º Trimestre - NPT') return g('3T-NPT') ?? g('3T-EN');
    return null;
  };
}

/** MT trimestres I e II: (MAC+NPT)/2; com NPP apenas se `usarNppNaMediaTrimestral` e NPP lançado: (MAC+NPP+NPT)/3. */
export function mediaTrimestralAngola(
  mac: number | null,
  npp: number | null,
  npt: number | null,
  _pesos?: PesosMTSecundarioCalc | null,
  usarNppNaMediaTrimestral = false,
): number | null {
  if (mac == null && npp == null && npt == null) return null;
  if (usarNppNaMediaTrimestral && npp != null) {
    return ((mac ?? 0) + (npp ?? 0) + (npt ?? 0)) / 3;
  }
  return ((mac ?? 0) + (npt ?? 0)) / 2;
}

function mediaTrimestralTri3(
  getValor: (tipo: string) => number | null,
  _pesos?: PesosMTSecundarioCalc | null,
  usarNppNaMediaTrimestral = false,
): number | null {
  const mac = getValor('3º Trimestre - MAC');
  const npp = getValor('3º Trimestre - NPP');
  const npt = getValor('3º Trimestre - NPT');
  const enOuProv = valorExameOuProvaTrimestre3(getValor);
  if (mac == null && npp == null && enOuProv == null) return null;
  if (usarNppNaMediaTrimestral && npp != null) {
    const prova = npt ?? getValor(TIPO_COMPONENTE_EXAME_NACIONAL_ANGOLA) ?? enOuProv;
    return ((mac ?? 0) + (npp ?? 0) + (prova ?? 0)) / 3;
  }
  return ((mac ?? 0) + (enOuProv ?? 0)) / 2;
}

/**
 * Devolve MT1, MT2, MT3: mini-pauta (médias aritméticas fixas) ou legado (uma nota por trimestre).
 * @param _pesosMT ignorado (mantido por compatibilidade com chamadas existentes).
 * @param opcoes.usarNppNaMediaTrimestral alinhar a `secundarioPesoNpp` > 0 nos parâmetros da instituição.
 */
export function obterMediasTrimestraisSecundario(
  getValor: (tipo: string) => number | null,
  _pesosMT?: PesosMTSecundarioCalc | null,
  opcoes?: OpcoesMediasTrimestraisSecundario | null,
): {
  mt1: number | null;
  mt2: number | null;
  mt3: number | null;
  usaModeloAngola: boolean;
} {
  const usarNpp = opcoes?.usarNppNaMediaTrimestral ?? false;
  let usaModeloAngola = false;
  for (const trim of [1, 2, 3] as const) {
    for (const t of tiposLancamentoMiniPautaTrimestre(trim)) {
      if (getValor(t) != null) {
        usaModeloAngola = true;
        break;
      }
    }
    if (usaModeloAngola) break;
    const [macK, nppK, nptK] = tiposComponenteTrimestre(trim);
    if (getValor(macK) != null || getValor(nppK) != null || getValor(nptK) != null) {
      usaModeloAngola = true;
      break;
    }
  }

  const mt = (trim: 1 | 2 | 3): number | null => {
    const legado = `${trim}º Trimestre`;
    if (!usaModeloAngola) return getValor(legado);
    if (trim === 3) return mediaTrimestralTri3(getValor, _pesosMT, usarNpp);
    const [macK, nppK, nptK] = tiposComponenteTrimestre(trim);
    return mediaTrimestralAngola(getValor(macK), getValor(nppK), getValor(nptK), _pesosMT, usarNpp);
  };

  return { mt1: mt(1), mt2: mt(2), mt3: mt(3), usaModeloAngola };
}

/** Quantos trimestres têm pelo menos um lançamento (Angola ou legado). */
export function contarTrimestresComLancamentoSecundario(
  getValor: (tipo: string) => number | null,
  usaModeloAngola: boolean,
): number {
  return [1, 2, 3].filter((trim) => {
    if (usaModeloAngola) {
      if (trim === 3) {
        const [a, b] = tiposLancamentoMiniPautaTrimestre(3);
        if (getValor(a) != null || getValor(b) != null) return true;
        const [x, y, z] = tiposComponenteTrimestre(3);
        return getValor(x) != null || getValor(y) != null || getValor(z) != null;
      }
      const [a, b] = tiposLancamentoMiniPautaTrimestre(trim as 1 | 2);
      if (getValor(a) != null || getValor(b) != null) return true;
      const [x, y, z] = tiposComponenteTrimestre(trim as 1 | 2);
      return getValor(x) != null || getValor(y) != null || getValor(z) != null;
    }
    return getValor(`${trim}º Trimestre`) != null;
  }).length;
}

/**
 * Nota final da 3ª prova com trabalho (superior). Recurso não substitui a 3ª prova.
 */
export function calcularNota3ProvaFinal(
  nota3Prova: number | null,
  notaTrabalho: number | null
): number | null {
  if (notaTrabalho !== null && nota3Prova !== null) {
    return (nota3Prova + notaTrabalho) / 2;
  }
  return nota3Prova;
}

/**
 * Ensino secundário (trimestres diretos na pauta): MA = (T1+T2+T3)/3 quando os três existem;
 * com menos trimestres, média dos lançados (pré-visualização). Recuperação só se permitido.
 */
export function calcularMediaFinalEnsinoMedio(
  nota1: number | null,
  nota2: number | null,
  nota3: number | null,
  notaRecuperacao: number | null,
  t: GestaoNotasThresholds
): number | null {
  const { notaMinimaAprovacao, notaMinRecurso, permitirExameRecurso } = t;
  const t1 = nota1 !== null;
  const t2 = nota2 !== null;
  const t3 = nota3 !== null;
  if (!t1 && !t2 && !t3) return null;

  const mediaAnual =
    t1 && t2 && t3
      ? (nota1! + nota2! + nota3!) / 3
      : [nota1, nota2, nota3].filter((n): n is number => n !== null).reduce((a, b) => a + b, 0) /
        [nota1, nota2, nota3].filter((n) => n !== null).length;

  if (mediaAnual >= notaMinimaAprovacao) {
    return mediaAnual;
  }

  if (
    permitirExameRecurso &&
    notaRecuperacao !== null &&
    mediaAnual >= notaMinRecurso &&
    mediaAnual < notaMinimaAprovacao
  ) {
    return (mediaAnual + notaRecuperacao) / 2;
  }

  return mediaAnual;
}

// --- Superior pauta por exames (paridade com calculoNota.service.ts) ---

export type OpcoesCalculoSuperiorPautaFrontend = {
  modeloPauta: 'PAUTA_3_PROVAS' | 'AC_EXAME_PONDERADO';
  pesoAc: number;
  pesoExame: number;
  notaMinimaAcParaContarExame: number;
  acTipoCalculo: 'MEDIA_ARITMETICA' | 'PONDERADA_P1_P2_TRAB';
  pesoAv1: number;
  pesoAv2: number;
  pesoTrab: number;
  recursoModo: 'MEDIA_COM_MF' | 'APROVACAO_DIRETA';
};

export type StatusCalculoSuperior = 'APROVADO' | 'REPROVADO' | 'EXAME_RECURSO' | 'EM_CURSO';

export function buildOpcoesCalculoSuperiorPautaFromParametros(
  param: Record<string, unknown> | null | undefined,
): OpcoesCalculoSuperiorPautaFrontend {
  const modeloPauta =
    param?.superiorModeloCalculo === 'AC_EXAME_PONDERADO' ? 'AC_EXAME_PONDERADO' : 'PAUTA_3_PROVAS';
  const pesoAc = param?.superiorPesoAc != null && param.superiorPesoAc !== '' ? Number(param.superiorPesoAc) : 0.6;
  const pesoExame =
    param?.superiorPesoExame != null && param.superiorPesoExame !== ''
      ? Number(param.superiorPesoExame)
      : 0.4;
  const notaMinimaAcParaContarExame =
    param?.superiorNotaMinimaAcContaExame != null && param.superiorNotaMinimaAcContaExame !== ''
      ? Number(param.superiorNotaMinimaAcContaExame)
      : 10;
  const acTipoCalculo =
    param?.superiorAcTipoCalculo === 'PONDERADA_P1_P2_TRAB'
      ? 'PONDERADA_P1_P2_TRAB'
      : 'MEDIA_ARITMETICA';
  const pesoAv1 =
    param?.superiorPesoAv1 != null && param.superiorPesoAv1 !== '' ? Number(param.superiorPesoAv1) : 0.3;
  const pesoAv2 =
    param?.superiorPesoAv2 != null && param.superiorPesoAv2 !== '' ? Number(param.superiorPesoAv2) : 0.3;
  const pesoTrab =
    param?.superiorPesoTrab != null && param.superiorPesoTrab !== '' ? Number(param.superiorPesoTrab) : 0.1;
  const recursoModo =
    param?.superiorRecursoModo === 'APROVACAO_DIRETA' ? 'APROVACAO_DIRETA' : 'MEDIA_COM_MF';
  return {
    modeloPauta,
    pesoAc,
    pesoExame,
    notaMinimaAcParaContarExame,
    acTipoCalculo,
    pesoAv1,
    pesoAv2,
    pesoTrab,
    recursoModo,
  };
}

function acSuperiorPautaFromGrid(
  p1: number | null,
  p2: number | null,
  notaTrabalho: number | null,
  acTipo: 'MEDIA_ARITMETICA' | 'PONDERADA_P1_P2_TRAB',
  w1: number,
  w2: number,
  w3: number,
): number | null {
  if (acTipo === 'PONDERADA_P1_P2_TRAB') {
    if (p1 == null && p2 == null && notaTrabalho == null) return null;
    return w1 * (p1 ?? 0) + w2 * (p2 ?? 0) + w3 * (notaTrabalho ?? 0);
  }
  const vals: number[] = [];
  if (p1 != null) vals.push(p1);
  if (p2 != null) vals.push(p2);
  if (notaTrabalho != null) vals.push(notaTrabalho);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function superiorPauta3ProvasResultado(
  p1: number | null,
  p2: number | null,
  p3: number | null,
  notaTrabalho: number | null,
  notaRecurso: number | null,
  percentualMinimoAprovacao: number,
  permitirExameRecurso: boolean,
  notaMinimaZona: number,
): { media_parcial: number; media_final: number; status: StatusCalculoSuperior } | null {
  const provasArr = [p1, p2, p3].filter((v): v is number => v !== null);
  if (provasArr.length === 0) return null;

  const mediaProvas = provasArr.reduce((a, b) => a + b, 0) / provasArr.length;
  const mediaParcial =
    notaTrabalho !== null ? mediaProvas * 0.8 + notaTrabalho * 0.2 : mediaProvas;

  let status: StatusCalculoSuperior = 'REPROVADO';
  if (mediaParcial >= percentualMinimoAprovacao) {
    status = 'APROVADO';
  } else if (
    mediaParcial >= notaMinimaZona &&
    mediaParcial < percentualMinimoAprovacao &&
    permitirExameRecurso
  ) {
    status = 'EXAME_RECURSO';
  }

  let mediaFinal = mediaParcial;

  if (notaRecurso != null && status === 'EXAME_RECURSO' && permitirExameRecurso) {
    mediaFinal = (mediaParcial + notaRecurso) / 2;
    if (mediaFinal >= percentualMinimoAprovacao) {
      status = 'APROVADO';
    } else {
      status = 'REPROVADO';
    }
  } else if (status !== 'APROVADO') {
    status = 'REPROVADO';
  }

  if (p1 == null || p2 == null || p3 == null) {
    status = 'EM_CURSO';
  }

  return {
    media_parcial: Number(mediaParcial.toFixed(2)),
    media_final: Number(mediaFinal.toFixed(2)),
    status,
  };
}

function superiorAcExameResultado(
  p1: number | null,
  p2: number | null,
  p3: number | null,
  notaTrabalho: number | null,
  notaRecurso: number | null,
  percentualMinimoAprovacao: number,
  permitirExameRecurso: boolean,
  notaMinimaZona: number,
  op: OpcoesCalculoSuperiorPautaFrontend,
): { media_parcial: number; media_final: number; status: StatusCalculoSuperior } | null {
  const nExame = p3;
  const ac = acSuperiorPautaFromGrid(
    p1,
    p2,
    notaTrabalho,
    op.acTipoCalculo,
    op.pesoAv1,
    op.pesoAv2,
    op.pesoTrab,
  );

  if (ac == null && nExame == null) return null;

  const sumW = op.pesoAc + op.pesoExame;
  const wAc = sumW > 0 ? op.pesoAc / sumW : 0.5;
  const wEx = sumW > 0 ? op.pesoExame / sumW : 0.5;
  const minAc = op.notaMinimaAcParaContarExame;

  let nf: number;
  if (nExame != null && ac != null) {
    if (ac >= minAc) {
      nf = ac * wAc + nExame * wEx;
    } else {
      nf = ac;
    }
  } else if (nExame != null && ac == null) {
    nf = nExame;
  } else {
    nf = ac ?? 0;
  }

  const mediaParcial = ac != null ? Number(ac.toFixed(2)) : Number(nf.toFixed(2));
  let mediaFinal = Number(nf.toFixed(2));
  const mfBase = mediaFinal;
  const aprov = percentualMinimoAprovacao;

  let status: StatusCalculoSuperior = 'REPROVADO';
  if (nExame != null && ac != null && ac >= minAc) {
    if (mfBase >= aprov) status = 'APROVADO';
    else if (mfBase >= notaMinimaZona && mfBase < aprov && permitirExameRecurso) {
      status = 'EXAME_RECURSO';
    } else {
      status = 'REPROVADO';
    }
  } else {
    const base = mfBase;
    if (base >= aprov) status = 'APROVADO';
    else if (base >= notaMinimaZona && base < aprov && permitirExameRecurso) {
      status = 'EXAME_RECURSO';
    } else {
      status = 'REPROVADO';
    }
  }

  const recursoModo = op.recursoModo;

  if (notaRecurso != null && permitirExameRecurso) {
    if (recursoModo === 'APROVACAO_DIRETA') {
      const elegivelRecurso = mfBase < aprov && mfBase >= notaMinimaZona;
      if (elegivelRecurso) {
        status = notaRecurso >= aprov ? 'APROVADO' : 'REPROVADO';
      }
    } else if (status === 'EXAME_RECURSO') {
      mediaFinal = Number(((nf + notaRecurso) / 2).toFixed(2));
      if (mediaFinal >= aprov) status = 'APROVADO';
      else status = 'REPROVADO';
    }
  }

  if (nExame == null) {
    status = 'EM_CURSO';
  }

  return {
    media_parcial: mediaParcial,
    media_final: mediaFinal,
    status,
  };
}

/**
 * Resultado alinhado ao `calcularSuperior` do backend (pauta por exames: PAUTA_3 ou AC+Exame).
 */
export function resultadoCalculoSuperiorPauta(
  p1: number | null,
  p2: number | null,
  p3: number | null,
  notaTrabalho: number | null,
  notaRecurso: number | null,
  t: GestaoNotasThresholds,
  op: OpcoesCalculoSuperiorPautaFrontend,
): { media_parcial: number; media_final: number; status: StatusCalculoSuperior } | null {
  const { notaMinimaAprovacao, notaMinRecurso, permitirExameRecurso } = t;
  if (op.modeloPauta === 'AC_EXAME_PONDERADO') {
    return superiorAcExameResultado(
      p1,
      p2,
      p3,
      notaTrabalho,
      notaRecurso,
      notaMinimaAprovacao,
      permitirExameRecurso,
      notaMinRecurso,
      op,
    );
  }
  return superiorPauta3ProvasResultado(
    p1,
    p2,
    p3,
    notaTrabalho,
    notaRecurso,
    notaMinimaAprovacao,
    permitirExameRecurso,
    notaMinRecurso,
  );
}

/**
 * Ensino superior: paridade com backend (PAUTA_3_PROVAS ou AC_EXAME_PONDERADO via parâmetros).
 */
export function calcularMediaFinalUniversidade(
  nota1: number | null,
  nota2: number | null,
  nota3: number | null,
  notaTrabalho: number | null,
  notaRecurso: number | null,
  t: GestaoNotasThresholds,
  op?: OpcoesCalculoSuperiorPautaFrontend | null,
): number | null {
  const opFinal = op ?? buildOpcoesCalculoSuperiorPautaFromParametros(null);
  const r = resultadoCalculoSuperiorPauta(
    nota1,
    nota2,
    nota3,
    notaTrabalho,
    notaRecurso,
    t,
    opFinal,
  );
  return r?.media_final ?? null;
}
