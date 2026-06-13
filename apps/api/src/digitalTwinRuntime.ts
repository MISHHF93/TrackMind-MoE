import { ImmutableAuditLog } from './auditLog.js';
import { type ApiServiceDefinition } from './enterpriseApiGateway.js';
import { UniversalEventBus, type RaceDayEvent } from './eventBus.js';
import type { AssetRiskLevel, ControlDefinition, SensorDefinition } from './racetrackControlRegistry.js';
import type { AssetRegistryEventType, RegistryAsset } from './racetrackAssetRegistryService.js';

export type TwinRuntimeHealth = 'healthy' | 'degraded' | 'critical';
export type TwinRuntimeEventType = AssetRegistryEventType | 'telemetry.observed' | 'digital-twin.state.patch';
export type RuntimeTwinRelationshipType = 'represents' | 'depends-on' | 'located-at' | 'monitored-by' | 'controlled-by' | 'related-to';

export interface TwinTelemetryReference { sensorId: string; metric: string; source: string; required: boolean; lastObservedAt?: string; lastValue?: unknown }
export interface TwinRiskIndicator { name: string; level: AssetRiskLevel; score: number; rationale: string; updatedAt: string }
export interface TwinApprovalRequirement { policyId: string; requiredApprovers: string[]; reason: string; requiredFor: string[] }
export interface RuntimeTwinRelationship { fromTwinId: string; toTwinId: string; type: RuntimeTwinRelationshipType; evidence: string[]; updatedAt: string }
export interface TwinHistoryEvent { id: string; eventType: string; occurredAt: string; actor: string; sourceEventId?: string; patch: Record<string, unknown>; resultingVersion: number }
export interface TwinSimulation { scenario: string; twinId: string; baselineVersion: number; predictedHealth: TwinRuntimeHealth; projectedRiskScore: number; state: Record<string, unknown>; approvalRequired: boolean; assumptions: string[] }

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
  approvalRequirements: TwinApprovalRequirement[];
  simulationCapabilities: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TwinQuery { twinId?: string; assetId?: string; tenantId?: string; domain?: string; health?: TwinRuntimeHealth; riskAtLeast?: number; dependsOn?: string }
export interface TwinStatePatch { twinId: string; patch: Record<string, unknown>; actor: string; observedAt?: string; sourceEventId?: string; telemetry?: { sensorId: string; metric: string; value: unknown } }

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const riskScore: Record<AssetRiskLevel, number> = { low: 15, medium: 35, high: 65, critical: 90 };
const assetEvents: AssetRegistryEventType[] = ['racetrack.asset.created', 'racetrack.asset.updated', 'racetrack.asset.archived', 'racetrack.asset.activated', 'racetrack.asset.deactivated', 'racetrack.asset.assigned', 'racetrack.asset.inspected', 'racetrack.asset.approved'];

export class DigitalTwinRuntime {
  private readonly twins = new Map<string, DigitalTwinRuntimeTwin>();
  private readonly assetIndex = new Map<string, string>();
  private readonly eventBus: UniversalEventBus;
  private readonly auditLog: ImmutableAuditLog;

  constructor(options: { eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog } = {}) {
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.registerEventSchemas();
    this.eventBus.subscribe('*', (event) => this.applyEvent(event), { name: 'digital-twin-runtime', retry: { maxAttempts: 1 } });
  }

  registerAsset(asset: RegistryAsset, actor = 'asset-registry', sourceEventId?: string): DigitalTwinRuntimeTwin {
    const now = asset.updatedAt;
    const twinId = asset.digitalTwin?.twinId ?? this.assetIndex.get(asset.assetId) ?? `twin:${asset.assetId}`;
    const current = this.twins.get(twinId);
    const next: DigitalTwinRuntimeTwin = {
      twinId,
      assetId: asset.assetId,
      tenantId: undefined,
      name: asset.name,
      assetType: asset.assetType,
      domain: asset.domain,
      state: { lifecycleStatus: asset.lifecycleStatus, maintenance: asset.maintenance, location: asset.location, ...asset.state },
      health: this.calculateOperationalHealth({ riskLevel: asset.riskLevel, maintenanceStatus: asset.maintenance.status, state: asset.state }),
      telemetryReferences: this.telemetryReferences(asset.sensors, current?.telemetryReferences),
      eventHistory: [...(current?.eventHistory ?? [])],
      dependencies: this.dependencies(asset),
      relationships: this.relationships(asset, twinId, now),
      riskIndicators: [{ name: 'asset-risk', level: asset.riskLevel, score: riskScore[asset.riskLevel], rationale: `Registry risk is ${asset.riskLevel}`, updatedAt: now }],
      approvalRequirements: this.approvals(asset.controls, asset.approvalPolicyId),
      simulationCapabilities: ['what-if-state-patch', 'telemetry-spike', 'dependency-outage', 'maintenance-delay'],
      version: (current?.version ?? 0) + 1,
      createdAt: current?.createdAt ?? asset.createdAt,
      updatedAt: now,
    };
    next.eventHistory.push({ id: id('hist'), eventType: current ? 'asset-synchronized' : 'asset-registered', occurredAt: now, actor, sourceEventId, patch: next.state, resultingVersion: next.version });
    this.save(next, actor, sourceEventId, asset.regulations.map((r) => r.authority));
    return clone(next);
  }

  queryTwins(query: TwinQuery = {}): DigitalTwinRuntimeTwin[] { return [...this.twins.values()].filter((t) => (!query.twinId || t.twinId === query.twinId) && (!query.assetId || t.assetId === query.assetId) && (!query.tenantId || t.tenantId === query.tenantId) && (!query.domain || t.domain === query.domain) && (!query.health || t.health === query.health) && (!query.dependsOn || t.dependencies.includes(query.dependsOn)) && (!query.riskAtLeast || Math.max(...t.riskIndicators.map((r) => r.score), 0) >= query.riskAtLeast)).map(clone); }
  getTwin(twinId: string): DigitalTwinRuntimeTwin { const twin = this.twins.get(twinId); if (!twin) throw new Error(`Unknown digital twin ${twinId}`); return clone(twin); }
  updateState(input: TwinStatePatch): DigitalTwinRuntimeTwin { const current = this.requireTwin(input.twinId); const updatedAt = input.observedAt ?? new Date().toISOString(); const telemetry = input.telemetry ? this.applyTelemetry(current.telemetryReferences, input.telemetry, updatedAt) : current.telemetryReferences; const state = { ...current.state, ...input.patch }; const health = this.calculateOperationalHealth({ state, telemetryReferences: telemetry, riskScore: Math.max(...current.riskIndicators.map((r) => r.score), 0) }); const next = { ...current, state, telemetryReferences: telemetry, health, version: current.version + 1, updatedAt, eventHistory: [...current.eventHistory, { id: id('hist'), eventType: 'state-updated', occurredAt: updatedAt, actor: input.actor, sourceEventId: input.sourceEventId, patch: clone(input.patch), resultingVersion: current.version + 1 }] }; this.save(next, input.actor, input.sourceEventId); return clone(next); }
  replayHistory(twinId: string, atOrBefore?: string): TwinHistoryEvent[] { return this.requireTwin(twinId).eventHistory.filter((e) => !atOrBefore || e.occurredAt <= atOrBefore).map(clone); }
  viewRelationships(twinId: string): RuntimeTwinRelationship[] { const twin = this.requireTwin(twinId); return twin.relationships.concat([...this.twins.values()].flatMap((t) => t.relationships.filter((r) => r.toTwinId === twinId && r.fromTwinId !== twinId))).map(clone); }
  calculateOperationalHealth(input: { riskLevel?: AssetRiskLevel; maintenanceStatus?: string; state?: Record<string, unknown>; telemetryReferences?: TwinTelemetryReference[]; riskScore?: number }): TwinRuntimeHealth { const score = input.riskScore ?? (input.riskLevel ? riskScore[input.riskLevel] : 0); const badMaintenance = ['overdue', 'out-of-service'].includes(String(input.maintenanceStatus ?? input.state?.maintenanceStatus ?? '').toLowerCase()); const staleRequiredTelemetry = input.telemetryReferences?.some((t) => t.required && !t.lastObservedAt) ?? false; const numericStress = Object.values(input.state ?? {}).some((v) => typeof v === 'number' && v >= 90); return score >= 85 || badMaintenance || numericStress ? 'critical' : score >= 50 || staleRequiredTelemetry ? 'degraded' : 'healthy'; }
  simulate(twinId: string, scenario: string, patch: Record<string, unknown> = {}): TwinSimulation { const twin = this.requireTwin(twinId); const state = { ...twin.state, ...patch }; const projectedRiskScore = Math.min(100, Math.max(...twin.riskIndicators.map((r) => r.score), 0) + (Object.values(patch).some((v) => typeof v === 'number' && v >= 90) ? 20 : 0)); return { scenario, twinId, baselineVersion: twin.version, state, projectedRiskScore, predictedHealth: this.calculateOperationalHealth({ state, riskScore: projectedRiskScore, telemetryReferences: twin.telemetryReferences }), approvalRequired: twin.approvalRequirements.length > 0, assumptions: ['Read-only simulation; controls remain isolated.', 'Dependency health is evaluated from current runtime state.'] }; }
  auditTrail(twinId?: string) { return this.auditLog.forensicTimeline({ subjectId: twinId }); }
  apiDefinition(): ApiServiceDefinition { return { id: 'digital-twin-runtime', name: 'Digital Twin Runtime', domain: 'digital-twin', version: 'v1', basePath: '/api/v1/twins', description: 'Runtime APIs for asset twins, state synchronization, history replay, relationships, simulations, and operational health.', owner: { team: 'racetrack-platform', productOwner: 'Director of Operations Technology', technicalOwner: 'Digital Twin Runtime Owner', supportChannel: '#trackmind-twins' }, lifecycle: 'active', auth: ['jwt', 'oauth2', 'mtls'], rateLimit: { requests: 900, perSeconds: 60, burst: 150 }, tags: ['digital-twin', 'assets', 'telemetry', 'audit'], slo: { availability: 99.95, latencyMs: 200 }, endpoints: [{ method: 'GET', path: '/', summary: 'Query twins', scopes: ['twins:read'] }, { method: 'GET', path: '/{twinId}', summary: 'Get a twin', scopes: ['twins:read'] }, { method: 'PATCH', path: '/{twinId}/state', summary: 'Update twin state', scopes: ['twins:write'] }, { method: 'GET', path: '/{twinId}/history', summary: 'Replay twin history', scopes: ['twins:read'] }, { method: 'GET', path: '/{twinId}/relationships', summary: 'View twin relationships', scopes: ['twins:read'] }, { method: 'GET', path: '/{twinId}/health', summary: 'Calculate operational health', scopes: ['twins:read'] }, { method: 'POST', path: '/{twinId}:simulate', summary: 'Run isolated what-if simulation', scopes: ['twins:simulate'] }] }; }

  private async applyEvent(event: RaceDayEvent): Promise<void> { const payload = event.payload as { asset?: RegistryAsset; twinId?: string; patch?: Record<string, unknown>; sensorId?: string; metric?: string; value?: unknown; observedAt?: string; actor?: string }; if (assetEvents.includes(event.type as AssetRegistryEventType) && payload.asset) this.registerAsset(payload.asset, String(payload.actor ?? event.lineage.producer), event.id); if (event.type === 'digital-twin.state.patch' && payload.twinId && payload.patch) this.updateState({ twinId: payload.twinId, patch: payload.patch, actor: String(payload.actor ?? event.lineage.producer), observedAt: payload.observedAt ?? event.occurredAt, sourceEventId: event.id }); if (event.type === 'telemetry.observed' && payload.twinId && payload.sensorId && payload.metric) this.updateState({ twinId: payload.twinId, patch: { [payload.metric]: payload.value }, actor: event.lineage.producer, observedAt: payload.observedAt ?? event.occurredAt, sourceEventId: event.id, telemetry: { sensorId: payload.sensorId, metric: payload.metric, value: payload.value } }); }
  private save(twin: DigitalTwinRuntimeTwin, actor: string, sourceEventId?: string, regulations: string[] = []) { this.twins.set(twin.twinId, clone(twin)); this.assetIndex.set(twin.assetId, twin.twinId); this.auditLog.append({ id: id('audit'), type: 'digital-twin-update', actor, timestamp: twin.updatedAt, payload: { twinId: twin.twinId, assetId: twin.assetId, version: twin.version, sourceEventId }, subjectId: twin.twinId, tenantId: twin.tenantId, correlationId: sourceEventId, severity: twin.health === 'critical' ? 'critical' : twin.health === 'degraded' ? 'warning' : 'info', regulations }); }
  private requireTwin(twinId: string) { const twin = this.twins.get(twinId); if (!twin) throw new Error(`Unknown digital twin ${twinId}`); return twin; }
  private telemetryReferences(sensors: SensorDefinition[], existing: TwinTelemetryReference[] = []) { return sensors.flatMap((s) => (s.verifies.length ? s.verifies : [s.type]).map((metric) => ({ sensorId: s.id, metric, source: s.type, required: s.required, lastObservedAt: existing.find((e) => e.sensorId === s.id && e.metric === metric)?.lastObservedAt, lastValue: existing.find((e) => e.sensorId === s.id && e.metric === metric)?.lastValue }))); }
  private applyTelemetry(refs: TwinTelemetryReference[], telemetry: NonNullable<TwinStatePatch['telemetry']>, at: string) { return refs.map((r) => r.sensorId === telemetry.sensorId && r.metric === telemetry.metric ? { ...r, lastObservedAt: at, lastValue: telemetry.value } : r); }
  private dependencies(asset: RegistryAsset) { return [...new Set([...(Array.isArray(asset.metadata.dependsOn) ? asset.metadata.dependsOn.map(String) : []), ...(asset.digitalTwin?.graphNodeId ? [asset.digitalTwin.graphNodeId] : [])])]; }
  private relationships(asset: RegistryAsset, twinId: string, updatedAt: string): RuntimeTwinRelationship[] { return [{ fromTwinId: twinId, toTwinId: asset.assetId, type: 'represents', evidence: ['asset-registry'], updatedAt }, ...this.dependencies(asset).map((dep) => ({ fromTwinId: twinId, toTwinId: dep, type: 'depends-on' as const, evidence: ['asset-metadata'], updatedAt }))]; }
  private approvals(controls: ControlDefinition[], policyId: string) { return controls.filter((c) => c.requiresApprovalFrom.length > 0 || c.executionMode !== 'automatic').map((c) => ({ policyId, requiredApprovers: [...c.requiresApprovalFrom], reason: c.description, requiredFor: [c.name, c.executionMode] })); }
  private registerEventSchemas() { ['telemetry.observed', 'digital-twin.state.patch'].forEach((type) => this.eventBus.registerEvent({ type, version: 1, description: `Digital Twin Runtime ${type}`, owner: { service: 'digital-twin-runtime', team: 'racetrack-platform', accountableRole: 'digital-twin-runtime-owner' }, payloadFields: ['twinId'], compliance: 'internal' })); }
}
