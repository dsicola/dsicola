/**
 * Cache em memória com TTL (time-to-live) para reduzir carga no BD.
 * Uso: dashboard, contagens, configuração que muda pouco.
 * Não usar para dados que precisam de consistência imediata.
 */

const DEFAULT_TTL_MS = 60 * 1000; // 60 segundos

interface Entry<T> {
  data: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();

/**
 * Obtém valor do cache. Retorna undefined se não existir ou estiver expirado.
 */
export function get<T>(key: string): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.data;
}

/**
 * Guarda valor no cache com TTL em milissegundos.
 */
export function set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, {
    data,
    expires: Date.now() + ttlMs,
  });
}

/**
 * Invalida uma chave (ex.: após alteração que afeta o dashboard).
 */
export function invalidate(key: string): void {
  store.delete(key);
}

export const DASHBOARD_STATS_TTL_MS = 60 * 1000; // 1 minuto
