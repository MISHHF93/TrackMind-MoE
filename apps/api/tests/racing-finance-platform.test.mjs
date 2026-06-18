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
