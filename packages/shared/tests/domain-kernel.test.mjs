import test from 'node:test';
import assert from 'node:assert/strict';
import { createDigitalTwinRef, createDomainEntityBase, deserializeDomainEntity, domainKernelSchemaVersion, domainSchemas, serializeDomainEntity, validateDomainContractSet, validateDomainEntity } from '../dist/index.js';

const now = '2026-06-13T00:00:00.000Z';

test('domain kernel registers schemas for all core TrackMind Nexus entities', () => {
  assert.deepEqual(Object.keys(domainSchemas), ['organization','tenant','user','role','permission','racetrack','race-meet','racing-season','race-day','race-card','race-entry','race','horse','jockey','trainer','owner','veterinarian','steward','official','fan','data-provider','federation-participant','finance-record','barn','stall','track-sector','facility','asset','starting-gate','sensor','vehicle','incident','security-event','workflow','ai-recommendation','approval','audit-event','audit-record','compliance-record']);
  assert.equal(domainSchemas.horse.schemaVersion, domainKernelSchemaVersion);
  assert.ok(domainSchemas.organization.rules.some((rule) => rule.path === 'tenantIds'));
  assert.ok(domainSchemas.tenant.rules.some((rule) => rule.path === 'isolationMode'));
  assert.ok(domainSchemas.user.rules.some((rule) => rule.path === 'roles'));
  assert.ok(domainSchemas.role.rules.some((rule) => rule.path === 'permissions'));
  assert.ok(domainSchemas.permission.rules.some((rule) => rule.path === 'approvalRequired'));
  assert.ok(domainSchemas['ai-recommendation'].rules.some((rule) => rule.path === 'confidence'));
  assert.ok(domainSchemas['ai-recommendation'].rules.some((rule) => rule.path === 'modelVersion'));
  assert.ok(domainSchemas['ai-recommendation'].rules.some((rule) => rule.path === 'auditReference.auditIds'));
  assert.ok(domainSchemas['security-event'].rules.some((rule) => rule.path === 'auditEventId'));
  assert.ok(domainSchemas['compliance-record'].rules.some((rule) => rule.path === 'externalCertificationClaimed'));
});

test('domain kernel validates organization, tenant, user, role, and permission as canonical business domains', () => {
  const organization = {
    ...createDomainEntityBase('organization', { id: 'org-trackmind', tenantId: 'tenant-east', displayName: 'TrackMind Racing Group', ownerId: 'executive', createdBy: 'system', now }),
    legalName: 'TrackMind Racing Group LLC',
    tenantIds: ['tenant-east'],
    status: 'active',
    dataResidency: 'us-east',
  };
  const tenant = {
    ...createDomainEntityBase('tenant', { id: 'tenant-east', tenantId: 'tenant-east', displayName: 'Eastern Racing Tenant', ownerId: 'tenant-ops', createdBy: 'system', now }),
    organizationId: 'org-trackmind',
    racetrackIds: ['track-001'],
    status: 'active',
    dataBoundary: 'racetrack',
    isolationMode: 'strict',
  };
  const user = {
    ...createDomainEntityBase('user', { id: 'user-admin', tenantId: 'tenant-east', displayName: 'Ops Admin', ownerId: 'identity-governance', createdBy: 'system', now }),
    organizationId: 'org-trackmind',
    email: 'ops@example.test',
    identityKind: 'human',
    roles: ['platform-super-admin'],
    permissions: ['read:any', 'tenant:admin'],
    racetrackIds: ['track-001'],
    status: 'active',
  };
  const role = {
    ...createDomainEntityBase('role', { id: 'role-admin', tenantId: 'tenant-east', displayName: 'Admin role', ownerId: 'identity-governance', createdBy: 'system', now }),
    role: 'platform-super-admin',
    permissions: ['read:any', 'tenant:admin'],
    assignable: false,
    privileged: true,
  };
  const permission = {
    ...createDomainEntityBase('permission', { id: 'permission-tenant-admin', tenantId: 'tenant-east', displayName: 'Tenant admin permission', ownerId: 'identity-governance', createdBy: 'system', now }),
    permission: 'tenant:admin',
    category: 'identity-governance',
    protected: true,
    approvalRequired: true,
  };
  for (const entity of [organization, tenant, user, role, permission]) assert.deepEqual(validateDomainEntity(entity), { valid: true, errors: [] }, entity.kind);
  assert.ok(validateDomainEntity({ ...tenant, racetrackIds: [] }).errors.includes('tenant requires at least one racetrackId'));
  assert.ok(validateDomainEntity({ ...permission, approvalRequired: false }).errors.includes('protected permissions require approval'));
});

test('domain kernel validates metadata, ownership, versioning, lifecycle, and entity specific constraints', () => {
  const horse = {
    ...createDomainEntityBase('horse', { id: 'horse-001', tenantId: 'track-001', displayName: 'Northern Logic', ownerId: 'equine-safety', createdBy: 'registrar', now, classification: 'regulated' }),
    registrationNumber: 'TB-001', microchipId: '985141001', status: 'active', trainerId: 'trainer-001', ownerIds: ['owner-001'],
    digitalTwin: { twinId: 'twin:horse:horse-001', modelId: 'horse.v1', entity: { id: 'horse-001', kind: 'horse', tenantId: 'track-001' }, sourceSystem: 'nexus-twin' },
    approvals: [{ approvalId: 'approval-001', status: 'approved', protectedAction: 'clear-veterinary-flag' }],
    events: [{ eventId: 'event-001', eventType: 'equine.horse.arrived.v1', occurredAt: now }]
  };
  assert.deepEqual(validateDomainEntity(horse), { valid: true, errors: [] });
  const invalid = { ...horse, ownership: { ...horse.ownership, tenantId: 'other-track' }, version: { ...horse.version, entityVersion: 0 }, ownerIds: undefined };
  const result = validateDomainEntity(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('tenantId must match ownership.tenantId'));
  assert.ok(result.errors.includes('version.entityVersion must be >= 1'));
  assert.ok(result.errors.includes('ownerIds is required'));
});

test('domain kernel serialization round trips and rejects invalid payloads for backward compatible JSON contracts', () => {
  const approval = {
    ...createDomainEntityBase('approval', { id: 'approval-001', tenantId: 'track-001', displayName: 'Scratch approval', ownerId: 'stewarding', createdBy: 'steward-1', now, lifecycleState: 'pending-approval', classification: 'regulated' }),
    recommendationId: 'ai-rec-001', protectedAction: 'scratch-horse', target: { id: 'horse-001', kind: 'horse', tenantId: 'track-001' }, status: 'approved', approverId: 'steward-1', approverRoles: ['steward'], reason: 'Vet evidence accepted', evidence: ['vet-note']
  };
  const payload = serializeDomainEntity(approval);
  assert.equal(deserializeDomainEntity(payload).id, approval.id);
  assert.throws(() => deserializeDomainEntity(JSON.stringify({ ...approval, confidence: 2, kind: 'ai-recommendation' })), /target is required|confidence/);
});

test('domain kernel validates race meets, barns, stalls, assets, audit events, and Digital Twin references', () => {
  const racetrack = {
    ...createDomainEntityBase('racetrack', { id: 'track-001', tenantId: 'track-001', displayName: 'Nexus Downs', ownerId: 'operations', createdBy: 'ops-admin', now }),
    timezone: 'America/New_York',
    commissionName: 'Local Racing Commission',
    sectorIds: ['sector-backstretch'],
    facilityIds: ['facility-barn-2'],
    digitalTwin: createDigitalTwinRef({ twinId: 'twin:racetrack:track-001', modelId: 'racetrack.v1', entity: { id: 'track-001', kind: 'racetrack', tenantId: 'track-001' }, sourceSystem: 'nexus-twin', twinClass: 'racetrack' }),
  };
  const meet = {
    ...createDomainEntityBase('race-meet', { id: 'meet-2026', tenantId: 'track-001', displayName: 'Summer Meet', ownerId: 'race-office', createdBy: 'racing-secretary', now }),
    racetrackId: 'track-001', season: '2026', opensOn: '2026-06-01', closesOn: '2026-09-01', status: 'open', raceDayIds: ['day-2026-06-13'],
    digitalTwin: createDigitalTwinRef({ twinId: 'twin:race-meet:meet-2026', modelId: 'raceMeet.v1', entity: { id: 'meet-2026', kind: 'race-meet', tenantId: 'track-001' }, sourceSystem: 'nexus-twin', twinClass: 'race-meet' }),
  };
  const barn = {
    ...createDomainEntityBase('barn', { id: 'barn-2', tenantId: 'track-001', displayName: 'Barn 2', ownerId: 'barn-ops', createdBy: 'ops-admin', now }),
    racetrackId: 'track-001', status: 'ready', capacity: 1, stallIds: ['stall-12A'], trainerIds: ['trainer-1'],
  };
  const stall = {
    ...createDomainEntityBase('stall', { id: 'stall-12A', tenantId: 'track-001', displayName: 'Stall 12A', ownerId: 'barn-ops', createdBy: 'ops-admin', now }),
    barnId: 'barn-2', label: '12A', status: 'occupied', occupancyHorseId: 'horse-001', restrictionIds: [],
  };
  const asset = {
    ...createDomainEntityBase('asset', { id: 'asset-gate-release', tenantId: 'track-001', displayName: 'Gate Release Control', ownerId: 'operations', createdBy: 'ops-admin', now, classification: 'regulated' }),
    racetrackId: 'track-001', assetType: 'control', riskClassification: 'safety-critical', status: 'standby', sectorId: 'sector-backstretch',
  };
  const auditEvent = {
    ...createDomainEntityBase('audit-event', { id: 'audit-event-1', tenantId: 'track-001', displayName: 'Approval Recorded', ownerId: 'compliance', createdBy: 'audit-service', now, classification: 'regulated' }),
    auditEventId: 'audit-event-1',
    actor: { actorId: 'audit-service', actorType: 'service' },
    entity: { entityId: 'approval-001', entityType: 'approval', tenantId: 'track-001', racetrackId: 'track-001' },
    action: 'approval.recorded',
    reason: 'Human approval record appended to canonical audit ledger.',
    approvalReference: { approvalId: 'approval-001', status: 'approved', protectedAction: 'race-start' },
    timestamp: now,
    tenantScope: { tenantId: 'track-001', racetrackId: 'track-001' },
    integrityReference: { hash: 'sha256:audit-event-1', previousHash: 'genesis', algorithm: 'sha256', chainScope: 'tenant' },
    eventType: 'audit.event.recorded.v1',
    actorId: 'audit-service',
    actorType: 'service',
    target: { id: 'approval-001', kind: 'approval', tenantId: 'track-001' },
    occurredAt: now,
    decision: 'approved',
    evidence: ['human-approval-record'],
    correlationId: 'corr-1',
    sourceService: 'audit-ledger',
    hash: 'sha256:audit-event-1',
    previousHash: 'genesis',
  };

  for (const entity of [racetrack, meet, barn, stall, asset, auditEvent]) assert.deepEqual(validateDomainEntity(entity), { valid: true, errors: [] }, entity.kind);
  assert.deepEqual(validateDomainContractSet([racetrack, meet]), { valid: true, errors: [] });

  const badStall = { ...stall, occupancyHorseId: undefined };
  assert.ok(validateDomainEntity(badStall).errors.includes('occupied stall requires occupancyHorseId'));
});

test('domain kernel keeps protected AI recommendations and workflows approval-gated', () => {
  const target = { id: 'race-7', kind: 'race', tenantId: 'track-001' };
  const recommendation = {
    ...createDomainEntityBase('ai-recommendation', { id: 'rec-1', tenantId: 'track-001', displayName: 'Race start readiness draft', ownerId: 'ai-governance', createdBy: 'agent-1', now, classification: 'regulated' }),
    activity: 'create-draft-action', target, summary: 'Draft race-start request only.', recommendationId: 'rec-1', confidence: 0.88, evidence: ['readiness-check'], modelVersion: 'model:readiness:v1', generatedAt: now, approvalRequirement: { required: true, policy: 'single-human', requirementId: 'approval-1' }, auditReference: { auditIds: ['audit-rec-1'], eventIds: ['ai.recommendation.created.v1'], digitalTwinRefs: ['twin:race:race-7'], approvalReference: 'approval-1' }, requestedAction: 'race-start', requiredApprovals: [{ approvalId: 'approval-1', status: 'pending-approval', protectedAction: 'race-start' }], advisoryOnly: true,
  };
  assert.deepEqual(validateDomainEntity(recommendation), { valid: true, errors: [] });

  const autonomous = { ...recommendation, advisoryOnly: undefined };
  assert.ok(validateDomainEntity(autonomous).errors.includes('AI recommendation requesting protected action must be advisoryOnly'));

  const legacyRecommendation = { ...recommendation };
  delete legacyRecommendation.modelVersion;
  delete legacyRecommendation.auditReference;
  const legacyResult = validateDomainEntity(legacyRecommendation);
  assert.equal(legacyResult.valid, false);
  assert.ok(legacyResult.errors.includes('modelVersion is required'));
  assert.ok(legacyResult.errors.includes('auditReference is required'));

  const executedWithoutApproval = {
    ...createDomainEntityBase('workflow', { id: 'workflow-1', tenantId: 'track-001', displayName: 'Race start workflow', ownerId: 'race-office', createdBy: 'steward-1', now, lifecycleState: 'active', classification: 'regulated' }),
    workflowType: 'race-start', state: 'executed', subject: target, protectedAction: 'race-start', approvalRefs: [{ approvalId: 'approval-1', status: 'pending-approval', protectedAction: 'race-start' }],
  };
  assert.ok(validateDomainEntity(executedWithoutApproval).errors.includes('executed protected workflow requires an approved approvalRef'));
});

test('domain kernel validates security events and compliance records without certification overclaims', () => {
  const securityEvent = {
    ...createDomainEntityBase('security-event', { id: 'security-event-1', tenantId: 'track-001', displayName: 'Restricted zone access denied', ownerId: 'security', createdBy: 'security-service', now, classification: 'regulated' }),
    eventType: 'security.access.denied.v1',
    severity: 'high',
    zoneId: 'zone-barn',
    credentialId: 'credential-1',
    actorId: 'security-officer-1',
    occurredAt: now,
    evidence: ['badge-denied', 'camera-clip-1'],
    auditEventId: 'audit-event-1',
  };
  const complianceRecord = {
    ...createDomainEntityBase('compliance-record', { id: 'compliance-record-1', tenantId: 'track-001', displayName: 'HISA operational oversight mapping', ownerId: 'compliance', createdBy: 'compliance-service', now, classification: 'regulated' }),
    frameworkId: 'HISA',
    controlId: 'HISA-OPS-001',
    status: 'readiness-only',
    evidenceIds: ['evidence-1'],
    auditEventIds: ['audit-event-1'],
    approvalIds: [],
    readinessOnly: true,
    externalCertificationClaimed: false,
  };

  assert.deepEqual(validateDomainEntity(securityEvent), { valid: true, errors: [] });
  assert.deepEqual(validateDomainEntity(complianceRecord), { valid: true, errors: [] });
  assert.ok(validateDomainEntity({ ...securityEvent, evidence: [] }).errors.includes('security-event requires evidence'));
  assert.ok(validateDomainEntity({ ...complianceRecord, externalCertificationClaimed: true }).errors.includes('compliance-record must not claim external certification'));
});
