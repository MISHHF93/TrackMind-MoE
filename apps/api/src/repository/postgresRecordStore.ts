import { createRequire } from 'node:module';
import type { RepositoryNamespace } from './index.js';

const require = createRequire(import.meta.url);

export interface PostgresRecordStore {
  isConnected(): boolean;
  loadNamespace<T>(namespace: RepositoryNamespace): Promise<T[]>;
  replaceNamespace<T extends { id: string }>(namespace: RepositoryNamespace, records: T[]): Promise<string>;
  upsertRecord<T extends { id: string }>(namespace: RepositoryNamespace, record: T): Promise<void>;
  deleteRecord(namespace: RepositoryNamespace, recordId: string): Promise<boolean>;
  namespaceStats(): Promise<Partial<Record<RepositoryNamespace, { recordCount: number; lastPersistedAt?: string }>>>;
  close(): Promise<void>;
}

type PgPool = {
  query<T = { rows: Array<Record<string, unknown>> }>(text: string, values?: unknown[]): Promise<T>;
  end(): Promise<void>;
};

let pgModuleAvailable: boolean | undefined;
let pgClientAvailableOverride: boolean | undefined;
let postgresRecordStoreOverride: PostgresRecordStore | undefined;
let sharedPool: PgPool | undefined;
let hydrationPromise: Promise<void> | undefined;

const namespaceHydrationCache = new Map<RepositoryNamespace, { records: unknown[]; persistedAt: string }>();

export function setPostgresClientAvailableForTests(value: boolean | undefined): void {
  pgClientAvailableOverride = value;
  pgModuleAvailable = value;
}

export function setPostgresRecordStoreForTests(store: PostgresRecordStore | undefined): void {
  postgresRecordStoreOverride = store;
  hydrationPromise = undefined;
  namespaceHydrationCache.clear();
}

export function resetPostgresRecordStoreForTests(): void {
  postgresRecordStoreOverride = undefined;
  pgClientAvailableOverride = undefined;
  pgModuleAvailable = undefined;
  hydrationPromise = undefined;
  namespaceHydrationCache.clear();
  if (sharedPool) {
    void sharedPool.end().catch(() => undefined);
    sharedPool = undefined;
  }
}

export function isPgModuleAvailable(): boolean {
  if (pgClientAvailableOverride !== undefined) return pgClientAvailableOverride;
  if (pgModuleAvailable !== undefined) return pgModuleAvailable;
  try {
    require.resolve('pg');
    pgModuleAvailable = true;
  } catch {
    pgModuleAvailable = false;
  }
  return pgModuleAvailable;
}

/** `TRACKMIND_DATABASE_URL` or `DATABASE_URL` — required when persistence mode is `postgres`. */
function connectionString(): string | undefined {
  return process.env.TRACKMIND_DATABASE_URL ?? process.env.DATABASE_URL;
}

export function isPostgresPersistenceReady(): boolean {
  return resolvePersistenceMode() === 'postgres' && Boolean(connectionString()) && isPgModuleAvailable();
}

function resolvePersistenceMode(): 'in-memory' | 'postgres' {
  const mode = (process.env.TRACKMIND_PERSISTENCE_MODE ?? process.env.PERSISTENCE_MODE)?.toLowerCase();
  return mode === 'postgres' ? 'postgres' : 'in-memory';
}

function getPool(): PgPool {
  if (!sharedPool) {
    const { Pool } = require('pg') as { Pool: new (config: { connectionString: string }) => PgPool };
    const url = connectionString();
    if (!url) throw new Error('TRACKMIND_DATABASE_URL is required for postgres persistence');
    sharedPool = new Pool({ connectionString: url });
  }
  return sharedPool;
}

class PgPostgresRecordStore implements PostgresRecordStore {
  isConnected(): boolean {
    return Boolean(sharedPool);
  }

  async loadNamespace<T>(namespace: RepositoryNamespace): Promise<T[]> {
    const result = await getPool().query<{ rows: Array<{ payload: T }> }>(
      `SELECT payload
       FROM trackmind.repository_records
       WHERE namespace = $1
       ORDER BY updated_at ASC, record_id ASC`,
      [namespace],
    );
    return result.rows.map((row) => row.payload);
  }

  async replaceNamespace<T extends { id: string }>(namespace: RepositoryNamespace, records: T[]): Promise<string> {
    const persistedAt = new Date().toISOString();
    const pool = getPool();
    await pool.query('BEGIN');
    try {
      await pool.query('DELETE FROM trackmind.repository_records WHERE namespace = $1', [namespace]);
      for (const record of records) {
        await pool.query(
          `INSERT INTO trackmind.repository_records (namespace, record_id, payload, updated_at)
           VALUES ($1, $2, $3::jsonb, $4::timestamptz)`,
          [namespace, record.id, JSON.stringify(record), persistedAt],
        );
      }
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    return persistedAt;
  }

  async upsertRecord<T extends { id: string }>(namespace: RepositoryNamespace, record: T): Promise<void> {
    await getPool().query(
      `INSERT INTO trackmind.repository_records (namespace, record_id, payload, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (namespace, record_id)
       DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
      [namespace, record.id, JSON.stringify(record)],
    );
  }

  async deleteRecord(namespace: RepositoryNamespace, recordId: string): Promise<boolean> {
    const result = await getPool().query<{ rowCount: number }>(
      'DELETE FROM trackmind.repository_records WHERE namespace = $1 AND record_id = $2',
      [namespace, recordId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async namespaceStats(): Promise<Partial<Record<RepositoryNamespace, { recordCount: number; lastPersistedAt?: string }>>> {
    const result = await getPool().query<{
      rows: Array<{ namespace: RepositoryNamespace; record_count: string; last_persisted_at: string | null }>;
    }>(
      `SELECT namespace,
              COUNT(*)::text AS record_count,
              MAX(updated_at)::text AS last_persisted_at
       FROM trackmind.repository_records
       GROUP BY namespace`,
    );
    const stats: Partial<Record<RepositoryNamespace, { recordCount: number; lastPersistedAt?: string }>> = {};
    for (const row of result.rows) {
      stats[row.namespace] = {
        recordCount: Number(row.record_count),
        lastPersistedAt: row.last_persisted_at ?? undefined,
      };
    }
    return stats;
  }

  async close(): Promise<void> {
    if (sharedPool) {
      await sharedPool.end();
      sharedPool = undefined;
    }
  }
}

export class InMemoryPostgresRecordStore implements PostgresRecordStore {
  private readonly namespaces = new Map<RepositoryNamespace, Map<string, unknown>>();

  isConnected(): boolean {
    return true;
  }

  async loadNamespace<T>(namespace: RepositoryNamespace): Promise<T[]> {
    return [...(this.namespaces.get(namespace)?.values() ?? [])] as T[];
  }

  async replaceNamespace<T extends { id: string }>(namespace: RepositoryNamespace, records: T[]): Promise<string> {
    const persistedAt = new Date().toISOString();
    this.namespaces.set(namespace, new Map(records.map((record) => [record.id, structuredClone(record)])));
    return persistedAt;
  }

  async upsertRecord<T extends { id: string }>(namespace: RepositoryNamespace, record: T): Promise<void> {
    const bucket = this.namespaces.get(namespace) ?? new Map<string, unknown>();
    bucket.set(record.id, structuredClone(record));
    this.namespaces.set(namespace, bucket);
  }

  async deleteRecord(namespace: RepositoryNamespace, recordId: string): Promise<boolean> {
    const bucket = this.namespaces.get(namespace);
    if (!bucket) return false;
    return bucket.delete(recordId);
  }

  async namespaceStats(): Promise<Partial<Record<RepositoryNamespace, { recordCount: number; lastPersistedAt?: string }>>> {
    const stats: Partial<Record<RepositoryNamespace, { recordCount: number; lastPersistedAt?: string }>> = {};
    for (const [namespace, bucket] of this.namespaces) {
      stats[namespace] = { recordCount: bucket.size };
    }
    return stats;
  }

  async close(): Promise<void> {
    this.namespaces.clear();
  }
}

function activeStore(): PostgresRecordStore | undefined {
  if (postgresRecordStoreOverride) return postgresRecordStoreOverride;
  if (!isPostgresPersistenceReady()) return undefined;
  return new PgPostgresRecordStore();
}

export function getHydratedNamespaceCache<T>(namespace: RepositoryNamespace): T[] | undefined {
  const cached = namespaceHydrationCache.get(namespace);
  return cached?.records as T[] | undefined;
}

export function setHydratedNamespaceCache<T extends { id: string }>(
  namespace: RepositoryNamespace,
  records: T[],
  persistedAt: string,
): void {
  namespaceHydrationCache.set(namespace, { records: structuredClone(records), persistedAt });
}

export async function hydrateRepositoryNamespaces(): Promise<void> {
  const store = activeStore();
  if (!store) return;
  const stats = await store.namespaceStats();
  const namespaces = new Set<RepositoryNamespace>([
    'platform.organizations',
    'platform.tenants',
    'platform.racetracks',
    'platform.approvals',
    'platform.audit',
    'platform.incidents',
    'platform.incident-reviews',
    ...Object.keys(stats) as RepositoryNamespace[],
  ]);
  for (const namespace of namespaces) {
    const records = await store.loadNamespace(namespace);
    if (!records.length) continue;
    const persistedAt = stats[namespace]?.lastPersistedAt ?? new Date().toISOString();
    setHydratedNamespaceCache(namespace, records as Array<{ id: string }>, persistedAt);
  }
}

export function ensureRepositoryHydration(): void {
  if (!isPostgresPersistenceReady() || hydrationPromise) return;
  hydrationPromise = hydrateRepositoryNamespaces().catch((error) => {
    hydrationPromise = undefined;
    console.error('[repository] postgres hydration failed', error);
  });
}

export async function initializeRepositoryPersistence(): Promise<void> {
  if (!isPostgresPersistenceReady()) return;
  await hydrateRepositoryNamespaces();
}

export async function persistNamespaceToPostgres<T extends { id: string }>(
  namespace: RepositoryNamespace,
  records: T[],
): Promise<string | undefined> {
  const store = activeStore();
  if (!store) return undefined;
  const persistedAt = await store.replaceNamespace(namespace, records);
  setHydratedNamespaceCache(namespace, records, persistedAt);
  return persistedAt;
}

export async function upsertRecordToPostgres<T extends { id: string }>(
  namespace: RepositoryNamespace,
  record: T,
): Promise<void> {
  const store = activeStore();
  if (!store) return;
  await store.upsertRecord(namespace, record);
}

export async function deleteRecordFromPostgres(namespace: RepositoryNamespace, recordId: string): Promise<void> {
  const store = activeStore();
  if (!store) return;
  await store.deleteRecord(namespace, recordId);
}

export async function loadPostgresNamespaceStats(): Promise<
  Partial<Record<RepositoryNamespace, { recordCount: number; lastPersistedAt?: string }>>
> {
  const store = activeStore();
  if (!store) return {};
  return store.namespaceStats();
}

export function schedulePostgresNamespacePersist<T extends { id: string }>(
  namespace: RepositoryNamespace,
  records: T[],
): void {
  void persistNamespaceToPostgres(namespace, records).catch((error) => {
    console.error(`[repository] postgres persist failed for ${namespace}`, error);
  });
}
