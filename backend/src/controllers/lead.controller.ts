import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit } = req.query;
    
    const leads = await prisma.leadComercial.findMany({
      where: {
        ...(status && { status: status as string }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 100,
    });
    
    res.json(leads);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const lead = await prisma.leadComercial.findUnique({ where: { id } });
    
    if (!lead) {
      throw new AppError('Lead não encontrado', 404);
    }
    
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    // Mapear campos do frontend para o schema Prisma (sem spread para evitar campos inválidos)
    const data = {
      nomeInstituicao: body.nomeInstituicao ?? body.nome_instituicao ?? '',
      nomeContato: body.nomeContato ?? body.nomeResponsavel ?? body.nome_responsavel ?? '',
      email: body.email ?? '',
      telefone: body.telefone ?? null,
      cidade: body.cidade ?? null,
      tipoInstituicao: body.tipoInstituicao ?? body.tipo_instituicao ?? null,
      quantidadeAlunos: body.quantidadeAlunos ?? body.quantidade_alunos ?? null,
      mensagem: body.mensagem ?? null,
      status: body.status ?? 'novo',
    };
    const lead = await prisma.leadComercial.create({ data });
    res.status(201).json(lead);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = req.body;
    // Mapear notas -> observacoes e remover campos inválidos
    const allowed = ['status', 'nomeInstituicao', 'nomeContato', 'email', 'telefone', 'cidade', 'tipoInstituicao', 'quantidadeAlunos', 'mensagem', 'dataContato', 'observacoes'];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) data[k] = body[k];
    }
    if ('notas' in body) data.observacoes = body.notas;
    
    const lead = await prisma.leadComercial.update({
      where: { id },
      data: data as any,
    });
    
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.leadComercial.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
