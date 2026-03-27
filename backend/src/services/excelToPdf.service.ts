/**
 * Converte Excel (.xlsx) para PDF mantendo fidelidade visual (merges, larguras, layout).
 * Usa LibreOffice em modo headless quando disponível (resultado idêntico ao original).
 * Fallback: excelBufferToHtml → Puppeteer (pode perder alguns detalhes).
 */
import type { OpcoesPDFCertificado } from './certificadoSuperior.service.js';

/**
 * Garante orientação paisagem em todas as folhas antes do PDF (modelos oficiais em CELL_MAPPING).
 * O LibreOffice usa pageSetup do ficheiro; se o modelo não tiver orientação gravada, o PDF saía em retrato.
 */
async function applyLandscapePageSetupToBuffer(buffer: Buffer): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  workbook.eachSheet((worksheet) => {
    worksheet.pageSetup.orientation = 'landscape';
  });
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

/**
 * Converte buffer Excel para PDF.
 * 1) Tenta LibreOffice (libreoffice-convert) — resultado 100% fiel ao ficheiro original.
 * 2) Fallback: excelBufferToHtml + Puppeteer — preserva merges e widths via HTML.
 * @param excelBuffer - Buffer do ficheiro Excel (.xlsx)
 * @param options - Opções para fallback (orientação, etc.)
 * @returns Buffer PDF ou null em caso de erro
 */
export async function excelBufferToPdf(
  excelBuffer: Buffer,
  options?: { landscape?: boolean }
): Promise<Buffer | null> {
  let bufferForConvert = excelBuffer;
  if (options?.landscape === true) {
    try {
      bufferForConvert = await applyLandscapePageSetupToBuffer(excelBuffer);
    } catch (e) {
      console.warn('[excelToPdf] Não foi possível aplicar paisagem ao .xlsx antes do PDF:', e);
    }
  }

  // 1) Tentar LibreOffice (resultado fiel ao original — recomendado em produção para modelos do governo)
  try {
    const libre = await import('libreoffice-convert');
    const convertFn = (libre as { convert: (doc: Buffer, format: string, filter: unknown, cb: (err: Error | null, out?: Buffer) => void) => void }).convert;
    const { promisify } = await import('node:util');
    const convertAsync = promisify(convertFn);

    const pdfBuffer = await convertAsync(bufferForConvert, '.pdf', undefined);
    if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
      return Buffer.from(pdfBuffer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('spawn') && !msg.includes('ENOENT') && !msg.includes('libreoffice')) {
      console.warn('[excelToPdf] LibreOffice convert falhou (pode não estar instalado):', msg);
    }
  }

  // 2) Fallback: Excel → HTML → PDF (preserva merges e widths — menos fiel que LibreOffice)
  try {
    const { excelBufferToHtml } = await import('./excelTemplate.service.js');
    const { gerarPDFCertificadoSuperior } = await import('./certificadoSuperior.service.js');
    const html = excelBufferToHtml(bufferForConvert);
    const opts: OpcoesPDFCertificado = options?.landscape ? { landscape: true } : {};
    return await gerarPDFCertificadoSuperior(html, opts);
  } catch (err) {
    console.error('[excelToPdf] Fallback HTML→PDF falhou:', err);
    return null;
  }
}
