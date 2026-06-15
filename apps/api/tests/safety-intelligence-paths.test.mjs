import assert from 'node:assert/strict';
import test from 'node:test';
import { CognitiveLoadManager, createApiFacadeState, handleApiRequest } from '../dist/index.js';

function frame(overrides = {}) {
  return {
    frameId: 'frame-1',
    raceId: 'race-7',
    subjectId: 'horse-1',
    subjectType: 'horse',
    observedAt: '2026-06-14T18:00:00.000Z',
    speedMetersPerSecond: 16.5,
    accelerationMetersPerSecond2: -8.2,
    lateralAccelerationG: 0.52,
    distanceToRailMeters: 0.9,
    distanceToNearestSubjectMeters: 2.0,
    closingSpeedMetersPerSecond: 5.2,
    trackZoneId: 'far-turn',
    trackCondition: 'good',
    confidence: 0.93,
    evidenceLinks: ['rtk://frame-1', 'vision://frame-1'],
    ...overrides,
  };
}

test('hot path emits reflexive safety alerts within edge budget metadata', async () => {
  const state = createApiFacadeState();
  const response = await handleApiRequest('POST', '/api/v1/safety-intelligence/hot-path/evaluate', frame(), state);
  assert.equal(response.status, 202);
  assert.equal(response.body.targetLatencyMs, 10);
  assert.equal(response.body.withinBudget, true);
  assert.ok(response.body.alerts.length >= 2);
  assert.ok(response.body.alerts.every((alert) => alert.approvalRequiredForControlAction === true));
  assert.ok(response.body.alerts.every((alert) => alert.confidence > 0 && alert.evidenceLinks.length > 0));
  assert.match(response.body.delivery.unifiedVoice, /TrackMind Safety:/);
});

test('warm path returns AJ Ross Gemini personas and unified synthesized alert', async () => {
  const state = createApiFacadeState();
  const response = await handleApiRequest('POST', '/api/v1/safety-intelligence/warm-path/analyze', {
    raceId: 'race-7',
    frames: [frame()],
    evidenceLinks: ['replay://race-7/frame-1'],
  }, state);
  assert.equal(response.status, 202);
  assert.equal(response.body.targetLatencyMs, 1500);
  assert.deepEqual(response.body.personas.map((persona) => persona.persona).sort(), ['AJ', 'Gemini', 'Ross']);
  assert.ok(response.body.personas.every((persona) => persona.confidence > 0 && persona.evidenceLinks.length > 0));
  assert.equal(response.body.synthesizedAlert.approvalRequiredForControlAction, true);
  assert.match(response.body.synthesizedAlert.unifiedVoice, /TrackMind Safety:/);
});

test('cognitive load manager applies priority ordering and 3-second refractory period', () => {
  const manager = new CognitiveLoadManager(3000, 1);
  const baseAlert = {
    id: 'alert-1',
    raceId: 'race-7',
    subjectId: 'horse-1',
    severity: 'warning',
    priority: 50,
    title: 'base',
    unifiedVoice: 'TrackMind Safety: base.',
    recommendedAction: 'base action',
    approvalRequiredForControlAction: true,
    confidence: 0.8,
    evidenceLinks: ['evidence://base'],
    createdAt: '2026-06-14T18:00:00.000Z',
    refractoryKey: 'race-7:horse-1:base',
    source: 'hot-path-edge',
  };
  const first = manager.enqueue([{ ...baseAlert, id: 'alert-low', priority: 10 }, { ...baseAlert, id: 'alert-high', priority: 90 }], 1000);
  assert.equal(first.delivered[0].id, 'alert-high');
  assert.equal(first.queued.length, 1);

  const second = manager.enqueue([{ ...baseAlert, id: 'alert-repeat', priority: 95 }], 2000);
  assert.equal(second.delivered.length, 0);
  assert.equal(second.suppressed[0].reason, 'refractory-period-active');
  assert.equal(second.refractoryPeriodMs, 3000);
});

test('learning loop creates Driver Score and evidence-backed action plan', async () => {
  const state = createApiFacadeState();
  const hot = await handleApiRequest('POST', '/api/v1/safety-intelligence/hot-path/evaluate', frame(), state);
  const response = await handleApiRequest('POST', '/api/v1/safety-intelligence/debrief', {
    raceId: 'race-7',
    driverId: 'jockey-1',
    telemetryFrames: [frame()],
    alerts: hot.body.alerts,
    incidents: [{ severity: 'warning', summary: 'Compression risk reviewed after race.', evidenceLinks: ['incident://compression'] }],
  }, state);
  assert.equal(response.status, 201);
  assert.equal(response.body.raceId, 'race-7');
  assert.ok(response.body.driverScore >= 0 && response.body.driverScore <= 100);
  assert.ok(response.body.actionPlan.length >= 1);
  assert.equal(response.body.approvalRequiredForOperationalChanges, true);
  assert.ok(response.body.evidenceLinks.includes('rtk://frame-1'));
});
