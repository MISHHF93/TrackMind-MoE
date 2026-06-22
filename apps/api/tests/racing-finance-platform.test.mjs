import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CentralizedApprovalService,
  ImmutableAuditLog,
  createSeededRacingFinance,
} from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

test('racing finance workspace exposes purses expenses costs revenue KPIs and audit trail', () => {
  const at = '2026-06-14T12:00:00.000Z';
  const platform = createSeededRacingFinance({ tenantId: 'trackmind', racetrackId: 'main-track' }, at);
  const workspace = platform.workspace(at);

  assert.equal(workspace.schemaVersion, 'trackmind.racing-finance-operations.v1');
  assert.ok(workspace.purses.length >= 2);
  assert.ok(workspace.payoutQueue.length >= 2);
  assert.ok(workspace.approvalControls.length >= 1);
  assert.ok(workspace.raceDayExpenses.length >= 2);
  assert.ok(workspace.operationalCosts.length >= 2);
  assert.ok(workspace.facilityCosts.length >= 2);
  assert.ok(workspace.ticketRevenue.length >= 2);
  assert.ok(workspace.hospitalityRevenue.length >= 1);
  assert.equal(workspace.guardrails.financialMutationsAudited, true);
  assert.equal(workspace.guardrails.payoutsRequireApproval, true);
  assert.ok(workspace.dashboard.panels.length >= 6);
  assert.ok(workspace.auditTrail.length >= 1);
  assert.ok(workspace.revenue.today > 0);
  assert.ok(workspace.budget.allocated > workspace.budget.spent);
  assert.ok(workspace.settlement);
  assert.ok(Array.isArray(workspace.settlement.adapters));
  assert.ok(workspace.settlement.adapters.length >= 2);
  assert.ok(Array.isArray(workspace.settlement.entries));
  assert.ok(workspace.settlement.entries.length >= 1);
  assert.equal(workspace.settlement.mock, true);
  assert.deepEqual(validateContract('RacingFinanceOperationsDto', workspace, apiContractSchemas.RacingFinanceOperationsDto), { valid: true, errors: [] });
});

test('racing finance mutations record expenses and approval-governed purse release and payouts', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const platform = createSeededRacingFinance({ approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const purseId = platform.workspace().purses[0]?.purseId;
  assert.ok(purseId);

  const release = platform.requestPurseRelease(purseId);
  assert.ok(release.approvalRequestId);

  const payout = platform.requestPayout(8500, 'Trainer settlement');
  assert.ok(payout.approvalRequestId);

  platform.recordRaceDayExpense({
    raceDayId: 'race-day-main',
    category: 'race-day',
    label: 'Photo finish surcharge',
    amount: 1200,
    currency: 'USD',
    status: 'recorded',
    incurredAt: '2026-06-14T13:00:00.000Z',
  });

  const workspace = platform.workspace('2026-06-14T13:00:00.000Z');
  assert.ok(workspace.raceDayExpenses.length >= 3);
  assert.ok(approvalService.allRequests().some((request) => request.action === 'payout'));
  assert.ok(auditLog.all().length >= 1);
  assert.ok(workspace.auditTrail.every((record, index, records) => index === 0 || record.previousHash === records[index - 1]?.hash));
});

test('racing finance payout release requires verified approval token after dual-control approval', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const platform = createSeededRacingFinance({ approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const payout = platform.requestPayout(8500, 'Trainer settlement');
  assert.ok(payout.approvalRequestId);

  assert.throws(
    () => platform.releasePayout(payout.recordId ?? 'missing', 'finance'),
    /requires verified approvalToken/,
  );

  const approvalRequestId = payout.approvalRequestId;
  const payoutId = payout.recordId;
  assert.ok(approvalRequestId);
  assert.ok(payoutId);

  approvalService.decide(approvalRequestId, { id: 'steward-1', roles: ['steward'], human: true }, 'approved', 'Steward approval', ['human-approval-record']);
  approvalService.decide(approvalRequestId, { id: 'finance-1', roles: ['finance'], human: true }, 'approved', 'Finance approval', ['human-approval-record']);
  const token = approvalService.authorizeExecution({
    requestId: approvalRequestId,
    action: 'payout',
    target: payoutId,
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    actor: { id: 'finance-1', roles: ['finance'], human: true },
  });

  const released = platform.releasePayout(payoutId, 'finance', { approvalToken: token });
  assert.equal(released.eventType, 'racing-finance.payout.released');
  assert.ok(platform.workspace().payouts.some((entry) => entry.id === payoutId && entry.status === 'released'));
});

test('racing finance settlement sync records ledger read model and audit trail', () => {
  const auditLog = new ImmutableAuditLog();
  const platform = createSeededRacingFinance({ auditLog, tenantId: 'trackmind', racetrackId: 'main-track' }, '2026-06-14T12:00:00.000Z');
  const workspace = platform.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.settlement.syncStatus, 'synced');
  assert.ok(workspace.settlement.lastSuccessfulSyncAt);
  assert.ok(workspace.settlement.adapters.some((adapter) => adapter.kind === 'general-ledger'));
  assert.ok(workspace.settlement.adapters.some((adapter) => adapter.kind === 'settlement'));
  assert.ok(workspace.settlement.entries.some((entry) => entry.referenceType === 'revenue'));
  assert.ok(workspace.settlement.entries.some((entry) => entry.status === 'exception' || entry.status === 'pending'));
  assert.ok(workspace.dashboard.panels.some((panel) => panel.kpiId === 'finance-settlement-sync'));
  assert.ok(workspace.auditTrail.some((record) => record.action === 'racing-finance.settlement.synced'));
  assert.ok(auditLog.all().some((entry) => entry.payload?.action === 'racing-finance.settlement.synced'));

  const resync = platform.syncSettlement('finance', '2026-06-14T13:00:00.000Z');
  assert.equal(resync.eventType, 'racing-finance.settlement.synced');
  const refreshed = platform.workspace('2026-06-14T13:00:00.000Z');
  assert.equal(refreshed.settlement.syncStatus, 'synced');
  assert.equal(refreshed.settlement.lastSuccessfulSyncAt, '2026-06-14T13:00:00.000Z');
});
