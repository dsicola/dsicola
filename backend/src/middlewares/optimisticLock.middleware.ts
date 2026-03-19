/**
 * Middleware de optimistic locking (resolução de conflitos).
 * Quando o cliente envia _expectedUpdatedAt no body, verifica se o registo
 * não foi alterado por outro utilizador. Se foi, retorna 409 Conflict.
 *
 * Uso: router.put('/:id', optionalOptimisticLock('user'), controller.update);
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from './errorHandler.js';

type PrismaModel = keyof typeof prisma;

export function optionalOptimisticLock(modelName: PrismaModel, idParam = 'id') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const expected = (req.body as Record<string, unknown>)?._expectedUpdatedAt;
    if (!expected || typeof expected !== 'string') return next();

    const id = req.params[idParam];
    if (!id) return next();

    try {
      const model = (prisma as any)[modelName];
      const row = await model?.findUnique?.({
        where: { id },
        select: { updatedAt: true },
      });
      if (!row) return next();
      const serverUpdated = row.updatedAt?.toISOString?.() ?? '';
      const clientExpected = new Date(expected).toISOString();
      if (serverUpdated !== clientExpected) {
        throw new AppError(
          'O registo foi alterado por outro utilizador. Recarregue e tente novamente.',
          409
        );
      }
      delete (req.body as Record<string, unknown>)._expectedUpdatedAt;
      next();
    } catch (err) {
      if (err instanceof AppError) next(err);
      else next(err);
    }
  };
}
