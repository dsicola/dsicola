/**
 * Constantes de configuração para storage e signed URLs
 */

// Tempo de expiração para signed URLs (8 minutos = 480000ms)
export const SIGNED_URL_EXPIRATION_MS = 8 * 60 * 1000; // 8 minutos

// Validações para upload de vídeos
export const VIDEO_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  ALLOWED_MIME_TYPES: ['video/mp4'],
  ALLOWED_EXTENSIONS: ['.mp4'],
} as const;

// Bucket padrão para videoaulas
export const VIDEO_BUCKET = 'videoaulas';

