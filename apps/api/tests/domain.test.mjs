import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAnomalies, ImmutableAuditLog, routeUserRequest, validateReading } from '../dist/index.js';

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
