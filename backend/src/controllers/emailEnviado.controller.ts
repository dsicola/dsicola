import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter } from '../middlewares/auth.js';
import { EmailRetryService } from '../services/emailRetry.service.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { status, tipo, limit, page } = req.query;
    
    const pageNumber = page ? parseInt(page as string) : 1;
    const pageSize = limit ? parseInt(limit as string) : 50;
    const skip = (pageNumber - 1) * pageSize;

    const where: any = {
      ...filter,
      ...(status && { status: status as string }),
      ...(tipo && { tipo: tipo as string }),
    };

    const [emails, total] = await Promise.all([
      prisma.emailEnviado.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.emailEnviado.count({ where }),
    ]);
    
    res.json({
      data: emails,
      pagination: {
        page: pageNumber,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter estatísticas de e-mails
 * GET /emails-enviados/estatisticas
 */
export const getEstatisticas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);

    const estatisticas = await EmailRetryService.obterEstatisticas(instituicaoId || undefined);

    // Estatísticas por tipo
    const porTipo = await prisma.emailEnviado.groupBy({
      by: ['tipo'],
      where: filter,
      _count: { id: true },
    });

    // Estatísticas por status
    const porStatus = await prisma.emailEnviado.groupBy({
      by: ['status'],
      where: filter,
      _count: { id: true },
    });

    // E-mails falhados recentes (últimos 7 dias)
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const falhadosRecentes = await prisma.emailEnviado.count({
      where: {
        ...filter,
        status: 'erro',
        createdAt: { gte: seteDiasAtras },
      },
    });

    res.json({
      ...estatisticas,
      porTipo: porTipo.map(item => ({
        tipo: item.tipo,
        quantidade: item._count.id,
      })),
      porStatus: porStatus.map(item => ({
        status: item.status,
        quantidade: item._count.id,
      })),
      falhadosRecentes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Processar retry de e-mails falhados
 * POST /emails-enviados/retry
 */
export const processarRetry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.body;
    const resultado = await EmailRetryService.processarEmailsFalhados(limit || 10);

    res.json({
      success: true,
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Agendar retry manual para um e-mail específico
 * POST /emails-enviados/:id/retry
 */
export const agendarRetry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await EmailRetryService.agendarRetry(id);

    res.json({
      success: true,
      message: 'Retry agendado com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.emailEnviado.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const deleteAllFailed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    
    await prisma.emailEnviado.deleteMany({
      where: {
        ...filter,
        status: 'erro',
      },
    });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
