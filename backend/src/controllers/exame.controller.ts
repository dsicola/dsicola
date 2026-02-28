import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { messages } from '../utils/messages.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { turmaId, status, planoEnsinoId: planoEnsinoIdQuery } = req.query;
    const filter = addInstitutionFilter(req);
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    const where: any = {};

    if (turmaId) {
      const turmaWhere: any = { id: turmaId as string };
      if (filter.instituicaoId) {
        turmaWhere.instituicaoId = filter.instituicaoId;
      }

      const turma = await prisma.turma.findFirst({
        where: turmaWhere,
        select: { id: true }
      });

      if (!turma) {
        if (isProfessor) return res.json([]);
        throw new AppError('Turma não encontrada ou sem permissão', 404);
      }

      where.turmaId = turma.id;

      // Professor: filtrar por plano(s) — cada professor/disciplina vê só os seus exames + globais
      if (isProfessor && professorId) {
        const planoIdFromQuery = typeof planoEnsinoIdQuery === 'string' && planoEnsinoIdQuery.trim()
          ? planoEnsinoIdQuery.trim()
          : null;

        if (planoIdFromQuery) {
          const plano = await prisma.planoEnsino.findFirst({
            where: {
              id: planoIdFromQuery,
              turmaId: turma.id,
              professorId,
              ...filter,
            },
            select: { id: true },
          });
          if (!plano) return res.json([]);
          where.OR = [
            { planoEnsinoId: null },
            { planoEnsinoId: plano.id },
          ];
        } else {
          const planos = await prisma.planoEnsino.findMany({
            where: {
              turmaId: turma.id,
              professorId,
              ...filter,
            },
            select: { id: true },
          });
          if (planos.length === 0) return res.json([]);
          const planoIds = planos.map(p => p.id);
          where.OR = [
            { planoEnsinoId: null },
            { planoEnsinoId: { in: planoIds } },
          ];
        }
      }
    } else if (isProfessor && professorId) {
      // Professor sem turmaId: turmas vêm dos PLANOS DE ENSINO (não Turma.professorId legacy)
      const planos = await prisma.planoEnsino.findMany({
        where: { professorId, ...filter },
        select: { id: true, turmaId: true },
      });
      const turmaIds = [...new Set(planos.map(p => p.turmaId).filter((id): id is string => id != null))];
      const planoIds = planos.map(p => p.id);
      if (turmaIds.length === 0) return res.json([]);
      where.turmaId = { in: turmaIds };
      where.OR = [
        { planoEnsinoId: null },
        { planoEnsinoId: { in: planoIds } },
      ];
    } else if (filter.instituicaoId) {
      // Para outros roles, filtrar por instituição através da turma
      const turmasDaInstituicao = await prisma.turma.findMany({
        where: filter,
        select: { id: true }
      });
      const turmaIds = turmasDaInstituicao.map(t => t.id);
      if (turmaIds.length === 0) {
        return res.json([]);
      }
      where.turmaId = { in: turmaIds };
    }
    
    if (status) {
      where.status = status as string;
    }
    
    const exames = await prisma.exame.findMany({
      where,
      include: { turma: true },
      orderBy: { dataExame: 'desc' },
    });
    
    res.json(exames);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Buscar exame e verificar tenant através da turma
    const exame = await prisma.exame.findUnique({
      where: { id },
      include: { 
        turma: {
          select: {
            id: true,
            nome: true,
            instituicaoId: true
          }
        },
        notas: true 
      },
    });
    
    if (!exame) {
      throw new AppError('Exame não encontrado', 404);
    }
    
    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId && exame.turma.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Exame não encontrado', 404);
    }
    
    res.json(exame);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { turmaId, planoEnsinoId: planoEnsinoIdBody, ...restData } = req.body;
    const filter = addInstitutionFilter(req);
    if (!req.professor?.id) {
      throw new AppError(messages.professor.naoIdentificado, 500);
    }
    const professorId = req.professor.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');

    if (!turmaId) {
      throw new AppError('turmaId é obrigatório', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const turmaWhere: any = { id: turmaId };
    if (filter.instituicaoId) {
      turmaWhere.instituicaoId = filter.instituicaoId;
    }

    let planoParaExame: { id: string } | null = null;
    if (isProfessor && professorId) {
      const planoIdFromBody = typeof planoEnsinoIdBody === 'string' && planoEnsinoIdBody.trim()
        ? planoEnsinoIdBody.trim()
        : null;

      if (planoIdFromBody) {
        const plano = await prisma.planoEnsino.findFirst({
          where: {
            id: planoIdFromBody,
            turmaId,
            professorId,
            ...filter,
          },
          select: { id: true },
        });
        if (!plano) {
          throw new AppError('Plano de Ensino inválido ou não pertence a esta turma/disciplina', 403);
        }
        planoParaExame = plano;
      } else {
        const planoEnsino = await prisma.planoEnsino.findFirst({
          where: {
            turmaId,
            professorId,
            ...filter,
          },
          select: { id: true },
        });
        if (!planoEnsino) {
          throw new AppError('Acesso negado: você não tem um Plano de Ensino vinculado a esta turma', 403);
        }
        planoParaExame = planoEnsino;
      }
    }

    const turma = await prisma.turma.findFirst({
      where: turmaWhere,
      include: {
        anoLetivoRef: {
          select: {
            id: true,
            ano: true,
            status: true,
          },
        },
      },
    });

    if (!turma) {
      throw new AppError('Turma não encontrada ou sem permissão', 404);
    }

    // REGRA MESTRA: Ano Letivo é contexto, não bloqueio.
    if (turma.anoLetivoId) {
      const anoLetivoStatus = await prisma.anoLetivo.findUnique({
        where: { id: turma.anoLetivoId },
        select: { status: true },
      });
      if (anoLetivoStatus?.status !== 'ATIVO') {
        console.warn(`[createExame] Ano Letivo ${turma.anoLetivoId} da turma ${turma.id} não está ATIVO. Status: ${anoLetivoStatus?.status}. Operação de criação de exame permitida, mas com aviso.`);
      }
    } else {
      console.warn(`[createExame] Turma ${turma.id} não possui ano letivo vinculado. Operação de criação de exame permitida, mas com aviso.`);
    }

    const exame = await prisma.exame.create({
      data: {
        turmaId: turma.id,
        ...(planoParaExame?.id && { planoEnsinoId: planoParaExame.id }),
        ...restData
      }
    });
    
    res.status(201).json(exame);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verificar se exame existe e pertence à instituição
    const existing = await prisma.exame.findUnique({
      where: { id },
      include: {
        turma: {
          select: {
            id: true,
            instituicaoId: true,
            professorId: true
          }
        }
      }
    });
    
    if (!existing) {
      throw new AppError('Exame não encontrado', 404);
    }
    
    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId && existing.turma.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Exame não encontrado', 404);
    }
    
    // Se for professor, verificar se a turma pertence ao professor via planos de ensino
    // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id (professores.id)
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    if (isProfessor && req.professor?.id) {
      const planoEnsino = await prisma.planoEnsino.findFirst({
        where: {
          turmaId: existing.turmaId,
          professorId: req.professor.id, // professores.id (NÃO users.id)
          ...filter,
        },
        select: { id: true },
      });

      if (!planoEnsino) {
        throw new AppError('Acesso negado: você não tem um Plano de Ensino vinculado a esta turma', 403);
      }
    }
    
    const { turmaId, ...updateData } = req.body;
    
    // Se turmaId está sendo alterado, validar
    if (turmaId && turmaId !== existing.turmaId) {
      const turmaWhere: any = { id: turmaId };
      if (filter.instituicaoId) {
        turmaWhere.instituicaoId = filter.instituicaoId;
      }

      // Se for professor, verificar se existe plano de ensino vinculando professor à nova turma
      // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id (professores.id)
      if (isProfessor && req.professor?.id) {
        const planoEnsino = await prisma.planoEnsino.findFirst({
          where: {
            turmaId: turmaId,
            professorId: req.professor.id, // professores.id (NÃO users.id)
            ...filter,
          },
          select: { id: true },
        });

        if (!planoEnsino) {
          throw new AppError('Acesso negado: você não tem um Plano de Ensino vinculado à nova turma', 403);
        }
      }
      
      const novaTurma = await prisma.turma.findFirst({
        where: turmaWhere,
        select: { id: true }
      });
      
      if (!novaTurma) {
        throw new AppError('Turma não encontrada ou sem permissão', 404);
      }
      updateData.turmaId = novaTurma.id;
    }
    
    const exame = await prisma.exame.update({
      where: { id },
      data: updateData,
      include: { turma: true }
    });
    
    res.json(exame);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verificar se exame existe e pertence à instituição
    const existing = await prisma.exame.findUnique({
      where: { id },
      include: {
        turma: {
          select: {
            id: true,
            instituicaoId: true,
            professorId: true
          }
        }
      }
    });
    
    if (!existing) {
      throw new AppError('Exame não encontrado', 404);
    }
    
    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId && existing.turma.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Exame não encontrado', 404);
    }
    
    // Se for professor, verificar se a turma pertence ao professor
    // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id (professores.id)
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    // Se for professor, verificar se a turma pertence ao professor via planos de ensino
    if (isProfessor && req.professor?.id) {
      const planoEnsino = await prisma.planoEnsino.findFirst({
        where: {
          turmaId: existing.turmaId,
          professorId: req.professor.id, // professores.id (NÃO users.id)
          ...filter,
        },
        select: { id: true },
      });

      if (!planoEnsino) {
        throw new AppError('Acesso negado: você não tem um Plano de Ensino vinculado a esta turma', 403);
      }
    }
    
    // Verificar se há notas vinculadas
    const notasCount = await prisma.nota.count({
      where: { exameId: id }
    });
    
    if (notasCount > 0) {
      throw new AppError('Não é possível excluir exame com notas vinculadas', 400);
    }
    
    await prisma.exame.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
