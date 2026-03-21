import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { getBaseUrlForSignedUrl } from '../utils/baseUrlForSignedUrl.js';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import {
  SIGNED_URL_EXPIRATION_MS,
  VIDEO_UPLOAD_CONFIG,
  BUCKET_UPLOAD_ROLES,
  isAllowedReadUploadBucket,
} from '../constants/storage.js';
import { getSecureUploadPath } from '../utils/parseArquivoUrl.js';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

// Get uploads directory - create if it doesn't exist
const getUploadsDir = () => {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

// Upload file
export const upload = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file;
    const { bucket, path: filePath } = req.body;

    if (!file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    // SEGURANÇA: Validar bucket e exigir roles específicas para documentos sensíveis
    if (!bucket || typeof bucket !== 'string') {
      throw new AppError('Bucket é obrigatório', 400);
    }
    const allowedRoles = BUCKET_UPLOAD_ROLES[bucket];
    if (!allowedRoles) {
      throw new AppError(`Bucket "${bucket}" não permitido para upload`, 403);
    }
    const userRoles = req.user?.roles ?? [];
    const hasPermission = userRoles.some((r) => allowedRoles.includes(r));
    if (!hasPermission) {
      throw new AppError('Sem permissão para enviar ficheiros neste bucket', 403);
    }

    // Validação específica para vídeos (bucket videoaulas)
    if (bucket === 'videoaulas') {
      // Validar MIME type
      if (!VIDEO_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new AppError(
          `Tipo de arquivo inválido. Apenas ${VIDEO_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.join(', ')} são permitidos para vídeos.`,
          400
        );
      }

      // Validar extensão
      const ext = path.extname(file.originalname).toLowerCase();
      if (!VIDEO_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.some(e => e === ext)) {
        throw new AppError(
          `Extensão inválida. Apenas ${VIDEO_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(', ')} são permitidos.`,
          400
        );
      }

      // Validar tamanho
      if (file.size > VIDEO_UPLOAD_CONFIG.MAX_FILE_SIZE) {
        const maxSizeMB = VIDEO_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024);
        throw new AppError(
          `Arquivo muito grande. Tamanho máximo permitido: ${maxSizeMB}MB`,
          400
        );
      }
    }

    // Caminho relativo: sanitizar (sem .., sem absolutos); validar com getSecureUploadPath
    const fileName = file.originalname || 'file';
    const rawRel = (typeof filePath === 'string' && filePath.trim()) ? filePath.trim().replace(/\\/g, '/') : path.basename(fileName);
    if (!rawRel || rawRel.includes('..') || rawRel.startsWith('/')) {
      throw new AppError('Caminho de ficheiro inválido', 400);
    }
    const uploadsDir = getUploadsDir();
    const fullPath = getSecureUploadPath(bucket, rawRel, uploadsDir);
    if (!fullPath) {
      throw new AppError('Caminho de ficheiro inválido', 400);
    }
    const finalPath = rawRel;

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(fullPath, file.buffer);

    const { getBaseUrlForSignedUrl } = await import('../utils/baseUrlForSignedUrl.js');
    const baseUrl = getBaseUrlForSignedUrl(req);
    const fileUrl = `${baseUrl}/uploads/${bucket}/${finalPath}`;

    res.json({
      url: fileUrl,
      path: finalPath,
      fileName,
      bucket,
    });
  } catch (error) {
    next(error);
  }
};

// Delete file
export const deleteFile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { bucket, path: filePath } = req.body;

    // SEGURANÇA: Validar bucket e exigir roles específicas (mesma lógica do upload)
    if (!bucket || typeof bucket !== 'string') {
      throw new AppError('Bucket é obrigatório', 400);
    }
    const allowedRoles = BUCKET_UPLOAD_ROLES[bucket];
    if (!allowedRoles) {
      throw new AppError(`Bucket "${bucket}" não permitido`, 403);
    }
    const userRoles = req.user?.roles ?? [];
    const hasPermission = userRoles.some((r) => allowedRoles.includes(r));
    if (!hasPermission) {
      throw new AppError('Sem permissão para eliminar ficheiros neste bucket', 403);
    }

    if (filePath && typeof filePath === 'string') {
      const normalized = filePath.trim().replace(/\\/g, '/');
      if (normalized.includes('..') || normalized.startsWith('/')) {
        throw new AppError('Caminho de ficheiro inválido', 400);
      }
      const uploadsDir = getUploadsDir();
      const fullPath = getSecureUploadPath(bucket, normalized, uploadsDir);
      if (fullPath && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get signed URL for private files
export const getSignedUrl = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { bucket, path: filePath } = req.query;

    if (!bucket || !filePath) {
      return res.status(400).json({ 
        message: 'Bucket and path parameters are required' 
      });
    }

    const bucketStr = String(bucket);
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(String(filePath));
    } catch {
      return res.status(400).json({ message: 'Invalid file path' });
    }
    if (decodedPath.includes('..') || decodedPath.startsWith('/') || bucketStr.includes('..')) {
      return res.status(400).json({ message: 'Invalid file path' });
    }
    const uploadsDir = getUploadsDir();
    const resolved = getSecureUploadPath(bucketStr, decodedPath, uploadsDir);
    if (!resolved) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    const baseUrl = getBaseUrlForSignedUrl(req);
    
    // Get token from Authorization header to include in signed URL
    // This allows the URL to be opened directly in browser without additional headers
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    
    // Construct absolute URL for the signed file
    // In production, this would generate a signed URL from cloud storage (S3, GCS, etc.)
    // The path should be URL-encoded to handle special characters
    const encodedPath = encodeURIComponent(decodedPath);
    const encodedToken = encodeURIComponent(token);
    
    // Since routes are mounted at root, use /storage/file/:bucket
    // Include token as query parameter so browser requests include it
    const expiresAt = Date.now() + SIGNED_URL_EXPIRATION_MS;
    const signedUrl = `${baseUrl}/storage/file/${bucket}?path=${encodedPath}&token=${encodedToken}&signed=true&expires=${expiresAt}`;

    res.json({ url: signedUrl });
  } catch (error) {
    next(error);
  }
};

// Serve file - for serving uploaded files
export const serveFile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { bucket } = req.params;
    const { path: filePath, signed, expires } = req.query;

    if (!bucket || !filePath) {
      return res.status(400).json({ message: 'Bucket and path are required' });
    }
    if (!isAllowedReadUploadBucket(String(bucket))) {
      return res.status(400).json({ message: 'Bucket not allowed' });
    }

    // SEGURANÇA: Validar expiração de signed URLs
    if (signed === 'true' && expires) {
      const expiresAt = parseInt(expires as string, 10);
      if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
        return res.status(403).json({ message: 'Link expirado. Solicite um novo link para visualizar o ficheiro.' });
      }
    }

    // Servir do disco local (funciona com volume persistente Railway/Docker)

    // Decode the file path
    const decodedPath = decodeURIComponent(filePath as string);
    
    // Prevent directory traversal attacks
    if (decodedPath.includes('..') || decodedPath.startsWith('/')) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    const uploadsDir = getUploadsDir();
    const fullPath = getSecureUploadPath(bucket as string, decodedPath, uploadsDir);
    if (!fullPath) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Get file stats
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return res.status(400).json({ message: 'Path is not a file' });
    }

    // Determine content type based on file extension
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);

    // Stream the file
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};
