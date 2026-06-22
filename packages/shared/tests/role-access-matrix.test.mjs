import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignableRoles,
  canRoleAccessEntity,
  canRoleAccessRoute,
  canRoleExportAudit,
  canRoleViewKpiDomain,
  canRoleViewPrivacyScope,
  entityAccessRules,
  financeActionRoles,
  homeRouteForRole,
  isReadOnlyOperationalRole,
  kpiAdminRoles,
  roles,
  stewardRulingRoles,
} from '../dist/index.js';

test('entity access rules cover all major domains', () => {
  const domains = ['veterinary', 'welfare', 'financial', 'disciplinary', 'security', 'compliance', 'operational', 'platform'];
  for (const domain of domains) {
    assert.ok(entityAccessRules[domain], `missing entity rule for ${domain}`);
    assert.ok(entityAccessRules[domain].viewers.length > 0, `${domain} viewers`);
  }
});

test('veterinary privacy scopes block unauthorized roles', () => {
  assert.equal(canRoleViewPrivacyScope('veterinarian', 'veterinary-confidential'), true);
  assert.equal(canRoleViewPrivacyScope('finance-manager', 'veterinary-confidential'), false);
  assert.equal(canRoleViewPrivacyScope('compliance-officer', 'veterinary-confidential'), true);
  assert.equal(canRoleViewPrivacyScope('staff-limited', 'care-team'), false);
});

test('executive and analytics personas reach analytics route via operating model', () => {
  assert.equal(canRoleAccessRoute('executive', 'analytics'), true);
  assert.equal(canRoleAccessRoute('data-analytics-user', 'analytics'), true);
  assert.equal(canRoleAccessRoute('staff-limited', 'analytics'), false);
});

test('finance and steward action role bundles use canonical slugs', () => {
  assert.ok(financeActionRoles.includes('finance-manager'));
  assert.ok(!financeActionRoles.includes('admin'));
  assert.ok(stewardRulingRoles.includes('steward'));
  assert.ok(kpiAdminRoles.includes('organization-admin'));
});

test('read-only personas cannot edit operational routes by default', () => {
  assert.equal(isReadOnlyOperationalRole('read-only-auditor'), true);
  assert.equal(isReadOnlyOperationalRole('data-analytics-user'), true);
  assert.equal(isReadOnlyOperationalRole('steward'), false);
});

test('audit export is limited to governed roles', () => {
  assert.equal(canRoleExportAudit('compliance-officer'), true);
  assert.equal(canRoleExportAudit('read-only-auditor'), true);
  assert.equal(canRoleExportAudit('race-day-operations-manager'), false);
  assert.equal(canRoleExportAudit('staff-limited'), false);
});

test('KPI domain visibility aligns with persona workspaces', () => {
  assert.equal(canRoleViewKpiDomain('facilities-manager', 'facilities'), true);
  assert.equal(canRoleViewKpiDomain('facilities-manager', 'finance'), false);
  assert.equal(canRoleViewKpiDomain('security-manager', 'security'), true);
  assert.equal(canRoleViewKpiDomain('ticketing-fan-manager', 'fan-experience'), true);
});

test('entity financial view excludes paddock official', () => {
  assert.equal(canRoleAccessEntity('finance-manager', 'financial', 'view'), true);
  assert.equal(canRoleAccessEntity('paddock-official', 'financial', 'view'), false);
});

test('every assignable role has resonant home route in viewer matrix', () => {
  for (const role of assignableRoles) {
    const home = homeRouteForRole(role);
    assert.ok(canRoleAccessRoute(role, home), `${role} must access home route ${home}`);
  }
});

test('twenty assignable personas remain stable', () => {
  assert.equal(assignableRoles.length, 20);
  assert.equal(roles.length, 21);
});
