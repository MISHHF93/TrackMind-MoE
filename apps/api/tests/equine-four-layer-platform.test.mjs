import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiFacadeState, handleApiRequest } from '../dist/index.js';

test('four-layer equine platform exposes Device Data Processing and Application layers', async () => {
  const state = createApiFacadeState();
  const response = await handleApiRequest('GET', '/api/v1/horses/horse-1/platform?role=veterinarian&actorId=vet-1', undefined, state);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.layers.map((layer) => layer.layer), ['Device', 'Data', 'Processing', 'Application']);
  assert.ok(response.body.layers.find((layer) => layer.layer === 'Processing').components.includes('XGBoost-lameness-classifier'));
  assert.equal(response.body.approvalRequiredForStateMutation, true);
  assert.deepEqual(Object.keys(response.body.managementModules).sort(), ['Behavior', 'Breeding', 'Environment', 'Epidemic', 'Record'].sort());
});

test('five equine management modules preserve privacy boundaries', async () => {
  const state = createApiFacadeState();
  const owner = await handleApiRequest('GET', '/api/v1/horses/horse-1/management?role=owner&actorId=owner-1&ownerId=owner-1', undefined, state);
  assert.equal(owner.status, 200);
  assert.equal(owner.body.Record.identity.name, 'Safety First');
  assert.equal(owner.body.Record.identity.microchip, undefined);
  assert.equal(owner.body.Epidemic.quarantineStatus, 'clear');
  assert.equal(owner.body.Behavior.lamenessPipelineAvailable, true);
  assert.equal(owner.body.Environment.risk, 'nominal');

  const regulator = await handleApiRequest('GET', '/api/v1/horses/horse-1/management?role=regulator&actorId=regulator-1', undefined, state);
  assert.equal(regulator.status, 200);
  assert.equal(regulator.body.Record.identity.name, undefined);
});

test('lameness detection runs YOLOv5 MMPose XGBoost advisory pipeline with evidence', async () => {
  const state = createApiFacadeState();
  const response = await handleApiRequest('POST', '/api/v1/horses/horse-1/lameness/detect', {
    role: 'veterinarian',
    actorId: 'vet-1',
    videoFrameEvidence: ['video://horse-1/frame-1', 'video://horse-1/frame-2'],
    gaitMetrics: {
      strideAsymmetryPct: 38,
      headBobMm: 42,
      stanceTimeImbalancePct: 31,
      speedMetersPerSecond: 8.5,
    },
    modelVersions: {
      yoloV5: 'yolov5-equine-custom-v1',
      mmPose: 'mmpose-equine-keypoints-v1',
      xgBoost: 'xgboost-lameness-v1',
    },
  }, state);

  assert.equal(response.status, 202);
  assert.deepEqual(response.body.pipeline.map((stage) => stage.stage), ['YOLOv5', 'MMPose', 'XGBoost']);
  assert.equal(response.body.recommendation.advisoryOnly, true);
  assert.equal(response.body.recommendation.approvalRequiredForOperationalChange, true);
  assert.ok(response.body.recommendation.confidence > 0);
  assert.ok(response.body.recommendation.evidence_links.includes('model://xgboost-lameness-v1'));
});

test('wireless sensor automatic calibration requires approval before applying state mutation', async () => {
  const state = createApiFacadeState();
  const proposed = await handleApiRequest('POST', '/api/v1/horses/horse-1/sensors/calibrate', {
    role: 'steward',
    actorId: 'steward-1',
    sensorId: 'imu-node-1',
    sensorType: 'imu',
    baseline: 0,
    observed: 0.18,
    tolerance: 0.05,
    evidenceLinks: ['sensor://imu-node-1/calibration-run'],
  }, state);

  assert.equal(proposed.status, 202);
  assert.equal(proposed.body.status, 'approval-required');
  assert.equal(proposed.body.applied, false);
  assert.equal(proposed.body.approvalRequiredForStateMutation, true);

  const applied = await handleApiRequest('POST', '/api/v1/horses/horse-1/sensors/calibrate', {
    role: 'steward',
    actorId: 'steward-1',
    approvalId: 'approval-calibration-1',
    approverId: 'chief-steward',
    approvalTimestamp: '2026-06-14T18:10:00.000Z',
    sensorId: 'imu-node-1',
    sensorType: 'imu',
    baseline: 0,
    observed: 0.18,
    tolerance: 0.05,
    evidenceLinks: ['sensor://imu-node-1/calibration-run', 'approval://approval-calibration-1'],
  }, state);

  assert.equal(applied.status, 200);
  assert.equal(applied.body.status, 'applied');
  assert.equal(applied.body.applied, true);
  assert.ok(applied.body.auditEventId);

  const audit = await handleApiRequest('GET', '/api/v1/horses/horse-1/audit', undefined, state);
  assert.equal(audit.body.verification.valid, true);
  assert.ok(audit.body.events.some((event) => event.type === 'equine.sensor.calibrated'));
});
