import type {
  DataEntryDraftRecord,
  DataEntryDraftStatus,
  DataEntryEntityKind,
  DataEntryFormMode,
} from './dataEntryFramework.js';
import { getDataEntryFormDefinition } from './dataEntryFramework.js';

export const dataEntryDraftRecoverySchemaVersion = 'trackmind.data-entry-draft-recovery.v1' as const;

/** Long-form workflows prioritized for autosave, restore, and conflict handling. */
export const longFormDraftEntityKinds = [
  'horse',
  'horse-ownership',
  'race-eligibility',
  'transport-record',
  'workout-record',
  'race-card',
  'race-card-conditions',
  'race-card-classification',
  'race-card-purse',
  'race-card-entry',
  'race-card-entry-trainer',
  'race-card-post-position',
  'race-card-lifecycle',
  'unified-incident',
  'compliance-evidence',
  'veterinary-observation',
  'welfare-observation',
  'facilities-inspection',
  'facilities-maintenance',
  'federation-metadata',
  'administrative-record',
] as const satisfies readonly DataEntryEntityKind[];

export type LongFormDraftEntityKind = (typeof longFormDraftEntityKinds)[number];

export interface DataEntryDraftCleanupPolicy {
  retentionDays: number;
  purgeOnSubmit: boolean;
  purgeExpiredOnList: boolean;
}

export interface DraftConflictResult {
  hasConflict: boolean;
  reason?: string;
  draftBaselineFingerprint?: string;
  currentBaselineFingerprint?: string;
  draftBaseRecordUpdatedAt?: string;
  currentBaseRecordUpdatedAt?: string;
}

export interface LocalDraftEnvelope {
  schemaVersion: typeof dataEntryDraftRecoverySchemaVersion;
  entityKind: DataEntryEntityKind;
  mode: DataEntryFormMode;
  recordId?: string;
  values: Record<string, unknown>;
  draftId?: string;
  status: DataEntryDraftStatus;
  baselineFingerprint: string;
  baseRecordVersion?: string;
  baseRecordUpdatedAt?: string;
  updatedAt: string;
  expiresAt: string;
}

const DEFAULT_RETENTION_DAYS = 7;
const LONG_FORM_RETENTION_DAYS = 14;

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter((key) => !key.startsWith('_')).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
};

export function computeBaselineFingerprint(values: Record<string, unknown>): string {
  const normalized = { ...values };
  for (const key of Object.keys(normalized)) {
    if (key.startsWith('_')) delete normalized[key];
  }
  return stableStringify(normalized);
}

export function extractRecordVersion(values: Record<string, unknown>): {
  baseRecordVersion?: string;
  baseRecordUpdatedAt?: string;
} {
  return {
    baseRecordVersion: values._recordVersion != null ? String(values._recordVersion) : undefined,
    baseRecordUpdatedAt: values._recordUpdatedAt != null ? String(values._recordUpdatedAt) : undefined,
  };
}

export function defaultDraftRetentionDays(entityKind: DataEntryEntityKind): number {
  if ((longFormDraftEntityKinds as readonly string[]).includes(entityKind)) return LONG_FORM_RETENTION_DAYS;
  try {
    const definition = getDataEntryFormDefinition(entityKind, 'create');
    return definition.draft.retentionDays ?? DEFAULT_RETENTION_DAYS;
  } catch {
    return DEFAULT_RETENTION_DAYS;
  }
}

export function defaultDraftCleanupPolicy(entityKind: DataEntryEntityKind): DataEntryDraftCleanupPolicy {
  return {
    retentionDays: defaultDraftRetentionDays(entityKind),
    purgeOnSubmit: true,
    purgeExpiredOnList: true,
  };
}

export function computeDraftExpiresAt(createdAt: string, retentionDays: number): string {
  const expires = new Date(createdAt);
  expires.setUTCDate(expires.getUTCDate() + retentionDays);
  return expires.toISOString();
}

export function isDraftExpired(record: Pick<DataEntryDraftRecord, 'expiresAt'>, now = new Date().toISOString()): boolean {
  if (!record.expiresAt) return false;
  return Date.parse(record.expiresAt) <= Date.parse(now);
}

export function draftSessionKey(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  recordId?: string,
  tenantId = 'trackmind',
  actorId = 'anonymous',
): string {
  return `trackmind:draft:${tenantId}:${actorId}:${entityKind}:${mode}:${recordId ?? 'new'}`;
}

export function detectDraftBaselineConflict(
  draft: Pick<DataEntryDraftRecord, 'baselineFingerprint' | 'baseRecordVersion' | 'baseRecordUpdatedAt'>,
  currentBaselineFingerprint: string,
  currentRecord?: { baseRecordVersion?: string; baseRecordUpdatedAt?: string },
): DraftConflictResult {
  if (draft.baselineFingerprint && draft.baselineFingerprint !== currentBaselineFingerprint) {
    return {
      hasConflict: true,
      reason: 'The underlying record changed while you were editing. Review your draft before submitting.',
      draftBaselineFingerprint: draft.baselineFingerprint,
      currentBaselineFingerprint,
      draftBaseRecordUpdatedAt: draft.baseRecordUpdatedAt,
      currentBaseRecordUpdatedAt: currentRecord?.baseRecordUpdatedAt,
    };
  }
  if (
    draft.baseRecordVersion
    && currentRecord?.baseRecordVersion
    && draft.baseRecordVersion !== currentRecord.baseRecordVersion
  ) {
    return {
      hasConflict: true,
      reason: 'A newer version of this record exists on the server.',
      draftBaselineFingerprint: draft.baselineFingerprint,
      currentBaselineFingerprint,
      draftBaseRecordUpdatedAt: draft.baseRecordUpdatedAt,
      currentBaseRecordUpdatedAt: currentRecord.baseRecordUpdatedAt,
    };
  }
  if (
    draft.baseRecordUpdatedAt
    && currentRecord?.baseRecordUpdatedAt
    && Date.parse(currentRecord.baseRecordUpdatedAt) > Date.parse(draft.baseRecordUpdatedAt)
  ) {
    return {
      hasConflict: true,
      reason: 'The record was updated after this draft was started.',
      draftBaselineFingerprint: draft.baselineFingerprint,
      currentBaselineFingerprint,
      draftBaseRecordUpdatedAt: draft.baseRecordUpdatedAt,
      currentBaseRecordUpdatedAt: currentRecord.baseRecordUpdatedAt,
    };
  }
  return { hasConflict: false };
}

export function pickRecoverableDraft(
  drafts: DataEntryDraftRecord[],
  now = new Date().toISOString(),
): DataEntryDraftRecord | undefined {
  const active = drafts
    .filter((draft) => !isDraftExpired(draft, now))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  return active[0];
}

export function buildLocalDraftEnvelope(input: {
  entityKind: DataEntryEntityKind;
  mode: DataEntryFormMode;
  recordId?: string;
  values: Record<string, unknown>;
  baseline: Record<string, unknown>;
  draftId?: string;
  status?: DataEntryDraftStatus;
  createdAt?: string;
}): LocalDraftEnvelope {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const retentionDays = defaultDraftRetentionDays(input.entityKind);
  const version = extractRecordVersion(input.baseline);
  return {
    schemaVersion: dataEntryDraftRecoverySchemaVersion,
    entityKind: input.entityKind,
    mode: input.mode,
    recordId: input.recordId,
    values: input.values,
    draftId: input.draftId,
    status: input.status ?? 'autosaved',
    baselineFingerprint: computeBaselineFingerprint(input.baseline),
    baseRecordVersion: version.baseRecordVersion,
    baseRecordUpdatedAt: version.baseRecordUpdatedAt,
    updatedAt: createdAt,
    expiresAt: computeDraftExpiresAt(createdAt, retentionDays),
  };
}

export function parseLocalDraftEnvelope(raw: string): LocalDraftEnvelope | undefined {
  try {
    const parsed = JSON.parse(raw) as LocalDraftEnvelope;
    if (parsed.schemaVersion !== dataEntryDraftRecoverySchemaVersion) return undefined;
    if (!parsed.entityKind || !parsed.values) return undefined;
    if (isDraftExpired(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
