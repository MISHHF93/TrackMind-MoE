import type { TUSAssetStandardDto, TUSTwinStandardDto, TUSStandardizationWorkspaceDto } from '@trackmind/shared';
import type { FoundationAuditEvent, FoundationTwin } from './digitalTwinFoundation.js';
import type { DigitalTwinRuntimeTwin } from './digitalTwinRuntime.js';
import type { TwinNode } from './twinGraph.js';
import type { RegistryAsset } from './racetrackAssetRegistryService.js';

type TusHealth = TUSAssetStandardDto['health']['status'];
type TusRisk = TUSAssetStandardDto['risk']['level'];
type TusTwinType = TUSTwinStandardDto['twinType'];

const riskScore: Record<TusRisk, number> = { low: 15, medium: 35, high: 65, critical: 90 };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface TUSStandardContext {
  tenantId: string;
  racetrackId: string;
  generatedAt?: string;
  mock?: boolean;
}

export interface LegacyAssetProjection {
  assetId?: string;
  id?: string;
  tenantId?: string;
  racetrackId?: string;
  name?: string;
  label?: string;
  assetClass?: TUSAssetStandardDto['assetCategory'];
  assetType?: string;
  type?: string;
  lifecycleStatus?: string;
  riskLevel?: TusRisk;
  safetyCritical?: boolean;
  owner?: string;
  location?: Record<string, unknown>;
  state?: Record<string, unknown>;
  maintenanceStatus?: string;
  healthScore?: number;
  readinessStatus?: string;
  telemetryBindings?: Array<{ bindingId?: string; sourceId: string; stream: string; schemaRef?: string; required?: boolean; sensorId?: string; metric?: string; lastObservedAt?: string }>;
  approvals?: Array<{ id: string; policyId?: string; status: string; requiredApprovers?: string[]; reason?: string; evidence?: string[]; updatedAt?: string }>;
  audit?: Array<{ id: string; action?: string; actor?: string; timestamp?: string; evidence?: string[] }>;
  auditId?: string;
  eventId?: string;
  twinId?: string;
  mock?: boolean;
  version?: number;
}

export function registryAssetToTUSAsset(asset: RegistryAsset, context?: Partial<TUSStandardContext>): TUSAssetStandardDto {
  const assessedAt = asset.riskAssessments.at(-1)?.assessedAt ?? asset.updatedAt;
  const health = maintenanceHealth(asset.maintenance.status, asset.riskLevel);
  const approvals = asset.controls.flatMap((control) => control.requiresApprovalFrom.length || control.executionMode !== 'automatic'
    ? [{
        id: `${asset.assetId}:${control.name}:approval`,
        policyId: asset.approvalPolicyId,
        status: asset.lifecycleStatus === 'pending-approval' ? 'pending' : 'required',
        requiredApprovers: [...control.requiresApprovalFrom],
        reason: control.description,
        evidence: [...asset.riskAssessments.flatMap((risk) => risk.evidence)],
        updatedAt: asset.updatedAt,
      }]
    : []);
  const audit = [
    ...asset.lifecycleHistory.map((event, index) => ({ id: `${asset.assetId}:lifecycle:${index + 1}`, action: `lifecycle:${event.status}`, actor: event.changedBy, timestamp: event.changedAt, evidence: event.approvalRequestId ? [event.approvalRequestId] : [] })),
    ...asset.maintenanceHistory.map((record) => ({ id: record.recordId, action: 'maintenance-recorded', actor: record.performedBy, timestamp: record.performedAt, evidence: [...record.evidence] })),
  ];
  return {
    schemaVersion: 'trackmind.tus.asset.v1',
    tenantId: asset.tenantId,
    racetrackId: context?.racetrackId ?? context?.tenantId ?? asset.tenantId,
    assetId: asset.assetId,
    assetType: asset.assetType,
    assetCategory: asset.assetClass,
    displayName: asset.name,
    location: clone(asset.location),
    state: { lifecycleStatus: asset.lifecycleStatus, ...clone(asset.state) },
    health: { status: health, maintenanceStatus: asset.maintenance.status, indicators: [
      { name: 'maintenance', status: health === 'critical' ? 'critical' : health === 'degraded' ? 'watch' : 'ok', value: asset.maintenance.status, updatedAt: asset.maintenance.lastInspectionAt ?? asset.updatedAt },
      { name: 'risk', status: asset.riskLevel === 'critical' ? 'critical' : asset.riskLevel === 'high' ? 'watch' : 'ok', value: asset.riskLevel, updatedAt: assessedAt },
    ] },
    risk: { level: asset.riskLevel, score: riskScore[asset.riskLevel], safetyCritical: asset.safetyCritical, drivers: [asset.domain, asset.assetType, ...asset.controls.map((control) => control.name)], assessedAt, evidence: [...asset.riskAssessments.flatMap((risk) => risk.evidence)] },
    telemetry: asset.telemetryBindings.map((binding) => ({ bindingId: binding.bindingId, sourceId: binding.sourceId, stream: binding.stream, schemaRef: binding.schemaRef, metric: binding.metric, required: binding.required, lastObservedAt: binding.lastObservedAt })),
    approvals: approvals.length ? approvals : [{ id: `${asset.assetId}:policy:${asset.approvalPolicyId}`, policyId: asset.approvalPolicyId, status: asset.safetyCritical ? 'required' : 'not-required', requiredApprovers: [], reason: 'Registry approval policy applied to asset lifecycle and risk changes.', evidence: asset.riskAssessments.flatMap((risk) => risk.evidence), updatedAt: asset.updatedAt }],
    audit,
    twin: asset.digitalTwin ? { twinId: asset.digitalTwin.twinId, relationship: asset.digitalTwin.relationship, modelVersion: asset.digitalTwin.modelVersion, synchronizedAt: asset.digitalTwin.synchronizedAt } : undefined,
    source: { system: 'racetrack-asset-registry', version: asset.version, mock: context?.mock ?? false },
  };
}

export function legacyAssetToTUSAsset(asset: LegacyAssetProjection, context: TUSStandardContext): TUSAssetStandardDto {
  const assetId = asset.assetId ?? asset.id ?? 'unknown-asset';
  const assetType = normalizeAssetType(asset.assetType ?? asset.type ?? 'Asset');
  const category = asset.assetClass ?? inferAssetCategory(assetType);
  const level = asset.riskLevel ?? legacyRisk(asset);
  const health = legacyHealth(asset.readinessStatus ?? asset.maintenanceStatus, level);
  const timestamp = context.generatedAt ?? new Date().toISOString();
  const location = asset.location ?? ('sectorId' in asset ? { sectorId: (asset as { sectorId?: string }).sectorId } : {});
  return {
    schemaVersion: 'trackmind.tus.asset.v1',
    tenantId: asset.tenantId ?? context.tenantId,
    racetrackId: asset.racetrackId ?? context.racetrackId,
    assetId,
    assetType,
    assetCategory: category,
    displayName: asset.name ?? asset.label ?? assetId,
    location: clone(location),
    state: { lifecycleStatus: asset.lifecycleStatus ?? 'active', status: asset.readinessStatus ?? asset.maintenanceStatus ?? 'unknown', ...clone(asset.state ?? {}) },
    health: { status: health, score: asset.healthScore, maintenanceStatus: asset.maintenanceStatus, indicators: [{ name: 'standardized-health', status: health === 'healthy' ? 'ok' : health, value: asset.healthScore ?? asset.readinessStatus ?? asset.maintenanceStatus ?? health, updatedAt: timestamp }] },
    risk: { level, score: riskScore[level], safetyCritical: asset.safetyCritical ?? level === 'critical', drivers: [assetType, asset.owner ?? 'unknown-owner'], evidence: [asset.auditId, asset.eventId].filter(Boolean) as string[] },
    telemetry: (asset.telemetryBindings ?? []).map((binding) => ({ bindingId: binding.bindingId ?? `binding:${assetId}:${binding.sourceId}`, sourceId: binding.sourceId, stream: binding.stream, schemaRef: binding.schemaRef, metric: binding.metric, required: binding.required ?? false, lastObservedAt: binding.lastObservedAt })),
    approvals: (asset.approvals ?? []).map((approval) => ({ id: approval.id, policyId: approval.policyId, status: approval.status, requiredApprovers: approval.requiredApprovers ?? [], reason: approval.reason ?? 'Approval metadata supplied by source DTO.', evidence: approval.evidence ?? [], updatedAt: approval.updatedAt })),
    audit: (asset.audit ?? []).map((record) => ({ id: record.id, action: record.action ?? 'source-audit', actor: record.actor ?? 'source-system', timestamp: record.timestamp ?? timestamp, evidence: record.evidence ?? [] })).concat(asset.auditId ? [{ id: asset.auditId, action: 'source-audit', actor: 'api-facade', timestamp, evidence: [asset.eventId].filter(Boolean) as string[] }] : []),
    twin: asset.twinId ? { twinId: asset.twinId, relationship: 'represents' } : undefined,
    source: { system: 'api-facade-adapter', version: asset.version, mock: asset.mock ?? context.mock ?? false },
  };
}

export function runtimeTwinToTUSTwin(twin: DigitalTwinRuntimeTwin, context?: Partial<TUSStandardContext>): TUSTwinStandardDto {
  const maxRiskScore = Math.max(...twin.riskIndicators.map((risk) => risk.score), 0);
  const level = riskLevelFromScore(maxRiskScore);
  const location = locationFromState(twin.state);
  return {
    schemaVersion: 'trackmind.tus.twin.v1',
    tenantId: twin.tenantId ?? context?.tenantId ?? 'unknown-tenant',
    racetrackId: context?.racetrackId ?? twin.tenantId ?? context?.tenantId ?? 'unknown-racetrack',
    twinId: twin.twinId,
    twinType: inferTwinType(twin.twinId, twin.assetType, twin.domain),
    twinCategory: twin.domain,
    displayName: twin.name,
    assetId: twin.assetId,
    assetType: twin.assetType,
    location,
    state: clone(twin.state),
    health: { status: mapHealth(twin.health), score: 100 - maxRiskScore, indicators: twin.healthIndicators.map((indicator) => ({ name: indicator.name, status: indicator.status === 'critical' ? 'critical' : indicator.status, value: indicator.value, updatedAt: indicator.updatedAt })) },
    risk: { level, score: maxRiskScore, drivers: twin.riskIndicators.map((risk) => risk.rationale), evidence: twin.riskIndicators.map((risk) => risk.name) },
    telemetry: twin.telemetryReferences.map((ref) => ({ sourceId: ref.sensorId, metric: ref.metric, stream: ref.source, required: ref.required, lastObservedAt: ref.lastObservedAt, value: ref.lastValue })),
    approvals: twin.approvalRequirements.map((approval, index) => ({ id: `${twin.twinId}:approval:${index + 1}`, policyId: approval.policyId, status: 'required', requiredApprovers: [...approval.requiredApprovers], reason: approval.reason, evidence: [...approval.requiredFor], updatedAt: twin.updatedAt })),
    audit: twin.eventHistory.map((event) => ({ id: event.id, action: event.eventType, actor: event.actor, timestamp: event.occurredAt, evidence: [event.sourceEventId, event.approvalRequestId].filter(Boolean) as string[] })),
    relationships: twin.relationships.map((rel) => ({ targetId: rel.toTwinId, type: rel.type, evidence: [...rel.evidence], updatedAt: rel.updatedAt })),
    context: { tenantId: twin.tenantId ?? context?.tenantId ?? 'unknown-tenant', racetrackId: context?.racetrackId ?? twin.tenantId ?? context?.tenantId ?? 'unknown-racetrack' },
    source: { system: 'digital-twin-runtime', version: twin.version, mock: context?.mock ?? false },
  };
}

export function foundationTwinToTUSTwin(twin: FoundationTwin, context?: Partial<TUSStandardContext>, auditEvents: FoundationAuditEvent[] = []): TUSTwinStandardDto {
  const level = riskLevelFromScore(twin.riskScore);
  return {
    schemaVersion: 'trackmind.tus.twin.v1',
    tenantId: twin.tenantId,
    racetrackId: context?.racetrackId ?? twin.tenantId,
    twinId: twin.id,
    twinType: inferTwinType(twin.id, twin.kind, twin.kind),
    twinCategory: twin.kind,
    displayName: twin.name,
    assetId: String(twin.state.assetId ?? twin.id),
    assetType: twin.kind,
    location: twin.geospatial ? clone(twin.geospatial as unknown as Record<string, unknown>) : locationFromState(twin.state),
    state: clone(twin.state),
    health: { status: mapHealth(twin.health), score: 100 - twin.riskScore, indicators: twin.healthIndicators.map((indicator) => ({ name: indicator.name, status: indicator.status === 'critical' ? 'critical' : indicator.status, value: indicator.value, updatedAt: indicator.updatedAt })) },
    risk: { level, score: twin.riskScore, drivers: ['foundation-risk-score'], evidence: twin.regulatoryRefs },
    telemetry: twin.telemetryBindings.map((binding) => ({ sourceId: binding.sensorId, metric: binding.metric, required: true, stream: binding.unit })),
    approvals: twin.controls.map((control) => ({ id: control.id, status: control.mode === 'manual-approval-required' ? 'required' : 'not-required', requiredApprovers: [...control.requiredApprovals], reason: control.action, evidence: [] })),
    audit: auditEvents.filter((event) => event.twinId === twin.id).map((event) => ({ id: event.id, action: event.action, actor: event.actor, timestamp: event.occurredAt, evidence: [...event.evidence] })),
    relationships: [...twin.dependencies.map((dependency) => ({ targetId: dependency, type: 'DEPENDS_ON', evidence: ['foundation-dependency'] })), ...twin.regulatoryRefs.map((ref) => ({ targetId: ref, type: 'GOVERNED_BY', evidence: ['foundation-regulatory-ref'] }))],
    context: { tenantId: twin.tenantId, racetrackId: context?.racetrackId ?? twin.tenantId },
    source: { system: 'digital-twin-foundation', version: twin.version, mock: context?.mock ?? false },
  };
}

export function graphNodeToTUSTwin(node: TwinNode, context: TUSStandardContext): TUSTwinStandardDto {
  const health = mapHealth(String(node.state.health ?? node.state.status ?? 'unknown'));
  const risk = riskLevelFromScore(Number(node.state.riskScore ?? 0));
  return {
    schemaVersion: 'trackmind.tus.twin.v1',
    tenantId: node.tenantId ?? context.tenantId,
    racetrackId: context.racetrackId,
    twinId: node.id,
    twinType: inferTwinType(node.id, node.labels.join(' '), node.kind),
    twinCategory: node.kind,
    displayName: node.name,
    assetId: String(node.state.assetId ?? node.id),
    location: locationFromState(node.state),
    state: clone(node.state),
    health: { status: health, indicators: [{ name: 'graph-health', status: health === 'healthy' ? 'ok' : health, value: node.state.health ?? node.state.status ?? 'unknown', updatedAt: node.updatedAt }] },
    risk: { level: risk, score: riskScore[risk], drivers: node.labels, evidence: [] },
    telemetry: [],
    approvals: [],
    audit: [{ id: `${node.id}:graph-upsert`, action: 'graph-node-upserted', actor: 'digital-twin-graph', timestamp: node.updatedAt, evidence: node.labels }],
    relationships: [],
    context: { tenantId: node.tenantId ?? context.tenantId, racetrackId: context.racetrackId },
    source: { system: 'digital-twin-graph', version: node.version, mock: context.mock ?? false },
  };
}

export function createTUSStandardizationWorkspace(input: { assets: TUSAssetStandardDto[]; twins: TUSTwinStandardDto[]; context: TUSStandardContext }): TUSStandardizationWorkspaceDto {
  const generatedAt = input.context.generatedAt ?? new Date().toISOString();
  return {
    generatedAt,
    tenantId: input.context.tenantId,
    racetrackId: input.context.racetrackId,
    assets: input.assets.map(clone),
    twins: input.twins.map(clone),
    coverage: {
      assetTypes: [...new Set(input.assets.map((asset) => asset.assetType))],
      twinTypes: [...new Set(input.twins.map((twin) => twin.twinType))],
      approvals: input.assets.reduce((sum, asset) => sum + asset.approvals.length, 0) + input.twins.reduce((sum, twin) => sum + twin.approvals.length, 0),
      auditEvents: input.assets.reduce((sum, asset) => sum + asset.audit.length, 0) + input.twins.reduce((sum, twin) => sum + twin.audit.length, 0),
      telemetryBindings: input.assets.reduce((sum, asset) => sum + asset.telemetry.length, 0) + input.twins.reduce((sum, twin) => sum + twin.telemetry.length, 0),
    },
    mock: input.context.mock ?? false,
  };
}

function maintenanceHealth(status: string, level: TusRisk): TusHealth {
  if (status === 'out-of-service' || level === 'critical') return 'critical';
  if (status === 'due' || status === 'overdue' || level === 'high') return 'degraded';
  return 'healthy';
}

function legacyHealth(status: string | undefined, level: TusRisk): TusHealth {
  const value = String(status ?? '').toLowerCase();
  if (['blocked', 'critical', 'out-of-service', 'offline'].includes(value) || level === 'critical') return 'critical';
  if (['watch', 'warning', 'maintenance', 'due', 'degraded'].includes(value) || level === 'high') return 'degraded';
  return value ? 'healthy' : 'unknown';
}

function legacyRisk(asset: LegacyAssetProjection): TusRisk {
  if (asset.safetyCritical) return 'critical';
  const status = String(asset.readinessStatus ?? asset.maintenanceStatus ?? '').toLowerCase();
  return status === 'blocked' || status === 'critical' ? 'critical' : status === 'watch' || status === 'warning' ? 'high' : 'medium';
}

function inferAssetCategory(assetType: string): TUSAssetStandardDto['assetCategory'] {
  const normalized = assetType.toLowerCase();
  if (normalized.includes('camera') || normalized.includes('sensor') || normalized.includes('ai')) return normalized.includes('ai') ? 'ai-agent' : 'digital';
  if (normalized.includes('horse') || normalized.includes('stall') || normalized.includes('barn')) return normalized.includes('horse') ? 'biological' : 'physical';
  if (normalized.includes('race') || normalized.includes('workflow') || normalized.includes('employee')) return 'operational';
  if (normalized.includes('regulatory') || normalized.includes('compliance')) return 'regulatory';
  return 'physical';
}

function normalizeAssetType(type: string): string {
  return type.split(/[-_\s]/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join('');
}

function mapHealth(health: string): TusHealth {
  const value = health.toLowerCase();
  if (value === 'critical' || value === 'offline' || value === 'blocked') return 'critical';
  if (value === 'degraded' || value === 'warning' || value === 'watch') return 'degraded';
  if (value === 'healthy' || value === 'ok' || value === 'ready' || value === 'online') return 'healthy';
  return 'unknown';
}

function riskLevelFromScore(score: number): TusRisk {
  return score >= 85 ? 'critical' : score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
}

function locationFromState(state: Record<string, unknown>): Record<string, unknown> {
  const location = state.location;
  if (location && typeof location === 'object' && !Array.isArray(location)) return clone(location as Record<string, unknown>);
  const keys = ['sectorId', 'zoneId', 'facilityId', 'barnId', 'stallId', 'latitude', 'longitude'];
  return Object.fromEntries(keys.flatMap((key) => state[key] === undefined ? [] : [[key, state[key]]]));
}

function inferTwinType(id: string, type: string, category: string): TusTwinType {
  const text = `${id} ${type} ${category}`.toLowerCase();
  if (text.includes('horse') || text.includes('equine')) return 'horse';
  if (text.includes('ai') || text.includes('agent')) return 'ai';
  if (text.includes('track') || text.includes('sector') || text.includes('surface')) return 'track';
  if (text.includes('gate')) return 'gate';
  if (text.includes('facility') || text.includes('barn') || text.includes('stall') || text.includes('generator') || text.includes('pole')) return 'facility';
  if (text.includes('race')) return 'race';
  if (text.includes('employee') || text.includes('workforce') || text.includes('staff')) return 'employee';
  if (text.includes('sensor')) return 'sensor';
  if (text.includes('workflow')) return 'workflow';
  if (text.includes('regulatory') || text.includes('compliance')) return 'regulatory';
  return 'asset';
}
