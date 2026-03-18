/**
 * Motor de renderização de templates DOCX dinâmicos.
 * Usa docxtemplater + PizZip. Placeholders no DOCX: {nome}, {student.fullName}, etc.
 * Mapeamento: campo_template → campo_sistema (resolvido via mappings).
 * Multi-tenant: instituicaoId obrigatório.
 */
import prisma from '../lib/prisma.js';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { AppError } from '../middlewares/errorHandler.js';
import { getCamposValidosDocx, validarMapeamentosCampos } from './availableFields.service.js';

/**
 * Obtém valor de objeto por caminho (ex: "student.fullName" → obj.student?.fullName).
 * Fallback: campo inexistente → string vazia.
 */
function getValueByPath(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[p];
  }
  if (current == null || current === undefined) return '';
  return String(current);
}

/**
 * Carrega mappings do modelo e constrói objeto de dados para docxtemplater.
 * mappings: campo_template (ex: "nome") → campo_sistema (ex: "student.fullName")
 * data: { student: {...}, instituicao: {...}, ... }
 */
function buildTemplateData(
  mappings: Array<{ campoTemplate: string; campoSistema: string }>,
  data: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of mappings) {
    const value = getValueByPath(data, m.campoSistema);
    // docxtemplater usa o nome do placeholder no template (ex: {nome})
    result[m.campoTemplate] = value ?? '';
  }
  return result;
}

export interface RenderTemplateParams {
  modeloDocumentoId: string;
  instituicaoId: string;
  data: Record<string, unknown>;
  outputFormat?: 'docx' | 'pdf';
}

/**
 * Renderiza template DOCX com dados. Retorna buffer (DOCX ou PDF se disponível).
 */
export async function renderTemplate(params: RenderTemplateParams): Promise<{ buffer: Buffer; format: 'docx' | 'pdf' }> {
  const { modeloDocumentoId, instituicaoId, data, outputFormat = 'docx' } = params;

  const modelo = await prisma.modeloDocumento.findFirst({
    where: { id: modeloDocumentoId, instituicaoId, ativo: true },
    include: { templateMappings: true },
  });

  if (!modelo) {
    throw new AppError('Modelo não encontrado ou inativo', 404);
  }

  const docxBase64 = modelo.docxTemplateBase64;
  if (!docxBase64 || docxBase64.trim().length === 0) {
    throw new AppError('Modelo não possui ficheiro DOCX. Use um modelo com formato DOCX.', 400);
  }

  const buffer = Buffer.from(docxBase64, 'base64');
  const zip = new PizZip(buffer);
  const opts: { paragraphLoop: boolean; linebreaks: boolean; nullGetter: () => string; delimiters?: { start: string; end: string } } = {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  };
  const docs = zip.folder('word');
  const xml = docs?.file('document.xml')?.asText() || '';
  if (xml.includes('{{') && xml.includes('}}')) {
    opts.delimiters = { start: '{{', end: '}}' };
  }
  const doc = new Docxtemplater(zip, opts);

  const mappings = modelo.templateMappings;
  const mappingsList = mappings.map((m) => ({ campoTemplate: m.campoTemplate, campoSistema: m.campoSistema }));

  if (mappingsList.length > 0) {
    const validPaths = getCamposValidosDocx();
    const invalidos = validarMapeamentosCampos(mappingsList, validPaths);
    if (invalidos.length > 0) {
      throw new AppError(
        `Campos inexistentes nos mapeamentos. Corrija ou remova antes de gerar: ${invalidos.join('; ')}`,
        400
      );
    }
    const { placeholders: templatePlaceholders } = extractPlaceholdersAndLoopsFromDocx(buffer);
    const mapped = new Set(mappingsList.map((m) => m.campoTemplate));
    const unmapped = templatePlaceholders.filter((p) => !mapped.has(p));
    if (unmapped.length > 0) {
      throw new AppError(
        `Placeholders não mapeados. Mapeie ou remova do template antes de gerar: ${unmapped.map((p) => `{{${p}}}`).join(', ')}`,
        400
      );
    }
  }

  const templateData = mappings.length > 0
    ? buildTemplateData(mappingsList, data)
    : (data as Record<string, string>);

  try {
    doc.render(templateData);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao renderizar template';
    console.error('[templateRender] Erro docxtemplater:', err);
    throw new AppError(`Falha ao preencher template: ${msg}`, 400);
  }

  const outBuffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  if (outputFormat === 'pdf') {
    try {
      const landscape = modelo.orientacaoPagina === 'PAISAGEM';
      const pdfBuf = await convertDocxToPdf(outBuffer, landscape);
      if (pdfBuf) return { buffer: pdfBuf, format: 'pdf' };
    } catch (e) {
      console.warn('[templateRender] Conversão DOCX→PDF falhou, retornando DOCX:', e);
    }
  }

  return { buffer: Buffer.from(outBuffer), format: 'docx' };
}

/**
 * Converte DOCX para PDF via mammoth (DOCX→HTML) + Puppeteer (HTML→PDF).
 * Fallback: se falhar, retorna null (caller usa DOCX).
 */
async function convertDocxToPdf(docxBuffer: Buffer, landscape = false): Promise<Buffer | null> {
  try {
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.convertToHtml({ buffer: docxBuffer });
    const html = result.value || '<body></body>';
    const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
    const { gerarPDFCertificadoSuperior } = await import('./certificadoSuperior.service.js');
    return await gerarPDFCertificadoSuperior(wrapped, { landscape });
  } catch {
    return null;
  }
}

/**
 * Extrai placeholders do DOCX.
 * Suporta {placeholder}, {{placeholder}}, e loops {#array}...{/array}.
 */
export function extractPlaceholdersFromDocx(docxBuffer: Buffer): string[] {
  const { placeholders } = extractPlaceholdersAndLoopsFromDocx(docxBuffer);
  return placeholders;
}

/** Extrai placeholders e loops de um bloco XML (document, header, footer). */
function extractFromXml(xml: string, placeholdersSet: Set<string>, loopsSet: Set<string>): void {
  for (const regex of [/\{\{([^{}]+)\}\}/g, /\{([^{}]+)\}/g]) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(xml)) !== null) {
      const name = m[1].trim();
      if (!name) continue;
      if (name.startsWith('#') && name.length > 1) {
        loopsSet.add(name.slice(1).trim());
      } else if (!name.startsWith('/')) {
        placeholdersSet.add(name);
      }
    }
  }
}

/**
 * Extrai placeholders e loops do DOCX.
 * Inclui: document.xml, header1-3.xml, footer1-3.xml (cabeçalhos e rodapés).
 * placeholders: campos simples (student.fullName, turma.nome)
 * loops: nomes de arrays/sections ({#alunos} → "alunos")
 */
export function extractPlaceholdersAndLoopsFromDocx(
  docxBuffer: Buffer
): { placeholders: string[]; loops: string[] } {
  const zip = new PizZip(docxBuffer);
  const docs = zip.folder('word');
  if (!docs) return { placeholders: [], loops: [] };
  const placeholdersSet = new Set<string>();
  const loopsSet = new Set<string>();

  const xmlFiles = ['document.xml', 'header1.xml', 'header2.xml', 'header3.xml', 'footer1.xml', 'footer2.xml', 'footer3.xml'];
  for (const f of xmlFiles) {
    const xml = docs.file(f)?.asText();
    if (xml) extractFromXml(xml, placeholdersSet, loopsSet);
  }
  return { placeholders: Array.from(placeholdersSet), loops: Array.from(loopsSet) };
}
