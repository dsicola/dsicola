import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';

/**
 * Lista documentos - multi-tenant: instituicaoId do JWT
 */
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId, tipoDocumentoId } = req.query;

    const documentos = await prisma.documentoEmitido.findMany({
      where: {
        instituicaoId,
        ...(alunoId && { alunoId: alunoId as string }),
        ...(tipoDocumentoId && { tipoDocumentoId: tipoDocumentoId as string }),
      },
      include: { tipoDocumentoRef: true, anoLetivo: { select: { ano: true } } },
      orderBy: { dataEmissao: 'desc' },
    });

    res.json(documentos);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtém documento por ID - somente do tenant
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const documento = await prisma.documentoEmitido.findFirst({
      where: { id, instituicaoId },
      include: { tipoDocumentoRef: true, anoLetivo: { select: { ano: true } } },
    });

    if (!documento) {
      throw new AppError('Documento não encontrado', 404);
    }

    res.json(documento);
  } catch (error) {
    next(error);
  }
};

/**
 * Create - DEPRECADO: Use POST /documentos/emitir ou /documentos/emitir-json
 * Mantido para compatibilidade; cria registro mínimo (preferir documentoOficial.emitir)
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const data = req.body;

    if (!data.alunoId) {
      throw new AppError('alunoId é obrigatório', 400);
    }

    const { getProximoNumeroDocumento, generateCodigoVerificacao } = await import('../services/documento.service.js');
    const numeroDocumento = data.numeroDocumento || await getProximoNumeroDocumento(instituicaoId, 'DECLARACAO_MATRICULA', '');
    const codigoVerificacao = data.codigoVerificacao || generateCodigoVerificacao();

    const documento = await prisma.documentoEmitido.create({
      data: {
        instituicaoId,
        tipoDocumento: data.tipoDocumento || 'DECLARACAO_MATRICULA',
        alunoId: data.alunoId,
        matriculaId: data.matriculaId,
        anoLetivoId: data.anoLetivoId,
        serie: data.serie ?? '',
        numeroDocumento,
        codigoVerificacao,
        status: 'ATIVO',
        emitidoPor: userId,
        observacoes: data.observacoes,
        dadosAdicionais: data.dadosAdicionais,
      },
      include: { tipoDocumentoRef: true },
    });
    res.status(201).json(documento);
  } catch (error) {
    next(error);
  }
};

export const gerarNumero = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { getProximoNumeroDocumento } = await import('../services/documento.service.js');
    const numero = await getProximoNumeroDocumento(instituicaoId, 'DECLARACAO_MATRICULA', '');
    res.json({ numero });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove - DEPRECADO: Use POST /documentos/:id/anular
 * REGRA SIGAE: Não deletar; apenas anular
 */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const { id } = req.params;

    const documento = await prisma.documentoEmitido.findFirst({
      where: { id, instituicaoId },
    });

    if (!documento) {
      throw new AppError('Documento não encontrado', 404);
    }

    await prisma.documentoEmitido.update({
      where: { id },
      data: {
        status: 'ANULADO',
        motivoAnulacao: 'Anulado via endpoint legado',
        anuladoPor: userId,
        anuladoEm: new Date(),
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
