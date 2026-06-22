import type { Permission, Role } from './accessControl.js';
import { hasPermission, normalizeRole } from './accessControl.js';
import type { KnowledgeGraphEntityKind } from './racingKnowledgeGraph.js';

export const entityPickerSchemaVersion = 'trackmind.entity-picker.v1' as const;

export type EntityPickerKind =
  | 'horse'
  | 'race'
  | 'race-day'
  | 'trainer'
  | 'jockey'
  | 'user'
  | 'incident'
  | 'facility'
  | 'approval'
  | 'policy'
  | 'kpi-definition'
  | 'compliance-evidence'
  | 'security-event'
  | 'audit-record'
  | 'federation-participant';

export const entityPickerKinds: readonly EntityPickerKind[] = [
  'horse',
  'race',
  'race-day',
  'trainer',
  'jockey',
  'user',
  'incident',
  'facility',
  'approval',
  'policy',
  'kpi-definition',
  'compliance-evidence',
  'security-event',
  'audit-record',
  'federation-participant',
];

export interface EntityPickerKindDefinition {
  kind: EntityPickerKind;
  label: string;
  pluralLabel: string;
  description: string;
  requiredPermission: Permission;
  graphKind?: KnowledgeGraphEntityKind;
  minQueryLength: number;
  browseLimit: number;
}

export const entityPickerKindDefinitions: Record<EntityPickerKind, EntityPickerKindDefinition> = {
  horse: {
    kind: 'horse',
    label: 'Horse',
    pluralLabel: 'Horses',
    description: 'Registered horses from the equine registry and knowledge graph.',
    requiredPermission: 'read:any',
    graphKind: 'horse',
    minQueryLength: 1,
    browseLimit: 12,
  },
  race: {
    kind: 'race',
    label: 'Race',
    pluralLabel: 'Races',
    description: 'Race cards and scheduled races.',
    requiredPermission: 'race:request-start',
    graphKind: 'race',
    minQueryLength: 1,
    browseLimit: 12,
  },
  'race-day': {
    kind: 'race-day',
    label: 'Race day',
    pluralLabel: 'Race days',
    description: 'Calendar race days with meet and post-time context.',
    requiredPermission: 'read:any',
    minQueryLength: 1,
    browseLimit: 12,
  },
  trainer: {
    kind: 'trainer',
    label: 'Trainer',
    pluralLabel: 'Trainers',
    description: 'Licensed trainers with compliance posture.',
    requiredPermission: 'identity:read',
    graphKind: 'trainer',
    minQueryLength: 1,
    browseLimit: 12,
  },
  jockey: {
    kind: 'jockey',
    label: 'Jockey',
    pluralLabel: 'Jockeys',
    description: 'Licensed jockeys and race assignments.',
    requiredPermission: 'race:request-start',
    graphKind: 'jockey',
    minQueryLength: 1,
    browseLimit: 12,
  },
  user: {
    kind: 'user',
    label: 'User',
    pluralLabel: 'Users',
    description: 'Platform users scoped to the active tenant.',
    requiredPermission: 'identity:read',
    minQueryLength: 1,
    browseLimit: 12,
  },
  incident: {
    kind: 'incident',
    label: 'Incident',
    pluralLabel: 'Incidents',
    description: 'Security, steward, and welfare incidents.',
    requiredPermission: 'read:any',
    graphKind: 'incident',
    minQueryLength: 1,
    browseLimit: 12,
  },
  facility: {
    kind: 'facility',
    label: 'Facility',
    pluralLabel: 'Facilities',
    description: 'RACR-backed facility and maintenance assets.',
    requiredPermission: 'track:readings',
    graphKind: 'facility',
    minQueryLength: 1,
    browseLimit: 12,
  },
  approval: {
    kind: 'approval',
    label: 'Approval',
    pluralLabel: 'Approvals',
    description: 'Centralized approval requests for protected actions.',
    requiredPermission: 'read:any',
    graphKind: 'approval',
    minQueryLength: 1,
    browseLimit: 12,
  },
  policy: {
    kind: 'policy',
    label: 'Policy',
    pluralLabel: 'Policies',
    description: 'Compliance controls and racing data license policies.',
    requiredPermission: 'read:any',
    minQueryLength: 1,
    browseLimit: 12,
  },
  'kpi-definition': {
    kind: 'kpi-definition',
    label: 'KPI definition',
    pluralLabel: 'KPI definitions',
    description: 'KPI registry entries and threshold definitions.',
    requiredPermission: 'kpi:read',
    graphKind: 'kpi',
    minQueryLength: 1,
    browseLimit: 12,
  },
  'compliance-evidence': {
    kind: 'compliance-evidence',
    label: 'Compliance evidence',
    pluralLabel: 'Compliance evidence',
    description: 'Evidence records linked to controls and frameworks.',
    requiredPermission: 'compliance:audit',
    minQueryLength: 1,
    browseLimit: 12,
  },
  'security-event': {
    kind: 'security-event',
    label: 'Security event',
    pluralLabel: 'Security events',
    description: 'Security operations events and access incidents.',
    requiredPermission: 'security:read',
    minQueryLength: 1,
    browseLimit: 12,
  },
  'audit-record': {
    kind: 'audit-record',
    label: 'Audit record',
    pluralLabel: 'Audit records',
    description: 'Immutable audit trail entries for cross-reference.',
    requiredPermission: 'audit:read',
    minQueryLength: 1,
    browseLimit: 12,
  },
  'federation-participant': {
    kind: 'federation-participant',
    label: 'Federation participant',
    pluralLabel: 'Federation participants',
    description: 'Federation cohort tracks and participant metadata.',
    requiredPermission: 'compliance:report',
    minQueryLength: 1,
    browseLimit: 12,
  },
};

export interface EntityPickerItem {
  id: string;
  kind: EntityPickerKind;
  label: string;
  subtitle?: string;
  status?: string;
  path?: string;
  tenantId: string;
  racetrackId: string;
  score: number;
}

export interface EntityPickerSearchResponse {
  schemaVersion: typeof entityPickerSchemaVersion;
  kind: EntityPickerKind;
  query: string;
  results: EntityPickerItem[];
  total: number;
  generatedAt: string;
  permissionDenied?: boolean;
}

export interface EntityPickerKindsResponse {
  schemaVersion: typeof entityPickerSchemaVersion;
  kinds: Array<Pick<EntityPickerKindDefinition, 'kind' | 'label' | 'pluralLabel' | 'description'>>;
  generatedAt: string;
}

export function isEntityPickerKind(value: string): value is EntityPickerKind {
  return (entityPickerKinds as readonly string[]).includes(value);
}

export function getEntityPickerKindDefinition(kind: EntityPickerKind): EntityPickerKindDefinition {
  const definition = entityPickerKindDefinitions[kind];
  if (!definition) throw new Error(`Unknown entity picker kind ${kind}`);
  return definition;
}

export function canAccessEntityPickerKind(kind: EntityPickerKind, role: Role): boolean {
  const canonical = normalizeRole(role);
  if (!canonical) return false;
  const definition = getEntityPickerKindDefinition(kind);
  return hasPermission(canonical, definition.requiredPermission);
}

export function listAccessibleEntityPickerKinds(role: Role): EntityPickerKindDefinition[] {
  return entityPickerKinds
    .filter((kind) => canAccessEntityPickerKind(kind, role))
    .map((kind) => getEntityPickerKindDefinition(kind));
}

export function entityPickerRecentStorageKey(
  kind: EntityPickerKind,
  tenantId: string,
  racetrackId: string,
): string {
  return `trackmind.entity-picker.recent:${tenantId}:${racetrackId}:${kind}`;
}

export function scoreEntityPickerMatch(
  fields: Array<string | undefined>,
  query: string,
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0.5;
  let score = 0;
  for (const [index, field] of fields.entries()) {
    if (!field) continue;
    const normalized = field.toLowerCase();
    if (normalized === q) score += 1 - index * 0.05;
    else if (normalized.startsWith(q)) score += 0.85 - index * 0.05;
    else if (normalized.includes(q)) score += 0.65 - index * 0.05;
  }
  return Number(score.toFixed(3));
}

export function filterEntityPickerItems(
  items: EntityPickerItem[],
  query: string,
  limit = 20,
): EntityPickerItem[] {
  const q = query.trim().toLowerCase();
  const scored = items.map((item) => ({
    item,
    score: q
      ? scoreEntityPickerMatch([item.label, item.id, item.subtitle, item.status], q)
      : item.score,
  })).filter((entry) => (q ? entry.score > 0 : true));

  return scored
    .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label))
    .slice(0, limit)
    .map((entry) => ({ ...entry.item, score: entry.score }));
}

export function mapGraphKindToEntityPickerKind(kind: KnowledgeGraphEntityKind): EntityPickerKind | undefined {
  if (kind === 'kpi') return 'kpi-definition';
  if (kind === 'audit' || kind === 'recommendation') return undefined;
  if (kind === 'facility') return 'facility';
  if ((entityPickerKinds as readonly string[]).includes(kind)) return kind as EntityPickerKind;
  return undefined;
}

const auditSubjectEntityPickerKinds: Record<string, EntityPickerKind> = {
  horse: 'horse',
  race: 'race',
  'race-day': 'race-day',
  incident: 'incident',
  approval: 'approval',
  facility: 'facility',
  facilities: 'facility',
  compliance: 'policy',
  'security-event': 'security-event',
  user: 'user',
  trainer: 'trainer',
  jockey: 'jockey',
};

export function entityPickerKindForAuditSubject(entityKind: string): EntityPickerKind | undefined {
  return auditSubjectEntityPickerKinds[entityKind];
}

const entityReferenceFieldBindings: Record<string, EntityPickerKind> = {
  horseId: 'horse',
  raceId: 'race',
  raceCardId: 'race',
  raceDayId: 'race-day',
  trainerId: 'trainer',
  jockeyId: 'jockey',
  userId: 'user',
  actorId: 'user',
  assigneeId: 'user',
  incidentId: 'incident',
  relatedIncidentId: 'incident',
  assetId: 'facility',
  approvalId: 'approval',
  policyId: 'policy',
  kpiId: 'kpi-definition',
  controlId: 'policy',
  evidenceId: 'compliance-evidence',
  securityEventId: 'security-event',
  auditRecordId: 'audit-record',
  cohortId: 'federation-participant',
};

export function entityPickerKindForField(
  path: string,
  formValues?: Record<string, unknown>,
): EntityPickerKind | undefined {
  const direct = entityReferenceFieldBindings[path];
  if (direct) return direct;
  if (path === 'entityId') {
    const subject = String(formValues?.entityKind ?? formValues?.subjectKind ?? '').trim();
    if (subject) return entityPickerKindForAuditSubject(subject);
  }
  return undefined;
}
