/**
 * Hook reutilizável para listagens com paginação, filtros e busca
 * Usado em: estudantes, professores, funcionários
 *
 * - Debounce na busca (300–500ms)
 * - Paginação controlada (page/pageSize)
 * - Ordenação (sortBy/sortOrder)
 * - Filtros padronizados
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListQueryParams, ListResponse } from '@/services/api';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_DEBOUNCE_MS = 400;

export interface UseListQueryOptions<T> {
  endpoint: (params: ListQueryParams) => Promise<ListResponse<T>>;
  queryKey: string[];
  defaultFilters?: Partial<ListQueryParams>;
  pageSize?: number;
  debounceMs?: number;
  enabled?: boolean;
}

export function useListQuery<T>({
  endpoint,
  queryKey,
  defaultFilters = {},
  pageSize = DEFAULT_PAGE_SIZE,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  enabled = true,
}: UseListQueryOptions<T>) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filters, setFilters] = useState<Partial<ListQueryParams>>({
    ...defaultFilters,
    pageSize,
  });
  const [sortBy, setSortBy] = useState<string>('nome');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput), debounceMs);
    return () => clearTimeout(t);
  }, [searchInput, debounceMs]);

  const params: ListQueryParams = {
    page,
    pageSize: filters.pageSize ?? pageSize,
    search: searchDebounced || undefined,
    sortBy,
    sortOrder,
    status: filters.status,
    from: filters.from,
    to: filters.to,
    anoLetivoId: filters.anoLetivoId,
    cursoId: filters.cursoId,
    turmaId: filters.turmaId,
    classeId: filters.classeId,
    cargoId: filters.cargoId,
    departamentoId: filters.departamentoId,
  };

  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [...queryKey, params],
    queryFn: () => endpoint(params),
    enabled,
  });

  const resetPage = useCallback(() => setPage(1), []);

  const updateFilter = useCallback(<K extends keyof ListQueryParams>(key: K, value: ListQueryParams[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...defaultFilters, pageSize });
    setSearchInput('');
    setSearchDebounced('');
    setSortBy('nome');
    setSortOrder('asc');
    setPage(1);
  }, [defaultFilters, pageSize]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    data: data?.data ?? [],
    meta: data?.meta ?? { page: 1, pageSize, total: 0, totalPages: 0 },
    isLoading,
    isFetching,
    error,
    page,
    setPage,
    searchInput,
    setSearchInput,
    filters,
    setFilters,
    updateFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    clearFilters,
    resetPage,
    invalidate,
  };
}
