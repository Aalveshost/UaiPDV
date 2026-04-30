import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Use ref to avoid re-creating callbacks when syncing state changes
  const syncingRef = useRef(false);

  const pullRecentSales = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (data && data.length > 0) {
        const fetchedSales = data.map(s => ({
          uuid: s.id,
          displayId: s.display_id,
          date: new Date(s.date),
          customerName: s.customer_name,
          items: s.items,
          paymentMethod: s.payment_method,
          payments: s.payments,
          total: Number(s.total),
          cashierId: s.cashier_id,
          synced: 1
        }));

        // Fix: Find existing local IDs for these UUIDs so bulkPut UPDATES instead of INSERTING
        const existingRecords = await db.sales.where('uuid').anyOf(fetchedSales.map(s => s.uuid)).toArray();
        const uuidToId = new Map(existingRecords.map(r => [r.uuid, r.id]));

        const salesToLocal = fetchedSales.map(s => {
          const existingId = uuidToId.get(s.uuid);
          if (existingId) {
            return { ...s, id: existingId };
          }
          return s;
        });

        await db.sales.bulkPut(salesToLocal);
      }
    } catch (err) {
      console.error('Failed to pull sales:', err);
    }
  }, []);

  const syncPendingSales = useCallback(async () => {
    // Use ref instead of state to keep this callback stable (no re-render loop)
    if (syncingRef.current || !navigator.onLine) return;
    try {
      syncingRef.current = true;
      setSyncing(true);
      const pendingSales = await db.sales.where('synced').equals(0).limit(50).toArray();
      if (pendingSales.length === 0) return;
      const batchData = pendingSales.map(sale => ({
        id: sale.uuid,
        display_id: sale.displayId,
        date: sale.date,
        customer_name: sale.customerName,
        items: sale.items,
        payment_method: sale.paymentMethod,
        payments: sale.payments,
        total: sale.total,
        cashier_id: sale.cashierId
      }));
      const { error } = await supabase
        .from('sales')
        .upsert(batchData, { onConflict: 'id' });
      if (!error) {
        const idsToUpdate = pendingSales.map(s => s.id!);
        await db.sales.where('id').anyOf(idsToUpdate).modify({ synced: 1 });
        setLastSyncTime(new Date());
      } else {
        console.error('Batch sync error:', error);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []); // stable — does not depend on syncing state

  // Update pending count every 15s
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const updateCount = async () => {
      try {
        const count = await db.sales.where('synced').equals(0).count();
        setPendingCount(count);
      } catch (e) {
        console.error('Count update failed', e);
      }
      timer = setTimeout(updateCount, 15000);
    };
    
    updateCount();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setTimeout(() => { syncPendingSales(); }, 1000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      setTimeout(() => { syncPendingSales(); }, 1000);
    }

    // Periodic sync every 30s using recursive timeout (safer than setInterval)
    let syncTimer: NodeJS.Timeout;
    const periodicSync = async () => {
      if (navigator.onLine && !syncingRef.current) {
        await syncPendingSales();
      }
      syncTimer = setTimeout(periodicSync, 120000);
    };

    syncTimer = setTimeout(periodicSync, 120000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(syncTimer);
    };
  }, [syncPendingSales, pullRecentSales]); // both are now stable references

  return { isOnline, syncing, pendingCount, lastSyncTime, pullRecentSales };
}
