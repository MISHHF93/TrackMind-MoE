import type { DataEntryEntityKind, DataEntryFormMode } from './dataEntryFramework.js';

export const facilitiesEntryWorkflowsSchemaVersion = 'trackmind.facilities-entry.v1' as const;

export type FacilityAssetCategory =
  | 'barn'
  | 'paddock'
  | 'track-surface'
  | 'gate'
  | 'utilities'
  | 'venue-infrastructure';

export type FacilitiesInspectionType =
  | 'routine'
  | 'safety'
  | 'regulatory'
  | 'pre-race'
  | 'follow-up'
  | 'weather-event';

export type FacilitiesEntryMode = 'quick' | 'full';

export type FacilitiesUrgency = 'low' | 'normal' | 'high' | 'critical';

export interface FacilityAssetPreset {
  category: FacilityAssetCategory;
  label: string;
  shortLabel: string;
  description: string;
  exampleAssetIds: readonly string[];
  defaultInspectionType: FacilitiesInspectionType;
}

export const facilityAssetPresets: readonly FacilityAssetPreset[] = [
  { category: 'barn', label: 'Barn & backstretch', shortLabel: 'Barn', description: 'Stalls, aisles, wash racks, and barn utilities.', exampleAssetIds: ['BARN_BLOCK_A', 'GRANDSTAND_HVAC_01'], defaultInspectionType: 'routine' },
  { category: 'paddock', label: 'Paddock & saddling', shortLabel: 'Paddock', description: 'Paddock footing, saddling barn access, and horse paths.', exampleAssetIds: ['PADDOCK_FOOTING_01'], defaultInspectionType: 'pre-race' },
  { category: 'track-surface', label: 'Track surface', shortLabel: 'Surface', description: 'Racing surface, drainage, and maintenance equipment zones.', exampleAssetIds: ['TRACK_SURFACE_MAIN'], defaultInspectionType: 'pre-race' },
  { category: 'gate', label: 'Starting gate', shortLabel: 'Gate', description: 'Gate position, locks, telemetry, and approach surface.', exampleAssetIds: ['START_GATE_01'], defaultInspectionType: 'safety' },
  { category: 'utilities', label: 'Utilities', shortLabel: 'Utilities', description: 'Power, HVAC, water, and life-safety systems.', exampleAssetIds: ['GRANDSTAND_HVAC_01', 'PATRON_ELEVATOR_A'], defaultInspectionType: 'routine' },
  { category: 'venue-infrastructure', label: 'Venue infrastructure', shortLabel: 'Venue', description: 'Grandstand, elevators, concessions, and patron areas.', exampleAssetIds: ['PATRON_ELEVATOR_A', 'GRANDSTAND_HVAC_01'], defaultInspectionType: 'regulatory' },
];

const presetMap = new Map(facilityAssetPresets.map((preset) => [preset.category, preset]));

export function getFacilityAssetPreset(category: FacilityAssetCategory): FacilityAssetPreset {
  const preset = presetMap.get(category);
  if (!preset) throw new Error(`Unknown facility category ${category}`);
  return preset;
}

export const facilitiesInspectionTypeOptions: readonly { value: FacilitiesInspectionType; label: string }[] = [
  { value: 'routine', label: 'Routine walkthrough' },
  { value: 'safety', label: 'Safety inspection' },
  { value: 'regulatory', label: 'Regulatory / compliance' },
  { value: 'pre-race', label: 'Pre-race readiness' },
  { value: 'follow-up', label: 'Follow-up verification' },
  { value: 'weather-event', label: 'Post weather event' },
];

export interface FacilitiesEntryValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export const quickInspectionRequiredFields = [
  'assetId', 'inspectionType', 'conditionRating', 'notes', 'reason',
] as const;

export const fullInspectionRequiredFields = [
  ...quickInspectionRequiredFields,
  'nextInspectionAt',
  'maintenanceOwner',
] as const;

export const quickMaintenanceRequiredFields = [
  'assetId', 'title', 'urgency', 'notes', 'reason',
] as const;

export const fullMaintenanceRequiredFields = [
  ...quickMaintenanceRequiredFields,
  'scheduledFor',
  'maintenanceOwner',
] as const;

export function facilitiesInspectionEntityKind(): DataEntryEntityKind {
  return 'facilities-inspection';
}

export function facilitiesMaintenanceEntityKind(): DataEntryEntityKind {
  return 'facilities-maintenance';
}

export function conditionRatingToScore(rating: unknown): number {
  const value = Number(rating);
  if (Number.isNaN(value)) return 70;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function urgencyToPriority(urgency: unknown): FacilitiesUrgency {
  const value = String(urgency ?? 'normal');
  if (value === 'low' || value === 'normal' || value === 'high' || value === 'critical') return value;
  return 'normal';
}

export function parseIssuesFound(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

export function parseAttachmentRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

export function validateFacilitiesInspectionEntry(
  values: Record<string, unknown>,
  mode: DataEntryFormMode = 'create',
  entryMode: FacilitiesEntryMode = 'quick',
): { valid: boolean; errors: string[]; issues: FacilitiesEntryValidationIssue[] } {
  const issues: FacilitiesEntryValidationIssue[] = [];

  if (mode === 'edit') {
    issues.push({ code: 'immutable', message: 'Inspection records are append-only — submit a new inspection to update posture.' });
  }

  const required = entryMode === 'full' ? fullInspectionRequiredFields : quickInspectionRequiredFields;
  for (const field of required) {
    const value = values[field];
    if (value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
      issues.push({ code: 'required', message: `${field} is required`, field });
    }
  }

  const rating = conditionRatingToScore(values.conditionRating);
  if (values.conditionRating != null && String(values.conditionRating).trim() && (rating < 0 || rating > 100)) {
    issues.push({ code: 'rating-range', message: 'conditionRating must be between 0 and 100', field: 'conditionRating' });
  }

  if (values.notes && String(values.notes).length > 0 && String(values.notes).length < 8 && entryMode === 'quick') {
    issues.push({ code: 'notes-short', message: 'notes must be at least 8 characters', field: 'notes' });
  }

  const errors = issues.map((issue) => issue.message);
  return { valid: errors.length === 0, errors, issues };
}

export function validateFacilitiesMaintenanceEntry(
  values: Record<string, unknown>,
  entryMode: FacilitiesEntryMode = 'quick',
): { valid: boolean; errors: string[]; issues: FacilitiesEntryValidationIssue[] } {
  const issues: FacilitiesEntryValidationIssue[] = [];
  const required = entryMode === 'full' ? fullMaintenanceRequiredFields : quickMaintenanceRequiredFields;

  for (const field of required) {
    const value = values[field];
    if (value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
      issues.push({ code: 'required', message: `${field} is required`, field });
    }
  }

  const errors = issues.map((issue) => issue.message);
  return { valid: errors.length === 0, errors, issues };
}

export function buildFacilitiesInspectionPayload(
  scope: { actorId: string },
  values: Record<string, unknown>,
  entryMode: FacilitiesEntryMode = 'quick',
): Record<string, unknown> {
  const validation = validateFacilitiesInspectionEntry(values, 'create', entryMode);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const issuesFound = parseIssuesFound(values.issuesFound);
  const attachmentRefs = parseAttachmentRefs(values.attachmentRefs);
  const score = conditionRatingToScore(values.conditionRating);
  const urgency = urgencyToPriority(values.urgency);

  return {
    assetId: String(values.assetId),
    facilityCategory: values.facilityCategory ? String(values.facilityCategory) : undefined,
    inspectionType: String(values.inspectionType ?? 'routine'),
    inspectedBy: String(values.inspectedBy ?? scope.actorId),
    conditionRating: score,
    score,
    notes: String(values.notes ?? ''),
    issuesFound,
    urgency,
    triggerWorkOrder: values.triggerWorkOrder === true || (values.workOrderTrigger === true && issuesFound.length > 0),
    attachmentRefs,
    nextInspectionAt: values.nextInspectionAt ? String(values.nextInspectionAt) : undefined,
    nextInspectionDueAt: values.nextInspectionAt ? String(values.nextInspectionAt) : undefined,
    maintenanceOwner: values.maintenanceOwner ? String(values.maintenanceOwner) : undefined,
    checklist: issuesFound.length ? ['issues-review', ...issuesFound.slice(0, 3)] : ['visual-walkthrough', 'operational-check'],
    findings: [
      String(values.notes ?? ''),
      ...issuesFound,
      ...attachmentRefs.map((ref) => `attachment:${ref}`),
    ].filter(Boolean),
    evidence: [
      'facilities-inspection-form',
      `inspection-type:${String(values.inspectionType ?? 'routine')}`,
      `entry-mode:${entryMode}`,
      ...(values.facilityCategory ? [`facility-category:${String(values.facilityCategory)}`] : []),
      ...attachmentRefs.map((ref) => `photo:${ref}`),
    ],
    reason: String(values.reason ?? 'Facilities inspection recorded'),
    entryMode,
  };
}

export function buildFacilitiesMaintenancePayload(
  scope: { actorId: string },
  values: Record<string, unknown>,
  entryMode: FacilitiesEntryMode = 'quick',
): Record<string, unknown> {
  const validation = validateFacilitiesMaintenanceEntry(values, entryMode);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const issuesFound = parseIssuesFound(values.issuesFound);
  const attachmentRefs = parseAttachmentRefs(values.attachmentRefs);
  const urgency = urgencyToPriority(values.urgency ?? values.priority);
  const dueAt = values.dueAt ?? values.scheduledFor ?? new Date(Date.now() + 86_400_000).toISOString();

  return {
    assetId: String(values.assetId),
    facilityCategory: values.facilityCategory ? String(values.facilityCategory) : undefined,
    title: String(values.title ?? 'Scheduled facility maintenance'),
    priority: urgency,
    urgency,
    notes: String(values.notes ?? ''),
    issuesFound,
    attachmentRefs,
    maintenanceOwner: values.maintenanceOwner ? String(values.maintenanceOwner) : scope.actorId,
    scheduledFor: values.scheduledFor ? String(values.scheduledFor) : undefined,
    dueAt: String(dueAt),
    tasks: issuesFound.length
      ? ['triage reported issues', ...issuesFound.slice(0, 4).map((issue) => `address: ${issue}`), 'capture return-to-service evidence']
      : ['verify lockout', 'perform maintenance', 'capture evidence'],
    evidence: [
      'facilities-maintenance-form',
      `entry-mode:${entryMode}`,
      ...(values.facilityCategory ? [`facility-category:${String(values.facilityCategory)}`] : []),
      ...attachmentRefs.map((ref) => `photo:${ref}`),
      ...issuesFound.map((issue) => `issue:${issue}`),
    ],
    operationalImpact: urgency === 'critical' || urgency === 'high' ? 'race-day-critical' : 'operational-impact',
    requestedBy: String(values.maintenanceOwner ?? scope.actorId),
    reason: String(values.reason ?? 'Maintenance entry recorded'),
    entryMode,
  };
}

export function buildFacilitiesIncidentPayload(
  scope: { actorId: string },
  values: Record<string, unknown>,
): Record<string, unknown> {
  const reason = String(values.reason ?? 'Facility incident reported');
  return {
    assetId: values.assetId ? String(values.assetId) : undefined,
    title: String(values.title ?? 'Facility incident reported'),
    severity: String(values.severity ?? 'medium'),
    description: String(values.description ?? 'Facility incident recorded for triage.'),
    evidence: ['facilities-incident-form', `audit:${reason.slice(0, 64)}`],
    reportedBy: scope.actorId,
    reason,
  };
}

export function fieldsForFacilitiesEntryMode(kind: 'inspection' | 'maintenance', mode: FacilitiesEntryMode): string[] {
  if (kind === 'inspection') {
    if (mode === 'quick') {
      return ['assetId', 'inspectionType', 'conditionRating', 'notes', 'issuesFound', 'urgency', 'triggerWorkOrder', 'reason'];
    }
    return [
      'assetId', 'inspectionType', 'conditionRating', 'notes', 'issuesFound', 'urgency', 'triggerWorkOrder',
      'attachmentRefs', 'nextInspectionAt', 'maintenanceOwner', 'reason',
    ];
  }
  if (mode === 'quick') {
    return ['assetId', 'title', 'urgency', 'notes', 'issuesFound', 'reason'];
  }
  return ['assetId', 'title', 'urgency', 'notes', 'issuesFound', 'attachmentRefs', 'scheduledFor', 'maintenanceOwner', 'reason'];
}

export function defaultFacilitiesSeed(
  kind: 'inspection' | 'maintenance',
  assetId: string,
  actorId: string,
  category: FacilityAssetCategory = 'utilities',
): Record<string, unknown> {
  const preset = getFacilityAssetPreset(category);
  const resolvedAssetId = assetId || preset.exampleAssetIds[0] || 'GRANDSTAND_HVAC_01';
  const base = {
    assetId: resolvedAssetId,
    facilityCategory: category,
    entryMode: 'quick' as FacilitiesEntryMode,
    maintenanceOwner: actorId,
    inspectedBy: actorId,
    urgency: 'normal' as FacilitiesUrgency,
    triggerWorkOrder: false,
    workOrderTrigger: false,
    conditionRating: 85,
    nextInspectionAt: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 16),
    scheduledFor: new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
    dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16),
  };
  if (kind === 'inspection') {
    return { ...base, inspectionType: preset.defaultInspectionType };
  }
  return { ...base, title: `${preset.shortLabel} maintenance` };
}

export interface FacilitiesInspectionIntakeResult {
  accepted: true;
  inspectionId: string;
  assetId: string;
  status: string;
  score: number;
  workOrderTriggered: boolean;
  workOrderId?: string;
  approvalRequired?: boolean;
  approvalRequestId?: string;
  auditId: string;
  message: string;
  mock: false;
}
