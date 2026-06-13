import test from 'node:test';
import assert from 'node:assert/strict';
import { EquineIntelligencePlatform } from '../dist/index.js';

test('equine intelligence platform manages lifecycle, eligibility, audit, privacy, and twin sync', () => {
  const platform = new EquineIntelligencePlatform();
  const registrar = { id: 'secretary-1', roles: ['racing-secretary'], tenantId: 'trk-1' };
  const vet = { id: 'vet-1', roles: ['veterinarian'], tenantId: 'trk-1' };
  const auditor = { id: 'auditor-1', roles: ['auditor'], tenantId: 'trk-1' };

  const created = platform.createProfile({ horseId: 'horse-1', tenantId: 'trk-1', name: 'Lifecycle Runner', microchipId: '985141001', lifecycleStatus: 'active' }, registrar);
  assert.equal(created.version, 1);
  assert.equal(platform.twinSnapshot('trk-1')[0].state.lifecycleStatus, 'active');

  const updated = platform.recordLifecycleEvent('horse-1', {
    ownershipHistory: [{ ownerId: 'owner-1', ownerName: 'Stable A', effectiveFrom: '2026-01-01', percentage: 100, evidence: ['bill-of-sale'] }],
    trainerAssignments: [{ trainerId: 'trainer-1', trainerName: 'Trainer A', effectiveFrom: '2026-02-01', licenseStatus: 'active', evidence: ['license-registry'] }],
    racingHistory: [{ raceId: 'race-1', date: '2026-06-13', trackId: 'trk-1', status: 'completed', finishPosition: 2, evidence: ['official-chart'] }],
    workouts: [{ workoutId: 'work-1', date: '2026-06-01', trackId: 'trk-1', distanceFurlongs: 4, timeSeconds: 48.4, surface: 'dirt', source: 'clockers' }],
    transportationRecords: [{ tripId: 'trip-1', from: 'farm', to: 'barn-12', departedAt: '2026-06-12T10:00:00Z', arrivedAt: '2026-06-12T12:00:00Z', transporter: 'licensed-van', welfareChecks: ['watered'] }],
    veterinaryRecords: [{ recordId: 'vet-1', recordedAt: '2026-06-12T13:00:00Z', veterinarianId: 'vet-1', category: 'clearance', summary: 'Cleared to race', privacyScope: 'veterinary-confidential' }],
    welfareRecords: [{ recordId: 'welfare-1', observedAt: '2026-06-12T14:00:00Z', observerId: 'welfare-1', score: 95, notes: 'Bright and alert', interventions: [] }],
    operationalEvent: { eventId: 'op-1', occurredAt: '2026-06-13T09:00:00Z', type: 'barn-check', actorId: 'steward-1', summary: 'Arrived and checked in', evidence: ['barn-log'] },
  }, registrar, 'race-week-profile-update');

  assert.equal(platform.evaluateEligibility(updated).eligible, true);
  assert.equal(platform.viewProfile('horse-1', vet).veterinaryRecords.length, 1);
  assert.equal(platform.viewProfile('horse-1', auditor).veterinaryRecords.length, 0);
  assert.equal(platform.auditTrail().length, 2);
  assert.equal(platform.twinSnapshot('trk-1')[0].state.currentTrainer, 'trainer-1');

  const flagged = platform.recordLifecycleEvent('horse-1', { eligibilityFlags: ['medication-review'] }, registrar, 'eligibility-flag-added');
  assert.equal(platform.evaluateEligibility(flagged).eligible, false);
  assert.equal(flagged.complianceStatus, 'under-review');
});
