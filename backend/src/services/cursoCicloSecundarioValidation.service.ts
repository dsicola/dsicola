import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/** Inteiro 1–20 ou null (apagar); `undefined` = não alterar no PATCH. */
export function parseDuracaoCicloAnosBody(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 20) {
    throw new AppError('Duração do ciclo (anos/classes no percurso) deve ser um inteiro entre 1 e 20, ou vazio.', 400);
  }
  return n;
}

export async function contarClassesActivasPorCurso(instituicaoId: string, cursoId: string): Promise<number> {
  return prisma.classe.count({
    where: { instituicaoId, cursoId, ativo: true },
  });
}

/**
 * Impede mais classes activas do que `duracaoCicloAnos` no curso (secundário).
 */
export async function validarNaoExcedeDuracaoCicloCurso(
  instituicaoId: string,
  cursoId: string | null | undefined,
  contagemPrevista: number
): Promise<void> {
  if (!cursoId || contagemPrevista <= 0) return;
  const curso = await prisma.curso.findFirst({
    where: { id: cursoId, instituicaoId },
    select: { duracaoCicloAnos: true, nome: true },
  });
  if (!curso?.duracaoCicloAnos || curso.duracaoCicloAnos < 1) return;
  if (contagemPrevista > curso.duracaoCicloAnos) {
    throw new AppError(
      `O curso «${curso.nome}» tem duração de ciclo de ${curso.duracaoCicloAnos} ano(s)/classe(s). ` +
        `Deve ter no máximo ${curso.duracaoCicloAnos} classe(s) activa(s) vinculadas (tentativa: ${contagemPrevista}). ` +
        `Ajuste a duração na área/opção ou desactive classes em excesso.`,
      400
    );
  }
}

/**
 * Ao reduzir `duracaoCicloAnos`, o número de classes activas ligadas não pode ser maior que o novo valor.
 */
export async function validarDuracaoCicloCompativelComClassesExistentes(
  instituicaoId: string,
  cursoId: string,
  novaDuracao: number | null
): Promise<void> {
  if (novaDuracao == null || novaDuracao < 1) return;
  const n = await contarClassesActivasPorCurso(instituicaoId, cursoId);
  if (n > novaDuracao) {
    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, instituicaoId },
      select: { nome: true },
    });
    throw new AppError(
      `Existem ${n} classe(s) activa(s) vinculada(s) ao curso «${curso?.nome ?? ''}». ` +
        `Não pode definir duração de ciclo inferior a ${n}. Remova vínculos ou desactive classes primeiro.`,
      400
    );
  }
}
