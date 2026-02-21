import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { funcionarioId } = req.query;
    
    const documentos = await prisma.documentoFuncionario.findMany({
      where: {
        ...(funcionarioId && { funcionarioId: funcionarioId as string }),
      },
      include: { funcionario: true },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(documentos);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const documento = await prisma.documentoFuncionario.findUnique({
      where: { id },
      include: { funcionario: true },
    });
    
    if (!documento) {
      throw new AppError('Documento não encontrado', 404);
    }
    
    res.json(documento);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const { funcionarioId } = body;

    if (!funcionarioId || !body.tipoDocumento || !body.nomeArquivo || !body.arquivoUrl) {
      throw new AppError('funcionarioId, tipoDocumento, nomeArquivo e arquivoUrl são obrigatórios', 400);
    }

    // Validar que o funcionário pertence à instituição do utilizador (multi-tenant)
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: { instituicaoId: true },
    });

    if (!funcionario) {
      throw new AppError('Funcionário não encontrado', 404);
    }

    const authReq = req as AuthenticatedRequest;
    const userInstituicaoId = authReq.user?.instituicaoId;
    if (funcionario.instituicaoId && userInstituicaoId && funcionario.instituicaoId !== userInstituicaoId) {
      throw new AppError('Acesso negado: funcionário não pertence à sua instituição', 403);
    }

    const data = {
      funcionarioId,
      tipoDocumento: body.tipoDocumento,
      nomeArquivo: body.nomeArquivo,
      arquivoUrl: body.arquivoUrl,
      tamanhoBytes: body.tamanhoBytes ?? null,
      descricao: body.descricao ?? null,
      dataVencimento: body.dataVencimento ? new Date(body.dataVencimento) : null,
      uploadedBy: body.uploadedBy ?? authReq.user?.userId ?? null,
    };

    const documento = await prisma.documentoFuncionario.create({ data });
    res.status(201).json(documento);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.documentoFuncionario.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
