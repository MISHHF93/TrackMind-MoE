import assert from 'node:assert/strict';
import test from 'node:test';
import { apiEndpointContracts, hasPermission, roles as nexusRoles } from '@trackmind/shared';
import { domainScreens, productPersonas } from '../dist/shell/domains.js';
import { breadcrumbForPath, filterCommandPalette } from '../dist/shell/experience.js';
import { activeNavItem, isNavItemActive, navItems, navLinkState, navSections, routeMetadataById, visibleNavItems } from '../dist/shell/navigation.js';

const requiredRoutes = [
  ['operations', 'Operations Command', '/operations'],
  ['race-office', 'Race Office', '/race-office'],
  ['track-configuration', 'Track Configuration', '/track-configuration'],
  ['starting-gate', 'Starting Gate Control', '/starting-gate'],
  ['surface', 'Surface Intelligence', '/surface'],
  ['equine', 'Equine Intelligence', '/equine'],
  ['barns', 'Barn Operations', '/barns'],
  ['stewards', 'Steward Center', '/stewards'],
  ['safety', 'Safety Center', '/safety'],
  ['security', 'Security', '/security'],
  ['emergency', 'Emergency Ops', '/emergency'],
  ['assets', 'Asset Registry', '/assets'],
  ['digital-twin', 'Digital Twin View', '/digital-twin'],
  ['facilities', 'Facilities', '/facilities'],
  ['workforce', 'Workforce', '/workforce'],
  ['approvals', 'Approvals', '/approvals'],
  ['audit', 'Audit Ledger', '/audit'],
  ['compliance', 'Compliance', '/compliance'],
  ['ai-governance', 'AI Governance', '/ai-governance'],
  ['api-hub', 'Racing Data API Hub', '/api-hub'],
  ['executive', 'Executive Center', '/executive'],
  ['platform-health', 'Platform Health', '/platform-health'],
];

test('frontend product model covers required first-class routes from navigation', () => {
  assert.equal(requiredRoutes.length, 22);
  const navById = new Map(navItems.map((item) => [item.id, item]));
  const screenById = new Map(domainScreens.map((screen) => [screen.id, screen]));

  for (const [id, label, path] of requiredRoutes) {
    const nav = navById.get(id);
    const screen = screenById.get(id);
    assert.ok(nav, `${id} missing from navigation`);
    assert.ok(screen, `${id} missing from product model`);
    assert.equal(nav.label, label);
    assert.equal(nav.path, path);
    assert.equal(screen.title, label);
    assert.equal(screen.route, path);
    assert.equal(screen.workspace.path, path);
  }
});

test('route registry exposes complete persistent shell metadata', () => {
  assert.deepEqual(navSections.map((section) => section.label), ['Operations','Equine','Safety','Facilities','Governance','Intelligence','Executive','Platform Admin']);
  const screenById = new Map(domainScreens.map((screen) => [screen.id, screen]));

  for (const item of navItems) {
    assert.ok(item.label.length > 0, `${item.id} label missing`);
    assert.ok(item.path.startsWith('/'), `${item.id} path missing`);
    assert.ok(item.iconKey.length > 0, `${item.id} icon key missing`);
    assert.equal(item.workspaceGroup, item.section, `${item.id} workspace group drifted`);
    assert.deepEqual(item.requiredPermissions, item.required ?? [], `${item.id} required permissions drifted`);
    assert.deepEqual(item.roleVisibility.permissions, item.requiredPermissions, `${item.id} role visibility permissions drifted`);
    assert.ok(item.roleVisibility.roles.length > 0, `${item.id} visible roles missing`);
    assert.ok(['authenticated', 'permission-gated'].includes(item.roleVisibility.policy), `${item.id} role policy missing`);
    assert.ok(item.badgeSource.static.includes('readiness'), `${item.id} readiness badge source missing`);
    assert.ok(item.badgeSource.static.includes('data-state'), `${item.id} data-state badge source missing`);
    assert.ok(item.breadcrumbLabel.length > 0, `${item.id} breadcrumb label missing`);
    assert.equal(item.dataState.eventReady, item.eventReady, `${item.id} event readiness drifted`);
    assert.equal(item.dataState.mockAllowed, item.mockAllowed, `${item.id} mock/live state drifted`);
    assert.equal(item.dataState.safeForDecisioning, false, `${item.id} mock/live state must not be decisioning-safe`);
    assert.equal(item.safetyPosture.protectedControlsLocked, true, `${item.id} protected controls should default locked`);
    assert.equal(item.safetyPosture.autonomousExecutionAllowed, false, `${item.id} autonomous execution must stay blocked`);

    const screen = screenById.get(item.id);
    assert.ok(screen, `${item.id} product screen missing`);
    assert.equal(screen.iconKey, item.iconKey);
    assert.equal(screen.workspace.group, item.workspaceGroup);
    assert.deepEqual(screen.roleVisibility.requiredPermissions, item.requiredPermissions);
    assert.equal(screen.dataState.mode, item.dataState.mode);
    assert.equal(screen.safetyPosture.posture, item.safetyPosture.posture);
  }
});

test('API Hub route metadata drives breadcrumbs, active states, and command palette entries', () => {
  const apiHub = navItems.find((item) => item.id === 'api-hub');
  const apiScreen = domainScreens.find((screen) => screen.id === 'api-hub');
  assert.ok(apiHub);
  assert.ok(apiScreen);
  assert.equal(apiHub.section, 'platform-admin');
  assert.equal(apiHub.iconKey, 'api-hub');
  assert.equal(apiHub.safetyPosture.posture, 'read-only');
  assert.equal(apiScreen.liveApi, '/racing-data');
  assert.deepEqual(breadcrumbForPath('/api-hub/providers'), ['Nexus', 'Platform Admin', 'Racing Data API Hub', 'Providers']);
  assert.equal(activeNavItem('/api-hub/quality?panel=rules')?.id, 'api-hub');
  assert.equal(isNavItemActive('/api-hub/lineage', apiHub), true);
  assert.equal(navLinkState('/api-hubness', apiHub).active, false);

  const palette = filterCommandPalette('provider registry', ['read-only-auditor']);
  const providers = palette.find((item) => item.path === '/api-hub/providers');
  assert.ok(providers);
  assert.equal(providers.iconKey, 'api-hub');
  assert.equal(providers.workspaceGroup, 'platform-admin');
  assert.equal(providers.safetyPosture.posture, 'read-only');
});

test('route and command labels avoid tenant-specific leakage', () => {
  const forbiddenTenantLabel = /Saratoga|Belmont|Mock Training Track|mock-main-track|track-1|tenantId|racetrackId/i;
  const labels = [
    ...navItems.flatMap((item) => [item.label, item.breadcrumbLabel, item.iconKey, item.path, ...((item.deepLinks ?? []).map((link) => `${link.label} ${link.path}`))]),
    ...filterCommandPalette('', ['admin']).map((item) => `${item.label} ${item.path} ${item.breadcrumbLabel}`),
    ...requiredRoutes.flatMap(([, , path]) => breadcrumbForPath(path)),
  ];

  for (const label of labels) assert.doesNotMatch(label, forbiddenTenantLabel, `tenant-specific label leaked: ${label}`);
});

test('route product metadata is complete enough to drive product UX copy', () => {
  const personaIds = new Set(productPersonas.map((persona) => persona.id));

  for (const screen of domainScreens) {
    assert.ok(screen.owner.length > 0, `${screen.id} owner missing`);
    assert.ok(screen.eventStreams.length > 0, `${screen.id} event streams missing`);
    assert.ok(screen.osComponentIds.length > 0, `${screen.id} OS coverage missing`);
    assert.ok(screen.universalSchemaCoverage.length > 0, `${screen.id} schema coverage missing`);
    assert.ok(screen.personas.length > 0, `${screen.id} personas missing`);
    assert.ok(screen.primaryTasks.length >= 3, `${screen.id} primary tasks missing`);
    for (const persona of screen.personas) assert.ok(personaIds.has(persona), `${screen.id} unknown persona ${persona}`);
    for (const value of Object.values(screen.productCopy)) assert.ok(String(value).length > 0, `${screen.id} product copy incomplete`);
    assert.equal(screen.productCopy.title, screen.title);
    assert.equal(screen.workspace.label, screen.title);
  }
});

test('route role visibility mirrors shared permissions and nav filtering', () => {
  const navById = new Map(navItems.map((item) => [item.id, item]));

  for (const screen of domainScreens) {
    const nav = navById.get(screen.id);
    const expectedRoles = nav.required?.length
      ? nexusRoles.filter((role) => nav.required.some((permission) => hasPermission(role, permission)))
      : [...nexusRoles];
    assert.deepEqual(screen.roleVisibility.roles, expectedRoles, `${screen.id} role visibility drifted from permissions`);
    assert.deepEqual(screen.roleVisibility.permissions, nav.required ?? []);
    assert.deepEqual(screen.roleVisibility.personas, screen.personas);
  }

  const auditorRoutes = visibleNavItems(['read-only-auditor']).map((item) => item.id);
  assert.ok(auditorRoutes.includes('safety'));
  assert.ok(auditorRoutes.includes('api-hub'));
  assert.ok(auditorRoutes.includes('platform-health'));
  assert.equal(auditorRoutes.includes('starting-gate'), false);
  assert.equal(auditorRoutes.includes('approvals'), false);
});

test('safety-critical and approval-required action metadata is locked by default', () => {
  const routesWithStateChanges = domainScreens.filter((screen) => screen.stateChangingActions.length > 0);
  assert.ok(routesWithStateChanges.length > 0);

  for (const screen of routesWithStateChanges) {
    assert.equal(screen.approvalRequiredActions.length, screen.stateChangingActions.length, `${screen.id} approval actions should mirror state-changing actions`);
    assert.ok(screen.approvalRequiredActions.every((action) => action.approvalRequired === true));
    assert.ok(screen.approvalRequiredActions.every((action) => action.autonomousExecutionAllowed === false));
    assert.ok(screen.approvalRequiredActions.every((action) => action.approvalApi.startsWith('POST /api/v1/')));
    assert.ok(screen.approvalRequiredActions.every((action) => action.requiredRoles.length > 0));
    assert.ok(screen.approvalRequiredActions.every((action) => action.evidenceRequired.length > 0));
  }

  for (const id of ['race-office','starting-gate','surface','equine','stewards','safety','security','emergency','ai-governance']) {
    const screen = domainScreens.find((candidate) => candidate.id === id);
    assert.ok(screen.safetyCriticalActions.length > 0, `${id} should declare safety-critical action metadata`);
    assert.ok(screen.safetyCriticalActions.every((action) => action.safetyCritical === true));
  }
});

test('mock-data and degraded-service route states are explicit', () => {
  for (const screen of domainScreens) {
    assert.equal(screen.mockDataState.safeForDecisioning, false, `${screen.id} mock state must not be decisioning-safe`);
    assert.equal(screen.mockDataState.allowed, navItems.find((item) => item.id === screen.id).mockAllowed);
    assert.ok(screen.mockDataState.reason.length > 0);
    assert.equal(screen.degradedServiceState.readOnlyAvailable, true);
    assert.equal(screen.degradedServiceState.safetyControlsLocked, true);
    assert.deepEqual(screen.degradedServiceState.lockedActions, screen.stateChangingActions);
  }
});

test('domain product model is not a disconnected route registry', () => {
  const navById = new Map(navItems.map((item) => [item.id, item]));
  assert.deepEqual(new Set(Object.keys(routeMetadataById)), new Set(navItems.map((item) => item.id)));
  assert.deepEqual(new Set(domainScreens.map((screen) => screen.id)), new Set(navItems.map((item) => item.id)));

  const contractedPaths = new Set(apiEndpointContracts.map((contract) => contract.path.replace('/api/v1', '')));
  for (const screen of domainScreens) {
    const nav = navById.get(screen.id);
    assert.equal(screen.route, nav.path);
    assert.equal(screen.title, nav.label);
    assert.deepEqual(screen.osComponentIds, nav.osComponentIds);
    assert.deepEqual(screen.universalSchemaCoverage, nav.universalSchemaCoverage);
    assert.equal(screen.readinessStatus, nav.readinessStatus);
    if (screen.liveApi && !contractedPaths.has(screen.liveApi)) assert.ok(screen.mockReason, `${screen.id} uncontracted liveApi should explain its boundary`);
  }
});
