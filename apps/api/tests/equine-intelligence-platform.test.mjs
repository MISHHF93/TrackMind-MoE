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

test('equine lifecycle domain enforces advisory-only health AI until veterinarian review', () => {
  const platform = new EquineIntelligencePlatform();
  const registrar = { id: 'secretary-2', roles: ['racing-secretary'], tenantId: 'trk-1' };
  const aiAgent = { id: 'ai-health-1', roles: ['ai-agent'], tenantId: 'trk-1', human: false };
  const vet = { id: 'vet-2', roles: ['veterinarian'], tenantId: 'trk-1', human: true };

  platform.createProfile({ horseId: 'horse-ai-1', tenantId: 'trk-1', name: 'Governed Runner', lifecycleStatus: 'active' }, registrar);
  platform.recordLifecycleEvent('horse-ai-1', {
    ownershipHistory: [{ ownerId: 'owner-ai-1', ownerName: 'AI Stable', effectiveFrom: '2026-01-01', percentage: 100, evidence: ['ownership-registry'] }],
    trainerAssignments: [{ trainerId: 'trainer-ai-1', trainerName: 'Trainer AI', effectiveFrom: '2026-02-01', licenseStatus: 'active', evidence: ['license-registry'] }],
    veterinaryRecords: [{ recordId: 'exam-1', recordedAt: '2026-06-10T10:00:00Z', veterinarianId: 'vet-2', category: 'exam', summary: 'Baseline exam', privacyScope: 'veterinary-confidential' }],
    welfareRecords: [{ recordId: 'welfare-ai-1', observedAt: '2026-06-11T10:00:00Z', observerId: 'welfare-2', score: 82, notes: 'Normal', interventions: [] }],
  }, registrar, 'baseline-care-profile');

  const recommendation = platform.recordAIRecommendation('horse-ai-1', {
    domain: 'health', modelId: 'equine-risk-model-v1', summary: 'Possible soreness pattern; consider veterinary restriction.', confidence: 0.72,
    proposedOperationalAction: 'add-veterinary-restriction', evidence: ['stride-sensor-window-42'],
  }, aiAgent);

  assert.equal(recommendation.advisoryOnly, true);
  assert.equal(recommendation.veterinarianReviewRequired, true);
  assert.equal(recommendation.status, 'pending-veterinarian-review');
  assert.throws(() => platform.applyAIRecommendation('horse-ai-1', recommendation.id, registrar), /advisory only/);
  assert.equal(platform.viewProfile('horse-ai-1', registrar).eligibilityFlags.length, 0);

  const reviewed = platform.reviewAIRecommendation('horse-ai-1', recommendation.id, vet, 'approved', 'Confirmed by clinical exam', ['vet-review-note']);
  assert.equal(reviewed.approvals.find((approval) => approval.recommendationId === recommendation.id).status, 'approved');
  const operationalized = platform.applyAIRecommendation('horse-ai-1', recommendation.id, registrar);
  assert.equal(operationalized.eligibilityFlags.length, 1);
  assert.equal(operationalized.aiRecommendations.find((rec) => rec.id === recommendation.id).status, 'operationalized');
  assert.equal(platform.twinSnapshot('trk-1')[0].state.openApprovalCount, 0);
});

test('equine lifecycle domain exposes event streams, relationship maps, retirement, and AI hooks', () => {
  const platform = new EquineIntelligencePlatform();
  const registrar = { id: 'secretary-3', roles: ['racing-secretary'], tenantId: 'trk-1' };
  platform.registerAIRecommendationHook((profile) => [{
    id: 'hook-rec-1', horseId: profile.identity.horseId, tenantId: profile.identity.tenantId, createdAt: '2026-06-13T00:00:00Z', requestedBy: 'hook',
    domain: 'training', modelId: 'workload-v1', summary: 'Maintain current workload.', confidence: 0.9, advisoryOnly: true, status: 'advisory', veterinarianReviewRequired: false, evidence: ['workout-history'],
  }]);

  platform.createProfile({ horseId: 'horse-map-1', tenantId: 'trk-1', name: 'Mapped Runner', lifecycleStatus: 'active' }, registrar);
  platform.recordLifecycleEvent('horse-map-1', {
    ownershipHistory: [{ ownerId: 'owner-map-1', ownerName: 'Mapped Stable', effectiveFrom: '2026-01-01', percentage: 100, evidence: ['bill-of-sale'] }],
    trainerAssignments: [{ trainerId: 'trainer-map-1', trainerName: 'Mapped Trainer', effectiveFrom: '2026-02-01', licenseStatus: 'active', evidence: ['license'] }],
    racingHistory: [{ raceId: 'race-map-1', date: '2026-06-01', trackId: 'trk-1', status: 'completed', finishPosition: 1, evidence: ['chart'] }],
  }, registrar, 'relationship-source-update');
  platform.runAIRecommendationHooks('horse-map-1', registrar);
  const retired = platform.retireHorse('horse-map-1', { retiredAt: '2026-06-13', reason: 'aftercare placement', destination: 'aftercare-farm-1', aftercareContact: 'aftercare@example.test', evidence: ['aftercare-agreement'] }, registrar);

  assert.equal(retired.identity.lifecycleStatus, 'retired');
  assert.equal(platform.evaluateEligibility(retired).eligible, false);
  assert.ok(platform.relationshipMap('horse-map-1', registrar).some((rel) => rel.type === 'retired-to'));
  assert.ok(platform.eventStream('horse-map-1', registrar).length >= 4);
  assert.ok(platform.platformEvents('horse-map-1').some((event) => event.type === 'equine.ai.recommendation.recorded'));
  assert.ok(platform.auditTrail().every((entry) => entry.subjectId === 'horse-map-1'));
});

test('equine vertical slice exposes explicit APIs for ownership, trainer, barn, welfare, eligibility, and read-only twins', () => {
  const platform = new EquineIntelligencePlatform();
  const registrar = { id: 'secretary-4', roles: ['racing-secretary'], tenantId: 'trk-1' };
  const vet = { id: 'vet-4', roles: ['veterinarian'], tenantId: 'trk-1', human: true };
  platform.createProfile({ horseId: 'horse-slice-1', tenantId: 'trk-1', name: 'Slice Runner', lifecycleStatus: 'active' }, registrar);
  assert.throws(() => platform.updateOwnership('horse-slice-1', [{ ownerId: 'bad', ownerName: 'Bad', effectiveFrom: '2026-01-01', percentage: 90, evidence: ['x'] }], registrar), /total 100/);
  platform.updateOwnership('horse-slice-1', [{ ownerId: 'owner-slice', ownerName: 'Slice Stable', effectiveFrom: '2026-01-01', percentage: 100, evidence: ['registry'] }], registrar);
  platform.assignTrainer('horse-slice-1', { trainerId: 'trainer-slice', trainerName: 'Slice Trainer', effectiveFrom: '2026-02-01', licenseStatus: 'active', evidence: ['license'] }, registrar);
  platform.assignBarn('horse-slice-1', { barnId: 'barn-2', stallId: '12A', assignedAt: '2026-06-12T12:00:00Z', assignedBy: registrar.id, evidence: ['barn-log'] }, registrar);
  platform.recordRaceHistory('horse-slice-1', { raceId: 'race-7', date: '2026-06-13', trackId: 'trk-1', status: 'entered', evidence: ['overnight'] }, registrar);
  platform.recordWorkout('horse-slice-1', { workoutId: 'work-slice', date: '2026-06-01', trackId: 'trk-1', distanceFurlongs: 4, timeSeconds: 49, surface: 'dirt', source: 'clocker' }, registrar);
  platform.recordWelfareStatus('horse-slice-1', { recordId: 'welfare-slice', observedAt: '2026-06-12T14:00:00Z', observerId: 'welfare-4', score: 92, notes: 'Calm', interventions: [] }, registrar);
  platform.updateVeterinaryStatus('horse-slice-1', { status: 'cleared', summary: 'Cleared by veterinarian', updatedAt: '2026-06-12T15:00:00Z', requiresVeterinarian: true }, vet);
  assert.throws(() => platform.addDigitalTwinReference('horse-slice-1', { twinId: 'mutable', twinType: 'biometric', sourceSystem: 'sensor', relationship: 'sensor-feed', readOnly: false }, registrar), /read-only/);
  platform.addDigitalTwinReference('horse-slice-1', { twinId: 'biometric:horse-slice-1', twinType: 'biometric', sourceSystem: 'sensor', relationship: 'sensor-feed', readOnly: true }, registrar);
  const profile = platform.viewProfile('horse-slice-1', vet);
  assert.equal(profile.barnAssignments.at(-1).barnId, 'barn-2');
  assert.equal(platform.eligibilityStatus('horse-slice-1', registrar).eligible, true);
  assert.equal(platform.welfareStatus('horse-slice-1', registrar).level, 'acceptable');
  assert.ok(platform.relationshipMap('horse-slice-1', registrar).some((rel) => rel.type === 'assigned-to-barn'));
  assert.ok(platform.relationshipMap('horse-slice-1', registrar).some((rel) => rel.type === 'mirrored-by-digital-twin'));
  assert.ok(platform.auditTrail().length >= 8);
  assert.ok(platform.platformEvents('horse-slice-1').some((event) => event.type === 'equine.lifecycle.barn-assigned'));
});

test('non-veterinarians cannot update veterinary status or impersonate AI risk review', () => {
  const platform = new EquineIntelligencePlatform();
  const registrar = { id: 'secretary-5', roles: ['racing-secretary'], tenantId: 'trk-1' };
  const aiVet = { id: 'ai-vet', roles: ['veterinarian'], tenantId: 'trk-1', human: false };
  platform.createProfile({ horseId: 'horse-vet-guard', tenantId: 'trk-1', name: 'Vet Guard', lifecycleStatus: 'active' }, registrar);
  assert.throws(() => platform.updateVeterinaryStatus('horse-vet-guard', { status: 'cleared', summary: 'Nope', updatedAt: '2026-06-12T15:00:00Z', requiresVeterinarian: true }, registrar), /required role/);
  const recommendation = platform.recordAIRecommendation('horse-vet-guard', { domain: 'health', modelId: 'risk-v1', summary: 'Advisory health risk', confidence: .7, proposedOperationalAction: 'clear-to-race', evidence: ['model'] }, { id: 'ai', roles: ['ai-agent'], tenantId: 'trk-1', human: false });
  assert.throws(() => platform.reviewAIRecommendation('horse-vet-guard', recommendation.id, aiVet, 'approved', 'automated', ['model']), /human veterinarian/);
});
