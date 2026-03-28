import type { UserRole } from '@prisma/client';

/**
 * Constantes de configuração para storage e signed URLs
 */

// Tempo de expiração para signed URLs (8 minutos = 480000ms)
export const SIGNED_URL_EXPIRATION_MS = 8 * 60 * 1000; // 8 minutos

/** Anexos em `documentos_alunos` e `documentos_funcionarios` (perfil estudante / RH). */
export const DOCUMENTO_ANEXO_PERFIL_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// Validações para upload de vídeos
export const VIDEO_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  ALLOWED_MIME_TYPES: ['video/mp4'],
  ALLOWED_EXTENSIONS: ['.mp4'],
} as const;

// Bucket padrão para videoaulas
export const VIDEO_BUCKET = 'videoaulas';

/**
 * Mapeamento bucket -> roles permitidas para upload.
 * Documentos sensíveis exigem roles específicas; buckets não listados são rejeitados.
 */
export const BUCKET_UPLOAD_ROLES: Record<string, UserRole[]> = {
  documentos_funcionarios: ['ADMIN', 'SUPER_ADMIN', 'RH'] as UserRole[],
  documentos_alunos: ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN'] as UserRole[],
  avatars: ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'RH', 'PROFESSOR', 'ALUNO'] as UserRole[],
  /** Pagamentos manuais: licença, publicidade Comunidade, etc. DIRECAO alinha a gestão institucional. */
  comprovativos: ['ADMIN', 'DIRECAO', 'SUPER_ADMIN', 'FINANCEIRO'] as UserRole[],
  videoaulas: ['SUPER_ADMIN'] as UserRole[],
};

/** Buckets com pasta em uploads/ (leitura autenticada). Inclui rotas que não usam storage API upload mas gravam em disco. */
const STATIC_UPLOAD_BUCKETS = ['biblioteca', 'chat', 'comunicados', 'relatorios'] as const;

function buildAllowedReadUploadBuckets(): Set<string> {
  const s = new Set<string>(Object.keys(BUCKET_UPLOAD_ROLES));
  for (const b of STATIC_UPLOAD_BUCKETS) s.add(b);
  const extra = (process.env.UPLOAD_BUCKETS_EXTRA || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  for (const b of extra) s.add(b);
  return s;
}

/** Conjunto resolvido no arranque; override sem redeploy: UPLOAD_BUCKETS_EXTRA=bucket1,bucket2 */
export const ALLOWED_READ_UPLOAD_BUCKETS = buildAllowedReadUploadBuckets();

export function isAllowedReadUploadBucket(bucket: string): boolean {
  const b = String(bucket ?? '').trim();
  if (!b || b.includes('..') || b.includes('/') || b.includes('\\')) return false;
  return ALLOWED_READ_UPLOAD_BUCKETS.has(b);
}

