import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { ativo } = req.query;
    
    const departamentos = await prisma.departamento.findMany({
      where: {
        ...filter,
        ...(ativo !== undefined && { ativo: ativo === 'true' }),
      },
      orderBy: { nome: 'asc' },
    });
    
    // Convert to snake_case for frontend compatibility
    const departamentosFormatted = departamentos.map(dept => ({
      id: dept.id,
      nome: dept.nome,
      descricao: dept.descricao,
      ativo: dept.ativo,
      instituicao_id: dept.instituicaoId,
      created_at: dept.createdAt,
      updated_at: dept.updatedAt,
    }));
    
    res.json(departamentosFormatted);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify departamento exists and belongs to institution
    const departamento = await prisma.departamento.findFirst({
      where: { id, ...filter }
    });
    
    if (!departamento) {
      throw new AppError('Departamento não encontrado', 404);
    }
    
    // Convert to snake_case for frontend compatibility
    const departamentoFormatted = {
      id: departamento.id,
      nome: departamento.nome,
      descricao: departamento.descricao,
      ativo: departamento.ativo,
      instituicao_id: departamento.instituicaoId,
      created_at: departamento.createdAt,
      updated_at: departamento.updatedAt,
    };
    
    res.json(departamentoFormatted);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Multi-tenant: SEMPRE usar instituicaoId do usuário autenticado, nunca do body
    if (!req.user?.instituicaoId) {
      throw new AppError('Usuário não possui instituição vinculada', 400);
    }

    const { nome, descricao, ativo } = req.body;

    // Validar campos obrigatórios
    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      throw new AppError('Nome é obrigatório', 400);
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    const departamentoData: any = {
      nome: nome.trim(),
      instituicaoId: req.user.instituicaoId,
      ativo: ativo !== undefined ? Boolean(ativo) : true,
    };

    // Adicionar campos opcionais apenas se definidos
    if (descricao !== undefined && descricao !== null && descricao !== '') {
      departamentoData.descricao = descricao.trim();
    }

    const departamento = await prisma.departamento.create({ data: departamentoData });
    
    // Convert to snake_case for frontend compatibility
    const departamentoFormatted = {
      id: departamento.id,
      nome: departamento.nome,
      descricao: departamento.descricao,
      ativo: departamento.ativo,
      instituicao_id: departamento.instituicaoId,
      created_at: departamento.createdAt,
      updated_at: departamento.updatedAt,
    };
    
    res.status(201).json(departamentoFormatted);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Multi-tenant: garantir que o departamento pertence à instituição do usuário
    if (!req.user?.instituicaoId) {
      throw new AppError('Usuário não possui instituição vinculada', 400);
    }

    const { id } = req.params;
    const { nome, descricao, ativo } = req.body;

    // Verificar se o departamento existe e pertence à instituição do usuário
    const existingDepartamento = await prisma.departamento.findFirst({
      where: { 
        id,
        instituicaoId: req.user.instituicaoId
      }
    });

    if (!existingDepartamento) {
      throw new AppError('Departamento não encontrado', 404);
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    const departamentoData: any = {};

    if (nome !== undefined && nome !== null) {
      if (typeof nome !== 'string' || nome.trim() === '') {
        throw new AppError('Nome inválido', 400);
      }
      departamentoData.nome = nome.trim();
    }
    if (descricao !== undefined && descricao !== null) {
      departamentoData.descricao = descricao === '' ? null : descricao.trim();
    }
    if (ativo !== undefined) {
      departamentoData.ativo = Boolean(ativo);
    }

    const departamento = await prisma.departamento.update({
      where: { id },
      data: departamentoData,
    });
    
    // Convert to snake_case for frontend compatibility
    const departamentoFormatted = {
      id: departamento.id,
      nome: departamento.nome,
      descricao: departamento.descricao,
      ativo: departamento.ativo,
      instituicao_id: departamento.instituicaoId,
      created_at: departamento.createdAt,
      updated_at: departamento.updatedAt,
    };
    
    res.json(departamentoFormatted);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify departamento exists and belongs to institution
    const existing = await prisma.departamento.findFirst({
      where: { id, ...filter }
    });
    
    if (!existing) {
      throw new AppError('Departamento não encontrado', 404);
    }
    
    // Check if departamento has funcionarios
    const funcionariosCount = await prisma.funcionario.count({
      where: { departamentoId: id }
    });
    
    if (funcionariosCount > 0) {
      throw new AppError('Não é possível excluir departamento com funcionários vinculados', 400);
    }
    
    await prisma.departamento.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
