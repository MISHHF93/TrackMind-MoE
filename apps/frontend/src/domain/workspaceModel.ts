import type { AIRecommendationDto, AuditEventDto, ApprovalDto, KPI, ModelReadableKPIContext } from '@trackmind/shared';
import type { AdapterSource } from '../api/client';
import type { RouteSupportMetadata } from './support';

export interface WorkspaceMetric {
  label: string;
  value: string;
  tone: 'nominal' | 'advisory' | 'warning' | 'critical';
  detail: string;
  actions?: WorkspaceCardAction[];
}

export interface WorkspaceCardAction {
  label: string;
  path: string;
  detail?: string;
}

export interface WorkspacePanel {
  id: string;
  title: string;
  body: string;
  status: 'implemented' | 'facade-only' | 'documented-stub';
  evidence: string[];
  actions?: WorkspaceCardAction[];
}

export type AdvisoryAIRecommendation = AIRecommendationDto & {
  governorAllowed?: boolean;
  governorReason?: string;
  actionLabel?: string;
  target?: string;
  status?: string;
  confidenceBand?: string;
};

export interface WorkspaceViewModel {
  route: RouteSupportMetadata;
  source: AdapterSource;
  generatedAt?: string;
  metrics: WorkspaceMetric[];
  panels: WorkspacePanel[];
  approvals: ApprovalDto[];
  aiRecommendations: AdvisoryAIRecommendation[];
  auditEvents: AuditEventDto[];
  kpis: KPI[];
  modelReadableKpiContext: ModelReadableKPIContext[];
}

export function countMetric(label: string, count: number, detail: string, tone: WorkspaceMetric['tone'] = 'nominal', actions?: WorkspaceCardAction[]): WorkspaceMetric {
  return { label, value: String(count), detail, tone, actions };
}

export function textMetric(label: string, value: string, detail: string, tone: WorkspaceMetric['tone'] = 'advisory', actions?: WorkspaceCardAction[]): WorkspaceMetric {
  return { label, value, detail, tone, actions };
}
