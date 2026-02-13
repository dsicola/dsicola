import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { anoLetivo } = req.query;
    
    const trimestres = await prisma.trimestreFechado.findMany({
      where: {
        ...filter,
        ...(anoLetivo && { anoLetivo: parseInt(anoLetivo as string) }),
      },
      orderBy: [{ anoLetivo: 'desc' }, { trimestre: 'asc' }],
    });
    
    res.json(trimestres);
  } catch (error) {
    next(error);
  }
};

export const fechar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, trimestre } = req.body;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    
    const trimestreFechado = await prisma.trimestreFechado.upsert({
      where: {
        instituicaoId_anoLetivo_trimestre: {
          instituicaoId,
          anoLetivo,
          trimestre,
        },
      },
      update: {
        fechado: true,
        fechadoPor: userId,
        dataFechamento: new Date(),
      },
      create: {
        instituicaoId,
        anoLetivo,
        trimestre,
        fechado: true,
        fechadoPor: userId,
        dataFechamento: new Date(),
      },
    });
    
    res.json(trimestreFechado);
  } catch (error) {
    next(error);
  }
};

export const reabrir = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, trimestre } = req.body;
    const instituicaoId = requireTenantScope(req);
    
    const trimestreFechado = await prisma.trimestreFechado.findFirst({
      where: {
        instituicaoId,
        anoLetivo,
        trimestre,
      },
    });
    
    if (!trimestreFechado) {
      throw new AppError('Trimestre fechado não encontrado', 404);
    }
    
    const trimestreReaberto = await prisma.trimestreFechado.update({
      where: {
        id: trimestreFechado.id,
      },
      data: {
        fechado: false,
        fechadoPor: null,
        dataFechamento: null,
      },
    });
    
    res.json(trimestreReaberto);
  } catch (error) {
    next(error);
  }
};
