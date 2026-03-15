import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';
import { AuditService } from '../services/audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { status, dataInicio, dataFim } = req.query;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN');
    const isComercial = req.user?.roles?.includes('COMERCIAL');

    // SUPER_ADMIN e COMERCIAL veem todos os pagamentos (gestão central de assinaturas)
    const where: any = (isSuperAdmin || isComercial) ? {} : { ...filter };
    
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
      include: { instituicao: { select: { nome: true } } },
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
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN');
    const isComercial = req.user?.roles?.includes('COMERCIAL');
    const whereClause = (isSuperAdmin || isComercial) ? { id } : { id, ...filter };

    const pagamento = await prisma.pagamentoInstituicao.findFirst({
      where: whereClause,
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

    const valor = data.valor != null ? Number(data.valor) : undefined;
    if (valor == null || Number.isNaN(valor) || valor < 0) {
      throw new AppError('O valor do pagamento é obrigatório e deve ser um número válido (≥ 0).', 400);
    }

    const pagamentoData: any = {
      instituicaoId: req.user.instituicaoId, // Always from req.user
      assinaturaId: data.assinatura_id || data.assinaturaId || undefined,
      valor,
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

    await AuditService.log(req, {
      modulo: ModuloAuditoria.FINANCEIRO,
      acao: AcaoAuditoria.CREATE,
      entidade: EntidadeAuditoria.PAGAMENTO_INSTITUICAO,
      entidadeId: pagamento.id,
      dadosNovos: { valor: pagamento.valor, status: pagamento.status, dataVencimento: pagamento.dataVencimento },
      instituicaoId: req.user.instituicaoId ?? undefined,
    }).catch((err) => console.error('[pagamentoInstituicao.create] Erro audit:', err?.message));
    
    res.status(201).json(pagamento);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN');
    const isComercial = req.user?.roles?.includes('COMERCIAL');

    // SUPER_ADMIN e COMERCIAL podem atualizar qualquer pagamento (gestão central de assinaturas)
    const whereClause = (isSuperAdmin || isComercial) ? { id } : { id, ...filter };

    const existing = await prisma.pagamentoInstituicao.findFirst({
      where: whereClause
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

    await AuditService.log(req, {
      modulo: ModuloAuditoria.FINANCEIRO,
      acao: AcaoAuditoria.UPDATE,
      entidade: EntidadeAuditoria.PAGAMENTO_INSTITUICAO,
      entidadeId: pagamento.id,
      dadosAnteriores: { status: existing.status, dataPagamento: existing.dataPagamento },
      dadosNovos: data,
      instituicaoId: req.user?.instituicaoId ?? undefined,
    }).catch((err) => console.error('[pagamentoInstituicao.update] Erro audit:', err?.message));
    
    res.json(pagamento);
  } catch (error) {
    next(error);
  }
};

/**
 * Remover comprovativo de um pagamento (ADMIN/FINANCEIRO da instituição).
 * Limpa comprovativo_url e comprovativo_texto. O ficheiro em storage pode permanecer.
 */
export const removerComprovativo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.pagamentoInstituicao.findFirst({
      where: { id, ...filter },
    });

    if (!existing) {
      throw new AppError('Pagamento não encontrado', 404);
    }

    if (!existing.comprovativoUrl && !existing.comprovativoTexto) {
      throw new AppError('Este pagamento não possui comprovativo para excluir', 400);
    }

    // Audit antes de remover (registra o que foi removido)
    await AuditService.log(req, {
      modulo: ModuloAuditoria.FINANCEIRO,
      acao: AcaoAuditoria.UPDATE,
      entidade: EntidadeAuditoria.PAGAMENTO_INSTITUICAO,
      entidadeId: id,
      dadosAnteriores: { comprovativoUrl: existing.comprovativoUrl, comprovativoTexto: existing.comprovativoTexto },
      dadosNovos: { comprovativoUrl: null, comprovativoTexto: null },
      observacao: 'Comprovativo removido',
      instituicaoId: req.user?.instituicaoId ?? undefined,
    }).catch((err) => console.error('[pagamentoInstituicao.removerComprovativo] Erro audit:', err?.message));

    await prisma.pagamentoInstituicao.update({
      where: { id },
      data: {
        comprovativoUrl: null,
        comprovativoTexto: null,
      },
    });

    res.json({
      message: 'Comprovativo excluído com sucesso',
      pagamento: await prisma.pagamentoInstituicao.findUnique({
        where: { id },
        include: { instituicao: { select: { nome: true } } },
      }),
    });
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

    await AuditService.log(req, {
      modulo: ModuloAuditoria.FINANCEIRO,
      acao: AcaoAuditoria.DELETE,
      entidade: EntidadeAuditoria.PAGAMENTO_INSTITUICAO,
      entidadeId: id,
      dadosAnteriores: { id: existing.id, valor: existing.valor, status: existing.status },
      instituicaoId: req.user?.instituicaoId ?? undefined,
    }).catch((err) => console.error('[pagamentoInstituicao.remove] Erro audit:', err?.message));
    
    await prisma.pagamentoInstituicao.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
