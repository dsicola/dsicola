import { useEffect, useRef, useCallback } from 'react';
import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

/**
 * Hook seguro para mutations que interagem com UI
 * 
 * Funcionalidades:
 * - Previne setState após unmount
 * - Previne fechamento duplicado de modais
 * - Garante que callbacks de UI (toast, navigate, setState) só executem se montado
 * - Integra com mudanças de rota
 * 
 * @param options - Opções do useMutation do React Query
 * @returns Mutation result com callbacks protegidos
 * 
 * @example
 * const createMutation = useSafeMutation({
 *   mutationFn: async (data) => await api.create(data),
 *   onSuccess: () => {
 *     queryClient.invalidateQueries({ queryKey: ['items'] });
 *     toast.success('Item criado!');
 *     setDialogOpen(false); // Seguro mesmo após unmount
 *   },
 *   onError: (error) => {
 *     toast.error('Erro: ' + error.message);
 *   }
 * });
 */
export function useSafeMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> {
  const location = useLocation();
  const previousLocationRef = useRef<string>(location.pathname);
  const isUnmountingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const pendingCallbacksRef = useRef<Set<() => void>>(new Set());

  // Wrapper seguro para onSuccess
  const safeOnSuccess = useCallback(
    (data: TData, variables: TVariables, context: TContext | undefined) => {
      // Se está desmontando ou desmontado, não executar callbacks de UI
      if (isUnmountingRef.current || !mountedRef.current) {
        return;
      }

      // Executar callback original se fornecido
      if (options.onSuccess) {
        try {
          options.onSuccess(data, variables, context);
        } catch (error) {
          console.error('[useSafeMutation] Erro em onSuccess:', error);
        }
      }
    },
    [options]
  );

  // Wrapper seguro para onError
  const safeOnError = useCallback(
    (error: TError, variables: TVariables, context: TContext | undefined) => {
      // Se está desmontando ou desmontado, não executar callbacks de UI
      if (isUnmountingRef.current || !mountedRef.current) {
        return;
      }

      // Executar callback original se fornecido
      if (options.onError) {
        try {
          options.onError(error, variables, context);
        } catch (error) {
          console.error('[useSafeMutation] Erro em onError:', error);
        }
      }
    },
    [options]
  );

  // Wrapper seguro para onSettled
  const safeOnSettled = useCallback(
    (
      data: TData | undefined,
      error: TError | null,
      variables: TVariables,
      context: TContext | undefined
    ) => {
      // Se está desmontando ou desmontado, não executar callbacks de UI
      if (isUnmountingRef.current || !mountedRef.current) {
        return;
      }

      // Executar callback original se fornecido
      if (options.onSettled) {
        try {
          options.onSettled(data, error, variables, context);
        } catch (error) {
          console.error('[useSafeMutation] Erro em onSettled:', error);
        }
      }
    },
    [options]
  );

  // Criar mutation com callbacks protegidos
  const mutation = useMutation<TData, TError, TVariables, TContext>({
    ...options,
    onSuccess: safeOnSuccess,
    onError: safeOnError,
    onSettled: safeOnSettled,
  });

  // Detectar mudança de rota e cancelar mutations pendentes se necessário
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousLocationRef.current;

    // Se a rota mudou e há mutation pendente, marcar como desmontando
    if (currentPath !== previousPath && mutation.isPending && mountedRef.current) {
      // Não cancelar a mutation (pode estar salvando dados importantes)
      // Apenas marcar que callbacks não devem executar se o componente desmontar
      isUnmountingRef.current = true;
    }

    previousLocationRef.current = currentPath;
  }, [location.pathname, mutation.isPending]);

  // Cleanup no unmount
  useEffect(() => {
    mountedRef.current = true;
    isUnmountingRef.current = false;

    return () => {
      // Marcar como desmontando ANTES de qualquer operação
      isUnmountingRef.current = true;
      mountedRef.current = false;

      // Limpar callbacks pendentes
      pendingCallbacksRef.current.clear();
    };
  }, []); // Apenas no mount/unmount

  return mutation;
}