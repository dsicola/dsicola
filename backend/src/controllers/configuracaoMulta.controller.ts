import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * GET /configuracao-multa
 * Buscar configuração de multa da instituição do usuário
 */
export const getConfiguracaoMulta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    // CRITICAL: Multi-tenant security - instituicaoId from token only
    if (!filter.instituicaoId && !req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Instituição não identificada', 403);
    }

    // SUPER_ADMIN pode buscar por instituicaoId na query
    const instituicaoId = req.user?.roles.includes('SUPER_ADMIN') && req.query.instituicaoId
      ? req.query.instituicaoId as string
      : filter.instituicaoId;

    if (!instituicaoId) {
      throw new AppError('Instituição não identificada', 403);
    }

    let config = await prisma.configuracaoMulta.findUnique({
      where: { instituicaoId },
    });

    // Se não existe, criar com valores padrão
    if (!config) {
      config = await prisma.configuracaoMulta.create({
        data: {
          instituicaoId,
          multaPercentual: new Decimal(2),
          jurosDiaPercentual: new Decimal(0.033),
          diasTolerancia: 5,
        },
      });
    }

    res.json({
      id: config.id,
      instituicao_id: config.instituicaoId,
      multa_percentual: parseFloat(config.multaPercentual.toString()),
      juros_dia_percentual: parseFloat(config.jurosDiaPercentual.toString()),
      dias_tolerancia: config.diasTolerancia,
      created_at: config.createdAt,
      updated_at: config.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /configuracao-multa
 * Atualizar configuração de multa da instituição
 * Apenas ADMIN pode alterar
 */
export const updateConfiguracaoMulta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    // CRITICAL: Multi-tenant security - instituicaoId from token only
    if (!filter.instituicaoId && !req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Instituição não identificada', 403);
    }

    // Verificar se é ADMIN
    if (!req.user?.roles.includes('ADMIN') && !req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Apenas administradores podem alterar configurações de multa', 403);
    }

    const { multa_percentual, juros_dia_percentual, dias_tolerancia } = req.body;

    // Validações
    if (multa_percentual !== undefined) {
      const multa = parseFloat(multa_percentual);
      if (isNaN(multa) || multa < 0 || multa > 100) {
        throw new AppError('Percentual de multa deve ser entre 0 e 100', 400);
      }
    }

    if (juros_dia_percentual !== undefined) {
      const juros = parseFloat(juros_dia_percentual);
      if (isNaN(juros) || juros < 0 || juros > 10) {
        throw new AppError('Percentual de juros por dia deve ser entre 0 e 10', 400);
      }
    }

    if (dias_tolerancia !== undefined) {
      const tolerancia = parseInt(dias_tolerancia);
      if (isNaN(tolerancia) || tolerancia < 0 || tolerancia > 30) {
        throw new AppError('Dias de tolerância deve ser entre 0 e 30', 400);
      }
    }

    const instituicaoId = filter.instituicaoId!;

    // Buscar ou criar configuração
    let config = await prisma.configuracaoMulta.findUnique({
      where: { instituicaoId },
    });

    if (!config) {
      config = await prisma.configuracaoMulta.create({
        data: {
          instituicaoId,
          multaPercentual: multa_percentual ? new Decimal(multa_percentual) : new Decimal(2),
          jurosDiaPercentual: juros_dia_percentual ? new Decimal(juros_dia_percentual) : new Decimal(0.033),
          diasTolerancia: dias_tolerancia || 5,
        },
      });
    } else {
      config = await prisma.configuracaoMulta.update({
        where: { id: config.id },
        data: {
          ...(multa_percentual !== undefined && { multaPercentual: new Decimal(multa_percentual) }),
          ...(juros_dia_percentual !== undefined && { jurosDiaPercentual: new Decimal(juros_dia_percentual) }),
          ...(dias_tolerancia !== undefined && { diasTolerancia: dias_tolerancia }),
        },
      });
    }

    res.json({
      id: config.id,
      instituicao_id: config.instituicaoId,
      multa_percentual: parseFloat(config.multaPercentual.toString()),
      juros_dia_percentual: parseFloat(config.jurosDiaPercentual.toString()),
      dias_tolerancia: config.diasTolerancia,
      created_at: config.createdAt,
      updated_at: config.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

