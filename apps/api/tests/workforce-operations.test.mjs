import test from 'node:test';
import assert from 'node:assert/strict';
import { EnterpriseIdentityGovernancePlatform } from '@trackmind/shared';
import {
  CentralizedApprovalService,
  EmergencyOperationsPlatform,
  GovernedWorkforceOperationsService,
  ImmutableAuditLog,
  InMemoryEventBus,
  RaceDayReadinessService,
  raceDayReadinessChecklist,
} from '../dist/index.js';

const entra = { tenantId: 'track-1', issuer: 'https://login.example/track-1', jwksUri: 'https://login.example/keys', authority: 'https://login.example', appId: 'trackmind-workforce', syncGroups: ['workforce-ops'], conditionalAccessPolicies: ['mfa'] };
const identity = (id, roles, attributes = {}) => ({ id, tenantId: 'track-1', kind: 'user', displayName: id, roles, attributes });

test('workforce operations reuses identity governance and audits certification compliance events', async () => {
  const governance = new EnterpriseIdentityGovernancePlatform(entra);
  governance.definePolicy({ id: 'workforce-compliance', tenantId: 'track-1', name: 'Workforce compliance recorders', permissions: ['compliance:report'], roles: ['workforce-compliance'], evidenceRequired: ['cert:evidence'] });
  governance.registerIdentity(identity('manager-1', ['workforce-compliance']));
  const auditLog = new ImmutableAuditLog();
  const eventBus = new InMemoryEventBus();
  const approvals = new CentralizedApprovalService({ auditLog, eventBus });
  const service = new GovernedWorkforceOperationsService('track-1', { identityGovernance: governance, auditLog, eventBus, approvals });

  service.registerEmployee({
    identity: identity('staff-1', ['gate-crew'], { department: 'race-operations' }),
    employeeNumber: 'EMP-1',
    department: 'race-operations',
    managerIdentityId: 'manager-1',
    employmentStatus: 'active',
    emergencyQualified: false,
    hiredAt: '2024-01-01T00:00:00.000Z',
  }, 'manager-1', '2026-06-13T12:00:00.000Z');
  const cert = service.upsertCertification({ id: 'cert-1', tenantId: 'track-1', identityId: 'staff-1', kind: 'gate-safety', status: 'active', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z', evidence: ['cert:evidence'], requiredForRoles: ['gate-crew'] }, 'manager-1', '2026-06-13T12:01:00.000Z');

  assert.equal(governance.identity('staff-1').tenantId, 'track-1');
  assert.ok(cert.auditId);
  assert.ok(cert.eventId);
  assert.ok(auditLog.all().some((entry) => entry.type === 'regulatory-activity' && entry.subjectId === 'staff-1'));
  assert.ok(eventBus.events({ type: 'workforce.certification.changed' }).length >= 1);
});

test('workforce readiness feeds race-day readiness and emergency workflows', () => {
  const auditLog = new ImmutableAuditLog();
  const eventBus = new InMemoryEventBus();
  const approvals = new CentralizedApprovalService({ auditLog, eventBus });
  const service = new GovernedWorkforceOperationsService('track-1', { auditLog, eventBus, approvals });
  service.registerEmployee({ identity: identity('staff-emergency', ['security'], { department: 'emergency' }), employeeNumber: 'EMP-2', department: 'emergency', managerIdentityId: 'manager-1', employmentStatus: 'active', emergencyQualified: true, hiredAt: '2024-01-01T00:00:00.000Z' }, 'seed', '2026-06-13T12:00:00.000Z');
  service.scheduleShift({ id: 'shift-1', tenantId: 'track-1', label: 'Race 7 staffing', startsAt: '2026-06-13T19:00:00.000Z', endsAt: '2026-06-13T22:00:00.000Z', zoneId: 'zone-grandstand', status: 'active', raceId: 'race-7', requirements: [{ role: 'incident-liaison', demand: 1, certificationKinds: ['ics-200'], emergencyCritical: true }] }, 'planner', '2026-06-13T12:00:00.000Z');
  service.upsertCertification({ id: 'cert-ics', tenantId: 'track-1', identityId: 'staff-emergency', kind: 'ics-200', status: 'active', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z', evidence: ['cert:ics'], requiredForRoles: ['incident-liaison'] }, 'workforce-compliance', '2026-06-13T12:01:00.000Z');
  service.assign({ id: 'assign-1', tenantId: 'track-1', identityId: 'staff-emergency', role: 'incident-liaison', shiftId: 'shift-1', zoneId: 'zone-grandstand', status: 'assigned', certificationKinds: ['ics-200'], emergencyCritical: true, raceId: 'race-7' }, 'planner', '2026-06-13T12:02:00.000Z');
  const workforce = service.readiness('2026-06-13T12:03:00.000Z', 'race-7');

  const readiness = new RaceDayReadinessService({ eventBus, auditLog });
  const assessment = readiness.evaluate({ raceId: 'race-7', trackId: 'main', postTime: '2026-06-13T21:00:00.000Z', evaluatedAt: '2026-06-13T12:03:00.000Z', checks: raceDayReadinessChecklist('2026-06-13T12:03:00.000Z'), workforceReadiness: workforce }, 'race-day-commander');
  assert.equal(assessment.checks.find((check) => check.domain === 'staffing').score, workforce.score);
  assert.ok(assessment.warnings.some((warning) => warning.domain === 'staffing'));

  const emergency = new EmergencyOperationsPlatform();
  const workflow = emergency.createEmergencyWorkflow({
    id: 'wf-workforce',
    planId: 'plan-fire',
    activatedBy: 'incident-commander',
    activatedByRoles: ['admin'],
    incident: { id: 'inc-workforce', scenario: 'fire-incident', severity: 'critical', location: 'Barn 2', reportedAt: '2026-06-13T12:04:00.000Z', affectedAssets: [], systems: [] },
    commandRoles: [],
    resources: [],
    workforceResources: service.emergencyResources(),
    workforceReadiness: workforce,
    evacuationZones: [],
    communicationChecklist: [],
    tenantId: 'track-1',
  });
  assert.equal(workflow.resources.some((resource) => resource.id === 'workforce:assign-1'), true);
  assert.ok(workflow.checklist.some((step) => step.label.includes('workforce emergency gap')));
  assert.equal(workflow.workforceReadiness.status, 'watch');
  const dashboard = service.dashboard('2026-06-13T12:05:00.000Z');
  assert.ok(dashboard.digitalTwinSync.some((sync) => sync.twinId === 'twin:workforce:staff-emergency'));
  assert.ok(dashboard.auditRecords.some((entry) => entry.subjectId === 'shift-1'));
});

test('workforce compliance surfaces expiring training alerts and approval-gated emergency overrides', () => {
  const auditLog = new ImmutableAuditLog();
  const eventBus = new InMemoryEventBus();
  const approvals = new CentralizedApprovalService({ auditLog, eventBus });
  const service = new GovernedWorkforceOperationsService('track-1', { auditLog, eventBus, approvals });

  service.registerEmployee({ identity: identity('staff-incident', ['security'], { department: 'emergency' }), employeeNumber: 'EMP-3', department: 'emergency', managerIdentityId: 'manager-1', employmentStatus: 'active', emergencyQualified: true, hiredAt: '2024-01-01T00:00:00.000Z' }, 'seed', '2026-06-13T12:00:00.000Z');
  service.scheduleShift({ id: 'shift-incident', tenantId: 'track-1', label: 'Emergency staffing shift', startsAt: '2026-06-13T19:00:00.000Z', endsAt: '2026-06-13T22:00:00.000Z', zoneId: 'zone-grandstand', status: 'active', raceId: 'race-7', requirements: [{ role: 'incident-liaison', demand: 1, certificationKinds: ['ics-200', 'radio-command'], emergencyCritical: true }] }, 'planner', '2026-06-13T12:00:00.000Z');
  service.upsertCertification({ id: 'cert-ics-expiring', tenantId: 'track-1', identityId: 'staff-incident', kind: 'ics-200', status: 'active', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-06-20T00:00:00.000Z', evidence: ['cert:ics-200'], requiredForRoles: ['incident-liaison'] }, 'workforce-compliance', '2026-06-13T12:01:00.000Z');
  service.upsertTraining({ id: 'training-incident-overdue', tenantId: 'track-1', identityId: 'staff-incident', courseId: 'incident-command-refresh', title: 'Incident command refresh', status: 'scheduled', dueAt: '2026-06-12T00:00:00.000Z', requiredForRoles: ['incident-liaison'], evidence: ['training:incident-command-refresh'] }, 'workforce-training', '2026-06-13T12:01:30.000Z');
  service.assign({ id: 'assign-incident', tenantId: 'track-1', identityId: 'staff-incident', role: 'incident-liaison', shiftId: 'shift-incident', zoneId: 'zone-grandstand', status: 'assigned', certificationKinds: ['ics-200', 'radio-command'], emergencyCritical: true, raceId: 'race-7' }, 'planner', '2026-06-13T12:02:00.000Z');

  const dashboard = service.dashboard('2026-06-13T12:03:00.000Z');
  assert.equal(dashboard.compliance.status, 'non-compliant');
  assert.ok(dashboard.compliance.expiringCertifications.some((cert) => cert.kind === 'ics-200'));
  assert.ok(dashboard.compliance.overdueTraining.some((training) => training.courseId === 'incident-command-refresh'));
  assert.ok(dashboard.readiness.certificationGaps.some((gap) => gap.missing.includes('radio-command')));
  assert.ok(dashboard.readiness.trainingGaps.some((gap) => gap.overdueCourses.includes('incident-command-refresh')));
  assert.ok(dashboard.approvals.some((approval) => approval.action === 'emergency-personnel-override' && approval.target === 'assign-incident'));
  assert.equal(new Set(dashboard.approvals.map((approval) => approval.id)).size, dashboard.approvals.length);
  assert.ok(dashboard.events.some((event) => event.type === 'workforce.training.changed' && event.severity === 'warning'));
  assert.ok(dashboard.digitalTwinSync.some((sync) => sync.status === 'queued-for-human-approved-sync'));
});
