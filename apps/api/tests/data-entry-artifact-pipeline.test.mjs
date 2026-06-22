import test from 'node:test';
import assert from 'node:assert/strict';
import { ImmutableAuditLog } from '../dist/auditLog.js';
import { CentralizedApprovalService } from '../dist/approvals.js';
import { InMemoryEventBus } from '../dist/eventBus.js';
import { createDataEntryService } from '../dist/dataEntry/dataEntryService.js';

const audit = { ledger: new ImmutableAuditLog() };
const scope = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  actorId: 'admin-operator',
  role: 'admin',
  requestId: 'req-pipeline-api-1',
};

test('data entry submit records artifact pipeline emissions', () => {
  const service = createDataEntryService(audit, {
    eventBus: new InMemoryEventBus(),
  });
  const result = service.submit('horse', {
    name: 'Pipeline Runner',
    sex: 'colt',
    breed: 'TB',
    dataSource: 'registry-import',
    reason: 'Registered through governed data entry pipeline',
  }, scope, 'create');

  assert.equal(result.accepted, true);
  assert.ok(result.artifactId);
  assert.ok(result.lineageRefs?.length);
  assert.ok(result.pipeline?.complete);
  assert.equal(result.pipeline?.bypassBlocked, true);
  assert.ok(result.kpiSourceEventIds === undefined || Array.isArray(result.kpiSourceEventIds));
});

test('approval-governed submit creates approval request and blocks bypass', () => {
  const approvals = new CentralizedApprovalService({ audit, eventBus: new InMemoryEventBus() });
  const service = createDataEntryService(audit, { approvals });
  const result = service.submit('approval-request-composer', {
    composeMode: 'quick',
    requestTitle: 'Gate adjustment review',
    sourceDomain: 'race-day-action',
    requestedAction: 'starting-gate-move',
    requestedApproverRole: 'steward',
    riskLevel: 'high',
    reason: 'Pre-race gate alignment verification required before post time',
    relatedEntityKind: 'race',
    relatedEntityId: 'race-7',
  }, scope, 'create');

  assert.ok(result.approvalRequestId);
  assert.ok(result.pipeline?.approvalRequestId);
  assert.ok(result.lineageRefs?.includes(result.auditId));
});

test('compliance evidence submit links control and evidence through pipeline', () => {
  const service = createDataEntryService(audit);
  const result = service.submit('compliance-evidence', {
    entryMode: 'quick',
    title: 'Inspection capture',
    controlId: 'ctrl-security-audit',
    domain: 'security',
    evidenceType: 'screenshot',
    source: 'walkthrough',
    linkTargets: 'control:ctrl-security-audit',
    evidenceRefs: 'https://evidence.example/shot-1',
    notes: 'Security walkthrough evidence capture for quarterly review',
    reason: 'Security walkthrough evidence capture for quarterly review',
  }, scope, 'create');

  assert.ok(result.complianceEvidenceLinkIds?.length);
  assert.ok(result.pipeline?.complianceEvidenceLinkIds?.length);
  assert.ok(result.artifactId);
});
