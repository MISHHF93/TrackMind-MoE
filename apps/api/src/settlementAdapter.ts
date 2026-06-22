import type {
  LedgerEntryReadModel,
  SettlementAdapter,
  SettlementAdapterDescriptor,
  SettlementAdapterRegistry,
  SettlementLedgerSnapshot,
} from '@trackmind/shared';

const now = () => new Date().toISOString();

class MockSettlementAdapter implements SettlementAdapter {
  constructor(
    readonly descriptor: SettlementAdapterDescriptor,
    private readonly entries: LedgerEntryReadModel[],
  ) {}

  readLedger(at = now()): LedgerEntryReadModel[] {
    return this.entries.map((entry) => ({ ...entry, postingDate: entry.postingDate || at.slice(0, 10) }));
  }
}

export class SettlementAdapterRegistryImpl implements SettlementAdapterRegistry {
  private readonly adapters: MockSettlementAdapter[];
  private lastSuccessfulSyncAt?: string;

  constructor(seedAt = now()) {
    this.adapters = [
      new MockSettlementAdapter(
        {
          adapterId: 'adapter-gl-core',
          kind: 'general-ledger',
          vendor: 'finance-erp-mock',
          status: 'connected',
          ledgerAccountIds: ['4100-revenue', '5100-expense', '2200-purse-liability'],
          streams: ['finance.gl.postings'],
          lastSyncAt: seedAt,
          mock: true,
        },
        [
          {
            entryId: 'gl-entry-revenue-tickets',
            adapterId: 'adapter-gl-core',
            accountCode: '4100',
            accountLabel: 'Ticket revenue',
            debitAmount: 0,
            creditAmount: 42_800,
            currency: 'USD',
            postingDate: seedAt.slice(0, 10),
            referenceType: 'revenue',
            referenceId: 'ticket-revenue-ga',
            status: 'posted',
            auditReference: 'audit-finance-ticket-revenue',
          },
          {
            entryId: 'gl-entry-expense-steward',
            adapterId: 'adapter-gl-core',
            accountCode: '5100',
            accountLabel: 'Race-day expenses',
            debitAmount: 4_200,
            creditAmount: 0,
            currency: 'USD',
            postingDate: seedAt.slice(0, 10),
            referenceType: 'expense',
            referenceId: 'race-expense-steward',
            status: 'posted',
            auditReference: 'audit-finance-race-day',
          },
          {
            entryId: 'gl-entry-purse-liability',
            adapterId: 'adapter-gl-core',
            accountCode: '2200',
            accountLabel: 'Purse liability',
            debitAmount: 0,
            creditAmount: 85_000,
            currency: 'USD',
            postingDate: seedAt.slice(0, 10),
            referenceType: 'purse',
            referenceId: 'race-7-purse',
            status: 'posted',
          },
        ],
      ),
      new MockSettlementAdapter(
        {
          adapterId: 'adapter-settlement-rail',
          kind: 'settlement',
          vendor: 'payout-settlement-mock',
          status: 'connected',
          ledgerAccountIds: ['2300-settlement-clearing'],
          streams: ['finance.settlement.batch'],
          lastSyncAt: seedAt,
          mock: true,
        },
        [
          {
            entryId: 'settlement-batch-payout-1',
            adapterId: 'adapter-settlement-rail',
            accountCode: '2300',
            accountLabel: 'Settlement clearing',
            debitAmount: 45_000,
            creditAmount: 0,
            currency: 'USD',
            postingDate: seedAt.slice(0, 10),
            referenceType: 'settlement',
            referenceId: 'payout-1',
            status: 'pending',
          },
        ],
      ),
      new MockSettlementAdapter(
        {
          adapterId: 'adapter-payout-rail',
          kind: 'payout-rail',
          vendor: 'ach-rail-mock',
          status: 'degraded',
          ledgerAccountIds: ['1200-cash'],
          streams: ['finance.payout.disbursement'],
          lastSyncAt: seedAt,
          mock: true,
        },
        [
          {
            entryId: 'payout-rail-exception',
            adapterId: 'adapter-payout-rail',
            accountCode: '1200',
            accountLabel: 'Cash disbursement',
            debitAmount: 12_000,
            creditAmount: 0,
            currency: 'USD',
            postingDate: seedAt.slice(0, 10),
            referenceType: 'payout',
            referenceId: 'payout-2',
            status: 'exception',
          },
        ],
      ),
    ];
  }

  list(): SettlementAdapterDescriptor[] {
    return this.adapters.map((adapter) => ({ ...adapter.descriptor }));
  }

  snapshot(at = now()): SettlementLedgerSnapshot {
    const adapters = this.list();
    const entries = this.adapters.flatMap((adapter) => adapter.readLedger(at));
    const connected = adapters.filter((adapter) => adapter.status === 'connected').length;
    const pendingPostings = entries.filter((entry) => entry.status === 'pending').length;
    const exceptionCount = entries.filter((entry) => entry.status === 'exception').length;
    const syncStatus = this.lastSuccessfulSyncAt ? 'synced' : exceptionCount > 0 || pendingPostings > 0 ? 'pending' : 'stale';
    return {
      generatedAt: at,
      adapters,
      entries,
      syncStatus,
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      pendingPostings,
      exceptionCount,
      coveragePct: adapters.length ? Math.round((connected / adapters.length) * 100) : 0,
      mock: true,
    };
  }

  sync(at = now()): SettlementLedgerSnapshot {
    for (const adapter of this.adapters) {
      adapter.descriptor.lastSyncAt = at;
    }
    this.lastSuccessfulSyncAt = at;
    return this.snapshot(at);
  }
}

export function createSettlementAdapterRegistry(seedAt?: string): SettlementAdapterRegistry {
  return new SettlementAdapterRegistryImpl(seedAt);
}
