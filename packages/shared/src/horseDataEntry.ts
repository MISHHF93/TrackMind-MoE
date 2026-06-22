import type { Role } from './accessControl.js';
import type { DataEntryEntityKind, DataEntryFormMode } from './dataEntryFramework.js';

export const horseDataEntrySchemaVersion = 'trackmind.horse-data-entry.v1' as const;

export type HorseDataEntrySection = 'identity' | 'operational' | 'welfare-restricted';

export type HorseDataSource =
  | 'manual-entry'
  | 'registry-import'
  | 'steward-report'
  | 'vet-system'
  | 'barn-operations'
  | 'clocker-report';

export interface HorseDataEntryWorkflow {
  entityKind: DataEntryEntityKind;
  label: string;
  shortLabel: string;
  section: HorseDataEntrySection;
  description: string;
  supportsDraft: boolean;
  sensitive: boolean;
  veterinaryRestricted?: boolean;
  allowedRoles?: readonly Role[];
}

export interface HorseTimelineEntry {
  id: string;
  at: string;
  category: 'identity' | 'ownership' | 'trainer' | 'stable' | 'eligibility' | 'transport' | 'workout' | 'welfare' | 'retirement' | 'audit';
  title: string;
  detail: string;
  actor?: string;
  source?: string;
  racetrackId?: string;
  restricted?: boolean;
}

export const horseDataSourceOptions: readonly { value: HorseDataSource; label: string }[] = [
  { value: 'manual-entry', label: 'Manual entry' },
  { value: 'registry-import', label: 'Registry import' },
  { value: 'steward-report', label: 'Steward report' },
  { value: 'vet-system', label: 'Veterinary system' },
  { value: 'barn-operations', label: 'Barn operations' },
  { value: 'clocker-report', label: 'Clocker report' },
];

export const horseDataEntryWorkflows: readonly HorseDataEntryWorkflow[] = [
  {
    entityKind: 'horse',
    label: 'Horse profile',
    shortLabel: 'Profile',
    section: 'identity',
    description: 'Registered identity — name, microchip, foaling, breed, and color.',
    supportsDraft: true,
    sensitive: true,
  },
  {
    entityKind: 'horse-ownership',
    label: 'Ownership details',
    shortLabel: 'Ownership',
    section: 'identity',
    description: 'Append ownership history with effective dates and percentage.',
    supportsDraft: true,
    sensitive: true,
  },
  {
    entityKind: 'trainer-assignment',
    label: 'Trainer assignment',
    shortLabel: 'Trainer',
    section: 'operational',
    description: 'Assign licensed trainer with effective date.',
    supportsDraft: false,
    sensitive: false,
  },
  {
    entityKind: 'stable-assignment',
    label: 'Stable assignment',
    shortLabel: 'Stable',
    section: 'operational',
    description: 'Assign barn and stall for on-track housing.',
    supportsDraft: false,
    sensitive: false,
  },
  {
    entityKind: 'race-eligibility',
    label: 'Race eligibility',
    shortLabel: 'Eligibility',
    section: 'operational',
    description: 'Steward eligibility posture — scratch status, flags, and restrictions.',
    supportsDraft: true,
    sensitive: true,
    allowedRoles: ['platform-super-admin', 'horse-operations-coordinator', 'steward', 'compliance-officer'],
  },
  {
    entityKind: 'transport-record',
    label: 'Transport record',
    shortLabel: 'Transport',
    section: 'operational',
    description: 'Log horse movement between locations with welfare checks.',
    supportsDraft: false,
    sensitive: false,
  },
  {
    entityKind: 'workout-record',
    label: 'Workout',
    shortLabel: 'Workout',
    section: 'operational',
    description: 'Record timed workout at track.',
    supportsDraft: false,
    sensitive: false,
  },
  {
    entityKind: 'welfare-observation',
    label: 'Welfare observation',
    shortLabel: 'Welfare',
    section: 'welfare-restricted',
    description: 'Structured welfare observation — score, severity, race-day impact; append-only history.',
    supportsDraft: true,
    sensitive: false,
    veterinaryRestricted: false,
  },
  {
    entityKind: 'veterinary-observation',
    label: 'Veterinary observation',
    shortLabel: 'Vet',
    section: 'welfare-restricted',
    description: 'Clinical observation with privacy scope — restricted to authorized roles; immutable history.',
    supportsDraft: true,
    sensitive: true,
    veterinaryRestricted: true,
    allowedRoles: ['platform-super-admin', 'veterinarian', 'compliance-officer'],
  },
  {
    entityKind: 'retirement-record',
    label: 'Retirement status',
    shortLabel: 'Retire',
    section: 'identity',
    description: 'Formal retirement with destination and aftercare — irreversible lifecycle change.',
    supportsDraft: true,
    sensitive: true,
  },
];

const workflowByKind = new Map(horseDataEntryWorkflows.map((workflow) => [workflow.entityKind, workflow]));

export function getHorseDataEntryWorkflow(entityKind: DataEntryEntityKind): HorseDataEntryWorkflow | undefined {
  return workflowByKind.get(entityKind);
}

export function horseWorkflowsForSection(section: HorseDataEntrySection): HorseDataEntryWorkflow[] {
  return horseDataEntryWorkflows.filter((workflow) => workflow.section === section);
}

export function isHorseVeterinaryRestrictedKind(entityKind: DataEntryEntityKind): boolean {
  return getHorseDataEntryWorkflow(entityKind)?.veterinaryRestricted === true;
}

export function requiresSensitiveOverwriteConfirmation(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
): boolean {
  if (mode !== 'edit') return false;
  const workflow = getHorseDataEntryWorkflow(entityKind);
  return workflow?.sensitive === true;
}

export function validateSensitiveOverwrite(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  if (!requiresSensitiveOverwriteConfirmation(entityKind, mode)) {
    return { valid: true, errors: [] };
  }
  if (values.confirmOverwrite !== true) {
    return { valid: false, errors: [`${entityKind}.confirmOverwrite is required to edit sensitive records`] };
  }
  return { valid: true, errors: [] };
}

export function validateRetirementConfirmation(values: Record<string, unknown>): { valid: boolean; errors: string[] } {
  if (values.confirmRetirement !== true) {
    return { valid: false, errors: ['retirement-record.confirmRetirement is required — retirement is irreversible'] };
  }
  return { valid: true, errors: [] };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function pushTimeline(
  entries: HorseTimelineEntry[],
  input: Omit<HorseTimelineEntry, 'id'> & { id?: string },
): void {
  entries.push({
    id: input.id ?? `${input.category}-${input.at}-${entries.length}`,
    ...input,
  });
}

export function buildHorseTimelineEntries(input: {
  lifecycleHistory?: readonly Record<string, unknown>[];
  ownershipHistory?: readonly Record<string, unknown>[];
  trainerHistory?: readonly Record<string, unknown>[];
  stableHistory?: readonly Record<string, unknown>[];
  auditEvents?: readonly Record<string, unknown>[];
  workouts?: readonly Record<string, unknown>[];
  transportRecords?: readonly Record<string, unknown>[];
  welfareObservations?: readonly Record<string, unknown>[];
  retirementRecord?: Record<string, unknown>;
  eligibilityUpdatedAt?: string;
}): HorseTimelineEntry[] {
  const entries: HorseTimelineEntry[] = [];

  for (const event of input.lifecycleHistory ?? []) {
    pushTimeline(entries, {
      at: String(event.timestamp ?? event.occurredAt ?? ''),
      category: 'identity',
      title: String(event.action ?? 'Lifecycle change'),
      detail: String(event.changeSummary ?? event.action ?? ''),
      actor: event.actor ? String(event.actor) : undefined,
    });
  }

  for (const row of input.ownershipHistory ?? []) {
    pushTimeline(entries, {
      at: String(row.effectiveFrom ?? ''),
      category: 'ownership',
      title: `Owner: ${String(row.ownerName ?? row.ownerId ?? '—')}`,
      detail: `${row.percentage != null ? `${row.percentage}%` : ''}`.trim() || 'Ownership recorded',
      source: Array.isArray(row.evidence) ? row.evidence.map(String).join(', ') : undefined,
    });
  }

  for (const row of input.trainerHistory ?? []) {
    pushTimeline(entries, {
      at: String(row.effectiveFrom ?? ''),
      category: 'trainer',
      title: `Trainer: ${String(row.trainerName ?? row.trainerId ?? '—')}`,
      detail: String(row.licenseStatus ?? 'assigned'),
      actor: row.trainerId ? String(row.trainerId) : undefined,
    });
  }

  for (const row of input.stableHistory ?? []) {
    pushTimeline(entries, {
      at: String(row.assignedAt ?? ''),
      category: 'stable',
      title: `Stable ${String(row.barnId ?? '—')}`,
      detail: row.stallId ? `Stall ${String(row.stallId)}` : 'Barn assignment',
      actor: row.assignedBy ? String(row.assignedBy) : undefined,
    });
  }

  for (const row of input.workouts ?? []) {
    pushTimeline(entries, {
      at: String(row.date ?? row.workedAt ?? ''),
      category: 'workout',
      title: `${row.distanceFurlongs ?? '—'}f ${String(row.surface ?? '')}`.trim(),
      detail: row.timeSeconds != null ? `${row.timeSeconds}s` : 'Workout recorded',
      source: row.source ? String(row.source) : undefined,
    });
  }

  for (const row of input.transportRecords ?? []) {
    pushTimeline(entries, {
      at: String(row.departedAt ?? ''),
      category: 'transport',
      title: `${String(row.from ?? '—')} → ${String(row.to ?? '—')}`,
      detail: Array.isArray(row.welfareChecks) ? row.welfareChecks.map(String).join('; ') : 'Transport logged',
    });
  }

  for (const row of input.welfareObservations ?? []) {
    pushTimeline(entries, {
      at: String(row.observedAt ?? ''),
      category: 'welfare',
      title: `Welfare: ${String(row.category ?? row.indicator ?? 'observation')}`,
      detail: row.score != null ? `Score ${row.score}` : String(row.notes ?? ''),
      actor: row.observerId ? String(row.observerId) : undefined,
      restricted: false,
    });
  }

  if (input.retirementRecord) {
    pushTimeline(entries, {
      at: String(input.retirementRecord.retiredAt ?? ''),
      category: 'retirement',
      title: 'Retired',
      detail: `${String(input.retirementRecord.reason ?? '')} → ${String(input.retirementRecord.destination ?? '')}`.trim(),
      restricted: true,
    });
  }

  if (input.eligibilityUpdatedAt) {
    pushTimeline(entries, {
      at: input.eligibilityUpdatedAt,
      category: 'eligibility',
      title: 'Eligibility updated',
      detail: 'Race eligibility posture changed',
    });
  }

  for (const event of input.auditEvents ?? []) {
    pushTimeline(entries, {
      at: String(event.occurredAt ?? event.timestamp ?? ''),
      category: 'audit',
      title: String(event.type ?? event.action ?? 'Audit event'),
      detail: String(event.detail ?? event.note ?? ''),
      actor: event.actorId ? String(event.actorId) : event.actor ? String(event.actor) : undefined,
    });
  }

  return entries
    .filter((entry) => entry.at && entry.at !== '—')
    .sort((left, right) => right.at.localeCompare(left.at));
}

export function canAccessHorseWorkflow(workflow: HorseDataEntryWorkflow, role: Role): boolean {
  if (!workflow.allowedRoles?.length) return true;
  return workflow.allowedRoles.includes(role);
}

export function extractHorseContextFromProfile(profile: Record<string, unknown> | undefined): {
  horseId: string;
  horseName: string;
  racetrackId?: string;
} {
  if (!profile) return { horseId: 'horse-1', horseName: 'horse-1' };
  const identity = isRecord(profile.identity) ? profile.identity : profile;
  return {
    horseId: String(identity.horseId ?? profile.horseId ?? 'horse-1'),
    horseName: String(identity.name ?? profile.name ?? identity.horseId ?? 'horse-1'),
    racetrackId: identity.racetrackId ? String(identity.racetrackId) : undefined,
  };
}
