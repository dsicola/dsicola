import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { ativo } = req.query;
    
    const where: any = { ...filter };
    if (ativo !== undefined) {
      where.ativo = ativo === 'true';
    }
    
    const bolsas = await prisma.bolsaDesconto.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
    
    res.json(bolsas);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    const bolsa = await prisma.bolsaDesconto.findFirst({
      where: { id, ...filter },
    });
    
    if (!bolsa) {
      throw new AppError('Bolsa não encontrada', 404);
    }
    
    res.json(bolsa);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // CRITICAL: Multi-tenant security - instituicaoId from token only
    const instituicaoId = requireTenantScope(req);
    
    const { nome, descricao, valor, tipo, ativo } = req.body;
    
    if (!nome) {
      throw new AppError('Nome é obrigatório', 400);
    }
    
    if (!valor && valor !== 0) {
      throw new AppError('Valor é obrigatório', 400);
    }
    
    // NUNCA permitir instituicaoId do body
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido definir instituição. Use o token de autenticação.', 400);
    }
    
    // O schema do Prisma só tem campo 'valor', então armazenamos percentual ou valor fixo em 'valor'
    // tipo indica se é PERCENTUAL ou VALOR
    const bolsa = await prisma.bolsaDesconto.create({
      data: {
        nome: nome.trim(),
        descricao: descricao || null,
        valor: Number(valor),
        tipo: tipo || 'PERCENTUAL',
        ativo: ativo !== undefined ? Boolean(ativo) : true,
        instituicaoId,
      },
    });
    
    res.status(201).json(bolsa);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verificar se bolsa existe e pertence à instituição
    const existing = await prisma.bolsaDesconto.findFirst({
      where: { id, ...filter },
    });
    
    if (!existing) {
      throw new AppError('Bolsa não encontrada', 404);
    }
    
    const { nome, descricao, valor, tipo, ativo } = req.body;
    
    // NUNCA permitir alterar instituicaoId
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição da bolsa', 400);
    }
    
    const updateData: any = {};
    if (nome !== undefined) updateData.nome = nome.trim();
    if (descricao !== undefined) updateData.descricao = descricao || null;
    if (tipo !== undefined) updateData.tipo = tipo;
    if (ativo !== undefined) updateData.ativo = Boolean(ativo);
    if (valor !== undefined) updateData.valor = Number(valor);
    
    const bolsa = await prisma.bolsaDesconto.update({
      where: { id },
      data: updateData,
    });
    
    res.json(bolsa);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verificar se bolsa existe e pertence à instituição
    const existing = await prisma.bolsaDesconto.findFirst({
      where: { id, ...filter },
    });
    
    if (!existing) {
      throw new AppError('Bolsa não encontrada', 404);
    }
    
    // Verificar se há alunos usando esta bolsa
    const alunosComBolsa = await prisma.alunoBolsa.count({
      where: { bolsaId: id },
    });
    
    if (alunosComBolsa > 0) {
      throw new AppError('Não é possível excluir bolsa com alunos vinculados', 400);
    }
    
    await prisma.bolsaDesconto.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
