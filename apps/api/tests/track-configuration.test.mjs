import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CentralizedApprovalService,
  ImmutableAuditLog,
  InMemoryEventBus,
  TrackConfigurationPlatform,
  buildGeospatialMap,
  buildTrackConfigurationExecutionPlan,
  generateTrackWorkOrders,
  simulateRaceSetup,
  validateGpsPlacement,
  WorkflowOrchestrationEngine,
} from '../dist/index.js';

const boundaries = [
  {
    id: 'main-turf',
    name: 'Main Turf Course',
    surface: 'turf',
    polygon: [
      { latitude: 38.0, longitude: -77.0 },
      { latitude: 38.0, longitude: -76.9 },
      { latitude: 38.1, longitude: -76.9 },
      { latitude: 38.1, longitude: -77.0 },
    ],
  },
];

const raceSetup = {
  raceId: 'race-7',
  distanceMeters: 1600,
  surface: 'turf',
  maxFieldSize: 12,
  gatePlacement: {
    gateId: 'gate-a',
    raceId: 'race-7',
    distanceMeters: 1600,
    location: { latitude: 38.05, longitude: -76.95 },
    headingDegrees: 92,
  },
  railPosition: {
    railId: 'portable-rail',
    offsetMeters: 6,
    effectiveFrom: '2026-06-13T17:00:00Z',
    protectedTurns: ['clubhouse', 'far-turn'],
  },
  turfConfiguration: {
    lane: 'B',
    going: 'good',
    irrigationMillimeters: 2,
    mowingHeightMillimeters: 110,
    resting: false,
  },
  surfaceAllocation: {
    surface: 'turf',
    purpose: 'racing',
    start: '2026-06-13T18:00:00Z',
    end: '2026-06-13T22:00:00Z',
  },
  regulatoryJurisdiction: 'US-HISA-state-racing-commission',
};

const verificationEvidence = ['gps-fix', 'photo', 'crew-attestation', 'distance-calculation-sheet', 'rail-measurement', 'inspection-report', 'going-stick-reading', 'irrigation-log', 'mowing-log'];

test('track configuration platform validates GPS, maps surfaces, creates work orders, and simulates race setup', () => {
  const validation = validateGpsPlacement(raceSetup.gatePlacement, boundaries);
  assert.equal(validation.valid, true);
  assert.equal(validation.mappedSurface, 'turf');

  const map = buildGeospatialMap(boundaries, [raceSetup]);
  assert.deepEqual(map[0].activeRaces, ['race-7']);
  assert.equal(map[0].gatePlacements[0].gateId, 'gate-a');

  const change = {
    id: 'chg-1',
    kind: 'race-setup',
    requestedBy: 'race-office',
    requestedAt: '2026-06-13T12:00:00Z',
    raceSetup,
    evidence: ['survey-control-point', 'condition-book'],
    reason: 'configure Saturday feature race',
    status: 'draft',
    approvals: [],
  };

  const orders = generateTrackWorkOrders(change);
  assert.equal(orders.length, 3);
  assert.ok(orders.flatMap((order) => order.evidenceRequired).includes('gps-fix'));

  const simulation = simulateRaceSetup(raceSetup);
  assert.equal(simulation.safe, true);
  assert.ok(simulation.testedScenarios.includes('emergency-access'));
});

test('track configuration changes require approvals before Digital Twin sync and race-office export', () => {
  const platform = new TrackConfigurationPlatform();
  const submitted = platform.submit({
    id: 'chg-2',
    kind: 'turf-configuration',
    requestedBy: 'course-superintendent',
    requestedAt: '2026-06-13T12:30:00Z',
    raceSetup,
    evidence: ['gps-survey', 'turf-condition-report'],
    reason: 'move rail and allocate turf lane',
    status: 'draft',
    approvals: [],
  });
  assert.equal(submitted.status, 'pending-approval');
  assert.throws(() => platform.synchronizeDigitalTwin('chg-2', '2026-06-13T13:00:00Z'), /only approved/);

  platform.approve('chg-2', 'racing-secretary', ['condition-book-reviewed'], '2026-06-13T13:05:00Z');
  platform.approve('chg-2', 'track-superintendent', ['work-order-reviewed'], '2026-06-13T13:10:00Z');
  platform.approve('chg-2', 'steward', ['regulatory-checklist'], '2026-06-13T13:15:00Z');
  const approved = platform.approve('chg-2', 'course-superintendent', ['turf-lane-release'], '2026-06-13T13:16:00Z');
  assert.equal(approved.status, 'approved');

  const orders = platform.issueWorkOrders('chg-2', 'track-superintendent', '2026-06-13T13:18:00Z');
  assert.equal(orders.every((order) => order.status === 'issued'), true);
  const verification = platform.recordVerification('chg-2', { verifiedBy: 'track-superintendent', verifiedAt: '2026-06-13T13:19:00Z', evidence: verificationEvidence });
  assert.equal(verification.digitalTwinSync, 'ready-for-sync');
  const sync = platform.synchronizeDigitalTwin('chg-2', '2026-06-13T13:20:00Z');
  assert.equal(sync.version, 1);
  assert.equal(sync.state.raceId, 'race-7');

  const exported = platform.raceOfficeExport('chg-2');
  assert.equal(exported.jurisdiction, 'US-HISA-state-racing-commission');
  assert.deepEqual(exported.approvals, ['racing-secretary', 'track-superintendent', 'steward', 'course-superintendent']);
  assert.equal(platform.auditTrail('chg-2').length, 8);
});

test('gate moves recalculate race distance, require expanded approvals, and sync dependent layout state', () => {
  const platform = new TrackConfigurationPlatform();
  const sector = platform.registerSector({
    id: 'turf-stretch',
    name: 'Turf Stretch',
    surface: 'turf',
    kind: 'straight',
    centerline: { points: [{ latitude: 38.05, longitude: -76.97 }, { latitude: 38.05, longitude: -76.95 }] },
    lengthMeters: 900,
    widthMeters: 24,
    restrictions: ['portable-rail-clearance'],
  });
  platform.registerCourseLayout({
    id: 'layout-mile-turf',
    name: 'One Mile Turf',
    surface: 'turf',
    sectors: [sector.id],
    nominalDistanceMeters: 1600,
    startGateCandidates: [raceSetup.gatePlacement],
    finishLine: { points: [{ latitude: 38.05, longitude: -76.95 }, { latitude: 38.051, longitude: -76.95 }] },
    regulatoryReferences: ['state-distance-measurement-rule'],
  });

  const submitted = platform.submit({
    id: 'chg-3',
    kind: 'race-setup',
    requestedBy: 'race-office',
    requestedAt: '2026-06-13T14:00:00Z',
    raceSetup: { ...raceSetup, courseLayoutId: 'layout-mile-turf', sectorIds: [sector.id], advertisedDistanceMeters: 1600 },
    evidence: ['condition-book', 'course-survey'],
    reason: 'publish one mile turf setup',
    status: 'draft',
    approvals: [],
  });
  assert.equal(submitted.raceSetup.calculations.measuredDistanceMeters, 1614.4);

  const moved = platform.moveGate('chg-3', {
    gateId: 'gate-a',
    newDistanceMeters: 1650,
    newLocation: { latitude: 38.052, longitude: -76.952, accuracyMeters: 0.2 },
    headingDegrees: 93,
    reason: 'move start to accommodate temporary rail and preserve safe first-turn run',
    requestedBy: 'racing-secretary',
    requestedAt: '2026-06-13T14:20:00Z',
    evidence: ['surveyor-stakeout', 'timer-recalculation'],
  });

  assert.equal(moved.raceSetup.calculations.calculationVersion, 2);
  assert.ok(moved.raceSetup.calculations.regulatoryFlags.includes('distance-variance-review'));
  assert.ok(moved.raceSetup.calculations.regulatoryFlags.includes('gate-position-changed'));

  for (const role of ['racing-secretary', 'track-superintendent', 'steward', 'timer', 'course-superintendent', 'regulatory-compliance']) {
    platform.approve(moved.id, role, [`${role}-approval`], '2026-06-13T14:30:00Z');
  }
  platform.issueWorkOrders(moved.id, 'track-superintendent', '2026-06-13T14:35:00Z');
  platform.recordVerification(moved.id, { verifiedBy: 'track-superintendent', verifiedAt: '2026-06-13T14:38:00Z', evidence: verificationEvidence });
  const sync = platform.synchronizeDigitalTwin(moved.id, '2026-06-13T14:40:00Z');
  assert.equal(sync.state.calculations.measuredDistanceMeters, 1664.4);
  assert.equal(sync.state.courseLayout.id, 'layout-mile-turf');
  assert.equal(platform.auditTrail(moved.id).some((entry) => entry.action === 'move-gate-and-recalculate-race-distance'), true);
});

test('track configuration integrates approval requests, workflows, events, audit, and verified-only twin sync', async () => {
  const eventBus = new InMemoryEventBus();
  const auditLog = new ImmutableAuditLog();
  const approvals = new CentralizedApprovalService({ eventBus, auditLog });
  const workflow = new WorkflowOrchestrationEngine();
  const platform = new TrackConfigurationPlatform({ eventBus, auditLog, approvals, workflow });
  const submitted = platform.submit({
    id: 'chg-integrated',
    kind: 'race-distance',
    requestedBy: 'racing-secretary',
    requestedAt: '2026-06-13T16:00:00Z',
    raceSetup,
    evidence: ['condition-book', 'course-survey'],
    reason: 'integrated race distance setup',
    status: 'draft',
    approvals: [],
  }, { tenantId: 'track-1', boundaries, startVerificationWorkflow: true });

  const plan = buildTrackConfigurationExecutionPlan(submitted, boundaries);
  assert.equal(plan.noLiveActuatorControl, true);
  assert.equal(plan.digitalTwinPatchPreview.status, 'approval-required');
  assert.ok(platform.approvalRequests(submitted.id).some((request) => request.action === 'race-distance-configuration'));
  assert.ok(platform.workflowInstance(submitted.id));
  assert.equal(eventBus.events({ type: 'track.configuration.change.requested', aggregateId: submitted.id }).length, 1);
  assert.throws(() => platform.issueWorkOrders(submitted.id, 'track-superintendent', '2026-06-13T16:05:00Z'), /only be issued after/);

  for (const role of ['racing-secretary', 'track-superintendent', 'steward', 'timer', 'course-superintendent', 'regulatory-compliance']) {
    platform.approve(submitted.id, role, [`${role}-approval`], '2026-06-13T16:10:00Z');
  }
  platform.issueWorkOrders(submitted.id, 'track-superintendent', '2026-06-13T16:15:00Z');
  assert.throws(() => platform.synchronizeDigitalTwin(submitted.id, '2026-06-13T16:16:00Z'), /requires field verification/);
  platform.recordVerification(submitted.id, { verifiedBy: 'track-superintendent', verifiedAt: '2026-06-13T16:17:00Z', evidence: verificationEvidence });
  const sync = platform.synchronizeDigitalTwin(submitted.id, '2026-06-13T16:18:00Z');
  assert.equal(sync.twinId, 'race-setup:race-7');
  assert.equal(eventBus.events({ type: 'digital-twin.state.patch', aggregateId: sync.twinId }).length, 1);
  assert.equal(auditLog.verify().valid, true);
});

test('AI cannot move gates or approve track configuration changes', () => {
  const platform = new TrackConfigurationPlatform();
  platform.submit({
    id: 'chg-ai-guard',
    kind: 'race-setup',
    requestedBy: 'race-office',
    requestedAt: '2026-06-13T15:00:00Z',
    raceSetup,
    evidence: ['condition-book', 'course-survey'],
    reason: 'publish guarded setup',
    status: 'draft',
    approvals: [],
  });

  assert.throws(() => platform.moveGate('chg-ai-guard', {
    gateId: 'gate-a',
    newDistanceMeters: 1650,
    newLocation: { latitude: 38.052, longitude: -76.952, accuracyMeters: 0.2 },
    headingDegrees: 93,
    reason: 'AI suggested move',
    requestedBy: 'ai-agent',
    requestedAt: '2026-06-13T15:05:00Z',
    evidence: ['model-recommendation'],
  }), /AI cannot move starting gates/);

  assert.throws(() => platform.approve('chg-ai-guard', 'ai-agent', ['model-confidence'], '2026-06-13T15:06:00Z'), /authorized human roles/);
});
