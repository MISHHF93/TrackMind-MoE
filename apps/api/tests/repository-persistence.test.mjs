import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ImmutableAuditLog,
  appendAudit,
  createAuditPersistenceAdapter,
  createNamespacedRepository,
  getApprovalRepository,
  getRepositoryEnvironment,
  InMemoryPostgresRecordStore,
  initializeRepositoryPersistence,
  loadSnapshot,
  resetApprovalRepositoryForTests,
  resetPostgresRecordStoreForTests,
  resetRepositorySnapshotsForTests,
  setPostgresClientAvailableForTests,
  setPostgresRecordStoreForTests,
  wireRepositoryAdaptersOnBoot,
} from '../dist/index.js';
import { bootstrapTrackMindApi, createApiFacadeState, handleApiRequest } from '../dist/server.js';

const adminHeaders = {
  'x-trackmind-role': 'platform-super-admin',
  'x-trackmind-tenant-id': 'trackmind',
  'x-trackmind-racetrack-id': 'main-track',
  'x-trackmind-organization-id': 'org-trackmind-network',
};

test('repository round-trip persistence reloads namespaced records', () => {
  resetRepositorySnapshotsForTests();
  resetApprovalRepositoryForTests();

  const tenantRepo = createNamespacedRepository('platform.tenants', []);
  tenantRepo.upsert({
    id: 'tenant-roundtrip',
    organizationId: 'org-trackmind-network',
    name: 'Round-trip Tenant',
    status: 'active',
    racetrackIds: [],
    dataBoundary: 'us-east',
    isolationMode: 'shared-schema',
    featureFlags: [],
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
    mock: false,
  });

  const reloadedTenantRepo = createNamespacedRepository('platform.tenants', []);
  assert.equal(reloadedTenantRepo.get('tenant-roundtrip')?.name, 'Round-trip Tenant');
  assert.equal(loadSnapshot('platform.tenants')?.length, 1);

  const approvalRepo = getApprovalRepository();
  approvalRepo.upsert({
    id: 'approval-roundtrip',
    request: { id: 'approval-roundtrip', status: 'pending' },
    auditIds: ['audit-1'],
    eventIds: ['event-1'],
    updatedAt: '2026-06-20T00:00:00.000Z',
  });
  resetApprovalRepositoryForTests();
  assert.equal(getApprovalRepository().get('approval-roundtrip')?.auditIds[0], 'audit-1');

  const ledger = new ImmutableAuditLog();
  const adapter = createAuditPersistenceAdapter(ledger);
  appendAudit({ ledger, adapter }, {
    type: 'repository.test',
    id: 'audit-roundtrip-1',
    actor: 'tester',
    subjectId: 'tenant-roundtrip',
    severity: 'info',
    reason: 'round-trip audit',
    timestamp: '2026-06-20T00:00:00.000Z',
  });
  const reloadedAuditRepo = createNamespacedRepository('platform.audit', []);
  assert.ok(reloadedAuditRepo.list().some((event) => event.reason === 'round-trip audit'));
});

test('tenant service repositories persist organizations across service recreation', async () => {
  resetRepositorySnapshotsForTests();

  const firstState = createApiFacadeState();
  const created = await handleApiRequest('POST', '/api/v1/platform/organizations', { name: 'Persisted Org' }, firstState, adminHeaders);
  assert.equal(created.status, 201);

  const secondState = createApiFacadeState();
  const orgList = await handleApiRequest('GET', '/api/v1/platform/organizations', undefined, secondState, adminHeaders);
  assert.equal(orgList.status, 200);
  assert.ok(orgList.body.some((org) => org.id === created.body.id && org.name === 'Persisted Org'));
});

test('GET /platform/environment exposes repository readiness flags', async () => {
  resetRepositorySnapshotsForTests();
  const state = createApiFacadeState();
  const env = await handleApiRequest('GET', '/api/v1/platform/environment', undefined, state, adminHeaders);

  assert.equal(env.status, 200);
  assert.equal(env.body.persistenceMode, 'in-memory');
  assert.equal(env.body.repository.mode, 'in-memory');
  assert.equal(env.body.repository.wired, true);
  assert.equal(env.body.repository.postgresReady, false);
  assert.equal(typeof env.body.repository.pgClientAvailable, 'boolean');
  assert.equal(env.body.repository.usingFallback, false);

  const status = getRepositoryEnvironment();
  assert.equal(status.mode, 'in-memory');
  assert.equal(status.wired, true);
});

test('postgres mode without pg client reports fallback readiness', () => {
  resetRepositorySnapshotsForTests();
  resetPostgresRecordStoreForTests();
  const previousMode = process.env.TRACKMIND_PERSISTENCE_MODE;
  const previousUrl = process.env.TRACKMIND_DATABASE_URL;

  process.env.TRACKMIND_PERSISTENCE_MODE = 'postgres';
  process.env.TRACKMIND_DATABASE_URL = 'postgres://trackmind:secret@localhost:5432/trackmind';
  setPostgresClientAvailableForTests(false);

  const status = getRepositoryEnvironment();
  assert.equal(status.mode, 'postgres');
  assert.equal(status.wired, true);
  assert.equal(status.postgresReady, false);
  assert.equal(status.usingFallback, true);
  assert.equal(status.pgClientAvailable, false);

  if (previousMode === undefined) delete process.env.TRACKMIND_PERSISTENCE_MODE;
  else process.env.TRACKMIND_PERSISTENCE_MODE = previousMode;
  if (previousUrl === undefined) delete process.env.TRACKMIND_DATABASE_URL;
  else process.env.TRACKMIND_DATABASE_URL = previousUrl;
  resetPostgresRecordStoreForTests();
});

test('postgres mode with mock store durably reloads namespaced records', async () => {
  resetRepositorySnapshotsForTests();
  resetPostgresRecordStoreForTests();
  resetApprovalRepositoryForTests();

  const previousMode = process.env.TRACKMIND_PERSISTENCE_MODE;
  const previousUrl = process.env.TRACKMIND_DATABASE_URL;

  process.env.TRACKMIND_PERSISTENCE_MODE = 'postgres';
  process.env.TRACKMIND_DATABASE_URL = 'postgres://trackmind:secret@localhost:5432/trackmind';
  setPostgresClientAvailableForTests(true);
  const pgStore = new InMemoryPostgresRecordStore();
  setPostgresRecordStoreForTests(pgStore);

  const tenantRepo = createNamespacedRepository('platform.tenants', []);
  tenantRepo.upsert({
    id: 'tenant-pg',
    organizationId: 'org-trackmind-network',
    name: 'Postgres Tenant',
    status: 'active',
    racetrackIds: [],
    dataBoundary: 'us-east',
    isolationMode: 'shared-schema',
    featureFlags: [],
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
    mock: false,
  });

  await new Promise((resolve) => setTimeout(resolve, 25));
  resetRepositorySnapshotsForTests();
  await initializeRepositoryPersistence();

  const reloadedTenantRepo = createNamespacedRepository('platform.tenants', []);
  assert.equal(reloadedTenantRepo.get('tenant-pg')?.name, 'Postgres Tenant');

  const status = getRepositoryEnvironment();
  assert.equal(status.mode, 'postgres');
  assert.equal(status.postgresReady, true);
  assert.equal(status.usingFallback, false);
  assert.equal(status.pgClientAvailable, true);

  resetPostgresRecordStoreForTests();
  if (previousMode === undefined) delete process.env.TRACKMIND_PERSISTENCE_MODE;
  else process.env.TRACKMIND_PERSISTENCE_MODE = previousMode;
  if (previousUrl === undefined) delete process.env.TRACKMIND_DATABASE_URL;
  else process.env.TRACKMIND_DATABASE_URL = previousUrl;
});

function enableMockPostgres() {
  process.env.TRACKMIND_PERSISTENCE_MODE = 'postgres';
  process.env.TRACKMIND_DATABASE_URL = 'postgres://trackmind:secret@localhost:5432/trackmind';
  setPostgresClientAvailableForTests(true);
  const pgStore = new InMemoryPostgresRecordStore();
  setPostgresRecordStoreForTests(pgStore);
  return pgStore;
}

function restorePersistenceEnv(previousMode, previousUrl) {
  resetPostgresRecordStoreForTests();
  if (previousMode === undefined) delete process.env.TRACKMIND_PERSISTENCE_MODE;
  else process.env.TRACKMIND_PERSISTENCE_MODE = previousMode;
  if (previousUrl === undefined) delete process.env.TRACKMIND_DATABASE_URL;
  else process.env.TRACKMIND_DATABASE_URL = previousUrl;
}

test('bootstrapTrackMindApi hydrates tenant, approval, and audit adapters from postgres', async () => {
  resetRepositorySnapshotsForTests();
  resetPostgresRecordStoreForTests();
  resetApprovalRepositoryForTests();

  const previousMode = process.env.TRACKMIND_PERSISTENCE_MODE;
  const previousUrl = process.env.TRACKMIND_DATABASE_URL;
  enableMockPostgres();

  const firstState = createApiFacadeState();
  const created = await handleApiRequest(
    'POST',
    '/api/v1/platform/organizations',
    { name: 'Boot Wired Org' },
    firstState,
    adminHeaders,
  );
  assert.equal(created.status, 201);

  const approvalRepo = getApprovalRepository();
  approvalRepo.upsert({
    id: 'approval-boot',
    request: { id: 'approval-boot', status: 'pending' },
    auditIds: ['audit-boot-1'],
    eventIds: ['event-boot-1'],
    updatedAt: '2026-06-20T00:00:00.000Z',
  });

  const ledger = new ImmutableAuditLog();
  const adapter = createAuditPersistenceAdapter(ledger);
  appendAudit({ ledger, adapter }, {
    type: 'repository.boot',
    id: 'audit-boot-1',
    actor: 'tester',
    subjectId: created.body.id,
    severity: 'info',
    reason: 'boot wiring audit',
    timestamp: '2026-06-20T00:00:00.000Z',
  });

  await new Promise((resolve) => setTimeout(resolve, 25));
  resetRepositorySnapshotsForTests();
  resetApprovalRepositoryForTests();

  await bootstrapTrackMindApi();

  const secondState = createApiFacadeState();
  const orgList = await handleApiRequest('GET', '/api/v1/platform/organizations', undefined, secondState, adminHeaders);
  assert.equal(orgList.status, 200);
  assert.ok(orgList.body.some((org) => org.id === created.body.id && org.name === 'Boot Wired Org'));

  assert.equal(getApprovalRepository().get('approval-boot')?.auditIds[0], 'audit-boot-1');

  const auditSearch = await handleApiRequest(
    'GET',
    '/api/v1/audit/search?domain=boot',
    undefined,
    secondState,
    adminHeaders,
  );
  assert.equal(auditSearch.status, 200);
  assert.ok(auditSearch.body.some((event) => event.reason === 'boot wiring audit'));

  const env = await handleApiRequest('GET', '/api/v1/platform/environment', undefined, secondState, adminHeaders);
  assert.equal(env.body.persistenceMode, 'postgres');
  assert.equal(env.body.repository.postgresReady, true);
  assert.equal(env.body.repository.usingFallback, false);

  restorePersistenceEnv(previousMode, previousUrl);
});

test('wireRepositoryAdaptersOnBoot is a no-op when persistence mode is in-memory', async () => {
  resetRepositorySnapshotsForTests();
  const previousMode = process.env.TRACKMIND_PERSISTENCE_MODE;
  delete process.env.TRACKMIND_PERSISTENCE_MODE;

  await wireRepositoryAdaptersOnBoot();

  const status = getRepositoryEnvironment();
  assert.equal(status.mode, 'in-memory');
  assert.equal(status.postgresReady, false);

  if (previousMode === undefined) delete process.env.TRACKMIND_PERSISTENCE_MODE;
  else process.env.TRACKMIND_PERSISTENCE_MODE = previousMode;
});
