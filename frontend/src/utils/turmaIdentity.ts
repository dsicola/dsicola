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
