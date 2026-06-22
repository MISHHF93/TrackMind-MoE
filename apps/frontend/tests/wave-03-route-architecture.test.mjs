import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

const wave03Routes = ['/admin', '/analytics', '/fan-experience', '/notifications'];

test('wave 03: canonical routes declare backend paths and support status', async () => {
  const routes = await source('src/routes/routes.ts');
  const paths = await source('src/api/paths.ts');

  for (const path of wave03Routes) {
    assert.match(routes, new RegExp(`path: '${path}'`), `${path} route missing`);
    assert.match(routes, new RegExp(`backendPaths: backendContractPathsForRoute\\('[^']+'\\)`));
    assert.match(routes, /supportStatus: 'live-api'/);
  }

  assert.match(paths, /analytics\/workspace/);
  assert.match(paths, /fan-experience\/workspace/);
  assert.match(paths, /notifications\/inbox/);
  assert.match(paths, /platform\/modules/);
  assert.match(paths, /platform\/feature-flags/);
});

test('wave 03: module enablement gates navigation and route guards', async () => {
  const shell = await source('src/shell/AppShell.tsx');
  const guards = await source('src/auth/guards.tsx');
  const hook = await source('src/hooks/useModuleEnablement.ts');
  const modules = await source('src/routes/routeModules.ts');
  const accessible = await source('src/domain/accessibleRoutes.ts');
  const support = await source('src/domain/support.ts');

  assert.match(hook, /apiPaths\.admin\.modules/);
  assert.match(hook, /ModuleEnablementDto/);
  assert.match(modules, /gatedRouteModules/);
  assert.match(modules, /analytics: 'analytics'/);
  assert.match(modules, /surface: 'surface'/);
  assert.match(modules, /fanExperience: 'fanExperience'/);
  assert.match(modules, /admin: 'admin'/);
  assert.match(accessible, /canAccessRoute/);
  assert.match(accessible, /isRouteModuleEnabled/);
  assert.match(accessible, /demoAccessEnabled/);
  assert.match(support, /accessibleRoutesForRole/);
  assert.match(shell, /useAccessibleRoutes/);
  assert.match(guards, /useAccessibleRoutes/);
  assert.match(guards, /canAccessRoute/);
});

test('wave 03: route coverage inventory stays synchronized', async () => {
  const routes = await source('src/routes/routes.ts');
  const paths = await source('src/api/paths.ts');
  const router = await source('src/app/router.tsx');
  const panels = await source('src/workspaces/views/WorkspaceDomainPanels.tsx');
  const validate = await source('src/routes/validateRoutes.ts');

  const routeIds = [...routes.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  const apiGroups = [...paths.matchAll(/^\s{2}([a-zA-Z]+): (?=\[|stewardingFeedPaths)/gm)].map((match) => match[1]);
  const panelCases = [...panels.matchAll(/case '([^']+)':/g)].map((match) => match[1]);

  assert.equal(routeIds.length, 24);
  for (const routeId of routeIds) {
    assert.ok(apiGroups.includes(routeId), `routeApiPathGroups missing ${routeId}`);
    assert.ok(panelCases.includes(routeId), `WorkspaceDomainPanels missing ${routeId}`);
    if (routeId !== 'account') {
      assert.match(routes, new RegExp(`backendPaths: backendContractPathsForRoute\\('${routeId}'\\)`));
    }
  }

  assert.match(router, /routes\.map\(\(route\) => \(/);
  assert.match(validate, /validateRouteInventory/);
  assert.match(routes, /backendContractPathsForRoute/);
});

function resolveApiPathRef(pathsSource, apiRef) {
  const [, group, key] = apiRef.split('.');
  const groupBlock = pathsSource.match(new RegExp(`${group}: \\{([\\s\\S]*?)\\n  \\}`))?.[1] ?? '';
  return groupBlock.match(new RegExp(`${key}: '([^']+)'`))?.[1];
}

function contractDeclaresPath(contractPath, backendPath) {
  if (contractPath === backendPath) return true;
  const templatePattern = contractPath.replace(/\{[^/]+\}/g, '[^/]+');
  return new RegExp(`^${templatePattern}$`).test(backendPath);
}

test('wave 03: route backendPaths are declared in shared endpoint contracts', async () => {
  const { apiEndpointContracts } = await import('@trackmind/shared');
  const pathsSource = await source('src/api/paths.ts');
  const routeBackendPaths = [...pathsSource.matchAll(/routeApiPathGroups = \{([\s\S]*?)\} as const/g)]
    .flatMap((match) => [...match[1].matchAll(/apiPaths\.[a-zA-Z0-9]+\.[a-zA-Z0-9]+/g)].map((pathMatch) => pathMatch[0]))
    .map((apiRef) => resolveApiPathRef(pathsSource, apiRef))
    .filter(Boolean)
    .map((relativePath) => `/api/v1${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`);

  const undeclared = routeBackendPaths.filter((backendPath) => (
    !apiEndpointContracts.some((contract) => contractDeclaresPath(contract.path, backendPath))
  ));

  assert.deepEqual(
    undeclared,
    [],
    undeclared.length
      ? `Undeclared backendPaths:\n${undeclared.map((backendPath) => `- ${backendPath}`).join('\n')}`
      : undefined,
  );
});
