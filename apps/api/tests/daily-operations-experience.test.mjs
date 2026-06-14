import assert from 'node:assert/strict';
import test from 'node:test';
import { BarnOperationsService, ExecutiveKpiIntelligenceService, FacilityAssetHealthService, NotificationAlertingService, PlatformHealthService, WorkforceOperationsService, dailyOperationsApiDefinitions } from '../dist/dailyOperationsExperience.js';

test('daily operations services cover notifications, workforce, barns, assets, executive KPIs, and platform health', () => {
  const notifications = new NotificationAlertingService();
  const alert = notifications.publish({ category: 'weather', severity: 'warning', title: 'Lightning watch', message: 'Cell west of track', targetRoles: ['operations'], evidence: ['weather:cell'], escalationChain: ['admin'] });
  assert.equal(notifications.acknowledge(alert.id, 'commander').status, 'acknowledged');

  const workforce = new WorkforceOperationsService();
  workforce.upsert({ id: 'worker-1', name: 'Gate Lead', role: 'gate-crew', certifications: [{ name: 'gate', expiresAt: '2026-12-31T00:00:00.000Z' }], shift: { startsAt: '2026-06-13T18:00:00.000Z', endsAt: '2026-06-14T02:00:00.000Z' }, assignment: 'race-7 gate', checkedIn: true, trainingRecords: ['gate-annual'], incidentAssignments: [] });
  assert.equal(workforce.readiness('2026-06-13T19:00:00.000Z').status, 'ready');

  const barns = new BarnOperationsService();
  barns.upsert({ id: 'barn-2', name: 'Barn 2', stalls: 40, occupied: 35, horses: [{ horseId: 'horse-1', stall: '2A', trainer: 'trainer-1' }], movements: [], inspections: [{ at: '2026-06-13T18:00:00.000Z', status: 'ready', evidence: ['inspection:ok'] }], accessEvents: [] });
  barns.recordMovement('barn-2', { horseId: 'horse-1', from: 'stall-2A', to: 'paddock', at: '2026-06-13T20:00:00.000Z', actor: 'stable-security' });
  assert.equal(barns.occupancyDashboard().movements.length, 1);

  const assets = new FacilityAssetHealthService();
  assets.upsert({ assetId: 'generator-1', name: 'Backup Generator', type: 'generator', healthScore: 82, status: 'watch', inspections: ['inspection:load'], maintenanceHistory: ['pm:2026-06'], predictedFailureRisk: 75, incidents: ['incident:fuel-pressure'], twinId: 'twin-generator-1' });
  assert.equal(assets.dashboard().predictiveMaintenance.length, 1);

  const executive = new ExecutiveKpiIntelligenceService([{ id: 'readiness', label: 'Race readiness', domain: 'operations', value: 92, unit: '%', trend: 'up', source: '/race-day-readiness/dashboard', evidence: ['readiness:race-7'] }]);
  assert.equal(executive.dashboard().benchmarks[0].benchmark, 'leading');

  const platform = new PlatformHealthService();
  platform.upsert({ service: 'digital-twin-runtime', status: 'degraded', latencyMs: 260, eventThroughput: 1200, dependencyOf: ['operations-command'], telemetryQuality: 88, aiHealthy: true });
  assert.equal(platform.diagnostics().digitalTwinSync, 'degraded');
  assert.ok(dailyOperationsApiDefinitions().some((api) => api.id === 'platform-health'));
});
