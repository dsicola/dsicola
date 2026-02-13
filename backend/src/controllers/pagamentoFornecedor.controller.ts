import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { PagamentoFornecedorService } from '../services/pagamentoFornecedor.service.js';

/**
 * Listar pagamentos de fornecedores
 * GET /pagamentos-fornecedor
 * RBAC: ADMIN pode ver todos da sua instituição, SUPER_ADMIN pode ver todos para auditoria
 * FUNCIONARIO NÃO tem acesso (separação RH ≠ Financeiro)
 */
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { fornecedorId, contratoId, status, dataInicio, dataFim } = req.query;

    const pagamentos = await PagamentoFornecedorService.list(instituicaoId, {
      fornecedorId: fornecedorId as string | undefined,
      contratoId: contratoId as string | undefined,
      status: status as 'PENDENTE' | 'PAGO' | 'CANCELADO' | undefined,
      dataInicio: dataInicio ? new Date(dataInicio as string) : undefined,
      dataFim: dataFim ? new Date(dataFim as string) : undefined,
    });

    res.json(pagamentos);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter pagamento por ID
 * GET /pagamentos-fornecedor/:id
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const pagamento = await PagamentoFornecedorService.getById(id, instituicaoId);

    res.json(pagamento);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar pagamento para fornecedor
 * POST /pagamentos-fornecedor
 * RBAC: Apenas ADMIN pode criar pagamentos
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    // Verificar se usuário tem permissão (apenas ADMIN)
    // SUPER_ADMIN NÃO pode criar pagamentos (apenas auditar)
    if (!req.user?.roles.includes('ADMIN')) {
      if (req.user?.roles.includes('SUPER_ADMIN')) {
        throw new AppError('SUPER_ADMIN não pode criar pagamentos. Apenas ADMIN da instituição pode criar pagamentos para fornecedores.', 403);
      }
      throw new AppError('Apenas ADMIN pode criar pagamentos para fornecedores', 403);
    }

    const {
      fornecedorId,
      contratoId,
      valor,
      dataPagamento,
      metodo,
      referencia,
      observacoes,
    } = req.body;

    // Validações
    if (!fornecedorId) {
      throw new AppError('ID do fornecedor é obrigatório', 400);
    }

    if (!valor || valor <= 0) {
      throw new AppError('Valor do pagamento deve ser maior que zero', 400);
    }

    if (!dataPagamento) {
      throw new AppError('Data de pagamento é obrigatória', 400);
    }

    if (!metodo || !['TRANSFERENCIA', 'CASH', 'CHEQUE', 'MOBILE_MONEY', 'OUTRO'].includes(metodo)) {
      throw new AppError('Método de pagamento é obrigatório e deve ser válido', 400);
    }

    const pagamento = await PagamentoFornecedorService.create(
      instituicaoId,
      {
        fornecedorId,
        contratoId,
        valor: Number(valor),
        dataPagamento: new Date(dataPagamento),
        metodo,
        referencia,
        observacoes,
      },
      userId,
      userId // ADMIN autoriza ao criar
    );

    res.status(201).json(pagamento);
  } catch (error) {
    next(error);
  }
};

/**
 * Autorizar e executar pagamento
 * POST /pagamentos-fornecedor/:id/autorizar
 * RBAC: Apenas ADMIN pode autorizar pagamentos
 */
export const autorizarEPagar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    // Verificar se usuário tem permissão (apenas ADMIN)
    // SUPER_ADMIN NÃO pode executar pagamentos (apenas auditar)
    if (!req.user?.roles.includes('ADMIN')) {
      if (req.user?.roles.includes('SUPER_ADMIN')) {
        throw new AppError('SUPER_ADMIN não pode executar pagamentos. Apenas ADMIN da instituição pode autorizar e executar pagamentos.', 403);
      }
      throw new AppError('Apenas ADMIN pode autorizar e executar pagamentos', 403);
    }

    const { id } = req.params;

    const pagamento = await PagamentoFornecedorService.autorizarEPagar(
      id,
      instituicaoId,
      userId!
    );

    res.json(pagamento);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancelar pagamento
 * POST /pagamentos-fornecedor/:id/cancelar
 * RBAC: Apenas ADMIN pode cancelar pagamentos
 */
export const cancelar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    // Verificar se usuário tem permissão (apenas ADMIN)
    // SUPER_ADMIN NÃO pode cancelar pagamentos (apenas auditar)
    if (!req.user?.roles.includes('ADMIN')) {
      if (req.user?.roles.includes('SUPER_ADMIN')) {
        throw new AppError('SUPER_ADMIN não pode cancelar pagamentos. Apenas ADMIN da instituição pode cancelar pagamentos.', 403);
      }
      throw new AppError('Apenas ADMIN pode cancelar pagamentos', 403);
    }

    const { id } = req.params;
    const { motivo } = req.body;

    const pagamento = await PagamentoFornecedorService.cancelar(
      id,
      instituicaoId,
      userId!,
      motivo
    );

    res.json(pagamento);
  } catch (error) {
    next(error);
  }
};

