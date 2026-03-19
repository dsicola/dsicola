import { useState, useEffect, useCallback } from 'react';
import { processOfflineQueue } from '@/services/api';
import { getQueueCount, getQueueStats } from '@/services/offlineQueue';

export type QueueStats = { pending: number; error: number; failed: number; total: number };

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [queueStats, setQueueStats] = useState<QueueStats>({
    pending: 0,
    error: 0,
    failed: 0,
    total: 0,
  });

  const refreshQueueCount = useCallback(async () => {
    const [count, stats] = await Promise.all([getQueueCount(), getQueueStats()]);
    setQueueCount(count);
    setQueueStats(stats);
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    const count = await getQueueCount();
    if (count === 0) return;
    setIsSyncing(true);
    try {
      await processOfflineQueue();
    } finally {
      setIsSyncing(false);
      await refreshQueueCount();
    }
  }, [isOnline, isSyncing, refreshQueueCount]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const count = await getQueueCount();
      if (count > 0) {
        setIsSyncing(true);
        try {
          await processOfflineQueue();
        } finally {
          setIsSyncing(false);
          await refreshQueueCount();
        }
      }
    };

    const handleOffline = () => setIsOnline(false);

    const handleQueueUpdated = () => refreshQueueCount();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-updated', handleQueueUpdated);

    refreshQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-updated', handleQueueUpdated);
    };
  }, [refreshQueueCount]);

  return {
    isOnline,
    isSyncing,
    queueCount,
    queueStats,
    refreshQueueCount,
    syncNow,
  };
}
