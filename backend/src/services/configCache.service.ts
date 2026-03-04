/**
 * Cache em memória para configuração da instituição.
 * ROADMAP-100: reduz queries repetidas em endpoints que leem config.
 *
 * TTL: 5 minutos. Invalidado em PUT /configuracoes-instituicao.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutos

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getConfigFromCache<T>(instituicaoId: string): T | null {
  const entry = cache.get(instituicaoId) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(instituicaoId);
    return null;
  }
  return entry.data;
}

export function setConfigInCache<T>(instituicaoId: string, data: T): void {
  cache.set(instituicaoId, {
    data,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function invalidateConfigCache(instituicaoId: string): void {
  cache.delete(instituicaoId);
}
