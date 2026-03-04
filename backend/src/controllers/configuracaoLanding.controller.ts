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

    if (!chave || typeof chave !== 'string' || !chave.trim()) {
      throw new AppError('Chave inválida', 400);
    }
    const valorStr = valor == null ? '' : String(valor);

    const configuracao = await prisma.configuracaoLanding.upsert({
      where: { chave: chave.trim() },
      update: { valor: valorStr },
      create: { chave: chave.trim(), valor: valorStr },
    });

    res.json(configuracao);
  } catch (error) {
    next(error);
  }
};
