export const racingKnowledgeGraphSchemaVersion = 'trackmind.racing-knowledge-graph.v1' as const;

export const racingKnowledgeGraphExplorationStatement =
  'Racing knowledge graph relationships are read-only projections for exploration and search; operational mutations remain on source domain services with approval and audit governance.';

export type KnowledgeGraphEntityKind =
  | 'horse'
  | 'race'
  | 'trainer'
  | 'jockey'
  | 'incident'
  | 'approval'
  | 'audit'
  | 'facility'
  | 'recommendation'
  | 'kpi';

export interface RacingKnowledgeGraphNodeDto {
  id: string;
  kind: KnowledgeGraphEntityKind;
  label: string;
  description?: string;
  path: string;
  score?: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface RacingKnowledgeGraphEdgeDto {
  edgeId: string;
  from: string;
  to: string;
  relationship: string;
  evidence: string[];
}

export interface KnowledgeGraphEntityCountsDto {
  horses: number;
  races: number;
  trainers: number;
  jockeys: number;
  incidents: number;
  approvals: number;
  audits: number;
  facilities: number;
  recommendations: number;
  kpis: number;
}

export interface RacingKnowledgeGraphWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof racingKnowledgeGraphSchemaVersion;
  tenantId: string;
  racetrackId: string;
  query: string;
  nodes: RacingKnowledgeGraphNodeDto[];
  edges: RacingKnowledgeGraphEdgeDto[];
  entityCounts: KnowledgeGraphEntityCountsDto;
  entityResolutionPending: number;
  explorationDepthDefault: number;
  connectedEntityKinds: KnowledgeGraphEntityKind[];
  guardrails: { readOnlyExploration: true; guardrailStatement: string };
  mock: false;
}

export interface RacingKnowledgeGraphSearchResultDto {
  nodeId: string;
  kind: KnowledgeGraphEntityKind;
  label: string;
  path: string;
  score: number;
  matchedFields: string[];
}

export interface RacingKnowledgeGraphSearchDto {
  generatedAt: string;
  schemaVersion: typeof racingKnowledgeGraphSchemaVersion;
  query: string;
  results: RacingKnowledgeGraphSearchResultDto[];
  relatedNodes: RacingKnowledgeGraphNodeDto[];
  relatedEdges: RacingKnowledgeGraphEdgeDto[];
  mock: false;
}

export interface RacingKnowledgeGraphExploreDto {
  generatedAt: string;
  schemaVersion: typeof racingKnowledgeGraphSchemaVersion;
  focusNodeId: string;
  depth: number;
  nodes: RacingKnowledgeGraphNodeDto[];
  edges: RacingKnowledgeGraphEdgeDto[];
  mock: false;
}

export const knowledgeGraphEntityKinds: KnowledgeGraphEntityKind[] = [
  'horse',
  'race',
  'trainer',
  'jockey',
  'incident',
  'approval',
  'audit',
  'facility',
  'recommendation',
  'kpi',
];
