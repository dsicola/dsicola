import type { Request } from 'express';

export type ConfigInstituicaoAssetTipo =
  | 'logo'
  | 'capa'
  | 'favicon'
  | 'imagemFundoDocumento'
  | 'landingHeroPublic';

/** URL pública para imagem extra do site (eventos), servida por id */
export function buildLandingPublicUploadedImageUrl(
  req: Request | undefined,
  instituicaoId: string,
  imageId: string,
  cacheVersion?: number | string,
): string {
  const base = resolveApiBase(req);
  const v =
    cacheVersion != null && String(cacheVersion) !== ''
      ? `&v=${encodeURIComponent(String(cacheVersion))}`
      : '';
  return `${base}/configuracoes-instituicao/landing-public-image/${encodeURIComponent(imageId)}?instituicaoId=${encodeURIComponent(instituicaoId)}${v}`;
}

export function resolveApiBase(req?: Request): string {
  const fromEnv = process.env.API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  if (req) {
    return `${req.protocol}://${req.get('host') || 'localhost'}`.replace(/\/$/, '');
  }
  return 'http://localhost:3001';
}

/**
 * URL pública para servir logo/capa/favicon guardados na BD.
 * `cacheVersion` (ex.: updatedAt em ms) evita cache do browser após novo upload — o path é estável.
 */
export function buildConfigInstituicaoAssetUrl(
  req: Request | undefined,
  instituicaoId: string,
  tipo: ConfigInstituicaoAssetTipo,
  cacheVersion?: number | string
): string {
  const base = resolveApiBase(req);
  const v =
    cacheVersion != null && String(cacheVersion) !== ''
      ? `&v=${encodeURIComponent(String(cacheVersion))}`
      : '';
  return `${base}/configuracoes-instituicao/assets/${tipo}?instituicaoId=${encodeURIComponent(instituicaoId)}${v}`;
}
