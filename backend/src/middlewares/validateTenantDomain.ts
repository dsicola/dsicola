/**
 * Validação obrigatória de subdomínio por instituição.
 * - Subdomínio (ex: escolaA.dsicola.com): apenas usuários da instituição do subdomínio.
 * - Domínio principal (ex: app.dsicola.com): login permitido; redirecionar para subdomínio após login; rotas autenticadas apenas SUPER_ADMIN.
 * - Localhost: ignora validação (dev).
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from './errorHandler.js';
import { UserRole } from '@prisma/client';

const platformBaseDomain = (process.env.PLATFORM_BASE_DOMAIN || 'dsicola.com').replace(/^https?:\/\//, '').split('/')[0];
const mainDomainHost = (process.env.MAIN_DOMAIN || `app.${platformBaseDomain}`).replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
// Portal central: app, www, api (backend pode estar em api.dsicola.com), domínio nu (SUPER_ADMIN/COMERCIAL)
// Opcional: CENTRAL_HOSTS=host1.com,host2.com para outros hosts (ex.: backend em Railway)
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

/**
 * Verifica se o hostname é um domínio principal (portal central).
 * Aceita: app.dsicola.com, www.dsicola.com, dsicola.com (SUPER_ADMIN/COMERCIAL entram por aqui).
 */
function isMainDomain(hostname: string): boolean {
  return centralHosts.includes(hostname.toLowerCase());
}

/**
 * Extrai subdomínio do hostname quando for *.dsicola.com (ou *.PLATFORM_BASE_DOMAIN).
 * Retorna null se não for subdomínio da plataforma.
 */
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
 * Quando a API está noutro host (api.dsicola.com, Railway), o frontend pode estar no subdomínio.
 * Usar Origin ou Referer para saber de onde vem o pedido e assim não devolver 403 REDIRECT_TO_SUBDOMAIN
 * quando o utilizador já está no subdomínio correto.
 */
function getEffectiveHostname(req: Request): string {
  const origin = req.get('origin') || req.get('referer');
  if (origin) {
    try {
      const url = new URL(origin);
      const originHost = url.hostname.toLowerCase();
      if (originHost && originHost !== getHostname(req)) {
        const sub = extractSubdomain(originHost);
        if (sub) return originHost; // pedido veio de um subdomínio da plataforma
      }
    } catch {
      // ignorar URL inválida
    }
  }
  return getHostname(req);
}

/**
 * Middleware que captura req.hostname e preenche o contexto de tenant (req.tenantDomain*).
 * Deve rodar antes das rotas. Em localhost não faz lookup; em subdomínio busca instituição por subdominio.
 */
export const parseTenantDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hostname = getEffectiveHostname(req);

    if (isLocalhost(hostname)) {
      req.tenantDomainMode = 'ignored';
      return next();
    }

    if (isMainDomain(hostname)) {
      req.tenantDomainMode = 'central';
      req.tenantDomainInstituicaoId = null;
      req.tenantDomainSubdominio = null;
      return next();
    }

    // Backend fora do domínio da plataforma (ex.: Railway, Vercel): tratar como central para SUPER_ADMIN/COMERCIAL
    if (!hostname.endsWith(platformBaseDomain)) {
      req.tenantDomainMode = 'central';
      req.tenantDomainInstituicaoId = null;
      req.tenantDomainSubdominio = null;
      return next();
    }

    const subdomain = extractSubdomain(hostname);
    if (!subdomain) {
      throw new AppError('Acesso inválido: use o domínio da sua instituição ou o portal principal.', 403);
    }

    const instituicao = await prisma.instituicao.findUnique({
      where: { subdominio: subdomain },
      select: { id: true, subdominio: true }
    });

    if (!instituicao) {
      throw new AppError('Instituição não encontrada para este subdomínio.', 404);
    }

    req.tenantDomainMode = 'subdomain';
    req.tenantDomainInstituicaoId = instituicao.id;
    req.tenantDomainSubdominio = instituicao.subdominio;
    next();
  } catch (e) {
    next(e);
  }
};

/**
 * Middleware de validação para rotas autenticadas.
 * Deve rodar DEPOIS de authenticate (req.user já preenchido).
 * - Modo ignorado (localhost): next().
 * - Subdomínio: req.user.instituicaoId deve coincidir com a instituição do hostname; senão 403.
 * - Domínio central: apenas SUPER_ADMIN pode acessar; outros recebem 403 com reason REDIRECT_TO_SUBDOMAIN e redirectToSubdomain (URL).
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
    const err = new AppError('Acesso pelo domínio principal é permitido apenas para administradores da plataforma. Use o endereço da sua instituição.', 403);
    (err as any).reason = 'REDIRECT_TO_SUBDOMAIN';
    if (req.user.instituicaoId) {
      try {
        const inst = await prisma.instituicao.findUnique({
          where: { id: req.user.instituicaoId },
          select: { subdominio: true }
        });
        if (inst?.subdominio) {
          (err as any).redirectToSubdomain = buildSubdomainUrl(inst.subdominio);
        }
      } catch {
        // ignorar; frontend pode construir URL se tiver subdominio
      }
    }
    return next(err);
  }

  next();
};

/**
 * Retorna a URL do subdomínio da instituição (ex: https://escolaA.dsicola.com).
 * Usado no login no domínio central para redirecionar o usuário.
 */
export function buildSubdomainUrl(subdominio: string): string {
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const base = platformBaseDomain;
  if (isLocalhost(base)) {
    return `${protocol}://localhost:${process.env.FRONTEND_PORT || '5173'}`;
  }
  return `${protocol}://${subdominio}.${base}`;
}
