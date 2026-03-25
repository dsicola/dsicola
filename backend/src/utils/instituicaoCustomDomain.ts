/**
 * Domínio próprio da instituição (ex.: escola.com) — complementa o subdomínio *.plataforma.
 * Valores guardados são sempre hostname normalizado (minúsculas, sem www., sem porta, sem path).
 */

const platformBaseDomain = (process.env.PLATFORM_BASE_DOMAIN || 'dsicola.com')
  .replace(/^https?:\/\//, '')
  .split('/')[0]
  .toLowerCase();

export function getPlatformBaseDomainForValidation(): string {
  return platformBaseDomain;
}

/** Extrai slug do subdomínio da plataforma (ex.: escola em escola.dsicola.com). */
export function extractPlatformSubdomainSlug(hostname: string): string | null {
  const platform = platformBaseDomain;
  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const suffix = parts.slice(-2).join('.');
  if (suffix !== platform) return null;
  const sub = parts[0].toLowerCase();
  if (['www', 'app', 'admin'].includes(sub)) return null;
  return /^[a-z0-9-]+$/.test(sub) ? sub : null;
}

/** A partir do hostname do browser (ou URL), indica como procurar a instituição na base de dados. */
export function parseHostForInstituicaoLookup(raw: string):
  | { kind: 'subdominio'; value: string }
  | { kind: 'dominio_customizado'; value: string }
  | null {
  let host = raw.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, '');
  const slash = host.indexOf('/');
  if (slash >= 0) host = host.slice(0, slash);
  host = host.split(':')[0].trim();
  if (!host) return null;

  const sub = extractPlatformSubdomainSlug(host);
  if (sub) return { kind: 'subdominio', value: sub };

  const custom = normalizeInstituicaoCustomDomainHost(host);
  if (custom) return { kind: 'dominio_customizado', value: custom };

  return null;
}

/**
 * Normaliza input do utilizador para hostname único ou null se inválido.
 */
export function normalizeInstituicaoCustomDomainHost(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return null;
  let s = raw.trim().toLowerCase();
  if (s === '') return null;
  s = s.replace(/^https?:\/\//, '');
  const slash = s.indexOf('/');
  if (slash >= 0) s = s.slice(0, slash);
  s = s.split(':')[0].trim();
  if (s.startsWith('www.')) s = s.slice(4);
  if (!s || s.length > 253) return null;

  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(s)) {
    return null;
  }

  if (s === platformBaseDomain || s.endsWith(`.${platformBaseDomain}`)) {
    return null;
  }

  const reserved = new Set(['localhost', '127.0.0.1']);
  if (reserved.has(s)) return null;

  return s;
}
