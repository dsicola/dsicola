/**
 * Identificação consistente da entidade Turma em listas (GET /turmas, /turmas/professor, etc.)
 * e nos params das APIs (matrículas, notas, planos). Suporta camelCase e snake_case.
 */
export function getTurmaRowId(
  t: { id?: string; turma_id?: string; turmaId?: string } | null | undefined,
): string {
  const raw = t?.id ?? t?.turma_id ?? t?.turmaId ?? '';
  return String(raw).trim();
}

/** Valor seguro para usar em Select / query: não vazio nem strings de erro comuns. */
export function isValidTurmaSelection(selected: string | undefined | null): boolean {
  const s = String(selected ?? '').trim();
  if (!s) return false;
  if (s === 'undefined' || s === 'null') return false;
  return true;
}

/**
 * GET /turmas pode devolver array direto ou envelope ({ data } / { turmas }).
 * Sem normalizar, o cliente trata objeto como truthy e .filter quebra — lista de turmas “não carrega”.
 */
export function turmasListFromApiResponse(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;
  if (res != null && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data;
    if (Array.isArray(r.turmas)) return r.turmas;
  }
  return [];
}

/** Ano civil para filtro (evita Number(null) === 0 e falsos positivos no ano letivo). */
export function parseTurmaAnoCivil(turma: {
  anoLetivoRef?: { ano?: unknown } | null;
  ano?: unknown;
}): number | null {
  const raw = turma?.anoLetivoRef?.ano ?? turma?.ano;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
