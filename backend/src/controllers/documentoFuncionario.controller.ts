import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, AuthenticatedRequest, getInstituicaoIdFromFilter } from '../middlewares/auth.js';
import { AuditService } from '../services/audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';
import { parseArquivoUrlToStorage, getSecureUploadPath } from '../utils/parseArquivoUrl.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { funcionarioId } = req.query;
    const where: any = {};
    if (filter.instituicaoId) {
      where.funcionario = { instituicaoId: filter.instituicaoId };
    }
    if (funcionarioId) where.funcionarioId = funcionarioId as string;

    const documentos = await prisma.documentoFuncionario.findMany({
      where,
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
    const filter = addInstitutionFilter(req);
    const { id } = req.params;
    const documento = await prisma.documentoFuncionario.findUnique({
      where: { id },
      include: { funcionario: true },
    });
    if (!documento) throw new AppError('O documento solicitado não foi encontrado.', 404);
    if (filter.instituicaoId && documento.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este documento', 403);
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
      throw new AppError('É necessário preencher: funcionário, tipo de documento, nome do ficheiro e URL. Verifique os dados e tente novamente.', 400);
    }

    // Validar que o funcionário pertence à instituição do utilizador (multi-tenant)
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: { instituicaoId: true },
    });

    if (!funcionario) {
      throw new AppError('O funcionário indicado não foi encontrado.', 404);
    }

    const authReq = req as AuthenticatedRequest;
    const userInstituicaoId = authReq.user?.instituicaoId;
    if (funcionario.instituicaoId && userInstituicaoId && funcionario.instituicaoId !== userInstituicaoId) {
      throw new AppError('Não tem permissão: o funcionário não pertence à sua instituição.', 403);
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

    await AuditService.log(req, {
      modulo: ModuloAuditoria.RECURSOS_HUMANOS,
      acao: AcaoAuditoria.CREATE,
      entidade: EntidadeAuditoria.DOCUMENTO_FUNCIONARIO,
      entidadeId: documento.id,
      dadosNovos: { funcionarioId: documento.funcionarioId, tipoDocumento: documento.tipoDocumento, nomeArquivo: documento.nomeArquivo },
      instituicaoId: funcionario.instituicaoId ?? undefined,
    }).catch((err) => console.error('[documentoFuncionario.create] Erro audit:', err?.message));

    res.status(201).json(documento);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;
    const doc = await prisma.documentoFuncionario.findUnique({
      where: { id },
      include: { funcionario: { select: { instituicaoId: true } } },
    });
    if (!doc) throw new AppError('Documento não encontrado', 404);
    if (filter.instituicaoId && doc.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado', 403);
    }
    await prisma.documentoFuncionario.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getArquivoSignedUrl = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const doc = await prisma.documentoFuncionario.findUnique({
      where: { id },
      include: { funcionario: { select: { instituicaoId: true } } },
    });
    if (!doc || !doc.arquivoUrl) throw new AppError('Documento ou arquivo não encontrado', 404);
    if (filter.instituicaoId && doc.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este documento', 403);
    }
    const parsed = parseArquivoUrlToStorage(doc.arquivoUrl);
    if (!parsed) throw new AppError('URL do arquivo inválida', 400);
    const { getBaseUrlForSignedUrl } = await import('../utils/baseUrlForSignedUrl.js');
    const baseUrl = getBaseUrlForSignedUrl(req);
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : (req.query.token as string) || '';
    res.json({ url: `${baseUrl}/documentos-funcionario/${id}/arquivo?token=${encodeURIComponent(token)}` });
  } catch (error) {
    next(error);
  }
};

export const getArquivo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const doc = await prisma.documentoFuncionario.findUnique({
      where: { id },
      include: { funcionario: { select: { instituicaoId: true } } },
    });
    if (!doc || !doc.arquivoUrl) throw new AppError('Documento ou arquivo não encontrado', 404);
    if (filter.instituicaoId && doc.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este documento', 403);
    }
    const parsed = parseArquivoUrlToStorage(doc.arquivoUrl);
    if (!parsed) throw new AppError('URL do arquivo inválida', 400);
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const fullPath = getSecureUploadPath(parsed.bucket, parsed.relPath, uploadsDir);
    if (!fullPath || !fs.existsSync(fullPath)) throw new AppError('Arquivo não encontrado', 404);
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) throw new AppError('Caminho inválido', 400);
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const download = req.query.download === 'true' || req.query.download === '1';
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', download
      ? `attachment; filename="${encodeURIComponent(doc.nomeArquivo || path.basename(fullPath))}"`
      : `inline; filename="${encodeURIComponent(doc.nomeArquivo || path.basename(fullPath))}"`);
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    next(error);
  }
};
