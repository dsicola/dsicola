/**
 * Invalida cache do React Query quando o sync offline completa com sucesso.
 * Garante que a UI mostre dados atualizados após itens da fila serem enviados.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function OfflineSyncQueryInvalidator() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleSyncCompleted = () => {
      queryClient.invalidateQueries();
    };

    window.addEventListener('offline-sync-completed', handleSyncCompleted);
    return () => window.removeEventListener('offline-sync-completed', handleSyncCompleted);
  }, [queryClient]);

  return null;
}
