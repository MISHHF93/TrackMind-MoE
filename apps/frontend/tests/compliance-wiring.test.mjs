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

const complianceApiPaths = [
  'compliance/dashboard',
  'compliance/corrective-actions',
  'compliance/control-library',
  'compliance/evidence-packets/generate',
];

const compliancePanelFeeds = [
  '/compliance/dashboard',
  '/compliance/corrective-actions',
  '/compliance/control-library',
  'evidence-packets/generate',
  'approval-gated',
];

test('compliance wiring: route API path groups include dashboard and corrective actions', async () => {
  const paths = await source('src/api/paths.ts');
  for (const fragment of complianceApiPaths) {
    assert.match(paths, new RegExp(fragment.replace('/', '\\/')), `paths.ts missing ${fragment}`);
  }
  assert.match(paths, /routeMutationPathGroups/);
  assert.match(paths, /evidencePacketGenerate: '\/compliance\/evidence-packets\/generate'/);
  assert.match(paths, /apiPaths\.compliance\.dashboard/);
  assert.match(paths, /apiPaths\.compliance\.correctiveActions/);
});

test('compliance wiring: backend contract paths include mutation endpoint', async () => {
  const paths = await source('src/api/paths.ts');
  assert.match(paths, /routeMutationPathGroups[\s\S]*compliance[\s\S]*evidencePacketGenerate/);
  assert.match(paths, /routeMutationPathGroups[\s\S]*compliance[\s\S]*correctiveActions/);
  assert.match(paths, /mutationPaths[\s\S]*fetchPaths/);
});

test('compliance wiring: compliance backend paths marked live-api', async () => {
  const paths = await source('src/api/paths.ts');
  assert.match(paths, /\[apiPaths\.compliance\.dashboard\]: 'live-api'/);
  assert.match(paths, /\[apiPaths\.compliance\.correctiveActions\]: 'live-api'/);
  assert.match(paths, /\[apiPaths\.compliance\.library\]: 'live-api'/);
  assert.match(paths, /\[apiPaths\.compliance\.evidencePacketGenerate\]: 'live-api'/);
  assert.match(paths, /correctiveActionUpdates:/);
  assert.match(paths, /correctiveActionClose:/);
  assert.match(paths, /correctiveActionDelete:/);
});

test('compliance wiring: mutation helpers target corrective-action POST contracts', async () => {
  const mutations = await source('src/api/mutations.ts');
  assert.match(mutations, /createComplianceCorrectiveAction/);
  assert.match(mutations, /updateComplianceCorrectiveAction/);
  assert.match(mutations, /closeComplianceCorrectiveAction/);
  assert.match(mutations, /deleteComplianceCorrectiveAction/);
  assert.match(mutations, /\/compliance\/corrective-actions'/);
  assert.match(mutations, /\/compliance\/corrective-actions\/\$\{encodeURIComponent\(correctiveActionId\)\}\/updates/);
  assert.match(mutations, /\/compliance\/corrective-actions\/\$\{encodeURIComponent\(correctiveActionId\)\}\/close/);
  assert.match(mutations, /\/compliance\/corrective-actions\/\$\{encodeURIComponent\(correctiveActionId\)\}\/delete/);
});

test('compliance wiring: governance panels consume dashboard, corrective actions, and evidence metadata', async () => {
  const panels = await source('src/workspaces/views/governancePanels.tsx');
  for (const fragment of compliancePanelFeeds) {
    assert.match(panels, new RegExp(fragment.replace('/', '\\/')), `governancePanels missing ${fragment}`);
  }
  assert.match(panels, /Corrective actions/);
  assert.match(panels, /Evidence packets/);
  assert.match(panels, /createComplianceCorrectiveAction/);
  assert.match(panels, /updateComplianceCorrectiveAction/);
  assert.match(panels, /closeComplianceCorrectiveAction/);
  assert.match(panels, /deleteComplianceCorrectiveAction/);
  assert.match(panels, /GovernedActionDialog/);
  assert.match(panels, /Register corrective action/);
  assert.match(panels, /Close selected action/);
  assert.doesNotMatch(panels, /postJson/);
  assert.doesNotMatch(panels, /generateComplianceEvidencePacket/);
});

test('compliance wiring: route manifest declares compliance backend paths', async () => {
  const routes = await source('src/routes/routes.ts');
  assert.match(routes, /id: 'compliance'/);
  assert.match(routes, /backendPaths: backendContractPathsForRoute\('compliance'\)/);
  assert.match(routes, /Compliance dashboard, control library, corrective actions/);
});

test('compliance wiring: shared contracts declare compliance endpoints', async () => {
  const shared = await repoSource('packages/shared/src/apiContracts.ts');
  for (const fragment of [
    '/api/v1/compliance/dashboard',
    '/api/v1/compliance/corrective-actions',
    '/api/v1/compliance/corrective-actions/{correctiveActionId}/updates',
    '/api/v1/compliance/corrective-actions/{correctiveActionId}/close',
    '/api/v1/compliance/corrective-actions/{correctiveActionId}/delete',
    '/api/v1/compliance/evidence-packets/generate',
    '/api/v1/compliance/control-library',
  ]) {
    assert.match(shared, new RegExp(fragment.replace(/\//g, '\\/')), `shared contract missing ${fragment}`);
  }
});

test('compliance wiring: compliance route promoted to live-api support', async () => {
  const routes = await source('src/routes/routes.ts');
  assert.match(routes, /id: 'compliance'[\s\S]*supportStatus: 'live-api'/);
});
