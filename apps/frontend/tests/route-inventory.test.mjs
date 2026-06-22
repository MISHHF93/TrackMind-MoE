import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

function extractRouterPaths(routerSource) {
  return [...routerSource.matchAll(/path:\s*routePathSegment\(route\)/g)].length > 0
    ? null
    : [...routerSource.matchAll(/\{ path: '([^']+)', element: guarded/g)].map((match) => match[1]);
}

test('route inventory stays synchronized across router, panels, navigation, and API paths', async () => {
  const routesSource = await source('src/routes/routes.ts');
  const routerSource = await source('src/app/router.tsx');
  const panelsSource = await source('src/workspaces/views/WorkspaceDomainPanels.tsx');
  const pathsSource = await source('src/api/paths.ts');
  const sidebarSource = await source('src/shell/Sidebar.tsx');
  const supportSource = await source('src/domain/support.ts');
  const validateSource = await source('src/routes/validateRoutes.ts');
  const workspaceSource = await source('src/workspaces/WorkspacePage.tsx');

  const guardsSource = await source('src/auth/guards.tsx');

  const routeIds = [...routesSource.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  const routePaths = [...routesSource.matchAll(/path: '(\/[^']+)'/g)].map((match) => match[1]);
  const panelCases = [...panelsSource.matchAll(/case '([^']+)':/g)].map((match) => match[1]);
  const apiGroups = [...pathsSource.matchAll(/^\s{2}([a-zA-Z]+): \[/gm)].map((match) => match[1]);
  const iconMapBlock = sidebarSource.match(/const iconMap[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  const sidebarIcons = iconMapBlock
    ? [...iconMapBlock[1].matchAll(/^\s{2}['"]?([a-zA-Z0-9-]+)['"]?:/gm)].map((match) => match[1])
    : [];

  assert.equal(routeIds.length, 24, 'expected 24 canonical workspace routes');
  assert.equal(new Set(routeIds).size, routeIds.length, 'duplicate route ids in routes.ts');
  assert.equal(new Set(routePaths).size, routePaths.length, 'duplicate route paths in routes.ts');

  for (const routeId of routeIds) {
    assert.ok(apiGroups.includes(routeId), `routeApiPathGroups missing ${routeId}`);
    assert.ok(panelCases.includes(routeId), `WorkspaceDomainPanels missing case ${routeId}`);
    assert.match(supportSource, new RegExp(`'${routeId}'`), `DomainRouteId missing ${routeId}`);
  }

  assert.match(routerSource, /routes\.map\(\(route\) => \(/, 'router must derive paths from routes.ts');
  assert.match(routerSource, /<WorkspacePage routeId=\{route\.id\} \/>/);
  assert.doesNotMatch(routerSource, /DashboardPage/);
  assert.doesNotMatch(routerSource, /from '@\/workspaces\/pages'/);

  assert.match(validateSource, /workspacePanelRouteIds/);
  assert.match(validateSource, /sidebarIconKeys/);

  for (const iconKey of [...routesSource.matchAll(/iconKey: '([^']+)'/g)].map((match) => match[1])) {
    assert.ok(sidebarIcons.includes(iconKey), `sidebar iconMap missing ${iconKey}`);
  }

  assert.match(workspaceSource, /LoadingState/);
  assert.match(workspaceSource, /ErrorState/);
  assert.match(workspaceSource, /EmptyState/);
  assert.match(workspaceSource, /DegradedStateBanner/);
  assert.match(workspaceSource, /SupportStatusBadge/);
  assert.match(routerSource, /RequireRouteAccess/);
  assert.match(guardsSource, /RequireRouteAccess/);
  assert.match(validateSource, /validateRouteInventory/);
});

test('orphaned workspace page wrappers are removed', async () => {
  await assert.rejects(() => source('src/workspaces/pages.tsx'));
});

test('every route declares permissions and navigation metadata', async () => {
  const routesSource = await source('src/routes/routes.ts');
  const permissionCount = [...routesSource.matchAll(/requiredPermission: routePermissions\./g)].length;
  const navigationCount = [...routesSource.matchAll(/navigationGroup: '/g)].length;
  const roleCount = [...routesSource.matchAll(/requiredRoles:/g)].length;

  assert.equal(permissionCount, 24);
  assert.equal(navigationCount, 24);
  assert.equal(roleCount, 24);
});

test('router does not contain hard-coded orphaned paths', async () => {
  const routerSource = await source('src/app/router.tsx');
  const routesSource = await source('src/routes/routes.ts');
  const declaredPaths = new Set([...routesSource.matchAll(/path: '(\/[^']+)'/g)].map((match) => match[1].replace(/^\//, '')));

  const legacyPaths = extractRouterPaths(routerSource) ?? [];
  for (const path of legacyPaths) {
    assert.ok(declaredPaths.has(path), `orphaned hard-coded router path: ${path}`);
  }
});
