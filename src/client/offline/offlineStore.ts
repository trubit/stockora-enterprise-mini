/**
 * offlineStore.ts
 * IndexedDB wrapper for offline POS transactions.
 *
 * Provides a simple typed API for storing/reading/deleting pending
 * transactions that were captured when the network was unavailable.
 * All operations are promise-based using the native IndexedDB API.
 */

const DB_NAME = 'stockora_mini_offline';
const DB_VERSION = 1;
const STORE_PENDING = 'pending_transactions';
const STORE_SYNC_LOG = 'sync_log';

export interface PendingTransaction {
  id: string; // Locally generated unique ID (e.g. 'off-<timestamp>-<rand>')
  transactionNumber: string;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashierId?: string;
  cashierName: string;
  branchId?: string;
  branchName: string;
  capturedAt: string; // ISO timestamp of when the sale was captured offline
  retryCount: number;
  lastError?: string;
}

export interface SyncLogEntry {
  id: string;
  transactionId: string;
  transactionNumber: string;
  status: 'SUCCESS' | 'CONFLICT' | 'FAILURE';
  message: string;
  syncedAt: string;
}

// ---------------------------------------------------------------------------
// DB initialisation
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const store = db.createObjectStore(STORE_PENDING, { keyPath: 'id' });
        store.createIndex('capturedAt', 'capturedAt');
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_LOG)) {
        const logStore = db.createObjectStore(STORE_SYNC_LOG, { keyPath: 'id' });
        logStore.createIndex('syncedAt', 'syncedAt');
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

// ---------------------------------------------------------------------------
// Pending transactions CRUD
// ---------------------------------------------------------------------------

function txPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingTransaction(tx: PendingTransaction): Promise<void> {
  const db = await openDB();
  const store = db.transaction(STORE_PENDING, 'readwrite').objectStore(STORE_PENDING);
  await txPromise(store.put(tx));
}

export async function getAllPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await openDB();
  const store = db.transaction(STORE_PENDING, 'readonly').objectStore(STORE_PENDING);
  return txPromise<PendingTransaction[]>(store.getAll() as IDBRequest<PendingTransaction[]>);
}

export async function deletePendingTransaction(id: string): Promise<void> {
  const db = await openDB();
  const store = db.transaction(STORE_PENDING, 'readwrite').objectStore(STORE_PENDING);
  await txPromise(store.delete(id));
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  const store = db.transaction(STORE_PENDING, 'readonly').objectStore(STORE_PENDING);
  return txPromise<number>(store.count() as IDBRequest<number>);
}

export async function clearAllPending(): Promise<void> {
  const db = await openDB();
  const store = db.transaction(STORE_PENDING, 'readwrite').objectStore(STORE_PENDING);
  await txPromise(store.clear());
}

// ---------------------------------------------------------------------------
// Sync log
// ---------------------------------------------------------------------------

export async function addSyncLogEntry(entry: SyncLogEntry): Promise<void> {
  const db = await openDB();
  const store = db.transaction(STORE_SYNC_LOG, 'readwrite').objectStore(STORE_SYNC_LOG);
  await txPromise(store.put(entry));
}

export async function getSyncLog(limit = 50): Promise<SyncLogEntry[]> {
  const db = await openDB();
  const store = db.transaction(STORE_SYNC_LOG, 'readonly').objectStore(STORE_SYNC_LOG);
  const all = await txPromise<SyncLogEntry[]>(store.getAll() as IDBRequest<SyncLogEntry[]>);
  // Sort descending by syncedAt and limit
  return all.sort((a, b) => b.syncedAt.localeCompare(a.syncedAt)).slice(0, limit);
}

export async function clearSyncLog(): Promise<void> {
  const db = await openDB();
  const store = db.transaction(STORE_SYNC_LOG, 'readwrite').objectStore(STORE_SYNC_LOG);
  await txPromise(store.clear());
}
