import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { ativo } = req.query;
    
    const cargos = await prisma.cargo.findMany({
      where: {
        ...filter,
        ...(ativo !== undefined && { ativo: ativo === 'true' }),
      },
      orderBy: { nome: 'asc' },
    });
    
    // Convert to snake_case for frontend compatibility
    const cargosFormatted = cargos.map(cargo => ({
      id: cargo.id,
      nome: cargo.nome,
      descricao: cargo.descricao,
      tipo: cargo.tipo,
      salario_base: cargo.salarioBase,
      instituicao_id: cargo.instituicaoId,
      created_at: cargo.createdAt,
      updated_at: cargo.updatedAt,
      ativo: cargo.ativo,
    }));
    
    res.json(cargosFormatted);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify cargo exists and belongs to institution
    const cargo = await prisma.cargo.findFirst({
      where: { id, ...filter }
    });
    
    if (!cargo) {
      throw new AppError('Cargo não encontrado', 404);
    }
    
    // Convert to snake_case for frontend compatibility
    const cargoFormatted = {
      ...cargo,
      salario_base: cargo.salarioBase,
      instituicao_id: cargo.instituicaoId,
      created_at: cargo.createdAt,
      updated_at: cargo.updatedAt,
    };
    delete (cargoFormatted as any).salarioBase;
    delete (cargoFormatted as any).instituicaoId;
    delete (cargoFormatted as any).createdAt;
    delete (cargoFormatted as any).updatedAt;
    
    res.json(cargoFormatted);
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

    const { nome, descricao, tipo, salarioBase, salario_base, ativo } = req.body;
    const salarioBaseValue = salarioBase ?? salario_base;

    // Validar campos obrigatórios
    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      throw new AppError('Nome é obrigatório', 400);
    }

    // Validar tipo se fornecido
    if (tipo && !['ACADEMICO', 'ADMINISTRATIVO'].includes(tipo)) {
      throw new AppError('Tipo deve ser ACADEMICO ou ADMINISTRATIVO', 400);
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    const cargoData: any = {
      nome: nome.trim(),
      instituicaoId: req.user.instituicaoId,
      ativo: ativo !== undefined ? Boolean(ativo) : true,
      tipo: tipo || 'ADMINISTRATIVO', // Default ADMINISTRATIVO
    };

    // Adicionar campos opcionais apenas se definidos
    if (descricao !== undefined && descricao !== null && descricao !== '') {
      cargoData.descricao = descricao.trim();
    }
    if (salarioBaseValue !== undefined && salarioBaseValue !== null && salarioBaseValue !== '') {
      cargoData.salarioBase = Number(salarioBaseValue);
    }

    const cargo = await prisma.cargo.create({ data: cargoData });
    
    // Convert to snake_case for frontend compatibility
    const cargoFormatted = {
      ...cargo,
      salario_base: cargo.salarioBase,
      instituicao_id: cargo.instituicaoId,
      created_at: cargo.createdAt,
      updated_at: cargo.updatedAt,
    };
    delete (cargoFormatted as any).salarioBase;
    delete (cargoFormatted as any).instituicaoId;
    delete (cargoFormatted as any).createdAt;
    delete (cargoFormatted as any).updatedAt;
    
    res.status(201).json(cargoFormatted);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Multi-tenant: garantir que o cargo pertence à instituição do usuário
    if (!req.user?.instituicaoId) {
      throw new AppError('Usuário não possui instituição vinculada', 400);
    }

    const { id } = req.params;
    const { nome, descricao, tipo, salarioBase, salario_base, ativo } = req.body;
    const salarioBaseValue = salarioBase ?? salario_base;

    // Verificar se o cargo existe e pertence à instituição do usuário
    const existingCargo = await prisma.cargo.findFirst({
      where: { 
        id,
        instituicaoId: req.user.instituicaoId
      }
    });

    if (!existingCargo) {
      throw new AppError('Cargo não encontrado', 404);
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    const cargoData: any = {};

    if (nome !== undefined && nome !== null) {
      if (typeof nome !== 'string' || nome.trim() === '') {
        throw new AppError('Nome inválido', 400);
      }
      cargoData.nome = nome.trim();
    }
    if (descricao !== undefined && descricao !== null) {
      cargoData.descricao = descricao === '' ? null : descricao.trim();
    }
    if (tipo !== undefined && tipo !== null) {
      if (!['ACADEMICO', 'ADMINISTRATIVO'].includes(tipo)) {
        throw new AppError('Tipo deve ser ACADEMICO ou ADMINISTRATIVO', 400);
      }
      cargoData.tipo = tipo;
    }
    if (salarioBaseValue !== undefined && salarioBaseValue !== null && salarioBaseValue !== '') {
      cargoData.salarioBase = Number(salarioBaseValue);
    }
    if (ativo !== undefined) {
      cargoData.ativo = Boolean(ativo);
    }

    const cargo = await prisma.cargo.update({
      where: { id },
      data: cargoData,
    });
    
    // Convert to snake_case for frontend compatibility
    const cargoFormatted = {
      ...cargo,
      salario_base: cargo.salarioBase,
      instituicao_id: cargo.instituicaoId,
      created_at: cargo.createdAt,
      updated_at: cargo.updatedAt,
    };
    delete (cargoFormatted as any).salarioBase;
    delete (cargoFormatted as any).instituicaoId;
    delete (cargoFormatted as any).createdAt;
    delete (cargoFormatted as any).updatedAt;
    
    res.json(cargoFormatted);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify cargo exists and belongs to institution
    const existing = await prisma.cargo.findFirst({
      where: { id, ...filter }
    });
    
    if (!existing) {
      throw new AppError('Cargo não encontrado', 404);
    }
    
    // Check if cargo has funcionarios
    const funcionariosCount = await prisma.funcionario.count({
      where: { cargoId: id }
    });
    
    if (funcionariosCount > 0) {
      throw new AppError('Não é possível excluir cargo com funcionários vinculados', 400);
    }
    
    await prisma.cargo.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
