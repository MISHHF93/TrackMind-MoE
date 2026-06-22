import type { KPIDomain } from './kpiArtifacts.js';
import type { Role, RoleScope } from './accessControl.js';
import {
  approvalActorRegistry,
  auditVisibilityRegistry,
  assignableRoles,
  roles,
} from './accessControl.js';
import type { EntityAction, EntityDomain } from './roleAccessMatrix.js';
import {
  canRoleAccessEntity,
  entityAccessRules,
} from './roleAccessMatrix.js';
import type { DomainRouteId, FunctionalCategory, SensitivityLevel } from './roleOperatingModel.js';
import {
  roleCapabilityBindings,
  visibleKpiDomainsForRole,
} from './roleOperatingModel.js';

export type EntityAccessFlags = Record<EntityAction, boolean>;

export interface RoleResonanceEntry {
  role: Role;
  scope: RoleScope;
  category: FunctionalCategory;
  homeRouteId: DomainRouteId;
  viewerRoutes: DomainRouteId[];
  editorRoutes: DomainRouteId[];
  adminRoutes: DomainRouteId[];
  exportRoutes: DomainRouteId[];
  kpiDomains: ReturnType<typeof visibleKpiDomainsForRole>;
  notificationChannels: string[];
  quickActions: string[];
  auditVisibility: 'none' | 'read' | 'export';
  canExportAudit: boolean;
  entityAccess: Record<EntityDomain, EntityAccessFlags>;
  approverActions: string[];
  requestorActions: string[];
  sensitivityLevels: SensitivityLevel[];
}

const entityDomains = Object.keys(entityAccessRules) as EntityDomain[];

function entityFlagsForRole(role: Role): Record<EntityDomain, EntityAccessFlags> {
  const actions: EntityAction[] = ['view', 'create', 'edit', 'approve', 'export', 'admin'];
  return Object.fromEntries(
    entityDomains.map((domain) => [
      domain,
      Object.fromEntries(
        actions.map((action) => [action, canRoleAccessEntity(role, domain, action)]),
      ) as EntityAccessFlags,
    ]),
  ) as Record<EntityDomain, EntityAccessFlags>;
}

function sensitivityLevelsForRole(role: Role): SensitivityLevel[] {
  const levels = new Set<SensitivityLevel>();
  for (const domain of entityDomains) {
    const rule = entityAccessRules[domain];
    if (canRoleAccessEntity(role, domain, 'view')) {
      levels.add(rule.sensitivity);
    }
  }
  return [...levels];
}

function approverActionsForRole(role: Role): string[] {
  return Object.entries(approvalActorRegistry)
    .filter(([, binding]) => binding.approvers.includes(role))
    .map(([action]) => action);
}

function requestorActionsForRole(role: Role): string[] {
  return Object.entries(approvalActorRegistry)
    .filter(([, binding]) => binding.requestors.includes(role))
    .map(([action]) => action);
}

export function buildRoleResonanceEntry(role: Role): RoleResonanceEntry {
  const binding = roleCapabilityBindings[role];
  const audit = auditVisibilityRegistry[role];
  return {
    role,
    scope: binding.scope,
    category: binding.category,
    homeRouteId: binding.homeRouteId,
    viewerRoutes: [...binding.viewerRoutes],
    editorRoutes: [...binding.editorRoutes],
    adminRoutes: [...binding.adminRoutes],
    exportRoutes: [...binding.exportRoutes],
    kpiDomains: visibleKpiDomainsForRole(role),
    notificationChannels: [...binding.notificationChannels],
    quickActions: [...binding.quickActions],
    auditVisibility: binding.auditVisibility,
    canExportAudit: audit?.canExport ?? false,
    entityAccess: entityFlagsForRole(role),
    approverActions: approverActionsForRole(role),
    requestorActions: requestorActionsForRole(role),
    sensitivityLevels: sensitivityLevelsForRole(role),
  };
}

/** Derived role-to-functionality resonance matrix for all canonical roles. */
export const roleResonanceMatrix: Record<Role, RoleResonanceEntry> = Object.fromEntries(
  roles.map((role) => [role, buildRoleResonanceEntry(role)]),
) as Record<Role, RoleResonanceEntry>;

export const assignableRoleResonanceMatrix: Record<Role, RoleResonanceEntry> = Object.fromEntries(
  assignableRoles.map((role) => [role, roleResonanceMatrix[role]]),
) as Record<Role, RoleResonanceEntry>;

export function validateRoleResonanceMatrix(): string[] {
  const errors: string[] = [];
  for (const role of assignableRoles) {
    const entry = roleResonanceMatrix[role];
    if (!entry.viewerRoutes.includes(entry.homeRouteId)) {
      errors.push(`${role}: home route ${entry.homeRouteId} not in viewerRoutes`);
    }
    if (entry.kpiDomains.length === 0) {
      errors.push(`${role}: no KPI domains assigned`);
    }
    if (role === 'support-operator') {
      if (entry.entityAccess.veterinary.create || entry.entityAccess.financial.create) {
        errors.push(`${role}: support-operator must not create veterinary or financial records`);
      }
      if (entry.approverActions.length > 0) {
        errors.push(`${role}: support-operator must not be an approver for regulated actions`);
      }
    }
    if (role === 'staff-limited' && entry.editorRoutes.length > 0) {
      errors.push(`${role}: staff-limited must not have editor routes`);
    }
  }
  return errors;
}

/** Filter KPI items by role-visible domains. */
export function filterKpisForRole<T extends { domain?: string; kpiDomain?: string }>(
  kpis: readonly T[],
  role: Role,
): T[] {
  const allowed = new Set(visibleKpiDomainsForRole(role));
  return kpis.filter((kpi) => {
    const domain = (kpi.domain ?? kpi.kpiDomain) as KPIDomain | undefined;
    if (!domain) return true;
    return allowed.has(domain);
  });
}
