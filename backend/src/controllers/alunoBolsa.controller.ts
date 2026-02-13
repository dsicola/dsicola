import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { Prisma } from '@prisma/client';
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { alunoId, bolsaId, ativo } = req.query;
    
    // CRITICAL: Multi-tenant security - filter by instituicaoId
    const where: any = {};
    
    if (alunoId) where.alunoId = alunoId as string;
    if (bolsaId) where.bolsaId = bolsaId as string;
    if (ativo !== undefined) where.ativo = ativo === 'true';
    
    // Filter through aluno and bolsa to ensure tenant isolation
    if (filter.instituicaoId) {
      where.AND = [
        { aluno: { instituicaoId: filter.instituicaoId } },
        { bolsa: { instituicaoId: filter.instituicaoId } },
      ];
    }
    
    const alunoBolsas = await prisma.alunoBolsa.findMany({
      where,
      include: { aluno: true, bolsa: true },
      orderBy: { dataInicio: 'desc' },
    });
    
    res.json(alunoBolsas);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    const alunoBolsa = await prisma.alunoBolsa.findUnique({
      where: { id },
      include: { aluno: true, bolsa: true },
    });
    
    if (!alunoBolsa) {
      throw new AppError('Vínculo aluno-bolsa não encontrado', 404);
    }
    
    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId) {
      if (alunoBolsa.aluno.instituicaoId !== filter.instituicaoId || 
          alunoBolsa.bolsa.instituicaoId !== filter.instituicaoId) {
        throw new AppError('Vínculo aluno-bolsa não encontrado', 404);
      }
    }
    
    res.json(alunoBolsa);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { alunoId, bolsaId, dataInicio, dataFim, observacao, ativo } = req.body;
    
    // Validate required fields
    if (!alunoId || !bolsaId || !dataInicio) {
      throw new AppError('Aluno, bolsa e data de início são obrigatórios', 400);
    }

    // Validate date format
    if (isNaN(new Date(dataInicio).getTime())) {
      throw new AppError('Data de início inválida', 400);
    }
    if (dataFim && isNaN(new Date(dataFim).getTime())) {
      throw new AppError('Data de fim inválida', 400);
    }

    // Verificar se o aluno existe no banco de dados
    const aluno = await prisma.user.findUnique({
      where: { id: alunoId },
      include: {
        roles: { select: { role: true } },
        instituicao: { select: { id: true } },
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado', 404);
    }

    // Verificar se tem role ALUNO
    const temRoleAluno = aluno.roles.some(r => r.role === 'ALUNO');
    if (!temRoleAluno) {
      throw new AppError('Usuário não é um aluno', 400);
    }

    // Verificar instituição
    if (filter.instituicaoId && aluno.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este aluno', 403);
    }

    // Verificar se a bolsa existe
    const bolsa = await prisma.bolsaDesconto.findUnique({
      where: { id: bolsaId },
    });

    if (!bolsa) {
      throw new AppError('Bolsa não encontrada', 404);
    }

    const alunoBolsa = await prisma.alunoBolsa.create({
      data: {
        alunoId,
        bolsaId,
        dataInicio: new Date(dataInicio),
        dataFim: dataFim ? new Date(dataFim) : undefined,
        observacao: observacao || undefined,
        ativo: ativo !== undefined ? ativo : true,
      },
      include: { aluno: true, bolsa: true },
    });
    res.status(201).json(alunoBolsa);
  } catch (error) {
    // Handle Prisma unique constraint violation
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.target as string[] | undefined;
      if (target?.includes('alunoId') && target?.includes('bolsaId')) {
        throw new AppError('Esta bolsa já está aplicada a este aluno', 409);
      }
    }
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const { dataFim, observacao, ativo } = req.body;
    
    // Verificar se existe e pertence à instituição
    const existing = await prisma.alunoBolsa.findUnique({
      where: { id },
      include: { aluno: true, bolsa: true },
    });
    
    if (!existing) {
      throw new AppError('Vínculo aluno-bolsa não encontrado', 404);
    }
    
    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId) {
      if (existing.aluno.instituicaoId !== filter.instituicaoId || 
          existing.bolsa.instituicaoId !== filter.instituicaoId) {
        throw new AppError('Vínculo aluno-bolsa não encontrado', 404);
      }
    }
    
    const updateData: any = {};
    if (dataFim !== undefined) updateData.dataFim = dataFim ? new Date(dataFim) : null;
    if (observacao !== undefined) updateData.observacao = observacao || null;
    if (ativo !== undefined) updateData.ativo = ativo;
    
    const alunoBolsa = await prisma.alunoBolsa.update({
      where: { id },
      data: updateData,
      include: { aluno: true, bolsa: true },
    });
    
    res.json(alunoBolsa);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verificar se existe e pertence à instituição
    const existing = await prisma.alunoBolsa.findUnique({
      where: { id },
      include: { aluno: true, bolsa: true },
    });
    
    if (!existing) {
      throw new AppError('Vínculo aluno-bolsa não encontrado', 404);
    }
    
    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId) {
      if (existing.aluno.instituicaoId !== filter.instituicaoId || 
          existing.bolsa.instituicaoId !== filter.instituicaoId) {
        throw new AppError('Vínculo aluno-bolsa não encontrado', 404);
      }
    }
    
    await prisma.alunoBolsa.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
