/**
 * Endpoints de templates dinâmicos (DOCX + mapeamento).
 * POST /templates/upload, POST /templates/:id/mapping, GET /templates/available-fields, POST /templates/:id/render
 * Multi-tenant: instituicaoId do JWT.
 */
import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../middlewares/auth.js';
import { listarCamposDisponiveis } from '../services/availableFields.service.js';
import { renderTemplate, extractPlaceholdersFromDocx } from '../services/templateRender.service.js';
import { resolveEntityData } from '../services/templateDataResolver.service.js';

const TIPOS_TEMPLATE = ['MINI_PAUTA', 'PAUTA_CONCLUSAO', 'CERTIFICADO', 'DECLARACAO_MATRICULA', 'DECLARACAO_FREQUENCIA', 'BOLETIM', 'RELATORIO', 'DOCUMENTO_OFICIAL'] as const;

/** POST /configuracoes-instituicao/templates/upload - Upload DOCX */
export const uploadTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) throw new AppError('Token inválido', 401);

    const file = (req as any).file;
    if (!file || !file.buffer) throw new AppError('Envie um ficheiro DOCX (campo: file)', 400);

    const { nome, tipo, tipoAcademico } = req.body || {};
    if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
      throw new AppError('nome é obrigatório', 400);
    }
    const tipoValido = tipo && TIPOS_TEMPLATE.includes(tipo) ? tipo : 'DOCUMENTO_OFICIAL';
    const tipoAcad = tipoAcademico === 'SUPERIOR' || tipoAcademico === 'SECUNDARIO' ? tipoAcademico : null;

    const docxBase64 = file.buffer.toString('base64');
    let placeholders: string[];
    try {
      placeholders = extractPlaceholdersFromDocx(file.buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Formato inválido';
      throw new AppError(
        `O ficheiro deve ser um DOCX válido (.docx). Ficheiros .doc antigos não são suportados. Verifique se o formato está correto. Detalhe: ${msg}`,
        400
      );
    }
    const placeholdersJson = JSON.stringify(placeholders);

    const modelo = await prisma.modeloDocumento.create({
      data: {
        instituicaoId: instituicaoId.trim(),
        tipo: tipoValido,
        tipoAcademico: tipoAcad,
        nome: nome.trim(),
        descricao: `Modelo DOCX importado. Placeholders: ${placeholders.join(', ') || 'nenhum detectado'}`,
        htmlTemplate: '',
        formatoDocumento: 'WORD',
        docxTemplateBase64: docxBase64,
        templatePlaceholdersJson: placeholdersJson,
        ativo: true,
      },
      include: { curso: true },
    });

    res.status(201).json({
      ...modelo,
      placeholders,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /configuracoes-instituicao/modelos-documento/:id/mapping - Salvar mapeamentos */
export const saveMapping = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    if (!instituicaoId?.trim() || !id) throw new AppError('Token ou ID inválido', 401);

    const existing = await prisma.modeloDocumento.findFirst({
      where: { id, instituicaoId: instituicaoId.trim() },
    });
    if (!existing) throw new AppError('Modelo não encontrado', 404);

    const { mappings } = req.body || {};
    if (!Array.isArray(mappings)) throw new AppError('mappings deve ser um array', 400);

    await prisma.templateMapping.deleteMany({ where: { modeloDocumentoId: id } });

    if (mappings.length > 0) {
      await prisma.templateMapping.createMany({
        data: mappings
          .filter((m: any) => m?.campo_template && m?.campo_sistema)
          .map((m: any) => ({
            modeloDocumentoId: id,
            campoTemplate: String(m.campo_template).trim(),
            campoSistema: String(m.campo_sistema).trim(),
          })),
        skipDuplicates: true,
      });
    }

    const updated = await prisma.modeloDocumento.findUnique({
      where: { id },
      include: { templateMappings: true },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/** GET /configuracoes-instituicao/templates/available-fields */
export const getAvailableFields = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const fields = listarCamposDisponiveis();
    res.json(fields.map((f) => f.caminho));
  } catch (error) {
    next(error);
  }
};

/** POST /configuracoes-instituicao/modelos-documento/:id/render - Gerar documento */
export const renderDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    if (!instituicaoId?.trim() || !id) throw new AppError('Token ou ID inválido', 401);

    const { entityId, entityType, outputFormat } = req.body || {};
    if (!entityId || !entityType) {
      throw new AppError('entityId e entityType são obrigatórios', 400);
    }

    const data = await resolveEntityData(entityId, entityType as any, instituicaoId.trim());
    const { buffer, format } = await renderTemplate({
      modeloDocumentoId: id,
      instituicaoId: instituicaoId.trim(),
      data,
      outputFormat: outputFormat === 'pdf' ? 'pdf' : 'docx',
    });

    const contentType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const ext = format === 'pdf' ? 'pdf' : 'docx';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="documento-${id}.${ext}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};
