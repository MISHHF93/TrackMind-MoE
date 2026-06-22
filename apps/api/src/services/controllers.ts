import type { Role } from '@trackmind/shared';
import { ApexApprovalGateway, type ApexMutationContext, type ApprovalEvidencePackage } from './approvalGateway.js';
import { EquineIntelligenceService } from './equineIntelligenceService.js';
import { FinanceService } from './financeService.js';
import { SafetyService } from './safetyService.js';
import { SecurityService } from './securityService.js';
import { StewardingService, createStewardingService } from './stewardingService.js';
import type { SafetyEmergencyOperationsBoundary } from './safetyEmergencyBoundary.js';

export interface ApiControllerResponse {
  status: number;
  body: unknown;
}

export interface ApexDomainServices {
  approvals: ApexApprovalGateway;
  safety: SafetyService;
  stewarding: StewardingService;
  equine: EquineIntelligenceService;
  security: SecurityService;
  finance: FinanceService;
}

const isRecord = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const stringValue = (value: unknown, fallback = '') => typeof value === 'string' && value.length > 0 ? value : fallback;
const arrayOfStrings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function evidenceFromBody(body: Record<string, any>): ApprovalEvidencePackage {
  const evidence = isRecord(body.evidence) ? body.evidence : {};
  return {
    confidence: typeof evidence.confidence === 'number' ? evidence.confidence : typeof body.confidence === 'number' ? body.confidence : 0.72,
    rationale: stringValue(evidence.rationale, stringValue(body.rationale, stringValue(body.reason, 'APEX workflow requires human approval before mutation.'))),
    alternativeOptions: arrayOfStrings(evidence.alternativeOptions ?? body.alternativeOptions),
    evidenceLinks: arrayOfStrings(evidence.evidenceLinks ?? body.evidenceLinks ?? body.evidence),
  };
}

function contextFromBody(body: Record<string, any>): ApexMutationContext {
  const actorType = body.actorType === 'human' || body.actorType === 'ai-agent' || body.actorType === 'service' ? body.actorType : 'service';
  return {
    tenantId: stringValue(body.tenantId, 'trackmind'),
    racetrackId: stringValue(body.racetrackId, 'main-track'),
    actor: stringValue(body.actor, stringValue(body.requestedBy, 'api-operator')),
    actorType,
    roles: arrayOfStrings(body.roles),
    now: typeof body.now === 'string' ? body.now : undefined,
  };
}

function approvalActorFromBody(body: Record<string, any>) {
  return {
    id: stringValue(body.actor, 'human-approver'),
    roles: arrayOfStrings(body.roles) as Role[],
    human: body.human !== false && body.actorType !== 'ai-agent' && body.actorType !== 'service',
  };
}

export function createApexDomainServices(gateway = new ApexApprovalGateway(), stewardOperations?: import('../stewardOperationsPlatform.js').StewardOperationsPlatform): ApexDomainServices {
  return {
    approvals: gateway,
    safety: new SafetyService(gateway),
    stewarding: createStewardingService(gateway, stewardOperations),
    equine: new EquineIntelligenceService(gateway),
    security: new SecurityService(gateway),
    finance: new FinanceService(gateway),
  };
}

export class ApexDomainControllers {
  safetyEmergencyBoundary?: SafetyEmergencyOperationsBoundary;

  constructor(readonly services = createApexDomainServices()) {}

  async handle(method: string, path: string, body: unknown): Promise<ApiControllerResponse | undefined> {
    const input = isRecord(body) ? body : {};

    if (method === 'GET' && path === '/services/safety/emergency-operations/workspace') {
      if (!this.safetyEmergencyBoundary) {
        return { status: 503, body: { ok: false, error: { code: 'safety_boundary_unavailable', message: 'Emergency operations boundary is not configured.' } } };
      }
      return { status: 200, body: this.safetyEmergencyBoundary.workspace() };
    }
    if (method === 'GET' && path === '/services/safety/state') return { status: 200, body: this.services.safety.currentSafetyState() };
    if (method === 'POST' && path === '/services/safety/emergency-actions') {
      return { status: 202, body: await this.services.safety.requestEmergencyAction({ incidentId: stringValue(input.incidentId, 'incident-1'), action: stringValue(input.action, 'emergency-action'), requestedBy: stringValue(input.requestedBy, stringValue(input.actor, 'safety-operator')), evidence: evidenceFromBody(input), context: contextFromBody(input) }) };
    }

    if (method === 'POST' && path === '/services/stewarding/rulebook/query') return { status: 200, body: this.services.stewarding.queryRulebook({ question: stringValue(input.question, 'rulebook query'), jurisdiction: input.jurisdiction, evidenceRefs: arrayOfStrings(input.evidenceRefs) }) };
    if (method === 'POST' && path === '/services/stewarding/penalty-recommendations') {
      return { status: 202, body: await this.services.stewarding.recommendPenalty({ inquiryId: stringValue(input.inquiryId, 'inquiry-1'), ruleIds: arrayOfStrings(input.ruleIds), recommendedPenalty: stringValue(input.recommendedPenalty, 'review by stewards'), evidence: evidenceFromBody(input), context: contextFromBody(input) }) };
    }

    if (method === 'GET' && path.startsWith('/services/equine/horses/')) {
      const horseId = decodeURIComponent(path.slice('/services/equine/horses/'.length));
      return { status: 200, body: this.services.equine.horseProfile(horseId, arrayOfStrings(input.roles)) };
    }
    if (method === 'POST' && path === '/services/equine/scratch-decisions') {
      return { status: 202, body: await this.services.equine.requestScratchDecision({ horseId: stringValue(input.horseId, 'horse-1'), reason: stringValue(input.reason, 'scratch requested'), evidence: evidenceFromBody(input), context: contextFromBody(input) }) };
    }
    if (method === 'POST' && path === '/services/equine/medication-approvals') {
      return { status: 202, body: await this.services.equine.requestMedicationApproval({ horseId: stringValue(input.horseId, 'horse-1'), medication: stringValue(input.medication, 'medication-review'), reason: stringValue(input.reason, 'medication approval requested'), evidence: evidenceFromBody(input), context: contextFromBody(input) }) };
    }

    if (method === 'POST' && path === '/services/security/credentials/validate') return { status: 200, body: this.services.security.validateCredential({ zoneId: stringValue(input.zoneId, 'paddock'), credentialId: stringValue(input.credentialId, 'unknown'), personId: stringValue(input.personId, 'unknown-person') }) };
    if (method === 'POST' && path === '/services/security/emergency-zone-actions') {
      return { status: 202, body: await this.services.security.requestEmergencyZoneAction({ zoneId: stringValue(input.zoneId, 'paddock'), action: stringValue(input.action, 'secure-zone'), evidence: evidenceFromBody(input), context: contextFromBody(input) }) };
    }

    if (method === 'GET' && path === '/services/finance/ticketing') return { status: 200, body: this.services.finance.ticketingState() };
    if (method === 'POST' && path === '/services/finance/payouts') {
      return { status: 202, body: await this.services.finance.requestPayout({ payoutId: stringValue(input.payoutId, 'payout-1'), amountCents: Number(input.amountCents ?? 0), recipientId: stringValue(input.recipientId, 'recipient-1'), evidence: evidenceFromBody(input), context: contextFromBody(input) }) };
    }

    const approvalMatch = path.match(/^\/approvals\/([^/]+)\/(approve|reject)$/);
    if (method === 'POST' && approvalMatch) {
      const [, approvalRequestId, decision] = approvalMatch;
      if (decision === 'approve') return { status: 200, body: await this.services.approvals.approve({ approvalRequestId, actor: approvalActorFromBody(input), reason: stringValue(input.reason, 'human approval recorded'), evidence: arrayOfStrings(input.evidence).length ? arrayOfStrings(input.evidence) : ['human-approval-record'], now: typeof input.now === 'string' ? input.now : undefined }) };
      return { status: 200, body: await this.services.approvals.reject({ approvalRequestId, actor: approvalActorFromBody(input), reason: stringValue(input.reason, 'human rejected request'), evidence: arrayOfStrings(input.evidence).length ? arrayOfStrings(input.evidence) : ['human-approval-record'], now: typeof input.now === 'string' ? input.now : undefined }) };
    }

    if (method === 'GET' && path === '/approvals/apex/actions') return { status: 200, body: this.services.approvals.approvalRecords() };
    return undefined;
  }
}

export function createApexDomainControllers(gateway?: ApexApprovalGateway, stewardOperations?: import('../stewardOperationsPlatform.js').StewardOperationsPlatform) {
  return new ApexDomainControllers(createApexDomainServices(gateway, stewardOperations));
}
