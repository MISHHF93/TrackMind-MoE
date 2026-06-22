import type {
  DigitalTwinStateDto,
  GatePositionDto,
  NexusActor,
  NexusSubjectReference,
  PlatformHealthWorkspaceDto,
  SurfaceMeasurementDto,
  TUSAssetHealthStateDto,
  TUSAssetRiskLevelDto,
  TUSTwinStandardDto,
} from '@trackmind/shared';
import type { FoundationAuditEvent, FoundationTwin } from './digitalTwinFoundation.js';
import type { DigitalTwinRuntimeTwin, TwinHistoryEvent } from './digitalTwinRuntime.js';
import type { AuditActorType, AuditLogEntry, ChainOfCustodyStep, EvidenceReference } from './auditLog.js';
import type { ComplianceClassification, EventOwner, EventTraceContext, RaceDayEvent } from './eventBus.js';
import type { PlatformTelemetrySignal } from './platformObservability.js';
import type { TelemetryEvent } from './telemetryEngine.js';

type ArtifactHealth = DigitalTwinArtifact['health']['status'];
type ArtifactRisk = DigitalTwinArtifact['risk']['level'];
type ArtifactContext = DigitalTwinArtifact['context'];
type TelemetryContext = TelemetryArtifact['context'];
type SurfaceMeasurementArtifactInput = SurfaceMeasurementDto | { sectorId: string; moisture: number; compaction: number; measuredAt: string; eventId?: string; auditId?: string };

export type TelemetryArtifactQualityDto = 'good' | 'watch' | 'poor' | 'unknown';
export interface ArtifactLineageDto { sourceSystem: string; sourceId?: string; eventId?: string; auditId?: string; producedAt: string; adapter: string; inputs: string[] }
export interface ArtifactEvidenceRefDto { id: string; type: 'event' | 'audit' | 'approval' | 'sensor' | 'lineage' | 'history' | 'relationship' | 'regulatory' | 'source'; label?: string }
export interface DigitalTwinArtifact {
  schemaVersion: 'trackmind.artifact.digital-twin.v1';
  artifactId: string;
  artifactType: 'digital-twin';
  tenantId: string;
  racetrackId: string;
  assetId: string;
  twinId: string;
  timestamp: string;
  state: Record<string, unknown>;
  telemetry: Array<{ sourceSensor: string; metric: string; value?: unknown; unit?: string; quality: TelemetryArtifactQualityDto; observedAt?: string; required: boolean }>;
  health: { status: TUSAssetHealthStateDto; score?: number; indicators: Array<{ name: string; status: TUSAssetHealthStateDto | 'ok' | 'watch'; value: unknown; updatedAt?: string }> };
  risk: { level: TUSAssetRiskLevelDto; score: number; drivers: string[]; evidence: string[] };
  history: Array<{ id: string; type: string; timestamp: string; actor: string; version?: number; evidenceRefs: string[] }>;
  context: { tenantId: string; racetrackId: string; trackId?: string; sectorId?: string; source?: string; mock: boolean };
  lineage: ArtifactLineageDto[];
  evidenceRefs: ArtifactEvidenceRefDto[];
  safeForStateMutation: false;
}
export interface TelemetryArtifact {
  schemaVersion: 'trackmind.artifact.telemetry.v1';
  artifactId: string;
  artifactType: 'telemetry';
  tenantId: string;
  racetrackId: string;
  trackId?: string;
  assetId?: string;
  twinId?: string;
  timestamp: string;
  metric: string;
  unit: string;
  value: unknown;
  quality: TelemetryArtifactQualityDto;
  sourceSensor: string;
  state?: Record<string, unknown>;
  health?: { status: TUSAssetHealthStateDto; score?: number };
  risk?: { level: TUSAssetRiskLevelDto; score: number; drivers: string[]; evidence: string[] };
  context: { tenantId: string; racetrackId: string; trackId?: string; sectorId?: string; source?: string; mock: boolean };
  lineage: ArtifactLineageDto[];
  evidenceRefs: ArtifactEvidenceRefDto[];
  safeForStateMutation: false;
}

export interface ArtifactAdapterContext {
  tenantId?: string;
  racetrackId?: string;
  trackId?: string;
  sectorId?: string;
  assetId?: string;
  twinId?: string;
  source?: string;
  sourceSensor?: string;
  timestamp?: string;
  unit?: string;
  mock?: boolean;
  lineage?: ArtifactLineageDto[];
  evidenceRefs?: ArtifactEvidenceRefDto[];
}

const riskScores: Record<ArtifactRisk, number> = { low: 15, medium: 35, high: 65, critical: 90 };

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

export function runtimeTwinToDigitalTwinArtifact(twin: DigitalTwinRuntimeTwin, context: ArtifactAdapterContext = {}): DigitalTwinArtifact {
  const tenantId = twin.tenantId ?? context.tenantId ?? 'unknown-tenant';
  const racetrackId = context.racetrackId ?? context.trackId ?? tenantId;
  const timestamp = context.timestamp ?? twin.updatedAt;
  const riskScore = Math.max(...twin.riskIndicators.map((risk) => risk.score), 0);
  const riskLevel = riskLevelFromScore(riskScore);
  const artifactContext = contextFor({ ...context, tenantId, racetrackId, sectorId: context.sectorId ?? sectorFromState(twin.state), source: context.source ?? 'digital-twin-runtime' });
  const history = twin.eventHistory.map(historyFromRuntimeEvent);
  const evidenceRefs = uniqueEvidenceRefs([
    ...twin.telemetryReferences.map((ref) => telemetryEvidenceRef(ref.sensorId, 'sensor', ref.metric)),
    ...twin.eventHistory.flatMap((event) => [
      telemetryEvidenceRef(event.id, 'history', event.eventType),
      event.sourceEventId ? telemetryEvidenceRef(event.sourceEventId, 'event') : undefined,
      event.approvalRequestId ? telemetryEvidenceRef(event.approvalRequestId, 'approval') : undefined,
    ]),
    ...twin.relationships.flatMap((relationship) => relationship.evidence.map((id) => telemetryEvidenceRef(id, 'relationship', relationship.type))),
    ...(context.evidenceRefs ?? []),
  ]);

  return clone({
    schemaVersion: 'trackmind.artifact.digital-twin.v1',
    artifactId: artifactId('digital-twin', tenantId, twin.twinId, timestamp),
    artifactType: 'digital-twin',
    tenantId,
    racetrackId,
    assetId: twin.assetId,
    twinId: twin.twinId,
    timestamp,
    state: clone(twin.state),
    telemetry: twin.telemetryReferences.map((ref) => ({
      sourceSensor: ref.sensorId,
      metric: ref.metric,
      value: clone(ref.lastValue),
      quality: ref.required && !ref.lastObservedAt ? 'watch' : 'good',
      observedAt: ref.lastObservedAt,
      required: ref.required,
    })),
    health: {
      status: mapHealth(twin.health),
      score: 100 - riskScore,
      indicators: twin.healthIndicators.map((indicator) => ({ name: indicator.name, status: indicator.status, value: clone(indicator.value), updatedAt: indicator.updatedAt })),
    },
    risk: { level: riskLevel, score: riskScore, drivers: twin.riskIndicators.map((risk) => risk.rationale), evidence: twin.riskIndicators.map((risk) => risk.name) },
    history,
    context: artifactContext,
    lineage: lineageFor(context, artifactContext.source ?? 'digital-twin-runtime', twin.twinId, timestamp, [twin.twinId, twin.assetId, ...history.map((event) => event.id)]),
    evidenceRefs,
    safeForStateMutation: false,
  });
}

export function foundationTwinToDigitalTwinArtifact(twin: FoundationTwin, context: ArtifactAdapterContext = {}, auditEvents: FoundationAuditEvent[] = []): DigitalTwinArtifact {
  const tenantId = twin.tenantId || context.tenantId || 'unknown-tenant';
  const racetrackId = context.racetrackId ?? context.trackId ?? tenantId;
  const timestamp = context.timestamp ?? twin.updatedAt;
  const assetId = String(twin.state.assetId ?? context.assetId ?? twin.id);
  const artifactContext = contextFor({ ...context, tenantId, racetrackId, sectorId: context.sectorId ?? sectorFromState(twin.state), source: context.source ?? 'digital-twin-foundation' });
  const matchingAudit = auditEvents.filter((event) => event.twinId === twin.id);
  const evidenceRefs = uniqueEvidenceRefs([
    ...twin.telemetryBindings.map((binding) => telemetryEvidenceRef(binding.sensorId, 'sensor', binding.metric)),
    ...twin.dependencies.map((dependency) => telemetryEvidenceRef(dependency, 'relationship', 'DEPENDS_ON')),
    ...twin.regulatoryRefs.map((ref) => telemetryEvidenceRef(ref, 'regulatory')),
    ...matchingAudit.flatMap((event) => [telemetryEvidenceRef(event.id, 'audit', event.action), ...event.evidence.map((id) => telemetryEvidenceRef(id, evidenceTypeFromId(id)))]),
    ...(context.evidenceRefs ?? []),
  ]);

  return clone({
    schemaVersion: 'trackmind.artifact.digital-twin.v1',
    artifactId: artifactId('digital-twin', tenantId, twin.id, timestamp),
    artifactType: 'digital-twin',
    tenantId,
    racetrackId,
    assetId,
    twinId: twin.id,
    timestamp,
    state: clone(twin.state),
    telemetry: twin.telemetryBindings.map((binding) => ({
      sourceSensor: binding.sensorId,
      metric: binding.metric,
      unit: binding.unit,
      value: clone(twin.state[binding.metric]),
      quality: twin.state[binding.metric] === undefined ? 'watch' : 'good',
      observedAt: timestamp,
      required: true,
    })),
    health: {
      status: mapHealth(twin.health),
      score: 100 - twin.riskScore,
      indicators: twin.healthIndicators.map((indicator) => ({ name: indicator.name, status: indicator.status, value: clone(indicator.value), updatedAt: indicator.updatedAt })),
    },
    risk: { level: riskLevelFromScore(twin.riskScore), score: twin.riskScore, drivers: ['foundation-risk-score', ...twin.dependencies], evidence: [...twin.regulatoryRefs] },
    history: matchingAudit.map((event) => ({ id: event.id, type: event.action, timestamp: event.occurredAt, actor: event.actor, version: event.afterVersion, evidenceRefs: [...event.evidence] })),
    context: artifactContext,
    lineage: lineageFor(context, artifactContext.source ?? 'digital-twin-foundation', twin.id, timestamp, [twin.id, assetId, ...matchingAudit.map((event) => event.id)]),
    evidenceRefs,
    safeForStateMutation: false,
  });
}

export function digitalTwinStateDtoToDigitalTwinArtifact(state: DigitalTwinStateDto, context: ArtifactAdapterContext = {}): DigitalTwinArtifact {
  const tenantId = context.tenantId ?? 'unknown-tenant';
  const racetrackId = context.racetrackId ?? context.trackId ?? tenantId;
  const timestamp = context.timestamp ?? state.lastUpdatedAt;
  const health = mapHealth(state.health);
  const risk = riskFromHealth(health);
  const artifactContext = contextFor({ ...context, tenantId, racetrackId, sectorId: context.sectorId ?? sectorFromState(state.state), source: context.source ?? 'digital-twin-state-dto', mock: context.mock ?? state.mock });

  return clone({
    schemaVersion: 'trackmind.artifact.digital-twin.v1',
    artifactId: artifactId('digital-twin', tenantId, state.twinId, timestamp),
    artifactType: 'digital-twin',
    tenantId,
    racetrackId,
    assetId: state.assetId,
    twinId: state.twinId,
    timestamp,
    state: clone(state.state),
    telemetry: telemetryFromState(state.state, timestamp),
    health: { status: health, score: 100 - risk.score, indicators: [{ name: 'dto-health', status: health === 'healthy' ? 'ok' : health, value: state.health, updatedAt: state.lastUpdatedAt }] },
    risk,
    history: [{ id: `${state.twinId}:version:${state.version}`, type: 'dto-snapshot', timestamp: state.lastUpdatedAt, actor: artifactContext.source ?? 'digital-twin-state-dto', version: state.version, evidenceRefs: context.evidenceRefs?.map((ref) => ref.id) ?? [] }],
    context: artifactContext,
    lineage: lineageFor(context, artifactContext.source ?? 'digital-twin-state-dto', state.twinId, timestamp, [state.twinId, state.assetId, `version:${state.version}`]),
    evidenceRefs: uniqueEvidenceRefs([...(context.evidenceRefs ?? []), telemetryEvidenceRef(`${state.twinId}:version:${state.version}`, 'history')]),
    safeForStateMutation: false,
  });
}

export function tusTwinToDigitalTwinArtifact(twin: TUSTwinStandardDto, context: ArtifactAdapterContext = {}): DigitalTwinArtifact {
  const tenantId = twin.tenantId || context.tenantId || 'unknown-tenant';
  const racetrackId = twin.racetrackId || context.racetrackId || tenantId;
  const timestamp = context.timestamp ?? twin.source.version?.toString() ?? new Date(0).toISOString();
  const artifactContext = contextFor({ ...context, tenantId, racetrackId, sectorId: context.sectorId ?? sectorFromState(twin.location), source: context.source ?? twin.source.system, mock: context.mock ?? twin.source.mock });

  return {
    schemaVersion: 'trackmind.artifact.digital-twin.v1',
    artifactId: artifactId('digital-twin', tenantId, twin.twinId, timestamp),
    artifactType: 'digital-twin',
    tenantId,
    racetrackId,
    assetId: twin.assetId ?? twin.twinId,
    twinId: twin.twinId,
    timestamp,
    state: clone(twin.state),
    telemetry: twin.telemetry.map((item) => ({ sourceSensor: item.sourceId, metric: item.metric, value: clone(item.value), quality: item.required && !item.lastObservedAt ? 'watch' : 'good', observedAt: item.lastObservedAt, required: item.required })),
    health: { status: twin.health.status, score: twin.health.score, indicators: twin.health.indicators.map((indicator) => ({ ...indicator, value: clone(indicator.value) })) },
    risk: clone(twin.risk),
    history: twin.audit.map((event) => ({ id: event.id, type: event.action, timestamp: event.timestamp, actor: event.actor, evidenceRefs: [...event.evidence] })),
    context: artifactContext,
    lineage: lineageFor(context, artifactContext.source ?? twin.source.system, twin.twinId, timestamp, [twin.twinId, twin.assetId ?? twin.twinId, ...twin.audit.map((event) => event.id)]),
    evidenceRefs: uniqueEvidenceRefs([...twin.audit.flatMap((event) => [telemetryEvidenceRef(event.id, 'audit', event.action), ...event.evidence.map((id) => telemetryEvidenceRef(id, evidenceTypeFromId(id)))]), ...twin.relationships.flatMap((rel) => rel.evidence.map((id) => telemetryEvidenceRef(id, 'relationship', rel.type))), ...(context.evidenceRefs ?? [])]),
    safeForStateMutation: false,
  };
}

export function surfaceMeasurementToTelemetryArtifacts(measurement: SurfaceMeasurementArtifactInput, context: ArtifactAdapterContext = {}): TelemetryArtifact[] {
  return [
    telemetryArtifact('surface.moisture', measurement.moisture, '%', {
      context,
      sourceId: measurement.sectorId,
      timestamp: measurement.measuredAt,
      sourceSensor: context.sourceSensor ?? `surface-probe:${measurement.sectorId}`,
      state: { sectorId: measurement.sectorId, moisture: measurement.moisture },
      risk: surfaceRisk(measurement.moisture, 'moisture', measurement),
      evidence: [measurement.eventId ? telemetryEvidenceRef(measurement.eventId, 'event') : undefined, measurement.auditId ? telemetryEvidenceRef(measurement.auditId, 'audit') : undefined],
      quality: measurement.eventId && measurement.auditId ? 'good' : 'watch',
      sectorId: measurement.sectorId,
    }),
    telemetryArtifact('surface.compaction', measurement.compaction, 'psi', {
      context,
      sourceId: measurement.sectorId,
      timestamp: measurement.measuredAt,
      sourceSensor: context.sourceSensor ?? `surface-probe:${measurement.sectorId}`,
      state: { sectorId: measurement.sectorId, compaction: measurement.compaction },
      risk: surfaceRisk(measurement.compaction, 'compaction', measurement),
      evidence: [measurement.eventId ? telemetryEvidenceRef(measurement.eventId, 'event') : undefined, measurement.auditId ? telemetryEvidenceRef(measurement.auditId, 'audit') : undefined],
      quality: measurement.eventId && measurement.auditId ? 'good' : 'watch',
      sectorId: measurement.sectorId,
    }),
  ];
}

export function trackMapMeasurementsToTelemetryArtifacts(trackMap: { trackId: string; measurements: SurfaceMeasurementArtifactInput[]; mock?: boolean }, context: ArtifactAdapterContext = {}): TelemetryArtifact[] {
  return trackMap.measurements.flatMap((measurement) => surfaceMeasurementToTelemetryArtifacts(measurement, { ...context, trackId: context.trackId ?? trackMap.trackId, mock: context.mock ?? trackMap.mock }));
}

export function gatePositionToTelemetryArtifact(gate: GatePositionDto, context: ArtifactAdapterContext = {}): TelemetryArtifact {
  return telemetryArtifact('gate.gpsVerified', gate.gpsVerified, 'boolean', {
    context: { ...context, assetId: context.assetId ?? gate.gateId, source: context.source ?? 'starting-gate-position-dto', mock: context.mock ?? gate.mock },
    sourceId: gate.gateId,
    timestamp: context.timestamp ?? new Date(0).toISOString(),
    sourceSensor: context.sourceSensor ?? `${gate.gateId}:gps`,
    state: { sectorId: gate.sectorId, metersFromStart: gate.metersFromStart, gpsVerified: gate.gpsVerified },
    health: { status: gate.gpsVerified ? 'healthy' : 'degraded', score: gate.gpsVerified ? 100 : 50 },
    risk: { level: gate.gpsVerified ? 'low' : 'high', score: gate.gpsVerified ? 15 : 65, drivers: ['gps-verification'], evidence: [gate.lastApprovedRequestId].filter((item): item is string => Boolean(item)) },
    evidence: [gate.lastApprovedRequestId ? telemetryEvidenceRef(gate.lastApprovedRequestId, 'approval') : undefined, telemetryEvidenceRef(gate.gateId, 'source', 'gate-position')],
    quality: gate.gpsVerified ? 'good' : 'poor',
    sectorId: gate.sectorId,
  });
}

export function platformHealthSignalToTelemetryArtifact(signal: PlatformTelemetrySignal | PlatformHealthWorkspaceDto['signals'][number], context: ArtifactAdapterContext = {}): TelemetryArtifact {
  const value = signalValue(signal);
  const quality = qualityFromSeverity(signal.severity);
  return telemetryArtifact(signal.name, value, unitFromValue(value), {
    context: { ...context, source: context.source ?? 'platform-observability', mock: context.mock ?? false },
    sourceId: signal.serviceId,
    timestamp: signal.timestamp,
    sourceSensor: context.sourceSensor ?? signal.serviceId,
    state: { kind: signal.kind, serviceId: signal.serviceId, severity: signal.severity, traceId: signal.traceId, spanId: signal.spanId, attributes: clone(signal.attributes) },
    health: { status: quality === 'poor' ? 'critical' : quality === 'watch' ? 'degraded' : 'healthy', score: quality === 'poor' ? 25 : quality === 'watch' ? 65 : 100 },
    risk: { level: quality === 'poor' ? 'critical' : quality === 'watch' ? 'medium' : 'low', score: quality === 'poor' ? 90 : quality === 'watch' ? 35 : 15, drivers: [signal.kind, signal.severity], evidence: [signal.traceId] },
    evidence: [telemetryEvidenceRef(signal.traceId, 'lineage', 'trace'), signal.spanId ? telemetryEvidenceRef(signal.spanId, 'lineage', 'span') : undefined],
    quality,
  });
}

export function telemetryEventToTelemetryArtifacts(event: TelemetryEvent, context: ArtifactAdapterContext = {}): TelemetryArtifact[] {
  return Object.entries(event.payload)
    .filter(([, value]) => isPrimitive(value))
    .map(([metric, value]) => telemetryArtifact(metric, value, unitFromMetric(metric), {
      context: { ...context, source: context.source ?? `telemetry-engine:${event.source}` },
      sourceId: event.subjectId,
      timestamp: event.observedAt,
      sourceSensor: context.sourceSensor ?? `${event.source}:${event.subjectId}`,
      state: { source: event.source, subjectId: event.subjectId },
      evidence: [telemetryEvidenceRef(event.id, 'event')],
      quality: 'good',
    }));
}

function telemetryArtifact(metric: string, value: unknown, unit: string, input: { context: ArtifactAdapterContext; sourceId: string; timestamp: string; sourceSensor: string; state?: Record<string, unknown>; health?: TelemetryArtifact['health']; risk?: NonNullable<TelemetryArtifact['risk']>; evidence?: Array<ArtifactEvidenceRefDto | undefined>; quality?: TelemetryArtifactQualityDto; sectorId?: string }): TelemetryArtifact {
  const tenantId = input.context.tenantId ?? 'unknown-tenant';
  const racetrackId = input.context.racetrackId ?? input.context.trackId ?? tenantId;
  const artifactContext = telemetryContextFor({ ...input.context, tenantId, racetrackId, sectorId: input.sectorId ?? input.context.sectorId, source: input.context.source ?? 'telemetry-artifact-adapter' });
  const evidenceRefs = uniqueEvidenceRefs([...(input.evidence ?? []), ...(input.context.evidenceRefs ?? []), telemetryEvidenceRef(input.sourceSensor, 'sensor', metric)]);
  return {
    schemaVersion: 'trackmind.artifact.telemetry.v1',
    artifactId: artifactId('telemetry', tenantId, input.sourceId, metric, input.timestamp),
    artifactType: 'telemetry',
    tenantId,
    racetrackId,
    trackId: artifactContext.trackId,
    assetId: input.context.assetId,
    twinId: input.context.twinId,
    timestamp: input.timestamp,
    metric,
    unit,
    value: clone(value),
    quality: input.quality ?? 'unknown',
    sourceSensor: input.sourceSensor,
    state: input.state ? clone(input.state) : undefined,
    health: input.health,
    risk: input.risk,
    context: artifactContext,
    lineage: lineageFor(input.context, artifactContext.source ?? 'telemetry-artifact-adapter', input.sourceId, input.timestamp, [input.sourceId, metric, ...evidenceRefs.map((ref) => ref.id)]),
    evidenceRefs,
    safeForStateMutation: false,
  };
}

function historyFromRuntimeEvent(event: TwinHistoryEvent): DigitalTwinArtifact['history'][number] {
  return {
    id: event.id,
    type: event.eventType,
    timestamp: event.occurredAt,
    actor: event.actor,
    version: event.resultingVersion,
    evidenceRefs: [event.sourceEventId, event.approvalRequestId].filter((item): item is string => Boolean(item)),
  };
}

function telemetryFromState(state: Record<string, unknown>, timestamp: string): DigitalTwinArtifact['telemetry'] {
  const gate = objectValue(state.gatePosition);
  if (gate) {
    return [
      { sourceSensor: String(gate.gateId ?? 'gate-position'), metric: 'gate.gpsVerified', value: gate.gpsVerified, unit: 'boolean', quality: gate.gpsVerified === true ? 'good' : 'watch', observedAt: timestamp, required: true },
      { sourceSensor: String(gate.gateId ?? 'gate-position'), metric: 'gate.metersFromStart', value: gate.metersFromStart, unit: 'meters', quality: 'good', observedAt: timestamp, required: true },
    ];
  }
  return [];
}

function contextFor(context: ArtifactAdapterContext & { tenantId: string; racetrackId: string }): ArtifactContext {
  return { tenantId: context.tenantId, racetrackId: context.racetrackId, trackId: context.trackId, sectorId: context.sectorId, source: context.source, mock: context.mock ?? false };
}

function telemetryContextFor(context: ArtifactAdapterContext & { tenantId: string; racetrackId: string }): TelemetryContext {
  return { tenantId: context.tenantId, racetrackId: context.racetrackId, trackId: context.trackId, sectorId: context.sectorId, source: context.source, mock: context.mock ?? false };
}

function lineageFor(context: ArtifactAdapterContext, sourceSystem: string, sourceId: string, producedAt: string, inputs: string[]): ArtifactLineageDto[] {
  return [
    ...(context.lineage ?? []),
    { sourceSystem, sourceId, producedAt, adapter: 'trackmind-artifact-adapters', inputs: [...new Set(inputs.filter(Boolean))] },
  ];
}

function telemetryEvidenceRef(id: string, type: ArtifactEvidenceRefDto['type'], label?: string): ArtifactEvidenceRefDto {
  return { id, type, label };
}

function uniqueEvidenceRefs(refs: Array<ArtifactEvidenceRefDto | undefined>): ArtifactEvidenceRefDto[] {
  return [...new Map(refs.filter((ref): ref is ArtifactEvidenceRefDto => Boolean(ref?.id)).map((ref) => [`${ref.type}:${ref.id}`, ref])).values()];
}

function evidenceTypeFromId(id: string): ArtifactEvidenceRefDto['type'] {
  const value = id.toLowerCase();
  if (value.includes('audit')) return 'audit';
  if (value.includes('approval')) return 'approval';
  if (value.includes('event') || value.startsWith('evt')) return 'event';
  if (value.includes('sensor')) return 'sensor';
  if (value.includes('history') || value.includes('hist')) return 'history';
  return 'source';
}

function mapHealth(health: string): ArtifactHealth {
  const value = health.toLowerCase();
  if (value === 'critical' || value === 'offline' || value === 'blocked') return 'critical';
  if (value === 'degraded' || value === 'warning' || value === 'watch') return 'degraded';
  if (value === 'healthy' || value === 'ok' || value === 'ready' || value === 'online' || value === 'standby') return 'healthy';
  return 'unknown';
}

function riskFromHealth(health: ArtifactHealth): DigitalTwinArtifact['risk'] {
  const level: ArtifactRisk = health === 'critical' ? 'critical' : health === 'degraded' ? 'high' : health === 'unknown' ? 'medium' : 'low';
  return { level, score: riskScores[level], drivers: ['health-status'], evidence: [] };
}

function riskLevelFromScore(score: number): ArtifactRisk {
  return score >= 85 ? 'critical' : score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
}

function surfaceRisk(value: number, metric: 'moisture' | 'compaction', measurement: SurfaceMeasurementArtifactInput): NonNullable<TelemetryArtifact['risk']> {
  const outsideTarget = metric === 'moisture' ? Math.abs(value - 18) : Math.abs(value - 240);
  const level = outsideTarget >= (metric === 'moisture' ? 10 : 40) ? 'high' : outsideTarget >= (metric === 'moisture' ? 5 : 20) ? 'medium' : 'low';
  return { level, score: riskScores[level], drivers: [`surface-${metric}`, `sector:${measurement.sectorId}`], evidence: [measurement.eventId, measurement.auditId].filter((item): item is string => Boolean(item)) };
}

function sectorFromState(state: Record<string, unknown>): string | undefined {
  const location = objectValue(state.location);
  const sector = state.sectorId ?? location?.sectorId ?? objectValue(state.gatePosition)?.sectorId;
  return typeof sector === 'string' ? sector : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function signalValue(signal: PlatformTelemetrySignal | PlatformHealthWorkspaceDto['signals'][number]): unknown {
  for (const key of ['latencyMs', 'eventsPerMinute', 'deadLetters', 'reportedErrors']) {
    const value = signal.attributes[key];
    if (typeof value === 'number') return value;
  }
  return signal.severity;
}

function qualityFromSeverity(severity: string): TelemetryArtifactQualityDto {
  return ['critical', 'error'].includes(severity) ? 'poor' : severity === 'warning' ? 'watch' : 'good';
}

function unitFromValue(value: unknown): string {
  return typeof value === 'number' ? 'count' : 'status';
}

function unitFromMetric(metric: string): string {
  const lower = metric.toLowerCase();
  if (lower.includes('moisture') || lower.includes('percent')) return '%';
  if (lower.includes('compaction')) return 'psi';
  if (lower.includes('latency')) return 'ms';
  if (lower.includes('temperature')) return 'fahrenheit';
  if (lower.includes('gps') || lower.includes('verified')) return 'boolean';
  return 'value';
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function artifactId(kind: string, ...parts: Array<string | number | undefined>): string {
  return [kind, ...parts.map((part) => String(part ?? 'unknown'))].join(':').replace(/[^a-zA-Z0-9:._-]/g, '-');
}

export const EVENT_ARTIFACT_SCHEMA_VERSION = 'trackmind.event-artifact.v1';
export const AUDIT_ARTIFACT_SCHEMA_VERSION = 'trackmind.audit-artifact.v1';
export const EVENT_AUDIT_LINK_SCHEMA_VERSION = 'trackmind.event-audit-link.v1';

export interface ArtifactHashChain {
  previousHash: string;
  hash: string;
}

export interface ArtifactActor {
  id: string;
  type?: string;
  roles?: string[];
}

export interface ArtifactLinkage {
  tenantId?: string;
  racetrackId?: string;
  subjectId?: string;
  assetId?: string;
  correlationId?: string;
  causationId?: string;
  eventRefs: string[];
  auditRefs: string[];
  approvalRefs: string[];
  workflowRefs: string[];
  digitalTwinRefs: string[];
  evidenceIds: string[];
}

export interface EventArtifact<T = unknown> {
  schemaVersion: typeof EVENT_ARTIFACT_SCHEMA_VERSION;
  artifactType: 'event';
  id: string;
  eventId: string;
  eventType: string;
  version: number;
  schemaRef: string;
  occurredAt: string;
  tenantId?: string;
  racetrackId?: string;
  correlationId: string;
  causationId?: string;
  parentEventIds: string[];
  aggregateId?: string;
  assetId?: string;
  actor?: NexusActor;
  subject?: NexusSubjectReference;
  owner: EventOwner;
  compliance: ComplianceClassification;
  producer: string;
  sequence: number;
  trace: EventTraceContext;
  payload: T;
  metadata: Record<string, unknown>;
  evidence: string[];
  auditRefs: string[];
  digitalTwinRefs: string[];
  approvalRefs: string[];
  workflowRefs: string[];
  linkage: ArtifactLinkage;
  hashChain?: ArtifactHashChain;
}

export interface AuditArtifact {
  schemaVersion: typeof AUDIT_ARTIFACT_SCHEMA_VERSION;
  artifactType: 'audit';
  id: string;
  auditId: string;
  auditType: AuditLogEntry['type'];
  action?: string;
  actionClass?: AuditLogEntry['actionClass'];
  target?: string;
  decision?: AuditLogEntry['decision'];
  timestamp: string;
  actor: ArtifactActor;
  sourceService?: string;
  apiRoute?: string;
  tenantId?: string;
  subjectId?: string;
  assetId?: string;
  workflowId?: string;
  correlationId?: string;
  causationId?: string;
  severity?: AuditLogEntry['severity'];
  regulations: string[];
  payload: unknown;
  evidenceIds: string[];
  evidence: EvidenceReference[];
  custody: ChainOfCustodyStep[];
  eventRefs: string[];
  auditRefs: string[];
  approvalRefs: string[];
  workflowRefs: string[];
  digitalTwinRefs: string[];
  linkage: ArtifactLinkage;
  hashChain: ArtifactHashChain;
  legalHold?: boolean;
  retainedUntil?: string;
}

export interface EventAuditArtifactLink {
  schemaVersion: typeof EVENT_AUDIT_LINK_SCHEMA_VERSION;
  eventId: string;
  auditId: string;
  correlationId?: string;
  causationId?: string;
  tenantId?: string;
  assetId?: string;
  evidenceIds: string[];
  digitalTwinRefs: string[];
  auditHashChain: ArtifactHashChain;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const record = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {};
const stringValue = (value: unknown): string | undefined => typeof value === 'string' && value.length > 0 ? value : undefined;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
const uniqueDefined = (values: Array<string | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)))];

function nestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  return record(source[key]);
}

function idsFromEvidence(evidence: EvidenceReference[] | undefined): string[] {
  return evidence?.map((item) => item.id).filter((id): id is string => Boolean(id)) ?? [];
}

function nestedAssetId(source: Record<string, unknown>): string | undefined {
  const asset = nestedRecord(source, 'asset');
  return stringValue(source.assetId)
    ?? stringValue(source.asset)
    ?? stringValue(asset.assetId)
    ?? stringValue(asset.id);
}

function digitalTwinRefsFrom(...sources: Record<string, unknown>[]): string[] {
  const refs = sources.flatMap((source) => {
    const asset = nestedRecord(source, 'asset');
    const assetTwin = nestedRecord(asset, 'digitalTwin');
    return [
      stringValue(source.digitalTwinRef),
      stringValue(source.twinId),
      stringValue(source.digitalTwinId),
      stringValue(asset.digitalTwinRef),
      stringValue(asset.twinId),
      stringValue(assetTwin.twinId),
      ...strings(source.digitalTwinRefs),
      ...strings(asset.digitalTwinRefs),
    ];
  });
  return uniqueDefined(refs);
}

function auditRefsFrom(...sources: Record<string, unknown>[]): string[] {
  return uniqueDefined(sources.flatMap((source) => [
    stringValue(source.auditRef),
    stringValue(source.auditId),
    ...strings(source.auditRefs),
    ...strings(source.auditIds),
  ]));
}

function approvalRefsFrom(...sources: Record<string, unknown>[]): string[] {
  return uniqueDefined(sources.flatMap((source) => [
    stringValue(source.approvalRef),
    stringValue(source.approvalId),
    stringValue(source.approvalRequestId),
    stringValue(source.requestId),
    ...strings(source.approvalRefs),
    ...strings(source.approvalIds),
    ...strings(source.approvalRequestIds),
  ]));
}

function workflowRefsFrom(...sources: Record<string, unknown>[]): string[] {
  return uniqueDefined(sources.flatMap((source) => [
    stringValue(source.workflowRef),
    stringValue(source.workflowId),
    stringValue(source.workflowInstanceId),
    ...strings(source.workflowRefs),
    ...strings(source.workflowIds),
    ...strings(source.workflowInstanceIds),
  ]));
}

function eventRefsFrom(...sources: Record<string, unknown>[]): string[] {
  return uniqueDefined(sources.flatMap((source) => [
    stringValue(source.eventId),
    stringValue(source.sourceEventId),
    ...strings(source.eventIds),
    ...strings(source.eventRefs),
  ]));
}

function evidenceIdsFrom(...sources: Record<string, unknown>[]): string[] {
  return uniqueDefined(sources.flatMap((source) => [
    stringValue(source.evidenceId),
    stringValue(source.sourceEventId),
    ...strings(source.evidence),
    ...strings(source.evidenceIds),
    ...strings(source.evidenceRefs),
  ]));
}

function actorFromAudit(actor: string, type?: AuditActorType): ArtifactActor {
  return type ? { id: actor, type } : { id: actor };
}

function hashChainFrom(...sources: Record<string, unknown>[]): ArtifactHashChain | undefined {
  for (const source of sources) {
    const previousHash = stringValue(source.previousHash);
    const hash = stringValue(source.hash);
    if (previousHash && hash) return { previousHash, hash };
  }
  return undefined;
}

function isEventArtifact(value: RaceDayEvent | EventArtifact): value is EventArtifact {
  return 'artifactType' in value && value.artifactType === 'event';
}

function isAuditArtifact(value: AuditLogEntry | AuditArtifact): value is AuditArtifact {
  return 'artifactType' in value && value.artifactType === 'audit';
}

export function toEventArtifact<T = unknown>(event: RaceDayEvent<T>): EventArtifact<T> {
  const payload = record(event.payload);
  const metadata = record(event.metadata);
  const context = event.context;
  const contextRecord = record(context);
  const subject = context.subject;
  const tenantId = context.tenantId ?? stringValue(metadata.tenantId) ?? stringValue(payload.tenantId);
  const racetrackId = context.racetrackId ?? stringValue(metadata.racetrackId) ?? stringValue(payload.racetrackId) ?? stringValue(payload.trackId);
  const auditRefs = uniqueDefined([
    context.auditRef,
    ...context.auditRefs,
    ...auditRefsFrom(metadata, payload, contextRecord),
  ]);
  const digitalTwinRefs = uniqueDefined([
    context.digitalTwinRef,
    ...context.digitalTwinRefs,
    ...digitalTwinRefsFrom(metadata, payload, contextRecord),
  ]);
  const approvalRefs = uniqueDefined([context.approvalRef, ...approvalRefsFrom(metadata, payload, contextRecord)]);
  const workflowRefs = uniqueDefined([context.workflowRef, ...workflowRefsFrom(metadata, payload, contextRecord)]);
  const evidence = uniqueDefined([
    ...context.evidence,
    ...evidenceIdsFrom(metadata, payload, contextRecord),
    ...auditRefs,
  ]);
  const assetId = nestedAssetId(payload)
    ?? nestedAssetId(metadata)
    ?? (subject?.type === 'asset' || subject?.type === 'racetrack-asset' ? subject.id : undefined)
    ?? stringValue(event.lineage.aggregateId);
  const hashChain = hashChainFrom(metadata, payload);
  const eventRefs = uniqueDefined([event.id, ...event.lineage.parentEventIds, ...eventRefsFrom(metadata, payload)]);

  return clone({
    schemaVersion: EVENT_ARTIFACT_SCHEMA_VERSION,
    artifactType: 'event',
    id: event.id,
    eventId: event.id,
    eventType: String(event.type),
    version: event.version,
    schemaRef: event.schemaRef,
    occurredAt: event.occurredAt,
    tenantId,
    racetrackId,
    correlationId: event.correlationId,
    causationId: event.lineage.causationId,
    parentEventIds: [...event.lineage.parentEventIds],
    aggregateId: event.lineage.aggregateId,
    assetId,
    actor: context.actor ? clone(context.actor) : undefined,
    subject: subject ? clone(subject) : undefined,
    owner: clone(event.owner),
    compliance: event.compliance,
    producer: event.lineage.producer,
    sequence: event.lineage.sequence,
    trace: clone(event.trace),
    payload: clone(event.payload),
    metadata: clone(event.metadata),
    evidence,
    auditRefs,
    digitalTwinRefs,
    approvalRefs,
    workflowRefs,
    linkage: {
      tenantId,
      racetrackId,
      subjectId: subject?.id,
      assetId,
      correlationId: event.correlationId,
      causationId: event.lineage.causationId,
      eventRefs,
      auditRefs,
      approvalRefs,
      workflowRefs,
      digitalTwinRefs,
      evidenceIds: evidence,
    },
    hashChain,
  });
}

export function toAuditArtifact(entry: AuditLogEntry): AuditArtifact {
  const payload = record(entry.payload);
  const context = nestedRecord(payload, 'context');
  const lineage = nestedRecord(payload, 'lineage');
  const metadata = nestedRecord(payload, 'metadata');
  const tenantId = entry.tenantId ?? stringValue(context.tenantId) ?? stringValue(metadata.tenantId) ?? stringValue(payload.tenantId);
  const subjectId = entry.subjectId ?? stringValue(context.subjectId) ?? stringValue(payload.subjectId);
  const assetId = nestedAssetId(payload)
    ?? nestedAssetId(context)
    ?? nestedAssetId(metadata)
    ?? (entry.actionClass === 'asset' ? entry.target ?? subjectId : undefined);
  const auditRefs = uniqueDefined([entry.id, ...auditRefsFrom(payload, context, metadata)]);
  const eventRefs = eventRefsFrom(payload, context, metadata);
  const approvalRefs = uniqueDefined([
    ...(entry.type === 'approval' ? [entry.correlationId, stringValue(payload.id)] : []),
    ...approvalRefsFrom(payload, context, metadata),
  ]);
  const workflowRefs = uniqueDefined([entry.workflowId, ...workflowRefsFrom(payload, context, metadata)]);
  const digitalTwinRefs = uniqueDefined([
    ...digitalTwinRefsFrom(payload, context, metadata),
    subjectId?.startsWith('twin:') ? subjectId : undefined,
  ]);
  const evidenceIds = uniqueDefined([
    ...(entry.evidenceIds ?? []),
    ...idsFromEvidence(entry.evidence),
    ...evidenceIdsFrom(payload, context, metadata),
    ...eventRefs,
  ]);
  const causationId = stringValue(payload.causationId) ?? stringValue(lineage.causationId) ?? stringValue(metadata.causationId);
  const hashChain = { previousHash: entry.previousHash, hash: entry.hash };

  return clone({
    schemaVersion: AUDIT_ARTIFACT_SCHEMA_VERSION,
    artifactType: 'audit',
    id: entry.id,
    auditId: entry.id,
    auditType: entry.type,
    action: entry.action,
    actionClass: entry.actionClass,
    target: entry.target,
    decision: entry.decision,
    timestamp: entry.timestamp,
    actor: actorFromAudit(entry.actor.actorId, entry.actor.actorType),
    sourceService: entry.sourceService,
    apiRoute: entry.apiRoute,
    tenantId,
    subjectId,
    assetId,
    workflowId: entry.workflowId,
    correlationId: entry.correlationId,
    causationId,
    severity: entry.severity,
    regulations: [...(entry.regulations ?? [])],
    payload: clone(entry.payload),
    evidenceIds,
    evidence: (entry.evidence ?? []).map((item) => clone(item)),
    custody: (entry.custody ?? []).map((step) => clone(step)),
    eventRefs,
    auditRefs,
    approvalRefs,
    workflowRefs,
    digitalTwinRefs,
    linkage: {
      tenantId,
      subjectId,
      assetId,
      correlationId: entry.correlationId,
      causationId,
      eventRefs,
      auditRefs,
      approvalRefs,
      workflowRefs,
      digitalTwinRefs,
      evidenceIds,
    },
    hashChain,
    legalHold: entry.legalHold,
    retainedUntil: entry.retainedUntil,
  });
}

export function toEventAuditArtifactLink(event: RaceDayEvent | EventArtifact, audit: AuditLogEntry | AuditArtifact): EventAuditArtifactLink {
  const eventArtifact = isEventArtifact(event) ? event : toEventArtifact(event);
  const auditArtifact = isAuditArtifact(audit) ? audit : toAuditArtifact(audit);
  return clone({
    schemaVersion: EVENT_AUDIT_LINK_SCHEMA_VERSION,
    eventId: eventArtifact.eventId,
    auditId: auditArtifact.auditId,
    correlationId: eventArtifact.correlationId ?? auditArtifact.correlationId,
    causationId: eventArtifact.causationId ?? auditArtifact.causationId,
    tenantId: eventArtifact.tenantId ?? auditArtifact.tenantId,
    assetId: eventArtifact.assetId ?? auditArtifact.assetId,
    evidenceIds: uniqueDefined([...eventArtifact.evidence, ...auditArtifact.evidenceIds]),
    digitalTwinRefs: uniqueDefined([...eventArtifact.digitalTwinRefs, ...auditArtifact.digitalTwinRefs]),
    auditHashChain: clone(auditArtifact.hashChain),
  });
}

export const eventToArtifact = toEventArtifact;
export const auditLogEntryToArtifact = toAuditArtifact;

export type CanonicalComplianceFrameworkId = 'ISO-42001' | 'ISO-27001' | 'SOC-2' | 'PCI-DSS' | 'HISA' | 'ARCI';
export type ComplianceArtifactKind = 'control' | 'evidence-package' | 'readiness';
export type InvestigationArtifactKind = 'incident' | 'investigation' | 'inquiry' | 'objection';
export type ArtifactSensitivity = 'public' | 'regulated' | 'security-sensitive' | 'ruling-sensitive';
export interface ComplianceArtifact { artifactType: 'compliance'; kind: ComplianceArtifactKind; id: string; tenantId?: string; status: string; title: string; summary: string; frameworkIds: CanonicalComplianceFrameworkId[]; controlIds: string[]; subjects: Array<{ id: string; type: string; label?: string }>; evidence: ArtifactCaseEvidenceRef[]; ruleRefs: ArtifactCaseRuleRef[]; timeline: ArtifactCaseTimelineEntry[]; traceability: ArtifactCaseTraceability; readiness?: { score: number; readinessOnly: true; externalCertificationClaimed: false; evidenceCoverage?: number; openFindings?: number }; sensitiveDataHandling: ArtifactCaseSensitiveDataHandling }
export interface InvestigationArtifact { artifactType: 'investigation'; sourceDomain: 'security-manager' | 'stewarding'; kind: InvestigationArtifactKind; id: string; caseId: string; tenantId?: string; status: string; title: string; summary: string; subjects: Array<{ id: string; type: string; label?: string }>; evidence: ArtifactCaseEvidenceRef[]; ruleRefs: ArtifactCaseRuleRef[]; timeline: ArtifactCaseTimelineEntry[]; traceability: ArtifactCaseTraceability; finalRulingRef?: { id: string; withheld: true }; sensitiveDataHandling: ArtifactCaseSensitiveDataHandling }
interface ArtifactCaseEvidenceRef { id: string; display: string; uri?: string; hash?: string; description?: string; source?: string; masked: boolean; sensitivity: ArtifactSensitivity; traceId: string; auditRefs: string[]; eventRefs: string[] }
interface ArtifactCaseRuleRef { id: string; frameworkId?: string; jurisdiction?: string; citation: string; summary?: string; auditRef?: string }
interface ArtifactCaseTimelineEntry { at: string; source: string; subjectId: string; label: string; evidenceIds: string[]; ruleIds: string[]; auditRef?: string; eventRef?: string; masked?: boolean }
interface ArtifactCaseTraceability { auditRefs: string[]; eventRefs: string[]; workflowRefs: string[]; approvalRefs: string[]; digitalTwinRefs: string[]; custodyRefs: string[]; evidenceTraceIds: string[] }
interface ArtifactCaseSensitiveDataHandling { uiMasked: boolean; sensitiveEvidenceMasked: boolean; finalRulingExcluded: boolean; unsafeActionsExcluded: boolean; reason: string }

const canonicalComplianceFrameworks = ['ISO-42001', 'ISO-27001', 'SOC-2', 'PCI-DSS', 'HISA', 'ARCI'] as const;
const frameworkAliases: Record<string, CanonicalComplianceFrameworkId> = { ISO42001: 'ISO-42001', ISOIEC42001: 'ISO-42001', ISO27001: 'ISO-27001', SOC2: 'SOC-2', PCI: 'PCI-DSS', PCIDSS: 'PCI-DSS', HISA: 'HISA', ARCI: 'ARCI' };
const complianceSensitiveHandling: ArtifactCaseSensitiveDataHandling = { uiMasked: false, sensitiveEvidenceMasked: false, finalRulingExcluded: true, unsafeActionsExcluded: true, reason: 'Compliance artifacts expose readiness and lineage metadata only; external certification claims, final rulings, and unsafe actions are excluded.' };

export function canonicalComplianceFrameworkId(id: string): CanonicalComplianceFrameworkId | undefined {
  return frameworkAliases[id.toUpperCase().replace(/[^A-Z0-9]/g, '')];
}

export function toComplianceArtifacts(snapshot: any, options: { frameworkIds?: string[]; tenantId?: string } = {}): ComplianceArtifact[] {
  const targetFrameworks = caseUnique((options.frameworkIds?.map(canonicalComplianceFrameworkId).filter(Boolean) as CanonicalComplianceFrameworkId[] | undefined) ?? [...canonicalComplianceFrameworks]);
  const targets = new Set(targetFrameworks);
  const artifacts: ComplianceArtifact[] = [];
  for (const control of snapshot.controls ?? []) {
    const frameworkIds = canonicalFrameworkIds(control.frameworkIds ?? [], targets);
    if (frameworkIds.length) artifacts.push(controlComplianceArtifact(control, snapshot, frameworkIds, options.tenantId));
  }
  for (const pkg of snapshot.evidencePackages ?? []) {
    const frameworkIds = canonicalFrameworkIds(pkg.frameworkIds ?? [], targets);
    if (frameworkIds.length) artifacts.push(evidencePackageComplianceArtifact(pkg, snapshot, frameworkIds, options.tenantId));
  }
  for (const readiness of snapshot.readiness?.byFramework ?? []) {
    const frameworkId = canonicalComplianceFrameworkId(readiness.frameworkId);
    if (frameworkId && targets.has(frameworkId)) artifacts.push(readinessComplianceArtifact(readiness, snapshot, frameworkId, options.tenantId));
  }
  return artifacts;
}

export function toSecurityInvestigationArtifacts(workspace: any, options: { tenantId?: string; includeSensitiveEvidence?: boolean } = {}): InvestigationArtifact[] {
  return [...(workspace.incidents ?? []).map((incident: any) => securityIncidentArtifact(incident, workspace, options)), ...(workspace.investigations ?? []).map((investigation: any) => securityInvestigationArtifact(investigation, workspace, options))];
}

export function toStewardInvestigationArtifacts(inquiries: any[], options: { tenantId?: string; includeSensitiveEvidence?: boolean; exposeFinalRulings?: boolean } = {}): InvestigationArtifact[] {
  return inquiries.flatMap((inquiry) => [stewardInquiryArtifact(inquiry, options), ...(inquiry.objections ?? []).map((objection: any) => stewardObjectionArtifact(inquiry, objection, options)), ...(inquiry.investigations ?? []).map((investigation: any) => stewardInvestigationArtifact(inquiry, investigation, options))]);
}

export function toInvestigationArtifacts(input: { security?: any; stewardInquiries?: any[] }, options: { tenantId?: string; includeSensitiveEvidence?: boolean; exposeFinalRulings?: boolean } = {}): InvestigationArtifact[] {
  return [...(input.security ? toSecurityInvestigationArtifacts(input.security, options) : []), ...(input.stewardInquiries ? toStewardInvestigationArtifacts(input.stewardInquiries, options) : [])];
}

function controlComplianceArtifact(control: any, snapshot: any, frameworkIds: CanonicalComplianceFrameworkId[], tenantId?: string): ComplianceArtifact {
  const evidence = (control.evidenceIds ?? []).map((id: string) => caseEvidenceRef(id, { sensitivity: 'regulated', auditRefs: control.auditRecordIds ?? [], eventRefs: control.eventIds ?? [] }));
  return { artifactType: 'compliance', kind: 'control', id: `compliance-control:${control.id}`, tenantId, status: control.status, title: control.title, summary: control.description, frameworkIds, controlIds: [control.id], subjects: [{ id: control.id, type: 'compliance-control', label: control.title }, { id: control.ownerId, type: 'control-owner' }, ...(control.obligationIds ?? []).map((id: string) => ({ id, type: 'compliance-obligation' }))], evidence, ruleRefs: complianceRuleRefs(snapshot, control.id, frameworkIds), timeline: (snapshot.auditReadinessEvents ?? []).filter((event: any) => event.controlId === control.id).map((event: any) => ({ at: event.occurredAt, source: event.type, subjectId: control.id, label: event.type, evidenceIds: control.evidenceIds ?? [], ruleIds: control.obligationIds ?? [], auditRef: event.auditRecordId, eventRef: event.eventId })), traceability: caseTraceability({ auditRefs: control.auditRecordIds ?? [], eventRefs: control.eventIds ?? [], workflowRefs: control.workflowInstanceIds ?? [], approvalRefs: control.approvalRequestIds ?? [], digitalTwinRefs: control.digitalTwinRefs ?? [], custodyRefs: [], evidence }), sensitiveDataHandling: complianceSensitiveHandling };
}

function evidencePackageComplianceArtifact(pkg: any, snapshot: any, frameworkIds: CanonicalComplianceFrameworkId[], tenantId?: string): ComplianceArtifact {
  const evidence = (pkg.evidenceIds ?? []).map((id: string) => caseEvidenceRef(id, { sensitivity: 'regulated', auditRefs: pkg.auditRefs ?? [], eventRefs: pkg.eventRefs ?? [] }));
  return { artifactType: 'compliance', kind: 'evidence-package', id: `compliance-evidence:${pkg.id}`, tenantId: tenantId ?? pkg.tenantId, status: pkg.readiness, title: pkg.title, summary: `${pkg.accreditationReadiness?.status ?? 'readiness'} evidence package for ${frameworkIds.join(', ')}.`, frameworkIds, controlIds: pkg.controlIds ?? [], subjects: [{ id: pkg.id, type: 'evidence-package', label: pkg.title }, { id: pkg.source?.objectId ?? pkg.id, type: pkg.source?.objectType ?? 'evidence-package' }, { id: pkg.controlOwnerId, type: 'control-owner' }], evidence, ruleRefs: [...(pkg.frameworkMappings ?? []).filter((mapping: any) => canonicalFrameworkIds([mapping.frameworkId], new Set(frameworkIds)).length).map((mapping: any) => ({ id: `${pkg.id}:${mapping.frameworkId}:${mapping.citation}`, frameworkId: mapping.frameworkId, citation: mapping.citation, summary: `${mapping.relationship} ${mapping.evidenceUse}` })), ...(pkg.controlIds ?? []).flatMap((controlId: string) => complianceRuleRefs(snapshot, controlId, frameworkIds))], timeline: (snapshot.auditReadinessEvents ?? []).filter((event: any) => (pkg.auditRecordIds ?? []).includes(event.auditRecordId) || Boolean(event.controlId && (pkg.controlIds ?? []).includes(event.controlId))).map((event: any) => ({ at: event.occurredAt, source: event.type, subjectId: event.controlId ?? pkg.id, label: event.type, evidenceIds: pkg.evidenceIds ?? [], ruleIds: (pkg.frameworkMappings ?? []).map((mapping: any) => mapping.citation), auditRef: event.auditRecordId, eventRef: event.eventId })), traceability: caseTraceability({ auditRefs: pkg.auditRefs ?? [], eventRefs: pkg.eventRefs ?? [], workflowRefs: pkg.workflowInstanceIds ?? [], approvalRefs: pkg.approvalRequestIds ?? [], digitalTwinRefs: pkg.digitalTwinRefs ?? [], custodyRefs: [], evidence }), readiness: { score: pkg.accreditationReadiness?.score ?? 0, readinessOnly: true, externalCertificationClaimed: false }, sensitiveDataHandling: complianceSensitiveHandling };
}

function readinessComplianceArtifact(readiness: any, snapshot: any, frameworkId: CanonicalComplianceFrameworkId, tenantId?: string): ComplianceArtifact {
  const controls = (snapshot.controls ?? []).filter((control: any) => (control.frameworkIds ?? []).includes(frameworkId));
  const evidence = controls.flatMap((control: any) => (control.evidenceIds ?? []).map((id: string) => caseEvidenceRef(id, { sensitivity: 'regulated', auditRefs: control.auditRecordIds ?? [], eventRefs: control.eventIds ?? [] })));
  return { artifactType: 'compliance', kind: 'readiness', id: `compliance-readiness:${frameworkId}`, tenantId, status: readiness.score >= 85 ? 'ready-for-review' : readiness.score >= 70 ? 'gap-remediation' : 'collecting', title: `${frameworkId} readiness record`, summary: `${frameworkId} readiness score ${readiness.score} across ${readiness.controls} mapped controls.`, frameworkIds: [frameworkId], controlIds: controls.map((control: any) => control.id), subjects: [{ id: frameworkId, type: 'compliance-framework' }], evidence, ruleRefs: controls.flatMap((control: any) => complianceRuleRefs(snapshot, control.id, [frameworkId])), timeline: (snapshot.auditReadinessEvents ?? []).filter((event: any) => (event.frameworkIds ?? []).includes(frameworkId)).map((event: any) => ({ at: event.occurredAt, source: event.type, subjectId: event.controlId ?? frameworkId, label: event.type, evidenceIds: controls.flatMap((control: any) => control.evidenceIds ?? []), ruleIds: [frameworkId], auditRef: event.auditRecordId, eventRef: event.eventId })), traceability: caseTraceability({ auditRefs: controls.flatMap((control: any) => control.auditRecordIds ?? []), eventRefs: controls.flatMap((control: any) => control.eventIds ?? []), workflowRefs: controls.flatMap((control: any) => control.workflowInstanceIds ?? []), approvalRefs: controls.flatMap((control: any) => control.approvalRequestIds ?? []), digitalTwinRefs: controls.flatMap((control: any) => control.digitalTwinRefs ?? []), custodyRefs: [], evidence }), readiness: { score: readiness.score, readinessOnly: true, externalCertificationClaimed: false, evidenceCoverage: snapshot.readiness?.evidenceCoverage, openFindings: snapshot.readiness?.openFindings }, sensitiveDataHandling: complianceSensitiveHandling };
}

function securityIncidentArtifact(incident: any, workspace: any, options: { tenantId?: string; includeSensitiveEvidence?: boolean }): InvestigationArtifact {
  const relatedEvents = (workspace.events ?? []).filter((event: any) => event.subjectId === incident.id || (incident.eventIds ?? []).includes(event.subjectId));
  const evidence = (incident.eventIds ?? []).map((id: string) => caseEvidenceRef(id, { sensitivity: 'regulated', auditRefs: [incident.auditId], eventRefs: relatedEvents.map((event: any) => event.id) }));
  return { artifactType: 'investigation', sourceDomain: 'security-manager', kind: 'incident', id: `security-incident:${incident.id}`, caseId: incident.id, tenantId: options.tenantId, status: incident.status, title: incident.title, summary: `${incident.severity} security incident in ${incident.zoneId}.`, subjects: [{ id: incident.id, type: 'security-incident', label: incident.title }, { id: incident.zoneId, type: 'restricted-zone' }, ...(incident.eventIds ?? []).map((id: string) => ({ id, type: 'security-event' }))], evidence, ruleRefs: securityRuleRefs(workspace), timeline: [{ at: incident.createdAt, source: 'security.incident.created', subjectId: incident.id, label: incident.title, evidenceIds: incident.eventIds ?? [], ruleIds: [], auditRef: incident.auditId }, ...relatedEvents.map((event: any) => ({ at: event.timestamp, source: event.type, subjectId: event.subjectId, label: event.type, evidenceIds: caseEventEvidenceIds(event.payload), ruleIds: [], auditRef: event.auditId, eventRef: event.id }))], traceability: caseTraceability({ auditRefs: caseUnique([incident.auditId, ...relatedEvents.map((event: any) => event.auditId)]), eventRefs: caseUnique([...(incident.eventIds ?? []), ...relatedEvents.map((event: any) => event.id)]), workflowRefs: [], approvalRefs: incident.approvalRequestId ? [incident.approvalRequestId] : [], digitalTwinRefs: (workspace.twinUpdates ?? []).filter((update: any) => update.sourceId === incident.id || update.sourceId === incident.zoneId).map((update: any) => update.twinId), custodyRefs: [], evidence }), sensitiveDataHandling: caseSecuritySensitiveHandling(options) };
}

function securityInvestigationArtifact(investigation: any, workspace: any, options: { tenantId?: string; includeSensitiveEvidence?: boolean }): InvestigationArtifact {
  const incident = (workspace.incidents ?? []).find((item: any) => item.id === investigation.incidentId);
  const relatedEvents = (workspace.events ?? []).filter((event: any) => event.subjectId === investigation.id || event.subjectId === investigation.incidentId);
  const evidence = (investigation.evidence ?? []).map((item: string) => caseEvidenceRef(item, { sensitivity: 'security-sensitive', mask: !options.includeSensitiveEvidence, auditRefs: [investigation.auditId], eventRefs: relatedEvents.map((event: any) => event.id) }));
  return { artifactType: 'investigation', sourceDomain: 'security-manager', kind: 'investigation', id: `security-investigation:${investigation.id}`, caseId: investigation.incidentId, tenantId: options.tenantId, status: investigation.status, title: incident?.title ?? investigation.id, summary: `Security investigation ${investigation.id} led by ${investigation.lead}.`, subjects: [{ id: investigation.id, type: 'security-investigation' }, { id: investigation.incidentId, type: 'security-incident', label: incident?.title }, { id: investigation.lead, type: 'investigation-lead' }], evidence, ruleRefs: securityRuleRefs(workspace), timeline: [{ at: investigation.openedAt, source: 'security.investigation.opened', subjectId: investigation.id, label: 'Security investigation opened', evidenceIds: evidence.map((item: ArtifactCaseEvidenceRef) => item.id), ruleIds: [], auditRef: investigation.auditId }, ...relatedEvents.map((event: any) => ({ at: event.timestamp, source: event.type, subjectId: event.subjectId, label: event.type, evidenceIds: caseEventEvidenceIds(event.payload), ruleIds: [], auditRef: event.auditId, eventRef: event.id }))], traceability: caseTraceability({ auditRefs: caseUnique([investigation.auditId, ...relatedEvents.map((event: any) => event.auditId)]), eventRefs: caseUnique(relatedEvents.map((event: any) => event.id)), workflowRefs: [], approvalRefs: investigation.approvalRequestId ? [investigation.approvalRequestId] : [], digitalTwinRefs: [], custodyRefs: [], evidence }), sensitiveDataHandling: caseSecuritySensitiveHandling(options) };
}

function stewardInquiryArtifact(inquiry: any, options: { tenantId?: string; includeSensitiveEvidence?: boolean; exposeFinalRulings?: boolean }): InvestigationArtifact {
  const evidence = (inquiry.evidenceReferences ?? []).map((item: any) => stewardEvidenceRef(item, options));
  return { artifactType: 'investigation', sourceDomain: 'stewarding', kind: 'inquiry', id: `steward-inquiry:${inquiry.id}`, caseId: inquiry.id, tenantId: options.tenantId, status: inquiry.status, title: `${inquiry.raceId} steward inquiry`, summary: `Steward inquiry ${inquiry.id} with ${(inquiry.objections ?? []).length} objection(s) and ${(inquiry.investigations ?? []).length} investigation(s).`, subjects: stewardSubjects(inquiry), evidence, ruleRefs: stewardRuleRefs(inquiry), timeline: stewardTimeline(inquiry, options), traceability: caseTraceability({ auditRefs: caseUnique([...(inquiry.auditRecords ?? []).map((record: any) => record.id), ...(inquiry.integrations?.auditRecordIds ?? [])]), eventRefs: inquiry.integrations?.eventTypes ?? [], workflowRefs: inquiry.integrations?.workflowInstanceIds ?? [], approvalRefs: inquiry.integrations?.approvalRequestIds ?? [], digitalTwinRefs: inquiry.integrations?.digitalTwinRefs ?? [], custodyRefs: (inquiry.evidenceReferences ?? []).flatMap((item: any) => item.custody?.custodyRecordIds ?? []), evidence }), finalRulingRef: inquiry.finalRuling && !options.exposeFinalRulings ? { id: inquiry.finalRuling.id, withheld: true } : undefined, sensitiveDataHandling: caseInvestigationSensitiveHandling(options, Boolean(inquiry.finalRuling)) };
}

function stewardObjectionArtifact(inquiry: any, objection: any, options: { tenantId?: string; includeSensitiveEvidence?: boolean; exposeFinalRulings?: boolean }): InvestigationArtifact {
  const evidence = (inquiry.evidenceReferences ?? []).map((item: any) => stewardEvidenceRef(item, options));
  return { artifactType: 'investigation', sourceDomain: 'stewarding', kind: 'objection', id: `steward-objection:${objection.id}`, caseId: inquiry.id, tenantId: options.tenantId, status: objection.status, title: objection.allegation, summary: `Objection ${objection.id} filed in inquiry ${inquiry.id}.`, subjects: stewardSubjects(inquiry, [{ id: objection.id, type: 'steward-objection', label: objection.allegation }, ...(objection.horseId ? [{ id: objection.horseId, type: 'horse' }] : []), ...(objection.jockeyId ? [{ id: objection.jockeyId, type: 'jockey' }] : [])]), evidence, ruleRefs: stewardRuleRefs(inquiry), timeline: stewardTimeline(inquiry, options).filter((entry) => entry.subjectId === objection.id || entry.source !== 'objection'), traceability: caseTraceability({ auditRefs: (inquiry.auditRecords ?? []).filter((record: any) => record.subjectId === objection.id || record.action === 'case.opened').map((record: any) => record.id), eventRefs: (inquiry.integrations?.eventTypes ?? []).filter((type: string) => type.includes('objection') || type.includes('inquiry')), workflowRefs: inquiry.integrations?.workflowInstanceIds ?? [], approvalRefs: inquiry.integrations?.approvalRequestIds ?? [], digitalTwinRefs: inquiry.integrations?.digitalTwinRefs ?? [], custodyRefs: (inquiry.evidenceReferences ?? []).flatMap((item: any) => item.custody?.custodyRecordIds ?? []), evidence }), finalRulingRef: inquiry.finalRuling && !options.exposeFinalRulings ? { id: inquiry.finalRuling.id, withheld: true } : undefined, sensitiveDataHandling: caseInvestigationSensitiveHandling(options, Boolean(inquiry.finalRuling)) };
}

function stewardInvestigationArtifact(inquiry: any, investigation: any, options: { tenantId?: string; includeSensitiveEvidence?: boolean; exposeFinalRulings?: boolean }): InvestigationArtifact {
  const evidence = evidenceForIds(inquiry.evidenceReferences ?? [], investigation.evidenceIds ?? [], options);
  return { artifactType: 'investigation', sourceDomain: 'stewarding', kind: 'investigation', id: investigation.id, caseId: inquiry.id, tenantId: options.tenantId, status: investigation.status, title: investigation.focus, summary: `Steward investigation ${investigation.id} for inquiry ${inquiry.id}.`, subjects: stewardSubjects(inquiry, [{ id: investigation.id, type: 'steward-investigation', label: investigation.focus }]), evidence, ruleRefs: ruleRefsForIds(inquiry, investigation.ruleIds ?? []), timeline: stewardTimeline(inquiry, options).filter((entry) => entry.subjectId === investigation.id || (investigation.evidenceIds ?? []).some((id: string) => entry.evidenceIds.includes(id)) || (investigation.ruleIds ?? []).some((id: string) => entry.ruleIds.includes(id))), traceability: caseTraceability({ auditRefs: caseUnique([...(investigation.approvalRequestId ? [investigation.approvalRequestId] : []), ...(inquiry.auditRecords ?? []).filter((record: any) => record.subjectId === investigation.id || (record.evidenceIds ?? []).some((id: string) => (investigation.evidenceIds ?? []).includes(id))).map((record: any) => record.id)]), eventRefs: inquiry.integrations?.eventTypes ?? [], workflowRefs: investigation.workflowInstanceId ? [investigation.workflowInstanceId] : [], approvalRefs: investigation.approvalRequestId ? [investigation.approvalRequestId] : [], digitalTwinRefs: investigation.digitalTwinRefs ?? [], custodyRefs: custodyRefsForEvidence(inquiry, investigation.evidenceIds ?? []), evidence }), sensitiveDataHandling: caseInvestigationSensitiveHandling(options, Boolean(inquiry.finalRuling)) };
}

function stewardTimeline(inquiry: any, options: { exposeFinalRulings?: boolean }): ArtifactCaseTimelineEntry[] {
  const timeline = (inquiry.timeline ?? []).length ? inquiry.timeline : fallbackStewardTimeline(inquiry);
  return timeline.map((entry: any) => { const redactFinalRuling = entry.source === 'final-ruling' && !options.exposeFinalRulings; return { at: entry.at, source: entry.source, subjectId: entry.subjectId, label: redactFinalRuling ? '[final ruling withheld]' : entry.label, evidenceIds: [...(entry.evidenceIds ?? [])], ruleIds: [...(entry.ruleIds ?? [])], auditRef: entry.auditRecordId, eventRef: entry.eventId, masked: redactFinalRuling || undefined }; });
}

function fallbackStewardTimeline(inquiry: any): any[] {
  return [...(inquiry.objections ?? []).map((item: any, index: number) => ({ sequence: index + 1, at: item.filedAt, source: 'objection', subjectId: item.id, label: item.allegation, actorId: item.filedBy, evidenceIds: [], ruleIds: [] })), ...(inquiry.investigations ?? []).map((item: any, index: number) => ({ sequence: index + 1, at: item.openedAt, source: 'audit', subjectId: item.id, label: item.focus, actorId: item.leadStewardId, evidenceIds: item.evidenceIds, ruleIds: item.ruleIds, auditRecordId: (inquiry.auditRecords ?? []).find((record: any) => record.subjectId === item.id)?.id })), ...(inquiry.auditRecords ?? []).map((item: any, index: number) => ({ sequence: index + 1, at: item.at, source: 'audit', subjectId: item.subjectId, label: item.action, actorId: item.actorId, evidenceIds: item.evidenceIds, ruleIds: item.ruleIds, auditRecordId: item.id }))];
}

function evidenceForIds(evidence: any[], ids: string[], options: { includeSensitiveEvidence?: boolean }): ArtifactCaseEvidenceRef[] { const selected = new Set(ids); return evidence.filter((item) => selected.has(item.id)).map((item) => stewardEvidenceRef(item, options)); }
function ruleRefsForIds(inquiry: any, ids: string[]): ArtifactCaseRuleRef[] { const selected = new Set(ids); return (inquiry.ruleReferences ?? []).filter((rule: any) => selected.has(rule.id)).map((rule: any) => ({ id: rule.id, jurisdiction: rule.jurisdiction, citation: `${rule.rulebook} ${rule.section}: ${rule.citation}`, summary: rule.summary, auditRef: rule.auditRecordId })); }
function stewardRuleRefs(inquiry: any): ArtifactCaseRuleRef[] { return (inquiry.ruleReferences ?? []).map((rule: any) => ({ id: rule.id, jurisdiction: rule.jurisdiction, citation: `${rule.rulebook} ${rule.section}: ${rule.citation}`, summary: rule.summary, auditRef: rule.auditRecordId })); }
function custodyRefsForEvidence(inquiry: any, ids: string[]): string[] { const selected = new Set(ids); return (inquiry.evidenceReferences ?? []).filter((item: any) => selected.has(item.id)).flatMap((item: any) => item.custody?.custodyRecordIds ?? []); }
function complianceRuleRefs(snapshot: any, controlId: string, frameworkIds: CanonicalComplianceFrameworkId[]): ArtifactCaseRuleRef[] { const targets = new Set<string>(frameworkIds); return [...(snapshot.obligations ?? []).filter((obligation: any) => (obligation.controlIds ?? []).includes(controlId) && targets.has(canonicalComplianceFrameworkId(obligation.frameworkId) ?? '')).map((obligation: any) => ({ id: obligation.id, frameworkId: obligation.frameworkId, jurisdiction: obligation.jurisdiction, citation: obligation.citation, summary: obligation.summary })), ...(snapshot.frameworkMappings ?? []).filter((mapping: any) => (mapping.controlIds ?? []).includes(controlId) && targets.has(canonicalComplianceFrameworkId(mapping.frameworkId) ?? '')).map((mapping: any) => ({ id: mapping.id, frameworkId: mapping.frameworkId, citation: mapping.citation, summary: mapping.racingCommissionRule }))]; }
function securityRuleRefs(workspace: any): ArtifactCaseRuleRef[] { const regulations = caseUnique((workspace.sharedAuditRecords ?? []).flatMap((record: any) => record.regulations ?? [])); return regulations.map((regulation) => ({ id: `security-rule:${regulation}`, frameworkId: regulation, citation: regulation, summary: 'Security operations policy or legal reference mirrored through the shared audit ledger.' })); }
function stewardEvidenceRef(item: any, options: { includeSensitiveEvidence?: boolean }): ArtifactCaseEvidenceRef { const sensitivity = sensitiveEvidenceValue(item.uri) || item.kind === 'video' ? 'security-sensitive' : 'regulated'; return caseEvidenceRef(item.id, { display: item.description, uri: item.uri, hash: item.hash, description: item.description, source: item.sourceSystem, sensitivity, mask: sensitivity === 'security-sensitive' && !options.includeSensitiveEvidence, auditRefs: item.auditRecordId ? [item.auditRecordId] : [], eventRefs: item.eventId ? [item.eventId] : [] }); }
function caseEvidenceRef(raw: string, input: { display?: string; uri?: string; hash?: string; description?: string; source?: string; sensitivity: ArtifactSensitivity; mask?: boolean; auditRefs?: string[]; eventRefs?: string[] }): ArtifactCaseEvidenceRef { const traceId = caseDigest(`${raw}:${input.uri ?? ''}:${input.hash ?? ''}`); const masked = Boolean(input.mask); return { id: masked ? `masked:${traceId}` : raw, display: masked ? '[masked evidence]' : input.display ?? raw, uri: masked ? undefined : input.uri, hash: input.hash, description: masked ? 'Evidence withheld for UI role; trace ID retained.' : input.description, source: input.source, masked, sensitivity: input.sensitivity, traceId, auditRefs: [...(input.auditRefs ?? [])], eventRefs: [...(input.eventRefs ?? [])] }; }
function sensitiveEvidenceValue(value: string | undefined): boolean { return Boolean(value && /^(s3|video|camera|credential|watchlist|security):\/\//i.test(value)); }
function caseEventEvidenceIds(payload: Record<string, unknown> = {}): string[] { const evidence = payload.evidenceIds ?? payload.evidence ?? payload.eventIds; return Array.isArray(evidence) ? evidence.filter((item): item is string => typeof item === 'string') : []; }
function canonicalFrameworkIds(ids: readonly string[], targets: Set<CanonicalComplianceFrameworkId>): CanonicalComplianceFrameworkId[] { return caseUnique(ids.map((id) => canonicalComplianceFrameworkId(id)).filter((id): id is CanonicalComplianceFrameworkId => Boolean(id))).filter((id) => targets.has(id)); }
function stewardSubjects(inquiry: any, extra: Array<{ id: string; type: string; label?: string }> = []): Array<{ id: string; type: string; label?: string }> { return caseUniqueById([{ id: inquiry.id, type: 'steward-inquiry' }, { id: inquiry.raceId, type: 'race' }, ...(inquiry.involvedHorses ?? []).map((horse: any) => ({ id: horse.horseId, type: 'horse', label: horse.name })), ...(inquiry.involvedJockeys ?? []).map((jockey: any) => ({ id: jockey.jockeyId, type: 'jockey', label: jockey.name })), ...extra]); }
function caseTraceability(input: { auditRefs: string[]; eventRefs: string[]; workflowRefs: string[]; approvalRefs: string[]; digitalTwinRefs: string[]; custodyRefs: string[]; evidence: ArtifactCaseEvidenceRef[] }): ArtifactCaseTraceability { return { auditRefs: caseUnique(input.auditRefs), eventRefs: caseUnique(input.eventRefs), workflowRefs: caseUnique(input.workflowRefs), approvalRefs: caseUnique(input.approvalRefs), digitalTwinRefs: caseUnique(input.digitalTwinRefs), custodyRefs: caseUnique(input.custodyRefs), evidenceTraceIds: caseUnique(input.evidence.map((item) => item.traceId)) }; }
function caseSecuritySensitiveHandling(options: { includeSensitiveEvidence?: boolean }): ArtifactCaseSensitiveDataHandling { return { uiMasked: !options.includeSensitiveEvidence, sensitiveEvidenceMasked: !options.includeSensitiveEvidence, finalRulingExcluded: true, unsafeActionsExcluded: true, reason: 'Security investigation artifacts retain trace IDs, audit refs, and event refs while masking security-sensitive evidence unless explicitly authorized.' }; }
function caseInvestigationSensitiveHandling(options: { includeSensitiveEvidence?: boolean; exposeFinalRulings?: boolean }, hasFinalRuling: boolean): ArtifactCaseSensitiveDataHandling { return { uiMasked: !options.includeSensitiveEvidence, sensitiveEvidenceMasked: !options.includeSensitiveEvidence, finalRulingExcluded: hasFinalRuling && !options.exposeFinalRulings, unsafeActionsExcluded: true, reason: 'Investigation artifacts preserve case lineage for review; final rulings and unsafe executable actions are withheld from the UI artifact surface by default.' }; }
function caseUnique<T extends string>(values: readonly (T | undefined)[]): T[] { return [...new Set(values.filter((value): value is T => Boolean(value)))]; }
function caseUniqueById<T extends { id: string }>(values: T[]): T[] { const seen = new Set<string>(); return values.filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; }); }
function caseDigest(input: string): string { let hash = 2166136261; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); } return `sha256:${(hash >>> 0).toString(16).padStart(8, '0')}`; }
