import { ImmutableAuditLog } from './auditLog.js';
import { CentralizedApprovalService, type ApprovalToken, type ControlledAction, type ControlledActionRequest } from './approvals.js';
import { type ApiServiceDefinition } from './enterpriseApiGateway.js';
import { UniversalEventBus, type RaceDayEvent } from './eventBus.js';
import type { AssetRiskLevel, ControlDefinition, SensorDefinition } from './racetrackControlRegistry.js';
import type { AssetRegistryEventType, RegistryAsset } from './racetrackAssetRegistryService.js';

export type TwinRuntimeHealth = 'healthy' | 'degraded' | 'critical';
export type TwinRuntimeEventType = AssetRegistryEventType | 'telemetry.observed' | 'digital-twin.state.patch' | 'digital-twin.state.updated' | 'digital-twin.health.changed' | 'digital-twin.command.rejected';
export type RuntimeTwinRelationshipType = 'represents' | 'depends-on' | 'located-at' | 'monitored-by' | 'controlled-by' | 'related-to';
export type TwinHealthIndicatorStatus = 'ok' | 'watch' | 'critical';

export interface TwinTelemetryReference { sensorId: string; metric: string; source: string; required: boolean; lastObservedAt?: string; lastValue?: unknown }
export interface TwinRiskIndicator { name: string; level: AssetRiskLevel; score: number; rationale: string; updatedAt: string }
export interface TwinApprovalRequirement { policyId: string; requiredApprovers: string[]; reason: string; requiredFor: string[] }
export interface RuntimeTwinRelationship { fromTwinId: string; toTwinId: string; type: RuntimeTwinRelationshipType; evidence: string[]; updatedAt: string }
export interface TwinHistoryEvent { id: string; eventType: string; occurredAt: string; actor: string; sourceEventId?: string; approvalRequestId?: string; patch: Record<string, unknown>; resultingVersion: number; resultingHealth: TwinRuntimeHealth }
export interface TwinHealthIndicator { name: string; status: TwinHealthIndicatorStatus; value: unknown; rationale: string; updatedAt: string }
export interface TwinSimulation { scenario: string; twinId: string; baselineVersion: number; predictedHealth: TwinRuntimeHealth; projectedRiskScore: number; state: Record<string, unknown>; approvalRequired: boolean; assumptions: string[]; dependencyImpacts: Array<{ twinId: string; health: TwinRuntimeHealth; riskScore: number }> }
export interface TwinSimulationHookResult { patch?: Record<string, unknown>; riskDelta?: number; assumptions?: string[]; approvalRequired?: boolean }
export type TwinSimulationHook = (input: { twin: DigitalTwinRuntimeTwin; scenario: string; patch: Record<string, unknown> }) => TwinSimulationHookResult;

export interface DigitalTwinRuntimeTwin {
  twinId: string;
  assetId: string;
  tenantId?: string;
  name: string;
  assetType: string;
  domain: string;
  state: Record<string, unknown>;
  health: TwinRuntimeHealth;
  telemetryReferences: TwinTelemetryReference[];
  eventHistory: TwinHistoryEvent[];
  dependencies: string[];
  relationships: RuntimeTwinRelationship[];
  riskIndicators: TwinRiskIndicator[];
  healthIndicators: TwinHealthIndicator[];
  approvalRequirements: TwinApprovalRequirement[];
  simulationCapabilities: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TwinQuery { twinId?: string; assetId?: string; tenantId?: string; domain?: string; health?: TwinRuntimeHealth; riskAtLeast?: number; dependsOn?: string }
export interface TwinStatePatch { twinId: string; patch: Record<string, unknown>; actor: string; observedAt?: string; sourceEventId?: string; tenantId?: string; approvalToken?: ApprovalToken; controlledAction?: ControlledAction; command?: boolean; reason?: string; evidence?: string[]; telemetry?: { sensorId: string; metric: string; value: unknown } }
export interface TwinDependencyGraph { generatedAt: string; tenantId?: string; nodes: Array<{ twinId: string; assetId: string; tenantId?: string; name: string; health: TwinRuntimeHealth; riskScore: number; version: number }>; edges: RuntimeTwinRelationship[] }
export interface TwinVisualizationModel { id: string; twinId: string; assetId: string; tenantId?: string; label: string; layer: 'digital-twin'; status: TwinRuntimeHealth; coordinates?: { latitude: number; longitude: number }; version: number; relationshipCount: number; dependencyCount: number; telemetryCount: number; historyEvents: number; approvalRequired: boolean; riskScore: number; lastUpdatedAt: string; properties: Record<string, unknown> }

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const riskScore: Record<AssetRiskLevel, number> = { low: 15, medium: 35, high: 65, critical: 90 };
const assetEvents: AssetRegistryEventType[] = ['racetrack.asset.created', 'racetrack.asset.updated', 'racetrack.asset.archived', 'racetrack.asset.activated', 'racetrack.asset.deactivated', 'racetrack.asset.assigned', 'racetrack.asset.inspected', 'racetrack.asset.approved', 'racetrack.asset.approval-requested', 'racetrack.asset.lifecycle-changed', 'racetrack.asset.risk-classified', 'racetrack.asset.telemetry-bound', 'racetrack.asset.maintenance-recorded'];

export class DigitalTwinRuntime {
  private readonly twins = new Map<string, DigitalTwinRuntimeTwin>();
  private readonly assetIndex = new Map<string, string>();
  private readonly eventBus: UniversalEventBus;
  private readonly auditLog: ImmutableAuditLog;
  private readonly approvals: CentralizedApprovalService;
  private readonly simulationHooks = new Map<string, TwinSimulationHook>();

  constructor(options: { eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog; approvals?: CentralizedApprovalService } = {}) {
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.approvals = options.approvals ?? new CentralizedApprovalService({ eventBus: this.eventBus, auditLog: this.auditLog });
    this.registerEventSchemas();
    this.eventBus.subscribe('*', (event) => this.applyEvent(event), { name: 'digital-twin-runtime', retry: { maxAttempts: 1 } });
  }

  registerAsset(asset: RegistryAsset, actor = 'asset-registry', sourceEventId?: string): DigitalTwinRuntimeTwin {
    const now = asset.updatedAt;
    let twinId = asset.digitalTwin?.twinId ?? this.assetIndex.get(this.assetKey(asset.tenantId, asset.assetId)) ?? `twin:${asset.assetId}`;
    if (this.twins.has(twinId) && this.twins.get(twinId)?.tenantId !== asset.tenantId) twinId = `twin:${asset.tenantId}:${asset.assetId}`;
    const current = this.twins.get(twinId);
    const telemetryReferences = this.telemetryReferences(asset.sensors, current?.telemetryReferences);
    const state = { lifecycleStatus: asset.lifecycleStatus, maintenance: asset.maintenance, location: asset.location, ...asset.state };
    const health = this.calculateOperationalHealth({ riskLevel: asset.riskLevel, maintenanceStatus: asset.maintenance.status, state, telemetryReferences });
    const dependencies = this.dependencies(asset);
    const riskIndicators = [{ name: 'asset-risk', level: asset.riskLevel, score: riskScore[asset.riskLevel], rationale: `Registry risk is ${asset.riskLevel}`, updatedAt: now }];
    const next: DigitalTwinRuntimeTwin = {
      twinId,
      assetId: asset.assetId,
      tenantId: asset.tenantId,
      name: asset.name,
      assetType: asset.assetType,
      domain: asset.domain,
      state,
      health,
      telemetryReferences,
      eventHistory: [...(current?.eventHistory ?? [])],
      dependencies,
      relationships: this.relationships(asset, twinId, now),
      riskIndicators,
      healthIndicators: this.healthIndicators({ state, telemetryReferences, riskIndicators, dependencies, updatedAt: now, health }),
      approvalRequirements: this.approvalsFor(asset.controls, asset.approvalPolicyId),
      simulationCapabilities: ['what-if-state-patch', 'telemetry-spike', 'dependency-outage', 'maintenance-delay'],
      version: (current?.version ?? 0) + 1,
      createdAt: current?.createdAt ?? asset.createdAt,
      updatedAt: now,
    };
    next.eventHistory.push({ id: id('hist'), eventType: current ? 'asset-synchronized' : 'asset-registered', occurredAt: now, actor, sourceEventId, patch: next.state, resultingVersion: next.version, resultingHealth: next.health });
    this.save(next, actor, sourceEventId, asset.regulations.map((r) => r.authority), current?.health);
    return clone(next);
  }

  queryTwins(query: TwinQuery = {}): DigitalTwinRuntimeTwin[] {
    return [...this.twins.values()]
      .filter((twin) => (!query.twinId || twin.twinId === query.twinId)
        && (!query.assetId || twin.assetId === query.assetId)
        && (!query.tenantId || twin.tenantId === query.tenantId)
        && (!query.domain || twin.domain === query.domain)
        && (!query.health || twin.health === query.health)
        && (!query.dependsOn || twin.dependencies.includes(query.dependsOn))
        && (!query.riskAtLeast || Math.max(...twin.riskIndicators.map((r) => r.score), 0) >= query.riskAtLeast))
      .map(clone);
  }

  getTwin(twinId: string): DigitalTwinRuntimeTwin {
    const twin = this.twins.get(twinId);
    if (!twin) throw new Error(`Unknown digital twin ${twinId}`);
    return clone(twin);
  }

  updateState(input: TwinStatePatch): DigitalTwinRuntimeTwin {
    const current = this.requireTwin(input.twinId);
    const updatedAt = input.observedAt ?? new Date().toISOString();
    this.assertTenant(input.tenantId, current);
    const commandApproval = this.commandApproval(input, current, updatedAt);
    const telemetryReferences = input.telemetry ? this.applyTelemetry(current.telemetryReferences, input.telemetry, updatedAt) : current.telemetryReferences;
    const state = { ...current.state, ...input.patch };
    const risk = Math.max(...current.riskIndicators.map((r) => r.score), 0);
    const health = this.calculateOperationalHealth({ state, telemetryReferences, riskScore: risk });
    const next: DigitalTwinRuntimeTwin = {
      ...current,
      state,
      telemetryReferences,
      health,
      healthIndicators: this.healthIndicators({ state, telemetryReferences, riskIndicators: current.riskIndicators, dependencies: current.dependencies, updatedAt, health }),
      version: current.version + 1,
      updatedAt,
      eventHistory: [...current.eventHistory, {
        id: id('hist'),
        eventType: input.telemetry ? 'telemetry-observed' : commandApproval ? 'state-command-applied' : 'state-synchronized',
        occurredAt: updatedAt,
        actor: input.actor,
        sourceEventId: input.sourceEventId,
        approvalRequestId: commandApproval?.requestId,
        patch: clone(input.patch),
        resultingVersion: current.version + 1,
        resultingHealth: health,
      }],
    };
    this.save(next, input.actor, input.sourceEventId, [], current.health, commandApproval?.requestId);
    return clone(next);
  }

  requestStateChangeApproval(input: { twinId: string; tenantId: string; requestedBy: string; actorType: 'human' | 'ai-agent' | 'service'; reason: string; evidence: string[]; action?: ControlledAction; now?: string }): ControlledActionRequest {
    this.assertTenant(input.tenantId, this.requireTwin(input.twinId));
    return this.approvals.createRequest({ tenantId: input.tenantId, action: input.action ?? 'safety-critical-control', target: input.twinId, requestedBy: input.requestedBy, actorType: input.actorType, reason: input.reason, evidence: input.evidence, now: input.now });
  }

  replayHistory(twinId: string, atOrBefore?: string): TwinHistoryEvent[] {
    return this.requireTwin(twinId).eventHistory.filter((event) => !atOrBefore || event.occurredAt <= atOrBefore).map(clone);
  }

  viewRelationships(twinId: string): RuntimeTwinRelationship[] {
    const twin = this.requireTwin(twinId);
    return twin.relationships.concat([...this.twins.values()].flatMap((candidate) => candidate.relationships.filter((rel) => rel.toTwinId === twinId && rel.fromTwinId !== twinId))).map(clone);
  }

  calculateOperationalHealth(input: { riskLevel?: AssetRiskLevel; maintenanceStatus?: string; state?: Record<string, unknown>; telemetryReferences?: TwinTelemetryReference[]; riskScore?: number }): TwinRuntimeHealth {
    const score = input.riskScore ?? (input.riskLevel ? riskScore[input.riskLevel] : 0);
    const maintenance = (input.state?.maintenance as { status?: string } | undefined)?.status;
    const badMaintenance = ['overdue', 'out-of-service'].includes(String(input.maintenanceStatus ?? maintenance ?? input.state?.maintenanceStatus ?? '').toLowerCase());
    const staleRequiredTelemetry = input.telemetryReferences?.some((ref) => ref.required && !ref.lastObservedAt) ?? false;
    const numericStress = Object.values(input.state ?? {}).some((value) => typeof value === 'number' && value >= 90);
    return score >= 85 || badMaintenance || numericStress ? 'critical' : score >= 50 || staleRequiredTelemetry ? 'degraded' : 'healthy';
  }

  registerSimulationHook(name: string, hook: TwinSimulationHook): () => void {
    this.simulationHooks.set(name, hook);
    return () => { this.simulationHooks.delete(name); };
  }

  simulate(twinId: string, scenario: string, patch: Record<string, unknown> = {}): TwinSimulation {
    const twin = this.requireTwin(twinId);
    const hookResults = [...this.simulationHooks.values()].map((hook) => hook({ twin: clone(twin), scenario, patch: clone(patch) }));
    const hookPatch = Object.assign({}, ...hookResults.map((result) => result.patch ?? {}));
    const state = { ...twin.state, ...patch, ...hookPatch };
    const dependencyImpacts = this.dependencyGraph([twinId], twin.tenantId).nodes
      .filter((node) => node.twinId !== twinId)
      .map((node) => ({ twinId: node.twinId, health: node.health, riskScore: node.riskScore }));
    const projectedRiskScore = Math.min(100, Math.max(...twin.riskIndicators.map((risk) => risk.score), 0)
      + (Object.values({ ...patch, ...hookPatch }).some((value) => typeof value === 'number' && value >= 90) ? 20 : 0)
      + hookResults.reduce((sum, result) => sum + (result.riskDelta ?? 0), 0)
      + dependencyImpacts.filter((node) => node.health === 'critical').length * 10);
    return {
      scenario,
      twinId,
      baselineVersion: twin.version,
      state,
      projectedRiskScore,
      predictedHealth: this.calculateOperationalHealth({ state, riskScore: projectedRiskScore, telemetryReferences: twin.telemetryReferences }),
      approvalRequired: twin.approvalRequirements.length > 0 || hookResults.some((result) => result.approvalRequired),
      assumptions: ['Read-only simulation; controls remain isolated.', 'Dependency health is evaluated from current runtime state.', ...hookResults.flatMap((result) => result.assumptions ?? [])],
      dependencyImpacts,
    };
  }

  dependencyGraph(seedTwinIds: string[] = [], tenantId?: string): TwinDependencyGraph {
    const seeds = new Set(seedTwinIds);
    const includeAll = seeds.size === 0;
    const traversed = new Set<string>();
    const visit = (twinId: string) => {
      if (traversed.has(twinId)) return;
      traversed.add(twinId);
      const twin = this.twins.get(twinId);
      if (!twin) return;
      for (const dep of twin.dependencies) if (this.twins.has(dep)) visit(dep);
    };
    if (includeAll) {
      for (const twin of this.twins.values()) if (!tenantId || twin.tenantId === tenantId) visit(twin.twinId);
    } else {
      for (const twinId of seeds) visit(twinId);
    }
    const nodes: TwinDependencyGraph['nodes'] = [];
    for (const twinId of traversed) {
      const twin = this.twins.get(twinId);
      if (twin && (!tenantId || twin.tenantId === tenantId)) nodes.push({ twinId: twin.twinId, assetId: twin.assetId, tenantId: twin.tenantId, name: twin.name, health: twin.health, riskScore: Math.max(...twin.riskIndicators.map((risk) => risk.score), 0), version: twin.version });
    }
    const nodeIds = new Set(nodes.map((node) => node.twinId));
    const edges = [...this.twins.values()].flatMap((twin) => twin.relationships).filter((rel) => nodeIds.has(rel.fromTwinId) && (nodeIds.has(rel.toTwinId) || includeAll));
    return { generatedAt: new Date().toISOString(), tenantId, nodes, edges: edges.map(clone) };
  }

  visualizationModels(query: TwinQuery = {}): TwinVisualizationModel[] {
    return this.queryTwins(query).map((twin) => {
      const loc = twin.state.location as Record<string, unknown> | undefined;
      const lat = Number(loc?.latitude ?? loc?.lat);
      const lon = Number(loc?.longitude ?? loc?.lon);
      return {
        id: `twin:${twin.twinId}`,
        twinId: twin.twinId,
        assetId: twin.assetId,
        tenantId: twin.tenantId,
        label: twin.name,
        layer: 'digital-twin',
        status: twin.health,
        coordinates: Number.isFinite(lat) && Number.isFinite(lon) ? { latitude: lat, longitude: lon } : undefined,
        version: twin.version,
        relationshipCount: this.viewRelationships(twin.twinId).length,
        dependencyCount: twin.dependencies.length,
        telemetryCount: twin.telemetryReferences.length,
        historyEvents: twin.eventHistory.length,
        approvalRequired: twin.approvalRequirements.length > 0,
        riskScore: Math.max(...twin.riskIndicators.map((risk) => risk.score), 0),
        lastUpdatedAt: twin.updatedAt,
        properties: { assetType: twin.assetType, domain: twin.domain, healthIndicators: twin.healthIndicators, simulationCapabilities: twin.simulationCapabilities },
      };
    });
  }

  auditTrail(twinId?: string) {
    return this.auditLog.forensicTimeline({ subjectId: twinId });
  }

  apiDefinition(): ApiServiceDefinition {
    return {
      id: 'digital-twin-runtime',
      name: 'Digital Twin Runtime',
      domain: 'digital-twin',
      version: 'v1',
      basePath: '/api/v1/twins',
      description: 'Runtime APIs for tenant-scoped asset twins, approved state commands, synchronization, history replay, relationships, dependency graphs, simulations, and operational health.',
      owner: { team: 'racetrack-platform', productOwner: 'Director of Operations Technology', technicalOwner: 'Digital Twin Runtime Owner', supportChannel: '#trackmind-twins' },
      lifecycle: 'active',
      auth: ['jwt', 'oauth2', 'mtls'],
      rateLimit: { requests: 900, perSeconds: 60, burst: 150 },
      tags: ['digital-twin', 'assets', 'telemetry', 'approval', 'audit'],
      slo: { availability: 99.95, latencyMs: 200 },
      endpoints: [
        { method: 'GET', path: '/', summary: 'Query twins', scopes: ['twins:read'] },
        { method: 'GET', path: '/{twinId}', summary: 'Get a twin', scopes: ['twins:read'] },
        { method: 'POST', path: '/{twinId}/state-approval', summary: 'Request approval for a state-changing twin command', scopes: ['twins:write'] },
        { method: 'PATCH', path: '/{twinId}/state', summary: 'Apply an approved twin state command or synchronization patch', scopes: ['twins:write'] },
        { method: 'GET', path: '/{twinId}/history', summary: 'Replay twin history', scopes: ['twins:read'] },
        { method: 'GET', path: '/{twinId}/relationships', summary: 'View twin relationships', scopes: ['twins:read'] },
        { method: 'GET', path: '/dependency-graph', summary: 'Render tenant-scoped dependency graph', scopes: ['twins:read'] },
        { method: 'GET', path: '/visualization-models', summary: 'Render asset visualization models for maps', scopes: ['twins:read'] },
        { method: 'GET', path: '/{twinId}/health', summary: 'Calculate operational health', scopes: ['twins:read'] },
        { method: 'POST', path: '/{twinId}:simulate', summary: 'Run isolated what-if simulation', scopes: ['twins:simulate'] },
      ],
    };
  }

  private async applyEvent(event: RaceDayEvent): Promise<void> {
    const payload = event.payload as { asset?: RegistryAsset; twinId?: string; patch?: Record<string, unknown>; sensorId?: string; metric?: string; value?: unknown; observedAt?: string; actor?: string; tenantId?: string; approvalToken?: ApprovalToken; controlledAction?: ControlledAction; command?: boolean; reason?: string; evidence?: string[] };
    if (assetEvents.includes(event.type as AssetRegistryEventType) && payload.asset) this.registerAsset(payload.asset, String(payload.actor ?? event.lineage.producer), event.id);
    if (event.type === 'digital-twin.state.patch' && payload.twinId && payload.patch) this.updateState({ twinId: payload.twinId, patch: payload.patch, actor: String(payload.actor ?? event.lineage.producer), observedAt: payload.observedAt ?? event.occurredAt, sourceEventId: event.id, tenantId: payload.tenantId ?? stringMetadata(event.metadata.tenantId), approvalToken: payload.approvalToken, controlledAction: payload.controlledAction, command: payload.command, reason: payload.reason, evidence: payload.evidence });
    if (event.type === 'telemetry.observed' && payload.twinId && payload.sensorId && payload.metric) this.updateState({ twinId: payload.twinId, patch: { [payload.metric]: payload.value }, actor: event.lineage.producer, observedAt: payload.observedAt ?? event.occurredAt, sourceEventId: event.id, tenantId: payload.tenantId ?? stringMetadata(event.metadata.tenantId), telemetry: { sensorId: payload.sensorId, metric: payload.metric, value: payload.value } });
  }

  private save(twin: DigitalTwinRuntimeTwin, actor: string, sourceEventId?: string, regulations: string[] = [], previousHealth?: TwinRuntimeHealth, approvalRequestId?: string) {
    this.twins.set(twin.twinId, clone(twin));
    this.assetIndex.set(this.assetKey(twin.tenantId, twin.assetId), twin.twinId);
    const correlationId = sourceEventId ?? approvalRequestId ?? `${twin.twinId}:v${twin.version}`;
    const evidence = [...new Set([sourceEventId, approvalRequestId, ...twin.riskIndicators.map((indicator) => indicator.name), ...twin.relationships.flatMap((relationship) => relationship.evidence)].filter((item): item is string => Boolean(item)))];
    const racetrackId = twinRacetrackRef(twin);
    const audit = this.auditLog.append({
      id: id('audit'),
      type: 'digital-twin-update',
      actor,
      actorType: actor === 'system' ? 'system' : 'service',
      timestamp: twin.updatedAt,
      action: 'digital-twin.state.updated',
      actionClass: 'twin',
      payload: { twinId: twin.twinId, assetId: twin.assetId, version: twin.version, sourceEventId, approvalRequestId, racetrackId },
      subjectId: twin.twinId,
      target: twin.twinId,
      tenantId: twin.tenantId,
      correlationId,
      severity: twin.health === 'critical' ? 'critical' : twin.health === 'degraded' ? 'warning' : 'info',
      regulations,
      evidenceIds: evidence,
    });
    void this.eventBus.publish({
      type: 'digital-twin.state.updated',
      payload: { twinId: twin.twinId, assetId: twin.assetId, tenantId: twin.tenantId, racetrackId, health: twin.health, version: twin.version, sourceEventId, approvalRequestId, auditRef: audit.id, digitalTwinRef: twin.twinId, evidence },
      aggregateId: twin.twinId,
      correlationId,
      producer: 'digital-twin-runtime',
      tenantId: twin.tenantId,
      racetrackId,
      actor: { id: actor, type: actor === 'system' ? 'system' : 'service' },
      subject: { id: twin.twinId, type: 'digital-twin', tenantId: twin.tenantId ?? 'unknown-tenant' },
      evidence,
      auditRef: audit.id,
      digitalTwinRef: twin.twinId,
      approvalRef: approvalRequestId,
      metadata: { tenantId: twin.tenantId, racetrackId, compliance: approvalRequestId ? 'regulated' : 'internal', team: 'racetrack-platform', accountableRole: 'digital-twin-runtime-owner', regulations },
    });
    if (previousHealth && previousHealth !== twin.health) void this.eventBus.publish({
      type: 'digital-twin.health.changed',
      payload: { twinId: twin.twinId, tenantId: twin.tenantId, racetrackId, previousHealth, health: twin.health, version: twin.version, auditRef: audit.id, digitalTwinRef: twin.twinId, evidence },
      aggregateId: twin.twinId,
      correlationId,
      producer: 'digital-twin-runtime',
      tenantId: twin.tenantId,
      racetrackId,
      actor: { id: actor, type: actor === 'system' ? 'system' : 'service' },
      subject: { id: twin.twinId, type: 'digital-twin', tenantId: twin.tenantId ?? 'unknown-tenant' },
      evidence,
      auditRef: audit.id,
      digitalTwinRef: twin.twinId,
      approvalRef: approvalRequestId,
      metadata: { tenantId: twin.tenantId, racetrackId, compliance: twin.health === 'critical' ? 'regulated' : 'internal', team: 'racetrack-platform', accountableRole: 'digital-twin-runtime-owner', regulations },
    });
  }

  private requireTwin(twinId: string) {
    const twin = this.twins.get(twinId);
    if (!twin) throw new Error(`Unknown digital twin ${twinId}`);
    return twin;
  }

  private telemetryReferences(sensors: SensorDefinition[], existing: TwinTelemetryReference[] = []) {
    return sensors.flatMap((sensor) => (sensor.verifies.length ? sensor.verifies : [sensor.type]).map((metric) => {
      const found = existing.find((item) => item.sensorId === sensor.id && item.metric === metric);
      return { sensorId: sensor.id, metric, source: sensor.type, required: sensor.required, lastObservedAt: found?.lastObservedAt, lastValue: found?.lastValue };
    }));
  }

  private applyTelemetry(refs: TwinTelemetryReference[], telemetry: NonNullable<TwinStatePatch['telemetry']>, at: string) {
    return refs.map((ref) => ref.sensorId === telemetry.sensorId && ref.metric === telemetry.metric ? { ...ref, lastObservedAt: at, lastValue: telemetry.value } : ref);
  }

  private dependencies(asset: RegistryAsset) {
    return [...new Set([...(Array.isArray(asset.metadata.dependsOn) ? asset.metadata.dependsOn.map(String) : []), ...(asset.digitalTwin?.graphNodeId ? [asset.digitalTwin.graphNodeId] : [])])];
  }

  private relationships(asset: RegistryAsset, twinId: string, updatedAt: string): RuntimeTwinRelationship[] {
    const location = String(asset.location.sectorId ?? asset.location.zoneId ?? asset.location.facilityId ?? '');
    return [
      { fromTwinId: twinId, toTwinId: asset.assetId, type: 'represents', evidence: ['asset-registry'], updatedAt },
      ...this.dependencies(asset).map((dep) => ({ fromTwinId: twinId, toTwinId: dep, type: 'depends-on' as const, evidence: ['asset-metadata'], updatedAt })),
      ...(location ? [{ fromTwinId: twinId, toTwinId: location, type: 'located-at' as const, evidence: ['asset-location'], updatedAt }] : []),
      ...asset.sensors.map((sensor) => ({ fromTwinId: twinId, toTwinId: sensor.id, type: 'monitored-by' as const, evidence: ['sensor-binding'], updatedAt })),
      ...asset.controls.map((control) => ({ fromTwinId: twinId, toTwinId: control.name, type: 'controlled-by' as const, evidence: ['control-registry'], updatedAt })),
    ];
  }

  private approvalsFor(controls: ControlDefinition[], policyId: string) {
    return controls
      .filter((control) => control.requiresApprovalFrom.length > 0 || control.executionMode !== 'automatic')
      .map((control) => ({ policyId, requiredApprovers: [...control.requiresApprovalFrom], reason: control.description, requiredFor: [control.name, control.executionMode] }));
  }

  private commandApproval(input: TwinStatePatch, current: DigitalTwinRuntimeTwin, now: string): ApprovalToken | undefined {
    const isCommand = Boolean(input.command || input.approvalToken || input.controlledAction || (!input.telemetry && !input.sourceEventId));
    if (!isCommand) return undefined;
    const action = input.controlledAction ?? 'safety-critical-control';
    const tenantId = input.tenantId ?? current.tenantId;
    try {
      if (!tenantId) throw new Error('tenantId is required for approved twin commands');
      this.approvals.assertAuthorized(input.approvalToken, action, current.twinId, tenantId, now);
      return input.approvalToken;
    } catch (error) {
      this.auditCommandRejected(current, input, error instanceof Error ? error.message : String(error), now);
      throw error;
    }
  }

  private auditCommandRejected(twin: DigitalTwinRuntimeTwin, input: TwinStatePatch, reason: string, timestamp: string): void {
    const racetrackId = twinRacetrackRef(twin);
    const evidence = [...new Set([...(input.evidence ?? []), input.sourceEventId, input.approvalToken?.requestId].filter((item): item is string => Boolean(item)))];
    const audit = this.auditLog.append({ id: id('audit'), type: 'digital-twin-update', actor: input.actor, actorType: 'human', timestamp, action: 'digital-twin.command.rejected', actionClass: 'twin', payload: { action: 'digital-twin.command.rejected', twinId: twin.twinId, assetId: twin.assetId, racetrackId, reason, patch: input.patch, sourceEventId: input.sourceEventId, approvalRequestId: input.approvalToken?.requestId }, subjectId: twin.twinId, target: twin.twinId, tenantId: twin.tenantId, correlationId: input.sourceEventId ?? input.approvalToken?.requestId ?? `${twin.twinId}:rejected`, severity: 'warning', regulations: ['HISA', 'ARCI'], evidenceIds: evidence });
    void this.eventBus.publish({ type: 'digital-twin.command.rejected', payload: { twinId: twin.twinId, tenantId: twin.tenantId, racetrackId, actor: input.actor, reason, auditRef: audit.id, digitalTwinRef: twin.twinId, evidence }, aggregateId: twin.twinId, correlationId: audit.correlationId, producer: 'digital-twin-runtime', tenantId: twin.tenantId, racetrackId, actor: { id: input.actor, type: 'human' }, subject: { id: twin.twinId, type: 'digital-twin', tenantId: twin.tenantId ?? 'unknown-tenant' }, evidence, auditRef: audit.id, digitalTwinRef: twin.twinId, approvalRef: input.approvalToken?.requestId, metadata: { tenantId: twin.tenantId, racetrackId, compliance: 'regulated', team: 'racetrack-platform', accountableRole: 'digital-twin-runtime-owner', regulations: ['HISA', 'ARCI'] } });
  }

  private assertTenant(inputTenantId: string | undefined, twin: DigitalTwinRuntimeTwin): void {
    if (inputTenantId && twin.tenantId && inputTenantId !== twin.tenantId) throw new Error('tenant isolation violation');
  }

  private assetKey(tenantId: string | undefined, assetId: string): string {
    return `${tenantId ?? 'global'}:${assetId}`;
  }

  private healthIndicators(input: { state: Record<string, unknown>; telemetryReferences: TwinTelemetryReference[]; riskIndicators: TwinRiskIndicator[]; dependencies: string[]; updatedAt: string; health: TwinRuntimeHealth }): TwinHealthIndicator[] {
    const risk = Math.max(...input.riskIndicators.map((indicator) => indicator.score), 0);
    const stale = input.telemetryReferences.filter((ref) => ref.required && !ref.lastObservedAt).length;
    const maintenance = String((input.state.maintenance as { status?: string } | undefined)?.status ?? input.state.maintenanceStatus ?? 'ok').toLowerCase();
    return [
      { name: 'overall-health', status: input.health === 'critical' ? 'critical' : input.health === 'degraded' ? 'watch' : 'ok', value: input.health, rationale: 'Derived from risk, maintenance, telemetry freshness, and numeric stress.', updatedAt: input.updatedAt },
      { name: 'risk-score', status: risk >= 85 ? 'critical' : risk >= 50 ? 'watch' : 'ok', value: risk, rationale: 'Highest runtime risk indicator score.', updatedAt: input.updatedAt },
      { name: 'telemetry-freshness', status: stale > 0 ? 'watch' : 'ok', value: { required: input.telemetryReferences.filter((ref) => ref.required).length, stale }, rationale: 'Required telemetry bindings should have observations.', updatedAt: input.updatedAt },
      { name: 'maintenance', status: ['overdue', 'out-of-service'].includes(maintenance) ? 'critical' : maintenance === 'due' ? 'watch' : 'ok', value: maintenance, rationale: 'Maintenance status from authoritative asset state.', updatedAt: input.updatedAt },
      { name: 'dependency-count', status: input.dependencies.length > 5 ? 'watch' : 'ok', value: input.dependencies.length, rationale: 'Dependency graph fan-out indicator.', updatedAt: input.updatedAt },
    ];
  }

  private registerEventSchemas() {
    const owner = { service: 'digital-twin-runtime', team: 'racetrack-platform', accountableRole: 'digital-twin-runtime-owner' };
    this.eventBus.registerEvent({ type: 'telemetry.observed', version: 1, description: 'Digital Twin Runtime telemetry observation', owner, payloadFields: ['twinId'], compliance: 'internal' });
    this.eventBus.registerEvent({ type: 'digital-twin.state.patch', version: 1, description: 'Digital Twin Runtime state patch event. Command patches must include an approval token.', owner, payloadFields: ['twinId'], compliance: 'regulated' });
    this.eventBus.registerEvent({ type: 'digital-twin.state.updated', version: 1, description: 'Digital Twin Runtime state updated projection event', owner, payloadFields: ['twinId', 'assetId', 'health', 'version'], compliance: 'internal' });
    this.eventBus.registerEvent({ type: 'digital-twin.health.changed', version: 1, description: 'Digital Twin Runtime health transition event', owner, payloadFields: ['twinId', 'previousHealth', 'health', 'version'], compliance: 'regulated' });
    this.eventBus.registerEvent({ type: 'digital-twin.command.rejected', version: 1, description: 'Digital Twin Runtime rejected unapproved command event', owner, payloadFields: ['twinId', 'actor', 'reason'], compliance: 'regulated' });
  }
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function twinRacetrackRef(twin: DigitalTwinRuntimeTwin): string | undefined {
  const location = twin.state.location;
  if (location && typeof location === 'object' && !Array.isArray(location)) {
    const record = location as Record<string, unknown>;
    return stringMetadata(record.racetrackId) ?? stringMetadata(record.trackId) ?? stringMetadata(record.track) ?? twin.tenantId;
  }
  return twin.tenantId;
}
