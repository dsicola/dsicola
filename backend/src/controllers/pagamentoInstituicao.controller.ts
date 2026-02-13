import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { status, dataInicio, dataFim } = req.query;
    
    // Always use filter from req.user - ignore instituicaoId from query (multi-tenant security)
    const where: any = { ...filter };
    
    if (status) {
      where.status = status as string;
    }
    
    if (dataInicio && dataFim) {
      where.dataVencimento = {
        gte: new Date(dataInicio as string),
        lte: new Date(dataFim as string),
      };
    }
    
    const pagamentos = await prisma.pagamentoInstituicao.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(pagamentos);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify pagamento exists and belongs to institution
    const pagamento = await prisma.pagamentoInstituicao.findFirst({
      where: { id, ...filter },
    });
    
    if (!pagamento) {
      throw new AppError('Pagamento não encontrado', 404);
    }
    
    res.json(pagamento);
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

    const { instituicaoId, instituicao_id, ...bodyData } = req.body;
    const data = bodyData;
    
    const pagamentoData: any = {
      instituicaoId: req.user.instituicaoId, // Always from req.user
      assinaturaId: data.assinatura_id || data.assinaturaId,
      valor: data.valor,
      dataVencimento: data.data_vencimento || data.dataVencimento ? new Date(data.data_vencimento || data.dataVencimento) : undefined,
      formaPagamento: data.forma_pagamento || data.formaPagamento,
      status: data.status || 'pendente',
      comprovativoTexto: data.comprovativo_texto || data.comprovativoTexto,
      comprovativoUrl: data.comprovativo_url || data.comprovativoUrl,
      telefoneContato: data.telefone_contato || data.telefoneContato,
      observacoes: data.observacoes,
    };

    // Filter out undefined values
    Object.keys(pagamentoData).forEach(key => {
      if (pagamentoData[key] === undefined) {
        delete pagamentoData[key];
      }
    });
    
    const pagamento = await prisma.pagamentoInstituicao.create({
      data: pagamentoData,
    });
    
    res.status(201).json(pagamento);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify pagamento exists and belongs to institution
    const existing = await prisma.pagamentoInstituicao.findFirst({
      where: { id, ...filter }
    });
    
    if (!existing) {
      throw new AppError('Pagamento não encontrado', 404);
    }

    // Remove fields that shouldn't be updated
    const { instituicaoId, instituicao_id, id: _, ...updateData } = req.body;
    
    // Filter out undefined values and build clean update object
    const data: any = {};
    
    if (updateData.status !== undefined && updateData.status !== null && updateData.status !== '') {
      data.status = updateData.status;
    }
    if (updateData.observacoes !== undefined) {
      data.observacoes = updateData.observacoes || null;
    }
    if (updateData.dataPagamento || updateData.data_pagamento) {
      data.dataPagamento = new Date(updateData.dataPagamento || updateData.data_pagamento);
    }
    
    const pagamento = await prisma.pagamentoInstituicao.update({
      where: { id },
      data,
    });
    
    res.json(pagamento);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify pagamento exists and belongs to institution
    const existing = await prisma.pagamentoInstituicao.findFirst({
      where: { id, ...filter }
    });
    
    if (!existing) {
      throw new AppError('Pagamento não encontrado', 404);
    }
    
    await prisma.pagamentoInstituicao.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
