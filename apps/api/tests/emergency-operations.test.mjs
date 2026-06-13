import test from 'node:test';
import assert from 'node:assert/strict';
import { EmergencyOperationsPlatform, buildEmergencyOperationsBlueprint } from '../dist/index.js';

test('emergency operations platform coordinates incidents, continuity, exercises, and after-action reporting', () => {
  const platform = new EmergencyOperationsPlatform();
  const continuity = platform.registerContinuityPlan({
    id: 'bc-raceday',
    name: 'Race Day Continuity',
    criticalProcesses: ['life safety', 'race operations', 'wagering settlement'],
    recoveryTimeObjectiveMinutes: 30,
    recoveryPointObjectiveMinutes: 5,
    alternateSites: ['backup command center'],
    manualWorkarounds: ['paper runner changes', 'radio dispatch log'],
  });
  assert.equal(continuity.governance.includes('ISO 22301'), true);

  const incident = platform.openIncident({
    id: 'inc-100',
    scenario: 'fire-incident',
    severity: 'critical',
    location: 'barns',
    reportedAt: '2026-06-13T18:00:00Z',
    populationAtRisk: 120,
    affectedAssets: [{ assetId: 'barn-a', zone: 'backstretch', risk: 'critical', dependencies: ['power-feed-2'] }],
    systems: [
      { system: 'digital-twin', status: 'online', dataFeeds: ['asset-state', 'occupancy'] },
      { system: 'access-control', status: 'degraded', dataFeeds: ['badges'] },
    ],
  });
  assert.equal(incident.incidentCommander, 'fire-safety-incident-commander');
  assert.equal(incident.evacuationRequired, true);
  assert.equal(incident.degradedSystems[0], 'access-control');
  assert.ok(incident.resourceRequests.includes('mutual-aid fire department'));

  const exercise = platform.runSimulationExercise('ex-1', 'severe-weather', ['ops', 'security', 'facilities']);
  assert.equal(exercise.injects.length, 5);
  assert.ok(exercise.successCriteria.includes('asset status reconciled with digital twin'));

  const report = platform.afterActionReport('inc-100', [{ finding: 'Access-control feed failed over slowly', severity: 'major', owner: 'security' }]);
  assert.equal(report.correctiveActions[0].dueDays, 30);
  assert.ok(report.evidencePackage.includes('digital-twin-state-history'));
  assert.equal(platform.continuityStatus()[0].ready, true);
});

test('emergency operations blueprint integrates operational systems and digital twin assets', () => {
  const blueprint = buildEmergencyOperationsBlueprint(
    [{ system: 'weather', status: 'online', dataFeeds: ['lightning', 'wind'] }],
    [{ assetId: 'grandstand', zone: 'public', risk: 'watch' }],
  );
  assert.ok(blueprint.supportedScenarios.includes('security-incident'));
  assert.equal(blueprint.operationalIntegrations[0].monitored, true);
  assert.ok(blueprint.minimumCapabilities.includes('after-action reporting'));
});
