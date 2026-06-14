import { ImmutableAuditLog } from './auditLog.js';
import { UniversalEventBus } from './eventBus.js';

export type TwinNodeKind = 'physical' | 'biological' | 'operational' | 'regulatory';
export type TwinRelationshipType = 'LOCATED_AT' | 'MONITORED_BY' | 'GOVERNED_BY' | 'PARTICIPATES_IN' | 'OPERATED_BY' | 'INVOLVED_IN' | 'DEPENDS_ON';
export type TwinGraphEventType = 'digital-twin.graph.node.upserted' | 'digital-twin.graph.relationship.created' | 'digital-twin.graph.state.updated';

export interface TwinNode<State extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  kind: TwinNodeKind;
  labels: string[];
  name: string;
  tenantId?: string;
  state: State;
  updatedAt: string;
  version?: number;
}

export interface TwinRelationship {
  from: string;
  to: string;
  type: TwinRelationshipType;
  properties?: Record<string, unknown>;
}

export interface TwinStateUpdate {
  nodeId: string;
  patch: Record<string, unknown>;
  observedAt: string;
  source: string;
  tenantId?: string;
  actor?: string;
  approvalRef?: string;
  evidence?: string[];
  confidence?: number;
}

export class DigitalTwinGraph {
  private readonly nodes = new Map<string, TwinNode>();
  private readonly relationships: TwinRelationship[] = [];
  private readonly updates: TwinStateUpdate[] = [];
  readonly auditLog: ImmutableAuditLog;
  readonly eventBus: UniversalEventBus;

  constructor(options: { auditLog?: ImmutableAuditLog; eventBus?: UniversalEventBus } = {}) {
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.registerEventSchemas();
  }

  upsertNode(node: TwinNode): TwinNode {
    const existing = this.nodes.get(node.id);
    if (existing?.tenantId && node.tenantId && existing.tenantId !== node.tenantId) throw new Error('tenant isolation violation');
    const next = existing ? { ...existing, ...node, state: { ...existing.state, ...node.state }, version: (existing.version ?? 1) + 1 } : { ...node, version: node.version ?? 1 };
    this.nodes.set(node.id, next);
    this.recordMutation('digital-twin.graph.node.upserted', next, node.updatedAt, String(node.state.updatedBy ?? node.state.actor ?? 'digital-twin-graph'), { patch: node.state, previousVersion: existing?.version });
    return { ...next, state: { ...next.state } };
  }

  relate(relationship: TwinRelationship): TwinRelationship {
    const from = this.nodes.get(relationship.from);
    const to = this.nodes.get(relationship.to);
    if (!from || !to) throw new Error('Relationship endpoints must exist');
    if (from.tenantId && to.tenantId && from.tenantId !== to.tenantId) throw new Error('tenant isolation violation');
    this.relationships.push(relationship);
    this.recordMutation('digital-twin.graph.relationship.created', from, new Date().toISOString(), 'digital-twin-graph', { relationship, evidence: relationshipEvidence(relationship) });
    return { ...relationship, properties: relationship.properties ? { ...relationship.properties } : undefined };
  }

  applyStateUpdate(update: TwinStateUpdate): TwinNode {
    const current = this.nodes.get(update.nodeId);
    if (!current) throw new Error(`Unknown twin node ${update.nodeId}`);
    if (update.tenantId && current.tenantId && update.tenantId !== current.tenantId) throw new Error('tenant isolation violation');
    const next = { ...current, state: { ...current.state, ...update.patch }, updatedAt: update.observedAt, version: (current.version ?? 1) + 1 };
    this.nodes.set(update.nodeId, next);
    this.updates.push({ ...update, evidence: [...(update.evidence ?? [])] });
    this.recordMutation('digital-twin.graph.state.updated', next, update.observedAt, update.actor ?? update.source, { patch: update.patch, source: update.source, approvalRef: update.approvalRef, confidence: update.confidence, evidence: update.evidence ?? [] });
    return { ...next, state: { ...next.state } };
  }

  neighborhood(nodeId: string) {
    return {
      node: this.nodes.get(nodeId),
      relationships: this.relationships.filter((rel) => rel.from === nodeId || rel.to === nodeId),
    };
  }

  history(nodeId?: string): TwinStateUpdate[] {
    return this.updates.filter((update) => !nodeId || update.nodeId === nodeId).map((update) => ({ ...update, patch: { ...update.patch } }));
  }

  auditTrail(nodeId?: string) {
    return this.auditLog.forensicTimeline(nodeId ? { subjectId: nodeId } : {});
  }

  dependencyGraph(seedIds: string[] = [], tenantId?: string) {
    const seeds = new Set(seedIds);
    const includeAll = seeds.size === 0;
    const traversed = new Set<string>();
    const visit = (nodeId: string) => {
      if (traversed.has(nodeId)) return;
      traversed.add(nodeId);
      for (const rel of this.relationships.filter((candidate) => candidate.from === nodeId && candidate.type === 'DEPENDS_ON')) visit(rel.to);
    };
    if (includeAll) {
      for (const node of this.nodes.values()) if (!tenantId || node.tenantId === tenantId) visit(node.id);
    } else {
      for (const nodeId of seeds) visit(nodeId);
    }
    const nodes: TwinNode[] = [];
    for (const id of traversed) {
      const node = this.nodes.get(id);
      if (node && (!tenantId || node.tenantId === tenantId)) nodes.push({ ...node, state: { ...node.state } });
    }
    const ids = new Set(nodes.map((node) => node.id));
    const relationships = this.relationships
      .filter((rel) => ids.has(rel.from) && ids.has(rel.to) && (includeAll || rel.type === 'DEPENDS_ON'))
      .map((rel) => ({ ...rel, properties: rel.properties ? { ...rel.properties } : undefined }));
    return { nodes, relationships };
  }

  stateAt(nodeId: string, atOrBefore: string): Record<string, unknown> {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Unknown twin node ${nodeId}`);
    return this.history(nodeId).filter((update) => update.observedAt <= atOrBefore).reduce((state, update) => ({ ...state, ...update.patch }), {});
  }

  private recordMutation(type: TwinGraphEventType, node: TwinNode, timestamp: string, actor: string, payload: Record<string, unknown>): void {
    const evidence = [...new Set([...(Array.isArray(payload.evidence) ? payload.evidence.filter((item): item is string => typeof item === 'string') : []), stringValue(payload.approvalRef), node.id].filter((item): item is string => Boolean(item)))];
    const audit = this.auditLog.append({
      id: `audit-twin-graph-${node.id}-${node.version ?? 1}-${this.auditLog.all().length + 1}`,
      type: 'digital-twin-update',
      actor,
      actorType: actor === 'system' ? 'system' : 'service',
      timestamp,
      action: type,
      actionClass: 'twin',
      subjectId: node.id,
      target: node.id,
      tenantId: node.tenantId,
      correlationId: `${node.id}:v${node.version ?? 1}`,
      payload: { nodeId: node.id, tenantId: node.tenantId, version: node.version, ...payload },
      evidenceIds: evidence,
      severity: type === 'digital-twin.graph.state.updated' ? 'warning' : 'info',
      regulations: ['HISA', 'ARCI'],
    });
    void this.eventBus.publish({
      type,
      payload: { nodeId: node.id, tenantId: node.tenantId, version: node.version, auditRef: audit.id, digitalTwinRef: node.id, ...payload },
      aggregateId: node.id,
      correlationId: audit.correlationId,
      producer: 'digital-twin-graph',
      tenantId: node.tenantId,
      racetrackId: stringValue(node.state.racetrackId) ?? stringValue(node.state.trackId) ?? node.tenantId,
      actor: { id: actor, type: actor === 'system' ? 'system' : 'service' },
      subject: { id: node.id, type: 'digital-twin', tenantId: node.tenantId ?? 'unknown-tenant' },
      evidence,
      auditRef: audit.id,
      digitalTwinRef: node.id,
      approvalRef: stringValue(payload.approvalRef),
      metadata: { tenantId: node.tenantId, racetrackId: stringValue(node.state.racetrackId) ?? stringValue(node.state.trackId) ?? node.tenantId, compliance: 'regulated', team: 'racetrack-platform', accountableRole: 'digital-twin-graph-owner', regulations: ['HISA', 'ARCI'] },
    });
  }

  private registerEventSchemas(): void {
    const owner = { service: 'digital-twin-graph', team: 'racetrack-platform', accountableRole: 'digital-twin-graph-owner' };
    for (const type of ['digital-twin.graph.node.upserted', 'digital-twin.graph.relationship.created', 'digital-twin.graph.state.updated'] as TwinGraphEventType[]) {
      this.eventBus.registerEvent({ type, version: 1, description: `Digital Twin graph ${type}`, owner, payloadFields: ['nodeId'], compliance: 'regulated' });
    }
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function relationshipEvidence(relationship: TwinRelationship): string[] {
  const evidence = relationship.properties?.evidence;
  return Array.isArray(evidence) ? evidence.filter((item): item is string => typeof item === 'string') : [];
}
