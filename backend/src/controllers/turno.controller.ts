import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getTurnos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    const turnos = await prisma.turno.findMany({
      where: filter,
      orderBy: { nome: 'asc' }
    });

    res.json(turnos);
  } catch (error) {
    next(error);
  }
};

export const getTurnoById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const turno = await prisma.turno.findFirst({
      where: { id, ...filter }
    });

    if (!turno) {
      throw new AppError('Turno não encontrado', 404);
    }

    res.json(turno);
  } catch (error) {
    next(error);
  }
};

export const createTurno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // CRITICAL: Multi-tenant security - instituicaoId from token only
    if (!req.user?.instituicaoId) {
      throw new AppError('Usuário não possui instituição vinculada', 400);
    }

    const { nome, horaInicio, horaFim } = req.body;

    if (!nome) {
      throw new AppError('Nome é obrigatório', 400);
    }

    // NUNCA permitir instituicaoId do body
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido definir instituição. Use o token de autenticação.', 400);
    }

    // Check for duplicate name in institution
    const existing = await prisma.turno.findFirst({
      where: {
        nome: nome.trim(),
        instituicaoId: req.user.instituicaoId
      }
    });

    if (existing) {
      throw new AppError('Já existe um turno com este nome na instituição', 400);
    }

    const turno = await prisma.turno.create({
      data: {
        nome: nome.trim(),
        horaInicio: horaInicio || null,
        horaFim: horaFim || null,
        instituicaoId: req.user.instituicaoId
      }
    });

    res.status(201).json(turno);
  } catch (error) {
    next(error);
  }
};

export const updateTurno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const { nome, horaInicio, horaFim } = req.body;

    const existing = await prisma.turno.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Turno não encontrado', 404);
    }

    // NUNCA permitir alterar instituicaoId
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição do turno', 400);
    }

    const updateData: any = {};
    if (nome !== undefined) updateData.nome = nome.trim();
    if (horaInicio !== undefined) updateData.horaInicio = horaInicio || null;
    if (horaFim !== undefined) updateData.horaFim = horaFim || null;

    const turno = await prisma.turno.update({
      where: { id },
      data: updateData
    });

    res.json(turno);
  } catch (error) {
    next(error);
  }
};

export const deleteTurno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.turno.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Turno não encontrado', 404);
    }

    await prisma.turno.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
