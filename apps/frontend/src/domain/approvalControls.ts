import { canRoleRequestApprovalAction, normalizeRole, type Role } from '@trackmind/shared';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import type { WorkspaceAction } from '@/design/components/workspace';
import { isRecord } from '@/lib/utils';

function approvalApiKind(api: string | undefined): WorkspaceAction['approvalApi'] {
  if (!api) return 'controlled-actions';
  if (api.includes('track-configuration/draft-requests')) return 'track-configuration/draft-requests';
  if (api.includes('starting-gate-operations/race-start-approval')) return 'starting-gate-operations/race-start-approval';
  return 'controlled-actions';
}

function controlsFromPayload(data: unknown): WorkspaceAction[] {
  if (!isRecord(data) || !Array.isArray(data.approvalControls)) return [];
  return data.approvalControls
    .filter(isRecord)
    .map((control) => {
      const action = String(control.action ?? '');
      const requiredRoles = Array.isArray(control.requiredRoles)
        ? control.requiredRoles.filter((role): role is string => typeof role === 'string')
        : [];
      return {
        id: String(control.id ?? `${action}-${control.target ?? 'target'}`),
        label: String(control.label ?? action),
        detail: String(control.reason ?? control.detail ?? 'Backend-governed approval control'),
        protectedAction: action,
        target: String(control.target ?? ''),
        approvalApi: approvalApiKind(typeof control.approvalApi === 'string' ? control.approvalApi : undefined),
        requiredRoles,
      } satisfies WorkspaceAction;
    });
}

export function extractApprovalControls(results: WorkspaceDataResult[]): WorkspaceAction[] {
  const actions: WorkspaceAction[] = [];
  for (const result of results) {
    if (result.status !== 'ready') continue;
    actions.push(...controlsFromPayload(result.data));
  }
  const byId = new Map<string, WorkspaceAction>();
  for (const action of actions) {
    byId.set(action.id, action);
  }
  return [...byId.values()];
}

export function roleCanUseAction(action: WorkspaceAction, role: Role): boolean {
  if (action.protectedAction && canRoleRequestApprovalAction(role, action.protectedAction)) {
    return true;
  }
  if (!action.requiredRoles?.length) return true;
  return action.requiredRoles.some((raw) => normalizeRole(raw) === role || raw === role);
}

export function actionDisabledReason(action: WorkspaceAction, role: Role): string | undefined {
  if (roleCanUseAction(action, role)) return undefined;
  return `Requires one of: ${action.requiredRoles?.join(', ')}`;
}

export function mergeWorkspaceActions(...groups: WorkspaceAction[][]): WorkspaceAction[] {
  const byId = new Map<string, WorkspaceAction>();
  for (const group of groups) {
    for (const action of group) {
      byId.set(action.id, action);
    }
  }
  return [...byId.values()];
}

export function resolveDefaultRaceTarget(results: WorkspaceDataResult[]): string {
  for (const result of results) {
    if (!isRecord(result.data)) continue;
    const cards = Array.isArray(result.data.cards) ? result.data.cards : [];
    const firstCard = cards.find(isRecord);
    if (firstCard && typeof firstCard.id === 'string') return firstCard.id;
    const races = Array.isArray(result.data.races) ? result.data.races : [];
    const firstRace = races.find(isRecord);
    if (firstRace && typeof firstRace.id === 'string') return firstRace.id;
    const lifecycle = Array.isArray(result.data.lifecycle) ? result.data.lifecycle : [];
    const firstLifecycle = lifecycle.find(isRecord);
    if (firstLifecycle && typeof firstLifecycle.raceId === 'string') return firstLifecycle.raceId;
  }
  return 'race-7';
}
