import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { UserRole } from '@prisma/client';
import { getJwtSecret } from '../lib/jwtSecrets.js';
import { AppError } from '../middlewares/errorHandler.js';

export const DOCUMENTO_ALUNO_VIEW_PURPOSE = 'documento_aluno_arquivo_v1';

export interface DocumentoAlunoViewTokenPayload {
  purpose: typeof DOCUMENTO_ALUNO_VIEW_PURPOSE;
  documentoId: string;
  /** Instituição do aluno dono do documento — reforça isolamento multi-tenant na verificação */
  resourceInstituicaoId: string | null;
  sub: string;
  email?: string;
  roles: UserRole[];
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
}

export function signDocumentoAlunoViewToken(
  payload: Omit<DocumentoAlunoViewTokenPayload, 'purpose'>,
  expiresInSeconds = 600
): string {
  const body: DocumentoAlunoViewTokenPayload = {
    purpose: DOCUMENTO_ALUNO_VIEW_PURPOSE,
    ...payload,
  };
  return jwt.sign(body, getJwtSecret(), {
    expiresIn: expiresInSeconds,
    jwtid: randomUUID(),
  });
}

export function verifyDocumentoAlunoViewToken(token: string): DocumentoAlunoViewTokenPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as DocumentoAlunoViewTokenPayload;
    if (decoded.purpose !== DOCUMENTO_ALUNO_VIEW_PURPOSE) {
      throw new AppError('Link de visualização inválido.', 403);
    }
    if (!decoded.documentoId || !decoded.sub || !Array.isArray(decoded.roles)) {
      throw new AppError('Link de visualização inválido.', 403);
    }
    return decoded;
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof jwt.TokenExpiredError) {
      const err = new AppError('O link de visualização expirou. Abra o documento novamente a partir do sistema.', 401);
      (err as any).reason = 'DOCUMENT_VIEW_TOKEN_EXPIRED';
      throw err;
    }
    if (e instanceof jwt.JsonWebTokenError) {
      const err = new AppError('Link de visualização inválido.', 401);
      (err as any).reason = 'DOCUMENT_VIEW_TOKEN_INVALID';
      throw err;
    }
    throw e;
  }
}
