import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStartingGateMoveRecommendation,
  controlsRequiringApproval,
  findControlAsset,
  racetrackAssetControlRegistry,
  validateRaceDistanceSetup,
} from '../dist/index.js';

test('RACR catalogs controllable racetrack assets with ownership, controls, sensors, and regulations', () => {
  assert.ok(racetrackAssetControlRegistry.length >= 3);
  const gate = findControlAsset('START_GATE_01');
  assert.equal(gate.assetType, 'StartingGate');
  assert.equal(gate.ownerAgent, 'RaceOps');
  assert.ok(gate.controls.some((control) => control.category === 'B_AI_RECOMMENDED'));
  assert.ok(gate.sensors.some((sensor) => sensor.type === 'gps' && sensor.required));
  assert.ok(gate.regulations.some((regulation) => regulation.authority === 'StateRacingCommission'));
});

test('RACR returns defensive copies of registry assets', () => {
  const gate = findControlAsset('START_GATE_01');
  gate.controls.pop();
  gate.sensors[0].verifies.pop();

  const freshGate = findControlAsset('START_GATE_01');
  assert.equal(freshGate.controls.length, 3);
  assert.ok(freshGate.sensors[0].verifies.includes('currentPositionMeters'));
});

test('race distance setup must be official before gate movement is ready for work order', () => {
  const gate = findControlAsset('START_GATE_01');
  const pending = buildStartingGateMoveRecommendation(gate, {
    raceId: 'RACE_5',
    distanceFurlongs: 8,
    requiredGateLocation: { x: 214, y: 12 },
  });
  assert.equal(pending.status, 'approval-required');
  assert.deepEqual(pending.requiredApprovals, ['RacingSecretary']);
  assert.deepEqual(pending.sensorsToVerify, ['gate-gps-01', 'gate-lock-telemetry-01']);

  const approved = validateRaceDistanceSetup({
    raceId: 'RACE_5',
    distanceFurlongs: 8,
    requiredGateLocation: { x: 214, y: 12 },
    approvedBy: 'RacingSecretary',
  });
  assert.equal(approved.valid, true);
});

test('approval-sensitive controls are discoverable for governance workflows', () => {
  const alertSystem = findControlAsset('EMERGENCY_ALERT_SYSTEM');
  const controls = controlsRequiringApproval(alertSystem);
  assert.equal(controls.length, 1);
  assert.equal(controls[0].protectedAction, 'emergency-action');
  assert.equal(controls[0].executionMode, 'human-only');
});
