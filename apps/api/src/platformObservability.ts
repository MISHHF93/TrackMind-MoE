import type { ImmutableAuditLog } from './auditLog.js';
import type { CentralizedApprovalService } from './approvals.js';
import type { DigitalTwinRuntime } from './digitalTwinRuntime.js';
import type { UniversalEventBus } from './eventBus.js';
import type { TelemetryEngine } from './telemetryEngine.js';
import type { WorkflowOrchestrationEngine } from './workflowEngine.js';
import { getRepositoryEnvironment, type RepositoryEnvironment } from './repository/index.js';

export type HealthState = 'healthy' | 'degraded' | 'critical';
export type TelemetrySignalKind = 'log' | 'metric' | 'trace' | 'frontend-error';
export type DependencyProbeId = 'postgres' | 'event-bus' | 'repository' | 'external-connectors';

export interface PlatformServiceHealth { serviceId: string; status: HealthState; latencyMs: number; dependencies: Array<{ id: string; status: HealthState; required: boolean }>; lastCheckedAt: string; }
export interface PlatformTelemetrySignal { kind: TelemetrySignalKind; name: string; serviceId: string; severity: 'debug'|'info'|'warning'|'error'|'critical'; traceId: string; spanId?: string; attributes: Record<string, unknown>; timestamp: string; }
export interface AIConfidenceDistribution { low: number; medium: number; high: number; }
export interface AIControlPlaneObservability { status: HealthState; activeAgents: number; pendingReviews: number; blockedActions: number; driftBreaches: number; inputThroughput: number; featureBuildCount: number; modelSelectionCount: number; recommendationCount: number; blockedActionCount: number; approvalRequiredCount: number; adjustedConfidenceDistribution: AIConfidenceDistribution; staleLowQualityInputCount: number; eventSyncStatus: HealthState; auditSyncStatus: HealthState; twinSyncStatus: HealthState; }
export interface PlatformDeploymentBoundary { providerStyle: 'Azure Front Door-style edge'; assumptions: Array<'HTTPS'|'managed TLS'|'WAF'|'global routing'|'centralized access logs'|'centralized security logs'|'frontend-error logs'>; loggingSignals: Array<'access'|'application'|'security'|'frontend-error'>; routingBoundary: string; implemented: false; copyOnly: true; claim: string; }

export interface DependencyProbeResult {
  id: DependencyProbeId;
  label: string;
  status: HealthState;
  required: boolean;
  latencyMs: number;
  lastCheckedAt: string;
  detail: string;
  attributes?: Record<string, unknown>;
}

export interface AzureApplicationInsightsAdapterStatus {
  enabled: boolean;
  connectionConfigured: boolean;
  adapter: 'stub';
  exportedSignals: number;
  claim: string;
}

export interface PlatformDependencyMatrix {
  generatedAt: string;
  overallStatus: HealthState;
  probes: DependencyProbeResult[];
  azureTelemetry: AzureApplicationInsightsAdapterStatus;
}

interface PlatformAIGovernanceSource { activeAgents?: Array<{ modelVersionId?: string }>; recommendationQueue?: Array<{ modelVersionId?: string; confidence?: number; confidenceScore?: { calibrated?: number; band?: 'low'|'medium'|'high' }; approvalPolicy?: string; lineage?: string[] }>; safetyBlockedActions?: Array<{ modelVersionId?: string; confidence?: number; confidenceScore?: { calibrated?: number; band?: 'low'|'medium'|'high' }; approvalPolicy?: string; lineage?: string[] }>; monitoringMetrics?: Array<{ value: number; threshold: number }>; approvalRequirements?: unknown[]; observabilitySignals?: Array<{ metric?: string; status?: string }>; events?: unknown[]; digitalTwinImpacts?: unknown[]; }

export interface ExternalConnectorProbeSource {
  connectorId: string;
  status: string;
  latencyMs?: number;
  required?: boolean;
}

export interface DependencyProbeContext {
  eventBus?: UniversalEventBus;
  repositoryEnvironment?: RepositoryEnvironment;
  externalConnectors?: ExternalConnectorProbeSource[];
}

export interface PlatformHealthWorkspace { generatedAt: string; overallStatus: HealthState; services: PlatformServiceHealth[]; eventBus: { status: HealthState; publishedEvents: number; deadLetters: number; schemas: number; eventsPerMinute: number; throughputCapacity: number; backpressure: boolean }; audit: { status: HealthState; validLedger: boolean; records: number; criticalRecords: number }; approvalEngine: { status: HealthState; pending: number; approved: number; rejected: number; escalated: number; expired: number }; aiGovernance: AIControlPlaneObservability; digitalTwin: { status: HealthState; totalTwins: number; healthy: number; degraded: number; critical: number; queuedSync: number; lastSyncAt?: string }; workflows: { status: HealthState; active: number; completed: number; failed: number }; apiLatency: { p50Ms: number; p95Ms: number; budgetMs: number; status: HealthState }; frontend: { status: HealthState; reportedErrors: number; lastErrorAt?: string; degradedMode: boolean }; telemetrySchema: { version: 'platform-observability.v1'; requiredSignals: TelemetrySignalKind[]; consistent: boolean }; signals: PlatformTelemetrySignal[]; deploymentBoundary: PlatformDeploymentBoundary; dependencyMatrix: PlatformDependencyMatrix; }

const now = () => new Date().toISOString();
const worst = (states: HealthState[]): HealthState => states.includes('critical') ? 'critical' : states.includes('degraded') ? 'degraded' : 'healthy';
const signal = (kind: TelemetrySignalKind, name: string, serviceId: string, severity: PlatformTelemetrySignal['severity'], attributes: Record<string, unknown>, traceId = `trace-${serviceId}`): PlatformTelemetrySignal => ({ kind, name, serviceId, severity, traceId, spanId: `span-${name}`, attributes, timestamp: now() });
export const defaultPlatformDeploymentBoundary: PlatformDeploymentBoundary = { providerStyle: 'Azure Front Door-style edge', assumptions: ['HTTPS','managed TLS','WAF','global routing','centralized access logs','centralized security logs','frontend-error logs'], loggingSignals: ['access','application','security','frontend-error'], routingBoundary: 'Internet-facing frontend edge before dashboard routes, API routing, and observability ingestion.', implemented: false, copyOnly: true, claim: 'Deployment boundary metadata only; this repository does not implement or claim production Azure Front Door infrastructure and is not proof of configured infrastructure.' };

const dependencyProbeLabels: Record<DependencyProbeId, string> = {
  postgres: 'PostgreSQL persistence',
  'event-bus': 'Universal event bus',
  repository: 'Repository backing store',
  'external-connectors': 'External data connectors',
};

type DependencyProbeFn = (context: DependencyProbeContext, checkedAt: string) => DependencyProbeResult;

export class DependencyProbeRegistry {
  private readonly probes = new Map<DependencyProbeId, DependencyProbeFn>();
  private exportedSignalCount = 0;

  constructor(private readonly context: DependencyProbeContext = {}) {
    this.registerDefaults();
  }

  register(id: DependencyProbeId, probe: DependencyProbeFn): void {
    this.probes.set(id, probe);
  }

  runAll(): PlatformDependencyMatrix {
    const checkedAt = now();
    const results = [...this.probes.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, probe]) => probe(this.context, checkedAt));
    const azureTelemetry = AzureApplicationInsightsAdapter.status(this.exportedSignalCount);
    return {
      generatedAt: checkedAt,
      overallStatus: worst(results.map((probe) => probe.status)),
      probes: results,
      azureTelemetry,
    };
  }

  noteExportedSignal(): void {
    this.exportedSignalCount += 1;
  }

  private registerDefaults(): void {
    this.register('postgres', probePostgres);
    this.register('event-bus', probeEventBus);
    this.register('repository', probeRepository);
    this.register('external-connectors', probeExternalConnectors);
  }
}

function probePostgres(context: DependencyProbeContext, checkedAt: string): DependencyProbeResult {
  const env = context.repositoryEnvironment ?? getRepositoryEnvironment();
  const start = performance.now();
  let status: HealthState = 'healthy';
  let detail = 'In-memory persistence mode; postgres probe nominal.';
  if (env.mode === 'postgres') {
    if (!env.wired) {
      status = 'critical';
      detail = 'Postgres mode requested but TRACKMIND_DATABASE_URL is not configured.';
    } else if (!env.postgresReady) {
      status = env.usingFallback ? 'degraded' : 'critical';
      detail = env.usingFallback
        ? 'Postgres requested but client unavailable; repository snapshot fallback active.'
        : 'Postgres connection string configured but client is not ready.';
    } else {
      detail = 'Postgres persistence client ready.';
    }
  }
  return {
    id: 'postgres',
    label: dependencyProbeLabels.postgres,
    status,
    required: env.mode === 'postgres',
    latencyMs: Math.round(performance.now() - start),
    lastCheckedAt: checkedAt,
    detail,
    attributes: { mode: env.mode, wired: env.wired, postgresReady: env.postgresReady, usingFallback: env.usingFallback },
  };
}

function probeEventBus(context: DependencyProbeContext, checkedAt: string): DependencyProbeResult {
  const start = performance.now();
  const events = context.eventBus?.events() ?? [];
  const dead = context.eventBus?.deadLetterQueue() ?? [];
  const schemas = context.eventBus?.governanceCatalog() ?? [];
  const status: HealthState = dead.length ? 'critical' : events.length > 50000 ? 'degraded' : context.eventBus ? 'healthy' : 'degraded';
  const detail = context.eventBus
    ? dead.length
      ? `Event bus has ${dead.length} dead-letter record(s).`
      : `Event bus reachable with ${events.length} published event(s).`
    : 'Event bus dependency not wired; reporting degraded readiness metadata.';
  return {
    id: 'event-bus',
    label: dependencyProbeLabels['event-bus'],
    status,
    required: true,
    latencyMs: Math.round(performance.now() - start),
    lastCheckedAt: checkedAt,
    detail,
    attributes: { publishedEvents: events.length, deadLetters: dead.length, schemas: schemas.length },
  };
}

function probeRepository(context: DependencyProbeContext, checkedAt: string): DependencyProbeResult {
  const env = context.repositoryEnvironment ?? getRepositoryEnvironment();
  const start = performance.now();
  const namespaceCount = Object.keys(env.namespaces ?? {}).length;
  const status: HealthState = env.usingFallback ? 'degraded' : env.mode === 'postgres' && !env.wired ? 'critical' : 'healthy';
  const detail = env.usingFallback
    ? 'Repository namespaces are served from process-local fallback snapshots.'
    : namespaceCount > 0
      ? `Repository namespaces hydrated (${namespaceCount} active).`
      : 'Repository abstraction ready; no persisted namespaces yet.';
  return {
    id: 'repository',
    label: dependencyProbeLabels.repository,
    status,
    required: true,
    latencyMs: Math.round(performance.now() - start),
    lastCheckedAt: checkedAt,
    detail,
    attributes: { mode: env.mode, namespaceCount, pgClientAvailable: env.pgClientAvailable },
  };
}

function mapConnectorStatus(status: string): HealthState {
  const normalized = status.toLowerCase();
  if (['critical', 'failed', 'offline', 'blocked'].includes(normalized)) return 'critical';
  if (['degraded', 'suspended', 'warning', 'stale'].includes(normalized)) return 'degraded';
  return 'healthy';
}

function probeExternalConnectors(context: DependencyProbeContext, checkedAt: string): DependencyProbeResult {
  const start = performance.now();
  const connectors = context.externalConnectors ?? [];
  const statuses = connectors.map((connector) => mapConnectorStatus(connector.status));
  const status: HealthState = connectors.length === 0 ? 'degraded' : worst(statuses);
  const unhealthy = connectors.filter((connector) => mapConnectorStatus(connector.status) !== 'healthy');
  const detail = connectors.length === 0
    ? 'No external connector registry wired; connector health metadata unavailable.'
    : unhealthy.length === 0
      ? `All ${connectors.length} connector(s) report healthy status.`
      : `${unhealthy.length} of ${connectors.length} connector(s) require attention.`;
  return {
    id: 'external-connectors',
    label: dependencyProbeLabels['external-connectors'],
    status,
    required: false,
    latencyMs: Math.round(performance.now() - start),
    lastCheckedAt: checkedAt,
    detail,
    attributes: {
      connectorCount: connectors.length,
      unhealthyConnectors: unhealthy.map((connector) => connector.connectorId),
      averageLatencyMs: connectors.length
        ? Math.round(connectors.reduce((sum, connector) => sum + (connector.latencyMs ?? 0), 0) / connectors.length)
        : 0,
    },
  };
}

export class AzureApplicationInsightsAdapter {
  private static exportedSignals = 0;

  static resetForTests(): void {
    AzureApplicationInsightsAdapter.exportedSignals = 0;
  }

  static isEnabled(): boolean {
    return Boolean(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING?.trim());
  }

  static status(exportedSignals = AzureApplicationInsightsAdapter.exportedSignals): AzureApplicationInsightsAdapterStatus {
    const connectionConfigured = AzureApplicationInsightsAdapter.isEnabled();
    return {
      enabled: connectionConfigured,
      connectionConfigured,
      adapter: 'stub',
      exportedSignals,
      claim: connectionConfigured
        ? 'Azure Application Insights connection string detected; export adapter is a repository stub and does not transmit telemetry.'
        : 'Azure Application Insights adapter disabled until APPLICATIONINSIGHTS_CONNECTION_STRING is configured.',
    };
  }

  static exportSignal(entry: PlatformTelemetrySignal, registry?: DependencyProbeRegistry): void {
    if (!AzureApplicationInsightsAdapter.isEnabled()) return;
    AzureApplicationInsightsAdapter.exportedSignals += 1;
    registry?.noteExportedSignal();
  }
}

export class PlatformObservabilityService {
  private readonly frontendErrors: PlatformTelemetrySignal[] = [];
  private readonly telemetrySignals: PlatformTelemetrySignal[] = [];
  private readonly latencies: number[] = [];
  private readonly probeRegistry: DependencyProbeRegistry;

  constructor(private readonly deps: {
    eventBus?: UniversalEventBus;
    auditLog?: ImmutableAuditLog;
    approvals?: CentralizedApprovalService;
    telemetry?: TelemetryEngine;
    twins?: DigitalTwinRuntime;
    workflows?: WorkflowOrchestrationEngine;
    aiGovernance?: PlatformAIGovernanceSource;
    repositoryEnvironment?: RepositoryEnvironment;
    externalConnectors?: ExternalConnectorProbeSource[];
  } = {}) {
    this.probeRegistry = new DependencyProbeRegistry({
      eventBus: deps.eventBus,
      repositoryEnvironment: deps.repositoryEnvironment,
      externalConnectors: deps.externalConnectors,
    });
  }

  dependencyMatrix(): PlatformDependencyMatrix {
    return this.probeRegistry.runAll();
  }

  recordApiLatency(serviceId: string, route: string, latencyMs: number, statusCode = 200): PlatformTelemetrySignal {
    this.latencies.push(latencyMs);
    const entry = signal('metric', 'api.request.latency', serviceId, latencyMs > 500 || statusCode >= 500 ? 'warning' : 'info', { route, latencyMs, statusCode });
    this.telemetrySignals.push(entry);
    AzureApplicationInsightsAdapter.exportSignal(entry, this.probeRegistry);
    return entry;
  }

  reportFrontendError(input: { message: string; route: string; component: string; traceId?: string; severity?: 'warning'|'error'|'critical' }): PlatformTelemetrySignal {
    const entry = signal('frontend-error', 'frontend.error.reported', 'dashboard', input.severity ?? 'error', { message: input.message, route: input.route, component: input.component }, input.traceId);
    this.frontendErrors.push(entry);
    AzureApplicationInsightsAdapter.exportSignal(entry, this.probeRegistry);
    return entry;
  }

  health(): PlatformHealthWorkspace {
    const events = this.deps.eventBus?.events() ?? []; const dead = this.deps.eventBus?.deadLetterQueue() ?? []; const schemas = this.deps.eventBus?.governanceCatalog() ?? [];
    const auditRecords = this.deps.auditLog?.all() ?? []; const auditValid = this.deps.auditLog?.verify().valid ?? true;
    const approvals = this.deps.approvals?.allRequests() ?? []; const twins = this.deps.twins?.queryTwins() ?? [];
    const workflowItems = this.workflowItems(); const ai = this.deps.aiGovernance;
    const twinCounts = { healthy: twins.filter((t) => t.health === 'healthy').length, degraded: twins.filter((t) => t.health === 'degraded').length, critical: twins.filter((t) => t.health === 'critical').length };
    const latency = this.percentiles(); const eventStatus = dead.length ? 'critical' : events.length > 50000 ? 'degraded' : 'healthy';
    const auditStatus = auditValid ? 'healthy' : 'critical'; const approvalStatus = approvals.some((r) => r.status === 'escalated') ? 'degraded' : 'healthy';
    const twinStatus = twinCounts.critical ? 'critical' : twinCounts.degraded ? 'degraded' : 'healthy'; const workflowStatus = workflowItems.failed ? 'critical' : 'healthy';
    const aiStatus = (ai?.monitoringMetrics ?? []).some((m) => m.value > m.threshold) ? 'degraded' : 'healthy'; const frontendStatus = this.frontendErrors.length ? 'degraded' : 'healthy';
    const aiControlPlane = this.aiControlPlaneMetrics(ai, aiStatus, eventStatus, auditStatus, twinStatus);
    const dependencyMatrix = this.dependencyMatrix();
    const services: PlatformServiceHealth[] = ['api-gateway','event-bus','audit-ledger','approval-engine','ai-governance','digital-twin-runtime','facilities-maintenance','dashboard'].map((serviceId) => ({ serviceId, status: serviceId === 'event-bus' ? eventStatus : serviceId === 'audit-ledger' ? auditStatus : serviceId === 'approval-engine' ? approvalStatus : serviceId === 'ai-governance' ? aiStatus : serviceId === 'digital-twin-runtime' || serviceId === 'facilities-maintenance' ? twinStatus : serviceId === 'dashboard' ? frontendStatus : latency.status, latencyMs: serviceId === 'api-gateway' ? latency.p95Ms : serviceId === 'facilities-maintenance' ? 48 : 25, dependencies: [{ id: 'event-bus', status: eventStatus, required: serviceId !== 'dashboard' }, { id: 'audit-ledger', status: auditStatus, required: ['approval-engine','ai-governance','digital-twin-runtime','facilities-maintenance'].includes(serviceId) }], lastCheckedAt: now() }));
    const signals = [signal('log','platform.health.evaluated','platform-observability','info',{ serviceCount: services.length, dependencyProbeCount: dependencyMatrix.probes.length }), signal('metric','event.throughput','event-bus',eventStatus === 'healthy' ? 'info' : 'warning',{ eventsPerMinute: events.length, deadLetters: dead.length }), signal('trace','dependency.health.walk','platform-observability','info',{ dependencies: dependencyMatrix.probes.length, matrixStatus: dependencyMatrix.overallStatus }), ...this.telemetrySignals, ...this.frontendErrors];
    const overallStatus = worst([eventStatus, auditStatus, approvalStatus, twinStatus, workflowStatus, aiStatus, frontendStatus, latency.status, dependencyMatrix.overallStatus]);
    return { generatedAt: now(), overallStatus, services, eventBus: { status: eventStatus, publishedEvents: events.length, deadLetters: dead.length, schemas: schemas.length, eventsPerMinute: events.length, throughputCapacity: 100000, backpressure: events.length > 100000 }, audit: { status: auditStatus, validLedger: auditValid, records: auditRecords.length, criticalRecords: auditRecords.filter((r) => r.severity === 'critical').length }, approvalEngine: { status: approvalStatus, pending: approvals.filter((r)=>r.status==='pending').length, approved: approvals.filter((r)=>r.status==='approved').length, rejected: approvals.filter((r)=>r.status==='rejected').length, escalated: approvals.filter((r)=>r.status==='escalated').length, expired: approvals.filter((r)=>r.status==='expired').length }, aiGovernance: aiControlPlane, digitalTwin: { status: twinStatus, totalTwins: twins.length, ...twinCounts, queuedSync: twins.filter((t)=>t.approvalRequirements.length > 0).length, lastSyncAt: twins.map((t)=>t.updatedAt).sort().at(-1) }, workflows: { status: workflowStatus, ...workflowItems }, apiLatency: latency, frontend: { status: frontendStatus, reportedErrors: this.frontendErrors.length, lastErrorAt: this.frontendErrors.at(-1)?.timestamp, degradedMode: overallStatus !== 'healthy' }, telemetrySchema: { version: 'platform-observability.v1', requiredSignals: ['log','metric','trace','frontend-error'], consistent: signals.every((s)=>s.traceId && s.serviceId && s.timestamp) }, signals, deploymentBoundary: defaultPlatformDeploymentBoundary, dependencyMatrix };
  }

  private aiControlPlaneMetrics(ai: PlatformAIGovernanceSource | undefined, status: HealthState, eventSyncStatus: HealthState, auditSyncStatus: HealthState, twinSyncStatus: HealthState): AIControlPlaneObservability {
    const queue = ai?.recommendationQueue ?? [];
    const blocked = ai?.safetyBlockedActions ?? [];
    const recommendations = [...queue, ...blocked];
    const distribution = recommendations.reduce<AIConfidenceDistribution>((summary, rec) => {
      const calibrated = rec.confidenceScore?.calibrated ?? rec.confidence ?? 0;
      const band = rec.confidenceScore?.band ?? (calibrated >= 0.8 ? 'high' : calibrated >= 0.55 ? 'medium' : 'low');
      summary[band] += 1;
      return summary;
    }, { low: 0, medium: 0, high: 0 });
    const modelIds = new Set([...recommendations.map((rec) => rec.modelVersionId).filter(Boolean), ...(ai?.activeAgents ?? []).map((agent) => agent.modelVersionId).filter(Boolean)]);
    const featureLineage = new Set(recommendations.flatMap((rec) => rec.lineage ?? []).filter((item) => /feature|dataset|input|telemetry/i.test(item)));
    const staleLowQualityInputCount = (ai?.observabilitySignals ?? []).filter((signal) => /stale|quality|evidence-count/.test(signal.metric ?? '') && signal.status !== 'nominal').length;
    return {
      status,
      activeAgents: ai?.activeAgents?.length ?? 0,
      pendingReviews: queue.length,
      blockedActions: blocked.length,
      driftBreaches: (ai?.monitoringMetrics ?? []).filter((m) => m.value > m.threshold).length,
      inputThroughput: recommendations.length + (ai?.events?.length ?? 0),
      featureBuildCount: featureLineage.size,
      modelSelectionCount: modelIds.size,
      recommendationCount: recommendations.length,
      blockedActionCount: blocked.length,
      approvalRequiredCount: ai?.approvalRequirements?.length ?? recommendations.filter((rec) => rec.approvalPolicy && rec.approvalPolicy !== 'none').length,
      adjustedConfidenceDistribution: distribution,
      staleLowQualityInputCount,
      eventSyncStatus,
      auditSyncStatus,
      twinSyncStatus,
    };
  }
  private percentiles() { const values = this.latencies.length ? [...this.latencies].sort((a,b)=>a-b) : [42, 88, 140]; const pick = (p: number) => values[Math.min(values.length - 1, Math.floor(values.length * p))]; const p95Ms = pick(.95); return { p50Ms: pick(.5), p95Ms, budgetMs: 250, status: (p95Ms > 500 ? 'critical' : p95Ms > 250 ? 'degraded' : 'healthy') as HealthState }; }
  private workflowItems() { const items = (this.deps.workflows as any)?.instances?.() ?? []; return { active: items.filter((w: any)=>['running','pending','waiting'].includes(w.status)).length, completed: items.filter((w: any)=>w.status==='completed').length, failed: items.filter((w: any)=>['failed','cancelled'].includes(w.status)).length }; }
}

export function createMockPlatformHealth(overrides: Partial<DependencyProbeContext> = {}): PlatformHealthWorkspace {
  const obs = new PlatformObservabilityService(overrides);
  obs.recordApiLatency('api-gateway','/api/v1/operations/command-center',184);
  obs.recordApiLatency('api-gateway','/api/v1/digital-twin/state',226);
  obs.reportFrontendError({ message:'Surface chart feed degraded; cached view rendered', route:'/platform-health', component:'PlatformHealthWorkspace', severity:'warning', traceId:'trace-ui-degraded' });
  const live = obs.health();
  return {
    ...live,
    eventBus:{ status:'healthy', publishedEvents:1842, deadLetters:0, schemas:28, eventsPerMinute:312, throughputCapacity:100000, backpressure:false },
    audit:{ status:'healthy', validLedger:true, records:936, criticalRecords:2 },
    approvalEngine:{ status:'degraded', pending:7, approved:31, rejected:2, escalated:1, expired:0 },
    aiGovernance:{ status:'healthy', activeAgents:4, pendingReviews:3, blockedActions:2, driftBreaches:0, inputThroughput:42, featureBuildCount:9, modelSelectionCount:5, recommendationCount:11, blockedActionCount:2, approvalRequiredCount:7, adjustedConfidenceDistribution:{ low:1, medium:4, high:6 }, staleLowQualityInputCount:1, eventSyncStatus:'healthy', auditSyncStatus:'healthy', twinSyncStatus:'degraded' },
    digitalTwin:{ status:'degraded', totalTwins:128, healthy:119, degraded:8, critical:1, queuedSync:5, lastSyncAt:'2026-06-14T00:00:00.000Z' },
    workflows:{ status:'healthy', active:12, completed:244, failed:0 },
    overallStatus:'degraded',
    dependencyMatrix: live.dependencyMatrix,
  };
}
