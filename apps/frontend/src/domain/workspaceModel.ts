import type { ReactNode } from 'react';

export type WorkspaceCardAction = { label: string; path: string; detail: string };
export type WorkspaceMetric = { label: string; value: string; detail: string; tone?: 'nominal' | 'advisory' | 'warning' | 'critical'; actions?: WorkspaceCardAction[] };
export type WorkspacePanel = { id: string; title: string; body: string; status: 'implemented' | 'facade-only' | 'documented-stub'; evidence: string[]; fields?: Array<{ label: string; value: string }>; actions?: WorkspaceCardAction[] };
export type AdvisoryAIRecommendation = {
  id: string;
  recommendationId?: string;
  recommendation: string;
  requiresApproval?: boolean;
  approvalRequirement?: { required?: boolean; policy?: string };
  riskLevel?: string;
  evidence?: string[];
  confidenceValue?: number;
  confidence?: { band?: string; calibrated?: number };
  confidenceBand?: string;
  auditReference?: { auditIds?: string[]; eventIds?: string[] };
  auditId?: string;
  evidencePackage?: { evidencePackageId?: string };
  executionAllowed?: boolean;
  blockedAutonomousExecution?: boolean;
  governorAllowed?: boolean;
  governorReason?: string;
  advisoryOnly?: boolean;
  modelVersion?: string;
  generatedAt?: string;
};

export type WorkspaceViewModel = {
  routeId: string;
  title: string;
  metrics: WorkspaceMetric[];
  panels: WorkspacePanel[];
  aiRecommendations?: AdvisoryAIRecommendation[];
};

export function countMetric(label: string, value: number, detail: string, tone: WorkspaceMetric['tone'] = 'nominal', action?: WorkspaceCardAction): WorkspaceMetric {
  return { label, value: String(value), detail, tone, actions: action ? [action] : undefined };
}

export function textMetric(label: string, value: string, detail: string, tone: WorkspaceMetric['tone'] = 'nominal', action?: WorkspaceCardAction): WorkspaceMetric {
  return { label, value, detail, tone, actions: action ? [action] : undefined };
}
