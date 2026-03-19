import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';

/**
 * Endpoint batch para sincronização offline.
 * Recebe array de pedidos e reexecuta cada um internamente.
 * Multi-tenant: usa o token do utilizador (instituicaoId no JWT).
 */

interface SyncItem {
  method: string;
  url: string;
  data?: unknown;
  params?: Record<string, unknown>;
  idempotencyKey?: string;
}

interface SyncResult {
  index: number;
  success: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

const idempotencyCache = new Map<string, { status: number; data: unknown }>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutos

function getCachedIdempotency(key: string): { status: number; data: unknown } | null {
  const cached = idempotencyCache.get(key);
  if (!cached) return null;
  return cached;
}

function setCachedIdempotency(key: string, status: number, data: unknown): void {
  idempotencyCache.set(key, { status, data });
  setTimeout(() => idempotencyCache.delete(key), IDEMPOTENCY_TTL_MS);
}

export async function syncBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { items } = req.body as { items: SyncItem[] };
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items é obrigatório e deve ser um array não vazio' });
      return;
    }
    if (items.length > 50) {
      res.status(400).json({ error: 'Máximo 50 itens por batch' });
      return;
    }

    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const authHeader = req.headers.authorization;
    const results: SyncResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const method = (item.method || 'post').toLowerCase();
      const url = item.url?.startsWith('/') ? item.url : `/${item.url}`;
      const fullUrl = new URL(url, baseUrl).toString();

      if (item.idempotencyKey) {
        const cached = getCachedIdempotency(item.idempotencyKey);
        if (cached) {
          results.push({ index: i, success: true, status: cached.status, data: cached.data });
          continue;
        }
      }

      try {
        const urlObj = new URL(fullUrl);
        if (item.params && typeof item.params === 'object') {
          Object.entries(item.params).forEach(([k, v]) => {
            if (v !== undefined && v !== null) urlObj.searchParams.set(k, String(v));
          });
        }
        const finalUrl = urlObj.toString();

        let bodyData = item.data;
        if (['post', 'put', 'patch'].includes(method) && bodyData && typeof bodyData === 'object' && !Array.isArray(bodyData)) {
          const obj = bodyData as Record<string, unknown>;
          if (obj.id && typeof obj.id === 'string' && obj.id.startsWith('temp_')) {
            const { id: _id, _tempId, ...rest } = obj;
            bodyData = rest;
          }
        }
        const fetchOptions: RequestInit = {
          method: method.toUpperCase(),
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader && { Authorization: authHeader }),
          },
        };
        if (['post', 'put', 'patch'].includes(method) && bodyData !== undefined) {
          fetchOptions.body = JSON.stringify(bodyData);
        }
        const response = await fetch(finalUrl, fetchOptions);
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

        if (item.idempotencyKey && response.ok) {
          setCachedIdempotency(item.idempotencyKey, response.status, data);
        }

        results.push({
          index: i,
          success: response.ok,
          status: response.status,
          data: response.ok ? data : undefined,
          error: response.ok ? undefined : (String(data?.message ?? data?.error ?? '').trim() || `HTTP ${response.status}`),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        results.push({ index: i, success: false, error: message });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('[sync] Erro:', err);
    res.status(500).json({ error: 'Erro ao processar sincronização' });
  }
}
