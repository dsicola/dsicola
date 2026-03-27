import prisma from '../lib/prisma.js';
import { TipoAcademico } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler.js';
import { avaliarPautaTemplate, valoresPorTipoNotasIndividuais } from '../pauta-engine/index.js';
import type { PautaCalculoTemplate } from '../pauta-engine/types.js';
import { resolvePautaTemplateForInstituicao } from './academicTemplate.service.js';

/**
 * Padrão quando `ParametrosSistema.notaMinimaZonaExameRecurso` não existe (ex.: Angola, escala 0–20).
 * Paridade com `gestaoNotasCalculo` / UI Gestão de Notas.
 */
export const DEFAULT_NOTA_MINIMA_ZONA_EXAME_RECURSO = 7;

function normTipoNota(t: string): string {
  return String(t || '').trim().replace(/°/g, 'º');
}

/** Paridade com frontend: NPP só entra no MT quando peso NPP está configurado (> 0). */
function secundarioUsaNppNaMediaTrimestralParam(param: { secundarioPesoNpp?: unknown } | null | undefined): boolean {
  const v = param?.secundarioPesoNpp;
  return v != null && v !== '' && Number(v) > 0;
}

function stripNppNotasMiniPautaSec(notas: NotaIndividual[], keepNpp: boolean): NotaIndividual[] {
  if (keepNpp) return notas;
  return notas.filter((n) => !/^[123][º°oO]\s*trimestre\s*-\s*NPP$/i.test(normTipoNota(n.tipo)));
}

function notasPautaSuperiorPorExames(notas: NotaIndividual[]): boolean {
  return notas.some((n) => {
    const x = normTipoNota(n.tipo);
    return (
      /^[123][ªºa]\s*prova$/i.test(x) ||
      /^[123]\s*ª\s*prova$/i.test(x) ||
      /^p[123]$/i.test(x)
    );
  });
}

function valorProvaIdxSuperior(notas: NotaIndividual[], idx: 1 | 2 | 3): number | null {
  for (const n of notas) {
    const x = normTipoNota(n.tipo);
    const ok =
      (idx === 1 && (/^1\s*[ªºa]\s*prova$/i.test(x) || /^p1$/i.test(x))) ||
      (idx === 2 && (/^2\s*[ªºa]\s*prova$/i.test(x) || /^p2$/i.test(x))) ||
      (idx === 3 && (/^3\s*[ªºa]\s*prova$/i.test(x) || /^p3$/i.test(x)));
    if (ok && n.valor != null) return n.valor;
  }
  return null;
}

function valorTrabalhoSuperior(notas: NotaIndividual[]): number | null {
  const x = notas.find(
    (n) => normTipoNota(n.tipo).toLowerCase() === 'trabalho' || n.tipo === 'TRABALHO',
  );
  return x?.valor ?? null;
}

function valorExameRecursoSuperior(notas: NotaIndividual[]): number | null {
  const x = notas.find((n) => {
    const t = normTipoNota(n.tipo).toLowerCase();
    return (
      t === 'exame de recurso' ||
      n.tipo === 'RECUPERACAO' ||
      n.tipo === 'PROVA_FINAL' ||
      (t.includes('exame') && t.includes('recurso'))
    );
  });
  return x?.valor ?? null;
}

/**
 * Ensino superior com pauta por exames (1ª/2ª/3ª Prova) — paridade com o painel do professor.
 */
function calcularSuperiorPautaExamesSync(
  notas: NotaIndividual[],
  percentualMinimoAprovacao: number,
  permitirExameRecurso: boolean,
  notaMinimaZona: number,
): ResultadoCalculo {
  const observacoes: string[] = [];
  const n1 = valorProvaIdxSuperior(notas, 1);
  const n2 = valorProvaIdxSuperior(notas, 2);
  const n3 = valorProvaIdxSuperior(notas, 3);
  const trab = valorTrabalhoSuperior(notas);
  const rec = valorExameRecursoSuperior(notas);

  const provasArr = [n1, n2, n3].filter((v): v is number => v !== null);
  if (provasArr.length === 0) {
    return {
      media_parcial: 0,
      media_final: 0,
      status: 'EM_CURSO',
      detalhes_calculo: {
        notas_utilizadas: [
          { tipo: '1ª Prova', valor: null },
          { tipo: '2ª Prova', valor: null },
          { tipo: '3ª Prova', valor: null },
          { tipo: 'Trabalho', valor: trab },
          { tipo: 'Exame de Recurso', valor: rec },
        ],
        formula_aplicada: 'Aguardando lançamento de provas',
        observacoes: ['É necessário lançar pelo menos uma prova (1ª, 2ª ou 3ª).'],
      },
    };
  }

  const mediaProvas = provasArr.reduce((a, b) => a + b, 0) / provasArr.length;
  const mediaParcial = trab !== null ? mediaProvas * 0.8 + trab * 0.2 : mediaProvas;

  let status: 'APROVADO' | 'REPROVADO' | 'EXAME_RECURSO' | 'EM_CURSO' = 'REPROVADO';
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
  let formulaMF = `MF = MP = ${mediaParcial.toFixed(2)}`;

  if (rec != null && status === 'EXAME_RECURSO' && permitirExameRecurso) {
    const vRecurso = rec;
    mediaFinal = (mediaParcial + vRecurso) / 2;
    formulaMF = `MF = (MP + Exame de Recurso) / 2 = ${mediaFinal.toFixed(2)}`;
    if (mediaFinal >= percentualMinimoAprovacao) {
      status = 'APROVADO';
    } else {
      status = 'REPROVADO';
    }
  } else if (status !== 'APROVADO') {
    status = 'REPROVADO';
  }

  const provasAnoCompleto = n1 != null && n2 != null && n3 != null;
  if (!provasAnoCompleto) {
    status = 'EM_CURSO';
    observacoes.push(
      'Situação não definitiva: a decisão de aprovação/reprovação por média exige as três provas (1ª, 2ª e 3ª) lançadas.',
    );
  }

  if (rec != null && !permitirExameRecurso) {
    observacoes.push('Notas de recurso encontradas, mas recurso/exame está desativado para esta instituição.');
  }

  const notasParaFrontend: NotaIndividual[] = [
    { tipo: '1ª Prova', valor: n1 },
    { tipo: '2ª Prova', valor: n2 },
    { tipo: '3ª Prova', valor: n3 },
  ];
  if (trab != null) {
    notasParaFrontend.push({ tipo: 'Trabalho', valor: trab });
  }
  if (rec != null) {
    notasParaFrontend.push({ tipo: 'Exame de Recurso', valor: rec });
  }

  return {
    media_parcial: Number(mediaParcial.toFixed(2)),
    media_final: Number(mediaFinal.toFixed(2)),
    status,
    detalhes_calculo: {
      notas_utilizadas: notasParaFrontend,
      formula_aplicada: formulaMF,
      observacoes: observacoes.length > 0 ? observacoes : undefined,
    },
  };
}

/** Modelo de pauta no superior quando há 1ª/2ª/3ª Prova no painel. */
export type ModeloCalculoSuperiorPauta = 'PAUTA_3_PROVAS' | 'AC_EXAME_PONDERADO';

/** Como compor a média contínua no modelo AC+exame (pauta por exames). */
export type SuperiorAcTipoCalculoPauta = 'MEDIA_ARITMETICA' | 'PONDERADA_P1_P2_TRAB';

/**
 * Recurso no superior (AC+exame):
 * - MEDIA_COM_MF: na zona de recurso, MF = (NF + Recurso) / 2
 * - APROVACAO_DIRETA: estilo Excel SE(Rec>=min;"Aprovado";status inicial) — NF numérica inalterada
 */
export type SuperiorRecursoModoPauta = 'MEDIA_COM_MF' | 'APROVACAO_DIRETA';

export interface OpcoesCalculoSuperiorPauta {
  modeloPauta: ModeloCalculoSuperiorPauta;
  pesoAc: number;
  pesoExame: number;
  notaMinimaAcParaContarExame: number;
  acTipoCalculo?: SuperiorAcTipoCalculoPauta;
  /** Pesos da 1ª prova, 2ª prova e trabalho quando acTipoCalculo = PONDERADA_P1_P2_TRAB (ex.: 0,3 / 0,3 / 0,1) */
  pesoAv1?: number;
  pesoAv2?: number;
  pesoTrab?: number;
  recursoModo?: SuperiorRecursoModoPauta;
}

/**
 * Média contínua (MC) para pauta superior no modelo AC+exame.
 * Ponderada: MC = w1×P1 + w2×P2 + w3×Trab (células em falta tratadas como 0, como em folha de cálculo).
 */
export function calcularAcSuperiorParaPauta(
  notas: NotaIndividual[],
  acTipo: SuperiorAcTipoCalculoPauta,
  pesoAv1: number,
  pesoAv2: number,
  pesoTrab: number,
): { ac: number | null; formulaMc: string } {
  if (acTipo === 'PONDERADA_P1_P2_TRAB') {
    const n1 = valorProvaIdxSuperior(notas, 1);
    const n2 = valorProvaIdxSuperior(notas, 2);
    const trab = valorTrabalhoSuperior(notas);
    if (n1 == null && n2 == null && trab == null) {
      return {
        ac: null,
        formulaMc: `MC = ${pesoAv1}×1ªProva + ${pesoAv2}×2ªProva + ${pesoTrab}×Trabalho (sem lançamentos)`,
      };
    }
    const ac = pesoAv1 * (n1 ?? 0) + pesoAv2 * (n2 ?? 0) + pesoTrab * (trab ?? 0);
    return {
      ac: Number(ac.toFixed(4)),
      formulaMc: `MC = ${pesoAv1}×P1 + ${pesoAv2}×P2 + ${pesoTrab}×Trab = ${ac.toFixed(2)}`,
    };
  }
  const valsAc = coletarValoresAcSuperior(notas);
  if (valsAc.length === 0) {
    return {
      ac: null,
      formulaMc: 'MC = média aritmética dos componentes de AC (sem lançamentos)',
    };
  }
  const ac = valsAc.reduce((a, b) => a + b, 0) / valsAc.length;
  return {
    ac: Number(ac.toFixed(4)),
    formulaMc: `MC = média(${valsAc.length} componentes) = ${ac.toFixed(2)}`,
  };
}

function isTerceiraProvaTextoSuperior(t: string): boolean {
  const x = normTipoNota(t);
  return /^3\s*[ªºa]\s*prova$/i.test(x) || /^p3$/i.test(x.trim());
}

function jaIncluidoEmP1P2TrabSuperior(t: string): boolean {
  const x = normTipoNota(t);
  return (
    /^1\s*[ªºa]\s*prova$/i.test(x) ||
    /^p1$/i.test(x.trim()) ||
    /^2\s*[ªºa]\s*prova$/i.test(x) ||
    /^p2$/i.test(x.trim()) ||
    /^trabalho$/i.test(x)
  );
}

function isRecursoTextoSuperior(t: string): boolean {
  const s = normTipoNota(t)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    s === 'recuperacao' ||
    s.includes('exame de recurso') ||
    (s.includes('exame') && s.includes('recurso'))
  );
}

/**
 * Componentes de Avaliação Contínua (AC): 1ª e 2ª provas, trabalho, testes/participação
 * (exclui 3ª prova = exame final e recurso).
 */
function coletarValoresAcSuperior(notas: NotaIndividual[]): number[] {
  const vals: number[] = [];
  const n1 = valorProvaIdxSuperior(notas, 1);
  const n2 = valorProvaIdxSuperior(notas, 2);
  const trab = valorTrabalhoSuperior(notas);
  if (n1 != null) vals.push(n1);
  if (n2 != null) vals.push(n2);
  if (trab != null) vals.push(trab);

  for (const n of notas) {
    if (n.valor == null) continue;
    const t = normTipoNota(n.tipo);
    if (isRecursoTextoSuperior(t)) continue;
    if (isTerceiraProvaTextoSuperior(t)) continue;
    if (jaIncluidoEmP1P2TrabSuperior(t)) continue;
    const tl = t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (tl.includes('participacao') || tl.includes('participação')) {
      vals.push(n.valor);
      continue;
    }
    if (tl.includes('teste') && !tl.includes('prova')) {
      vals.push(n.valor);
    }
  }
  return vals;
}

/**
 * Superior — MC conforme tipo (média aritmética ou ponderada P1/P2/Trab); NF = MC×wAC + Exame×wEx (se MC ≥ mínimo).
 * Recurso: MEDIA_COM_MF ou APROVACAO_DIRETA (Excel: SE(Rec>=min;Aprovado;status inicial)).
 */
function calcularSuperiorAcExamePonderadoSync(
  notas: NotaIndividual[],
  percentualMinimoAprovacao: number,
  permitirExameRecurso: boolean,
  notaMinimaZona: number,
  opcoes: OpcoesCalculoSuperiorPauta,
): ResultadoCalculo {
  const observacoes: string[] = [];
  const nExame = valorProvaIdxSuperior(notas, 3);
  const rec = valorExameRecursoSuperior(notas);
  const acTipo = opcoes.acTipoCalculo ?? 'MEDIA_ARITMETICA';
  const wAv1 = opcoes.pesoAv1 ?? 0.3;
  const wAv2 = opcoes.pesoAv2 ?? 0.3;
  const wTrab = opcoes.pesoTrab ?? 0.1;
  const { ac, formulaMc } = calcularAcSuperiorParaPauta(notas, acTipo, wAv1, wAv2, wTrab);
  const notaMinimaAcParaContarExame = opcoes.notaMinimaAcParaContarExame;
  const recursoModo = opcoes.recursoModo ?? 'MEDIA_COM_MF';

  if (ac == null && nExame == null) {
    return {
      media_parcial: 0,
      media_final: 0,
      status: 'EM_CURSO',
      detalhes_calculo: {
        notas_utilizadas: [
          { tipo: 'AC (média contínua)', valor: null },
          { tipo: '3ª Prova (Exame final)', valor: null },
          { tipo: 'Exame de Recurso', valor: rec },
        ],
        formula_aplicada: 'Aguardando lançamento da avaliação contínua e/ou exame final',
        observacoes: ['Lance pelo menos um componente de AC (ex.: 1ª Prova, 2ª Prova, Trabalho) ou o exame final.'],
      },
    };
  }

  const pesoAcIn = opcoes.pesoAc;
  const pesoExameIn = opcoes.pesoExame;
  const sumW = pesoAcIn + pesoExameIn;
  const wAc = sumW > 0 ? pesoAcIn / sumW : 0.5;
  const wEx = sumW > 0 ? pesoExameIn / sumW : 0.5;

  let nf: number;
  let formulaNf: string;

  if (nExame != null && ac != null) {
    if (ac >= notaMinimaAcParaContarExame) {
      nf = ac * wAc + nExame * wEx;
      formulaNf = `NF = MC×${wAc.toFixed(2)} + Exame×${wEx.toFixed(2)} = (${ac.toFixed(2)}×${wAc.toFixed(2)}) + (${nExame.toFixed(2)}×${wEx.toFixed(2)}) = ${nf.toFixed(2)}`;
    } else {
      nf = ac;
      formulaNf = `NF = MC = ${ac.toFixed(2)} (exame ${nExame.toFixed(2)} não integra: MC < ${notaMinimaAcParaContarExame})`;
      observacoes.push(
        `A nota do exame final não entrou na média porque a média contínua (${ac.toFixed(2)}) é inferior ao mínimo configurado (${notaMinimaAcParaContarExame}).`,
      );
    }
  } else if (nExame != null && ac == null) {
    nf = nExame;
    formulaNf = `NF = Exame = ${nExame.toFixed(2)} (sem componentes de AC lançados)`;
    observacoes.push('Nenhum componente de AC encontrado; apenas exame final foi considerado.');
  } else {
    nf = ac ?? 0;
    formulaNf =
      ac != null
        ? `Prévia: ${formulaMc} — aguardando exame final`
        : 'Sem dados';
    if (ac != null) {
      observacoes.push('Exame final ainda não lançado; a nota final será completada com MC×peso + Exame×peso quando houver 3ª Prova.');
    }
  }

  const mediaParcial = ac != null ? Number(ac.toFixed(2)) : Number(nf.toFixed(2));
  let mediaFinal = Number(nf.toFixed(2));
  const mfBase = mediaFinal;
  const aprov = percentualMinimoAprovacao;

  let status: ResultadoCalculo['status'] = 'REPROVADO';
  if (nExame != null && ac != null && ac >= notaMinimaAcParaContarExame) {
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

  if (rec != null && permitirExameRecurso) {
    if (recursoModo === 'APROVACAO_DIRETA') {
      const elegivelRecurso = mfBase < aprov && mfBase >= notaMinimaZona;
      if (elegivelRecurso) {
        status = rec >= aprov ? 'APROVADO' : 'REPROVADO';
        formulaNf += `; recurso ${rec.toFixed(2)} (aprovação direta ≥ ${aprov}): ${status === 'APROVADO' ? 'APROVADO' : 'REPROVADO'}`;
      } else if (mfBase < aprov) {
        observacoes.push(
          mfBase < notaMinimaZona
            ? 'Nota de recurso não aplicada: NF abaixo da zona mínima para exame de recurso.'
            : 'Nota de recurso não aplicada (NF já igual ou acima da aprovação).',
        );
      }
    } else if (status === 'EXAME_RECURSO') {
      const vRecurso = rec;
      mediaFinal = Number(((nf + vRecurso) / 2).toFixed(2));
      formulaNf += ` → após recurso: (NF + Recurso)/2 = ${mediaFinal.toFixed(2)}`;
      if (mediaFinal >= aprov) status = 'APROVADO';
      else status = 'REPROVADO';
    }
  } else if (rec != null && !permitirExameRecurso) {
    observacoes.push('Notas de recurso encontradas, mas recurso/exame está desativado para esta instituição.');
  }

  if (nExame == null) {
    status = 'EM_CURSO';
    observacoes.push(
      'Situação não definitiva: a decisão final por média (AP/REP) considera a nota do exame final (3ª prova), quando aplicável ao modelo.',
    );
  }

  const labelAc =
    acTipo === 'PONDERADA_P1_P2_TRAB' ? 'MC (ponderada 1ª+2ª+Trab)' : 'MC (média componentes AC)';
  const notasParaFrontend: NotaIndividual[] = [
    { tipo: labelAc, valor: ac != null ? Number(ac.toFixed(2)) : null },
    { tipo: '1ª Prova', valor: valorProvaIdxSuperior(notas, 1) },
    { tipo: '2ª Prova', valor: valorProvaIdxSuperior(notas, 2) },
    { tipo: '3ª Prova (Exame final)', valor: nExame },
    { tipo: 'Trabalho', valor: valorTrabalhoSuperior(notas) },
  ];
  if (rec != null) {
    notasParaFrontend.push({ tipo: 'Exame de Recurso', valor: rec });
  }

  return {
    media_parcial: mediaParcial,
    media_final: mediaFinal,
    status,
    detalhes_calculo: {
      notas_utilizadas: notasParaFrontend,
      formula_aplicada: `${formulaMc}; ${formulaNf}`,
      observacoes: observacoes.length > 0 ? observacoes : undefined,
    },
  };
}

/**
 * Média contínua MC (pauta superior) para validação antes de lançar exame final — multi-tenant via `dados`.
 */
export async function obterMediaAcSuperiorPauta(dados: DadosCalculoNota): Promise<number | null> {
  const notas = await buscarNotasAluno(dados);
  if (!notasPautaSuperiorPorExames(notas)) return null;
  const params = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId: dados.instituicaoId },
    select: {
      superiorAcTipoCalculo: true,
      superiorPesoAv1: true,
      superiorPesoAv2: true,
      superiorPesoTrab: true,
    },
  });
  const acTipo: SuperiorAcTipoCalculoPauta =
    params?.superiorAcTipoCalculo === 'PONDERADA_P1_P2_TRAB' ? 'PONDERADA_P1_P2_TRAB' : 'MEDIA_ARITMETICA';
  const w1 = params?.superiorPesoAv1 != null ? Number(params.superiorPesoAv1) : 0.3;
  const w2 = params?.superiorPesoAv2 != null ? Number(params.superiorPesoAv2) : 0.3;
  const w3 = params?.superiorPesoTrab != null ? Number(params.superiorPesoTrab) : 0.1;
  const { ac } = calcularAcSuperiorParaPauta(notas, acTipo, w1, w2, w3);
  return ac != null ? Number(ac.toFixed(2)) : null;
}

function notasPautaSecundariaPorExames(notas: NotaIndividual[]): boolean {
  return notas.some((n) => {
    const x = normTipoNota(n.tipo);
    return (
      /^[123][º°o]\s*trimestre$/i.test(x) ||
      /^[123][º°o]\s*trimestre\s*-\s*(MAC|NPP|NPT|EN)$/i.test(x)
    );
  });
}

export type PesosMiniPautaSecundario = { mac: number; npp: number; npt: number };

/**
 * Mini-pauta secundário via template da instituição (BD) ou builtin — `pauta-engine`.
 * Parâmetro pesos ignorado (compatibilidade de assinatura).
 */
function mtTrimestrePauta(
  notas: NotaIndividual[],
  trim: 1 | 2 | 3,
  template: PautaCalculoTemplate,
  _pesos?: PesosMiniPautaSecundario | null,
): number | null {
  const valores = valoresPorTipoNotasIndividuais(notas, normTipoNota);
  const r = avaliarPautaTemplate(template, { valoresPorTipoCanonico: valores });
  const k = trim === 1 ? 'MT1' : trim === 2 ? 'MT2' : 'MT3';
  return r.saidas[k] ?? null;
}

function extrairRecuperacaoSecundario(notas: NotaIndividual[]): number | null {
  const x = notas.find((n) => {
    if (n.tipo === 'RECUPERACAO') return true;
    const s = normTipoNota(n.tipo)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return s === 'recuperacao';
  });
  return x?.valor ?? null;
}

/**
 * Secundário com pauta por exames (1º/2º/3º Trimestre + Recuperação) — paridade com Gestão de Notas.
 */
function calcularSecundarioPautaExamesSync(
  notas: NotaIndividual[],
  mediaMinima: number,
  permitirExameRecurso: boolean,
  notaMinimaZona: number,
  pesosMiniPauta: PesosMiniPautaSecundario | null | undefined,
  template: PautaCalculoTemplate,
): ResultadoCalculo {
  const observacoes: string[] = [];
  const t1 = mtTrimestrePauta(notas, 1, template, pesosMiniPauta);
  const t2 = mtTrimestrePauta(notas, 2, template, pesosMiniPauta);
  const t3 = mtTrimestrePauta(notas, 3, template, pesosMiniPauta);
  const rec = extrairRecuperacaoSecundario(notas);

  const qtd = [t1, t2, t3].filter((v) => v != null).length;
  const provasCompletas = t1 != null && t2 != null && t3 != null;

  if (qtd === 0) {
    return {
      media_final: 0,
      status: 'EM_CURSO',
      detalhes_calculo: {
        notas_utilizadas: [1, 2, 3].map((trim) => ({
          tipo: `${trim}º Trimestre`,
          valor: null,
          peso: 1,
        })),
        formula_aplicada: 'Aguardando lançamento das notas trimestrais',
        observacoes: ['Nenhuma nota de trimestre encontrada.'],
      },
    };
  }

  const mediaAnual =
    provasCompletas && t1 != null && t2 != null && t3 != null
      ? (t1 + t2 + t3) / 3
      : (([t1, t2, t3].filter((v): v is number => v != null) as number[]).reduce((a, b) => a + b, 0) /
          Math.max(1, [t1, t2, t3].filter((v) => v != null).length));

  let mediaFinal = mediaAnual;
  if (
    permitirExameRecurso &&
    rec != null &&
    mediaAnual >= notaMinimaZona &&
    mediaAnual < mediaMinima
  ) {
    mediaFinal = (mediaAnual + rec) / 2;
  }

  if (qtd > 0 && !provasCompletas) {
    observacoes.push('Pauta anual incompleta: são necessários os 3 trimestres para fecho definitivo.');
  }

  // Sem os 3 trimestres não há decisão final — paridade com calcularSecundario (MT1+MT2+MT3)
  let status: ResultadoCalculo['status'] = 'EM_CURSO';
  if (provasCompletas) {
    if (mediaFinal >= mediaMinima) {
      status = 'APROVADO';
    } else if (
      permitirExameRecurso &&
      mediaAnual >= notaMinimaZona &&
      mediaAnual < mediaMinima &&
      rec == null
    ) {
      status = 'EXAME_RECURSO';
    } else {
      status = 'REPROVADO';
    }
  }

  const notasParaFrontend: NotaIndividual[] = [1, 2, 3].map((trim) => ({
    tipo: `${trim}º Trimestre`,
    valor: trim === 1 ? t1 : trim === 2 ? t2 : t3,
    peso: 1,
  }));
  if (rec != null) {
    notasParaFrontend.push({ tipo: 'Recuperação', valor: rec, peso: 1 });
  }

  return {
    media_parcial: Number(mediaAnual.toFixed(2)),
    media_anual: Number(mediaAnual.toFixed(2)),
    media_final: Number(mediaFinal.toFixed(2)),
    status,
    detalhes_calculo: {
      notas_utilizadas: notasParaFrontend,
      formula_aplicada: provasCompletas
        ? `MFD = (MT1+MT2+MT3)/3 com MTk = (MAC+NPT)/2 (III: MAC+EN/2); resultado = (${[t1, t2, t3].map((x) => (x != null ? x.toFixed(1) : '—')).join('+')})/3 = ${mediaAnual.toFixed(2)}; MF após recuperação (se houver) = ${mediaFinal.toFixed(2)}`
        : `Média parcial dos trimestres lançados = ${mediaAnual.toFixed(2)} (pauta incompleta — MFD oficial exige os 3 trimestres)`,
      observacoes: observacoes.length > 0 ? observacoes : undefined,
    },
  };
}

/**
 * Interface para dados de entrada do cálculo
 */
export interface DadosCalculoNota {
  alunoId: string;
  planoEnsinoId?: string; // OBRIGATÓRIO: Cálculo baseado em Plano de Ensino (se não fornecido, pode ser derivado de avaliacaoId)
  disciplinaId?: string;
  turmaId?: string;
  professorId?: string; // CRÍTICO: Garantir que média use apenas notas do professor correto (professores.id)
  avaliacaoId?: string;
  anoLetivoId?: string;
  anoLetivo?: number;
  semestreId?: string;
  trimestreId?: string;
  trimestre?: number;
  instituicaoId: string;
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null; // Tipo acadêmico da instituição (vem do JWT, não buscar no banco)
}

/**
 * Interface para notas individuais
 */
export interface NotaIndividual {
  tipo: string; // P1, P2, P3, Trabalho, Recurso, 1º Trimestre, etc.
  valor: number | null; // null = sem nota lançada (ex.: trimestre vazio no boletim)
  peso?: number;
  avaliacaoId?: string;
}

/**
 * Interface para resultado do cálculo
 */
export interface ResultadoCalculo {
  media_parcial?: number;
  media_final: number;
  media_trimestral?: { [trimestre: number]: number };
  media_anual?: number;
  /** EM_CURSO = ano/período ainda não fechado para efeitos de decisão final (não equivale a reprovação) */
  status: 'APROVADO' | 'REPROVADO' | 'EXAME_RECURSO' | 'REPROVADO_FALTA' | 'EM_CURSO';
  detalhes_calculo: {
    notas_utilizadas: NotaIndividual[];
    formula_aplicada: string;
    observacoes?: string[];
  };
}

/**
 * Obter tipo acadêmico da instituição
 */
async function obterTipoAcademico(instituicaoId: string): Promise<TipoAcademico | null> {
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { tipoAcademico: true }
  });

  return instituicao?.tipoAcademico || null;
}

/**
 * Buscar todas as notas do aluno para um Plano de Ensino
 * REGRA MESTRA: Cálculo baseado em Plano de Ensino
 */
async function buscarNotasAluno(dados: DadosCalculoNota): Promise<NotaIndividual[]> {
  const where: any = {
    alunoId: dados.alunoId,
    ...(dados.disciplinaId && { disciplinaId: dados.disciplinaId }),
    ...(dados.turmaId && { turmaId: dados.turmaId }),
  };

  // CRÍTICO: Combinar instituicaoId E professorId em AND para não haver vazamento multi-tenant
  // (evitar que o segundo spread sobrescreva o primeiro OR)
  const andConditions: Array<Record<string, unknown>> = [];
  if (dados.instituicaoId != null) {
    andConditions.push({ OR: [{ instituicaoId: dados.instituicaoId }, { instituicaoId: null }] });
  }
  if (dados.professorId) {
    andConditions.push({ OR: [{ professorId: dados.professorId }, { professorId: null }] });
  }
  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  // PRIORIDADE 1: Se tiver planoEnsinoId, filtrar diretamente por ele
  if (dados.planoEnsinoId) {
    where.planoEnsinoId = dados.planoEnsinoId;
  }
  // PRIORIDADE 2: Se tiver avaliacaoId, obter planoEnsinoId da avaliação
  else if (dados.avaliacaoId) {
    const avaliacao = await prisma.avaliacao.findFirst({
      where: {
        id: dados.avaliacaoId,
        instituicaoId: dados.instituicaoId,
      },
    });

    // Acessar planoEnsinoId usando type assertion
    const planoEnsinoId = (avaliacao as any)?.planoEnsinoId;
    if (planoEnsinoId) {
      where.planoEnsinoId = planoEnsinoId;
    } else {
      // Se não encontrou avaliação ou ela não tem planoEnsinoId, usar avaliacaoId diretamente
      where.avaliacaoId = dados.avaliacaoId;
    }
  }
  // PRIORIDADE 3: Fallback - buscar avaliações por turmaId/semestreId/trimestreId (compatibilidade)
  else {
    const avaliacaoWhere: any = {
      instituicaoId: dados.instituicaoId,
    };

    if (dados.turmaId) {
      avaliacaoWhere.turmaId = dados.turmaId;
    }

    if (dados.semestreId) {
      avaliacaoWhere.semestreId = dados.semestreId;
    }

    if (dados.trimestreId) {
      avaliacaoWhere.trimestreId = dados.trimestreId;
    }

    if (dados.trimestre) {
      avaliacaoWhere.trimestre = dados.trimestre;
    }

    const avaliacoes = await prisma.avaliacao.findMany({
      where: avaliacaoWhere,
    });

    if (avaliacoes.length > 0) {
      // Agrupar por planoEnsinoId se houver
      const planoEnsinoIds = avaliacoes.map(a => (a as any).planoEnsinoId).filter(Boolean) as string[];
      if (planoEnsinoIds.length > 0) {
        where.planoEnsinoId = { in: planoEnsinoIds };
      } else {
        // Se não há planoEnsinoId, usar avaliacaoId (fallback para compatibilidade)
        where.avaliacaoId = { in: avaliacoes.map(a => a.id) };
      }
    } else {
      // Se não há avaliações, retornar array vazio
      return [];
    }
  }

  const notas = await prisma.nota.findMany({
    where,
    include: {
      avaliacao: {
        select: {
          id: true,
          tipo: true,
          peso: true,
          trimestre: true,
          semestreId: true,
          trimestreId: true,
          data: true,
        }
      },
      exame: {
        select: {
          id: true,
          tipo: true,
          nome: true,
          dataExame: true,
        }
      }
    },
    orderBy: { createdAt: 'asc' },
  });

  return notas.map(nota => {
    const tipo = nota.avaliacao?.tipo || nota.exame?.tipo || nota.exame?.nome || 'PROVA';
    return {
      tipo,
      valor: nota.valor != null ? Number(nota.valor) : null,
      peso: nota.avaliacao?.peso ? Number(nota.avaliacao.peso) : 1,
      avaliacaoId: nota.avaliacaoId || undefined,
    };
  });
}

/**
 * Calcular média para ENSINO SUPERIOR
 * 
 * REGRAS:
 * - P1, P2, P3 (opcional), Trabalho (opcional), Recurso (opcional)
 * - Média Parcial (MP):
 *   - Sem Trabalho: MP = (P1 + P2 + P3) / quantidade
 *   - Com Trabalho: MP = (Média das Provas × 0.8) + (Trabalho × 0.2)
 * - Status após MP:
 *   - MP ≥ 10 → APROVADO
 *   - MP ≥ 7 e < 10 → EXAME_RECURSO
 *   - MP < 7 → REPROVADO
 * - Média Final (MF):
 *   - Com Recurso: MF = (MP + Recurso) / 2
 *   - Sem Recurso: MF = MP
 * - Status Final:
 *   - MF ≥ 10 → APROVADO
 *   - MF < 10 → REPROVADO
 */
export async function calcularSuperior(
  notas: NotaIndividual[],
  percentualMinimoAprovacao: number = 10,
  tipoMedia: string = 'simples',
  permitirExameRecurso: boolean = false,
  notaMinimaZonaExameRecurso: number = DEFAULT_NOTA_MINIMA_ZONA_EXAME_RECURSO,
  opcoesPauta?: OpcoesCalculoSuperiorPauta | null,
): Promise<ResultadoCalculo> {
  const observacoes: string[] = [];

  if (notasPautaSuperiorPorExames(notas)) {
    if (opcoesPauta?.modeloPauta === 'AC_EXAME_PONDERADO') {
      return calcularSuperiorAcExamePonderadoSync(
        notas,
        percentualMinimoAprovacao,
        permitirExameRecurso,
        notaMinimaZonaExameRecurso,
        opcoesPauta,
      );
    }
    return calcularSuperiorPautaExamesSync(
      notas,
      percentualMinimoAprovacao,
      permitirExameRecurso,
      notaMinimaZonaExameRecurso,
    );
  }

  // Buscar avaliações para ordenar por data e identificar P1, P2, P3
  const avaliacaoIds = notas.map(n => n.avaliacaoId).filter(Boolean) as string[];
  const avaliacoes = await prisma.avaliacao.findMany({
    where: {
      id: { in: avaliacaoIds },
    },
    select: {
      id: true,
      tipo: true,
      data: true,
      nome: true,
    },
    orderBy: {
      data: 'asc',
    },
  });

  // Separar notas por tipo, ordenadas por data da avaliação
  // P1, P2, P3 são identificadas pela ordem (primeira, segunda, terceira prova por data)
  const provasNotas = notas.filter(n => n.tipo === 'PROVA');
  
  // Ordenar provas por data da avaliação
  const provas = provasNotas
    .map(nota => {
      const avaliacao = avaliacoes.find(av => av.id === nota.avaliacaoId);
      return { nota, avaliacao, data: avaliacao?.data || new Date(0) };
    })
    .sort((a, b) => a.data.getTime() - b.data.getTime())
    .map((item, index) => {
      // Identificar P1, P2, P3 pela ordem ou pelo nome da avaliação
      const nomeAvaliacao = item.avaliacao?.nome?.toUpperCase() || '';
      let identificacao = '';
      
      // Tentar identificar pelo nome (ex: "P1", "1ª Prova", "Prova 1")
      if (nomeAvaliacao.includes('P1') || nomeAvaliacao.includes('1ª') || nomeAvaliacao.includes('1º') || nomeAvaliacao.match(/PROVA\s*1/i)) {
        identificacao = 'P1';
      } else if (nomeAvaliacao.includes('P2') || nomeAvaliacao.includes('2ª') || nomeAvaliacao.includes('2º') || nomeAvaliacao.match(/PROVA\s*2/i)) {
        identificacao = 'P2';
      } else if (nomeAvaliacao.includes('P3') || nomeAvaliacao.includes('3ª') || nomeAvaliacao.includes('3º') || nomeAvaliacao.match(/PROVA\s*3/i)) {
        identificacao = 'P3';
      } else {
        // Se não identificou pelo nome, usar ordem: primeira = P1, segunda = P2, terceira = P3
        identificacao = index === 0 ? 'P1' : index === 1 ? 'P2' : index === 2 ? 'P3' : `P${index + 1}`;
      }
      
      return { ...item.nota, identificacao };
    });
  
  const trabalhos = notas.filter(
    (n) => n.tipo === 'TRABALHO' || normTipoNota(n.tipo).toLowerCase() === 'trabalho',
  );
  const recursos = notas.filter((n) => {
    const t = normTipoNota(n.tipo).toLowerCase();
    return (
      n.tipo === 'RECUPERACAO' ||
      n.tipo === 'PROVA_FINAL' ||
      t === 'exame de recurso' ||
      (t.includes('exame') && t.includes('recurso'))
    );
  });

  // Se não há provas, retornar resultado com status apropriado (não erro)
  // Sempre incluir P1, P2 e Exame (com valor null) para o boletim carregar os três campos
  if (provas.length === 0) {
    const outrasNotas = [
      ...trabalhos.map((t) => ({ ...t, tipo: 'Trabalho' as string })),
      ...recursos.map((r) => ({ ...r, tipo: 'Exame de Recurso' as string })),
    ];
    const notasParaFrontendVazias: NotaIndividual[] = [
      { tipo: 'P1', valor: null },
      { tipo: 'P2', valor: null },
      { tipo: 'Exame de Recurso', valor: recursos[0]?.valor ?? null },
      ...trabalhos.map((t) => ({ ...t, tipo: 'Trabalho' as string })),
      ...recursos.slice(1).map((r) => ({ ...r, tipo: 'Exame de Recurso' as string })),
    ];
    return {
      media_parcial: 0,
      media_final: 0,
      status: 'EM_CURSO',
      detalhes_calculo: {
        notas_utilizadas: notasParaFrontendVazias,
        formula_aplicada: 'Aguardando lançamento de provas',
        observacoes: ['É necessário pelo menos uma prova (P1) para calcular a média no Ensino Superior.'],
      },
    };
  }

  // Calcular média das provas
  let mediaProvas = 0;
  if (provas.length > 0) {
    const somaProvas = provas.reduce((acc, n) => acc + (n.valor ?? 0), 0);
    mediaProvas = somaProvas / provas.length;
  }

  // Calcular Média Parcial (MP)
  let mediaParcial = 0;
  let formulaMP = '';

  if (trabalhos.length > 0) {
    // Com Trabalho: MP = (Média das Provas × 0.8) + (Trabalho × 0.2)
    const trabalho = trabalhos[0]; // Usar o primeiro trabalho
    const vTrabalho = trabalho.valor ?? 0;
    mediaParcial = (mediaProvas * 0.8) + (vTrabalho * 0.2);
    formulaMP = `MP = (Média das Provas × 0.8) + (Trabalho × 0.2) = (${mediaProvas.toFixed(2)} × 0.8) + (${vTrabalho} × 0.2) = ${mediaParcial.toFixed(2)}`;
  } else {
    // Sem Trabalho: MP = Média das Provas
    mediaParcial = mediaProvas;
    formulaMP = `MP = Média das Provas = ${mediaParcial.toFixed(2)}`;
  }

  // Determinar status após Média Parcial (usar percentual mínimo configurado)
  let status: 'APROVADO' | 'REPROVADO' | 'EXAME_RECURSO' | 'EM_CURSO' = 'REPROVADO';
  if (mediaParcial >= percentualMinimoAprovacao) {
    status = 'APROVADO';
  } else if (
    mediaParcial >= notaMinimaZonaExameRecurso &&
    mediaParcial < percentualMinimoAprovacao &&
    permitirExameRecurso
  ) {
    status = 'EXAME_RECURSO';
  }

  // Calcular Média Final (MF)
  let mediaFinal = mediaParcial;
  let formulaMF = '';

  if (recursos.length > 0 && status === 'EXAME_RECURSO' && permitirExameRecurso) {
    // Com Recurso: MF = (MP + Recurso) / 2
    const recurso = recursos[0]; // Usar o primeiro recurso
    const vRecurso = recurso.valor ?? 0;
    mediaFinal = (mediaParcial + vRecurso) / 2;
    formulaMF = `MF = (MP + Recurso) / 2 = (${mediaParcial.toFixed(2)} + ${vRecurso}) / 2 = ${mediaFinal.toFixed(2)}`;
    
    // Status final após recurso (usar percentual mínimo configurado)
    if (mediaFinal >= percentualMinimoAprovacao) {
      status = 'APROVADO';
    } else {
      status = 'REPROVADO';
    }
  } else {
    // Sem Recurso: MF = MP
    formulaMF = `MF = MP = ${mediaFinal.toFixed(2)}`;
    
    // Se já estava aprovado, manter; senão, reprovado
    if (status !== 'APROVADO') {
      status = 'REPROVADO';
    }
  }
  
  // Observação se recurso não permitido mas tentado
  if (recursos.length > 0 && !permitirExameRecurso) {
    observacoes.push('Notas de recurso encontradas, mas recurso/exame está desativado para esta instituição.');
  }

  // Observações
  if (provas.length < 2) {
    observacoes.push('Apenas uma prova foi lançada. Recomenda-se lançar P2 para cálculo completo.');
  }
  if (trabalhos.length > 1) {
    observacoes.push('Múltiplos trabalhos encontrados. Apenas o primeiro foi considerado no cálculo.');
  }
  if (recursos.length > 1) {
    observacoes.push('Múltiplos recursos encontrados. Apenas o primeiro foi considerado no cálculo.');
  }

  if (provas.length < 3) {
    status = 'EM_CURSO';
    observacoes.push(
      'Situação não definitiva: a aprovação/reprovação por média só é declarada com o registo completo das provas do período (três provas).',
    );
  }

  // Montar notas_utilizadas sempre com P1, P2 e Exame para o boletim carregar os três campos (valor null se não houver)
  const valorP1 = provas[0]?.valor ?? null;
  const valorP2 = provas[1]?.valor ?? null;
  const valorExame = provas[2]?.valor ?? recursos[0]?.valor ?? null;
  const notasParaFrontend: NotaIndividual[] = [
    { tipo: 'P1', valor: valorP1, peso: provas[0]?.peso, avaliacaoId: provas[0]?.avaliacaoId },
    { tipo: 'P2', valor: valorP2, peso: provas[1]?.peso, avaliacaoId: provas[1]?.avaliacaoId },
    { tipo: 'Exame de Recurso', valor: valorExame, peso: recursos[0]?.peso ?? provas[2]?.peso, avaliacaoId: recursos[0]?.avaliacaoId ?? provas[2]?.avaliacaoId },
    ...trabalhos.map((t) => ({ ...t, tipo: 'Trabalho' as string })),
    ...recursos.slice(1).map((r) => ({ ...r, tipo: 'Exame de Recurso' as string })),
  ];

  return {
    media_parcial: Number(mediaParcial.toFixed(2)),
    media_final: Number(mediaFinal.toFixed(2)),
    status,
    detalhes_calculo: {
      notas_utilizadas: notasParaFrontend,
      formula_aplicada: `${formulaMP}; ${formulaMF}`,
      observacoes: observacoes.length > 0 ? observacoes : undefined,
    },
  };
}

/**
 * Calcular média para ENSINO SECUNDÁRIO
 * 
 * REGRAS:
 * - Avaliação Contínua, Provas Trimestrais, Trabalhos (opcional)
 * - Média Trimestral (MT):
 *   - MT = (Avaliação Contínua + Prova Trimestral) / 2
 * - Média Anual (MA):
 *   - MA = (MT1 + MT2 + MT3) / 3
 * - Status Final:
 *   - MA ≥ média_minima (padrão: 10) → APROVADO
 *   - MA < média_minima → REPROVADO
 */
export async function calcularSecundario(
  notas: NotaIndividual[],
  instituicaoId: string,
  trimestre?: number,
  percentualMinimoAprovacao: number = 10,
  tipoMedia: string = 'simples',
  permitirExameRecurso: boolean = false,
  notaMinimaZonaExameRecurso: number = DEFAULT_NOTA_MINIMA_ZONA_EXAME_RECURSO,
  pesosMiniPauta?: PesosMiniPautaSecundario | null,
): Promise<ResultadoCalculo> {
  const observacoes: string[] = [];
  
  // Usar percentual mínimo de aprovação configurado (padrão: 10 = 50% de 20)
  const mediaMinima = percentualMinimoAprovacao;

  // Buscar avaliações para obter trimestres
  const avaliacaoIds = notas.map(n => n.avaliacaoId).filter(Boolean) as string[];
  const avaliacoes = await prisma.avaliacao.findMany({
    where: {
      id: { in: avaliacaoIds },
    },
    select: {
      id: true,
      trimestre: true,
      tipo: true,
    },
  });

  // Se trimestre específico foi solicitado, calcular apenas para esse trimestre
  if (trimestre) {
    const notasTrimestre = notas.filter(n => {
      const avaliacao = avaliacoes.find(a => a.id === n.avaliacaoId);
      return avaliacao && avaliacao.trimestre === trimestre;
    });

    if (notasTrimestre.length === 0) {
      throw new AppError(`Nenhuma nota encontrada para o ${trimestre}º trimestre`, 400);
    }

    // Calcular média trimestral
    // Assumir que há avaliação contínua e prova trimestral
    const avaliacaoContinua = notasTrimestre.find(n => n.tipo === 'TESTE' || n.tipo === 'TRABALHO');
    const provaTrimestral = notasTrimestre.find(n => n.tipo === 'PROVA');

    // Se não há avaliações, retornar resultado com status apropriado (não erro)
    if (!avaliacaoContinua && !provaTrimestral) {
      return {
        media_trimestral: { [trimestre]: 0 },
        media_final: 0,
        status: 'EM_CURSO',
        detalhes_calculo: {
          notas_utilizadas: notasTrimestre,
          formula_aplicada: `Aguardando lançamento de avaliações para o ${trimestre}º trimestre`,
          observacoes: [`É necessário pelo menos uma avaliação (Contínua ou Prova) para calcular a média do ${trimestre}º trimestre.`],
        },
      };
    }

    let mediaTrimestral = 0;
    const vCont = avaliacaoContinua?.valor ?? 0;
    const vProva = provaTrimestral?.valor ?? 0;
    if (avaliacaoContinua && provaTrimestral) {
      mediaTrimestral = (vCont + vProva) / 2;
    } else if (avaliacaoContinua) {
      mediaTrimestral = vCont;
      observacoes.push('Apenas avaliação contínua encontrada. Prova trimestral não foi lançada.');
    } else if (provaTrimestral) {
      mediaTrimestral = vProva;
      observacoes.push('Apenas prova trimestral encontrada. Avaliação contínua não foi lançada.');
    }

    const status = mediaTrimestral >= mediaMinima ? 'APROVADO' : 'REPROVADO';

    return {
      media_trimestral: { [trimestre]: Number(mediaTrimestral.toFixed(2)) },
      media_final: Number(mediaTrimestral.toFixed(2)),
      status,
      detalhes_calculo: {
        notas_utilizadas: notasTrimestre,
        formula_aplicada: `MT${trimestre} = (Avaliação Contínua + Prova Trimestral) / 2 = ${mediaTrimestral.toFixed(2)}`,
        observacoes: observacoes.length > 0 ? observacoes : undefined,
      },
    };
  }

  if (notasPautaSecundariaPorExames(notas)) {
    const template = await resolvePautaTemplateForInstituicao(instituicaoId);
    const parametrosMini = await prisma.parametrosSistema.findUnique({
      where: { instituicaoId },
      select: { secundarioPesoNpp: true },
    });
    const usarNpp = secundarioUsaNppNaMediaTrimestralParam(parametrosMini);
    const notasCalc = stripNppNotasMiniPautaSec(notas, usarNpp);
    return calcularSecundarioPautaExamesSync(
      notasCalc,
      mediaMinima,
      permitirExameRecurso,
      notaMinimaZonaExameRecurso,
      pesosMiniPauta,
      template,
    );
  }

  // Calcular média anual (todos os trimestres)
  // Avaliações já foram buscadas acima

  // Extrair trimestre de tipo (ex: "1º Trimestre" -> 1) para notas de exame
  const trimestreFromTipo = (t: string): number | null => {
    const m = (t || '').match(/^([123])[º°o]\s*trimestre/i);
    return m ? parseInt(m[1], 10) : null;
  };

  // Agrupar notas por trimestre (avaliacao.trimestre OU tipo "1º Trimestre" para exames)
  const notasPorTrimestre: { [trimestre: number]: NotaIndividual[] } = {};
  const mediasTrimestrais: { [trimestre: number]: number } = {};

  notas.forEach(nota => {
    const avaliacao = avaliacoes.find(a => a.id === nota.avaliacaoId);
    let trim: number | null = avaliacao?.trimestre ?? null;
    if (trim == null) {
      trim = trimestreFromTipo(nota.tipo);
    }
    if (trim != null) {
      if (!notasPorTrimestre[trim]) {
        notasPorTrimestre[trim] = [];
      }
      notasPorTrimestre[trim].push(nota);
    }
  });

  // Calcular média por trimestre (ordem garantida: 1, 2, 3)
  const trimestresOrdenados = Object.keys(notasPorTrimestre).map(Number).sort((a, b) => a - b);
  trimestresOrdenados.forEach(trimestre => {
    const notasTrim = notasPorTrimestre[trimestre];
    
    // Separar avaliação contínua e prova trimestral
    const avaliacaoContinua = notasTrim.find(n => {
      const av = avaliacoes.find(a => a.id === n.avaliacaoId);
      return av && (av.tipo === 'TESTE' || av.tipo === 'TRABALHO');
    });
    const provaTrimestral = notasTrim.find(n => {
      const av = avaliacoes.find(a => a.id === n.avaliacaoId);
      return av && av.tipo === 'PROVA';
    });

    let mediaTrimestral = 0;
    const vCont = avaliacaoContinua?.valor ?? 0;
    const vProva = provaTrimestral?.valor ?? 0;
    if (avaliacaoContinua && provaTrimestral) {
      mediaTrimestral = (vCont + vProva) / 2;
    } else if (avaliacaoContinua) {
      mediaTrimestral = vCont;
      observacoes.push(`Trimestre ${trimestre}: Apenas avaliação contínua encontrada. Prova trimestral não foi lançada.`);
    } else if (provaTrimestral) {
      mediaTrimestral = vProva;
      observacoes.push(`Trimestre ${trimestre}: Apenas prova trimestral encontrada. Avaliação contínua não foi lançada.`);
    } else {
      // Se não há avaliação contínua nem prova, calcular média simples
      const soma = notasTrim.reduce((acc, n) => acc + (n.valor ?? 0), 0);
      mediaTrimestral = soma / notasTrim.length;
      observacoes.push(`Trimestre ${trimestre}: Média calculada a partir de todas as avaliações disponíveis.`);
    }

    mediasTrimestrais[trimestre] = Number(mediaTrimestral.toFixed(2));
  });

  const hasMt = (k: number) =>
    Object.prototype.hasOwnProperty.call(mediasTrimestrais, k) && mediasTrimestrais[k] != null;
  const provasCompletasMt = hasMt(1) && hasMt(2) && hasMt(3);

  const trimestres = Object.keys(mediasTrimestrais).map(Number);
  let mediaAnual = 0;

  if (provasCompletasMt) {
    mediaAnual = (mediasTrimestrais[1] + mediasTrimestrais[2] + mediasTrimestrais[3]) / 3;
  } else if (trimestres.length > 0) {
    const somaMedias = trimestres.reduce((acc, trim) => acc + mediasTrimestrais[trim], 0);
    mediaAnual = somaMedias / trimestres.length;
    observacoes.push(
      'Média anual parcial: quando existirem MT1, MT2 e MT3, a média anual será (MT1+MT2+MT3)/3.',
    );
  } else {
    const somaNotas = notas.reduce((acc, n) => acc + (n.valor ?? 0), 0);
    mediaAnual = notas.length > 0 ? somaNotas / notas.length : 0;
    observacoes.push('Nenhum trimestre identificado. Média calculada a partir de todas as notas disponíveis.');
  }

  const recVal = extrairRecuperacaoSecundario(notas);
  const ma = mediaAnual;
  let mf = ma;
  if (
    permitirExameRecurso &&
    recVal != null &&
    ma >= notaMinimaZonaExameRecurso &&
    ma < mediaMinima
  ) {
    mf = (ma + recVal) / 2;
  }

  let status: ResultadoCalculo['status'] = 'EM_CURSO';
  if (provasCompletasMt) {
    if (mf >= mediaMinima) {
      status = 'APROVADO';
    } else if (
      permitirExameRecurso &&
      ma >= notaMinimaZonaExameRecurso &&
      ma < mediaMinima &&
      recVal == null
    ) {
      status = 'EXAME_RECURSO';
    } else {
      status = 'REPROVADO';
    }
  }

  const notasParaFrontend: NotaIndividual[] = [1, 2, 3].map((trim) => ({
    tipo: `${trim}º Trimestre`,
    valor: mediasTrimestrais[trim] ?? null,
    peso: 1,
  }));
  if (recVal != null) {
    notasParaFrontend.push({ tipo: 'Recuperação', valor: recVal, peso: 1 });
  }

  return {
    media_parcial: Number(ma.toFixed(2)),
    media_trimestral: Object.keys(mediasTrimestrais).length > 0 ? mediasTrimestrais : undefined,
    media_anual: Number(ma.toFixed(2)),
    media_final: Number(mf.toFixed(2)),
    status,
    detalhes_calculo: {
      notas_utilizadas: notasParaFrontend,
      formula_aplicada: provasCompletasMt
        ? `MA = (MT1+MT2+MT3)/3 = ${ma.toFixed(2)}; MF = ${mf.toFixed(2)}`
        : `MA = ${ma.toFixed(2)}; MF = ${mf.toFixed(2)}`,
      observacoes: observacoes.length > 0 ? observacoes : undefined,
    },
  };
}

/**
 * Função principal: Calcular média baseado no tipo de instituição
 * 
 * @param dados - Dados para o cálculo
 * @returns Resultado do cálculo com média e status
 */
export async function calcularMedia(dados: DadosCalculoNota): Promise<ResultadoCalculo> {
  // Validar dados obrigatórios
  if (!dados.alunoId || !dados.instituicaoId) {
    throw new AppError('alunoId e instituicaoId são obrigatórios', 400);
  }

  // CRÍTICO: tipoAcademico deve vir do parâmetro (req.user.tipoAcademico do JWT)
  // Fallback para buscar no banco apenas se não fornecido (compatibilidade com código legado)
  let tipoAcademico: TipoAcademico | null = null;
  if (dados.tipoAcademico) {
    tipoAcademico = dados.tipoAcademico as TipoAcademico;
  } else {
    // Fallback: buscar no banco (apenas para compatibilidade com código legado)
    // TODO: Remover este fallback após atualizar todos os chamadores
    tipoAcademico = await obterTipoAcademico(dados.instituicaoId);
  }

  if (!tipoAcademico) {
    throw new AppError('Tipo acadêmico da instituição não identificado. Configure o tipo da instituição primeiro.', 400);
  }

  // Buscar notas do aluno
  const notas = await buscarNotasAluno(dados);

  // Se não há notas, retornar resultado vazio (não erro)
  // Frontend pode exibir "Aguardando lançamento de notas"
  if (notas.length === 0) {
    return {
      media_final: 0,
      status: 'EM_CURSO',
      detalhes_calculo: {
        notas_utilizadas: [],
        formula_aplicada: 'Nenhuma nota lançada',
        observacoes: ['Nenhuma nota encontrada para o aluno. Aguardando lançamento de notas.'],
      },
    };
  }

  // Validar notas (valores entre 0 e 20 ou padrão institucional)
  // Buscar configuração da instituição para intervalo de notas (se houver)
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: dados.instituicaoId },
    select: { id: true },
  });

  // Buscar parâmetros do sistema para usar configurações institucionais
  const parametrosSistema = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId: dados.instituicaoId },
  });

  const notaMaxima = 20; // Padrão: 0-20, pode ser configurável no futuro
  const notaMinima = 0;
  
  // Percentual mínimo de aprovação configurado (padrão: 10 = 50% de 20)
  const percentualMinimoAprovacao = parametrosSistema?.percentualMinimoAprovacao 
    ? Number(parametrosSistema.percentualMinimoAprovacao) 
    : 10;
  
  // Tipo de média configurado (simples ou ponderada)
  const tipoMedia = parametrosSistema?.tipoMedia || 'simples';
  
  // Permitir exame/recurso configurado
  const permitirExameRecurso = parametrosSistema?.permitirExameRecurso ?? false;

  const notaMinimaZonaExameRecurso =
    parametrosSistema?.notaMinimaZonaExameRecurso != null
      ? Number(parametrosSistema.notaMinimaZonaExameRecurso)
      : DEFAULT_NOTA_MINIMA_ZONA_EXAME_RECURSO;

  for (const nota of notas) {
    const v = nota.valor;
    if (v != null && (v < notaMinima || v > notaMaxima)) {
      throw new AppError(`Nota inválida: ${v}. Valores devem estar entre ${notaMinima} e ${notaMaxima}.`, 400);
    }
  }

  // Calcular baseado no tipo, passando configurações
  if (tipoAcademico === TipoAcademico.SUPERIOR) {
    const modeloRaw = parametrosSistema?.superiorModeloCalculo;
    const modeloPauta: ModeloCalculoSuperiorPauta =
      modeloRaw === 'AC_EXAME_PONDERADO' ? 'AC_EXAME_PONDERADO' : 'PAUTA_3_PROVAS';
    let pesoAc =
      parametrosSistema?.superiorPesoAc != null ? Number(parametrosSistema.superiorPesoAc) : 0.4;
    let pesoExame =
      parametrosSistema?.superiorPesoExame != null ? Number(parametrosSistema.superiorPesoExame) : 0.6;
    const sumW = pesoAc + pesoExame;
    if (sumW > 0) {
      pesoAc = pesoAc / sumW;
      pesoExame = pesoExame / sumW;
    }
    const notaMinimaAcParaContarExame =
      parametrosSistema?.superiorNotaMinimaAcContaExame != null
        ? Number(parametrosSistema.superiorNotaMinimaAcContaExame)
        : 10;

    const acTipoRaw = parametrosSistema?.superiorAcTipoCalculo;
    const acTipoCalculo: SuperiorAcTipoCalculoPauta =
      acTipoRaw === 'PONDERADA_P1_P2_TRAB' ? 'PONDERADA_P1_P2_TRAB' : 'MEDIA_ARITMETICA';
    const pesoAv1 =
      parametrosSistema?.superiorPesoAv1 != null ? Number(parametrosSistema.superiorPesoAv1) : 0.3;
    const pesoAv2 =
      parametrosSistema?.superiorPesoAv2 != null ? Number(parametrosSistema.superiorPesoAv2) : 0.3;
    const pesoTrab =
      parametrosSistema?.superiorPesoTrab != null ? Number(parametrosSistema.superiorPesoTrab) : 0.1;
    const recursoModoRaw = parametrosSistema?.superiorRecursoModo;
    const recursoModo: SuperiorRecursoModoPauta =
      recursoModoRaw === 'APROVACAO_DIRETA' ? 'APROVACAO_DIRETA' : 'MEDIA_COM_MF';

    const opcoesSuperior: OpcoesCalculoSuperiorPauta = {
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

    return await calcularSuperior(
      notas,
      percentualMinimoAprovacao,
      tipoMedia,
      permitirExameRecurso,
      notaMinimaZonaExameRecurso,
      opcoesSuperior,
    );
  } else if (tipoAcademico === TipoAcademico.SECUNDARIO) {
    return await calcularSecundario(
      notas,
      dados.instituicaoId,
      dados.trimestre,
      percentualMinimoAprovacao,
      tipoMedia,
      permitirExameRecurso,
      notaMinimaZonaExameRecurso,
      null,
    );
  } else {
    throw new AppError('Tipo acadêmico não suportado para cálculo de notas', 400);
  }
}

/**
 * Calcular média para múltiplos alunos (lote)
 */
export async function calcularMediaLote(
  dados: Array<DadosCalculoNota>
): Promise<Array<{ alunoId: string; resultado: ResultadoCalculo }>> {
  const resultados = await Promise.all(
    dados.map(async (dado) => {
      try {
        const resultado = await calcularMedia(dado);
        return { alunoId: dado.alunoId, resultado };
      } catch (error: any) {
        // Em caso de erro, retornar erro específico para esse aluno
        return {
          alunoId: dado.alunoId,
          resultado: {
            media_final: 0,
            status: 'REPROVADO' as const,
            detalhes_calculo: {
              notas_utilizadas: [],
              formula_aplicada: 'Erro no cálculo',
              observacoes: [error.message || 'Erro desconhecido'],
            },
          },
        };
      }
    })
  );

  return resultados;
}

/** Resposta do motor para o frontend (preview) — secundário, pauta por exames. */
export type PreviewSecundarioPautaExamesAluno = {
  matriculaId: string;
  mt1: number | null;
  mt2: number | null;
  mt3: number | null;
  media: number | null;
  mediaFinal: number | null;
  status: ResultadoCalculo['status'];
};

/**
 * Pré-visualização em lote: mesma regra que `calcularSecundario` (pauta exames), com template da instituição.
 */
export async function previewSecundarioPautaExamesBatch(
  instituicaoId: string,
  alunos: Array<{ matriculaId: string; notas: NotaIndividual[] }>,
  opts: {
    percentualMinimoAprovacao: number;
    permitirExameRecurso: boolean;
    notaMinimaZonaExameRecurso: number;
    usarNppNaMediaTrimestral?: boolean;
  },
): Promise<{
  templateId: string;
  templateVersion: number;
  alunos: PreviewSecundarioPautaExamesAluno[];
}> {
  const template = await resolvePautaTemplateForInstituicao(instituicaoId);
  const mediaMinima = opts.percentualMinimoAprovacao;
  const usarNpp = opts.usarNppNaMediaTrimestral ?? false;
  const alunosOut: PreviewSecundarioPautaExamesAluno[] = alunos.map(({ matriculaId, notas }) => {
    const notasCalc = stripNppNotasMiniPautaSec(notas, usarNpp);
    const t1 = mtTrimestrePauta(notasCalc, 1, template);
    const t2 = mtTrimestrePauta(notasCalc, 2, template);
    const t3 = mtTrimestrePauta(notasCalc, 3, template);
    const r = calcularSecundarioPautaExamesSync(
      notasCalc,
      mediaMinima,
      opts.permitirExameRecurso,
      opts.notaMinimaZonaExameRecurso,
      null,
      template,
    );
    return {
      matriculaId,
      mt1: t1,
      mt2: t2,
      mt3: t3,
      media: r.media_anual ?? r.media_parcial ?? null,
      mediaFinal: r.media_final,
      status: r.status,
    };
  });
  return {
    templateId: template.id,
    templateVersion: template.version,
    alunos: alunosOut,
  };
}

