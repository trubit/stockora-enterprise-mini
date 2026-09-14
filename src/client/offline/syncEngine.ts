/**
 * syncEngine.ts
 * Manages the synchronisation of offline POS transactions to the server.
 *
 * Responsibilities:
 *  - Detect network status changes
 *  - Iterate pending IndexedDB transactions and POST to /api/branch-sync/sync
 *  - Record results in the sync log
 *  - Retry up to MAX_RETRIES per transaction before marking as failed
 *  - Emit events via a simple EventEmitter for UI updates
 */

import {
  getAllPendingTransactions,
  deletePendingTransaction,
  savePendingTransaction,
  addSyncLogEntry,
  getPendingCount,
  type PendingTransaction,
  type SyncLogEntry,
} from './offlineStore.ts';

// ---- Config ----------------------------------------------------------------

const MAX_RETRIES = 3;
const SYNC_ENDPOINT = '/api/v1/branch-sync/sync';

// ---- Event emitter (lightweight, no npm dep) --------------------------------

type SyncEventType =
  'sync:start' | 'sync:progress' | 'sync:complete' | 'sync:error' | 'pending:change';

type SyncProgressPayload = {
  type: SyncEventType;
  synced?: number;
  conflicts?: number;
  failures?: number;
  total?: number;
  pendingCount?: number;
  message?: string;
};

const listeners = new Map<SyncEventType, Array<(payload: SyncProgressPayload) => void>>();

function emit(type: SyncEventType, payload: Omit<SyncProgressPayload, 'type'> = {}) {
  const handlers = listeners.get(type) || [];
  handlers.forEach((h) => h({ type, ...payload }));
}

export function on(event: SyncEventType, handler: (payload: SyncProgressPayload) => void) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event)!.push(handler);
  return () => {
    const arr = listeners.get(event) ?? [];
    listeners.set(
      event,
      arr.filter((h) => h !== handler)
    );
  };
}

// ---- Core sync logic -------------------------------------------------------

let isSyncing = false;

export async function runSync(authToken: string): Promise<{
  synced: number;
  conflicts: number;
  failures: number;
}> {
  if (isSyncing) return { synced: 0, conflicts: 0, failures: 0 };
  if (!navigator.onLine) return { synced: 0, conflicts: 0, failures: 0 };

  isSyncing = true;
  const pending = await getAllPendingTransactions();
  if (pending.length === 0) {
    isSyncing = false;
    return { synced: 0, conflicts: 0, failures: 0 };
  }

  emit('sync:start', { total: pending.length });

  const results = { synced: 0, conflicts: 0, failures: 0 };

  for (const tx of pending) {
    try {
      const response = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ transactions: [tx] }),
      });

      const data = (await response.json()) as {
        synced: number;
        conflicts: number;
        failures: number;
        logs: string[];
      };

      if (data.synced > 0) {
        results.synced++;
        await deletePendingTransaction(tx.id);
        await addSyncLogEntry(buildLogEntry(tx, 'SUCCESS', 'Successfully synced.'));
      } else if (data.conflicts > 0) {
        results.conflicts++;
        await deletePendingTransaction(tx.id); // Conflict = already exists, remove from queue
        await addSyncLogEntry(
          buildLogEntry(tx, 'CONFLICT', data.logs[0] ?? 'Conflict: already exists.')
        );
      } else {
        throw new Error(data.logs[0] ?? 'Server rejected transaction.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      tx.retryCount = (tx.retryCount ?? 0) + 1;
      tx.lastError = message;

      if (tx.retryCount >= MAX_RETRIES) {
        results.failures++;
        await deletePendingTransaction(tx.id);
        await addSyncLogEntry(
          buildLogEntry(tx, 'FAILURE', `Failed after ${MAX_RETRIES} retries: ${message}`)
        );
      } else {
        // Put back with incremented retry count
        await savePendingTransaction(tx);
      }
    }

    emit('sync:progress', { ...results, total: pending.length });
  }

  const remaining = await getPendingCount();
  emit('sync:complete', { ...results, pendingCount: remaining });
  isSyncing = false;

  return results;
}

function buildLogEntry(
  tx: PendingTransaction,
  status: SyncLogEntry['status'],
  message: string
): SyncLogEntry {
  return {
    id: `log-${tx.id}-${Date.now()}`,
    transactionId: tx.id,
    transactionNumber: tx.transactionNumber,
    status,
    message,
    syncedAt: new Date().toISOString(),
  };
}

// ---- Auto-sync on network reconnect ----------------------------------------

let autoSyncBound = false;

export function initAutoSync(getToken: () => string): void {
  if (autoSyncBound) return;
  autoSyncBound = true;

  window.addEventListener('online', async () => {
    emit('pending:change', { message: 'Network restored — starting auto-sync…' });
    await runSync(getToken());
  });
}

// ---- Queue a new offline transaction ----------------------------------------

export async function queueOfflineTransaction(
  tx: Omit<PendingTransaction, 'retryCount'>
): Promise<void> {
  await savePendingTransaction({ ...tx, retryCount: 0 });
  const count = await getPendingCount();
  emit('pending:change', {
    pendingCount: count,
    message: `Queued offline: ${tx.transactionNumber}`,
  });
}

// ---- Query pending count (for UI badge) ------------------------------------

export async function getPendingQueueCount(): Promise<number> {
  return getPendingCount();
}
