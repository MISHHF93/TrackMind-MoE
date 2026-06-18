import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CentralizedApprovalService,
  ImmutableAuditLog,
  createSeededFanExperience,
} from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

test('fan experience workspace exposes attendance hospitality premium seating guest services satisfaction analytics and revenue linkage', () => {
  const platform = createSeededFanExperience({ tenantId: 'trackmind', racetrackId: 'main-track' });
  const workspace = platform.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.fan-experience-operations.v1');
  assert.ok(workspace.attendanceTracking.snapshots.length >= 1);
  assert.ok(workspace.attendanceTracking.zones.length >= 3);
  assert.ok(workspace.hospitality.packages.length >= 2);
  assert.ok(workspace.premiumSeating.length >= 3);
  assert.ok(workspace.guestServices.length >= 3);
  assert.ok(workspace.eventSatisfaction.length >= 1);
  assert.ok(workspace.fanAnalytics.trends.length >= 5);
  assert.ok(workspace.revenueLinkage.length >= 5);
  assert.equal(workspace.guardrails.refundsRequireApproval, true);
  assert.ok(workspace.dashboard.panels.length >= 6);
  assert.ok(workspace.attendance.current > 0);
  assert.ok(workspace.crowdDensity.length >= 3);
  assert.deepEqual(validateContract('FanExperienceOperationsDto', workspace, apiContractSchemas.FanExperienceOperationsDto), { valid: true, errors: [] });
});

test('fan experience mutations record attendance satisfaction and approval-governed refund requests', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const platform = createSeededFanExperience({ approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });

  platform.recordAttendanceSnapshot({
    recordedAt: '2026-06-14T13:00:00.000Z',
    current: 9100,
    capacity: 12000,
    entryRatePerMinute: 36,
  });

  const refund = platform.createGuestServiceRequest({
    category: 'refund',
    status: 'open',
    priority: 'high',
    submittedAt: '2026-06-14T13:00:00.000Z',
    guestLabel: 'Guest R-44',
    zone: 'grandstand',
    waitMinutes: 0,
    details: 'Weather delay refund request',
  });
  assert.ok(refund.approvalRequestId);
  assert.ok(approvalService.allRequests().some((request) => request.action === 'payout'));

  platform.recordSatisfactionSurvey({
    eventId: 'race-day-main',
    submittedAt: '2026-06-14T14:00:00.000Z',
    overallRating: 4.6,
    categories: [{ category: 'overall', rating: 4.6 }],
  });

  const workspace = platform.workspace('2026-06-14T14:00:00.000Z');
  assert.ok(workspace.attendanceTracking.snapshots.length >= 2);
  assert.ok(workspace.eventSatisfaction.length >= 2);
  assert.ok(auditLog.all().length >= 1);
});
