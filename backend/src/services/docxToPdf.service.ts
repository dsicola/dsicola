/**
 * Converte DOCX para PDF mantendo fidelidade 100% ao original.
 * Usa LibreOffice em modo headless quando disponível (resultado idêntico ao ficheiro importado).
 * Fallback: mammoth (DOCX→HTML) + Puppeteer (HTML→PDF) — pode perder formatação.
 *
 * Recomendação: instalar LibreOffice para conversão fiel (ex: apt install libreoffice, brew install --cask libreoffice).
 */
import type { OpcoesPDFCertificado } from './certificadoSuperior.service.js';

/**
 * Converte buffer DOCX para PDF.
 * 1) Tenta LibreOffice — resultado 100% fiel ao documento original (margens, fontes, tabelas).
 * 2) Fallback: mammoth + Puppeteer — perde detalhes de formatação.
 *
 * @param docxBuffer - Buffer do ficheiro DOCX (.docx)
 * @param options - Opções (orientação paisagem, etc.)
 * @returns Buffer PDF ou null em caso de erro
 */
export async function docxBufferToPdf(
  docxBuffer: Buffer,
  options?: { landscape?: boolean }
): Promise<Buffer | null> {
  // 1) LibreOffice — fidelidade total ao original
  try {
    const libre = await import('libreoffice-convert');
    const convertFn = (libre as {
      convert: (
        doc: Buffer,
        format: string,
        filter: unknown,
        cb: (err: Error | null, out?: Buffer) => void
      ) => void;
    }).convert;
    const { promisify } = await import('node:util');
    const convertAsync = promisify(convertFn);

    const pdfBuffer = await convertAsync(docxBuffer, '.pdf', undefined);
    if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
      return Buffer.from(pdfBuffer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('spawn') && !msg.includes('ENOENT') && !msg.includes('libreoffice')) {
      console.warn('[docxToPdf] LibreOffice convert falhou (pode não estar instalado):', msg);
    }
  }

  // 2) Fallback: mammoth DOCX→HTML + Puppeteer HTML→PDF
  try {
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.convertToHtml({ buffer: docxBuffer });
    const html = result.value || '<body></body>';
    const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
    const { gerarPDFCertificadoSuperior } = await import('./certificadoSuperior.service.js');
    const opts: OpcoesPDFCertificado = options?.landscape ? { landscape: true } : {};
    return await gerarPDFCertificadoSuperior(wrapped, opts);
  } catch (err) {
    console.error('[docxToPdf] Fallback mammoth+PDF falhou:', err);
    return null;
  }
}
