import assert from 'node:assert/strict';
import test from 'node:test';
import { apiContractSchemas, apiEndpointContracts, nexusWorkspaceIds, validateContract, validateKPIArtifact, validateModelReadableKPIContext } from '@trackmind/shared';
import { handleApiRequest, createApiFacadeState, createTrackMindApiServer } from '../dist/index.js';

test('runtime API facade serves dashboard live-client endpoints', async () => {
  const state = createApiFacadeState();
  const routes = [
    '/api/v1/approvals/requests',
    '/api/v1/workflows/templates',
    '/api/v1/audit/events',
    '/api/v1/track-configuration/map',
    '/api/v1/track-surface/measurements',
    '/api/v1/operations/command-center',
    '/api/v1/races',
    '/api/v1/race-day-readiness/dashboard',
    '/api/v1/starting-gate/position',
    '/api/v1/race-distance/configuration',
    '/api/v1/digital-twin/state',
    '/api/v1/assets/standard',
    '/api/v1/digital-twin/standard',
    '/api/v1/tus/standardization',
    '/api/v1/tus/data-model',
    '/api/v1/race-operations/race-office',
    '/api/v1/surface-intelligence/workspace',
    '/api/v1/equine-intelligence/horses/horse-1',
    '/api/v1/barn-operations/workspace',
    '/api/v1/facilities-maintenance/workspace',
    '/api/v1/stewarding/inquiries',
    '/api/v1/security-operations/workspace',
    '/api/v1/emergency-operations/workspace',
    '/api/v1/compliance/control-library',
    '/api/v1/kpis',
    '/api/v1/kpis/model-context',
    '/api/v1/ai/recommendations',
    '/api/v1/ai-governance/workspace',
    '/api/v1/ai-control-plane/workspace',
    '/api/v1/ai-control-plane/policy',
    '/api/v1/ai-control-plane/models',
    '/api/v1/ai-control-plane/features',
    '/api/v1/ai-control-plane/recommendations',
    '/api/v1/ai-control-plane/blocked-actions',
    '/api/v1/ai-control-plane/events',
    '/api/v1/events/catalog',
    '/api/v1/platform/health',
    '/api/v1/platform/nexus-upgrade',
    '/api/v1/artifacts/registry',
    '/api/v1/artifacts/schemas',
    '/api/v1/artifacts/training-inputs',
    '/api/v1/artifacts/storage-map',
    '/api/v1/ros/universal-schema',
    '/api/v1/ros/standardization-framework',
    '/api/v1/ros/saas-tiers',
    '/api/v1/ros/certified-track',
    '/api/v1/ros/data-model',
    '/api/v1/ros/intelligence-core',
    '/api/v1/ros/federation',
  ];

  for (const route of routes) {
    const response = await handleApiRequest('GET', route, undefined, state);
    assert.equal(response.status, 200, route);
  }
});

test('runtime API facade implements declared shared route contracts for races and AI recommendations', async () => {
  const state = createApiFacadeState();
  const expectedRoutes = ['/api/v1/races', '/api/v1/ai/recommendations', '/api/v1/ai-control-plane/features'];

  for (const path of expectedRoutes) {
    assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === path), `${path} missing from shared contract manifest`);
    const response = await handleApiRequest('GET', path, undefined, state);
    assert.equal(response.status, 200, path);
    assert.ok(Array.isArray(response.body), `${path} should return an array`);
    assert.ok(response.body.length > 0, `${path} should expose seeded backend data`);
  }

  const races = await handleApiRequest('GET', '/api/v1/races', undefined, state);
  assert.deepEqual(validateContract('RaceDto', races.body[0], apiContractSchemas.RaceDto), { valid: true, errors: [] });

  const recommendations = await handleApiRequest('GET', '/api/v1/ai/recommendations', undefined, state);
  assert.deepEqual(validateContract('AIRecommendationDto', recommendations.body[0], apiContractSchemas.AIRecommendationDto), { valid: true, errors: [] });

  const features = await handleApiRequest('GET', '/api/v1/ai-control-plane/features', undefined, state);
  assert.deepEqual(validateContract('FeatureRecordDto', features.body[0], apiContractSchemas.FeatureRecordDto), { valid: true, errors: [] });
});

test('runtime KPI facade exposes governed artifacts, snapshots, filtering, and model context', async () => {
  const state = createApiFacadeState();
  const adminHeaders = { 'x-trackmind-role': 'admin' };
  const auditorHeaders = { 'x-trackmind-role': 'read-only-auditor' };

  for (const path of ['/api/v1/kpis', '/api/v1/kpis/model-context', '/api/v1/kpis/kpi-race-day-operations', '/api/v1/kpis/kpi-race-day-operations/snapshots']) {
    const response = await handleApiRequest('GET', path, undefined, state, adminHeaders);
    assert.equal(response.status, 200, path);
  }

  for (const path of ['/api/v1/kpis', '/api/v1/kpis/{kpiId}', '/api/v1/kpis/{kpiId}/snapshots', '/api/v1/kpis/model-context']) {
    assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === path), `${path} missing from shared contract manifest`);
  }
  assert.ok(!apiEndpointContracts.some((endpoint) => endpoint.path.startsWith('/api/v1/artifacts/kpis')));

  const workspace = await handleApiRequest('GET', '/api/v1/kpis?tenantId=trackmind&racetrackId=main-track', undefined, state, adminHeaders);
  assert.equal(workspace.body.kpis.length, 20);
  assert.equal(workspace.body.governance.aiMutationAllowed, false);
  assert.equal(workspace.body.governance.regulatedExecutionAllowed, false);
  assert.deepEqual(validateContract('KPIWorkspaceDto', workspace.body, apiContractSchemas.KPIWorkspaceDto), { valid: true, errors: [] });
  assert.ok(workspace.body.kpis.every((kpi) => validateKPIArtifact(kpi).valid));
  assert.ok(workspace.body.kpis.some((kpi) => kpi.domain === 'multi-track-federation' && kpi.visibility === 'federation-aggregate'));
  assert.equal(workspace.body.kpis.find((kpi) => kpi.domain === 'safety-incidents')?.threshold.targetDirection, 'below');
  assert.deepEqual(workspace.body.kpis.find((kpi) => kpi.domain === 'equine-welfare')?.sourceEvents, ['equine.profile.viewed', 'equine.veterinary.recorded']);
  assert.deepEqual(workspace.body.kpis.find((kpi) => kpi.domain === 'veterinary-privacy')?.sourceEvents, ['equine.profile.viewed', 'equine.hisa.verification']);

  const queryRoleOnly = await handleApiRequest('GET', '/api/v1/kpis?role=admin&tenantId=trackmind&racetrackId=main-track', undefined, state);
  assert.ok(queryRoleOnly.body.kpis.length < workspace.body.kpis.length);

  const mismatch = await handleApiRequest('GET', '/api/v1/kpis?tenantId=trackmind&racetrackId=main-track', undefined, state, { ...adminHeaders, 'x-trackmind-tenant-id': 'different-tenant' });
  assert.equal(mismatch.status, 403);
  const organizationMismatch = await handleApiRequest('GET', '/api/v1/kpis?organizationId=org-trackmind-network', undefined, state, { ...adminHeaders, 'x-trackmind-organization-id': 'different-org' });
  assert.equal(organizationMismatch.status, 403);
  const organizationFilter = await handleApiRequest('GET', '/api/v1/kpis?organizationId=unknown-org', undefined, state, adminHeaders);
  assert.equal(organizationFilter.body.kpis.length, 0);

  const auditor = await handleApiRequest('GET', '/api/v1/kpis?tenantId=trackmind&racetrackId=main-track', undefined, state, auditorHeaders);
  assert.ok(auditor.body.kpis.length < workspace.body.kpis.length);
  assert.ok(auditor.body.kpis.every((kpi) => kpi.visibility !== 'veterinary-restricted'));

  const context = await handleApiRequest('GET', '/api/v1/kpis/model-context', undefined, state, adminHeaders);
  assert.ok(context.body.length > 0);
  assert.ok(context.body.every((entry) => validateModelReadableKPIContext(entry).valid));
  assert.ok(context.body.every((entry) => entry.prohibitedUse.includes('modify KPI values')));
  assert.ok(context.body.every((entry) => entry.prohibitedUse.includes('execute regulated actions')));
  assert.ok(context.body.every((entry) => entry.prohibitedUse.includes('expose raw cross-track records')));

  for (const path of ['/api/v1/kpis/execute', '/api/v1/artifacts/kpis', '/api/v1/artifacts/kpis/kpi-race-day-operations']) {
    const response = await handleApiRequest('POST', path, { action: 'race-start' }, state);
    assert.equal(response.status, 404, path);
  }
});

test('runtime equine and barn facades keep horse occupancy, relationship map, and vet-review gates aligned', async () => {
  const state = createApiFacadeState();
  const equine = await handleApiRequest('GET', '/api/v1/equine-intelligence/horses/horse-1', undefined, state);
  const barn = await handleApiRequest('GET', '/api/v1/barn-operations/workspace', undefined, state);

  assert.equal(equine.status, 200);
  assert.equal(barn.status, 200);
  assert.ok(apiEndpointContracts.some((endpoint) => endpoint.path === '/api/v1/equine-intelligence/horses/{horseId}' && endpoint.operationId === 'getEquineIntelligenceHorse'));
  assert.equal(equine.body.barnAssignment.barnId, 'barn-2');
  assert.equal(equine.body.barnAssignment.stallId, 'stall-12A');
  assert.ok(barn.body.occupancy.some((occupancy) => occupancy.horseId === equine.body.horse.horseId && occupancy.stallId === equine.body.barnAssignment.stallId));

  const relationshipTypes = equine.body.relationships.map((relationship) => relationship.type);
  for (const expected of ['owned-by', 'trained-by', 'entered-in-race', 'worked-at-track', 'transported-by', 'assigned-to-barn', 'mirrored-by-digital-twin']) {
    assert.ok(relationshipTypes.includes(expected), `missing ${expected}`);
  }

  assert.equal(equine.body.aiRiskRecommendations[0].advisoryOnly, true);
  assert.equal(equine.body.aiRiskRecommendations[0].veterinarianReviewRequired, true);
  assert.equal(equine.body.approvals[0].requiredRole, 'veterinarian');
  assert.equal(equine.body.integrations.barn, true);
  assert.equal(equine.body.integrations.digitalTwin, true);
  assert.ok(barn.body.twinSync.some((sync) => sync.twinId === 'equine:horse-1'));

  const missing = await handleApiRequest('GET', '/api/v1/equine-intelligence/horses/horse-unknown', undefined, state);
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'not_found');
});

test('runtime operations command center exposes stabilized widget sources', async () => {
  const response = await handleApiRequest('GET', '/api/v1/operations/command-center');
  assert.equal(response.status, 200);
  const titles = response.body.widgets.map((widget) => widget.title);
  for (const required of ['Race readiness','Surface conditions','Weather status','Active incidents','Pending approvals','Steward inquiries','Asset health','Workforce readiness','Emergency resources','Facility readiness','AI recommendations','Audit activity','Event telemetry snapshot']) {
    assert.ok(titles.includes(required), `missing ${required}`);
  }
  assert.ok(response.body.widgets.every((widget) => ['service','event-stream','digital-twin'].includes(widget.source)));
  assert.ok(response.body.widgets.every((widget) => widget.drillDownPath.startsWith('/')));
  assert.equal(response.body.widgets.find((widget) => widget.id === 'weather-status').source, 'service');
  assert.match(response.body.widgets.find((widget) => widget.id === 'weather-status').detail, /no separate live weather service is claimed/i);
  assert.equal(response.body.widgets.find((widget) => widget.id === 'emergency-resources').source, 'service');
  assert.equal(response.body.widgets.find((widget) => widget.id === 'race-readiness').drillDownPath, '/race-day');
  assert.equal(response.body.widgets.find((widget) => widget.id === 'surface-conditions').drillDownPath, '/race-day');
  assert.equal(response.body.widgets.find((widget) => widget.id === 'emergency-resources').drillDownPath, '/incidents');
  assert.equal(response.body.widgets.find((widget) => widget.id === 'event-timeline').drillDownPath, '/dashboard');
  assert.ok(response.body.dataLineage.some((lineage) => lineage.domain === 'events' && lineage.reference === '/api/v1/events/stream'));
});

test('runtime API workspaces reject placeholder facades on service-backed routes', async () => {
  const state = createApiFacadeState();
  const repairedRoutes = [
    '/api/v1/facilities-maintenance/workspace',
    '/api/v1/emergency-operations/workspace',
    '/api/v1/race-operations/race-office',
    '/api/v1/race-day-readiness/dashboard',
    '/api/v1/operations/command-center',
  ];

  for (const route of repairedRoutes) {
    const response = await handleApiRequest('GET', route, undefined, state);
    assert.equal(response.status, 200, route);
    assert.doesNotMatch(JSON.stringify(response.body), /"placeholder"\s*:\s*true|declarationsPlaceholder|horse-live-placeholder|approved-mock-adapter/, route);
    if ('mock' in response.body) assert.equal(response.body.mock, false, route);
  }

  const facilities = await handleApiRequest('GET', '/api/v1/facilities-maintenance/workspace', undefined, state);
  assert.ok(facilities.body.assets.some((asset) => asset.sourceOfTruth === 'racetrack-asset-registry'));
  assert.ok(facilities.body.inspections.length > 0);
  assert.ok(facilities.body.workOrders.length > 0);
  assert.ok(facilities.body.approvals.length > 0);
  assert.ok(facilities.body.twins.length > 0);

  const emergency = await handleApiRequest('GET', '/api/v1/emergency-operations/workspace', undefined, state);
  assert.equal(emergency.body.emergencyActions.aiMayBlock, false);
  assert.ok(emergency.body.workflowIntegrations.length > 0);
  assert.ok(emergency.body.checklist.length > 0);
  assert.ok(emergency.body.resources.length > 0);
  assert.ok(emergency.body.events.some((event) => event.type === 'emergency.workflow.activated'));

  const raceOffice = await handleApiRequest('GET', '/api/v1/race-operations/race-office', undefined, state);
  assert.ok(raceOffice.body.cards[0].entries.every((entry) => entry.declared && !entry.placeholder));
  assert.ok(raceOffice.body.cards[0].entries.every((entry) => entry.horseId !== 'horse-live-placeholder'));
  assert.equal(raceOffice.body.readiness[0].activeEntries, 2);

  const readiness = await handleApiRequest('GET', '/api/v1/race-day-readiness/dashboard', undefined, state);
  assert.ok(readiness.body.latestAssessment.checks.length >= 9);
  assert.ok(readiness.body.auditRecords.length > 0);
  assert.ok(readiness.body.events.some((event) => event.type === 'readiness.evaluated'));
});

test('runtime API facade exposes Tier 4 canonical workflow templates', async () => {
  const response = await handleApiRequest('GET', '/api/v1/workflows/templates');
  assert.equal(response.status, 200);
  assert.equal(response.body.certificationTier, 'Tier 4');
  assert.equal(response.body.templates.length, 7);
  assert.ok(response.body.templates.some((template) => template.canonicalId === 'tmwf.gate-move.v1'));
  assert.ok(response.body.templates.every((template) => template.approvalPoints.length && template.auditRequirements.length && template.eventRequirements.length && template.digitalTwinSyncPoints.length && template.requiredRoles.length));
});

test('runtime track configuration facade exposes approval-blocked gate work orders and evidence path', async () => {
  const response = await handleApiRequest('GET', '/api/v1/track-configuration/map');
  assert.equal(response.status, 200);
  assert.equal(response.body.trackConfiguration.noLiveActuatorControl, true);
  assert.equal(response.body.trackConfiguration.verificationWorkflow.actuatorControlAvailable, false);
  assert.ok(response.body.trackConfiguration.workOrders.some((order) => order.crew === 'gate-crew' && order.status === 'approval-blocked'));
  assert.ok(response.body.trackConfiguration.workOrders.some((order) => order.evidenceRequired.includes('gps-fix')));
  assert.ok(response.body.trackConfiguration.events.includes('track.configuration.change.requested'));
  assert.ok(response.body.trackConfiguration.auditIds.length > 0);
});

test('runtime steward facade exposes connected inquiry queues without ruling authority', async () => {
  const response = await handleApiRequest('GET', '/api/v1/stewarding/inquiries');
  assert.equal(response.status, 200);
  assert.equal(response.body.permissions.canFinalize, false);
  const inquiry = response.body.inquiries[0];
  assert.equal(inquiry.aiGuardrails.advisoryOnly, true);
  assert.equal(inquiry.aiGuardrails.mayIssueOfficialRuling, false);
  assert.equal(inquiry.aiGuardrails.mayModifyOfficialResults, false);
  assert.ok(inquiry.objections.length > 0);
  assert.ok(inquiry.involvedHorses.every((horse) => horse.officialResultLocked));
  assert.ok(inquiry.investigations.some((investigation) => investigation.workflowInstanceId && investigation.approvalRequestId));
  assert.ok(inquiry.evidenceReferences.some((evidence) => evidence.aiGenerated === true && evidence.tags.includes('advisory-only')));
  assert.ok(inquiry.evidenceReferences.every((evidence) => evidence.auditRecordId && evidence.custody.legalHold));
  assert.ok(inquiry.ruleReferences.every((rule) => rule.auditRecordId));
  assert.ok(inquiry.integrations.approvalRequestIds.includes('approval-steward-decision-r7'));
  assert.ok(inquiry.integrations.evidenceVaultRecordIds.includes('ev-headon'));
  assert.ok(inquiry.integrations.eventTypes.includes('steward.approval.requested'));
  assert.ok(inquiry.appealPackages[0].contents.guardrailStatement.includes('AI may summarize and organize evidence only'));
  assert.equal(inquiry.finalRuling, undefined);
});

test('runtime API facade serves auxiliary adapter endpoints and consistent fallback errors', async () => {
  const state = createApiFacadeState();
  const assets = await handleApiRequest('GET', '/api/v1/assets', undefined, state);
  assert.equal(assets.status, 200);
  assert.ok(Array.isArray(assets.body));
  assert.ok(assets.body.length > 0);

  const sectors = await handleApiRequest('GET', '/api/v1/track-sectors', undefined, state);
  assert.equal(sectors.status, 200);
  assert.ok(Array.isArray(sectors.body));
  assert.ok(sectors.body.every((sector) => sector.id && sector.name));

  const measurements = await handleApiRequest('GET', '/api/v1/track-surface/measurements', undefined, state);
  assert.equal(measurements.status, 200);
  assert.ok(Array.isArray(measurements.body));
  assert.ok(measurements.body.every((measurement) => measurement.sectorId && measurement.measuredAt));

  const preflight = await handleApiRequest('OPTIONS', '/api/v1/approvals/controlled-actions', undefined, state);
  assert.equal(preflight.status, 204);

  const missing = await handleApiRequest('GET', '/api/v1/not-implemented-yet', undefined, state);
  assert.equal(missing.status, 404);
  assert.equal(missing.body.ok, false);
  assert.equal(missing.body.error.code, 'not_found');
});

test('runtime API facade enforces shared endpoint permissions when role headers are present', async () => {
  const state = createApiFacadeState();
  const missingRole = await handleApiRequest('GET', '/api/v1/audit/compliance-export', undefined, state, {});
  assert.equal(missingRole.status, 401);
  assert.equal(missingRole.body.error.code, 'unauthorized');

  const disallowedRole = await handleApiRequest('GET', '/api/v1/audit/compliance-export', undefined, state, { 'x-trackmind-role': 'steward' });
  assert.equal(disallowedRole.status, 403);
  assert.match(disallowedRole.body.error.message, /not allowed|lacks permission/i);

  const allowedRole = await handleApiRequest('GET', '/api/v1/audit/compliance-export', undefined, state, { 'x-trackmind-role': 'read-only-auditor' });
  assert.equal(allowedRole.status, 200);
  assert.ok(allowedRole.body.records);
});

test('runtime protected action POST boundaries require context, human actors, and RBAC', async () => {
  const state = createApiFacadeState();
  const validContext = {
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    action: 'race-start',
    target: 'race-7',
    reason: 'Request race start approval after readiness review.',
    actor: 'racing-secretary-1',
    actorType: 'human',
    roles: ['racing-secretary'],
    evidence: ['readiness-check', 'human-approval-record'],
  };

  const missingContext = await handleApiRequest('POST', '/api/v1/approvals/controlled-actions', { action: 'race-start', target: 'race-7', reason: 'missing context', actor: 'starter-1', roles: ['racing-secretary'], evidence: ['readiness-check'] }, state);
  assert.equal(missingContext.status, 400);
  assert.match(missingContext.body.error.message, /tenantId, racetrackId/);

  const aiControlledAction = await handleApiRequest('POST', '/api/v1/approvals/controlled-actions', { ...validContext, actor: 'ai-surface-agent', actorType: 'ai-agent' }, state);
  assert.equal(aiControlledAction.status, 403);
  assert.match(aiControlledAction.body.error.message, /human actor/i);

  const unauthorizedRole = await handleApiRequest('POST', '/api/v1/approvals/controlled-actions', { ...validContext, actor: 'auditor-1', roles: ['read-only-auditor'] }, state);
  assert.equal(unauthorizedRole.status, 403);
  assert.match(unauthorizedRole.body.error.message, /required role permission/i);

  const validHumanRequest = await handleApiRequest('POST', '/api/v1/approvals/controlled-actions', validContext, state);
  assert.equal(validHumanRequest.status, 202);
  assert.equal(validHumanRequest.body.action, 'race-start');
  assert.equal(validHumanRequest.body.tenantId, 'trackmind');
  assert.equal(validHumanRequest.body.racetrackId, 'main-track');

  const aiDraft = await handleApiRequest('POST', '/api/v1/track-configuration/draft-requests', { ...validContext, action: 'starting-gate-move', target: 'gate-1', actor: 'ai-gate-planner', actorType: 'ai-agent', roles: ['track-superintendent'], evidence: ['gps-fix', 'draft-only:no-live-actuator-control'] }, state);
  assert.equal(aiDraft.status, 202);
  assert.equal(aiDraft.body.eventType, 'track.configuration.change.requested');

  const serviceAssetChange = await handleApiRequest('POST', '/api/v1/assets/safety-critical-changes', { ...validContext, action: 'safety-critical-control', target: 'GATE_MAIN_01', actor: 'service-asset-sync', actorType: 'service', roles: ['admin'] }, state);
  assert.equal(serviceAssetChange.status, 403);
  assert.match(serviceAssetChange.body.error.message, /human actor/i);
});

test('runtime API facade serves Racing Data API Hub core GET routes', async () => {
  const state = createApiFacadeState();
  const routes = [
    '/api/v1/racing-data/providers',
    '/api/v1/racing-data/providers/provider-official-feed/status',
    '/api/v1/racing-data/ingestion-jobs/job-racing-hub-seed-1',
    '/api/v1/racing-data/raw-payloads/raw-official-feed-race-7',
    '/api/v1/racing-data/canonical/race-cards',
    '/api/v1/racing-data/canonical/races/race-7',
    '/api/v1/racing-data/canonical/horses/horse-1',
    '/api/v1/racing-data/canonical/entries',
    '/api/v1/racing-data/canonical/results',
    '/api/v1/racing-data/data-quality/reports',
    '/api/v1/racing-data/lineage/canonical-race-card-race-7',
  ];

  for (const route of routes) {
    const response = await handleApiRequest('GET', route, undefined, state);
    assert.equal(response.status, 200, route);
  }

  const providers = await handleApiRequest('GET', '/api/v1/racing-data/providers', undefined, state);
  assert.ok(providers.body.some((provider) => provider.providerId === 'provider-official-feed' && provider.license.licenseStatus === 'active'));
  assert.ok(providers.body.every((provider) => provider.tags.includes('no-scraping')));

  const quality = await handleApiRequest('GET', '/api/v1/racing-data/data-quality/reports', undefined, state);
  assert.equal(quality.body[0].externalCallsPerformed, false);
  assert.equal(quality.body[0].scrapingPerformed, false);
  assert.ok(quality.body[0].checks.some((check) => check.checkId === 'no-scraping' && check.passed));
});

test('runtime API facade serves dashboard Racing Data canonical read models', async () => {
  const state = createApiFacadeState();
  const routes = [
    '/api/v1/racing-data',
    '/api/v1/racing-data/providers/statuses',
    '/api/v1/racing-data/providers/provider-official-feed',
    '/api/v1/racing-data/connectors',
    '/api/v1/racing-data/normalization-mappings',
    '/api/v1/racing-data/ingestion-jobs',
    '/api/v1/racing-data/ingestion-jobs/job-racing-hub-seed-1',
    '/api/v1/racing-data/raw-payloads/review',
    '/api/v1/racing-data/raw-payloads/review/raw-official-feed-race-7',
    '/api/v1/racing-data/canonical/races',
    '/api/v1/racing-data/canonical/horses',
    '/api/v1/racing-data/entity-resolution',
    '/api/v1/racing-data/data-quality/reports',
    '/api/v1/racing-data/lineage',
    '/api/v1/racing-data/digital-twin/sync-descriptor',
  ];

  for (const route of routes) {
    const response = await handleApiRequest('GET', route, undefined, state);
    assert.equal(response.status, 200, route);
  }

  const hub = await handleApiRequest('GET', '/api/v1/racing-data', undefined, state);
  assert.equal(hub.body.metadata.serviceId, 'racing-data-api-hub');
  assert.ok(Array.isArray(hub.body.rawPayloadReviews));
  assert.equal(hub.body.digitalTwinSync.directMutationAllowed, false);

  const drafts = [
    ['/api/v1/racing-data/ingestion-jobs/draft-requests', 'racing-data.ingestion-job.draft.created'],
    ['/api/v1/racing-data/exports/feature-store', 'racing-data.export.feature-store.draft.created'],
    ['/api/v1/racing-data/exports/data-lake', 'racing-data.export.data-lake.draft.created'],
  ];
  for (const [route, eventType] of drafts) {
    const response = await handleApiRequest('POST', route, { providerId: 'provider-official-feed' }, state);
    assert.equal(response.status, 202, route);
    assert.equal(response.body.approvalRequired, true);
    assert.equal(response.body.executionAllowed, false);
    assert.equal(response.body.eventType, eventType);
  }
});

test('runtime Racing Data API Hub POST routes are draft-only and governed', async () => {
  const state = createApiFacadeState();
  const draftRoutes = [
    ['POST', '/api/v1/racing-data/providers', { providerId: 'provider-new-draft' }],
    ['POST', '/api/v1/racing-data/ingestion-jobs/draft-requests', { providerId: 'provider-official-feed', requestedBy: 'racing-secretary' }],
    ['POST', '/api/v1/racing-data/entity-resolution/review', { providerId: 'provider-official-feed', entityId: 'horse-1' }],
    ['POST', '/api/v1/racing-data/exports/feature-store', { providerId: 'provider-official-feed', featureSetId: 'race-card-features' }],
    ['POST', '/api/v1/racing-data/exports/data-lake', { providerId: 'provider-official-feed', zone: 'silver-conformed' }],
    ['POST', '/api/v1/racing-data/sync/digital-twins', { providerId: 'provider-official-feed', twinIds: ['twin:race:race-7'] }],
  ];

  for (const [method, route, body] of draftRoutes) {
    const response = await handleApiRequest(method, route, body, state);
    assert.equal(response.status, 202, route);
    assert.equal(response.body.accepted, true);
    assert.equal(response.body.approvalRequired, true);
    assert.equal(response.body.executionAllowed, false);
    assert.equal(response.body.externalCallsPerformed, false);
    assert.equal(response.body.scrapingPerformed, false);
    assert.equal(response.body.governance.draftOnly, true);
    assert.match(response.body.message, /No scraping, external provider call/i);
  }
});

test('runtime Racing Data API Hub enforces license restrictions before drafts', async () => {
  const state = createApiFacadeState();
  const restrictedProvider = state.racingData.providers.find((provider) => provider.providerId === 'provider-restricted-odds');

  const ingest = await handleApiRequest('POST', '/api/v1/racing-data/ingestion-jobs/draft-requests', { providerId: 'provider-restricted-odds', requestedBy: 'compliance-officer' }, state);
  assert.equal(ingest.status, 403);
  assert.equal(ingest.body.error.code, 'license_not_permitted');
  assert.equal(ingest.body.externalCallsPerformed, false);
  assert.equal(ingest.body.scrapingPerformed, false);
  assert.match(ingest.body.error.details.join(' '), /restricted/);

  const featureStore = await handleApiRequest('POST', '/api/v1/racing-data/exports/feature-store', { providerId: 'provider-restricted-odds' }, state);
  assert.equal(featureStore.status, 403);
  assert.equal(featureStore.body.error.code, 'license_not_permitted');
  assert.ok(featureStore.body.error.details.some((detail) => detail.includes('ai-training')));

  const providerRegistration = await handleApiRequest('POST', '/api/v1/racing-data/providers', { providerId: 'provider-denied', license: restrictedProvider.license }, state);
  assert.equal(providerRegistration.status, 403);
  assert.equal(providerRegistration.body.error.code, 'license_not_permitted');
  assert.equal(providerRegistration.body.externalCallsPerformed, false);
});

test('runtime Racing Data API Hub uses shared API constants and performs no external calls', async () => {
  const racingDataContracts = apiEndpointContracts.filter((endpoint) => endpoint.path.startsWith('/api/v1/racing-data/'));
  assert.equal(racingDataContracts.length, 18);
  assert.ok(racingDataContracts.some((endpoint) => endpoint.operationId === 'createRacingDataIngestDraft' && endpoint.description.includes('no external pull')));
  assert.ok(racingDataContracts.filter((endpoint) => endpoint.method === 'POST').every((endpoint) => /draft/i.test(endpoint.description)));

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('Racing Data API Hub facade must not fetch external providers during tests');
  };

  try {
    const state = createApiFacadeState();
    const responses = await Promise.all([
      handleApiRequest('GET', '/api/v1/racing-data/providers', undefined, state),
      handleApiRequest('GET', '/api/v1/racing-data/canonical/race-cards', undefined, state),
      handleApiRequest('POST', '/api/v1/racing-data/ingestion-jobs/draft-requests', { providerId: 'provider-official-feed' }, state),
      handleApiRequest('POST', '/api/v1/racing-data/exports/data-lake', { providerId: 'provider-official-feed' }, state),
    ]);
    assert.ok(responses.every((response) => [200, 202].includes(response.status)));
    assert.equal(fetchCalls, 0);
    assert.ok(responses.every((response) => !JSON.stringify(response.body).includes('"externalCallsPerformed":true')));
    assert.ok(responses.every((response) => !JSON.stringify(response.body).includes('"scrapingPerformed":true')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime API facade exposes coordinated Nexus upgrade package', async () => {
  const response = await handleApiRequest('GET', '/api/v1/platform/nexus-upgrade');
  assert.equal(response.status, 200);
  assert.equal(response.body.platform, 'TrackMind Nexus');
  assert.equal(response.body.workspaces.length, nexusWorkspaceIds.length);
  assert.ok(response.body.workspaces.some((workspace) => workspace.id === 'track-configuration'));
  assert.ok(response.body.workspaces.some((workspace) => workspace.id === 'platform-health'));
  assert.ok(response.body.aiControlPlane.flow.includes('ai-governor'));
  assert.ok(response.body.aiControlPlane.observabilityMetrics.includes('ai_input_throughput'));
  assert.ok(response.body.complianceFrameworks.includes('ISO-25010'));
  assert.ok(response.body.safetyControls.every((control) => control.autonomousExecutionAllowed === false));
});

test('runtime API facade exposes read-only ROS metadata slices', async () => {
  const schema = await handleApiRequest('GET', '/api/v1/ros/universal-schema');
  assert.equal(schema.status, 200);
  assert.equal(schema.body.readOnly, true);
  assert.equal(schema.body.executionEndpointsAvailable, false);
  assert.equal(schema.body.standard, 'TrackMind Universal Schema');
  assert.ok(schema.body.entityKinds.includes('racetrack'));
  assert.ok(schema.body.safetyControls.every((control) => control.autonomousExecutionAllowed === false));

  const framework = await handleApiRequest('GET', '/api/v1/ros/standardization-framework');
  assert.equal(framework.status, 200);
  assert.equal(framework.body.eventStandards.auditRequired, true);
  assert.ok(framework.body.complianceMappings.some((mapping) => mapping.framework === 'ISO-42001'));

  const tiers = await handleApiRequest('GET', '/api/v1/ros/saas-tiers');
  assert.equal(tiers.status, 200);
  assert.ok(tiers.body.tiers.some((tier) => tier.id === 'federated' && tier.federationEnabled));
  assert.ok(tiers.body.tiers.every((tier) => tier.executionEndpointsAvailable === false));

  const certifiedTrack = await handleApiRequest('GET', '/api/v1/ros/certified-track');
  assert.equal(certifiedTrack.status, 200);
  assert.equal(certifiedTrack.body.candidate.certificationLabel, 'TrackMind Certified Track');
  assert.equal(certifiedTrack.body.candidate.externalCertificationClaimed, false);
  assert.ok(certifiedTrack.body.scorecard.overallScore >= 0);

  const dataModel = await handleApiRequest('GET', '/api/v1/ros/data-model');
  assert.equal(dataModel.status, 200);
  assert.ok(dataModel.body.stores.some((store) => store.id === 'tus-assets'));
  assert.ok(dataModel.body.apiContracts.includes('/api/v1/operations/command-center'));

  const intelligenceCore = await handleApiRequest('GET', '/api/v1/ros/intelligence-core');
  assert.equal(intelligenceCore.status, 200);
  assert.equal(intelligenceCore.body.protectedControlExecutionAllowed, false);
  assert.equal(intelligenceCore.body.governor.executionEndpointsAvailable, false);

  const federation = await handleApiRequest('GET', '/api/v1/ros/federation');
  assert.equal(federation.status, 200);
  assert.equal(federation.body.tenantIsolation, true);
  assert.equal(federation.body.unsafeExecutionAcrossBoundaryAllowed, false);
});

test('runtime API facade exposes no ROS protected execution routes', async () => {
  for (const route of ['/api/v1/ros/execute', '/api/v1/ros/start-race', '/api/v1/ros/certified-track/execute', '/api/v1/ros/federation/execute']) {
    const response = await handleApiRequest('POST', route, { action: 'race-start' });
    assert.equal(response.status, 404, route);
    assert.equal(response.body.error.code, 'not_found');
  }
});

test('runtime API facade exposes Universal Artifact Framework read-only contracts', async () => {
  const registry = await handleApiRequest('GET', '/api/v1/artifacts/registry');
  assert.equal(registry.status, 200);
  assert.equal(registry.body.readOnly, true);
  assert.equal(registry.body.executionEndpointsAvailable, false);
  assert.equal(registry.body.governance.draftRegistrationOnly, true);
  assert.equal(registry.body.governance.autonomousExecutionAllowed, false);
  assert.equal(registry.body.governance.operationalMutationAllowed, false);
  for (const kind of ['Asset','Event','DigitalTwin','Telemetry','Workflow','Approval','Audit','Compliance','Recommendation','Investigation','Feature','Insight','Forecast']) {
    assert.ok(registry.body.artifactKinds.includes(kind), kind);
    assert.ok(registry.body.artifacts.some((artifact) => artifact.kind === kind), kind);
  }
  assert.ok(registry.body.artifacts.every((artifact) => artifact.readOnly === true && artifact.operationalMutationAllowed === false && artifact.autonomousExecutionAllowed === false));

  const schemas = await handleApiRequest('GET', '/api/v1/artifacts/schemas');
  assert.equal(schemas.status, 200);
  assert.equal(schemas.body.readOnly, true);
  assert.ok(schemas.body.schemas.every((schema) => schema.autonomousExecutionAllowed === false && schema.approvalRequiredFor.includes('operational-mutation')));

  const training = await handleApiRequest('GET', '/api/v1/artifacts/training-inputs');
  assert.equal(training.status, 200);
  assert.equal(training.body.policy.noAutonomousExecution, true);
  assert.equal(training.body.policy.draftOnlyRegistration, true);
  assert.ok(training.body.inputs.every((input) => input.humanReviewRequired && input.prohibitedUse.length > 0));

  const storage = await handleApiRequest('GET', '/api/v1/artifacts/storage-map');
  assert.equal(storage.status, 200);
  assert.equal(storage.body.executionEndpointsAvailable, false);
  assert.ok(storage.body.storage.every((store) => store.tenantScoped && store.auditRequired && store.operationalMutationAllowed === false));
});

test('runtime API facade accepts artifact registration drafts without operational mutation', async () => {
  const state = createApiFacadeState();
  const before = await handleApiRequest('GET', '/api/v1/artifacts/registry', undefined, state);
  const draft = await handleApiRequest('POST', '/api/v1/artifacts/registry/draft-registrations', { artifactId: 'artifact-draft-surface-review', kind: 'Investigation', requestedBy: 'compliance-officer' }, state);
  assert.equal(draft.status, 202);
  assert.equal(draft.body.accepted, true);
  assert.equal(draft.body.status, 'draft');
  assert.equal(draft.body.approvalRequired, true);
  assert.equal(draft.body.audited, true);
  assert.equal(draft.body.executionAllowed, false);
  assert.equal(draft.body.operationalMutationAllowed, false);
  assert.match(draft.body.message, /no artifact registry, operational state, or autonomous AI execution was mutated/i);

  const after = await handleApiRequest('GET', '/api/v1/artifacts/registry', undefined, state);
  assert.deepEqual(after.body, before.body);

  for (const route of ['/api/v1/artifacts/execute', '/api/v1/artifacts/registry/register', '/api/v1/artifacts/registry/publish', '/api/v1/artifacts/registry/draft-registrations/execute']) {
    const response = await handleApiRequest('POST', route, { artifactId: 'artifact-draft-surface-review' }, state);
    assert.equal(response.status, 404, route);
    assert.equal(response.body.error.code, 'not_found');
  }
});

test('runtime API facade exposes event catalog for frontend and observability consumers', async () => {
  const response = await handleApiRequest('GET', '/api/v1/events/catalog');
  assert.equal(response.status, 200);
  assert.equal(response.body.standards.tenantScoped, true);
  assert.ok(response.body.events.some((event) => event.type === 'asset.registry.changed.v1' && event.standards.auditRequired));
  assert.ok(response.body.integrations.includes('digital-twin-runtime'));
});

test('runtime API facade exposes seeded responsible AI governance workspace', async () => {
  const response = await handleApiRequest('GET', '/api/v1/ai-governance/workspace');
  assert.equal(response.status, 200);
  assert.equal(response.body.activeAgents[0].id, 'agent-surface-ops');
  assert.ok(response.body.modelVersions.some((model) => model.id === 'model-surface-advisor-v2'));
  assert.ok(response.body.promptTemplates.some((prompt) => prompt.id === 'prompt-surface-v4'));
  assert.ok(response.body.recommendationQueue.some((rec) => rec.confidenceScore && rec.explainability));
  assert.ok(response.body.recommendationQueue.every((rec) => rec.recommendationId === rec.id && rec.modelVersion && rec.generatedAt && rec.approvalRequirement?.required === true && rec.auditReference?.auditIds?.length > 0));
  assert.ok(response.body.safetyBlockedActions.some((blocked) => blocked.action === 'race-start'));
  assert.ok(response.body.safetyBlockedActions.every((blocked) => blocked.recommendationId === blocked.id && blocked.approvalRequirement?.required === true && blocked.auditReference?.eventIds?.length > 0));
  assert.ok(response.body.approvalRequirements.length > 0);
  assert.ok(response.body.safetyPolicies[0].allowedActivities.includes('prioritize'));
  assert.ok(response.body.digitalTwinImpacts.some((impact) => impact.approvalRequired));
  assert.ok(response.body.observabilitySignals.some((signal) => signal.metric === 'confidence'));
  assert.ok(response.body.auditTrails.some((audit) => audit.action === 'ai.recommendation.recorded'));
  assert.ok(response.body.events.some((event) => event.type === 'ai.approval.workflow.created'));
});

test('runtime API facade exposes unified AI control plane DTOs', async () => {
  const response = await handleApiRequest('GET', '/api/v1/ai-control-plane/workspace');
  assert.equal(response.status, 200);
  assert.equal(response.body.policy.executionEndpointsAvailable, false);
  assert.equal(response.body.policy.draftOnlyStateChanges, true);
  assert.ok(response.body.inputsSummary.evidenceRefs.includes('surface:moisture=19'));
  assert.ok(response.body.featureStoreSummary.datasets.includes('dataset:surface-readings-v5'));
  assert.ok(response.body.modelRegistry.models.some((model) => model.id === 'model-surface-risk-v1'));
  assert.ok(response.body.expertModules.some((module) => module.id === 'agent-surface-ops'));
  assert.ok(response.body.policy.governanceMapping.some((mapping) => mapping.framework === 'ISO-42001'));
  assert.ok(response.body.policy.governanceMapping.some((mapping) => mapping.framework === 'NIST-AI-RMF'));
  assert.ok(response.body.auditEventTwinReferences.auditIds.length > 0);
  assert.ok(response.body.auditEventTwinReferences.eventIds.length > 0);
  assert.ok(response.body.auditEventTwinReferences.digitalTwinRefs.length > 0);
});

test('runtime API facade exposes protected recommendations as approval-required drafts', async () => {
  const recommendations = await handleApiRequest('GET', '/api/v1/ai-control-plane/recommendations');
  assert.equal(recommendations.status, 200);
  assert.ok(recommendations.body.length > 0);
  assert.ok(recommendations.body.every((rec) => rec.governorDecision.allowed === false));
  assert.ok(recommendations.body.every((rec) => rec.governorDecision.approvalRequired === true));
  assert.ok(recommendations.body.every((rec) => rec.approvalWorkflow?.draftOnly === true));
  assert.ok(recommendations.body.every((rec) => rec.confidence.raw >= 0 && rec.confidence.calibrated <= 1));
  assert.ok(recommendations.body.every((rec) => rec.evidence.length > 0 && rec.affectedAssets.length > 0));
  assert.ok(recommendations.body.every((rec) => rec.recommendationId === rec.id && rec.modelVersion === rec.modelVersionId && rec.generatedAt && rec.approvalRequirement.required === true && rec.auditReference.auditIds.length > 0));

  const blocked = await handleApiRequest('GET', '/api/v1/ai-control-plane/blocked-actions');
  assert.equal(blocked.status, 200);
  assert.ok(blocked.body.some((rec) => rec.action === 'race-start' && rec.status === 'safety-blocked'));
  assert.ok(blocked.body.every((rec) => rec.governorDecision.allowed === false));
  assert.ok(blocked.body.every((rec) => rec.auditReference.eventIds.length > 0 && rec.approvalRequirement.required === true));
});

test('runtime API facade only creates AI recommendation drafts and exposes no execution path', async () => {
  const draft = await handleApiRequest('POST', '/api/v1/ai-control-plane/recommendations/draft', { recommendationId: 'rec-race-start', action: 'race-start' });
  assert.equal(draft.status, 202);
  assert.equal(draft.body.accepted, true);
  assert.equal(draft.body.approvalRequired, true);
  assert.equal(draft.body.executionAllowed, false);
  assert.equal(draft.body.audited, true);
  assert.match(draft.body.message, /no autonomous execution/i);

  const evaluate = await handleApiRequest('POST', '/api/v1/ai-control-plane/recommendations/evaluate', { recommendationId: 'rec-harrow-7', action: 'recommend-harrow' });
  assert.equal(evaluate.status, 202);
  assert.equal(evaluate.body.eventType, 'ai.recommendation.evaluated');
  assert.equal(evaluate.body.executionAllowed, false);

  const execute = await handleApiRequest('POST', '/api/v1/ai-control-plane/recommendations/execute', { recommendationId: 'rec-race-start' });
  assert.equal(execute.status, 404);
  assert.equal(execute.body.error.code, 'not_found');
});

test('runtime API facade keeps protected actions approval-only', async () => {
  const state = createApiFacadeState();
  const before = await handleApiRequest('GET', '/api/v1/starting-gate/position', undefined, state);
  const minimalBypass = await handleApiRequest('POST', '/api/v1/approvals/controlled-actions', { action: 'race-start', target: 'race-7' }, state);
  assert.equal(minimalBypass.status, 400);
  assert.match(minimalBypass.body.error.message, /tenantId, racetrackId, reason, evidence/);

  const response = await handleApiRequest('POST', '/api/v1/approvals/controlled-actions', { tenantId: 'trackmind', racetrackId: 'main-track', action: 'race-start', target: 'race-7', reason: 'readiness approval test', actorId: 'steward-1', actorType: 'human', roles: ['steward'], evidence: ['readiness-watch'] }, state);
  assert.equal(response.status, 202);
  assert.equal(response.body.accepted, true);
  assert.equal(response.body.eventType, 'approval.requested');
  assert.equal(response.body.audited, true);
  assert.equal(response.body.mock, false);
  assert.match(response.body.message, /Execution remains locked/);
  assert.doesNotMatch(response.body.message, /executed/i);

  const draft = await handleApiRequest('POST', '/api/v1/approvals/draft-requests', { tenantId: 'trackmind', racetrackId: 'main-track', action: 'starting-gate-move', target: 'gate-1', reason: 'Draft gate movement package only.', actorId: 'starter-1', actorType: 'human', roles: ['track-superintendent'], evidence: ['gps-fix', 'draft-only:no-live-actuator-control'] }, state);
  assert.equal(draft.status, 202);
  assert.equal(draft.body.eventType, 'approval.requested');
  assert.match(draft.body.message, /Execution remains locked/);

  const trackConfigurationDraft = await handleApiRequest('POST', '/api/v1/track-configuration/draft-requests', { tenantId: 'trackmind', racetrackId: 'main-track', action: 'race-distance-configuration', target: 'race-7', reason: 'Draft race distance and rail configuration package only.', actorId: 'track-superintendent-1', actorType: 'human', roles: ['track-superintendent'], evidence: ['distance-sheet', 'survey-control'] }, state);
  assert.equal(trackConfigurationDraft.status, 202);
  assert.equal(trackConfigurationDraft.body.eventType, 'track.configuration.change.requested');
  assert.match(trackConfigurationDraft.body.message, /no live actuator command/);

  const after = await handleApiRequest('GET', '/api/v1/starting-gate/position', undefined, state);
  assert.deepEqual(after.body, before.body);
});

test('runtime API facade exposes enriched Steward Center inquiry data', async () => {
  const response = await handleApiRequest('GET', '/api/v1/stewarding/inquiries');
  assert.equal(response.status, 200);
  assert.ok(response.body.inquiries.length >= 1);
  const inquiry = response.body.inquiries[0];
  assert.ok(inquiry.investigations.length >= 1);
  assert.ok(inquiry.evidenceOrganizations.every((org) => org.officialRuling === false && org.mayModifyOfficialResults === false));
  assert.ok(inquiry.timeline.length >= inquiry.evidenceReferences.length);
  assert.ok(inquiry.integrations.eventTypes.includes('steward.ai.evidence.organized'));
  assert.equal(inquiry.aiGuardrails.mayModifyOfficialResults, false);
});

test('runtime API facade serves enriched surface intelligence workspace', async () => {
  const response = await handleApiRequest('GET', '/api/v1/surface-intelligence/workspace');
  assert.equal(response.status, 200);
  assert.equal(response.body.operationalActionsRequireHumanApproval, true);
  assert.ok(response.body.conditionScorecards.length >= 1);
  assert.ok(response.body.metricPanels.some((panel) => panel.factor === 'compaction'));
  assert.ok(response.body.forecasts.every((forecast) => forecast.advisoryOnly));
  assert.ok(response.body.drainageAnalysis.some((item) => item.status === 'restricted'));
  assert.ok(response.body.approvalActions.every((action) => action.locked));
});

test('runtime API facade exposes unified data model store metadata', async () => {
  const response = await handleApiRequest('GET', '/api/v1/tus/data-model');
  assert.equal(response.status, 200);
  assert.equal(response.body.schemaVersion, 'trackmind.unified-data-model.v1');
  assert.equal(response.body.scope.tenantId, 'trackmind');
  assert.equal(response.body.scope.racetrackId, 'main-track');
  assert.ok(response.body.coverage.eventStoreRepresented);
  assert.ok(response.body.coverage.auditStoreRepresented);
  assert.ok(response.body.coverage.twinGraphRepresented);
  assert.ok(response.body.coverage.featureStoreRepresented);
  assert.ok(response.body.stores.every((store) => store.scope.tenantScoped && store.runtimeFacade.backingDependency === 'none'));
  assert.ok(response.body.tusEntityMappings.every((mapping) => mapping.storeIds.length > 0 && mapping.governanceControls.includes('tenant-isolation')));
  assert.ok(response.body.lineageContracts.some((lineage) => lineage.entity.entityKind === 'ai-recommendation' && lineage.recommendationIds.includes('rec-harrow-7')));
});

test('runtime API facade exposes platform health and event stream heartbeat', async () => {
  const health = await handleApiRequest('GET', '/api/v1/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.status, 'healthy');
  assert.equal(health.body.observability.structuredLogs, true);
  assert.equal(health.body.observability.requestIdHeader, 'x-trackmind-request-id');
  assert.ok(health.body.requestId);
  assert.equal(health.headers['x-trackmind-request-id'], health.body.requestId);

  const platform = await handleApiRequest('GET', '/api/v1/platform/health');
  assert.equal(platform.status, 200);
  assert.equal(platform.body.overallStatus, 'degraded');
  assert.equal(platform.body.frontend.degradedMode, true);
  assert.ok(platform.body.signals.length > 0);

  const stream = await handleApiRequest('GET', '/api/v1/events/stream');
  assert.equal(stream.status, 200);
  assert.match(stream.headers['content-type'], /text\/event-stream/);
  assert.match(stream.body, /heartbeat/);
  assert.match(stream.body, /requestId/);
  assert.ok(stream.headers['x-trackmind-request-id']);
});

test('runtime API server returns structured bad-json errors with request metadata', async () => {
  const server = createTrackMindApiServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/approvals/draft-requests`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-trackmind-request-id': 'test-request-1' }, body: '{"action":' });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('x-trackmind-request-id'), 'test-request-1');
    assert.match(response.headers.get('access-control-allow-headers') ?? '', /x-trackmind-tenant-id/);
    assert.match(response.headers.get('access-control-allow-headers') ?? '', /x-trackmind-racetrack-id/);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'bad_json');
    assert.equal(body.error.requestId, 'test-request-1');
    assert.equal(body.error.path, '/api/v1/approvals/draft-requests');
    assert.ok(body.error.timestamp);
    assert.equal(body.meta.requestId, 'test-request-1');
    assert.equal(body.meta.method, 'POST');
    assert.equal(body.meta.path, '/api/v1/approvals/draft-requests');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
