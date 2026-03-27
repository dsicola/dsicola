import type { Request } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Garante vínculo ResponsavelAluno + educando na instituição (multi-tenant).
 */
export async function assertResponsavelPodeVerAluno(opts: {
  responsavelUserId: string;
  alunoId: string;
  instituicaoId: string;
}): Promise<void> {
  const { responsavelUserId, alunoId, instituicaoId } = opts;

  const vinculo = await prisma.responsavelAluno.findUnique({
    where: {
      responsavelId_alunoId: {
        responsavelId: responsavelUserId,
        alunoId,
      },
    },
  });

  if (!vinculo) {
    throw new AppError('Sem permissão para aceder a dados deste educando.', 403);
  }

  const alunoInst = await prisma.user.findFirst({
    where: { id: alunoId, instituicaoId },
    select: { id: true },
  });

  if (!alunoInst) {
    throw new AppError('Educando não encontrado nesta instituição.', 403);
  }
}

/** Responsável “portal” (sem papéis de staff que já vê dados de alunos). */
export function isResponsavelPortalOnly(roles: string[] | undefined): boolean {
  if (!roles?.includes('RESPONSAVEL')) return false;
  const staffish = ['ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN', 'DIRECAO', 'COORDENADOR'];
  return !roles.some((r) => staffish.includes(r));
}

const STAFF_MATRICULA_ANUAL = new Set(['ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'DIRECAO', 'COORDENADOR']);

/**
 * Quem não é staff só lê matrícula anual do próprio aluno ou de educando vinculado.
 */
export async function ensureLeituraMatriculaAnualPorAluno(
  req: Request,
  alunoId: string,
  instituicaoId: string | null | undefined
): Promise<void> {
  const roles = req.user?.roles ?? [];
  const uid = req.user?.userId;
  const inst = instituicaoId ?? req.user?.instituicaoId ?? null;
  if (!uid) {
    throw new AppError('Não autenticado', 401);
  }
  if (!inst) {
    throw new AppError('Instituição não identificada', 400);
  }
  if (roles.some((r) => STAFF_MATRICULA_ANUAL.has(r))) {
    return;
  }

  const hasAluno = roles.includes('ALUNO');
  const hasResp = roles.includes('RESPONSAVEL');

  if (hasAluno && !hasResp) {
    if (alunoId !== uid) {
      throw new AppError('Acesso negado.', 403);
    }
    return;
  }

  if (hasResp && !hasAluno) {
    await assertResponsavelPodeVerAluno({
      responsavelUserId: uid,
      alunoId,
      instituicaoId: inst,
    });
    return;
  }

  if (hasAluno && hasResp) {
    if (alunoId === uid) return;
    await assertResponsavelPodeVerAluno({
      responsavelUserId: uid,
      alunoId,
      instituicaoId: inst,
    });
    return;
  }

  throw new AppError('Acesso negado.', 403);
}
