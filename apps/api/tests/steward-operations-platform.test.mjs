import test from 'node:test';
import assert from 'node:assert/strict';
import { ImmutableAuditLog, createSeededStewardOperations } from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

test('steward operations workspace exposes inquiries reviews workflows advisory recommendations audit and approval linkage', () => {
  const auditLog = new ImmutableAuditLog();
  const stewardOperations = createSeededStewardOperations({ auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const workspace = stewardOperations.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.steward-operations.v1');
  assert.ok(workspace.inquiries.length >= 1);
  assert.ok(workspace.reviews.length >= 1);
  assert.ok(workspace.decisionWorkflows.length >= 1);
  assert.equal(workspace.recommendationSupport.advisoryOnly, true);
  assert.equal(workspace.recommendationSupport.mayIssueOfficialRuling, false);
  assert.equal(workspace.recommendationSupport.mayModifyOfficialResults, false);
  assert.ok(workspace.dashboard.panels.length >= 5);
  assert.ok(workspace.auditTrail.length >= 1);
  assert.deepEqual(validateContract('StewardOperationsWorkspaceDto', workspace, apiContractSchemas.StewardOperationsWorkspaceDto), { valid: true, errors: [] });

  const inquiry = workspace.inquiries[0];
  assert.equal(inquiry.aiGuardrails.advisoryOnly, true);
  assert.equal(inquiry.aiGuardrails.mayIssueOfficialRuling, false);
  assert.ok(inquiry.integrations.approvalRequestIds.length >= 1);
  assert.ok(inquiry.integrations.auditRecordIds.length >= 1);
});

test('steward operations recordReview and advisory recommendation mutations are audit linked', () => {
  const auditLog = new ImmutableAuditLog();
  const stewardOperations = createSeededStewardOperations({ auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const inquiryId = stewardOperations.workspace().inquiries[0].id;

  const review = stewardOperations.recordReview(inquiryId, {
    reviewedAt: '2026-06-14T12:00:00.000Z',
    reviewerId: 'steward-2',
    reviewerRole: 'steward',
    reviewType: 'panel',
    status: 'complete',
    findings: ['Panel reviewed objection with full evidence chain'],
    evidenceIds: [],
    ruleIds: [],
  });
  assert.ok(review.auditId);

  const recommendation = stewardOperations.createAdvisoryRecommendation(inquiryId, 'steward-ai');
  assert.equal(recommendation.eventType, 'steward-operations.recommendation.created');

  const workspace = stewardOperations.workspace('2026-06-14T12:00:00.000Z');
  assert.ok(workspace.recommendationSupport.recommendations.every((item) => item.advisoryOnly === true && item.officialRuling === false));

  const trail = stewardOperations.auditTrail(inquiryId, '2026-06-14T12:00:00.000Z');
  assert.ok(trail.records.length >= 2);
  assert.ok(trail.records.every((record) => record.hash && record.previousHash));
  assert.ok(auditLog.all().length >= 1);
});
