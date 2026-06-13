import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TrackConfigurationPlatform,
  buildGeospatialMap,
  generateTrackWorkOrders,
  simulateRaceSetup,
  validateGpsPlacement,
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
  const approved = platform.approve('chg-2', 'steward', ['regulatory-checklist'], '2026-06-13T13:15:00Z');
  assert.equal(approved.status, 'approved');

  const sync = platform.synchronizeDigitalTwin('chg-2', '2026-06-13T13:20:00Z');
  assert.equal(sync.version, 1);
  assert.equal(sync.state.raceId, 'race-7');

  const exported = platform.raceOfficeExport('chg-2');
  assert.equal(exported.jurisdiction, 'US-HISA-state-racing-commission');
  assert.deepEqual(exported.approvals, ['racing-secretary', 'track-superintendent', 'steward']);
  assert.equal(platform.auditTrail('chg-2').length, 5);
});
