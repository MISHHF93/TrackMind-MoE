import type { AppRoute } from '../routes/routes';

export type DomainRouteId = AppRoute['id'];

export type OpsPosture = 'ready' | 'watch' | 'blocked' | 'critical' | 'advisory';

export type ConsoleActionTone = 'primary' | 'secondary' | 'critical';

export interface ConsoleAction {
  label: string;
  path: string;
  detail: string;
  tone?: ConsoleActionTone;
}

export interface QueueItem {
  id: string;
  title: string;
  summary: string;
  posture: OpsPosture;
  evidence: string[];
  actions: ConsoleAction[];
}

export interface ConsoleQueue {
  id: string;
  title: string;
  description?: string;
  items: QueueItem[];
}

export interface ConsoleMetric {
  label: string;
  value: string;
  detail?: string;
  posture?: OpsPosture;
  action?: ConsoleAction;
}

export interface ConsoleAdvisory {
  id: string;
  recommendation: string;
  posture: OpsPosture;
  requiresApproval: boolean;
  actions: ConsoleAction[];
}

export interface LifecycleStage {
  id: string;
  label: string;
  status: string;
  summary: string;
  approvalRequired?: boolean;
  posture: OpsPosture;
  evidence: string[];
  actions: ConsoleAction[];
  updatedAt?: string;
}

export interface LifecycleLane {
  id: string;
  title: string;
  description?: string;
  stages: LifecycleStage[];
}

export interface LiveSignal {
  id: string;
  timestamp: string;
  title: string;
  summary: string;
  domain: string;
  severity: string;
  posture: OpsPosture;
  evidence: string[];
  actions: ConsoleAction[];
}

export interface ConsoleChartPoint {
  id: string;
  label: string;
  value: number;
  posture?: OpsPosture;
  detail?: string;
}

export interface ConsoleGraphNode {
  id: string;
  label: string;
  kind?: string;
  posture?: OpsPosture;
}

export interface ConsoleGraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export type ConsoleChartKind = 'bar' | 'donut' | 'gauge' | 'sparkline' | 'timeline' | 'graph';

export interface ConsoleChart {
  id: string;
  title: string;
  description?: string;
  kind: ConsoleChartKind;
  unit?: string;
  maxValue?: number;
  series?: ConsoleChartPoint[];
  nodes?: ConsoleGraphNode[];
  edges?: ConsoleGraphEdge[];
  action?: ConsoleAction;
}

export interface ConsolePayload {
  routeId: DomainRouteId;
  title: string;
  mission: string;
  posture: OpsPosture;
  postureLabel: string;
  postureScore?: number;
  generatedAt?: string;
  source: string;
  primaryActions: ConsoleAction[];
  lifecycleLanes?: LifecycleLane[];
  liveSignals?: LiveSignal[];
  queues: ConsoleQueue[];
  metrics: ConsoleMetric[];
  advisories?: ConsoleAdvisory[];
  contextDegraded?: string[];
  charts?: ConsoleChart[];
}

export interface ConsoleState {
  routeKey: string;
  loading: boolean;
  data?: ConsolePayload;
  error?: string;
}
