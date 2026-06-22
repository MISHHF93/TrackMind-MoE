import type { DataEntryEntityKind, DataEntryFormMode } from './dataEntryFramework.js';

export const securityEventEntrySchemaVersion = 'trackmind.security-event-entry.v1' as const;

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export type SecurityEventEntryMode = 'quick' | 'full';

export type SecurityEventEntryType =
  | 'restricted-zone'
  | 'access-issue'
  | 'suspicious-activity'
  | 'security-incident'
  | 'personnel-event'
  | 'escalation-request';

export type SecurityAccessDecision = 'granted' | 'denied' | 'review';

export interface SecurityEventTypeDefinition {
  type: SecurityEventEntryType;
  label: string;
  shortLabel: string;
  description: string;
  defaultSeverity: SecurityEventSeverity;
  requiresZone: boolean;
}

export interface SecurityZonePreset {
  zoneId: string;
  label: string;
  shortLabel: string;
  classification: 'public' | 'staff-only' | 'restricted' | 'critical';
}

export const securityEventTypes: readonly SecurityEventTypeDefinition[] = [
  { type: 'restricted-zone', label: 'Restricted zone event', shortLabel: 'Zone', description: 'Unauthorized or anomalous restricted-area access.', defaultSeverity: 'high', requiresZone: true },
  { type: 'access-issue', label: 'Access issue', shortLabel: 'Access', description: 'Credential, reader, or gate access failure.', defaultSeverity: 'medium', requiresZone: true },
  { type: 'suspicious-activity', label: 'Suspicious activity', shortLabel: 'Suspicious', description: 'Behavior or pattern requiring security review.', defaultSeverity: 'high', requiresZone: false },
  { type: 'security-incident', label: 'Security incident report', shortLabel: 'Incident', description: 'Formal security incident for triage and investigation.', defaultSeverity: 'high', requiresZone: false },
  { type: 'personnel-event', label: 'Personnel-related event', shortLabel: 'Personnel', description: 'Staff, contractor, or visitor security concern.', defaultSeverity: 'medium', requiresZone: false },
  { type: 'escalation-request', label: 'Escalation request', shortLabel: 'Escalate', description: 'Route an open incident to supervisors or incident command.', defaultSeverity: 'critical', requiresZone: false },
];

export const securityZonePresets: readonly SecurityZonePreset[] = [
  { zoneId: 'zone-backstretch-medication', label: 'Backstretch medication storage', shortLabel: 'Medication', classification: 'critical' },
  { zoneId: 'zone-paddock', label: 'Paddock restricted gate', shortLabel: 'Paddock', classification: 'restricted' },
  { zoneId: 'zone-grandstand', label: 'Grandstand public concourse', shortLabel: 'Grandstand', classification: 'public' },
];

const typeMap = new Map(securityEventTypes.map((definition) => [definition.type, definition]));
const zoneMap = new Map(securityZonePresets.map((preset) => [preset.zoneId, preset]));

export function getSecurityEventType(type: SecurityEventEntryType): SecurityEventTypeDefinition {
  const definition = typeMap.get(type);
  if (!definition) throw new Error(`Unknown security event type ${type}`);
  return definition;
}

export function getSecurityZonePreset(zoneId: string): SecurityZonePreset | undefined {
  return zoneMap.get(zoneId);
}

export interface SecurityEventIntakePayload {
  eventType: SecurityEventEntryType;
  entryMode: SecurityEventEntryMode;
  severity: SecurityEventSeverity;
  zoneId?: string;
  summary: string;
  detailedNotes?: string;
  personDisplayName?: string;
  personLegalName?: string;
  credentialId?: string;
  accessDecision?: SecurityAccessDecision;
  accessReason?: string;
  cameraId?: string;
  host?: string;
  credentialStatus?: 'valid' | 'expired' | 'revoked' | 'unknown';
  evidenceRefs?: string[];
  relatedIncidentId?: string;
  escalationRoute?: string[];
  requestInvestigation?: boolean;
  followUpOwner?: string;
  sensitiveDetails?: string;
  occurredAt?: string;
  reportedBy: string;
  reason: string;
}

export interface SecurityEventEntryValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export const quickSecurityEventRequiredFields = ['eventType', 'severity', 'summary', 'reason'] as const;
export const fullSecurityEventRequiredFields = [...quickSecurityEventRequiredFields, 'detailedNotes'] as const;

export function securityEventEntryEntityKind(): DataEntryEntityKind {
  return 'security-event-entry';
}

export function parseEscalationRoute(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

export function parseSecurityEvidenceRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

export function buildSecurityEventTitle(type: SecurityEventEntryType, summary: string): string {
  const label = getSecurityEventType(type).shortLabel;
  const trimmed = summary.trim();
  return trimmed.length > 80 ? `${label}: ${trimmed.slice(0, 77)}…` : `${label}: ${trimmed}`;
}

export function fieldsForSecurityEventEntryMode(mode: SecurityEventEntryMode, eventType?: SecurityEventEntryType): string[] {
  const baseQuick = ['eventType', 'severity', 'zoneId', 'summary', 'reason'];
  const baseFull = [...baseQuick, 'detailedNotes', 'evidenceRefs', 'followUpOwner', 'occurredAt'];

  if (eventType === 'restricted-zone' || eventType === 'access-issue') {
    return mode === 'quick'
      ? [...baseQuick, 'personDisplayName', 'accessDecision', 'accessReason']
      : [...baseFull, 'personDisplayName', 'personLegalName', 'credentialId', 'accessDecision', 'accessReason', 'cameraId'];
  }
  if (eventType === 'suspicious-activity') {
    return mode === 'quick'
      ? [...baseQuick, 'personDisplayName', 'cameraId']
      : [...baseFull, 'personDisplayName', 'cameraId', 'requestInvestigation', 'sensitiveDetails'];
  }
  if (eventType === 'security-incident') {
    return mode === 'quick'
      ? [...baseQuick, 'requestInvestigation']
      : [...baseFull, 'requestInvestigation', 'relatedIncidentId', 'sensitiveDetails'];
  }
  if (eventType === 'personnel-event') {
    return mode === 'quick'
      ? [...baseQuick, 'personDisplayName', 'host']
      : [...baseFull, 'personDisplayName', 'personLegalName', 'credentialId', 'host', 'credentialStatus'];
  }
  if (eventType === 'escalation-request') {
    return mode === 'quick'
      ? ['eventType', 'severity', 'relatedIncidentId', 'summary', 'escalationRoute', 'reason']
      : ['eventType', 'severity', 'relatedIncidentId', 'summary', 'detailedNotes', 'escalationRoute', 'evidenceRefs', 'followUpOwner', 'reason'];
  }
  return mode === 'quick' ? baseQuick : baseFull;
}

export function validateSecurityEventEntry(
  values: Record<string, unknown>,
  mode: DataEntryFormMode = 'create',
  entryMode: SecurityEventEntryMode = 'quick',
): { valid: boolean; errors: string[]; issues: SecurityEventEntryValidationIssue[] } {
  const issues: SecurityEventEntryValidationIssue[] = [];

  if (mode === 'edit') {
    issues.push({ code: 'immutable', message: 'Security event records are append-only — submit a new entry to update posture.' });
  }

  const eventType = String(values.eventType ?? '') as SecurityEventEntryType;
  if (eventType && !typeMap.has(eventType)) {
    issues.push({ code: 'invalid-type', message: 'eventType must be a supported security event type', field: 'eventType' });
  }

  const required = entryMode === 'full' ? fullSecurityEventRequiredFields : quickSecurityEventRequiredFields;
  for (const field of required) {
    const value = values[field];
    if (value === undefined || value === '' || (typeof value === 'string' && !value.trim())) {
      issues.push({ code: 'required', message: `${field} is required`, field });
    }
  }

  if (eventType && getSecurityEventType(eventType).requiresZone) {
    const zoneId = values.zoneId;
    if (!zoneId || (typeof zoneId === 'string' && !zoneId.trim())) {
      issues.push({ code: 'required', message: 'zoneId is required for this event type', field: 'zoneId' });
    }
  }

  if (eventType === 'personnel-event' && entryMode === 'quick') {
    const person = values.personDisplayName;
    if (!person || (typeof person === 'string' && !person.trim())) {
      issues.push({ code: 'required', message: 'personDisplayName is required for personnel events', field: 'personDisplayName' });
    }
  }

  if (eventType === 'escalation-request') {
    const incidentId = values.relatedIncidentId;
    const summary = values.summary;
    if ((!incidentId || (typeof incidentId === 'string' && !incidentId.trim())) && (!summary || String(summary).trim().length < 8)) {
      issues.push({ code: 'escalation-target', message: 'relatedIncidentId or a detailed summary is required for escalation', field: 'relatedIncidentId' });
    }
  }

  if (values.summary && String(values.summary).length > 0 && String(values.summary).length < 8 && entryMode === 'quick') {
    issues.push({ code: 'summary-short', message: 'summary must be at least 8 characters', field: 'summary' });
  }

  if (entryMode === 'full' && values.detailedNotes && String(values.detailedNotes).length < 12) {
    issues.push({ code: 'notes-short', message: 'detailedNotes must be at least 12 characters in full mode', field: 'detailedNotes' });
  }

  const errors = issues.map((issue) => issue.message);
  return { valid: errors.length === 0, errors, issues };
}

export function buildSecurityEventIntakePayload(
  scope: { actorId: string },
  values: Record<string, unknown>,
  entryMode: SecurityEventEntryMode = 'quick',
): SecurityEventIntakePayload {
  const validation = validateSecurityEventEntry(values, 'create', entryMode);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const eventType = String(values.eventType) as SecurityEventEntryType;
  const severity = String(values.severity ?? getSecurityEventType(eventType).defaultSeverity) as SecurityEventSeverity;
  const evidenceRefs = parseSecurityEvidenceRefs(values.evidenceRefs);
  const escalationRoute = parseEscalationRoute(values.escalationRoute);

  return {
    eventType,
    entryMode,
    severity,
    zoneId: values.zoneId ? String(values.zoneId) : undefined,
    summary: String(values.summary ?? '').trim(),
    detailedNotes: values.detailedNotes ? String(values.detailedNotes) : undefined,
    personDisplayName: values.personDisplayName ? String(values.personDisplayName) : undefined,
    personLegalName: values.personLegalName ? String(values.personLegalName) : undefined,
    credentialId: values.credentialId ? String(values.credentialId) : undefined,
    accessDecision: values.accessDecision
      ? String(values.accessDecision) as SecurityAccessDecision
      : eventType === 'restricted-zone'
        ? 'denied'
        : eventType === 'access-issue'
          ? 'review'
          : undefined,
    accessReason: values.accessReason ? String(values.accessReason) : undefined,
    cameraId: values.cameraId ? String(values.cameraId) : undefined,
    host: values.host ? String(values.host) : undefined,
    credentialStatus: values.credentialStatus
      ? String(values.credentialStatus) as SecurityEventIntakePayload['credentialStatus']
      : 'unknown',
    evidenceRefs,
    relatedIncidentId: values.relatedIncidentId ? String(values.relatedIncidentId) : undefined,
    escalationRoute: escalationRoute.length ? escalationRoute : undefined,
    requestInvestigation: values.requestInvestigation === true,
    followUpOwner: values.followUpOwner ? String(values.followUpOwner) : undefined,
    sensitiveDetails: values.sensitiveDetails ? String(values.sensitiveDetails) : undefined,
    occurredAt: values.occurredAt ? String(values.occurredAt) : undefined,
    reportedBy: String(values.reportedBy ?? scope.actorId),
    reason: String(values.reason ?? 'Security event recorded'),
  };
}

export function defaultSecurityEventSeed(
  eventType: SecurityEventEntryType,
  actorId: string,
  zoneId = 'zone-paddock',
): Record<string, unknown> {
  const definition = getSecurityEventType(eventType);
  return {
    eventType,
    entryMode: 'quick' as SecurityEventEntryMode,
    severity: definition.defaultSeverity,
    zoneId,
    summary: '',
    detailedNotes: '',
    personDisplayName: '',
    credentialId: '',
    accessDecision: eventType === 'restricted-zone' ? 'denied' : eventType === 'access-issue' ? 'review' : 'granted',
    accessReason: '',
    cameraId: '',
    host: '',
    credentialStatus: 'unknown',
    evidenceRefs: '',
    relatedIncidentId: '',
    escalationRoute: 'security-supervisor\nincident-command',
    requestInvestigation: eventType === 'security-incident' || eventType === 'suspicious-activity',
    followUpOwner: actorId,
    reportedBy: actorId,
    reason: '',
    occurredAt: new Date().toISOString().slice(0, 16),
  };
}
