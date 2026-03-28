/**
 * Mantém os mesmos valores que backend/src/constants/cursoAcademico.ts
 * (duração nominal e graus para Ensino Superior).
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
