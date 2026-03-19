import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Trash2, Clock, AlertCircle, XCircle } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getEntityLabel, getMethodLabel, getStatusLabel } from '@/utils/offlineEntityLabels';
import type { QueuedRequest, QueueStatus } from '@/services/offlineQueue';
import { discardFromQueue, getQueue } from '@/services/offlineQueue';

interface OfflineQueueDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OfflineQueueDrawer({ open, onOpenChange }: OfflineQueueDrawerProps) {
  const { isOnline, isSyncing, queueStats, syncNow, refreshQueueCount } = useOfflineSync();
  const [items, setItems] = useState<QueuedRequest[]>([]);

  const loadItems = React.useCallback(() => {
    getQueue().then(setItems);
  }, []);

  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open, queueStats.total, loadItems]);

  useEffect(() => {
    const handler = () => loadItems();
    window.addEventListener('offline-queue-updated', handler);
    return () => window.removeEventListener('offline-queue-updated', handler);
  }, [loadItems]);

  const handleDiscard = async (id: string) => {
    await discardFromQueue(id);
    window.dispatchEvent(new CustomEvent('offline-queue-updated'));
    refreshQueueCount();
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const StatusIcon = ({ status }: { status?: QueueStatus }) => {
    switch (status) {
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Fila de sincronização</SheetTitle>
          <SheetDescription>
            Pedidos guardados localmente. Serão enviados quando a ligação voltar.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4">
          {isOnline && queueStats.total > 0 && (
            <Button
              onClick={syncNow}
              disabled={isSyncing || queueStats.pending === 0}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  A sincronizar...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tentar sincronizar agora
                </>
              )}
            </Button>
          )}

          {!isOnline && (
            <p className="text-sm text-muted-foreground">
              Sem ligação à internet. Os pedidos serão enviados automaticamente quando a ligação
              voltar.
            </p>
          )}

          <div className="text-sm text-muted-foreground">
            {queueStats.pending > 0 && <span>{queueStats.pending} em espera</span>}
            {queueStats.error > 0 && (
              <span>
                {queueStats.pending > 0 ? ' · ' : ''}
                {queueStats.error} com erro
              </span>
            )}
            {queueStats.failed > 0 && (
              <span>
                {queueStats.pending > 0 || queueStats.error > 0 ? ' · ' : ''}
                {queueStats.failed} falha definitiva
              </span>
            )}
          </div>

          <ScrollArea className="h-[60vh]">
            <div className="space-y-2 pr-4">
              {items.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum pedido em espera
                </p>
              ) : (
                items.map((item) => {
                  const status = item.status ?? 'PENDING';
                  const entityLabel = getEntityLabel(item.entity ?? 'other');
                  const methodLabel = getMethodLabel(item.method);
                  const canDiscard = status === 'FAILED';

                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StatusIcon status={status} />
                          <span className="font-medium">
                            {methodLabel} {entityLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {getStatusLabel(status)}
                          {item.retryCount && item.retryCount > 0 && (
                            <> · Tentativa {item.retryCount}/5</>
                          )}
                        </p>
                      </div>
                      {canDiscard && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleDiscard(item.id)}
                          title="Remover da fila"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
