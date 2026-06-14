import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DigitalTwinRuntimeEngine,
  EnterpriseDataLakehouse,
  EventSourcedCqrsStore,
  RacetrackAssetRegistryService,
  createMasterDataEntityTemplate,
  designFederatedRacetrackArchitecture,
  enterpriseArchitectureArtifacts,
  enterpriseDomainSchemas,
  evaluateTrackAccreditation,
  federatedBenchmark,
  globalRacingIntelligenceNetwork,
  handleApiRequest,
  lakehouseReferenceArchitecture,
  seededComplianceLibrary,
  unifiedOperationalKnowledgeLayer,
  workflowPortfolio,
} from '../dist/index.js';
import {
  createTrackMindNexusUpgradePackage,
  nexusDigitalTwinAssetKinds,
  nexusWorkspaceIds,
} from '@trackmind/shared';

const expectedTusBusinessObjects = [
  'racetrack',
  'race-day',
  'race',
  'horse',
  'jockey',
  'trainer',
  'owner',
  'veterinarian',
  'steward',
  'maintenance-crew',
  'security-personnel',
  'facility',
  'asset',
  'sensor',
  'track-sector',
  'betting-system',
  'ticketing-system',
  'incident',
  'investigation',
  'compliance-record',
  'ai-recommendation',
  'approval',
  'digital-twin-object',
  'starting-gate',
  'vehicle',
  'workflow',
  'audit-record',
];

test('TUS business object registry covers canonical ROS entities with standard metadata', () => {
  const kinds = enterpriseDomainSchemas.map((schema) => schema.kind);
  assert.deepEqual(kinds, expectedTusBusinessObjects);
  assert.equal(new Set(kinds).size, kinds.length);

  for (const schema of enterpriseDomainSchemas) {
    assert.equal(schema.schemaVersion, 'edm.v1');
    assert.equal(schema.kernelSchemaVersion, 'trackmind.domain-kernel.v1');
    assert.ok(schema.namespace.startsWith('trackmind.enterprise.'));
    assert.deepEqual(schema.keyFields, ['entityId', 'tenantId']);
    assert.ok(schema.owner.accountableRole.length > 0, `${schema.kind} missing owner role`);
    assert.ok(schema.owner.stewardshipGroup.length > 0, `${schema.kind} missing stewardship group`);
    assert.ok(schema.analyticsGrain.includes(schema.kind), `${schema.kind} missing analytics grain`);
    assert.ok(schema.retentionPolicy.length > 0, `${schema.kind} missing retention policy`);
    for (const commonField of ['entityId', 'tenantId', 'lifecycleState', 'updatedAt']) {
      assert.ok(schema.fields.some((field) => field.name === commonField && field.required), `${schema.kind} missing ${commonField}`);
    }
  }

  for (const regulated of ['race', 'horse', 'jockey', 'trainer', 'veterinarian', 'compliance-record', 'ai-recommendation', 'approval', 'workflow', 'audit-record']) {
    assert.equal(enterpriseDomainSchemas.find((schema) => schema.kind === regulated)?.classification, 'regulated', `${regulated} should be regulated`);
  }
});

test('TUS master data templates validate required object fields and representative schema coverage', () => {
  const templates = [
    createMasterDataEntityTemplate('racetrack', { entityId: 'edm:racetrack:track-1', tenantId: 'track-1', name: 'Track 1', updatedBy: 'data-steward', attributes: { timezone: 'America/New_York', geoBoundary: { type: 'Polygon', coordinates: [] } } }),
    createMasterDataEntityTemplate('race', { entityId: 'edm:race:track-1:7', tenantId: 'track-1', name: 'Race 7', updatedBy: 'race-office', attributes: { raceNumber: 7, surface: 'dirt' } }),
    createMasterDataEntityTemplate('compliance-record', { entityId: 'edm:compliance-record:hisa-1', tenantId: 'track-1', name: 'HISA Evidence', updatedBy: 'compliance', attributes: { framework: 'HISA' } }),
    createMasterDataEntityTemplate('digital-twin-object', { entityId: 'edm:digital-twin-object:gate-1', tenantId: 'track-1', name: 'Gate Twin', updatedBy: 'twin-runtime', attributes: { twinModelId: 'dtmi:trackmind:starting-gate;1' } }),
  ];

  for (const template of templates) {
    assert.equal(template.schemaVersion, 'edm.v1');
    assert.equal(template.metadata.qualityScore, 100);
    assert.equal(template.lifecycleState, 'draft');
    assert.ok(template.entityId.startsWith(`edm:${template.kind}:`));
    assert.equal(template.owner.ownerType, 'department');
  }
});

test('asset standard fields are normalized across representative ROS assets', async () => {
  const service = new RacetrackAssetRegistryService();
  const principal = { id: 'asset-standards', tenantId: 'track-std', scopes: ['assets:read', 'assets:write', 'assets:approve'] };
  const base = {
    riskLevel: 'medium',
    maintenance: { status: 'ok', nextInspectionDueAt: '2026-06-20T00:00:00.000Z' },
    ownership: { ownerAgent: 'RaceOps', stewardTeam: 'asset-standards' },
    location: { zone: 'operations' },
    state: { status: 'ready' },
    controls: [],
    sensors: [],
    regulations: [{ authority: 'StateRacingCommission', reference: 'standard asset evidence', appliesTo: ['race-day-readiness'] }],
    tags: ['standard'],
    approvalPolicyId: 'standard-asset-approval',
    metadata: { source: 'ros-standardization-test' },
  };

  const assets = [
    { ...base, assetId: 'STD_START_GATE_01', externalIds: ['std:gate:1'], name: 'Standard Starting Gate 01', assetType: 'StartingGate', domain: 'racing', riskLevel: 'high', approvalPolicyId: 'critical-asset-dual-control', digitalTwin: { twinId: 'twin:std:gate-1', relationship: 'represents' } },
    { ...base, assetId: 'STD_SENSOR_01', externalIds: ['std:sensor:1'], name: 'Standard Surface Sensor 01', assetType: 'Sensor', domain: 'surface', sensors: [{ id: 'sensor-moisture-1', type: 'moisture', verifies: ['moisture'], required: true }], digitalTwin: { twinId: 'twin:std:sensor-1', relationship: 'observes' } },
    { ...base, assetId: 'STD_FACILITY_01', externalIds: ['std:facility:1'], name: 'Standard Facility 01', assetType: 'LightingSystem', domain: 'facilities', digitalTwin: { twinId: 'twin:std:facility-1', relationship: 'represents' } },
    { ...base, assetId: 'STD_AI_AGENT_01', externalIds: ['std:ai:1'], name: 'Standard AI Agent 01', assetType: 'AIAgent', domain: 'surface', digitalTwin: { twinId: 'twin:std:ai-agent-1', relationship: 'observes' } },
  ];

  for (const asset of assets) await service.create(asset, principal);

  const standardFields = ['assetId', 'tenantId', 'externalIds', 'name', 'assetClass', 'assetType', 'domain', 'lifecycleStatus', 'riskLevel', 'safetyCritical', 'maintenance', 'maintenanceHistory', 'ownership', 'location', 'state', 'controls', 'sensors', 'telemetryBindings', 'regulations', 'complianceMappings', 'lifecycleHistory', 'riskAssessments', 'tags', 'digitalTwin', 'approvalPolicyId', 'createdAt', 'updatedAt', 'version', 'metadata'];
  const created = service.query({}, principal).assets;
  assert.equal(created.length, assets.length);

  for (const asset of created) {
    for (const field of standardFields) assert.ok(Object.hasOwn(asset, field), `${asset.assetId} missing ${field}`);
    assert.equal(asset.tenantId, 'track-std');
    assert.ok(asset.complianceMappings.length >= 1);
    assert.ok(asset.lifecycleHistory.length >= 1);
    assert.ok(asset.riskAssessments.length >= 1);
    assert.ok(asset.digitalTwin.twinId.startsWith('twin:std:'));
  }

  assert.equal(service.query({ assetClass: 'physical' }, principal).total, 2);
  assert.equal(service.query({ assetClass: 'digital', sensorId: 'sensor-moisture-1' }, principal).total, 1);
  assert.equal(service.query({ assetClass: 'ai-agent' }, principal).total, 1);
});

test('ROS digital twin kinds, workspaces, events, and workflow templates preserve governance metadata', () => {
  const pkg = createTrackMindNexusUpgradePackage('2026-06-14T00:00:00.000Z');
  for (const kind of ['racetrack', 'race-day', 'race', 'horse', 'track-sector', 'starting-gate', 'facility', 'sensor', 'vehicle', 'workflow', 'approval', 'incident', 'ai-agent']) {
    assert.ok(nexusDigitalTwinAssetKinds.includes(kind), `${kind} missing from shared Digital Twin kinds`);
    assert.ok(pkg.digitalTwinAssetKinds.includes(kind), `${kind} missing from Nexus package`);
  }

  assert.deepEqual(pkg.workspaces.map((workspace) => workspace.id), [...nexusWorkspaceIds]);
  for (const workspace of pkg.workspaces) {
    assert.ok(workspace.route.startsWith('/'), `${workspace.id} missing dashboard route`);
    assert.ok(workspace.apiPath.startsWith('/api/v1/'), `${workspace.id} missing API path`);
    assert.ok(workspace.twinKinds.length > 0, `${workspace.id} missing twin kinds`);
    assert.ok(workspace.eventTypes.length > 0, `${workspace.id} missing event types`);
    assert.ok(workspace.auditActions.length > 0 || workspace.id === 'audit', `${workspace.id} missing audit actions`);
  }

  for (const contract of pkg.eventContracts) {
    for (const metadata of ['tenantId', 'racetrackId', 'correlationId', 'auditRef', 'digitalTwinRef']) {
      assert.ok(contract.requiredMetadata.includes(metadata), `${contract.eventType} missing ${metadata}`);
    }
    assert.equal(contract.auditRequired, true);
    assert.equal(contract.replayable, true);
  }

  const templates = workflowPortfolio('track-std');
  assert.ok(templates.length >= 10);
  assert.ok(templates.some((definition) => definition.domain === 'compliance'));
  assert.ok(templates.some((definition) => definition.domain === 'ai-review'));
  assert.ok(templates.some((definition) => definition.steps.some((step) => step.approval?.action === 'race-start')));
  assert.ok(templates.every((definition) => definition.tenantId === 'track-std'));
  assert.ok(templates.every((definition) => definition.bpmnProcessId.startsWith('Process_')));
  assert.ok(templates.every((definition) => definition.steps.some((step) => step.digitalTwin || step.approval || step.type === 'endEvent')));
});

test('compliance evidence packages map one evidence set across safety, AI, security, quality, and racing frameworks', () => {
  const dashboard = seededComplianceLibrary('track-std').dashboard();
  const evidencePackage = dashboard.evidencePackages.find((pkg) => pkg.id === 'pkg-accreditation-2026-q2');
  assert.ok(evidencePackage);
  assert.equal(evidencePackage.sealed, true);
  assert.equal(evidencePackage.readiness, 'audit-ready');

  for (const field of ['evidenceIds', 'auditRecordIds', 'workflowInstanceIds', 'approvalRequestIds', 'digitalTwinRefs']) {
    assert.ok(evidencePackage[field].length > 0, `evidence package missing ${field}`);
  }
  assert.ok(dashboard.auditReadinessEvents.some((event) => event.type === 'compliance.accreditation.readiness.updated'), 'dashboard missing compliance readiness event metadata');
  for (const framework of ['ISO-42001', 'ISO-27001', 'ISO-27701', 'ISO-25010', 'ISO-31000', 'ISO-22301', 'SOC-2', 'PCI-DSS', 'HISA', 'ARCI', 'LOCAL-RACING-COMMISSION']) {
    assert.ok(evidencePackage.frameworkIds.includes(framework), `evidence package missing ${framework}`);
  }
  assert.ok(evidencePackage.frameworkMappings.length >= 3);
  assert.ok(evidencePackage.frameworkMappings.every((mapping) => mapping.controlIds.length > 0));

  const racingMapping = dashboard.frameworkMappings.find((mapping) => mapping.frameworkId === 'HISA');
  assert.ok(racingMapping);
  assert.ok(racingMapping.mappedTo.some((mapping) => mapping.frameworkId === 'ARCI'));
  assert.ok(racingMapping.mappedTo.some((mapping) => mapping.frameworkId === 'LOCAL-RACING-COMMISSION'));
  assert.ok(racingMapping.mappedTo.some((mapping) => mapping.frameworkId === 'ISO-31000'));
});

test('ROS SaaS tiers, deployment modes, certified-track scoring, and shared intelligence layers are standardized', () => {
  const architecture = designFederatedRacetrackArchitecture([
    { id: 'tenant-local', name: 'Local Track', region: 'east', tier: 'local-track', dataResidency: 'us-east' },
    { id: 'tenant-regional', name: 'Regional Authority', region: 'east', tier: 'regional-authority', dataResidency: 'us-east' },
    { id: 'tenant-national', name: 'National Command', region: 'national', tier: 'national-command', dataResidency: 'us' },
  ], 500);
  assert.deepEqual(architecture.tenants.map((tenant) => tenant.tier), ['local-track', 'regional-authority', 'national-command']);
  assert.equal(architecture.capacityOk, true);
  assert.ok(architecture.isolation.includes('tenant-id partition keys'));
  assert.ok(architecture.isolation.includes('per-track encryption keys'));
  assert.ok(architecture.perTenantServices.includes('local digital twin'));
  assert.ok(architecture.commandCenterServices.includes('national telemetry mesh'));
  assert.ok(architecture.landingZones.includes('ai-platform'));
  assert.ok(enterpriseArchitectureArtifacts.azureLandingZone.includes('hub-spoke-network'));
  assert.ok(enterpriseArchitectureArtifacts.roadmap.includes('federation'));
  assert.ok(enterpriseArchitectureArtifacts.roadmap.includes('national-scale'));

  const accreditation = evaluateTrackAccreditation([
    { domain: 'operations', score: 94, evidence: ['race-day-readiness'] },
    { domain: 'maintenance', score: 91, evidence: ['work-order-closure'] },
    { domain: 'safety', score: 95, evidence: ['emergency-drill'] },
    { domain: 'compliance', score: 92, evidence: ['sealed-evidence-package'] },
  ]);
  assert.equal(accreditation.status, 'accredited');
  assert.ok(accreditation.overall >= 90);
  assert.deepEqual(accreditation.byDomain.map((item) => item.domain), ['operations', 'maintenance', 'safety', 'compliance']);
  assert.ok(accreditation.byDomain.every((item) => Number.isInteger(item.score)));
  assert.ok(accreditation.evidence.includes('sealed-evidence-package'));

  const knowledge = unifiedOperationalKnowledgeLayer([
    { id: 'src-race', domain: 'race-operations', system: 'race-office', sensitivity: 'internal', owner: 'race-office' },
    { id: 'src-twin', domain: 'digital-twin', system: 'twin-runtime', sensitivity: 'confidential', owner: 'platform' },
    { id: 'src-compliance', domain: 'compliance', system: 'evidence-vault', sensitivity: 'restricted', owner: 'compliance' },
  ]);
  assert.equal(knowledge.trusted, true);
  for (const capability of ['schema-mapping', 'metadata-catalog', 'lineage-tracking', 'semantic-search', 'governance-workflows', 'auditable-apis']) {
    assert.ok(knowledge.capabilities.includes(capability), `missing ${capability}`);
  }
  assert.ok(knowledge.ontology.some((entity) => entity.name === 'FacilityAsset'));
  assert.ok(knowledge.semanticModel.includes('Evidence'));
});

test('unified stores and federation contracts keep tenants isolated and benchmarking anonymized', () => {
  const eventStore = new EventSourcedCqrsStore();
  eventStore.append({ id: 'evt-1', aggregateId: 'race-7', type: 'race.created', version: 1, occurredAt: '2026-06-14T00:00:00.000Z', payload: { tenantId: 'track-a', status: 'draft' } });
  eventStore.append({ id: 'evt-2', aggregateId: 'race-7', type: 'race.approved', version: 2, occurredAt: '2026-06-14T00:01:00.000Z', payload: { tenantId: 'track-a', status: 'approved' } });
  const projection = eventStore.project('race-7', (state, event) => ({ ...state, ...event.payload }), {});
  assert.deepEqual(projection, { tenantId: 'track-a', status: 'approved' });

  const twins = new DigitalTwinRuntimeEngine();
  twins.sync({ id: 'asset-a', tenantId: 'track-a', updatedAt: '2026-06-14T00:00:00.000Z', state: { health: 'normal' } });
  twins.sync({ id: 'asset-b', tenantId: 'track-b', updatedAt: '2026-06-14T00:00:00.000Z', state: { health: 'warning' } });
  assert.deepEqual(twins.snapshot('track-a').map((state) => state.id), ['asset-a']);
  assert.equal(twins.snapshot().length, 2);

  const lakehouse = new EnterpriseDataLakehouse();
  lakehouse.registerSource({ id: 'src-telemetry', name: 'Telemetry Mesh', domain: 'telemetry', systemOfRecord: 'event-hubs', refreshCadence: 'streaming', owner: 'platform-data', retentionYears: 7 });
  lakehouse.ingest({ id: 'ds-telemetry-silver', sourceId: 'src-telemetry', name: 'Conformed Telemetry', zone: 'silver', domain: 'telemetry', sensitivity: 'confidential', schema: ['tenantId', 'assetId', 'metric', 'observedAt'], partitions: ['tenantId', 'observedDate'], qualityScore: 93, lineage: ['quality:range-checks'], tags: ['encrypted', 'private-link'], rowCount: 1000, updatedAt: '2026-06-14T00:00:00.000Z' });
  lakehouse.addPolicy({ id: 'pol-telemetry', appliesTo: ['telemetry'], requiredTags: ['encrypted', 'private-link'], minQualityScore: 90, encryptionRequired: true, privateAccessRequired: true, evidenceRequired: ['lineage'] });
  lakehouse.publishProduct({ id: 'prod-intelligence-core', name: 'Intelligence Core', purpose: 'enterprise-intelligence', datasetIds: ['ds-telemetry-silver'], metrics: ['asset-health', 'benchmark-readiness'], refreshCadence: '15m', consumers: ['operations-command'] });
  assert.equal(lakehouse.compliance('ds-telemetry-silver').compliant, true);
  assert.ok(lakehouse.intelligenceBrief().capabilities.includes('enterprise-intelligence'));
  assert.ok(lakehouseReferenceArchitecture().storageZones.includes('feature-store'));

  const federation = globalRacingIntelligenceNetwork([
    { tenantId: 'track-a', region: 'east', regulations: ['HISA'] },
    { tenantId: 'track-b', region: 'east', regulations: ['ARCI'] },
    { tenantId: 'track-c', region: 'west', regulations: ['LOCAL-RACING-COMMISSION'] },
  ]);
  assert.ok(federation.tenantIsolation.includes('row-level-security'));
  assert.ok(federation.tenantIsolation.includes('clean-room-analytics'));
  assert.ok(federation.analytics.includes('cross-track-benchmarking'));
  assert.ok(federation.analytics.includes('anonymized-safety-studies'));
  assert.deepEqual(federation.benchmarkCohorts.sort(), ['east', 'west']);
  assert.equal(federation.sharingAllowed, true);

  const benchmark = federatedBenchmark([
    { tenantId: 'track-a', metric: 'surface-readiness', value: 90, shareable: true },
    { tenantId: 'track-b', metric: 'surface-readiness', value: 80, shareable: true },
    { tenantId: 'track-c', metric: 'surface-readiness', value: 10, shareable: false },
  ]);
  assert.equal(benchmark.participants, 2);
  assert.equal(benchmark.average, 85);
  assert.equal(benchmark.anonymized, true);
  assert.equal(benchmark.suppressed, 1);
});

test('implemented API facade endpoints expose ROS/TUS standardization metadata without execution side effects', async () => {
  const upgrade = await handleApiRequest('GET', '/api/v1/platform/nexus-upgrade');
  assert.equal(upgrade.status, 200);
  assert.equal(upgrade.body.schemaVersion, 'trackmind-nexus.upgrade-package.v1');
  assert.equal(upgrade.body.azureFirst, true);
  assert.equal(upgrade.body.humanGoverned, true);
  assert.ok(upgrade.body.workspaces.some((workspace) => workspace.id === 'compliance'));

  const events = await handleApiRequest('GET', '/api/v1/events/catalog');
  assert.equal(events.status, 200);
  assert.equal(events.body.standards.tenantScoped, true);
  assert.equal(events.body.standards.auditRequired, true);
  assert.ok(events.body.standards.requiredReferences.includes('digitalTwinRef'));
  assert.ok(events.body.integrations.includes('workflow-engine'));

  const compliance = await handleApiRequest('GET', '/api/v1/compliance/control-library');
  assert.equal(compliance.status, 200);
  assert.ok(compliance.body.evidencePackages.some((pkg) => pkg.frameworkIds.includes('HISA') && pkg.frameworkIds.includes('ISO-42001')));

  const aiControlPlane = await handleApiRequest('GET', '/api/v1/ai-control-plane/workspace');
  assert.equal(aiControlPlane.status, 200);
  assert.equal(aiControlPlane.body.policy.executionEndpointsAvailable, false);
  assert.equal(aiControlPlane.body.policy.draftOnlyStateChanges, true);
  assert.ok(aiControlPlane.body.auditEventTwinReferences.auditIds.length > 0);
  assert.ok(aiControlPlane.body.auditEventTwinReferences.eventIds.length > 0);
  assert.ok(aiControlPlane.body.auditEventTwinReferences.digitalTwinRefs.length > 0);

  const draft = await handleApiRequest('POST', '/api/v1/ai-control-plane/recommendations/evaluate', { recommendationId: 'rec-test', action: 'race-start' });
  assert.equal(draft.status, 202);
  assert.equal(draft.body.accepted, true);
  assert.equal(draft.body.approvalRequired, true);
  assert.equal(draft.body.audited, true);
  assert.equal(draft.body.executionAllowed, false);
});
