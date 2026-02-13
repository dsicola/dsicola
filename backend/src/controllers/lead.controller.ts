import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit } = req.query;
    
    const leads = await prisma.leadComercial.findMany({
      where: {
        ...(status && { status: status as string }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 100,
    });
    
    res.json(leads);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const lead = await prisma.leadComercial.findUnique({ where: { id } });
    
    if (!lead) {
      throw new AppError('Lead não encontrado', 404);
    }
    
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const lead = await prisma.leadComercial.create({ data });
    res.status(201).json(lead);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const lead = await prisma.leadComercial.update({
      where: { id },
      data,
    });
    
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.leadComercial.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
