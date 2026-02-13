import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { funcionarioId, tipoAlteracao } = req.query;
    
    const historico = await prisma.historicoRh.findMany({
      where: {
        ...(funcionarioId && { funcionarioId: funcionarioId as string }),
        ...(tipoAlteracao && { tipoAlteracao: tipoAlteracao as string }),
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(historico);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    
    const historico = await prisma.historicoRh.create({
      data: {
        funcionarioId: data.funcionarioId,
        tipoAlteracao: data.tipoAlteracao,
        campoAlterado: data.campoAlterado,
        valorAnterior: data.valorAnterior,
        valorNovo: data.valorNovo,
        alteradoPor: data.alteradoPor,
        observacao: data.observacao,
      },
    });
    
    res.status(201).json(historico);
  } catch (error) {
    next(error);
  }
};
