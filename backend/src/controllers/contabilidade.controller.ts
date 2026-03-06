import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { ContabilidadeService } from '../services/contabilidade.service.js';

// ========== PLANO DE CONTAS ==========

export const listPlanoContas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const incluirInativos = req.query.incluirInativos === 'true';
    const contas = await ContabilidadeService.listPlanoContas(instituicaoId, incluirInativos);
    res.json(contas);
  } catch (error) {
    next(error);
  }
};

export const getPlanoContaById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const conta = await ContabilidadeService.getPlanoContaById(id, instituicaoId);
    res.json(conta);
  } catch (error) {
    next(error);
  }
};

export const createPlanoConta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { codigo, descricao, tipo, contaPaiId, nivel } = req.body;

    if (!codigo?.trim()) throw new AppError('Código é obrigatório', 400);
    if (!descricao?.trim()) throw new AppError('Descrição é obrigatória', 400);
    if (!tipo) throw new AppError('Tipo é obrigatório', 400);

    const conta = await ContabilidadeService.createPlanoConta(instituicaoId, {
      codigo,
      descricao,
      tipo,
      contaPaiId: contaPaiId || null,
      nivel,
    });
    res.status(201).json(conta);
  } catch (error) {
    next(error);
  }
};

export const updatePlanoConta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { codigo, descricao, tipo, contaPaiId, nivel, ativo } = req.body;

    const conta = await ContabilidadeService.updatePlanoConta(id, instituicaoId, {
      codigo,
      descricao,
      tipo,
      contaPaiId,
      nivel,
      ativo,
    });
    res.json(conta);
  } catch (error) {
    next(error);
  }
};

export const deletePlanoConta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    await ContabilidadeService.deletePlanoConta(id, instituicaoId);
    res.json({ message: 'Conta excluída' });
  } catch (error) {
    next(error);
  }
};

// ========== LANÇAMENTOS ==========

export const listLancamentos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { dataInicio, dataFim, fechado } = req.query;

    const filters: { dataInicio?: Date; dataFim?: Date; fechado?: boolean } = {};
    if (dataInicio) filters.dataInicio = new Date(dataInicio as string);
    if (dataFim) filters.dataFim = new Date(dataFim as string);
    if (fechado !== undefined) filters.fechado = fechado === 'true';

    const lancamentos = await ContabilidadeService.listLancamentos(instituicaoId, filters);
    res.json(lancamentos);
  } catch (error) {
    next(error);
  }
};

export const getLancamentoById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const lanc = await ContabilidadeService.getLancamentoById(id, instituicaoId);
    res.json(lanc);
  } catch (error) {
    next(error);
  }
};

export const createLancamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { data, descricao, linhas } = req.body;

    if (!data) throw new AppError('Data é obrigatória', 400);
    if (!descricao?.trim()) throw new AppError('Descrição é obrigatória', 400);
    if (!Array.isArray(linhas) || linhas.length < 2) {
      throw new AppError('Lançamento deve ter pelo menos 2 linhas', 400);
    }

    const lanc = await ContabilidadeService.createLancamento(instituicaoId, {
      data: new Date(data),
      descricao,
      linhas: linhas.map((l: { contaId: string; descricao?: string; debito: number; credito: number; ordem?: number }) => ({
        contaId: l.contaId,
        descricao: l.descricao,
        debito: Number(l.debito) || 0,
        credito: Number(l.credito) || 0,
        ordem: l.ordem,
      })),
    });
    res.status(201).json(lanc);
  } catch (error) {
    next(error);
  }
};

export const updateLancamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { data, descricao, fechado, linhas } = req.body;

    const updateData: { data?: Date; descricao?: string; fechado?: boolean; linhas?: Array<{ contaId: string; descricao?: string; debito: number; credito: number; ordem?: number }> } = {};
    if (data !== undefined) updateData.data = new Date(data);
    if (descricao !== undefined) updateData.descricao = descricao;
    if (fechado !== undefined) updateData.fechado = fechado;
    if (Array.isArray(linhas)) {
      updateData.linhas = linhas.map((l: { contaId: string; descricao?: string; debito: number; credito: number; ordem?: number }) => ({
        contaId: l.contaId,
        descricao: l.descricao,
        debito: Number(l.debito) || 0,
        credito: Number(l.credito) || 0,
        ordem: l.ordem,
      }));
    }

    const lanc = await ContabilidadeService.updateLancamento(id, instituicaoId, updateData);
    res.json(lanc);
  } catch (error) {
    next(error);
  }
};

export const fecharLancamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const lanc = await ContabilidadeService.fecharLancamento(id, instituicaoId);
    res.json(lanc);
  } catch (error) {
    next(error);
  }
};

export const deleteLancamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    await ContabilidadeService.deleteLancamento(id, instituicaoId);
    res.json({ message: 'Lançamento excluído' });
  } catch (error) {
    next(error);
  }
};

// ========== BALANCETE ==========

export const getBalancete = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { dataInicio, dataFim } = req.query;

    if (!dataInicio || !dataFim) {
      throw new AppError('dataInicio e dataFim são obrigatórios', 400);
    }

    const balancete = await ContabilidadeService.getBalancete(
      instituicaoId,
      new Date(dataInicio as string),
      new Date(dataFim as string)
    );
    res.json(balancete);
  } catch (error) {
    next(error);
  }
};
