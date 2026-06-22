import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createRaceOperationsHttpServer,
  createRaceOperationsService,
  createPlatformReadAdapter,
} from '../../dist/index.js';

const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function readServiceFile(name) {
  return readFile(resolve(serviceRoot, name), 'utf8');
}

test('race operations service publishes required operational API endpoints', async () => {
  const openapi = await readServiceFile('openapi.yaml');

  for (const path of ['/health:', '/ready:', '/live:', '/metrics:', '/race-office:', '/dashboard:', '/races:']) {
    assert.match(openapi, new RegExp(`^  ${path}`, 'm'));
  }
  assert.match(openapi, /^openapi: 3\.1\.0$/m);
});

test('race operations service catalog preserves governance and extraction metadata', async () => {
  const catalog = await readServiceFile('service.catalog.yaml');

  assert.match(catalog, /^  tenantIsolation: required$/m);
  assert.match(catalog, /^  extractionStatus: read-models-delegated$/m);
  assert.match(catalog, /race-start/);
  assert.match(catalog, /official-results/);
});

test('race operations service boundary delegates read models through adapter', () => {
  const platform = {
    raceOfficeWorkspace: () => ({
      meets: [{ id: 'meet-1', name: 'Spring Meet', trackId: 'trk-1', status: 'open' }],
      raceDays: [],
      cards: [],
      readiness: [],
      approvalControls: [],
      lifecycle: [],
    }),
    operationalDashboard: (now) => ({
      generatedAt: now ?? '2026-06-13T18:00:00Z',
      totals: { all: 0, draft: 0, scheduled: 0, 'entries-open': 0, declared: 0, 'post-positions-drawn': 0, ready: 0, running: 0, official: 0, cancelled: 0 },
      byTrack: [],
      upcoming: [],
      resourceExceptions: [],
      staffingExceptions: [],
      executionAlerts: [],
    }),
    listRaces: () => [{ id: 'race-1' }],
    getRace: (raceId) => ({ id: raceId, status: 'ready' }),
    operationalReport: (raceId) => ({ raceId, status: 'ready', entries: 2 }),
  };

  const service = createRaceOperationsService({
    readPort: createPlatformReadAdapter(platform),
    tenantId: 'tenant-1',
  });

  assert.equal(service.raceOfficeWorkspace('2026-06-13T18:00:00Z', false).mock, false);
  assert.equal(service.raceOfficeWorkspace('2026-06-13T18:00:00Z', false).meets[0].id, 'meet-1');
  assert.equal(service.listRaces().length, 1);
  assert.equal(service.operationalReport('race-1').entries, 2);
});

test('race operations HTTP server serves health and read-model routes', async () => {
  const service = createRaceOperationsService({
    readPort: createPlatformReadAdapter({
      raceOfficeWorkspace: () => ({
        meets: [],
        raceDays: [],
        cards: [{ id: 'race-7', raceNumber: 7, status: 'ready', conditions: { surface: 'dirt', eligibility: [] }, entries: [], approvals: {} }],
        readiness: [],
        approvalControls: [],
        lifecycle: [],
      }),
      operationalDashboard: (now) => ({
        generatedAt: now ?? '2026-06-13T18:00:00Z',
        totals: { all: 1, draft: 0, scheduled: 0, 'entries-open': 0, declared: 0, 'post-positions-drawn': 0, ready: 1, running: 0, official: 0, cancelled: 0 },
        byTrack: [],
        upcoming: [],
        resourceExceptions: [],
        staffingExceptions: [],
        executionAlerts: [],
      }),
      listRaces: () => [{ id: 'race-7' }],
      getRace: (raceId) => ({ id: raceId }),
      operationalReport: (raceId) => ({ raceId }),
    }),
  });

  const httpServer = createRaceOperationsHttpServer({ service, port: 0 });
  await httpServer.listen();
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.service, 'race-operations-service');

    const raceOffice = await fetch(`${base}/race-office`);
    assert.equal(raceOffice.status, 200);
    const raceOfficeBody = await raceOffice.json();
    assert.equal(raceOfficeBody.cards[0].id, 'race-7');
  } finally {
    await httpServer.close();
  }
});
