/** Repository abstraction — in-memory default, Postgres opt-in via env */

export type PersistenceMode = 'in-memory' | 'postgres';

export interface RepositoryConfig {
  mode: PersistenceMode;
  connectionString?: string;
}

export function resolvePersistenceMode(): PersistenceMode {
  const mode = process.env.TRACKMIND_PERSISTENCE_MODE?.toLowerCase();
  return mode === 'postgres' ? 'postgres' : 'in-memory';
}

export interface KeyValueRepository<T extends { id: string }> {
  list(): T[];
  get(id: string): T | undefined;
  upsert(record: T): T;
  delete(id: string): boolean;
}

export class InMemoryRepository<T extends { id: string }> implements KeyValueRepository<T> {
  private store = new Map<string, T>();

  constructor(initial: T[] = []) {
    for (const record of initial) this.store.set(record.id, record);
  }

  list(): T[] {
    return [...this.store.values()];
  }

  get(id: string): T | undefined {
    return this.store.get(id);
  }

  upsert(record: T): T {
    this.store.set(record.id, record);
    return record;
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }
}

/** Postgres adapter stub — records mode for Wave 20 wiring */
export class PostgresRepositoryStub<T extends { id: string }> implements KeyValueRepository<T> {
  private fallback: InMemoryRepository<T>;

  constructor(initial: T[] = []) {
    this.fallback = new InMemoryRepository(initial);
  }

  list(): T[] {
    return this.fallback.list();
  }

  get(id: string): T | undefined {
    return this.fallback.get(id);
  }

  upsert(record: T): T {
    return this.fallback.upsert(record);
  }

  delete(id: string): boolean {
    return this.fallback.delete(id);
  }
}

export function createRepository<T extends { id: string }>(initial: T[] = []): KeyValueRepository<T> {
  return resolvePersistenceMode() === 'postgres'
    ? new PostgresRepositoryStub(initial)
    : new InMemoryRepository(initial);
}
