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
  assert.match(main, /applyTheme\(loadTheme\(\)\)/);
  assert.match(app, /<AppShell \/>/);
});

test('frontend theme persists across reloads and defaults to product-facing light mode', async () => {
  const shell = await source('src/shell/AppShell.tsx');
  const theme = await source('src/theme/theme.ts');
  const tokens = await source('src/theme/tokens.css');
  assert.match(theme, /const themeStorageKey = 'trackmind-theme'/);
  assert.match(theme, /return storedTheme \?\? 'light'/);
  assert.match(theme, /typeof document === 'undefined'/);
  assert.match(theme, /typeof window === 'undefined'/);
  assert.match(theme, /normalizeTheme/);
  assert.match(theme, /localStorage\.setItem\(themeStorageKey, normalizedTheme\)/);
  assert.match(shell, /useState<ThemeName>\(\(\) => loadTheme\(\)\)/);
  assert.match(shell, /persistTheme\(theme\)/);
  assert.match(shell, /aria-pressed=\{theme === 'dark'\}/);
  assert.match(tokens, /:root \{\n  color-scheme: light;/);
  assert.match(tokens, /:root\[data-theme="dark"\] \{\n  color-scheme: dark;/);
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
  assert.match(routes, /label: 'Command Center'/);
  assert.match(routes, /label: 'AI Policy'/);
  assert.match(routes, /Monitor race-day readiness/);
  assert.match(routes, /Review advisory AI policies/);
  assert.doesNotMatch(routes, /aliases:/);
  assert.doesNotMatch(routes, /normalized\.startsWith\(`\$\{alias\}\/`\)/);
  assert.match(routes, /normalized\.startsWith\(`\$\{route\.path\}\/`\)/);
});

test('frontend shell layout uses stable responsive alignment tokens', async () => {
  const tokens = await source('src/theme/tokens.css');
  assert.match(tokens, /--shell-nav-width: 18rem/);
  assert.match(tokens, /--shell-aside-width: 21rem/);
  assert.match(tokens, /--page-max-width: 86rem/);
  assert.match(tokens, /grid-template-columns: minmax\(0, 1fr\) var\(--shell-aside-width\)/);
  assert.match(tokens, /grid-template-columns: minmax\(7rem, 0\.4fr\) minmax\(0, 1fr\)/);
  assert.match(tokens, /background: var\(--surface-base\)/);
  assert.match(tokens, /\.route-button--active small \{\n  color: var\(--text-strong\);/);
  assert.match(tokens, /@media \(max-width: 1280px\)/);
  assert.match(tokens, /grid-template-rows: auto/);
  assert.match(tokens, /overflow: visible/);
  assert.match(tokens, /@media \(max-width: 900px\)/);
  assert.match(tokens, /@media \(max-width: 520px\)/);
});

test('components do not call raw fetch or render forbidden execution controls', async () => {
  const page = await source('src/pages/WorkspacePage.tsx');
  const shell = await source('src/shell/AppShell.tsx');
  const router = await source('src/routes/Router.tsx');
  const ui = await source('src/components/ui.tsx');
  assert.doesNotMatch(page, /\bfetch\(/);
  assert.doesNotMatch(shell, /\bfetch\(/);
  assert.doesNotMatch(router, /\bfetch\(/);
  const forbiddenActions = [
    'Start race',
    'Stop race',
    'Finalize results',
    'Scratch horse',
    'Administer medication',
    'Issue payout',
    'Release payout',
    'Approve payout',
    'Return to service',
    'Move starting gate',
    'Dispatch emergency',
    'Execute maintenance',
    'Approve medication',
    'Execute recommendation',
  ];
  for (const unsafe of forbiddenActions) {
    assert.doesNotMatch(page, new RegExp(`label:\\s*['"]${unsafe}|>\\s*${unsafe}\\s*<`, 'i'));
  }
  assert.match(page, /View approval context/);
  assert.doesNotMatch(page, /Request approval/);
  assert.match(page, /View audit context/);
  assert.doesNotMatch(page, /disabled title="Read-only until a governed endpoint is wired\."/);
  assert.match(page, /ActionButtons/);
  assert.match(ui, /PageHeader/);
  assert.match(ui, /SectionCard/);
  assert.match(ui, /StatusBadge/);
  assert.match(ui, /workspacePanelStatusLabel/);
  assert.match(ui, /Endpoint-backed/);
  assert.match(ui, /Facade data/);
  assert.match(ui, /Documentation only/);
  assert.match(ui, /MetricCard/);
  assert.match(ui, /DataTable/);
  assert.match(ui, /Timeline/);
  assert.match(ui, /safeItems/);
  assert.match(ui, /Array\.isArray\(rows\)/);
  assert.match(ui, /Array\.isArray\(values\)/);
  assert.match(ui, /Array\.isArray\(actions\)/);
  assert.match(ui, /function percent/);
  assert.match(ui, /Unavailable/);
  assert.match(ui, /EmptyState/);
  assert.match(ui, /LoadingState/);
  assert.match(ui, /RenderErrorBoundary/);
  assert.match(ui, /RecordCardFrame/);
  assert.match(ui, /AlertPanel/);
  assert.match(ui, /ApprovalCard/);
  assert.match(ui, /AuditCard/);
  assert.match(ui, /event\.entity\?\.displayName/);
  assert.match(ui, /No entity reference/);
  assert.match(ui, /hash unavailable/);
  assert.match(ui, /safeRows/);
  assert.match(ui, /safeValues/);
  assert.match(ui, /role not listed/);
  assert.match(ui, /roles unavailable/);
  assert.match(ui, /AuditEventCard/);
  assert.match(ui, /RecommendationCard/);
  assert.match(ui, /KPICard/);
  assert.match(ui, /WorkspaceRecordCard/);
  assert.match(page, /View approval context/);
  assert.match(page, /Route Data Cards/);
  assert.match(page, /They do not execute regulated operations/);
  assert.match(page, /recommendation\.approvalRequirement\?\.required/);
  assert.match(page, /navigateWithinShell/);
  assert.match(page, /Contract surface/);
  assert.match(page, /Route contract summary/);
  assert.match(page, /Canonical route/);
  assert.match(page, /Navigation context/);
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

test('frontend card actions stay navigation-only and advisory-safe', async () => {
  const page = await source('src/pages/WorkspacePage.tsx');
  const ui = await source('src/components/ui.tsx');
  const services = await source('src/api/services.ts');
  const workspaceModel = await source('src/domain/workspaceModel.ts');
  const sourceTexts = [page, ui, services, workspaceModel];

  for (const sourceText of sourceTexts) {
    assert.doesNotMatch(sourceText, /label:\s*'(Start race|Stop race|Finalize results|Release payout|Approve payout|Return to service|Move starting gate|Administer medication|Dispatch emergency|Execute maintenance|Execute recommendation)'/i);
    assert.doesNotMatch(sourceText, />\s*(Start race|Stop race|Finalize results|Release payout|Approve payout|Execute recommendation)\s*</i);
  }

  assert.match(page, /title="Review audit workspace with a recommendation context note\.">View audit context note/);
  assert.match(page, /title="Review approvals workspace with a recommendation context note\.">View approval context note/);
  assert.match(page, /title="Review advisory-only AI policy\.">Review AI policy/);
  assert.match(page, /Draft and evaluate APIs are backend-owned/);
  assert.match(page, /Execution remains blocked/);
  assert.match(services, /label: 'Review AI policy', path: '\/settings'/);
  assert.match(services, /Aggregate sharing categories \(metadata only, no export endpoint\)/);
  assert.match(services, /Readiness authority reference/);
  assert.match(services, /no external certification or approval claimed/);
  assert.match(workspaceModel, /View platform context/);
});

test('codex issue follow-up keeps card data defensive and copy accurate', async () => {
  const page = await source('src/pages/WorkspacePage.tsx');
  const services = await source('src/api/services.ts');
  const workspaceModel = await source('src/domain/workspaceModel.ts');
  const routes = await source('src/routes/routes.ts');
  const sharedAccess = await repoSource('packages/shared/src/accessControl.ts');
  const sharedContracts = await repoSource('packages/shared/src/apiContracts.ts');
  const server = await repoSource('apps/api/src/server.ts');
  const facilitiesMaintenance = await repoSource('apps/api/src/facilitiesMaintenance.ts');
  const kpiArtifacts = await repoSource('apps/api/src/kpiArtifacts.ts');

  assert.match(page, /const metrics = Array\.isArray\(data\.metrics\)/);
  assert.match(page, /const panels = Array\.isArray\(data\.panels\)/);
  assert.match(page, /const aiRecommendations = Array\.isArray\(data\.aiRecommendations\)/);
  assert.match(page, /View audit context', path: '\/audit', detail: 'Review available evidence for veterinary or privacy-scoped records\.'/);

  assert.match(services, /const allKpis = Array\.isArray\(partial\.kpis\)/);
  assert.match(services, /const confidence = item\.confidence \?\? \{ calibrated: Number\.NaN, band: 'unknown' \}/);
  assert.match(services, /AI recommendation text unavailable/);
  assert.match(services, /const services = Array\.isArray\(data\.services\)/);
  assert.match(services, /deploymentBoundary = data\.deploymentBoundary \?\?/);
  assert.match(services, /const protectedActions = Array\.isArray\(data\.protectedActions\)/);
  assert.match(services, /Active ticket value/);
  assert.doesNotMatch(services, /Ticket revenue/);
  assert.match(services, /View-only approval request records/);
  assert.match(services, /View barn context/);
  assert.match(services, /active face value/);
  assert.match(services, /Active-layout command widgets/);
  assert.match(page, /Navigation context note/);
  assert.match(page, /queryLabelsByRoute/);
  assert.doesNotMatch(page, /label: 'Open/);
  assert.doesNotMatch(services, /label: 'Open/);
  assert.doesNotMatch(workspaceModel, /label: 'Open/);

  assert.match(routes, /supportStatus: 'live-api'[\s\S]*dataSource: 'Review visible approval request records/);
  assert.match(routes, /supportStatus: 'live-api'[\s\S]*dataSource: 'Review audit event metadata/);
  assert.match(routes, /label: 'Ticketing'/);
  assert.doesNotMatch(routes, /Ticketing & Fan Experience/);
  assert.doesNotMatch(routes, /role-filtered horse profile views/);
  assert.match(routes, /no incident escalation, investigation mutation\/export, camera control/);

  assert.match(sharedAccess, /raceDay: 'read:any'/);
  assert.match(sharedAccess, /approvals: 'read:any'/);
  assert.match(sharedAccess, /input\.method === 'GET' \? 'read:any' : 'ai:approve'/);
  assert.match(sharedContracts, /seeded equine workspace summary data/);
  assert.doesNotMatch(sharedContracts, /Read role-filtered equine identity/);

  assert.match(kpiArtifacts, /'equine\.profile\.viewed', 'equine\.veterinary\.recorded'/);
  assert.match(kpiArtifacts, /'equine\.profile\.viewed', 'equine\.hisa\.verification'/);

  assert.match(server, /drillDownPath: '\/race-day'/);
  assert.match(server, /drillDownPath: '\/incidents'/);
  assert.match(server, /Event telemetry snapshot/);
  assert.doesNotMatch(server, /drillDownPath: '\/race-office'/);
  assert.doesNotMatch(server, /drillDownPath: '\/emergency'/);

  assert.match(facilitiesMaintenance, /read model for inspections/);
  assert.match(facilitiesMaintenance, /work order requests/);
  assert.doesNotMatch(facilitiesMaintenance, /path: '\/work-orders'/);
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
  assert.match(shell, /RenderErrorBoundary/);
  assert.doesNotMatch(shell, /Search is not wired yet/);
  assert.doesNotMatch(shell, /disabled title/);
});

test('frontend route filtering honors required roles and tenant scope headers', async () => {
  const shell = await source('src/shell/AppShell.tsx');
  const router = await source('src/routes/Router.tsx');
  const page = await source('src/pages/WorkspacePage.tsx');
  const navigation = await source('src/routes/navigation.ts');
  const support = await source('src/domain/support.ts');
  const client = await source('src/api/client.ts');
  const routes = await source('src/routes/routes.ts');
  assert.match(support, /canViewRoute/);
  assert.match(support, /API route wired/);
  assert.match(support, /Facade-backed/);
  assert.match(support, /Documented plan/);
  assert.match(routes, /const routePermissions/);
  assert.doesNotMatch(routes, /frontendRoutePermissionRegistry/);
  assert.doesNotMatch(routes, /requiredPermission: 'compliance:audit'/);
  assert.match(shell, /canViewRoute\(route, defaultTenantContext\.role\)/);
  assert.match(router, /canViewRoute\(route, defaultTenantContext\.role\)/);
  assert.match(client, /x-trackmind-tenant-id/);
  assert.match(client, /x-trackmind-racetrack-id/);
  assert.match(client, /x-trackmind-organization-id/);
  assert.match(client, /x-trackmind-role/);
  assert.doesNotMatch(client, /searchParams\.set\('role'/);
  assert.match(shell, /currentPathname\(\)/);
  assert.match(router, /currentPathname\(\)/);
  assert.match(page, /currentSearch\(\)/);
  assert.match(navigation, /typeof window === 'undefined'/);
  assert.match(navigation, /typeof PopStateEvent === 'function'/);
  assert.match(support, /scopeSource: 'demo-reference-context'/);
  assert.match(shell, /Demo context only/);
});

test('frontend API client times out unavailable backend requests', async () => {
  const client = await source('src/api/client.ts');

  assert.match(client, /const defaultRequestTimeoutMs = 8000/);
  assert.match(client, /new AbortController\(\)/);
  assert.match(client, /setTimeout\(\(\) => timeoutController\.abort/);
  assert.match(client, /signal: timeoutController\.signal/);
  assert.match(client, /Backend unavailable or timed out/);
  assert.match(client, /clearTimeout\(timeoutId\)/);
});

test('frontend keeps routes accessible when API adapters fail', async () => {
  const router = await source('src/routes/Router.tsx');
  const workspaceModel = await source('src/domain/workspaceModel.ts');

  assert.match(router, /createUnavailableWorkspace\(route, message\)/);
  assert.doesNotMatch(router, /setState\(\{ loading: false, error: message \}\)/);
  assert.match(workspaceModel, /Workspace availability/);
  assert.match(workspaceModel, /Backend connection unavailable/);
  assert.match(workspaceModel, /VITE_TRACKMIND_API_BASE_URL/);
  assert.match(workspaceModel, /source: 'documented-stub'/);
  assert.match(workspaceModel, /route\.backendPaths/);
});

test('frontend route adapters do not depend on generic mock-domain data', async () => {
  const page = await source('src/pages/WorkspacePage.tsx');
  const services = await source('src/api/services.ts');
  const routes = await source('src/routes/routes.ts');
  await assert.rejects(() => source('src/mocks/domainMocks.ts'), /ENOENT/);
  assert.doesNotMatch(page, /mockUnsupportedDomain/);
  assert.doesNotMatch(services, /mockUnsupportedDomain|mockService/);
  assert.doesNotMatch(routes, /explicit-mock|mock-adapter/);
  assert.match(services, /dashboardDrillDownRouteMap/);
  assert.match(services, /frontendPathForBackendDrilldown/);
  assert.match(services, /actionForBackendDrilldown/);
  assert.match(services, /label: 'View workspace'/);
  assert.match(services, /`frontend:\$\{path\}`/);
  assert.doesNotMatch(services, /evidence: \[widget\.source, widget\.drillDownPath\]/);
  assert.match(services, /Released payouts/);
  assert.match(services, /Seeded provider facade status/);
  assert.doesNotMatch(services, /Allowed exports:/);
});

test('vite proxy does not capture api-hub frontend deep links', async () => {
  const viteConfig = await source('vite.config.ts');
  assert.match(viteConfig, /'\/api\/v1'/);
  assert.doesNotMatch(viteConfig, /'\/api':/);
});

test('root deployment build stays Vite-only', async () => {
  const rootPackage = await repoSource('package.json');
  const frontendPackage = await source('package.json');
  const vercelConfig = await repoSource('vercel.json');
  const packageJson = JSON.parse(rootPackage);
  const frontendPackageJson = JSON.parse(frontendPackage);
  const vercelJson = JSON.parse(vercelConfig);

  assert.equal(packageJson.scripts.build, 'npm run build:vite');
  assert.doesNotMatch(packageJson.scripts['build:vite'], /apps\/api|apps\\api/);
  assert.match(packageJson.scripts['build:vite'], /apps\/frontend|apps\\frontend/);
  assert.match(frontendPackageJson.scripts.prestart, /packages\/shared|packages\\shared/);
  assert.match(frontendPackageJson.scripts.prebuild, /packages\/shared|packages\\shared/);
  assert.match(frontendPackageJson.scripts.pretypecheck, /packages\/shared|packages\\shared/);
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

test('frontend API URL builder normalizes configured base and route path slashes', async () => {
  const paths = await source('src/api/paths.ts');
  assert.match(paths, /normalizeApiBaseUrl/);
  assert.match(paths, /\.trim\(\)\.replace\(\/\\\/\+\$\/, ''\)/);
  assert.match(paths, /baseUrl \|\| nexusApiBasePath/);
  assert.match(paths, /path\.startsWith\('\/'\)/);
  assert.match(paths, /`\$\{API_BASE_URL\}\$\{normalizedPath\}`/);
});
