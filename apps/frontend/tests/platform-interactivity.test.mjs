import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const routeIds = [
  'dashboard',
  'raceDay',
  'equine',
  'approvals',
  'incidents',
  'compliance',
  'security',
  'facilities',
  'ticketing',
  'finance',
  'federation',
  'dataHub',
  'audit',
  'admin',
  'settings',
  'stewarding',
  'workforce',
  'digitalTwin',
  'surface',
  'emergency',
  'analytics',
  'fanExperience',
  'notifications',
];

const interactivePanelBindings = [
  ['commandPanels.tsx', 'EntityFormAction'],
  ['racePanels.tsx', 'requestRaceStop'],
  ['approvalsPanels.tsx', 'simulateApprovalEscalation'],
  ['securityPanels.tsx', 'patchSecurityEscalation'],
  ['surfacePanels.tsx', 'requestSurfaceOperationalAction'],
  ['governancePanels.tsx', 'generateComplianceEvidencePacket'],
  ['operationsPanels.tsx', 'completeWorkforceTask'],
  ['equinePanels.tsx', 'updateHorseEligibility'],
  ['stewardingPanels.tsx', 'issueStewardFinalRuling'],
  ['businessPanels.tsx', 'dispatchNotification'],
  ['platformPanels.tsx', 'acknowledgeNotification'],
  ['settingsPanels.tsx', 'createControlledAction'],
];

test('platform interactivity: every route has dock actions in routeActions', async () => {
  const routeActions = await readFile(resolve(root, 'src/domain/routeActions.ts'), 'utf8');
  assert.match(routeActions, /buildRouteActions/);
  for (const routeId of routeIds) {
    assert.match(routeActions, new RegExp(`${routeId}:\\s*\\[`), `routeActions missing actions for ${routeId}`);
  }
});

test('platform interactivity: workspace shell exposes queue and advisory controls', async () => {
  const workspace = await readFile(resolve(root, 'src/design/components/workspace.tsx'), 'utf8');
  const workspacePage = await readFile(resolve(root, 'src/workspaces/WorkspacePage.tsx'), 'utf8');
  const actionDock = await readFile(resolve(root, 'src/shell/ActionDock.tsx'), 'utf8');
  assert.match(workspace, /ApprovalDecisionButtons/);
  assert.match(workspace, /Request approval/);
  assert.match(workspacePage, /buildRouteActions/);
  assert.match(workspacePage, /isDevJsonEnabled/);
  assert.match(actionDock, /actionKind/);
  assert.match(actionDock, /useWorkspaceActionMutation/);
});

test('platform interactivity: domain panels wire mutation helpers', async () => {
  for (const [file, fragment] of interactivePanelBindings) {
    const source = await readFile(resolve(root, `src/workspaces/views/${file}`), 'utf8');
    assert.match(source, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${file} missing ${fragment}`);
  }
});

test('platform interactivity: mutation path groups cover operational routes', async () => {
  const paths = await readFile(resolve(root, 'src/api/paths.ts'), 'utf8');
  for (const routeId of ['raceDay', 'surface', 'notifications', 'workforce', 'digitalTwin', 'compliance']) {
    assert.match(paths, new RegExp(`${routeId}:\\s*\\[`), `routeMutationPathGroups missing ${routeId}`);
  }
  assert.match(paths, /documented-stub/);
  assert.match(paths, /escalationSimulate/);
  assert.match(paths, /operationalActions/);
});

test('platform interactivity: route badges distinguish facade and live routes', async () => {
  const routes = await readFile(resolve(root, 'src/routes/routes.ts'), 'utf8');
  assert.match(routes, /supportStatus: 'facade-api'/);
  assert.match(routes, /supportStatus: 'live-api'/);
});
