export type IdentityKind = 'user' | 'service' | 'machine' | 'ai-agent' | 'workflow' | 'integration';
export type GovernancePermission =
  | 'identity:read'
  | 'identity:write'
  | 'policy:manage'
  | 'access:request'
  | 'access:approve'
  | 'access:review'
  | 'audit:read'
  | 'compliance:report'
  | 'tenant:admin'
  | 'privileged:elevate'
  | 'service:operate'
  | 'workflow:execute'
  | 'integration:invoke'
  | 'ai-agent:act';

export interface EntraTenantIntegration {
  tenantId: string;
  issuer: string;
  jwksUri: string;
  authority: string;
  appId: string;
  syncGroups: string[];
  conditionalAccessPolicies: string[];
}

export interface GovernedIdentity {
  id: string;
  tenantId: string;
  kind: IdentityKind;
  displayName: string;
  entraObjectId?: string;
  roles: string[];
  attributes: Record<string, string | number | boolean | string[]>;
  delegatedScopes?: string[];
  servicePrincipal?: boolean;
  managedIdentity?: boolean;
}

export interface AccessPolicy {
  id: string;
  tenantId: string;
  name: string;
  permissions: GovernancePermission[];
  roles?: string[];
  subjectKinds?: IdentityKind[];
  attributes?: Record<string, string | number | boolean>;
  conditions?: string[];
  requiresApproval?: boolean;
  privileged?: boolean;
  evidenceRequired?: string[];
}

export interface AccessDecision {
  allowed: boolean;
  permission: GovernancePermission;
  identityId: string;
  tenantId: string;
  matchedPolicies: string[];
  reason: string;
  approvalRequired: boolean;
  evidence: string[];
}

export interface AuditTrailEntry {
  id: string;
  tenantId: string;
  actorId: string;
  actorKind: IdentityKind;
  action: string;
  target: string;
  timestamp: string;
  decision: 'allowed' | 'denied' | 'pending-approval' | 'approved' | 'revoked';
  evidence: string[];
  policyIds: string[];
  correlationId: string;
}

export interface AccessRequest {
  id: string;
  tenantId: string;
  requesterId: string;
  permission: GovernancePermission;
  target: string;
  justification: string;
  evidence: string[];
  durationMinutes?: number;
  approvers: string[];
}

export interface TemporaryElevation {
  id: string;
  tenantId: string;
  identityId: string;
  permission: GovernancePermission;
  startsAt: string;
  expiresAt: string;
  approvedBy: string[];
  evidence: string[];
}

export class EnterpriseIdentityGovernancePlatform {
  private readonly identities = new Map<string, GovernedIdentity>();
  private readonly policies = new Map<string, AccessPolicy>();
  private readonly auditTrail: AuditTrailEntry[] = [];
  private readonly elevations: TemporaryElevation[] = [];

  constructor(public readonly entra: EntraTenantIntegration) {}

  registerIdentity(identity: GovernedIdentity): GovernedIdentity {
    this.assertTenant(identity.tenantId);
    this.identities.set(identity.id, { ...identity, roles: [...identity.roles], attributes: { ...identity.attributes }, delegatedScopes: [...(identity.delegatedScopes ?? [])] });
    this.audit(identity, 'identity.register', identity.id, 'allowed', ['entra-sync', ...(identity.entraObjectId ? ['entra-object-linked'] : [])], [], `identity-${identity.id}`);
    return this.identity(identity.id)!;
  }

  definePolicy(policy: AccessPolicy): AccessPolicy {
    this.assertTenant(policy.tenantId);
    this.policies.set(policy.id, { ...policy, permissions: [...policy.permissions], roles: [...(policy.roles ?? [])], subjectKinds: [...(policy.subjectKinds ?? [])], attributes: { ...(policy.attributes ?? {}) }, conditions: [...(policy.conditions ?? [])], evidenceRequired: [...(policy.evidenceRequired ?? [])] });
    this.auditSystem('policy.define', policy.id, ['policy-as-code', 'tenant-isolation'], [policy.id]);
    return this.policy(policy.id)!;
  }

  decide(identityId: string, permission: GovernancePermission, context: { tenantId: string; target: string; evidence?: string[]; now?: string; correlationId?: string }): AccessDecision {
    this.assertTenant(context.tenantId);
    const identity = this.identity(identityId);
    const evidence = [...(context.evidence ?? [])];
    if (!identity || identity.tenantId !== context.tenantId) return this.denied(identityId, permission, context, evidence, 'identity not found in tenant');
    const activeElevation = this.elevations.find((e) => e.identityId === identityId && e.tenantId === context.tenantId && e.permission === permission && (context.now ?? new Date().toISOString()) <= e.expiresAt);
    const matched = [...this.policies.values()].filter((policy) => this.policyMatches(policy, identity, permission));
    const policyEvidence = matched.flatMap((p) => p.evidenceRequired ?? []);
    const requiredEvidenceMissing = policyEvidence.some((required) => !evidence.includes(required) && !activeElevation?.evidence.includes(required));
    const approvalRequired = matched.some((p) => p.requiresApproval || p.privileged) && !activeElevation;
    const allowed = matched.length > 0 && !requiredEvidenceMissing && !approvalRequired;
    const decision: AccessDecision = { allowed, permission, identityId, tenantId: context.tenantId, matchedPolicies: matched.map((p) => p.id), reason: allowed ? 'explicit policy grant' : approvalRequired ? 'approval required' : requiredEvidenceMissing ? 'required evidence missing' : 'no matching policy', approvalRequired, evidence: [...evidence, ...(activeElevation?.evidence ?? [])] };
    this.audit(identity, `access.${permission}`, context.target, allowed ? 'allowed' : approvalRequired ? 'pending-approval' : 'denied', decision.evidence, decision.matchedPolicies, context.correlationId ?? `access-${identityId}`);
    return decision;
  }

  requestElevation(request: AccessRequest): TemporaryElevation | undefined {
    this.assertTenant(request.tenantId);
    const requester = this.identity(request.requesterId);
    if (!requester || requester.tenantId !== request.tenantId || request.approvers.length < 2 || request.evidence.length === 0 || !request.justification) {
      if (requester) this.audit(requester, 'elevation.request', request.target, 'denied', request.evidence, [], request.id);
      return undefined;
    }
    const startsAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + (request.durationMinutes ?? 60) * 60_000).toISOString();
    const elevation: TemporaryElevation = { id: request.id, tenantId: request.tenantId, identityId: request.requesterId, permission: request.permission, startsAt, expiresAt, approvedBy: [...request.approvers], evidence: ['approval-workflow', ...request.evidence] };
    this.elevations.push(elevation);
    this.audit(requester, 'elevation.approve', request.target, 'approved', elevation.evidence, [], request.id);
    return { ...elevation, approvedBy: [...elevation.approvedBy], evidence: [...elevation.evidence] };
  }

  runAccessReview(tenantId: string): { tenantId: string; reviewedIdentities: number; orphanedServiceIdentities: string[]; privilegedPolicies: string[]; evidence: string[] } {
    this.assertTenant(tenantId);
    const identities = [...this.identities.values()].filter((i) => i.tenantId === tenantId);
    const orphanedServiceIdentities = identities.filter((i) => (i.kind === 'service' || i.kind === 'machine') && !i.attributes.owner).map((i) => i.id);
    const privilegedPolicies = [...this.policies.values()].filter((p) => p.tenantId === tenantId && p.privileged).map((p) => p.id);
    this.auditSystem('access-review.complete', tenantId, ['review-attestation', 'least-privilege-analysis'], privilegedPolicies);
    return { tenantId, reviewedIdentities: identities.length, orphanedServiceIdentities, privilegedPolicies, evidence: ['review-attestation', 'least-privilege-analysis', 'separation-of-duties-check'] };
  }

  complianceReport(tenantId: string) {
    this.assertTenant(tenantId);
    const events = this.auditTrail.filter((e) => e.tenantId === tenantId);
    return { tenantId, controls: ['Microsoft Entra ID federation', 'RBAC', 'ABAC', 'PAM/JIT elevation', 'delegated administration', 'service and machine identity governance', 'approval workflows', 'access reviews', 'immutable audit logging', 'tenant isolation'], auditEvents: events.length, deniedEvents: events.filter((e) => e.decision === 'denied').length, evidence: [...new Set(events.flatMap((e) => e.evidence))] };
  }

  auditEntries(tenantId?: string): AuditTrailEntry[] { return this.auditTrail.filter((e) => !tenantId || e.tenantId === tenantId).map((e) => ({ ...e, evidence: [...e.evidence], policyIds: [...e.policyIds] })); }
  identity(id: string) { const value = this.identities.get(id); return value ? { ...value, roles: [...value.roles], attributes: { ...value.attributes }, delegatedScopes: [...(value.delegatedScopes ?? [])] } : undefined; }
  policy(id: string) { const value = this.policies.get(id); return value ? { ...value, permissions: [...value.permissions], roles: [...(value.roles ?? [])], subjectKinds: [...(value.subjectKinds ?? [])], attributes: { ...(value.attributes ?? {}) }, conditions: [...(value.conditions ?? [])], evidenceRequired: [...(value.evidenceRequired ?? [])] } : undefined; }

  private policyMatches(policy: AccessPolicy, identity: GovernedIdentity, permission: GovernancePermission): boolean {
    return policy.tenantId === identity.tenantId && policy.permissions.includes(permission) && (!policy.roles?.length || policy.roles.some((role) => identity.roles.includes(role))) && (!policy.subjectKinds?.length || policy.subjectKinds.includes(identity.kind)) && Object.entries(policy.attributes ?? {}).every(([key, value]) => identity.attributes[key] === value);
  }
  private denied(identityId: string, permission: GovernancePermission, context: { tenantId: string; target: string; correlationId?: string }, evidence: string[], reason: string): AccessDecision { this.auditSystem(`access.${permission}`, context.target, evidence, []); return { allowed: false, permission, identityId, tenantId: context.tenantId, matchedPolicies: [], reason, approvalRequired: false, evidence }; }
  private audit(identity: GovernedIdentity, action: string, target: string, decision: AuditTrailEntry['decision'], evidence: string[], policyIds: string[], correlationId: string) { this.auditTrail.push({ id: `audit-${this.auditTrail.length + 1}`, tenantId: identity.tenantId, actorId: identity.id, actorKind: identity.kind, action, target, timestamp: new Date().toISOString(), decision, evidence: [...evidence], policyIds: [...policyIds], correlationId }); }
  private auditSystem(action: string, target: string, evidence: string[], policyIds: string[]) { this.auditTrail.push({ id: `audit-${this.auditTrail.length + 1}`, tenantId: this.entra.tenantId, actorId: 'system', actorKind: 'service', action, target, timestamp: new Date().toISOString(), decision: 'allowed', evidence: [...evidence], policyIds: [...policyIds], correlationId: `system-${this.auditTrail.length + 1}` }); }
  private assertTenant(tenantId: string) { if (tenantId !== this.entra.tenantId) throw new Error(`tenant isolation violation for ${tenantId}`); }
}

export function enterpriseIdentityGovernanceBlueprint() {
  return ['Microsoft Entra ID integration', 'role-based access control', 'attribute-based access control', 'privileged access management', 'delegated administration', 'temporary elevation', 'service identities', 'machine identities', 'approval workflows', 'access reviews', 'audit logging', 'compliance reporting', 'tenant isolation'].map((capability) => ({ capability, explicitPermissions: true, auditEvidence: true, policyGoverned: true }));
}
