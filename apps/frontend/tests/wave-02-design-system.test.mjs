import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('wave 02: AppShell exposes notification slot in command shell', async () => {
  const shell = await source('src/shell/AppShell.tsx');
  const commandBar = await source('src/shell/CommandBar.tsx');
  const notificationCenter = await source('src/shell/NotificationCenter.tsx');

  assert.match(shell, /CommandBar/);
  assert.match(commandBar, /NotificationCenter/);
  assert.match(notificationCenter, /export function NotificationCenter/);
  assert.match(notificationCenter, /aria-label="Notifications"/);
  assert.match(notificationCenter, /\/notifications\/inbox/);
});

test('wave 02: workspace headers show support status badges for every route', async () => {
  const workspace = await source('src/workspaces/WorkspacePage.tsx');
  const routes = await source('src/routes/routes.ts');
  const badge = await source('src/design/components/support-status-badge.tsx');
  const shellBadge = await source('src/shell/SupportStatusBadge.tsx');

  const routeCount = [...routes.matchAll(/id: '([^']+)'/g)].length;
  const supportStatusCount = [...routes.matchAll(/supportStatus:/g)].length;

  assert.equal(supportStatusCount, routeCount, 'every route must declare supportStatus');
  assert.match(workspace, /SupportStatusBadge status=\{route\.supportStatus\}/);
  assert.match(badge, /backendSupportLabels/);
  assert.match(shellBadge, /SupportStatusBadge/);
});

test('wave 02: degraded and mock labeling surfaces are present', async () => {
  const workspace = await source('src/workspaces/WorkspacePage.tsx');
  const banner = await source('src/shell/DegradedStateBanner.tsx');
  const sidebar = await source('src/shell/Sidebar.tsx');
  const support = await source('src/domain/support.ts');

  assert.match(banner, /export function DegradedStateBanner/);
  assert.match(workspace, /DegradedStateBanner/);
  assert.match(workspace, /degraded/);
  assert.match(sidebar, /supportLabel/);
  assert.match(support, /backendSupportLabels/);
  assert.match(support, /'live-api'/);
  assert.match(support, /'facade-api'/);
  assert.match(support, /'documented-stub'/);
});

test('wave 02: tenant, racetrack, and role context appear in command shell', async () => {
  const commandBar = await source('src/shell/CommandBar.tsx');
  const session = await source('src/auth/session.ts');

  assert.match(commandBar, /session\.tenantId/);
  assert.match(commandBar, /session\.racetrackId/);
  assert.match(commandBar, /roleDisplayName\(session\.role\)/);
  assert.match(session, /tenantId/);
  assert.match(session, /racetrackId/);
});

test('wave 02: navigation groups and KPI strip components are wired', async () => {
  const validate = await source('src/routes/validateRoutes.ts');
  const shell = await source('src/shell/AppShell.tsx');
  const kpiStrip = await source('src/design/components/kpi-strip.tsx');
  const states = await source('src/design/components/states.tsx');
  const commandPanels = await source('src/workspaces/views/commandPanels.tsx');

  assert.match(validate, /navigationGroups/);
  assert.match(shell, /navigationGroups/);
  assert.match(kpiStrip, /export function KpiStrip/);
  assert.match(commandPanels, /KpiStrip/);
  assert.match(states, /export function Skeleton/);
  assert.match(states, /export function LoadingState/);
});
