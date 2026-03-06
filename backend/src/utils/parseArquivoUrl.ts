import path from 'path';

/**
 * Extrai bucket e path relativo a partir de arquivoUrl (URL completa ou path).
 * Ex: "https://x.com/uploads/documentos_funcionarios/contratos/file.pdf" -> { bucket: "documentos_funcionarios", relPath: "contratos/file.pdf" }
 * Ex: "/uploads/documentos_funcionarios/contratos/file.pdf" -> { bucket: "documentos_funcionarios", relPath: "contratos/file.pdf" }
 */
export function parseArquivoUrlToStorage(arquivoUrl: string | null): { bucket: string; relPath: string } | null {
  if (!arquivoUrl || typeof arquivoUrl !== 'string') return null;
  const s = arquivoUrl.trim();
  const match = s.match(/\/uploads\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const [, bucket, relPath] = match;
  if (!bucket || !relPath || relPath.includes('..') || relPath.startsWith('/')) return null;
  return { bucket, relPath };
}

/**
 * Retorna o path completo no disco para um ficheiro em uploads.
 * Valida que o path não escapa do diretório uploads (path traversal).
 */
export function getSecureUploadPath(bucket: string, relPath: string, uploadsDir: string): string | null {
  if (!bucket || !relPath || bucket.includes('..') || relPath.includes('..') || relPath.startsWith('/')) return null;
  const fullPath = path.join(uploadsDir, bucket, relPath);
  const resolved = path.resolve(fullPath);
  const uploadsResolved = path.resolve(uploadsDir);
  if (!resolved.startsWith(uploadsResolved)) return null;
  return fullPath;
}
