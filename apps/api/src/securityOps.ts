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
