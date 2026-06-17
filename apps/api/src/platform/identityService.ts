import type { IdentityWorkspaceDto, PlatformUserDto } from '@trackmind/shared';
import { roles, type Role } from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';

const now = () => new Date().toISOString();

const seedUsers = (): PlatformUserDto[] => [
  {
    id: 'user-admin-1',
    tenantId: 'trackmind',
    organizationId: 'org-trackmind-network',
    displayName: 'Operations Admin',
    email: 'admin@trackmind.local',
    roles: ['admin'],
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

export class IdentityService {
  readonly users: KeyValueRepository<PlatformUserDto>;
  private roleAssignments: Array<{ userId: string; role: string; tenantId: string; assignedAt: string }>;
  private accessRequests: IdentityWorkspaceDto['accessRequests'];

  constructor() {
    this.users = createRepository(seedUsers());
    this.roleAssignments = seedUsers().flatMap((u) =>
      u.roles.map((role) => ({ userId: u.id, role, tenantId: u.tenantId, assignedAt: u.createdAt })),
    );
    this.accessRequests = [];
  }

  workspace(): IdentityWorkspaceDto {
    return {
      generatedAt: now(),
      users: this.users.list(),
      roleAssignments: this.roleAssignments,
      accessRequests: this.accessRequests,
      mock: false,
    };
  }

  assignRole(userId: string, role: Role, tenantId: string): void {
    if (!roles.includes(role)) throw new Error(`Invalid role: ${role}`);
    const user = this.users.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    const rolesForUser = [...new Set([...user.roles, role])];
    this.users.upsert({ ...user, roles: rolesForUser });
    this.roleAssignments.push({ userId, role, tenantId, assignedAt: now() });
  }

  requestAccess(userId: string, requestedRole: string): IdentityWorkspaceDto['accessRequests'][number] {
    const request = {
      id: `access-${Date.now().toString(36)}`,
      userId,
      requestedRole,
      status: 'pending' as const,
      createdAt: now(),
    };
    this.accessRequests.push(request);
    return request;
  }

  reviewAccessRequest(requestId: string, decision: 'approved' | 'rejected'): void {
    const request = this.accessRequests.find((r) => r.id === requestId);
    if (!request) throw new Error(`Access request not found: ${requestId}`);
    request.status = decision;
    if (decision === 'approved' && roles.includes(request.requestedRole as Role)) {
      const user = this.users.get(request.userId);
      if (user) this.assignRole(request.userId, request.requestedRole as Role, user.tenantId);
    }
  }
}
