import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { SIGNED_URL_EXPIRATION_MS, VIDEO_UPLOAD_CONFIG } from '../constants/storage.js';

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

    // Salvar em disco local (dev + produção com volume persistente Railway/Docker)
    // Se no futuro usar S3/R2, adicione STORAGE_PROVIDER=s3 e lógica condicional
    const fileName = file.originalname || 'file';
    const finalPath = filePath || fileName;

    const uploadsDir = getUploadsDir();
    const bucketDir = path.join(uploadsDir, bucket);

    if (!fs.existsSync(bucketDir)) {
      await mkdir(bucketDir, { recursive: true });
    }

    const fullPath = path.join(bucketDir, finalPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(fullPath, file.buffer);

    const fileUrl = `/uploads/${bucket}/${finalPath}`;

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

    // Deletar do disco local (dev + produção com volume persistente)
    if (filePath) {
      const uploadsDir = getUploadsDir();
      const fullPath = path.join(uploadsDir, bucket, filePath);
      
      if (fs.existsSync(fullPath)) {
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

    // Get base URL from environment or construct from request
    // Since routes are mounted at root level, we don't need /api prefix
    let baseUrl = process.env.API_URL || process.env.BASE_URL;
    
    if (!baseUrl) {
      // Construct from request headers
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers.host || 'localhost:3001';
      baseUrl = `${protocol}://${host}`;
    }
    
    // Remove trailing slash if present
    baseUrl = baseUrl.replace(/\/$/, '');
    
    // Get token from Authorization header to include in signed URL
    // This allows the URL to be opened directly in browser without additional headers
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    
    // Construct absolute URL for the signed file
    // In production, this would generate a signed URL from cloud storage (S3, GCS, etc.)
    // The path should be URL-encoded to handle special characters
    const encodedPath = encodeURIComponent(filePath as string);
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
    const { path: filePath } = req.query;

    if (!bucket || !filePath) {
      return res.status(400).json({ message: 'Bucket and path are required' });
    }

    // Servir do disco local (funciona com volume persistente Railway/Docker)

    // Decode the file path
    const decodedPath = decodeURIComponent(filePath as string);
    
    // Prevent directory traversal attacks
    if (decodedPath.includes('..') || decodedPath.startsWith('/')) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    const uploadsDir = getUploadsDir();
    const fullPath = path.join(uploadsDir, bucket, decodedPath);

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
