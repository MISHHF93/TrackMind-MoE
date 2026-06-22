import {
  createNamespacedRepository,
  resolvePersistenceMode,
  type KeyValueRepository,
  type PersistenceMode,
} from '../repository/repositoryAdapter.js';

/** Module-scoped repository — uses `createNamespacedRepository` when `PERSISTENCE_MODE=postgres`. */
export interface StoredApprovalRecord {
  id: string;
  request: unknown;
  auditIds: string[];
  eventIds: string[];
  reminderSentAt?: string;
  updatedAt: string;
}

let sharedApprovalRepository: KeyValueRepository<StoredApprovalRecord> | undefined;
let sharedApprovalRepositoryMode: PersistenceMode | undefined;

export function getApprovalRepository(): KeyValueRepository<StoredApprovalRecord> {
  const mode = resolvePersistenceMode();
  if (!sharedApprovalRepository || sharedApprovalRepositoryMode !== mode) {
    sharedApprovalRepository = createNamespacedRepository<StoredApprovalRecord>('platform.approvals', []);
    sharedApprovalRepositoryMode = mode;
  }
  return sharedApprovalRepository;
}

/** Rebind the module-scoped approval repository after postgres hydration on API boot. */
export function rewireApprovalRepository(): void {
  sharedApprovalRepository = createNamespacedRepository<StoredApprovalRecord>('platform.approvals', []);
  sharedApprovalRepositoryMode = resolvePersistenceMode();
}

export function resetApprovalRepositoryForTests(): void {
  rewireApprovalRepository();
}
