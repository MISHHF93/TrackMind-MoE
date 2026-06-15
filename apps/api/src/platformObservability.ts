import type { ImmutableAuditLog } from './auditLog.js';
import type { CentralizedApprovalService } from './approvals.js';
import type { DigitalTwinRuntime } from './digitalTwinRuntime.js';
import type { UniversalEventBus } from './eventBus.js';
import type { TelemetryEngine } from './telemetryEngine.js';
import type { WorkflowOrchestrationEngine } from './workflowEngine.js';

export type HealthState = 'healthy' | 'degraded' | 'critical';
export type TelemetrySignalKind = 'log' | 'metric' | 'trace' | 'frontend-error';
export interface PlatformServiceHealth { serviceId: string; status: HealthState; latencyMs: number; dependencies: Array<{ id: string; status: HealthState; required: boolean }>; lastCheckedAt: string; }
export interface PlatformTelemetrySignal { kind: TelemetrySignalKind; name: string; serviceId: string; severity: 'debug'|'info'|'warning'|'error'|'critical'; traceId: string; spanId?: string; attributes: Record<string, unknown>; timestamp: string; }
export interface AIConfidenceDistribution { low: number; medium: number; high: number; }
export interface AIControlPlaneObservability { status: HealthState; activeAgents: number; pendingReviews: number; blockedActions: number; driftBreaches: number; inputThroughput: number; featureBuildCount: number; modelSelectionCount: number; recommendationCount: number; blockedActionCount: number; approvalRequiredCount: number; adjustedConfidenceDistribution: AIConfidenceDistribution; staleLowQualityInputCount: number; eventSyncStatus: HealthState; auditSyncStatus: HealthState; twinSyncStatus: HealthState; }
export interface PlatformDeploymentBoundary { providerStyle: 'Azure Front Door-style edge'; assumptions: Array<'HTTPS'|'managed TLS'|'WAF'|'global routing'|'centralized access logs'|'centralized security logs'|'frontend-error logs'>; loggingSignals: Array<'access'|'application'|'security'|'frontend-error'>; routingBoundary: string; implemented: false; copyOnly: true; claim: string; }
interface PlatformAIGovernanceSource { activeAgents?: Array<{ modelVersionId?: string }>; recommendationQueue?: Array<{ modelVersionId?: string; confidence?: number; confidenceScore?: { calibrated?: number; band?: 'low'|'medium'|'high' }; approvalPolicy?: string; lineage?: string[] }>; safetyBlockedActions?: Array<{ modelVersionId?: string; confidence?: number; confidenceScore?: { calibrated?: number; band?: 'low'|'medium'|'high' }; approvalPolicy?: string; lineage?: string[] }>; monitoringMetrics?: Array<{ value: number; threshold: number }>; approvalRequirements?: unknown[]; observabilitySignals?: Array<{ metric?: string; status?: string }>; events?: unknown[]; digitalTwinImpacts?: unknown[]; }
export interface PlatformHealthWorkspace { generatedAt: string; overallStatus: HealthState; services: PlatformServiceHealth[]; eventBus: { status: HealthState; publishedEvents: number; deadLetters: number; schemas: number; eventsPerMinute: number; throughputCapacity: number; backpressure: boolean }; audit: { status: HealthState; validLedger: boolean; records: number; criticalRecords: number }; approvalEngine: { status: HealthState; pending: number; approved: number; rejected: number; escalated: number; expired: number }; aiGovernance: AIControlPlaneObservability; digitalTwin: { status: HealthState; totalTwins: number; healthy: number; degraded: number; critical: number; queuedSync: number; lastSyncAt?: string }; workflows: { status: HealthState; active: number; completed: number; failed: number }; apiLatency: { p50Ms: number; p95Ms: number; budgetMs: number; status: HealthState }; frontend: { status: HealthState; reportedErrors: number; lastErrorAt?: string; degradedMode: boolean }; telemetrySchema: { version: 'platform-observability.v1'; requiredSignals: TelemetrySignalKind[]; consistent: boolean }; signals: PlatformTelemetrySignal[]; deploymentBoundary: PlatformDeploymentBoundary; }

const now = () => new Date().toISOString();
const worst = (states: HealthState[]): HealthState => states.includes('critical') ? 'critical' : states.includes('degraded') ? 'degraded' : 'healthy';
const signal = (kind: TelemetrySignalKind, name: string, serviceId: string, severity: PlatformTelemetrySignal['severity'], attributes: Record<string, unknown>, traceId = `trace-${serviceId}`): PlatformTelemetrySignal => ({ kind, name, serviceId, severity, traceId, spanId: `span-${name}`, attributes, timestamp: now() });
export const defaultPlatformDeploymentBoundary: PlatformDeploymentBoundary = { providerStyle: 'Azure Front Door-style edge', assumptions: ['HTTPS','managed TLS','WAF','global routing','centralized access logs','centralized security logs','frontend-error logs'], loggingSignals: ['access','application','security','frontend-error'], routingBoundary: 'Internet-facing frontend edge before dashboard routes, API routing, and observability ingestion.', implemented: false, copyOnly: true, claim: 'Deployment boundary metadata only; this repository does not implement or claim production Azure Front Door infrastructure and is not proof of configured infrastructure.' };

export class PlatformObservabilityService {
  private readonly frontendErrors: PlatformTelemetrySignal[] = [];
  private readonly telemetrySignals: PlatformTelemetrySignal[] = [];
  private readonly latencies: number[] = [];
  constructor(private readonly deps: { eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog; approvals?: CentralizedApprovalService; telemetry?: TelemetryEngine; twins?: DigitalTwinRuntime; workflows?: WorkflowOrchestrationEngine; aiGovernance?: PlatformAIGovernanceSource } = {}) {}
  recordApiLatency(serviceId: string, route: string, latencyMs: number, statusCode = 200): PlatformTelemetrySignal { this.latencies.push(latencyMs); const entry = signal('metric', 'api.request.latency', serviceId, latencyMs > 500 || statusCode >= 500 ? 'warning' : 'info', { route, latencyMs, statusCode }); this.telemetrySignals.push(entry); return entry; }
  reportFrontendError(input: { message: string; route: string; component: string; traceId?: string; severity?: 'warning'|'error'|'critical' }): PlatformTelemetrySignal { const entry = signal('frontend-error', 'frontend.error.reported', 'dashboard', input.severity ?? 'error', { message: input.message, route: input.route, component: input.component }, input.traceId); this.frontendErrors.push(entry); return entry; }
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
    const services: PlatformServiceHealth[] = ['api-gateway','event-bus','audit-ledger','approval-engine','ai-governance','digital-twin-runtime','facilities-maintenance','dashboard'].map((serviceId) => ({ serviceId, status: serviceId === 'event-bus' ? eventStatus : serviceId === 'audit-ledger' ? auditStatus : serviceId === 'approval-engine' ? approvalStatus : serviceId === 'ai-governance' ? aiStatus : serviceId === 'digital-twin-runtime' || serviceId === 'facilities-maintenance' ? twinStatus : serviceId === 'dashboard' ? frontendStatus : latency.status, latencyMs: serviceId === 'api-gateway' ? latency.p95Ms : serviceId === 'facilities-maintenance' ? 48 : 25, dependencies: [{ id: 'event-bus', status: eventStatus, required: serviceId !== 'dashboard' }, { id: 'audit-ledger', status: auditStatus, required: ['approval-engine','ai-governance','digital-twin-runtime','facilities-maintenance'].includes(serviceId) }], lastCheckedAt: now() }));
    const signals = [signal('log','platform.health.evaluated','platform-observability','info',{ serviceCount: services.length }), signal('metric','event.throughput','event-bus',eventStatus === 'healthy' ? 'info' : 'warning',{ eventsPerMinute: events.length, deadLetters: dead.length }), signal('trace','dependency.health.walk','platform-observability','info',{ dependencies: services.flatMap((s)=>s.dependencies).length }), ...this.telemetrySignals, ...this.frontendErrors];
    const overallStatus = worst([eventStatus, auditStatus, approvalStatus, twinStatus, workflowStatus, aiStatus, frontendStatus, latency.status]);
    return { generatedAt: now(), overallStatus, services, eventBus: { status: eventStatus, publishedEvents: events.length, deadLetters: dead.length, schemas: schemas.length, eventsPerMinute: events.length, throughputCapacity: 100000, backpressure: events.length > 100000 }, audit: { status: auditStatus, validLedger: auditValid, records: auditRecords.length, criticalRecords: auditRecords.filter((r) => r.severity === 'critical').length }, approvalEngine: { status: approvalStatus, pending: approvals.filter((r)=>r.status==='pending').length, approved: approvals.filter((r)=>r.status==='approved').length, rejected: approvals.filter((r)=>r.status==='rejected').length, escalated: approvals.filter((r)=>r.status==='escalated').length, expired: approvals.filter((r)=>r.status==='expired').length }, aiGovernance: aiControlPlane, digitalTwin: { status: twinStatus, totalTwins: twins.length, ...twinCounts, queuedSync: twins.filter((t)=>t.approvalRequirements.length > 0).length, lastSyncAt: twins.map((t)=>t.updatedAt).sort().at(-1) }, workflows: { status: workflowStatus, ...workflowItems }, apiLatency: latency, frontend: { status: frontendStatus, reportedErrors: this.frontendErrors.length, lastErrorAt: this.frontendErrors.at(-1)?.timestamp, degradedMode: overallStatus !== 'healthy' }, telemetrySchema: { version: 'platform-observability.v1', requiredSignals: ['log','metric','trace','frontend-error'], consistent: signals.every((s)=>s.traceId && s.serviceId && s.timestamp) }, signals, deploymentBoundary: defaultPlatformDeploymentBoundary };
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

export function createMockPlatformHealth(): PlatformHealthWorkspace { const obs = new PlatformObservabilityService(); obs.recordApiLatency('api-gateway','/api/v1/operations/command-center',184); obs.recordApiLatency('api-gateway','/api/v1/digital-twin/state',226); obs.reportFrontendError({ message:'Surface chart feed degraded; cached view rendered', route:'/platform-health', component:'PlatformHealthWorkspace', severity:'warning', traceId:'trace-ui-degraded' }); return { ...obs.health(), eventBus:{ status:'healthy', publishedEvents:1842, deadLetters:0, schemas:28, eventsPerMinute:312, throughputCapacity:100000, backpressure:false }, audit:{ status:'healthy', validLedger:true, records:936, criticalRecords:2 }, approvalEngine:{ status:'degraded', pending:7, approved:31, rejected:2, escalated:1, expired:0 }, aiGovernance:{ status:'healthy', activeAgents:4, pendingReviews:3, blockedActions:2, driftBreaches:0, inputThroughput:42, featureBuildCount:9, modelSelectionCount:5, recommendationCount:11, blockedActionCount:2, approvalRequiredCount:7, adjustedConfidenceDistribution:{ low:1, medium:4, high:6 }, staleLowQualityInputCount:1, eventSyncStatus:'healthy', auditSyncStatus:'healthy', twinSyncStatus:'degraded' }, digitalTwin:{ status:'degraded', totalTwins:128, healthy:119, degraded:8, critical:1, queuedSync:5, lastSyncAt:'2026-06-14T00:00:00.000Z' }, workflows:{ status:'healthy', active:12, completed:244, failed:0 }, overallStatus:'degraded' }; }
