import { Request } from 'express';

/**
 * Obtém a base URL para gerar URLs assinadas (documentos, ficheiros, vídeos).
 * A URL deve apontar sempre para a API (backend), não para o frontend.
 * Caso contrário, ao abrir em nova aba (ex: colegiodorianadealves.dsicola.com/documentos-funcionario/...)
 * o pedido vai para o SPA e retorna 404 em vez de servir o ficheiro.
 */
export function getBaseUrlForSignedUrl(req: Request): string {
  // 1. Preferir API_URL/BASE_URL explícitos (backend em domínio separado)
  let baseUrl = (process.env.API_URL || process.env.BASE_URL || '').trim();
  if (baseUrl) {
    return baseUrl.replace(/\/$/, '');
  }
  // 2. Fallback: mesmo host do pedido (reverse proxy - API e frontend no mesmo domínio)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers.host || 'localhost:3001';
  let base = `${protocol}://${host}`.replace(/\/$/, '');
  // Se o pedido atual veio por /api/... (ex.: VITE_API_URL=https://host/api), o link assinado tem de
  // incluir /api; caso contrário /documentos-aluno/... cai no SPA e não no Express (produção Railway, etc.).
  const pathOnly = (req.originalUrl || req.url || '').split('?')[0];
  if (pathOnly.startsWith('/api/')) {
    base = `${base}/api`;
  }
  return base;
}
