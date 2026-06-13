export type TwinNodeKind = 'physical' | 'biological' | 'operational' | 'regulatory';
export type TwinRelationshipType = 'LOCATED_AT' | 'MONITORED_BY' | 'GOVERNED_BY' | 'PARTICIPATES_IN' | 'OPERATED_BY' | 'INVOLVED_IN' | 'DEPENDS_ON';

export interface TwinNode<State extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  kind: TwinNodeKind;
  labels: string[];
  name: string;
  state: State;
  updatedAt: string;
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
  confidence?: number;
}

export class DigitalTwinGraph {
  private readonly nodes = new Map<string, TwinNode>();
  private readonly relationships: TwinRelationship[] = [];
  private readonly updates: TwinStateUpdate[] = [];

  upsertNode(node: TwinNode): TwinNode {
    const existing = this.nodes.get(node.id);
    const next = existing ? { ...existing, ...node, state: { ...existing.state, ...node.state } } : node;
    this.nodes.set(node.id, next);
    return { ...next, state: { ...next.state } };
  }

  relate(relationship: TwinRelationship): TwinRelationship {
    if (!this.nodes.has(relationship.from) || !this.nodes.has(relationship.to)) throw new Error('Relationship endpoints must exist');
    this.relationships.push(relationship);
    return { ...relationship, properties: relationship.properties ? { ...relationship.properties } : undefined };
  }

  applyStateUpdate(update: TwinStateUpdate): TwinNode {
    const current = this.nodes.get(update.nodeId);
    if (!current) throw new Error(`Unknown twin node ${update.nodeId}`);
    const next = { ...current, state: { ...current.state, ...update.patch }, updatedAt: update.observedAt };
    this.nodes.set(update.nodeId, next);
    this.updates.push(update);
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
}
