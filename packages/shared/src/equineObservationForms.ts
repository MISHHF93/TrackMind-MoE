import type { Role } from './accessControl.js';
import { isRole, normalizeRole } from './accessControl.js';
import type { DataEntryEntityKind, DataEntryFormMode } from './dataEntryFramework.js';
import type { WelfareAlertSeverity } from './equineWelfareIntelligence.js';
import type { VeterinaryObservationDto, VeterinaryPrivacyScope } from './veterinaryOperations.js';
import { veterinaryPrivacyScopesByRole } from './veterinaryOperations.js';

export const equineObservationFormsSchemaVersion = 'trackmind.equine-observation-forms.v1' as const;

export type EquineObservationKind = 'veterinary' | 'welfare';

export type EquineObservationEntryMode = 'quick' | 'professional';

export type EquineClearanceState =
  | 'none'
  | 'pending-review'
  | 'cleared'
  | 'restricted'
  | 'vet-hold'
  | 'denied';

export type RaceDayImpactLevel =
  | 'none'
  | 'monitor-only'
  | 'paddock-hold'
  | 'gate-delay'
  | 'scratch-recommended'
  | 'eligibility-hold';

export interface EquineObservationTypeDefinition {
  value: string;
  label: string;
  kind: EquineObservationKind | 'both';
  defaultPrivacyScope: VeterinaryPrivacyScope;
}

export const equineObservationTypes: readonly EquineObservationTypeDefinition[] = [
  { value: 'lameness', label: 'Lameness / gait', kind: 'both', defaultPrivacyScope: 'care-team' },
  { value: 'behavior', label: 'Behavior', kind: 'both', defaultPrivacyScope: 'care-team' },
  { value: 'body-condition', label: 'Body condition', kind: 'welfare', defaultPrivacyScope: 'care-team' },
  { value: 'hydration', label: 'Hydration', kind: 'both', defaultPrivacyScope: 'care-team' },
  { value: 'respiratory', label: 'Respiratory', kind: 'veterinary', defaultPrivacyScope: 'veterinary-confidential' },
  { value: 'medication', label: 'Medication / treatment', kind: 'veterinary', defaultPrivacyScope: 'veterinary-confidential' },
  { value: 'injury', label: 'Injury sign', kind: 'both', defaultPrivacyScope: 'veterinary-confidential' },
  { value: 'transport-stress', label: 'Transport stress', kind: 'welfare', defaultPrivacyScope: 'care-team' },
  { value: 'general-exam', label: 'General exam', kind: 'veterinary', defaultPrivacyScope: 'care-team' },
  { value: 'other', label: 'Other', kind: 'both', defaultPrivacyScope: 'care-team' },
];

const observationTypeMap = new Map(equineObservationTypes.map((definition) => [definition.value, definition]));

export function getEquineObservationType(value: string): EquineObservationTypeDefinition {
  return observationTypeMap.get(value) ?? {
    value: 'other',
    label: 'Other',
    kind: 'both',
    defaultPrivacyScope: 'care-team',
  };
}

export function observationTypesForKind(kind: EquineObservationKind): EquineObservationTypeDefinition[] {
  return equineObservationTypes.filter((definition) => definition.kind === kind || definition.kind === 'both');
}

export interface EquineObservationValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export const quickObservationRequiredFields = [
  'horseId', 'observationType', 'observedAt', 'severity', 'notes', 'reason',
] as const;

export const professionalObservationRequiredFields = [
  ...quickObservationRequiredFields,
  'privacyScope',
] as const;

export function equineObservationEntityKind(kind: EquineObservationKind): DataEntryEntityKind {
  return kind === 'veterinary' ? 'veterinary-observation' : 'welfare-observation';
}

export function canRoleSetPrivacyScope(role: Role, scope: VeterinaryPrivacyScope): boolean {
  const allowed = veterinaryPrivacyScopesByRole[role] ?? ['public'];
  return allowed.includes(scope);
}

export function effectivePrivacyScope(role: Role, requested: unknown, observationType: string): VeterinaryPrivacyScope {
  const definition = getEquineObservationType(observationType);
  const scope = String(requested ?? definition.defaultPrivacyScope) as VeterinaryPrivacyScope;
  if (canRoleSetPrivacyScope(role, scope)) return scope;
  const allowed = veterinaryPrivacyScopesByRole[role] ?? ['public'];
  return allowed.includes('care-team') ? 'care-team' : 'public';
}

export function validateEquineObservationEntry(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
  mode: DataEntryFormMode = 'create',
  entryMode: EquineObservationEntryMode = 'quick',
): { valid: boolean; errors: string[]; issues: EquineObservationValidationIssue[] } {
  const issues: EquineObservationValidationIssue[] = [];

  if (mode === 'edit') {
    issues.push({
      code: 'immutable',
      message: 'Observations are immutable — submit a new observation to amend the record.',
    });
  }

  const required = entryMode === 'professional' ? professionalObservationRequiredFields : quickObservationRequiredFields;
  for (const field of required) {
    const value = values[field];
    if (value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
      issues.push({ code: 'required', message: `${field} is required`, field });
    }
  }

  if (entityKind === 'welfare-observation' && values.score != null && String(values.score).trim()) {
    const score = Number(values.score);
    if (Number.isNaN(score) || score < 1 || score > 100) {
      issues.push({ code: 'score-range', message: 'score must be between 1 and 100', field: 'score' });
    }
  }

  const severity = String(values.severity ?? '');
  if (severity && !['low', 'medium', 'high', 'critical'].includes(severity)) {
    issues.push({ code: 'invalid-severity', message: 'severity must be low, medium, high, or critical', field: 'severity' });
  }

  if (values.notes && String(values.notes).length > 0 && String(values.notes).length < 8 && entryMode === 'quick') {
    issues.push({ code: 'notes-short', message: 'notes must be at least 8 characters', field: 'notes' });
  }

  if (entryMode === 'professional' && values.notes && String(values.notes).length < 12) {
    issues.push({ code: 'notes-short', message: 'notes must be at least 12 characters in professional mode', field: 'notes' });
  }

  const observerRole = String(values.observerRole ?? values.role ?? '');
  const normalizedObserver = normalizeRole(observerRole);
  if (observerRole && !normalizedObserver && !['equine-welfare-officer', 'welfare-officer', 'trainer', 'groom'].includes(observerRole)) {
    if (entityKind === 'veterinary-observation' && !normalizedObserver) {
      issues.push({ code: 'invalid-observer', message: 'observerRole must be a valid platform role for veterinary observations', field: 'observerRole' });
    }
  }

  const errors = issues.map((issue) => issue.message);
  return { valid: errors.length === 0, errors, issues };
}

export function parseRestrictions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

export function mapVetObservationCategory(observationType: string): VeterinaryObservationDto['category'] {
  const map: Record<string, VeterinaryObservationDto['category']> = {
    lameness: 'gait',
    behavior: 'behavior',
    hydration: 'hydration',
    appetite: 'appetite',
    injury: 'injury-sign',
    medication: 'injury-sign',
    respiratory: 'other',
    'general-exam': 'behavior',
    'body-condition': 'behavior',
    'transport-stress': 'behavior',
    other: 'other',
  };
  return map[observationType] ?? 'other';
}

export function buildVeterinaryObservationPayload(
  scope: { actorId: string; role: Role },
  values: Record<string, unknown>,
  entryMode: EquineObservationEntryMode = 'quick',
): Record<string, unknown> {
  const validation = validateEquineObservationEntry('veterinary-observation', values, 'create', entryMode);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const observationType = String(values.observationType ?? 'other');
  const privacyScope = effectivePrivacyScope(scope.role, values.privacyScope, observationType);
  const restrictions = parseRestrictions(values.restrictions);
  const evidence = [
    'equine-observation-form',
    `observation-type:${observationType}`,
    `entry-mode:${entryMode}`,
    ...(values.followUpNeeded === true ? ['follow-up:required'] : []),
    ...(values.raceDayImpact ? [`race-day-impact:${String(values.raceDayImpact)}`] : []),
    ...(values.clearanceState ? [`clearance:${String(values.clearanceState)}`] : []),
    ...restrictions.map((item) => `restriction:${item}`),
  ];

  return {
    horseId: String(values.horseId),
    observedAt: String(values.observedAt ?? new Date().toISOString()),
    observerId: String(values.observerId ?? values.observedBy ?? scope.actorId),
    observerRole: String(values.observerRole ?? scope.role),
    observationType,
    category: mapVetObservationCategory(observationType),
    summary: String(values.notes ?? values.summary ?? ''),
    notes: String(values.notes ?? ''),
    severity: String(values.severity ?? 'medium') as 'low' | 'medium' | 'high',
    privacyScope,
    followUpNeeded: values.followUpNeeded === true,
    clearanceState: String(values.clearanceState ?? 'none') as EquineClearanceState,
    restrictions,
    raceDayImpact: String(values.raceDayImpact ?? 'none') as RaceDayImpactLevel,
    evidence,
    immutable: true,
    reason: String(values.reason ?? 'Veterinary observation recorded'),
  };
}

export function buildWelfareObservationPayload(
  scope: { actorId: string; role: Role },
  values: Record<string, unknown>,
  entryMode: EquineObservationEntryMode = 'quick',
): Record<string, unknown> {
  const validation = validateEquineObservationEntry('welfare-observation', values, 'create', entryMode);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const observationType = String(values.observationType ?? values.category ?? 'other');
  const privacyScope = effectivePrivacyScope(scope.role, values.privacyScope, observationType);
  const restrictions = parseRestrictions(values.restrictions);
  const evidence = [
    'equine-observation-form',
    `observation-type:${observationType}`,
    `entry-mode:${entryMode}`,
    ...(values.followUpNeeded === true ? ['follow-up:required'] : []),
    ...(values.raceDayImpact ? [`race-day-impact:${String(values.raceDayImpact)}`] : []),
    ...(values.clearanceState ? [`clearance:${String(values.clearanceState)}`] : []),
    ...restrictions.map((item) => `restriction:${item}`),
  ];

  return {
    horseId: String(values.horseId),
    observedAt: String(values.observedAt ?? new Date().toISOString()),
    observerId: String(values.observerId ?? values.observedBy ?? scope.actorId),
    role: String(values.role ?? values.observerRole ?? 'equine-welfare-officer'),
    observationType,
    category: observationType,
    score: values.score != null && String(values.score).trim() ? Number(values.score) : welfareScoreFromSeverity(String(values.severity ?? 'medium')),
    severity: String(values.severity ?? 'medium') as WelfareAlertSeverity,
    notes: String(values.notes ?? ''),
    followUpNeeded: values.followUpNeeded === true,
    clearanceState: String(values.clearanceState ?? 'none') as EquineClearanceState,
    restrictions,
    privacyScope,
    raceDayImpact: String(values.raceDayImpact ?? 'none') as RaceDayImpactLevel,
    interventions: parseRestrictions(values.interventions),
    evidence,
    immutable: true,
    reason: String(values.reason ?? 'Welfare observation recorded'),
  };
}

export function welfareScoreFromSeverity(severity: string): number {
  switch (severity) {
    case 'critical': return 40;
    case 'high': return 55;
    case 'medium': return 72;
    default: return 85;
  }
}

export function fieldsForObservationEntryMode(mode: EquineObservationEntryMode, kind: EquineObservationKind): string[] {
  const base = ['horseId', 'observationType', 'observedAt', 'observedBy', 'severity', 'notes', 'followUpNeeded', 'reason'];
  if (mode === 'quick') return base;
  return [
    ...base,
    'clearanceState',
    'restrictions',
    'privacyScope',
    'raceDayImpact',
    ...(kind === 'welfare' ? ['score', 'role'] : ['observerRole']),
  ];
}

export function defaultObservationSeed(kind: EquineObservationKind, horseId: string, actorId: string, role: Role): Record<string, unknown> {
  const types = observationTypesForKind(kind);
  const firstType = types[0]?.value ?? 'other';
  return {
    horseId,
    observationType: firstType,
    observedAt: new Date().toISOString().slice(0, 16),
    observedBy: actorId,
    observerId: actorId,
    observerRole: role,
    role: kind === 'welfare' ? 'equine-welfare-officer' : role,
    severity: 'medium',
    followUpNeeded: false,
    clearanceState: 'none',
    privacyScope: getEquineObservationType(firstType).defaultPrivacyScope,
    raceDayImpact: 'none',
    entryMode: 'quick',
  };
}

export function canViewObservationPrivacyScope(role: Role, scope: VeterinaryPrivacyScope | undefined): boolean {
  if (!scope) return true;
  return (veterinaryPrivacyScopesByRole[role] ?? ['public']).includes(scope);
}

export function redactObservationForRole(
  observation: Record<string, unknown>,
  role: Role,
): Record<string, unknown> {
  if (observation.redacted === true) return observation;
  const scope = observation.privacyScope as VeterinaryPrivacyScope | undefined;
  if (scope && !canViewObservationPrivacyScope(role, scope)) {
    return {
      observationId: observation.observationId ?? observation.id,
      horseId: observation.horseId,
      observedAt: observation.observedAt,
      observationType: observation.observationType ?? observation.category,
      severity: observation.severity,
      followUpNeeded: observation.followUpNeeded,
      clearanceState: observation.clearanceState,
      raceDayImpact: observation.raceDayImpact,
      notes: 'Restricted observation detail',
      summary: 'Restricted observation detail',
      privacyScope: scope,
      redacted: true,
      auditId: observation.auditId,
    };
  }
  if (scope === 'veterinary-confidential' && role !== 'veterinarian' && role !== 'platform-super-admin' && role !== 'compliance-officer') {
    const notes = String(observation.notes ?? observation.summary ?? '');
    return {
      ...observation,
      notes: notes.length > 80 ? `${notes.slice(0, 77)}… [clinical detail restricted]` : notes,
      summary: 'Clinical observation on file',
      redacted: true,
    };
  }
  return observation;
}

export function observationHistoryImmutable(): true {
  return true;
}
