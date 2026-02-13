import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ano } = req.query;
    const instituicaoId = requireTenantScope(req);
    
    const metas = await prisma.metaFinanceira.findMany({
      where: {
        instituicaoId,
        ...(ano && { ano: parseInt(ano as string) }),
      },
      orderBy: [{ ano: 'desc' }, { mes: 'asc' }],
    });
    
    res.json(metas);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const data = req.body;
    const meta = await prisma.metaFinanceira.create({
      data: {
        ...data,
        instituicaoId,
      },
    });
    res.status(201).json(meta);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);
    const data = req.body;

    const existingMeta = await prisma.metaFinanceira.findFirst({
      where: { id, instituicaoId },
      select: { id: true },
    });

    if (!existingMeta) {
      throw new AppError('Meta financeira não encontrada', 404);
    }

    const meta = await prisma.metaFinanceira.update({
      where: { id },
      data: {
        ...data,
        instituicaoId,
      },
    });
    
    res.json(meta);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const existingMeta = await prisma.metaFinanceira.findFirst({
      where: { id, instituicaoId },
      select: { id: true },
    });

    if (!existingMeta) {
      throw new AppError('Meta financeira não encontrada', 404);
    }

    await prisma.metaFinanceira.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
