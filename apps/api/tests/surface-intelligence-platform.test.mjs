import test from 'node:test';
import assert from 'node:assert/strict';
import { CentralizedApprovalService, ImmutableAuditLog, createSeededSurfaceIntelligence } from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

test('surface intelligence platform workspace exposes observations history maintenance inspections trends and readiness', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const surfaceIntelligence = createSeededSurfaceIntelligence({ approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const workspace = surfaceIntelligence.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.surface-intelligence.v1');
  assert.ok(workspace.observations.length >= 1);
  assert.ok(workspace.conditionHistory.length >= 1);
  assert.ok(workspace.maintenanceEvents.length >= 1);
  assert.ok(workspace.inspectionWorkflows.length >= 1);
  assert.ok(workspace.trendAnalytics.length >= 1);
  assert.ok(workspace.readinessIndicators.length >= 5);
  assert.equal(workspace.operationalActionsRequireHumanApproval, true);
  assert.equal(workspace.guardrails.advisoryOnly, true);
  assert.ok(workspace.dashboard.panels.length >= 5);
  assert.deepEqual(validateContract('SurfaceIntelligenceOperationsDto', workspace, apiContractSchemas.SurfaceIntelligenceOperationsDto), { valid: true, errors: [] });
});

test('surface intelligence mutations record observations maintenance and approval-governed operational actions', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const surfaceIntelligence = createSeededSurfaceIntelligence({ approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });

  surfaceIntelligence.recordObservation({
    sectionId: 'stretch',
    observedAt: '2026-06-14T12:00:00.000Z',
    observerId: 'steward-1',
    role: 'steward',
    severity: 2,
    note: 'Synthetic strip riding even',
    evidence: ['post-workout-review'],
  });

  surfaceIntelligence.recordMaintenance({
    sectionId: 'stretch',
    completedAt: '2026-06-14T12:00:00.000Z',
    action: 'roll',
    effectiveness: 9,
    notes: 'Light roll before late races',
    performedBy: 'maintenance-crew',
    evidence: ['roller-pass'],
  });

  const approval = surfaceIntelligence.requestOperationalAction({
    action: 'harrowing',
    sectionId: 'far-turn',
    reason: 'Address compaction after morning works',
    requestedBy: 'track-superintendent',
  });
  assert.ok(approval.approvalRequestId);

  const workspace = surfaceIntelligence.workspace('2026-06-14T12:00:00.000Z');
  assert.ok(workspace.observations.length >= 2);
  assert.ok(workspace.maintenanceEvents.length >= 3);
  assert.ok(workspace.trendAnalytics.some((trend) => trend.metric === 'condition-score'));
  assert.ok(approvalService.allRequests().some((request) => request.action === 'surface-harrowing'));
  assert.ok(auditLog.all().length >= 1);
});
