import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instituicaoId, limit } = req.query;
    
    const logs = await prisma.logRedefinicaoSenha.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 100,
    });
    
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

export const getRecent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.query;
    
    const logs = await prisma.logRedefinicaoSenha.findMany({
      where: {
        ...(userId && { redefinidoPorId: userId as string }),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    
    const log = await prisma.logRedefinicaoSenha.create({
      data: {
        redefinidoPorId: data.redefinidoPorId,
        redefinidoPorEmail: data.redefinidoPorEmail,
        redefinidoPorNome: data.redefinidoPorNome,
        usuarioAfetadoId: data.usuarioAfetadoId,
        usuarioAfetadoEmail: data.usuarioAfetadoEmail,
        usuarioAfetadoNome: data.usuarioAfetadoNome,
        enviadoPorEmail: data.enviadoPorEmail || false,
        ipAddress: data.ipAddress,
      },
    });
    
    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
};
