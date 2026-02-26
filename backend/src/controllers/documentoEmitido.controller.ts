import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';

/**
 * Lista documentos - multi-tenant. ALUNO: só próprios; ADMIN/SECRETARIA: todos.
 */
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const roles = (req.user?.roles ?? []) as string[];
    const { alunoId, tipoDocumentoId } = req.query;

    const isAlunoOnly = roles.includes('ALUNO') && !roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN') && !roles.includes('SECRETARIA');
    const effectiveAlunoId = isAlunoOnly ? userId : (alunoId as string | undefined);

    const documentos = await prisma.documentoEmitido.findMany({
      where: {
        instituicaoId,
        ...(effectiveAlunoId && { alunoId: effectiveAlunoId }),
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
 * Obtém documento por ID. ALUNO só pode ver os próprios.
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const roles = (req.user?.roles ?? []) as string[];
    const { id } = req.params;

    const documento = await prisma.documentoEmitido.findFirst({
      where: { id, instituicaoId },
      include: { tipoDocumentoRef: true, anoLetivo: { select: { ano: true } } },
    });

    if (!documento) {
      throw new AppError('Documento não encontrado', 404);
    }

    const isAlunoOnly = roles.includes('ALUNO') && !roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN') && !roles.includes('SECRETARIA');
    if (isAlunoOnly && documento.alunoId !== userId) {
      throw new AppError('Só pode consultar os seus próprios documentos', 403);
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

    const tipoDoc = (data.tipoDocumento || 'DECLARACAO_MATRICULA') as string;
    const isCertificado = tipoDoc === 'CERTIFICADO' || !!(data.dadosAdicionais as any)?.tipo_certificado;
    if (isCertificado) {
      const roles = (req.user?.roles ?? []) as string[];
      if (!roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN')) {
        throw new AppError('Apenas administradores podem emitir certificados', 403);
      }
    }

    const { getProximoNumeroDocumento, generateCodigoVerificacao } = await import('../services/documento.service.js');
    const numeroDocumento = data.numeroDocumento || await getProximoNumeroDocumento(instituicaoId, 'DECLARACAO_MATRICULA', '');
    const codigoVerificacao = data.codigoVerificacao || generateCodigoVerificacao();

    const documento = await prisma.documentoEmitido.create({
      data: {
        instituicaoId,
        tipoDocumento: tipoDoc,
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

    await AuditService.log(req, {
      modulo: ModuloAuditoria.DOCUMENTOS_OFICIAIS,
      entidade: EntidadeAuditoria.DOCUMENTO_EMITIDO,
      acao: AcaoAuditoria.CREATE,
      entidadeId: documento.id,
      dadosNovos: { tipoDocumento: tipoDoc, numeroDocumento, alunoId: data.alunoId },
      observacao: `Documento ${tipoDoc} nº ${numeroDocumento} emitido (legado)`,
    }).catch((err) => console.error('[documentoEmitido.create] Erro auditoria:', err));

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
