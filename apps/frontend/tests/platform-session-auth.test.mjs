import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('assigned role picker is wired in command bar', () => {
  const commandBar = readFileSync(path.join(root, 'src/shell/CommandBar.tsx'), 'utf8');
  assert.match(commandBar, /AssignedRolePicker/);
  assert.match(commandBar, /OperatorIdentityMenu/);
  assert.doesNotMatch(commandBar, /RoleSwitcher/);
});

test('login route and auth gate exist', () => {
  const router = readFileSync(path.join(root, 'src/app/router.tsx'), 'utf8');
  const authGate = readFileSync(path.join(root, 'src/auth/AuthGate.tsx'), 'utf8');
  assert.match(router, /LoginPage/);
  assert.match(router, /AuthGate/);
  assert.match(router, /path: '\/login'/);
  assert.match(authGate, /Restoring operator session/);
});

test('account workspace has tabbed identity panels', () => {
  const panels = readFileSync(path.join(root, 'src/workspaces/views/accountPanels.tsx'), 'utf8');
  const roles = readFileSync(path.join(root, 'src/workspaces/views/account/AccountRolesTab.tsx'), 'utf8');
  const security = readFileSync(path.join(root, 'src/workspaces/views/account/AccountSecurityTab.tsx'), 'utf8');
  assert.match(panels, /TabsTrigger value="overview"/);
  assert.match(panels, /TabsTrigger value="security"/);
  assert.match(roles, /createAccessRequest/);
  assert.match(security, /revokeOtherOperatorSessions/);
});

test('identity api client covers preferences and sessions', () => {
  const identityApi = readFileSync(path.join(root, 'src/api/identityApi.ts'), 'utf8');
  assert.match(identityApi, /fetchOperatorPreferences/);
  assert.match(identityApi, /listOperatorSessions/);
  assert.match(identityApi, /createAccessRequest/);
});

test('sidebar footer exposes profile and sign out', () => {
  const sidebar = readFileSync(path.join(root, 'src/shell/Sidebar.tsx'), 'utf8');
  assert.match(sidebar, /My Profile/);
  assert.match(sidebar, /OperatorAvatar/);
  assert.match(sidebar, /Sign out/);
});

test('session state persists operator profile metadata', () => {
  const session = readFileSync(path.join(root, 'src/auth/session.ts'), 'utf8');
  assert.match(session, /profile\?: OperatorProfileDto/);
  assert.match(session, /expiresAt\?: string/);
  assert.match(session, /authProvider\?: string/);
});
