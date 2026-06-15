import type { Role } from '@trackmind/shared';
import type { CentralizedApprovalService } from './approvals.js';
import { ApprovalStore, type HumanApprovalRecord } from './approvals.js';
import { ImmutableAuditLog, type AuditLogEntry } from './auditLog.js';
import type { DigitalTwinRuntime, TwinStatePatch } from './digitalTwinRuntime.js';
import { UniversalEventBus } from './eventBus.js';
import type { PlatformObservabilityService, PlatformTelemetrySignal } from './platformObservability.js';
import { controlCategoryPolicies, type AssetRiskLevel } from './racetrackControlRegistry.js';
import { RacetrackAssetRegistryService, type AssetCreateInput, type AssetPrincipal } from './racetrackAssetRegistryService.js';

export interface SecurityEvent {
  id: string;
  type: 'access-control' | 'restricted-zone-alert' | 'camera-health' | 'emergency-button' | 'suspicious-activity' | 'lost-and-found' | 'banned-person-watchlist-placeholder';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'triaged' | 'escalated' | 'closed';
  location?: string;
  evidenceUris?: string[];
}

export interface EscalationRecord {
  eventId: string;
  escalatedTo: string;
  reason: string;
  timestamp: string;
}

export function escalate(event: SecurityEvent, escalatedTo = 'security-supervisor'): { event: SecurityEvent; escalation: EscalationRecord } {
  return {
    event: { ...event, status: 'escalated' },
    escalation: { eventId: event.id, escalatedTo, reason: `${event.severity} ${event.type}`, timestamp: new Date().toISOString() },
  };
}

export type SocSignalType =
  | 'access-control'
  | 'surveillance'
  | 'incident-report'
  | 'emergency-response'
  | 'restricted-area'
  | 'cybersecurity-telemetry'
  | 'threat-intelligence'
  | 'investigation'
  | 'workforce-safety'
  | 'compliance';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SocSignal {
  id: string;
  type: SocSignalType;
  source: string;
  subject: string;
  location: string;
  observedAt: string;
  description: string;
  severity: RiskLevel;
  confidence: number;
  restrictedArea?: boolean;
  evidenceUris?: string[];
  controls?: string[];
  cyberTactics?: string[];
}

export interface SocAlert {
  id: string;
  signalId: string;
  priority: RiskLevel;
  routeTo: string[];
  message: string;
  createdAt: string;
  slaMinutes: number;
}

export interface RiskAssessment {
  id: string;
  scope: string;
  score: number;
  level: RiskLevel;
  drivers: string[];
  recommendedActions: string[];
}

export interface IncidentTimelineEntry {
  timestamp: string;
  signalId: string;
  type: SocSignalType;
  description: string;
  actor: string;
}

export interface DigitalTwinSecurityUpdate {
  twinId: string;
  patch: Record<string, unknown>;
  observedAt: string;
  source: string;
}

export interface SocDashboard {
  totalSignals: number;
  openAlerts: number;
  criticalAlerts: number;
  restrictedAreaBreaches: number;
  cyberIndicators: number;
  workforceSafetyItems: number;
  complianceOpenItems: number;
  averageRiskScore: number;
  hotLocations: Array<{ location: string; count: number }>;
}

export interface ComplianceReport {
  generatedAt: string;
  frameworks: Array<{ name: string; openFindings: number; evidence: string[] }>;
  controlCoverage: number;
  reportableIncidents: number;
}

const riskWeight: Record<RiskLevel, number> = { low: 15, medium: 40, high: 70, critical: 95 };
const routeByType: Record<SocSignalType, string[]> = {
  'access-control': ['security-operations'],
  surveillance: ['security-operations'],
  'incident-report': ['safety-manager', 'security-operations'],
  'emergency-response': ['incident-commander', 'public-safety-liaison'],
  'restricted-area': ['security-operations', 'area-owner'],
  'cybersecurity-telemetry': ['cybersecurity-analyst'],
  'threat-intelligence': ['cybersecurity-analyst', 'security-operations'],
  investigation: ['investigations-lead'],
  'workforce-safety': ['safety-manager'],
  compliance: ['compliance-officer'],
};

export class SecurityOperationsSafetyPlatform {
  private signals = new Map<string, SocSignal>();
  private alerts = new Map<string, SocAlert>();
  private timeline: IncidentTimelineEntry[] = [];
  private twinUpdates: DigitalTwinSecurityUpdate[] = [];

  ingest(signal: SocSignal): { signal: SocSignal; alerts: SocAlert[]; twinUpdate: DigitalTwinSecurityUpdate; timeline: IncidentTimelineEntry[] } {
    const normalized = { ...signal, confidence: Math.max(0, Math.min(1, signal.confidence)) };
    this.signals.set(normalized.id, normalized);
    const generatedAlerts = this.generateAlerts(normalized);
    generatedAlerts.forEach((alert) => this.alerts.set(alert.id, alert));
    const twinUpdate = this.buildTwinUpdate(normalized, generatedAlerts);
    this.twinUpdates.push(twinUpdate);
    this.timeline.push({ timestamp: normalized.observedAt, signalId: normalized.id, type: normalized.type, description: normalized.description, actor: normalized.source });
    return { signal: normalized, alerts: generatedAlerts, twinUpdate, timeline: this.incidentTimeline(normalized.subject) };
  }

  assessRisk(scope: string): RiskAssessment {
    const scoped = [...this.signals.values()].filter((signal) => signal.subject === scope || signal.location === scope || scope === 'enterprise');
    const total = Math.max(1, scoped.length);
    const score = Math.round(scoped.reduce((sum, signal) => sum + riskWeight[signal.severity] * signal.confidence + (signal.restrictedArea ? 10 : 0), 0) / total);
    const drivers = [...new Set(scoped.flatMap((signal) => [signal.type, ...(signal.cyberTactics ?? []), ...(signal.controls ?? [])]))];
    const hasCriticalSignal = scoped.some((signal) => signal.severity === 'critical' || (signal.restrictedArea && signal.severity === 'high'));
    const level = hasCriticalSignal || score >= 85 ? 'critical' : score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';
    return { id: `risk-${scope}`, scope, score, level, drivers, recommendedActions: this.actionsFor(level, drivers) };
  }

  operationalDashboard(): SocDashboard {
    const signals = [...this.signals.values()];
    const alerts = [...this.alerts.values()];
    const byLocation = new Map<string, number>();
    signals.forEach((signal) => byLocation.set(signal.location, (byLocation.get(signal.location) ?? 0) + 1));
    const averageRiskScore = Math.round(signals.reduce((sum, signal) => sum + riskWeight[signal.severity] * signal.confidence, 0) / Math.max(1, signals.length));
    return {
      totalSignals: signals.length,
      openAlerts: alerts.length,
      criticalAlerts: alerts.filter((alert) => alert.priority === 'critical').length,
      restrictedAreaBreaches: signals.filter((signal) => signal.restrictedArea).length,
      cyberIndicators: signals.filter((signal) => signal.type === 'cybersecurity-telemetry' || signal.type === 'threat-intelligence').length,
      workforceSafetyItems: signals.filter((signal) => signal.type === 'workforce-safety').length,
      complianceOpenItems: signals.filter((signal) => signal.type === 'compliance').length,
      averageRiskScore,
      hotLocations: [...byLocation.entries()].map(([location, count]) => ({ location, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    };
  }

  incidentTimeline(subject?: string): IncidentTimelineEntry[] {
    return this.timeline
      .filter((entry) => !subject || this.signals.get(entry.signalId)?.subject === subject)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  digitalTwinUpdates(): DigitalTwinSecurityUpdate[] {
    return [...this.twinUpdates];
  }

  complianceReport(frameworks = ['ISO 27001', 'ISO 45001', 'SOC 2', 'NIST CSF']): ComplianceReport {
    const complianceSignals = [...this.signals.values()].filter((signal) => signal.type === 'compliance' || signal.controls?.length);
    const evidence = [...new Set(complianceSignals.flatMap((signal) => signal.evidenceUris ?? []))];
    return {
      generatedAt: new Date().toISOString(),
      frameworks: frameworks.map((name) => ({ name, openFindings: complianceSignals.filter((signal) => signal.severity !== 'low').length, evidence })),
      controlCoverage: Math.min(1, complianceSignals.reduce((sum, signal) => sum + (signal.controls?.length ?? 0), 0) / Math.max(1, frameworks.length * 3)),
      reportableIncidents: [...this.alerts.values()].filter((alert) => alert.priority === 'high' || alert.priority === 'critical').length,
    };
  }

  private generateAlerts(signal: SocSignal): SocAlert[] {
    if (signal.severity === 'low' && signal.confidence < 0.8 && !signal.restrictedArea) return [];
    const priority: RiskLevel = signal.restrictedArea && signal.severity === 'high' ? 'critical' : signal.severity;
    return [{ id: `alert-${signal.id}`, signalId: signal.id, priority, routeTo: routeByType[signal.type], message: `${priority.toUpperCase()}: ${signal.description} at ${signal.location}`, createdAt: signal.observedAt, slaMinutes: priority === 'critical' ? 5 : priority === 'high' ? 15 : priority === 'medium' ? 60 : 240 }];
  }

  private buildTwinUpdate(signal: SocSignal, alerts: SocAlert[]): DigitalTwinSecurityUpdate {
    return { twinId: signal.location, observedAt: signal.observedAt, source: signal.source, patch: { securityPosture: signal.severity, lastSignalId: signal.id, restrictedArea: signal.restrictedArea ?? false, activeAlertIds: alerts.map((alert) => alert.id), evidenceUris: signal.evidenceUris ?? [] } };
  }

  private actionsFor(level: RiskLevel, drivers: string[]): string[] {
    const actions = ['document evidence', 'notify accountable owner'];
    if (level === 'critical' || level === 'high') actions.push('activate incident command', 'preserve video and access logs');
    if (drivers.includes('cybersecurity-telemetry') || drivers.includes('threat-intelligence')) actions.push('isolate affected systems and enrich indicators');
    if (drivers.includes('workforce-safety')) actions.push('start safety stand-down and corrective action plan');
    if (drivers.includes('compliance')) actions.push('open compliance finding and attach audit evidence');
    return actions;
  }
}

export type SecurityOpsPermission = 'security:read' | 'security:sensitive:read' | 'security:write' | 'security:escalate' | 'security:investigate' | 'security:admin';
export type SecurityAction =
  | 'access.checked'
  | 'security.event.created'
  | 'incident.created'
  | 'incident.escalated'
  | 'investigation.opened'
  | 'visitor.logged'
  | 'credential.checked'
  | 'camera.health.updated'
  | 'restricted-zone.registered'
  | 'sensitive-fields.accessed'
  | 'sensitive-fields.masked'
  | 'security.approval.requested'
  | 'security.approval.approved'
  | 'security.authorization.failed'
  | 'security.asset.synced'
  | 'security.twin.patch.queued';
export type SecurityDomainEventType =
  | 'security.credential.checked'
  | 'security.access.checked'
  | 'security.incident.created'
  | 'security.incident.escalated'
  | 'security.investigation.opened'
  | 'security.visitor.logged'
  | 'security.camera.health.updated'
  | 'security.restricted-zone.registered'
  | 'security.sensitive-fields.accessed'
  | 'security.approval.requested'
  | 'security.approval.approved'
  | 'security.authorization.failed'
  | 'security.asset.synced'
  | 'security.twin.patch.queued';
export type SecurityApprovalAction = 'security-sensitive-read' | 'security-incident-escalation' | 'security-investigation-export';
export interface SecurityActor { id: string; permissions: SecurityOpsPermission[]; roles?: Role[]; tenantId?: string; approvalId?: string; human?: boolean }
export interface SecurityAuditRecord { id: string; action: SecurityAction; actorId: string; subjectId: string; timestamp: string; hash: string; previousHash: string; sensitiveFields: string[]; sharedAuditId: string }
export interface RestrictedZone { id: string; name: string; classification: 'public' | 'staff-only' | 'restricted' | 'critical'; requiredCredential: string; cameraIds: string[]; twinId?: string; assetId?: string; retentionPolicy?: string }
export interface CameraAsset { id: string; zoneId: string; label: string; health: 'online' | 'degraded' | 'offline'; privacyMasking: boolean; lastHeartbeatAt: string; twinId?: string; assetId?: string; coverage?: string[] }
export interface AccessControlEvent { id: string; zoneId: string; credentialId: string; personDisplayName: string; personLegalName?: string; decision: 'granted' | 'denied'; reason: string; occurredAt: string; eventId: string; auditId: string }
export interface SecurityIncident { id: string; title: string; severity: RiskLevel; status: 'open' | 'triaged' | 'escalated' | 'resolved'; zoneId: string; eventIds: string[]; assignedTo?: string; createdAt: string; auditId: string; approvalRequestId?: string }
export interface SecurityInvestigation { id: string; incidentId: string; status: 'queued' | 'active' | 'closed'; lead: string; evidence: string[]; openedAt: string; auditId: string; approvalRequestId?: string }
export interface WatchlistPlaceholder { id: string; category: 'banned-person' | 'credential-watch' | 'law-enforcement-notice'; displayLabel: string; sensitiveNotes?: string; requiresHumanReview: true }
export interface VisitorLog { id: string; visitorDisplayName: string; visitorLegalName?: string; host: string; zoneId: string; checkedInAt: string; checkedOutAt?: string; credentialCheckId: string; auditId: string }
export interface CredentialCheck { id: string; credentialId: string; holderDisplayName: string; holderLegalName?: string; status: 'valid' | 'expired' | 'revoked' | 'unknown'; checkedAt: string; decision: 'allow' | 'deny' | 'review'; auditId: string; requiredCredential?: string }
export interface EscalationWorkflow { id: string; incidentId: string; routeTo: string[]; status: 'pending' | 'sent' | 'acknowledged'; reason: string; auditId: string; approvalRequestId?: string }
export interface SecurityDomainEvent { id: string; type: SecurityDomainEventType; subjectId: string; severity: RiskLevel; timestamp: string; auditId: string; payload: Record<string, unknown> }
export interface SecurityTwinUpdate { twinId: string; sourceId: string; patch: Record<string, unknown>; eventId?: string; auditId: string; status: 'queued' | 'published' | 'applied'; error?: string }
export interface SecurityAssetRegistryLink { assetId: string; sourceId: string; sourceType: 'camera' | 'restricted-zone'; registryStatus: 'created' | 'updated' | 'queued'; twinId?: string; auditId: string; eventId?: string }
export interface SecurityApprovalGate { id: string; action: SecurityApprovalAction; target: string; status: 'not-required' | 'pending' | 'approved' | 'rejected' | 'expired'; requestedBy?: string; evidence: string[]; reason: string }
export interface SecurityOperationsWorkspace {
  restrictedZones: RestrictedZone[];
  cameras: CameraAsset[];
  accessEvents: AccessControlEvent[];
  incidents: SecurityIncident[];
  investigations: SecurityInvestigation[];
  watchlistPlaceholders: WatchlistPlaceholder[];
  visitorLogs: VisitorLog[];
  credentialChecks: CredentialCheck[];
  escalations: EscalationWorkflow[];
  auditRecords: SecurityAuditRecord[];
  sharedAuditRecords: AuditLogEntry[];
  events: SecurityDomainEvent[];
  twinUpdates: SecurityTwinUpdate[];
  assetRegistryLinks: SecurityAssetRegistryLink[];
  approvalGates: SecurityApprovalGate[];
  observabilitySignals: PlatformTelemetrySignal[];
  dashboard: {
    activeAlerts: number;
    restrictedZoneEvents: number;
    criticalIncidents: number;
    openEscalations: number;
    cameraHealth: Record<CameraAsset['health'], number>;
    incidentTimeline: Array<{ at: string; label: string; severity: RiskLevel }>;
    investigationQueue: number;
    sensitiveAccesses: number;
  };
}

export interface SecurityOperationsOptions {
  eventBus?: UniversalEventBus;
  auditLog?: ImmutableAuditLog;
  approvalStore?: ApprovalStore;
  approvals?: CentralizedApprovalService;
  assetRegistry?: RacetrackAssetRegistryService;
  twins?: DigitalTwinRuntime;
  observability?: PlatformObservabilityService;
}

const mask = '••••';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const can = (actor: SecurityActor, permission: SecurityOpsPermission) => actor.permissions.includes(permission);
const hasSensitiveRole = (actor: SecurityActor) => actor.roles?.some((role) => role === 'admin' || role === 'security' || role === 'compliance-officer') ?? false;
const riskByZone: Record<RestrictedZone['classification'], AssetRiskLevel> = { public: 'low', 'staff-only': 'medium', restricted: 'high', critical: 'critical' };

export class SecurityOperationsService {
  private zones = new Map<string, RestrictedZone>();
  private cameras = new Map<string, CameraAsset>();
  private accessEvents: AccessControlEvent[] = [];
  private incidents = new Map<string, SecurityIncident>();
  private investigations = new Map<string, SecurityInvestigation>();
  private watchlist: WatchlistPlaceholder[] = [];
  private visitors: VisitorLog[] = [];
  private credentialChecks: CredentialCheck[] = [];
  private escalations: EscalationWorkflow[] = [];
  private audits: SecurityAuditRecord[] = [];
  private sharedAudits: AuditLogEntry[] = [];
  private events: SecurityDomainEvent[] = [];
  private twinUpdates: SecurityTwinUpdate[] = [];
  private assetRegistryLinks: SecurityAssetRegistryLink[] = [];
  private approvalGates: SecurityApprovalGate[] = [];
  private observabilitySignals: PlatformTelemetrySignal[] = [];
  private readonly eventBus: UniversalEventBus;
  private readonly auditLog: ImmutableAuditLog;
  private readonly approvalStore: ApprovalStore;

  constructor(private clock = () => new Date().toISOString(), private readonly options: SecurityOperationsOptions = {}) {
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.approvalStore = options.approvalStore ?? new ApprovalStore();
    this.registerEventSchemas();
    this.seed();
  }

  getWorkspace(actor: SecurityActor): SecurityOperationsWorkspace {
    this.require(actor, 'security:read');
    const sensitive = this.canReadSensitive(actor);
    this.audit(sensitive ? 'sensitive-fields.accessed' : 'sensitive-fields.masked', actor.id, 'security-operations-workspace', sensitive ? this.sensitiveFieldNames() : []);
    return {
      restrictedZones: this.values(this.zones).map((zone) => sensitive ? zone : { ...zone, requiredCredential: mask }),
      cameras: this.values(this.cameras),
      accessEvents: this.accessEvents.map((event) => sensitive ? clone(event) : { ...clone(event), personLegalName: event.personLegalName ? mask : undefined, credentialId: mask }),
      incidents: this.values(this.incidents),
      investigations: this.values(this.investigations),
      watchlistPlaceholders: this.watchlist.map((item) => sensitive ? clone(item) : { ...clone(item), sensitiveNotes: item.sensitiveNotes ? mask : undefined }),
      visitorLogs: this.visitors.map((visitor) => sensitive ? clone(visitor) : { ...clone(visitor), visitorLegalName: visitor.visitorLegalName ? mask : undefined, credentialCheckId: mask }),
      credentialChecks: this.credentialChecks.map((check) => sensitive ? clone(check) : { ...clone(check), holderLegalName: check.holderLegalName ? mask : undefined, credentialId: mask, requiredCredential: check.requiredCredential ? mask : undefined }),
      escalations: this.escalations.map(clone),
      auditRecords: this.audits.map(clone),
      sharedAuditRecords: this.auditLog.all().filter((entry) => entry.type === 'security-event' || entry.subjectId?.startsWith('security:') || entry.payload && typeof entry.payload === 'object' && (entry.payload as Record<string, unknown>).domain === 'security-operations'),
      events: this.events.map(clone),
      twinUpdates: this.twinUpdates.map(clone),
      assetRegistryLinks: this.assetRegistryLinks.map(clone),
      approvalGates: this.approvalGates.map(clone),
      observabilitySignals: this.observabilitySignals.map(clone),
      dashboard: this.dashboard(),
    };
  }

  requestSensitiveAccess(actor: SecurityActor, input: { reason: string; evidence: string[]; expiresAt?: string }): SecurityApprovalGate {
    this.require(actor, 'security:read');
    const recommendationId = this.sensitiveRecommendationId(actor.id);
    this.approvalStore.saveRecommendation({ id: recommendationId, status: 'pending-approval', requestedBy: actor.id, createdAt: this.clock(), evidence: input.evidence, requiredApprovals: ['security', 'compliance-officer'], recommendation: { reason: input.reason, action: 'security-sensitive-read' } });
    const gate: SecurityApprovalGate = { id: `gate-${this.approvalGates.length + 1}`, action: 'security-sensitive-read', target: recommendationId, status: 'pending', requestedBy: actor.id, evidence: [...input.evidence], reason: input.reason };
    this.approvalGates.push(gate);
    const auditId = this.audit('security.approval.requested', actor.id, recommendationId, []);
    this.emitDomainEvent('security.approval.requested', recommendationId, 'medium', auditId, { action: gate.action, requestedBy: actor.id, evidenceCount: input.evidence.length });
    return clone(gate);
  }

  approveSensitiveAccess(input: Omit<HumanApprovalRecord, 'action' | 'recommendationId' | 'status'> & { actorId: string; approver: string; reason: string; evidence: string[] }): HumanApprovalRecord {
    const record = this.approvalStore.saveApproval({ ...input, action: 'security-sensitive-read', recommendationId: this.sensitiveRecommendationId(input.actorId), status: 'approved' });
    this.approvalGates = this.approvalGates.map((gate) => gate.target === record.recommendationId ? { ...gate, status: 'approved' } : gate);
    const auditId = this.audit('security.approval.approved', input.approver, record.recommendationId, []);
    this.emitDomainEvent('security.approval.approved', record.recommendationId, 'medium', auditId, { action: record.action, approvedFor: input.actorId, approver: input.approver, evidenceCount: input.evidence.length });
    return clone(record);
  }

  registerRestrictedZone(actor: SecurityActor, zone: RestrictedZone): RestrictedZone {
    this.require(actor, 'security:write');
    this.zones.set(zone.id, clone(zone));
    const auditId = this.audit('restricted-zone.registered', actor.id, zone.id, ['requiredCredential']);
    this.emitDomainEvent('security.restricted-zone.registered', zone.id, zone.classification === 'critical' ? 'critical' : 'medium', auditId, { zoneId: zone.id, classification: zone.classification, cameraIds: zone.cameraIds });
    return clone(zone);
  }

  registerCamera(actor: SecurityActor, camera: CameraAsset): CameraAsset {
    this.require(actor, 'security:write');
    if (!this.zones.has(camera.zoneId)) throw new Error(`unknown restricted zone ${camera.zoneId}`);
    this.cameras.set(camera.id, clone(camera));
    this.queueTwinPatch(actor, camera.twinId ?? `twin:${camera.id}`, camera.id, { cameraHealth: camera.health, privacyMasking: camera.privacyMasking, zoneId: camera.zoneId, lastHeartbeatAt: camera.lastHeartbeatAt });
    return clone(camera);
  }

  checkCredential(actor: SecurityActor, input: { credentialId: string; holderDisplayName: string; holderLegalName?: string; zoneId: string; status: CredentialCheck['status'] }): CredentialCheck {
    this.require(actor, 'security:write');
    const zone = this.zones.get(input.zoneId);
    const decision = input.status === 'valid' && zone ? 'allow' : input.status === 'unknown' ? 'review' : 'deny';
    const auditId = this.audit('credential.checked', actor.id, input.credentialId, ['credentialId', 'holderLegalName']);
    const check: CredentialCheck = { id: `check-${this.credentialChecks.length + 1}`, credentialId: input.credentialId, holderDisplayName: input.holderDisplayName, holderLegalName: input.holderLegalName, status: input.status, checkedAt: this.clock(), decision, auditId, requiredCredential: zone?.requiredCredential };
    this.credentialChecks.push(check);
    this.emitDomainEvent('security.credential.checked', check.id, decision === 'allow' ? 'low' : decision === 'review' ? 'medium' : 'high', auditId, { zoneId: input.zoneId, decision, status: input.status, holderDisplayName: input.holderDisplayName });
    this.observe('credential.checked', decision === 'allow' ? 200 : 403);
    return clone(check);
  }

  recordAccessEvent(actor: SecurityActor, input: Omit<AccessControlEvent, 'id' | 'eventId' | 'auditId'>): AccessControlEvent {
    this.require(actor, 'security:write');
    const zone = this.zones.get(input.zoneId);
    const auditId = this.audit('access.checked', actor.id, input.zoneId, ['credentialId', 'personLegalName']);
    const event: AccessControlEvent = { ...input, id: `access-${this.accessEvents.length + 1}`, eventId: `evt-security-access-${this.accessEvents.length + 1}`, auditId };
    this.accessEvents.push(event);
    this.emitDomainEvent('security.access.checked', event.id, event.decision === 'granted' ? 'low' : zone?.classification === 'critical' ? 'critical' : 'high', auditId, { zoneId: event.zoneId, decision: event.decision, reason: event.reason, eventId: event.eventId });
    this.queueTwinPatch(actor, zone?.twinId ?? `twin:${event.zoneId}`, event.id, { lastAccessDecision: event.decision, lastAccessEventId: event.eventId, restrictedArea: zone?.classification !== 'public' });
    if (event.decision === 'denied' && zone?.classification !== 'public') this.createIncident(actor, { title: `Denied access at ${zone?.name ?? event.zoneId}`, severity: zone?.classification === 'critical' ? 'critical' : 'high', zoneId: event.zoneId, eventIds: [event.eventId] });
    return clone(event);
  }

  createIncident(actor: SecurityActor, input: { title: string; severity: RiskLevel; zoneId: string; eventIds: string[] }): SecurityIncident {
    this.require(actor, 'security:write');
    const auditId = this.audit('incident.created', actor.id, input.zoneId, []);
    const incident: SecurityIncident = { id: `inc-${this.incidents.size + 1}`, status: 'open', createdAt: this.clock(), auditId, ...input };
    this.incidents.set(incident.id, incident);
    this.emitDomainEvent('security.incident.created', incident.id, incident.severity, auditId, { zoneId: incident.zoneId, eventIds: incident.eventIds, status: incident.status });
    this.queueTwinPatch(actor, this.zones.get(input.zoneId)?.twinId ?? `twin:${input.zoneId}`, incident.id, { activeSecurityIncidentId: incident.id, securityPosture: incident.severity });
    return clone(incident);
  }

  openInvestigation(actor: SecurityActor, incidentId: string, lead = actor.id, evidence: string[] = []): SecurityInvestigation {
    this.require(actor, 'security:investigate');
    if (!this.incidents.has(incidentId)) throw new Error('incident not found');
    const auditId = this.audit('investigation.opened', actor.id, incidentId, evidence);
    const inv: SecurityInvestigation = { id: `inv-${this.investigations.size + 1}`, incidentId, status: 'queued', lead, evidence: [...evidence], openedAt: this.clock(), auditId };
    this.investigations.set(inv.id, inv);
    this.emitDomainEvent('security.investigation.opened', inv.id, 'medium', auditId, { incidentId, lead, evidenceCount: evidence.length });
    return clone(inv);
  }

  escalateIncident(actor: SecurityActor, incidentId: string, routeTo = ['security-supervisor', 'incident-command']): EscalationWorkflow {
    this.require(actor, 'security:escalate');
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error('incident not found');
    incident.status = 'escalated';
    incident.assignedTo = routeTo[0];
    const approvalRequestId = this.requestEscalationApproval(actor, incident);
    incident.approvalRequestId = approvalRequestId;
    const auditId = this.audit('incident.escalated', actor.id, incidentId, []);
    const flow: EscalationWorkflow = { id: `esc-${this.escalations.length + 1}`, incidentId, routeTo, status: 'sent', reason: `${incident.severity} ${incident.title}`, auditId, approvalRequestId };
    this.escalations.push(flow);
    this.emitDomainEvent('security.incident.escalated', incidentId, incident.severity, auditId, { routeTo, approvalRequestId, escalationId: flow.id });
    return clone(flow);
  }

  logVisitor(actor: SecurityActor, input: { visitorDisplayName: string; visitorLegalName?: string; host: string; zoneId: string; credentialId: string; credentialStatus: CredentialCheck['status'] }): VisitorLog {
    this.require(actor, 'security:write');
    const check = this.checkCredential(actor, { credentialId: input.credentialId, holderDisplayName: input.visitorDisplayName, holderLegalName: input.visitorLegalName, zoneId: input.zoneId, status: input.credentialStatus });
    const auditId = this.audit('visitor.logged', actor.id, input.zoneId, ['visitorLegalName', 'credentialCheckId']);
    const visitor: VisitorLog = { id: `visitor-${this.visitors.length + 1}`, visitorDisplayName: input.visitorDisplayName, visitorLegalName: input.visitorLegalName, host: input.host, zoneId: input.zoneId, checkedInAt: this.clock(), credentialCheckId: check.id, auditId };
    this.visitors.push(visitor);
    this.emitDomainEvent('security.visitor.logged', visitor.id, check.decision === 'allow' ? 'low' : 'medium', auditId, { zoneId: visitor.zoneId, host: visitor.host, credentialDecision: check.decision });
    return clone(visitor);
  }

  updateCameraHealth(actor: SecurityActor, cameraId: string, health: CameraAsset['health'], observedAt = this.clock()): CameraAsset {
    this.require(actor, 'security:write');
    const current = this.cameras.get(cameraId);
    if (!current) throw new Error(`unknown camera ${cameraId}`);
    const next = { ...current, health, lastHeartbeatAt: observedAt };
    this.cameras.set(cameraId, next);
    const auditId = this.audit('camera.health.updated', actor.id, cameraId, []);
    this.emitDomainEvent('security.camera.health.updated', cameraId, health === 'offline' ? 'high' : health === 'degraded' ? 'medium' : 'low', auditId, { cameraId, health, zoneId: next.zoneId });
    this.queueTwinPatch(actor, next.twinId ?? `twin:${cameraId}`, cameraId, { cameraHealth: health, lastHeartbeatAt: observedAt });
    return clone(next);
  }

  async syncCameraAssetsToRegistry(principal: AssetPrincipal): Promise<SecurityAssetRegistryLink[]> {
    const registry = this.options.assetRegistry ?? new RacetrackAssetRegistryService({ eventBus: this.eventBus, auditLog: this.auditLog, approvalStore: this.approvalStore });
    const links: SecurityAssetRegistryLink[] = [];
    for (const camera of this.cameras.values()) {
      const zone = this.zones.get(camera.zoneId);
      const asset = this.cameraRegistryAsset(camera, zone, principal.tenantId ?? 'trackmind');
      const existing = registry.repository.get(asset.assetId);
      const saved = existing ?? await registry.create(asset, principal);
      const auditId = this.audit('security.asset.synced', principal.id, saved.assetId, []);
      const link: SecurityAssetRegistryLink = { assetId: saved.assetId, sourceId: camera.id, sourceType: 'camera', registryStatus: existing ? 'updated' : 'created', twinId: saved.digitalTwin?.twinId, auditId };
      links.push(link);
      this.assetRegistryLinks.push(link);
      this.emitDomainEvent('security.asset.synced', saved.assetId, saved.riskLevel === 'critical' ? 'critical' : 'medium', auditId, { sourceId: camera.id, assetId: saved.assetId, twinId: saved.digitalTwin?.twinId });
    }
    return links.map(clone);
  }

  listEvents(): SecurityDomainEvent[] { return this.events.map(clone); }
  listAuditRecords(): SecurityAuditRecord[] { return this.audits.map(clone); }
  listTwinUpdates(): SecurityTwinUpdate[] { return this.twinUpdates.map(clone); }

  private dashboard(): SecurityOperationsWorkspace['dashboard'] {
    const health = { online: 0, degraded: 0, offline: 0 };
    [...this.cameras.values()].forEach((camera) => health[camera.health] += 1);
    return {
      activeAlerts: [...this.incidents.values()].filter((incident) => incident.status !== 'resolved').length,
      restrictedZoneEvents: this.accessEvents.filter((event) => this.zones.get(event.zoneId)?.classification !== 'public').length,
      criticalIncidents: [...this.incidents.values()].filter((incident) => incident.severity === 'critical').length,
      openEscalations: this.escalations.filter((flow) => flow.status !== 'acknowledged').length,
      cameraHealth: health,
      incidentTimeline: [...this.incidents.values()].map((incident) => ({ at: incident.createdAt, label: incident.title, severity: incident.severity })),
      investigationQueue: [...this.investigations.values()].filter((investigation) => investigation.status === 'queued').length,
      sensitiveAccesses: this.audits.filter((record) => record.action === 'sensitive-fields.accessed').length,
    };
  }

  private audit(action: SecurityAction, actorId: string, subjectId: string, sensitiveFields: string[]): string {
    const timestamp = this.clock();
    const previousHash = this.audits.at(-1)?.hash ?? 'genesis';
    const id = `audit-security-${this.audits.length + 1}`;
    const hash = `sha256:${[previousHash, id, action, subjectId, timestamp].join(':').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0).toString(16)}`;
    const shared = this.auditLog.append({ id: `shared-${id}`, type: 'security-event', actor: actorId, timestamp, payload: { domain: 'security-operations', action, sensitiveFields }, subjectId: `security:${subjectId}`, severity: this.auditSeverity(action), regulations: ['TrackPolicy', 'LocalLaw'], evidenceIds: sensitiveFields });
    const local = { id, action, actorId, subjectId, timestamp, previousHash, hash, sensitiveFields: [...sensitiveFields], sharedAuditId: shared.id };
    this.audits.push(local);
    this.sharedAudits.push(shared);
    return id;
  }

  private emitDomainEvent(type: SecurityDomainEventType, subjectId: string, severity: RiskLevel, auditId: string, payload: Record<string, unknown>): SecurityDomainEvent {
    const event: SecurityDomainEvent = { id: `evt-security-${this.events.length + 1}`, type, subjectId, severity, timestamp: this.clock(), auditId, payload: clone(payload) };
    this.events.push(event);
    void this.eventBus.publish({
      id: event.id,
      type,
      occurredAt: event.timestamp,
      payload: { ...event.payload, subjectId, severity, auditId },
      aggregateId: subjectId,
      correlationId: auditId,
      producer: 'security-operations',
      metadata: { team: 'security-operations', accountableRole: 'security-operations-commander', compliance: severity === 'critical' ? 'restricted' : 'regulated' },
    });
    return event;
  }

  private queueTwinPatch(actor: SecurityActor, twinId: string, sourceId: string, patch: Record<string, unknown>): SecurityTwinUpdate {
    const auditId = this.audit('security.twin.patch.queued', actor.id, twinId, []);
    const event = this.emitDomainEvent('security.twin.patch.queued', twinId, 'medium', auditId, { twinId, sourceId, patch });
    const update: SecurityTwinUpdate = { twinId, sourceId, patch: clone(patch), eventId: event.id, auditId, status: 'queued' };
    const twinPatch: TwinStatePatch = { twinId, patch, actor: actor.id, observedAt: this.clock(), sourceEventId: auditId };
    try {
      if (this.options.twins) {
        this.options.twins.updateState(twinPatch);
        update.status = 'applied';
      } else {
        void this.eventBus.publish({ type: 'digital-twin.state.patch', payload: twinPatch, aggregateId: twinId, correlationId: auditId, producer: 'security-operations', metadata: { team: 'security-operations', accountableRole: 'digital-twin-runtime-owner', compliance: 'regulated' } });
        update.status = 'published';
      }
    } catch (error) {
      update.error = error instanceof Error ? error.message : String(error);
    }
    this.twinUpdates.push(update);
    return update;
  }

  private canReadSensitive(actor: SecurityActor): boolean {
    if ((can(actor, 'security:sensitive:read') && (!actor.roles || hasSensitiveRole(actor))) || can(actor, 'security:admin')) return true;
    return Boolean(this.approvalStore.findApproved('security-sensitive-read', this.sensitiveRecommendationId(actor.id)));
  }

  private requestEscalationApproval(actor: SecurityActor, incident: SecurityIncident): string | undefined {
    if (incident.severity !== 'critical' || !this.options.approvals) return undefined;
    try {
      return this.options.approvals.createRequest({ tenantId: actor.tenantId ?? 'trackmind', racetrackId: this.zones.get(incident.zoneId)?.id ?? incident.zoneId, action: 'emergency-action', target: incident.id, requestedBy: actor.id, actorType: actor.human === false ? 'service' : 'human', reason: `Escalate critical security incident: ${incident.title}`, evidence: incident.eventIds }).id;
    } catch {
      const gate: SecurityApprovalGate = { id: `gate-${this.approvalGates.length + 1}`, action: 'security-incident-escalation', target: incident.id, status: 'pending', requestedBy: actor.id, evidence: incident.eventIds, reason: `Escalate critical security incident: ${incident.title}` };
      this.approvalGates.push(gate);
      return gate.id;
    }
  }

  private observe(route: string, statusCode: number): void {
    const signal = this.options.observability?.recordApiLatency('security-operations', route, statusCode >= 400 ? 320 : 95, statusCode);
    if (signal) this.observabilitySignals.push(signal);
  }

  private cameraRegistryAsset(camera: CameraAsset, zone: RestrictedZone | undefined, tenantId: string): AssetCreateInput & { assetId: string; tenantId: string } {
    const now = this.clock();
    const riskLevel = riskByZone[zone?.classification ?? 'restricted'];
    return {
      assetId: camera.assetId ?? `SEC-CAMERA-${camera.id.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
      tenantId,
      externalIds: [camera.id],
      name: camera.label,
      assetClass: 'physical',
      assetType: 'SecurityCamera',
      domain: 'security',
      lifecycleStatus: 'draft',
      riskLevel,
      safetyCritical: riskLevel === 'critical',
      maintenance: { status: camera.health === 'offline' ? 'out-of-service' : camera.health === 'degraded' ? 'due' : 'ok', lastInspectionAt: camera.lastHeartbeatAt },
      ownership: { ownerAgent: 'SecuritySOC', stewardTeam: 'security-operations', assignedTo: zone?.id, assignedAt: now },
      location: { zoneId: camera.zoneId, zoneName: zone?.name, coverage: camera.coverage ?? [] },
      state: { health: camera.health, privacyMasking: camera.privacyMasking, lastHeartbeatAt: camera.lastHeartbeatAt },
      controls: [{ name: 'camera-review', category: 'C_HUMAN_CONTROLLED', description: 'Video review and sensitive identity disclosure require authorized security staff or approval.', requiresApprovalFrom: ['Security'], protectedAction: 'security-sensitive-read', executionMode: 'human-only' }],
      sensors: [{ id: `${camera.id}-heartbeat`, type: 'camera-heartbeat', verifies: ['health', 'lastHeartbeatAt'], required: true }],
      regulations: [{ authority: 'TrackPolicy', reference: 'Security video retention and privacy masking policy', appliesTo: ['camera-review'] }, { authority: 'LocalLaw', reference: 'Visitor and surveillance privacy requirements', appliesTo: ['camera-review'] }],
      tags: ['security', 'camera', camera.health, camera.zoneId],
      digitalTwin: { twinId: camera.twinId ?? `twin:${camera.id}`, relationship: 'represents' },
      approvalPolicyId: riskLevel === 'critical' || riskLevel === 'high' ? 'critical-asset-dual-control' : 'standard-asset-approval',
      metadata: { privacyMasking: camera.privacyMasking, approvalPolicy: controlCategoryPolicies.C_HUMAN_CONTROLLED.defaultApprovalPolicy },
    };
  }

  private require(actor: SecurityActor, permission: SecurityOpsPermission): void {
    if (!actor.id) {
      const auditId = this.audit('security.authorization.failed', 'anonymous', permission, []);
      this.emitDomainEvent('security.authorization.failed', permission, 'high', auditId, { reason: 'authentication required', permission });
      throw new Error('authentication required');
    }
    if (!can(actor, permission) && !can(actor, 'security:admin')) {
      const auditId = this.audit('security.authorization.failed', actor.id, permission, []);
      this.emitDomainEvent('security.authorization.failed', permission, 'high', auditId, { reason: 'missing permission', permission });
      throw new Error(`missing permission ${permission}`);
    }
  }

  private values<T>(map: Map<string, T>): T[] {
    return [...map.values()].map(clone);
  }

  private sensitiveFieldNames(): string[] {
    return ['credentialId', 'personLegalName', 'holderLegalName', 'visitorLegalName', 'credentialCheckId', 'requiredCredential', 'sensitiveNotes'];
  }

  private sensitiveRecommendationId(actorId: string): string {
    return `security-sensitive-read:${actorId}`;
  }

  private auditSeverity(action: SecurityAction): 'info' | 'warning' | 'critical' {
    return action.includes('escalated') || action.includes('sensitive-fields.accessed') ? 'critical' : action.includes('masked') || action.includes('approval') ? 'warning' : 'info';
  }

  private registerEventSchemas(): void {
    const owner = { service: 'security-operations', team: 'security-operations', accountableRole: 'security-operations-commander' };
    ([
      'security.credential.checked',
      'security.access.checked',
      'security.incident.created',
      'security.incident.escalated',
      'security.investigation.opened',
      'security.visitor.logged',
      'security.camera.health.updated',
      'security.restricted-zone.registered',
      'security.sensitive-fields.accessed',
      'security.approval.requested',
      'security.approval.approved',
      'security.authorization.failed',
      'security.asset.synced',
      'security.twin.patch.queued',
    ] satisfies SecurityDomainEventType[]).forEach((type) => this.eventBus.registerEvent({ type, version: 1, description: `Security Operations ${type}`, owner, payloadFields: ['subjectId', 'severity', 'auditId'], compliance: 'regulated' }));
  }

  private seed(): void {
    this.zones.set('zone-backstretch-medication', { id: 'zone-backstretch-medication', name: 'Backstretch medication storage', classification: 'critical', requiredCredential: 'veterinary-security', cameraIds: ['cam-med-1'], twinId: 'twin:zone-backstretch-medication', assetId: 'SEC-ZONE-MEDICATION', retentionPolicy: 'security-evidence-7y' });
    this.zones.set('zone-grandstand', { id: 'zone-grandstand', name: 'Grandstand public concourse', classification: 'public', requiredCredential: 'ticket', cameraIds: ['cam-grand-1'], twinId: 'twin:zone-grandstand', assetId: 'SEC-ZONE-GRANDSTAND' });
    this.zones.set('zone-paddock', { id: 'zone-paddock', name: 'Paddock restricted gate', classification: 'restricted', requiredCredential: 'paddock-credential', cameraIds: ['cam-pad-1'], twinId: 'twin:zone-paddock', assetId: 'SEC-ZONE-PADDOCK' });
    this.cameras.set('cam-med-1', { id: 'cam-med-1', zoneId: 'zone-backstretch-medication', label: 'Medication Corridor PTZ', health: 'degraded', privacyMasking: true, lastHeartbeatAt: this.clock(), twinId: 'twin:cam-med-1', assetId: 'SEC-CAMERA-CAM-MED-1', coverage: ['medication-storage', 'restricted-door'] });
    this.cameras.set('cam-grand-1', { id: 'cam-grand-1', zoneId: 'zone-grandstand', label: 'Grandstand Overview', health: 'online', privacyMasking: true, lastHeartbeatAt: this.clock(), twinId: 'twin:cam-grand-1', assetId: 'SEC-CAMERA-CAM-GRAND-1', coverage: ['public-concourse'] });
    this.cameras.set('cam-pad-1', { id: 'cam-pad-1', zoneId: 'zone-paddock', label: 'Paddock Gate Fixed', health: 'online', privacyMasking: true, lastHeartbeatAt: this.clock(), twinId: 'twin:cam-pad-1', assetId: 'SEC-CAMERA-CAM-PAD-1', coverage: ['paddock-gate'] });
    this.watchlist.push({ id: 'watch-placeholder-1', category: 'banned-person', displayLabel: 'Human-reviewed watchlist placeholder', sensitiveNotes: 'Do not display without security sensitive permission or approval', requiresHumanReview: true });
  }
}
