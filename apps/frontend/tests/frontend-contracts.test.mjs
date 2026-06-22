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
  const app = await source('src/app/App.tsx');
  const shell = await source('src/shell/AppShell.tsx');
  assert.match(main, /createRoot\(root\)\.render/);
  assert.match(main, /applyTheme\(loadTheme\(\)\)/);
  assert.match(main, /design\/tokens\.css/);
  assert.match(app, /RouterProvider/);
  assert.match(shell, /export function AppShell/);
  assert.match(shell, /useAccessibleRoutes/);
});

test('route constants cover required backend-driven sections', async () => {
  const routes = await source('src/routes/routes.ts');
  const paths = await source('src/api/paths.ts');
  for (const path of [
    '/dashboard', '/race-day', '/equine', '/approvals', '/incidents', '/compliance', '/security',
    '/facilities', '/ticketing', '/finance', '/federation', '/data-hub', '/audit', '/admin', '/settings',
    '/stewarding', '/workforce', '/digital-twin', '/surface', '/emergency',
    '/analytics', '/fan-experience', '/notifications',
  ]) {
    assert.match(routes, new RegExp(`path: '${path}'`), `${path} route missing`);
  }
  assert.match(paths, /race-operations\/paddock/);
  assert.match(paths, /analytics\/workspace/);
  assert.match(paths, /fan-experience\/workspace/);
  assert.match(paths, /notifications\/inbox/);
  const fanPanels = await source('src/workspaces/views/platformPanels.tsx');
  assert.match(fanPanels, /Ticketing connector status/);
  assert.match(fanPanels, /ticketingConnector/);
  assert.match(paths, /search\/global/);
  assert.match(paths, /routeApiPathGroups/);
  assert.match(routes, /backendContractPathsForRoute/);
});

test('control surface layout tokens remain stable', async () => {
  const tokens = await source('src/design/tokens.css');
  assert.match(tokens, /--shell-nav-width: 18rem/);
  assert.match(tokens, /--shell-aside-width: 21rem/);
  assert.match(tokens, /--page-max-width: 86rem/);
  assert.match(tokens, /--brand-navy: #142A45/);
  assert.match(tokens, /--brand-maroon: #7A1828/);
  assert.match(tokens, /--brand-blue: #2D5F9E/);
  assert.match(tokens, /--brand-parchment: #FBF8F4/);
  assert.match(tokens, /--surface-chrome: var\(--brand-white\)/);
});

test('frontend uses workspace pages wired to backend paths', async () => {
  const workspace = await source('src/workspaces/WorkspacePage.tsx');
  const hooks = await source('src/hooks/useWorkspaceData.ts');
  const router = await source('src/app/router.tsx');
  const components = await source('src/design/components/workspace.tsx');
  assert.match(hooks, /routeApiPathGroups/);
  assert.match(hooks, /getJson/);
  assert.match(workspace, /MetricGrid/);
  assert.match(workspace, /PriorityQueue/);
  assert.match(workspace, /AdvisoryCard/);
  assert.match(router, /WorkspacePage routeId=\{route\.id\}/);
  assert.match(components, /MetricGrid/);
  assert.match(components, /PriorityQueue/);
});

test('frontend forbids protected execution controls in workspace actions', async () => {
  const workspace = await source('src/workspaces/WorkspacePage.tsx');
  const routeActions = await source('src/domain/routeActions.ts');
  const actionDock = await source('src/shell/ActionDock.tsx');
  const forbidden = ['Start race', 'Stop race', 'Release payout', 'Execute maintenance', 'Dispatch emergency'];
  for (const label of forbidden) {
    assert.doesNotMatch(workspace, new RegExp(`label: '${label}'`));
    assert.doesNotMatch(actionDock, new RegExp(`>${label}<`));
  }
  assert.match(routeActions, /Request race start approval/);
  assert.match(workspace, /protectedAction/);
});

test('frontend route filtering honors tenant scope headers', async () => {
  const shell = await source('src/shell/AppShell.tsx');
  const client = await source('src/api/client.ts');
  const session = await source('src/auth/TenantSessionProvider.tsx');
  assert.match(shell, /useAccessibleRoutes/);
  assert.match(shell, /RouteAccessSync/);
  assert.match(client, /getTenantContext\(\)/);
  assert.match(client, /x-trackmind-tenant-id/);
  assert.match(client, /x-trackmind-role/);
  assert.match(client, /postJson/);
});

test('frontend keeps consoles accessible when API adapters fail', async () => {
  const workspace = await source('src/workspaces/WorkspacePage.tsx');
  assert.match(workspace, /Backend unavailable/);
  assert.match(workspace, /degraded/);
});

test('frontend surface intelligence paths are wired in routeApiPathGroups', async () => {
  const paths = await source('src/api/paths.ts');
  const racePanels = await source('src/workspaces/views/racePanels.tsx');
  const surfacePanels = await source('src/workspaces/views/surfacePanels.tsx');
  for (const fragment of [
    'surface-intelligence/workspace',
    'track-surface/measurements',
  ]) {
    assert.match(paths, new RegExp(fragment.replace('/', '\\/')), `routeApiPathGroups missing ${fragment}`);
  }
  assert.match(paths, /raceDay:[\s\S]*surfaceMeasurements/);
  assert.match(paths, /surface:[\s\S]*measurements/);
  assert.match(paths, /\[apiPaths\.raceDay\.surface\]: 'live-api'/);
  assert.match(paths, /\[apiPaths\.raceDay\.surfaceMeasurements\]: 'live-api'/);
  assert.match(paths, /surface:[\s\S]*workspace: '\/surface-intelligence\/workspace'/);
  assert.match(paths, /surface:[\s\S]*measurements: '\/track-surface\/measurements'/);
  assert.match(racePanels, /\/surface-intelligence\/workspace/);
  assert.match(racePanels, /\/track-surface\/measurements/);
  assert.match(surfacePanels, /\/surface-intelligence\/workspace/);
  assert.match(surfacePanels, /\/track-surface\/measurements/);
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

test('frontend theme is locked to race-day light mode', async () => {
  const theme = await source('src/lib/theme.ts');
  const shell = await source('src/shell/AppShell.tsx');
  const commandBar = await source('src/shell/CommandBar.tsx');
  assert.match(theme, /return 'light'/);
  assert.match(shell, /applyTheme\('light'\)/);
  assert.doesNotMatch(commandBar, /onToggleTheme/);
});

test('frontend workspace domain panels cover all consoles', async () => {
  const router = await source('src/workspaces/views/WorkspaceDomainPanels.tsx');
  const workspace = await source('src/workspaces/WorkspacePage.tsx');
  const feedUtils = await source('src/workspaces/feedUtils.ts');
  assert.match(router, /WorkspaceDomainPanels/);
  assert.match(router, /case 'dashboard'/);
  assert.match(router, /case 'settings'/);
  assert.match(workspace, /WorkspaceDomainPanels/);
  assert.match(feedUtils, /extractAllRecommendations/);
});

test('frontend approval payloads align with backend contracts', async () => {
  const payload = await source('src/api/approvalPayload.ts');
  const mutations = await source('src/api/mutations.ts');
  const actionDock = await source('src/shell/ActionDock.tsx');
  const workspace = await source('src/workspaces/WorkspacePage.tsx');
  const controls = await source('src/domain/approvalControls.ts');
  assert.match(payload, /buildControlledActionBody/);
  assert.match(payload, /buildApprovalControlledActionPayload/);
  assert.match(payload, /tenantId: session\.tenantId/);
  assert.match(payload, /protectedAction: input\.action/);
  assert.match(payload, /reason: input\.reason/);
  assert.match(payload, /buildApprovalDecisionBody/);
  assert.match(mutations, /assertMutationOk/);
  assert.match(actionDock, /target=\{dialog\.action\.target/);
  assert.match(workspace, /extractApprovalControls/);
  assert.match(controls, /export function extractApprovalControls/);
});

test('frontend brand design language is defined', async () => {
  const tokens = await source('src/design/tokens.css');
  const globals = await source('src/design/globals.css');
  const sidebar = await source('src/shell/Sidebar.tsx');
  const button = await source('src/design/components/button.tsx');
  assert.match(tokens, /--accent-governance: var\(--brand-maroon\)/);
  assert.match(tokens, /\.brand-logo/);
  assert.match(tokens, /object-fit: contain/);
  assert.match(globals, /--color-navy: #142A45/);
  assert.match(globals, /--color-parchment: #FBF8F4/);
  assert.match(tokens, /--brand-turf:/);
  assert.match(sidebar, /shell-sidebar/);
  assert.match(button, /governance:/);
});

test('frontend data hub entity resolution review uses draft-only mutation contract', async () => {
  const panels = await source('src/workspaces/views/businessPanels.tsx');
  const mutations = await source('src/api/mutations.ts');
  const paths = await source('src/api/paths.ts');
  assert.match(panels, /Draft entity resolution review/);
  assert.match(panels, /Draft only/);
  assert.match(panels, /Review required/);
  assert.match(panels, /Optional review rationale/);
  assert.match(panels, /Invoke provider adapter/);
  assert.match(panels, /Simulation only/);
  assert.match(mutations, /draftEntityResolutionReview/);
  assert.match(mutations, /invokeRacingDataProvider/);
  assert.match(mutations, /\/racing-data\/entity-resolution\/review/);
  assert.match(mutations, /\/racing-data\/providers\/\$\{encodeURIComponent\(providerId\)\}\/invoke/);
  assert.match(paths, /entityResolutionReview: '\/racing-data\/entity-resolution\/review'/);
  assert.match(paths, /providerInvoke: \(providerId: string\) => `\/racing-data\/providers\/\$\{providerId\}\/invoke`/);
});

test('frontend includes realtime and assistant integrations', async () => {
  const sseHook = await source('src/hooks/useEventStream.ts');
  const incidentTimelineHook = await source('src/hooks/useIncidentTimelineStream.ts');
  const analyticsStreamHook = await source('src/hooks/useAnalyticsStream.ts');
  const securityPanels = await source('src/workspaces/views/securityPanels.tsx');
  const platformPanels = await source('src/workspaces/views/platformPanels.tsx');
  const assistant = await source('src/features/assistant/MoEChatPanel.tsx');
  const mutations = await source('src/api/mutations.ts');
  assert.match(sseHook, /createEventSource/);
  assert.match(incidentTimelineHook, /createIncidentTimelineEventSource/);
  assert.match(analyticsStreamHook, /createAnalyticsWorkspaceEventSource/);
  assert.match(securityPanels, /useIncidentTimelineStream/);
  assert.match(securityPanels, /timeline\/stream/);
  assert.match(platformPanels, /useAnalyticsStream/);
  assert.match(platformPanels, /analytics\/workspace\/stream/);
  assert.match(assistant, /sendChatCompletion/);
  assert.match(assistant, /Advisory only/);
  assert.match(mutations, /approveRequest/);
  assert.match(mutations, /createControlledAction/);
});

test('operational form component library exports canonical controls', async () => {
  const index = await source('src/design/components/operational-form/index.ts');
  const renderer = await source('src/design/components/operational-form/OperationalFormFieldRenderer.tsx');
  const trackMindForm = await source('src/features/data-entry/TrackMindForm.tsx');
  for (const exportName of [
    'TextInput',
    'TextAreaInput',
    'SearchableSelect',
    'MultiSelect',
    'DateTimeInput',
    'StatusPicker',
    'SeverityPicker',
    'ApprovalRequirementPicker',
    'TenantRacetrackPicker',
    'NotesEditor',
    'AttachmentPlaceholder',
    'EvidenceLinkSelector',
    'AuditReferenceViewer',
    'EntityRelationshipPicker',
    'OperationalFormFieldRenderer',
  ]) {
    assert.match(index, new RegExp(`export \\{ ${exportName}`), `${exportName} export missing`);
  }
  assert.match(renderer, /resolveOperationalFormComponentKind/);
  assert.match(trackMindForm, /OperationalFormFieldRenderer/);
});
