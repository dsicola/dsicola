import type { Prisma } from '@prisma/client';
import type { CursoDisciplina } from '@prisma/client';

type PrismaLike = {
  cursoDisciplina: {
    findMany: (args: Prisma.CursoDisciplinaFindManyArgs) => Promise<CursoDisciplina[]>;
  };
};

/** Vínculos aplicáveis à classe: globais (classeId null) ou específicos dessa classe. */
export function whereCursoDisciplinaAplicavelClasse(
  cursoId: string,
  disciplinaId: string,
  classeId: string
): Prisma.CursoDisciplinaWhereInput {
  return {
    cursoId,
    disciplinaId,
    OR: [{ classeId: null }, { classeId }],
  };
}

/**
 * Entre vínculos do mesmo curso+disciplina, prefere o específico da classe; senão o global.
 */
export function escolherVinculoCursoDisciplina(
  rows: CursoDisciplina[],
  classeId?: string | null
): CursoDisciplina | null {
  if (rows.length === 0) return null;
  if (!classeId) {
    const globalRow = rows.find((r) => r.classeId == null);
    return globalRow ?? rows[0] ?? null;
  }
  const especifico = rows.find((r) => r.classeId === classeId);
  if (especifico) return especifico;
  return rows.find((r) => r.classeId == null) ?? null;
}

export async function findVinculoCursoDisciplinaResolvido(
  prisma: PrismaLike,
  cursoId: string,
  disciplinaId: string,
  classeId?: string | null
): Promise<CursoDisciplina | null> {
  if (!classeId) {
    const rows = await prisma.cursoDisciplina.findMany({
      where: { cursoId, disciplinaId },
    });
    return escolherVinculoCursoDisciplina(rows, null);
  }
  const rows = await prisma.cursoDisciplina.findMany({
    where: whereCursoDisciplinaAplicavelClasse(cursoId, disciplinaId, classeId),
  });
  return escolherVinculoCursoDisciplina(rows, classeId);
}

/** Mescla lista (uma linha por disciplina) para matrículas/planos no secundário. */
export function mergeCursoDisciplinasPorDisciplinaPreferindoClasse<T extends { disciplinaId: string; classeId: string | null }>(
  rows: T[],
  classeId: string
): T[] {
  const score = (r: T) => (r.classeId === classeId ? 2 : r.classeId == null ? 1 : 0);
  const map = new Map<string, T>();
  for (const row of rows) {
    const prev = map.get(row.disciplinaId);
    if (!prev || score(row) > score(prev)) {
      map.set(row.disciplinaId, row);
    }
  }
  return Array.from(map.values());
}
