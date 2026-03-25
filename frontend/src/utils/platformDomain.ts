/** Domínio base da plataforma (ex.: dsicola.com), alinhado a PLATFORM_BASE_DOMAIN no backend. */
export function getPlatformBaseDomain(): string {
  const raw = (import.meta.env.VITE_PLATFORM_BASE_DOMAIN as string | undefined)?.trim();
  if (raw) {
    return raw.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  }
  return 'dsicola.com';
}
