/**
 * Regras de cadastro de Curso por tipo de instituição.
 * Ensino Superior: duração nominal e grau são obrigatórios e limitados a listas fechadas
 * (alinhado ao select do frontend).
 */
export const DURACOES_CURSO_SUPERIOR = [
  '1 ano',
  '2 anos',
  '3 anos',
  '4 anos',
  '5 anos',
  '6 anos',
] as const;

export type DuracaoCursoSuperior = (typeof DURACOES_CURSO_SUPERIOR)[number];

export const GRAUS_CURSO_SUPERIOR = [
  'Licenciatura',
  'Bacharelato',
  'Mestrado',
  'Doutorado',
] as const;

export type GrauCursoSuperior = (typeof GRAUS_CURSO_SUPERIOR)[number];

export function isDuracaoCursoSuperiorValid(
  value: string | null | undefined
): value is DuracaoCursoSuperior {
  return !!value && (DURACOES_CURSO_SUPERIOR as readonly string[]).includes(value);
}

export function isGrauCursoSuperiorValid(value: string | null | undefined): value is GrauCursoSuperior {
  return !!value && (GRAUS_CURSO_SUPERIOR as readonly string[]).includes(value);
}
