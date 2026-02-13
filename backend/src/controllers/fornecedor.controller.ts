import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { FornecedorService } from '../services/fornecedor.service.js';

/**
 * Listar fornecedores
 * GET /fornecedores
 */
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { status, tipoServico, search } = req.query;

    const fornecedores = await FornecedorService.list(instituicaoId, {
      status: status as 'ATIVO' | 'INATIVO' | 'SUSPENSO' | undefined,
      tipoServico: tipoServico as string | undefined,
      search: search as string | undefined,
    });

    res.json(fornecedores);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter fornecedor por ID
 * GET /fornecedores/:id
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const fornecedor = await FornecedorService.getById(id, instituicaoId);

    res.json(fornecedor);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar fornecedor
 * POST /fornecedores
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    const {
      razaoSocial,
      nif,
      tipoServico,
      contato,
      email,
      telefone,
      endereco,
      cidade,
      pais,
      observacoes,
    } = req.body;

    // Validações
    if (!razaoSocial || razaoSocial.trim().length === 0) {
      throw new AppError('Razão social é obrigatória', 400);
    }

    if (!tipoServico) {
      throw new AppError('Tipo de serviço é obrigatório', 400);
    }

    const fornecedor = await FornecedorService.create(
      instituicaoId,
      {
        razaoSocial,
        nif,
        tipoServico,
        contato,
        email,
        telefone,
        endereco,
        cidade,
        pais,
        observacoes,
      },
      userId
    );

    res.status(201).json(fornecedor);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar fornecedor
 * PUT /fornecedores/:id
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const { id } = req.params;

    const {
      razaoSocial,
      nif,
      tipoServico,
      contato,
      email,
      telefone,
      endereco,
      cidade,
      pais,
      inicioContrato,
      fimContrato,
      status,
      observacoes,
    } = req.body;

    const fornecedor = await FornecedorService.update(
      id,
      instituicaoId,
      {
        razaoSocial,
        nif,
        tipoServico,
        contato,
        email,
        telefone,
        endereco,
        cidade,
        pais,
        status,
        observacoes,
      },
      userId
    );

    res.json(fornecedor);
  } catch (error) {
    next(error);
  }
};

/**
 * Deletar fornecedor (soft delete)
 * DELETE /fornecedores/:id
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const { id } = req.params;

    await FornecedorService.delete(id, instituicaoId, userId);

    res.json({ message: 'Fornecedor desativado com sucesso' });
  } catch (error) {
    next(error);
  }
};

