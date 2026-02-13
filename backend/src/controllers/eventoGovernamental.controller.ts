import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope, addInstitutionFilter } from '../middlewares/auth.js';
import {
  criarEventoGovernamental,
  buscarEventosGovernamentais,
  buscarEventoGovernamentalPorId,
  tentarEnviarEvento,
  cancelarEvento,
  obterEstatisticasEventos,
  isIntegracaoGovernamentalAtiva,
  processarEventosPendentes,
  processarEventosPendentesComErro,
} from '../services/governo/eventoGovernamental.service.js';
import { TipoEventoGovernamental, StatusEventoGovernamental } from '@prisma/client';

/**
 * Controller para gerenciar eventos governamentais
 * Apenas ADMIN e SUPER_ADMIN podem acessar
 */

/**
 * Criar evento governamental
 * POST /eventos-governamentais
 */
export const criarEvento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const { tipoEvento, payloadJson, observacoes } = req.body;

    if (!tipoEvento) {
      throw new AppError('Tipo de evento é obrigatório', 400);
    }

    if (!payloadJson) {
      throw new AppError('Payload JSON é obrigatório', 400);
    }

    // Validar tipo de evento
    if (!Object.values(TipoEventoGovernamental).includes(tipoEvento)) {
      throw new AppError('Tipo de evento inválido', 400);
    }

    const evento = await criarEventoGovernamental({
      instituicaoId,
      tipoEvento,
      payloadJson,
      criadoPor: userId,
      observacoes: observacoes || undefined,
    });

    // Auditoria obrigatória
    if (userId) {
      await AuditService.logCreate(req, {
        modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
        entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
        entidadeId: evento.id,
        dadosNovos: { tipoEvento, status: evento.status },
        observacao: `Evento governamental criado: ${tipoEvento}`,
      });
    }

    res.status(201).json(evento);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar eventos governamentais
 * GET /eventos-governamentais
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

    const eventos = await buscarEventosGovernamentais(instituicaoId, filtros);

    res.json(eventos);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar evento por ID
 * GET /eventos-governamentais/:id
 */
export const buscarEventoPorId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const evento = await buscarEventoGovernamentalPorId(id, instituicaoId);

    if (!evento) {
      throw new AppError('Evento não encontrado', 404);
    }

    res.json(evento);
  } catch (error) {
    next(error);
  }
};

/**
 * Enviar evento governamental
 * POST /eventos-governamentais/:id/enviar
 */
export const enviarEvento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { forcarEnvio } = req.body;

    // Verificar se integração está ativa
    if (!forcarEnvio && !isIntegracaoGovernamentalAtiva(instituicaoId)) {
      throw new AppError(
        'Integração governamental não está ativa. Configure a feature flag para ativar.',
        403
      );
    }

    const resultado = await tentarEnviarEvento({
      eventoId: id,
      instituicaoId,
      forcarEnvio: forcarEnvio || false,
    });

    if (!resultado.sucesso) {
      throw new AppError(resultado.erro || 'Erro ao enviar evento', 400);
    }

    // Auditoria obrigatória
    const userId = req.user?.userId;
    if (userId) {
      await AuditService.logUpdate(req, {
        modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
        entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
        entidadeId: id,
        dadosAnteriores: { status: 'PENDENTE' },
        dadosNovos: { status: 'ENVIADO', protocolo: resultado.protocolo },
        observacao: `Evento enviado com sucesso. Protocolo: ${resultado.protocolo || 'N/A'}`,
      });
    }

    res.json({
      message: 'Evento enviado com sucesso',
      protocolo: resultado.protocolo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancelar evento governamental
 * POST /eventos-governamentais/:id/cancelar
 */
export const cancelarEventoController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo) {
      throw new AppError('Motivo do cancelamento é obrigatório', 400);
    }

    if (!userId) {
      throw new AppError('Usuário não identificado', 401);
    }

    const evento = await cancelarEvento(id, instituicaoId, motivo, userId);

    // Auditoria obrigatória
    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.INTEGRACAO_GOVERNAMENTAL,
      entidade: EntidadeAuditoria.EVENTO_GOVERNAMENTAL,
      entidadeId: id,
      dadosAnteriores: { status: 'PENDENTE' },
      dadosNovos: { status: 'CANCELADO' },
      observacao: `Evento cancelado: ${motivo}`,
    });

    res.json({
      message: 'Evento cancelado com sucesso',
      evento,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter estatísticas de eventos
 * GET /eventos-governamentais/estatisticas
 */
export const obterEstatisticas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);

    const estatisticas = await obterEstatisticasEventos(instituicaoId);

    res.json(estatisticas);
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar status da integração governamental
 * GET /eventos-governamentais/status-integracao
 */
export const verificarStatusIntegracao = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const instituicaoId = requireTenantScope(req);

    const ativa = await isIntegracaoGovernamentalAtiva(instituicaoId);

    res.json({
      ativa,
      mensagem: ativa
        ? 'Integração governamental está ativa'
        : 'Integração governamental está desativada. Configure a feature flag para ativar.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Processar eventos pendentes manualmente (endpoint administrativo)
 * POST /eventos-governamentais/processar-pendentes
 */
export const processarPendentes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resultado = await processarEventosPendentes();

    res.json({
      message: 'Processamento de eventos pendentes concluído',
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Processar eventos com erro manualmente (retry manual)
 * POST /eventos-governamentais/processar-erros
 */
export const processarErros = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resultado = await processarEventosPendentesComErro();

    res.json({
      message: 'Processamento de eventos com erro concluído',
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};
