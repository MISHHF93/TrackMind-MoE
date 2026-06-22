/**
 * Repository abstraction — in-memory default, Postgres opt-in via env.
 *
 * Env:
 * - `TRACKMIND_PERSISTENCE_MODE` or `PERSISTENCE_MODE`: `in-memory` (default) or `postgres`
 * - `TRACKMIND_DATABASE_URL` or `DATABASE_URL`: Postgres connection string when mode is `postgres`
 */

import {
  ensureRepositoryHydration,
  getHydratedNamespaceCache,
  isPgModuleAvailable,
  isPostgresPersistenceReady,
  schedulePostgresNamespacePersist,
  setHydratedNamespaceCache,
} from './postgresRecordStore.js';

export type PersistenceMode = 'in-memory' | 'postgres';

export type RepositoryNamespace =
  | 'platform.organizations'
  | 'platform.tenants'
  | 'platform.racetracks'
  | 'platform.approvals'
  | 'platform.audit'
  | 'platform.incidents'
  | 'platform.incident-reviews';

export interface RepositoryConfig {
  mode: PersistenceMode;
  connectionString?: string;
  wired: boolean;
}

export interface RepositorySnapshot<T = unknown> {
  namespace: RepositoryNamespace;
  records: T[];
  persistedAt: string;
}

export interface RepositoryEnvironment {
  mode: PersistenceMode;
  wired: boolean;
  postgresReady: boolean;
  usingFallback: boolean;
  pgClientAvailable: boolean;
  namespaces: Partial<Record<RepositoryNamespace, { recordCount: number; lastPersistedAt?: string }>>;
}

const snapshotBackingStore = new Map<RepositoryNamespace, RepositorySnapshot>();

export function resolvePersistenceMode(): PersistenceMode {
  const mode = (process.env.TRACKMIND_PERSISTENCE_MODE ?? process.env.PERSISTENCE_MODE)?.toLowerCase();
  return mode === 'postgres' ? 'postgres' : 'in-memory';
}

export function getRepositoryConfig(): RepositoryConfig {
  const mode = resolvePersistenceMode();
  const connectionString = process.env.TRACKMIND_DATABASE_URL ?? process.env.DATABASE_URL;
  return {
    mode,
    connectionString,
    wired: mode === 'postgres' ? Boolean(connectionString) : true,
  };
}

export function isPostgresClientAvailable(): boolean {
  return isPgModuleAvailable();
}

export function loadSnapshot<T>(namespace: RepositoryNamespace): T[] | undefined {
  if (isPostgresPersistenceReady()) {
    ensureRepositoryHydration();
    const hydrated = getHydratedNamespaceCache<T>(namespace);
    if (hydrated) return hydrated;
  }
  const snapshot = snapshotBackingStore.get(namespace);
  return snapshot?.records as T[] | undefined;
}

export function persistSnapshot<T extends { id: string }>(namespace: RepositoryNamespace, records: T[]): RepositorySnapshot<T> {
  const persistedAt = new Date().toISOString();
  const snapshot: RepositorySnapshot<T> = { namespace, records: structuredClone(records), persistedAt };
  snapshotBackingStore.set(namespace, snapshot as RepositorySnapshot);
  setHydratedNamespaceCache(namespace, records, persistedAt);
  if (isPostgresPersistenceReady()) {
    schedulePostgresNamespacePersist(namespace, records);
  }
  return snapshot;
}

export function resetRepositorySnapshotsForTests(): void {
  snapshotBackingStore.clear();
}

export function getRepositoryEnvironment(): RepositoryEnvironment {
  const config = getRepositoryConfig();
  const pgClientAvailable = isPostgresClientAvailable();
  const postgresReady = config.mode === 'postgres' && config.wired && pgClientAvailable;
  const usingFallback = config.mode === 'postgres' && !postgresReady;

  const namespaces: RepositoryEnvironment['namespaces'] = {};
  for (const [namespace, snapshot] of snapshotBackingStore) {
    namespaces[namespace] = {
      recordCount: snapshot.records.length,
      lastPersistedAt: snapshot.persistedAt,
    };
  }

  return {
    mode: config.mode,
    wired: config.wired,
    postgresReady,
    usingFallback,
    pgClientAvailable,
    namespaces,
  };
}

export interface KeyValueRepository<T extends { id: string }> {
  namespace(): RepositoryNamespace | undefined;
  list(): T[];
  get(id: string): T | undefined;
  upsert(record: T): T;
  delete(id: string): boolean;
  persistenceMode(): PersistenceMode;
  flush(): RepositorySnapshot<T> | undefined;
}

abstract class BackingKeyValueRepository<T extends { id: string }> implements KeyValueRepository<T> {
  protected store = new Map<string, T>();
  protected config: RepositoryConfig;

  constructor(
    protected readonly boundNamespace: RepositoryNamespace | undefined,
    initial: T[] = [],
  ) {
    this.config = getRepositoryConfig();
    if (boundNamespace && isPostgresPersistenceReady()) {
      ensureRepositoryHydration();
    }
    const loaded = boundNamespace ? loadSnapshot<T>(boundNamespace) : undefined;
    const seed = loaded ?? initial;
    for (const record of seed) this.store.set(record.id, record);
    if (boundNamespace && loaded === undefined && initial.length > 0) {
      this.flush();
    }
  }

  abstract persistenceMode(): PersistenceMode;

  namespace(): RepositoryNamespace | undefined {
    return this.boundNamespace;
  }

  list(): T[] {
    return [...this.store.values()];
  }

  get(id: string): T | undefined {
    return this.store.get(id);
  }

  upsert(record: T): T {
    this.store.set(record.id, record);
    this.flush();
    return record;
  }

  delete(id: string): boolean {
    const deleted = this.store.delete(id);
    if (deleted) this.flush();
    return deleted;
  }

  flush(): RepositorySnapshot<T> | undefined {
    if (!this.boundNamespace) return undefined;
    return persistSnapshot(this.boundNamespace, this.list());
  }
}

export class InMemoryRepository<T extends { id: string }> extends BackingKeyValueRepository<T> {
  constructor(initial: T[] = [], namespace?: RepositoryNamespace) {
    super(namespace, initial);
  }

  persistenceMode(): PersistenceMode {
    return 'in-memory';
  }
}

/**
 * Postgres repository — durable JSONB upsert/read when pg client and DATABASE_URL are configured.
 * Falls back to process-local snapshot persistence when postgres is requested but not ready.
 */
export class PostgresRepository<T extends { id: string }> extends BackingKeyValueRepository<T> {
  constructor(initial: T[] = [], namespace?: RepositoryNamespace) {
    super(namespace, initial);
  }

  persistenceMode(): PersistenceMode {
    return 'postgres';
  }

  isWired(): boolean {
    return this.config.wired;
  }

  usingFallback(): boolean {
    return !isPostgresPersistenceReady();
  }

  postgresReady(): boolean {
    return isPostgresPersistenceReady();
  }
}

/** @deprecated Use PostgresRepository — retained for compatibility with existing imports. */
export const PostgresRepositoryStub = PostgresRepository;

export function createRepository<T extends { id: string }>(
  initial: T[] = [],
  namespace?: RepositoryNamespace,
): KeyValueRepository<T> {
  return resolvePersistenceMode() === 'postgres'
    ? new PostgresRepository(initial, namespace)
    : new InMemoryRepository(initial, namespace);
}
