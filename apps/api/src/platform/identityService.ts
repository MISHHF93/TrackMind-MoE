import type {
  AccessRequestDto,
  AuthProviderWorkspaceDto,
  PlatformRoleDto,
  PlatformUserDto,
  RoleAssignmentResultDto,
  TenantRbacPolicyDto,
  TenantRbacPolicyStoreDto,
  TenantSessionDto,
} from '@trackmind/shared';
import {
  normalizeRole,
  rolePermissions,
  roleRegistry,
  roles,
  type Permission,
  type Role,
} from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';
import { createAuthProvider, type AuthProvider } from './authAbstraction.js';

const now = () => new Date().toISOString();

const seedUsers = (): PlatformUserDto[] => [
  {
    id: 'user-admin-1',
    tenantId: 'trackmind',
    organizationId: 'org-trackmind-network',
    displayName: 'Operations Admin',
    email: 'admin@trackmind.local',
    roles: ['platform-super-admin'],
    status: 'active',
    lastLoginAt: now(),
    createdAt: '2026-01-01T00:00:00.000Z',
    mock: false,
  },
  {
    id: 'user-steward-1',
    tenantId: 'trackmind',
    organizationId: 'org-trackmind-network',
    displayName: 'Chief Steward',
    email: 'steward@trackmind.local',
    roles: ['steward'],
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    mock: false,
  },
];

const seedPolicies = (): TenantRbacPolicyDto[] => [
  {
    id: 'policy-ops-read',
    tenantId: 'trackmind',
    name: 'Operations read baseline',
    permissions: ['read:any', 'kpi:read'],
    roles: ['steward', 'horse-operations-coordinator', 'read-only-auditor'],
    requiresApproval: false,
    privileged: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'policy-identity-governance',
    tenantId: 'trackmind',
    name: 'Identity governance',
    permissions: ['identity:read', 'identity:write', 'access:request', 'access:approve', 'access:review'],
    roles: ['organization-admin'],
    requiresApproval: true,
    privileged: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'policy-support-deny-regulated',
    tenantId: 'trackmind',
    name: 'Support operator regulated action deny',
    permissions: ['vet:clear-flag', 'finance:payout', 'discipline:issue', 'audit:export'],
    roles: ['support-operator'],
    requiresApproval: false,
    privileged: true,
    effect: 'deny',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export class IdentityService {
  readonly users: KeyValueRepository<PlatformUserDto>;
  readonly authProvider: AuthProvider;
  private roleAssignments: Array<{ userId: string; role: string; tenantId: string; assignedAt: string; assignedBy?: string }>;
  private accessRequests: AccessRequestDto[];
  private rbacPolicies: TenantRbacPolicyDto[];

  constructor(authProvider: AuthProvider = createAuthProvider()) {
    this.authProvider = authProvider;
    this.users = createRepository(seedUsers());
    this.roleAssignments = seedUsers().flatMap((u) =>
      u.roles.map((role) => ({ userId: u.id, role, tenantId: u.tenantId, assignedAt: u.createdAt })),
    );
    this.accessRequests = [];
    this.rbacPolicies = seedPolicies();
  }

  workspace() {
    return {
      generatedAt: now(),
      users: this.users.list(),
      roleAssignments: this.roleAssignments,
      accessRequests: this.accessRequests,
      mock: false,
    };
  }

  listUsers(tenantId?: string): PlatformUserDto[] {
    const users = this.users.list();
    return tenantId ? users.filter((u) => u.tenantId === tenantId) : users;
  }

  createUser(input: {
    tenantId: string;
    organizationId: string;
    displayName: string;
    email: string;
    roles?: Role[];
    status?: PlatformUserDto['status'];
  }): PlatformUserDto {
    const user: PlatformUserDto = {
      id: `user-${Date.now().toString(36)}`,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      displayName: input.displayName,
      email: input.email,
      roles: input.roles?.length ? [...input.roles] : ['read-only-auditor'],
      status: input.status ?? 'pending',
      createdAt: now(),
      mock: false,
    };
    this.users.upsert(user);
    for (const role of user.roles) {
      if (roles.includes(role as Role)) {
        this.roleAssignments.push({ userId: user.id, role, tenantId: user.tenantId, assignedAt: user.createdAt });
      }
    }
    return user;
  }

  listRoles(): PlatformRoleDto[] {
    return roles.map((role) => ({
      role,
      displayName: roleRegistry[role].displayName,
      group: roleRegistry[role].group,
      privileged: roleRegistry[role].privileged,
      assignable: roleRegistry[role].assignable,
      permissions: [...rolePermissions[role]],
    }));
  }

  listRoleAssignments(tenantId?: string) {
    return tenantId
      ? this.roleAssignments.filter((a) => a.tenantId === tenantId)
      : [...this.roleAssignments];
  }

  assignRole(
    userId: string,
    role: Role,
    tenantId: string,
    assignedBy?: string,
  ): RoleAssignmentResultDto {
    const canonical = normalizeRole(role);
    if (!canonical || !roles.includes(canonical)) throw new Error(`Invalid role: ${role}`);
    if (!roleRegistry[canonical].assignable && canonical !== 'platform-super-admin') {
      throw new Error(`Role is not assignable: ${canonical}`);
    }
    const user = this.users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    if (user.tenantId !== tenantId) throw new Error(`Tenant isolation violation for user ${userId}`);
    const rolesForUser = [...new Set([...user.roles, canonical])];
    const assignedAt = now();
    const updated = { ...user, roles: rolesForUser, status: user.status === 'pending' ? 'active' as const : user.status };
    this.users.upsert(updated);
    this.roleAssignments.push({ userId, role: canonical, tenantId, assignedAt, assignedBy });
    return { userId, role: canonical, tenantId, assignedAt, user: updated };
  }

  listAccessRequests(tenantId?: string): AccessRequestDto[] {
    return tenantId
      ? this.accessRequests.filter((r) => r.tenantId === tenantId)
      : [...this.accessRequests];
  }

  requestAccess(userId: string, requestedRole: string, tenantId: string): AccessRequestDto {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    if (user.tenantId !== tenantId) throw new Error(`Tenant isolation violation for user ${userId}`);
    const request: AccessRequestDto = {
      id: `access-${Date.now().toString(36)}`,
      tenantId,
      userId,
      requestedRole,
      status: 'pending',
      createdAt: now(),
    };
    this.accessRequests.push(request);
    return request;
  }

  reviewAccessRequest(
    requestId: string,
    decision: 'approved' | 'rejected',
    reviewedBy: string,
  ): AccessRequestDto {
    const request = this.accessRequests.find((r) => r.id === requestId);
    if (!request) throw new Error(`Access request not found: ${requestId}`);
    request.status = decision;
    request.reviewedAt = now();
    request.reviewedBy = reviewedBy;
    if (decision === 'approved') {
      const canonical = normalizeRole(request.requestedRole);
      if (canonical && roles.includes(canonical)) {
        this.assignRole(request.userId, canonical, request.tenantId, reviewedBy);
      }
    }
    return { ...request };
  }

  rbacPolicyStore(tenantId: string): TenantRbacPolicyStoreDto {
    return {
      generatedAt: now(),
      tenantId,
      policies: this.rbacPolicies.filter((p) => p.tenantId === tenantId),
      mock: false,
    };
  }

  upsertRbacPolicy(input: Omit<TenantRbacPolicyDto, 'updatedAt'>): TenantRbacPolicyDto {
    const policy: TenantRbacPolicyDto = { ...input, updatedAt: now() };
    const index = this.rbacPolicies.findIndex((p) => p.id === policy.id);
    if (index >= 0) this.rbacPolicies[index] = policy;
    else this.rbacPolicies.push(policy);
    return policy;
  }

  evaluatePolicy(tenantId: string, role: Role, permission: Permission): boolean {
    const policies = this.rbacPolicies.filter((p) => p.tenantId === tenantId);
    const matching = policies.filter(
      (p) => p.permissions.includes(permission) && (!p.roles.length || p.roles.includes(role)),
    );
    if (matching.some((p) => p.effect === 'deny')) return false;
    const rolePolicyAllow = matching.some((p) => (p.effect ?? 'allow') === 'allow');
    return rolePolicyAllow || (rolePermissions[role]?.includes(permission) ?? false);
  }

  issueSession(userId: string): TenantSessionDto {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    return this.authProvider.issueSession({
      userId: user.id,
      tenantId: user.tenantId,
      organizationId: user.organizationId,
      roles: user.roles.filter((r): r is Role => roles.includes(r as Role)),
    });
  }

  authWorkspace(): AuthProviderWorkspaceDto {
    return {
      generatedAt: now(),
      provider: this.authProvider.descriptor,
      activeSessions: this.authProvider.activeSessionCount(),
      mock: false,
    };
  }
}
