import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceDayReadinessService, raceDayReadinessChecklist, UniversalEventBus, ImmutableAuditLog } from '../dist/index.js';

test('race-day readiness evaluates score, events, warnings, approvals, audit, and dashboard', () => {
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const seen = [];
  eventBus.subscribe('*', (event) => seen.push(event), { name: 'readiness-spy' });
  const service = new RaceDayReadinessService({ eventBus, auditLog });
  const checks = raceDayReadinessChecklist('2026-06-13T20:45:00Z').map((check) => check.domain === 'weather' ? { ...check, score: 62, status: 'blocked', blockers: ['lightning within hold radius'], evidence: ['weather:lightning-7mi'], approvalRequired: true } : check.domain === 'facility' ? { ...check, score: 81, status: 'watch', blockers: ['grandstand HVAC elevated load'], evidence: ['facility:hvac-watch'] } : check);

  const assessment = service.evaluate({ raceId: 'race-7', trackId: 'main', postTime: '2026-06-13T21:00:00Z', evaluatedAt: '2026-06-13T20:45:00Z', checks }, 'race-day-commander');
  assert.equal(assessment.status, 'blocked');
  assert.equal(assessment.checks.length, 9);
  assert.ok(assessment.overallScore < 100);
  assert.ok(assessment.events.some((event) => event.type === 'readiness.approval-required'));
  assert.ok(assessment.warnings.some((warning) => warning.domain === 'weather' && warning.severity === 'critical'));
  assert.ok(assessment.approvals.some((approval) => approval.action === 'weather-readiness-override'));
  assert.equal(assessment.audit.previousHash, 'genesis');
  assert.ok(seen.some((event) => event.type === 'readiness.blocked'));
  assert.equal(auditLog.forensicTimeline({ subjectId: 'race-7' }).length, 1);

  const dashboard = service.dashboard('2026-06-13T20:46:00Z');
  assert.equal(dashboard.blocked, 1);
  assert.equal(dashboard.races[0].warnings, 2);
  assert.equal(dashboard.domainScores.find((domain) => domain.domain === 'weather').blocked, 1);
  assert.ok(service.apiDefinition().endpoints.some((endpoint) => endpoint.path === '/dashboard'));
});
