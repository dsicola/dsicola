import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';

export type RegraAprovacaoRow = Prisma.RegraAprovacaoGetPayload<object>;

/**
 * Resolve a regra mais específica que coincide com o contexto (curso/classe).
 * Prioridade: curso+classe > só curso > só instituição (ambos nulos em curso/classe na linha).
 */
export function selecionarRegraMaisEspecifica(
  linhas: RegraAprovacaoRow[],
  cursoId: string | null | undefined,
  classeId: string | null | undefined
): RegraAprovacaoRow | null {
  const candidatas = linhas.filter((r) => {
    if (r.cursoId && r.cursoId !== cursoId) return false;
    if (r.classeId && r.classeId !== classeId) return false;
    return true;
  });
  if (candidatas.length === 0) return null;
  const pontuacao = (r: RegraAprovacaoRow) => (r.classeId ? 3 : 0) + (r.cursoId ? 1 : 0);
  return [...candidatas].sort((a, b) => pontuacao(b) - pontuacao(a))[0] ?? null;
}

export async function listarRegrasInstituicao(instituicaoId: string): Promise<RegraAprovacaoRow[]> {
  return prisma.regraAprovacao.findMany({ where: { instituicaoId } });
}

export async function listarDisciplinasChaveScope(
  instituicaoId: string,
  cursoId: string,
  classeId: string | null | undefined
): Promise<{ disciplinaId: string }[]> {
  return prisma.disciplinaChave.findMany({
    where: {
      instituicaoId,
      cursoId,
      OR: [{ classeId: null }, ...(classeId ? [{ classeId }] : [])],
    },
    select: { disciplinaId: true },
    distinct: ['disciplinaId'],
  });
}

/**
 * Disciplinas obrigatórias na matriz (curso_disciplina) para efeitos de progressão.
 * Com classeId: vínculos com essa classe ou vínculo geral ao curso (classeId null).
 * Sem classeId: apenas vínculos gerais (classeId null).
 */
export async function listDisciplinaIdsObrigatoriasMatrizCurricular(
  instituicaoId: string,
  cursoId: string,
  classeId: string | null | undefined
): Promise<string[]> {
  const cursoOk = await prisma.curso.findFirst({
    where: { id: cursoId, instituicaoId },
    select: { id: true },
  });
  if (!cursoOk) return [];

  const where: Prisma.CursoDisciplinaWhereInput = {
    cursoId,
    obrigatoria: true,
  };
  if (classeId) {
    where.OR = [{ classeId: null }, { classeId }];
  } else {
    where.classeId = null;
  }

  const rows = await prisma.cursoDisciplina.findMany({
    where,
    select: { disciplinaId: true },
    distinct: ['disciplinaId'],
  });
  return rows.map((r) => r.disciplinaId);
}
