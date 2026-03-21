import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { getSecureUploadPath } from '../utils/parseArquivoUrl.js';
import { isAllowedReadUploadBucket } from '../constants/storage.js';

const getUploadsDir = () => {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Serve ficheiros em /uploads após authenticate (JWT no header ou ?token=).
 * Não usar express.static — valida bucket + path relativamente a uploads/.
 */
export function serveSecureUploads(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') {
    return next();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const urlPath = (req.originalUrl || '').split('?')[0];
  const prefix = '/uploads';
  if (!urlPath.startsWith(prefix)) {
    return res.status(404).json({ message: 'Não encontrado' });
  }

  let after = urlPath.slice(prefix.length);
  if (after.startsWith('/')) after = after.slice(1);
  const segments = after.split('/').filter(Boolean);
  if (segments.length < 2) {
    return res.status(400).json({ message: 'Caminho inválido' });
  }

  const bucket = segments[0];
  const relPath = segments.slice(1).join('/');
  if (bucket.includes('..') || !relPath) {
    return res.status(400).json({ message: 'Caminho inválido' });
  }
  if (!isAllowedReadUploadBucket(bucket)) {
    return res.status(404).json({ message: 'Não encontrado' });
  }

  const uploadsDir = getUploadsDir();
  const fullPath = getSecureUploadPath(bucket, relPath, uploadsDir);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return res.status(404).json({ message: 'Ficheiro não encontrado' });
  }

  const stats = fs.statSync(fullPath);
  if (!stats.isFile()) {
    return res.status(400).json({ message: 'Path is not a file' });
  }

  const { signed, expires } = req.query;
  if (signed === 'true' && expires) {
    const expiresAt = parseInt(expires as string, 10);
    if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
      return res.status(403).json({ message: 'Link expirado. Solicite um novo link.' });
    }
  }

  const ext = path.extname(fullPath).toLowerCase();
  res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', String(stats.size));
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);

  if (req.method === 'HEAD') {
    return res.end();
  }

  const stream = fs.createReadStream(fullPath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end();
  });
  stream.pipe(res);
}
