import type { ConfiguracaoInstituicao, Instituicao } from '@prisma/client';

export async function fetchImageBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const axios = (await import('axios')).default;
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 8_000_000 });
    return Buffer.from(r.data);
  } catch {
    return null;
  }
}

export async function loadLogoBuffer(
  instituicao: Instituicao & { configuracao: ConfiguracaoInstituicao | null }
): Promise<Buffer | null> {
  const c = instituicao.configuracao;
  if (c?.logoData && c.logoData.length > 0) {
    return Buffer.from(c.logoData);
  }
  const fromConfigUrl = await fetchImageBuffer(c?.logoUrl ?? null);
  if (fromConfigUrl) return fromConfigUrl;
  return fetchImageBuffer(instituicao.logoUrl);
}

/** Carimbo dedicado Secundário; legado: imagem de fundo. */
export async function loadCarimboCertificadoSecundarioPdf(
  config: ConfiguracaoInstituicao | null
): Promise<Buffer | null> {
  if (!config) return null;
  if (config.carimboCertificadoSecundarioData && config.carimboCertificadoSecundarioData.length > 0) {
    return Buffer.from(config.carimboCertificadoSecundarioData);
  }
  const fromDedicated = await fetchImageBuffer(config.carimboCertificadoSecundarioUrl);
  if (fromDedicated) return fromDedicated;
  if (config.imagemFundoDocumentoData && config.imagemFundoDocumentoData.length > 0) {
    return Buffer.from(config.imagemFundoDocumentoData);
  }
  return fetchImageBuffer(config.imagemFundoDocumentoUrl);
}

/** Carimbo dedicado Superior; legado: imagem de fundo. */
export async function loadCarimboCertificadoSuperiorPdf(
  config: ConfiguracaoInstituicao | null
): Promise<Buffer | null> {
  if (!config) return null;
  if (config.carimboCertificadoSuperiorData && config.carimboCertificadoSuperiorData.length > 0) {
    return Buffer.from(config.carimboCertificadoSuperiorData);
  }
  const fromDedicated = await fetchImageBuffer(config.carimboCertificadoSuperiorUrl);
  if (fromDedicated) return fromDedicated;
  if (config.imagemFundoDocumentoData && config.imagemFundoDocumentoData.length > 0) {
    return Buffer.from(config.imagemFundoDocumentoData);
  }
  return fetchImageBuffer(config.imagemFundoDocumentoUrl);
}

export function fmtMedia(v: unknown): string {
  if (v == null) return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2);
}

export function fmtDataPt(d: Date): string {
  return d.toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' });
}
