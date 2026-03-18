/**
 * Serviço de geração de documentos DOCX a partir de templates.
 * Função principal: generateDocxFromTemplate(templateBuffer, data)
 * Suporta placeholders {{campo}} e loops {#array}...{/array} (docxtemplater nativo).
 * Multi-tenant: instituicaoId validado pelo controller.
 */
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { AppError } from '../middlewares/errorHandler.js';

const MAX_TEMPLATE_SIZE = 15 * 1024 * 1024; // 15 MB

export interface GenerateDocxOptions {
  /** Delimitadores: '{{' e '}}' (padrão) ou '{' e '}' */
  delimiters?: { start: string; end: string };
  /** Converter para PDF após render (se disponível) */
  outputFormat?: 'docx' | 'pdf';
}

/**
 * Gera documento DOCX a partir de template e dados.
 * Fluxo: carregar DOCX → docxtemplater → setData → render → gerar buffer.
 *
 * Placeholders: {{student.fullName}}, {{turma.nome}}, etc.
 * Loops: {#alunos} Nome: {{fullName}} {/alunos} — data deve ter alunos: [{fullName: '...'}, ...]
 *
 * @param templateBuffer Buffer do ficheiro DOCX
 * @param data Objeto com dados (pode ter aninhamento e arrays)
 * @param options Opções opcionais
 */
export function generateDocxFromTemplate(
  templateBuffer: Buffer,
  data: Record<string, unknown>,
  options?: GenerateDocxOptions
): Buffer {
  if (!templateBuffer?.length) {
    throw new AppError('Template DOCX não fornecido', 400);
  }
  if (templateBuffer.length > MAX_TEMPLATE_SIZE) {
    throw new AppError(`Template demasiado grande (máx. 15 MB)`, 400);
  }

  const zip = new PizZip(templateBuffer);
  const opts: { paragraphLoop: boolean; linebreaks: boolean; nullGetter: () => string; delimiters?: { start: string; end: string } } = {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  };

  const docs = zip.folder('word');
  const xml = docs?.file('document.xml')?.asText() || '';
  const useDoubleBraces = xml.includes('{{') && xml.includes('}}');
  opts.delimiters = options?.delimiters ?? (useDoubleBraces ? { start: '{{', end: '}}' } : { start: '{', end: '}' });

  const doc = new Docxtemplater(zip, opts);

  try {
    doc.render(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao renderizar template';
    console.error('[docxDocument] docxtemplater:', err);
    throw new AppError(`Falha ao preencher template: ${msg}`, 400);
  }

  const outBuffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return Buffer.from(outBuffer);
}

/**
 * Converte DOCX para PDF mantendo fidelidade 100% ao original.
 * 1) LibreOffice (idêntico ao ficheiro) → 2) Fallback mammoth + Puppeteer.
 */
export async function convertDocxToPdf(docxBuffer: Buffer, landscape = false): Promise<Buffer | null> {
  const { docxBufferToPdf } = await import('./docxToPdf.service.js');
  return docxBufferToPdf(docxBuffer, { landscape });
}
