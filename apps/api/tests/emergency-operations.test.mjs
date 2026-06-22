import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CentralizedApprovalService,
  EmergencyOperationsPlatform,
  ImmutableAuditLog,
  SafetyService,
  UniversalEventBus,
  WorkflowOrchestrationEngine,
  buildEmergencyOperationsBlueprint,
  createEmergencyOperationsService,
  createMockEmergencyOperationsWorkspace,
  createSafetyEmergencyOperationsBoundary,
  handleApiRequest,
  createApiFacadeState,
} from '../dist/index.js';

const adminHeaders = { 'x-trackmind-role': 'platform-super-admin', 'x-trackmind-tenant-id': 'trackmind', 'x-trackmind-racetrack-id': 'main-track' };

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
  platform.registerEmergencyPlan({ id:'plan-fire', name:'Barn fire plan', scenarios:['fire-incident','evacuation'], ownerRole:'race-day-operations-manager', activationCriteria:['smoke','alarm'], communicationChannels:['radio','pa'], evacuationZoneIds:['zone-barn'], drillCadenceDays:90 });
  const workflow = platform.createEmergencyWorkflow({
    id:'wf-fire-1', planId:'plan-fire', activatedBy:'commander-1', activatedByRoles:['security'],
    incident:{ id:'inc-fire-1', scenario:'fire-incident', severity:'critical', location:'Barn 2', reportedAt:'2026-06-13T18:00:00Z', populationAtRisk:40, affectedAssets:[{assetId:'barn-2', zone:'zone-barn', risk:'critical'}], systems:[{system:'dispatch', status:'online', dataFeeds:['radio']}] },
    commandRoles:[{id:'role-ic', role:'race-day-operations-manager', assignee:'commander-1', permissions:['activate-workflow','override-ai','dispatch-resource','send-communication','close-incident']}],
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
  assert.equal(workflow.evacuationProcedure.aiMayBlock, false);
  assert.equal(workflow.auditTimeline[0].humanOverride, true);
  assert.equal(workflow.events[0].type, 'emergency.workflow.activated');
  assert.ok(workflow.digitalTwinPatches.some((patch) => patch.patch.aiMayBlock === false));
  assert.equal(workflow.approvalPosture.emergencyPersonnelAuthority, true);
});

test('emergency role permissions reject users without incident management', () => {
  const platform = new EmergencyOperationsPlatform();
  assert.equal(platform.canManageEmergency(['security']), true);
  assert.equal(platform.canManageEmergency(['read-only-auditor']), false);
  assert.throws(() => platform.createEmergencyWorkflow({ id:'wf-denied', planId:'plan', activatedBy:'auditor', activatedByRoles:['read-only-auditor'], incident:{ id:'inc-denied', scenario:'medical-emergency', severity:'major', location:'clinic', reportedAt:'2026-06-13T18:00:00Z', affectedAssets:[], systems:[] }, commandRoles:[], resources:[], evacuationZones:[], communicationChecklist:[] }), /incident:manage/);
});

test('emergency audit records and events are generated for workflow and communications', () => {
  const platform = new EmergencyOperationsPlatform();
  const workflow = platform.createEmergencyWorkflow({ id:'wf-weather-1', planId:'weather-plan', activatedBy:'steward-1', activatedByRoles:['steward'], incident:{ id:'inc-weather-1', scenario:'severe-weather', severity:'major', location:'main track', reportedAt:'2026-06-13T18:00:00Z', affectedAssets:[], systems:[] }, commandRoles:[{id:'role-ic', role:'race-day-operations-manager', assignee:'steward-1', permissions:['activate-workflow','override-ai','dispatch-resource','send-communication','close-incident']}], resources:[], evacuationZones:[], communicationChecklist:[{id:'comm-radio', audience:'field teams', channel:'radio', message:'Shelter now', completed:false}] });
  platform.recordCommunication(workflow.id, 'comm-radio', 'steward-1');
  assert.equal(platform.listAuditRecords().length, 3);
  assert.equal(platform.listAuditRecords().every((record) => record.aiBlocked === false), true);
  assert.deepEqual(platform.listEvents().map((event) => event.type), ['emergency.incident.opened', 'emergency.workflow.activated', 'emergency.communication.completed']);
});

test('emergency workflows integrate workflow engine, audit, event bus, approvals, twins, and observability without blocking personnel', () => {
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const workflows = new WorkflowOrchestrationEngine();
  const approvals = new CentralizedApprovalService({ auditLog, eventBus, workflow: workflows });
  const platform = new EmergencyOperationsPlatform({ eventBus, auditLog, workflows, approvals });

  const workflow = platform.createEmergencyWorkflow({
    id:'wf-medical-1', planId:'plan-medical', activatedBy:'commander-2', activatedByRoles:['admin'], tenantId:'track-1',
    incident:{ id:'inc-medical-1', scenario:'medical-emergency', severity:'critical', location:'grandstand', reportedAt:'2026-06-13T18:00:00Z', populationAtRisk:25, affectedAssets:[{assetId:'grandstand', zone:'zone-grandstand', risk:'critical'}], systems:[{system:'event-bus', status:'online', dataFeeds:['events']}] },
    commandRoles:[{id:'role-ic', role:'race-day-operations-manager', assignee:'commander-2', permissions:['activate-workflow','override-ai','dispatch-resource','send-communication','close-incident']}],
    resources:[{id:'res-ems', kind:'medical', label:'EMS unit', status:'assigned', zoneId:'zone-grandstand', coordinates:{latitude:38.044, longitude:-76.949}, capacity:2}],
    evacuationZones:[],
    communicationChecklist:[{id:'comm-ems', audience:'ems', channel:'radio', message:'Proceed to grandstand', completed:false}],
    aiRecommendationId:'ai-medical-summary',
  });

  assert.equal(workflow.workflowIntegration.status, 'started');
  assert.equal(workflow.approvalPosture.mode, 'approval-request-created');
  assert.equal(workflow.approvalPosture.aiMayBlock, false);
  assert.ok(workflows.instances('track-1').some((instance) => instance.id === workflow.workflowIntegration.instanceId));
  assert.ok(auditLog.all().some((entry) => entry.subjectId === 'wf-medical-1'));
  assert.ok(eventBus.events({ type:'emergency.workflow.activated' }).length >= 1);
  assert.ok(eventBus.events({ type:'digital-twin.state.patch' }).some((event) => event.payload.twinId === 'twin:grandstand'));
  assert.ok(platform.listDigitalTwinPatches().some((patch) => patch.twinId === 'twin:grandstand'));
  assert.equal(platform.workspace().observability.criticalIncidents, 1);
});

test('emergency command role enforcement rejects unauthorized communication actors', () => {
  const platform = new EmergencyOperationsPlatform();
  const workflow = platform.createEmergencyWorkflow({
    id:'wf-fire-guard', planId:'plan-fire', activatedBy:'commander-1', activatedByRoles:['security'],
    incident:{ id:'inc-guard-1', scenario:'fire-incident', severity:'critical', location:'Barn 2', reportedAt:'2026-06-13T18:00:00Z', affectedAssets:[], systems:[] },
    commandRoles:[
      {id:'role-ic', role:'race-day-operations-manager', assignee:'commander-1', permissions:['activate-workflow','override-ai','dispatch-resource','send-communication','close-incident']},
      {id:'role-observer', role:'safety-officer', assignee:'observer-1', permissions:['activate-workflow']},
    ],
    resources:[], evacuationZones:[], communicationChecklist:[{id:'comm-guard', audience:'field teams', channel:'radio', message:'Test', completed:false}],
  });
  assert.throws(() => platform.recordCommunication(workflow.id, 'comm-guard', 'observer-1'), /incident-commander authority required/);
  assert.doesNotThrow(() => platform.recordCommunication(workflow.id, 'comm-guard', 'commander-1'));
});

test('emergency post-action evidence posture is returned for platform mutations', () => {
  const platform = new EmergencyOperationsPlatform();
  const posture = platform.postActionEvidencePosture('wf-evidence-1', 'audit-emergency-1');
  assert.equal(posture.mode, 'post-action-evidence');
  assert.equal(posture.emergencyPersonnelAuthority, true);
  assert.equal(posture.aiMayBlock, false);
  assert.equal(posture.action, 'emergency-action');
});

test('emergency activation rejects actors without incident-commander authority', () => {
  const platform = new EmergencyOperationsPlatform();
  assert.throws(() => platform.createEmergencyWorkflow({
    id: 'wf-denied-command',
    planId: 'plan-fire',
    activatedBy: 'observer-1',
    activatedByRoles: ['security'],
    incident: { id: 'inc-denied-command', scenario: 'fire-incident', severity: 'critical', location: 'Barn 2', reportedAt: '2026-06-13T18:00:00Z', affectedAssets: [], systems: [] },
    commandRoles: [
      { id: 'role-ic', role: 'race-day-operations-manager', assignee: 'commander-1', permissions: ['activate-workflow', 'override-ai', 'dispatch-resource', 'send-communication', 'close-incident'] },
      { id: 'role-observer', role: 'safety-officer', assignee: 'observer-1', permissions: ['activate-workflow'] },
    ],
    resources: [],
    evacuationZones: [],
    communicationChecklist: [],
  }), /incident-commander authority required for activate-workflow/);
});

test('emergency operations service wires safety post-action evidence on native activation', () => {
  const platform = new EmergencyOperationsPlatform();
  const safety = new SafetyService();
  const service = createEmergencyOperationsService({ platform, safety, clock: () => '2026-06-14T12:00:00.000Z' });
  const result = service.activateWorkflow({
    id: 'wf-native-1',
    planId: 'plan-weather',
    scenario: 'severe-weather',
    severity: 'major',
    activatedBy: 'commander-native',
    roles: ['platform-super-admin'],
  }, ['admin']);

  assert.equal(result.eventType, 'emergency.workflow.activated');
  assert.equal(result.approvalPosture.mode, 'post-action-evidence');
  assert.equal(result.approvalPosture.aiMayBlock, false);
  assert.ok(result.evidencePackage.includes('emergency.workflow.activated'));
  assert.ok(safety.incidents.some((incident) => incident.id === 'inc-wf-native-1'));
});

test('emergency native mutation routes enforce RBAC and post-action evidence semantics', async () => {
  const state = createApiFacadeState();

  const denied = await handleApiRequest('POST', '/api/v1/emergency-operations/workflows', {
    id: 'wf-denied-api',
    planId: 'plan-weather',
    scenario: 'severe-weather',
    severity: 'major',
    activatedBy: 'unauthorized-operator',
    roles: ['platform-super-admin'],
    commandRoles: [
      { id: 'role-ic', role: 'race-day-operations-manager', assignee: 'Avery Chen', permissions: ['activate-workflow', 'override-ai', 'dispatch-resource', 'send-communication', 'close-incident'] },
      { id: 'role-observer', role: 'safety-officer', assignee: 'unauthorized-operator', permissions: ['activate-workflow'] },
    ],
  }, state, adminHeaders);
  assert.equal(denied.status, 403);
  assert.match(denied.body.error.message, /incident-commander authority required/);

  const activation = await handleApiRequest('POST', '/api/v1/emergency-operations/workflows', {
    id: 'wf-api-native-1',
    planId: 'plan-weather',
    scenario: 'severe-weather',
    severity: 'major',
    location: 'Grandstand',
    activatedBy: 'Avery Chen',
    roles: ['platform-super-admin'],
  }, state, adminHeaders);
  assert.equal(activation.status, 201);
  assert.equal(activation.body.eventType, 'emergency.workflow.activated');
  assert.equal(activation.body.workflowId, 'wf-api-native-1');
  assert.equal(activation.body.approvalPosture.emergencyPersonnelAuthority, true);
  assert.equal(activation.body.approvalPosture.aiMayBlock, false);

  const communication = await handleApiRequest('POST', '/api/v1/emergency-operations/workflows/wf-api-native-1/communications', {
    itemId: 'comm-wf-api-native-1',
    actor: 'Avery Chen',
  }, state, adminHeaders);
  assert.equal(communication.status, 201);
  assert.equal(communication.body.eventType, 'emergency.communication.completed');

  const drill = await handleApiRequest('POST', '/api/v1/emergency-operations/drills', {
    id: 'drill-api-1',
    scenario: 'severe-weather',
    participants: ['ops', 'security'],
  }, state, adminHeaders);
  assert.equal(drill.status, 201);
  assert.equal(drill.body.eventType, 'emergency.drill.scheduled');

  const drillComplete = await handleApiRequest('POST', '/api/v1/emergency-operations/drills/drill-api-1/complete', {
    actor: 'Avery Chen',
    workflowId: 'wf-api-native-1',
    observations: ['Command log reconciled'],
  }, state, adminHeaders);
  assert.equal(drillComplete.status, 201);
  assert.equal(drillComplete.body.approvalPosture.mode, 'post-action-evidence');

  const afterAction = await handleApiRequest('POST', '/api/v1/emergency-operations/after-action-reports', {
    incidentId: 'inc-100',
    actor: 'Avery Chen',
    workflowId: 'wf-api-native-1',
    findings: [{ finding: 'Communications reviewed', severity: 'major', owner: 'safety' }],
  }, state, adminHeaders);
  assert.equal(afterAction.status, 201);
  assert.ok(afterAction.body.evidencePackage.length >= 3);
});

test('safety emergency boundary delegates workspace read model through service catalog runtime', async () => {
  const platform = new EmergencyOperationsPlatform();
  const safety = new SafetyService();
  const emergencyOperations = createEmergencyOperationsService({ platform, safety, clock: () => '2026-06-14T12:00:00.000Z' });
  const boundary = createSafetyEmergencyOperationsBoundary({ emergencyOperations, safety });

  emergencyOperations.activateWorkflow({
    id: 'wf-boundary-1',
    planId: 'plan-weather',
    scenario: 'severe-weather',
    severity: 'major',
    activatedBy: 'commander-boundary',
    roles: ['platform-super-admin'],
  }, ['admin']);

  const workspace = boundary.workspace();
  assert.equal(workspace.mock, false);
  assert.equal(workspace.emergencyActions.aiMayBlock, false);
  assert.equal(workspace.approvalPosture.emergencyPersonnelAuthority, true);
  assert.equal(workspace.observability.serviceId, 'emergency-operations');

  const state = createApiFacadeState();
  const facade = await handleApiRequest('GET', '/api/v1/emergency-operations/workspace', undefined, state, adminHeaders);
  assert.equal(facade.status, 200);
  assert.equal(facade.body.emergencyActions.aiMayBlock, false);
  assert.ok(facade.body.workflowIntegrations.length > 0);

  const serviceRoute = await handleApiRequest('GET', '/api/v1/services/safety/emergency-operations/workspace', undefined, state, adminHeaders);
  assert.equal(serviceRoute.status, 200);
  assert.equal(serviceRoute.body.observability.serviceId, 'emergency-operations');
});

test('mock emergency workspace exposes plans workflows twins approvals observability drills and after-action reports', () => {
  const workspace = createMockEmergencyOperationsWorkspace();
  assert.equal(workspace.mock, true);
  assert.ok(workspace.plans.length >= 2);
  assert.ok(workspace.workflowIntegrations.some((integration) => integration.definitionIds.includes('emergency-fire-incident-workflow')));
  assert.ok(workspace.digitalTwinPatches.some((patch) => patch.patch.aiMayBlock === false));
  assert.equal(workspace.approvalPosture.emergencyPersonnelAuthority, true);
  assert.equal(workspace.observability.serviceId, 'emergency-operations');
  assert.ok(workspace.drills.some((drill) => drill.completedAt));
  assert.ok(workspace.afterActionReports[0].evidencePackage.includes('digital-twin-state-history'));
});
