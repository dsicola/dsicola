/**
 * CORS em produção: permite Origin quando o hostname está registado como
 * domínio próprio de uma instituição (Instituicao.dominioCustomizado).
 * Evita CORS_EXTRA_ORIGINS manual por cliente — padrão SaaS multi-tenant.
 */

import prisma from '../lib/prisma.js';
import { normalizeInstituicaoCustomDomainHost } from './instituicaoCustomDomain.js';

const TTL_MS = 60_000;
const cache = new Map<string, { allowed: boolean; expiresAt: number }>();

const isLikelyCloudDeploy = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RENDER ||
    process.env.FLY_APP_NAME
);

function secureCorsRequireHttps(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    isLikelyCloudDeploy
  );
}

/**
 * true se a Origin do browser corresponde a uma instituição com esse domínio customizado (ativa).
 */
export async function isOriginRegisteredInstitutionCustomDomain(origin: string): Promise<boolean> {
  if (!origin || typeof origin !== 'string') return false;

  let hostKey: string;
  try {
    const url = new URL(origin);
    if (secureCorsRequireHttps() && url.protocol !== 'https:') return false;
    const norm = normalizeInstituicaoCustomDomainHost(url.hostname);
    if (!norm) return false;
    hostKey = norm;
  } catch {
    return false;
  }

  const now = Date.now();
  const hit = cache.get(hostKey);
  if (hit && hit.expiresAt > now) {
    return hit.allowed;
  }

  let allowed = false;
  try {
    const inst = await prisma.instituicao.findUnique({
      where: { dominioCustomizado: hostKey },
      select: { id: true, status: true },
    });
    allowed = Boolean(inst && inst.status === 'ativa');
    allowed = Boolean(inst);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[CORS] Erro ao verificar domínio institucional:', (e as Error)?.message);
    }
    return false;
  }

  cache.set(hostKey, { allowed, expiresAt: now + TTL_MS });
  return allowed;
}

/** Para testes: limpar cache entre casos */
export function clearCorsCustomDomainCache(): void {
  cache.clear();
}
