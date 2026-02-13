import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

// Get all responsavel-aluno relationships
export const getAll = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { responsavelId, alunoId } = req.query;

    // CRITICAL: Multi-tenant - filtrar por instituição através do aluno
    const where: any = {};
    
    if (filter.instituicaoId) {
      where.aluno = { instituicaoId: filter.instituicaoId };
    }
    
    if (responsavelId) {
      // Verificar se responsável pertence à instituição
      if (filter.instituicaoId) {
        const responsavel = await prisma.user.findFirst({
          where: { id: responsavelId as string, instituicaoId: filter.instituicaoId },
          select: { id: true },
        });
        if (!responsavel) {
          return res.json([]);
        }
      }
      where.responsavelId = responsavelId as string;
    }
    
    if (alunoId) {
      // Verificar se aluno pertence à instituição
      if (filter.instituicaoId) {
        const aluno = await prisma.user.findFirst({
          where: { id: alunoId as string, instituicaoId: filter.instituicaoId },
          select: { id: true },
        });
        if (!aluno) {
          return res.json([]);
        }
      }
      where.alunoId = alunoId as string;
    }

    const vinculos = await prisma.responsavelAluno.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(vinculos);
  } catch (error) {
    next(error);
  }
};

// Get alunos vinculados to a responsavel
export const getAlunosVinculados = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { responsavelId } = req.params;

    // CRITICAL: Verificar se responsável pertence à instituição
    if (filter.instituicaoId) {
      const responsavel = await prisma.user.findFirst({
        where: { id: responsavelId, instituicaoId: filter.instituicaoId },
        select: { id: true },
      });
      if (!responsavel) {
        return res.json([]);
      }
    }

    const vinculos = await prisma.responsavelAluno.findMany({
      where: { responsavelId },
      orderBy: { createdAt: 'desc' },
    });

    // Get aluno details - CRITICAL: filtrar por instituição
    const alunoIds = vinculos.map(v => v.alunoId);
    const alunoWhere: any = { id: { in: alunoIds } };
    if (filter.instituicaoId) {
      alunoWhere.instituicaoId = filter.instituicaoId;
    }
    
    const alunos = await prisma.user.findMany({
      where: alunoWhere,
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        numeroIdentificacaoPublica: true,
      },
    });

    res.json(alunos);
  } catch (error) {
    next(error);
  }
};

// Create vinculation
export const create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { responsavelId, alunoId, parentesco, principal } = req.body;

    // CRITICAL: Multi-tenant - verificar se responsável e aluno pertencem à mesma instituição
    if (filter.instituicaoId) {
      const [responsavel, aluno] = await Promise.all([
        prisma.user.findFirst({
          where: { id: responsavelId, instituicaoId: filter.instituicaoId },
          select: { id: true },
        }),
        prisma.user.findFirst({
          where: { id: alunoId, instituicaoId: filter.instituicaoId },
          select: { id: true },
        }),
      ]);

      if (!responsavel || !aluno) {
        throw new AppError('Responsável ou aluno não encontrado ou não pertence à sua instituição', 404);
      }
    }

    const vinculo = await prisma.responsavelAluno.create({
      data: {
        responsavelId,
        alunoId,
        parentesco,
        principal: principal || false,
      },
    });

    res.status(201).json(vinculo);
  } catch (error) {
    next(error);
  }
};

// Update vinculation
export const update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;
    const data = req.body;

    // CRITICAL: Verificar se vínculo pertence à instituição (ResponsavelAluno não tem relação aluno)
    const vinculoExistente = await prisma.responsavelAluno.findUnique({ where: { id } });

    if (!vinculoExistente) {
      throw new AppError('Vínculo não encontrado', 404);
    }

    const aluno = await prisma.user.findFirst({
      where: { id: vinculoExistente.alunoId },
      select: { instituicaoId: true },
    });
    if (filter.instituicaoId && aluno?.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Vínculo não pertence à sua instituição', 403);
    }

    // Se está atualizando alunoId ou responsavelId, verificar multi-tenant
    if ((data.alunoId || data.responsavelId) && filter.instituicaoId) {
      if (data.alunoId) {
        const aluno = await prisma.user.findFirst({
          where: { id: data.alunoId, instituicaoId: filter.instituicaoId },
          select: { id: true },
        });
        if (!aluno) {
          throw new AppError('Aluno não pertence à sua instituição', 403);
        }
      }
      if (data.responsavelId) {
        const responsavel = await prisma.user.findFirst({
          where: { id: data.responsavelId, instituicaoId: filter.instituicaoId },
          select: { id: true },
        });
        if (!responsavel) {
          throw new AppError('Responsável não pertence à sua instituição', 403);
        }
      }
    }

    const vinculo = await prisma.responsavelAluno.update({
      where: { id },
      data,
    });

    res.json(vinculo);
  } catch (error) {
    next(error);
  }
};

// Delete vinculation
export const remove = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;

    // CRITICAL: Verificar se vínculo pertence à instituição (ResponsavelAluno não tem relação aluno)
    const vinculoExistente = await prisma.responsavelAluno.findUnique({ where: { id } });

    if (!vinculoExistente) {
      throw new AppError('Vínculo não encontrado', 404);
    }

    const aluno = await prisma.user.findFirst({
      where: { id: vinculoExistente.alunoId },
      select: { instituicaoId: true },
    });
    if (filter.instituicaoId && aluno?.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Vínculo não pertence à sua instituição', 403);
    }

    await prisma.responsavelAluno.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
