export type FoundationTwinKind = 'racetrack-asset' | 'race-operation' | 'horse' | 'facility' | 'sensor' | 'workflow' | 'regulatory-object';
export type FoundationRelationshipType = 'LOCATED_AT' | 'MONITORED_BY' | 'GOVERNED_BY' | 'PARTICIPATES_IN' | 'OPERATES' | 'DEPENDS_ON' | 'CONTROLS' | 'SIMULATES';
export type FoundationHealth = 'healthy' | 'degraded' | 'critical';
export type ControlMode = 'advisory' | 'supervised' | 'manual-approval-required';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  zoneId?: string;
  trackMeter?: number;
}

export interface TelemetryBinding {
  sensorId: string;
  metric: string;
  unit: string;
  freshnessSeconds: number;
}

export interface ControlInterface {
  id: string;
  action: string;
  mode: ControlMode;
  requiredApprovals: string[];
}

export interface FoundationTwin {
  id: string;
  kind: FoundationTwinKind;
  name: string;
  tenantId: string;
  state: Record<string, unknown>;
  version: number;
  updatedAt: string;
  geospatial?: GeoPosition;
  telemetryBindings: TelemetryBinding[];
  controls: ControlInterface[];
  dependencies: string[];
  regulatoryRefs: string[];
  health: FoundationHealth;
  riskScore: number;
}

export interface FoundationRelationship {
  from: string;
  to: string;
  type: FoundationRelationshipType;
  evidence: string[];
}

export interface FoundationAuditEvent {
  id: string;
  twinId: string;
  actor: string;
  action: string;
  occurredAt: string;
  beforeVersion?: number;
  afterVersion: number;
  evidence: string[];
}

export interface FoundationStateUpdate {
  twinId: string;
  observedAt: string;
  sourceSystem: string;
  patch: Record<string, unknown>;
  expectedVersion?: number;
  telemetry?: { sensorId: string; metric: string; value: number; unit: string };
}

export class DigitalTwinFoundationPlatform {
  private readonly twins = new Map<string, FoundationTwin>();
  private readonly relationships: FoundationRelationship[] = [];
  private readonly history = new Map<string, FoundationTwin[]>();
  private readonly auditTrail: FoundationAuditEvent[] = [];

  registerTwin(input: Omit<FoundationTwin, 'version' | 'telemetryBindings' | 'controls' | 'dependencies' | 'regulatoryRefs' | 'health' | 'riskScore'> & Partial<Pick<FoundationTwin, 'version' | 'telemetryBindings' | 'controls' | 'dependencies' | 'regulatoryRefs' | 'health' | 'riskScore'>>): FoundationTwin {
    const existing = this.twins.get(input.id);
    const next: FoundationTwin = {
      ...existing,
      ...input,
      state: { ...(existing?.state ?? {}), ...input.state },
      version: existing ? existing.version + 1 : input.version ?? 1,
      telemetryBindings: [...(input.telemetryBindings ?? existing?.telemetryBindings ?? [])],
      controls: [...(input.controls ?? existing?.controls ?? [])],
      dependencies: [...(input.dependencies ?? existing?.dependencies ?? [])],
      regulatoryRefs: [...(input.regulatoryRefs ?? existing?.regulatoryRefs ?? [])],
      health: input.health ?? existing?.health ?? 'healthy',
      riskScore: input.riskScore ?? existing?.riskScore ?? 0,
    };
    this.persist(next, 'registry', existing?.version, ['twin-registration']);
    return this.clone(next);
  }

  relate(relationship: FoundationRelationship): FoundationRelationship {
    if (!this.twins.has(relationship.from) || !this.twins.has(relationship.to)) throw new Error('Digital Twin relationship endpoints must exist');
    this.relationships.push({ ...relationship, evidence: [...relationship.evidence] });
    return { ...relationship, evidence: [...relationship.evidence] };
  }

  synchronize(update: FoundationStateUpdate): FoundationTwin {
    const current = this.twins.get(update.twinId);
    if (!current) throw new Error(`Unknown Digital Twin ${update.twinId}`);
    if (update.expectedVersion !== undefined && current.version !== update.expectedVersion) throw new Error('Digital Twin version conflict');
    const riskScore = this.scoreRisk(current, update);
    const health: FoundationHealth = riskScore >= 60 ? 'critical' : riskScore >= 35 ? 'degraded' : 'healthy';
    const next: FoundationTwin = { ...current, state: { ...current.state, ...update.patch }, updatedAt: update.observedAt, version: current.version + 1, riskScore, health };
    this.persist(next, update.sourceSystem, current.version, update.telemetry ? [`telemetry:${update.telemetry.sensorId}:${update.telemetry.metric}`] : ['state-sync']);
    return this.clone(next);
  }

  bindTelemetry(twinId: string, binding: TelemetryBinding): FoundationTwin {
    const current = this.requireTwin(twinId);
    const next = { ...current, telemetryBindings: [...current.telemetryBindings, { ...binding }], version: current.version + 1 };
    this.persist(next, 'telemetry-binding', current.version, [`sensor:${binding.sensorId}`]);
    return this.clone(next);
  }

  addControlInterface(twinId: string, control: ControlInterface): FoundationTwin {
    const current = this.requireTwin(twinId);
    const next = { ...current, controls: [...current.controls, { ...control, requiredApprovals: [...control.requiredApprovals] }], version: current.version + 1 };
    this.persist(next, 'control-registry', current.version, [`control:${control.id}`]);
    return this.clone(next);
  }

  playback(twinId: string, atOrBefore?: string): FoundationTwin[] {
    return (this.history.get(twinId) ?? []).filter((twin) => !atOrBefore || twin.updatedAt <= atOrBefore).map((twin) => this.clone(twin));
  }

  simulationEnvironment(twinIds: string[], scenario: string) {
    const twins = twinIds.map((id) => this.requireTwin(id));
    return { scenario, twins: twins.map((twin) => this.clone(twin)), controlsIsolated: true, deterministicReplay: true, dependencyGraph: this.dependencyGraph(twinIds) };
  }

  dependencyGraph(seedIds: string[]) {
    const seed = new Set(seedIds);
    return this.relationships.filter((rel) => seed.has(rel.from) || seed.has(rel.to) || rel.type === 'DEPENDS_ON').map((rel) => ({ ...rel, evidence: [...rel.evidence] }));
  }

  audit(twinId?: string): FoundationAuditEvent[] {
    return this.auditTrail.filter((event) => !twinId || event.twinId === twinId).map((event) => ({ ...event, evidence: [...event.evidence] }));
  }

  private requireTwin(id: string) { const twin = this.twins.get(id); if (!twin) throw new Error(`Unknown Digital Twin ${id}`); return twin; }
  private persist(twin: FoundationTwin, actor: string, beforeVersion: number | undefined, evidence: string[]) { this.twins.set(twin.id, twin); this.history.set(twin.id, [...(this.history.get(twin.id) ?? []), this.clone(twin)]); this.auditTrail.push({ id: `audit-${this.auditTrail.length + 1}`, twinId: twin.id, actor, action: 'upsert-state', occurredAt: twin.updatedAt, beforeVersion, afterVersion: twin.version, evidence }); }
  private clone(twin: FoundationTwin): FoundationTwin { return { ...twin, state: { ...twin.state }, geospatial: twin.geospatial ? { ...twin.geospatial } : undefined, telemetryBindings: twin.telemetryBindings.map((b) => ({ ...b })), controls: twin.controls.map((c) => ({ ...c, requiredApprovals: [...c.requiredApprovals] })), dependencies: [...twin.dependencies], regulatoryRefs: [...twin.regulatoryRefs] }; }
  private scoreRisk(twin: FoundationTwin, update: FoundationStateUpdate) { const healthPenalty = twin.health === 'critical' ? 30 : twin.health === 'degraded' ? 15 : 0; const sensorPenalty = update.telemetry && !twin.telemetryBindings.some((b) => b.sensorId === update.telemetry?.sensorId && b.metric === update.telemetry?.metric) ? 20 : 0; const numericPenalty = Object.values(update.patch).reduce<number>((sum, value) => typeof value === 'number' && value > 90 ? sum + Math.min(90, (value - 90) * 0.9) : sum, 0); return Math.min(100, Math.max(0, twin.riskScore * 0.5 + healthPenalty + sensorPenalty + numericPenalty)); }
}
