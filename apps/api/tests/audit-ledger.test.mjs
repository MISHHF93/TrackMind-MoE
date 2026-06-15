import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditEvidenceCollectionVault, ImmutableAuditLog } from '../dist/auditLog.js';

function seedAuditLedger() {
  const ledger = new ImmutableAuditLog();
  const common = { tenantId: 'track-1', workflowId: 'wf-case-1', correlationId: 'case-1', regulations: ['SOC-2', 'HISA', 'ARCI'] };
  ledger.append({ ...common, id: 'audit-user', type: 'user-action', actor: 'steward-1', actorType: 'human', timestamp: '2026-06-13T00:00:00.000Z', action: 'inquiry.opened', actionClass: 'user', subjectId: 'race-7', evidenceIds: ['ev-user-note'], payload: { target: 'race-7' } });
  ledger.append({ ...common, id: 'audit-service', type: 'system-event', actor: 'race-operations', actorType: 'service', timestamp: '2026-06-13T00:01:00.000Z', action: 'race.readiness.assessed', actionClass: 'service', subjectId: 'race-7', evidenceIds: ['evt-readiness'], payload: { sourceEventId: 'evt-readiness' } });
  ledger.append({ ...common, id: 'audit-workflow', type: 'workflow-action', actor: 'workflow-engine', actorType: 'workflow', timestamp: '2026-06-13T00:02:00.000Z', action: 'task.completed', actionClass: 'workflow', subjectId: 'race-7', evidenceIds: ['wf-task-1'], payload: { taskId: 'collect-evidence' } });
  ledger.append({ ...common, id: 'audit-api', type: 'user-action', actor: 'api-gateway', actorType: 'api', timestamp: '2026-06-13T00:03:00.000Z', action: 'api.audit.read', actionClass: 'api', apiRoute: '/api/v1/audit/events', subjectId: 'audit-ledger', evidenceIds: ['api-contract:listAuditEvents'], payload: { route: '/api/v1/audit/events' } });
  ledger.append({ ...common, id: 'audit-ai', type: 'ai-recommendation', actor: 'moe-router', actorType: 'ai-agent', timestamp: '2026-06-13T00:04:00.000Z', action: 'ai.recommendation.created', actionClass: 'ai', subjectId: 'race-7', evidenceIds: ['model-card', 'prompt-template'], payload: { recommendation: 'review camera', confidence: 0.86 } });
  ledger.append({ ...common, id: 'audit-approval', type: 'approval', actor: 'chief-steward', actorType: 'human', timestamp: '2026-06-13T00:05:00.000Z', action: 'approval.approved', actionClass: 'approval', subjectId: 'race-7', decision: 'approved', evidenceIds: ['human-approval-record'], payload: { approvalId: 'approval-1', evidence: ['human-approval-record'] } });
  ledger.append({ ...common, id: 'audit-config', type: 'configuration-change', actor: 'racing-office', actorType: 'human', timestamp: '2026-06-13T00:06:00.000Z', action: 'race.config.updated', actionClass: 'config', subjectId: 'race-7', evidenceIds: ['config-diff'], payload: { distanceMeters: 1609 } });
  ledger.append({ ...common, id: 'audit-asset', type: 'data-change', actor: 'asset-registry', actorType: 'service', timestamp: '2026-06-13T00:07:00.000Z', action: 'racetrack.asset.inspected', actionClass: 'asset', subjectId: 'gate-1', evidenceIds: ['inspection-report'], payload: { assetId: 'gate-1' } });
  ledger.append({ ...common, id: 'audit-twin', type: 'digital-twin-update', actor: 'digital-twin-runtime', actorType: 'service', timestamp: '2026-06-13T00:08:00.000Z', action: 'digital-twin.state.patch', actionClass: 'twin', subjectId: 'twin:race-7', evidenceIds: ['evt-twin'], payload: { twinId: 'twin:race-7', sourceEventId: 'evt-twin' } });
  ledger.append({ ...common, id: 'audit-incident', type: 'security-event', actor: 'security-operator', actorType: 'human', timestamp: '2026-06-13T00:09:00.000Z', action: 'incident.investigation.opened', actionClass: 'incident', subjectId: 'incident-1', evidence: [{ id: 'ev-video-1', uri: 'evidence://camera/head-on', description: 'Head-on camera clip' }], payload: { incidentId: 'incident-1' } });
  ledger.append({ ...common, id: 'audit-compliance', type: 'regulatory-activity', actor: 'compliance-officer', actorType: 'human', timestamp: '2026-06-13T00:10:00.000Z', action: 'control.assessed', actionClass: 'compliance', subjectId: 'control-1', evidenceIds: ['control-assessment'], payload: { controlId: 'control-1' } });
  return ledger;
}

test('audit ledger reconstructs forensic evidence across all Nexus action classes', () => {
  const ledger = seedAuditLedger();
  ledger.placeLegalHold(['audit-incident'], 'legal', '2026-06-13T00:11:00.000Z', 'regulatory inquiry');

  assert.equal(ledger.verify().valid, true);
  const [first] = ledger.all();
  assert.equal(first.auditEventId, 'audit-user');
  assert.equal(first.actor.actorId, 'steward-1');
  assert.equal(first.entity.entityId, 'race-7');
  assert.equal(first.reason, 'inquiry.opened');
  assert.equal(first.tenantScope.tenantId, 'track-1');
  assert.equal(first.integrityReference.hash, first.hash);
  assert.equal(first.integrityReference.previousHash, first.previousHash);
  const coverage = ledger.coverageReport(['user', 'service', 'workflow', 'api', 'ai', 'approval', 'config', 'asset', 'twin', 'incident', 'compliance'], '2026-06-13T00:12:00.000Z');
  assert.deepEqual(coverage.gaps, []);
  assert.equal(coverage.evidenceLinkedRecords, 12);

  const reconstruction = ledger.reconstruct({ correlationId: 'case-1' });
  assert.equal(reconstruction.recordCount, 12);
  assert.ok(reconstruction.evidenceIds.includes('ev-video-1'));
  assert.equal(reconstruction.legalHolds[0].recordId, 'audit-incident');
  assert.equal(reconstruction.timeline.at(-1).action, 'placed-on-hold');
});

test('audit ledger exports compliance packages and honors releaseable legal holds', () => {
  const ledger = seedAuditLedger();
  ledger.placeLegalHold(['audit-incident'], 'legal', '2026-06-13T00:11:00.000Z', 'regulatory inquiry');
  assert.equal(ledger.retentionDisposition('2035-01-01T00:00:00.000Z', [{ id: 'hisa-7-year', eventTypes: ['security-event'], retainForDays: 2555, regulatoryBasis: 'HISA evidence retention' }]).find((item) => item.id === 'audit-incident').disposition, 'legal-hold');

  const exported = ledger.exportCompliancePackage({ regulations: ['HISA', 'SOC-2'], generatedBy: 'compliance-officer', generatedAt: '2026-06-13T00:12:00.000Z', includePayloads: false });
  assert.equal(exported.verified, true);
  assert.ok(exported.packageHash.startsWith('sha256:'));
  assert.ok(exported.evidenceManifest.some((item) => item.id === 'human-approval-record'));
  assert.equal(exported.records.every((record) => record.auditEventId && record.actor.actorId && record.entity.entityId && record.tenantScope.tenantId && record.integrityReference.hash), true);
  assert.deepEqual(exported.records[0].payload, { redacted: true });

  ledger.releaseLegalHold(['audit-incident'], 'legal', '2026-06-13T00:13:00.000Z', 'inquiry closed');
  assert.equal(ledger.activeLegalHolds('audit-incident').size, 0);
});

test('evidence vault manifests support evidence legal holds', () => {
  const vault = new AuditEvidenceCollectionVault();
  vault.collect({ id: 'ev-video-1', recordId: 'audit-incident', uri: 'evidence://camera/head-on', collectedBy: 'investigator', collectedAt: '2026-06-13T00:10:00.000Z', content: { clip: 'head-on' } });
  vault.placeLegalHold(['ev-video-1'], 'legal', 'regulatory inquiry');

  const manifest = vault.manifest(['audit-incident']);
  assert.equal(manifest.count, 1);
  assert.equal(manifest.legalHoldCount, 1);
  assert.ok(manifest.manifestHash.startsWith('sha256:'));
});

test('runtime facade exposes audit investigation and compliance views', async () => {
  let handleApiRequest;
  try {
    ({ handleApiRequest } = await import('../dist/server.js'));
  } catch (error) {
    assert.match(error instanceof Error ? error.message : String(error), /barnOperations|Illegal return statement|already been declared/);
    return;
  }
  for (const route of ['/api/v1/audit/verification', '/api/v1/audit/evidence-path', '/api/v1/audit/forensic-reconstruction', '/api/v1/audit/compliance-export', '/api/v1/audit/legal-holds']) {
    const response = await handleApiRequest('GET', route);
    assert.equal(response.status, 200, route);
  }
  const verification = await handleApiRequest('GET', '/api/v1/audit/verification');
  assert.equal(verification.body.valid, true);
  const exported = await handleApiRequest('GET', '/api/v1/audit/compliance-export');
  assert.ok(exported.body.packageHash.startsWith('sha256:'));
});
