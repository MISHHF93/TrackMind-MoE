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

export function createUnavailableWorkspace(route: RouteSupportMetadata, reason: string): WorkspaceViewModel {
  const apiEvidence = route.backendPaths.length ? [...route.backendPaths] : ['No backend endpoint declared for this route'];
  const evidencePanels = route.evidence.map((item, index): WorkspacePanel => ({
    id: `route-evidence-${route.id}-${index}`,
    title: `${item.source}: ${item.reference}`,
    body: item.summary,
    status: route.supportStatus === 'live-api' ? 'implemented' : 'facade-only',
    evidence: [item.reference],
  }));

  return {
    route,
    source: 'documented-stub',
    metrics: [
      textMetric('Workspace availability', 'Offline view', reason, 'warning', [{ label: 'View platform context', path: '/admin', detail: 'Review backend availability and dependency status.' }]),
      countMetric('Declared endpoints', route.backendPaths.length, 'Route contract endpoints remain visible while data loading is unavailable.', 'advisory'),
      textMetric('Required permission', String(route.requiredPermission), 'Access metadata is still rendered from shared route support definitions.', 'advisory'),
    ],
    panels: [
      {
        id: `${route.id}-offline-backend-status`,
        title: 'Backend connection unavailable',
        body: `The ${route.label} page is accessible, but live data could not be loaded. Start the API locally or configure VITE_TRACKMIND_API_BASE_URL for the deployed API to restore live data.`,
        status: 'documented-stub',
        evidence: apiEvidence,
        actions: [
          { label: 'View platform context', path: '/admin', detail: 'Check backend and dependency status.' },
          { label: 'View audit context', path: '/audit', detail: 'Review available audit route wiring.' },
        ],
      },
      ...evidencePanels,
      {
        id: `${route.id}-route-boundary`,
        title: 'Route boundary',
        body: route.limitations.join(' ') || 'This route is read-only until live service data is available.',
        status: route.supportStatus === 'live-api' ? 'implemented' : 'facade-only',
        evidence: apiEvidence,
      },
    ],
    approvals: [],
    aiRecommendations: [],
    auditEvents: [],
    kpis: [],
    modelReadableKpiContext: [],
  };
}
