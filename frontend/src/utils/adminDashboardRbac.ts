/**
 * Alinha o hub Admin Dashboard ao RBAC já documentado em menuConfig / sidebar:
 * SUPER_ADMIN não deve ver atalhos para operações pedagógicas por instituição.
 */

export function isAcademicModuleItemBlockedForSuperAdmin(href: string): boolean {
  const h = href.split('?')[0];
  if (h.includes('/admin-dashboard/avaliacoes-notas')) return true;
  if (h.includes('/admin-dashboard/lancamento-aulas')) return true;
  if (h.includes('/admin-dashboard/presencas')) return true;
  if (href.includes('tab=notas')) return true;
  return false;
}

/** Rotas permitidas nas Ações Rápidas para SUPER_ADMIN (suporte / fiscal, sem operação académica). */
const SUPER_ADMIN_QUICK_ACTION_PATH_PREFIXES = [
  '/admin-dashboard/pagamentos',
  '/admin-dashboard/gestao-financeira',
  '/admin-dashboard/documentos-fiscais',
  '/admin-dashboard/notificacoes',
  '/admin-dashboard/configuracao-ensino',
  '/admin-dashboard/configuracoes',
] as const;

export function isQuickActionAllowedForSuperAdmin(path: string): boolean {
  return SUPER_ADMIN_QUICK_ACTION_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function filterAcademicDashboardItems<T extends { href: string }>(
  role: string | undefined,
  items: T[]
): T[] {
  if (role !== 'SUPER_ADMIN') return items;
  return items.filter((item) => !isAcademicModuleItemBlockedForSuperAdmin(item.href));
}
