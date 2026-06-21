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
  'paddock-operations/workspace',
  'starting-gate-operations/workspace',
  'identity/workspace',
  'reporting/workspace',
  'industry-intelligence/workspace',
  'federation-intelligence/workspace',
  'equine-welfare/workspace',
  'search/global',
];

const panelPathBindings = [
  ['equinePanels.tsx', 'horse-registry/workspace'],
  ['equinePanels.tsx', 'trainer-management/workspace'],
  ['equinePanels.tsx', 'veterinary-operations/workspace'],
  ['racePanels.tsx', 'racing-calendar/workspace'],
  ['racePanels.tsx', 'race-cards/workspace'],
  ['racePanels.tsx', 'starting-gate-operations/workspace'],
  ['businessPanels.tsx', 'industry-intelligence/workspace'],
  ['businessPanels.tsx', 'federation-intelligence/workspace'],
  ['platformPanels.tsx', 'reporting/workspace'],
  ['platformPanels.tsx', 'identity/workspace'],
  ['platformPanels.tsx', 'search/global'],
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
