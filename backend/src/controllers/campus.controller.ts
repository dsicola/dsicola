import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';

export const getCampus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    const campus = await prisma.campus.findMany({
      where: filter,
      orderBy: { nome: 'asc' },
    });

    res.json(campus);
  } catch (error) {
    next(error);
  }
};

export const getCampusById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const campus = await prisma.campus.findFirst({
      where: { id, ...filter },
    });

    if (!campus) {
      throw new AppError('Campus não encontrado', 404);
    }

    res.json(campus);
  } catch (error) {
    next(error);
  }
};

export const createCampus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);

    const { nome, codigo, endereco, telefone } = req.body;

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      throw new AppError('Nome é obrigatório', 400);
    }

    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido definir instituição. Use o token de autenticação.', 400);
    }

    // Validação: 2º+ campus exige plano multiCampus e config multiCampus
    const campusCount = await prisma.campus.count({ where: { instituicaoId } });
    const config = await prisma.configuracaoInstituicao.findUnique({
      where: { instituicaoId },
      select: { multiCampus: true },
    });
    const { canCreateCampus } = await import('../services/planFeatures.service.js');
    await canCreateCampus(
      instituicaoId,
      campusCount,
      config?.multiCampus ?? false,
      req.user?.roles
    );

    const existing = await prisma.campus.findFirst({
      where: {
        nome: nome.trim(),
        instituicaoId,
      },
    });

    if (existing) {
      throw new AppError('Já existe um campus com este nome na instituição', 400);
    }

    const campus = await prisma.campus.create({
      data: {
        nome: nome.trim(),
        codigo: codigo?.trim() || null,
        endereco: endereco?.trim() || null,
        telefone: telefone?.trim() || null,
        instituicaoId,
      },
    });

    res.status(201).json(campus);
  } catch (error) {
    next(error);
  }
};

export const updateCampus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const { nome, codigo, endereco, telefone, ativo } = req.body;

    const existing = await prisma.campus.findFirst({
      where: { id, ...filter },
    });

    if (!existing) {
      throw new AppError('Campus não encontrado', 404);
    }

    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição do campus', 400);
    }

    const updateData: Record<string, unknown> = {};
    if (nome !== undefined) updateData.nome = nome.trim();
    if (codigo !== undefined) updateData.codigo = codigo?.trim() || null;
    if (endereco !== undefined) updateData.endereco = endereco?.trim() || null;
    if (telefone !== undefined) updateData.telefone = telefone?.trim() || null;
    if (ativo !== undefined) updateData.ativo = Boolean(ativo);

    const campus = await prisma.campus.update({
      where: { id },
      data: updateData,
    });

    res.json(campus);
  } catch (error) {
    next(error);
  }
};

export const deleteCampus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.campus.findFirst({
      where: { id, ...filter },
    });

    if (!existing) {
      throw new AppError('Campus não encontrado', 404);
    }

    await prisma.campus.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
