import type { CanonicalEventRef, GovernedIdentity, EnterpriseIdentityGovernancePlatform, GovernancePermission } from '@trackmind/shared';
import { ImmutableAuditLog, type AuditLogEntry } from './auditLog.js';
import type { CentralizedApprovalService, ControlledActionRequest } from './approvals.js';
import type { UniversalEventBus } from './eventBus.js';
import type { ApiServiceDefinition } from './enterpriseApiGateway.js';
import type { EmergencyResource } from './emergencyOperations.js';
import type { ReadinessCheck, ReadinessStatus } from './raceDayReadiness.js';

export type WorkforceComplianceStatus = 'compliant' | 'watch' | 'non-compliant';
export type WorkforceCertificationStatus = 'active' | 'expiring' | 'expired' | 'suspended';
export type WorkforceAssignmentStatus = 'assigned' | 'checked-in' | 'no-show' | 'released';
export type WorkforceShiftStatus = 'scheduled' | 'active' | 'completed' | 'missed';
export type WorkforceTrainingStatus = 'scheduled' | 'in-progress' | 'completed' | 'overdue';

export interface WorkforceEmployeeRecord {
  identity: GovernedIdentity;
  employeeNumber: string;
  department: 'race-operations' | 'veterinary' | 'security' | 'facilities' | 'emergency' | 'guest-services';
  managerIdentityId: string;
  employmentStatus: 'active' | 'leave' | 'suspended' | 'terminated';
  emergencyQualified: boolean;
  homeZoneId?: string;
  hiredAt: string;
}

export interface WorkforceCertificationRecord {
  id: string;
  tenantId: string;
  identityId: string;
  kind: string;
  status: WorkforceCertificationStatus;
  issuedAt: string;
  expiresAt: string;
  evidence: string[];
  requiredForRoles: string[];
  auditId?: string;
  eventId?: string;
}

export interface WorkforceTrainingRecord {
  id: string;
  tenantId: string;
  identityId: string;
  courseId: string;
  title: string;
  status: WorkforceTrainingStatus;
  dueAt: string;
  completedAt?: string;
  requiredForRoles: string[];
  evidence: string[];
  auditId?: string;
  eventId?: string;
}

export interface WorkforceShiftRequirement {
  role: string;
  demand: number;
  certificationKinds: string[];
  emergencyCritical?: boolean;
}

export interface WorkforceShift {
  id: string;
  tenantId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  zoneId: string;
  status: WorkforceShiftStatus;
  raceId?: string;
  requirements: WorkforceShiftRequirement[];
}

export interface WorkforceAssignment {
  id: string;
  tenantId: string;
  identityId: string;
  role: string;
  shiftId: string;
  zoneId: string;
  status: WorkforceAssignmentStatus;
  certificationKinds: string[];
  emergencyCritical: boolean;
  digitalTwinRef: string;
  raceId?: string;
  auditId?: string;
  eventId?: string;
}

export interface WorkforceReadinessSummary {
  generatedAt: string;
  tenantId: string;
  status: ReadinessStatus;
  score: number;
  coveragePct: number;
  complianceStatus: WorkforceComplianceStatus;
  demand: number;
  assigned: number;
  checkedIn: number;
  staffingGap: number;
  certificationGaps: Array<{ identityId: string; assignmentId?: string; missing: string[] }>;
  trainingGaps: Array<{ identityId: string; role: string; overdueCourses: string[] }>;
  emergencyGaps: string[];
  blockers: string[];
  raceDayCheck: ReadinessCheck;
}

export interface WorkforcePlanningSummary {
  generatedAt: string;
  tenantId: string;
  demand: number;
  available: number;
  assigned: number;
  checkedIn: number;
  gap: number;
  byRole: Array<{ role: string; demand: number; assigned: number; checkedIn: number; gap: number }>;
  recommendations: string[];
}

export interface WorkforceComplianceSummary {
  generatedAt: string;
  tenantId: string;
  status: WorkforceComplianceStatus;
  certificationCoveragePct: number;
  trainingCoveragePct: number;
  expiringCertifications: WorkforceCertificationRecord[];
  expiredCertifications: WorkforceCertificationRecord[];
  overdueTraining: WorkforceTrainingRecord[];
  auditEvidence: string[];
}

export interface WorkforceDigitalTwinSync {
  twinId: string;
  identityId: string;
  assignmentId: string;
  status: 'queued-for-human-approved-sync' | 'synced';
  patch: Record<string, unknown>;
  eventId?: string;
  auditId?: string;
}

export interface WorkforceDomainEvent extends Pick<CanonicalEventRef, 'eventId' | 'eventType' | 'tenantId' | 'racetrackId' | 'actorId' | 'source' | 'timestamp' | 'version'> {
  id: string;
  type: string;
  subjectId: string;
  severity: 'info' | 'warning' | 'critical';
  auditId?: string;
  payload: Record<string, unknown>;
}

export interface WorkforceOperationsDashboard {
  generatedAt: string;
  tenantId: string;
  employees: WorkforceEmployeeRecord[];
  certifications: WorkforceCertificationRecord[];
  assignments: WorkforceAssignment[];
  shifts: WorkforceShift[];
  trainingRecords: WorkforceTrainingRecord[];
  readiness: WorkforceReadinessSummary;
  planning: WorkforcePlanningSummary;
  compliance: WorkforceComplianceSummary;
  emergencyResources: EmergencyResource[];
  approvals: ControlledActionRequest[];
  auditRecords: AuditLogEntry[];
  events: WorkforceDomainEvent[];
  digitalTwinSync: WorkforceDigitalTwinSync[];
  identityGovernance: { tenantId: string; reviewedIdentities: number; privilegedPolicies: string[]; evidence: string[] };
  mock?: boolean;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const daysUntil = (futureIso: string, nowIso: string) => Math.ceil((Date.parse(futureIso) - Date.parse(nowIso)) / 86_400_000);
const statusFromScore = (score: number, blocked: boolean, watch: boolean): ReadinessStatus => blocked || score < 70 ? 'blocked' : watch || score < 90 ? 'watch' : 'ready';

export class WorkforceOperationsService {
  private readonly employees = new Map<string, WorkforceEmployeeRecord>();
  private readonly certifications = new Map<string, WorkforceCertificationRecord>();
  private readonly assignments = new Map<string, WorkforceAssignment>();
  private readonly shifts = new Map<string, WorkforceShift>();
  private readonly training = new Map<string, WorkforceTrainingRecord>();
  private readonly events: WorkforceDomainEvent[] = [];
  private readonly approvals: ControlledActionRequest[] = [];
  private readonly twinSync: WorkforceDigitalTwinSync[] = [];

  constructor(
    private readonly tenantId: string,
    private readonly deps: {
      identityGovernance?: EnterpriseIdentityGovernancePlatform;
      eventBus?: UniversalEventBus;
      auditLog?: ImmutableAuditLog;
      approvals?: CentralizedApprovalService;
    } = {},
  ) {}

  registerEmployee(record: WorkforceEmployeeRecord, actor = 'workforce-operations', now = new Date().toISOString()): WorkforceEmployeeRecord {
    this.assertTenant(record.identity.tenantId);
    const identity = this.deps.identityGovernance?.registerIdentity(record.identity) ?? record.identity;
    const next = { ...record, identity };
    this.employees.set(identity.id, clone(next));
    const audit = this.audit('data-change', actor, identity.id, now, 'workforce.employee.registered', next, 'info');
    this.emit('workforce.employee.registered', identity.id, now, 'info', { identityId: identity.id, employeeNumber: record.employeeNumber, auditId: audit.id }, audit.id);
    return clone(next);
  }

  upsertCertification(record: WorkforceCertificationRecord, actorIdentityId = 'workforce-compliance', now = new Date().toISOString()): WorkforceCertificationRecord {
    this.assertTenant(record.tenantId);
    this.requireEmployee(record.identityId);
    this.assertGoverned(actorIdentityId, 'compliance:report', `workforce-certification:${record.identityId}`, record.evidence, now);
    const normalized = { ...record, status: this.normalizeCertificationStatus(record, now) };
    const severity = normalized.status === 'expired' || normalized.status === 'suspended' ? 'critical' : normalized.status === 'expiring' ? 'warning' : 'info';
    const audit = this.audit('regulatory-activity', actorIdentityId, normalized.identityId, now, 'workforce.certification.changed', normalized, severity);
    const event = this.emit('workforce.certification.changed', normalized.identityId, now, severity, { certificationId: normalized.id, kind: normalized.kind, status: normalized.status, auditId: audit.id }, audit.id);
    normalized.auditId = audit.id;
    normalized.eventId = event.id;
    this.certifications.set(normalized.id, clone(normalized));
    return clone(normalized);
  }

  upsertTraining(record: WorkforceTrainingRecord, actorIdentityId = 'workforce-training', now = new Date().toISOString()): WorkforceTrainingRecord {
    this.assertTenant(record.tenantId);
    this.requireEmployee(record.identityId);
    const normalized = { ...record, status: record.status !== 'completed' && record.dueAt < now ? 'overdue' as const : record.status };
    const severity = normalized.status === 'overdue' ? 'warning' : 'info';
    const audit = this.audit('regulatory-activity', actorIdentityId, normalized.identityId, now, 'workforce.training.changed', normalized, severity);
    const event = this.emit('workforce.training.changed', normalized.identityId, now, severity, { trainingId: normalized.id, courseId: normalized.courseId, status: normalized.status, auditId: audit.id }, audit.id);
    normalized.auditId = audit.id;
    normalized.eventId = event.id;
    this.training.set(normalized.id, clone(normalized));
    return clone(normalized);
  }

  scheduleShift(shift: WorkforceShift, actor = 'workforce-planner', now = new Date().toISOString()): WorkforceShift {
    this.assertTenant(shift.tenantId);
    this.shifts.set(shift.id, clone(shift));
    const audit = this.audit('workflow-action', actor, shift.id, now, 'workforce.shift.scheduled', shift, 'info');
    this.emit('workforce.shift.scheduled', shift.id, now, 'info', { shiftId: shift.id, demand: this.shiftDemand(shift), auditId: audit.id }, audit.id);
    return clone(shift);
  }

  assign(input: Omit<WorkforceAssignment, 'digitalTwinRef'|'auditId'|'eventId'>, actorIdentityId = 'workforce-coordinator', now = new Date().toISOString()): WorkforceAssignment {
    this.assertTenant(input.tenantId);
    this.requireEmployee(input.identityId);
    const shift = this.requireShift(input.shiftId);
    const missing = this.missingCertifications(input.identityId, input.certificationKinds, now);
    const severity = missing.length ? 'critical' : 'info';
    const assignment: WorkforceAssignment = { ...input, zoneId: input.zoneId || shift.zoneId, digitalTwinRef: `twin:workforce:${input.identityId}` };
    const audit = this.audit('workflow-action', actorIdentityId, assignment.identityId, now, 'workforce.assignment.changed', { assignment, missingCertifications: missing }, severity);
    const event = this.emit('workforce.assignment.changed', assignment.identityId, now, severity, { assignmentId: assignment.id, shiftId: assignment.shiftId, status: assignment.status, missingCertifications: missing, auditId: audit.id, digitalTwinRef: assignment.digitalTwinRef }, audit.id);
    assignment.auditId = audit.id;
    assignment.eventId = event.id;
    this.assignments.set(assignment.id, clone(assignment));
    this.queueTwinSync(assignment, now, event.id, audit.id);
    if (assignment.emergencyCritical && missing.length) this.requestEmergencyPersonnelOverride(assignment.id, actorIdentityId, missing, now);
    return clone(assignment);
  }

  checkIn(assignmentId: string, actorIdentityId: string, now = new Date().toISOString()): WorkforceAssignment {
    const current = this.requireAssignment(assignmentId);
    const assignment = { ...current, status: 'checked-in' as const };
    const audit = this.audit('workflow-action', actorIdentityId, assignment.identityId, now, 'workforce.assignment.checked-in', assignment, 'info');
    const event = this.emit('workforce.assignment.checked-in', assignment.identityId, now, 'info', { assignmentId, shiftId: assignment.shiftId, auditId: audit.id, digitalTwinRef: assignment.digitalTwinRef }, audit.id);
    assignment.auditId = audit.id;
    assignment.eventId = event.id;
    this.assignments.set(assignment.id, clone(assignment));
    this.queueTwinSync(assignment, now, event.id, audit.id, 'synced');
    return clone(assignment);
  }

  requestEmergencyPersonnelOverride(assignmentId: string, requestedBy: string, missingEvidence: string[], now = new Date().toISOString()): ControlledActionRequest | undefined {
    const assignment = this.requireAssignment(assignmentId);
    const request = this.deps.approvals?.createRequest({
      tenantId: assignment.tenantId,
      racetrackId: assignment.raceId ?? assignment.zoneId,
      action: 'emergency-personnel-override',
      target: assignment.id,
      requestedBy,
      actorType: requestedBy.startsWith('ai-') ? 'ai-agent' : 'human',
      reason: `Emergency-critical assignment ${assignment.role} has workforce compliance gaps.`,
      evidence: ['human-approval-record', ...missingEvidence],
      now,
    });
    if (request) this.approvals.push(clone(request));
    return request ? clone(request) : undefined;
  }

  readiness(now = new Date().toISOString(), _raceId = 'race-day'): WorkforceReadinessSummary {
    const shifts = [...this.shifts.values()];
    const assignments = [...this.assignments.values()];
    const demand = shifts.reduce((sum, shift) => sum + this.shiftDemand(shift), 0);
    const assigned = assignments.filter((a) => a.status !== 'released').length;
    const checkedIn = assignments.filter((a) => a.status === 'checked-in').length;
    const certificationGaps = assignments.map((assignment) => ({ identityId: assignment.identityId, assignmentId: assignment.id, missing: this.missingCertifications(assignment.identityId, assignment.certificationKinds, now) })).filter((gap) => gap.missing.length > 0);
    const trainingGaps = assignments.map((assignment) => ({ identityId: assignment.identityId, role: assignment.role, overdueCourses: this.overdueTraining(assignment.identityId, assignment.role, now).map((record) => record.courseId) })).filter((gap) => gap.overdueCourses.length > 0);
    const emergencyGaps = assignments.filter((assignment) => assignment.emergencyCritical && assignment.status !== 'checked-in').map((assignment) => `${assignment.role}:${assignment.identityId}:not-checked-in`);
    const coveragePct = Math.round((assigned / Math.max(1, demand)) * 100);
    const staffingGap = Math.max(0, demand - assigned);
    const complianceStatus: WorkforceComplianceStatus = certificationGaps.length || trainingGaps.length ? 'non-compliant' : [...this.certifications.values()].some((cert) => this.normalizeCertificationStatus(cert, now) === 'expiring') ? 'watch' : 'compliant';
    const blockers = [
      ...(staffingGap ? [`staffing gap ${staffingGap}`] : []),
      ...certificationGaps.map((gap) => `missing certification ${gap.identityId}:${gap.missing.join(',')}`),
      ...trainingGaps.map((gap) => `overdue training ${gap.identityId}:${gap.overdueCourses.join(',')}`),
      ...emergencyGaps.map((gap) => `emergency role not checked in ${gap}`),
    ];
    const score = Math.max(0, Math.min(100, Math.round(coveragePct - certificationGaps.length * 15 - trainingGaps.length * 10 - emergencyGaps.length * 12)));
    const status = statusFromScore(score, staffingGap > 0 || certificationGaps.length > 0, trainingGaps.length > 0 || emergencyGaps.length > 0 || complianceStatus === 'watch');
    const evidence = [`workforce:demand=${demand}`, `workforce:assigned=${assigned}`, `workforce:checked-in=${checkedIn}`, `workforce:compliance=${complianceStatus}`];
    return {
      generatedAt: now,
      tenantId: this.tenantId,
      status,
      score,
      coveragePct,
      complianceStatus,
      demand,
      assigned,
      checkedIn,
      staffingGap,
      certificationGaps,
      trainingGaps,
      emergencyGaps,
      blockers,
      raceDayCheck: { domain: 'staffing', label: 'Workforce readiness', score, status, evidence, blockers, updatedAt: now, approvalRequired: status !== 'ready', ownerRole: 'workforce-manager' },
    };
  }

  planning(now = new Date().toISOString()): WorkforcePlanningSummary {
    const shifts = [...this.shifts.values()];
    const assignments = [...this.assignments.values()];
    const requirements = shifts.flatMap((shift) => shift.requirements);
    const roles = [...new Set(requirements.map((requirement) => requirement.role))];
    const byRole = roles.map((role) => {
      const demand = requirements.filter((requirement) => requirement.role === role).reduce((sum, requirement) => sum + requirement.demand, 0);
      const roleAssignments = assignments.filter((assignment) => assignment.role === role && assignment.status !== 'released');
      const checkedIn = roleAssignments.filter((assignment) => assignment.status === 'checked-in').length;
      return { role, demand, assigned: roleAssignments.length, checkedIn, gap: Math.max(0, demand - roleAssignments.length) };
    });
    const demand = byRole.reduce((sum, item) => sum + item.demand, 0);
    const assigned = byRole.reduce((sum, item) => sum + item.assigned, 0);
    const checkedIn = byRole.reduce((sum, item) => sum + item.checkedIn, 0);
    return {
      generatedAt: now,
      tenantId: this.tenantId,
      demand,
      available: [...this.employees.values()].filter((employee) => employee.employmentStatus === 'active').length,
      assigned,
      checkedIn,
      gap: Math.max(0, demand - assigned),
      byRole,
      recommendations: byRole.filter((item) => item.gap > 0).map((item) => `Backfill ${item.gap} ${item.role} assignment${item.gap === 1 ? '' : 's'} before race-day lock.`),
    };
  }

  compliance(now = new Date().toISOString()): WorkforceComplianceSummary {
    const certifications = [...this.certifications.values()].map((cert) => ({ ...cert, status: this.normalizeCertificationStatus(cert, now) }));
    const training = [...this.training.values()].map((record) => ({ ...record, status: record.status !== 'completed' && record.dueAt < now ? 'overdue' as const : record.status }));
    const expiredCertifications = certifications.filter((cert) => cert.status === 'expired' || cert.status === 'suspended');
    const expiringCertifications = certifications.filter((cert) => cert.status === 'expiring');
    const overdueTraining = training.filter((record) => record.status === 'overdue');
    const certificationCoveragePct = Math.round((certifications.filter((cert) => cert.status === 'active' || cert.status === 'expiring').length / Math.max(1, certifications.length)) * 100);
    const trainingCoveragePct = Math.round((training.filter((record) => record.status === 'completed').length / Math.max(1, training.length)) * 100);
    const status: WorkforceComplianceStatus = expiredCertifications.length || overdueTraining.length ? 'non-compliant' : expiringCertifications.length ? 'watch' : 'compliant';
    return { generatedAt: now, tenantId: this.tenantId, status, certificationCoveragePct, trainingCoveragePct, expiringCertifications, expiredCertifications, overdueTraining, auditEvidence: [...new Set([...certifications.flatMap((cert) => cert.evidence), ...training.flatMap((record) => record.evidence)])] };
  }

  emergencyResources(): EmergencyResource[] {
    return [...this.assignments.values()].filter((assignment) => assignment.emergencyCritical).map((assignment, index) => ({
      id: `workforce:${assignment.id}`,
      kind: 'personnel',
      label: `${assignment.role} ${assignment.identityId}`,
      status: assignment.status === 'checked-in' ? 'available' : assignment.status === 'assigned' ? 'assigned' : 'offline',
      zoneId: assignment.zoneId,
      coordinates: { latitude: 38.05 + index / 1000, longitude: -76.95 - index / 1000 },
      capacity: 1,
    }));
  }

  dashboard(now = new Date().toISOString()): WorkforceOperationsDashboard {
    const readiness = this.readiness(now);
    const identityGovernance = this.deps.identityGovernance?.runAccessReview(this.tenantId) ?? { tenantId: this.tenantId, reviewedIdentities: this.employees.size, orphanedServiceIdentities: [], privilegedPolicies: [], evidence: ['governed-identity-records'] };
    const approvalRequests = uniqueById([...this.approvals, ...(this.deps.approvals?.allRequests().filter((request) => request.action === 'emergency-personnel-override') ?? [])]);
    return {
      generatedAt: now,
      tenantId: this.tenantId,
      employees: [...this.employees.values()].map(clone),
      certifications: [...this.certifications.values()].map(clone),
      assignments: [...this.assignments.values()].map(clone),
      shifts: [...this.shifts.values()].map(clone),
      trainingRecords: [...this.training.values()].map(clone),
      readiness,
      planning: this.planning(now),
      compliance: this.compliance(now),
      emergencyResources: this.emergencyResources(),
      approvals: approvalRequests.map(clone),
      auditRecords: this.deps.auditLog?.all().filter((entry) => this.isWorkforceAudit(entry)) ?? [],
      events: this.events.map(clone),
      digitalTwinSync: this.twinSync.map(clone),
      identityGovernance: { tenantId: identityGovernance.tenantId, reviewedIdentities: identityGovernance.reviewedIdentities, privilegedPolicies: identityGovernance.privilegedPolicies, evidence: identityGovernance.evidence },
    };
  }

  apiDefinition(): ApiServiceDefinition {
    return {
      id: 'workforce-operations',
      name: 'Workforce Operations',
      domain: 'operations',
      version: 'v1',
      basePath: '/api/v1/workforce-operations',
      description: 'Governed workforce records, certifications, assignments, shifts, training, readiness, compliance, planning, emergency staffing, and scheduling dashboards.',
      owner: { team: 'workforce-operations', productOwner: 'Workforce Manager', technicalOwner: 'Operations Platform Owner', supportChannel: '#workforce-operations' },
      lifecycle: 'active',
      auth: ['jwt', 'oauth2', 'mtls'],
      rateLimit: { requests: 600, perSeconds: 60, burst: 100 },
      tags: ['workforce', 'staffing', 'readiness', 'compliance', 'audit', 'digital-twin'],
      slo: { availability: 99.9, latencyMs: 220 },
      endpoints: [
        { method: 'GET', path: '/workspace', summary: 'Workforce operations dashboard', scopes: ['workforce:read'] },
        { method: 'POST', path: '/employees', summary: 'Register governed employee identity', scopes: ['identity:write'] },
        { method: 'POST', path: '/certifications', summary: 'Record certification change', scopes: ['compliance:report'] },
        { method: 'POST', path: '/assignments', summary: 'Assign workforce to shift', scopes: ['workflow:execute'] },
        { method: 'GET', path: '/readiness', summary: 'Get staffing readiness', scopes: ['race:read'] },
      ],
    };
  }

  private assertTenant(tenantId: string): void {
    if (tenantId !== this.tenantId) throw new Error(`workforce tenant isolation violation for ${tenantId}`);
  }

  private assertGoverned(identityId: string, permission: GovernancePermission, target: string, evidence: string[], now: string): void {
    if (!this.deps.identityGovernance || identityId.startsWith('workforce-')) return;
    const decision = this.deps.identityGovernance.decide(identityId, permission, { tenantId: this.tenantId, target, evidence, now, correlationId: `workforce-${target}` });
    if (!decision.allowed) throw new Error(`workforce governance denied ${permission}: ${decision.reason}`);
  }

  private requireEmployee(identityId: string): WorkforceEmployeeRecord {
    const employee = this.employees.get(identityId);
    if (!employee) throw new Error(`Unknown workforce identity ${identityId}`);
    return employee;
  }

  private requireShift(shiftId: string): WorkforceShift {
    const shift = this.shifts.get(shiftId);
    if (!shift) throw new Error(`Unknown workforce shift ${shiftId}`);
    return shift;
  }

  private requireAssignment(assignmentId: string): WorkforceAssignment {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) throw new Error(`Unknown workforce assignment ${assignmentId}`);
    return assignment;
  }

  private shiftDemand(shift: WorkforceShift): number {
    return shift.requirements.reduce((sum, requirement) => sum + requirement.demand, 0);
  }

  private normalizeCertificationStatus(cert: WorkforceCertificationRecord, now: string): WorkforceCertificationStatus {
    if (cert.status === 'suspended') return 'suspended';
    if (cert.expiresAt <= now) return 'expired';
    return daysUntil(cert.expiresAt, now) <= 30 ? 'expiring' : 'active';
  }

  private missingCertifications(identityId: string, required: string[], now: string): string[] {
    const active = new Set([...this.certifications.values()].filter((cert) => cert.identityId === identityId && ['active', 'expiring'].includes(this.normalizeCertificationStatus(cert, now))).map((cert) => cert.kind));
    return required.filter((kind) => !active.has(kind));
  }

  private overdueTraining(identityId: string, role: string, now: string): WorkforceTrainingRecord[] {
    return [...this.training.values()].filter((record) => record.identityId === identityId && record.requiredForRoles.includes(role) && record.status !== 'completed' && record.dueAt < now);
  }

  private isWorkforceAudit(entry: AuditLogEntry): boolean {
    const payload = JSON.stringify(entry.payload).toLowerCase();
    return payload.includes('workforce') || entry.actor.actorId.startsWith('workforce-') || String(entry.subjectId ?? '').startsWith('staff-') || String(entry.subjectId ?? '').startsWith('shift-') || String(entry.subjectId ?? '').startsWith('assign-');
  }

  private audit(type: Parameters<ImmutableAuditLog['append']>[0]['type'], actor: string, subjectId: string, timestamp: string, action: string, payload: unknown, severity: 'info' | 'warning' | 'critical'): AuditLogEntry {
    const ledger = this.deps.auditLog ?? new ImmutableAuditLog();
    return ledger.append({ id: id('audit-workforce'), type, actor, timestamp, subjectId, tenantId: this.tenantId, racetrackId: 'main-track', severity, regulations: ['HISA', 'ARCI', 'ISO-22301'], evidenceIds: [action], action, reason: action, payload: { action, payload } });
  }

  private emit(type: string, subjectId: string, timestamp: string, severity: WorkforceDomainEvent['severity'], payload: Record<string, unknown>, auditId?: string): WorkforceDomainEvent {
    const eventId = id('evt-workforce');
    const eventType = `${type}.v1` as CanonicalEventRef['eventType'];
    const event: WorkforceDomainEvent = { eventId, eventType, tenantId: this.tenantId, racetrackId: 'main-track', actorId: 'workforce-operations', source: 'workforce-operations', timestamp, version: 1, id: eventId, type, subjectId, severity, auditId, payload };
    this.events.push(clone(event));
    void this.deps.eventBus?.publish({ id: event.eventId, type: event.eventType, payload: event, tenantId: event.tenantId, racetrackId: event.racetrackId, actor: { id: event.actorId, type: 'service' }, subject: { id: subjectId, type: 'workforce', tenantId: event.tenantId }, evidence: auditId ? [auditId] : [], auditRef: auditId, occurredAt: event.timestamp, aggregateId: subjectId, producer: event.source, metadata: { compliance: 'regulated', team: 'workforce-operations', accountableRole: 'workforce-manager' } });
    return event;
  }

  private queueTwinSync(assignment: WorkforceAssignment, at: string, eventId?: string, auditId?: string, status: WorkforceDigitalTwinSync['status'] = 'queued-for-human-approved-sync'): void {
    const sync: WorkforceDigitalTwinSync = { twinId: assignment.digitalTwinRef, identityId: assignment.identityId, assignmentId: assignment.id, status, patch: { role: assignment.role, shiftId: assignment.shiftId, zoneId: assignment.zoneId, status: assignment.status, emergencyCritical: assignment.emergencyCritical, updatedAt: at }, eventId, auditId };
    this.twinSync.push(sync);
    void this.deps.eventBus?.publish({ type: 'digital-twin.state.patch', payload: { twinId: sync.twinId, patch: sync.patch, actor: 'workforce-operations', observedAt: at }, aggregateId: sync.twinId, producer: 'workforce-operations', metadata: { compliance: 'regulated', team: 'workforce-operations', accountableRole: 'workforce-manager' } });
  }
}

export function seedWorkforceOperations(deps: ConstructorParameters<typeof WorkforceOperationsService>[1] = {}, tenantId = 'track-1', now = '2026-06-13T20:30:00.000Z'): WorkforceOperationsService {
  const service = new WorkforceOperationsService(tenantId, deps);
  const identities: GovernedIdentity[] = [
    { id: 'staff-gate-lead', tenantId, kind: 'user', displayName: 'Gate Crew Lead', roles: ['organization-admin'], attributes: { department: 'race-operations', credentialed: true } },
    { id: 'staff-vet-tech', tenantId, kind: 'user', displayName: 'Veterinary Technician', roles: ['veterinarian'], attributes: { department: 'veterinary', credentialed: true } },
    { id: 'staff-emergency-liaison', tenantId, kind: 'user', displayName: 'Emergency Liaison', roles: ['security-manager'], attributes: { department: 'emergency', credentialed: true } },
    { id: 'staff-facilities-watch', tenantId, kind: 'user', displayName: 'Facilities Watch', roles: ['facilities-manager'], attributes: { department: 'facilities', credentialed: true } },
  ];
  identities.forEach((identity, index) => service.registerEmployee({ identity, employeeNumber: `EMP-${index + 101}`, department: index === 1 ? 'veterinary' : index === 2 ? 'emergency' : index === 3 ? 'facilities' : 'race-operations', managerIdentityId: 'staff-gate-lead', employmentStatus: 'active', emergencyQualified: index === 2, homeZoneId: index === 2 ? 'zone-grandstand' : 'backstretch', hiredAt: '2024-01-01T00:00:00.000Z' }, 'seed', now));
  service.scheduleShift({ id: 'shift-race-7', tenantId, label: 'Race 7 operations shift', startsAt: '2026-06-13T19:30:00.000Z', endsAt: '2026-06-13T22:30:00.000Z', zoneId: 'backstretch', status: 'active', raceId: 'race-7', requirements: [
    { role: 'gate-crew', demand: 1, certificationKinds: ['gate-safety'], emergencyCritical: false },
    { role: 'veterinary-response', demand: 1, certificationKinds: ['vet-tech-license'], emergencyCritical: true },
    { role: 'incident-liaison', demand: 1, certificationKinds: ['ics-200'], emergencyCritical: true },
    { role: 'facilities-watch', demand: 1, certificationKinds: ['facility-safety'], emergencyCritical: false },
  ] }, 'seed', now);
  service.upsertCertification({ id: 'cert-gate', tenantId, identityId: 'staff-gate-lead', kind: 'gate-safety', status: 'active', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z', evidence: ['cert:gate-safety'], requiredForRoles: ['gate-crew'] }, 'workforce-compliance', now);
  service.upsertCertification({ id: 'cert-vet', tenantId, identityId: 'staff-vet-tech', kind: 'vet-tech-license', status: 'active', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z', evidence: ['cert:vet-tech-license'], requiredForRoles: ['veterinary-response'] }, 'workforce-compliance', now);
  service.upsertCertification({ id: 'cert-ics', tenantId, identityId: 'staff-emergency-liaison', kind: 'ics-200', status: 'active', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-06-20T00:00:00.000Z', evidence: ['cert:ics-200'], requiredForRoles: ['incident-liaison'] }, 'workforce-compliance', now);
  service.upsertCertification({ id: 'cert-facilities', tenantId, identityId: 'staff-facilities-watch', kind: 'facility-safety', status: 'active', issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z', evidence: ['cert:facility-safety'], requiredForRoles: ['facilities-watch'] }, 'workforce-compliance', now);
  service.upsertTraining({ id: 'training-gate', tenantId, identityId: 'staff-gate-lead', courseId: 'race-day-safety', title: 'Race-day safety briefing', status: 'completed', completedAt: now, dueAt: now, requiredForRoles: ['gate-crew'], evidence: ['training:race-day-safety'] }, 'workforce-training', now);
  service.upsertTraining({ id: 'training-vet', tenantId, identityId: 'staff-vet-tech', courseId: 'equine-emergency-response', title: 'Equine emergency response', status: 'completed', completedAt: now, dueAt: now, requiredForRoles: ['veterinary-response'], evidence: ['training:equine-emergency-response'] }, 'workforce-training', now);
  service.upsertTraining({ id: 'training-ics', tenantId, identityId: 'staff-emergency-liaison', courseId: 'incident-command-refresh', title: 'Incident command refresh', status: 'completed', completedAt: now, dueAt: now, requiredForRoles: ['incident-liaison'], evidence: ['training:incident-command-refresh'] }, 'workforce-training', now);
  service.assign({ id: 'assign-gate', tenantId, identityId: 'staff-gate-lead', role: 'gate-crew', shiftId: 'shift-race-7', zoneId: 'backstretch', status: 'checked-in', certificationKinds: ['gate-safety'], emergencyCritical: false, raceId: 'race-7' }, 'workforce-coordinator', now);
  service.assign({ id: 'assign-vet', tenantId, identityId: 'staff-vet-tech', role: 'veterinary-response', shiftId: 'shift-race-7', zoneId: 'zone-track', status: 'checked-in', certificationKinds: ['vet-tech-license'], emergencyCritical: true, raceId: 'race-7' }, 'workforce-coordinator', now);
  service.assign({ id: 'assign-ics', tenantId, identityId: 'staff-emergency-liaison', role: 'incident-liaison', shiftId: 'shift-race-7', zoneId: 'zone-grandstand', status: 'assigned', certificationKinds: ['ics-200'], emergencyCritical: true, raceId: 'race-7' }, 'workforce-coordinator', now);
  service.assign({ id: 'assign-facilities', tenantId, identityId: 'staff-facilities-watch', role: 'facilities-watch', shiftId: 'shift-race-7', zoneId: 'grandstand', status: 'checked-in', certificationKinds: ['facility-safety'], emergencyCritical: false, raceId: 'race-7' }, 'workforce-coordinator', now);
  return service;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
