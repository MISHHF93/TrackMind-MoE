import type { DomainRouteId } from '@/domain/support';
import type { WorkspaceAction } from '@/design/components/workspace';

/** Maps role operating model quick-action ids to dock actions. */
export const quickActionRegistry: Record<string, WorkspaceAction> = {
  'platform-health': { id: 'qa-platform-health', label: 'Platform health', detail: 'Review platform observability.', href: '/admin' },
  'tenant-management': { id: 'qa-tenant-mgmt', label: 'Tenant management', detail: 'Manage organizations and tenants.', href: '/admin' },
  'feature-flags': { id: 'qa-feature-flags', label: 'Feature flags', detail: 'Review module enablement.', href: '/admin' },
  'user-management': { id: 'qa-user-mgmt', label: 'User management', detail: 'Manage organization users.', href: '/admin' },
  'module-enablement': { id: 'qa-modules', label: 'Module enablement', detail: 'Configure module entitlements.', href: '/admin' },
  'race-day-readiness': { id: 'qa-race-readiness', label: 'Race day readiness', detail: 'Open race-day command center.', href: '/race-day' },
  'user-assignments': { id: 'qa-assignments', label: 'User assignments', detail: 'Manage racetrack user access.', href: '/dashboard' },
  'race-start-approval': { id: 'qa-race-start', label: 'Race start approval', detail: 'Request race start approval.', href: '/race-day' },
  'scratch-approval': { id: 'qa-scratch', label: 'Scratch approval', detail: 'Request scratch approval.', href: '/race-day' },
  'open-approvals': { id: 'qa-approvals', label: 'Open approvals', detail: 'Review approval queue.', href: '/approvals' },
  'steward-inquiry': { id: 'qa-steward-inquiry', label: 'Steward inquiry', detail: 'Open steward command center.', href: '/stewarding' },
  'gate-readiness': { id: 'qa-gate', label: 'Gate readiness', detail: 'Update starting gate status.', href: '/race-day' },
  'paddock-check-in': { id: 'qa-paddock', label: 'Paddock check-in', detail: 'Record paddock arrival.', href: '/race-day' },
  'readiness-update': { id: 'qa-readiness', label: 'Readiness update', detail: 'Update paddock readiness.', href: '/race-day' },
  'welfare-observation': { id: 'qa-welfare', label: 'Welfare observation', detail: 'Record welfare observation.', href: '/equine?focus=observations' },
  'follow-up-request': { id: 'qa-follow-up', label: 'Follow-up request', detail: 'Request welfare follow-up.', href: '/equine' },
  'vet-examination': { id: 'qa-vet-exam', label: 'Vet examination', detail: 'Record veterinary examination.', href: '/equine' },
  'clearance-request': { id: 'qa-clearance', label: 'Clearance request', detail: 'Request veterinary clearance.', href: '/equine' },
  'horse-entry': { id: 'qa-horse-entry', label: 'Horse entry', detail: 'Manage race entries.', href: '/equine' },
  'trainer-assignment': { id: 'qa-trainer', label: 'Trainer assignment', detail: 'Coordinate trainer assignments.', href: '/equine' },
  'security-incident': { id: 'qa-security', label: 'Security incident', detail: 'File security incident.', href: '/security?focus=entry' },
  'escalation-request': { id: 'qa-escalation', label: 'Escalation request', detail: 'Request security escalation.', href: '/security' },
  'maintenance-approval': { id: 'qa-maintenance', label: 'Maintenance approval', detail: 'Request maintenance approval.', href: '/facilities' },
  inspection: { id: 'qa-inspection', label: 'Inspection', detail: 'Record facility inspection.', href: '/facilities' },
  'evidence-upload': { id: 'qa-evidence', label: 'Evidence upload', detail: 'Attach compliance evidence.', href: '/compliance?focus=corrective' },
  'audit-export': { id: 'qa-audit-export', label: 'Audit export', detail: 'Export audit evidence.', href: '/audit' },
  'payout-approval': { id: 'qa-payout', label: 'Payout approval', detail: 'Review payout approvals.', href: '/finance' },
  'attendance-update': { id: 'qa-attendance', label: 'Attendance update', detail: 'Update fan attendance.', href: '/fan-experience' },
  'executive-scorecard': { id: 'qa-executive', label: 'Executive scorecard', detail: 'View executive analytics.', href: '/analytics' },
  'evidence-export': { id: 'qa-evidence-export', label: 'Evidence export', detail: 'Export compliance evidence.', href: '/audit' },
  'trend-report': { id: 'qa-trends', label: 'Trend report', detail: 'Open analytics workspace.', href: '/analytics' },
  'tenant-diagnostics': { id: 'qa-diagnostics', label: 'Tenant diagnostics', detail: 'Run support diagnostics.', href: '/admin' },
};

export function quickActionsForRoleDock(quickActionIds: readonly string[]): WorkspaceAction[] {
  return quickActionIds
    .map((id) => quickActionRegistry[id])
    .filter((action): action is WorkspaceAction => Boolean(action));
}

export function mergeRoleQuickActions(
  routeId: DomainRouteId,
  routeActions: WorkspaceAction[],
  quickActionIds: readonly string[],
): WorkspaceAction[] {
  const quick = quickActionsForRoleDock(quickActionIds);
  const seen = new Set(routeActions.map((action) => action.id));
  const merged = [...routeActions];
  for (const action of quick) {
    if (!seen.has(action.id)) {
      merged.push(action);
      seen.add(action.id);
    }
  }
  return merged;
}
