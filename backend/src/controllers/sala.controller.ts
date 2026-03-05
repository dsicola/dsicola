import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getSalas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    const salas = await prisma.sala.findMany({
      where: filter,
      orderBy: { nome: 'asc' },
      include: { campus: { select: { id: true, nome: true } } },
    });

    res.json(salas);
  } catch (error) {
    next(error);
  }
};

export const getSalaById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const sala = await prisma.sala.findFirst({
      where: { id, ...filter },
    });

    if (!sala) {
      throw new AppError('Sala não encontrada', 404);
    }

    res.json(sala);
  } catch (error) {
    next(error);
  }
};

export const createSala = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.instituicaoId) {
      throw new AppError('Usuário não possui instituição vinculada', 400);
    }

    const { nome, capacidade, campusId } = req.body;

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      throw new AppError('Nome é obrigatório', 400);
    }

    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido definir instituição. Use o token de autenticação.', 400);
    }

    if (campusId) {
      const campus = await prisma.campus.findFirst({
        where: { id: campusId, instituicaoId: req.user.instituicaoId },
      });
      if (!campus) {
        throw new AppError('Campus não encontrado ou não pertence à sua instituição', 400);
      }
    }

    const existing = await prisma.sala.findFirst({
      where: {
        nome: nome.trim(),
        instituicaoId: req.user.instituicaoId,
      },
    });

    if (existing) {
      throw new AppError('Já existe uma sala com este nome na instituição', 400);
    }

    const sala = await prisma.sala.create({
      data: {
        nome: nome.trim(),
        capacidade: capacidade != null && Number.isFinite(Number(capacidade)) ? Number(capacidade) : null,
        instituicaoId: req.user.instituicaoId,
        campusId: campusId || null,
      },
    });

    res.status(201).json(sala);
  } catch (error) {
    next(error);
  }
};

export const updateSala = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const { nome, capacidade, ativa, campusId } = req.body;

    const existing = await prisma.sala.findFirst({
      where: { id, ...filter },
    });

    if (!existing) {
      throw new AppError('Sala não encontrada', 404);
    }

    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição da sala', 400);
    }

    if (campusId !== undefined && campusId !== null) {
      const instituicaoId = req.user?.instituicaoId ?? undefined;
      if (!instituicaoId) throw new AppError('Usuário sem instituição associada', 403);
      const campus = await prisma.campus.findFirst({
        where: { id: String(campusId), instituicaoId },
      });
      if (!campus) {
        throw new AppError('Campus não encontrado ou não pertence à sua instituição', 400);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (nome !== undefined) updateData.nome = nome.trim();
    if (capacidade !== undefined) updateData.capacidade = capacidade != null && Number.isFinite(Number(capacidade)) ? Number(capacidade) : null;
    if (ativa !== undefined) updateData.ativa = Boolean(ativa);
    if (campusId !== undefined) updateData.campusId = campusId || null;

    const sala = await prisma.sala.update({
      where: { id },
      data: updateData,
    });

    res.json(sala);
  } catch (error) {
    next(error);
  }
};

export const deleteSala = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.sala.findFirst({
      where: { id, ...filter },
    });

    if (!existing) {
      throw new AppError('Sala não encontrada', 404);
    }

    await prisma.sala.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
