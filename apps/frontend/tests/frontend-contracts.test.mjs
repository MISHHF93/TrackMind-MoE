import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const repoRoot = resolve(root, '../..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

async function repoSource(path) {
  return readFile(resolve(repoRoot, path), 'utf8');
}

test('frontend has canonical entrypoint and control surface shell', async () => {
  const main = await source('src/main.tsx');
  const app = await source('src/App.tsx');
  assert.match(main, /createRoot\(root\)\.render/);
  assert.match(main, /applyTheme\(loadTheme\(\)\)/);
  assert.match(main, /theme\/tokens\.css/);
  assert.match(main, /design\/tokens\.css/);
  assert.match(app, /<AppShell \/>/);
});

test('route constants cover required backend-driven sections', async () => {
  const routes = await source('src/routes/routes.ts');
  const paths = await source('src/api/paths.ts');
  for (const path of ['/dashboard', '/race-day', '/equine', '/approvals', '/incidents', '/compliance', '/security', '/facilities', '/ticketing', '/finance', '/federation', '/data-hub', '/audit', '/admin', '/settings']) {
    assert.match(routes, new RegExp(`path: '${path}'`), `${path} route missing`);
  }
  assert.match(paths, /routeApiPathGroups/);
  assert.match(routes, /backendContractPathsForRoute/);
});

test('control surface layout tokens remain stable', async () => {
  const tokens = await source('src/theme/tokens.css');
  assert.match(tokens, /--shell-nav-width: 18rem/);
  assert.match(tokens, /--shell-aside-width: 21rem/);
  assert.match(tokens, /--page-max-width: 86rem/);
});

test('frontend uses actionable console loaders wired to backend paths', async () => {
  const registry = await source('src/consoles/registry.ts');
  const commandCenter = await source('src/api/loaders/commandCenter.ts');
  const router = await source('src/app/Router.tsx');
  const components = await source('src/design/components.tsx');
  assert.match(registry, /consoleRegistry/);
  assert.match(registry, /loadCommandCenterConsole/);
  assert.match(commandCenter, /getJson<OperationsCommandCenterDto>/);
  assert.match(commandCenter, /lifecycleLanes/);
  assert.match(router, /consoleRegistry\[route\.id\]/);
  assert.match(router, /setActiveConsole/);
  assert.match(components, /CommandStrip/);
  assert.match(components, /PriorityQueue/);
  assert.match(components, /ChartRail/);
  assert.match(components, /OpsButton/);
  assert.match(components, /ConsoleSurface/);
});

test('frontend forbids protected execution controls in console actions', async () => {
  const loadersDir = await source('src/api/loaders/commandCenter.ts');
  const design = await source('src/design/components.tsx');
  const forbidden = ['Start race', 'Stop race', 'Release payout', 'Execute maintenance', 'Dispatch emergency'];
  for (const label of forbidden) {
    assert.doesNotMatch(loadersDir, new RegExp(`label: '${label}'`));
    assert.doesNotMatch(design, new RegExp(`>${label}<`));
  }
  assert.match(loadersDir, /navAction\(/);
});

test('frontend route filtering honors tenant scope headers', async () => {
  const shell = await source('src/shell/AppShell.tsx');
  const router = await source('src/app/Router.tsx');
  const client = await source('src/api/client.ts');
  assert.match(shell, /canViewRoute\(route, tenantSession\.role\)/);
  assert.match(router, /useTenantSession/);
  assert.match(router, /sessionKey/);
  assert.match(client, /getTenantContext\(\)/);
  assert.match(client, /x-trackmind-tenant-id/);
  assert.match(client, /x-trackmind-role/);
});

test('frontend keeps consoles accessible when API adapters fail', async () => {
  const router = await source('src/app/Router.tsx');
  const unavailable = await source('src/app/unavailableConsole.ts');
  assert.match(router, /createUnavailableConsole\(route, message\)/);
  assert.match(unavailable, /Backend unavailable/);
});

test('frontend backend route paths are declared in shared endpoint contracts', async () => {
  const paths = await source('src/api/paths.ts');
  const sharedContracts = await repoSource('packages/shared/src/apiContracts.ts');
  const routeBackendPaths = [...paths.matchAll(/routeApiPathGroups = \{([\s\S]*?)\} as const/g)]
    .flatMap((match) => [...match[1].matchAll(/apiPaths\.[a-zA-Z0-9]+\.[a-zA-Z0-9]+/g)].map((pathMatch) => pathMatch[0]))
    .map((apiRef) => {
      const [, group, key] = apiRef.split('.');
      const groupBlock = paths.match(new RegExp(`${group}: \\{([\\s\\S]*?)\\n  \\}`))?.[1] ?? '';
      return groupBlock.match(new RegExp(`${key}: '([^']+)'`))?.[1];
    })
    .filter(Boolean)
    .map((path) => `/api/v1${path}`);
  const sharedEndpointPaths = [...sharedContracts.matchAll(/path:'([^']+)'/g)].map((match) => match[1]);
  for (const backendPath of routeBackendPaths) {
    const declared = sharedEndpointPaths.some((contractPath) => {
      if (contractPath === backendPath) return true;
      const templatePattern = contractPath.replace(/\{[^/]+\}/g, '[^/]+');
      return new RegExp(`^${templatePattern}$`).test(backendPath);
    });
    assert.ok(declared, `${backendPath} missing from shared apiEndpointContracts`);
  }
});

test('frontend theme persists and defaults to light mode', async () => {
  const theme = await source('src/theme/theme.ts');
  const shell = await source('src/shell/AppShell.tsx');
  assert.match(theme, /return storedTheme \?\? 'light'/);
  assert.match(shell, /persistTheme\(theme\)/);
});
