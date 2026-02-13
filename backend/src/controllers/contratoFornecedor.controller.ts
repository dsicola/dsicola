import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { ContratoFornecedorService } from '../services/contratoFornecedor.service.js';

/**
 * Listar contratos de fornecedores
 * GET /contratos-fornecedor
 */
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { fornecedorId, status, tipoContrato } = req.query;

    const contratos = await ContratoFornecedorService.list(instituicaoId, {
      fornecedorId: fornecedorId as string | undefined,
      status: status as 'ATIVO' | 'ENCERRADO' | 'SUSPENSO' | undefined,
      tipoContrato: tipoContrato as 'MENSAL' | 'ANUAL' | 'EVENTUAL' | undefined,
    });

    res.json(contratos);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter contrato por ID
 * GET /contratos-fornecedor/:id
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const contrato = await ContratoFornecedorService.getById(id, instituicaoId);

    res.json(contrato);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar contrato com fornecedor
 * POST /contratos-fornecedor
 * RBAC: Apenas ADMIN pode criar contratos
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    const {
      fornecedorId,
      tipoContrato,
      valor,
      dataInicio,
      dataFim,
      observacoes,
    } = req.body;

    // Validações
    if (!fornecedorId) {
      throw new AppError('ID do fornecedor é obrigatório', 400);
    }

    if (!tipoContrato || !['MENSAL', 'ANUAL', 'EVENTUAL'].includes(tipoContrato)) {
      throw new AppError('Tipo de contrato é obrigatório e deve ser MENSAL, ANUAL ou EVENTUAL', 400);
    }

    if (!valor || valor <= 0) {
      throw new AppError('Valor do contrato deve ser maior que zero', 400);
    }

    if (!dataInicio) {
      throw new AppError('Data de início é obrigatória', 400);
    }

    const contrato = await ContratoFornecedorService.create(
      instituicaoId,
      {
        fornecedorId,
        tipoContrato,
        valor: Number(valor),
        dataInicio: new Date(dataInicio),
        dataFim: dataFim ? new Date(dataFim) : undefined,
        observacoes,
      },
      userId
    );

    res.status(201).json(contrato);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar contrato
 * PUT /contratos-fornecedor/:id
 * RBAC: Apenas ADMIN pode atualizar contratos
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const { id } = req.params;

    const {
      tipoContrato,
      valor,
      dataInicio,
      dataFim,
      status,
      observacoes,
    } = req.body;

    const contrato = await ContratoFornecedorService.update(
      id,
      instituicaoId,
      {
        tipoContrato,
        valor: valor ? Number(valor) : undefined,
        dataInicio: dataInicio ? new Date(dataInicio) : undefined,
        dataFim: dataFim ? new Date(dataFim) : undefined,
        status,
        observacoes,
      },
      userId
    );

    res.json(contrato);
  } catch (error) {
    next(error);
  }
};

