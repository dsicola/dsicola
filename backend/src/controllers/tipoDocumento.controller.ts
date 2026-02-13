import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ativo } = req.query;
    
    const tipos = await prisma.tipoDocumento.findMany({
      where: {
        ...(ativo !== undefined && { ativo: ativo === 'true' }),
      },
      orderBy: { nome: 'asc' },
    });
    
    res.json(tipos);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tipo = await prisma.tipoDocumento.findUnique({ where: { id } });
    
    if (!tipo) {
      throw new AppError('Tipo de documento não encontrado', 404);
    }
    
    res.json(tipo);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const tipo = await prisma.tipoDocumento.create({ data });
    res.status(201).json(tipo);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const tipo = await prisma.tipoDocumento.update({
      where: { id },
      data,
    });
    
    res.json(tipo);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.tipoDocumento.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
