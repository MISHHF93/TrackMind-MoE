import type { KPIDomain } from './kpiArtifacts.js';
import type {
  Permission,
  ProtectedAction,
  Role,
  RoleScope,
} from './accessControl.js';
import {
  approvalActorRegistry,
  auditVisibilityRegistry,
  canRoleApproveAction,
  canRoleExportAudit,
  canRoleRequestApprovalAction,
  frontendRoutePermissionRegistry,
  hasPermission,
  rolePermissions,
  roles,
  rolesWithPermission,
} from './accessControl.js';
import type { DomainRouteId, FunctionalCategory, SensitivityLevel } from './roleOperatingModel.js';
import {
  canRoleEditRoute,
  canRoleViewRoute,
  roleCapabilityBindings,
  visibleKpiDomainsForRole,
} from './roleOperatingModel.js';
import type { VeterinaryPrivacyScope } from './veterinaryOperations.js';
import { veterinaryPrivacyScopesByRole } from './veterinaryOperations.js';

export type EntityDomain =
  | 'veterinary'
  | 'welfare'
  | 'financial'
  | 'disciplinary'
  | 'security'
  | 'compliance'
  | 'operational'
  | 'platform'
  | 'ticketing'
  | 'facilities';

export type EntityAction = 'view' | 'create' | 'edit' | 'approve' | 'export' | 'admin';

export interface EntityAccessRule {
  domain: EntityDomain;
  sensitivity: SensitivityLevel;
  scope: RoleScope;
  viewers: Role[];
  creators: Role[];
  editors: Role[];
  approvers: Role[];
  exporters: Role[];
  admins: Role[];
}

const entityDomainMeta: Record<EntityDomain, { sensitivity: SensitivityLevel; scope: RoleScope; viewPermission: Permission }> = {
  veterinary: { sensitivity: 'medical', scope: 'racetrack', viewPermission: 'vet:review' },
  welfare: { sensitivity: 'medical', scope: 'racetrack', viewPermission: 'welfare:observe' },
  financial: { sensitivity: 'financial', scope: 'racetrack', viewPermission: 'finance:payout' },
  disciplinary: { sensitivity: 'disciplinary', scope: 'racetrack', viewPermission: 'discipline:issue' },
  security: { sensitivity: 'security-sensitive', scope: 'racetrack', viewPermission: 'security:read' },
  compliance: { sensitivity: 'compliance', scope: 'organization', viewPermission: 'compliance:report' },
  operational: { sensitivity: 'operational', scope: 'racetrack', viewPermission: 'read:any' },
  platform: { sensitivity: 'support-governed', scope: 'platform', viewPermission: 'service:operate' },
  ticketing: { sensitivity: 'operational', scope: 'racetrack', viewPermission: 'ticketing:manage' },
  facilities: { sensitivity: 'operational', scope: 'racetrack', viewPermission: 'track:readings' },
};

function rolesWithAnyPermission(...permissions: Permission[]): Role[] {
  return roles.filter((role) => permissions.some((permission) => hasPermission(role, permission)));
}

function buildEntityRule(domain: EntityDomain): EntityAccessRule {
  const meta = entityDomainMeta[domain];
  const viewers = rolesWithPermission(meta.viewPermission);
  const creators = rolesWithAnyPermission(
    meta.viewPermission,
    ...(domain === 'veterinary' ? ['vet:clear-flag' as Permission] : []),
    ...(domain === 'welfare' ? ['welfare:observe' as Permission] : []),
    ...(domain === 'financial' ? ['finance:payout' as Permission] : []),
    ...(domain === 'disciplinary' ? ['discipline:issue' as Permission] : []),
    ...(domain === 'security' ? ['security:manage' as Permission] : []),
    ...(domain === 'compliance' ? ['compliance:audit' as Permission] : []),
    ...(domain === 'platform' ? ['platform:admin' as Permission, 'organization:admin' as Permission] : []),
  );
  const editors = creators.filter((role) => canRoleEditRoute(role, domainRouteForEntity(domain)));
  const approvers = (roles as readonly Role[]).filter((role) =>
    Object.keys(approvalActorRegistry).some((action) =>
      canRoleApproveAction(role, action as ProtectedAction)
      && approvalActionMatchesDomain(action as ProtectedAction, domain),
    ),
  );
  const exporters = (roles as readonly Role[]).filter((role) => {
    if (domain === 'compliance' || domain === 'security') return canRoleExportAudit(role);
    if (domain === 'financial') return hasPermission(role, 'audit:read');
    return false;
  });
  const admins = rolesWithAnyPermission(
    ...(domain === 'platform'
      ? ['platform:admin' as Permission, 'organization:admin' as Permission, 'racetrack:admin' as Permission]
      : domain === 'compliance'
        ? ['compliance:audit' as Permission, 'policy:manage' as Permission]
        : domain === 'security'
          ? ['security:admin' as Permission]
          : ['tenant:admin' as Permission]),
  );

  return {
    domain,
    sensitivity: meta.sensitivity,
    scope: meta.scope,
    viewers,
    creators,
    editors,
    approvers,
    exporters,
    admins,
  };
}

function domainRouteForEntity(domain: EntityDomain): DomainRouteId {
  const map: Record<EntityDomain, DomainRouteId> = {
    veterinary: 'equine',
    welfare: 'equine',
    financial: 'finance',
    disciplinary: 'stewarding',
    security: 'security',
    compliance: 'compliance',
    operational: 'raceDay',
    platform: 'admin',
    ticketing: 'ticketing',
    facilities: 'facilities',
  };
  return map[domain];
}

function approvalActionMatchesDomain(action: ProtectedAction, domain: EntityDomain): boolean {
  const prefixes: Record<EntityDomain, ProtectedAction[]> = {
    veterinary: ['clear-vet-flag', 'veterinary-clearance', 'medication-decision', 'scratch-horse'],
    welfare: ['scratch-horse', 'clear-vet-flag'],
    financial: ['payout'],
    disciplinary: ['disciplinary-decision', 'steward-ruling', 'steward-decision', 'official-results'],
    security: ['emergency-action', 'safety-critical-control', 'emergency-personnel-override'],
    compliance: ['compliance-filing-approval'],
    operational: ['race-start', 'race-stop', 'race-status-change', 'starting-gate-move'],
    platform: ['kpi-threshold-change'],
    ticketing: [],
    facilities: ['facility-maintenance-execution', 'surface-irrigation', 'track-closure', 'track-reopen'],
  };
  return prefixes[domain]?.includes(action) ?? false;
}

export const entityAccessRules: Record<EntityDomain, EntityAccessRule> = Object.fromEntries(
  (Object.keys(entityDomainMeta) as EntityDomain[]).map((domain) => [domain, buildEntityRule(domain)]),
) as Record<EntityDomain, EntityAccessRule>;

export function canRoleAccessEntity(role: Role, domain: EntityDomain, action: EntityAction): boolean {
  const rule = entityAccessRules[domain];
  if (!rule) return false;
  switch (action) {
    case 'view': return rule.viewers.includes(role);
    case 'create': return rule.creators.includes(role);
    case 'edit': return rule.editors.includes(role);
    case 'approve': return rule.approvers.includes(role);
    case 'export': return rule.exporters.includes(role);
    case 'admin': return rule.admins.includes(role);
    default: return false;
  }
}

export function rolesForEntityAction(domain: EntityDomain, action: EntityAction): Role[] {
  const rule = entityAccessRules[domain];
  if (!rule) return [];
  switch (action) {
    case 'view': return rule.viewers;
    case 'create': return rule.creators;
    case 'edit': return rule.editors;
    case 'approve': return rule.approvers;
    case 'export': return rule.exporters;
    case 'admin': return rule.admins;
    default: return [];
  }
}

export function canRoleViewKpiDomain(role: Role, domain: KPIDomain): boolean {
  return visibleKpiDomainsForRole(role).includes(domain);
}

export function canRoleReceiveNotification(role: Role, channel: string): boolean {
  return roleCapabilityBindings[role]?.notificationChannels.includes(channel) ?? false;
}

export function routePermissionForId(routeId: DomainRouteId): Permission {
  return frontendRoutePermissionRegistry[routeId as keyof typeof frontendRoutePermissionRegistry] ?? 'read:any';
}

export function canRoleAccessRoute(role: Role, routeId: DomainRouteId): boolean {
  return canRoleViewRoute(role, routeId) && hasPermission(role, routePermissionForId(routeId));
}

export function canRoleExportRoute(role: Role, routeId: DomainRouteId): boolean {
  return roleCapabilityBindings[role]?.exportRoutes.includes(routeId) ?? false;
}

export function canRoleViewAudit(role: Role): boolean {
  return auditVisibilityRegistry[role]?.canRead ?? false;
}

export function canRoleViewPrivacyScope(role: Role, scope: VeterinaryPrivacyScope): boolean {
  return veterinaryPrivacyScopesByRole[role]?.includes(scope) ?? false;
}

export function canRolePerformProtectedAction(role: Role, action: ProtectedAction): boolean {
  return canRoleRequestApprovalAction(role, action) || canRoleApproveAction(role, action);
}

/** Canonical roles permitted for finance payout and release actions. */
export const financeActionRoles: Role[] = rolesForEntityAction('financial', 'create');

/** Canonical roles permitted for facilities maintenance approvals. */
export const facilitiesActionRoles: Role[] = [
  ...rolesForEntityAction('facilities', 'create'),
  'platform-super-admin',
].filter((role, index, list) => list.indexOf(role) === index) as Role[];

/** Canonical roles for steward final rulings. */
export const stewardRulingRoles: Role[] = ['steward', 'platform-super-admin'];

/** Canonical roles for race-day gate and lifecycle commands. */
export const raceDayCommandRoles: Role[] = [
  'platform-super-admin',
  'steward',
  'horse-operations-coordinator',
  'starter-official',
  'race-day-operations-manager',
];

/** Canonical roles for KPI threshold administration. */
export const kpiAdminRoles: Role[] = rolesWithPermission('kpi:admin');

/** Canonical roles for compliance record mutation. */
export const complianceMutationRoles: Role[] = rolesWithPermission('compliance:audit');

/** Canonical roles for AI governance registration. */
export const governanceRegistrationRoles: Role[] = rolesWithAnyPermission('ai:approve').filter(
  (role) => role === 'platform-super-admin' || role === 'compliance-officer' || role === 'organization-admin',
);

/** Canonical roles for data hub provider invocation. */
export const dataHubInvokeRoles: Role[] = rolesWithPermission('integration:invoke').filter(
  (role) => hasPermission(role, 'compliance:report') || role === 'platform-super-admin' || role === 'horse-operations-coordinator',
);

/** Canonical roles for entity resolution review drafts. */
export const dataHubReviewRoles: Role[] = [
  'platform-super-admin',
  'compliance-officer',
  'horse-operations-coordinator',
];

export function functionalCategoryForRoleBinding(role: Role): FunctionalCategory {
  return roleCapabilityBindings[role]?.category ?? 'operational';
}

export function roleScopeForRole(role: Role): RoleScope {
  return roleCapabilityBindings[role]?.scope ?? 'racetrack';
}

/** Returns true when role is read-only for operational mutations (auditor, analytics, executive default). */
export function isReadOnlyOperationalRole(role: Role): boolean {
  if (role === 'read-only-auditor') return true;
  if (role === 'data-analytics-user') return true;
  const binding = roleCapabilityBindings[role];
  if (!binding) return true;
  return binding.editorRoutes.length === 0 && binding.approverActions.length === 0;
}

/** Support tooling guard: support operators may read diagnostics but not approve regulated actions. */
export function supportOperatorMayImpersonate(role: Role): boolean {
  return role === 'support-operator' && hasPermission(role, 'support:operate');
}

export function rolePermissionSummary(role: Role): {
  role: Role;
  scope: RoleScope;
  category: FunctionalCategory;
  permissions: Permission[];
  viewerRoutes: DomainRouteId[];
  kpiDomains: KPIDomain[];
  auditRead: boolean;
  auditExport: boolean;
  privacyScopes: VeterinaryPrivacyScope[];
} {
  const binding = roleCapabilityBindings[role];
  return {
    role,
    scope: binding?.scope ?? 'racetrack',
    category: binding?.category ?? 'operational',
    permissions: rolePermissions[role] ?? [],
    viewerRoutes: binding?.viewerRoutes ?? [],
    kpiDomains: binding?.kpiDomains ?? [],
    auditRead: canRoleViewAudit(role),
    auditExport: canRoleExportAudit(role),
    privacyScopes: binding?.privacyScopes ?? ['public'],
  };
}
