import assert from 'node:assert/strict';
import test from 'node:test';
import { auditFrontendDecommission } from '../dist/decommission/frontend.js';
import { auditCanonicalRouteRegistry, canonicalBreadcrumbsForPath, canonicalCommandPaletteItems, canonicalNavigationGroups, canonicalRoutes, resolveCanonicalRoute } from '../dist/routes/registry.js';
import { auditWorkspaceCohorts, workspaceModules } from '../dist/workspaces/cohorts.js';

test('canonical route registry covers all Nexus workspaces and derives shell helpers', () => {
  const audit = auditCanonicalRouteRegistry();
  assert.equal(audit.routeCount, 22);
  assert.equal(audit.duplicateIds, 0);
  assert.equal(audit.duplicatePaths, 0);
  assert.deepEqual(audit.nonAppShellRoutes, []);
  assert.deepEqual(audit.missingBackendMetadata, []);

  assert.deepEqual(canonicalBreadcrumbsForPath('/digital-twin/state'), ['Nexus', 'Intelligence', 'Digital Twin View']);
  assert.deepEqual(canonicalBreadcrumbsForPath('/ai-governance/reviews'), ['Nexus', 'Governance', 'AI Governance']);
  assert.equal(resolveCanonicalRoute('/surface-intelligence/sectors/far-turn', ['admin']).intent, 'redirect');
  assert.equal(resolveCanonicalRoute('/legacy-one-page-dashboard', ['admin']).intent, 'quarantined');
  assert.equal(resolveCanonicalRoute('/starting-gate', ['read-only-auditor']).intent, 'permission-denied');

  const commandItems = canonicalCommandPaletteItems(['admin']);
  assert.ok(commandItems.some((item) => item.path === '/starting-gate' && item.keywords.includes('starting-gate')));
  assert.ok(commandItems.some((item) => item.path === '/api-hub/providers'));

  const groups = canonicalNavigationGroups(['admin']);
  assert.ok(groups.find((group) => group.group === 'intelligence')?.routes.some((route) => route.id === 'digital-twin'));
  assert.ok(groups.find((group) => group.group === 'governance')?.routes.some((route) => route.id === 'ai-governance'));
});

test('frontend decommission audit keeps quarantined routes out of active routing', () => {
  const audit = auditFrontendDecommission();
  assert.equal(audit.activeRouteCount, 22);
  assert.deepEqual(audit.activeRoutesUsingQuarantinedPaths, []);
  assert.ok(audit.quarantinedAliases.includes('/legacy-one-page-dashboard'));
  assert.ok(audit.quarantinedAliases.includes('/nexus-operational-workspace-blueprint'));
  assert.ok(audit.compatibilityItems.includes('app-tsx-compat-command-center'));
  assert.ok(audit.removalCandidates.includes('state-wrapper-duplicates'));
});

test('workspace cohort manifest preserves boundaries for every canonical route', () => {
  assert.equal(workspaceModules.length, canonicalRoutes.length);
  const audit = auditWorkspaceCohorts();
  assert.ok(audit.moduleRendered.includes('starting-gate'));
  assert.ok(audit.moduleRendered.includes('surface'));
  assert.deepEqual(audit.missingApprovalBoundaries, []);
  assert.deepEqual(audit.missingMockLabels, []);

  for (const workspace of workspaceModules) {
    assert.ok(workspace.moduleId.startsWith(`workspaces/${workspace.cohort}/`));
    assert.equal(workspace.mockBoundary.labelled, true);
    assert.ok(['module', 'command-center-compat'].includes(workspace.renderStrategy));
  }
});
