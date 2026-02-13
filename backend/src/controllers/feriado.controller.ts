import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { mes, ano, tipo } = req.query;
    
    const where: any = {
      ...filter,
    };
    
    // Filter by tipo if provided
    if (tipo) {
      where.tipo = tipo as string;
    }
    
    // Filter by month/year if provided
    if (mes && ano) {
      const primeiroDia = new Date(parseInt(ano as string), parseInt(mes as string) - 1, 1);
      const ultimoDia = new Date(parseInt(ano as string), parseInt(mes as string), 0, 23, 59, 59);
      
      where.data = {
        gte: primeiroDia,
        lte: ultimoDia,
      };
    }
    
    const feriados = await prisma.feriado.findMany({
      where,
      orderBy: { data: 'asc' },
    });
    
    // Convert to snake_case for frontend compatibility
    const formatted = feriados.map(feriado => ({
      id: feriado.id,
      nome: feriado.nome,
      data: feriado.data.toISOString().split('T')[0],
      tipo: feriado.tipo,
      instituicao_id: feriado.instituicaoId,
      created_at: feriado.createdAt,
      updated_at: feriado.updatedAt,
    }));
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    const feriado = await prisma.feriado.findUnique({
      where: { id },
    });
    
    if (!feriado) {
      throw new AppError('Feriado não encontrado', 404);
    }
    
    // Check institution access (feriados nacionais podem ser acessados por todos)
    if (feriado.instituicaoId && filter.instituicaoId && feriado.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este feriado', 403);
    }
    
    // Convert to snake_case
    const formatted = {
      id: feriado.id,
      nome: feriado.nome,
      data: feriado.data.toISOString().split('T')[0],
      tipo: feriado.tipo,
      instituicao_id: feriado.instituicaoId,
      created_at: feriado.createdAt,
      updated_at: feriado.updatedAt,
    };
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    
    const {
      nome,
      data,
      tipo = 'NACIONAL',
    } = req.body;
    
    // CRITICAL: Multi-tenant security - NUNCA aceitar instituicaoId do body
    const { instituicao_id, instituicaoId, ...cleanBody } = req.body;
    if (instituicaoId !== undefined || instituicao_id !== undefined) {
      throw new AppError('Não é permitido definir instituição. Use o token de autenticação.', 400);
    }
    
    if (!nome || !data) {
      throw new AppError('Nome e data são obrigatórios', 400);
    }
    
    // Validar tipo
    if (tipo !== 'NACIONAL' && tipo !== 'INSTITUCIONAL') {
      throw new AppError('Tipo inválido. Use: NACIONAL ou INSTITUCIONAL', 400);
    }
    
    // Se for feriado nacional, instituicaoId deve ser null
    // Se for feriado institucional, usar instituicaoId do token
    const finalInstituicaoId = tipo === 'NACIONAL' 
      ? null 
      : getInstituicaoIdFromFilter(filter) ?? null;
    
    if (tipo === 'INSTITUCIONAL' && !finalInstituicaoId) {
      throw new AppError('Feriados institucionais devem ter uma instituição associada. Usuário não possui instituição vinculada.', 400);
    }
    
    // Verificar se já existe feriado na mesma data para a mesma instituição
    const dataInicio = new Date(data);
    dataInicio.setHours(0, 0, 0, 0);
    const dataFim = new Date(data);
    dataFim.setHours(23, 59, 59, 999);
    
    const existing = await prisma.feriado.findFirst({
      where: {
        data: {
          gte: dataInicio,
          lte: dataFim,
        },
        instituicaoId: finalInstituicaoId || null,
      },
    });
    
    if (existing) {
      throw new AppError('Já existe um feriado cadastrado para esta data', 409);
    }
    
    const feriado = await prisma.feriado.create({
      data: {
        nome,
        data: new Date(data),
        tipo,
        instituicaoId: finalInstituicaoId,
      },
    });
    
    // Convert to snake_case
    const formatted = {
      id: feriado.id,
      nome: feriado.nome,
      data: feriado.data.toISOString().split('T')[0],
      tipo: feriado.tipo,
      instituicao_id: feriado.instituicaoId,
      created_at: feriado.createdAt,
      updated_at: feriado.updatedAt,
    };
    
    res.status(201).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Check if feriado exists
    const existing = await prisma.feriado.findUnique({
      where: { id },
    });
    
    if (!existing) {
      throw new AppError('Feriado não encontrado', 404);
    }
    
    // Check institution access
    if (existing.instituicaoId && filter.instituicaoId && existing.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este feriado', 403);
    }
    
    // CRITICAL: Multi-tenant security - NUNCA aceitar instituicaoId do body
    const { instituicao_id, instituicaoId, ...bodyData } = req.body;
    if (instituicaoId !== undefined || instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição do feriado', 400);
    }
    
    const {
      nome,
      data,
      tipo,
    } = bodyData;
    
    const updateData: any = {};
    
    if (nome !== undefined) {
      updateData.nome = nome;
    }
    
    if (data !== undefined) {
      updateData.data = new Date(data);
      
      // Verificar se já existe outro feriado na nova data
      const dataInicio = new Date(data);
      dataInicio.setHours(0, 0, 0, 0);
      const dataFim = new Date(data);
      dataFim.setHours(23, 59, 59, 999);
      
      const existingData = await prisma.feriado.findFirst({
        where: {
          id: { not: id },
          data: {
            gte: dataInicio,
            lte: dataFim,
          },
          instituicaoId: existing.instituicaoId || null,
        },
      });
      
      if (existingData) {
        throw new AppError('Já existe um feriado cadastrado para esta data', 409);
      }
    }
    
    if (tipo !== undefined) {
      if (tipo !== 'NACIONAL' && tipo !== 'INSTITUCIONAL') {
        throw new AppError('Tipo inválido. Use: NACIONAL ou INSTITUCIONAL', 400);
      }
      updateData.tipo = tipo;
      
      // Se mudou para nacional, remover instituicaoId
      if (tipo === 'NACIONAL') {
        updateData.instituicaoId = null;
      } else if (tipo === 'INSTITUCIONAL') {
        // Se mudou para institucional, usar instituicaoId do token
        if (!filter.instituicaoId) {
          throw new AppError('Feriados institucionais devem ter uma instituição associada. Usuário não possui instituição vinculada.', 400);
        }
        updateData.instituicaoId = filter.instituicaoId;
      }
    }
    
    const feriado = await prisma.feriado.update({
      where: { id },
      data: updateData,
    });
    
    // Convert to snake_case
    const formatted = {
      id: feriado.id,
      nome: feriado.nome,
      data: feriado.data.toISOString().split('T')[0],
      tipo: feriado.tipo,
      instituicao_id: feriado.instituicaoId,
      created_at: feriado.createdAt,
      updated_at: feriado.updatedAt,
    };
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Check if feriado exists
    const existing = await prisma.feriado.findUnique({
      where: { id },
    });
    
    if (!existing) {
      throw new AppError('Feriado não encontrado', 404);
    }
    
    // Check institution access
    if (existing.instituicaoId && filter.instituicaoId && existing.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este feriado', 403);
    }
    
    await prisma.feriado.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

