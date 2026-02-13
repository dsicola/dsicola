import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configuracoes = await prisma.configuracaoLanding.findMany({
      orderBy: { chave: 'asc' },
    });
    
    res.json(configuracoes);
  } catch (error) {
    next(error);
  }
};

export const getByChave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chave } = req.params;
    const configuracao = await prisma.configuracaoLanding.findUnique({
      where: { chave },
    });
    
    if (!configuracao) {
      throw new AppError('Configuração não encontrada', 404);
    }
    
    res.json(configuracao);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chave } = req.params;
    const { valor } = req.body;
    
    const configuracao = await prisma.configuracaoLanding.upsert({
      where: { chave },
      update: { valor },
      create: { chave, valor },
    });
    
    res.json(configuracao);
  } catch (error) {
    next(error);
  }
};
