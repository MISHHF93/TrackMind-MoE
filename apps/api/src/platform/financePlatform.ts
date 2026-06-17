import type { FinancePlatformWorkspaceDto } from '@trackmind/shared';

const now = () => new Date().toISOString();

export function createFinancePlatformWorkspace(): FinancePlatformWorkspaceDto {
  return {
    generatedAt: now(),
    revenue: { today: 125400, mtd: 892000, currency: 'USD' },
    expenses: { today: 48200, mtd: 318000, currency: 'USD' },
    budget: { allocated: 1200000, spent: 318000, remaining: 882000, currency: 'USD' },
    payouts: [
      { id: 'payout-1', amount: 45000, status: 'pending-approval', approvalId: 'approval-payout-1' },
      { id: 'payout-2', amount: 12000, status: 'released' },
    ],
    reconciliation: { pending: 3, matched: 47, exceptions: 1 },
    mock: false,
  };
}
