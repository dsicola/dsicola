/**
 * Upload de anexos para chat - fotos, PDF, vídeos (estilo WhatsApp)
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from './errorHandler.js';

const CHAT_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'chat');
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE = 20 * 1024 * 1024;   // 20MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_SIZE = MAX_VIDEO_SIZE;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const ALLOWED_DOC_TYPES = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/webm'];

const ALLOWED_MIME = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_PDF_TYPES, ...ALLOWED_DOC_TYPES, ...ALLOWED_AUDIO_TYPES];

if (!fs.existsSync(CHAT_UPLOAD_DIR)) {
  fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const instId = (req as any).user?.instituicaoId || 'default';
    const dir = path.join(CHAT_UPLOAD_DIR, instId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || path.extname(file.mimetype || '') || '.bin';
    const safeName = (file.originalname || 'file').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50);
    const filename = `${Date.now()}_${uuidv4().slice(0, 8)}_${safeName}`;
    cb(null, filename);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new AppError(`Tipo de arquivo não permitido. Use: imagens (JPG, PNG, GIF, WebP), PDF, vídeos (MP4, WebM), áudio (MP3, WAV, M4A, OGG) ou documentos Word.`, 400));
  }
  cb(null, true);
};

export const chatUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});
