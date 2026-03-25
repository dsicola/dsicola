/**
 * Validação multi-tenant por hostname.
 * - Subdomínio (ex: escolaA.dsicola.com): instituição pelo campo subdominio.
 * - Domínio próprio (ex: escola.com): mesma instituição, campo dominioCustomizado (Enterprise / funcionalidade).
 * - Domínio principal (ex: app.dsicola.com): portal central; SUPER_ADMIN/COMERCIAL.
 * - Localhost: sem candidato de tenant (`localhost` / 127.* só na API) → ignorado; `escola.localhost` (dev) resolve pelo campo subdominio.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from './errorHandler.js';
import { UserRole } from '@prisma/client';
import { normalizeInstituicaoCustomDomainHost } from '../utils/instituicaoCustomDomain.js';

const platformBaseDomain = (process.env.PLATFORM_BASE_DOMAIN || 'dsicola.com').replace(/^https?:\/\//, '').split('/')[0];
const mainDomainHost = (process.env.MAIN_DOMAIN || `app.${platformBaseDomain}`).replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
const centralHosts = [
  mainDomainHost,
  `www.${platformBaseDomain}`,
  platformBaseDomain,
  `api.${platformBaseDomain}`,
  ...(process.env.CENTRAL_HOSTS || '').split(',').map((h: string) => h.trim().toLowerCase()).filter(Boolean),
].map((h) => h.toLowerCase());

export type TenantDomainMode = 'ignored' | 'central' | 'subdomain';

declare global {
  namespace Express {
    interface Request {
      tenantDomainMode?: TenantDomainMode;
      tenantDomainInstituicaoId?: string | null;
      tenantDomainSubdominio?: string | null;
      /** Preenchido quando o tenant foi resolvido por domínio próprio (hostname normalizado). */
      tenantDomainCustomHost?: string | null;
    }
  }
}

function getHostname(req: Request): string {
  const host = req.hostname || req.get('host') || '';
  return host.split(':')[0].toLowerCase().trim();
}

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('127.');
}

function isMainDomain(hostname: string): boolean {
  return centralHosts.includes(hostname.toLowerCase());
}

function extractSubdomain(hostname: string): string | null {
  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const suffix = parts.slice(-2).join('.');
  if (suffix !== platformBaseDomain) return null;
  const sub = parts[0].toLowerCase();
  if (['www', 'app', 'admin'].includes(sub)) return null;
  return /^[a-z0-9-]+$/.test(sub) ? sub : null;
}

/**
 * Dev: `minhaescola.localhost` resolve o mesmo tenant que `minhaescola.PLATFORM_BASE_DOMAIN`.
 * Em produção só activo se ALLOW_LOCALHOST_SUBDOMAIN=true (testes CI).
 */
export function extractLocalhostTenantSubdomain(hostname: string): string | null {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCALHOST_SUBDOMAIN !== 'true') {
    return null;
  }
  const h = hostname.toLowerCase().trim();
  const parts = h.split('.');
  if (parts.length !== 2 || parts[1] !== 'localhost') return null;
  const sub = parts[0].toLowerCase();
  if (['www', 'app', 'admin'].includes(sub)) return null;
  return /^[a-z0-9-]+$/.test(sub) ? sub : null;
}

/**
 * Hosts candidatos: Origin/Referer primeiro (browser real), depois Host da API.
 * Permite resolver tenant quando o frontend está em domínio próprio ou subdomínio e a API em outro host.
 */
function collectHostnameCandidates(req: Request): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (h: string) => {
    const x = h.split(':')[0].toLowerCase().trim();
    if (x && !seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  };
  const origin = req.get('origin') || req.get('referer');
  if (origin) {
    try {
      const url = new URL(origin);
      push(url.hostname);
    } catch {
      // ignorar
    }
  }
  // Encadeamento de proxies: por vezes Host é interno mas o cliente enviou o host público aqui
  const xfHost = req.get('x-forwarded-host');
  if (xfHost) {
    push(xfHost.split(',')[0].trim());
  }
  push(getHostname(req));
  return out;
}

function shouldSkipHostForTenantLookup(hostname: string): boolean {
  return isLocalhost(hostname) || isMainDomain(hostname);
}

type InstTenantSelect = { id: string; subdominio: string; dominioCustomizado: string | null };

function applySubdomainContext(req: Request, inst: InstTenantSelect, customHost: string | null): void {
  req.tenantDomainMode = 'subdomain';
  req.tenantDomainInstituicaoId = inst.id;
  req.tenantDomainSubdominio = inst.subdominio;
  req.tenantDomainCustomHost = customHost;
}

const instSelect = { id: true, subdominio: true, dominioCustomizado: true } as const;

/**
 * Middleware que captura req.hostname / Origin e preenche o contexto de tenant.
 */
export const parseTenantDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const candidates = collectHostnameCandidates(req);
    const nonLocal = candidates.filter((c) => !isLocalhost(c));

    if (nonLocal.length === 0) {
      req.tenantDomainMode = 'ignored';
      return next();
    }

    for (const h of candidates) {
      if (shouldSkipHostForTenantLookup(h)) continue;

      if (h.endsWith(platformBaseDomain)) {
        const sub = extractSubdomain(h);
        if (!sub) continue;
        const instituicao = await prisma.instituicao.findUnique({
          where: { subdominio: sub },
          select: instSelect,
        });
        if (!instituicao) {
          throw new AppError('Instituição não encontrada para este subdomínio.', 404);
        }
        applySubdomainContext(req, instituicao, null);
        return next();
      }

      const localSub = extractLocalhostTenantSubdomain(h);
      if (localSub) {
        const instLocal = await prisma.instituicao.findUnique({
          where: { subdominio: localSub },
          select: instSelect,
        });
        if (!instLocal) {
          throw new AppError('Instituição não encontrada para este subdomínio.', 404);
        }
        applySubdomainContext(req, instLocal, null);
        return next();
      }

      const norm = normalizeInstituicaoCustomDomainHost(h);
      if (!norm) continue;
      const instCustom = await prisma.instituicao.findUnique({
        where: { dominioCustomizado: norm },
        select: instSelect,
      });
      if (instCustom) {
        applySubdomainContext(req, instCustom, norm);
        return next();
      }
    }

    const hasResolvablePlatformHost = candidates.some(
      (c) => !shouldSkipHostForTenantLookup(c) && c.endsWith(platformBaseDomain) && extractSubdomain(c),
    );
    const hasLocalTenantHost = candidates.some(
      (c) => !shouldSkipHostForTenantLookup(c) && Boolean(extractLocalhostTenantSubdomain(c)),
    );
    if (hasResolvablePlatformHost) {
      throw new AppError('Acesso inválido: use o domínio da sua instituição ou o portal principal.', 403);
    }
    if (hasLocalTenantHost) {
      throw new AppError('Instituição não encontrada para este subdomínio (localhost).', 404);
    }

    req.tenantDomainMode = 'central';
    req.tenantDomainInstituicaoId = null;
    req.tenantDomainSubdominio = null;
    req.tenantDomainCustomHost = null;
    next();
  } catch (e) {
    next(e);
  }
};

/**
 * Middleware de validação para rotas autenticadas (após authenticate).
 */
export const validateTenantDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const mode = req.tenantDomainMode ?? 'ignored';

  if (mode === 'ignored') {
    return next();
  }

  if (!req.user) {
    const err = new AppError('Não autenticado. Faça login para continuar.', 401);
    (err as any).reason = 'UNAUTHORIZED';
    return next(err);
  }

  if (mode === 'subdomain') {
    const tenantId = req.tenantDomainInstituicaoId ?? null;
    const userInstId = req.user.instituicaoId ?? null;
    const isPlatformRole =
      (req.user.roles?.includes(UserRole.SUPER_ADMIN) || req.user.roles?.includes(UserRole.COMERCIAL)) ?? false;

    if (isPlatformRole) {
      return next();
    }

    if (tenantId !== userInstId) {
      const err = new AppError('Usuário não pertence a esta instituição.', 403);
      (err as any).reason = 'TENANT_MISMATCH';
      return next(err);
    }
    return next();
  }

  if (mode === 'central') {
    const isPlatformRole = (req.user.roles?.includes(UserRole.SUPER_ADMIN) || req.user.roles?.includes(UserRole.COMERCIAL)) ?? false;
    if (isPlatformRole) {
      return next();
    }
    const rawPath = (req.originalUrl || req.url || req.path || '').split('?')[0];
    const path = rawPath.replace(/^\/api(?=\/|$)/i, '') || rawPath;
    const isDocumentViewRoute =
      /^\/documentos-aluno\/[^/]+\/arquivo$/i.test(path) ||
      /^\/documentos-funcionario\/[^/]+\/arquivo$/i.test(path) ||
      /^\/contratos-funcionario\/[^/]+\/arquivo$/i.test(path) ||
      /^\/storage\/file\/[^/]+$/i.test(path);
    if (isDocumentViewRoute && req.user.instituicaoId) {
      return next();
    }
    const isStorageUploadRoute = req.method === 'POST' && /^\/storage\/upload$/i.test(path);
    if (isStorageUploadRoute && req.user.instituicaoId) {
      return next();
    }
    const err = new AppError('Acesso pelo domínio principal é permitido apenas para administradores da plataforma. Use o endereço da sua instituição.', 403);
    (err as any).reason = 'REDIRECT_TO_SUBDOMAIN';
    if (req.user.instituicaoId) {
      try {
        const inst = await prisma.instituicao.findUnique({
          where: { id: req.user.instituicaoId },
          select: { subdominio: true, dominioCustomizado: true },
        });
        if (inst?.subdominio || inst?.dominioCustomizado) {
          (err as any).redirectToSubdomain = getLoginBaseUrlForInstituicao(inst.subdominio, inst.dominioCustomizado);
        }
      } catch {
        // ignorar
      }
    }
    return next(err);
  }

  next();
};

export function buildSubdomainUrl(subdominio: string): string {
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.FRONTEND_PORT || '5173';
    return `${protocol}://${subdominio}.localhost:${port}`;
  }
  const base = platformBaseDomain;
  if (isLocalhost(base)) {
    return `${protocol}://localhost:${process.env.FRONTEND_PORT || '5173'}`;
  }
  return `${protocol}://${subdominio}.${base}`;
}

/**
 * URL preferencial do portal da instituição (domínio próprio se configurado; senão subdomínio da plataforma).
 */
export function getLoginBaseUrlForInstituicao(subdominio?: string | null, dominioCustomizado?: string | null): string {
  const custom = dominioCustomizado?.trim();
  if (custom) {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    return `${protocol}://${custom}`;
  }
  const s = subdominio?.trim();
  if (s) {
    return buildSubdomainUrl(s);
  }
  const raw = process.env.FRONTEND_URL || 'http://localhost:8080';
  return raw.split(',')[0].trim();
}
