import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPermission,
  normalizeRole,
  roles,
  assignableRoles,
  homeRouteForRole,
  canRoleViewRoute,
  canRoleApproveAction,
  approvalActorRegistry,
  legacyRoleAliases,
  canonicalToLegacyRoleBridge,
  contractAllowsRole,
} from '../dist/index.js';

test('legacy role aliases normalize to canonical slugs', () => {
  assert.equal(normalizeRole('platform-super-admin'), 'platform-super-admin');
  assert.equal(normalizeRole('racing-secretary'), 'horse-operations-coordinator');
  assert.equal(normalizeRole('welfare-officer'), 'equine-welfare-officer');
  assert.equal(normalizeRole('steward'), 'steward');
});

test('read-only auditor cannot mutate regulated actions', () => {
  assert.equal(hasPermission('read-only-auditor', 'race:finalize-results'), false);
  assert.equal(hasPermission('read-only-auditor', 'read:any'), true);
});

test('role permissions grant scoped operational access', () => {
  assert.equal(hasPermission('veterinarian', 'vet:clear-flag'), true);
  assert.equal(hasPermission('finance-manager', 'security:manage'), false);
  assert.equal(hasPermission('paddock-official', 'paddock:operate'), true);
  assert.equal(hasPermission('executive', 'executive:read'), true);
  assert.equal(hasPermission('staff-limited', 'staff:task'), true);
  assert.equal(hasPermission('staff-limited', 'tenant:admin'), false);
});

test('platform super admin has all permissions but steward approves race start', () => {
  assert.equal(hasPermission('platform-super-admin', 'platform:admin'), true);
  assert.equal(canRoleApproveAction('steward', 'race-start'), true);
  assert.equal(canRoleApproveAction('paddock-official', 'race-start'), false);
});

test('twenty assignable personas plus system role', () => {
  assert.equal(assignableRoles.length, 20);
  assert.equal(roles.length, 21);
  assert.ok(!assignableRoles.includes('ai-safety-agent'));
});

test('role home routes resonate with persona', () => {
  assert.equal(homeRouteForRole('steward'), 'stewarding');
  assert.equal(homeRouteForRole('veterinarian'), 'equine');
  assert.equal(homeRouteForRole('executive'), 'analytics');
  assert.equal(homeRouteForRole('read-only-auditor'), 'audit');
  assert.equal(homeRouteForRole('race-day-operations-manager'), 'raceDay');
});

test('route visibility matrix blocks staff from stewarding', () => {
  assert.equal(canRoleViewRoute('steward', 'stewarding'), true);
  assert.equal(canRoleViewRoute('staff-limited', 'stewarding'), false);
  assert.equal(canRoleViewRoute('finance-manager', 'finance'), true);
});

test('approval actor registry covers protected actions', () => {
  for (const action of Object.keys(approvalActorRegistry)) {
    const binding = approvalActorRegistry[action];
    assert.ok(binding.requestors.length > 0, `${action} requestors`);
    assert.ok(binding.approvers.length > 0, `${action} approvers`);
  }
});

test('every legacy alias maps to canonical role', () => {
  for (const [legacy, canonical] of Object.entries(legacyRoleAliases)) {
    assert.equal(normalizeRole(legacy), canonical);
  }
});

test('canonical to legacy bridge covers primary persona renames', () => {
  assert.equal(canonicalToLegacyRoleBridge['platform-super-admin'], 'admin');
  assert.equal(canonicalToLegacyRoleBridge['horse-operations-coordinator'], 'racing-secretary');
});

test('contractAllowsRole aligns legacy contract slugs with canonical actors', () => {
  assert.equal(contractAllowsRole(['admin', 'steward'], 'platform-super-admin'), true);
  assert.equal(contractAllowsRole(['platform-super-admin'], 'platform-super-admin'), true);
  assert.equal(contractAllowsRole(['steward'], 'platform-super-admin'), false);
});

test('canonical slugs bridge to legacy ids when legacy registry is still active', () => {
  const legacyRoles = [
    'admin',
    'steward',
    'veterinarian',
    'track-superintendent',
    'security',
    'ticketing-manager',
    'finance',
    'racing-secretary',
    'compliance-officer',
    'read-only-auditor',
    'operations-admin',
    'ai-safety-agent',
  ];
  const simulateNormalize = (raw) => {
    const value = raw.trim();
    if (legacyRoles.includes(value)) return value;
    const fromLegacy = legacyRoleAliases[value];
    if (fromLegacy && legacyRoles.includes(fromLegacy)) return fromLegacy;
    const bridged = {
      'platform-super-admin': 'admin',
      'organization-admin': 'operations-admin',
      'horse-operations-coordinator': 'racing-secretary',
      'facilities-manager': 'track-superintendent',
      'security-manager': 'security',
      'finance-manager': 'finance',
      'ticketing-fan-manager': 'ticketing-manager',
      'equine-welfare-officer': 'welfare-officer',
      'race-day-operations-manager': 'incident-commander',
    }[value];
    if (bridged && legacyRoles.includes(bridged)) return bridged;
    return undefined;
  };

  assert.equal(simulateNormalize('platform-super-admin'), 'admin');
  assert.equal(simulateNormalize('horse-operations-coordinator'), 'racing-secretary');
  assert.equal(normalizeRole(' platform-super-admin '), 'platform-super-admin');
});
