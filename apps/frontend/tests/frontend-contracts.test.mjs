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

test('frontend has one canonical entrypoint and app shell', async () => {
  const main = await source('src/main.tsx');
  const app = await source('src/App.tsx');
  assert.match(main, /createRoot\(root\)\.render/);
  assert.match(app, /<AppShell \/>/);
});

test('route constants cover required backend-driven sections', async () => {
  const routes = await source('src/routes/routes.ts');
  const paths = await source('src/api/paths.ts');
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
  assert.doesNotMatch(routes, /supportStatus: 'mock-adapter'/);
  assert.doesNotMatch(routes, /pageComponent:/);
  assert.match(routes, /backendContractPathsForRoute/);
  assert.match(paths, /routeApiPathGroups/);
  assert.match(paths, /services\/finance\/ticketing/);
  assert.match(paths, /surface-intelligence\/workspace/);
  assert.match(paths, /barn-operations\/workspace/);
  assert.match(routes, /FinanceTicketingWorkspaceDto/);
  assert.match(routes, /BarnOperationsDto/);
  assert.doesNotMatch(routes, /aliases:/);
  assert.doesNotMatch(routes, /normalized\.startsWith\(`\$\{alias\}\/`\)/);
  assert.match(routes, /normalized\.startsWith\(`\$\{route\.path\}\/`\)/);
});

test('components do not call raw fetch or render forbidden execution controls', async () => {
  const page = await source('src/pages/WorkspacePage.tsx');
  const shell = await source('src/shell/AppShell.tsx');
  const router = await source('src/routes/Router.tsx');
  const ui = await source('src/components/ui.tsx');
  assert.doesNotMatch(page, /\bfetch\(/);
  assert.doesNotMatch(shell, /\bfetch\(/);
  assert.doesNotMatch(router, /\bfetch\(/);
  for (const unsafe of ['Start race', 'Stop race', 'Finalize results', 'Scratch horse', 'Administer medication', 'Issue payout']) {
    assert.doesNotMatch(page, new RegExp(unsafe, 'i'));
  }
  assert.match(page, /Open approval queue/);
  assert.doesNotMatch(page, /Request approval/);
  assert.match(page, /Open audit trail/);
  assert.doesNotMatch(page, /disabled title="Read-only until a governed endpoint is wired\."/);
  assert.match(page, /ActionButtons/);
  assert.match(ui, /PageHeader/);
  assert.match(ui, /SectionCard/);
  assert.match(ui, /StatusBadge/);
  assert.match(ui, /MetricCard/);
  assert.match(ui, /DataTable/);
  assert.match(ui, /Timeline/);
  assert.match(ui, /EmptyState/);
  assert.match(ui, /LoadingState/);
  assert.match(ui, /RecordCardFrame/);
  assert.match(ui, /AlertPanel/);
  assert.match(ui, /ApprovalCard/);
  assert.match(ui, /AuditCard/);
  assert.match(ui, /AuditEventCard/);
  assert.match(ui, /RecommendationCard/);
  assert.match(ui, /KPICard/);
  assert.match(ui, /WorkspaceRecordCard/);
  assert.match(page, /Open approvals/);
  assert.match(page, /navigateWithinShell/);
  assert.match(page, /Contract surface/);
  assert.match(page, /Route contract summary/);
  assert.match(page, /Canonical route/);
  assert.match(page, /Focused evidence/);
  assert.match(page, /focusFromSearch/);
  assert.match(page, /Governed KPI Artifacts/);
  assert.match(ui, /Data quality/);
  assert.doesNotMatch(page, /function RecordCard/);
  assert.doesNotMatch(page, /function KPICard/);
  assert.doesNotMatch(page, /function AICard/);
  assert.doesNotMatch(page, /className="workspace-state"/);
  for (const sourceText of [page, shell, ui]) {
    assert.doesNotMatch(sourceText, /```/);
    assert.doesNotMatch(sourceText, /dangerouslySetInnerHTML/);
    assert.doesNotMatch(sourceText, /README/);
    assert.doesNotMatch(sourceText, /JSON\.stringify/);
  }
});

test('app shell renders grouped route navigation from metadata', async () => {
  const shell = await source('src/shell/AppShell.tsx');
  assert.match(shell, /navigationOrder/);
  assert.match(shell, /className="nav-group"/);
  assert.match(shell, /route-button/);
  assert.match(shell, /route-button--active/);
  assert.match(shell, /route\.navigationGroup === group/);
  assert.match(shell, /Global route shortcuts/);
  assert.match(shell, /navigate\('\/dashboard'\)/);
  assert.match(shell, /searchQuery/);
  assert.match(shell, /routeSearchText/);
  assert.match(shell, /scope-chip/);
  assert.match(shell, /AlertPanel/);
  assert.match(shell, /TagList/);
  assert.match(shell, /StatusBadge/);
  assert.doesNotMatch(shell, /Search is not wired yet/);
  assert.doesNotMatch(shell, /disabled title/);
});

test('frontend route filtering honors required roles and tenant scope headers', async () => {
  const shell = await source('src/shell/AppShell.tsx');
  const router = await source('src/routes/Router.tsx');
  const support = await source('src/domain/support.ts');
  const client = await source('src/api/client.ts');
  const routes = await source('src/routes/routes.ts');
  assert.match(support, /canViewRoute/);
  assert.match(routes, /frontendRoutePermissionRegistry/);
  assert.doesNotMatch(routes, /requiredPermission: 'compliance:audit'/);
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

test('frontend route adapters do not depend on generic mock-domain data', async () => {
  const page = await source('src/pages/WorkspacePage.tsx');
  const services = await source('src/api/services.ts');
  const routes = await source('src/routes/routes.ts');
  await assert.rejects(() => source('src/mocks/domainMocks.ts'), /ENOENT/);
  assert.doesNotMatch(page, /mockUnsupportedDomain/);
  assert.doesNotMatch(services, /mockUnsupportedDomain|mockService/);
  assert.doesNotMatch(routes, /explicit-mock|mock-adapter/);
});

test('vite proxy does not capture api-hub frontend deep links', async () => {
  const viteConfig = await source('vite.config.ts');
  assert.match(viteConfig, /'\/api\/v1'/);
  assert.doesNotMatch(viteConfig, /'\/api':/);
});

test('root deployment build stays Vite-only', async () => {
  const rootPackage = await repoSource('package.json');
  const vercelConfig = await repoSource('vercel.json');
  const packageJson = JSON.parse(rootPackage);
  const vercelJson = JSON.parse(vercelConfig);

  assert.equal(packageJson.scripts.build, 'npm run build:vite');
  assert.doesNotMatch(packageJson.scripts['build:vite'], /apps\/api|apps\\api/);
  assert.match(packageJson.scripts['build:vite'], /apps\/frontend|apps\\frontend/);
  assert.equal(vercelJson.buildCommand, 'npm run build:vite');
  assert.equal(vercelJson.outputDirectory, 'dist');
});

test('frontend KPI adapter uses the central API service layer', async () => {
  const services = await source('src/api/services.ts');
  const paths = await source('src/api/paths.ts');
  assert.match(paths, /workspace: '\/kpis'/);
  assert.match(paths, /adapterSourceForPath/);
  assert.match(paths, /backendContractPathsForRoute/);
  assert.match(services, /getJson<KPIWorkspaceDto>/);
  assert.match(services, /modelReadableKpiContext/);
  assert.match(services, /modelReadableContext/);
  assert.match(services, /getJson<FacilitiesMaintenanceWorkspaceDto>/);
  assert.match(services, /getJson<SurfaceIntelligenceDto>/);
  assert.match(services, /getJson<BarnOperationsDto>/);
  assert.match(services, /requireReady/);
  assert.match(services, /routeKpiDomains/);
  assert.match(services, /getJson<FinanceTicketingWorkspaceDto>/);
  assert.doesNotMatch(services, /mockService/);
  assert.doesNotMatch(services, /interface FacilitiesMaintenanceWorkspace/);
  assert.doesNotMatch(services, /equineExtras/);
  const ui = await source('src/components/ui.tsx');
  assert.match(ui, /Allowed model use/);
  assert.match(ui, /Prohibited model use/);
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
  const literalRouteBackendPaths = [...paths.matchAll(/routeApiPathGroups = \{([\s\S]*?)\} as const/g)]
    .flatMap((match) => [...match[1].matchAll(/'([^']+)'/g)].map((pathMatch) => pathMatch[1]))
    .filter((path) => path.startsWith('/'))
    .map((path) => `/api/v1${path}`);
  routeBackendPaths.push(...literalRouteBackendPaths);
  const sharedEndpointPaths = [...sharedContracts.matchAll(/path:'([^']+)'/g)].map((match) => match[1]);

  assert.ok(routeBackendPaths.length > 0, 'frontend routes should declare backend paths');
  for (const backendPath of routeBackendPaths) {
    const declared = sharedEndpointPaths.some((contractPath) => {
      if (contractPath === backendPath) return true;
      const templatePattern = contractPath.replace(/\{[^/]+\}/g, '[^/]+');
      return new RegExp(`^${templatePattern}$`).test(backendPath);
    });
    assert.ok(declared, `${backendPath} missing from shared apiEndpointContracts`);
  }
});
