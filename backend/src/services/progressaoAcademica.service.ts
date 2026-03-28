/**
 * ========================================
 * SERVIÇO: PROGRESSÃO ACADÊMICA
 * ========================================
 *
 * Regras de progressão automática (padrão institucional):
 * - status_final = APROVADO → classe_proxima = classe_atual + 1
 * - status_final = REPROVADO → manter na mesma classe
 * - Bloqueio: reprovado não pode matricular na classe seguinte (exceto ADMIN com override)
 * - Compatível Secundário (10ª, 11ª, 12ª) e Superior (1º, 2º, 3º Ano)
 */

import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  listarDisciplinasChaveScope,
  listarRegrasInstituicao,
  selecionarRegraMaisEspecifica,
} from '../repositories/academicProgression.repository.js';

export type StatusFinalAno = 'APROVADO' | 'REPROVADO';

export interface ResultadoStatusFinal {
  statusFinal: StatusFinalAno;
  disciplinasReprovadas: number;
  disciplinasTotal: number;
  disciplinasNegativasPermitidas: number;
  /** Motor `regras_aprovacao` / disciplinas chave (quando aplicável) */
  mediaGeral?: number | null;
  motivosExtras?: string[];
  regraAplicadaId?: string | null;
}

export interface SugestaoClasseProxima {
  classeProximaSugerida: string;
  classeProximaSugeridaId: string | null;
  classeAtual: string;
  classeAtualId: string | null;
  statusFinalAnoAnterior: StatusFinalAno | null;
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO';
  podeMatricular: boolean;
  motivoBloqueio?: string;
}

/**
 * Buscar parâmetros da instituição (disciplinas negativas, override)
 */
/**
 * Refina resultado da política de “disciplinas negativas permitidas” com `regras_aprovacao` / disciplinas chave.
 */
export async function refinamentoRegrasInstitucionais(
  instituicaoId: string,
  cursoId: string | null | undefined,
  classeId: string | null | undefined,
  baseline: ResultadoStatusFinal,
  historicos: { situacaoAcademica: string; mediaFinal: unknown; disciplinaId: string }[]
): Promise<ResultadoStatusFinal> {
  const linhas = await listarRegrasInstituicao(instituicaoId);
  const regra = selecionarRegraMaisEspecifica(linhas, cursoId ?? null, classeId ?? null);

  const medias: number[] = [];
  for (const h of historicos) {
    const m = h.mediaFinal != null ? Number(h.mediaFinal) : NaN;
    if (!Number.isNaN(m)) medias.push(m);
  }
  const mediaGeral =
    medias.length > 0 ? Math.round((medias.reduce((a, b) => a + b, 0) / medias.length) * 100) / 100 : null;

  let statusFinal: StatusFinalAno = baseline.statusFinal;
  const motivosExtras: string[] = [];

  if (regra?.mediaMinima != null && mediaGeral != null) {
    const min = Number(regra.mediaMinima);
    if (mediaGeral < min) {
      statusFinal = 'REPROVADO';
      motivosExtras.push(`Média geral ${mediaGeral} inferior ao mínimo ${min} (regra institucional).`);
    }
  }

  if (regra?.maxReprovacoes != null) {
    const max = regra.maxReprovacoes;
    if (baseline.disciplinasReprovadas > max) {
      statusFinal = 'REPROVADO';
      motivosExtras.push(
        `Número de reprovações (${baseline.disciplinasReprovadas}) superior ao máximo permitido (${max}).`
      );
    }
  }

  if (regra?.exigeDisciplinasChave && cursoId) {
    const chaves = await listarDisciplinasChaveScope(instituicaoId, cursoId, classeId);
    const idsChave = [...new Set(chaves.map((c) => c.disciplinaId))];
    for (const did of idsChave) {
      const linha = historicos.find((h) => h.disciplinaId === did);
      const ok = linha && linha.situacaoAcademica === 'APROVADO';
      if (!ok) {
        statusFinal = 'REPROVADO';
        motivosExtras.push(`Disciplina chave não aprovada ou sem histórico (disciplina ${did}).`);
      }
    }
  }

  if (baseline.statusFinal === 'REPROVADO' && statusFinal === 'APROVADO') {
    statusFinal = 'REPROVADO';
  }

  return {
    ...baseline,
    statusFinal,
    mediaGeral,
    motivosExtras: motivosExtras.length ? motivosExtras : undefined,
    regraAplicadaId: regra?.id ?? null,
  };
}

async function getParametrosProgressao(instituicaoId: string) {
  const params = await prisma.parametrosSistema.findFirst({
    where: { instituicaoId },
  });
  return {
    disciplinasNegativasPermitidas: params?.disciplinasNegativasPermitidas ?? 0,
    permitirOverrideMatriculaReprovado: params?.permitirOverrideMatriculaReprovado ?? false,
    progressaoReprovacaoBloqueiaSubirAnoClasse: params?.progressaoReprovacaoBloqueiaSubirAnoClasse ?? true,
    progressaoMaxDisciplinasAtrasoSubirAno: params?.progressaoMaxDisciplinasAtrasoSubirAno ?? 2,
  };
}

/**
 * Calcular status final do ano para um aluno, agregando histórico por disciplina
 * @param contextoOpcional cursoId/classeId da matrícula anual — refinam com `regras_aprovacao` quando existir
 */
export async function calcularStatusFinalAno(
  alunoId: string,
  anoLetivoId: string,
  instituicaoId: string,
  contextoOpcional?: { cursoId?: string | null; classeId?: string | null }
): Promise<ResultadoStatusFinal> {
  const params = await getParametrosProgressao(instituicaoId);

  const historicos = await prisma.historicoAcademico.findMany({
    where: {
      alunoId,
      anoLetivoId,
      instituicaoId,
    },
    select: { situacaoAcademica: true, mediaFinal: true, disciplinaId: true },
  });

  if (historicos.length === 0) {
    return {
      statusFinal: 'REPROVADO',
      disciplinasReprovadas: 0,
      disciplinasTotal: 0,
      disciplinasNegativasPermitidas: params.disciplinasNegativasPermitidas,
    };
  }

  const reprovadas = historicos.filter(
    (h) => h.situacaoAcademica === 'REPROVADO' || h.situacaoAcademica === 'REPROVADO_FALTA'
  ).length;
  const total = historicos.length;

  const statusFinal: StatusFinalAno =
    reprovadas <= params.disciplinasNegativasPermitidas ? 'APROVADO' : 'REPROVADO';

  const base: ResultadoStatusFinal = {
    statusFinal,
    disciplinasReprovadas: reprovadas,
    disciplinasTotal: total,
    disciplinasNegativasPermitidas: params.disciplinasNegativasPermitidas,
  };

  return refinamentoRegrasInstitucionais(
    instituicaoId,
    contextoOpcional?.cursoId,
    contextoOpcional?.classeId,
    base,
    historicos
  );
}

/**
 * Obter classe próxima sugerida com base no status e classe atual
 * Secundário: usa Classe.ordem (10→11→12)
 * Superior: usa parsing de "1º Ano" → "2º Ano"
 */
export async function obterClasseProximaSugerida(
  matriculaAnualAnterior: {
    classeOuAnoCurso: string;
    classeId: string | null;
    cursoId: string | null;
  },
  statusFinal: StatusFinalAno,
  instituicaoId: string,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null
): Promise<{ classeProximaSugerida: string; classeProximaSugeridaId: string | null }> {
  if (statusFinal === 'REPROVADO') {
    return {
      classeProximaSugerida: matriculaAnualAnterior.classeOuAnoCurso,
      classeProximaSugeridaId: matriculaAnualAnterior.classeId,
    };
  }

  if (tipoAcademico === 'SECUNDARIO') {
    const classeAtual = matriculaAnualAnterior.classeId
      ? await prisma.classe.findUnique({
          where: { id: matriculaAnualAnterior.classeId },
        })
      : null;

    const ordemAtual = classeAtual?.ordem ?? extrairOrdemSecundario(matriculaAnualAnterior.classeOuAnoCurso);
    const ordemProxima = ordemAtual !== null ? ordemAtual + 1 : null;

    const classeProxima = ordemProxima !== null
      ? await prisma.classe.findFirst({
          where: { instituicaoId, ordem: ordemProxima },
          orderBy: { nome: 'asc' },
        })
      : null;

    if (classeProxima) {
      return {
        classeProximaSugerida: classeProxima.nome,
        classeProximaSugeridaId: classeProxima.id,
      };
    }
    return {
      classeProximaSugerida: matriculaAnualAnterior.classeOuAnoCurso,
      classeProximaSugeridaId: matriculaAnualAnterior.classeId,
    };
  }

  if (tipoAcademico === 'SUPERIOR') {
    const anoAtual = extrairAnoSuperior(matriculaAnualAnterior.classeOuAnoCurso);
    const anoProximo = anoAtual !== null ? anoAtual + 1 : null;
    const anosValidos = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano'];
    const classeProximaSugerida =
      anoProximo !== null && anoProximo >= 1 && anoProximo <= 6
        ? anosValidos[anoProximo - 1]
        : matriculaAnualAnterior.classeOuAnoCurso;

    return {
      classeProximaSugerida,
      classeProximaSugeridaId: null,
    };
  }

  return {
    classeProximaSugerida: matriculaAnualAnterior.classeOuAnoCurso,
    classeProximaSugeridaId: matriculaAnualAnterior.classeId,
  };
}

function extrairOrdemSecundario(classeOuAnoCurso: string): number | null {
  const m = classeOuAnoCurso.match(/(\d{1,2})ª?\s*Classe/i) || classeOuAnoCurso.match(/^(\d{1,2})$/);
  return m ? parseInt(m[1], 10) : null;
}

function extrairAnoSuperior(classeOuAnoCurso: string): number | null {
  const m = classeOuAnoCurso.match(/(\d)º\s*Ano/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Sugestão de classe para nova matrícula anual (baseado no último ano)
 */
export async function obterSugestaoClasse(
  alunoId: string,
  instituicaoId: string,
  anoLetivoNovo: number
): Promise<SugestaoClasseProxima | null> {
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { tipoAcademico: true },
  });
  const tipoAcademico = instituicao?.tipoAcademico || null;

  const ultimaMatricula = await prisma.matriculaAnual.findFirst({
    where: { alunoId, instituicaoId },
    orderBy: { anoLetivo: 'desc' },
    include: {
      classe: { select: { id: true, nome: true, ordem: true } },
      anoLetivoRef: { select: { id: true } },
    },
  });

  if (!ultimaMatricula) {
    return null;
  }

  const statusFinalAnoAnterior = ultimaMatricula.statusFinal as StatusFinalAno | null;
  const classeAtual = ultimaMatricula.classeOuAnoCurso;
  const classeAtualId = ultimaMatricula.classeId;

  let classeProximaSugerida = classeAtual;
  let classeProximaSugeridaId: string | null = classeAtualId;

  if (statusFinalAnoAnterior === 'APROVADO' && ultimaMatricula.anoLetivoRef?.id) {
    const sugestao = await obterClasseProximaSugerida(
      {
        classeOuAnoCurso: ultimaMatricula.classeOuAnoCurso,
        classeId: ultimaMatricula.classeId,
        cursoId: ultimaMatricula.cursoId,
      },
      'APROVADO',
      instituicaoId,
      tipoAcademico
    );
    classeProximaSugerida = sugestao.classeProximaSugerida;
    classeProximaSugeridaId = sugestao.classeProximaSugeridaId;
  }

  return {
    classeProximaSugerida,
    classeProximaSugeridaId,
    classeAtual,
    classeAtualId,
    statusFinalAnoAnterior,
    tipoAcademico: tipoAcademico || 'SECUNDARIO',
    podeMatricular: true,
  };
}

/**
 * Validar se o aluno pode matricular na classe pretendida
 * Bloqueia se reprovado e tenta matricular na classe seguinte (exceto ADMIN com override)
 * Compatível Secundário (classe) e Superior (ano)
 * @param anoLetivoContexto - Quando fornecido (ex: no UPDATE), usa matrícula do ano anterior para statusFinal
 */
export async function validarMatriculaClasse(
  alunoId: string,
  classeIdOuNomeOuAno: string,
  cursoId: string | null,
  instituicaoId: string,
  userRoles: string[],
  overrideReprovado?: boolean,
  anoLetivoContexto?: number | null
): Promise<{ permitido: boolean; motivoBloqueio?: string }> {
  const params = await getParametrosProgressao(instituicaoId);
  const isAdmin = userRoles.some((r) => ['ADMIN', 'SUPER_ADMIN', 'DIRECAO'].includes(r));

  let matriculaReferencia;
  if (anoLetivoContexto != null && anoLetivoContexto > 0) {
    matriculaReferencia = await prisma.matriculaAnual.findFirst({
      where: { alunoId, instituicaoId, anoLetivo: anoLetivoContexto - 1 },
      include: { classe: true },
    });
  }
  if (!matriculaReferencia) {
    matriculaReferencia = await prisma.matriculaAnual.findFirst({
      where: { alunoId, instituicaoId },
      orderBy: { anoLetivo: 'desc' },
      include: { classe: true },
    });
  }

  if (!matriculaReferencia || matriculaReferencia.statusFinal !== 'REPROVADO') {
    return { permitido: true };
  }

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { tipoAcademico: true },
  });
  const tipoAcademico = instituicao?.tipoAcademico || null;

  const podeOverride =
    isAdmin && params.permitirOverrideMatriculaReprovado && overrideReprovado === true;

  if (podeOverride) {
    return { permitido: true };
  }

  if (!params.progressaoReprovacaoBloqueiaSubirAnoClasse) {
    const { contarReprovacoesObrigatoriasNoAnoLetivo } = await import(
      './matriculaInteligente.service.js'
    );
    const nRepro = await contarReprovacoesObrigatoriasNoAnoLetivo(alunoId, instituicaoId, {
      anoLetivoId: matriculaReferencia.anoLetivoId,
      anoLetivo: matriculaReferencia.anoLetivo ?? null,
    });
    if (nRepro <= params.progressaoMaxDisciplinasAtrasoSubirAno) {
      return { permitido: true };
    }
    return {
      permitido: false,
      motivoBloqueio:
        `Política institucional: com “reprovação não bloqueia subida”, o limite é ${params.progressaoMaxDisciplinasAtrasoSubirAno} disciplina(s) obrigatória(s) em atraso no ano de referência. ` +
        `Foram registadas ${nRepro}. O estudante deve reduzir pendências ou solicitar decisão da direcção (override), se permitido.`,
    };
  }

  if (tipoAcademico === 'SUPERIOR') {
    const anoAtual = extrairAnoSuperior(matriculaReferencia.classeOuAnoCurso);
    const anoPretendido = extrairAnoSuperior(classeIdOuNomeOuAno);
    if (anoAtual === null || anoPretendido === null) return { permitido: true };
    const tentandoClasseSeguinte = anoPretendido > anoAtual;
    if (!tentandoClasseSeguinte) return { permitido: true };
    return {
      permitido: false,
      motivoBloqueio:
        'Aluno reprovado no ano anterior. Não é permitido matricular no ano seguinte. Mantenha no mesmo ano ou contacte o ADMIN para override (se configurado).',
    };
  }

  const classeAtualId = matriculaReferencia.classeId;
  let classePretendidaId: string | null = null;
  if (classeIdOuNomeOuAno.length === 36 && classeIdOuNomeOuAno.includes('-')) {
    classePretendidaId = classeIdOuNomeOuAno;
  } else {
    const c = await prisma.classe.findFirst({
      where: { instituicaoId, OR: [{ nome: classeIdOuNomeOuAno }, { id: classeIdOuNomeOuAno }] },
    });
    classePretendidaId = c?.id || null;
  }

  if (!classePretendidaId || !classeAtualId) {
    return { permitido: true };
  }

  const classeAtual = await prisma.classe.findUnique({ where: { id: classeAtualId } });
  const classePretendida = await prisma.classe.findUnique({ where: { id: classePretendidaId } });

  if (!classeAtual || !classePretendida) {
    return { permitido: true };
  }

  const ordemAtual = classeAtual.ordem ?? extrairOrdemSecundario(classeAtual.nome) ?? 0;
  const ordemPretendida = classePretendida.ordem ?? extrairOrdemSecundario(classePretendida.nome) ?? 0;
  const tentandoClasseSeguinte = ordemPretendida > ordemAtual;

  if (!tentandoClasseSeguinte) {
    return { permitido: true };
  }

  return {
    permitido: false,
    motivoBloqueio:
      'Aluno reprovado no ano anterior. Não é permitido matricular na classe seguinte. Mantenha na mesma classe ou contacte o ADMIN para override (se configurado).',
  };
}

/**
 * REGRA INSTITUCIONAL: proibir saltos de mais de um nível (classe ou ano do curso).
 * - Secundário: compara `Classe.ordem` (ex.: 10→12 sem ter concluído 11 não permitido).
 * - Superior: compara ano parseado de `classeOuAnoCurso` (1º–6º Ano), no mesmo `cursoId`.
 * - Primeira matrícula no percurso (sem histórico relevante): permite.
 * - Descer de nível (correcção administrativa): permite (só bloqueia dest > base + 1).
 * Override: ADMIN | SUPER_ADMIN | DIRECAO com `overrideProgressaoSequencial === true` (equivalência, transferência).
 */
export async function validarProgressaoSequencialSemSaltos(
  alunoId: string,
  instituicaoId: string,
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null,
  classeOuAnoDestino: string,
  classeDestinoId: string | null,
  cursoIdDestino: string | null,
  userRoles: string[],
  overrideSequencial?: boolean
): Promise<{ permitido: boolean; motivoBloqueio?: string }> {
  const isAdmin = userRoles.some((r) => ['ADMIN', 'SUPER_ADMIN', 'DIRECAO'].includes(r));
  if (overrideSequencial === true && isAdmin) {
    return { permitido: true };
  }

  if (!tipoAcademico || (tipoAcademico !== 'SUPERIOR' && tipoAcademico !== 'SECUNDARIO')) {
    return { permitido: true };
  }

  const todas = await prisma.matriculaAnual.findMany({
    where: { alunoId, instituicaoId },
    orderBy: [{ anoLetivo: 'desc' }, { createdAt: 'desc' }],
    include: { classe: { select: { id: true, nome: true, ordem: true } } },
  });

  if (todas.length === 0) {
    return { permitido: true };
  }

  const relevantes =
    tipoAcademico === 'SUPERIOR' && cursoIdDestino
      ? todas.filter((m) => m.cursoId === cursoIdDestino)
      : todas;

  if (relevantes.length === 0) {
    return { permitido: true };
  }

  if (tipoAcademico === 'SECUNDARIO') {
    let destOrdem: number | null = null;
    let classeDestNome = classeOuAnoDestino;
    if (classeDestinoId) {
      const cd = await prisma.classe.findFirst({
        where: { id: classeDestinoId, instituicaoId },
      });
      destOrdem = cd?.ordem ?? extrairOrdemSecundario(cd?.nome || '') ?? null;
      if (cd?.nome) classeDestNome = cd.nome;
    } else {
      const cd = await prisma.classe.findFirst({
        where: {
          instituicaoId,
          OR: [{ nome: classeOuAnoDestino }, { id: classeOuAnoDestino }],
        },
      });
      destOrdem = cd?.ordem ?? extrairOrdemSecundario(classeOuAnoDestino) ?? null;
      if (cd?.nome) classeDestNome = cd.nome;
    }
    if (destOrdem === null || destOrdem <= 0) {
      return { permitido: true };
    }

    const comAprovado = relevantes.filter((m) => m.statusFinal === 'APROVADO');
    let baseOrdem: number | null = null;
    if (comAprovado.length > 0) {
      for (const m of comAprovado) {
        const o =
          m.classe?.ordem ??
          extrairOrdemSecundario(m.classe?.nome || m.classeOuAnoCurso) ??
          null;
        if (o != null && o > 0) {
          baseOrdem = baseOrdem === null ? o : Math.max(baseOrdem, o);
        }
      }
    }
    if (baseOrdem === null) {
      const ultima = relevantes[0];
      baseOrdem =
        ultima.classe?.ordem ??
        extrairOrdemSecundario(ultima.classe?.nome || ultima.classeOuAnoCurso) ??
        null;
    }
    if (baseOrdem === null || baseOrdem <= 0) {
      return { permitido: true };
    }

    if (destOrdem > baseOrdem + 1) {
      return {
        permitido: false,
        motivoBloqueio:
          `Progressão institucional (Ensino Secundário): não é permitido saltos de classe. ` +
          `O último nível atingido no percurso corresponde à ordem ${baseOrdem}; a classe pretendida (“${classeDestNome}”, ordem ${destOrdem}) excede o próximo nível permitido (${baseOrdem + 1}). ` +
          `Matricule o aluno sequencialmente ou utilize override por ADMIN/DIRECAO em caso de equivalência ou transferência externa devidamente documentada.`,
      };
    }
    return { permitido: true };
  }

  const destAno = extrairAnoSuperior(classeOuAnoDestino);
  if (destAno === null || destAno < 1) {
    return { permitido: true };
  }

  const comAprovado = relevantes.filter((m) => m.statusFinal === 'APROVADO');
  let baseAno: number | null = null;
  if (comAprovado.length > 0) {
    for (const m of comAprovado) {
      const a = extrairAnoSuperior(m.classeOuAnoCurso);
      if (a !== null) {
        baseAno = baseAno === null ? a : Math.max(baseAno, a);
      }
    }
  }
  if (baseAno === null) {
    baseAno = extrairAnoSuperior(relevantes[0].classeOuAnoCurso);
  }
  if (baseAno === null || baseAno < 1) {
    return { permitido: true };
  }

  if (destAno > baseAno + 1) {
    return {
      permitido: false,
      motivoBloqueio:
        `Progressão institucional (Ensino Superior): não é permitido saltos de ano curricular. ` +
        `Último ano concluído com aproveitamento no curso: ${baseAno}º ano; pretende-se o ${destAno}º ano. ` +
        `Avance de um ano de cada vez (máximo permitido agora: ${baseAno + 1}º ano) ou utilize override por ADMIN/DIRECAO para equivalências/regimes excepcionais.`,
    };
  }
  return { permitido: true };
}
