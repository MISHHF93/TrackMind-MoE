import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';

const adminHeaders = {
  'x-trackmind-role': 'platform-super-admin',
  'x-trackmind-tenant-id': 'trackmind',
  'x-trackmind-racetrack-id': 'main-track',
  'x-trackmind-organization-id': 'org-trackmind-network',
};

test('wave 01 foundation platform endpoints', async () => {
  const state = createApiFacadeState();
  const foundation = await handleApiRequest('GET', '/api/v1/platform/foundation', undefined, state, adminHeaders);
  assert.equal(foundation.status, 200);
  assert.ok(foundation.body.organizations);

  const flags = await handleApiRequest('GET', '/api/v1/platform/feature-flags/evaluate?key=race-day-ops', undefined, state, adminHeaders);
  assert.equal(flags.status, 200);
  assert.equal(flags.body.enabled, true);

  const env = await handleApiRequest('GET', '/api/v1/platform/environment', undefined, state, adminHeaders);
  assert.equal(env.status, 200);
  assert.equal(env.body.persistenceMode, 'in-memory');
  assert.equal(env.body.repository.mode, 'in-memory');
  assert.equal(env.body.repository.wired, true);

  const orgList = await handleApiRequest('GET', '/api/v1/platform/organizations', undefined, state, adminHeaders);
  assert.equal(orgList.status, 200);
  assert.ok(orgList.body.length >= 1);

  const orgCreate = await handleApiRequest('POST', '/api/v1/platform/organizations', { name: 'Wave 01 Org' }, state, adminHeaders);
  assert.equal(orgCreate.status, 201);
  assert.equal(orgCreate.body.name, 'Wave 01 Org');

  const tenantCreate = await handleApiRequest('POST', '/api/v1/platform/tenants', {
    organizationId: orgCreate.body.id,
    name: 'Wave 01 Tenant',
  }, state, adminHeaders);
  assert.equal(tenantCreate.status, 201);
  assert.equal(tenantCreate.body.organizationId, orgCreate.body.id);

  const trackCreate = await handleApiRequest('POST', '/api/v1/platform/racetracks', {
    tenantId: tenantCreate.body.id,
    organizationId: orgCreate.body.id,
    name: 'Wave 01 Track',
    jurisdiction: 'US-CA',
  }, state, adminHeaders);
  assert.equal(trackCreate.status, 201);
  assert.equal(trackCreate.body.tenantId, tenantCreate.body.id);

  const tenants = await handleApiRequest('GET', '/api/v1/platform/tenants', undefined, state, adminHeaders);
  assert.equal(tenants.status, 200);
  assert.ok(tenants.body.some((t) => t.id === tenantCreate.body.id));

  const tracks = await handleApiRequest('GET', '/api/v1/platform/racetracks', undefined, state, adminHeaders);
  assert.equal(tracks.status, 200);
  assert.ok(tracks.body.some((t) => t.id === trackCreate.body.id));
});

test('wave 04 identity and wave 05 audit search', async () => {
  const state = createApiFacadeState();
  const identity = await handleApiRequest('GET', '/api/v1/identity/workspace', undefined, state, adminHeaders);
  assert.equal(identity.status, 200);
  assert.ok(identity.body.users.length > 0);

  const users = await handleApiRequest('GET', '/api/v1/platform/users', undefined, state, adminHeaders);
  assert.equal(users.status, 200);
  assert.ok(users.body.length > 0);

  const roles = await handleApiRequest('GET', '/api/v1/platform/roles', undefined, state, adminHeaders);
  assert.equal(roles.status, 200);
  assert.ok(roles.body.length > 0);

  const search = await handleApiRequest('GET', '/api/v1/audit/search?domain=api', undefined, state, adminHeaders);
  assert.equal(search.status, 200);
  assert.ok(Array.isArray(search.body));
});

test('wave 09 paddock and schedule plus wave 11 incidents', async () => {
  const state = createApiFacadeState();
  const paddock = await handleApiRequest('GET', '/api/v1/race-operations/paddock', undefined, state, adminHeaders);
  assert.equal(paddock.status, 200);
  assert.ok(paddock.body.assignments.length > 0);

  const schedule = await handleApiRequest('GET', '/api/v1/race-operations/schedule', undefined, state, adminHeaders);
  assert.equal(schedule.status, 200);
  assert.ok(schedule.body.races.length > 0);

  const incidents = await handleApiRequest('GET', '/api/v1/incidents', undefined, state, adminHeaders);
  assert.equal(incidents.status, 200);
  assert.ok(incidents.body.length > 0);

  const incident = await handleApiRequest('GET', '/api/v1/incidents/inc-1', undefined, state, adminHeaders);
  assert.equal(incident.status, 200);
  assert.ok(incident.body.timeline.length > 0);
  assert.ok(incident.body.auditIds.length > 0);

  const incidentTimeline = await handleApiRequest('GET', '/api/v1/incidents/inc-1/timeline', undefined, state, adminHeaders);
  assert.equal(incidentTimeline.status, 200);
  assert.equal(incidentTimeline.body.incidentId, 'inc-1');
  assert.ok(incidentTimeline.body.entries.length > 0);

  const incidentStream = await handleApiRequest('GET', '/api/v1/incidents/inc-1/timeline/stream', undefined, state, adminHeaders);
  assert.equal(incidentStream.status, 200);
  assert.match(String(incidentStream.body), /event: snapshot/);
  assert.match(String(incidentStream.body), /event: heartbeat/);

  const created = await handleApiRequest('POST', '/api/v1/incidents', {
    title: 'Surface washout near rail',
    description: 'Standing water reported on backstretch.',
    severity: 'high',
    category: 'safety',
    reportedBy: 'track-superintendent',
  }, state, adminHeaders);
  assert.equal(created.status, 201);
  assert.equal(created.body.status, 'reported');
  assert.ok(created.body.auditIds.length > 0);

  const triaged = await handleApiRequest('POST', `/api/v1/incidents/${created.body.id}/triage`, {
    severity: 'high',
    assignedTo: 'race-day-operations-manager',
    actor: 'security-officer',
  }, state, adminHeaders);
  assert.equal(triaged.status, 200);
  assert.equal(triaged.body.status, 'triaged');

  const triagedTimeline = await handleApiRequest('GET', `/api/v1/incidents/${created.body.id}/timeline`, undefined, state, adminHeaders);
  assert.equal(triagedTimeline.status, 200);
  assert.ok(triagedTimeline.body.entries.length >= 2);
  const since = triagedTimeline.body.entries[0].at;
  const incrementalTimeline = await handleApiRequest('GET', `/api/v1/incidents/${created.body.id}/timeline?since=${encodeURIComponent(since)}`, undefined, state, adminHeaders);
  assert.equal(incrementalTimeline.status, 200);
  assert.ok(incrementalTimeline.body.entries.length >= 1);

  const resolved = await handleApiRequest('POST', `/api/v1/incidents/${created.body.id}`, {
    status: 'resolved',
    actor: 'race-day-operations-manager',
  }, state, adminHeaders);
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.status, 'resolved');

  const review = await handleApiRequest('POST', `/api/v1/incidents/${created.body.id}/post-incident-review`, {
    submittedBy: 'safety-officer',
    findings: [{ finding: 'Drainage response delayed', severity: 'medium', owner: 'facilities' }],
  }, state, adminHeaders);
  assert.equal(review.status, 201);
  assert.ok(review.body.review.correctiveActions.length > 0);

  const kpiPack = await handleApiRequest('GET', '/api/v1/incidents/kpi-pack', undefined, state, adminHeaders);
  assert.equal(kpiPack.status, 200);
  assert.equal(kpiPack.body.kpiPackId, 'safety-kpi-pack-v1');
  assert.ok(kpiPack.body.kpis.length >= 5);

  const incidentCatalog = state.platformEventBus.governanceCatalog().map((entry) => entry.type);
  assert.ok(incidentCatalog.includes('incident.reported.v1'));
  assert.ok(incidentCatalog.includes('incident.updated.v1'));
  assert.ok(incidentCatalog.includes('incident.triaged.v1'));
  assert.ok(incidentCatalog.includes('incident.resolved.v1'));
  assert.ok(incidentCatalog.includes('incident.post-incident-review.submitted.v1'));

  await handleApiRequest('POST', '/api/v1/incidents', {
    title: 'Event bus verification',
    description: 'Verify incident.*.v1 registration.',
    severity: 'medium',
    category: 'operational',
    reportedBy: 'security-officer',
  }, state, adminHeaders);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const incidentBusEvents = state.platformEventBus.events().filter((event) => String(event.type).startsWith('incident.') || String(event.eventType ?? '').startsWith('incident.'));
  assert.ok(incidentBusEvents.some((event) => event.eventType === 'incident.reported.v1' || event.type === 'incident.reported.v1'));
});

test('wave 16 fan experience and wave 17 finance workspace', async () => {
  const state = createApiFacadeState();
  const fan = await handleApiRequest('GET', '/api/v1/fan-experience/workspace', undefined, state, adminHeaders);
  assert.equal(fan.status, 200);
  assert.equal(fan.body.schemaVersion, 'trackmind.fan-experience-operations.v1');
  assert.ok(fan.body.attendance);
  assert.ok(fan.body.dashboard.panels.length >= 6);
  assert.ok(fan.body.ticketingConnector);
  assert.equal(fan.body.ticketingConnector.overallStatus, 'degraded');
  assert.equal(fan.body.ticketingConnector.degraded, true);
  assert.ok(fan.body.ticketingConnector.adapters.length >= 2);
  assert.equal(fan.body.ticketingConnector.inventorySource, 'degraded-connector');
  assert.equal(fan.body.ticketingConnector.attendanceSource, 'degraded-connector');
  assert.ok(fan.body.ticketingConnector.syncAuditIds.length >= 1);
  assert.equal(fan.body.ticketInventory.sold, 8490);
  assert.equal(fan.body.attendance.current, 8490);

  const attendance = await handleApiRequest('GET', '/api/v1/fan-experience/attendance', undefined, state, adminHeaders);
  assert.equal(attendance.status, 200);
  assert.ok(attendance.body.ticketingConnector);

  const finance = await handleApiRequest('GET', '/api/v1/finance/workspace', undefined, state, adminHeaders);
  assert.equal(finance.status, 200);
  assert.equal(finance.body.schemaVersion, 'trackmind.racing-finance-operations.v1');
  assert.ok(finance.body.revenue);
  assert.ok(finance.body.dashboard.panels.length >= 6);
});

test('wave 08 analytics workspace and dashboard KPI trends', async () => {
  const state = createApiFacadeState();
  const analytics = await handleApiRequest('GET', '/api/v1/analytics/workspace', undefined, state, adminHeaders);
  assert.equal(analytics.status, 200);
  assert.equal(analytics.body.mock, false);
  assert.ok(analytics.body.kpiTrends.length >= 1);
  assert.ok(analytics.body.kpiTrends.every((trend) => trend.kpiId && trend.points.length >= 1));
  assert.ok(analytics.body.forecastingReadiness.modelsAvailable.length >= 1);

  const analyticsStream = await handleApiRequest('GET', '/api/v1/analytics/workspace/stream', undefined, state, adminHeaders);
  assert.equal(analyticsStream.status, 200);
  assert.match(String(analyticsStream.body), /event: snapshot/);
  assert.match(String(analyticsStream.body), /event: heartbeat/);
  assert.match(String(analyticsStream.body), /forecastingReadiness/);

  const kpis = await handleApiRequest('GET', '/api/v1/kpis', undefined, state, adminHeaders);
  assert.equal(kpis.status, 200);
  assert.ok(kpis.body.kpis.some((kpi) => (kpi.historicalSnapshots ?? []).length >= 1));
});

test('wave 18 model registry and wave 19 federation KPIs', async () => {
  const state = createApiFacadeState();
  const registry = await handleApiRequest('GET', '/api/v1/ai-governance/model-registry', undefined, state, adminHeaders);
  assert.equal(registry.status, 200);
  assert.ok(registry.body.modelCards.length > 0);

  const promptRegistration = await handleApiRequest('POST', '/api/v1/ai-governance/model-registry/prompts', {
    id: 'surface-intervention-v5',
    name: 'Surface Intervention',
    version: '5.0.0',
    path: 'ai/prompt-cards/surface-intervention-v5.md',
    lineage: ['surface-intervention-v4', 'surface-advisor-v2'],
  }, state, adminHeaders);
  assert.equal(promptRegistration.status, 201);
  assert.equal(promptRegistration.body.eventType, 'ai.prompt-card.registered');
  assert.equal(promptRegistration.body.audited, true);
  assert.ok(promptRegistration.body.auditId);
  assert.ok(promptRegistration.body.registry.promptCards.some((card) => card.id === 'surface-intervention-v5'));

  const modelRegistration = await handleApiRequest('POST', '/api/v1/ai-governance/model-registry/models', {
    id: 'weather-advisor-v1',
    name: 'Weather Advisor',
    version: '1.0.0',
    riskLevel: 'medium',
    path: 'ai/model-cards/weather-advisor-v1.md',
    reason: 'wave-18 verification registration',
  }, state, adminHeaders);
  assert.equal(modelRegistration.status, 201);
  assert.equal(modelRegistration.body.eventType, 'ai.model-card.registered');
  assert.equal(modelRegistration.body.audited, true);
  assert.ok(modelRegistration.body.auditId);

  const auditSearch = await handleApiRequest('GET', '/api/v1/audit/search?domain=ai', undefined, state, adminHeaders);
  assert.equal(auditSearch.status, 200);
  assert.ok(auditSearch.body.some((event) => event.action === 'ai.prompt-card.registered'));
  assert.ok(auditSearch.body.some((event) => event.action === 'ai.model-card.registered'));

  const connector = await handleApiRequest('POST', '/api/v1/racing-data/providers/provider-official-feed/invoke', undefined, state, adminHeaders);
  assert.equal(connector.status, 202);
  assert.equal(connector.body.providerId, 'provider-official-feed');
  assert.equal(connector.body.status, 'simulated');
  assert.ok(connector.body.recordsProcessed >= 1);
  assert.equal(connector.body.mock, false);
  assert.equal(connector.body.audited, true);
  assert.ok(connector.body.auditId);
  assert.ok(connector.body.correlationId);
  assert.equal(connector.body.externalCallsPerformed, false);
  assert.equal(connector.body.scrapingPerformed, false);
  assert.ok(connector.body.lineage?.sourceRefs?.length >= 1);
  assert.ok(typeof connector.body.rateLimit?.remaining === 'number');
  assert.ok(connector.body.rateLimit.remaining < connector.body.rateLimit.limit);

  const restrictedInvoke = await handleApiRequest('POST', '/api/v1/racing-data/providers/provider-restricted-odds/invoke', undefined, state, adminHeaders);
  assert.equal(restrictedInvoke.status, 403);
  assert.equal(restrictedInvoke.body.error?.code, 'provider_suspended');

  const entityReview = await handleApiRequest('POST', '/api/v1/racing-data/entity-resolution/review', {
    providerId: 'provider-official-feed',
    entityId: 'trainer-candidate-1',
    resolutionId: 'resolution-trainer-ambiguous-1',
    rationale: 'wave-19 entity resolution review draft',
  }, state, adminHeaders);
  assert.equal(entityReview.status, 202);
  assert.equal(entityReview.body.eventType, 'racing-data.entity-resolution.review.draft.created');
  assert.equal(entityReview.body.executionAllowed, false);
  assert.ok(entityReview.body.draftId);

  const providerAudit = await handleApiRequest('GET', '/api/v1/audit/search?domain=racing-data', undefined, state, adminHeaders);
  assert.equal(providerAudit.status, 200);
  assert.ok(providerAudit.body.some((event) => event.action === 'racing-data.provider.invoked'));

  const federation = await handleApiRequest('GET', '/api/v1/federation/kpi-aggregation', undefined, state, adminHeaders);
  assert.equal(federation.status, 200);
  assert.ok(Array.isArray(federation.body));
  assert.ok(federation.body.length >= 1);
  assert.ok(federation.body.every((row) => row.metric && typeof row.aggregatedValue === 'number' && row.trackCount >= 1));

  const analytics = await handleApiRequest('GET', '/api/v1/analytics/workspace', undefined, state, adminHeaders);
  assert.equal(analytics.status, 200);
  assert.ok(analytics.body.federationBenchmarks.length >= federation.body.length);
  assert.ok(analytics.body.federationBenchmarks.every((benchmark) => benchmark.anonymized === true));
});

test('wave 09 emergency workflow activation mutation', async () => {
  const state = createApiFacadeState();
  const before = await handleApiRequest('GET', '/api/v1/emergency-operations/workspace', undefined, state, adminHeaders);
  assert.equal(before.status, 200);

  const activation = await handleApiRequest('POST', '/api/v1/emergency-operations/workflows', {
    id: 'wf-weather-drill',
    planId: 'plan-weather',
    scenario: 'severe-weather',
    severity: 'major',
    location: 'Grandstand',
    activatedBy: 'race-day-operations-manager',
    roles: ['platform-super-admin'],
  }, state, adminHeaders);
  assert.equal(activation.status, 201);
  assert.equal(activation.body.eventType, 'emergency.workflow.activated');
  assert.equal(activation.body.workflowId, 'wf-weather-drill');

  const after = await handleApiRequest('GET', '/api/v1/emergency-operations/workspace', undefined, state, adminHeaders);
  assert.notEqual(after.body.activeEmergencyStatus, before.body.activeEmergencyStatus);
});

test('wave 14 security operations endpoints', async () => {
  const state = createApiFacadeState();
  const headers = { 'x-trackmind-role': 'security-manager', 'x-trackmind-tenant-id': 'trackmind', 'x-trackmind-racetrack-id': 'main-track' };

  const zonesLive = await handleApiRequest('GET', '/api/v1/security-operations/zones/live', undefined, state, headers);
  assert.equal(zonesLive.status, 200);
  assert.equal(zonesLive.body.mock, false);
  assert.ok(zonesLive.body.zones.length >= 2);

  const cameraReadiness = await handleApiRequest('GET', '/api/v1/security-operations/cameras/readiness', undefined, state, headers);
  assert.equal(cameraReadiness.status, 200);
  assert.ok(cameraReadiness.body.items.length >= 3);

  const sensorReadiness = await handleApiRequest('GET', '/api/v1/security-operations/sensors/readiness', undefined, state, headers);
  assert.equal(sensorReadiness.status, 200);
  assert.ok(sensorReadiness.body.items.length >= 3);

  const kpiPack = await handleApiRequest('GET', '/api/v1/security-operations/kpis', undefined, state, headers);
  assert.equal(kpiPack.status, 200);
  assert.ok(kpiPack.body.kpis.some((kpi) => kpi.kpiId === 'kpi-security'));

  const webhook = await handleApiRequest('POST', '/api/v1/security-operations/webhooks/access-events', {
    adapterId: 'vendor-access-runtime',
    zoneId: 'zone-paddock',
    credentialId: 'cred-runtime-1',
    personDisplayName: 'Runtime Vendor',
    decision: 'granted',
    reason: 'scheduled maintenance',
    occurredAt: '2026-06-14T12:00:00.000Z',
    signatureValid: true,
  }, state, headers);
  assert.equal(webhook.status, 202);
  assert.equal(webhook.body.accepted, true);
});

test('wave 20 global search and notifications', async () => {
  const state = createApiFacadeState();
  const search = await handleApiRequest('GET', '/api/v1/search/global?q=horse', undefined, state, adminHeaders);
  assert.equal(search.status, 200);
  assert.ok(Array.isArray(search.body.results));
  assert.equal(search.body.mock, false);

  const inbox = await handleApiRequest('GET', '/api/v1/notifications/inbox?role=admin', undefined, state, adminHeaders);
  assert.equal(inbox.status, 200);
  assert.ok(inbox.body.notifications.length > 0);

  const adapters = await handleApiRequest('GET', '/api/v1/notifications/delivery-adapters', undefined, state, adminHeaders);
  assert.equal(adapters.status, 200);
  assert.ok(adapters.body.adapters.includes('in-app'));
  assert.ok(adapters.body.adapters.includes('webhook-stub'));
  assert.ok(adapters.body.adapters.includes('email-stub'));
  assert.ok(adapters.body.stats.length >= 1);

  const coverage = await handleApiRequest('GET', '/api/v1/platform/contract-coverage', undefined, state, adminHeaders);
  assert.equal(coverage.status, 200);
  assert.equal(coverage.body.schemaVersion, 'trackmind.contract-coverage.v1');
  assert.ok(coverage.body.totalContracts >= 100);
  assert.ok(coverage.body.schemaCoveragePercent >= 90);
});

test('wave 06 durable approvals, escalation simulation, and audit-backed mutations', async () => {
  const state = createApiFacadeState();

  const created = await handleApiRequest('POST', '/api/v1/approvals/controlled-actions', {
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    action: 'emergency-action',
    target: 'gate-wave-06',
    actorId: 'race-day-operations-manager',
    actorType: 'human',
    roles: ['security-manager'],
    reason: 'Gate fault requires controlled approval',
    evidence: ['alarm-feed'],
  }, state, { ...adminHeaders, 'x-trackmind-role': 'security-manager' });
  assert.equal(created.status, 202);
  assert.equal(created.body.audited, true);
  const approvalId = created.body.approvalId;

  const durableBefore = await handleApiRequest('GET', '/api/v1/approvals/durable', undefined, state, adminHeaders);
  assert.equal(durableBefore.status, 200);
  const durableRecord = durableBefore.body.find((item) => item.id === approvalId);
  assert.ok(durableRecord);
  assert.ok(durableRecord.approvalSteps.length >= 1);

  const escalateAt = new Date(Date.parse(durableRecord.createdAt) + 3 * 60_000).toISOString();
  const escalation = await handleApiRequest('POST', '/api/v1/approvals/escalation/simulate', {
    now: escalateAt,
    reminderLeadMinutes: 10,
  }, state, adminHeaders);
  assert.equal(escalation.status, 200);
  assert.ok(escalation.body.escalated.includes(approvalId));

  const listed = await handleApiRequest('GET', '/api/v1/approvals/requests', undefined, state, adminHeaders);
  assert.equal(listed.status, 200);
  const live = listed.body.find((item) => item.id === approvalId || item.approvalRequestId === approvalId);
  assert.ok(live);

  const approved = await handleApiRequest(
    'POST',
    `/api/v1/approvals/${approvalId}/approve`,
    {
      actorId: 'security-lead',
      actorType: 'human',
      roles: ['security-manager'],
      reason: 'Gate fault verified for wave 06 audit search',
      evidence: ['human-approval-record'],
    },
    state,
    { ...adminHeaders, 'x-trackmind-role': 'security-manager' },
  );
  assert.equal(approved.status, 200);

  const approvalSearch = await handleApiRequest('GET', '/api/v1/audit/search?domain=approval', undefined, state, adminHeaders);
  assert.equal(approvalSearch.status, 200);
  assert.ok(approvalSearch.body.some((event) => event.action === 'approval.approved'));
});
