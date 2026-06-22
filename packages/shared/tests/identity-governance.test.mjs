import test from 'node:test';
import assert from 'node:assert/strict';
import { EnterpriseIdentityGovernancePlatform, enterpriseIdentityGovernanceBlueprint } from '../dist/index.js';

const entra = { tenantId: 'tenant-a', issuer: 'https://login.microsoftonline.com/tenant-a/v2.0', jwksUri: 'https://login.microsoftonline.com/tenant-a/discovery/v2.0/keys', authority: 'https://login.microsoftonline.com/tenant-a', appId: 'trackmind-api', syncGroups: ['TrackMind-Admins'], conditionalAccessPolicies: ['mfa-required'] };

test('enterprise identity governance enforces Entra tenant isolation, RBAC, ABAC, approvals, and audit evidence', () => {
  const platform = new EnterpriseIdentityGovernancePlatform(entra);
  platform.registerIdentity({ id: 'u1', tenantId: 'tenant-a', kind: 'user', displayName: 'Ops Admin', entraObjectId: 'entra-u1', roles: ['organization-admin'], attributes: { department: 'operations', region: 'east' } });
  platform.registerIdentity({ id: 'agent-1', tenantId: 'tenant-a', kind: 'ai-agent', displayName: 'Safety Agent', roles: ['ai-safety-agent'], attributes: { department: 'safety', region: 'east' }, managedIdentity: true });
  platform.definePolicy({ id: 'pol-admin', tenantId: 'tenant-a', name: 'Operations delegated admin', permissions: ['tenant:admin'], roles: ['organization-admin'], attributes: { region: 'east' }, requiresApproval: true, privileged: true, evidenceRequired: ['ticket'] });
  platform.definePolicy({ id: 'pol-agent', tenantId: 'tenant-a', name: 'AI agent bounded action', permissions: ['ai-agent:act'], subjectKinds: ['ai-agent'], attributes: { department: 'safety' }, evidenceRequired: ['model-policy'] });

  assert.equal(platform.decide('agent-1', 'ai-agent:act', { tenantId: 'tenant-a', target: 'risk-workflow', evidence: ['model-policy'] }).allowed, true);
  const pending = platform.decide('u1', 'tenant:admin', { tenantId: 'tenant-a', target: 'tenant-settings', evidence: ['ticket'] });
  assert.equal(pending.allowed, false);
  assert.equal(pending.approvalRequired, true);

  const elevation = platform.requestElevation({ id: 'elev-1', tenantId: 'tenant-a', requesterId: 'u1', permission: 'tenant:admin', target: 'tenant-settings', justification: 'incident response', evidence: ['ticket'], durationMinutes: 15, approvers: ['ciso', 'compliance'] });
  assert.equal(elevation?.permission, 'tenant:admin');
  assert.equal(platform.decide('u1', 'tenant:admin', { tenantId: 'tenant-a', target: 'tenant-settings', evidence: ['ticket'], now: elevation.expiresAt }).allowed, true);
  assert.equal(platform.runAccessReview('tenant-a').privilegedPolicies[0], 'pol-admin');
  const report = platform.complianceReport('tenant-a');
  assert.ok(report.controls.includes('tenant isolation'));
  assert.ok(report.auditEvents >= 8);
  assert.ok(report.evidence.includes('approval-workflow'));
  assert.throws(() => platform.registerIdentity({ id: 'u2', tenantId: 'tenant-b', kind: 'user', displayName: 'Wrong Tenant', roles: [], attributes: {} }), /tenant isolation/);
});

test('identity governance blueprint declares all requested platform capabilities', () => {
  const capabilities = enterpriseIdentityGovernanceBlueprint().map((item) => item.capability);
  assert.ok(capabilities.includes('Microsoft Entra ID integration'));
  assert.ok(capabilities.includes('service identities'));
  assert.ok(capabilities.includes('machine identities'));
  assert.ok(capabilities.every((capability) => typeof capability === 'string'));
});
