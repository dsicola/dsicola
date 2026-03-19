import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

/**
 * Mostra toast de sucesso quando um pedido é guardado na fila offline.
 * Listener do evento 'offline-request-queued' disparado pelo interceptor Axios.
 */
export function OfflineQueueToastHandler() {
  useEffect(() => {
    const handler = () => {
      toast({
        title: 'Guardado localmente',
        description: 'O pedido será enviado automaticamente quando a ligação voltar.',
        variant: 'default',
      });
    };
    window.addEventListener('offline-request-queued', handler);
    return () => window.removeEventListener('offline-request-queued', handler);
  }, []);
  return null;
}
