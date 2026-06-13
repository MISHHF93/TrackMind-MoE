import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceOperationsPlatform, raceOperationsControlMatrix } from '../dist/index.js';

test('race operations platform coordinates race lifecycle, readiness, execution, and reporting', () => {
  const platform = new RaceOperationsPlatform();
  platform.scheduleRace({ id: 'race-1', trackId: 'trk-1', raceDate: '2026-06-13', raceNumber: 1, scheduledPostTime: '2026-06-13T18:00:00Z', conditions: { surface: 'dirt', distanceFurlongs: 6, classLevel: 'Allowance', purse: 90000, eligibility: ['three-year-olds-and-up'] } });
  platform.addEntry('race-1', { id: 'entry-1', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1' });
  platform.addEntry('race-1', { id: 'entry-2', horseId: 'horse-2', trainerId: 'trainer-2', ownerId: 'owner-2' });
  platform.declareEntry('race-1', 'entry-1', 'jockey-1', 124);
  platform.declareEntry('race-1', 'entry-2', 'jockey-2', 122);
  platform.scratchEntry('race-1', 'entry-2', 'veterinary', 'state-vet');
  platform.drawPostPositions('race-1');
  const gated = platform.assignGates('race-1');
  assert.equal(gated.entries.find((entry) => entry.id === 'entry-1').gate, 'G-1');

  platform.coordinateStaffing('race-1', { stewards: ['steward-1'], veterinarians: ['vet-1'], gateCrew: ['gate-1'], outriders: ['out-1'], trackMaintenance: ['maint-1'], security: ['sec-1'] });
  platform.allocateResources('race-1', [{ id: 'gate-main', type: 'starting-gate', zone: 'chute', status: 'allocated' }]);
  platform.approveWorkflow('race-1', 'racingOffice', 'approved');
  platform.approveWorkflow('race-1', 'stewards', 'approved');
  platform.approveWorkflow('race-1', 'veterinarian', 'approved');
  const telemetry = [{ streamId: 'gate-status', type: 'gate', observedAt: '2026-06-13T17:55:00Z', healthy: true, value: 'closed' }];
  assert.equal(platform.assessReadiness('race-1', telemetry).ready, true);
  assert.equal(platform.aiRecommendations('race-1', telemetry).recommendations[0], 'proceed-to-post-parade');
  platform.monitorExecution('race-1', { timestamp: '2026-06-13T18:00:00Z', type: 'off', message: 'clean start' });
  platform.monitorExecution('race-1', { timestamp: '2026-06-13T18:02:00Z', type: 'official', message: 'result official' });
  const report = platform.operationalReport('race-1');
  assert.equal(report.status, 'official');
  assert.equal(report.scratches, 1);
  assert.deepEqual(report.regulatoryControls, ['HISA', 'ARCI', 'state-racing-commission']);
});

test('race operations control matrix maps workflows to approvals, twins, telemetry, and AI controls', () => {
  const matrix = raceOperationsControlMatrix();
  assert.equal(matrix.length, 4);
  assert.ok(matrix[2].systems.includes('ai-recommendations'));
});
