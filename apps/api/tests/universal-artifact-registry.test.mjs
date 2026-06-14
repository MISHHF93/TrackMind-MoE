import assert from 'node:assert/strict';
import test from 'node:test';
import { UniversalArtifactRegistryService, universalArtifactRegistryApiDefinition } from '../dist/universalArtifactRegistry.js';

const principal = { id: 'artifact-admin-1', tenantId: 'tenant-a', racetrackId: 'main-track', scopes: ['artifacts:read', 'artifacts:write'], actorType: 'human' };
const tenantB = { id: 'artifact-admin-2', tenantId: 'tenant-b', racetrackId: 'main-track', scopes: ['artifacts:read', 'artifacts:write'], actorType: 'human' };

const baseArtifact = {
  artifactId: 'ART-READINESS-001',
  artifactType: 'readiness-report',
  schemaVersion: 'trackmind.readiness-report.v1',
  owner: 'RaceOps',
  source: { system: 'race-day-readiness', id: 'readiness:RACE-7', type: 'workflow-output', eventId: 'evt-readiness-1' },
  lineage: { parentArtifactIds: ['ART-SURFACE-001'], sourceEventIds: ['evt-surface-1'], sourceAuditIds: ['audit-surface-1'], relatedTwinIds: ['twin:race:RACE-7'] },
  evidence: [{ id: 'evidence-readiness-1', uri: 's3://trackmind-evidence/readiness-1.json', hash: 'sha256:readiness' }],
  storageRefs: [{ id: 'lakehouse-readiness-1', uri: 's3://trackmind-lakehouse/artifacts/readiness-1.json', provider: 's3', contentType: 'application/json' }],
  metadata: { raceId: 'RACE-7', status: 'ready' },
};

test('universal artifact registry keeps tenant and racetrack access isolated', async () => {
  const service = new UniversalArtifactRegistryService();
  const created = await service.register(baseArtifact, principal);
  await service.register({ ...baseArtifact, artifactId: 'ART-READINESS-002', source: { ...baseArtifact.source, id: 'readiness:RACE-8' } }, tenantB);

  assert.equal(created.tenantId, 'tenant-a');
  assert.equal(created.racetrackId, 'main-track');
  assert.equal(service.query({}, principal).total, 1);
  assert.equal(service.query({}, tenantB).total, 1);
  assert.throws(() => service.get('ART-READINESS-001', tenantB), /tenant isolation violation/);
  assert.throws(() => service.query({ tenantId: 'tenant-b' }, principal), /tenant isolation violation/);
  assert.throws(() => service.query({ racetrackId: 'backside-track' }, principal), /racetrack isolation violation/);
});

test('universal artifact registry rejects duplicate artifact registrations within a tenant', async () => {
  const service = new UniversalArtifactRegistryService();
  await service.register(baseArtifact, principal);

  await assert.rejects(
    () => service.register({ ...baseArtifact, source: { ...baseArtifact.source, id: 'readiness:RACE-7:duplicate' } }, principal),
    /artifactId must be unique within tenant/,
  );

  const sameIdOtherTenant = await service.register(baseArtifact, tenantB);
  assert.equal(sameIdOtherTenant.artifactId, baseArtifact.artifactId);
  assert.equal(sameIdOtherTenant.tenantId, 'tenant-b');
});

test('universal artifact registry filters by type owner source and preserves immutable metadata', async () => {
  const service = new UniversalArtifactRegistryService();
  await service.register(baseArtifact, principal);
  await service.register({
    ...baseArtifact,
    artifactId: 'ART-SURFACE-001',
    artifactType: 'surface-model',
    schemaVersion: 'trackmind.surface-model.v2',
    owner: 'TrackSurface',
    source: { system: 'surface-intelligence', id: 'surface:model:1', type: 'model-output', auditRef: 'audit-surface-model-1' },
    metadata: { model: 'surface-v2', status: 'watch' },
  }, principal);
  await service.register({
    ...baseArtifact,
    artifactId: 'ART-COMPLIANCE-001',
    artifactType: 'compliance-dossier',
    owner: 'RegulatoryOps',
    source: { system: 'regulatory-operations', id: 'case:HISA-1', type: 'case-file' },
    metadata: { caseId: 'HISA-1' },
  }, principal);

  assert.equal(service.query({ artifactType: 'surface-model' }, principal).total, 1);
  assert.equal(service.query({ owner: 'RegulatoryOps' }, principal).artifacts[0].artifactId, 'ART-COMPLIANCE-001');
  assert.equal(service.query({ sourceSystem: 'race-day-readiness' }, principal).total, 1);
  assert.equal(service.query({ source: 'case:HISA-1' }, principal).artifacts[0].owner, 'RegulatoryOps');

  const updated = await service.updateMetadata('ART-COMPLIANCE-001', {
    metadata: { packageStatus: 'submitted' },
    evidence: [{ id: 'evidence-compliance-2', uri: 's3://trackmind-evidence/hisa-1.pdf', hash: 'sha256:hisa' }],
    storageRefs: [{ id: 'vault-compliance-1', uri: 'vault://compliance/hisa-1', provider: 'vault' }],
    lineage: { sourceAuditIds: ['audit-compliance-submit-1'], relatedTwinIds: ['twin:regulatory:HISA-1'] },
  }, principal, { reason: 'submit compliance dossier', correlationId: 'corr-artifact-1' });

  assert.equal(updated.version, 2);
  assert.equal(updated.owner, 'RegulatoryOps');
  assert.equal(updated.metadata.packageStatus, 'submitted');
  assert.equal(updated.updateHistory.at(-1).reason, 'submit compliance dossier');
  assert.ok(updated.auditRefs.length >= 2);
  assert.ok(updated.eventRefs.length >= 2);
  assert.ok(service.eventBus.events({ type: 'artifact.registry.metadata-updated', correlationId: 'corr-artifact-1' }).length >= 1);
  assert.equal(service.auditLog.verify().valid, true);
  await assert.rejects(() => service.updateMetadata('ART-COMPLIANCE-001', { artifactType: 'changed' }, principal), /immutable artifact field cannot be updated/);
});

test('universal artifact registry returns serializable plain artifact entries', async () => {
  const service = new UniversalArtifactRegistryService();
  const artifact = await service.register(baseArtifact, principal);
  const parsed = JSON.parse(JSON.stringify(artifact));

  assert.deepEqual(parsed, artifact);
  assert.equal(parsed.artifactId, 'ART-READINESS-001');
  assert.equal(parsed.lineage.relatedTwinIds[0], 'twin:race:RACE-7');
  assert.equal(parsed.auditRefs.length, 1);
  assert.equal(parsed.eventRefs.length, 1);

  const apiDefinition = universalArtifactRegistryApiDefinition();
  assert.equal(apiDefinition.id, 'universal-artifact-registry');
  assert.ok(apiDefinition.endpoints.some((endpoint) => endpoint.path === '/{artifactId}/metadata'));
});
