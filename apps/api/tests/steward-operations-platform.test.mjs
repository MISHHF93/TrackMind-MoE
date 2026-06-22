import test from 'node:test';
import assert from 'node:assert/strict';
import { ImmutableAuditLog, createSeededStewardOperations, createStewardOperationsIntegrations } from '../dist/index.js';
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

test('steward operations final ruling requires verified approval token and preserves human-only invariants', () => {
  const auditLog = new ImmutableAuditLog();
  const integrations = createStewardOperationsIntegrations(auditLog);
  const stewardOperations = createSeededStewardOperations({ auditLog, tenantId: 'track-1', racetrackId: 'race-7', integrations });
  const inquiry = stewardOperations.workspace('2026-06-14T12:00:00.000Z').inquiries[0];
  const inquiryId = inquiry.id;
  const evidenceIds = inquiry.evidenceReferences.map((evidence) => evidence.id);
  const ruleIds = inquiry.ruleReferences.map((rule) => rule.id);
  const approvalRequestId = 'approval-final-ruling-test';
  stewardOperations.requestApproval(inquiryId, {
    id: approvalRequestId,
    tenantId: 'track-1',
    racetrackId: 'race-7',
    requestedBy: 'steward-1',
    actorType: 'human',
    reason: 'Panel ready for human final ruling',
    evidence: [...evidenceIds, 'human-approval-record'],
    now: '2026-06-14T12:00:00.000Z',
  });
  const rulingBase = {
    id: 'final-test-1',
    issuedBy: 'steward-1',
    issuedByRole: 'steward',
    issuedAt: '2026-06-14T12:00:00.000Z',
    decision: 'Objection dismissed; official results unchanged',
    rationale: 'Insufficient interference after human panel review',
    penalties: [],
    evidenceIds,
    ruleIds,
  };

  assert.throws(
    () => stewardOperations.issueFinalRuling(inquiryId, rulingBase),
    /approval token|Controlled action/,
  );

  assert.throws(
    () => stewardOperations.issueFinalRuling(inquiryId, {
      ...rulingBase,
      id: 'final-ai-bad',
      issuedBy: 'steward-ai',
      issuedByRole: 'ai-agent',
    }),
    /authorized human steward/,
  );

  assert.equal(inquiry.finalRuling, undefined);

  const approvalService = integrations.approvals;
  assert.ok(approvalService);
  approvalService.decide(
    approvalRequestId,
    { id: 'steward-1', roles: ['steward'], human: true },
    'approved',
    'Steward panel approval',
    [...evidenceIds, 'human-approval-record'],
    '2026-06-14T12:01:00.000Z',
  );
  const token = approvalService.authorizeExecution({
    requestId: approvalRequestId,
    action: 'steward-decision',
    target: inquiryId,
    tenantId: 'track-1',
    racetrackId: 'race-7',
    actor: { id: 'steward-1', roles: ['steward'], human: true },
    now: '2026-06-14T12:02:00.000Z',
  });

  const recorded = stewardOperations.issueFinalRuling(inquiryId, rulingBase, 'steward-1', {
    approvalToken: token,
    tenantId: 'track-1',
    racetrackId: 'race-7',
  });
  assert.equal(recorded.eventType, 'steward-operations.final-ruling.recorded');

  const updated = stewardOperations.getInquiry(inquiryId, '2026-06-14T12:03:00.000Z');
  assert.equal(updated?.finalRuling?.decision, rulingBase.decision);
  assert.equal(updated?.finalRuling?.officialResultsModified, false);
  assert.equal(updated?.status, 'finalized');
});
