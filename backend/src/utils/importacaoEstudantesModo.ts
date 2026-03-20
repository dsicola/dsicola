/** Modo de importação Excel — partilhado entre preview, confirmar e testes. */
export function resolveModoImportacao(
  modoBody: string | undefined,
  legacyPermissivo: boolean | undefined
): 'seguro' | 'flexivel' {
  if (modoBody === 'flexivel') return 'flexivel';
  if (modoBody === 'seguro') return 'seguro';
  if (legacyPermissivo === true) return 'flexivel';
  return 'seguro';
}
