import type { DataEntryFormMode } from './dataEntryFramework.js';

export const administrativeRecordEntrySchemaVersion = 'trackmind.administrative-record-entry.v1' as const;

export function validateAdministrativeRecordEntry(
  values: Record<string, unknown>,
  mode: DataEntryFormMode = 'create',
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!String(values.recordType ?? '').trim()) errors.push('recordType is required');
  if (!String(values.displayName ?? '').trim()) errors.push('displayName is required');
  if (!String(values.reason ?? '').trim()) errors.push('reason is required');
  if (mode === 'edit' && !String(values.recordId ?? '').trim()) {
    errors.push('recordId is required for administrative record edits');
  }
  return { valid: errors.length === 0, errors };
}

export function buildAdministrativeRecordPayload(
  values: Record<string, unknown>,
  mode: DataEntryFormMode = 'create',
): Record<string, unknown> {
  const validation = validateAdministrativeRecordEntry(values, mode);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const displayName = String(values.displayName ?? '').trim();
  const notes = values.notes ? String(values.notes).trim() : '';
  return {
    recordType: String(values.recordType ?? ''),
    displayName,
    referenceId: values.referenceId ? String(values.referenceId) : undefined,
    notes,
    summary: notes ? `${displayName} — ${notes}` : displayName,
    recordId: values.recordId ? String(values.recordId) : undefined,
    reason: String(values.reason ?? 'Administrative record captured'),
    mode,
  };
}
