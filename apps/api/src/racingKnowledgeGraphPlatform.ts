import type {
  RacingKnowledgeGraphEdgeDto,
  KnowledgeGraphEntityCountsDto,
  KnowledgeGraphEntityKind,
  RacingKnowledgeGraphNodeDto,
  RacingKnowledgeGraphExploreDto,
  RacingKnowledgeGraphSearchDto,
  RacingKnowledgeGraphSearchResultDto,
  RacingKnowledgeGraphWorkspaceDto,
} from '@trackmind/shared';
import { knowledgeGraphEntityKinds, racingKnowledgeGraphExplorationStatement } from '@trackmind/shared';
import type { KPIArtifact } from '@trackmind/shared';
import type { CentralizedApprovalService } from './approvals.js';
import type { EquineWelfareIntelligencePlatform } from './equineWelfareIntelligencePlatform.js';
import type { HorseRegistryPlatform } from './horseRegistryPlatform.js';
import type { JockeyManagementPlatform } from './jockeyManagementPlatform.js';
import type { RaceCardManagementPlatform } from './raceCardManagement.js';
import type { TrainerManagementPlatform } from './trainerManagementPlatform.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const edgeId = (from: string, to: string, relationship: string) => `edge:${from}:${relationship}:${to}`;

interface GraphStore {
  nodes: Map<string, RacingKnowledgeGraphNodeDto>;
  edges: RacingKnowledgeGraphEdgeDto[];
}

export interface RacingKnowledgeGraphDeps {
  tenantId?: string;
  racetrackId?: string;
  equineWorkspace?: {
    horse?: { horseId: string; name?: string };
    relationships?: Array<{ id: string; type: string; fromId: string; toId: string; evidence?: string[] }>;
    aiRiskRecommendations?: Array<{ id: string; summary: string; advisoryOnly?: boolean }>;
    approvals?: Array<{ id: string; action: string; status: string }>;
    audit?: Array<{ id: string; action: string; actor?: string }>;
    raceHistory?: Array<{ raceId: string; date?: string; status?: string }>;
  };
  horseRegistryService?: HorseRegistryPlatform;
  trainerManagementService?: TrainerManagementPlatform;
  jockeyManagementService?: JockeyManagementPlatform;
  raceCardManagementService?: RaceCardManagementPlatform;
  approvalService?: CentralizedApprovalService;
  auditEvents?: Array<{ id?: string; auditEventId?: string; type?: string; action?: string }>;
  securityIncidents?: Array<{ id: string; title: string; status?: string }>;
  stewardInquiries?: Array<{ id: string; raceId?: string; status?: string }>;
  facilitiesMaintenance?: {
    assets?: Array<{ assetId: string; name: string; assetType: string; healthScore?: number }>;
    workOrders?: Array<{ id: string; assetId?: string; title?: string }>;
  };
  kpis?: KPIArtifact[];
  aiRecommendations?: Array<{ id: string; recommendation?: string; recommendationId?: string }>;
  equineWelfareIntelligenceService?: EquineWelfareIntelligencePlatform;
}

export class RacingKnowledgeGraphPlatform {
  private graphVersion = 0;
  private cachedGraph: GraphStore | null = null;

  constructor(private readonly deps: RacingKnowledgeGraphDeps = {}) {}

  workspace(query = '', now = new Date().toISOString()): RacingKnowledgeGraphWorkspaceDto {
    const graph = this.buildGraph();
    const normalizedQuery = query.trim() || '*';
    const filtered = this.filterGraph(graph, normalizedQuery === '*' ? '' : normalizedQuery);
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.racing-knowledge-graph.v1',
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      query: normalizedQuery,
      nodes: filtered.nodes,
      edges: filtered.edges,
      entityCounts: this.entityCounts(graph),
      entityResolutionPending: 0,
      explorationDepthDefault: 2,
      connectedEntityKinds: knowledgeGraphEntityKinds,
      guardrails: { readOnlyExploration: true, guardrailStatement: racingKnowledgeGraphExplorationStatement },
      mock: false,
    };
  }

  search(query: string, now = new Date().toISOString()): RacingKnowledgeGraphSearchDto {
    const graph = this.buildGraph();
    const q = query.trim().toLowerCase();
    const results: RacingKnowledgeGraphSearchResultDto[] = [];

    for (const node of graph.nodes.values()) {
      const matchedFields: string[] = [];
      if (node.id.toLowerCase().includes(q)) matchedFields.push('id');
      if (node.label.toLowerCase().includes(q)) matchedFields.push('label');
      if (node.description?.toLowerCase().includes(q)) matchedFields.push('description');
      if (node.kind.toLowerCase().includes(q)) matchedFields.push('kind');
      for (const [key, value] of Object.entries(node.attributes ?? {})) {
        if (String(value).toLowerCase().includes(q)) matchedFields.push(key);
      }
      if (!matchedFields.length) continue;
      const kindBoost: Record<KnowledgeGraphEntityKind, number> = {
        horse: 0.95,
        race: 0.9,
        trainer: 0.88,
        jockey: 0.88,
        incident: 0.85,
        approval: 0.8,
        audit: 0.75,
        facility: 0.72,
        recommendation: 0.7,
        kpi: 0.78,
      };
      results.push({
        nodeId: node.id,
        kind: node.kind,
        label: node.label,
        path: node.path,
        score: Number((kindBoost[node.kind] - matchedFields.length * 0.02).toFixed(3)),
        matchedFields,
      });
    }

    results.sort((a, b) => b.score - a.score);
    const focusIds = new Set(results.slice(0, 8).map((result) => result.nodeId));
    const related = this.collectNeighborhood(graph, focusIds, 1);

    return {
      generatedAt: now,
      schemaVersion: 'trackmind.racing-knowledge-graph.v1',
      query,
      results,
      relatedNodes: related.nodes,
      relatedEdges: related.edges,
      mock: false,
    };
  }

  explore(nodeId: string, depth = 2, now = new Date().toISOString()): RacingKnowledgeGraphExploreDto {
    const graph = this.buildGraph();
    if (!graph.nodes.has(nodeId)) throw new Error(`Unknown knowledge graph node ${nodeId}`);
    const boundedDepth = Math.max(1, Math.min(depth, 4));
    const neighborhood = this.collectNeighborhood(graph, new Set([nodeId]), boundedDepth);
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.racing-knowledge-graph.v1',
      focusNodeId: nodeId,
      depth: boundedDepth,
      nodes: neighborhood.nodes,
      edges: neighborhood.edges,
      mock: false,
    };
  }

  globalSearchResults(query: string) {
    const search = this.search(query);
    return search.results.map((result) => ({
      id: result.nodeId,
      kind: result.kind,
      title: result.label,
      subtitle: result.kind,
      path: result.path,
      score: result.score,
      mock: false as const,
    }));
  }

  private buildGraph(): GraphStore {
    if (this.cachedGraph) return this.cachedGraph;

    const nodes = new Map<string, RacingKnowledgeGraphNodeDto>();
    const edges: RacingKnowledgeGraphEdgeDto[] = [];
    const upsert = (node: RacingKnowledgeGraphNodeDto) => nodes.set(node.id, node);
    const connect = (from: string, to: string, relationship: string, evidence: string[] = []) => {
      if (!nodes.has(from) || !nodes.has(to)) return;
      edges.push({ edgeId: edgeId(from, to, relationship), from, to, relationship, evidence: [...evidence] });
    };

    const equine = this.deps.equineWorkspace;
    if (equine?.horse) {
      upsert({
        id: equine.horse.horseId,
        kind: 'horse',
        label: equine.horse.name ?? equine.horse.horseId,
        description: 'Canonical equine profile with welfare, eligibility, and twin references.',
        path: `/equine-intelligence/horses/${equine.horse.horseId}`,
        attributes: { lifecycle: 'active' },
      });
    }

    for (const horse of this.deps.horseRegistryService?.workspace().horses ?? []) {
      upsert({
        id: horse.identity.horseId,
        kind: 'horse',
        label: horse.identity.name,
        description: 'Horse registry record with ownership and trainer linkage.',
        path: `/horse-registry/horses/${horse.identity.horseId}`,
        attributes: { lifecycle: horse.identity.lifecycleStatus },
      });
    }

    for (const trainer of this.deps.trainerManagementService?.workspace().trainers ?? []) {
      upsert({
        id: trainer.trainerId,
        kind: 'trainer',
        label: trainer.displayName,
        description: 'Licensed trainer with stable and horse assignments.',
        path: `/trainer-management/trainers/${trainer.trainerId}`,
        attributes: { status: trainer.status },
      });
      for (const assignment of trainer.horseAssignments ?? []) {
        upsert({
          id: assignment.horseId,
          kind: 'horse',
          label: assignment.horseName ?? assignment.horseId,
          path: `/equine-intelligence/horses/${assignment.horseId}`,
        });
        connect(trainer.trainerId, assignment.horseId, 'trains', assignment.evidence ?? ['trainer-assignment']);
        connect(assignment.horseId, trainer.trainerId, 'trained-by', assignment.evidence ?? ['trainer-assignment']);
      }
    }

    for (const jockey of this.deps.jockeyManagementService?.workspace().jockeys ?? []) {
      upsert({
        id: jockey.jockeyId,
        kind: 'jockey',
        label: jockey.displayName,
        description: 'Licensed jockey with race participation history.',
        path: `/jockey-management/jockeys/${jockey.jockeyId}`,
        attributes: { status: jockey.status },
      });
      for (const assignment of jockey.assignments ?? []) {
        connect(jockey.jockeyId, assignment.horseId, 'rides', assignment.evidence ?? ['jockey-assignment']);
        connect(assignment.horseId, jockey.jockeyId, 'ridden-by', assignment.evidence ?? ['jockey-assignment']);
        if (assignment.raceCardId) connect(jockey.jockeyId, assignment.raceCardId, 'entered-in-race', assignment.evidence ?? ['race-office']);
      }
      for (const participation of jockey.raceParticipation ?? []) {
        upsert({
          id: participation.raceId,
          kind: 'race',
          label: `Race ${participation.raceId}`,
          path: `/race-cards/${participation.raceCardId ?? participation.raceId}`,
          attributes: { raceDate: participation.raceDate },
        });
        connect(jockey.jockeyId, participation.raceId, 'competed-in', participation.evidence ?? ['chart']);
        connect(participation.raceId, jockey.jockeyId, 'includes-jockey', participation.evidence ?? ['chart']);
        if (participation.horseId) connect(participation.raceId, participation.horseId, 'includes-horse', participation.evidence ?? ['chart']);
      }
    }

    for (const raceCard of this.deps.raceCardManagementService?.workspace().raceCards ?? []) {
      upsert({
        id: raceCard.id,
        kind: 'race',
        label: `Race ${raceCard.raceNumber}`,
        description: 'Managed race card with entries and conditions.',
        path: `/race-cards/${raceCard.id}`,
        attributes: { status: raceCard.lifecycleStatus, raceDate: raceCard.raceDate },
      });
      for (const entry of raceCard.entries ?? []) {
        upsert({
          id: entry.horseId,
          kind: 'horse',
          label: entry.horseId,
          path: `/equine-intelligence/horses/${entry.horseId}`,
        });
        connect(raceCard.id, entry.horseId, 'includes-horse', ['race-card-entry']);
        connect(entry.horseId, raceCard.id, 'entered-in-race', ['race-card-entry']);
        if (entry.jockeyId) {
          upsert({
            id: entry.jockeyId,
            kind: 'jockey',
            label: entry.jockeyId,
            path: `/jockey-management/jockeys/${entry.jockeyId}`,
          });
          connect(entry.jockeyId, raceCard.id, 'entered-in-race', ['race-card-entry']);
        }
        if (entry.trainerId) {
          upsert({
            id: entry.trainerId,
            kind: 'trainer',
            label: entry.trainerId,
            path: `/trainer-management/trainers/${entry.trainerId}`,
          });
          connect(entry.trainerId, entry.horseId, 'trains', ['race-card-entry']);
        }
      }
    }

    for (const race of equine?.raceHistory ?? []) {
      upsert({
        id: race.raceId,
        kind: 'race',
        label: `Race ${race.raceId}`,
        path: `/races/${race.raceId}`,
        attributes: { status: race.status ?? 'scheduled' },
      });
      if (equine?.horse) connect(equine.horse.horseId, race.raceId, 'entered-in-race', ['race-history']);
    }

    for (const incident of this.deps.securityIncidents ?? []) {
      upsert({
        id: incident.id,
        kind: 'incident',
        label: incident.title,
        description: 'Security or operational incident under review.',
        path: `/incidents/${incident.id}`,
        attributes: { status: incident.status ?? 'open' },
      });
    }

    for (const inquiry of this.deps.stewardInquiries ?? []) {
      upsert({
        id: inquiry.id,
        kind: 'incident',
        label: `Steward inquiry ${inquiry.id}`,
        description: 'Steward inquiry with evidence and ruling workflow.',
        path: `/stewarding/inquiries/${inquiry.id}`,
        attributes: { status: inquiry.status ?? 'open' },
      });
      if (inquiry.raceId) connect(inquiry.id, inquiry.raceId, 'references-race', ['steward-inquiry']);
    }

    for (const approval of this.deps.approvalService?.allRequests() ?? []) {
      upsert({
        id: approval.id,
        kind: 'approval',
        label: `${approval.action} on ${approval.target}`,
        description: 'Centralized approval request for protected action.',
        path: `/approvals/requests/${approval.id}`,
        attributes: { status: approval.status, action: approval.action },
      });
    }

    for (const approval of equine?.approvals ?? []) {
      upsert({
        id: approval.id,
        kind: 'approval',
        label: approval.action,
        path: `/approvals/requests/${approval.id}`,
        attributes: { status: approval.status },
      });
      if (equine?.horse) connect(approval.id, equine.horse.horseId, 'governs-horse-action', ['equine-approval']);
    }

    for (const event of this.deps.auditEvents ?? []) {
      const auditId = event.id ?? event.auditEventId ?? '';
      if (!auditId) continue;
      upsert({
        id: auditId,
        kind: 'audit',
        label: event.action ?? event.type ?? auditId,
        description: event.type,
        path: `/audit/events/${auditId}`,
      });
    }

    for (const audit of equine?.audit ?? []) {
      upsert({
        id: audit.id,
        kind: 'audit',
        label: audit.action,
        path: `/audit/events/${audit.id}`,
      });
      if (equine?.horse) connect(audit.id, equine.horse.horseId, 'audits-horse-domain', ['equine-audit']);
    }

    const welfareWorkspace = this.deps.equineWelfareIntelligenceService?.workspace();
    for (const alert of welfareWorkspace?.alerts ?? []) {
      upsert({
        id: alert.alertId,
        kind: 'incident',
        label: alert.title,
        path: `/equine-welfare/alerts/${alert.alertId}`,
        attributes: { severity: alert.severity, status: alert.status },
      });
      connect(alert.alertId, alert.horseId, 'affects-horse', alert.summary ? [alert.summary] : ['welfare-alert']);
    }

    for (const asset of this.deps.facilitiesMaintenance?.assets ?? []) {
      upsert({
        id: asset.assetId,
        kind: 'facility',
        label: asset.name,
        description: asset.assetType,
        path: `/facilities/assets/${asset.assetId}`,
        attributes: { healthScore: asset.healthScore ?? 0 },
      });
    }

    for (const workOrder of this.deps.facilitiesMaintenance?.workOrders ?? []) {
      if (workOrder.assetId) connect(workOrder.id, workOrder.assetId, 'maintains-facility', ['work-order']);
    }

    for (const kpi of this.deps.kpis ?? []) {
      upsert({
        id: kpi.kpiId,
        kind: 'kpi',
        label: kpi.name,
        description: kpi.description,
        path: `/kpis/${kpi.kpiId}`,
        attributes: { domain: kpi.domain, value: kpi.value },
      });
    }

    for (const rec of this.deps.aiRecommendations ?? []) {
      upsert({
        id: rec.id,
        kind: 'recommendation',
        label: rec.recommendation ?? rec.recommendationId ?? rec.id,
        description: 'Advisory AI recommendation; not an operational command.',
        path: `/ai-governance/recommendations/${rec.id}`,
        attributes: { advisoryOnly: true },
      });
    }

    for (const rec of equine?.aiRiskRecommendations ?? []) {
      upsert({
        id: rec.id,
        kind: 'recommendation',
        label: rec.summary,
        path: `/ai-governance/recommendations/${rec.id}`,
        attributes: { advisoryOnly: rec.advisoryOnly ?? true },
      });
      if (equine?.horse) connect(rec.id, equine.horse.horseId, 'recommends-for-horse', ['ai-advisory']);
    }

    for (const relationship of equine?.relationships ?? []) {
      connect(relationship.fromId, relationship.toId, relationship.type, relationship.evidence ?? ['equine-relationship']);
    }

    this.cachedGraph = { nodes, edges };
    this.graphVersion += 1;
    return this.cachedGraph;
  }

  private entityCounts(graph: GraphStore): KnowledgeGraphEntityCountsDto {
    const counts: KnowledgeGraphEntityCountsDto = {
      horses: 0,
      races: 0,
      trainers: 0,
      jockeys: 0,
      incidents: 0,
      approvals: 0,
      audits: 0,
      facilities: 0,
      recommendations: 0,
      kpis: 0,
    };
    const kindToCountKey: Record<KnowledgeGraphEntityKind, keyof KnowledgeGraphEntityCountsDto> = {
      horse: 'horses',
      race: 'races',
      trainer: 'trainers',
      jockey: 'jockeys',
      incident: 'incidents',
      approval: 'approvals',
      audit: 'audits',
      facility: 'facilities',
      recommendation: 'recommendations',
      kpi: 'kpis',
    };
    for (const node of graph.nodes.values()) {
      counts[kindToCountKey[node.kind]] += 1;
    }
    return counts;
  }

  private filterGraph(graph: GraphStore, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) {
      return { nodes: [...graph.nodes.values()].map(clone), edges: graph.edges.map(clone) };
    }
    const search = this.search(query);
    const nodeIds = new Set([
      ...search.results.map((result) => result.nodeId),
      ...search.relatedNodes.map((node) => node.id),
    ]);
    return {
      nodes: [...graph.nodes.values()].filter((node) => nodeIds.has(node.id)).map(clone),
      edges: graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)).map(clone),
    };
  }

  private collectNeighborhood(graph: GraphStore, seedIds: Set<string>, depth: number) {
    const visited = new Set<string>(seedIds);
    let frontier = new Set(seedIds);
    for (let level = 0; level < depth; level += 1) {
      const next = new Set<string>();
      for (const edge of graph.edges) {
        if (frontier.has(edge.from) && !visited.has(edge.to)) {
          visited.add(edge.to);
          next.add(edge.to);
        }
        if (frontier.has(edge.to) && !visited.has(edge.from)) {
          visited.add(edge.from);
          next.add(edge.from);
        }
      }
      frontier = next;
      if (!frontier.size) break;
    }
    const nodes = [...visited].map((id) => graph.nodes.get(id)).filter((node): node is RacingKnowledgeGraphNodeDto => Boolean(node)).map(clone);
    const nodeSet = new Set(visited);
    const edges = graph.edges.filter((edge) => nodeSet.has(edge.from) && nodeSet.has(edge.to)).map(clone);
    return { nodes, edges };
  }
}

export function createSeededRacingKnowledgeGraph(deps: RacingKnowledgeGraphDeps = {}): RacingKnowledgeGraphPlatform {
  const platform = new RacingKnowledgeGraphPlatform(deps);
  platform.workspace('', new Date().toISOString());
  return platform;
}
