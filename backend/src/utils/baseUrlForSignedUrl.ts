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
  return `${protocol}://${host}`.replace(/\/$/, '');
}
