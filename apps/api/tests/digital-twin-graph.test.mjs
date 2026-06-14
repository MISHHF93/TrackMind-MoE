import test from 'node:test';
import assert from 'node:assert/strict';
import { DigitalTwinGraph } from '../dist/twinGraph.js';

test('digital twin graph exposes dependency graph and state replay helpers', () => {
  const graph = new DigitalTwinGraph();
  graph.upsertNode({ id: 'horse-1', tenantId: 'trk-1', kind: 'biological', labels: ['Horse'], name: 'Sample Horse', state: { stall: 'A1' }, updatedAt: '2026-06-13T00:00:00Z' });
  graph.upsertNode({ id: 'race-1', tenantId: 'trk-1', kind: 'operational', labels: ['Race'], name: 'Race 1', state: { status: 'scheduled' }, updatedAt: '2026-06-13T00:00:00Z' });
  graph.relate({ from: 'horse-1', to: 'race-1', type: 'DEPENDS_ON', properties: { evidence: ['entry-card'] } });

  graph.applyStateUpdate({ nodeId: 'horse-1', tenantId: 'trk-1', patch: { gps: [38.1, -77.1] }, observedAt: '2026-06-13T00:01:00Z', source: 'gps', actor: 'gps-service', evidence: ['gps-observation-1'] });

  assert.equal(graph.dependencyGraph(['horse-1'], 'trk-1').relationships.length, 1);
  assert.deepEqual(graph.stateAt('horse-1', '2026-06-13T00:01:00Z').gps, [38.1, -77.1]);
  assert.equal(graph.auditLog.verify().valid, true);
  assert.ok(graph.auditTrail('horse-1').some((entry) => entry.action === 'digital-twin.graph.state.updated'));
  const stateEvent = graph.eventBus.events({ type: 'digital-twin.graph.state.updated', aggregateId: 'horse-1' }).at(-1);
  assert.equal(stateEvent.context.tenantId, 'trk-1');
  assert.equal(stateEvent.context.digitalTwinRef, 'horse-1');
  assert.ok(stateEvent.context.auditRefs.length >= 1);
  assert.throws(() => graph.applyStateUpdate({ nodeId: 'horse-1', tenantId: 'other-track', patch: { stall: 'B2' }, observedAt: '2026-06-13T00:02:00Z', source: 'manual' }), /tenant isolation violation/);
});
