import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

const DEFAULT_ORDENS = [10, 11, 12];

function normalizarOrdens(raw: unknown): number[] {
  if (raw == null || !Array.isArray(raw)) return [...DEFAULT_ORDENS];
  const nums = raw
    .map((x) => (typeof x === 'number' ? x : parseInt(String(x), 10)))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 20);
  return nums.length > 0 ? [...new Set(nums)].sort((a, b) => a - b) : [...DEFAULT_ORDENS];
}

export type PautaDisciplinaCiclo = {
  disciplinaId: string;
  disciplinaNome: string;
  cargaHoraria: number;
  notasPorClasse: Array<{
    classeOrdem: number;
    classeNome: string;
    mediaFinal: number | null;
    situacao: string;
  }>;
  mediaDisciplinaCiclo: number | null;
  aprovadoDisciplina: boolean;
};

export type PautaConclusaoCicloSecundarioResultado = {
  ordensCiclo: number[];
  tipoMediaFinalCurso: 'SIMPLES' | 'PONDERADA_CARGA';
  disciplinas: PautaDisciplinaCiclo[];
  mediaFinalCurso: number | null;
  aprovadoCurso: boolean;
  percentualMinimo: number;
  incompleto: boolean;
  avisos: string[];
  classeIdsCiclo: string[];
};

/**
 * Ordens do ciclo e mapa ordem → classe (uma classe por ordem, primeiro código na instituição).
 */
export async function obterOrdensEClassesCicloSecundario(instituicaoId: string): Promise<{
  ordens: number[];
  classeIdPorOrdem: Map<number, { id: string; nome: string }>;
  avisos: string[];
}> {
  const params = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId },
    select: { secundarioCicloOrdensConclusao: true },
  });
  const ordens = normalizarOrdens(params?.secundarioCicloOrdensConclusao);
  const classes = await prisma.classe.findMany({
    where: { instituicaoId, ativo: true, ordem: { in: ordens } },
    select: { id: true, ordem: true, nome: true, codigo: true },
    orderBy: { codigo: 'asc' },
  });
  const classeIdPorOrdem = new Map<number, { id: string; nome: string }>();
  const avisos: string[] = [];
  for (const c of classes) {
    const o = c.ordem ?? 0;
    if (!ordens.includes(o)) continue;
    if (!classeIdPorOrdem.has(o)) {
      classeIdPorOrdem.set(o, { id: c.id, nome: c.nome });
    }
  }
  for (const o of ordens) {
    if (!classeIdPorOrdem.has(o)) {
      avisos.push(
        `Não existe classe ativa com ordem ${o}ª na instituição; notas dessa classe não entram na pauta até existir cadastro.`,
      );
    }
  }
  return { ordens, classeIdPorOrdem, avisos };
}

/** IDs de todas as classes do ciclo (secundário) — para filtrar histórico / validações. */
export async function obterClasseIdsCicloSecundario(instituicaoId: string): Promise<string[]> {
  const { classeIdPorOrdem } = await obterOrdensEClassesCicloSecundario(instituicaoId);
  return [...new Set([...classeIdPorOrdem.values()].map((c) => c.id))];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Média final do curso a partir de linhas de histórico (uma por ano/classe por disciplina).
 * Agrupa por nome da disciplina, calcula média por disciplina no tempo, depois média do curso.
 */
export function calcularMediaFinalCursoSecundarioPorHistoricoDisciplinas(
  itens: Array<{
    disciplinaNome: string;
    mediaFinal: number | null;
    cargaHoraria?: number | null;
  }>,
  tipo: 'SIMPLES' | 'PONDERADA_CARGA',
): number | null {
  const byName = new Map<string, { notas: number[]; ch: number }>();
  for (const it of itens) {
    const nome = (it.disciplinaNome || '').trim();
    if (!nome || it.mediaFinal == null || isNaN(Number(it.mediaFinal))) continue;
    if (!byName.has(nome)) {
      byName.set(nome, { notas: [], ch: Math.max(0, Number(it.cargaHoraria) || 0) });
    }
    byName.get(nome)!.notas.push(Number(it.mediaFinal));
    if (it.cargaHoraria != null && Number(it.cargaHoraria) > 0) {
      byName.get(nome)!.ch = Math.max(byName.get(nome)!.ch, Number(it.cargaHoraria));
    }
  }
  if (byName.size === 0) return null;
  const mediasDisc: Array<{ m: number; ch: number }> = [];
  for (const [, { notas, ch }] of byName) {
    if (notas.length === 0) continue;
    mediasDisc.push({
      m: round1(notas.reduce((a, b) => a + b, 0) / notas.length),
      ch,
    });
  }
  if (mediasDisc.length === 0) return null;
  if (tipo === 'PONDERADA_CARGA') {
    let num = 0;
    let den = 0;
    for (const { m, ch } of mediasDisc) {
      if (ch <= 0) {
        num += m;
        den += 1;
      } else {
        num += m * ch;
        den += ch;
      }
    }
    return den > 0 ? round1(num / den) : null;
  }
  return round1(mediasDisc.reduce((s, x) => s + x.m, 0) / mediasDisc.length);
}

/**
 * Pauta de conclusão do ciclo (secundário): média por disciplina = média das notas finais nas classes do ciclo;
 * média final do curso = média simples das médias por disciplina ou ponderada pela carga horária.
 */
export async function calcularPautaConclusaoCicloSecundario(opts: {
  alunoId: string;
  instituicaoId: string;
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null;
}): Promise<PautaConclusaoCicloSecundarioResultado> {
  if (opts.tipoAcademico !== 'SECUNDARIO') {
    throw new AppError('Pauta de conclusão do ciclo é apenas para Ensino Secundário.', 400);
  }

  const [params, ciclo] = await Promise.all([
    prisma.parametrosSistema.findUnique({
      where: { instituicaoId: opts.instituicaoId },
      select: {
        percentualMinimoAprovacao: true,
        secundarioMediaFinalCursoTipo: true,
      },
    }),
    obterOrdensEClassesCicloSecundario(opts.instituicaoId),
  ]);

  const percentualMinimo =
    params?.percentualMinimoAprovacao != null ? Number(params.percentualMinimoAprovacao) : 10;
  const tipoMediaFinal: 'SIMPLES' | 'PONDERADA_CARGA' =
    params?.secundarioMediaFinalCursoTipo === 'PONDERADA_CARGA' ? 'PONDERADA_CARGA' : 'SIMPLES';

  const classeIdsCiclo = [...new Set([...ciclo.classeIdPorOrdem.values()].map((c) => c.id))];

  if (classeIdsCiclo.length === 0) {
    return {
      ordensCiclo: ciclo.ordens,
      tipoMediaFinalCurso: tipoMediaFinal,
      disciplinas: [],
      mediaFinalCurso: null,
      aprovadoCurso: false,
      percentualMinimo,
      incompleto: true,
      avisos: [
        ...ciclo.avisos,
        'Configure classes com ordem 10, 11, 12 (ou o ciclo definido nos parâmetros) para calcular a pauta.',
      ],
      classeIdsCiclo: [],
    };
  }

  const historicos = await prisma.historicoAcademico.findMany({
    where: {
      alunoId: opts.alunoId,
      instituicaoId: opts.instituicaoId,
      classeId: { in: classeIdsCiclo },
    },
    include: {
      disciplina: { select: { id: true, nome: true, cargaHoraria: true } },
      classe: { select: { id: true, nome: true, ordem: true } },
    },
    orderBy: [{ disciplina: { nome: 'asc' } }, { classe: { ordem: 'asc' } }],
  });

  const porDisciplina = new Map<
    string,
    {
      nome: string;
      cargaHoraria: number;
      porOrdem: Map<number, { media: number; situacao: string; classeNome: string }>;
    }
  >();

  for (const h of historicos) {
    const did = h.disciplinaId;
    const ordem = h.classe?.ordem ?? null;
    if (ordem == null || !ciclo.ordens.includes(ordem)) continue;

    if (!porDisciplina.has(did)) {
      porDisciplina.set(did, {
        nome: h.disciplina.nome,
        cargaHoraria: h.disciplina.cargaHoraria ?? h.cargaHoraria ?? 0,
        porOrdem: new Map(),
      });
    }
    const bucket = porDisciplina.get(did)!;
    const mf = Number(h.mediaFinal);
    bucket.porOrdem.set(ordem, {
      media: mf,
      situacao: h.situacaoAcademica,
      classeNome: h.classe?.nome ?? `${ordem}ª`,
    });
  }

  const avisos = [...ciclo.avisos];
  let incompleto = false;

  const disciplinasCorrigidas: PautaDisciplinaCiclo[] = [];
  for (const [disciplinaId, data] of porDisciplina) {
    const notasPorClasse: PautaDisciplinaCiclo['notasPorClasse'] = [];
    const valores: number[] = [];
    for (const o of ciclo.ordens) {
      const cid = ciclo.classeIdPorOrdem.get(o);
      const slot = data.porOrdem.get(o);
      if (!cid) {
        notasPorClasse.push({
          classeOrdem: o,
          classeNome: `${o}ª (sem classe cadastrada)`,
          mediaFinal: null,
          situacao: '—',
        });
        incompleto = true;
        continue;
      }
      if (!slot) {
        notasPorClasse.push({
          classeOrdem: o,
          classeNome: cid.nome,
          mediaFinal: null,
          situacao: 'Sem histórico',
        });
        incompleto = true;
        continue;
      }
      notasPorClasse.push({
        classeOrdem: o,
        classeNome: cid.nome,
        mediaFinal: round1(slot.media),
        situacao: slot.situacao,
      });
      valores.push(slot.media);
    }
    const mediaDisciplinaCiclo =
      valores.length > 0 ? round1(valores.reduce((a, b) => a + b, 0) / valores.length) : null;
    const aprovadoDisciplina =
      mediaDisciplinaCiclo != null && mediaDisciplinaCiclo >= percentualMinimo;

    disciplinasCorrigidas.push({
      disciplinaId,
      disciplinaNome: data.nome,
      cargaHoraria: data.cargaHoraria,
      notasPorClasse,
      mediaDisciplinaCiclo,
      aprovadoDisciplina,
    });
  }

  disciplinasCorrigidas.sort((a, b) => a.disciplinaNome.localeCompare(b.disciplinaNome, 'pt'));

  let mediaFinalCurso: number | null = null;
  const comMedia = disciplinasCorrigidas.filter(
    (d) => d.mediaDisciplinaCiclo != null,
  ) as Array<PautaDisciplinaCiclo & { mediaDisciplinaCiclo: number }>;

  if (comMedia.length > 0) {
    if (tipoMediaFinal === 'PONDERADA_CARGA') {
      let num = 0;
      let den = 0;
      for (const d of comMedia) {
        const ch = Math.max(0, d.cargaHoraria || 0);
        if (ch <= 0) {
          num += d.mediaDisciplinaCiclo;
          den += 1;
        } else {
          num += d.mediaDisciplinaCiclo * ch;
          den += ch;
        }
      }
      mediaFinalCurso = den > 0 ? round1(num / den) : null;
    } else {
      mediaFinalCurso = round1(
        comMedia.reduce((s, d) => s + d.mediaDisciplinaCiclo, 0) / comMedia.length,
      );
    }
  }

  const aprovadoCurso =
    comMedia.length > 0 &&
    disciplinasCorrigidas.length > 0 &&
    disciplinasCorrigidas.every((d) => d.aprovadoDisciplina) &&
    mediaFinalCurso != null &&
    mediaFinalCurso >= percentualMinimo &&
    !incompleto;

  if (historicos.length === 0) {
    avisos.push(
      'Sem histórico académico nas classes do ciclo. A pauta preenche-se após encerramento do(s) ano(s) letivo(s) com snapshot gerado.',
    );
    incompleto = true;
  }

  return {
    ordensCiclo: ciclo.ordens,
    tipoMediaFinalCurso: tipoMediaFinal,
    disciplinas: disciplinasCorrigidas,
    mediaFinalCurso,
    aprovadoCurso,
    percentualMinimo,
    incompleto,
    avisos,
    classeIdsCiclo,
  };
}
