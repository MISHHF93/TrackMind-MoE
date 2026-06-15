export const permissionGroups = ['read','race-operations','equine-care','track-operations','security','commerce','compliance','ai-governance','identity-governance','workflow','integration','service'] as const;
export type PermissionGroup = typeof permissionGroups[number];

export const permissionRegistry = {
  'read:any': { group: 'read', description: 'Read non-sensitive workspace metadata.' },
  'race:request-start': { group: 'race-operations', description: 'Request race lifecycle changes that require approval.' },
  'race:finalize-results': { group: 'race-operations', description: 'Finalize or modify official race results after approvals.' },
  'horse:scratch': { group: 'equine-care', description: 'Request horse scratches and race-office scratch workflows.' },
  'vet:review': { group: 'equine-care', description: 'Read veterinary and equine welfare review data.' },
  'vet:clear-flag': { group: 'equine-care', description: 'Clear veterinary flags after approval.' },
  'track:readings': { group: 'track-operations', description: 'Read and draft track surface, gate, facility, and maintenance operations.' },
  'incident:manage': { group: 'security', description: 'Manage incidents, emergency actions, and safety-critical controls.' },
  'ticketing:manage': { group: 'commerce', description: 'Read and manage ticketing workspace state.' },
  'finance:payout': { group: 'commerce', description: 'Read finance records and request protected payout actions.' },
  'security:read': { group: 'security', description: 'Read security operations workspaces and masked security records.' },
  'security:manage': { group: 'security', description: 'Read security operations and manage security incidents.' },
  'security:sensitive-read': { group: 'security', description: 'Read sensitive security fields after role and approval gates.' },
  'security:investigate': { group: 'security', description: 'Open investigations and export security investigation packages.' },
  'security:admin': { group: 'security', description: 'Administer security operations policy and sensitive access.' },
  'compliance:audit': { group: 'compliance', description: 'Manage compliance controls and regulated audit actions.' },
  'audit:read': { group: 'compliance', description: 'Read audit ledgers, evidence paths, and immutable audit events.' },
  'audit:export': { group: 'compliance', description: 'Export forensic, compliance, and legal-hold audit packages.' },
  'compliance:report': { group: 'compliance', description: 'Read compliance reports and certification-readiness packages.' },
  'data-hub:read': { group: 'integration', description: 'Read Racing Data API Hub provider, lineage, quality, and export metadata.' },
  'artifact:read': { group: 'integration', description: 'Read Universal Artifact registry, schemas, training inputs, and storage maps.' },
  'kpi:read': { group: 'read', description: 'Read governed KPI artifacts and model-readable context.' },
  'ai:approve': { group: 'ai-governance', description: 'Approve or review AI-governed recommendations and draft actions.' },
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
} as const satisfies Record<string, { group: PermissionGroup; description: string }>;

export type Permission = keyof typeof permissionRegistry;

export const roles = ['admin','steward','veterinarian','track-superintendent','security','ticketing-manager','finance','racing-secretary','compliance-officer','read-only-auditor','operations-admin','ai-safety-agent'] as const;
export type Role = typeof roles[number];
export interface RoleDefinition { role: Role; displayName: string; group: PermissionGroup; privileged: boolean; assignable: boolean }
export const roleRegistry: Record<Role, RoleDefinition> = {
  admin: { role: 'admin', displayName: 'Administrator', group: 'identity-governance', privileged: true, assignable: false },
  steward: { role: 'steward', displayName: 'Steward', group: 'race-operations', privileged: false, assignable: true },
  veterinarian: { role: 'veterinarian', displayName: 'Veterinarian', group: 'equine-care', privileged: false, assignable: true },
  'track-superintendent': { role: 'track-superintendent', displayName: 'Track Superintendent', group: 'track-operations', privileged: false, assignable: true },
  security: { role: 'security', displayName: 'Security Operations', group: 'security', privileged: false, assignable: true },
  'ticketing-manager': { role: 'ticketing-manager', displayName: 'Ticketing Manager', group: 'commerce', privileged: false, assignable: true },
  finance: { role: 'finance', displayName: 'Finance', group: 'commerce', privileged: false, assignable: true },
  'racing-secretary': { role: 'racing-secretary', displayName: 'Racing Secretary', group: 'race-operations', privileged: false, assignable: true },
  'compliance-officer': { role: 'compliance-officer', displayName: 'Compliance Officer', group: 'compliance', privileged: false, assignable: true },
  'read-only-auditor': { role: 'read-only-auditor', displayName: 'Read-only Auditor', group: 'compliance', privileged: false, assignable: true },
  'operations-admin': { role: 'operations-admin', displayName: 'Operations Administrator', group: 'workflow', privileged: true, assignable: true },
  'ai-safety-agent': { role: 'ai-safety-agent', displayName: 'AI Safety Agent', group: 'ai-governance', privileged: false, assignable: true },
};

export const rolePermissions: Record<Role, Permission[]> = {
  admin: Object.keys(permissionRegistry) as Permission[],
  steward: ['read:any','race:request-start','race:finalize-results','horse:scratch','track:readings','incident:manage','ai:approve','discipline:issue','audit:read','workflow:execute','kpi:read'],
  veterinarian: ['read:any','vet:review','vet:clear-flag','horse:scratch','ai:approve','audit:read','kpi:read'],
  'track-superintendent': ['read:any','track:readings','incident:manage','ai:approve','workflow:execute','kpi:read'],
  security: ['read:any','security:read','security:manage','security:sensitive-read','security:investigate','incident:manage','ai:approve','audit:read','workflow:execute'],
  'ticketing-manager': ['read:any','ticketing:manage','kpi:read'],
  finance: ['read:any','finance:payout','ticketing:manage','audit:read','kpi:read'],
  'racing-secretary': ['read:any','race:request-start','horse:scratch','track:readings','ai:approve','workflow:execute','integration:invoke','data-hub:read','kpi:read'],
  'compliance-officer': ['read:any','security:read','compliance:audit','compliance:report','audit:read','audit:export','ai:approve','artifact:read','integration:invoke','data-hub:read','kpi:read','policy:manage','access:review'],
  'read-only-auditor': ['read:any','audit:read','audit:export','compliance:report','artifact:read','data-hub:read','kpi:read'],
  'operations-admin': ['read:any','identity:read','identity:write','tenant:admin','access:request','access:approve','access:review','workflow:execute','service:operate','integration:invoke','track:readings','incident:manage','kpi:read'],
  'ai-safety-agent': ['read:any','ai:read','ai-agent:act','kpi:read'],
};

export function isRole(value: string): value is Role { return (roles as readonly string[]).includes(value); }
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
export const protectedActions = ['race-start','race-stop','race-cancellation','official-results','modify-official-results','scratch-horse','race-office-scratch','medication-decision','clear-vet-flag','veterinary-clearance','emergency-action','emergency-personnel-override','payout','disciplinary-decision','steward-ruling','steward-decision','safety-critical-control','starting-gate-move','race-distance-configuration','race-status-change','race-office-configuration','facility-maintenance-execution','surface-irrigation','surface-harrowing','surface-rolling','surface-track-closure-recommendation','track-closure','track-reopen','compliance-filing-approval'] as const;
export type ProtectedAction = typeof protectedActions[number];

export const approvalActionPermissionRegistry: Record<ProtectedAction, Permission[]> = {
  'race-start': ['race:request-start'],
  'race-stop': ['incident:manage'],
  'race-cancellation': ['race:request-start'],
  'official-results': ['race:finalize-results'],
  'modify-official-results': ['race:finalize-results'],
  'scratch-horse': ['horse:scratch','vet:review'],
  'race-office-scratch': ['horse:scratch','vet:review'],
  'medication-decision': ['vet:review','vet:clear-flag'],
  'clear-vet-flag': ['vet:clear-flag'],
  'veterinary-clearance': ['vet:clear-flag'],
  'emergency-action': ['incident:manage'],
  'emergency-personnel-override': ['incident:manage'],
  payout: ['finance:payout'],
  'disciplinary-decision': ['discipline:issue'],
  'steward-ruling': ['discipline:issue'],
  'steward-decision': ['discipline:issue'],
  'safety-critical-control': ['incident:manage','track:readings','security:manage'],
  'starting-gate-move': ['race:request-start','track:readings'],
  'race-distance-configuration': ['race:request-start','track:readings'],
  'race-status-change': ['race:request-start'],
  'race-office-configuration': ['race:request-start'],
  'facility-maintenance-execution': ['track:readings'],
  'surface-irrigation': ['track:readings'],
  'surface-harrowing': ['track:readings'],
  'surface-rolling': ['track:readings'],
  'surface-track-closure-recommendation': ['track:readings','incident:manage'],
  'track-closure': ['track:readings','incident:manage'],
  'track-reopen': ['track:readings','incident:manage'],
  'compliance-filing-approval': ['compliance:audit'],
};

export function isProtectedAction(value: string): value is ProtectedAction { return (protectedActions as readonly string[]).includes(value); }
export function permissionsForApprovalAction(action: string): Permission[] { return isProtectedAction(action) ? approvalActionPermissionRegistry[action] : []; }
export function canRoleRequestApprovalAction(role: Role, action: string): boolean { return hasAnyPermission(role, permissionsForApprovalAction(action)); }

export const frontendRoutePermissionRegistry = {
  dashboard: 'read:any',
  raceDay: 'race:request-start',
  equine: 'vet:review',
  approvals: 'ai:approve',
  incidents: 'incident:manage',
  compliance: 'compliance:report',
  security: 'security:read',
  facilities: 'track:readings',
  ticketing: 'ticketing:manage',
  finance: 'finance:payout',
  federation: 'compliance:report',
  dataHub: 'data-hub:read',
  audit: 'audit:read',
  admin: 'tenant:admin',
  settings: 'ai:read',
} as const satisfies Record<string, Permission>;
export type FrontendRoutePermissionId = keyof typeof frontendRoutePermissionRegistry;

export const workflowPermissionRegistry = {
  'tmwf.gate-move.v1': ['race:request-start','track:readings'],
  'tmwf.horse-entry.v1': ['horse:scratch','vet:review'],
  'tmwf.scratch.v1': ['horse:scratch','vet:review'],
  'tmwf.inspection.v1': ['track:readings'],
  'tmwf.incident.v1': ['incident:manage'],
  'tmwf.race-readiness.v1': ['race:request-start','track:readings'],
  'tmwf.emergency.v1': ['incident:manage','security:manage'],
} as const satisfies Record<string, readonly Permission[]>;

export const auditExportPermissionRegistry = {
  '/api/v1/audit/events': 'audit:read',
  '/api/v1/audit/verification': 'audit:read',
  '/api/v1/audit/evidence-path': 'audit:read',
  '/api/v1/audit/forensic-reconstruction': 'audit:export',
  '/api/v1/audit/compliance-export': 'audit:export',
  '/api/v1/audit/legal-holds': 'audit:export',
} as const satisfies Record<string, Permission>;

export function permissionForApiEndpoint(input: { method: 'GET' | 'POST'; path: string; operationId: string }): Permission {
  if (input.path in auditExportPermissionRegistry) return auditExportPermissionRegistry[input.path as keyof typeof auditExportPermissionRegistry];
  if (input.path.includes('/approvals/') || input.operationId.toLowerCase().includes('approval')) return 'ai:approve';
  if (input.path.includes('/ai-control-plane') || input.path.includes('/ai-governance') || input.path.includes('/ai/')) return input.method === 'GET' ? 'ai:read' : 'ai:approve';
  if (input.path.includes('/racing-data')) return input.method === 'GET' ? 'data-hub:read' : 'integration:invoke';
  if (input.path.includes('/artifacts/')) return input.method === 'GET' ? 'artifact:read' : 'integration:invoke';
  if (input.path.includes('/kpis')) return 'kpi:read';
  if (input.path.includes('/audit/')) return 'audit:read';
  if (input.path.includes('/compliance/') || input.path.includes('/ros/')) return 'compliance:report';
  if (input.path.includes('/security-operations')) return input.method === 'GET' ? 'security:read' : 'security:manage';
  if (input.path.includes('/emergency-operations') || input.path.includes('/incidents')) return 'incident:manage';
  if (input.path.includes('/services/finance')) return input.operationId.toLowerCase().includes('payout') ? 'finance:payout' : 'ticketing:manage';
  if (input.path.includes('/finance')) return 'finance:payout';
  if (input.path.includes('/ticket')) return 'ticketing:manage';
  if (input.path.includes('/equine') || input.path.includes('/horses')) return 'vet:review';
  if (input.path.includes('/barn')) return 'vet:review';
  if (input.path.includes('/track') || input.path.includes('/surface') || input.path.includes('/facilities') || input.path.includes('/starting-gate')) return 'track:readings';
  if (input.path.includes('/race') || input.path.includes('/races')) return 'race:request-start';
  if (input.path.includes('/stewarding')) return input.method === 'GET' ? 'read:any' : 'discipline:issue';
  if (input.path.includes('/workflows')) return 'workflow:execute';
  if (input.path.includes('/platform')) return 'service:operate';
  if (input.path.includes('/federation')) return 'compliance:report';
  return 'read:any';
}
