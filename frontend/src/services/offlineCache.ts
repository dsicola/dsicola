/**
 * Cache de respostas GET para leitura offline.
 * Guarda respostas da API em IndexedDB e serve quando offline.
 *
 * Multi-tenant: a chave inclui URL completa (com contexto de instituição).
 * TTL: 30 minutos. Máx 100 entradas com evicção LRU.
 */

const DB_NAME = 'dsicola-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'responses';
const MAX_ENTRIES = 100;
const TTL_MS = 30 * 60 * 1000; // 30 minutos

interface CacheEntry {
  key: string;
  data: unknown;
  status: number;
  timestamp: number;
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
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

function buildCacheKey(method: string, url: string, params?: unknown): string {
  let paramsStr = '';
  if (params && typeof params === 'object') {
    const keys = Object.keys(params as object).sort();
    const sorted = keys.reduce((acc, k) => {
      (acc as Record<string, unknown>)[k] = (params as Record<string, unknown>)[k];
      return acc;
    }, {} as Record<string, unknown>);
    paramsStr = JSON.stringify(sorted);
  }
  return `${(method || 'get').toLowerCase()}:${url}:${paramsStr}`;
}

export function buildCacheKeyFromConfig(url: string, params?: unknown): string {
  return buildCacheKey('get', url, params);
}

export async function getCachedResponse(key: string): Promise<{ data: unknown; status: number } | null> {
  try {
    const db = await openDB();
    const entry = await new Promise<CacheEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!entry) return null;
    if (Date.now() - entry.timestamp > TTL_MS) {
      await removeCachedResponse(key);
      return null;
    }
    return { data: entry.data, status: entry.status };
  } catch {
    return null;
  }
}

export async function setCachedResponse(
  key: string,
  data: unknown,
  status: number
): Promise<void> {
  try {
    const db = await openDB();
    const entry: CacheEntry = { key, data, status, timestamp: Date.now() };

    // Evicção LRU: remover entradas mais antigas se exceder limite
    const all = await new Promise<CacheEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (all.length >= MAX_ENTRIES) {
      const sorted = [...all].sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = sorted.slice(0, all.length - MAX_ENTRIES + 1);
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const e of toRemove) {
        store.delete(e.key);
      }
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

async function removeCachedResponse(key: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}
