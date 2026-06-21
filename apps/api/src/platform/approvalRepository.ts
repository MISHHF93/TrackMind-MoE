import { createRepository, type KeyValueRepository } from '../repository/index.js';

/** Module-scoped repository so approval records survive process restarts within the same runtime. */
export interface StoredApprovalRecord {
  id: string;
  request: unknown;
  auditIds: string[];
  eventIds: string[];
  reminderSentAt?: string;
  updatedAt: string;
}

let sharedApprovalRepository: KeyValueRepository<StoredApprovalRecord> | undefined;

export function getApprovalRepository(): KeyValueRepository<StoredApprovalRecord> {
  if (!sharedApprovalRepository) {
    sharedApprovalRepository = createRepository<StoredApprovalRecord>([]);
  }
  return sharedApprovalRepository;
}

export function resetApprovalRepositoryForTests(): void {
  sharedApprovalRepository = createRepository<StoredApprovalRecord>([]);
}
