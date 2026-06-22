/** CQRS repository adapter — in-memory default with Postgres opt-in (Wave 01 / Wave 20 wiring). */

import { rewireApprovalRepository } from '../platform/approvalRepository.js';
import {
  createRepository as createRepositoryImpl,
  resolvePersistenceMode,
  type KeyValueRepository,
  type RepositoryNamespace,
} from './index.js';
import * as postgresRecordStore from './postgresRecordStore.js';

export {
  createRepository,
  resolvePersistenceMode,
  getRepositoryConfig,
  getRepositoryEnvironment,
  loadSnapshot,
  persistSnapshot,
  resetRepositorySnapshotsForTests,
  isPostgresClientAvailable,
  InMemoryRepository,
  PostgresRepository,
  PostgresRepositoryStub,
  type KeyValueRepository,
  type PersistenceMode,
  type RepositoryConfig,
  type RepositoryEnvironment,
  type RepositoryNamespace,
  type RepositorySnapshot,
} from './index.js';

export {
  InMemoryPostgresRecordStore,
  initializeRepositoryPersistence,
  isPostgresPersistenceReady,
  resetPostgresRecordStoreForTests,
  setPostgresClientAvailableForTests,
  setPostgresRecordStoreForTests,
  type PostgresRecordStore,
} from './postgresRecordStore.js';

/** Create a repository bound to a namespace with automatic persist/load hooks. */
export function createNamespacedRepository<T extends { id: string }>(
  namespace: RepositoryNamespace,
  initial: T[] = [],
): KeyValueRepository<T> {
  return createRepositoryImpl(initial, namespace);
}

/**
 * Boot-time wiring for postgres persistence: hydrate namespaces, then rebind singleton adapters
 * (`approvalRepository`; `tenantService` and `auditAdapter` bind on next construction).
 */
export async function wireRepositoryAdaptersOnBoot(): Promise<void> {
  if (resolvePersistenceMode() !== 'postgres') return;
  await postgresRecordStore.initializeRepositoryPersistence();
  rewireApprovalRepository();
}
