import test from 'node:test';
import assert from 'node:assert/strict';
import { apiContractSchemas, apiEndpointContracts, auditExportPermissionRegistry, frontendRoutePermissionRegistry, hasPermission, modelReadableKpiAllowedUses, normalizeApprovalStatus, permissionRegistry, rolesWithPermission, validateAuditEventContract, validateContract, validateModelReadableKPIContext, workflowPermissionRegistry } from '../dist/index.js';

const externalOrDeferredResponseSchemas = new Set([
  'ProviderConfig',
  'ProviderStatus',
  'RacingDataDraftResultDto',
  'IngestionJob',
  'RawProviderPayload',
  'CanonicalRacingDataEnvelope',
  'DataQualityReport',
  'RacingDataLineageRecord',
  'WorkforceOperationsDto',
  'TrackMindNexusUpgradePackage',
  'ServerSentEventStream',
]);

function baseResponseName(response) {
  return response.replace(/\[\]$/, '');
}

test('endpoint catalog responses resolve to shared schemas or explicit deferred contracts', () => {
  for (const endpoint of apiEndpointContracts) {
    const name = baseResponseName(endpoint.response);
    assert.ok(apiContractSchemas[name] || externalOrDeferredResponseSchemas.has(name), `${endpoint.operationId} response ${endpoint.response} is missing a schema or explicit deferred marker`);
    assert.equal(endpoint.responseEnvelope, 'ApiResponse');
    assert.ok(endpoint.requiredPermission in permissionRegistry, `${endpoint.operationId} uses an unknown permission ${endpoint.requiredPermission}`);
    assert.ok(rolesWithPermission(endpoint.requiredPermission).length > 0, `${endpoint.operationId} permission ${endpoint.requiredPermission} is not granted to any role`);
    assert.ok(endpoint.metadata.includes('requestId'), `${endpoint.operationId} missing requestId metadata`);
    assert.ok(endpoint.metadata.includes('timestamp'), `${endpoint.operationId} missing timestamp metadata`);
    if (endpoint.response.endsWith('[]')) assert.equal(endpoint.pagination, 'offset', `${endpoint.operationId} list endpoint missing offset pagination standard`);
  }
});

test('endpoint role allowlists match required permissions', () => {
  for (const endpoint of apiEndpointContracts) {
    if (endpoint.roles === 'authenticated') continue;
    for (const role of endpoint.roles) {
      assert.equal(
        hasPermission(role, endpoint.requiredPermission),
        true,
        `${endpoint.operationId} allows ${role} but requires ${endpoint.requiredPermission}`,
      );
    }
  }
});

test('RBAC registry centralizes route, workflow, approval, and audit export permissions', () => {
  for (const [routeId, permission] of Object.entries(frontendRoutePermissionRegistry)) {
    assert.ok(permission in permissionRegistry, `${routeId} route permission is not registered`);
    assert.ok(rolesWithPermission(permission).length > 0, `${routeId} route permission has no grants`);
  }
  for (const [path, permission] of Object.entries(auditExportPermissionRegistry)) {
    assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === path && endpoint.requiredPermission === permission), `${path} audit export permission is not reflected in endpoint contracts`);
  }
  for (const [workflowId, permissions] of Object.entries(workflowPermissionRegistry)) {
    assert.ok(permissions.length > 0, `${workflowId} workflow has no permissions`);
    for (const permission of permissions) assert.ok(permission in permissionRegistry, `${workflowId} references unknown permission ${permission}`);
  }
  assert.equal(hasPermission('read-only-auditor', 'audit:read'), true);
  assert.equal(hasPermission('read-only-auditor', 'compliance:audit'), false);
  assert.equal(hasPermission('compliance-officer', frontendRoutePermissionRegistry.security), true);
});

test('shared API standard defines request metadata, pagination, and error envelope schemas', () => {
  const meta = { requestId: 'req-1', path: '/api/v1/kpis', method: 'GET', timestamp: '2026-06-15T06:00:00.000Z', tenantId: 'trackmind', racetrackId: 'main-track', organizationId: 'org-trackmind-network', role: 'admin', pagination: { limit: 50, offset: 0, total: 100, hasMore: true } };
  const error = { code: 'bad_request', message: 'Invalid input', details: ['field is required'], path: meta.path, requestId: meta.requestId, timestamp: meta.timestamp };
  assert.deepEqual(validateContract('ApiResponseMetadata', meta, apiContractSchemas.ApiResponseMetadata), { valid: true, errors: [] });
  assert.deepEqual(validateContract('ApiPaginationMetadata', meta.pagination, apiContractSchemas.ApiPaginationMetadata), { valid: true, errors: [] });
  assert.deepEqual(validateContract('ApiError', error, apiContractSchemas.ApiError), { valid: true, errors: [] });
});

test('model-readable KPI context rejects unknown or prohibited model uses', () => {
  const context = {
    kpiId: 'kpi-ai-governance',
    domain: 'ai-governance',
    name: 'AI governance completeness',
    description: 'Governed KPI context for advisory AI only.',
    currentValue: 91,
    unit: '%',
    trend: 'up',
    status: 'watch',
    confidence: 0.82,
    dataQualityScore: 0.79,
    sourceSummary: '2 event refs; deterministic calculation',
    allowedUse: [...modelReadableKpiAllowedUses],
    prohibitedUse: ['modify KPI values', 'execute regulated actions', 'bypass human approval', 'expose raw cross-track records'],
    approvalSensitivity: 'approval-visible',
    lastCalculatedAt: '2026-06-15T06:00:00.000Z',
  };
  assert.equal(validateModelReadableKPIContext(context).valid, true);
  assert.equal(validateModelReadableKPIContext({ ...context, allowedUse: [...context.allowedUse, 'train autonomous executor'] }).valid, false);
  assert.equal(validateModelReadableKPIContext({ ...context, allowedUse: ['execute regulated actions'] }).valid, false);
});

test('canonical audit event DTO standardizes identity actor entity scope approval and integrity fields', () => {
  const event = {
    auditEventId: 'audit-race-7',
    id: 'audit-race-7',
    type: 'approval',
    actor: { actorId: 'steward-1', actorType: 'human', roles: ['steward'] },
    actorId: 'steward-1',
    entity: { entityId: 'race-7', entityType: 'race', tenantId: 'trackmind', racetrackId: 'main-track' },
    action: 'approval.approved',
    reason: 'Race start checklist approved by human steward.',
    approvalReference: { approvalId: 'approval-race-start', status: 'approved', protectedAction: 'race-start' },
    timestamp: '2026-06-13T00:05:00.000Z',
    tenantScope: { tenantId: 'trackmind', racetrackId: 'main-track' },
    integrityReference: { hash: 'sha256:audit', previousHash: 'genesis', algorithm: 'sha256', chainScope: 'tenant' },
    severity: 'warning',
    hash: 'sha256:audit',
    previousHash: 'genesis',
    evidenceIds: ['human-approval-record'],
    mock: false,
  };
  assert.deepEqual(validateContract('AuditEventDto', event, apiContractSchemas.AuditEventDto), { valid: true, errors: [] });
  assert.equal(validateAuditEventContract({ ...event, eventType: event.type, evidence: event.evidenceIds, sourceService: 'approval-engine' }).allowed, true);
});

test('canonical approval DTO standardizes request status roles evidence escalation expiration and audit linkage', () => {
  const approval = {
    id: 'approval-race-start',
    approvalRequestId: 'approval-race-start',
    action: 'race-start',
    target: 'race-7',
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    requestedBy: 'ai-race-agent',
    status: 'escalated',
    canonicalStatus: normalizeApprovalStatus('approval_required'),
    createdAt: '2026-06-13T17:45:00.000Z',
    expiresAt: '2026-06-13T18:00:00.000Z',
    evidence: ['human-approval-record'],
    mock: false,
    requestedByActor: { id: 'ai-race-agent', displayName: 'ai-race-agent', role: 'ai-agent', actorType: 'ai-agent' },
    approverRoles: ['racing-secretary', 'steward'],
    approvalSteps: [{ id: 'stewards', approverRoles: ['steward'], minimumApprovals: 1, evidenceRequired: ['human-approval-record', 'reason'], status: 'pending', decisions: [] }],
    escalation: [{ afterMinutes: 10, approverRoles: ['admin'], reason: 'race start approval SLA exceeded' }],
    auditLinkage: { auditIds: ['audit-approval-1'], eventIds: ['approval.requested'], workflowInstanceId: 'wf-race-start', correlationId: 'approval-race-start' },
  };
  assert.equal(approval.canonicalStatus, 'pending');
  assert.deepEqual(validateContract('ApprovalDto', approval, apiContractSchemas.ApprovalDto), { valid: true, errors: [] });
});

test('racing data workspace aggregate route has a first-class shared contract', () => {
  const workspace = {
    generatedAt: '2026-06-15T06:00:00.000Z',
    metadata: {},
    providers: [],
    statuses: [],
    connectors: [],
    normalizationMappings: [],
    ingestionJobs: [],
    rawPayloadReviews: [],
    canonical: { envelopes: [] },
    entityResolution: {},
    entityResolutionQueue: [],
    qualityReports: [],
    lineage: {},
    licensePolicies: {},
    digitalTwinSync: {},
    policyCenter: {},
    featureStoreExports: [],
    dataLakeExports: [],
    exportControls: [],
    reviewActions: [],
    governance: {},
    mock: false,
  };
  assert.deepEqual(validateContract('RacingDataWorkspaceDto', workspace, apiContractSchemas.RacingDataWorkspaceDto), { valid: true, errors: [] });
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/racing-data' && endpoint.response === 'RacingDataWorkspaceDto'));
});

test('shared API contract schemas cover race office, readiness, facilities, surface, finance, track configuration, stewarding, barn, asset, and workflow DTOs', () => {
  for (const schemaName of ['EventRefDto','RaceMeetDto','RaceDayDto','RaceOfficeWorkspaceDto','RaceDayReadinessDashboardDto','FacilitiesMaintenanceWorkspaceDto','FinanceTicketingWorkspaceDto','SurfaceIntelligenceDto','TrackMapDto','TrackConfigurationSummaryDto','TrackConfigurationWorkOrderDto','TrackConfigurationVerificationDto','StewardCenterDto','StreamingDataSourceDto','StreamingDataSnapshotDto','DomainAssetDto','BarnDto','StallDto','TrackFacilityDto','BarnOperationsDto','WorkflowContractDto','WorkflowTemplateRegistryDto','UniversalArtifactRegistryDto','UniversalArtifactSchemaCatalogDto','UniversalArtifactTrainingInputsDto','UniversalArtifactStorageMapDto','UniversalArtifactDraftRegistrationResultDto']) {
    assert.ok(apiContractSchemas[schemaName], `${schemaName} missing`);
  }
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/barn-operations/workspace' && endpoint.response === 'BarnOperationsDto'));
});

test('finance ticketing workspace contract replaces ticketing and finance mock route adapters', () => {
  const workspace = {
    generatedAt: '2026-06-15T06:00:00.000Z',
    tickets: [{ ticketId: 'ticket-1', raceDayId: 'race-day-1', status: 'active', priceCents: 2500 }],
    payouts: [],
    summary: { activeTickets: 1, refundedTickets: 0, voidTickets: 0, grossTicketRevenueCents: 2500, protectedPayouts: 0, raceDayIds: ['race-day-1'] },
    payoutApproval: 'dual-control steward + finance',
    protectedActions: ['payout'],
    evidence: ['finance-service:ticketing-state', 'approval-gateway:payout'],
    mock: false,
  };

  assert.deepEqual(validateContract('FinanceTicketingWorkspaceDto', workspace, apiContractSchemas.FinanceTicketingWorkspaceDto), { valid: true, errors: [] });
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/services/finance/ticketing' && endpoint.response === 'FinanceTicketingWorkspaceDto'));
});

test('race office workspace contract covers carding, placeholders, lifecycle, and approval controls', () => {
  const raceOffice = {
    meets: [{ id: 'meet-2026', name: 'Summer Meet', trackId: 'main-track', startsOn: '2026-06-01', endsOn: '2026-09-07', status: 'open', officialConfig: { stewards: ['steward-1'], racingSecretary: 'secretary-1', commission: 'state-racing-commission', rulesVersion: '2026.06', scratchDeadlineMinutes: 45, maxFieldSize: 14 }, updatedAt: '2026-06-13T12:00:00Z' }],
    raceDays: [{ id: 'day-2026-06-13', meetId: 'meet-2026', trackId: 'main-track', raceDate: '2026-06-13', status: 'entries-open', raceIds: ['race-7'], updatedAt: '2026-06-13T12:00:00Z' }],
    cards: [{ id: 'race-7', trackId: 'main-track', raceDate: '2026-06-13', raceNumber: 7, scheduledPostTime: '2026-06-13T21:00:00Z', status: 'ready', conditions: { surface: 'dirt', distanceFurlongs: 8, classLevel: 'Allowance', purse: 92000, eligibility: ['3yo+'], medicationRules: ['HISA'], surfaceRequirements: ['inspection'] }, entries: [{ id: 'entry-1', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1', declared: true, postPosition: 1, gate: 'G-1' }, { id: 'entry-2', horseId: 'horse-2', trainerId: 'trainer-2', ownerId: 'owner-2', declared: false, placeholder: true }], approvals: { racingOffice: 'approved', stewards: 'pending' }, regulatoryControls: ['HISA'], twinLinks: ['race:race-7'], telemetryStreams: ['weather'], declarationsPlaceholder: true, updatedAt: '2026-06-13T12:00:00Z' }],
    readiness: [{ raceId: 'race-7', ready: false, activeEntries: 1, blockers: ['steward approval pending'], assessedAt: '2026-06-13T12:00:00Z', telemetryStreams: ['weather'] }],
    approvalControls: [{ id: 'race-office-scratch-race-7', label: 'Request scratch approval', action: 'race-office-scratch', target: 'race-7', reason: 'Scratches require approval.', requiredRoles: ['veterinarian', 'steward'], evidence: ['scratch-reason', 'human-approval-record'], approvalApi: 'POST /api/v1/approvals/controlled-actions', locked: true, safetyCritical: true }, { id: 'race-office-distance-race-7', label: 'Draft race distance configuration', action: 'race-distance-configuration', target: 'race-7', reason: 'Distance changes use the track-configuration draft path.', requiredRoles: ['racing-secretary', 'track-superintendent', 'steward'], evidence: ['distance-sheet', 'human-approval-record'], approvalApi: 'POST /api/v1/track-configuration/draft-requests', locked: true, safetyCritical: true }],
    lifecycle: [{ raceId: 'race-7', status: 'ready', nextAction: 'request race-start approval', approvalRequired: true, eventType: 'race.readiness.assessed', auditId: 'audit-ready', updatedAt: '2026-06-13T12:00:00Z' }],
    mock: true,
  };

  assert.deepEqual(validateContract('RaceOfficeWorkspaceDto', raceOffice, apiContractSchemas.RaceOfficeWorkspaceDto), { valid: true, errors: [] });
  assert.ok(raceOffice.approvalControls.every((control) => control.locked && control.safetyCritical && (control.approvalApi.includes('/approvals/controlled-actions') || control.approvalApi.includes('/track-configuration/draft-requests'))));
  assert.ok(raceOffice.approvalControls.some((control) => control.action === 'race-distance-configuration' && control.approvalApi.includes('/track-configuration/draft-requests')));
  assert.ok(raceOffice.cards[0].entries.some((entry) => entry.placeholder));
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/race-operations/race-office' && endpoint.response === 'RaceOfficeWorkspaceDto'));
});

test('shared contracts define stream readiness and approval-only mutation boundaries', () => {
  const source = {
    url: '/api/v1/events/stream',
    mode: 'live',
    transport: 'server-sent-events',
    label: 'Live TrackMind event stream',
    mock: false,
    safeForStateMutation: false,
    reconnectStrategy: { initialDelayMs: 1000, maxDelayMs: 30000, backoff: 'exponential' },
  };
  const snapshot = {
    source,
    connection: 'stale',
    lastUpdatedAt: '2026-06-13T12:00:00Z',
    stale: true,
    degraded: false,
    warnings: ['Stale data warning', 'protected operational state remains backend-owned'],
    events: [{ id: 'evt-stream', timestamp: '2026-06-13T12:00:00Z', type: 'heartbeat', domain: 'platform', summary: 'heartbeat', severity: 'info', source: 'event-stream' }],
  };

  assert.deepEqual(validateContract('StreamingDataSourceDto', source, apiContractSchemas.StreamingDataSourceDto), { valid: true, errors: [] });
  assert.deepEqual(validateContract('StreamingDataSnapshotDto', snapshot, apiContractSchemas.StreamingDataSnapshotDto), { valid: true, errors: [] });
  assert.equal(validateContract('StreamingDataSourceDto', { ...source, safeForStateMutation: true }, apiContractSchemas.StreamingDataSourceDto).valid, false);

  const streamEndpoint = apiEndpointContracts.find((endpoint) => endpoint.operationId === 'getEventStream');
  assert.equal(streamEndpoint?.path, '/api/v1/events/stream');
  assert.equal(streamEndpoint?.method, 'GET');
  assert.match(streamEndpoint?.description ?? '', /never safe for safety-critical state mutation/);

  const controlledActionEndpoint = apiEndpointContracts.find((endpoint) => endpoint.operationId === 'requestControlledAction');
  assert.equal(controlledActionEndpoint?.path, '/api/v1/approvals/controlled-actions');
  assert.equal(controlledActionEndpoint?.method, 'POST');
  assert.ok(controlledActionEndpoint?.emits.includes('approval.requested'));
  assert.ok(controlledActionEndpoint?.audits.includes('approval.requested'));
  assert.match(controlledActionEndpoint?.description ?? '', /no protected operational control executes/);
});

test('track configuration map contract carries gate work order, GPS verification, audit, and event evidence without actuator control', () => {
  const workOrder = { id: 'wo-gate-race-7', crew: 'gate-crew', status: 'approval-blocked', tasks: ['calculate target position', 'capture GPS proof'], evidenceRequired: ['gps-fix', 'human-approval-record'], dueAt: '2026-06-13T12:00:00Z' };
  const verificationWorkflow = { id: 'verify-gate-race-7', status: 'approval-blocked', digitalTwinSync: 'blocked-until-approved', requiredRoles: ['steward', 'track-superintendent'], actuatorControlAvailable: false };
  const trackConfiguration = {
    changeId: 'chg-gate-race-7',
    raceDistance: { advertisedMeters: 1609, measuredMeters: 1614.4, varianceMeters: 5.4, regulatoryFlags: ['distance-variance-review'] },
    approvalRequirements: ['racing-secretary', 'track-superintendent', 'steward', 'timer'],
    workOrders: [workOrder],
    verificationWorkflow,
    events: ['track.configuration.change.requested', 'gate.movement.requested.v1', 'approval.requested'],
    auditIds: ['audit-track-config-submit', 'audit-gate-move'],
    digitalTwinSync: { twinId: 'race-setup:race-7', status: 'approval-required' },
    noLiveActuatorControl: true,
  };
  const trackMap = {
    trackId: 'main-track',
    distanceMeters: 1609,
    startingGate: { sectorId: 'backstretch', metersFromStart: 0 },
    sectors: [{ id: 'backstretch', name: 'Backstretch', startMeters: 0, endMeters: 1609, condition: 'fast' }],
    measurements: [{ sectorId: 'backstretch', moisture: 18, compaction: 238, measuredAt: '2026-06-13T12:00:00Z', eventId: 'evt-surface-backstretch', auditId: 'audit-surface-backstretch' }],
    assets: [{ id: 'gate-1', type: 'gate', label: 'Starting Gate', sectorId: 'backstretch', status: 'standby' }],
    geospatial: {
      viewport: { center: { latitude: 38.045, longitude: -76.95 }, zoom: 16, bounds: { north: 38.07, south: 38.03, east: -76.93, west: -76.97 } },
      overlays: [{ id: 'twin', name: 'Digital Twin', layer: 'twin', visible: true, opacity: 1 }],
      features: [{ id: 'feature-gate-1', layer: 'digital-twin', label: 'Gate twin', status: 'standby', source: 'digital-twin', coordinates: { latitude: 38.045, longitude: -76.95 }, properties: { twinId: 'twin:gate:gate-1' } }],
      playback: [{ at: '2026-06-13T12:00:00Z', featureIds: ['feature-gate-1'], summary: 'Gate twin read model refreshed' }],
      simulationOverlays: [{ id: 'sim-gate', scenario: 'gate move preview', featureIds: ['feature-gate-1'], riskDelta: 0, approvalRequired: true }],
      digitalTwinState: [{ twinId: 'twin:gate:gate-1', assetId: 'gate-1', health: 'healthy', version: 3, lastUpdatedAt: '2026-06-13T12:00:00Z', relationshipCount: 2, dependencyCount: 1, historyEvents: 4, approvalRequired: true }],
      controls: { zoom: { current: 16, presets: [14, 16, 18] }, filters: ['twin'], overlayModes: ['read-only'], playbackEnabled: true },
    },
    trackConfiguration,
    mock: true,
  };

  assert.deepEqual(validateContract('TrackConfigurationWorkOrderDto', workOrder, apiContractSchemas.TrackConfigurationWorkOrderDto), { valid: true, errors: [] });
  assert.deepEqual(validateContract('TrackConfigurationVerificationDto', verificationWorkflow, apiContractSchemas.TrackConfigurationVerificationDto), { valid: true, errors: [] });
  assert.deepEqual(validateContract('TrackConfigurationSummaryDto', trackConfiguration, apiContractSchemas.TrackConfigurationSummaryDto), { valid: true, errors: [] });
  assert.deepEqual(validateContract('TrackMapDto', trackMap, apiContractSchemas.TrackMapDto), { valid: true, errors: [] });
  assert.equal(validateContract('TrackConfigurationVerificationDto', { ...verificationWorkflow, actuatorControlAvailable: true }, apiContractSchemas.TrackConfigurationVerificationDto).valid, false);
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.operationId === 'getTrackConfigurationMap' && endpoint.path === '/api/v1/track-configuration/map'));
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.operationId === 'createTrackConfigurationDraftRequest' && endpoint.path === '/api/v1/track-configuration/draft-requests'));
});

test('shared API contract schemas and endpoint catalog cover read-only ROS metadata facade', () => {
  for (const schemaName of ['RosUniversalSchemaDto','RosStandardizationFrameworkDto','RosSaasTiersDto','RosCertifiedTrackDto','RosDataModelDto','RosIntelligenceCoreDto','RosFederationDto']) {
    assert.ok(apiContractSchemas[schemaName], `${schemaName} missing`);
  }

  const rosSchema = {
    generatedAt: '2026-06-13T12:00:00Z',
    schemaVersion: 'trackmind.ros.metadata.v1',
    readOnly: true,
    executionEndpointsAvailable: false,
    source: 'trackmind-nexus-upgrade-package',
    standard: 'TrackMind Universal Schema',
    domains: ['operations'],
    entityKinds: ['racetrack'],
    requiredMetadata: ['tenantId', 'racetrackId', 'auditRef'],
    eventSchemaRefs: ['audit.record.appended.v1'],
    complianceFrameworks: ['ISO-42001'],
    safetyControls: [{ action: 'start-race', autonomousExecutionAllowed: false, requiredRoles: ['steward'], evidenceRequired: ['human-approval-record'] }],
    mock: false,
  };
  assert.deepEqual(validateContract('RosUniversalSchemaDto', rosSchema, apiContractSchemas.RosUniversalSchemaDto), { valid: true, errors: [] });

  const endpoints = apiEndpointContracts.filter((endpoint) => endpoint.path.startsWith('/api/v1/ros/'));
  assert.equal(endpoints.length, 7);
  assert.ok(endpoints.every((endpoint) => endpoint.method === 'GET'));
  assert.ok(endpoints.every((endpoint) => endpoint.emits.length === 0));
  assert.ok(endpoints.every((endpoint) => endpoint.audits.includes('ros.metadata.read')));
  assert.ok(!apiEndpointContracts.some((endpoint) => endpoint.path.startsWith('/api/v1/ros/') && endpoint.method === 'POST'));
});

test('shared API contract schemas and endpoint catalog cover Universal Artifact Framework safety boundaries', () => {
  const registry = {
    generatedAt: '2026-06-14T12:00:00.000Z',
    schemaVersion: 'trackmind.artifacts.registry.v1',
    readOnly: true,
    executionEndpointsAvailable: false,
    artifactKinds: ['Asset','Event','DigitalTwin','Telemetry','Workflow','Approval','Audit','Compliance','Recommendation','Investigation','Feature','Insight','Forecast'],
    artifacts: [{ id: 'artifact-asset-1', kind: 'Asset', name: 'Asset artifact', description: 'Asset example', schemaRef: 'trackmind.artifact.asset.v1', ownerDomain: 'asset-registry', lifecycleStatus: 'published', readOnly: true, operationalMutationAllowed: false, autonomousExecutionAllowed: false, approvalRequiredForMutation: true, auditIds: ['audit-artifact-asset-1'], eventTypes: ['artifact.asset.registered.v1'], digitalTwinRefs: ['twin:track:main-track'], evidence: ['schema:asset'], mock: false }],
    governance: { draftRegistrationOnly: true, approvalRequired: true, audited: true, autonomousExecutionAllowed: false, operationalMutationAllowed: false },
    mock: false,
  };
  assert.deepEqual(validateContract('UniversalArtifactRegistryDto', registry, apiContractSchemas.UniversalArtifactRegistryDto), { valid: true, errors: [] });

  const endpoints = apiEndpointContracts.filter((endpoint) => endpoint.path.startsWith('/api/v1/artifacts/'));
  assert.ok(endpoints.filter((endpoint) => endpoint.method === 'GET').length >= 4);
  assert.equal(endpoints.filter((endpoint) => endpoint.method === 'POST').length, 1);
  assert.ok(endpoints.some((endpoint) => endpoint.path === '/api/v1/artifacts/registry' && endpoint.response === 'UniversalArtifactRegistryDto'));
  assert.ok(endpoints.some((endpoint) => endpoint.path === '/api/v1/artifacts/registry/draft-registrations' && endpoint.response === 'UniversalArtifactDraftRegistrationResultDto'));
  assert.ok(!endpoints.some((endpoint) => endpoint.path.startsWith('/api/v1/artifacts/kpis')));
  assert.ok(endpoints.every((endpoint) => endpoint.audits.length > 0));
  assert.ok(!apiEndpointContracts.some((endpoint) => endpoint.path.startsWith('/api/v1/artifacts/') && /execute|publish|mutate/i.test(endpoint.operationId)));
});

test('platform health contract covers operational, frontend, dependency, and deployment-boundary metadata', () => {
  const platformHealth = {
    generatedAt: '2026-06-14T12:00:00.000Z',
    overallStatus: 'degraded',
    services: [{ serviceId: 'api-gateway', status: 'healthy', latencyMs: 120, dependencies: [{ id: 'event-bus', status: 'healthy', required: true }], lastCheckedAt: '2026-06-14T12:00:00.000Z' }],
    eventBus: { status: 'healthy', publishedEvents: 1200, deadLetters: 0, schemas: 28, eventsPerMinute: 312, throughputCapacity: 100000, backpressure: false },
    audit: { status: 'healthy', validLedger: true, records: 936, criticalRecords: 2 },
    approvalEngine: { status: 'degraded', pending: 7, approved: 31, rejected: 2, escalated: 1, expired: 0 },
    aiGovernance: { status: 'healthy', activeAgents: 4, pendingReviews: 3, blockedActions: 2, driftBreaches: 0, inputThroughput: 42, featureBuildCount: 9, modelSelectionCount: 5, recommendationCount: 11, blockedActionCount: 2, approvalRequiredCount: 7, adjustedConfidenceDistribution: { low: 1, medium: 4, high: 6 }, staleLowQualityInputCount: 1, eventSyncStatus: 'healthy', auditSyncStatus: 'healthy', twinSyncStatus: 'degraded' },
    digitalTwin: { status: 'degraded', totalTwins: 128, healthy: 119, degraded: 8, critical: 1, queuedSync: 5, lastSyncAt: '2026-06-14T12:00:00.000Z' },
    workflows: { status: 'healthy', active: 12, completed: 244, failed: 0 },
    apiLatency: { p50Ms: 184, p95Ms: 226, budgetMs: 250, status: 'healthy' },
    frontend: { status: 'degraded', reportedErrors: 1, lastErrorAt: '2026-06-14T12:00:00.000Z', degradedMode: true },
    telemetrySchema: { version: 'platform-observability.v1', requiredSignals: ['log','metric','trace','frontend-error'], consistent: true },
    signals: [{ kind: 'frontend-error', name: 'frontend.error.reported', serviceId: 'dashboard', severity: 'warning', traceId: 'trace-ui', attributes: { route: '/platform-health' }, timestamp: '2026-06-14T12:00:00.000Z' }],
    deploymentBoundary: { providerStyle: 'Azure Front Door-style edge', assumptions: ['HTTPS','managed TLS','WAF','global routing','centralized access logs','centralized security logs','frontend-error logs'], loggingSignals: ['access','application','security','frontend-error'], routingBoundary: 'Internet-facing frontend edge.', implemented: false, copyOnly: true, claim: 'Metadata only; not proof of configured infrastructure.' },
  };

  assert.deepEqual(validateContract('PlatformHealthWorkspaceDto', platformHealth, apiContractSchemas.PlatformHealthWorkspaceDto), { valid: true, errors: [] });
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/platform/health' && endpoint.response === 'PlatformHealthWorkspaceDto'));
  assert.equal(platformHealth.deploymentBoundary.implemented, false);
});

test('surface intelligence contract covers scorecards, factor panels, heatmaps, inspections, and locked approvals', () => {
  const surfaceWorkspace = {
    trackId: 'track-001',
    generatedAt: '2026-06-13T12:00:00Z',
    overallScore: 72,
    approvalState: 'required',
    operationalActionsRequireHumanApproval: true,
    statusCards: [{ label: 'Surface score', value: '72', tone: 'warning', detail: 'Far Turn watch' }],
    conditionScorecards: [{ id: 'score-far-turn', label: 'Far Turn', score: 58, riskLevel: 'high', status: 'watch', detail: 'Moisture and drainage review', drivers: ['moisture', 'drainage'] }],
    metricPanels: [{ id: 'metric-moisture', factor: 'moisture', label: 'Moisture', value: '27%', target: '18%', status: 'warning', sectorId: 'far-turn', detail: 'Wet', trend: 'wetting' }],
    sectors: [{ id: 'far-turn', name: 'Far Turn', surfaceType: 'dirt', status: 'watch', conditionScore: 58, moisture: 27, compaction: 276, cushionDepth: 2.8, drainageRate: 6, latestInspectionAt: '2026-06-13T11:30:00Z' }],
    timeline: [{ id: 'tl-moisture', sectorId: 'far-turn', kind: 'moisture', observedAt: '2026-06-13T11:00:00Z', label: 'Moisture probe', value: '27%', eventId: 'evt-surface-moisture', auditId: 'audit-surface-moisture' }],
    inspectionTimeline: [{ id: 'inspection-far-turn', sectorId: 'far-turn', inspectedAt: '2026-06-13T11:30:00Z', inspector: 'track-superintendent', score: 58, summary: 'Standing water observed', findings: ['standing-water'], requiresFollowUp: true, eventId: 'evt-inspection', auditId: 'audit-inspection' }],
    heatmap: [{ id: 'hm-far-turn', sectorId: 'far-turn', latitude: 38.049, longitude: -76.944, averageMoisture: 27, averageCompaction: 276, averageDrainage: 6, riskIndex: 82, latestObservedAt: '2026-06-13T11:00:00Z' }],
    heatmapSectors: [{ sectorId: 'far-turn', label: 'Far Turn heatmap sector', riskLevel: 'high', riskIndex: 82, cellIds: ['hm-far-turn'], coordinates: [{ latitude: 38.049, longitude: -76.944 }], metrics: { moisture: 27, compaction: 276, drainage: 6 } }],
    recommendations: [{ id: 'rec-harrow', type: 'maintenance', sectorId: 'far-turn', priority: 'high', recommendation: 'Draft harrow pass after human approval.', requiresHumanApproval: true, executionState: 'approval-required', eventId: 'evt-rec', auditId: 'audit-rec' }],
    riskBadges: [{ sectorId: 'far-turn', level: 'high', drivers: ['moisture', 'drainage'] }],
    weatherObservation: { observedAt: '2026-06-13T11:45:00Z', rainfallMm: 5, forecastRainMm: 14, temperature: 83, windMph: 12 },
    digitalTwinSync: [{ twinId: 'track-001:far-turn', status: 'queued-for-human-approved-sync', patch: { conditionScore: 58 }, eventId: 'evt-twin', auditId: 'audit-twin' }],
    approvalActions: [{ id: 'surface-harrowing', label: 'Request harrowing approval', detail: 'Creates an approval request only.', approvalApi: 'POST /api/v1/approvals/draft-requests', locked: true }],
    mock: true,
  };

  assert.deepEqual(validateContract('SurfaceIntelligenceDto', surfaceWorkspace, apiContractSchemas.SurfaceIntelligenceDto), { valid: true, errors: [] });
  assert.ok(surfaceWorkspace.recommendations.every((item) => item.requiresHumanApproval && item.executionState === 'approval-required'));
  assert.ok(surfaceWorkspace.approvalActions.every((action) => action.locked && action.approvalApi.includes('/approvals/')));
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/surface-intelligence/workspace' && endpoint.response === 'SurfaceIntelligenceDto'));
});

test('steward center contract covers inquiry evidence, AI boundaries, and human-only final posture', () => {
  const stewardWorkspace = {
    inquiries: [{
      id: 'inq-race-7-1',
      raceId: 'race-7',
      openedAt: '2026-06-13T21:04:00.000Z',
      status: 'under-review',
      objections: [{ id: 'obj-1', filedBy: 'trainer-4', allegation: 'Horse 7 drifted inward.', status: 'accepted-for-review', filedAt: '2026-06-13T21:05:00.000Z', horseId: 'horse-4', jockeyId: 'jockey-4' }],
      incidentsUnderReview: [{ id: 'incident-r7-stretch', description: 'Possible stretch interference', severity: 'major', status: 'reviewing', openedAt: '2026-06-13T21:04:00.000Z' }],
      investigations: [{ id: 'investigation-r7-stretch', inquiryId: 'inq-race-7-1', openedAt: '2026-06-13T21:07:00.000Z', leadStewardId: 'steward-1', status: 'evidence-collection', focus: 'Stretch interference objection', taskIds: ['collect-evidence'], evidenceIds: ['ev-headon'], ruleIds: ['rule-interference'], digitalTwinRefs: ['twin:race-7'], approvalRequestId: 'approval-steward-decision-r7' }],
      involvedHorses: [{ horseId: 'horse-4', name: 'Rail Runner', programNumber: '4', officialResultLocked: true }],
      involvedJockeys: [{ jockeyId: 'jockey-4', name: 'Sam Rivera', licenseId: 'LIC-4', horseId: 'horse-4' }],
      evidenceReferences: [{ id: 'ev-headon', kind: 'video', uri: 's3://stewards/race-7/headon.mp4', capturedAt: '2026-06-13T21:03:30.000Z', description: 'Head-on replay', hash: 'sha256:headon', addedBy: 'video-review', eventId: 'steward.evidence.added', auditRecordId: 'audit-2', custody: { custodyRecordIds: ['custody-ev-headon-1'], legalHold: true, sealed: false, retentionPolicy: 'steward-inquiry-legal-hold', chainOfCustody: [{ actorId: 'video-review', action: 'collected', at: '2026-06-13T21:03:30.000Z' }] } }],
      ruleReferences: [{ id: 'rule-interference', jurisdiction: 'NY', rulebook: 'Racing Rules', section: '4035.2', citation: 'Interference and careless riding', summary: 'Human stewards review whether interference altered placing.', auditRecordId: 'audit-3' }],
      evidenceOrganizations: [{ id: 'ai-org-1', generatedAt: '2026-06-13T21:08:00.000Z', generatedBy: 'steward-ai', aiGenerated: true, officialRuling: false, mayModifyOfficialResults: false, clusters: [{ id: 'cluster-1', title: 'video evidence', evidenceIds: ['ev-headon'], ruleIds: ['rule-interference'], summary: 'Organized for human review.' }], timeline: [], missingEvidence: [], limitations: ['AI did not decide the objection.'] }],
      timeline: [{ sequence: 1, at: '2026-06-13T21:03:30.000Z', source: 'evidence', subjectId: 'ev-headon', label: 'Head-on replay', evidenceIds: ['ev-headon'], ruleIds: [], eventId: 'steward.evidence.added', auditRecordId: 'audit-2' }],
      decisionDrafts: [{ id: 'draft-human-1', authorId: 'steward-2', authorRole: 'steward', recommendation: 'Panel draft pending final approval', rationale: 'Human review required.', aiGenerated: false, officialRuling: false, evidenceIds: ['ev-headon'], ruleIds: ['rule-interference'] }],
      appealPackages: [],
      auditRecords: [{ id: 'audit-1', actorId: 'steward-1', action: 'case.opened', subjectId: 'inq-race-7-1', hash: 'sha256:audit1', previousHash: 'genesis' }],
      integrations: { auditRecordIds: ['audit-1'], eventTypes: ['steward.inquiry.opened'], approvalRequestIds: ['approval-steward-decision-r7'], workflowInstanceIds: [], evidenceVaultRecordIds: ['ev-headon'], digitalTwinRefs: ['twin:race-7'], observabilitySignals: [{ name: 'steward.evidence.added', at: '2026-06-13T21:03:30.000Z', severity: 'info', traceId: 'trace-steward-inq-race-7-1' }] },
      aiGuardrails: { advisoryOnly: true, mayIssueOfficialRuling: false, mayModifyOfficialResults: false },
    }],
    permissions: { canRead: true, canDraft: true, canFinalize: false, canExportAppeal: true },
    mock: false,
  };

  assert.deepEqual(validateContract('StewardCenterDto', stewardWorkspace, apiContractSchemas.StewardCenterDto), { valid: true, errors: [] });
  assert.ok(stewardWorkspace.inquiries.every((inquiry) => inquiry.aiGuardrails.advisoryOnly && !inquiry.aiGuardrails.mayIssueOfficialRuling && !inquiry.aiGuardrails.mayModifyOfficialResults));
  assert.ok(stewardWorkspace.inquiries.every((inquiry) => inquiry.evidenceReferences.every((evidence) => evidence.hash && evidence.auditRecordId && evidence.custody.legalHold)));
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/stewarding/inquiries' && endpoint.response === 'StewardCenterDto' && endpoint.method === 'GET'));
  assert.ok(!apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/stewarding/inquiries' && endpoint.method === 'POST'));
});

test('shared API contract schemas validate event, audit, twin, and approval references', () => {
  const asset = {
    id: 'asset-gate-release',
    trackId: 'track-001',
    type: 'control',
    label: 'Gate Release Control',
    status: 'standby',
    riskClassification: 'safety-critical',
    sectorId: 'sector-backstretch',
    twinId: 'twin:asset:asset-gate-release',
    eventId: 'asset.registry.changed.v1',
    auditId: 'audit-asset-1',
    mock: false,
  };
  assert.deepEqual(validateContract('DomainAssetDto', asset, apiContractSchemas.DomainAssetDto), { valid: true, errors: [] });

  const workflow = {
    id: 'workflow-race-start',
    subjectId: 'race-7',
    subjectType: 'race',
    state: 'executed',
    protectedAction: 'race-start',
    approvalIds: ['approval-race-start'],
    eventIds: ['approval.protectedAction.approved.v1'],
    auditIds: ['audit-race-start'],
    mock: false,
  };
  assert.deepEqual(validateContract('WorkflowContractDto', workflow, apiContractSchemas.WorkflowContractDto), { valid: true, errors: [] });

  const invalid = validateContract('DomainAssetDto', { ...asset, riskClassification: 'actuator' }, apiContractSchemas.DomainAssetDto);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes('riskClassification')));
});

test('TrackMind Certified Track candidate contract covers criteria, scorecard, evidence, controls, and claim boundary', () => {
  const candidate = {
    tier: 8,
    model: 'franchise',
    certificationLabel: 'TrackMind Certified Track',
    trackId: 'track-001',
    generatedAt: '2026-06-14T00:00:00.000Z',
    readinessStatus: 'candidate',
    candidateStatement: 'TrackMind readiness candidate only.',
    externalCertificationClaimed: false,
    claimBoundary: 'TrackMind readiness/certification candidate only; no external certification is asserted.',
    certificationCriteria: ['platform-installed','operational-controls-active','safety-controls-active','inspection-controls-active','digital-twin-active','audit-ledger-active','ai-governance-active'].map((id) => ({
      id,
      label: id,
      description: `${id} criterion`,
      required: true,
      status: 'candidate',
      score: 90,
      requiredControlRefs: ['ctrl-ai-evidence'],
      requiredEvidenceRefs: [{ id: `${id}:evidence`, kind: id.includes('audit') ? 'audit' : id.includes('digital-twin') ? 'digital-twin' : id.includes('ai') ? 'ai-governance' : 'evidence', source: 'contract-test', controlId: 'ctrl-ai-evidence' }],
      blockers: [],
    })),
    scorecard: { safetyScore: 91, complianceScore: 92, operationalScore: 90, accreditationScore: 88, overallScore: 90, generatedAt: '2026-06-14T00:00:00.000Z', scoringModel: 'trackmind-certified-track.v1', scoreBands: { ready: 90, watch: 75, blocked: 70 } },
    requiredEvidenceRefs: [{ id: 'audit:verification', kind: 'audit', source: '/api/v1/audit/verification' }],
    requiredControlRefs: ['ctrl-ai-evidence'],
    accreditationReadiness: { status: 'candidate', score: 88, programIds: ['program-readiness'], evidencePackageIds: ['pkg-readiness'], controlIds: ['ctrl-ai-evidence'] },
    operatingStandards: [{ id: 'standard-ai', title: 'AI governance standard', category: 'ai-governance', required: true, controlRefs: ['ctrl-ai-evidence'], evidenceRefs: ['ai:safety-policy'], ownerRole: 'compliance-officer', cadence: 'continuous' }],
    integrations: { platform: true, operationalControls: true, safetyControls: true, inspectionControls: true, digitalTwin: true, auditLedger: true, aiGovernance: true, complianceReadiness: true },
    mock: false,
  };

  assert.deepEqual(validateContract('TrackCertificationCandidateDto', candidate, apiContractSchemas.TrackCertificationCandidateDto), { valid: true, errors: [] });
  assert.equal(candidate.externalCertificationClaimed, false);
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.operationId === 'getTrackCertificationCandidate' && endpoint.response === 'TrackCertificationCandidateDto'));
});

test('workflow template registry contract exposes Tier 4 canonical metadata', () => {
  const registry = {
    tenantId: 'track-001',
    certificationTier: 'Tier 4',
    generatedAt: '2026-06-14T12:00:00.000Z',
    templates: [{
      canonicalId: 'tmwf.gate-move.v1',
      templateName: 'Gate Move Workflow',
      certifiedRacetrackRequired: true,
      safetyCritical: true,
      requiredRoles: ['racing-secretary', 'track-superintendent'],
      protectedActions: ['starting-gate-move'],
      approvalPoints: [{ stepId: 'approve-gate-move', action: 'starting-gate-move', requiredRoles: ['racing-secretary', 'track-superintendent'], minimumApprovals: 2, evidenceRequired: ['human-approval-record'], deadlineMinutes: 15, policy: 'starting-gate-move' }],
      auditRequirements: [{ action: 'approval.requested', severity: 'warning', evidenceRequired: ['human-approval-record'], retention: 'regulated-racing-record' }],
      eventRequirements: [{ type: 'approval.requested', requiredReferences: ['tenantId', 'workflowInstanceId', 'auditId'], producer: 'workflow-orchestration-engine' }],
      digitalTwinSyncPoints: [{ stepId: 'sync-gate-twin', refs: ['twin:main-track:gate-1'], syncMode: 'read-write', requiredBeforeApproval: false }],
      sla: { startWithinMinutes: 5, completeWithinMinutes: 30, escalationRole: 'operations-director', deadlineField: 'dueAt', breachEvent: 'sla.breached' },
      certificationEvidence: [{ id: 'tmwf.gate-move.v1:approval-policy', kind: 'approval-policy', label: 'Approval policy', required: true }],
      apiFacadePath: '/api/v1/workflows/templates',
    }],
    mock: false,
  };
  assert.deepEqual(validateContract('WorkflowTemplateRegistryDto', registry, apiContractSchemas.WorkflowTemplateRegistryDto), { valid: true, errors: [] });
  assert.ok(registry.templates.every((template) => template.approvalPoints.length && template.auditRequirements.length && template.eventRequirements.length && template.digitalTwinSyncPoints.length && template.requiredRoles.length));
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/workflows/templates' && endpoint.response === 'WorkflowTemplateRegistryDto'));
});
