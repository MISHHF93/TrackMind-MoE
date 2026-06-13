import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditEvidenceCollectionVault, detectAnomalies, ImmutableAuditLog, routeUserRequest, validateReading } from '../dist/index.js';

test('MoE router returns structured evidence and protected approvals', async () => {
  const recommendation = await routeUserRequest('Can we scratch horse 3 and finalize official results?', 'rec-test');
  assert.equal(recommendation.id, 'rec-test');
  assert.equal(recommendation.status, 'draft');
  assert.ok(recommendation.requiredApprovals.includes('scratch-horse'));
  assert.ok(recommendation.requiredApprovals.includes('official-results'));
  assert.ok(recommendation.evidence.length > 0);
});

test('IoT validation and anomaly detection flags unsafe readings', () => {
  const reading = { moisture: 45, cushionDepth: 3, compaction: 250, temperature: 75, rainfall: 1, wind: 12, lightningDistance: 5, gateStatus: 'fault', lightingStatus: 'ok', cameraHealth: 'offline' };
  assert.deepEqual(validateReading(reading), []);
  assert.deepEqual(detectAnomalies(reading), ['lightning proximity requires weather review', 'camera offline', 'gate fault', 'wet track surface trend']);
});

test('audit log entries are hash chained and returned as copies', () => {
  const log = new ImmutableAuditLog();
  const first = log.append({ id: 'a1', type: 'user-action', actor: 'admin', timestamp: '2026-06-13T00:00:00Z', payload: { action: 'view' } });
  const second = log.append({ id: 'a2', type: 'approval', actor: 'steward', timestamp: '2026-06-13T00:01:00Z', payload: { status: 'approved' } });
  assert.equal(second.previousHash, first.hash);
  const copy = log.all();
  copy.pop();
  assert.equal(log.all().length, 2);
});

test('unified audit ledger supports verification, forensic timelines, legal hold, retention, and evidence collection', () => {
  const ledger = new ImmutableAuditLog();
  const action = ledger.append({
    id: 'ledger-1',
    type: 'workflow-action',
    actor: 'steward-1',
    timestamp: '2026-06-13T00:00:00Z',
    subjectId: 'race-7',
    workflowId: 'inquiry-9',
    correlationId: 'case-abc',
    regulations: ['state-racing-commission'],
    evidenceIds: ['ev-video-1'],
    payload: { action: 'open-inquiry' },
  });
  ledger.append({
    id: 'ledger-2',
    type: 'ai-recommendation',
    actor: 'moe-router',
    timestamp: '2026-06-13T00:01:00Z',
    subjectId: 'race-7',
    workflowId: 'inquiry-9',
    correlationId: 'case-abc',
    regulations: ['state-racing-commission'],
    evidenceIds: ['ev-video-1', 'ev-model-card'],
    payload: { recommendation: 'review head-on camera', confidence: 0.88 },
  });
  ledger.append({
    id: 'ledger-3',
    type: 'digital-twin-update',
    actor: 'twin-runtime',
    timestamp: '2026-06-13T00:02:00Z',
    subjectId: 'race-7',
    workflowId: 'inquiry-9',
    correlationId: 'case-abc',
    regulations: ['state-racing-commission'],
    payload: { twinId: 'horse-4', patch: { lane: 2 } },
  });

  assert.equal(ledger.verify().valid, true);
  assert.equal(ledger.forensicTimeline({ correlationId: 'case-abc' }).map((step) => step.id).join(','), 'ledger-1,ledger-2,ledger-3');

  const hold = ledger.placeLegalHold(['ledger-1'], 'compliance-officer', '2026-06-13T00:03:00Z', 'regulatory investigation')[0];
  assert.equal(hold.legalHold, true);
  assert.equal(ledger.complianceReport('state-racing-commission').recordCount, 4);
  assert.equal(ledger.retentionDisposition('2030-01-01T00:00:00Z', [{ id: 'commission-7-year', eventTypes: ['workflow-action', 'ai-recommendation', 'digital-twin-update'], retainForDays: 2555, regulatoryBasis: 'state-racing-retention' }]).find((item) => item.id === action.id).disposition, 'retain');

  const vault = new AuditEvidenceCollectionVault();
  const evidence = vault.collect({ id: 'ev-video-1', recordId: 'ledger-1', uri: 's3://evidence/video.mp4', collectedBy: 'investigator', collectedAt: '2026-06-13T00:04:00Z', content: { clip: 'head-on' } });
  assert.ok(evidence.hash.startsWith('sha256:'));
  assert.equal(vault.forRecord('ledger-1').length, 1);
});
