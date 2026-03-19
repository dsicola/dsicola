/**
 * Controller de geração de documentos (DOCX, PDF).
 * Endpoints:
 * - POST /documents/generate-docx
 * - POST /documents/generate-pdf-form
 * - POST /documents/generate-pdf-coordinates
 * - POST /documents/extract-docx-placeholders
 * - POST /documents/preview-docx
 * Multi-tenant: instituicaoId do JWT.
 */
import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../middlewares/auth.js';
import { generateDocxFromTemplate, convertDocxToPdf } from '../services/docxDocument.service.js';
import { extractPlaceholdersAndLoopsFromDocx } from '../services/templateRender.service.js';
import { generateBlankCertificateDocx } from '../services/blankCertificateTemplate.service.js';
import { fillPdfFormFields, fillPdfWithCoordinates, extractFormFieldsFromPdf } from '../services/pdfTemplate.service.js';
import type { PdfFormMapping, PdfCoordinateMapping } from '../services/pdfTemplate.service.js';
import {
  getCamposValidosDocx,
  validarMapeamentosCampos,
  CAMPO_VAZIO,
  PREFIXO_VALOR_FIXO,
} from '../services/availableFields.service.js';

const MAX_TEMPLATE_BASE64_LENGTH = 15 * 1024 * 1024; // 15 MB

function validateTemplateSize(base64: string): void {
  if (base64.length > MAX_TEMPLATE_BASE64_LENGTH) {
    throw new AppError('Template demasiado grande (máx. 15 MB)', 400);
  }
}

/** Dados mock para preview DOCX */
const MOCK_DATA_PREVIEW: Record<string, unknown> = {
  student: {
    fullName: 'João da Silva',
    birthDate: '15/03/2000',
    gender: 'M',
    bi: '123456789LA123',
    numeroEstudante: '2024001',
    email: 'joao@exemplo.ao',
    curso: 'Engenharia Informática',
    classe: '12ª Classe',
    turma: '12-A',
    anoLetivo: '2024/2025',
  },
  instituicao: {
    nome: 'Instituto Superior de Tecnologia',
    nif: '123456789',
    endereco: 'Luanda, Angola',
  },
  document: {
    number: 'DOC-2024-001',
    codigoVerificacao: 'ABC123XYZ',
    dataEmissao: new Date().toLocaleDateString('pt-AO'),
    tipo: 'CERTIFICADO',
  },
  turma: { nome: '12-A' },
  alunos: [
    { fullName: 'João Silva', birthDate: '15/03/2000' },
    { fullName: 'Maria Santos', birthDate: '20/05/1999' },
  ],
};

/** POST /documents/generate-docx */
export const generateDocx = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) throw new AppError('Token inválido', 401);

    const { templateId, data, outputFormat } = req.body || {};
    if (!templateId && !req.body?.templateBase64) {
      throw new AppError('templateId ou templateBase64 é obrigatório', 400);
    }

    let buffer: Buffer;
    let orientacaoPagina: string | null = null;

    if (templateId) {
      const modelo = await prisma.modeloDocumento.findFirst({
        where: { id: templateId, instituicaoId: instituicaoId.trim(), ativo: true },
        include: { templateMappings: true },
      });
      if (!modelo) throw new AppError('Modelo não encontrado ou inativo', 404);
      const docxBase64 = modelo.docxTemplateBase64;
      if (!docxBase64?.trim()) throw new AppError('Modelo não possui ficheiro DOCX', 400);

      const templateBuf = Buffer.from(docxBase64, 'base64');
      let templateData = (data ?? {}) as Record<string, unknown>;
      if (modelo.templateMappings?.length) {
        const mappingsList = modelo.templateMappings.map((m) => ({ campoTemplate: m.campoTemplate, campoSistema: m.campoSistema }));
        const validPaths = getCamposValidosDocx();
        const invalidos = validarMapeamentosCampos(mappingsList, validPaths);
        if (invalidos.length > 0) {
          throw new AppError(`Campos inválidos: ${invalidos.join('; ')}`, 400);
        }
        const { placeholders: templatePlaceholders } = extractPlaceholdersAndLoopsFromDocx(templateBuf);
        const mappedSet = new Set(mappingsList.map((m) => m.campoTemplate));
        const unmapped = templatePlaceholders.filter((p) => !mappedSet.has(p));
        if (unmapped.length > 0) {
          throw new AppError(
            `Placeholders não mapeados. Mapeie ou remova do template: ${unmapped.map((p) => `{{${p}}}`).join(', ')}`,
            400
          );
        }
        const result: Record<string, string> = {};
        for (const m of mappingsList) {
          const val = getValueByPath(templateData, m.campoSistema);
          result[m.campoTemplate] = val ?? '';
        }
        templateData = { ...templateData, ...result };
      }
      buffer = generateDocxFromTemplate(templateBuf, templateData);
      orientacaoPagina = modelo.orientacaoPagina;
    } else {
      const templateBase64 = req.body?.templateBase64;
      if (!templateBase64?.trim()) throw new AppError('templateBase64 é obrigatório quando templateId não é fornecido', 400);
      validateTemplateSize(templateBase64);
      const templateBuf = Buffer.from(templateBase64, 'base64');
      buffer = generateDocxFromTemplate(templateBuf, (data ?? {}) as Record<string, unknown>);
    }

    if (outputFormat === 'pdf') {
      const landscape = orientacaoPagina === 'PAISAGEM';
      const pdfBuf = await convertDocxToPdf(buffer, landscape);
      if (pdfBuf) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="documento.pdf"');
        return res.send(pdfBuf);
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="documento.docx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

function getValueByPath(obj: Record<string, unknown>, path: string): string {
  if (path === CAMPO_VAZIO) return '';
  if (path.startsWith(PREFIXO_VALOR_FIXO)) return path.slice(PREFIXO_VALOR_FIXO.length);
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[p];
  }
  return current == null ? '' : String(current);
}

/** POST /documents/generate-pdf-form */
export const generatePdfForm = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) throw new AppError('Token inválido', 401);

    const { templateId, templateBase64, mapping, data } = req.body || {};
    const hasModelo = templateId && !templateBase64;
    const hasInline = templateBase64 && mapping;

    if (!hasModelo && !hasInline) {
      throw new AppError('templateId ou (templateBase64 + mapping) é obrigatório', 400);
    }

    let pdfBase64: string;
    let mappingObj: PdfFormMapping;
    let templateData: Record<string, unknown>;

    if (hasModelo) {
      const modelo = await prisma.modeloDocumento.findFirst({
        where: { id: templateId, instituicaoId: instituicaoId.trim(), ativo: true },
      });
      if (!modelo) throw new AppError('Modelo não encontrado', 404);
      const b64 = (modelo as { pdfTemplateBase64?: string }).pdfTemplateBase64;
      if (!b64?.trim()) throw new AppError('Modelo não possui PDF', 400);
      const mj = (modelo as { pdfMappingJson?: string }).pdfMappingJson;
      if (!mj?.trim()) throw new AppError('Modelo PDF sem mapeamento (FORM_FIELDS)', 400);
      pdfBase64 = b64;
      try {
        mappingObj = JSON.parse(mj) as PdfFormMapping;
      } catch {
        throw new AppError('pdfMappingJson inválido', 400);
      }
      templateData = (data ?? {}) as Record<string, unknown>;
    } else {
      validateTemplateSize(templateBase64);
      mappingObj = mapping as PdfFormMapping;
      if (!mappingObj || typeof mappingObj !== 'object') throw new AppError('mapping inválido', 400);
      templateData = (data ?? {}) as Record<string, unknown>;
      pdfBase64 = templateBase64;
    }

    const buf = await fillPdfFormFields(pdfBase64, templateData, mappingObj);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento.pdf"');
    res.send(buf);
  } catch (error) {
    next(error);
  }
};

/** POST /documents/generate-pdf-coordinates */
export const generatePdfCoordinates = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) throw new AppError('Token inválido', 401);

    const { templateId, templateBase64, mapping, data } = req.body || {};
    const hasModelo = templateId && !templateBase64;
    const hasInline = templateBase64 && mapping;

    if (!hasModelo && !hasInline) {
      throw new AppError('templateId ou (templateBase64 + mapping) é obrigatório', 400);
    }

    let pdfBase64: string;
    let mappingObj: PdfCoordinateMapping;
    let templateData: Record<string, unknown>;

    if (hasModelo) {
      const modelo = await prisma.modeloDocumento.findFirst({
        where: { id: templateId, instituicaoId: instituicaoId.trim(), ativo: true },
      });
      if (!modelo) throw new AppError('Modelo não encontrado', 404);
      const b64 = (modelo as { pdfTemplateBase64?: string }).pdfTemplateBase64;
      if (!b64?.trim()) throw new AppError('Modelo não possui PDF', 400);
      const mj = (modelo as { pdfMappingJson?: string }).pdfMappingJson;
      if (!mj?.trim()) throw new AppError('Modelo PDF sem mapeamento (COORDINATES)', 400);
      pdfBase64 = b64;
      try {
        mappingObj = JSON.parse(mj) as PdfCoordinateMapping;
      } catch {
        throw new AppError('pdfMappingJson inválido', 400);
      }
      templateData = (data ?? {}) as Record<string, unknown>;
    } else {
      validateTemplateSize(templateBase64);
      mappingObj = mapping as PdfCoordinateMapping;
      if (!mappingObj?.items?.length) throw new AppError('mapping.items é obrigatório', 400);
      templateData = (data ?? {}) as Record<string, unknown>;
      pdfBase64 = templateBase64;
    }

    const buf = await fillPdfWithCoordinates(pdfBase64, templateData, mappingObj);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento.pdf"');
    res.send(buf);
  } catch (error) {
    next(error);
  }
};

/** GET /documents/modelo-certificado-blank — DOCX em branco com placeholders já prontos (para utilizadores não técnicos) */
export const getModeloCertificadoBlank = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const buffer = generateBlankCertificateDocx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="modelo-certificado-blank.docx"');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/** POST /documents/extract-docx-placeholders */
export const extractDocxPlaceholders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { docxTemplateBase64, file } = req.body || {};
    const fileBuf = (req as any).file?.buffer;
    let buffer: Buffer;
    if (fileBuf) {
      buffer = fileBuf;
    } else if (docxTemplateBase64 && typeof docxTemplateBase64 === 'string' && docxTemplateBase64.trim()) {
      validateTemplateSize(docxTemplateBase64);
      buffer = Buffer.from(docxTemplateBase64, 'base64');
    } else {
      throw new AppError('Envie docxTemplateBase64 no body ou ficheiro (file) no form-data', 400);
    }
    const { placeholders, loops } = extractPlaceholdersAndLoopsFromDocx(buffer);
    res.json({ placeholders, loops });
  } catch (error) {
    next(error);
  }
};

/** POST /documents/extract-pdf-fields - Extrair campos de formulário do PDF (AcroForm) */
export const extractPdfFields = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) throw new AppError('Token inválido', 401);

    const { pdfTemplateBase64 } = req.body || {};
    const fileBuf = (req as any).file?.buffer;
    let buffer: Buffer;
    if (fileBuf) {
      if (fileBuf.length > MAX_TEMPLATE_BASE64_LENGTH) throw new AppError('Template demasiado grande (máx. 15 MB)', 400);
      buffer = fileBuf;
    } else if (pdfTemplateBase64 && typeof pdfTemplateBase64 === 'string' && pdfTemplateBase64.trim()) {
      validateTemplateSize(pdfTemplateBase64);
      buffer = Buffer.from(pdfTemplateBase64, 'base64');
    } else {
      throw new AppError('Envie pdfTemplateBase64 no body ou ficheiro (file) no form-data', 400);
    }
    const base64 = buffer.toString('base64');
    const fields = await extractFormFieldsFromPdf(base64);
    res.json({ fields });
  } catch (error) {
    next(error);
  }
};

/** POST /documents/preview-docx */
export const previewDocx = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) throw new AppError('Token inválido', 401);

    const { templateId, templateBase64, mockData } = req.body || {};
    const data = (mockData ?? MOCK_DATA_PREVIEW) as Record<string, unknown>;

    let buffer: Buffer;
    if (templateId) {
      const modelo = await prisma.modeloDocumento.findFirst({
        where: { id: templateId, instituicaoId: instituicaoId.trim(), ativo: true },
        include: { templateMappings: true },
      });
      if (!modelo) throw new AppError('Modelo não encontrado', 404);
      const docxBase64 = modelo.docxTemplateBase64;
      if (!docxBase64?.trim()) throw new AppError('Modelo não possui DOCX', 400);
      const templateBuf = Buffer.from(docxBase64, 'base64');
      let templateData = data;
      if (modelo.templateMappings?.length) {
        const result: Record<string, string> = {};
        for (const m of modelo.templateMappings) {
          result[m.campoTemplate] = getValueByPath(data, m.campoSistema) ?? '';
        }
        templateData = { ...data, ...result };
      }
      buffer = generateDocxFromTemplate(templateBuf, templateData as Record<string, unknown>);
    } else if (templateBase64?.trim()) {
      validateTemplateSize(templateBase64);
      buffer = generateDocxFromTemplate(Buffer.from(templateBase64, 'base64'), data);
    } else {
      throw new AppError('templateId ou templateBase64 é obrigatório', 400);
    }

    res.json({ docxBase64: buffer.toString('base64') });
  } catch (error) {
    next(error);
  }
};
