export const permissionGroups = ['read','race-operations','equine-care','track-operations','security','commerce','compliance','ai-governance','identity-governance','workflow','integration','service'] as const;
export type PermissionGroup = typeof permissionGroups[number];

export const permissionRegistry = {
  'read:any': { group: 'read', description: 'Read non-sensitive workspace metadata.' },
  'race:request-start': { group: 'race-operations', description: 'Request race lifecycle changes that require approval.' },
  'race:finalize-results': { group: 'race-operations', description: 'Finalize or modify official race results after approvals.' },
  'horse:scratch': { group: 'equine-care', description: 'Request horse scratches and race-office scratch workflows.' },
  'vet:review': { group: 'equine-care', description: 'Read veterinary and equine welfare review data.' },
  'vet:clear-flag': { group: 'equine-care', description: 'Clear veterinary flags after approval.' },
  'track:readings': { group: 'track-operations', description: 'Read track surface, gate, facility, and maintenance metadata; draft routes are separately governed.' },
  'incident:manage': { group: 'security', description: 'Read incident command metadata and request governed emergency actions when a contracted mutation route exists.' },
  'ticketing:manage': { group: 'commerce', description: 'Read ticketing workspace state.' },
  'finance:payout': { group: 'commerce', description: 'Read finance records and request protected payout actions.' },
  'security:read': { group: 'security', description: 'Read security operations workspaces and masked security records.' },
  'security:manage': { group: 'security', description: 'Read security operations and manage security incidents.' },
  'security:sensitive-read': { group: 'security', description: 'Read sensitive security fields after role and approval gates.' },
  'security:investigate': { group: 'security', description: 'Read investigation metadata and use service-internal investigation workflows when explicitly contracted.' },
  'security:admin': { group: 'security', description: 'Administer security operations policy and sensitive access.' },
  'compliance:audit': { group: 'compliance', description: 'Manage compliance controls and regulated audit actions.' },
  'audit:read': { group: 'compliance', description: 'Read audit ledger metadata, evidence paths, and hash references.' },
  'audit:export': { group: 'compliance', description: 'Read forensic, compliance, and legal-hold package metadata when explicitly authorized.' },
  'compliance:report': { group: 'compliance', description: 'Read compliance reports and internal readiness packages.' },
  'data-hub:read': { group: 'integration', description: 'Read Racing Data API Hub provider readiness, lineage, quality, and sharing-control metadata.' },
  'artifact:read': { group: 'integration', description: 'Read Universal Artifact registry, schemas, training inputs, and storage maps.' },
  'kpi:read': { group: 'read', description: 'Read governed KPI artifacts and model-readable context.' },
  'kpi:admin': { group: 'service', description: 'Administer KPI definitions and request threshold changes.' },
  'ai:approve': { group: 'ai-governance', description: 'Approve or review AI-governed recommendations and protected draft actions.' },
  'ai:read': { group: 'ai-governance', description: 'Read AI governance, control-plane, model, feature, and recommendation metadata.' },
  'discipline:issue': { group: 'race-operations', description: 'Issue steward rulings and disciplinary decisions after approval.' },
  'identity:read': { group: 'identity-governance', description: 'Read identity, role, and access-review state.' },
  'identity:write': { group: 'identity-governance', description: 'Write identity and role assignments.' },
  'policy:manage': { group: 'identity-governance', description: 'Manage tenant policies and RBAC policy definitions.' },
  'access:request': { group: 'identity-governance', description: 'Request access and temporary elevation.' },
  'access:approve': { group: 'identity-governance', description: 'Approve access and temporary elevation.' },
  'access:review': { group: 'identity-governance', description: 'Run access reviews and least-privilege attestations.' },
  'tenant:admin': { group: 'identity-governance', description: 'Administer tenant-level configuration.' },
  'privileged:elevate': { group: 'identity-governance', description: 'Use privileged access workflows.' },
  'service:operate': { group: 'service', description: 'Operate backend service facades and service diagnostics.' },
  'workflow:execute': { group: 'workflow', description: 'Execute approved backend workflow steps.' },
  'integration:invoke': { group: 'integration', description: 'Invoke approved integration and draft-export operations.' },
  'ai-agent:act': { group: 'ai-governance', description: 'Allow AI agents to create advisory drafts only.' },
  'platform:admin': { group: 'identity-governance', description: 'Administer platform-wide configuration and cross-tenant tooling.' },
  'organization:admin': { group: 'identity-governance', description: 'Administer organization portfolio, users, and module enablement.' },
  'racetrack:admin': { group: 'identity-governance', description: 'Administer racetrack-scoped users and operational configuration.' },
  'race-day:operate': { group: 'race-operations', description: 'Operate race-day command center, readiness, and incident coordination.' },
  'paddock:operate': { group: 'race-operations', description: 'Manage paddock arrivals, inspections, and readiness checks.' },
  'starter:update': { group: 'race-operations', description: 'Update starting gate readiness and official race flow status.' },
  'welfare:observe': { group: 'equine-care', description: 'Create welfare observations and review horse welfare posture.' },
  'horse-ops:manage': { group: 'equine-care', description: 'Manage horse operational records, entries, and logistics.' },
  'executive:read': { group: 'read', description: 'Read executive dashboards and leadership scorecards.' },
  'analytics:read': { group: 'read', description: 'Read analytics, trends, and benchmarking reports.' },
  'support:operate': { group: 'service', description: 'Use governed support tooling and tenant diagnostics.' },
  'staff:task': { group: 'workflow', description: 'Complete assigned operational tasks and limited data entry.' },
} as const satisfies Record<string, { group: PermissionGroup; description: string }>;

export type Permission = keyof typeof permissionRegistry;

/** Twenty assignable personas plus non-assignable system role. */
export const roles = [
  'platform-super-admin',
  'organization-admin',
  'racetrack-admin',
  'race-day-operations-manager',
  'steward',
  'starter-official',
  'paddock-official',
  'equine-welfare-officer',
  'veterinarian',
  'horse-operations-coordinator',
  'security-manager',
  'facilities-manager',
  'compliance-officer',
  'finance-manager',
  'ticketing-fan-manager',
  'executive',
  'read-only-auditor',
  'data-analytics-user',
  'support-operator',
  'staff-limited',
  'ai-safety-agent',
] as const;
export type Role = typeof roles[number];

export const assignableRoles = roles.filter((role) => role !== 'ai-safety-agent') as Exclude<Role, 'ai-safety-agent'>[];

export interface RoleDefinition {
  role: Role;
  displayName: string;
  group: PermissionGroup;
  privileged: boolean;
  assignable: boolean;
}

export const roleRegistry: Record<Role, RoleDefinition> = {
  'platform-super-admin': { role: 'platform-super-admin', displayName: 'Platform Super Admin', group: 'identity-governance', privileged: true, assignable: false },
  'organization-admin': { role: 'organization-admin', displayName: 'Organization Admin', group: 'identity-governance', privileged: true, assignable: true },
  'racetrack-admin': { role: 'racetrack-admin', displayName: 'Racetrack Admin', group: 'identity-governance', privileged: true, assignable: true },
  'race-day-operations-manager': { role: 'race-day-operations-manager', displayName: 'Race-Day Operations Manager', group: 'race-operations', privileged: false, assignable: true },
  steward: { role: 'steward', displayName: 'Steward', group: 'race-operations', privileged: false, assignable: true },
  'starter-official': { role: 'starter-official', displayName: 'Starter / Race Official', group: 'race-operations', privileged: false, assignable: true },
  'paddock-official': { role: 'paddock-official', displayName: 'Paddock Official', group: 'race-operations', privileged: false, assignable: true },
  'equine-welfare-officer': { role: 'equine-welfare-officer', displayName: 'Equine Welfare Officer', group: 'equine-care', privileged: false, assignable: true },
  veterinarian: { role: 'veterinarian', displayName: 'Veterinarian', group: 'equine-care', privileged: false, assignable: true },
  'horse-operations-coordinator': { role: 'horse-operations-coordinator', displayName: 'Horse Operations Coordinator', group: 'equine-care', privileged: false, assignable: true },
  'security-manager': { role: 'security-manager', displayName: 'Security Manager', group: 'security', privileged: false, assignable: true },
  'facilities-manager': { role: 'facilities-manager', displayName: 'Facilities Manager', group: 'track-operations', privileged: false, assignable: true },
  'compliance-officer': { role: 'compliance-officer', displayName: 'Compliance Officer', group: 'compliance', privileged: false, assignable: true },
  'finance-manager': { role: 'finance-manager', displayName: 'Finance Manager', group: 'commerce', privileged: false, assignable: true },
  'ticketing-fan-manager': { role: 'ticketing-fan-manager', displayName: 'Ticketing / Fan Experience Manager', group: 'commerce', privileged: false, assignable: true },
  executive: { role: 'executive', displayName: 'Executive / Track Leadership', group: 'read', privileged: false, assignable: true },
  'read-only-auditor': { role: 'read-only-auditor', displayName: 'Auditor / Regulator', group: 'compliance', privileged: false, assignable: true },
  'data-analytics-user': { role: 'data-analytics-user', displayName: 'Data / Analytics User', group: 'read', privileged: false, assignable: true },
  'support-operator': { role: 'support-operator', displayName: 'Support / Internal Operator', group: 'service', privileged: true, assignable: true },
  'staff-limited': { role: 'staff-limited', displayName: 'Generic Staff / Limited User', group: 'workflow', privileged: false, assignable: true },
  'ai-safety-agent': { role: 'ai-safety-agent', displayName: 'AI Safety Agent', group: 'ai-governance', privileged: false, assignable: false },
};

/** Maps legacy slugs and workflow persona strings to canonical Role values. */
export const legacyRoleAliases: Record<string, Role> = {
  admin: 'platform-super-admin',
  'operations-admin': 'organization-admin',
  'racing-secretary': 'horse-operations-coordinator',
  'track-superintendent': 'facilities-manager',
  security: 'security-manager',
  finance: 'finance-manager',
  'ticketing-manager': 'ticketing-fan-manager',
  'welfare-officer': 'equine-welfare-officer',
  'facilities-supervisor': 'facilities-manager',
  'incident-commander': 'race-day-operations-manager',
  'maintenance-lead': 'facilities-manager',
  'safety-manager': 'security-manager',
  'transport-coordinator': 'horse-operations-coordinator',
  trainer: 'horse-operations-coordinator',
  groom: 'paddock-official',
  regulator: 'read-only-auditor',
  owner: 'staff-limited',
  jockey: 'staff-limited',
  official: 'starter-official',
};

/**
 * Maps canonical slugs to legacy ids still accepted by an older in-memory role registry.
 * Used only when the canonical slug is not yet in `roles` (e.g. API not restarted after upgrade).
 */
export const canonicalToLegacyRoleBridge: Record<string, string> = {
  'platform-super-admin': 'admin',
  'organization-admin': 'operations-admin',
  'horse-operations-coordinator': 'racing-secretary',
  'facilities-manager': 'track-superintendent',
  'security-manager': 'security',
  'finance-manager': 'finance',
  'ticketing-fan-manager': 'ticketing-manager',
  'equine-welfare-officer': 'welfare-officer',
  'race-day-operations-manager': 'incident-commander',
};

export function normalizeRole(raw: string): Role | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (isRole(value)) return value;
  const fromLegacy = legacyRoleAliases[value];
  if (fromLegacy && isRole(fromLegacy)) return fromLegacy;
  const bridgedLegacy = canonicalToLegacyRoleBridge[value];
  if (bridgedLegacy && isRole(bridgedLegacy)) return bridgedLegacy as Role;
  return undefined;
}

export function isRole(value: string): value is Role {
  return (roles as readonly string[]).includes(value);
}

/** True when an actor role may call a contracted endpoint (normalizes legacy + canonical slugs). */
export function contractAllowsRole(allowedRoles: readonly Role[] | 'authenticated', actorRole: Role): boolean {
  if (allowedRoles === 'authenticated') return true;
  return allowedRoles.some((allowed) => {
    const allowedCanonical = normalizeRole(allowed) ?? (isRole(allowed) ? allowed : undefined);
    return allowedCanonical === actorRole || allowed === actorRole;
  });
}

const allPermissions = Object.keys(permissionRegistry) as Permission[];

export const rolePermissions: Record<Role, Permission[]> = {
  'platform-super-admin': allPermissions,
  'organization-admin': [
    'read:any', 'organization:admin', 'identity:read', 'identity:write', 'tenant:admin', 'policy:manage',
    'access:request', 'access:approve', 'access:review', 'workflow:execute', 'service:operate', 'integration:invoke',
    'kpi:read', 'kpi:admin', 'executive:read', 'analytics:read', 'compliance:report', 'audit:read',
    'incident:manage', 'track:readings', 'security:manage', 'staff:task', 'ai:approve',
  ],
  'racetrack-admin': [
    'read:any', 'racetrack:admin', 'identity:read', 'identity:write', 'access:request', 'workflow:execute',
    'track:readings', 'incident:manage', 'kpi:read', 'audit:read', 'compliance:report', 'race-day:operate',
    'integration:invoke', 'service:operate',
  ],
  'race-day-operations-manager': [
    'read:any', 'race-day:operate', 'race:request-start', 'horse:scratch', 'track:readings', 'incident:manage',
    'ai:read', 'ai:approve', 'workflow:execute', 'kpi:read', 'audit:read', 'starter:update',
  ],
  steward: [
    'read:any', 'race:request-start', 'race:finalize-results', 'horse:scratch', 'track:readings', 'incident:manage',
    'ai:read', 'ai:approve', 'discipline:issue', 'audit:read', 'workflow:execute', 'kpi:read',
    'welfare:observe', 'vet:review', 'executive:read', 'horse-ops:manage', 'compliance:audit',
  ],
  'starter-official': [
    'read:any', 'starter:update', 'race:request-start', 'track:readings', 'kpi:read', 'workflow:execute',
  ],
  'paddock-official': [
    'read:any', 'paddock:operate', 'horse:scratch', 'track:readings', 'kpi:read', 'staff:task',
  ],
  'equine-welfare-officer': [
    'read:any', 'welfare:observe', 'vet:review', 'horse:scratch', 'ai:read', 'kpi:read', 'audit:read',
  ],
  veterinarian: [
    'read:any', 'vet:review', 'vet:clear-flag', 'horse:scratch', 'welfare:observe', 'ai:read', 'ai:approve', 'audit:read', 'kpi:read',
  ],
  'horse-operations-coordinator': [
    'read:any', 'horse-ops:manage', 'horse:scratch', 'vet:review', 'ai:read', 'ai:approve', 'workflow:execute',
    'integration:invoke', 'data-hub:read', 'kpi:read', 'race:request-start', 'track:readings', 'staff:task', 'welfare:observe',
  ],
  'security-manager': [
    'read:any', 'security:read', 'security:manage', 'security:sensitive-read', 'security:investigate',
    'incident:manage', 'ai:read', 'ai:approve', 'audit:read', 'workflow:execute',
  ],
  'facilities-manager': [
    'read:any', 'track:readings', 'incident:manage', 'ai:read', 'ai:approve', 'workflow:execute', 'kpi:read',
  ],
  'compliance-officer': [
    'read:any', 'security:read', 'compliance:audit', 'compliance:report', 'audit:read', 'audit:export',
    'ai:read', 'ai:approve', 'artifact:read', 'integration:invoke', 'data-hub:read', 'kpi:read', 'policy:manage', 'access:review',
    'vet:review', 'executive:read', 'staff:task',
  ],
  'finance-manager': [
    'read:any', 'finance:payout', 'ticketing:manage', 'ai:approve', 'audit:read', 'kpi:read',
  ],
  'ticketing-fan-manager': [
    'read:any', 'ticketing:manage', 'kpi:read', 'analytics:read',
  ],
  executive: [
    'read:any', 'executive:read', 'analytics:read', 'kpi:read', 'compliance:report', 'audit:read', 'finance:payout', 'incident:manage',
  ],
  'read-only-auditor': [
    'read:any', 'audit:read', 'compliance:report', 'artifact:read', 'data-hub:read', 'kpi:read', 'analytics:read', 'vet:review',
  ],
  'data-analytics-user': [
    'read:any', 'analytics:read', 'kpi:read', 'data-hub:read', 'artifact:read', 'staff:task',
  ],
  'support-operator': [
    'read:any', 'support:operate', 'identity:read', 'service:operate', 'audit:read', 'workflow:execute', 'kpi:read',
  ],
  'staff-limited': [
    'read:any', 'staff:task', 'kpi:read',
  ],
  'ai-safety-agent': [
    'read:any', 'ai:read', 'ai-agent:act', 'kpi:read',
  ],
};

export function isPermission(value: string): value is Permission { return value in permissionRegistry; }
export function hasPermission(role: Role, permission: Permission): boolean { return rolePermissions[role]?.includes(permission) ?? false; }
export function hasAnyPermission(role: Role, permissions: readonly Permission[]): boolean { return permissions.some((permission) => hasPermission(role, permission)); }
export function rolesWithPermission(permission: Permission): Role[] { return roles.filter((role) => hasPermission(role, permission)); }

export const approvalWorkflowStatuses = ['draft','pending','approved','rejected','expired','escalated','overridden','cancelled'] as const;
export type ApprovalWorkflowStatus = typeof approvalWorkflowStatuses[number];
export type ApprovalStatus = ApprovalWorkflowStatus | 'pending-approval';
export type ApprovalActorType = 'human' | 'ai-agent' | 'service' | 'system';
export interface CanonicalApprovalActor { id: string; actorType: ApprovalActorType; roles: Role[]; displayName?: string }
export interface CanonicalApprovalDecision { stepId: string; actor: CanonicalApprovalActor; decision: 'approved' | 'rejected'; reason: string; evidence: string[]; decidedAt: string; delegatedFor?: string }
export interface CanonicalApprovalStep { id: string; approverRoles: Role[]; minimumApprovals: number; evidenceRequired: string[]; status: ApprovalWorkflowStatus; decisions: CanonicalApprovalDecision[] }
export interface CanonicalApprovalEscalation { afterMinutes: number; approverRoles: Role[]; reason: string; escalatedAt?: string }
export interface CanonicalApprovalAuditLinkage { auditIds: string[]; eventIds: string[]; workflowInstanceId?: string; workflowTaskId?: string; correlationId: string }
export interface CanonicalApprovalRequest {
  approvalRequestId: string;
  tenantId: string;
  racetrackId: string;
  action: ProtectedAction;
  target: string;
  requestedBy: CanonicalApprovalActor;
  status: ApprovalWorkflowStatus;
  reason: string;
  evidence: string[];
  steps: CanonicalApprovalStep[];
  escalation: CanonicalApprovalEscalation[];
  createdAt: string;
  expiresAt: string;
  auditLinkage: CanonicalApprovalAuditLinkage;
}

export function isApprovalWorkflowStatus(value: string): value is ApprovalWorkflowStatus {
  return (approvalWorkflowStatuses as readonly string[]).includes(value);
}

export function normalizeApprovalStatus(value: string): ApprovalWorkflowStatus {
  if (isApprovalWorkflowStatus(value)) return value;
  if (value === 'pending-approval' || value === 'approval_required' || value === 'approval-required' || value === 'approval-blocked' || value === 'queued' || value === 'not-required' || value === 'satisfied') return 'pending';
  if (value === 'executed') return 'approved';
  return 'pending';
}

export type RaceDayEventType = 'horse-arrived'|'vet-check-completed'|'track-reading-ingested'|'race-start-requested'|'steward-inquiry-opened'|'incident-created'|'ticket-sale-completed'|'emergency-alert-raised';
export type ExpertDomain = 'RaceOps'|'Stewarding'|'EquineSafety'|'VetCompliance'|'TrackSurface'|'WeatherEnvironment'|'WageringIntegrity'|'TicketingFanExperience'|'SecuritySOC'|'FacilitiesIoT'|'MaintenanceOps'|'FinanceRevenue'|'LegalRegulatory'|'ExecutiveDecisionSupport'|'ResponsibleAIGovernor';

export const protectedActions = ['race-start','race-stop','race-cancellation','official-results','modify-official-results','scratch-horse','race-office-scratch','medication-decision','clear-vet-flag','veterinary-clearance','emergency-action','emergency-personnel-override','payout','disciplinary-decision','steward-ruling','steward-decision','safety-critical-control','starting-gate-move','race-distance-configuration','race-status-change','race-office-configuration','facility-maintenance-execution','surface-irrigation','surface-harrowing','surface-rolling','surface-track-closure-recommendation','track-closure','track-reopen','compliance-filing-approval','kpi-threshold-change'] as const;
export type ProtectedAction = typeof protectedActions[number];

export const approvalActionPermissionRegistry: Record<ProtectedAction, Permission[]> = {
  'race-start': ['race:request-start', 'starter:update', 'race-day:operate'],
  'race-stop': ['incident:manage', 'race-day:operate'],
  'race-cancellation': ['race:request-start', 'race-day:operate'],
  'official-results': ['race:finalize-results'],
  'modify-official-results': ['race:finalize-results'],
  'scratch-horse': ['horse:scratch', 'vet:review', 'horse-ops:manage'],
  'race-office-scratch': ['horse:scratch', 'vet:review', 'horse-ops:manage'],
  'medication-decision': ['vet:review', 'vet:clear-flag'],
  'clear-vet-flag': ['vet:clear-flag'],
  'veterinary-clearance': ['vet:clear-flag'],
  'emergency-action': ['incident:manage', 'race-day:operate'],
  'emergency-personnel-override': ['incident:manage', 'race-day:operate'],
  payout: ['finance:payout'],
  'disciplinary-decision': ['discipline:issue'],
  'steward-ruling': ['discipline:issue'],
  'steward-decision': ['discipline:issue'],
  'safety-critical-control': ['incident:manage', 'track:readings', 'security:manage'],
  'starting-gate-move': ['race:request-start', 'track:readings', 'starter:update'],
  'race-distance-configuration': ['race:request-start', 'track:readings', 'race-day:operate'],
  'race-status-change': ['race:request-start', 'race-day:operate'],
  'race-office-configuration': ['race:request-start', 'horse-ops:manage'],
  'facility-maintenance-execution': ['track:readings'],
  'surface-irrigation': ['track:readings'],
  'surface-harrowing': ['track:readings'],
  'surface-rolling': ['track:readings'],
  'surface-track-closure-recommendation': ['track:readings', 'incident:manage'],
  'track-closure': ['track:readings', 'incident:manage'],
  'track-reopen': ['track:readings', 'incident:manage'],
  'compliance-filing-approval': ['compliance:audit'],
  'kpi-threshold-change': ['kpi:admin'],
};

export interface ApprovalActorBinding {
  requestors: Role[];
  approvers: Role[];
  escalators: Role[];
}

export const approvalActorRegistry: Record<ProtectedAction, ApprovalActorBinding> = {
  'race-start': {
    requestors: ['race-day-operations-manager', 'starter-official', 'steward'],
    approvers: ['steward', 'race-day-operations-manager'],
    escalators: ['platform-super-admin', 'compliance-officer'],
  },
  'race-stop': {
    requestors: ['race-day-operations-manager', 'steward', 'security-manager'],
    approvers: ['steward', 'race-day-operations-manager'],
    escalators: ['compliance-officer'],
  },
  'race-cancellation': {
    requestors: ['race-day-operations-manager', 'steward'],
    approvers: ['steward', 'compliance-officer'],
    escalators: ['platform-super-admin'],
  },
  'official-results': {
    requestors: ['steward'],
    approvers: ['steward', 'compliance-officer'],
    escalators: ['platform-super-admin'],
  },
  'modify-official-results': {
    requestors: ['steward'],
    approvers: ['steward', 'compliance-officer'],
    escalators: ['platform-super-admin'],
  },
  'scratch-horse': {
    requestors: ['horse-operations-coordinator', 'veterinarian', 'steward', 'paddock-official'],
    approvers: ['steward', 'veterinarian'],
    escalators: ['race-day-operations-manager'],
  },
  'race-office-scratch': {
    requestors: ['horse-operations-coordinator', 'race-day-operations-manager'],
    approvers: ['steward'],
    escalators: ['compliance-officer'],
  },
  'medication-decision': {
    requestors: ['veterinarian'],
    approvers: ['veterinarian', 'steward'],
    escalators: ['compliance-officer'],
  },
  'clear-vet-flag': {
    requestors: ['veterinarian'],
    approvers: ['veterinarian', 'steward'],
    escalators: ['compliance-officer'],
  },
  'veterinary-clearance': {
    requestors: ['veterinarian'],
    approvers: ['veterinarian', 'steward'],
    escalators: ['compliance-officer'],
  },
  'emergency-action': {
    requestors: ['race-day-operations-manager', 'security-manager'],
    approvers: ['race-day-operations-manager', 'security-manager'],
    escalators: ['platform-super-admin'],
  },
  'emergency-personnel-override': {
    requestors: ['race-day-operations-manager'],
    approvers: ['race-day-operations-manager', 'security-manager'],
    escalators: ['compliance-officer'],
  },
  payout: {
    requestors: ['finance-manager'],
    approvers: ['finance-manager', 'compliance-officer'],
    escalators: ['executive'],
  },
  'disciplinary-decision': {
    requestors: ['steward'],
    approvers: ['steward', 'compliance-officer'],
    escalators: ['platform-super-admin'],
  },
  'steward-ruling': {
    requestors: ['steward'],
    approvers: ['steward', 'compliance-officer'],
    escalators: ['platform-super-admin'],
  },
  'steward-decision': {
    requestors: ['steward'],
    approvers: ['steward', 'compliance-officer'],
    escalators: ['platform-super-admin'],
  },
  'safety-critical-control': {
    requestors: ['security-manager', 'facilities-manager', 'race-day-operations-manager'],
    approvers: ['security-manager', 'race-day-operations-manager'],
    escalators: ['compliance-officer'],
  },
  'starting-gate-move': {
    requestors: ['starter-official', 'race-day-operations-manager'],
    approvers: ['steward', 'starter-official'],
    escalators: ['race-day-operations-manager'],
  },
  'race-distance-configuration': {
    requestors: ['race-day-operations-manager', 'horse-operations-coordinator'],
    approvers: ['steward'],
    escalators: ['compliance-officer'],
  },
  'race-status-change': {
    requestors: ['race-day-operations-manager', 'starter-official'],
    approvers: ['steward'],
    escalators: ['compliance-officer'],
  },
  'race-office-configuration': {
    requestors: ['horse-operations-coordinator', 'race-day-operations-manager'],
    approvers: ['steward'],
    escalators: ['compliance-officer'],
  },
  'facility-maintenance-execution': {
    requestors: ['facilities-manager'],
    approvers: ['facilities-manager', 'racetrack-admin'],
    escalators: ['compliance-officer'],
  },
  'surface-irrigation': {
    requestors: ['facilities-manager'],
    approvers: ['facilities-manager', 'race-day-operations-manager'],
    escalators: ['steward'],
  },
  'surface-harrowing': {
    requestors: ['facilities-manager'],
    approvers: ['facilities-manager', 'race-day-operations-manager'],
    escalators: ['steward'],
  },
  'surface-rolling': {
    requestors: ['facilities-manager'],
    approvers: ['facilities-manager', 'race-day-operations-manager'],
    escalators: ['steward'],
  },
  'surface-track-closure-recommendation': {
    requestors: ['facilities-manager', 'race-day-operations-manager'],
    approvers: ['steward', 'facilities-manager'],
    escalators: ['compliance-officer'],
  },
  'track-closure': {
    requestors: ['facilities-manager', 'race-day-operations-manager'],
    approvers: ['steward', 'facilities-manager'],
    escalators: ['compliance-officer'],
  },
  'track-reopen': {
    requestors: ['facilities-manager', 'race-day-operations-manager'],
    approvers: ['steward', 'facilities-manager'],
    escalators: ['compliance-officer'],
  },
  'compliance-filing-approval': {
    requestors: ['compliance-officer'],
    approvers: ['compliance-officer'],
    escalators: ['platform-super-admin'],
  },
  'kpi-threshold-change': {
    requestors: ['organization-admin', 'racetrack-admin'],
    approvers: ['organization-admin', 'compliance-officer'],
    escalators: ['platform-super-admin'],
  },
};

export type RoleScope = 'platform' | 'organization' | 'racetrack' | 'federation';

export interface AuditVisibilityBinding {
  canRead: boolean;
  canExport: boolean;
  scopes: RoleScope[];
}

export const auditVisibilityRegistry: Record<Role, AuditVisibilityBinding> = {
  'platform-super-admin': { canRead: true, canExport: true, scopes: ['platform', 'organization', 'racetrack', 'federation'] },
  'organization-admin': { canRead: true, canExport: true, scopes: ['organization', 'racetrack'] },
  'racetrack-admin': { canRead: true, canExport: true, scopes: ['racetrack'] },
  'race-day-operations-manager': { canRead: true, canExport: false, scopes: ['racetrack'] },
  steward: { canRead: true, canExport: false, scopes: ['racetrack'] },
  'starter-official': { canRead: false, canExport: false, scopes: ['racetrack'] },
  'paddock-official': { canRead: false, canExport: false, scopes: ['racetrack'] },
  'equine-welfare-officer': { canRead: true, canExport: false, scopes: ['racetrack'] },
  veterinarian: { canRead: true, canExport: false, scopes: ['racetrack'] },
  'horse-operations-coordinator': { canRead: true, canExport: false, scopes: ['racetrack'] },
  'security-manager': { canRead: true, canExport: true, scopes: ['racetrack'] },
  'facilities-manager': { canRead: true, canExport: false, scopes: ['racetrack'] },
  'compliance-officer': { canRead: true, canExport: true, scopes: ['organization', 'racetrack', 'federation'] },
  'finance-manager': { canRead: true, canExport: false, scopes: ['racetrack'] },
  'ticketing-fan-manager': { canRead: false, canExport: false, scopes: ['racetrack'] },
  executive: { canRead: true, canExport: false, scopes: ['organization', 'racetrack'] },
  'read-only-auditor': { canRead: true, canExport: true, scopes: ['organization', 'racetrack', 'federation'] },
  'data-analytics-user': { canRead: false, canExport: false, scopes: ['racetrack'] },
  'support-operator': { canRead: true, canExport: false, scopes: ['platform', 'organization'] },
  'staff-limited': { canRead: false, canExport: false, scopes: ['racetrack'] },
  'ai-safety-agent': { canRead: true, canExport: false, scopes: ['platform'] },
};

export function rolesForApprovalStep(action: ProtectedAction, kind: 'requestors' | 'approvers' | 'escalators'): Role[] {
  return approvalActorRegistry[action]?.[kind] ?? [];
}

export function canRoleApproveAction(role: Role, action: ProtectedAction): boolean {
  return approvalActorRegistry[action]?.approvers.includes(role) ?? false;
}

export function canRoleExportAudit(role: Role): boolean {
  return auditVisibilityRegistry[role]?.canExport ?? false;
}

export function isProtectedAction(value: string): value is ProtectedAction { return (protectedActions as readonly string[]).includes(value); }
export function permissionsForApprovalAction(action: string): Permission[] { return isProtectedAction(action) ? approvalActionPermissionRegistry[action] : []; }
export function canRoleRequestApprovalAction(role: Role, action: string): boolean { return hasAnyPermission(role, permissionsForApprovalAction(action)); }

export const frontendRoutePermissionRegistry = {
  dashboard: 'read:any',
  raceDay: 'read:any',
  equine: 'vet:review',
  approvals: 'read:any',
  incidents: 'incident:manage',
  compliance: 'compliance:report',
  security: 'security:read',
  facilities: 'track:readings',
  ticketing: 'ticketing:manage',
  finance: 'finance:payout',
  federation: 'compliance:report',
  dataHub: 'data-hub:read',
  audit: 'audit:read',
  admin: 'service:operate',
  settings: 'ai:read',
  stewarding: 'read:any',
  workforce: 'read:any',
  digitalTwin: 'read:any',
  surface: 'track:readings',
  emergency: 'incident:manage',
  analytics: 'analytics:read',
  fanExperience: 'ticketing:manage',
  notifications: 'read:any',
} as const satisfies Record<string, Permission>;
export type FrontendRoutePermissionId = keyof typeof frontendRoutePermissionRegistry;

export const workflowPermissionRegistry = {
  'tmwf.gate-move.v1': ['race:request-start','track:readings','starter:update'],
  'tmwf.horse-entry.v1': ['horse:scratch','vet:review','paddock:operate'],
  'tmwf.scratch.v1': ['horse:scratch','vet:review'],
  'tmwf.inspection.v1': ['track:readings','paddock:operate'],
  'tmwf.incident.v1': ['incident:manage'],
  'tmwf.race-readiness.v1': ['race:request-start','track:readings','race-day:operate'],
  'tmwf.emergency.v1': ['incident:manage','security:manage'],
} as const satisfies Record<string, readonly Permission[]>;

export const auditExportPermissionRegistry = {
  '/api/v1/audit/events': 'audit:read',
  '/api/v1/audit/search': 'audit:read',
  '/api/v1/audit/verification': 'audit:read',
  '/api/v1/audit/evidence-path': 'audit:read',
  '/api/v1/audit/forensic-reconstruction': 'audit:export',
  '/api/v1/audit/compliance-export': 'audit:export',
  '/api/v1/audit/legal-holds': 'audit:export',
  '/api/v1/audit/exports': 'audit:export',
} as const satisfies Record<string, Permission>;

export function permissionForApiEndpoint(input: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; operationId: string }): Permission {
  if (input.path in auditExportPermissionRegistry) return auditExportPermissionRegistry[input.path as keyof typeof auditExportPermissionRegistry];
  if (input.operationId === 'requestRaceStopCommand') return 'incident:manage';
  if (input.operationId === 'requestRaceScratchCommand') return 'horse:scratch';
  if (input.operationId === 'requestRaceStartCommand') return 'race:request-start';
  if (input.operationId === 'updateHorseEligibility') return 'discipline:issue';
  if (input.operationId === 'draftAIPromptLineage') return 'ai:approve';
  if (input.operationId === 'publishAIPromptLineage') return 'ai:approve';
  if (input.path.includes('/entity-picker/')) return 'read:any';
  if (input.path.includes('/data-entry/bulk/') || input.path.includes('/data-entry/quality-validate') || input.path.includes('/data-entry/drafts')) return 'staff:task';
  if (input.path.includes('/services/safety/')) return 'incident:manage';
  if (input.path.includes('/services/security/')) return input.method === 'GET' ? 'security:read' : 'security:manage';
  if (input.path.includes('/safety-intelligence/hot-path') || input.path.includes('/safety-intelligence/warm-path') || input.path.includes('/safety-intelligence/debrief')) return 'incident:manage';
  if (input.path.includes('/safety-intelligence/')) return input.method === 'GET' ? 'incident:manage' : 'security:manage';
  if (input.path.includes('/telemetry/')) return input.method === 'GET' ? 'track:readings' : 'integration:invoke';
  if (input.path.includes('/collaboration/')) return input.method === 'GET' ? 'read:any' : 'workflow:execute';
  if (input.path.includes('/approvals/') || input.operationId.toLowerCase().includes('approval')) return input.method === 'GET' ? 'read:any' : 'ai:approve';
  if (input.path.includes('/ai-control-plane') || input.path.includes('/ai-governance') || input.path.includes('/ai/')) return input.method === 'GET' ? 'ai:read' : 'ai:approve';
  if (input.path.includes('/racing-data')) return input.method === 'GET' ? 'data-hub:read' : 'integration:invoke';
  if (input.path.includes('/artifacts/')) return input.method === 'GET' ? 'artifact:read' : 'integration:invoke';
  if (input.path.includes('/security-operations')) return input.method === 'GET' ? 'security:read' : 'security:manage';
  if (input.path.includes('/kpis/definitions') || input.path.includes('/kpis/thresholds')) return input.method === 'GET' ? 'kpi:read' : 'kpi:admin';
  if (input.path.includes('/kpis/registry') || input.path.includes('/kpis/sources')) return 'kpi:read';
  if (input.path.includes('/kpis')) return 'kpi:read';
  if (input.path.includes('/audit/')) return 'audit:read';
  if (input.path.includes('/audit-trail')) return 'read:any';
  if (input.path.includes('/compliance/') || input.path.includes('/ros/')) return 'compliance:report';
  if (input.path.includes('/emergency-operations') || input.path.includes('/incidents')) return 'incident:manage';
  if (input.path.includes('/services/finance')) return input.operationId.toLowerCase().includes('payout') ? 'finance:payout' : 'ticketing:manage';
  if (input.path.includes('/finance/ticket-revenue') || input.path.includes('/finance/hospitality-revenue')) return 'ticketing:manage';
  if (input.path.includes('/finance')) return 'finance:payout';
  if (input.path.includes('/ticket')) return 'ticketing:manage';
  if (input.operationId === 'updateTrainerCompliance' || input.operationId === 'addJockeyComplianceRecord' || input.operationId === 'updateJockeyEligibility') return 'compliance:audit';
  if (input.operationId === 'recordHorseRetirement') return 'vet:review';
  if (input.path.includes('/horse-registry') || input.path.includes('/trainer-management') || input.path.includes('/jockey-management')) {
    return input.method === 'GET' ? 'read:any' : 'horse-ops:manage';
  }
  if (input.path.includes('/veterinary-operations')) {
    if (input.method === 'GET') return 'vet:review';
    if (input.operationId === 'addVeterinaryObservation' || input.operationId === 'addVeterinaryWelfareIndicator') return 'welfare:observe';
    return 'vet:clear-flag';
  }
  if (input.path.includes('/equine-welfare')) return 'welfare:observe';
  if (input.path.includes('/equine') || (input.path.includes('/horses') && !input.path.includes('/trainer-management'))) return 'vet:review';
  if (input.path.includes('/barn')) return 'vet:review';
  if (input.path.includes('/audit-trail') || input.operationId.toLowerCase().includes('audittrail')) return 'read:any';
  if (input.path.includes('/track') || input.path.includes('/surface') || input.path.includes('/starting-gate')) return 'track:readings';
  if (input.path.includes('/facilities')) return 'track:readings';
  if (input.path.includes('/race') || input.path.includes('/races')) return input.method === 'GET' ? 'read:any' : 'race:request-start';
  if (input.path.includes('/stewarding')) return input.method === 'GET' ? 'read:any' : 'discipline:issue';
  if (input.path.includes('/workflows')) return 'workflow:execute';
  if (input.path.includes('/subscriptions') || input.path.includes('/onboarding/') || input.path.includes('/billing/')) {
    return input.method === 'GET' ? 'identity:read' : 'organization:admin';
  }
  if (input.path.includes('/customer-management') || input.path.includes('/customers') || input.path.includes('/customer-')) {
    return input.method === 'GET' ? 'identity:read' : 'organization:admin';
  }
  if (input.path.includes('/marketplace') || input.path.includes('/white-label') || input.path.includes('/nexus-expansion')) {
    return input.method === 'GET' ? 'identity:read' : 'platform:admin';
  }
  if (input.path.includes('/reporting/jobs') && input.method === 'POST') return 'compliance:report';
  if (input.path.includes('/operational-intelligence') || input.path.includes('/equine-welfare') || input.path.includes('/predictive-analytics')
    || input.path.includes('/reporting') || input.path.includes('/workflow-automation') || input.path.includes('/integration-hub')
    || input.path.includes('/mobile-operations') || input.path.includes('/compliance-command-center') || input.path.includes('/security-soc')
    || input.path.includes('/facilities-command') || input.path.includes('/federation-intelligence') || input.path.includes('/industry-intelligence') || input.path.includes('/ai-governance-registry')
    || input.path.includes('/knowledge-graph') || input.path.includes('/executive-intelligence') || input.path.includes('/enterprise-readiness')
    || input.path.includes('/digital-twin/platform')) {
    return input.method === 'GET' ? 'read:any' : 'workflow:execute';
  }
  if (input.path.includes('/platform/users') || input.path.includes('/platform/roles')) {
    return input.method === 'GET' ? 'identity:read' : 'identity:write';
  }
  if (input.path.includes('/platform/access-requests')) {
    if (input.method === 'GET') return 'identity:read';
    if (input.operationId === 'reviewPlatformAccessRequest') return 'access:approve';
    return 'access:request';
  }
  if (input.path.includes('/platform/health') || input.path.includes('/platform/readiness-scorecards') || input.path.includes('/platform/nexus-upgrade') || input.path.includes('/platform/modules') || input.path.includes('/platform/feature-flags/evaluate')) {
    return 'read:any';
  }
  if (input.path.includes('/platform/domain-ownership') || input.path.includes('/platform/governance-lineage') || input.path.includes('/platform/governed-artifacts') || input.path.includes('/platform/maturity-review') || input.path.includes('/platform/contract-coverage')) {
    return 'compliance:report';
  }
  if (input.path.includes('/platform/executive-scorecard')) return 'executive:read';
  if (input.path.includes('/platform/workflow-health') || input.path.includes('/platform/foundation') || input.path.includes('/platform/environment') || input.path.includes('/platform/feature-flags') || input.path.includes('/platform/nexus-expansion') || input.path.includes('/platform/enterprise-readiness')) {
    return input.method === 'GET' ? 'service:operate' : 'service:operate';
  }
  if (input.path.includes('/platform/organizations') || input.path.includes('/platform/tenants') || input.path.includes('/platform/racetracks')) {
    return input.method === 'GET' ? 'identity:read' : 'identity:write';
  }
  if (input.path.includes('/platform')) return 'service:operate';
  if (input.path.includes('/identity') || input.path.includes('/organizations') || input.path.includes('/tenants') || input.path.includes('/racetracks')) return input.method === 'GET' ? 'identity:read' : 'identity:write';
  if (input.path.includes('/search/')) return 'read:any';
  if (input.path.includes('/notifications/')) return 'read:any';
  if (input.path.includes('/analytics/')) return 'analytics:read';
  if (input.path.includes('/fan-experience')) return 'ticketing:manage';
  if (input.path.includes('/federation')) return 'compliance:report';
  return 'read:any';
}
