import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('frontend has one canonical entrypoint and app shell', async () => {
  const main = await source('src/main.tsx');
  const app = await source('src/App.tsx');
  assert.match(main, /createRoot\(root\)\.render/);
  assert.match(app, /<AppShell \/>/);
});

test('route constants cover required backend-driven sections', async () => {
  const routes = await source('src/routes/routes.ts');
  for (const path of [
    '/dashboard',
    '/race-day',
    '/equine',
    '/approvals',
    '/incidents',
    '/compliance',
    '/security',
    '/facilities',
    '/ticketing',
    '/finance',
    '/federation',
    '/data-hub',
    '/audit',
    '/admin',
    '/settings',
  ]) {
    assert.match(routes, new RegExp(`path: '${path}'`), `${path} route missing`);
  }
  assert.match(routes, /supportStatus: 'mock-adapter'/);
  assert.match(routes, /backendPaths: \[\]/);
  for (const alias of ['/operations', '/command-center', '/starting-gate', '/api-hub', '/api-hub-dashboard', '/audit-ledger']) {
    assert.match(routes, new RegExp(alias.replace(/\//g, '\\/')), `${alias} compatibility alias missing`);
  }
  assert.match(routes, /normalized\.startsWith\(`\$\{alias\}\/`\)/);
});

test('components do not call raw fetch or render forbidden execution controls', async () => {
  const page = await source('src/pages/WorkspacePage.tsx');
  const shell = await source('src/shell/AppShell.tsx');
  const router = await source('src/routes/Router.tsx');
  assert.doesNotMatch(page, /\bfetch\(/);
  assert.doesNotMatch(shell, /\bfetch\(/);
  assert.doesNotMatch(router, /\bfetch\(/);
  for (const unsafe of ['Start race', 'Stop race', 'Finalize results', 'Scratch horse', 'Administer medication', 'Issue payout']) {
    assert.doesNotMatch(page, new RegExp(unsafe, 'i'));
  }
  assert.match(page, /Request approval/);
  assert.match(page, /Open audit trail/);
  assert.match(page, /disabled title="Read-only until a governed endpoint is wired\."/);
  assert.match(page, /navigateWithinShell/);
  assert.match(page, /Governed KPI Artifacts/);
  assert.match(page, /Data quality/);
});

test('frontend route filtering honors required roles and tenant scope headers', async () => {
  const shell = await source('src/shell/AppShell.tsx');
  const router = await source('src/routes/Router.tsx');
  const support = await source('src/domain/support.ts');
  const client = await source('src/api/client.ts');
  assert.match(support, /canViewRoute/);
  assert.match(shell, /canViewRoute\(route, defaultTenantContext\.role\)/);
  assert.match(router, /canViewRoute\(route, defaultTenantContext\.role\)/);
  assert.match(client, /x-trackmind-tenant-id/);
  assert.match(client, /x-trackmind-racetrack-id/);
  assert.match(client, /x-trackmind-organization-id/);
  assert.match(client, /x-trackmind-role/);
  assert.doesNotMatch(client, /searchParams\.set\('role'/);
  assert.match(support, /scopeSource: 'demo-reference-context'/);
  assert.match(shell, /Demo context only/);
});

test('mock data is isolated from React components', async () => {
  const mock = await source('src/mocks/domainMocks.ts');
  const page = await source('src/pages/WorkspacePage.tsx');
  assert.match(mock, /mockUnsupportedDomain/);
  assert.doesNotMatch(page, /mockUnsupportedDomain/);
});

test('vite proxy does not capture api-hub frontend deep links', async () => {
  const viteConfig = await source('vite.config.ts');
  assert.match(viteConfig, /'\/api\/v1'/);
  assert.doesNotMatch(viteConfig, /'\/api':/);
});

test('frontend KPI adapter uses the central API service layer', async () => {
  const services = await source('src/api/services.ts');
  const paths = await source('src/api/paths.ts');
  assert.match(paths, /workspace: '\/kpis'/);
  assert.match(services, /getJson<KPIWorkspaceDto>/);
  assert.match(services, /requireReady/);
  assert.match(services, /routeKpiDomains/);
});
