import type { Role } from './accessControl.js';
import type { DataEntryEntityKind, DataEntryFormMode, DataEntryScope, DataEntryValidationResult } from './dataEntryFramework.js';
import {
  assertDataEntryTenantScope,
  enrichPayloadWithScope,
  validateDataEntryForm,
} from './dataEntryFramework.js';
import type { RaceCardLifecycleStatus } from './raceCardManagement.js';
import { raceCardLifecycleTransitions } from './raceCardManagement.js';
import { validateRaceCardEntryConflicts } from './raceCardEntry.js';

export const dataQualityValidationSchemaVersion = 'trackmind.data-quality-validation.v1' as const;

export type DataQualityIssueCategory =
  | 'required-field'
  | 'domain-rule'
  | 'cross-field'
  | 'duplicate'
  | 'date-time'
  | 'status-transition'
  | 'assignment-conflict'
  | 'scope-tenant'
  | 'stale-reference';

export type DataQualityIssueSeverity = 'error' | 'warning';

export interface DataQualityIssue {
  code: string;
  category: DataQualityIssueCategory;
  severity: DataQualityIssueSeverity;
  message: string;
  field?: string;
  entityKind?: DataEntryEntityKind;
}

export interface DataQualityReferenceRecord {
  id: string;
  status?: string;
  updatedAt?: string;
  racetrackId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface DataQualityRaceCardEntryRef {
  entryId: string;
  raceCardId: string;
  horseId: string;
  jockeyId?: string;
  trainerId?: string;
  postPosition?: number;
  scratched?: boolean;
}

export interface DataQualityTrainerAssignmentRef {
  horseId: string;
  trainerId: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface DataQualityReferenceCatalog {
  horses?: DataQualityReferenceRecord[];
  trainers?: DataQualityReferenceRecord[];
  jockeys?: DataQualityReferenceRecord[];
  owners?: DataQualityReferenceRecord[];
  raceCards?: DataQualityReferenceRecord[];
  assets?: DataQualityReferenceRecord[];
  entries?: DataQualityRaceCardEntryRef[];
  trainerAssignments?: DataQualityTrainerAssignmentRef[];
}

export interface DataQualityValidationContext {
  scope: DataEntryScope;
  mode?: DataEntryFormMode;
  role?: Role;
  references?: DataQualityReferenceCatalog;
  baseline?: Record<string, unknown>;
  batchValues?: readonly Record<string, unknown>[];
  batchRowIndex?: number;
  staleReferenceMaxAgeHours?: number;
}

export interface DataQualityValidationResult extends DataEntryValidationResult {
  schemaVersion: typeof dataQualityValidationSchemaVersion;
  issues: DataQualityIssue[];
}

const DEFAULT_STALE_REFERENCE_MAX_AGE_HOURS = 24 * 30;

const paddockStatusTransitions: Record<string, readonly string[]> = {
  scheduled: ['in-progress', 'blocked'],
  'in-progress': ['complete', 'blocked'],
  blocked: ['in-progress'],
  complete: [],
};

const inactiveReferenceStatuses = new Set([
  'retired',
  'inactive',
  'deceased',
  'archived',
  'cancelled',
  'suspended',
  'expired',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTimestamp(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function issue(
  code: string,
  category: DataQualityIssueCategory,
  message: string,
  options: { field?: string; entityKind?: DataEntryEntityKind; severity?: DataQualityIssueSeverity } = {},
): DataQualityIssue {
  return {
    code,
    category,
    severity: options.severity ?? 'error',
    message,
    field: options.field,
    entityKind: options.entityKind,
  };
}

function catalogIndex(records: DataQualityReferenceRecord[] | undefined): Map<string, DataQualityReferenceRecord> {
  return new Map((records ?? []).map((record) => [record.id, record]));
}

function issueMessages(issues: DataQualityIssue[]): string[] {
  return [...new Set(issues.filter((entry) => entry.severity === 'error').map((entry) => entry.message))];
}

export function validateDateTimeSanity(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const now = Date.now();
  const twoYearsMs = 1000 * 60 * 60 * 24 * 365 * 2;

  const checkPast = (field: string, label: string, maxFutureMs = 0) => {
    const ts = parseTimestamp(values[field]);
    if (ts === undefined) return;
    if (ts > now + maxFutureMs) {
      issues.push(issue('datetime-future', 'date-time', `${label} cannot be in the future.`, { field, entityKind }));
    }
  };

  const checkFuture = (field: string, label: string, gracePastMs = 1000 * 60 * 60 * 24) => {
    const ts = parseTimestamp(values[field]);
    if (ts === undefined) return;
    if (ts < now - gracePastMs) {
      issues.push(issue('datetime-stale-schedule', 'date-time', `${label} must be in the future.`, { field, entityKind }));
    }
  };

  const checkRange = (startField: string, endField: string, label: string) => {
    const start = parseTimestamp(values[startField]);
    const end = parseTimestamp(values[endField]);
    if (start !== undefined && end !== undefined && end < start) {
      issues.push(issue('datetime-range-invalid', 'cross-field', `${label}: end must be on or after start.`, {
        field: endField,
        entityKind,
      }));
    }
  };

  if (entityKind === 'horse') {
    checkPast('foaled', 'Foaling date');
    const foaled = parseTimestamp(values.foaled);
    if (foaled !== undefined && foaled < Date.parse('1970-01-01')) {
      issues.push(issue('datetime-unreasonable', 'date-time', 'Foaling date is unreasonably early.', { field: 'foaled', entityKind }));
    }
  }

  if (entityKind === 'trainer-assignment' || entityKind === 'horse-ownership' || entityKind === 'stable-assignment') {
    checkPast('effectiveFrom', 'Effective from', twoYearsMs);
    checkRange('effectiveFrom', 'effectiveTo', 'Assignment effective period');
  }

  if (entityKind === 'retirement-record') {
    checkPast('retiredAt', 'Retirement date');
    const foaled = parseTimestamp(values.foaled ?? values.horseFoaled);
    const retiredAt = parseTimestamp(values.retiredAt);
    if (foaled !== undefined && retiredAt !== undefined && retiredAt < foaled) {
      issues.push(issue('datetime-retirement-before-foaling', 'cross-field', 'Retirement date cannot precede foaling date.', {
        field: 'retiredAt',
        entityKind,
      }));
    }
  }

  if (entityKind === 'facilities-inspection') {
    checkFuture('nextInspectionAt', 'Next inspection time');
  }

  if (entityKind === 'race-card') {
    checkPast('scheduledPostTime', 'Scheduled post time', twoYearsMs);
  }

  if (entityKind === 'workout-record' || entityKind === 'transport-record') {
    checkPast('date', 'Activity date', twoYearsMs);
    checkPast('observedAt', 'Observed time', twoYearsMs);
  }

  return issues;
}

export function validateScopeAndTenant(
  scope: DataEntryScope,
  values: Record<string, unknown>,
): DataQualityIssue[] {
  const scopeCheck = assertDataEntryTenantScope(scope, values);
  return scopeCheck.errors.map((message) => issue('scope-tenant-mismatch', 'scope-tenant', message));
}

function referenceIsStale(record: DataQualityReferenceRecord, maxAgeHours: number): boolean {
  if (!record.updatedAt) return false;
  const updatedAt = parseTimestamp(record.updatedAt);
  if (updatedAt === undefined) return false;
  return Date.now() - updatedAt > maxAgeHours * 60 * 60 * 1000;
}

export function validateReferenceCatalog(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
  references: DataQualityReferenceCatalog | undefined,
  maxAgeHours = DEFAULT_STALE_REFERENCE_MAX_AGE_HOURS,
): DataQualityIssue[] {
  if (!references) return [];
  const issues: DataQualityIssue[] = [];
  const horses = catalogIndex(references.horses);
  const trainers = catalogIndex(references.trainers);
  const jockeys = catalogIndex(references.jockeys);
  const owners = catalogIndex(references.owners);
  const raceCards = catalogIndex(references.raceCards);
  const assets = catalogIndex(references.assets);

  const requireRef = (
    field: string,
    catalog: Map<string, DataQualityReferenceRecord>,
    label: string,
    options: { allowInactive?: boolean } = {},
  ) => {
    const id = String(values[field] ?? '').trim();
    if (!id) return;
    const record = catalog.get(id);
    if (!record) {
      issues.push(issue('stale-reference-missing', 'stale-reference', `${label} ${id} was not found in the current catalog.`, {
        field,
        entityKind,
      }));
      return;
    }
    if (!options.allowInactive && record.status && inactiveReferenceStatuses.has(record.status)) {
      issues.push(issue('stale-reference-inactive', 'stale-reference', `${label} ${id} is ${record.status} and cannot be referenced.`, {
        field,
        entityKind,
      }));
    }
    if (referenceIsStale(record, maxAgeHours)) {
      issues.push(issue('stale-reference-aged', 'stale-reference', `${label} ${id} catalog entry may be stale — refresh workspace data.`, {
        field,
        entityKind,
        severity: 'warning',
      }));
    }
  };

  const horseLinkedKinds: DataEntryEntityKind[] = [
    'horse-ownership', 'trainer-assignment', 'stable-assignment', 'race-eligibility',
    'transport-record', 'workout-record', 'welfare-observation', 'veterinary-observation',
    'retirement-record', 'race-card-entry', 'paddock-record',
  ];
  if (horseLinkedKinds.includes(entityKind)) requireRef('horseId', horses, 'Horse');
  if (entityKind === 'trainer-assignment' || entityKind === 'race-card-entry') requireRef('trainerId', trainers, 'Trainer');
  if (entityKind === 'jockey-assignment' || entityKind === 'race-card-entry') requireRef('jockeyId', jockeys, 'Jockey', { allowInactive: false });
  if (entityKind === 'race-card-entry') requireRef('ownerId', owners, 'Owner');
  if (entityKind === 'race-card' || entityKind === 'race-card-entry' || entityKind === 'jockey-assignment' || entityKind === 'race-card-lifecycle') {
    requireRef('raceCardId', raceCards, 'Race card');
  }
  if (entityKind === 'facilities-inspection' || entityKind === 'facilities-maintenance') requireRef('assetId', assets, 'Asset');

  return issues;
}

export function validateStatusTransitions(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
  baseline?: Record<string, unknown>,
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  if (entityKind === 'race-card-lifecycle') {
    const fromStatus = String(baseline?.lifecycleStatus ?? baseline?.fromStatus ?? values.fromStatus ?? 'draft') as RaceCardLifecycleStatus;
    const toStatus = String(values.toStatus ?? values.targetStatus ?? '') as RaceCardLifecycleStatus;
    if (!toStatus) return issues;
    const allowed = raceCardLifecycleTransitions
      .filter((transition) => transition.from === fromStatus)
      .map((transition) => transition.to);
    if (!allowed.includes(toStatus)) {
      issues.push(issue(
        'status-transition-invalid',
        'status-transition',
        `Race card cannot transition from ${fromStatus} to ${toStatus}. Allowed: ${allowed.join(', ') || 'none'}.`,
        { field: 'toStatus', entityKind },
      ));
    }
  }

  if (entityKind === 'paddock-record') {
    const fromStatus = String(baseline?.status ?? 'scheduled');
    const toStatus = String(values.status ?? '');
    if (!toStatus || fromStatus === toStatus) return issues;
    const allowed = paddockStatusTransitions[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      issues.push(issue(
        'status-transition-invalid',
        'status-transition',
        `Paddock status cannot transition from ${fromStatus} to ${toStatus}.`,
        { field: 'status', entityKind },
      ));
    }
  }

  if (entityKind === 'race-eligibility') {
    const fromScratch = String(baseline?.scratchStatus ?? 'active');
    const toScratch = String(values.scratchStatus ?? '');
    if (fromScratch !== 'active' && toScratch === 'active' && values.confirmOverwrite !== true) {
      issues.push(issue(
        'status-transition-reactivation',
        'status-transition',
        'Reactivating a scratched horse requires confirmOverwrite.',
        { field: 'scratchStatus', entityKind },
      ));
    }
  }

  return issues;
}

export function validateAssignmentConflicts(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
  references: DataQualityReferenceCatalog | undefined,
): DataQualityIssue[] {
  if (!references) return [];
  const issues: DataQualityIssue[] = [];

  if (entityKind === 'trainer-assignment') {
    const horseId = String(values.horseId ?? '');
    const trainerId = String(values.trainerId ?? '');
    const effectiveFrom = String(values.effectiveFrom ?? '');
    const licenseStatus = String(values.licenseStatus ?? 'active');
    if (licenseStatus !== 'active') {
      issues.push(issue('assignment-trainer-license', 'assignment-conflict', 'Trainer license must be active for new assignments.', {
        field: 'licenseStatus',
        entityKind,
      }));
    }
    for (const assignment of references.trainerAssignments ?? []) {
      if (assignment.horseId !== horseId) continue;
      if (assignment.trainerId === trainerId && assignment.effectiveFrom === effectiveFrom) continue;
      if (assignment.effectiveFrom === effectiveFrom) {
        issues.push(issue(
          'assignment-trainer-overlap',
          'assignment-conflict',
          `Horse ${horseId} already has a trainer assignment effective ${effectiveFrom}.`,
          { field: 'effectiveFrom', entityKind },
        ));
      }
    }
  }

  if (entityKind === 'jockey-assignment') {
    const raceCardId = String(values.raceCardId ?? '');
    const entryId = String(values.entryId ?? '');
    const jockeyId = String(values.jockeyId ?? '');
    const activeEntries = (references.entries ?? []).filter((entry) => !entry.scratched);
    for (const entry of activeEntries) {
      if (entry.raceCardId !== raceCardId) continue;
      if (entry.entryId === entryId) continue;
      if (entry.jockeyId && entry.jockeyId === jockeyId) {
        issues.push(issue(
          'assignment-jockey-conflict',
          'assignment-conflict',
          `Jockey ${jockeyId} is already assigned to entry ${entry.entryId} on race card ${raceCardId}.`,
          { field: 'jockeyId', entityKind,
          },
        ));
      }
    }
  }

  return issues;
}

export function validateDuplicateDetection(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
  references: DataQualityReferenceCatalog | undefined,
  batchValues?: readonly Record<string, unknown>[],
  batchRowIndex?: number,
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  if (entityKind === 'horse') {
    const microchipId = String(values.microchipId ?? '').trim();
    if (microchipId && references?.horses?.some((horse) => {
      const meta = horse.metadata;
      return isRecord(meta) && String(meta.microchipId ?? '') === microchipId && horse.id !== String(values.recordId ?? values.horseId ?? '');
    })) {
      issues.push(issue('duplicate-microchip', 'duplicate', `Microchip ${microchipId} is already registered.`, {
        field: 'microchipId',
        entityKind,
      }));
    }
  }

  if (entityKind === 'race-card-entry') {
    const raceCardId = String(values.raceCardId ?? '');
    const horseId = String(values.horseId ?? '');
    const existing = (references?.entries ?? []).filter((entry) => entry.raceCardId === raceCardId && entry.horseId === horseId && !entry.scratched);
    if (existing.length > 0) {
      issues.push(issue('duplicate-race-entry', 'duplicate', `Horse ${horseId} is already entered on race card ${raceCardId}.`, {
        field: 'horseId',
        entityKind,
      }));
    }
    const batchDuplicates = (batchValues ?? []).filter((row, index) =>
      index !== batchRowIndex
      && String(row.raceCardId ?? '') === raceCardId
      && String(row.horseId ?? '') === horseId,
    );
    if (batchDuplicates.length > 0) {
      issues.push(issue('duplicate-batch-race-entry', 'duplicate', `Duplicate horse ${horseId} appears multiple times in this batch for race card ${raceCardId}.`, {
        field: 'horseId',
        entityKind,
      }));
    }
  }

  if (entityKind === 'race-card-entry' && references?.entries) {
    const proposed = [
      ...references.entries.map((entry) => ({
        id: entry.entryId,
        horseId: entry.horseId,
        jockeyId: entry.jockeyId,
        postPosition: entry.postPosition,
        scratched: entry.scratched ?? false,
      })),
      {
        id: String(values.entryId ?? 'proposed'),
        horseId: String(values.horseId ?? ''),
        jockeyId: values.jockeyId ? String(values.jockeyId) : undefined,
        postPosition: typeof values.programNumber === 'number' ? values.programNumber : undefined,
        scratched: false,
      },
    ];
    for (const conflict of validateRaceCardEntryConflicts(proposed)) {
      issues.push(issue(conflict.code, 'duplicate', conflict.message, {
        field: conflict.field,
        entityKind,
      }));
    }
  }

  return issues;
}

export function validateCrossFieldRules(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  if (entityKind === 'race-card-entry') {
    const weight = values.weightLbs;
    if (weight !== undefined && (Number(weight) < 100 || Number(weight) > 140)) {
      issues.push(issue('cross-field-weight', 'cross-field', 'Assigned weight must be between 100 and 140 lbs.', {
        field: 'weightLbs',
        entityKind,
      }));
    }
    if (!values.trainerId || !values.ownerId) {
      issues.push(issue('cross-field-race-entry-linkage', 'cross-field', 'Race entries require trainer and owner linkage.', {
        field: 'trainerId',
        entityKind,
      }));
    }
  }

  if (entityKind === 'race-eligibility') {
    const scratchStatus = String(values.scratchStatus ?? '');
    const hisaCompliance = String(values.hisaCompliance ?? '');
    if (scratchStatus !== 'active' && hisaCompliance === 'compliant') {
      issues.push(issue('cross-field-scratch-compliance', 'cross-field', 'Scratched horses should not remain HISA compliant without review.', {
        field: 'hisaCompliance',
        entityKind,
        severity: 'warning',
      }));
    }
  }

  if (entityKind === 'facilities-inspection') {
    const rating = Number(values.conditionRating);
    const urgency = String(values.urgency ?? '');
    if (Number.isFinite(rating) && rating < 60 && urgency === 'normal') {
      issues.push(issue('cross-field-inspection-urgency', 'cross-field', 'Low condition ratings should elevate urgency above normal.', {
        field: 'urgency',
        entityKind,
        severity: 'warning',
      }));
    }
  }

  if (entityKind === 'kpi-definition') {
    const warning = Number(values.warning);
    const critical = Number(values.critical);
    if (Number.isFinite(warning) && Number.isFinite(critical) && critical > warning) {
      issues.push(issue('cross-field-kpi-thresholds', 'cross-field', 'Critical threshold should be lower than warning for above-target KPIs.', {
        field: 'critical',
        entityKind,
      }));
    }
  }

  return issues;
}

export function validateDomainRules(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  if (entityKind === 'horse') {
    const name = String(values.name ?? '').trim();
    if (name && name.length < 2) {
      issues.push(issue('domain-horse-name', 'domain-rule', 'Registered horse name is too short.', { field: 'name', entityKind }));
    }
  }

  if (entityKind === 'trainer-assignment') {
    if (String(values.trainerId) === String(values.horseId)) {
      issues.push(issue('domain-trainer-self', 'domain-rule', 'Trainer ID cannot match horse ID.', { field: 'trainerId', entityKind }));
    }
  }

  if (entityKind === 'jockey-assignment') {
    if (String(values.jockeyId) === String(values.entryId)) {
      issues.push(issue('domain-jockey-entry', 'domain-rule', 'Jockey ID cannot match entry ID.', { field: 'jockeyId', entityKind }));
    }
  }

  return issues;
}

export function runDataQualityValidation(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
  context: DataQualityValidationContext,
): DataQualityIssue[] {
  const scoped = enrichPayloadWithScope(context.scope, values);
  const maxAgeHours = context.staleReferenceMaxAgeHours ?? DEFAULT_STALE_REFERENCE_MAX_AGE_HOURS;

  return [
    ...validateScopeAndTenant(context.scope, scoped),
    ...validateDomainRules(entityKind, scoped),
    ...validateCrossFieldRules(entityKind, scoped),
    ...validateDateTimeSanity(entityKind, scoped),
    ...validateStatusTransitions(entityKind, scoped, context.baseline),
    ...validateReferenceCatalog(entityKind, scoped, context.references, maxAgeHours),
    ...validateAssignmentConflicts(entityKind, scoped, context.references),
    ...validateDuplicateDetection(
      entityKind,
      scoped,
      context.references,
      context.batchValues,
      context.batchRowIndex,
    ),
  ];
}

export function validateDataEntryWithQuality(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
  context: DataQualityValidationContext,
): DataQualityValidationResult {
  const mode = context.mode ?? 'create';
  const role = context.role ?? context.scope.role;
  const scoped = enrichPayloadWithScope(context.scope, values);

  const formResult = validateDataEntryForm(entityKind, scoped, { mode, role });
  const qualityIssues = runDataQualityValidation(entityKind, values, context);
  const blockingIssues = qualityIssues.filter((entry) => entry.severity === 'error');
  const qualityErrors = issueMessages(qualityIssues);

  return {
    schemaVersion: dataQualityValidationSchemaVersion,
    valid: formResult.valid && blockingIssues.length === 0,
    errors: [...new Set([...formResult.errors, ...qualityErrors])],
    issues: qualityIssues,
    normalizedValues: formResult.normalizedValues,
  };
}

export function dataQualityIssuesToFieldErrors(issues: DataQualityIssue[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const entry of issues) {
    if (!entry.field || entry.severity !== 'error') continue;
    if (!fieldErrors[entry.field]) fieldErrors[entry.field] = entry.message;
  }
  return fieldErrors;
}

export function buildReferenceCatalogFromWorkspace(input: {
  horses?: Array<Record<string, unknown>>;
  trainers?: Array<Record<string, unknown>>;
  jockeys?: Array<Record<string, unknown>>;
  owners?: Array<Record<string, unknown>>;
  raceCards?: Array<Record<string, unknown>>;
  assets?: Array<Record<string, unknown>>;
  entries?: Array<Record<string, unknown>>;
  trainerAssignments?: Array<Record<string, unknown>>;
}): DataQualityReferenceCatalog {
  const mapRecord = (rows: Array<Record<string, unknown>> | undefined, idKeys: string[]) =>
    (rows ?? []).map((row) => {
      const id = idKeys.map((key) => row[key]).find((value) => value != null && String(value).trim() !== '');
      return {
        id: String(id ?? ''),
        status: row.lifecycleStatus != null ? String(row.lifecycleStatus)
          : row.status != null ? String(row.status)
            : row.licenseStatus != null ? String(row.licenseStatus)
              : row.eligibilityStatus != null ? String(row.eligibilityStatus)
                : undefined,
        updatedAt: row.updatedAt != null ? String(row.updatedAt) : row.lastUpdatedAt != null ? String(row.lastUpdatedAt) : undefined,
        racetrackId: row.racetrackId != null ? String(row.racetrackId) : undefined,
        tenantId: row.tenantId != null ? String(row.tenantId) : undefined,
        metadata: row,
      } satisfies DataQualityReferenceRecord;
    }).filter((record) => record.id);

  return {
    horses: mapRecord(input.horses, ['horseId', 'id']),
    trainers: mapRecord(input.trainers, ['trainerId', 'id']),
    jockeys: mapRecord(input.jockeys, ['jockeyId', 'id']),
    owners: mapRecord(input.owners, ['ownerId', 'id']),
    raceCards: mapRecord(input.raceCards, ['raceCardId', 'id']),
    assets: mapRecord(input.assets, ['assetId', 'id']),
    entries: (input.entries ?? []).map((row) => ({
      entryId: String(row.entryId ?? row.id ?? ''),
      raceCardId: String(row.raceCardId ?? ''),
      horseId: String(row.horseId ?? ''),
      jockeyId: row.jockeyId != null ? String(row.jockeyId) : undefined,
      trainerId: row.trainerId != null ? String(row.trainerId) : undefined,
      postPosition: typeof row.postPosition === 'number' ? row.postPosition : typeof row.programNumber === 'number' ? row.programNumber : undefined,
      scratched: row.scratched === true || row.status === 'scratched',
    })).filter((entry) => entry.entryId && entry.raceCardId),
    trainerAssignments: (input.trainerAssignments ?? []).map((row) => ({
      horseId: String(row.horseId ?? ''),
      trainerId: String(row.trainerId ?? ''),
      effectiveFrom: String(row.effectiveFrom ?? ''),
      effectiveTo: row.effectiveTo != null ? String(row.effectiveTo) : undefined,
    })).filter((assignment) => assignment.horseId && assignment.trainerId && assignment.effectiveFrom),
  };
}
