/**
 * CRUD de Modelos de Documentos oficiais (certificados, declarações, pautas).
 * Permite importar modelos HTML do governo e vinculá-los por instituição/tipo/curso.
 * Multi-tenant: instituicaoId do JWT.
 */
import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import type { AuthenticatedRequest } from '../middlewares/auth.js';
import {
  extractPlaceholdersFromExcel,
  extractPlaceholdersFromExcelWithCellRefs,
  analyzeExcelTemplate,
  validateCellMapping,
} from '../services/excelTemplate.service.js';
import { extractFormFieldsFromPdf } from '../services/pdfTemplate.service.js';
import { extractPlaceholdersFromHtml } from '../services/documentoTemplateGeneric.service.js';

const TIPOS_VALIDOS = ['CERTIFICADO', 'DECLARACAO_MATRICULA', 'DECLARACAO_FREQUENCIA', 'BOLETIM', 'MINI_PAUTA', 'PAUTA_CONCLUSAO', 'RELATORIO', 'DOCUMENTO_OFICIAL'] as const;
const TIPOS_ACADEMICOS_VALIDOS = ['SUPERIOR', 'SECUNDARIO'] as const;
const ORIENTACOES_VALIDAS = ['RETRATO', 'PAISAGEM'] as const;
const EXCEL_MODES_VALIDOS = ['PLACEHOLDER', 'CELL_MAPPING'] as const;

/** Limite máximo do Excel em base64: 15 MB - previne DoS por upload de ficheiros gigantes */
const EXCEL_TEMPLATE_MAX_BASE64_LENGTH = 15 * 1024 * 1024;

function validateExcelTemplateSize(base64: string): void {
  if (base64.length > EXCEL_TEMPLATE_MAX_BASE64_LENGTH) {
    throw new AppError(
      `Modelo Excel demasiado grande (máx. 15 MB). Use um ficheiro mais pequeno.`,
      400
    );
  }
}

/** GET /configuracoes-instituicao/modelos-documento - Listar modelos da instituição */
export const listar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) {
      throw new AppError('Token inválido: ID de instituição inválido.', 401);
    }

    const { tipo, tipoAcademico } = req.query;
    const where: any = { instituicaoId: instituicaoId.trim() };
    if (tipo && typeof tipo === 'string' && TIPOS_VALIDOS.includes(tipo as any)) {
      where.tipo = tipo;
    }
    if (tipoAcademico && typeof tipoAcademico === 'string' && TIPOS_ACADEMICOS_VALIDOS.includes(tipoAcademico as any)) {
      where.tipoAcademico = tipoAcademico;
    }

    const modelos = await prisma.modeloDocumento.findMany({
      where,
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        templateMappings: { select: { id: true, campoTemplate: true, campoSistema: true } },
      },
      orderBy: [{ tipo: 'asc' }, { tipoAcademico: 'asc' }, { updatedAt: 'desc' }],
    });

    res.json(modelos);
  } catch (error) {
    next(error);
  }
};

/** GET /configuracoes-instituicao/modelos-documento/:id - Obter modelo por ID (inclui excelTemplateBase64 para edição/mapeamento) */
export const obter = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    if (!instituicaoId?.trim() || !id) {
      throw new AppError('Token ou ID inválido', 401);
    }

    const modelo = await prisma.modeloDocumento.findFirst({
      where: { id, instituicaoId: instituicaoId.trim() },
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        templateMappings: { select: { id: true, campoTemplate: true, campoSistema: true } },
      },
    });

    if (!modelo) {
      throw new AppError('Modelo não encontrado', 404);
    }

    res.json(modelo);
  } catch (error) {
    next(error);
  }
};

/** POST /configuracoes-instituicao/modelos-documento - Criar modelo */
export const criar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) {
      throw new AppError('Token inválido: ID de instituição inválido.', 401);
    }

    const { tipo, tipoAcademico, cursoId, nome, descricao, htmlTemplate, formatoDocumento, excelTemplateBase64, excelTemplateMode, excelCellMappingJson, docxTemplateBase64, pdfTemplateBase64, pdfTemplateMode, pdfMappingJson, templatePlaceholdersJson, orientacaoPagina, ativo } = req.body || {};

    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      throw new AppError(`tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}`, 400);
    }
    if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
      throw new AppError('nome é obrigatório', 400);
    }
    const isExcelModelo = tipo === 'BOLETIM' || tipo === 'PAUTA_CONCLUSAO' || tipo === 'MINI_PAUTA';
    const isDocx = docxTemplateBase64 && typeof docxTemplateBase64 === 'string' && docxTemplateBase64.trim().length > 0;
    const isPdf = pdfTemplateBase64 && typeof pdfTemplateBase64 === 'string' && pdfTemplateBase64.trim().length > 0;
    if (isExcelModelo) {
      if (!excelTemplateBase64 || typeof excelTemplateBase64 !== 'string' || excelTemplateBase64.trim().length === 0) {
        const label = tipo === 'BOLETIM' ? 'Boletim' : tipo === 'PAUTA_CONCLUSAO' ? 'Pauta de Conclusão' : 'Mini Pauta';
        throw new AppError(`Para ${label}, envie o modelo Excel do governo (excelTemplateBase64)`, 400);
      }
      validateExcelTemplateSize(excelTemplateBase64);
    } else if (!isDocx && !isPdf) {
      if (!htmlTemplate || typeof htmlTemplate !== 'string' || htmlTemplate.trim().length === 0) {
        throw new AppError('htmlTemplate é obrigatório para certificados e declarações (ou envie docxTemplateBase64 para DOCX, pdfTemplateBase64 para PDF)', 400);
      }
    }
    if (isPdf) {
      validateExcelTemplateSize(pdfTemplateBase64);
    }

    const tipoAcad = tipoAcademico && TIPOS_ACADEMICOS_VALIDOS.includes(tipoAcademico) ? tipoAcademico : null;

    if (cursoId) {
      const curso = await prisma.curso.findFirst({
        where: { id: cursoId, instituicaoId: instituicaoId.trim() },
      });
      if (!curso) {
        throw new AppError('Curso não encontrado ou não pertence à instituição', 404);
      }
    }

    let templatePlaceholders = templatePlaceholdersJson && typeof templatePlaceholdersJson === 'string' ? templatePlaceholdersJson : null;
    const modo = excelTemplateMode && EXCEL_MODES_VALIDOS.includes(excelTemplateMode as any) ? excelTemplateMode : 'PLACEHOLDER';
    if (isExcelModelo && excelTemplateBase64 && !templatePlaceholders && modo === 'PLACEHOLDER') {
      const placeholders = extractPlaceholdersFromExcel(excelTemplateBase64);
      if (placeholders.length > 0) templatePlaceholders = JSON.stringify(placeholders);
    }
    if (!templatePlaceholders && htmlTemplate?.trim() && !isExcelModelo && !isDocx && !isPdf) {
      const ph = extractPlaceholdersFromHtml(htmlTemplate);
      if (ph.length > 0) templatePlaceholders = JSON.stringify(ph);
    }

    const cellMapping = excelCellMappingJson && typeof excelCellMappingJson === 'string' && excelCellMappingJson.trim() ? excelCellMappingJson.trim() : null;
    const orientacao = orientacaoPagina === 'RETRATO' || orientacaoPagina === 'PAISAGEM' ? orientacaoPagina : null;

    const pdfMode = (pdfTemplateMode === 'COORDINATES' ? 'COORDINATES' : 'FORM_FIELDS') as string;
    const pdfMapping = pdfMappingJson && typeof pdfMappingJson === 'string' && pdfMappingJson.trim() ? pdfMappingJson.trim() : null;
    const createData: any = {
      instituicaoId: instituicaoId.trim(),
      tipo,
      tipoAcademico: tipoAcad,
      cursoId: cursoId && typeof cursoId === 'string' ? cursoId : null,
      nome: nome.trim(),
      descricao: descricao && typeof descricao === 'string' ? descricao.trim() : null,
      htmlTemplate: isExcelModelo || isDocx || isPdf ? '' : (htmlTemplate?.trim() || ''),
      formatoDocumento: formatoDocumento && typeof formatoDocumento === 'string' ? formatoDocumento : (isExcelModelo ? 'EXCEL' : isDocx ? 'WORD' : isPdf ? 'PDF' : null),
      excelTemplateBase64: isExcelModelo && excelTemplateBase64 ? excelTemplateBase64 : null,
      excelTemplateMode: isExcelModelo ? modo : null,
      excelCellMappingJson: isExcelModelo && cellMapping ? cellMapping : null,
      docxTemplateBase64: isDocx ? docxTemplateBase64 : null,
      pdfTemplateBase64: isPdf ? pdfTemplateBase64 : null,
      pdfTemplateMode: isPdf ? pdfMode : null,
      pdfMappingJson: isPdf ? pdfMapping : null,
      templatePlaceholdersJson: templatePlaceholders,
      orientacaoPagina: orientacao,
      ativo: ativo !== false,
    };

    const modelo = await prisma.modeloDocumento.create({
      data: createData,
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
      },
    });

    res.status(201).json(modelo);
  } catch (error) {
    next(error);
  }
};

/** PUT /configuracoes-instituicao/modelos-documento/:id - Atualizar modelo */
export const atualizar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    if (!instituicaoId?.trim() || !id) {
      throw new AppError('Token ou ID inválido', 401);
    }

    const existing = await prisma.modeloDocumento.findFirst({
      where: { id, instituicaoId: instituicaoId.trim() },
    });
    if (!existing) {
      throw new AppError('Modelo não encontrado', 404);
    }

    const { tipo, tipoAcademico, cursoId, nome, descricao, htmlTemplate, formatoDocumento, excelTemplateBase64, excelTemplateMode, excelCellMappingJson, docxTemplateBase64, pdfTemplateBase64, pdfTemplateMode, pdfMappingJson, templatePlaceholdersJson, orientacaoPagina, ativo } = req.body || {};

    const updateData: any = {};
    let extractedPlaceholdersFromHtml = false;
    if (tipo !== undefined) {
      if (!TIPOS_VALIDOS.includes(tipo)) {
        throw new AppError(`tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}`, 400);
      }
      updateData.tipo = tipo;
    }
    if (tipoAcademico !== undefined) {
      updateData.tipoAcademico = tipoAcademico && TIPOS_ACADEMICOS_VALIDOS.includes(tipoAcademico) ? tipoAcademico : null;
    }
    if (cursoId !== undefined) {
      if (cursoId) {
        const curso = await prisma.curso.findFirst({
          where: { id: cursoId, instituicaoId: instituicaoId.trim() },
        });
        if (!curso) {
          throw new AppError('Curso não encontrado ou não pertence à instituição', 404);
        }
        updateData.cursoId = cursoId;
      } else {
        updateData.cursoId = null;
      }
    }
    if (nome !== undefined) {
      if (typeof nome !== 'string' || nome.trim().length === 0) {
        throw new AppError('nome não pode ser vazio', 400);
      }
      updateData.nome = nome.trim();
    }
    if (descricao !== undefined) {
      updateData.descricao = descricao && typeof descricao === 'string' ? descricao.trim() : null;
    }
    if (htmlTemplate !== undefined) {
      const tipoAtual = updateData.tipo ?? existing.tipo;
      const isExcelModelo = tipoAtual === 'BOLETIM' || tipoAtual === 'PAUTA_CONCLUSAO' || tipoAtual === 'MINI_PAUTA';
      const isDocx = docxTemplateBase64 !== undefined ? docxTemplateBase64 : existing.docxTemplateBase64;
      const isPdf = pdfTemplateBase64 !== undefined ? pdfTemplateBase64 : existing.pdfTemplateBase64;
      if (!isExcelModelo && !isDocx && !isPdf && (typeof htmlTemplate !== 'string' || htmlTemplate.trim().length === 0)) {
        throw new AppError('htmlTemplate não pode ser vazio', 400);
      }
      updateData.htmlTemplate = isExcelModelo || isDocx || isPdf ? '' : (htmlTemplate?.trim() ?? '');
      // Sempre extrair placeholders do HTML ao guardar Cert/Decl (permite Mapear aparecer na secção Certificados)
      if (updateData.htmlTemplate && !isExcelModelo && !isDocx && !isPdf) {
        const ph = extractPlaceholdersFromHtml(updateData.htmlTemplate);
        if (ph.length > 0) {
          updateData.templatePlaceholdersJson = JSON.stringify(ph);
          extractedPlaceholdersFromHtml = true;
        }
      }
    }
    if (docxTemplateBase64 !== undefined) {
      updateData.docxTemplateBase64 = docxTemplateBase64 && typeof docxTemplateBase64 === 'string' ? docxTemplateBase64 : null;
    }
    if (templatePlaceholdersJson !== undefined && !extractedPlaceholdersFromHtml) {
      updateData.templatePlaceholdersJson = templatePlaceholdersJson && typeof templatePlaceholdersJson === 'string' ? templatePlaceholdersJson : null;
    }
    if (formatoDocumento !== undefined) {
      updateData.formatoDocumento = typeof formatoDocumento === 'string' ? formatoDocumento : null;
    }
    // Só atualizar excelTemplateBase64 quando ficheiro novo é enviado (não vazio).
    // Se vier "" ou undefined, preservar o existente — evita apagar o Excel ao guardar apenas o mapeamento.
    if (excelTemplateBase64 !== undefined && typeof excelTemplateBase64 === 'string' && excelTemplateBase64.trim()) {
      const tipoAtual = updateData.tipo ?? existing.tipo;
      const isExcelModelo = tipoAtual === 'BOLETIM' || tipoAtual === 'PAUTA_CONCLUSAO' || tipoAtual === 'MINI_PAUTA';
      if (isExcelModelo) {
        updateData.excelTemplateBase64 = excelTemplateBase64.trim();
        validateExcelTemplateSize(excelTemplateBase64);
        const modoAtual = updateData.excelTemplateMode ?? (existing as { excelTemplateMode?: string }).excelTemplateMode ?? 'PLACEHOLDER';
        if (modoAtual === 'PLACEHOLDER') {
          const placeholders = extractPlaceholdersFromExcel(excelTemplateBase64);
          if (placeholders.length > 0) updateData.templatePlaceholdersJson = JSON.stringify(placeholders);
        }
      }
    }
    if (excelTemplateMode !== undefined) {
      updateData.excelTemplateMode = excelTemplateMode && EXCEL_MODES_VALIDOS.includes(excelTemplateMode as any) ? excelTemplateMode : 'PLACEHOLDER';
    }
    if (excelCellMappingJson !== undefined) {
      updateData.excelCellMappingJson = excelCellMappingJson && typeof excelCellMappingJson === 'string' && excelCellMappingJson.trim() ? excelCellMappingJson.trim() : null;
    }
    if (docxTemplateBase64 !== undefined) {
      updateData.docxTemplateBase64 = docxTemplateBase64 && typeof docxTemplateBase64 === 'string' ? docxTemplateBase64 : null;
    }
    if (templatePlaceholdersJson !== undefined && !extractedPlaceholdersFromHtml) {
      updateData.templatePlaceholdersJson = templatePlaceholdersJson && typeof templatePlaceholdersJson === 'string' ? templatePlaceholdersJson : null;
    }
    if (pdfTemplateBase64 !== undefined) {
      const tipoAtual = updateData.tipo ?? existing.tipo;
      const isPdfModelo = tipoAtual === 'CERTIFICADO' || tipoAtual === 'DECLARACAO_MATRICULA' || tipoAtual === 'DECLARACAO_FREQUENCIA';
      updateData.pdfTemplateBase64 = isPdfModelo && pdfTemplateBase64 ? pdfTemplateBase64 : null;
      if (isPdfModelo && pdfTemplateBase64) validateExcelTemplateSize(pdfTemplateBase64);
    }
    if (pdfTemplateMode !== undefined) {
      updateData.pdfTemplateMode = pdfTemplateMode === 'COORDINATES' ? 'COORDINATES' : 'FORM_FIELDS';
    }
    if (pdfMappingJson !== undefined) {
      updateData.pdfMappingJson = pdfMappingJson && typeof pdfMappingJson === 'string' && pdfMappingJson.trim() ? pdfMappingJson.trim() : null;
    }
    if (orientacaoPagina !== undefined) {
      updateData.orientacaoPagina = orientacaoPagina === 'RETRATO' || orientacaoPagina === 'PAISAGEM' ? orientacaoPagina : null;
    }
    if (ativo !== undefined) {
      updateData.ativo = Boolean(ativo);
    }

    const modelo = await prisma.modeloDocumento.update({
      where: { id },
      data: updateData,
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
      },
    });

    res.json(modelo);
  } catch (error) {
    next(error);
  }
};

/** POST /configuracoes-instituicao/modelos-documento/extract-pdf-fields - Extrair campos de formulário do PDF (AcroForm) */
export const extractPdfFields = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { pdfTemplateBase64 } = req.body || {};
    if (!pdfTemplateBase64 || typeof pdfTemplateBase64 !== 'string' || !pdfTemplateBase64.trim()) {
      throw new AppError('pdfTemplateBase64 é obrigatório', 400);
    }
    validateExcelTemplateSize(pdfTemplateBase64);
    const fields = await extractFormFieldsFromPdf(pdfTemplateBase64);
    res.json({ fields });
  } catch (error) {
    next(error);
  }
};

/** POST /configuracoes-instituicao/modelos-documento/extract-excel-placeholders - Extrair placeholders com referência de células */
export const extractExcelPlaceholders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { excelTemplateBase64 } = req.body || {};
    if (!excelTemplateBase64 || typeof excelTemplateBase64 !== 'string' || !excelTemplateBase64.trim()) {
      throw new AppError('excelTemplateBase64 é obrigatório', 400);
    }
    validateExcelTemplateSize(excelTemplateBase64);
    const result = extractPlaceholdersFromExcelWithCellRefs(excelTemplateBase64);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** POST /configuracoes-instituicao/modelos-documento/analyze-excel-template - Analisar Excel e sugerir mapeamento */
export const analyzeExcelTemplateController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { excelTemplateBase64 } = req.body || {};
    if (!excelTemplateBase64 || typeof excelTemplateBase64 !== 'string' || !excelTemplateBase64.trim()) {
      throw new AppError('excelTemplateBase64 é obrigatório', 400);
    }
    validateExcelTemplateSize(excelTemplateBase64);
    const result = analyzeExcelTemplate(excelTemplateBase64);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** POST /configuracoes-instituicao/modelos-documento/preview-excel-cell-mapping - Preview Excel preenchido (Pauta Conclusão) */
export const previewExcelCellMappingController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { excelTemplateBase64, excelCellMappingJson, turmaId, format } = req.body || {};
    if (!excelTemplateBase64 || typeof excelTemplateBase64 !== 'string' || !excelTemplateBase64.trim()) {
      throw new AppError('excelTemplateBase64 é obrigatório', 400);
    }
    if (!excelCellMappingJson || typeof excelCellMappingJson !== 'string' || !excelCellMappingJson.trim()) {
      throw new AppError('excelCellMappingJson é obrigatório', 400);
    }
    validateExcelTemplateSize(excelTemplateBase64);
    const instituicaoId = requireTenantScope(req);
    if (!instituicaoId?.trim()) throw new AppError('Token inválido', 401);

    const { getPautaConclusaoSaudeDados } = await import('../services/pautaConclusaoSaude.service.js');
    const { fillExcelTemplateWithCellMapping } = await import('../services/excelTemplate.service.js');

    const dados = await getPautaConclusaoSaudeDados(instituicaoId.trim(), turmaId && typeof turmaId === 'string' ? turmaId : null);
    let mapping: import('../services/excelTemplate.service.js').ExcelCellMapping;
    try {
      mapping = JSON.parse(excelCellMappingJson) as import('../services/excelTemplate.service.js').ExcelCellMapping;
    } catch {
      throw new AppError('excelCellMappingJson inválido (JSON)', 400);
    }
    const buffer = fillExcelTemplateWithCellMapping(excelTemplateBase64, dados, mapping);

    if (format === 'pdf') {
      const { excelBufferToPdf } = await import('../services/excelToPdf.service.js');
      const pdfBuffer = await excelBufferToPdf(buffer, { landscape: true });
      if (pdfBuffer) {
        return res.json({ pdfBase64: pdfBuffer.toString('base64') });
      }
    }

    const excelBase64 = buffer.toString('base64');
    res.json({ excelBase64 });
  } catch (error) {
    next(error);
  }
};

/** POST /configuracoes-instituicao/modelos-documento/validate-cell-mapping - Validar mapeamento CELL_MAPPING */
export const validateCellMappingController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { excelCellMappingJson, excelTemplateBase64, disciplinas } = req.body || {};
    if (!excelCellMappingJson || typeof excelCellMappingJson !== 'string' || !excelCellMappingJson.trim()) {
      throw new AppError('excelCellMappingJson é obrigatório', 400);
    }
    let mapping: import('../services/excelTemplate.service.js').ExcelCellMapping;
    try {
      mapping = JSON.parse(excelCellMappingJson) as import('../services/excelTemplate.service.js').ExcelCellMapping;
    } catch {
      throw new AppError('excelCellMappingJson inválido (JSON)', 400);
    }
    if (excelTemplateBase64 && typeof excelTemplateBase64 === 'string' && excelTemplateBase64.trim()) {
      validateExcelTemplateSize(excelTemplateBase64);
    }
    const result = validateCellMapping(
      mapping,
      excelTemplateBase64 && typeof excelTemplateBase64 === 'string' ? excelTemplateBase64 : undefined,
      Array.isArray(disciplinas) ? disciplinas.filter((d: unknown) => typeof d === 'string') : undefined
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** DELETE /configuracoes-instituicao/modelos-documento/:id - Remover modelo */
export const remover = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    if (!instituicaoId?.trim() || !id) {
      throw new AppError('Token ou ID inválido', 401);
    }

    const existing = await prisma.modeloDocumento.findFirst({
      where: { id, instituicaoId: instituicaoId.trim() },
    });
    if (!existing) {
      throw new AppError('Modelo não encontrado', 404);
    }

    await prisma.modeloDocumento.delete({ where: { id } });
    res.json({ message: 'Modelo removido com sucesso' });
  } catch (error) {
    next(error);
  }
};

/** GET /configuracoes-instituicao/modelos-documento/placeholders - Listar placeholders suportados */
export const listarPlaceholders = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const placeholders = [
      { chave: 'NOME_ALUNO', descricao: 'Nome completo do estudante' },
      { chave: 'BI', descricao: 'Bilhete de identidade' },
      { chave: 'NUMERO_ESTUDANTE', descricao: 'Número de estudante' },
      { chave: 'CURSO', descricao: 'Nome do curso' },
      { chave: 'CLASSE', descricao: 'Classe (Ensino Secundário)' },
      { chave: 'TURMA', descricao: 'Turma' },
      { chave: 'ANO_LETIVO', descricao: 'Ano letivo' },
      { chave: 'N_DOCUMENTO', descricao: 'Número do documento' },
      { chave: 'CODIGO_VERIFICACAO', descricao: 'Código de verificação' },
      { chave: 'NOME_INSTITUICAO', descricao: 'Nome da instituição' },
      { chave: 'LOCALIDADE', descricao: 'Localidade' },
      { chave: 'DATA_EMISSAO', descricao: 'Data de emissão' },
      { chave: 'LOGO_IMG', descricao: 'Tag HTML do logo (img)' },
      { chave: 'IMAGEM_FUNDO_URL', descricao: 'URL da imagem de fundo (use em style="background-image: url({{IMAGEM_FUNDO_URL}})")' },
      { chave: 'MINISTERIO_SUPERIOR', descricao: 'Ministério (Ensino Superior)' },
      { chave: 'DECRETO_CRIACAO', descricao: 'Decreto de criação' },
      { chave: 'NOME_CHEFE_DAA', descricao: 'Nome do Chefe do DAA' },
      { chave: 'NOME_DIRECTOR_GERAL', descricao: 'Nome do Director Geral' },
      { chave: 'LOCALIDADE_CERTIFICADO', descricao: 'Localidade do certificado' },
      { chave: 'CARGO_ASSINATURA_1', descricao: 'Cargo da assinatura 1' },
      { chave: 'CARGO_ASSINATURA_2', descricao: 'Cargo da assinatura 2' },
      { chave: 'TEXTO_FECHO_CERTIFICADO', descricao: 'Texto de fecho' },
      { chave: 'TEXTO_RODAPE_CERTIFICADO', descricao: 'Texto de rodapé' },
      { chave: 'REPUBLICA_ANGOLA', descricao: 'República de Angola (Secundário)' },
      { chave: 'GOVERNO_PROVINCIA', descricao: 'Governo da Província (Secundário)' },
      { chave: 'ESCOLA_NOME_NUMERO', descricao: 'Nome e número da escola (Secundário)' },
      { chave: 'ENSINO_GERAL', descricao: 'Ensino Geral (Secundário)' },
      { chave: 'TITULO_CERTIFICADO_SECUNDARIO', descricao: 'Título do certificado (Secundário)' },
      { chave: 'TEXTO_FECHO_CERTIFICADO_SECUNDARIO', descricao: 'Texto de fecho (Secundário)' },
      { chave: 'CARGO_ASSINATURA_1_SECUNDARIO', descricao: 'Cargo assinatura 1 (Secundário)' },
      { chave: 'CARGO_ASSINATURA_2_SECUNDARIO', descricao: 'Cargo assinatura 2 (Secundário)' },
      { chave: 'NOME_ASSINATURA_1_SECUNDARIO', descricao: 'Nome assinatura 1 (Secundário)' },
      { chave: 'NOME_ASSINATURA_2_SECUNDARIO', descricao: 'Nome assinatura 2 (Secundário)' },
      { chave: 'LABEL_RESULTADO_FINAL_SECUNDARIO', descricao: 'Label resultado final (Secundário)' },
      // Mini Pauta
      { chave: 'TABELA_ALUNOS', descricao: 'Linhas HTML da tabela de alunos (Mini Pauta)' },
      { chave: 'LABEL_CURSO_CLASSE', descricao: 'Label Curso ou Classe (Mini Pauta)' },
      { chave: 'VALOR_CURSO_CLASSE', descricao: 'Nome do curso ou classe (Mini Pauta)' },
      { chave: 'DISCIPLINA', descricao: 'Nome da disciplina (Mini Pauta)' },
      { chave: 'PROFESSOR', descricao: 'Nome do professor (Mini Pauta)' },
      { chave: 'TIPO_PAUTA', descricao: 'PROVISÓRIA ou DEFINITIVA (Mini Pauta)' },
      { chave: 'TOTAL_ESTUDANTES', descricao: 'Total de estudantes (Mini Pauta)' },
    ];
    res.json(placeholders);
  } catch (error) {
    next(error);
  }
};
