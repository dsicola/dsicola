import React, { useState } from 'react';
import { WifiOff, RefreshCw, AlertCircle, List, XCircle } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { OfflineQueueDrawer } from './OfflineQueueDrawer';

/**
 * Indicador de estado offline/sincronização - mostra banner discreto quando
 * sem ligação ou quando está a sincronizar pedidos da fila.
 * Multi-tenant: o contexto de instituição é preservado nos pedidos em fila.
 */
export const OfflineIndicator: React.FC = () => {
  const { isOnline, isSyncing, queueCount, queueStats, syncNow } = useOfflineSync();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isOnline && !isSyncing && queueCount === 0) return null;

  const hasErrors = queueStats.error > 0;
  const hasFailed = queueStats.failed > 0;

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-[9999] flex justify-center py-2 px-4"
        role="status"
        aria-live="polite"
      >
        <div
          className={`
            flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg
            ${!isOnline
              ? 'bg-amber-500/95 text-amber-950 dark:bg-amber-400 dark:text-amber-950'
              : isSyncing
                ? 'bg-blue-500/95 text-white dark:bg-blue-600'
                : hasErrors || hasFailed
                  ? 'bg-amber-600/95 text-amber-50 dark:bg-amber-700'
                  : 'bg-amber-500/95 text-amber-950 dark:bg-amber-400 dark:text-amber-950'
            }
          `}
        >
          {!isOnline ? (
            <>
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>
                Sem ligação à internet
                {queueCount > 0 && ` · ${queueCount} pedido(s) em espera`}
                · Dados em cache quando disponível
              </span>
            </>
          ) : isSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
              <span>A sincronizar...</span>
            </>
          ) : (
            <>
              {hasErrors ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : hasFailed ? (
                <XCircle className="h-4 w-4 shrink-0" />
              ) : (
                <WifiOff className="h-4 w-4 shrink-0" />
              )}
              <span>
                {queueCount} pedido(s) em espera
                {hasErrors && ` · ${queueStats.error} com erro`}
                {hasFailed && ` · ${queueStats.failed} falha definitiva`}
              </span>
            </>
          )}
          {queueCount > 0 && (
            <>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="ml-2 rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
                title="Ver lista"
                aria-label="Ver lista de pedidos pendentes"
              >
                <List className="h-4 w-4" />
              </button>
              {isOnline && !isSyncing && (
                <button
                  type="button"
                  onClick={syncNow}
                  className="ml-1 rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
                  title="Sincronizar agora"
                  aria-label="Tentar sincronizar agora"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <OfflineQueueDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
};
