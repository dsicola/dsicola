import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { computarStatusPeriodo } from '../services/periodoLancamentoNotas.service.js';
import { StatusPeriodoLancamentoNotas } from '@prisma/client';

/**
 * Listar períodos de lançamento de notas da instituição (multi-tenant)
 */
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);

    const periodos = await prisma.periodoLancamentoNotas.findMany({
      where: { instituicaoId },
      include: {
        anoLetivo: { select: { id: true, ano: true, status: true } },
        reabertoPorUser: { select: { id: true, nomeCompleto: true, email: true } },
      },
      orderBy: [{ anoLetivo: { ano: 'desc' } }, { tipoPeriodo: 'asc' }, { numeroPeriodo: 'asc' }],
    });

    // Computar status EXPIRADO automaticamente
    const comStatusComputado = periodos.map((p) => {
      const status = computarStatusPeriodo(p.dataFim, p.status);
      return { ...p, statusComputado: status };
    });

    res.json(comStatusComputado);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar período de lançamento de notas (ADMIN apenas)
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { anoLetivoId, tipoPeriodo, numeroPeriodo, dataInicio, dataFim } = req.body;

    if (!anoLetivoId || !tipoPeriodo || !numeroPeriodo || !dataInicio || !dataFim) {
      throw new AppError('anoLetivoId, tipoPeriodo, numeroPeriodo, dataInicio e dataFim são obrigatórios', 400);
    }

    if (!['SEMESTRE', 'TRIMESTRE'].includes(String(tipoPeriodo).toUpperCase())) {
      throw new AppError('tipoPeriodo deve ser SEMESTRE ou TRIMESTRE', 400);
    }

    const num = Number(numeroPeriodo);
    if (tipoPeriodo === 'SEMESTRE' && (num < 1 || num > 2)) {
      throw new AppError('numeroPeriodo para SEMESTRE deve ser 1 ou 2', 400);
    }
    if (tipoPeriodo === 'TRIMESTRE' && (num < 1 || num > 3)) {
      throw new AppError('numeroPeriodo para TRIMESTRE deve ser 1, 2 ou 3', 400);
    }

    const dataInicioDate = new Date(dataInicio);
    const dataFimDate = new Date(dataFim);
    if (dataFimDate <= dataInicioDate) {
      throw new AppError('dataFim deve ser posterior a dataInicio', 400);
    }

    // Verificar se ano letivo pertence à instituição
    const anoLetivo = await prisma.anoLetivo.findFirst({
      where: { id: anoLetivoId, instituicaoId },
    });
    if (!anoLetivo) {
      throw new AppError('Ano letivo não encontrado ou não pertence à instituição', 404);
    }

    const tipoPeriodoNorm = String(tipoPeriodo).toUpperCase();

    const periodo = await prisma.periodoLancamentoNotas.create({
      data: {
        instituicaoId,
        anoLetivoId,
        tipoPeriodo: tipoPeriodoNorm,
        numeroPeriodo: num,
        dataInicio: dataInicioDate,
        dataFim: dataFimDate,
        status: StatusPeriodoLancamentoNotas.ABERTO,
      },
      include: {
        anoLetivo: { select: { id: true, ano: true } },
      },
    });

    await AuditService.logCreate(req, {
      modulo: ModuloAuditoria.PERIODO_LANCAMENTO_NOTAS,
      entidade: EntidadeAuditoria.PERIODO_LANCAMENTO_NOTAS,
      entidadeId: periodo.id,
      dadosNovos: periodo,
      observacao: `Período ${tipoPeriodoNorm} ${num} criado para ano ${anoLetivo.ano}`,
    });

    res.status(201).json(periodo);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar período (datas, status FECHADO) - ADMIN apenas
 */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { dataInicio, dataFim, status } = req.body;

    const existing = await prisma.periodoLancamentoNotas.findFirst({
      where: { id, instituicaoId },
      include: { anoLetivo: { select: { ano: true } } },
    });

    if (!existing) {
      throw new AppError('Período não encontrado', 404);
    }

    const updateData: any = {};
    if (dataInicio !== undefined) updateData.dataInicio = new Date(dataInicio);
    if (dataFim !== undefined) updateData.dataFim = new Date(dataFim);
    if (status !== undefined) {
      if (status !== 'ABERTO' && status !== 'FECHADO') {
        throw new AppError('status só pode ser ABERTO ou FECHADO (EXPIRADO é automático)', 400);
      }
      updateData.status = status;
    }

    const periodo = await prisma.periodoLancamentoNotas.update({
      where: { id },
      data: updateData,
      include: {
        anoLetivo: { select: { id: true, ano: true } },
      },
    });

    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.PERIODO_LANCAMENTO_NOTAS,
      entidade: EntidadeAuditoria.PERIODO_LANCAMENTO_NOTAS,
      entidadeId: id,
      dadosAnteriores: existing,
      dadosNovos: periodo,
    });

    res.json(periodo);
  } catch (error) {
    next(error);
  }
};

/**
 * Reabrir período - APENAS ADMIN
 * Permite mudar status de FECHADO/EXPIRADO para ABERTO (com log de auditoria)
 */
export const reabrir = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { motivoReabertura, dataFimNova } = req.body;

    const userRoles = req.user?.roles || [];
    if (!userRoles.includes('ADMIN') && !userRoles.includes('SUPER_ADMIN')) {
      throw new AppError('Apenas ADMIN pode reabrir períodos de lançamento de notas', 403);
    }

    const existing = await prisma.periodoLancamentoNotas.findFirst({
      where: { id, instituicaoId },
      include: {
        anoLetivo: { select: { ano: true } },
        reabertoPorUser: { select: { nomeCompleto: true } },
      },
    });

    if (!existing) {
      throw new AppError('Período não encontrado', 404);
    }

    const statusComputado = computarStatusPeriodo(existing.dataFim, existing.status);
    if (statusComputado === StatusPeriodoLancamentoNotas.ABERTO) {
      throw new AppError('Período já está aberto. Não é necessário reabrir.', 400);
    }

    const motivo = motivoReabertura?.trim() || 'Reabertura autorizada pelo administrador';

    const updateData: any = {
      status: StatusPeriodoLancamentoNotas.ABERTO,
      reabertoPor: req.user?.userId || null,
      reabertoEm: new Date(),
      motivoReabertura: motivo,
    };

    if (dataFimNova) {
      const novaDataFim = new Date(dataFimNova);
      if (novaDataFim <= existing.dataInicio) {
        throw new AppError('dataFimNova deve ser posterior a dataInicio', 400);
      }
      updateData.dataFim = novaDataFim;
    }

    const periodo = await prisma.periodoLancamentoNotas.update({
      where: { id },
      data: updateData,
      include: {
        anoLetivo: { select: { id: true, ano: true } },
        reabertoPorUser: { select: { id: true, nomeCompleto: true, email: true } },
      },
    });

    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.PERIODO_LANCAMENTO_NOTAS,
      entidade: EntidadeAuditoria.PERIODO_LANCAMENTO_NOTAS,
      entidadeId: id,
      dadosAnteriores: existing,
      dadosNovos: periodo,
      observacao: `PERÍODO REABERTO por ${(req.user as any)?.nomeCompleto || 'ADMIN'}. Motivo: ${motivo}`,
    });

    res.json({
      ...periodo,
      message: 'Período reaberto com sucesso. Log de auditoria registrado.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter período ativo atual (para exibir na UI)
 */
export const getAtivo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const now = new Date();

    const periodoAtivo = await prisma.periodoLancamentoNotas.findFirst({
      where: {
        instituicaoId,
        status: StatusPeriodoLancamentoNotas.ABERTO,
        dataInicio: { lte: now },
        dataFim: { gte: now },
      },
      include: {
        anoLetivo: { select: { id: true, ano: true } },
      },
    });

    res.json(periodoAtivo ?? null);
  } catch (error) {
    next(error);
  }
};
