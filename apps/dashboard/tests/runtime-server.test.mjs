import assert from 'node:assert/strict';
import test from 'node:test';
import { createTrackMindDashboardServer } from '../dist/server.js';

test('dashboard runtime server renders the command center shell', async () => {
  const originalApiBase = process.env.TRACKMIND_API_BASE_URL;
  process.env.TRACKMIND_API_BASE_URL = 'http://127.0.0.1:1/api/v1';
  const server = createTrackMindDashboardServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${port}/operations`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /TrackMind Nexus/);
    assert.match(body, /Unified Operations Command Center/);
    assert.doesNotMatch(body, /Starting Gate Control Workspace/);
    assert.match(body, /mock fallback/);
    assert.doesNotMatch(body, /ECONNREFUSED|fetch failed/);
    assert.match(body, /Degraded service/);
    assert.match(body, /Quick-access command palette/);
    assert.match(body, /Tenant racetrack selector/);
    assert.match(body, /skip-link/);
    assert.match(body, /prefers-reduced-motion/);
    assert.match(body, /focus-visible/);
    assert.match(body, /--tm-space-3/);
    assert.match(body, /--tm-radius-lg/);
    assert.match(body, /--tm-layout-page-max/);
    assert.match(body, /--tm-layout-shell-max/);
    assert.match(body, /--tm-elevation-panel/);
    assert.match(body, /--tm-color-status-warning-bg/);
    assert.match(body, /--tm-color-risk-critical/);
    assert.match(body, /background-color: var\(--tm-risk-background-high\)/);
    assert.match(body, /Legacy aliases are quarantined/);
    assert.match(body, /render-mode-banner/);
    assert.match(body, /route-content-frame/);
    assert.match(body, /\.route-content-frame/);
    assert.match(body, /track-map-canvas/);
    assert.match(body, /grid-template-columns: repeat\(var\(--tm-track-sector-count\)/);
    assert.match(body, /left: var\(--tm-map-marker-left\)/);
    assert.match(body, /max-width: 900px/);
    assert.match(body, /max-width: 640px/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (originalApiBase === undefined) delete process.env.TRACKMIND_API_BASE_URL;
    else process.env.TRACKMIND_API_BASE_URL = originalApiBase;
  }
});

test('dashboard runtime server preserves role-filtered navigation during SSR fallback', async () => {
  const originalApiBase = process.env.TRACKMIND_API_BASE_URL;
  const originalRoles = process.env.TRACKMIND_ROLES;
  process.env.TRACKMIND_API_BASE_URL = 'http://127.0.0.1:1/api/v1';
  process.env.TRACKMIND_ROLES = 'read-only-auditor';
  const server = createTrackMindDashboardServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${port}/starting-gate`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /Active route[\s\S]*\/starting-gate[\s\S]*Starting Gate Control/);
    assert.doesNotMatch(body, /<a href="\/starting-gate" aria-current="page"/);
    assert.match(body, /Permission denied for this workspace/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (originalApiBase === undefined) delete process.env.TRACKMIND_API_BASE_URL;
    else process.env.TRACKMIND_API_BASE_URL = originalApiBase;
    if (originalRoles === undefined) delete process.env.TRACKMIND_ROLES;
    else process.env.TRACKMIND_ROLES = originalRoles;
  }
});

test('dashboard runtime server redirects legacy workspace routes to canonical shell paths', async () => {
  const server = createTrackMindDashboardServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const redirects = [
      ['/surface-intelligence/sectors/far-turn?panel=moisture', '/surface/sectors/far-turn?panel=moisture'],
      ['/safety-center/readiness?panel=all', '/safety/readiness?panel=all'],
      ['/security-operations/incidents', '/security/incidents'],
      ['/emergency-operations/plans', '/emergency/plans'],
      ['/racing-data-api-hub/providers', '/api-hub/providers'],
    ];
    for (const [from, to] of redirects) {
      const response = await fetch(`http://127.0.0.1:${port}${from}`, { redirect: 'manual' });
      const body = await response.text();
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), to);
      assert.match(body, /TrackMind Nexus route moved/);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('dashboard runtime server renders unknown routes through not-found shell', async () => {
  const originalApiBase = process.env.TRACKMIND_API_BASE_URL;
  process.env.TRACKMIND_API_BASE_URL = 'http://127.0.0.1:1/api/v1';
  const server = createTrackMindDashboardServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${port}/legacy-one-page-dashboard`);
    const body = await response.text();
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('location'), null);
    assert.match(body, /Route not found in TrackMind Nexus/);
    assert.match(body, /Legacy Route Quarantine/);
    assert.match(body, /data-active-workspace="not-found"/);
    assert.doesNotMatch(body, /Unified Operations Command Center/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (originalApiBase === undefined) delete process.env.TRACKMIND_API_BASE_URL;
    else process.env.TRACKMIND_API_BASE_URL = originalApiBase;
  }
});

test('dashboard runtime server exposes health endpoint', async () => {
  const server = createTrackMindDashboardServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, 'trackmind-dashboard');
    assert.equal(body.status, 'healthy');
    assert.equal(body.observability.structuredLogs, true);
    assert.equal(body.observability.degradedFallbackMode, 'mock-read-only');
    assert.equal(response.headers.get('x-trackmind-request-id'), body.requestId);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
