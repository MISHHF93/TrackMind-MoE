import type {
  AccessRequestDto,
  AuthProviderWorkspaceDto,
  NotificationChannelPreferenceDto,
  NotificationPreferencesDto,
  OperatorPreferencesDto,
  OperatorPreferencesPatchDto,
  OperatorProfileDto,
  OperatorSessionDto,
  OperatorSessionSummaryDto,
  PlatformRoleDto,
  PlatformUserDto,
  RoleAssignmentResultDto,
  TenantRbacPolicyDto,
  TenantRbacPolicyStoreDto,
  TenantSessionDto,
} from '@trackmind/shared';
import {
  normalizeRole,
  notificationChannelsForRole,
  rolePermissionSummary,
  rolePermissions,
  roleRegistry,
  roles,
  type Permission,
  type Role,
} from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';
import { createAuthProvider, type AuthProvider } from './authAbstraction.js';
import { mapEntraClaimsToRoles } from './entraRoleMapping.js';

const now = () => new Date().toISOString();

const personaSeeds: Array<{ id: string; role: Role; displayName: string; email: string; entraObjectId?: string }> = [
  { id: 'user-admin-1', role: 'platform-super-admin', displayName: 'Operations Admin', email: 'admin@trackmind.local', entraObjectId: 'entra-admin-1' },
  { id: 'user-org-admin-1', role: 'organization-admin', displayName: 'Organization Admin', email: 'org-admin@trackmind.local', entraObjectId: 'entra-org-admin-1' },
  { id: 'user-racetrack-admin-1', role: 'racetrack-admin', displayName: 'Racetrack Admin', email: 'racetrack-admin@trackmind.local' },
  { id: 'user-race-day-1', role: 'race-day-operations-manager', displayName: 'Race Day Manager', email: 'race-day@trackmind.local', entraObjectId: 'entra-race-day-1' },
  { id: 'user-steward-1', role: 'steward', displayName: 'Chief Steward', email: 'steward@trackmind.local', entraObjectId: 'entra-steward-1' },
  { id: 'user-starter-1', role: 'starter-official', displayName: 'Starter Official', email: 'starter@trackmind.local' },
  { id: 'user-paddock-1', role: 'paddock-official', displayName: 'Paddock Official', email: 'paddock@trackmind.local' },
  { id: 'user-welfare-1', role: 'equine-welfare-officer', displayName: 'Equine Welfare Officer', email: 'welfare@trackmind.local' },
  { id: 'user-vet-1', role: 'veterinarian', displayName: 'Track Veterinarian', email: 'vet@trackmind.local', entraObjectId: 'entra-vet-1' },
  { id: 'user-horse-ops-1', role: 'horse-operations-coordinator', displayName: 'Horse Operations Coordinator', email: 'horse-ops@trackmind.local' },
  { id: 'user-security-1', role: 'security-manager', displayName: 'Security Manager', email: 'security@trackmind.local' },
  { id: 'user-facilities-1', role: 'facilities-manager', displayName: 'Facilities Manager', email: 'facilities@trackmind.local', entraObjectId: 'entra-facilities-1' },
  { id: 'user-compliance-1', role: 'compliance-officer', displayName: 'Compliance Officer', email: 'compliance@trackmind.local' },
  { id: 'user-finance-1', role: 'finance-manager', displayName: 'Finance Manager', email: 'finance@trackmind.local', entraObjectId: 'entra-finance-1' },
  { id: 'user-ticketing-1', role: 'ticketing-fan-manager', displayName: 'Ticketing Manager', email: 'ticketing@trackmind.local' },
  { id: 'user-executive-1', role: 'executive', displayName: 'Track Executive', email: 'executive@trackmind.local' },
  { id: 'user-auditor-1', role: 'read-only-auditor', displayName: 'Read-Only Auditor', email: 'auditor@trackmind.local', entraObjectId: 'entra-auditor-1' },
  { id: 'user-analytics-1', role: 'data-analytics-user', displayName: 'Analytics User', email: 'analytics@trackmind.local' },
  { id: 'user-support-1', role: 'support-operator', displayName: 'Support Operator', email: 'support@trackmind.local' },
  { id: 'user-staff-1', role: 'staff-limited', displayName: 'Limited Staff', email: 'staff@trackmind.local' },
];

const seedUsers = (): PlatformUserDto[] => personaSeeds.map((persona) => ({
  id: persona.id,
  tenantId: 'trackmind',
  organizationId: 'org-trackmind-network',
  displayName: persona.displayName,
  email: persona.email,
  roles: [persona.role],
  entraObjectId: persona.entraObjectId,
  status: 'active' as const,
  lastLoginAt: persona.id === 'user-admin-1' ? now() : undefined,
  createdAt: '2026-01-01T00:00:00.000Z',
  mock: false,
}));

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

function assignedRolesForUser(user: PlatformUserDto): Role[] {
  return user.roles.filter((r): r is Role => roles.includes(r as Role));
}

function defaultActiveRole(user: PlatformUserDto): Role {
  const assigned = assignedRolesForUser(user);
  return assigned[0] ?? 'read-only-auditor';
}

export class IdentityService {
  readonly users: KeyValueRepository<PlatformUserDto>;
  readonly authProvider: AuthProvider;
  private roleAssignments: Array<{ userId: string; role: string; tenantId: string; assignedAt: string; assignedBy?: string }>;
  private accessRequests: AccessRequestDto[];
  private rbacPolicies: TenantRbacPolicyDto[];
  private activeRoleBySession = new Map<string, Role>();
  private notificationPrefs = new Map<string, NotificationPreferencesDto>();
  private operatorPrefs = new Map<string, OperatorPreferencesDto>();

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

  findUserByEmail(email: string): PlatformUserDto | undefined {
    const normalized = email.trim().toLowerCase();
    return this.users.list().find((u) => u.email.toLowerCase() === normalized);
  }

  findUserByEntraObjectId(entraObjectId: string): PlatformUserDto | undefined {
    return this.users.list().find((u) => u.entraObjectId === entraObjectId);
  }

  buildOperatorProfile(user: PlatformUserDto, activeRole: Role): OperatorProfileDto {
    const summary = rolePermissionSummary(activeRole);
    return {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      tenantId: user.tenantId,
      organizationId: user.organizationId,
      assignedRoles: assignedRolesForUser(user),
      activeRole,
      resonance: {
        role: summary.role,
        scope: summary.scope,
        category: summary.category,
        viewerRoutes: summary.viewerRoutes,
        kpiDomains: summary.kpiDomains,
        auditRead: summary.auditRead,
        auditExport: summary.auditExport,
        privacyScopes: summary.privacyScopes,
      },
    };
  }

  private toOperatorSession(user: PlatformUserDto, session: TenantSessionDto, activeRole: Role): OperatorSessionDto {
    const profile = this.buildOperatorProfile(user, activeRole);
    return {
      ...session,
      displayName: user.displayName,
      email: user.email,
      assignedRoles: profile.assignedRoles,
      activeRole,
      profile,
    };
  }

  resolveOperatorSession(sessionId: string, tenantId: string): OperatorSessionDto | undefined {
    const session = this.authProvider.validateSession(sessionId, tenantId);
    if (!session) return undefined;
    const user = this.users.get(session.userId);
    if (!user) return undefined;
    const activeRole = this.activeRoleBySession.get(sessionId) ?? defaultActiveRole(user);
    if (!assignedRolesForUser(user).includes(activeRole)) return undefined;
    return this.toOperatorSession(user, session, activeRole);
  }

  createOperatorSession(input: {
    accessToken?: string;
    userId?: string;
    tenantId?: string;
    clientHint?: string;
  }): OperatorSessionDto {
    const tenantId = input.tenantId ?? 'trackmind';
    let user: PlatformUserDto | undefined;

    if (input.accessToken && this.authProvider.parseAccessToken) {
      const claims = this.authProvider.parseAccessToken(input.accessToken);
      if (!claims?.email) throw new Error('Invalid or unverifiable access token');
      user = (claims.oid ? this.findUserByEntraObjectId(claims.oid) : undefined) ?? this.findUserByEmail(claims.email);
      if (!user && process.env.TRACKMIND_ENTRA_AUTO_PROVISION === 'true') {
        const mappedRoles = mapEntraClaimsToRoles({ groups: claims.groups, roles: claims.roles, tenantId });
        user = this.createUser({
          tenantId,
          organizationId: 'org-trackmind-network',
          displayName: claims.displayName ?? claims.email,
          email: claims.email,
          roles: mappedRoles.length ? mappedRoles : ['read-only-auditor'],
          status: 'active',
        });
        if (claims.oid) {
          this.users.upsert({ ...user, entraObjectId: claims.oid });
          user = this.users.get(user.id)!;
        }
      }
      if (!user) throw new Error(`No platform user mapped for ${claims.email}`);
    } else if (input.userId) {
      user = this.users.get(input.userId);
      if (!user) throw new Error(`User not found: ${input.userId}`);
      if (user.tenantId !== tenantId) throw new Error(`Tenant isolation violation for user ${input.userId}`);
    } else {
      throw new Error('accessToken or userId is required');
    }

    const assigned = assignedRolesForUser(user);
    const session = this.authProvider.issueSession({
      userId: user.id,
      tenantId: user.tenantId,
      organizationId: user.organizationId,
      roles: assigned,
      clientHint: input.clientHint ?? 'Web browser',
    });
    const activeRole = defaultActiveRole(user);
    this.activeRoleBySession.set(session.sessionId, activeRole);
    this.users.upsert({ ...user, lastLoginAt: now() });
    return this.toOperatorSession(user, session, activeRole);
  }

  patchActiveRole(sessionId: string, tenantId: string, requestedRole: string): OperatorSessionDto {
    const session = this.authProvider.validateSession(sessionId, tenantId);
    if (!session) throw new Error('Session not found or expired');
    const user = this.users.get(session.userId);
    if (!user) throw new Error('User not found for session');
    const canonical = normalizeRole(requestedRole);
    if (!canonical || !assignedRolesForUser(user).includes(canonical)) {
      throw new Error(`Role ${requestedRole} is not assigned to user`);
    }
    this.activeRoleBySession.set(sessionId, canonical);
    return this.toOperatorSession(user, session, canonical);
  }

  revokeOperatorSession(sessionId: string): boolean {
    this.activeRoleBySession.delete(sessionId);
    return this.authProvider.revokeSession(sessionId);
  }

  getNotificationPreferences(userId: string): NotificationPreferencesDto {
    const existing = this.notificationPrefs.get(userId);
    if (existing) return existing;
    const user = this.users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    const activeRole = defaultActiveRole(user);
    const channels = notificationChannelsForRole(activeRole).map((channel): NotificationChannelPreferenceDto => ({
      channel,
      enabled: true,
    }));
    const prefs: NotificationPreferencesDto = {
      userId,
      tenantId: user.tenantId,
      channels,
      updatedAt: now(),
      mock: false,
    };
    this.notificationPrefs.set(userId, prefs);
    return prefs;
  }

  patchNotificationPreferences(userId: string, channels: NotificationChannelPreferenceDto[]): NotificationPreferencesDto {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    const prefs: NotificationPreferencesDto = {
      userId,
      tenantId: user.tenantId,
      channels: channels.map((c) => ({ channel: c.channel, enabled: Boolean(c.enabled) })),
      updatedAt: now(),
      mock: false,
    };
    this.notificationPrefs.set(userId, prefs);
    return prefs;
  }

  getOperatorPreferences(userId: string): OperatorPreferencesDto {
    const existing = this.operatorPrefs.get(userId);
    if (existing) return existing;
    const user = this.users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    const prefs: OperatorPreferencesDto = {
      userId,
      tenantId: user.tenantId,
      theme: 'system',
      locale: 'en-US',
      timezone: 'America/New_York',
      density: 'comfortable',
      updatedAt: now(),
      mock: false,
    };
    this.operatorPrefs.set(userId, prefs);
    return prefs;
  }

  patchOperatorPreferences(userId: string, patch: OperatorPreferencesPatchDto): OperatorPreferencesDto {
    const current = this.getOperatorPreferences(userId);
    const prefs: OperatorPreferencesDto = {
      ...current,
      theme: patch.theme ?? current.theme,
      locale: patch.locale ?? current.locale,
      timezone: patch.timezone ?? current.timezone,
      density: patch.density ?? current.density,
      updatedAt: now(),
    };
    this.operatorPrefs.set(userId, prefs);
    return prefs;
  }

  listOperatorSessions(userId: string, currentSessionId?: string): OperatorSessionSummaryDto[] {
    return this.authProvider.listSessionsForUser(userId).map((session) => ({
      sessionId: session.sessionId,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      authProvider: session.authProvider,
      current: session.sessionId === currentSessionId,
      clientHint: this.authProvider.getSessionClientHint(session.sessionId) ?? 'Web browser',
    }));
  }

  revokeOperatorSessionForUser(userId: string, sessionId: string, currentSessionId?: string): boolean {
    const owned = this.authProvider.listSessionsForUser(userId).some((s) => s.sessionId === sessionId);
    if (!owned) throw new Error('Session not found for user');
    if (sessionId === currentSessionId) {
      throw new Error('Use DELETE /platform/session to revoke the current session');
    }
    this.activeRoleBySession.delete(sessionId);
    return this.authProvider.revokeSession(sessionId);
  }

  revokeOtherOperatorSessions(userId: string, currentSessionId: string): number {
    for (const session of this.authProvider.listSessionsForUser(userId)) {
      if (session.sessionId !== currentSessionId) {
        this.activeRoleBySession.delete(session.sessionId);
      }
    }
    return this.authProvider.revokeSessionsForUserExcept(userId, currentSessionId);
  }

  getUserRecord(userId: string): PlatformUserDto | undefined {
    return this.users.get(userId);
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

  listAccessRequests(tenantId?: string, userId?: string): AccessRequestDto[] {
    let requests = tenantId
      ? this.accessRequests.filter((r) => r.tenantId === tenantId)
      : [...this.accessRequests];
    if (userId) requests = requests.filter((r) => r.userId === userId);
    return requests;
  }

  requestAccess(
    userId: string,
    requestedRole: string,
    tenantId: string,
    justification?: string,
  ): AccessRequestDto {
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
      justification: justification?.trim() || undefined,
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
      roles: assignedRolesForUser(user),
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
