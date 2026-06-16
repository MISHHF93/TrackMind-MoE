import type { WorkspaceCardAction, WorkspaceMetric, WorkspacePanel, WorkspaceViewModel } from './workspaceModel';
import type { RecordWiring } from './operatingSystem';

export type ExperienceLaneKind = 'readiness' | 'operations' | 'governance' | 'evidence' | 'boundary' | 'catalog';

export interface ExperienceRecord {
  id: string;
  title: string;
  summary: string;
  statusLabel?: string;
  tone?: WorkspaceMetric['tone'];
  fields?: Array<{ label: string; value: string }>;
  evidence?: string[];
  actions?: WorkspaceCardAction[];
  highlight?: boolean;
  wiring?: RecordWiring;
  operatorNote?: string;
}

export interface ExperienceLane {
  id: string;
  kind: ExperienceLaneKind;
  title: string;
  description: string;
  records: ExperienceRecord[];
}

export interface ExperienceStage {
  id: string;
  label: string;
  laneIds: string[];
}

export interface WorkspaceExperience {
  headline: string;
  subheadline: string;
  stages: ExperienceStage[];
  lanes: ExperienceLane[];
}

export function panelToRecord(panel: WorkspacePanel, highlight = false, wiring?: RecordWiring, operatorNote?: string): ExperienceRecord {
  return {
    id: panel.id,
    title: panel.title,
    summary: panel.body,
    statusLabel: panel.status === 'implemented' ? 'Live record' : panel.status === 'facade-only' ? 'Reference read model' : 'Planned',
    tone: panel.status === 'implemented' ? 'nominal' : 'advisory',
    evidence: panel.evidence,
    actions: panel.actions,
    highlight,
    wiring,
    operatorNote,
  };
}

export function emptyExperience(headline: string, subheadline: string): WorkspaceExperience {
  return { headline, subheadline, stages: [], lanes: [] };
}
