import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EquineIntelligencePlatform,
  ImmutableAuditLog,
  createSeededEquineWelfareIntelligence,
  createSeededHorseRegistry,
} from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

test('equine welfare intelligence workspace exposes indicators observations trends alerts retirement readiness twins and KPI registry', () => {
  const auditLog = new ImmutableAuditLog();
  const equinePlatform = new EquineIntelligencePlatform({ auditLog });
  createSeededHorseRegistry({ equinePlatform, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' }, '2026-06-14T12:00:00.000Z');
  const platform = createSeededEquineWelfareIntelligence({ equinePlatform, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' }, '2026-06-14T12:00:00.000Z');
  const workspace = platform.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.equine-welfare-intelligence.v1');
  assert.ok(workspace.welfareIndicators.length >= 5);
  assert.ok(workspace.observations.length >= 2);
  assert.ok(workspace.trendAnalytics.length >= 3);
  assert.ok(workspace.retirementReadiness.length >= 1);
  assert.ok(workspace.digitalTwinLinks.length >= 1);
  assert.equal(workspace.guardrails.aiRecommendationsAdvisoryOnly, true);
  assert.ok(workspace.advisoryRecommendations.every((rec) => rec.advisoryOnly === true));
  assert.ok(workspace.dashboard.panels.length >= 6);
  assert.ok(workspace.horses.length >= 1);
  assert.deepEqual(validateContract('EquineWelfareIntelligenceOperationsDto', workspace, apiContractSchemas.EquineWelfareIntelligenceOperationsDto), { valid: true, errors: [] });
});

test('equine welfare mutations record observations and sync advisory recommendations from equine platform', () => {
  const auditLog = new ImmutableAuditLog();
  const equinePlatform = new EquineIntelligencePlatform({ auditLog });
  createSeededHorseRegistry({ equinePlatform, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });
  const platform = createSeededEquineWelfareIntelligence({ equinePlatform, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' });

  platform.recordObservation({
    horseId: 'horse-1',
    observedAt: '2026-06-14T13:00:00.000Z',
    observerId: 'vet-live',
    role: 'veterinarian',
    score: 65,
    category: 'post-workout',
    notes: 'Mild stiffness after workout',
    interventions: ['monitor-next-48h'],
    evidence: ['jog-review'],
  });

  const detail = platform.horseDetail('horse-1', '2026-06-14T13:00:00.000Z');
  assert.ok(detail.observations.length >= 3);
  assert.ok(detail.welfareIndicators.length >= 5);
  assert.ok(auditLog.all().length >= 1);
});
