/**
 * Após criar User (ALUNO), cria Matrícula anual + Matrícula em turma na importação Excel.
 * Respeita regras SUPERIOR vs SECUNDÁRIO e multi-tenant.
 */

import type { Prisma } from '@prisma/client';
import { StatusMatricula, TipoAcademico } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler.js';
import { validarMatriculaClasse, validarProgressaoSequencialSemSaltos } from './progressaoAcademica.service.js';
import { verificarAlunoConcluido } from './conclusaoCurso.service.js';

const ANOS_SUPERIOR_VALIDOS = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano'] as const;

/** Só usado em importação Excel — nunca altera regras globais da instituição. */
export type RelaxarRegrasImportacao = {
  ignorarPeriodoLetivo?: boolean;
  ignorarBloqueioDivida?: boolean;
  ignorarCapacidadeTurma?: boolean;
  ignorarValidacaoProgressao?: boolean;
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Se a célula "classe" do Excel já for um ano válido (ex: "1º Ano"), usa-o. */
export function resolveClasseOuAnoCursoSuperior(classeExcelRaw: string, turmaNome: string): string | null {
  const t = stripAccents((classeExcelRaw || '').trim());
  for (const a of ANOS_SUPERIOR_VALIDOS) {
    if (stripAccents(a).toLowerCase() === t.toLowerCase()) return a;
  }
  const n = stripAccents(turmaNome || '');
  for (let i = 1; i <= 6; i++) {
    if (new RegExp(`\\b${i}\\s*º?\\s*Ano\\b`, 'i').test(n)) return `${i}º Ano`;
    if (new RegExp(`\\b${i}\\s*o\\s*Ano\\b`, 'i').test(n)) return `${i}º Ano`;
  }
  return null;
}

export function effectiveTipoFromTurma(
  tipoInst: TipoAcademico | null,
  turma: { cursoId: string | null; classeId: string | null }
): TipoAcademico {
  if (tipoInst === 'SUPERIOR' || tipoInst === 'SECUNDARIO') return tipoInst;
  if (turma.classeId && !turma.cursoId) return TipoAcademico.SECUNDARIO;
  if (turma.cursoId && !turma.classeId) return TipoAcademico.SUPERIOR;
  if (turma.classeId) return TipoAcademico.SECUNDARIO;
  if (turma.cursoId) return TipoAcademico.SUPERIOR;
  return TipoAcademico.SECUNDARIO;
}

/** Reutilizado no preview (modo seguro) e na matrícula real. */
export async function verificarPeriodoMatriculaLetivo(
  tx: Prisma.TransactionClient,
  instituicaoId: string,
  anoLetivoId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parametros = await tx.parametrosSistema.findFirst({
    where: { instituicaoId },
    select: { permitirMatriculaForaPeriodo: true },
  });
  if (parametros?.permitirMatriculaForaPeriodo === true) return { ok: true };

  const anoLetivoRef = await tx.anoLetivo.findFirst({
    where: { id: anoLetivoId, instituicaoId },
    select: { ano: true, dataInicio: true, dataFim: true },
  });
  if (!anoLetivoRef?.dataInicio || !anoLetivoRef.dataFim) return { ok: true };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataInicio = new Date(anoLetivoRef.dataInicio);
  dataInicio.setHours(0, 0, 0, 0);
  const dataFim = new Date(anoLetivoRef.dataFim);
  dataFim.setHours(23, 59, 59, 999);
  if (hoje < dataInicio || hoje > dataFim) {
    return {
      ok: false,
      message: `Matrícula fora do período letivo (${anoLetivoRef.ano}). Ative "permitir matrícula fora do período" nas configurações ou importe dentro das datas.`,
    };
  }
  return { ok: true };
}

async function assertPeriodoMatriculaPermitido(
  tx: Prisma.TransactionClient,
  instituicaoId: string,
  anoLetivoId: string
): Promise<void> {
  const v = await verificarPeriodoMatriculaLetivo(tx, instituicaoId, anoLetivoId);
  if (!v.ok) throw new AppError(v.message, 400);
}

export async function criarMatriculaAnualEMatriculaNaImportacao(
  tx: Prisma.TransactionClient,
  opts: {
    alunoId: string;
    instituicaoId: string;
    turmaId: string;
    tipoAcademicoInstituicao: TipoAcademico | null;
    classeRawExcel: string;
    userRoles: string[];
    relaxarRegrasImportacao?: RelaxarRegrasImportacao;
  }
): Promise<{ matriculaId: string }> {
  const {
    alunoId,
    instituicaoId,
    turmaId,
    tipoAcademicoInstituicao,
    classeRawExcel,
    userRoles,
    relaxarRegrasImportacao: relax,
  } = opts;

  const turma = await tx.turma.findFirst({
    where: { id: turmaId, instituicaoId },
    include: {
      curso: { select: { id: true, nome: true, instituicaoId: true } },
      classe: { select: { id: true, nome: true, instituicaoId: true } },
      anoLetivoRef: { select: { id: true, ano: true, status: true } },
      _count: { select: { matriculas: true } },
    },
  });

  if (!turma) {
    throw new AppError('Turma não encontrada ou não pertence à instituição.', 404);
  }

  if (!turma.anoLetivoId) {
    throw new AppError('Turma sem ano letivo vinculado.', 400);
  }

  const tipo = effectiveTipoFromTurma(tipoAcademicoInstituicao, turma);

  let nivelEnsino: TipoAcademico;
  let classeOuAnoCurso: string;
  let cursoId: string | null;
  let classeId: string | null;

  if (tipo === TipoAcademico.SECUNDARIO) {
    if (!turma.classeId || !turma.classe) {
      throw new AppError('Turma sem classe (Ensino Secundário).', 400);
    }
    nivelEnsino = TipoAcademico.SECUNDARIO;
    classeOuAnoCurso = turma.classe.nome;
    classeId = turma.classeId;
    cursoId = turma.cursoId ?? null;
  } else {
    if (!turma.cursoId) {
      throw new AppError('Turma sem curso (Ensino Superior).', 400);
    }
    nivelEnsino = TipoAcademico.SUPERIOR;
    const anoCurso = resolveClasseOuAnoCursoSuperior(classeRawExcel, turma.nome);
    if (!anoCurso) {
      throw new AppError(
        'Não foi possível determinar o ano do curso (ex.: 1º Ano). Indique no Excel uma coluna "classe/ano" com valores como "1º Ano" ou use um nome de turma que inclua o ano.',
        400
      );
    }
    classeOuAnoCurso = anoCurso;
    cursoId = turma.cursoId;
    classeId = null;
  }

  if (tipoAcademicoInstituicao === TipoAcademico.SUPERIOR && tipo !== TipoAcademico.SUPERIOR) {
    throw new AppError(
      'Instituição de Ensino Superior: a turma detetada não está vinculada a um curso (sem matrícula em turma).',
      400
    );
  }
  if (tipoAcademicoInstituicao === TipoAcademico.SECUNDARIO && tipo !== TipoAcademico.SECUNDARIO) {
    throw new AppError(
      'Instituição de Ensino Secundário: a turma detetada não está vinculada a uma classe.',
      400
    );
  }

  const concl = await verificarAlunoConcluido(alunoId, cursoId, classeId, instituicaoId);
  if (concl.concluido) {
    throw new AppError('Aluno já consta como tendo concluído este percurso — matrícula bloqueada.', 403);
  }

  if (!relax?.ignorarValidacaoProgressao) {
    const classeParaProgressao =
      tipo === TipoAcademico.SECUNDARIO ? (classeId || classeOuAnoCurso) : classeOuAnoCurso;
    const progressao = await validarMatriculaClasse(
      alunoId,
      classeParaProgressao,
      cursoId,
      instituicaoId,
      userRoles,
      false
    );
    if (!progressao.permitido) {
      throw new AppError(progressao.motivoBloqueio || 'Matrícula bloqueada por regra de progressão.', 403);
    }

    const tipoSeq: 'SUPERIOR' | 'SECUNDARIO' =
      tipo === TipoAcademico.SUPERIOR ? 'SUPERIOR' : 'SECUNDARIO';
    const sequencial = await validarProgressaoSequencialSemSaltos(
      alunoId,
      instituicaoId,
      tipoSeq,
      classeOuAnoCurso,
      tipo === TipoAcademico.SECUNDARIO ? classeId : null,
      cursoId,
      userRoles,
      false
    );
    if (!sequencial.permitido) {
      throw new AppError(sequencial.motivoBloqueio || 'Matrícula bloqueada: progressão sequencial.', 403);
    }
  }

  const anoLetivoNum = turma.anoLetivoRef?.ano ?? null;
  if (anoLetivoNum == null) {
    throw new AppError('Ano letivo da turma inválido.', 400);
  }

  const existenteAno = await tx.matriculaAnual.findFirst({
    where: {
      alunoId,
      instituicaoId,
      status: 'ATIVA',
      anoLetivo: anoLetivoNum,
    },
  });
  if (existenteAno) {
    throw new AppError('Já existe matrícula anual ativa para este aluno neste ano letivo.', 409);
  }

  if (!relax?.ignorarPeriodoLetivo) {
    await assertPeriodoMatriculaPermitido(tx, instituicaoId, turma.anoLetivoId);
  }

  if (!relax?.ignorarBloqueioDivida) {
    const bloquearDivida =
      (await tx.parametrosSistema.findFirst({
        where: { instituicaoId },
        select: { bloquearMatriculaDivida: true },
      }))?.bloquearMatriculaDivida ?? true;

    if (bloquearDivida) {
      const dividas = await tx.mensalidade.findMany({
        where: {
          alunoId,
          status: { in: ['Atrasado', 'Pendente'] },
          OR: [
            { status: 'Atrasado' },
            { status: 'Pendente', dataVencimento: { lt: new Date() } },
          ],
        },
        take: 1,
      });
      if (dividas.length > 0) {
        throw new AppError(
          'Aluno com mensalidade em atraso/pendente — matrícula bloqueada pelas regras da instituição.',
          400
        );
      }
    }
  }

  await tx.matriculaAnual.create({
    data: {
      alunoId,
      instituicaoId,
      anoLetivo: anoLetivoNum,
      anoLetivoId: turma.anoLetivoId,
      nivelEnsino,
      classeOuAnoCurso,
      cursoId,
      classeId,
      status: 'ATIVA',
    },
  });

  if (!relax?.ignorarCapacidadeTurma && turma._count.matriculas >= turma.capacidade) {
    throw new AppError('Turma sem vagas.', 400);
  }

  const jaMatriculado = await tx.matricula.findFirst({
    where: { alunoId, turmaId },
  });
  if (jaMatriculado) {
    throw new AppError('Aluno já matriculado nesta turma.', 409);
  }

  const matricula = await tx.matricula.create({
    data: {
      alunoId,
      turmaId,
      status: StatusMatricula.Ativa,
      anoLetivo: anoLetivoNum,
      anoLetivoId: turma.anoLetivoId,
    },
  });

  return { matriculaId: matricula.id };
}

export type TurmaSnapshotImportacaoPreview = {
  id: string;
  nome: string;
  cursoId: string | null;
  classeId: string | null;
  capacidade: number;
  matriculasCount: number;
  classe: { nome: string } | null;
  curso: { nome: string } | null;
};

/**
 * Regras de matrícula na importação que não dependem do aluno (preview modo seguro).
 * Não cobre dívida nem progressão — para utilizador novo costumam não aplicar.
 */
export function avaliarRegrasMatriculaImportacaoSemAluno(p: {
  tipoAcademicoInstituicao: TipoAcademico | null;
  classeRawExcel: string;
  turma: TurmaSnapshotImportacaoPreview;
  periodoLetivoOk: boolean;
  mensagemPeriodoLetivo?: string;
}): string[] {
  const reasons: string[] = [];
  const tipo = effectiveTipoFromTurma(p.tipoAcademicoInstituicao, p.turma);

  if (tipo === TipoAcademico.SECUNDARIO) {
    if (!p.turma.classeId || !p.turma.classe) {
      reasons.push('Turma sem classe (Ensino Secundário).');
    }
  } else {
    if (!p.turma.cursoId) {
      reasons.push('Turma sem curso (Ensino Superior).');
    }
    const anoCurso = resolveClasseOuAnoCursoSuperior(p.classeRawExcel, p.turma.nome);
    if (!anoCurso) {
      reasons.push(
        'Não foi possível determinar o ano do curso (ex.: 1º Ano). Indique no Excel uma coluna "classe/ano" com valores como "1º Ano" ou use um nome de turma que inclua o ano.'
      );
    }
  }

  if (p.tipoAcademicoInstituicao === TipoAcademico.SUPERIOR && tipo !== TipoAcademico.SUPERIOR) {
    reasons.push(
      'Instituição de Ensino Superior: a turma detetada não está vinculada a um curso (sem matrícula em turma).'
    );
  }
  if (p.tipoAcademicoInstituicao === TipoAcademico.SECUNDARIO && tipo !== TipoAcademico.SECUNDARIO) {
    reasons.push('Instituição de Ensino Secundário: a turma detetada não está vinculada a uma classe.');
  }

  if (!p.periodoLetivoOk && p.mensagemPeriodoLetivo) {
    reasons.push(p.mensagemPeriodoLetivo);
  }

  if (p.turma.matriculasCount >= p.turma.capacidade) {
    reasons.push('Turma sem vagas.');
  }

  return reasons;
}
