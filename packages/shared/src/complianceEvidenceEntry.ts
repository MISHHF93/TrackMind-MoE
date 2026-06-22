import type { DataEntryEntityKind, DataEntryFormMode } from './dataEntryFramework.js';

export const complianceEvidenceEntrySchemaVersion = 'trackmind.compliance-evidence-entry.v1' as const;

export type ComplianceEvidenceEntryMode = 'quick' | 'full';

export type ComplianceEvidenceReviewStatus =
  | 'draft'
  | 'submitted'
  | 'pending-review'
  | 'approved'
  | 'rejected'
  | 'archived';

export type ComplianceEvidenceType =
  | 'document'
  | 'screenshot'
  | 'log-export'
  | 'approval-record'
  | 'audit-trail'
  | 'sensor-capture'
  | 'policy-attestation'
  | 'workflow-artifact'
  | 'other';

export type ComplianceEvidenceDomain =
  | 'security'
  | 'operations'
  | 'equine-welfare'
  | 'facilities'
  | 'finance'
  | 'governance'
  | 'racing-integrity'
  | 'ai-governance'
  | 'regulatory';

export type ComplianceEvidenceLinkTargetKind =
  | 'incident'
  | 'approval'
  | 'control'
  | 'audit'
  | 'kpi-definition'
  | 'regulatory-workflow';

export interface ComplianceEvidenceLinkTarget {
  targetKind: ComplianceEvidenceLinkTargetKind;
  targetId: string;
  label?: string;
}

export interface ComplianceEvidenceFrameworkOption {
  id: string;
  label: string;
}

export const complianceEvidenceFrameworkOptions: readonly ComplianceEvidenceFrameworkOption[] = [
  { id: 'ISO-42001', label: 'ISO 42001 AI management' },
  { id: 'ISO-27001', label: 'ISO 27001 security' },
  { id: 'ISO-27701', label: 'ISO 27701 privacy' },
  { id: 'ISO-31000', label: 'ISO 31000 risk' },
  { id: 'ISO-22301', label: 'ISO 22301 continuity' },
  { id: 'SOC-2', label: 'SOC 2 trust services' },
  { id: 'PCI-DSS', label: 'PCI DSS payments' },
  { id: 'HISA', label: 'HISA racing integrity' },
  { id: 'ARCI', label: 'ARCI model rules' },
  { id: 'LOCAL-RACING-COMMISSION', label: 'Local racing commission' },
];

export const complianceEvidenceDomainOptions: readonly { value: ComplianceEvidenceDomain; label: string }[] = [
  { value: 'governance', label: 'Governance & compliance' },
  { value: 'security', label: 'Security operations' },
  { value: 'operations', label: 'Race-day operations' },
  { value: 'equine-welfare', label: 'Equine welfare' },
  { value: 'facilities', label: 'Facilities & maintenance' },
  { value: 'finance', label: 'Finance & payments' },
  { value: 'racing-integrity', label: 'Racing integrity' },
  { value: 'ai-governance', label: 'AI governance' },
  { value: 'regulatory', label: 'Regulatory filing' },
];

export const complianceEvidenceTypeOptions: readonly { value: ComplianceEvidenceType; label: string }[] = [
  { value: 'document', label: 'Document / report' },
  { value: 'screenshot', label: 'Screenshot / capture' },
  { value: 'log-export', label: 'Log export' },
  { value: 'approval-record', label: 'Approval record' },
  { value: 'audit-trail', label: 'Audit trail extract' },
  { value: 'sensor-capture', label: 'Sensor / telemetry capture' },
  { value: 'policy-attestation', label: 'Policy attestation' },
  { value: 'workflow-artifact', label: 'Workflow artifact' },
  { value: 'other', label: 'Other structured evidence' },
];

export const complianceEvidenceLinkTargetKinds: readonly { kind: ComplianceEvidenceLinkTargetKind; label: string; description: string }[] = [
  { kind: 'incident', label: 'Incident', description: 'Platform or security incident record.' },
  { kind: 'approval', label: 'Approval', description: 'Centralized approval request.' },
  { kind: 'control', label: 'Control', description: 'Compliance control library entry.' },
  { kind: 'audit', label: 'Audit', description: 'Immutable audit ledger record.' },
  { kind: 'kpi-definition', label: 'KPI definition', description: 'KPI threshold or definition artifact.' },
  { kind: 'regulatory-workflow', label: 'Regulatory workflow', description: 'Compliance or accreditation workflow instance.' },
];

export interface ComplianceEvidenceIntakePayload {
  title: string;
  controlId: string;
  frameworkIds?: string[];
  policyCitation?: string;
  domain: ComplianceEvidenceDomain;
  evidenceType: ComplianceEvidenceType;
  source: string;
  notes: string;
  reviewStatus: ComplianceEvidenceReviewStatus;
  approvalRequestId?: string;
  auditRecordId?: string;
  linkTargets: ComplianceEvidenceLinkTarget[];
  retentionPolicy: string;
  retainedUntil?: string;
  legalHold?: boolean;
  uri?: string;
  evidenceRefs?: string[];
  startReviewWorkflow?: boolean;
  reportedBy: string;
  reason: string;
  entryMode: ComplianceEvidenceEntryMode;
}

export interface ComplianceEvidenceEntryValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export const quickComplianceEvidenceRequiredFields = [
  'title', 'controlId', 'domain', 'evidenceType', 'source', 'notes', 'reason',
] as const;

export const fullComplianceEvidenceRequiredFields = [
  ...quickComplianceEvidenceRequiredFields,
  'reviewStatus', 'retentionPolicy',
] as const;

const domainSet = new Set(complianceEvidenceDomainOptions.map((option) => option.value));
const typeSet = new Set(complianceEvidenceTypeOptions.map((option) => option.value));
const linkKindSet = new Set(complianceEvidenceLinkTargetKinds.map((entry) => entry.kind));
const reviewStatuses: ComplianceEvidenceReviewStatus[] = ['draft', 'submitted', 'pending-review', 'approved', 'rejected', 'archived'];

export function complianceEvidenceEntityKind(): DataEntryEntityKind {
  return 'compliance-evidence';
}

export function parseComplianceEvidenceLinkTargets(value: unknown): ComplianceEvidenceLinkTarget[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry !== 'object' || !entry) return [];
      const targetKind = String((entry as { targetKind?: string }).targetKind ?? '') as ComplianceEvidenceLinkTargetKind;
      const targetId = String((entry as { targetId?: string }).targetId ?? '');
      if (!targetKind || !targetId) return [];
      return [{ targetKind, targetId, label: (entry as { label?: string }).label ? String((entry as { label?: string }).label) : undefined }];
    });
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split('\n').flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) return [];
    const [kind, id, ...labelParts] = trimmed.split(':');
    const targetKind = kind as ComplianceEvidenceLinkTargetKind;
    const targetId = id ?? '';
    if (!targetKind || !targetId) return [];
    return [{ targetKind, targetId, label: labelParts.length ? labelParts.join(':') : undefined }];
  }).filter((target) => linkKindSet.has(target.targetKind));
}

export function parseFrameworkIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

export function parseComplianceEvidenceUriRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

export function fieldsForComplianceEvidenceEntryMode(mode: ComplianceEvidenceEntryMode): string[] {
  if (mode === 'quick') {
    return ['title', 'controlId', 'domain', 'evidenceType', 'source', 'linkTargets', 'notes', 'reason'];
  }
  return [
    'title', 'controlId', 'frameworkIds', 'policyCitation', 'domain', 'evidenceType', 'source',
    'linkTargets', 'notes', 'reviewStatus', 'approvalRequestId', 'auditRecordId',
    'retentionPolicy', 'retainedUntil', 'legalHold', 'evidenceRefs', 'startReviewWorkflow', 'reason',
  ];
}

export function validateComplianceEvidenceEntry(
  values: Record<string, unknown>,
  mode: DataEntryFormMode = 'create',
  entryMode: ComplianceEvidenceEntryMode = 'quick',
): { valid: boolean; errors: string[]; issues: ComplianceEvidenceEntryValidationIssue[] } {
  const issues: ComplianceEvidenceEntryValidationIssue[] = [];

  if (mode === 'edit') {
    issues.push({ code: 'immutable', message: 'Compliance evidence records are append-only — submit a new entry to extend the chain.' });
  }

  const required = entryMode === 'full' ? fullComplianceEvidenceRequiredFields : quickComplianceEvidenceRequiredFields;
  for (const field of required) {
    const value = values[field];
    if (value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
      issues.push({ code: 'required', message: `${field} is required`, field });
    }
  }

  const domain = String(values.domain ?? '');
  if (domain && !domainSet.has(domain as ComplianceEvidenceDomain)) {
    issues.push({ code: 'invalid-domain', message: 'domain must be a supported compliance evidence domain', field: 'domain' });
  }

  const evidenceType = String(values.evidenceType ?? '');
  if (evidenceType && !typeSet.has(evidenceType as ComplianceEvidenceType)) {
    issues.push({ code: 'invalid-type', message: 'evidenceType must be a supported evidence type', field: 'evidenceType' });
  }

  const reviewStatus = String(values.reviewStatus ?? 'submitted');
  if (entryMode === 'full' && reviewStatus && !reviewStatuses.includes(reviewStatus as ComplianceEvidenceReviewStatus)) {
    issues.push({ code: 'invalid-review-status', message: 'reviewStatus must be a supported review status', field: 'reviewStatus' });
  }

  if (values.notes && String(values.notes).length > 0 && String(values.notes).length < 8) {
    issues.push({ code: 'notes-short', message: 'notes must be at least 8 characters', field: 'notes' });
  }

  const linkTargets = parseComplianceEvidenceLinkTargets(values.linkTargets);
  for (const target of linkTargets) {
    if (!linkKindSet.has(target.targetKind)) {
      issues.push({ code: 'invalid-link', message: `Unsupported link target kind ${target.targetKind}`, field: 'linkTargets' });
    }
  }

  const errors = issues.map((issue) => issue.message);
  return { valid: errors.length === 0, errors, issues };
}

export function buildComplianceEvidenceIntakePayload(
  scope: { actorId: string },
  values: Record<string, unknown>,
  entryMode: ComplianceEvidenceEntryMode = 'quick',
): ComplianceEvidenceIntakePayload {
  const validation = validateComplianceEvidenceEntry(values, 'create', entryMode);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const linkTargets = parseComplianceEvidenceLinkTargets(values.linkTargets);
  const frameworkIds = parseFrameworkIds(values.frameworkIds ?? values.frameworkId);
  const evidenceRefs = parseComplianceEvidenceUriRefs(values.evidenceRefs);
  const uri = values.uri
    ? String(values.uri)
    : evidenceRefs[0]
      ?? (linkTargets[0] ? `evidence://${linkTargets[0].targetKind}/${linkTargets[0].targetId}` : `evidence://compliance/${Date.now()}`);

  return {
    title: String(values.title ?? '').trim(),
    controlId: String(values.controlId ?? ''),
    frameworkIds: frameworkIds.length ? frameworkIds : undefined,
    policyCitation: values.policyCitation ? String(values.policyCitation) : undefined,
    domain: String(values.domain ?? 'governance') as ComplianceEvidenceDomain,
    evidenceType: String(values.evidenceType ?? 'document') as ComplianceEvidenceType,
    source: String(values.source ?? ''),
    notes: String(values.notes ?? ''),
    reviewStatus: (values.reviewStatus ? String(values.reviewStatus) : entryMode === 'quick' ? 'submitted' : 'pending-review') as ComplianceEvidenceReviewStatus,
    approvalRequestId: values.approvalRequestId ? String(values.approvalRequestId) : undefined,
    auditRecordId: values.auditRecordId ? String(values.auditRecordId) : undefined,
    linkTargets,
    retentionPolicy: String(values.retentionPolicy ?? 'regulated-records-7y'),
    retainedUntil: values.retainedUntil ? String(values.retainedUntil) : undefined,
    legalHold: values.legalHold === true,
    uri,
    evidenceRefs,
    startReviewWorkflow: values.startReviewWorkflow === true || values.reviewStatus === 'pending-review',
    reportedBy: String(values.reportedBy ?? scope.actorId),
    reason: String(values.reason ?? 'Compliance evidence recorded'),
    entryMode,
  };
}

export function   defaultComplianceEvidenceSeed(
  controlId: string,
  actorId: string,
  frameworkId = 'ISO-27001',
): Record<string, unknown> {
  return {
    entryMode: 'quick' as ComplianceEvidenceEntryMode,
    title: '',
    controlId: controlId || 'ctrl-security-audit',
    frameworkIds: frameworkId,
    policyCitation: '',
    domain: 'governance' as ComplianceEvidenceDomain,
    evidenceType: 'document' as ComplianceEvidenceType,
    source: '',
    notes: '',
    reviewStatus: 'submitted' as ComplianceEvidenceReviewStatus,
    approvalRequestId: '',
    auditRecordId: '',
    linkTargets: '',
    retentionPolicy: 'regulated-records-7y',
    retainedUntil: new Date(Date.now() + 2555 * 86_400_000).toISOString().slice(0, 10),
    legalHold: false,
    evidenceRefs: '',
    uri: '',
    startReviewWorkflow: true,
    reportedBy: actorId,
    reason: '',
  };
}

export function formatLinkTargetLine(target: ComplianceEvidenceLinkTarget): string {
  return target.label ? `${target.targetKind}:${target.targetId}:${target.label}` : `${target.targetKind}:${target.targetId}`;
}
