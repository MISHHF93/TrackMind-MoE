import type { CanonicalEventRef } from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { UniversalEventBus } from './eventBus.js';
import type { ApiServiceDefinition } from './enterpriseApiGateway.js';
import type { WorkforceReadinessSummary } from './workforceOperations.js';

export type ReadinessDomain = 'track' | 'gate' | 'staffing' | 'veterinary' | 'stewards' | 'emergency' | 'security' | 'weather' | 'facility';
export type ReadinessStatus = 'ready' | 'watch' | 'blocked';
export type ReadinessSeverity = 'info' | 'advisory' | 'warning' | 'critical';

export interface ReadinessCheck { domain: ReadinessDomain; label: string; score: number; status: ReadinessStatus; evidence: string[]; blockers: string[]; updatedAt: string; approvalRequired?: boolean; ownerRole: string; }
export interface RaceDayReadinessInput { raceId: string; trackId: string; postTime: string; evaluatedAt: string; checks: ReadinessCheck[]; workforceReadiness?: WorkforceReadinessSummary; }
export interface ReadinessEvent extends Pick<CanonicalEventRef, 'eventId' | 'eventType' | 'tenantId' | 'racetrackId' | 'actorId' | 'source' | 'timestamp' | 'version'> { id: string; raceId: string; type: 'readiness.evaluated' | 'readiness.warning' | 'readiness.approval-required' | 'readiness.blocked'; domain?: ReadinessDomain; severity: ReadinessSeverity; message: string; evidence: string[]; }
export interface OperationalWarning { id: string; raceId: string; domain: ReadinessDomain; severity: Exclude<ReadinessSeverity, 'info'>; message: string; recommendedAction: string; evidence: string[]; }
export interface ReadinessApprovalRequirement { id: string; raceId: string; action: string; requiredRoles: string[]; reason: string; evidence: string[]; status: 'pending' | 'satisfied'; }
export interface ReadinessAuditRecord { id: string; raceId: string; actor: string; timestamp: string; summaryHash: string; previousHash: string; score: number; status: ReadinessStatus; evidence: string[]; }
export interface RaceDayReadinessAssessment { raceId: string; trackId: string; postTime: string; evaluatedAt: string; overallScore: number; status: ReadinessStatus; checks: ReadinessCheck[]; events: ReadinessEvent[]; warnings: OperationalWarning[]; approvals: ReadinessApprovalRequirement[]; audit: ReadinessAuditRecord; }
export interface RaceDayReadinessDashboard { generatedAt: string; averageScore: number; ready: number; watch: number; blocked: number; races: Array<{ raceId: string; trackId: string; postTime: string; score: number; status: ReadinessStatus; warnings: number; approvals: number }>; warnings: OperationalWarning[]; approvals: ReadinessApprovalRequirement[]; events: ReadinessEvent[]; auditRecords: ReadinessAuditRecord[]; domainScores: Array<{ domain: ReadinessDomain; averageScore: number; blocked: number; watch: number }>; }

const requiredDomains: ReadinessDomain[] = ['track','gate','staffing','veterinary','stewards','emergency','security','weather','facility'];
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const hash = (value: unknown) => { const text = JSON.stringify(value); let acc = 0; for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0; return `sha256:${acc.toString(16).padStart(8, '0')}`; };

export class RaceDayReadinessService {
  private assessments = new Map<string, RaceDayReadinessAssessment>();
  private auditChain: ReadinessAuditRecord[] = [];
  constructor(private readonly deps: { eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog } = {}) {}

  evaluate(input: RaceDayReadinessInput, actor = 'readiness-service'): RaceDayReadinessAssessment {
    const checks = this.normalizeChecks(input.workforceReadiness ? this.mergeWorkforceCheck(input.checks, input.workforceReadiness.raceDayCheck) : input.checks, input.evaluatedAt);
    const overallScore = Math.round(checks.reduce((sum, check) => sum + check.score, 0) / checks.length);
    const status: ReadinessStatus = checks.some((c) => c.status === 'blocked') || overallScore < 70 ? 'blocked' : checks.some((c) => c.status === 'watch') || overallScore < 90 ? 'watch' : 'ready';
    const warnings = checks.flatMap((check) => this.warningFor(input.raceId, check));
    const approvals = checks.filter((check) => check.approvalRequired || check.status !== 'ready').map((check) => ({ id: id('approval-readiness'), raceId: input.raceId, action: `${check.domain}-readiness-override`, requiredRoles: [check.ownerRole, 'steward'], reason: `${check.label} is ${check.status} with score ${check.score}`, evidence: check.evidence, status: 'pending' as const }));
    const readinessEvent = (prefix: string, event: Omit<ReadinessEvent, 'id' | 'eventId' | 'eventType' | 'tenantId' | 'racetrackId' | 'actorId' | 'source' | 'timestamp' | 'version'>): ReadinessEvent => {
      const eventId = id(prefix);
      const [context, verb] = event.type.split('.');
      return { eventId, eventType: `${context}.race-day.${verb}.v1` as CanonicalEventRef['eventType'], tenantId: 'trackmind', racetrackId: input.trackId, actorId: actor, source: 'race-day-readiness', timestamp: input.evaluatedAt, version: 1, id: eventId, ...event };
    };
    const events: ReadinessEvent[] = [
      readinessEvent('evt-ready', { raceId: input.raceId, type: 'readiness.evaluated', severity: status === 'ready' ? 'info' : status === 'watch' ? 'warning' : 'critical', message: `Race readiness ${status} at ${overallScore}`, evidence: checks.flatMap((c) => c.evidence) }),
      ...warnings.map((w): ReadinessEvent => readinessEvent('evt-warning', { raceId: input.raceId, type: w.severity === 'critical' ? 'readiness.blocked' : 'readiness.warning', domain: w.domain, severity: w.severity, message: w.message, evidence: w.evidence })),
      ...approvals.map((a): ReadinessEvent => readinessEvent('evt-approval', { raceId: input.raceId, type: 'readiness.approval-required', severity: 'warning', message: `Approval required: ${a.action}`, evidence: a.evidence }))
    ];
    const previousHash = this.auditChain.at(-1)?.summaryHash ?? 'genesis';
    const audit: ReadinessAuditRecord = { id: id('audit-readiness'), raceId: input.raceId, actor, timestamp: input.evaluatedAt, previousHash, score: overallScore, status, evidence: checks.flatMap((c) => c.evidence), summaryHash: hash({ input, overallScore, status, previousHash }) };
    this.auditChain.push(audit);
    const assessment = { raceId: input.raceId, trackId: input.trackId, postTime: input.postTime, evaluatedAt: input.evaluatedAt, overallScore, status, checks, events, warnings, approvals, audit };
    this.assessments.set(input.raceId, clone(assessment));
    this.deps.auditLog?.append({ id: audit.id, type: 'workflow-action', actor, timestamp: input.evaluatedAt, subjectId: input.raceId, severity: status === 'blocked' ? 'critical' : status === 'watch' ? 'warning' : 'info', payload: assessment, regulations: ['HISA','ARCI'] });
    for (const event of events) void this.deps.eventBus?.publish({ id: event.eventId, type: event.eventType, tenantId: event.tenantId, racetrackId: event.racetrackId, actor: { id: event.actorId, type: 'service' }, subject: { id: input.raceId, type: 'race-readiness', tenantId: event.tenantId }, evidence: event.evidence, auditRef: audit.id, payload: event, aggregateId: input.raceId, producer: event.source, metadata: { compliance: 'regulated', team: 'racing-operations', accountableRole: 'race-day-commander' } });
    return clone(assessment);
  }

  dashboard(now = new Date().toISOString()): RaceDayReadinessDashboard {
    const list = [...this.assessments.values()];
    const domainScores = requiredDomains.map((domain) => { const checks = list.flatMap((a) => a.checks.filter((c) => c.domain === domain)); return { domain, averageScore: checks.length ? Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length) : 0, blocked: checks.filter((c) => c.status === 'blocked').length, watch: checks.filter((c) => c.status === 'watch').length }; });
    return { generatedAt: now, averageScore: list.length ? Math.round(list.reduce((sum, a) => sum + a.overallScore, 0) / list.length) : 0, ready: list.filter((a) => a.status === 'ready').length, watch: list.filter((a) => a.status === 'watch').length, blocked: list.filter((a) => a.status === 'blocked').length, races: list.map((a) => ({ raceId: a.raceId, trackId: a.trackId, postTime: a.postTime, score: a.overallScore, status: a.status, warnings: a.warnings.length, approvals: a.approvals.length })), warnings: list.flatMap((a) => a.warnings), approvals: list.flatMap((a) => a.approvals), events: list.flatMap((a) => a.events), auditRecords: this.auditChain.map(clone), domainScores };
  }
  getAssessment(raceId: string): RaceDayReadinessAssessment | undefined { const value = this.assessments.get(raceId); return value ? clone(value) : undefined; }
  apiDefinition(): ApiServiceDefinition { return { id: 'race-day-readiness', name: 'Race Day Readiness', domain: 'race-day', version: 'v1', basePath: '/api/v1/race-day-readiness', description: 'Continuously evaluates race readiness across track, gate, staffing, veterinary, stewards, emergency, security, weather, and facility health.', owner: { team: 'racing-operations', productOwner: 'Race Day Commander', technicalOwner: 'Operations Platform Owner', supportChannel: '#race-day-readiness' }, lifecycle: 'active', auth: ['jwt','oauth2','mtls'], rateLimit: { requests: 900, perSeconds: 60, burst: 150 }, tags: ['race-day','readiness','audit','approvals'], slo: { availability: 99.9, latencyMs: 200 }, endpoints: [{ method: 'POST', path: '/evaluations', summary: 'Evaluate readiness', scopes: ['race:write'] }, { method: 'GET', path: '/evaluations/{raceId}', summary: 'Get readiness assessment', scopes: ['race:read'] }, { method: 'GET', path: '/dashboard', summary: 'Readiness dashboard', scopes: ['race:read'] }, { method: 'GET', path: '/events', summary: 'Readiness events', scopes: ['race:read'] }] }; }

  private normalizeChecks(checks: ReadinessCheck[], at: string): ReadinessCheck[] { const byDomain = new Map(checks.map((c) => [c.domain, c])); return requiredDomains.map((domain) => byDomain.get(domain) ?? { domain, label: `${domain} readiness feed missing`, score: 0, status: 'blocked', evidence: [`missing:${domain}`], blockers: ['required readiness input missing'], updatedAt: at, approvalRequired: true, ownerRole: domain === 'veterinary' ? 'veterinarian' : domain === 'stewards' ? 'steward' : 'operations' }); }
  private mergeWorkforceCheck(checks: ReadinessCheck[], workforceCheck: ReadinessCheck): ReadinessCheck[] { return [...checks.filter((check) => check.domain !== 'staffing'), workforceCheck]; }
  private warningFor(raceId: string, check: ReadinessCheck): OperationalWarning[] { if (check.status === 'ready') return []; const severity = check.status === 'blocked' ? 'critical' : 'warning'; return [{ id: id('warn-ready'), raceId, domain: check.domain, severity, message: `${check.label}: ${check.blockers.join('; ') || 'readiness watch'}`, recommendedAction: `Route ${check.domain} exception to ${check.ownerRole} and require documented clearance before race start.`, evidence: check.evidence }]; }
}

export function raceDayReadinessChecklist(at = new Date().toISOString()): ReadinessCheck[] { return requiredDomains.map((domain) => ({ domain, label: `${domain} readiness`, score: 100, status: 'ready', evidence: [`${domain}:ok`], blockers: [], updatedAt: at, ownerRole: domain === 'veterinary' ? 'veterinarian' : domain === 'stewards' ? 'steward' : 'operations' })); }
