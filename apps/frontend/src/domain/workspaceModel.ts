import type { AIRecommendationDto, AuditEventDto, ApprovalDto, KPIArtifact } from '@trackmind/shared';
import type { AdapterSource } from '../api/client';
import type { RouteSupportMetadata } from './support';

export interface WorkspaceMetric {
  label: string;
  value: string;
  tone: 'nominal' | 'advisory' | 'warning' | 'critical';
  detail: string;
}

export interface WorkspacePanel {
  id: string;
  title: string;
  body: string;
  status: 'implemented' | 'facade-only' | 'documented-stub' | 'mock-adapter';
  evidence: string[];
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
  kpis: KPIArtifact[];
}

export function countMetric(label: string, count: number, detail: string, tone: WorkspaceMetric['tone'] = 'nominal'): WorkspaceMetric {
  return { label, value: String(count), detail, tone };
}

export function textMetric(label: string, value: string, detail: string, tone: WorkspaceMetric['tone'] = 'advisory'): WorkspaceMetric {
  return { label, value, detail, tone };
}
