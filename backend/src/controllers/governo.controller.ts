import { Request, Response, NextFunction } from 'express';
import { GovernoService, TipoEventoGovernamental, StatusEventoGovernamental } from '../services/governo.service.js';
import { requireTenantScope, addInstitutionFilter } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Criar evento governamental
 * Eventos são gerados internamente pelo sistema
 */
export const criarEvento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { tipoEvento, payloadJson, observacoes } = req.body;
    const userId = req.user?.userId;

    if (!tipoEvento) {
      throw new AppError('tipoEvento é obrigatório', 400);
    }

    if (!payloadJson) {
      throw new AppError('payloadJson é obrigatório', 400);
    }

    // Validar tipo de evento
    const tiposValidos = Object.values(TipoEventoGovernamental);
    if (!tiposValidos.includes(tipoEvento)) {
      throw new AppError(`Tipo de evento inválido. Tipos válidos: ${tiposValidos.join(', ')}`, 400);
    }

    const evento = await GovernoService.criarEvento({
      instituicaoId,
      tipoEvento: tipoEvento as TipoEventoGovernamental,
      payloadJson,
      criadoPor: userId,
      observacoes,
    });

    res.status(201).json(evento);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar eventos governamentais
 * Filtrado por instituição (multi-tenant)
 */
export const listarEventos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { tipoEvento, status, dataInicio, dataFim } = req.query;

    const filtros: any = {};

    if (tipoEvento) {
      filtros.tipoEvento = tipoEvento as TipoEventoGovernamental;
    }

    if (status) {
      filtros.status = status as StatusEventoGovernamental;
    }

    if (dataInicio) {
      filtros.dataInicio = new Date(dataInicio as string);
    }

    if (dataFim) {
      filtros.dataFim = new Date(dataFim as string);
    }

    const eventos = await GovernoService.listarEventos(instituicaoId, filtros);

    res.json(eventos);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter evento por ID
 */
export const obterEventoPorId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const evento = await GovernoService.obterEventoPorId(id, instituicaoId);

    res.json(evento);
  } catch (error) {
    next(error);
  }
};

/**
 * Enviar evento ao órgão governamental
 * Requer que integração esteja ativa
 */
export const enviarEvento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const resposta = await GovernoService.enviarEvento(id, instituicaoId);

    res.json(resposta);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancelar evento governamental
 */
export const cancelarEvento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const instituicaoId = requireTenantScope(req);

    const evento = await GovernoService.cancelarEvento(id, instituicaoId, motivo);

    res.json(evento);
  } catch (error) {
    next(error);
  }
};

/**
 * Retentar envio de evento com erro
 */
export const retentarEnvio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const resposta = await GovernoService.retentarEnvio(id, instituicaoId);

    res.json(resposta);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter estatísticas de eventos
 */
export const obterEstatisticas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);

    const estatisticas = await GovernoService.obterEstatisticas(instituicaoId);

    res.json(estatisticas);
  } catch (error) {
    next(error);
  }
};
