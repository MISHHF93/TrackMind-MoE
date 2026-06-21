import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createModelReadableKPIContext,
  kpiDomains,
  validateKPIArtifact,
  validateModelReadableKPIContext,
} from '../dist/index.js';

const baseKpi = {
  kpiId: 'kpi-race-day-readiness',
  tenantId: 'tenant-1',
  organizationId: 'org-1',
  racetrackId: 'track-1',
  domain: 'race-day-operations',
  name: 'Race-day readiness score',
  description: 'Readiness score derived from race-day events, approvals, and warnings.',
  artifactType: 'KPI',
  metricType: 'score',
  value: 87,
  unit: 'score',
  target: 90,
  threshold: { warning: 75, critical: 60, targetDirection: 'above', description: 'Higher readiness is better.' },
  status: 'watch',
  trend: 'flat',
  confidence: 0.86,
  dataQualityScore: 0.82,
  sourceEvents: ['event-race-readiness'],
  sourceEntities: [{ entityType: 'race-day', entityId: 'race-day-1' }],
  calculationMethod: 'Seeded facade calculation: average readiness score minus warning and approval penalties.',
  refreshCadence: '5m',
  lastCalculatedAt: '2026-06-15T05:00:00.000Z',
  ownerRole: 'steward',
  visibility: 'tenant-internal',
  approvalSensitivity: 'regulated-advisory-only',
  requiredPermission: 'race:request-start',
  auditReference: {
    auditEventIds: ['audit-kpi-race-day-readiness'],
    eventIds: ['event-race-readiness'],
    correlationId: 'corr-kpi-race-day-readiness',
    calculationRunId: 'calc-kpi-race-day-readiness-v1',
  },
  modelReadable: true,
  version: '1.0.0',
  createdAt: '2026-06-15T05:00:00.000Z',
  updatedAt: '2026-06-15T05:00:00.000Z',
  historicalSnapshots: [],
};

test('KPI artifact contract validates governed KPI metadata', () => {
  assert.ok(kpiDomains.includes('race-day-operations'));
  assert.deepEqual(validateKPIArtifact(baseKpi), { valid: true, errors: [] });
  assert.equal(validateKPIArtifact({ ...baseKpi, artifactType: 'Metric' }).valid, false);
  assert.equal(validateKPIArtifact({ ...baseKpi, confidence: 1.2 }).valid, false);
  assert.equal(validateKPIArtifact({ ...baseKpi, sourceEvents: [] }).valid, false);
});

test('federated KPI artifacts must remain aggregate-only', () => {
  const unsafe = validateKPIArtifact({
    ...baseKpi,
    kpiId: 'kpi-federation-safety',
    domain: 'multi-track-federation',
    visibility: 'tenant-internal',
  });
  assert.equal(unsafe.valid, false);
  assert.ok(unsafe.errors.some((error) => error.includes('federation-aggregate')));
});

test('model-readable KPI context exposes metadata only and blocks execution', () => {
  const context = createModelReadableKPIContext(baseKpi);
  assert.deepEqual(validateModelReadableKPIContext(context), { valid: true, errors: [] });
  assert.equal(context.currentValue, baseKpi.value);
  assert.ok(context.allowedUse.includes('generate advisory recommendations'));
  assert.ok(context.prohibitedUse.includes('modify KPI values'));
  assert.ok(context.prohibitedUse.includes('execute regulated actions'));
  assert.ok(context.prohibitedUse.includes('expose raw cross-track records'));
  assert.equal(validateModelReadableKPIContext({ ...context, allowedUse: [...context.allowedUse, 'execute regulated actions'] }).valid, false);
});

test('KPI status and trend helpers evaluate thresholds and history', async () => {
  const { computeKpiTrend, evaluateKpiStatus } = await import('../dist/kpiArtifacts.js');
  assert.equal(evaluateKpiStatus(92, { warning: 75, critical: 60, targetDirection: 'above', description: 'Higher is better.' }, 'score'), 'nominal');
  assert.equal(evaluateKpiStatus(70, { warning: 75, critical: 60, targetDirection: 'above', description: 'Higher is better.' }, 'score'), 'warning');
  assert.equal(evaluateKpiStatus(45, { warning: 30, critical: 40, targetDirection: 'below', description: 'Lower pressure is better.' }, 'score'), 'critical');
  assert.equal(computeKpiTrend([{ snapshotId: 's1', kpiId: 'k1', value: 80, status: 'watch', trend: 'flat', confidence: 0.8, dataQualityScore: 0.8, calculatedAt: '2026-01-01T00:00:00.000Z', sourceEvents: ['e1'], auditReference: { auditEventIds: ['a1'], eventIds: ['e1'], correlationId: 'c1', calculationRunId: 'r1' } }], 85), 'up');
  assert.equal(computeKpiTrend([{ snapshotId: 's1', kpiId: 'k1', value: 80, status: 'watch', trend: 'flat', confidence: 0.8, dataQualityScore: 0.8, calculatedAt: '2026-01-01T00:00:00.000Z', sourceEvents: ['e1'], auditReference: { auditEventIds: ['a1'], eventIds: ['e1'], correlationId: 'c1', calculationRunId: 'r1' } }], 80.2), 'flat');
  assert.equal(computeKpiTrend([], 80), 'insufficient-history');
});
