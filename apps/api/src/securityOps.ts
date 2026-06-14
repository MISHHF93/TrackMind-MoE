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

export type SecurityOpsPermission = 'security:read' | 'security:sensitive:read' | 'security:write' | 'security:escalate' | 'security:investigate';
export type SecurityAction = 'access.checked' | 'security.event.created' | 'incident.created' | 'incident.escalated' | 'investigation.opened' | 'visitor.logged' | 'credential.checked';
export interface SecurityActor { id: string; permissions: SecurityOpsPermission[] }
export interface SecurityAuditRecord { id: string; action: SecurityAction; actorId: string; subjectId: string; timestamp: string; hash: string; previousHash: string; sensitiveFields: string[] }
export interface RestrictedZone { id: string; name: string; classification: 'public' | 'staff-only' | 'restricted' | 'critical'; requiredCredential: string; cameraIds: string[] }
export interface CameraAsset { id: string; zoneId: string; label: string; health: 'online' | 'degraded' | 'offline'; privacyMasking: boolean; lastHeartbeatAt: string }
export interface AccessControlEvent { id: string; zoneId: string; credentialId: string; personDisplayName: string; personLegalName?: string; decision: 'granted' | 'denied'; reason: string; occurredAt: string; eventId: string; auditId: string }
export interface SecurityIncident { id: string; title: string; severity: RiskLevel; status: 'open' | 'triaged' | 'escalated' | 'resolved'; zoneId: string; eventIds: string[]; assignedTo?: string; createdAt: string; auditId: string }
export interface SecurityInvestigation { id: string; incidentId: string; status: 'queued' | 'active' | 'closed'; lead: string; evidence: string[]; openedAt: string; auditId: string }
export interface WatchlistPlaceholder { id: string; category: 'banned-person' | 'credential-watch' | 'law-enforcement-notice'; displayLabel: string; sensitiveNotes?: string; requiresHumanReview: true }
export interface VisitorLog { id: string; visitorDisplayName: string; visitorLegalName?: string; host: string; zoneId: string; checkedInAt: string; checkedOutAt?: string; credentialCheckId: string; auditId: string }
export interface CredentialCheck { id: string; credentialId: string; holderDisplayName: string; holderLegalName?: string; status: 'valid' | 'expired' | 'revoked' | 'unknown'; checkedAt: string; decision: 'allow' | 'deny' | 'review'; auditId: string }
export interface EscalationWorkflow { id: string; incidentId: string; routeTo: string[]; status: 'pending' | 'sent' | 'acknowledged'; reason: string; auditId: string }
export interface SecurityOperationsWorkspace { restrictedZones: RestrictedZone[]; cameras: CameraAsset[]; accessEvents: AccessControlEvent[]; incidents: SecurityIncident[]; investigations: SecurityInvestigation[]; watchlistPlaceholders: WatchlistPlaceholder[]; visitorLogs: VisitorLog[]; credentialChecks: CredentialCheck[]; escalations: EscalationWorkflow[]; auditRecords: SecurityAuditRecord[]; dashboard: { activeAlerts: number; restrictedZoneEvents: number; cameraHealth: Record<CameraAsset['health'], number>; incidentTimeline: Array<{ at: string; label: string; severity: RiskLevel }>; investigationQueue: number } }

const mask = '••••';
function can(actor: SecurityActor, permission: SecurityOpsPermission) { return actor.permissions.includes(permission); }

export class SecurityOperationsService {
  private zones = new Map<string, RestrictedZone>(); private cameras = new Map<string, CameraAsset>(); private accessEvents: AccessControlEvent[] = []; private incidents = new Map<string, SecurityIncident>(); private investigations = new Map<string, SecurityInvestigation>(); private watchlist: WatchlistPlaceholder[] = []; private visitors: VisitorLog[] = []; private credentialChecks: CredentialCheck[] = []; private escalations: EscalationWorkflow[] = []; private audits: SecurityAuditRecord[] = [];
  constructor(private clock = () => new Date().toISOString()) { this.seed(); }
  getWorkspace(actor: SecurityActor): SecurityOperationsWorkspace { const sensitive = can(actor, 'security:sensitive:read'); return { restrictedZones:[...this.zones.values()], cameras:[...this.cameras.values()], accessEvents:this.accessEvents.map((e)=>sensitive?e:{...e,personLegalName:e.personLegalName?mask:undefined,credentialId:mask}), incidents:[...this.incidents.values()], investigations:[...this.investigations.values()], watchlistPlaceholders:this.watchlist.map((w)=>sensitive?w:{...w,sensitiveNotes:w.sensitiveNotes?mask:undefined}), visitorLogs:this.visitors.map((v)=>sensitive?v:{...v,visitorLegalName:v.visitorLegalName?mask:undefined,credentialCheckId:mask}), credentialChecks:this.credentialChecks.map((c)=>sensitive?c:{...c,holderLegalName:c.holderLegalName?mask:undefined,credentialId:mask}), escalations:[...this.escalations], auditRecords:[...this.audits], dashboard:this.dashboard() }; }
  checkCredential(actor: SecurityActor, input: { credentialId: string; holderDisplayName: string; holderLegalName?: string; zoneId: string; status: CredentialCheck['status'] }): CredentialCheck { this.require(actor, 'security:write'); const zone = this.zones.get(input.zoneId); const decision = input.status === 'valid' && zone ? 'allow' : input.status === 'unknown' ? 'review' : 'deny'; const auditId = this.audit('credential.checked', actor.id, input.credentialId, ['credentialId','holderLegalName']); const check = { id:`check-${this.credentialChecks.length+1}`, credentialId:input.credentialId, holderDisplayName:input.holderDisplayName, holderLegalName:input.holderLegalName, status:input.status, checkedAt:this.clock(), decision, auditId } as CredentialCheck; this.credentialChecks.push(check); return check; }
  recordAccessEvent(actor: SecurityActor, input: Omit<AccessControlEvent,'id'|'eventId'|'auditId'>): AccessControlEvent { this.require(actor, 'security:write'); const auditId = this.audit('access.checked', actor.id, input.zoneId, ['credentialId','personLegalName']); const event = { ...input, id:`access-${this.accessEvents.length+1}`, eventId:`evt-security-access-${this.accessEvents.length+1}`, auditId }; this.accessEvents.push(event); if (event.decision === 'denied' && this.zones.get(event.zoneId)?.classification !== 'public') this.createIncident(actor, { title:`Denied access at ${event.zoneId}`, severity:'high', zoneId:event.zoneId, eventIds:[event.eventId] }); return event; }
  createIncident(actor: SecurityActor, input: { title: string; severity: RiskLevel; zoneId: string; eventIds: string[] }): SecurityIncident { this.require(actor, 'security:write'); const auditId = this.audit('incident.created', actor.id, input.zoneId, []); const incident = { id:`inc-${this.incidents.size+1}`, status:'open' as const, createdAt:this.clock(), auditId, ...input }; this.incidents.set(incident.id, incident); return incident; }
  openInvestigation(actor: SecurityActor, incidentId: string, lead = actor.id): SecurityInvestigation { this.require(actor, 'security:investigate'); const auditId = this.audit('investigation.opened', actor.id, incidentId, []); const inv = { id:`inv-${this.investigations.size+1}`, incidentId, status:'queued', lead, evidence:[], openedAt:this.clock(), auditId } as SecurityInvestigation; this.investigations.set(inv.id, inv); return inv; }
  escalateIncident(actor: SecurityActor, incidentId: string, routeTo = ['security-supervisor','incident-command']): EscalationWorkflow { this.require(actor, 'security:escalate'); const incident = this.incidents.get(incidentId); if (!incident) throw new Error('incident not found'); incident.status = 'escalated'; const auditId = this.audit('incident.escalated', actor.id, incidentId, []); const flow = { id:`esc-${this.escalations.length+1}`, incidentId, routeTo, status:'sent', reason:`${incident.severity} ${incident.title}`, auditId } as EscalationWorkflow; this.escalations.push(flow); return flow; }
  private dashboard() { const health = { online:0, degraded:0, offline:0 }; [...this.cameras.values()].forEach((c)=>health[c.health]++); return { activeAlerts:[...this.incidents.values()].filter((i)=>i.status!=='resolved').length, restrictedZoneEvents:this.accessEvents.filter((e)=>this.zones.get(e.zoneId)?.classification !== 'public').length, cameraHealth:health, incidentTimeline:[...this.incidents.values()].map((i)=>({ at:i.createdAt, label:i.title, severity:i.severity })), investigationQueue:[...this.investigations.values()].filter((i)=>i.status==='queued').length }; }
  private audit(action: SecurityAction, actorId: string, subjectId: string, sensitiveFields: string[]) { const previousHash = this.audits.at(-1)?.hash ?? 'genesis'; const id = `audit-security-${this.audits.length+1}`; const hash = `sha256:${[previousHash,id,action,subjectId].join(':').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0).toString(16)}`; this.audits.push({ id, action, actorId, subjectId, timestamp:this.clock(), previousHash, hash, sensitiveFields }); return id; }
  private require(actor: SecurityActor, permission: SecurityOpsPermission) { if (!can(actor, permission)) throw new Error(`missing permission ${permission}`); }
  private seed() { this.zones.set('zone-backstretch-medication', { id:'zone-backstretch-medication', name:'Backstretch medication storage', classification:'critical', requiredCredential:'veterinary-security', cameraIds:['cam-med-1'] }); this.zones.set('zone-grandstand', { id:'zone-grandstand', name:'Grandstand public concourse', classification:'public', requiredCredential:'ticket', cameraIds:['cam-grand-1'] }); this.cameras.set('cam-med-1', { id:'cam-med-1', zoneId:'zone-backstretch-medication', label:'Medication Corridor PTZ', health:'degraded', privacyMasking:true, lastHeartbeatAt:this.clock() }); this.cameras.set('cam-grand-1', { id:'cam-grand-1', zoneId:'zone-grandstand', label:'Grandstand Overview', health:'online', privacyMasking:true, lastHeartbeatAt:this.clock() }); this.watchlist.push({ id:'watch-placeholder-1', category:'banned-person', displayLabel:'Human-reviewed watchlist placeholder', sensitiveNotes:'Do not display without security sensitive permission', requiresHumanReview:true }); }
}
