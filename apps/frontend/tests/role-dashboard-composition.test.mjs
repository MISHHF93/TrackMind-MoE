import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';
import {
  filterKpisForRole,
  quickActionsForRole,
  visibleKpiDomainsForRole,
} from '../../../packages/shared/dist/index.js';

const root = resolve(import.meta.dirname, '..');

test('race-day operations manager has operational quick actions', () => {
  const actions = quickActionsForRole('race-day-operations-manager');
  assert.ok(actions.includes('race-start-approval'));
  assert.ok(visibleKpiDomainsForRole('race-day-operations-manager').includes('race-day-operations'));
});

test('executive persona sees finance KPI domain only when allowed', () => {
  const kpis = [
    { id: 'f', domain: 'finance', label: 'Revenue' },
    { id: 'v', domain: 'veterinary-operations', label: 'Vet' },
  ];
  const visible = filterKpisForRole(kpis, 'executive');
  assert.equal(visible.some((k) => k.id === 'f'), true);
  assert.equal(visible.some((k) => k.id === 'v'), false);
});

test('frontend wires useRoleWorkspace into shell and workspace', async () => {
  const workspacePage = await readFile(resolve(root, 'src/workspaces/WorkspacePage.tsx'), 'utf8');
  const appShell = await readFile(resolve(root, 'src/shell/AppShell.tsx'), 'utf8');
  const commandBar = await readFile(resolve(root, 'src/shell/CommandBar.tsx'), 'utf8');
  const notificationCenter = await readFile(resolve(root, 'src/shell/NotificationCenter.tsx'), 'utf8');
  const roleQuickActions = await readFile(resolve(root, 'src/domain/roleQuickActions.ts'), 'utf8');

  assert.match(workspacePage, /useRoleWorkspace/);
  assert.match(workspacePage, /mergeRoleQuickActions/);
  assert.match(appShell, /useRoleWorkspace/);
  assert.match(commandBar, /useRoleWorkspace/);
  assert.match(notificationCenter, /notificationChannels/);
  assert.match(roleQuickActions, /quickActionRegistry/);
});
