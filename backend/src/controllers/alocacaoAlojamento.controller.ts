import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId, alojamentoId, status, instituicaoId } = req.query;
    
    const alocacoes = await prisma.alocacaoAlojamento.findMany({
      where: {
        ...(alunoId && { alunoId: alunoId as string }),
        ...(alojamentoId && { alojamentoId: alojamentoId as string }),
        ...(status && { status: status as any }),
        ...(instituicaoId && { alojamento: { instituicaoId: instituicaoId as string } }),
      },
      include: { aluno: true, alojamento: true },
      orderBy: { dataEntrada: 'desc' },
    });
    
    res.json(alocacoes);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const alocacao = await prisma.alocacaoAlojamento.findUnique({
      where: { id },
      include: { aluno: true, alojamento: true },
    });
    
    if (!alocacao) {
      throw new AppError('Alocação não encontrada', 404);
    }
    
    res.json(alocacao);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const alocacao = await prisma.alocacaoAlojamento.create({
      data,
      include: { aluno: true, alojamento: true },
    });
    res.status(201).json(alocacao);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const alocacao = await prisma.alocacaoAlojamento.update({
      where: { id },
      data,
      include: { aluno: true, alojamento: true },
    });
    
    res.json(alocacao);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.alocacaoAlojamento.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
