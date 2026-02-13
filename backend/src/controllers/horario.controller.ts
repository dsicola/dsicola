import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { turmaId } = req.query;
    const filter = addInstitutionFilter(req);
    
    // MULTI-TENANT: Filtrar horários através das turmas da instituição
    const where: any = {};
    
    if (turmaId) {
      // Verificar se a turma pertence à instituição antes de incluir no filtro
      const turma = await prisma.turma.findFirst({
        where: {
          id: turmaId as string,
          ...filter
        },
        select: { id: true }
      });
      
      if (!turma) {
        // Turma não pertence à instituição ou não existe
        return res.json([]);
      }
      
      where.turmaId = turmaId as string;
    } else {
      // Se não especificou turma, filtrar por turmas da instituição
      const turmas = await prisma.turma.findMany({
        where: filter,
        select: { id: true }
      });
      
      const turmaIds = turmas.map(t => t.id);
      if (turmaIds.length === 0) {
        return res.json([]);
      }
      
      where.turmaId = { in: turmaIds };
    }
    
    const horarios = await prisma.horario.findMany({
      where,
      include: { turma: true },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });
    
    res.json(horarios);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    const horario = await prisma.horario.findUnique({
      where: { id },
      include: { turma: true },
    });
    
    if (!horario) {
      throw new AppError('Horário não encontrado', 404);
    }
    
    // MULTI-TENANT: Verificar se a turma do horário pertence à instituição
    const turma = await prisma.turma.findFirst({
      where: {
        id: horario.turmaId,
        ...filter
      },
      select: { id: true }
    });
    
    if (!turma) {
      throw new AppError('Horário não encontrado ou acesso negado', 404);
    }
    
    res.json(horario);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { turmaId, ...horarioData } = req.body;
    
    if (!turmaId) {
      throw new AppError('TurmaId é obrigatório', 400);
    }
    
    // REGRA MESTRA: Verificar se a turma pertence à instituição e tem ano letivo ATIVO
    const instituicaoId = requireTenantScope(req);
    const turma = await prisma.turma.findFirst({
      where: {
        id: turmaId,
        ...filter
      },
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
      throw new AppError('Turma não encontrada ou acesso negado', 404);
    }

    // REGRA MESTRA: Ano Letivo é contexto, não bloqueio.
    if (turma.anoLetivoId) {
      const anoLetivoStatus = await prisma.anoLetivo.findUnique({
        where: { id: turma.anoLetivoId },
        select: { status: true },
      });
      if (anoLetivoStatus?.status !== 'ATIVO') {
        console.warn(`[createHorario] Ano Letivo ${turma.anoLetivoId} da turma ${turma.id} não está ATIVO. Status: ${anoLetivoStatus?.status}. Operação de criação de horário permitida, mas com aviso.`);
      }
    } else {
      console.warn(`[createHorario] Turma ${turma.id} não possui ano letivo vinculado. Operação de criação de horário permitida, mas com aviso.`);
    }
    
    // NUNCA permitir alterar instituicaoId (não existe no modelo, mas proteger turmaId)
    if (req.body.instituicaoId !== undefined) {
      throw new AppError('Não é permitido definir instituição. Use o token de autenticação.', 400);
    }
    
    const horario = await prisma.horario.create({
      data: {
        ...horarioData,
        turmaId
      }
    });
    
    res.status(201).json(horario);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const { turmaId, ...updateData } = req.body;
    
    // MULTI-TENANT: Verificar se o horário pertence à instituição
    const horario = await prisma.horario.findUnique({
      where: { id },
      include: { turma: true }
    });
    
    if (!horario) {
      throw new AppError('Horário não encontrado', 404);
    }
    
    const turma = await prisma.turma.findFirst({
      where: {
        id: horario.turmaId,
        ...filter
      },
      select: { id: true }
    });
    
    if (!turma) {
      throw new AppError('Horário não encontrado ou acesso negado', 404);
    }
    
    // Se está tentando mudar a turma, verificar se a nova turma também pertence à instituição
    if (turmaId && turmaId !== horario.turmaId) {
      const novaTurma = await prisma.turma.findFirst({
        where: {
          id: turmaId,
          ...filter
        },
        select: { id: true }
      });
      
      if (!novaTurma) {
        throw new AppError('Nova turma não encontrada ou acesso negado', 404);
      }
      
      updateData.turmaId = turmaId;
    }
    
    // NUNCA permitir alterar instituicaoId
    if (req.body.instituicaoId !== undefined) {
      throw new AppError('Não é permitido alterar a instituição do horário', 400);
    }
    
    const updatedHorario = await prisma.horario.update({
      where: { id },
      data: updateData,
      include: { turma: true }
    });
    
    res.json(updatedHorario);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // MULTI-TENANT: Verificar se o horário pertence à instituição antes de deletar
    const horario = await prisma.horario.findUnique({
      where: { id },
      select: { id: true, turmaId: true }
    });
    
    if (!horario) {
      throw new AppError('Horário não encontrado', 404);
    }
    
    const turma = await prisma.turma.findFirst({
      where: {
        id: horario.turmaId,
        ...filter
      },
      select: { id: true }
    });
    
    if (!turma) {
      throw new AppError('Horário não encontrado ou acesso negado', 404);
    }
    
    await prisma.horario.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
