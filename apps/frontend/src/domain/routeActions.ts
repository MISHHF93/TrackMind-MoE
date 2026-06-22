import type { Role } from '@trackmind/shared';
import { canRoleAccessRoute } from '@trackmind/shared';
import type { DomainRouteId } from '@/domain/support';
import type { WorkspaceAction } from '@/design/components/workspace';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { mergeWorkspaceActions, resolveDefaultRaceTarget } from '@/domain/approvalControls';

export const defaultNavActions: WorkspaceAction[] = [
  { id: 'nav-dashboard', label: 'Command center', detail: 'Open the operations command center.', href: '/dashboard' },
  { id: 'nav-race-day', label: 'Race day', detail: 'Review race office lifecycle and readiness.', href: '/race-day' },
  { id: 'nav-approvals', label: 'Approvals', detail: 'Review human approval workflow queue.', href: '/approvals' },
];

const navRouteByActionId: Record<string, DomainRouteId> = {
  'nav-dashboard': 'dashboard',
  'nav-race-day': 'raceDay',
  'nav-approvals': 'approvals',
};

function filterNavActionsForRole(actions: WorkspaceAction[], role: Role): WorkspaceAction[] {
  return actions.filter((action) => {
    const routeId = navRouteByActionId[action.id];
    if (!routeId) return true;
    return canRoleAccessRoute(role, routeId);
  });
}

function routeSpecificActions(routeId: DomainRouteId, results: WorkspaceDataResult[]): WorkspaceAction[] {
  const raceTarget = resolveDefaultRaceTarget(results);
  const byRoute: Record<DomainRouteId, WorkspaceAction[]> = {
    dashboard: [
      { id: 'dash-incidents', label: 'Open incidents', detail: 'Review active incident command posture.', href: '/incidents' },
      { id: 'dash-race-day', label: 'Race day console', detail: 'Jump to race-day readiness and gate controls.', href: '/race-day' },
      { id: 'dash-emergency', label: 'Emergency ops', detail: 'Review emergency workflows and checklist.', href: '/emergency', variant: 'governance' },
    ],
    raceDay: [
      { id: 'request-race-start', label: 'Request race start approval', detail: 'Create an approval-gated race start draft.', protectedAction: 'race-start', target: raceTarget, approvalApi: 'controlled-actions', variant: 'governance' },
      { id: 'request-race-stop', label: 'Request race stop approval', detail: 'Create an approval-gated race stop draft.', protectedAction: 'race-stop', target: raceTarget, approvalApi: 'controlled-actions', variant: 'governance' },
      { id: 'request-scratch', label: 'Request scratch approval', detail: 'Create an approval-gated scratch draft.', protectedAction: 'scratch-horse', target: raceTarget, approvalApi: 'controlled-actions', variant: 'governance' },
    ],
    equine: [
      { id: 'equine-eligibility', label: 'Request eligibility update', detail: 'Governed horse eligibility review.', protectedAction: 'race-office-scratch', target: 'horse-1', approvalApi: 'controlled-actions', variant: 'governance' },
      { id: 'equine-vet', label: 'Record vet observation', detail: 'Open equine welfare observation intake.', href: '/equine?focus=observations' },
    ],
    stewarding: [
      { id: 'steward-ruling', label: 'Issue ruling draft', detail: 'Request steward final ruling approval.', protectedAction: 'disciplinary-decision', target: 'inquiry-1', approvalApi: 'controlled-actions', variant: 'governance' },
    ],
    surface: [
      { id: 'surface-irrigation', label: 'Request surface action', detail: 'Approval-gated surface maintenance action.', protectedAction: 'surface-irrigation', target: 'far-turn', approvalApi: 'controlled-actions', variant: 'governance' },
      { id: 'surface-closure', label: 'Track closure request', detail: 'Request governed track closure.', protectedAction: 'track-closure', target: 'main-track', approvalApi: 'controlled-actions', variant: 'governance' },
    ],
    approvals: [
      { id: 'approvals-composer', label: 'Open composer', detail: 'Compose a rich approval request with domain context.', href: '/approvals?focus=composer' },
      { id: 'approvals-escalation', label: 'Run escalation review', detail: 'Simulate approval escalation cycle for SLA breaches.', actionKind: 'escalation-simulate', variant: 'governance' },
    ],
    incidents: [
      { id: 'incidents-security', label: 'Security console', detail: 'File security events and escalations.', href: '/security' },
      { id: 'incidents-emergency', label: 'Activate emergency workflow', detail: 'Open emergency operations console.', href: '/emergency', variant: 'governance' },
    ],
    emergency: [
      { id: 'request-emergency', label: 'Request emergency action approval', detail: 'Human-governed emergency workflow draft.', protectedAction: 'emergency-action', target: 'incident-1', approvalApi: 'controlled-actions', variant: 'governance' },
      { id: 'emergency-drill', label: 'Schedule drill', detail: 'Jump to drill scheduling controls.', href: '/emergency?focus=drills' },
    ],
    compliance: [
      { id: 'compliance-corrective', label: 'Create corrective action', detail: 'Open compliance corrective action intake.', href: '/compliance?focus=corrective' },
      { id: 'compliance-evidence', label: 'Generate evidence packet', detail: 'Request compliance evidence package generation.', actionKind: 'compliance-evidence-packet', variant: 'governance' },
    ],
    security: [
      { id: 'security-escalation', label: 'File escalation', detail: 'Structured security escalation intake.', href: '/security?focus=entry' },
      { id: 'security-incident', label: 'Open incidents', detail: 'Review security incident board.', href: '/incidents' },
    ],
    facilities: [
      { id: 'request-maintenance', label: 'Request maintenance approval', detail: 'Safety-critical maintenance draft.', protectedAction: 'facility-maintenance-execution', target: 'GATE_MAIN_01', approvalApi: 'controlled-actions', variant: 'governance' },
      { id: 'facilities-incident', label: 'Report facility incident', detail: 'Report a facilities maintenance incident.', actionKind: 'facilities-incident-report' },
    ],
    workforce: [
      { id: 'workforce-task', label: 'Complete assigned task', detail: 'Mark next workforce task complete.', actionKind: 'workforce-task-complete' },
    ],
    digitalTwin: [
      { id: 'twin-sync', label: 'Trigger twin sync', detail: 'Request digital twin state synchronization.', actionKind: 'digital-twin-sync' },
    ],
    ticketing: [
      { id: 'ticketing-dispatch', label: 'Dispatch fan alert', detail: 'Send governed fan experience notification.', actionKind: 'notification-dispatch', variant: 'governance' },
    ],
    finance: [
      { id: 'request-payout', label: 'Request payout approval', detail: 'Dual-control payout request draft.', protectedAction: 'payout', target: 'payout-1', approvalApi: 'controlled-actions', variant: 'governance' },
    ],
    federation: [
      { id: 'federation-review', label: 'Review federation KPIs', detail: 'Open analytics for federation benchmarks.', href: '/analytics' },
    ],
    dataHub: [
      { id: 'datahub-invoke', label: 'Invoke provider', detail: 'Jump to racing data hub provider controls.', href: '/data-hub?focus=providers' },
    ],
    audit: [
      { id: 'audit-export', label: 'Request audit export', detail: 'Governed forensic audit package export.', protectedAction: 'compliance-filing-approval', target: 'audit-ledger', approvalApi: 'controlled-actions', variant: 'governance' },
    ],
    admin: [
      { id: 'admin-identity', label: 'Identity workspace', detail: 'Review users, roles, and access requests.', href: '/admin?focus=identity' },
      { id: 'admin-iot', label: 'IoT & CCTV monitoring', detail: 'Review integration connectors, camera fleet, and sensor readiness.', href: '/iot-monitoring' },
      { id: 'admin-access', label: 'Request access elevation', detail: 'Request privileged access elevation.', protectedAction: 'kpi-threshold-change', target: 'access-request', approvalApi: 'controlled-actions', variant: 'governance' },
    ],
    iotMonitoring: [
      { id: 'iot-admin', label: 'Platform administration', detail: 'Open platform health, tenants, and feature flags.', href: '/admin' },
      { id: 'iot-security', label: 'Security console', detail: 'Open operational security incidents and escalations.', href: '/security' },
      { id: 'iot-facilities', label: 'Facilities utilities', detail: 'Review facilities IoT utility adapters.', href: '/facilities?focus=utilities' },
    ],
    analytics: [
      { id: 'analytics-kpi', label: 'KPI threshold draft', detail: 'Request governed KPI threshold change.', protectedAction: 'kpi-threshold-change', target: 'kpi-readiness', approvalApi: 'controlled-actions', variant: 'governance' },
    ],
    fanExperience: [
      { id: 'fan-dispatch', label: 'Dispatch guest alert', detail: 'Send fan experience notification.', actionKind: 'notification-dispatch' },
    ],
    notifications: [
      { id: 'notifications-ack', label: 'Acknowledge inbox', detail: 'Acknowledge the latest notification.', actionKind: 'notification-acknowledge' },
    ],
    settings: [
      { id: 'settings-lineage', label: 'Prompt lineage draft', detail: 'Create AI prompt lineage draft for review.', href: '/settings?focus=lineage' },
      { id: 'settings-model', label: 'Register model card', detail: 'Open AI model registry intake.', href: '/settings?focus=registry' },
    ],
    account: [
      { id: 'account-profile', label: 'Review profile', detail: 'Open operator profile and resonance summary.', href: '/account' },
      { id: 'account-access', label: 'Request access', detail: 'Submit an access elevation request.', href: '/admin?focus=identity' },
    ],
  };
  return byRoute[routeId] ?? [];
}

export function buildRouteActions(
  routeId: DomainRouteId,
  results: WorkspaceDataResult[],
  backendActions: WorkspaceAction[],
  role?: Role,
): WorkspaceAction[] {
  const merged = mergeWorkspaceActions(defaultNavActions, backendActions, routeSpecificActions(routeId, results));
  return role ? filterNavActionsForRole(merged, role) : merged;
}

export function advisoryProtectedAction(domain?: string): string | undefined {
  if (!domain) return 'safety-critical-control';
  if (domain.includes('surface') || domain.includes('track')) return 'surface-irrigation';
  if (domain.includes('finance')) return 'payout';
  if (domain.includes('security') || domain.includes('incident')) return 'emergency-action';
  if (domain.includes('equine') || domain.includes('vet')) return 'veterinary-clearance';
  if (domain.includes('steward')) return 'disciplinary-decision';
  return 'safety-critical-control';
}

/** Map recommendation domain to approval target slug for advisories. */
export function advisoryTarget(domain?: string): string {
  if (domain?.includes('race')) return resolveDefaultRaceTarget([]);
  if (domain?.includes('surface')) return 'far-turn';
  return 'recommendation-1';
}

export function roleFilterActions(actions: WorkspaceAction[], role: Role, canUse: (action: WorkspaceAction, role: Role) => boolean): WorkspaceAction[] {
  return actions.filter((action) => canUse(action, role));
}
