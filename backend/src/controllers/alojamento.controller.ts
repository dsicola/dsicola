import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { status } = req.query;
    
    const alojamentos = await prisma.alojamento.findMany({
      where: {
        ...filter,
        ...(status && { status: status as any }),
      },
      orderBy: { nomeBloco: 'asc' },
    });
    
    res.json(alojamentos);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify alojamento exists and belongs to institution
    const alojamento = await prisma.alojamento.findFirst({
      where: { id, ...filter },
      include: { alocacoes: true },
    });
    
    if (!alojamento) {
      throw new AppError('Alojamento não encontrado', 404);
    }
    
    res.json(alojamento);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    const { instituicaoId: bodyInstituicaoId, instituicao_id, ...bodyData } = req.body;
    
    // Determine which instituicaoId to use
    let finalInstituicaoId: string | undefined;
    
    // SUPER_ADMIN can provide instituicaoId in body, or use their own if they have one
    if (req.user.roles.includes('SUPER_ADMIN')) {
      finalInstituicaoId = bodyInstituicaoId || instituicao_id || req.user.instituicaoId || undefined;
      
      // If SUPER_ADMIN provided instituicaoId, validate it exists
      if (finalInstituicaoId) {
        const instituicao = await prisma.instituicao.findUnique({
          where: { id: finalInstituicaoId }
        });
        if (!instituicao) {
          throw new AppError('Instituição não encontrada', 404);
        }
      }
    } else {
      // Regular users: SEMPRE usar instituicaoId do usuário autenticado, nunca do body
      if (!req.user.instituicaoId) {
        throw new AppError('Usuário não possui instituição vinculada', 400);
      }
      finalInstituicaoId = req.user.instituicaoId;
    }

    // Build data object, filtering undefined values
    const data: any = {
      ...bodyData,
      ...(finalInstituicaoId && { instituicaoId: finalInstituicaoId }),
    };

    // Filter out undefined values
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });

    const alojamento = await prisma.alojamento.create({ data });
    res.status(201).json(alojamento);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify alojamento exists and belongs to institution
    const existing = await prisma.alojamento.findFirst({
      where: { id, ...filter }
    });
    
    if (!existing) {
      throw new AppError('Alojamento não encontrado', 404);
    }

    // Remove fields that shouldn't be updated
    const { instituicaoId, instituicao_id, id: _, ...updateData } = req.body;
    
    // Filter out undefined values
    const data: any = {};
    Object.keys(updateData).forEach(key => {
      const value = updateData[key];
      if (value !== undefined && value !== null && value !== '') {
        data[key] = value;
      }
    });
    
    const alojamento = await prisma.alojamento.update({
      where: { id },
      data,
    });
    
    res.json(alojamento);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify alojamento exists and belongs to institution
    const existing = await prisma.alojamento.findFirst({
      where: { id, ...filter }
    });
    
    if (!existing) {
      throw new AppError('Alojamento não encontrado', 404);
    }
    
    // Check if has dependencies (alocacoes)
    const alocacoesCount = await prisma.alocacaoAlojamento.count({
      where: { alojamentoId: id }
    });
    
    if (alocacoesCount > 0) {
      throw new AppError('Não é possível excluir alojamento com alocações vinculadas', 400);
    }
    
    await prisma.alojamento.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
