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

test('emergency workflow creation supports command roles resources checklist and non-blocking AI override', () => {
  const platform = new EmergencyOperationsPlatform();
  platform.registerEmergencyPlan({ id:'plan-fire', name:'Barn fire plan', scenarios:['fire-incident','evacuation'], ownerRole:'incident-commander', activationCriteria:['smoke','alarm'], communicationChannels:['radio','pa'], evacuationZoneIds:['zone-barn'], drillCadenceDays:90 });
  const workflow = platform.createEmergencyWorkflow({
    id:'wf-fire-1', planId:'plan-fire', activatedBy:'commander-1', activatedByRoles:['security'],
    incident:{ id:'inc-fire-1', scenario:'fire-incident', severity:'critical', location:'Barn 2', reportedAt:'2026-06-13T18:00:00Z', populationAtRisk:40, affectedAssets:[{assetId:'barn-2', zone:'zone-barn', risk:'critical'}], systems:[{system:'dispatch', status:'online', dataFeeds:['radio']}] },
    commandRoles:[{id:'role-ic', role:'incident-commander', assignee:'commander-1', permissions:['activate-workflow','override-ai','dispatch-resource','send-communication','close-incident']}],
    resources:[{id:'res-fire-1', kind:'fire', label:'Fire brigade', status:'assigned', zoneId:'zone-barn', coordinates:{latitude:38.061, longitude:-76.955}, capacity:4}],
    evacuationZones:[{id:'zone-barn', name:'Barn Zone', status:'evacuating', route:['north gate','assembly A'], assemblyArea:'Lot A', capacity:120}],
    communicationChecklist:[{id:'comm-pa', audience:'patrons', channel:'pa', message:'Move away from Barn 2', completed:false}],
    aiRecommendationId:'ai-fire-advice-1'
  });
  assert.equal(workflow.status, 'active');
  assert.equal(workflow.emergencyActions.aiMayBlock, false);
  assert.equal(workflow.checklist.every((step) => step.humanOverrideAvailable && !step.aiBlockingAllowed), true);
  assert.equal(workflow.resourceMap[0].label, 'Fire brigade');
  assert.equal(workflow.fireResponse.aiMayBlock, false);
  assert.equal(workflow.auditTimeline[0].humanOverride, true);
  assert.equal(workflow.events[0].type, 'emergency.workflow.activated');
});

test('emergency role permissions reject users without incident management', () => {
  const platform = new EmergencyOperationsPlatform();
  assert.equal(platform.canManageEmergency(['security']), true);
  assert.equal(platform.canManageEmergency(['read-only-auditor']), false);
  assert.throws(() => platform.createEmergencyWorkflow({ id:'wf-denied', planId:'plan', activatedBy:'auditor', activatedByRoles:['read-only-auditor'], incident:{ id:'inc-denied', scenario:'medical-emergency', severity:'major', location:'clinic', reportedAt:'2026-06-13T18:00:00Z', affectedAssets:[], systems:[] }, commandRoles:[], resources:[], evacuationZones:[], communicationChecklist:[] }), /incident:manage/);
});

test('emergency audit records and events are generated for workflow and communications', () => {
  const platform = new EmergencyOperationsPlatform();
  const workflow = platform.createEmergencyWorkflow({ id:'wf-weather-1', planId:'weather-plan', activatedBy:'steward-1', activatedByRoles:['steward'], incident:{ id:'inc-weather-1', scenario:'severe-weather', severity:'major', location:'main track', reportedAt:'2026-06-13T18:00:00Z', affectedAssets:[], systems:[] }, commandRoles:[], resources:[], evacuationZones:[], communicationChecklist:[{id:'comm-radio', audience:'field teams', channel:'radio', message:'Shelter now', completed:false}] });
  platform.recordCommunication(workflow.id, 'comm-radio', 'steward-1');
  assert.equal(platform.listAuditRecords().length, 2);
  assert.equal(platform.listAuditRecords().every((record) => record.aiBlocked === false), true);
  assert.deepEqual(platform.listEvents().map((event) => event.type), ['emergency.workflow.activated', 'emergency.communication.completed']);
});
