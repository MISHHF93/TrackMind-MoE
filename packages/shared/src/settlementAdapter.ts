export type SettlementAdapterKind = 'general-ledger' | 'settlement' | 'payout-rail';

export type SettlementAdapterStatus = 'connected' | 'degraded' | 'disconnected' | 'mock';

export type SettlementSyncStatus = 'synced' | 'pending' | 'failed' | 'stale';

export type LedgerEntryStatus = 'posted' | 'pending' | 'exception';

export type LedgerReferenceType = 'purse' | 'payout' | 'revenue' | 'expense' | 'settlement';

export interface LedgerEntryReadModel {
  entryId: string;
  adapterId: string;
  accountCode: string;
  accountLabel: string;
  debitAmount: number;
  creditAmount: number;
  currency: string;
  postingDate: string;
  referenceType: LedgerReferenceType;
  referenceId: string;
  status: LedgerEntryStatus;
  auditReference?: string;
}

export interface SettlementAdapterDescriptor {
  adapterId: string;
  kind: SettlementAdapterKind;
  vendor: string;
  status: SettlementAdapterStatus;
  ledgerAccountIds: string[];
  streams: string[];
  lastSyncAt: string;
  mock: boolean;
}

export interface SettlementLedgerSnapshot {
  generatedAt: string;
  adapters: SettlementAdapterDescriptor[];
  entries: LedgerEntryReadModel[];
  syncStatus: SettlementSyncStatus;
  lastSuccessfulSyncAt?: string;
  pendingPostings: number;
  exceptionCount: number;
  coveragePct: number;
  mock: boolean;
}

export interface SettlementAdapter {
  readonly descriptor: SettlementAdapterDescriptor;
  readLedger(at?: string): LedgerEntryReadModel[];
}

export interface SettlementAdapterRegistry {
  list(): SettlementAdapterDescriptor[];
  snapshot(now?: string): SettlementLedgerSnapshot;
  sync(now?: string): SettlementLedgerSnapshot;
}
