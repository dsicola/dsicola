import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import type { StatusAlocacao } from '@prisma/client';

const STATUS_ALOCACAO: StatusAlocacao[] = ['Ativo', 'Inativo', 'Transferido'];

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId, alojamentoId, status } = req.query;

    const alocacoes = await prisma.alocacaoAlojamento.findMany({
      where: {
        alojamento: { instituicaoId },
        ...(alunoId && typeof alunoId === 'string' && alunoId.trim() && { alunoId: alunoId.trim() }),
        ...(alojamentoId && typeof alojamentoId === 'string' && alojamentoId.trim() && { alojamentoId: alojamentoId.trim() }),
        ...(status && typeof status === 'string' && STATUS_ALOCACAO.includes(status as StatusAlocacao) && { status: status as StatusAlocacao }),
      },
      include: { aluno: true, alojamento: true },
      orderBy: { dataEntrada: 'desc' },
    });

    res.json(alocacoes);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const alocacao = await prisma.alocacaoAlojamento.findFirst({
      where: {
        id,
        alojamento: { instituicaoId },
      },
      include: { aluno: true, alojamento: true },
    });

    if (!alocacao) {
      throw new AppError('Alocação não encontrada', 404);
    }

    res.json(alocacao);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId, alojamentoId, dataEntrada, dataSaida, status } = req.body ?? {};

    if (!alunoId || typeof alunoId !== 'string') {
      throw new AppError('alunoId é obrigatório', 400);
    }
    if (!alojamentoId || typeof alojamentoId !== 'string') {
      throw new AppError('alojamentoId é obrigatório', 400);
    }

    const alojamento = await prisma.alojamento.findFirst({
      where: { id: alojamentoId, instituicaoId },
    });
    if (!alojamento) {
      throw new AppError('Alojamento não encontrado nesta instituição', 404);
    }

    const aluno = await prisma.user.findFirst({
      where: { id: alunoId, instituicaoId },
    });
    if (!aluno) {
      throw new AppError('Aluno não encontrado nesta instituição', 404);
    }

    let statusVal: StatusAlocacao = 'Ativo';
    if (status !== undefined && status !== null && status !== '') {
      if (!STATUS_ALOCACAO.includes(status as StatusAlocacao)) {
        throw new AppError('Status de alocação inválido', 400);
      }
      statusVal = status as StatusAlocacao;
    }

    let dataEntradaDate: Date | undefined;
    if (dataEntrada !== undefined && dataEntrada !== null && dataEntrada !== '') {
      const d = new Date(dataEntrada);
      if (isNaN(d.getTime())) {
        throw new AppError('dataEntrada inválida', 400);
      }
      dataEntradaDate = d;
    }

    let dataSaidaDate: Date | null | undefined;
    if (dataSaida !== undefined && dataSaida !== null && dataSaida !== '') {
      const d = new Date(dataSaida);
      if (isNaN(d.getTime())) {
        throw new AppError('dataSaida inválida', 400);
      }
      dataSaidaDate = d;
    }

    const alocacao = await prisma.alocacaoAlojamento.create({
      data: {
        alunoId,
        alojamentoId,
        ...(dataEntradaDate && { dataEntrada: dataEntradaDate }),
        ...(dataSaidaDate !== undefined && { dataSaida: dataSaidaDate }),
        status: statusVal,
      },
      include: { aluno: true, alojamento: true },
    });

    res.status(201).json(alocacao);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { alunoId, alojamentoId, dataEntrada, dataSaida, status } = req.body ?? {};

    const existing = await prisma.alocacaoAlojamento.findFirst({
      where: { id, alojamento: { instituicaoId } },
    });
    if (!existing) {
      throw new AppError('Alocação não encontrada', 404);
    }

    const data: Record<string, unknown> = {};

    if (alojamentoId !== undefined) {
      if (typeof alojamentoId !== 'string') {
        throw new AppError('alojamentoId inválido', 400);
      }
      const aloj = await prisma.alojamento.findFirst({
        where: { id: alojamentoId, instituicaoId },
      });
      if (!aloj) {
        throw new AppError('Alojamento não encontrado nesta instituição', 404);
      }
      data.alojamentoId = alojamentoId;
    }

    if (alunoId !== undefined) {
      if (typeof alunoId !== 'string') {
        throw new AppError('alunoId inválido', 400);
      }
      const aluno = await prisma.user.findFirst({
        where: { id: alunoId, instituicaoId },
      });
      if (!aluno) {
        throw new AppError('Aluno não encontrado nesta instituição', 404);
      }
      data.alunoId = alunoId;
    }

    if (dataEntrada !== undefined) {
      if (dataEntrada === null || dataEntrada === '') {
        throw new AppError('dataEntrada não pode ser vazia', 400);
      }
      const d = new Date(dataEntrada);
      if (isNaN(d.getTime())) {
        throw new AppError('dataEntrada inválida', 400);
      }
      data.dataEntrada = d;
    }

    if (dataSaida !== undefined) {
      if (dataSaida === null || dataSaida === '') {
        data.dataSaida = null;
      } else {
        const d = new Date(dataSaida);
        if (isNaN(d.getTime())) {
          throw new AppError('dataSaida inválida', 400);
        }
        data.dataSaida = d;
      }
    }

    if (status !== undefined) {
      if (!STATUS_ALOCACAO.includes(status as StatusAlocacao)) {
        throw new AppError('Status de alocação inválido', 400);
      }
      data.status = status as StatusAlocacao;
    }

    if (Object.keys(data).length === 0) {
      const unchanged = await prisma.alocacaoAlojamento.findFirst({
        where: { id, alojamento: { instituicaoId } },
        include: { aluno: true, alojamento: true },
      });
      return res.json(unchanged);
    }

    const alocacao = await prisma.alocacaoAlojamento.update({
      where: { id },
      data: data as any,
      include: { aluno: true, alojamento: true },
    });

    res.json(alocacao);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const existing = await prisma.alocacaoAlojamento.findFirst({
      where: { id, alojamento: { instituicaoId } },
    });
    if (!existing) {
      throw new AppError('Alocação não encontrada', 404);
    }

    await prisma.alocacaoAlojamento.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
