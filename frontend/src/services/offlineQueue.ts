/**
 * Fila offline - guarda pedidos falhados por falta de rede em IndexedDB
 * e reenvia automaticamente quando a ligação voltar.
 *
 * Multi-tenant: o pedido guardado preserva URL, headers (auth) e params -
 * o contexto de instituição vem do JWT no header Authorization.
 *
 * Uso seguro em produção:
 * - Não altera o fluxo quando online
 * - Fallback gracioso se IndexedDB falhar
 * - Apenas enfileira POST/PUT/PATCH/DELETE que falharam por erro de rede
 */

const DB_NAME = 'dsicola-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'requests';

export type QueueStatus = 'PENDING' | 'SYNCED' | 'ERROR' | 'FAILED';

/** Máximo de tentativas antes de marcar como falha definitiva */
export const MAX_RETRIES = 5;

export type QueueEntity =
  | 'student'
  | 'grade'
  | 'payment'
  | 'document'
  | 'class'
  | 'course'
  | 'enrollment'
  | 'other';

export interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  baseURL?: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  createdAt: number;
  idempotencyKey?: string;
  status?: QueueStatus;
  entity?: QueueEntity;
  retryCount?: number;
  /** ID temporário para entidades criadas offline; mapeado para ID real após sync */
  tempId?: string;
}

const TEMP_ID_REGEX = /^temp_[a-zA-Z0-9-]+$/;

/** Extrai tempId de data.id se existir */
export function extractTempId(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'id' in data) {
    const id = (data as { id?: unknown }).id;
    if (typeof id === 'string' && TEMP_ID_REGEX.test(id)) return id;
  }
  return undefined;
}

/** Verifica se data contém referências a temp IDs (para substituição) */
export function containsTempIds(data: unknown): boolean {
  if (!data) return false;
  if (typeof data === 'string') return TEMP_ID_REGEX.test(data);
  if (Array.isArray(data)) return data.some((v) => containsTempIds(v));
  if (typeof data === 'object') {
    return Object.values(data).some((v) => containsTempIds(v));
  }
  return false;
}

/** Substitui temp IDs por IDs reais no objeto (clone) */
export function substituteTempIds<T>(data: T, map: Map<string, string>): T {
  if (!data) return data;
  if (typeof data === 'string') {
    const real = map.get(data);
    return (real ?? data) as T;
  }
  if (Array.isArray(data)) {
    return data.map((v) => substituteTempIds(v, map)) as T;
  }
  if (typeof data === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = substituteTempIds(v, map);
    }
    return out as T;
  }
  return data;
}

/** Infere entidade a partir da URL (para UI e logs) */
export function inferEntityFromUrl(url: string): QueueEntity {
  const u = url.toLowerCase();
  if (u.includes('/estudantes') || u.includes('/alunos')) return 'student';
  if (u.includes('/notas')) return 'grade';
  if (u.includes('/pagamentos') || u.includes('/mensalidades') || u.includes('/recibos')) return 'payment';
  if (u.includes('/documentos')) return 'document';
  if (u.includes('/classes')) return 'class';
  if (u.includes('/cursos')) return 'course';
  if (u.includes('/matriculas')) return 'enrollment';
  return 'other';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

export async function addToQueue(request: Omit<QueuedRequest, 'id' | 'createdAt'>): Promise<string | null> {
  try {
    const db = await openDB();
    const id = crypto.randomUUID();
    const entity = request.entity ?? inferEntityFromUrl(request.url);
    const tempId = request.tempId ?? extractTempId(request.data);
    const item: QueuedRequest = {
      ...request,
      id,
      createdAt: Date.now(),
      status: 'PENDING',
      entity,
      retryCount: 0,
      ...(tempId && { tempId }),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(item);
      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function updateQueueItemStatus(id: string, status: QueueStatus): Promise<void> {
  try {
    const items = await getQueue();
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const retryCount = (item.retryCount ?? 0) + 1;
    const finalStatus = retryCount >= MAX_RETRIES ? 'FAILED' : status;
    const updated = { ...item, status: finalStatus, retryCount };
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

export async function getQueue(): Promise<QueuedRequest[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

export async function getQueueCount(): Promise<number> {
  const items = await getQueue();
  return items.length;
}

export async function getQueueStats(): Promise<{
  pending: number;
  error: number;
  failed: number;
  total: number;
}> {
  const items = await getQueue();
  const pending = items.filter((i) => (i.status ?? 'PENDING') === 'PENDING').length;
  const error = items.filter((i) => i.status === 'ERROR').length;
  const failed = items.filter((i) => i.status === 'FAILED').length;
  return { pending, error, failed, total: items.length };
}

/** Remove item da fila (ex.: utilizador descarta item com falha) */
export async function discardFromQueue(id: string): Promise<void> {
  await removeFromQueue(id);
}
