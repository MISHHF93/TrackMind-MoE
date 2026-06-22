import type { Role } from './accessControl.js';
import {
  complianceEvidenceLinkTargetKinds,
  parseComplianceEvidenceLinkTargets,
  parseComplianceEvidenceUriRefs,
  type ComplianceEvidenceLinkTarget,
} from './complianceEvidenceEntry.js';
import type { DataEntryFieldDefinition, DataEntryFieldOption } from './dataEntryFramework.js';
import { entityPickerKindForField } from './entityPicker.js';
import { inlineStatusOptionSets } from './inlineEditPolicy.js';

export const operationalFormComponentsSchemaVersion = 'trackmind.operational-form-components.v1' as const;

export type OperationalFormComponentKind =
  | 'text-input'
  | 'text-area'
  | 'searchable-select'
  | 'multi-select'
  | 'date-time'
  | 'status-picker'
  | 'severity-picker'
  | 'approval-requirement'
  | 'tenant-racetrack'
  | 'notes-editor'
  | 'attachment-placeholder'
  | 'evidence-link-selector'
  | 'audit-reference-viewer'
  | 'entity-relationship';

export type OperationalFormTone = 'neutral' | 'nominal' | 'watch' | 'warning' | 'critical';

export interface OperationalFormOption {
  value: string;
  label: string;
  tone?: OperationalFormTone;
  approvalGoverned?: boolean;
  destructive?: boolean;
}

export const operationalSeverityOptions: readonly OperationalFormOption[] = [
  { value: 'low', label: 'Low', tone: 'neutral' },
  { value: 'medium', label: 'Medium', tone: 'watch' },
  { value: 'high', label: 'High', tone: 'warning' },
  { value: 'critical', label: 'Critical', tone: 'critical' },
];

export const operationalApprovalRequirementOptions: readonly OperationalFormOption[] = [
  { value: 'none', label: 'No approval required', tone: 'nominal' },
  { value: 'optional', label: 'Approval recommended', tone: 'watch' },
  { value: 'required', label: 'Approval required before action', tone: 'warning' },
  { value: 'dual-control', label: 'Dual-control approval required', tone: 'critical', approvalGoverned: true },
];

export const operationalStatusOptionSets = {
  ...inlineStatusOptionSets,
  genericLifecycle: [
    { value: 'draft', label: 'Draft', tone: 'neutral' as const },
    { value: 'active', label: 'Active', tone: 'nominal' as const },
    { value: 'on-hold', label: 'On hold', tone: 'watch' as const },
    { value: 'closed', label: 'Closed', tone: 'neutral' as const, destructive: true },
  ],
  incidentStatus: [
    { value: 'open', label: 'Open', tone: 'watch' as const },
    { value: 'investigating', label: 'Investigating', tone: 'neutral' as const },
    { value: 'escalated', label: 'Escalated', tone: 'critical' as const, approvalGoverned: true },
    { value: 'resolved', label: 'Resolved', tone: 'nominal' as const },
    { value: 'closed', label: 'Closed', tone: 'neutral' as const, destructive: true },
  ],
} as const;

export type OperationalStatusOptionSetId = keyof typeof operationalStatusOptionSets;

/** Roles permitted to override tenant/racetrack scope in operational forms. */
export const operationalScopeOverrideRoles: readonly Role[] = [
  'admin',
  'compliance-officer',
  'operations-admin',
];

const notesFieldPaths = new Set(['notes', 'reason', 'summary', 'description', 'comment', 'body']);
const evidenceFieldPaths = new Set(['evidenceRefs', 'evidence', 'attachments']);
const auditFieldPaths = new Set(['auditRecordId', 'auditEventId', 'auditReference', 'integrityReference']);
const scopeFieldPaths = new Set(['tenantId', 'racetrackId', 'organizationId']);
const multiSelectFieldPaths = new Set(['frameworkIds', 'involvedEntities', 'eligibilityFlags', 'raceRestrictions', 'welfareChecks']);

export function canOverrideOperationalScope(role: Role): boolean {
  return (operationalScopeOverrideRoles as readonly string[]).includes(role);
}

export function operationalStatusOptionsForField(field: DataEntryFieldDefinition): readonly OperationalFormOption[] {
  if (field.path === 'reviewStatus') return operationalStatusOptionSets.complianceEvidenceReviewStatus;
  if (field.path === 'priority') return operationalStatusOptionSets.facilitiesWorkOrderPriority;
  if (field.path === 'status' && field.options?.length === operationalStatusOptionSets.securityIncidentStatus.length) {
    return operationalStatusOptionSets.securityIncidentStatus;
  }
  if (field.options?.length) {
    return field.options.map((option) => ({ value: option.value, label: option.label }));
  }
  return operationalStatusOptionSets.genericLifecycle;
}

export function operationalStatusOptionSetIdForField(field: DataEntryFieldDefinition): OperationalStatusOptionSetId | undefined {
  if (field.path === 'reviewStatus') return 'complianceEvidenceReviewStatus';
  if (field.path === 'priority') return 'facilitiesWorkOrderPriority';
  if (field.path === 'status') return 'securityIncidentStatus';
  return undefined;
}

export function fieldOptionsToOperationalOptions(options: readonly DataEntryFieldOption[] | undefined): OperationalFormOption[] {
  return (options ?? []).map((option) => ({ value: option.value, label: option.label }));
}

export function resolveOperationalFormComponentKind(
  field: DataEntryFieldDefinition,
  values?: Record<string, unknown>,
): OperationalFormComponentKind {
  if (entityPickerKindForField(field.path, values)) return 'entity-relationship';
  if (scopeFieldPaths.has(field.path)) return 'tenant-racetrack';
  if (field.path === 'severity' || field.path === 'riskLevel') return 'severity-picker';
  if (field.path === 'approvalRequired' || field.path === 'requiresApproval') return 'approval-requirement';
  if (field.path === 'status' || field.path === 'reviewStatus' || field.path === 'priority') return 'status-picker';
  if (auditFieldPaths.has(field.path) && field.readOnly) return 'audit-reference-viewer';
  if (field.path === 'linkTargets') return 'evidence-link-selector';
  if (evidenceFieldPaths.has(field.path)) return 'attachment-placeholder';
  if (notesFieldPaths.has(field.path) && field.type === 'textarea') return 'notes-editor';
  if (multiSelectFieldPaths.has(field.path)) return 'multi-select';
  if (field.type === 'textarea') return 'text-area';
  if (field.type === 'select' && (field.options?.length ?? 0) > 6) return 'searchable-select';
  if (field.type === 'select') return 'searchable-select';
  if (field.type === 'date' || field.type === 'datetime-local') return 'date-time';
  return 'text-input';
}

export function parseOperationalMultiSelectValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

export function serializeOperationalMultiSelectValue(values: string[]): string {
  return values.join('\n');
}

export function parseOperationalEvidenceRefs(value: unknown): string[] {
  return parseComplianceEvidenceUriRefs(value);
}

export function parseOperationalEvidenceLinks(value: unknown): ComplianceEvidenceLinkTarget[] {
  return parseComplianceEvidenceLinkTargets(value);
}

export function serializeOperationalEvidenceLinks(targets: ComplianceEvidenceLinkTarget[]): string {
  return targets
    .map((target) => {
      const label = target.label ? `:${target.label}` : '';
      return `${target.targetKind}:${target.targetId}${label}`;
    })
    .join('\n');
}

export function operationalEvidenceLinkKindOptions(): readonly { kind: string; label: string }[] {
  return complianceEvidenceLinkTargetKinds.map((entry) => ({ kind: entry.kind, label: entry.label }));
}

export interface OperationalAuditReference {
  id: string;
  action?: string;
  actor?: string;
  timestamp?: string;
  integrityHash?: string;
}

export function parseOperationalAuditReference(value: unknown): OperationalAuditReference | null {
  if (typeof value === 'object' && value && 'id' in value) {
    const record = value as Record<string, unknown>;
    const id = String(record.id ?? record.auditEventId ?? record.auditRecordId ?? '');
    if (!id) return null;
    return {
      id,
      action: record.action ? String(record.action) : undefined,
      actor: record.actor ? String(record.actor) : undefined,
      timestamp: record.timestamp ? String(record.timestamp) : undefined,
      integrityHash: record.integrityHash ? String(record.integrityHash) : record.hash ? String(record.hash) : undefined,
    };
  }
  if (typeof value === 'string' && value.trim()) {
    return { id: value.trim() };
  }
  return null;
}

const compositeOperationalKinds = new Set<OperationalFormComponentKind>([
  'status-picker',
  'severity-picker',
  'approval-requirement',
  'multi-select',
  'entity-relationship',
  'tenant-racetrack',
  'audit-reference-viewer',
  'evidence-link-selector',
  'attachment-placeholder',
]);

export function isCompositeOperationalField(field: DataEntryFieldDefinition): boolean {
  return compositeOperationalKinds.has(resolveOperationalFormComponentKind(field));
}

export function normalizeApprovalRequirementValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'required' : 'none';
  const normalized = String(value ?? 'none');
  if (operationalApprovalRequirementOptions.some((option) => option.value === normalized)) return normalized;
  return value === true || normalized === 'true' ? 'required' : 'none';
}

export function approvalRequirementToBoolean(value: unknown): boolean {
  const normalized = normalizeApprovalRequirementValue(value);
  return normalized === 'required' || normalized === 'dual-control';
}

