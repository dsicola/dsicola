import type { TFunction } from 'i18next';

export type InstitutionLabelKey =
  | 'cursoOuClasse'
  | 'cursoOuClassePlural'
  | 'areaOuOpcao'
  | 'cursoOuClasseHistorico'
  | 'filtrarCatalogo'
  | 'todosCatalogo'
  | 'candidaturaColuna'
  | 'candidaturaPretendido'
  | 'excelLabelTrilha'
  | 'excelValorTrilha'
  | 'queueEntityCourse';

function branch(isSecundario: boolean): 'secundario' | 'superior' {
  return isSecundario ? 'secundario' : 'superior';
}

/**
 * Rótulo traduzido conforme Ensino Superior vs Secundário.
 * Chaves em `institution.<key>.superior` | `.secundario` (pt-BR, en, …).
 */
export function tInstitution(t: TFunction, key: InstitutionLabelKey, isSecundario: boolean): string {
  return String(t(`institution.${key}.${branch(isSecundario)}`));
}
