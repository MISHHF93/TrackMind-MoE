import type { ApprovalToken } from '../approvals.js';
import type { IncidentService } from '../platform/incidentService.js';
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

export interface PostIncidentReviewRequest {
  incidentId: string;
  findings: Array<{ finding: string; severity: 'low' | 'medium' | 'high' | 'critical'; owner: string }>;
  submittedBy: string;
  evidence?: string[];
}

export class SafetyService {
  readonly trackConditions: TrackCondition[] = [];
  readonly weatherAlerts: WeatherAlert[] = [];
  readonly incidents: SafetyIncident[] = [];

  constructor(
    private readonly approvals: ApexApprovalGateway,
    private readonly incidentService?: IncidentService,
  ) {
    this.trackConditions.push({ sectionId: 'far-turn', moisture: 27, compaction: 276, status: 'watch', observedAt: '2026-06-14T00:00:00.000Z' });
    this.weatherAlerts.push({ id: 'weather-lightning-west', type: 'lightning', severity: 'warning', summary: 'Lightning cell west at 11 miles.', observedAt: '2026-06-14T00:00:00.000Z' });
  }

  currentSafetyState() {
    const platformIncidents = this.incidentService?.list() ?? [];
    return {
      trackConditions: this.trackConditions.map((item) => ({ ...item })),
      weatherAlerts: this.weatherAlerts.map((item) => ({ ...item })),
      incidents: [
        ...this.incidents.map((item) => ({ ...item, evidence: [...item.evidence] })),
        ...platformIncidents.map((incident) => ({
          id: incident.id,
          title: incident.title,
          severity: incident.severity,
          status: incident.status === 'closed' || incident.status === 'resolved' ? 'closed' as const : incident.status === 'reported' ? 'open' as const : 'contained' as const,
          evidence: incident.auditIds,
        })),
      ],
      safetyKpiPack: this.incidentService?.computeSafetyKpiPack({ safetyIntelligenceAlerts: this.weatherAlerts.filter((alert) => alert.severity !== 'advisory').length }) ?? null,
      approvalRequiredForMutations: true,
    };
  }

  submitPostIncidentReview(input: PostIncidentReviewRequest) {
    if (!this.incidentService) throw new Error('Incident service unavailable for post-incident review');
    return this.incidentService.submitPostIncidentReview(input.incidentId, {
      findings: input.findings,
      submittedBy: input.submittedBy,
      evidence: input.evidence,
    });
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
        if (this.incidentService?.get(input.incidentId)) {
          this.incidentService.update(input.incidentId, { status: 'responding', actor: input.requestedBy, note: input.action });
        }
        return { executed: true, incident: { ...incident, evidence: [...incident.evidence] }, approval_required: true };
      },
    });
  }
}

export function createSafetyService(gateway = new ApexApprovalGateway(), incidentService?: IncidentService) {
  return new SafetyService(gateway, incidentService);
}
