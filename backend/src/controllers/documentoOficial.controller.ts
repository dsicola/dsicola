/**
 * Controller de Documentos Oficiais - Padrão SIGAE
 *
 * REGRAS:
 * - instituicaoId SEMPRE do JWT (nunca do frontend)
 * - Emitir: ADMIN/SECRETARIA
 * - Anular: ADMIN/SECRETARIA
 * - Professor NÃO emite documentos oficiais
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { geraDocumento, validarEmissaoDocumento, TIPOS_DOCUMENTO_SIGAE, TipoDocumentoSigae } from '../services/documento.service.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';

/**
 * POST /documentos/emitir
 * Body: { tipoDocumento, estudanteId, matriculaId? }
 * instituicaoId do JWT
 */
export const emitir = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Não autenticado', 401);

    const { tipoDocumento, estudanteId, matriculaId, anoLetivoId, observacao } = req.body;

    if (!tipoDocumento || !estudanteId) {
      throw new AppError('tipoDocumento e estudanteId são obrigatórios', 400);
    }

    if (!TIPOS_DOCUMENTO_SIGAE.includes(tipoDocumento as TipoDocumentoSigae)) {
      throw new AppError(`Tipo de documento inválido. Tipos permitidos: ${TIPOS_DOCUMENTO_SIGAE.join(', ')}`, 400);
    }

    const tipoAcademico = req.user?.tipoAcademico ?? null;
    const resultado = await geraDocumento(
      tipoDocumento as TipoDocumentoSigae,
      estudanteId,
      instituicaoId,
      userId,
      tipoAcademico,
      { matriculaId, anoLetivoId, observacao }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="documento-${resultado.numeroDocumento}.pdf"`);
    res.status(200).send(resultado.pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /documentos/emitir (retorna JSON com documento + link para download)
 * Alternativa: retornar JSON em vez de PDF direto (para UI mostrar prévia)
 */
export const emitirJson = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Não autenticado', 401);

    const { tipoDocumento, estudanteId, matriculaId, anoLetivoId, observacao } = req.body;

    if (!tipoDocumento || !estudanteId) {
      throw new AppError('tipoDocumento e estudanteId são obrigatórios', 400);
    }

    if (!TIPOS_DOCUMENTO_SIGAE.includes(tipoDocumento as TipoDocumentoSigae)) {
      throw new AppError(`Tipo de documento inválido. Tipos permitidos: ${TIPOS_DOCUMENTO_SIGAE.join(', ')}`, 400);
    }

    const tipoAcademico = req.user?.tipoAcademico ?? null;
    const resultado = await geraDocumento(
      tipoDocumento as TipoDocumentoSigae,
      estudanteId,
      instituicaoId,
      userId,
      tipoAcademico,
      { matriculaId, anoLetivoId, observacao }
    );

    await AuditService.log(req, {
      modulo: ModuloAuditoria.DOCUMENTOS_OFICIAIS,
      entidade: EntidadeAuditoria.DOCUMENTO_EMITIDO,
      acao: AcaoAuditoria.CREATE,
      entidadeId: resultado.id,
      dadosNovos: { tipoDocumento, numeroDocumento: resultado.numeroDocumento, alunoId: estudanteId },
    });

    res.status(201).json({
      id: resultado.id,
      numeroDocumento: resultado.numeroDocumento,
      codigoVerificacao: resultado.codigoVerificacao,
      mensagem: 'Documento emitido com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pré-validação para emissão (prévia na UI)
 */
export const preValidar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { tipoDocumento, estudanteId, anoLetivoId } = req.query;

    if (!tipoDocumento || !estudanteId) {
      return res.status(200).json({ valido: false, erro: 'tipoDocumento e estudanteId são obrigatórios' });
    }

    const tipoAcademico = req.user?.tipoAcademico ?? null;
    const validacao = await validarEmissaoDocumento(
      tipoDocumento as TipoDocumentoSigae,
      estudanteId as string,
      instituicaoId,
      tipoAcademico,
      anoLetivoId as string | undefined
    );

    res.status(200).json(validacao);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /documentos/:id
 * Somente do tenant
 */
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const documento = await prisma.documentoEmitido.findFirst({
      where: { id, instituicaoId },
      include: {
        instituicao: { select: { nome: true } },
        anoLetivo: { select: { ano: true } },
      },
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
 * GET /documentos?estudanteId=...
 * Lista documentos do tenant, opcionalmente filtrados por estudante
 */
export const listar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { estudanteId } = req.query;

    const documentos = await prisma.documentoEmitido.findMany({
      where: {
        instituicaoId,
        ...(estudanteId && { alunoId: estudanteId as string }),
      },
      orderBy: { dataEmissao: 'desc' },
      include: {
        anoLetivo: { select: { ano: true } },
      },
    });

    res.json(documentos);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /documentos/:id/anular
 * Body: { motivo }
 */
export const anular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Não autenticado', 401);

    const { id } = req.params;
    const { motivo } = req.body;

    const documento = await prisma.documentoEmitido.findFirst({
      where: { id, instituicaoId },
    });

    if (!documento) {
      throw new AppError('Documento não encontrado', 404);
    }

    if (documento.status === 'ANULADO') {
      throw new AppError('Documento já está anulado', 400);
    }

    await prisma.documentoEmitido.update({
      where: { id },
      data: {
        status: 'ANULADO',
        motivoAnulacao: motivo || 'Anulado por solicitação',
        anuladoPor: userId,
        anuladoEm: new Date(),
      },
    });

    await AuditService.log(req, {
      modulo: ModuloAuditoria.DOCUMENTOS_OFICIAIS,
      entidade: EntidadeAuditoria.DOCUMENTO_EMITIDO,
      acao: AcaoAuditoria.ANULAR,
      entidadeId: id,
      dadosNovos: { motivo: motivo || 'Anulado por solicitação' },
    });

    res.json({ mensagem: 'Documento anulado com sucesso' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /documentos/verificar?codigo=...
 * Verificação pública - retorna apenas válido/inválido + nome parcial + data
 */
export const verificar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { codigo } = req.query;
    if (!codigo || typeof codigo !== 'string') {
      return res.status(200).json({ valido: false, mensagem: 'Código não fornecido' });
    }

    const documento = await prisma.documentoEmitido.findFirst({
      where: { codigoVerificacao: codigo.toUpperCase().trim(), status: 'ATIVO' },
      include: {
        instituicao: { select: { nome: true } },
      },
    });

    if (!documento) {
      return res.status(200).json({ valido: false, mensagem: 'Documento inválido ou anulado' });
    }

    const nomeCompleto = (documento.dadosAdicionais as any)?.estudante?.nomeCompleto ?? '';
    const nomeParcial = nomeCompleto
      ? nomeCompleto.split(' ').slice(0, 2).join(' ') + (nomeCompleto.split(' ').length > 2 ? ' ***' : '')
      : '***';

    res.status(200).json({
      valido: true,
      instituicao: documento.instituicao?.nome,
      nomeParcial,
      dataEmissao: documento.dataEmissao,
      tipoDocumento: documento.tipoDocumento,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /documentos/:id/pdf
 * Download do PDF do documento (se existir em dados_adicionais ou regenerar)
 */
export const downloadPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const documento = await prisma.documentoEmitido.findFirst({
      where: { id, instituicaoId },
    });

    if (!documento) {
      throw new AppError('Documento não encontrado', 404);
    }

    if (documento.status === 'ANULADO') {
      throw new AppError('Não é possível baixar documento anulado', 400);
    }

    const { geraDocumentoPDF } = await import('../services/documento.service.js');
    const payload = documento.dadosAdicionais as any;
    if (!payload) {
      throw new AppError('Dados do documento não disponíveis', 500);
    }
    const pdfBuffer = await geraDocumentoPDF(payload);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="documento-${documento.numeroDocumento}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
