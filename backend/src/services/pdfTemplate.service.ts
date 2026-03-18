/**
 * Serviço de preenchimento de templates PDF.
 * - Modo FORM_FIELDS: preenche campos AcroForm do PDF
 * - Modo COORDINATES: desenha texto em posições (x,y) - análogo ao Excel CELL_MAPPING
 *
 * Multi-tenant: instituicaoId respeitado pelo caller (documento.service).
 * Tipos de instituição: dados via payloadToTemplateData (SUPERIOR/SECUNDARIO).
 */
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';
import { AppError } from '../middlewares/errorHandler.js';

export type PdfTemplateMode = 'FORM_FIELDS' | 'COORDINATES';

/** Mapeamento para modo FORM_FIELDS: nome do campo PDF → caminho do sistema */
export interface PdfFormMapping {
  [fieldName: string]: string;
}

/** Item de mapeamento por coordenadas (modo COORDINATES) */
export interface PdfCoordinateItem {
  pageIndex: number;
  x: number;
  y: number;
  campo: string;
  fontSize?: number;
}

export interface PdfCoordinateMapping {
  items: PdfCoordinateItem[];
}

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
 * Extrai nomes dos campos de formulário do PDF (AcroForm).
 */
export async function extractFormFieldsFromPdf(pdfBase64: string): Promise<{ fieldName: string; type: string }[]> {
  if (!pdfBase64?.trim()) return [];
  let buf: Buffer;
  try {
    buf = Buffer.from(pdfBase64, 'base64');
  } catch {
    return [];
  }
  try {
    const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    const result: { fieldName: string; type: string }[] = [];
    for (const field of fields) {
      const name = field.getName();
      let type = 'unknown';
      if (field.constructor.name.includes('TextField')) type = 'text';
      else if (field.constructor.name.includes('CheckBox')) type = 'checkbox';
      else if (field.constructor.name.includes('Dropdown')) type = 'dropdown';
      else if (field.constructor.name.includes('RadioGroup')) type = 'radio';
      result.push({ fieldName: name, type });
    }
    return result;
  } catch (err) {
    console.warn('[pdfTemplate] Erro ao extrair campos do PDF:', err);
    return [];
  }
}

/**
 * Preenche PDF em modo FORM_FIELDS (campos AcroForm).
 */
export async function fillPdfFormFields(
  pdfBase64: string,
  data: Record<string, unknown>,
  mapping: PdfFormMapping
): Promise<Buffer> {
  if (!pdfBase64?.trim()) throw new AppError('Modelo PDF não fornecido', 400);
  if (!mapping || Object.keys(mapping).length === 0) {
    throw new AppError('Mapeamento de campos PDF obrigatório em modo FORM_FIELDS', 400);
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(pdfBase64, 'base64');
  } catch {
    throw new AppError('Modelo PDF inválido (base64)', 400);
  }
  try {
    const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    for (const [fieldName, campoSistema] of Object.entries(mapping)) {
      const value = getValueByPath(data, campoSistema);
      try {
        const field = form.getField(fieldName);
        if (field instanceof PDFTextField) {
          field.setText(value || '');
        } else if (field instanceof PDFCheckBox) {
          const checked = /^(sim|s[ií]|yes|true|1|x|\u2713|✓)$/i.test(String(value || '').trim());
          if (checked) field.check();
          else field.uncheck();
        } else if (field instanceof PDFDropdown) {
          const opts = field.getOptions();
          if (opts.includes(value)) field.select(value);
          else if (opts.length) field.select(opts[0]);
        } else if (field instanceof PDFRadioGroup) {
          const opts = field.getOptions();
          if (opts.includes(value)) field.select(value);
          else if (opts.length) field.select(opts[0]);
        }
      } catch {
        /* campo pode não existir, ignorar */
      }
    }
    form.flatten();
    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao preencher PDF';
    throw new AppError(`Falha ao preencher PDF: ${msg}`, 400);
  }
}

/**
 * Preenche PDF em modo COORDINATES (desenha texto em posições x,y).
 * Sistema de coordenadas: origem no canto inferior-esquerdo da página.
 */
export async function fillPdfWithCoordinates(
  pdfBase64: string,
  data: Record<string, unknown>,
  mapping: PdfCoordinateMapping
): Promise<Buffer> {
  if (!pdfBase64?.trim()) throw new AppError('Modelo PDF não fornecido', 400);
  if (!mapping?.items?.length) {
    throw new AppError('Mapeamento de coordenadas obrigatório em modo COORDINATES', 400);
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(pdfBase64, 'base64');
  } catch {
    throw new AppError('Modelo PDF inválido (base64)', 400);
  }
  try {
    const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    for (const item of mapping.items) {
      const { pageIndex, x, y, campo, fontSize = 11 } = item;
      if (pageIndex < 0 || pageIndex >= pages.length) continue;
      const page = pages[pageIndex];
      const value = getValueByPath(data, campo);
      if (!value) continue;
      const { height } = page.getSize();
      page.drawText(value, {
        x,
        y: height - y,
        size: fontSize,
      });
    }
    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao preencher PDF';
    throw new AppError(`Falha ao preencher PDF: ${msg}`, 400);
  }
}
