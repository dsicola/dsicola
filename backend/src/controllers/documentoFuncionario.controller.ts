import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { funcionarioId } = req.query;
    
    const documentos = await prisma.documentoFuncionario.findMany({
      where: {
        ...(funcionarioId && { funcionarioId: funcionarioId as string }),
      },
      include: { funcionario: true },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(documentos);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const documento = await prisma.documentoFuncionario.findUnique({
      where: { id },
      include: { funcionario: true },
    });
    
    if (!documento) {
      throw new AppError('Documento não encontrado', 404);
    }
    
    res.json(documento);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const documento = await prisma.documentoFuncionario.create({ data });
    res.status(201).json(documento);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.documentoFuncionario.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
