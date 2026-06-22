import type { Permission, Role } from './accessControl.js';
import { hasAnyPermission, hasPermission } from './accessControl.js';
import type { ContractRule } from './apiContracts.js';
import { validateContract } from './apiContracts.js';
import { dataEntryEntityForms, fieldRulesFromDefinition } from './dataEntryEntityRegistry.js';
import { validateRetirementConfirmation, validateSensitiveOverwrite } from './horseDataEntry.js';
import { validateIncidentIntake, type IncidentIntakeMode } from './incidentIntake.js';
import { validateApprovalComposer, type ApprovalComposeMode } from './approvalRequestComposer.js';
import {
  validateEquineObservationEntry,
  type EquineObservationEntryMode,
} from './equineObservationForms.js';
import {
  validateFacilitiesInspectionEntry,
  validateFacilitiesMaintenanceEntry,
  type FacilitiesEntryMode,
} from './facilitiesEntryWorkflows.js';
import {
  validateSecurityEventEntry,
  type SecurityEventEntryMode,
} from './securityEventEntry.js';
import {
  validateComplianceEvidenceEntry,
  type ComplianceEvidenceEntryMode,
} from './complianceEvidenceEntry.js';
import {
  validateOperationalNoteEntry,
  type OperationalNoteEntryMode,
} from './operationalNotesEntry.js';
import { validateAdministrativeRecordEntry } from './administrativeRecordEntry.js';
import { validateFederationMetadataEntry } from './federationMetadataEntry.js';

export const dataEntrySchemaVersion = 'trackmind.data-entry.v1' as const;

export type DataEntryEntityKind =
  | 'horse'
  | 'horse-ownership'
  | 'stable-assignment'
  | 'race-eligibility'
  | 'transport-record'
  | 'workout-record'
  | 'retirement-record'
  | 'race'
  | 'race-card'
  | 'race-card-conditions'
  | 'race-card-classification'
  | 'race-card-purse'
  | 'race-card-entry'
  | 'race-card-entry-trainer'
  | 'race-card-post-position'
  | 'race-card-lifecycle'
  | 'unified-incident'
  | 'incident'
  | 'approval'
  | 'approval-request-composer'
  | 'audit-note'
  | 'operational-note'
  | 'veterinary-observation'
  | 'welfare-observation'
  | 'trainer-assignment'
  | 'jockey-assignment'
  | 'paddock-record'
  | 'security-incident'
  | 'security-event-entry'
  | 'facilities-inspection'
  | 'facilities-incident'
  | 'facilities-maintenance'
  | 'compliance-evidence'
  | 'kpi-definition'
  | 'administrative-record'
  | 'federation-metadata';

export const dataEntryEntityKinds: readonly DataEntryEntityKind[] = [
  'horse', 'horse-ownership', 'stable-assignment', 'race-eligibility', 'transport-record',
  'workout-record', 'retirement-record', 'race', 'race-card', 'race-card-conditions',
  'race-card-classification', 'race-card-purse', 'race-card-entry', 'race-card-entry-trainer',
  'race-card-post-position', 'race-card-lifecycle', 'unified-incident', 'incident', 'approval', 'approval-request-composer', 'audit-note', 'operational-note',
  'veterinary-observation', 'welfare-observation', 'trainer-assignment',
  'jockey-assignment', 'paddock-record', 'security-incident', 'security-event-entry', 'facilities-inspection',
  'facilities-incident', 'facilities-maintenance', 'compliance-evidence',
  'kpi-definition', 'administrative-record', 'federation-metadata',
];

export type DataEntryFormMode = 'create' | 'edit';

export type DataEntryFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'date'
  | 'datetime-local'
  | 'checkbox'
  | 'entity-ref';

export interface DataEntryFieldOption {
  value: string;
  label: string;
}

export interface DataEntryFieldDefinition {
  path: string;
  label: string;
  type: DataEntryFieldType;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string | number | boolean;
  options?: readonly DataEntryFieldOption[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  visibleToRoles?: readonly Role[];
  editRoles?: readonly Role[];
  requiredPermission?: Permission;
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface DataEntryDraftPolicy {
  enabled: boolean;
  storage: 'local' | 'server' | 'both';
  /** Days before expired drafts are purged. Long-form workflows default to 14. */
  retentionDays?: number;
  /** Prompt before discarding unsaved or draft changes. */
  warnOnDiscard?: boolean;
}

export interface DataEntryAutosavePolicy {
  enabled: boolean;
  debounceMs: number;
}

export interface DataEntrySubmitBinding {
  createPath: string;
  editPath?: string;
  method: 'POST' | 'PATCH';
}

export interface DataEntryFormDefinition {
  entityKind: DataEntryEntityKind;
  displayName: string;
  schemaVersion: typeof dataEntrySchemaVersion;
  modes: readonly DataEntryFormMode[];
  fields: readonly DataEntryFieldDefinition[];
  submit: DataEntrySubmitBinding;
  requiredPermission: Permission;
  allowedRoles: readonly Role[];
  draft: DataEntryDraftPolicy;
  autosave: DataEntryAutosavePolicy;
  auditAction: string;
  description?: string;
}

export interface DataEntryScope {
  tenantId: string;
  racetrackId: string;
  organizationId?: string;
  actorId: string;
  role: Role;
  requestId?: string;
}

export interface DataEntryAuditMetadata {
  action: string;
  actorId: string;
  tenantId: string;
  racetrackId: string;
  organizationId?: string;
  reason: string;
  correlationId?: string;
  entityKind: DataEntryEntityKind;
  mode: DataEntryFormMode;
  recordId?: string;
  capturedAt: string;
}

export interface DataEntryValidationResult {
  valid: boolean;
  errors: string[];
  normalizedValues: Record<string, unknown>;
}

export type DataEntryDraftStatus = 'draft' | 'autosaved' | 'restored' | 'conflict';

export interface DataEntryDraftRecord {
  draftId: string;
  entityKind: DataEntryEntityKind;
  mode: DataEntryFormMode;
  recordId?: string;
  values: Record<string, unknown>;
  scope: Pick<DataEntryScope, 'tenantId' | 'racetrackId' | 'actorId' | 'role'>;
  status: DataEntryDraftStatus;
  baselineFingerprint?: string;
  baseRecordVersion?: string;
  baseRecordUpdatedAt?: string;
  autosaveCount?: number;
  conflictDetectedAt?: string;
  conflictReason?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface DataEntryMutationResult {
  accepted: boolean;
  entityKind: DataEntryEntityKind;
  mode: DataEntryFormMode;
  recordId?: string;
  auditId: string;
  eventId?: string;
  approvalRequired?: boolean;
  approvalRequestId?: string;
  artifactId?: string;
  lineageRefs?: string[];
  kpiSourceEventIds?: string[];
  digitalTwinUpdateIds?: string[];
  complianceEvidenceLinkIds?: string[];
  aiArtifactId?: string;
  pipeline?: import('./dataEntryArtifactPipeline.js').DataEntryPipelineResult;
  message: string;
  auditMetadata: DataEntryAuditMetadata;
}

export interface DataEntryDirtyState {
  isDirty: boolean;
  changedFields: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function getDataEntryFormDefinition(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode = 'create',
): DataEntryFormDefinition {
  const definition = dataEntryEntityForms[entityKind];
  if (!definition.modes.includes(mode)) {
    throw new Error(`Entity ${entityKind} does not support mode ${mode}`);
  }
  return definition;
}

export function listDataEntryFormDefinitions(): DataEntryFormDefinition[] {
  return Object.values(dataEntryEntityForms);
}

export function getDefaultFormValues(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode = 'create',
  seed: Record<string, unknown> = {},
): Record<string, unknown> {
  const definition = getDataEntryFormDefinition(entityKind, mode);
  const values: Record<string, unknown> = { ...seed };
  for (const fieldDef of definition.fields) {
    if (values[fieldDef.path] === undefined && fieldDef.defaultValue !== undefined) {
      values[fieldDef.path] = fieldDef.defaultValue;
    }
  }
  return values;
}

export function resolveSubmitPath(
  definition: DataEntryFormDefinition,
  mode: DataEntryFormMode,
  params: Record<string, string> = {},
): string {
  const template = mode === 'edit' && definition.submit.editPath
    ? definition.submit.editPath
    : definition.submit.createPath;
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => encodeURIComponent(params[key] ?? ''));
}

export function isFieldVisible(
  field: DataEntryFieldDefinition,
  role: Role,
): boolean {
  if (field.visibleToRoles && !field.visibleToRoles.includes(role)) return false;
  if (field.requiredPermission && !hasPermission(role, field.requiredPermission)) return false;
  return true;
}

export function isFieldEditable(
  field: DataEntryFieldDefinition,
  role: Role,
): boolean {
  if (field.readOnly) return false;
  if (field.editRoles && !field.editRoles.includes(role)) return false;
  return isFieldVisible(field, role);
}

export function filterVisibleFields(
  definition: DataEntryFormDefinition,
  role: Role,
): DataEntryFieldDefinition[] {
  return definition.fields.filter((fieldDef) => isFieldVisible(fieldDef, role));
}

export function canAccessForm(definition: DataEntryFormDefinition, role: Role): boolean {
  if (!definition.allowedRoles.includes(role)) return false;
  return hasPermission(role, definition.requiredPermission);
}

export function buildDataEntryAuditMetadata(
  definition: DataEntryFormDefinition,
  scope: DataEntryScope,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  recordId?: string,
): DataEntryAuditMetadata {
  return {
    action: definition.auditAction,
    actorId: scope.actorId,
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    organizationId: scope.organizationId,
    reason: String(values.reason ?? values.note ?? 'Data entry mutation'),
    correlationId: scope.requestId,
    entityKind: definition.entityKind,
    mode,
    recordId,
    capturedAt: new Date().toISOString(),
  };
}

function normalizeFieldValue(field: DataEntryFieldDefinition, value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (field.type === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  if (field.type === 'checkbox') return Boolean(value);
  if (field.type === 'textarea' && (field.path === 'evidence' || field.path === 'evidenceRefs' || field.path === 'involvedEntities' || field.path === 'eligibilityFlags' || field.path === 'raceRestrictions' || field.path === 'welfareChecks' || field.path === 'eligibility' || field.path === 'medicationRules') && typeof value === 'string') {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  if (field.type === 'textarea' && field.path === 'evidenceRefs' && typeof value === 'string') {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  if (typeof value === 'string') return value.trim();
  return value;
}

export function validateDataEntryForm(
  entityKind: DataEntryEntityKind,
  values: Record<string, unknown>,
  options: { mode?: DataEntryFormMode; role?: Role } = {},
): DataEntryValidationResult {
  const mode = options.mode ?? 'create';
  const definition = getDataEntryFormDefinition(entityKind, mode);
  const role = options.role;
  const visibleFields = role ? filterVisibleFields(definition, role) : definition.fields;
  const normalizedValues: Record<string, unknown> = {};

  for (const fieldDef of visibleFields) {
    const normalized = normalizeFieldValue(fieldDef, values[fieldDef.path]);
    if (normalized !== undefined) normalizedValues[fieldDef.path] = normalized;
  }

  const contractRules = fieldRulesFromDefinition({
    ...definition,
    fields: visibleFields.filter((fieldDef) => fieldDef.required || fieldDef.min !== undefined || fieldDef.max !== undefined),
  });

  const contractResult = validateContract(`${entityKind}.${mode}`, normalizedValues, contractRules);
  const errors = [...contractResult.errors];

  const sensitiveResult = validateSensitiveOverwrite(entityKind, mode, normalizedValues);
  if (!sensitiveResult.valid) errors.push(...sensitiveResult.errors);

  if (entityKind === 'retirement-record' && mode === 'create') {
    const retirementResult = validateRetirementConfirmation(normalizedValues);
    if (!retirementResult.valid) errors.push(...retirementResult.errors);
  }

  if (entityKind === 'unified-incident') {
    const intakeMode = (normalizedValues.intakeMode as IncidentIntakeMode | undefined) ?? 'triage';
    const intakeResult = validateIncidentIntake(normalizedValues, intakeMode);
    if (!intakeResult.valid) errors.push(...intakeResult.errors);
  }

  if (entityKind === 'approval-request-composer') {
    const composeMode = (normalizedValues.composeMode as ApprovalComposeMode | undefined) ?? 'quick';
    const composerResult = validateApprovalComposer(normalizedValues, composeMode);
    if (!composerResult.valid) errors.push(...composerResult.errors);
  }

  if (entityKind === 'veterinary-observation' || entityKind === 'welfare-observation') {
    const entryMode = (normalizedValues.entryMode as EquineObservationEntryMode | undefined) ?? 'quick';
    const observationResult = validateEquineObservationEntry(entityKind, normalizedValues, mode, entryMode);
    if (!observationResult.valid) errors.push(...observationResult.errors);
  }

  if (entityKind === 'facilities-inspection') {
    const entryMode = (normalizedValues.entryMode as FacilitiesEntryMode | undefined) ?? 'quick';
    const inspectionResult = validateFacilitiesInspectionEntry(normalizedValues, mode, entryMode);
    if (!inspectionResult.valid) errors.push(...inspectionResult.errors);
  }

  if (entityKind === 'facilities-maintenance') {
    const entryMode = (normalizedValues.entryMode as FacilitiesEntryMode | undefined) ?? 'quick';
    const maintenanceResult = validateFacilitiesMaintenanceEntry(normalizedValues, entryMode);
    if (!maintenanceResult.valid) errors.push(...maintenanceResult.errors);
  }

  if (entityKind === 'security-event-entry') {
    const entryMode = (normalizedValues.entryMode as SecurityEventEntryMode | undefined) ?? 'quick';
    const securityEventResult = validateSecurityEventEntry(normalizedValues, mode, entryMode);
    if (!securityEventResult.valid) errors.push(...securityEventResult.errors);
  }

  if (entityKind === 'compliance-evidence') {
    const entryMode = (normalizedValues.entryMode as ComplianceEvidenceEntryMode | undefined) ?? 'quick';
    const evidenceResult = validateComplianceEvidenceEntry(normalizedValues, mode, entryMode);
    if (!evidenceResult.valid) errors.push(...evidenceResult.errors);
  }

  if (entityKind === 'operational-note') {
    const entryMode = (normalizedValues.entryMode as OperationalNoteEntryMode | undefined) ?? 'flash';
    const noteResult = validateOperationalNoteEntry(normalizedValues, mode, entryMode);
    if (!noteResult.valid) errors.push(...noteResult.errors);
  }

  if (entityKind === 'administrative-record') {
    const adminResult = validateAdministrativeRecordEntry(normalizedValues, mode);
    if (!adminResult.valid) errors.push(...adminResult.errors);
  }

  if (entityKind === 'federation-metadata') {
    const federationResult = validateFederationMetadataEntry(normalizedValues, mode);
    if (!federationResult.valid) errors.push(...federationResult.errors);
  }

  for (const fieldDef of visibleFields) {
    const value = normalizedValues[fieldDef.path];
    if (fieldDef.required && (value === undefined || value === '')) {
      errors.push(`${entityKind}.${fieldDef.path} is required`);
    }
    if (typeof value === 'string' && fieldDef.minLength !== undefined && value.length < fieldDef.minLength) {
      errors.push(`${entityKind}.${fieldDef.path} must be at least ${fieldDef.minLength} characters`);
    }
    if (typeof value === 'string' && fieldDef.maxLength !== undefined && value.length > fieldDef.maxLength) {
      errors.push(`${entityKind}.${fieldDef.path} must be at most ${fieldDef.maxLength} characters`);
    }
    if (typeof value === 'number' && fieldDef.min !== undefined && value < fieldDef.min) {
      errors.push(`${entityKind}.${fieldDef.path} must be >= ${fieldDef.min}`);
    }
    if (typeof value === 'number' && fieldDef.max !== undefined && value > fieldDef.max) {
      errors.push(`${entityKind}.${fieldDef.path} must be <= ${fieldDef.max}`);
    }
    if (fieldDef.options?.length && value !== undefined && !fieldDef.options.some((option) => option.value === String(value))) {
      errors.push(`${entityKind}.${fieldDef.path} must be one of ${fieldDef.options.map((option) => option.value).join(',')}`);
    }
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)], normalizedValues };
}

export function detectDirtyState(
  current: Record<string, unknown>,
  baseline: Record<string, unknown>,
): DataEntryDirtyState {
  const changedFields: string[] = [];
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const key of keys) {
    const left = current[key];
    const right = baseline[key];
    if (JSON.stringify(left ?? null) !== JSON.stringify(right ?? null)) {
      changedFields.push(key);
    }
  }
  return { isDirty: changedFields.length > 0, changedFields };
}

export function assertDataEntryTenantScope(
  scope: DataEntryScope,
  payload: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (payload.tenantId && payload.tenantId !== scope.tenantId) {
    errors.push(`tenantId mismatch: payload ${String(payload.tenantId)} != scope ${scope.tenantId}`);
  }
  if (payload.racetrackId && payload.racetrackId !== scope.racetrackId) {
    errors.push(`racetrackId mismatch: payload ${String(payload.racetrackId)} != scope ${scope.racetrackId}`);
  }
  return { valid: errors.length === 0, errors };
}

export function enrichPayloadWithScope(
  scope: DataEntryScope,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...values,
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    organizationId: scope.organizationId,
    requestedBy: scope.actorId,
    actor: scope.actorId,
    actorId: scope.actorId,
  };
}

export function isDataEntryEntityKind(value: string): value is DataEntryEntityKind {
  return (dataEntryEntityKinds as readonly string[]).includes(value);
}

export { dataEntryEntityForms, fieldRulesFromDefinition };

export type DataEntryFormValues = Record<string, unknown>;

export function mergeFormValues(
  baseline: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  if (!isRecord(patch)) return { ...baseline };
  return { ...baseline, ...patch };
}

export function roleCanSubmitForm(definition: DataEntryFormDefinition, role: Role): boolean {
  return canAccessForm(definition, role) && hasAnyPermission(role, [definition.requiredPermission]);
}

export type DataEntryContractRule = ContractRule;
