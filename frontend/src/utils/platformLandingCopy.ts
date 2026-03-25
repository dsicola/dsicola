/** Mapa de chaves vindas de GET /configuracoes-landing/public (super-admin). */

export type PlatformPublicCopy = Record<string, string>;

export function landingConfigsToMap(
  configs: Array<{ chave: string; valor: string | null }> | undefined,
): PlatformPublicCopy {
  const m: PlatformPublicCopy = {};
  if (!configs) return m;
  for (const c of configs) {
    if (c.valor != null && String(c.valor).length) m[c.chave] = String(c.valor);
  }
  return m;
}

export function getLandingCopy(map: PlatformPublicCopy, key: string, fallback: string): string {
  const v = map[key]?.trim();
  return v || fallback;
}
