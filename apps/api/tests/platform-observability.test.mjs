import assert from 'node:assert/strict';
import test from 'node:test';
import { PlatformObservabilityService, createMockPlatformHealth, UniversalEventBus, ImmutableAuditLog, CentralizedApprovalService } from '../dist/index.js';

test('platform health endpoint model reports core dependencies and health dimensions', () => {
  const health = createMockPlatformHealth();
  assert.equal(health.telemetrySchema.version, 'platform-observability.v1');
  for (const service of ['api-gateway','event-bus','audit-ledger','approval-engine','ai-governance','digital-twin-runtime','dashboard']) assert.ok(health.services.some((s) => s.serviceId === service));
  assert.equal(health.eventBus.deadLetters, 0);
  assert.equal(health.audit.validLedger, true);
  assert.ok(health.digitalTwin.queuedSync >= 1);
});

test('telemetry schema consistency requires traceable logs metrics traces and frontend errors', () => {
  const obs = new PlatformObservabilityService();
  obs.recordApiLatency('api-gateway', '/api/v1/platform/health', 123);
  obs.reportFrontendError({ message:'render failed', route:'/platform-health', component:'PlatformHealthWorkspace', traceId:'trace-test' });
  const health = obs.health();
  assert.equal(health.telemetrySchema.consistent, true);
  for (const kind of health.telemetrySchema.requiredSignals) assert.ok(health.signals.some((s) => s.kind === kind), `missing signal ${kind}`);
  assert.ok(health.signals.every((s) => s.traceId && s.serviceId && s.timestamp));
});

test('platform observability derives event throughput, approval queue, audit ledger, and API latency metrics', async () => {
  const eventBus = new UniversalEventBus();
  await eventBus.publish({ type:'platform.health.checked', payload:{ subjectId:'platform' }, producer:'test' });
  const auditLog = new ImmutableAuditLog();
  const approvals = new CentralizedApprovalService({ auditLog, eventBus });
  approvals.createRequest({ tenantId:'tenant-1', action:'race-start', target:'race-1', requestedBy:'agent', actorType:'ai-agent', reason:'readiness', evidence:['readiness'] });
  const obs = new PlatformObservabilityService({ eventBus, auditLog, approvals });
  obs.recordApiLatency('api-gateway', '/api/v1/platform/health', 640, 200);
  const health = obs.health();
  assert.equal(health.eventBus.publishedEvents >= 1, true);
  assert.equal(health.approvalEngine.pending, 1);
  assert.equal(health.audit.validLedger, true);
  assert.equal(health.apiLatency.status, 'critical');
});
