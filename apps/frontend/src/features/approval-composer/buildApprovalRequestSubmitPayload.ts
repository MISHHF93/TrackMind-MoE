import type { DataEntryEntityKind, DataEntryFormMode, Role } from '@trackmind/shared';
import { buildApprovalComposerSubmitPayload } from '@trackmind/shared';

export const approvalComposerEntityKinds = ['approval-request-composer'] as const satisfies readonly DataEntryEntityKind[];

export function isApprovalComposerEntityKind(entityKind: DataEntryEntityKind): boolean {
  return (approvalComposerEntityKinds as readonly string[]).includes(entityKind);
}

export function buildApprovalRequestSubmitPayload(
  entityKind: DataEntryEntityKind,
  _mode: DataEntryFormMode,
  values: Record<string, unknown>,
  role: Role,
): Record<string, unknown> {
  if (entityKind !== 'approval-request-composer') return values;
  return buildApprovalComposerSubmitPayload(values, role);
}
