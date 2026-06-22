import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IncidentService,
  InMemoryPostgresRecordStore,
  initializeRepositoryPersistence,
  loadSnapshot,
  resetPostgresRecordStoreForTests,
  resetRepositorySnapshotsForTests,
  setPostgresClientAvailableForTests,
  setPostgresRecordStoreForTests,
} from '../dist/index.js';
import { createApiFacadeState, handleApiRequest } from '../dist/server.js';

const adminHeaders = {
  'x-trackmind-role': 'platform-super-admin',
  'x-trackmind-tenant-id': 'trackmind',
  'x-trackmind-racetrack-id': 'main-track',
  'x-trackmind-organization-id': 'org-trackmind-network',
};

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

test('incident service persists create/triage/review across service recreation', async () => {
  resetRepositorySnapshotsForTests();
  resetPostgresRecordStoreForTests();
  const previousMode = process.env.TRACKMIND_PERSISTENCE_MODE;
  const previousUrl = process.env.TRACKMIND_DATABASE_URL;
  enableMockPostgres();

  const first = new IncidentService();
  const created = first.create({
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    title: 'Durable incident',
    description: 'Verify postgres-backed incident store.',
    severity: 'medium',
    status: 'reported',
    category: 'safety',
    reportedBy: 'security-officer',
    assignedTo: 'race-day-operations-manager',
  });
  first.triage(created.id, {
    severity: 'high',
    assignedTo: 'race-day-operations-manager',
    actor: 'race-day-operations-manager',
    note: 'Escalated for durability test',
  });
  first.update(created.id, { status: 'resolved', actor: 'race-day-operations-manager' });
  first.submitPostIncidentReview(created.id, {
    findings: [{ finding: 'Gate latch failed', severity: 'medium', owner: 'facilities' }],
    submittedBy: 'race-day-operations-manager',
  });

  await new Promise((resolve) => setTimeout(resolve, 25));
  resetRepositorySnapshotsForTests();
  await initializeRepositoryPersistence();

  const reloaded = new IncidentService();
  const incident = reloaded.get(created.id);
  assert.ok(incident, 'incident should reload from postgres namespace');
  assert.equal(incident.title, 'Durable incident');
  assert.equal(incident.status, 'resolved');
  assert.equal(incident.severity, 'high');
  assert.ok(incident.timeline.some((entry) => entry.action === 'status:triaged'));
  assert.ok(incident.timeline.some((entry) => entry.action === 'post-incident-review:submitted'));

  const reviews = reloaded.listPostIncidentReviews(created.id);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].findings[0].finding, 'Gate latch failed');

  const snapshot = loadSnapshot('platform.incidents');
  assert.ok(snapshot?.some((record) => record.id === created.id));

  restorePersistenceEnv(previousMode, previousUrl);
});

test('incident API facade reloads persisted incidents and SSE timeline stream', async () => {
  resetRepositorySnapshotsForTests();
  resetPostgresRecordStoreForTests();
  const previousMode = process.env.TRACKMIND_PERSISTENCE_MODE;
  const previousUrl = process.env.TRACKMIND_DATABASE_URL;
  enableMockPostgres();

  const firstState = createApiFacadeState();
  const created = await handleApiRequest('POST', '/api/v1/incidents', {
    title: 'Facade durable incident',
    description: 'API round-trip persistence',
    severity: 'low',
    category: 'operations',
    reportedBy: 'ops-lead',
  }, firstState, adminHeaders);
  assert.equal(created.status, 201);
  const incidentId = created.body.id;

  const triageResponse = await handleApiRequest('POST', `/api/v1/incidents/${incidentId}/triage`, {
    severity: 'medium',
    assignedTo: 'race-day-operations-manager',
    actor: 'race-day-operations-manager',
  }, firstState, adminHeaders);
  assert.equal(triageResponse.status, 200);

  await new Promise((resolve) => setTimeout(resolve, 25));
  resetRepositorySnapshotsForTests();
  await initializeRepositoryPersistence();

  const secondState = createApiFacadeState();
  const reloaded = await handleApiRequest('GET', `/api/v1/incidents/${incidentId}`, undefined, secondState, adminHeaders);
  assert.equal(reloaded.status, 200);
  assert.equal(reloaded.body.title, 'Facade durable incident');
  assert.equal(reloaded.body.status, 'triaged');

  const timeline = await handleApiRequest('GET', `/api/v1/incidents/${incidentId}/timeline`, undefined, secondState, adminHeaders);
  assert.equal(timeline.status, 200);
  assert.equal(timeline.body.incidentId, incidentId);
  assert.ok(timeline.body.entries.length >= 2);

  const stream = await handleApiRequest('GET', `/api/v1/incidents/${incidentId}/timeline/stream`, undefined, secondState, adminHeaders);
  assert.equal(stream.status, 200);
  assert.match(String(stream.body), /event: snapshot/);
  assert.match(String(stream.body), /event: heartbeat/);
  assert.match(String(stream.body), new RegExp(`"incidentId":"${incidentId}"`));

  restorePersistenceEnv(previousMode, previousUrl);
});
