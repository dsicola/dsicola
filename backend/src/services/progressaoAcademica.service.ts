/**
 * ========================================
 * SERVIÇO: PROGRESSÃO ACADÊMICA
 * ========================================
 *
 * Regras de progressão automática (SIGA/SIGAE):
 * - status_final = APROVADO → classe_proxima = classe_atual + 1
 * - status_final = REPROVADO → manter na mesma classe
 * - Bloqueio: reprovado não pode matricular na classe seguinte (exceto ADMIN com override)
 * - Compatível Secundário (10ª, 11ª, 12ª) e Superior (1º, 2º, 3º Ano)
 */

import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

export type StatusFinalAno = 'APROVADO' | 'REPROVADO';

export interface ResultadoStatusFinal {
  statusFinal: StatusFinalAno;
  disciplinasReprovadas: number;
  disciplinasTotal: number;
  disciplinasNegativasPermitidas: number;
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
async function getParametrosProgressao(instituicaoId: string) {
  const params = await prisma.parametrosSistema.findFirst({
    where: { instituicaoId },
  });
  return {
    disciplinasNegativasPermitidas: params?.disciplinasNegativasPermitidas ?? 0,
    permitirOverrideMatriculaReprovado: params?.permitirOverrideMatriculaReprovado ?? false,
  };
}

/**
 * Calcular status final do ano para um aluno, agregando histórico por disciplina
 */
export async function calcularStatusFinalAno(
  alunoId: string,
  anoLetivoId: string,
  instituicaoId: string
): Promise<ResultadoStatusFinal> {
  const params = await getParametrosProgressao(instituicaoId);

  const historicos = await prisma.historicoAcademico.findMany({
    where: {
      alunoId,
      anoLetivoId,
      instituicaoId,
    },
    select: { situacaoAcademica: true },
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

  return {
    statusFinal,
    disciplinasReprovadas: reprovadas,
    disciplinasTotal: total,
    disciplinasNegativasPermitidas: params.disciplinasNegativasPermitidas,
  };
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

  if (tipoAcademico === 'SUPERIOR') {
    const anoAtual = extrairAnoSuperior(matriculaReferencia.classeOuAnoCurso);
    const anoPretendido = extrairAnoSuperior(classeIdOuNomeOuAno);
    if (anoAtual === null || anoPretendido === null) return { permitido: true };
    const tentandoClasseSeguinte = anoPretendido > anoAtual;
    if (!tentandoClasseSeguinte) return { permitido: true };
    if (podeOverride) return { permitido: true };
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

  if (podeOverride) {
    return { permitido: true };
  }

  return {
    permitido: false,
    motivoBloqueio:
      'Aluno reprovado no ano anterior. Não é permitido matricular na classe seguinte. Mantenha na mesma classe ou contacte o ADMIN para override (se configurado).',
  };
}
