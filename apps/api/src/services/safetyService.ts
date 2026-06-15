import type { ApprovalToken } from '../approvals.js';
import { ApexApprovalGateway, type ApexMutationContext, type ApprovalEvidencePackage, type ApprovalRequiredActionRecord } from './approvalGateway.js';

export interface TrackCondition {
  sectionId: string;
  moisture: number;
  compaction: number;
  status: 'safe' | 'watch' | 'unsafe';
  observedAt: string;
}

export interface WeatherAlert {
  id: string;
  type: 'lightning' | 'rain' | 'wind' | 'heat';
  severity: 'advisory' | 'warning' | 'critical';
  summary: string;
  observedAt: string;
}

export interface SafetyIncident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'contained' | 'closed';
  evidence: string[];
}

export interface EmergencyActionInput {
  incidentId: string;
  action: string;
  requestedBy: string;
  evidence: ApprovalEvidencePackage;
  context: ApexMutationContext;
}

export class SafetyService {
  readonly trackConditions: TrackCondition[] = [];
  readonly weatherAlerts: WeatherAlert[] = [];
  readonly incidents: SafetyIncident[] = [];

  constructor(private readonly approvals: ApexApprovalGateway) {
    this.trackConditions.push({ sectionId: 'far-turn', moisture: 27, compaction: 276, status: 'watch', observedAt: '2026-06-14T00:00:00.000Z' });
    this.weatherAlerts.push({ id: 'weather-lightning-west', type: 'lightning', severity: 'warning', summary: 'Lightning cell west at 11 miles.', observedAt: '2026-06-14T00:00:00.000Z' });
  }

  currentSafetyState() {
    return {
      trackConditions: this.trackConditions.map((item) => ({ ...item })),
      weatherAlerts: this.weatherAlerts.map((item) => ({ ...item })),
      incidents: this.incidents.map((item) => ({ ...item, evidence: [...item.evidence] })),
      approvalRequiredForMutations: true,
    };
  }

  async requestEmergencyAction(input: EmergencyActionInput): Promise<ApprovalRequiredActionRecord> {
    return this.approvals.requestProtectedMutation({
      service: 'safety',
      operation: 'emergency_action',
      action: 'emergency-action',
      target: input.incidentId,
      payload: { action: input.action, requestedBy: input.requestedBy },
      context: input.context,
      evidence: input.evidence,
      execute: (_token: ApprovalToken) => {
        const incident = this.incidents.find((item) => item.id === input.incidentId) ?? { id: input.incidentId, title: input.action, severity: 'critical' as const, status: 'open' as const, evidence: [] };
        incident.status = 'contained';
        incident.evidence = [...new Set([...incident.evidence, ...input.evidence.evidenceLinks])];
        if (!this.incidents.some((item) => item.id === incident.id)) this.incidents.push(incident);
        return { executed: true, incident: { ...incident, evidence: [...incident.evidence] }, approval_required: true };
      },
    });
  }
}

export function createSafetyService(gateway = new ApexApprovalGateway()) {
  return new SafetyService(gateway);
}
