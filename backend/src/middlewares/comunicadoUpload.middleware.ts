/**
 * Upload de anexos para comunicados - multi-tenant por instituicaoId
 * Aceita: imagens, PDF, áudio (mp3, wav, m4a, ogg, webm), documentos Word
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from './errorHandler.js';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'comunicados');
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;   // 25MB
const MAX_PDF_SIZE = 20 * 1024 * 1024;     // 20MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;   // 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;    // 50MB

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_AUDIO = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/webm'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_PDF = ['application/pdf'];
const ALLOWED_DOC = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const ALLOWED_MIME = [...ALLOWED_IMAGE, ...ALLOWED_AUDIO, ...ALLOWED_VIDEO, ...ALLOWED_PDF, ...ALLOWED_DOC];

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const instId = (req as any).user?.instituicaoId || 'default';
    const dir = path.join(UPLOAD_DIR, instId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype?.includes('audio') ? '.mp3' : '.bin');
    const safeName = (file.originalname || 'file').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50);
    const filename = `${Date.now()}_${uuidv4().slice(0, 8)}_${safeName}`;
    cb(null, filename);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new AppError(
      'Tipo não permitido. Use: imagens, PDF, áudio (MP3, WAV, M4A, OGG), vídeos ou documentos Word.',
      400
    ));
  }
  cb(null, true);
};

export const comunicadoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});
