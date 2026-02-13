/**
 * PADRÃO SIGAE — Helper reutilizável para listagens com paginação, filtros e busca
 * Usado em: estudantes, professores, funcionários
 *
 * REGRA: instituicaoId NUNCA vem do frontend — sempre do JWT (req.user.instituicaoId)
 */

export interface ParseListQueryResult {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  filters: {
    status?: string;
    from?: string; // ISO date string (createdAt)
    to?: string;
    anoLetivoId?: string;
    cursoId?: string;
    turmaId?: string;
    classeId?: string;
    cargoId?: string;
    departamentoId?: string;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const VALID_SORT_ORDERS = ['asc', 'desc'] as const;

/**
 * Converte query params da requisição em objeto estruturado para listagens paginadas
 * Segurança: Remove qualquer instituicaoId vindo do frontend
 */
export function parseListQuery(query: Record<string, string | string[] | undefined>): ParseListQueryResult {
  const page = Math.max(1, parseInt(String(query.page || DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const rawPageSize = parseInt(String(query.pageSize || query.page_size || DEFAULT_PAGE_SIZE), 10);
  const pageSize = Math.min(MAX_PAGE_SIZE, isNaN(rawPageSize) ? DEFAULT_PAGE_SIZE : Math.max(1, rawPageSize));
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const search = String(query.search || '').trim();
  const sortBy = String(query.sortBy || query.sort_by || 'nome').trim();
  const rawSortOrder = String(query.sortOrder || query.sort_order || 'asc').toLowerCase();
  const sortOrder = VALID_SORT_ORDERS.includes(rawSortOrder as 'asc' | 'desc') ? (rawSortOrder as 'asc' | 'desc') : 'asc';

  // Filtros — NUNCA incluir instituicaoId
  const filters: ParseListQueryResult['filters'] = {};
  if (query.status && typeof query.status === 'string') filters.status = query.status.trim();
  if (query.from && typeof query.from === 'string') filters.from = query.from.trim();
  if (query.to && typeof query.to === 'string') filters.to = query.to.trim();
  if (query.anoLetivoId && typeof query.anoLetivoId === 'string') filters.anoLetivoId = query.anoLetivoId.trim();
  if (query.cursoId && typeof query.cursoId === 'string') filters.cursoId = query.cursoId.trim();
  if (query.turmaId && typeof query.turmaId === 'string') filters.turmaId = query.turmaId.trim();
  if (query.classeId && typeof query.classeId === 'string') filters.classeId = query.classeId.trim();
  if (query.cargoId && typeof query.cargoId === 'string') filters.cargoId = query.cargoId.trim();
  if (query.departamentoId && typeof query.departamentoId === 'string') filters.departamentoId = query.departamentoId.trim();

  return {
    page,
    pageSize,
    skip,
    take,
    search,
    sortBy,
    sortOrder,
    filters,
  };
}

/**
 * Retorna objeto meta padronizado para resposta paginada
 */
export function listMeta(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 0,
  };
}
