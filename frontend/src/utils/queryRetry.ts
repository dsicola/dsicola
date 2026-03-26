/**
 * Política de retry para React Query em chamadas à API.
 * Evita reexecutar em 4xx (erro do cliente / permissões / não encontrado).
 */
export function queryRetryNot4xx(failureCount: number, err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 400 || status === 401 || status === 403 || status === 404) return false;
  return failureCount < 1;
}

/**
 * Retry padrão do app (QueryClient): sem retry offline; em 4xx não repete; caso contrário até 1 nova tentativa.
 * Use como `defaultOptions.queries.retry` para aplicar a todas as `useQuery` sem repetir código.
 */
export function defaultQueryRetry(failureCount: number, err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  return queryRetryNot4xx(failureCount, err);
}
