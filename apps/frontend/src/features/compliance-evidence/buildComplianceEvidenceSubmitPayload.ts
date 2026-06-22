import type { DataEntryEntityKind, DataEntryFormMode } from '@trackmind/shared';
import { buildComplianceEvidenceIntakePayload } from '@trackmind/shared';

export const complianceEvidenceDataEntryEntityKinds = ['compliance-evidence'] as const satisfies readonly DataEntryEntityKind[];

export function isComplianceEvidenceDataEntryEntityKind(entityKind: DataEntryEntityKind): boolean {
  return (complianceEvidenceDataEntryEntityKinds as readonly string[]).includes(entityKind);
}

export function buildComplianceEvidenceSubmitPayload(
  entityKind: DataEntryEntityKind,
  _mode: DataEntryFormMode,
  values: Record<string, unknown>,
  actorId: string,
): Record<string, unknown> {
  if (entityKind !== 'compliance-evidence') return values;
  const entryMode = (values.entryMode as 'quick' | 'full' | undefined) ?? 'quick';
  return { ...buildComplianceEvidenceIntakePayload({ actorId }, values, entryMode) };
}
