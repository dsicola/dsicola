import { Request } from 'express';

/**
 * Obtém a base URL para gerar URLs assinadas (documentos, ficheiros, vídeos).
 * Prefere o Origin/Referer do pedido (subdomínio da instituição) para que a URL
 * abra no domínio correto e evite REDIRECT_TO_SUBDOMAIN ao abrir em nova aba (multi-tenant).
 */
export function getBaseUrlForSignedUrl(req: Request): string {
  let baseUrl = '';
  const origin = req.headers['origin'] || req.headers['referer'];
  if (origin) {
    try {
      const url = new URL(origin);
      const host = url.hostname.toLowerCase();
      const platformDomain = (process.env.PLATFORM_BASE_DOMAIN || 'dsicola.com')
        .replace(/^https?:\/\//, '')
        .split('/')[0];
      const parts = host.split('.');
      const isSubdomain =
        parts.length >= 3 &&
        parts.slice(-2).join('.') === platformDomain &&
        !['www', 'app', 'admin'].includes(parts[0]);
      if (isSubdomain) {
        baseUrl = `${url.protocol}//${url.host}`;
      }
    } catch {
      // invalid origin, fall through
    }
  }
  if (!baseUrl) {
    baseUrl = process.env.API_URL || process.env.BASE_URL || '';
  }
  if (!baseUrl) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers.host || 'localhost:3001';
    baseUrl = `${protocol}://${host}`;
  }
  return baseUrl.replace(/\/$/, '');
}
