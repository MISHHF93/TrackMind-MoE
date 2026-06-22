import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

const wiredBackendPaths = [
  'horse-registry/workspace',
  'trainer-management/workspace',
  'jockey-management/workspace',
  'veterinary-operations/workspace',
  'racing-calendar/workspace',
  'race-cards/workspace',
  'race-operations/race-office',
  'race-operations/paddock',
  'starting-gate-operations/workspace',
  'surface-intelligence/workspace',
  'track-surface/measurements',
  'identity/workspace',
  'reporting/workspace',
  'industry-intelligence/workspace',
  'federation-intelligence/workspace',
  'equine-welfare/workspace',
  'search/global',
  'kpis/registry',
  'kpis/definitions',
  'kpis/thresholds',
  'compliance/dashboard',
  'compliance/corrective-actions',
];

const panelPathBindings = [
  ['equinePanels.tsx', 'horse-registry/workspace'],
  ['equinePanels.tsx', 'trainer-management/workspace'],
  ['equinePanels.tsx', 'veterinary-operations/workspace'],
  ['racePanels.tsx', 'racing-calendar/workspace'],
  ['racePanels.tsx', 'race-cards/workspace'],
  ['racePanels.tsx', 'race-operations/race-office'],
  ['racePanels.tsx', 'apiPaths.raceDay.paddock'],
  ['racePanels.tsx', 'starting-gate-operations/workspace'],
  ['racePanels.tsx', 'surface-intelligence/workspace'],
  ['racePanels.tsx', 'track-surface/measurements'],
  ['surfacePanels.tsx', 'surface-intelligence/workspace'],
  ['surfacePanels.tsx', 'track-surface/measurements'],
  ['businessPanels.tsx', 'industry-intelligence/workspace'],
  ['businessPanels.tsx', 'federation-intelligence/workspace'],
  ['businessPanels.tsx', 'finance/workspace'],
  ['businessPanels.tsx', 'payoutQueue'],
  ['businessPanels.tsx', 'GovernedActionDialog'],
  ['businessPanels.tsx', 'authorizeApprovalExecution'],
  ['platformPanels.tsx', 'reporting/workspace'],
  ['platformPanels.tsx', 'identity/workspace'],
  ['platformPanels.tsx', 'search/global'],
  ['platformPanels.tsx', 'kpis/registry'],
  ['platformPanels.tsx', 'kpis/definitions'],
  ['platformPanels.tsx', 'kpis/thresholds'],
  ['platformPanels.tsx', 'pending-approval'],
  ['platformPanels.tsx', 'ApprovalDecisionButtons'],
  ['platformPanels.tsx', 'authorizeApprovalExecution'],
  ['platformPanels.tsx', 'operations-admin'],
  ['governancePanels.tsx', 'compliance/dashboard'],
  ['governancePanels.tsx', 'compliance/corrective-actions'],
];

test('platform verification: route API path groups wire formerly orphaned backend domains', async () => {
  const paths = await source('src/api/paths.ts');
  for (const fragment of wiredBackendPaths) {
    assert.match(paths, new RegExp(fragment.replace('/', '\\/')), `routeApiPathGroups missing ${fragment}`);
  }
});

test('platform verification: domain panels consume wired backend feeds', async () => {
  for (const [file, fragment] of panelPathBindings) {
    const panelSource = await source(`src/workspaces/views/${file}`);
    assert.match(panelSource, new RegExp(fragment.replace('/', '\\/')), `${file} missing feed for ${fragment}`);
  }
});

test('platform verification: global search hook uses shared DTO contracts', async () => {
  const hook = await source('src/hooks/useGlobalSearch.ts');
  assert.match(hook, /@trackmind\/shared/);
  assert.match(hook, /GlobalSearchResponseDto/);
  assert.doesNotMatch(hook, /export interface GlobalSearchResult \{/);
});

test('platform verification: mobile and tablet responsive layout tokens exist', async () => {
  const tokens = await source('src/design/tokens.css');
  assert.match(tokens, /@media \(max-width: 1024px\)/);
  assert.match(tokens, /\.shell-sidebar/);
  assert.match(tokens, /\.action-dock/);
  assert.match(tokens, /@media \(max-width: 640px\)/);
  const kpiStrip = await source('src/design/components/kpi-strip.tsx');
  assert.match(kpiStrip, /kpi-strip/);
});

test('platform verification: analytics route wires KPI admin endpoints', async () => {
  const paths = await source('src/api/paths.ts');
  const panels = await source('src/workspaces/views/platformPanels.tsx');
  const mutations = await source('src/api/mutations.ts');
  for (const fragment of ['kpis/registry', 'kpis/definitions', 'kpis/thresholds']) {
    assert.match(paths, new RegExp(fragment.replace('/', '\\/')), `analytics route missing ${fragment}`);
  }
  assert.match(paths, /thresholdDraftRequests: '\/kpis\/thresholds\/draft-requests'/);
  assert.match(paths, /routeMutationPathGroups[\s\S]*analytics[\s\S]*thresholdDraftRequests/);
  assert.match(paths, /\[apiPaths\.kpis\.registry\]: 'live-api'/);
  assert.match(paths, /\[apiPaths\.kpis\.definitions\]: 'live-api'/);
  assert.match(paths, /\[apiPaths\.kpis\.thresholds\]: 'live-api'/);
  assert.match(panels, /KpiAdminPanels/);
  assert.match(panels, /Pending threshold changes/);
  assert.match(panels, /Human approval required/);
  assert.match(panels, /approvalRequired/);
  assert.match(panels, /ApprovalDecisionButtons/);
  assert.match(panels, /authorizeApprovalExecution/);
  assert.match(panels, /operations-admin/);
  assert.match(panels, /kpi-threshold-change/);
  assert.match(mutations, /requestKpiThresholdDraft/);
  assert.match(mutations, /apiPaths\.kpis\.thresholdDraftRequests/);
});

test('platform verification: analytics route fetches searchable sample index', async () => {
  const paths = await source('src/api/paths.ts');
  const panels = await source('src/workspaces/views/platformPanels.tsx');
  assert.match(paths, /globalSample: '\/search\/global\?q=horse'/);
  assert.match(paths, /apiPaths\.search\.globalSample/);
  assert.match(paths, /federation\.kpiAggregation/);
  assert.match(panels, /\/analytics\/workspace/);
  assert.match(panels, /forecastingReadiness/);
  assert.match(panels, /\/federation\/kpi-aggregation/);
});

test('platform verification: settings route wires AI governance registration and review actions', async () => {
  const paths = await source('src/api/paths.ts');
  const panels = await source('src/workspaces/views/settingsPanels.tsx');
  const mutations = await source('src/api/mutations.ts');
  for (const fragment of [
    '/ai-governance/workspace',
    '/ai-governance/model-registry',
    '/ai-governance/model-cards',
    '/ai-governance/prompt-cards',
    '/ai-governance/kpi-pack',
  ]) {
    assert.match(paths, new RegExp(fragment.replace(/\//g, '\\/')), `settings route missing ${fragment}`);
  }
  assert.match(panels, /\/ai-governance\/model-cards/);
  assert.match(panels, /\/ai-governance\/prompt-cards/);
  assert.match(panels, /\/ai-governance\/kpi-pack/);
  assert.match(panels, /registerModelCard/);
  assert.match(panels, /registerPromptCard/);
  assert.match(panels, /draftPromptLineage/);
  assert.match(panels, /publishPromptLineage/);
  assert.match(panels, /Draft prompt lineage/);
  assert.match(panels, /Publish lineage draft/);
  assert.match(panels, /RegistryRegistrationDialog/);
  assert.match(panels, /ApprovalDecisionButtons/);
  assert.match(panels, /advisory-only/);
  assert.match(mutations, /\/ai-governance\/model-registry\/models/);
  assert.match(mutations, /\/ai-governance\/model-registry\/prompts/);
  assert.match(mutations, /apiPaths\.settings\.promptLineageDrafts/);
  assert.match(paths, /promptLineageDrafts/);
  assert.match(paths, /publishPromptLineage/);
  assert.match(paths, /routeMutationPathGroups[\s\S]*settings[\s\S]*promptLineageDrafts/);
});

test('platform verification: admin route wires governance platform endpoints', async () => {
  const paths = await source('src/api/paths.ts');
  for (const fragment of [
    'platform/domain-ownership',
    'platform/governance-lineage/validation',
    'platform/readiness-scorecards',
    'platform/executive-scorecard',
    'platform/maturity-review',
  ]) {
    assert.match(paths, new RegExp(fragment.replace('/', '\\/')), `admin route missing ${fragment}`);
  }
});

test('platform verification: facilities maintenance panels wire mutation endpoints', async () => {
  const paths = await source('src/api/paths.ts');
  const panels = await source('src/workspaces/views/operationsPanels.tsx');
  const map = await source('src/workspaces/views/FacilitiesGeospatialMap.tsx');
  const mutations = await source('src/api/mutations.ts');
  for (const fragment of [
    'facilities-maintenance/workspace',
    'facilities-maintenance/maintenance-schedules',
    'facilities-maintenance/incidents',
  ]) {
    assert.match(paths, new RegExp(fragment.replace('/', '\\/')), `facilities route missing ${fragment}`);
  }
  assert.match(paths, /maintenanceSchedules: '\/facilities-maintenance\/maintenance-schedules'/);
  assert.match(paths, /routeMutationPathGroups[\s\S]*facilities[\s\S]*maintenanceSchedules/);
  assert.match(paths, /routeMutationPathGroups[\s\S]*facilities[\s\S]*incidents/);
  assert.match(paths, /\[apiPaths\.facilities\.maintenanceSchedules\]: 'live-api'/);
  assert.match(paths, /\[apiPaths\.facilities\.incidents\]: 'live-api'/);
  assert.match(panels, /createFacilitiesMaintenanceSchedule/);
  assert.match(panels, /reportFacilitiesIncident/);
  assert.match(panels, /GovernedActionDialog/);
  assert.match(panels, /facility-maintenance-execution/);
  assert.match(panels, /Schedule maintenance/);
  assert.match(panels, /Report incident/);
  assert.match(map, /onAssetSelect/);
  assert.match(map, /assetIdFromMapFeature/);
  assert.match(mutations, /\/facilities-maintenance\/maintenance-schedules/);
  assert.match(mutations, /\/facilities-maintenance\/incidents/);
});

test('platform verification: surface intelligence panels load live API feeds', async () => {
  const paths = await source('src/api/paths.ts');
  const surfacePanels = await source('src/workspaces/views/surfacePanels.tsx');
  const routes = await source('src/routes/routes.ts');
  for (const fragment of ['surface-intelligence/workspace', 'track-surface/measurements']) {
    assert.match(paths, new RegExp(fragment.replace('/', '\\/')), `surface route missing ${fragment}`);
  }
  assert.match(paths, /raceDay:[\s\S]*surfaceMeasurements/);
  assert.match(paths, /surface:[\s\S]*measurements/);
  assert.match(paths, /\[apiPaths\.raceDay\.surface\]: 'live-api'/);
  assert.match(paths, /\[apiPaths\.raceDay\.surfaceMeasurements\]: 'live-api'/);
  assert.match(paths, /surface:[\s\S]*workspace: '\/surface-intelligence\/workspace'/);
  assert.match(paths, /surface:[\s\S]*measurements: '\/track-surface\/measurements'/);
  assert.match(surfacePanels, /feedData<Record<string, unknown>>\(results, '\/surface-intelligence\/workspace'\)/);
  assert.match(surfacePanels, /feedData\(results, '\/track-surface\/measurements'\)/);
  assert.match(routes, /backendContractPathsForRoute\('surface'\)/);
});
