/**
 * Validadores para chat - Zod
 */
import { z } from 'zod';

export const createThreadSchema = z.object({
  tipo: z.enum(['DISCIPLINA', 'DIRECT']),
  disciplinaId: z.string().uuid().optional(),
  targetUserId: z.string().uuid().optional(),
}).refine(
  (data) => {
    if (data.tipo === 'DISCIPLINA') return !!data.disciplinaId;
    if (data.tipo === 'DIRECT') return !!data.targetUserId;
    return true;
  },
  { message: 'disciplinaId obrigatório para DISCIPLINA. targetUserId obrigatório para DIRECT.' }
);

export const sendMessageSchema = z.object({
  content: z.string().max(2000, 'Máximo 2000 caracteres').default(''),
  attachments: z.array(z.object({
    url: z.string(),
    type: z.string().optional(),
    name: z.string().optional(),
    size: z.number().optional(),
  })).optional(),
}).refine(
  (data) => data.content.trim().length >= 1 || (data.attachments && data.attachments.length > 0),
  { message: 'Informe um texto ou anexe pelo menos um arquivo (foto, PDF ou vídeo).' }
);

export const getMessagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});
