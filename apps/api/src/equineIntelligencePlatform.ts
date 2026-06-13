import { ImmutableAuditLog, type AuditLogEntry } from './auditLog.js';
import { DigitalTwinRuntimeEngine, type AssetState } from './enterpriseArchitecture.js';
import { UniversalEventBus, type RaceDayEvent } from './eventBus.js';

export type EquinePrivacyScope = 'public' | 'racing-officials' | 'care-team' | 'regulator' | 'veterinary-confidential';
export type EquineLifecycleStatus = 'active' | 'inactive' | 'retired' | 'deceased';
export type EquineComplianceStatus = 'compliant' | 'under-review' | 'suspended' | 'ineligible';
export type EquineDomainEventType = `equine.${string}`;
export type EquineRelationshipType = 'owned-by' | 'trained-by' | 'treated-by' | 'transported-by' | 'entered-in-race' | 'worked-at-track' | 'retired-to';
export type AIRecommendationDomain = 'health' | 'welfare' | 'eligibility' | 'training' | 'transportation' | 'retirement';
export type AIRecommendationStatus = 'advisory' | 'pending-veterinarian-review' | 'veterinarian-reviewed' | 'rejected' | 'operationalized';

export interface EquineActor { id: string; roles: Array<'owner' | 'trainer' | 'veterinarian' | 'racing-secretary' | 'steward' | 'compliance-officer' | 'welfare-officer' | 'transport-coordinator' | 'auditor' | 'ai-agent'>; tenantId: string; human?: boolean }
export interface EquineIdentity { horseId: string; tenantId: string; name: string; microchipId?: string; foaled?: string; sex?: 'colt' | 'filly' | 'gelding' | 'mare' | 'stallion'; breed?: string; lifecycleStatus: EquineLifecycleStatus }
export interface OwnershipRecord { ownerId: string; ownerName: string; effectiveFrom: string; effectiveTo?: string; percentage: number; evidence: string[] }
export interface TrainerAssignment { trainerId: string; trainerName: string; effectiveFrom: string; effectiveTo?: string; licenseStatus: 'active' | 'expired' | 'suspended'; evidence: string[] }
export interface RaceHistoryRecord { raceId: string; date: string; trackId: string; finishPosition?: number; status: 'entered' | 'started' | 'scratched' | 'completed' | 'disqualified'; stewardNotes?: string; evidence: string[] }
export interface WorkoutRecord { workoutId: string; date: string; trackId: string; distanceFurlongs: number; timeSeconds: number; surface: string; source: string }
export interface TransportationRecord { tripId: string; from: string; to: string; departedAt: string; arrivedAt?: string; transporter: string; welfareChecks: string[] }
export interface VeterinaryRecord { recordId: string; recordedAt: string; veterinarianId: string; category: 'exam' | 'medication' | 'injury' | 'clearance' | 'lab' | 'ai-review'; summary: string; privacyScope: EquinePrivacyScope; restrictions?: string[]; recommendationId?: string }
export interface WelfareRecord { recordId: string; observedAt: string; observerId: string; score: number; notes: string; interventions: string[] }
export interface RetirementRecord { retiredAt: string; reason: string; destination: string; aftercareContact?: string; evidence: string[] }
export interface OperationalEvent { eventId: string; occurredAt: string; type: string; actorId: string; summary: string; evidence: string[] }
export interface EligibilityRule { id: string; description: string; evaluate: (profile: EquineProfile) => boolean; failureStatus: EquineComplianceStatus }
export interface EquineEventStreamEntry { sequence: number; eventId: string; occurredAt: string; type: EquineDomainEventType; actorId: string; payload: unknown; twinSynced: boolean; auditId: string }
export interface EquineRelationship { id: string; type: EquineRelationshipType; fromId: string; toId: string; effectiveFrom: string; effectiveTo?: string; evidence: string[] }
export interface EquineApprovalRecord { id: string; recommendationId?: string; action: string; status: 'pending' | 'approved' | 'rejected'; requestedBy: string; reviewedBy?: string; reviewedAt?: string; reason?: string; evidence: string[]; requiredRole: EquineActor['roles'][number] }
export interface EquineAIRecommendation { id: string; horseId: string; tenantId: string; domain: AIRecommendationDomain; createdAt: string; requestedBy: string; modelId: string; summary: string; confidence: number; proposedOperationalAction?: 'add-eligibility-flag' | 'add-veterinary-restriction' | 'clear-to-race' | 'adjust-training' | 'transport-welfare-check'; advisoryOnly: boolean; status: AIRecommendationStatus; veterinarianReviewRequired: boolean; veterinarianReview?: { veterinarianId: string; reviewedAt: string; decision: 'approved' | 'rejected'; reason: string; evidence: string[] }; evidence: string[] }
export type AIRecommendationHook = (profile: EquineProfile) => EquineAIRecommendation[];

export interface EquineProfile {
  identity: EquineIdentity; ownershipHistory: OwnershipRecord[]; trainerAssignments: TrainerAssignment[]; racingHistory: RaceHistoryRecord[]; workouts: WorkoutRecord[]; transportationRecords: TransportationRecord[]; veterinaryRecords: VeterinaryRecord[]; welfareRecords: WelfareRecord[]; retirementRecord?: RetirementRecord; complianceStatus: EquineComplianceStatus; eligibilityFlags: string[]; operationalHistory: OperationalEvent[]; twinId: string; relationships: EquineRelationship[]; approvals: EquineApprovalRecord[]; aiRecommendations: EquineAIRecommendation[]; eventStream: EquineEventStreamEntry[]; version: number; updatedAt: string;
}

const readScopesByRole: Record<EquineActor['roles'][number], EquinePrivacyScope[]> = { owner: ['public', 'racing-officials', 'care-team'], trainer: ['public', 'racing-officials', 'care-team'], veterinarian: ['public', 'racing-officials', 'care-team', 'veterinary-confidential'], 'racing-secretary': ['public', 'racing-officials'], steward: ['public', 'racing-officials', 'regulator'], 'compliance-officer': ['public', 'racing-officials', 'care-team', 'regulator', 'veterinary-confidential'], 'welfare-officer': ['public', 'racing-officials', 'care-team', 'regulator'], 'transport-coordinator': ['public', 'care-team'], auditor: ['public', 'racing-officials', 'regulator'], 'ai-agent': ['public'] };

export const defaultEligibilityRules: EligibilityRule[] = [
  { id: 'active-lifecycle', description: 'Horse must be active', evaluate: (p) => p.identity.lifecycleStatus === 'active', failureStatus: 'ineligible' },
  { id: 'no-active-compliance-flags', description: 'No open eligibility flags', evaluate: (p) => p.eligibilityFlags.length === 0, failureStatus: 'under-review' },
  { id: 'trainer-license-active', description: 'Current trainer license must be active', evaluate: (p) => !currentTrainer(p) || currentTrainer(p)?.licenseStatus === 'active', failureStatus: 'suspended' },
  { id: 'recent-welfare-ok', description: 'Latest welfare score must be at least 70', evaluate: (p) => latest(p.welfareRecords)?.score === undefined || latest(p.welfareRecords)!.score >= 70, failureStatus: 'under-review' },
  { id: 'no-unreviewed-health-ai', description: 'Health AI recommendations must not affect operations before veterinarian review', evaluate: (p) => !p.aiRecommendations.some((r) => r.domain === 'health' && r.proposedOperationalAction && r.status !== 'veterinarian-reviewed' && r.status !== 'operationalized'), failureStatus: 'under-review' },
];

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export class EquineIntelligencePlatform {
  private readonly profiles = new Map<string, EquineProfile>();
  private readonly audit = new ImmutableAuditLog();
  private readonly eventBus = new UniversalEventBus();
  private readonly aiHooks: AIRecommendationHook[] = [];
  private eventSequence = 0;
  constructor(private readonly twinRuntime = new DigitalTwinRuntimeEngine(), private readonly rules = defaultEligibilityRules) {}

  createProfile(identity: EquineIdentity, actor: EquineActor): EquineProfile {
    this.requireTenant(identity.tenantId, actor); this.requireRole(actor, ['racing-secretary', 'compliance-officer']); if (this.profiles.has(identity.horseId)) throw new Error('Equine profile already exists');
    const now = new Date().toISOString();
    const profile: EquineProfile = { identity: { ...identity }, ownershipHistory: [], trainerAssignments: [], racingHistory: [], workouts: [], transportationRecords: [], veterinaryRecords: [], welfareRecords: [], complianceStatus: 'under-review', eligibilityFlags: [], operationalHistory: [], twinId: `equine:${identity.horseId}`, relationships: [], approvals: [], aiRecommendations: [], eventStream: [], version: 1, updatedAt: now };
    const next = this.appendDomainEvent(profile, actor, 'equine.profile.created', { identity }, 'profile-created'); this.profiles.set(identity.horseId, structuredClone(next)); this.syncTwin(next, actor, 'profile-created'); return this.clone(next);
  }

  recordLifecycleEvent(horseId: string, patch: Partial<Omit<EquineProfile, 'identity' | 'twinId' | 'version' | 'updatedAt' | 'eventStream' | 'relationships' | 'approvals' | 'aiRecommendations'>> & { identity?: Partial<EquineIdentity>; operationalEvent?: OperationalEvent }, actor: EquineActor, reason: string): EquineProfile {
    this.requireRole(actor, ['racing-secretary', 'compliance-officer', 'veterinarian', 'welfare-officer', 'transport-coordinator', 'trainer']);
    const current = this.getWritable(horseId, actor); const next: EquineProfile = { ...current, ...patch, identity: { ...current.identity, ...(patch.identity ?? {}) }, operationalHistory: patch.operationalEvent ? [...current.operationalHistory, patch.operationalEvent] : current.operationalHistory, relationships: this.deriveRelationships({ ...current, ...patch } as EquineProfile), version: current.version + 1, updatedAt: new Date().toISOString() };
    next.complianceStatus = this.evaluateEligibility(next).complianceStatus; const withEvent = this.appendDomainEvent(next, actor, `equine.lifecycle.${reason}` as EquineDomainEventType, { changes: Object.keys(patch) }, reason); this.profiles.set(horseId, structuredClone(withEvent)); this.syncTwin(withEvent, actor, reason); return this.clone(withEvent);
  }

  retireHorse(horseId: string, retirementRecord: RetirementRecord, actor: EquineActor): EquineProfile { return this.recordLifecycleEvent(horseId, { retirementRecord, identity: { lifecycleStatus: 'retired' } }, actor, 'horse-retired'); }
  registerAIRecommendationHook(hook: AIRecommendationHook): void { this.aiHooks.push(hook); }
  runAIRecommendationHooks(horseId: string, actor: EquineActor): EquineAIRecommendation[] { const profile = this.getWritable(horseId, actor); const recs = this.aiHooks.flatMap((hook) => hook(this.clone(profile))); return recs.map((rec) => this.recordAIRecommendation(horseId, rec, actor)); }

  recordAIRecommendation(horseId: string, input: Omit<EquineAIRecommendation, 'id'|'horseId'|'tenantId'|'createdAt'|'requestedBy'|'advisoryOnly'|'status'|'veterinarianReviewRequired'> & Partial<Pick<EquineAIRecommendation, 'id'|'createdAt'|'requestedBy'>>, actor: EquineActor): EquineAIRecommendation {
    const profile = this.getWritable(horseId, actor); const healthGoverned = input.domain === 'health' || input.proposedOperationalAction === 'add-veterinary-restriction' || input.proposedOperationalAction === 'clear-to-race';
    const rec: EquineAIRecommendation = { ...input, id: input.id ?? id('ai-rec'), horseId, tenantId: profile.identity.tenantId, createdAt: input.createdAt ?? new Date().toISOString(), requestedBy: input.requestedBy ?? actor.id, advisoryOnly: true, status: healthGoverned ? 'pending-veterinarian-review' : 'advisory', veterinarianReviewRequired: healthGoverned, evidence: [...input.evidence] };
    const next = this.appendDomainEvent({ ...profile, aiRecommendations: [...profile.aiRecommendations, rec], approvals: healthGoverned ? [...profile.approvals, { id: id('approval'), recommendationId: rec.id, action: rec.proposedOperationalAction ?? 'health-ai-review', status: 'pending', requestedBy: actor.id, evidence: rec.evidence, requiredRole: 'veterinarian' }] : profile.approvals, version: profile.version + 1, updatedAt: new Date().toISOString() }, actor, 'equine.ai.recommendation.recorded', { recommendationId: rec.id, advisoryOnly: rec.advisoryOnly, veterinarianReviewRequired: rec.veterinarianReviewRequired }, 'ai-recommendation-recorded');
    this.profiles.set(horseId, structuredClone(next)); this.syncTwin(next, actor, 'ai-recommendation-recorded'); return this.clone(rec);
  }

  reviewAIRecommendation(horseId: string, recommendationId: string, vet: EquineActor, decision: 'approved'|'rejected', reason: string, evidence: string[]): EquineProfile {
    this.requireRole(vet, ['veterinarian']); if (vet.human === false) throw new Error('Veterinarian AI review must be performed by a human veterinarian');
    const profile = this.getWritable(horseId, vet); const rec = profile.aiRecommendations.find((r) => r.id === recommendationId); if (!rec) throw new Error('AI recommendation not found');
    const reviewed = { ...rec, status: decision === 'approved' ? 'veterinarian-reviewed' as const : 'rejected' as const, veterinarianReview: { veterinarianId: vet.id, reviewedAt: new Date().toISOString(), decision, reason, evidence } };
    const next = this.appendDomainEvent({ ...profile, aiRecommendations: profile.aiRecommendations.map((r) => r.id === recommendationId ? reviewed : r), approvals: profile.approvals.map((a) => a.recommendationId === recommendationId ? { ...a, status: decision, reviewedBy: vet.id, reviewedAt: reviewed.veterinarianReview!.reviewedAt, reason, evidence } : a), version: profile.version + 1, updatedAt: new Date().toISOString() }, vet, 'equine.ai.recommendation.veterinarian-reviewed', { recommendationId, decision }, 'ai-recommendation-veterinarian-reviewed');
    this.profiles.set(horseId, structuredClone(next)); this.syncTwin(next, vet, 'ai-recommendation-veterinarian-reviewed'); return this.clone(next);
  }

  applyAIRecommendation(horseId: string, recommendationId: string, actor: EquineActor): EquineProfile {
    const profile = this.getWritable(horseId, actor); const rec = profile.aiRecommendations.find((r) => r.id === recommendationId); if (!rec) throw new Error('AI recommendation not found');
    if (rec.veterinarianReviewRequired && rec.status !== 'veterinarian-reviewed') throw new Error('Health-related AI recommendations are advisory only until reviewed by a veterinarian');
    if (!rec.proposedOperationalAction) throw new Error('Recommendation has no operational action');
    const patch = rec.proposedOperationalAction === 'add-eligibility-flag' || rec.proposedOperationalAction === 'add-veterinary-restriction' ? { eligibilityFlags: [...new Set([...profile.eligibilityFlags, `ai:${rec.id}:${rec.proposedOperationalAction}`])], aiRecommendations: profile.aiRecommendations.map((r) => r.id === rec.id ? { ...r, status: 'operationalized' as const } : r) } : { aiRecommendations: profile.aiRecommendations.map((r) => r.id === rec.id ? { ...r, status: 'operationalized' as const } : r) };
    return this.recordLifecycleEvent(horseId, patch, actor, 'ai-recommendation-operationalized');
  }

  evaluateEligibility(profile: EquineProfile): { eligible: boolean; complianceStatus: EquineComplianceStatus; failedRules: string[] } { const failed = this.rules.filter((rule) => !rule.evaluate(profile)); const complianceStatus = failed[0]?.failureStatus ?? (profile.retirementRecord ? 'ineligible' : 'compliant'); return { eligible: failed.length === 0 && !profile.retirementRecord, complianceStatus, failedRules: failed.map((rule) => rule.id) }; }
  viewProfile(horseId: string, actor: EquineActor): EquineProfile { const profile = this.getWritable(horseId, actor); const scopes = new Set(actor.roles.flatMap((role) => readScopesByRole[role])); return { ...this.clone(profile), veterinaryRecords: profile.veterinaryRecords.filter((record) => scopes.has(record.privacyScope)) }; }
  relationshipMap(horseId: string, actor: EquineActor): EquineRelationship[] { return this.viewProfile(horseId, actor).relationships; }
  eventStream(horseId: string, actor: EquineActor): EquineEventStreamEntry[] { return this.viewProfile(horseId, actor).eventStream; }
  platformEvents(horseId?: string): RaceDayEvent[] { return this.eventBus.events(horseId ? { aggregateId: horseId } : {}); }
  auditTrail(): AuditLogEntry[] { return this.audit.all(); }
  twinSnapshot(tenantId?: string): AssetState[] { return this.twinRuntime.snapshot(tenantId); }

  private getWritable(horseId: string, actor: EquineActor) { const profile = this.profiles.get(horseId); if (!profile) throw new Error('Equine profile not found'); this.requireTenant(profile.identity.tenantId, actor); return this.clone(profile); }
  private requireTenant(tenantId: string, actor: EquineActor) { if (actor.tenantId !== tenantId) throw new Error('Tenant boundary violation'); }
  private requireRole(actor: EquineActor, roles: EquineActor['roles']) { if (!actor.roles.some((role) => roles.includes(role))) throw new Error(`Actor lacks required role: ${roles.join('|')}`); }
  private appendDomainEvent(profile: EquineProfile, actor: EquineActor, type: EquineDomainEventType, payload: unknown, action: string): EquineProfile { const audit = this.auditChange(profile, actor, action, [type]); const event: EquineEventStreamEntry = { sequence: ++this.eventSequence, eventId: id('equine-event'), occurredAt: profile.updatedAt, type, actorId: actor.id, payload, twinSynced: false, auditId: audit.id }; void this.eventBus.publish({ type, payload: { horseId: profile.identity.horseId, tenantId: profile.identity.tenantId, payload }, aggregateId: profile.identity.horseId, producer: 'equine-intelligence-platform', metadata: { compliance: 'regulated', team: 'equine-lifecycle', accountableRole: 'compliance-officer' } }); return { ...profile, eventStream: [...profile.eventStream, event] }; }
  private auditChange(profile: EquineProfile, actor: EquineActor, action: string, changes: string[]) { return this.audit.append({ id: `${profile.identity.horseId}:v${profile.version}:${action}:${this.eventSequence + 1}`, type: action.includes('ai-recommendation') ? 'ai-recommendation' : 'data-change', actor: actor.id, timestamp: profile.updatedAt, payload: { horseId: profile.identity.horseId, tenantId: profile.identity.tenantId, action, changes }, subjectId: profile.identity.horseId, tenantId: profile.identity.tenantId, severity: action.includes('ai') ? 'warning' : 'info', regulations: ['HISA', 'ARCI'] }); }
  private syncTwin(profile: EquineProfile, actor: EquineActor, reason: string) { this.twinRuntime.sync({ id: profile.twinId, tenantId: profile.identity.tenantId, updatedAt: profile.updatedAt, state: { horseId: profile.identity.horseId, lifecycleStatus: profile.identity.lifecycleStatus, complianceStatus: profile.complianceStatus, eligibilityFlags: profile.eligibilityFlags, currentOwner: latest(profile.ownershipHistory)?.ownerId, currentTrainer: currentTrainer(profile)?.trainerId, retirementDestination: profile.retirementRecord?.destination, openApprovalCount: profile.approvals.filter((a) => a.status === 'pending').length, pendingHealthAiReviewCount: profile.aiRecommendations.filter((r) => r.veterinarianReviewRequired && r.status === 'pending-veterinarian-review').length, relationshipCount: profile.relationships.length, lastSyncedBy: actor.id, syncReason: reason } }); }
  private deriveRelationships(profile: EquineProfile): EquineRelationship[] { const horse = profile.identity.horseId; return [...profile.ownershipHistory.map((r) => ({ id: `${horse}:owner:${r.ownerId}:${r.effectiveFrom}`, type: 'owned-by' as const, fromId: horse, toId: r.ownerId, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo, evidence: r.evidence })), ...profile.trainerAssignments.map((r) => ({ id: `${horse}:trainer:${r.trainerId}:${r.effectiveFrom}`, type: 'trained-by' as const, fromId: horse, toId: r.trainerId, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo, evidence: r.evidence })), ...profile.veterinaryRecords.map((r) => ({ id: `${horse}:vet:${r.veterinarianId}:${r.recordId}`, type: 'treated-by' as const, fromId: horse, toId: r.veterinarianId, effectiveFrom: r.recordedAt, evidence: [r.recordId] })), ...profile.racingHistory.map((r) => ({ id: `${horse}:race:${r.raceId}`, type: 'entered-in-race' as const, fromId: horse, toId: r.raceId, effectiveFrom: r.date, evidence: r.evidence })), ...(profile.retirementRecord ? [{ id: `${horse}:retired:${profile.retirementRecord.retiredAt}`, type: 'retired-to' as const, fromId: horse, toId: profile.retirementRecord.destination, effectiveFrom: profile.retirementRecord.retiredAt, evidence: profile.retirementRecord.evidence }] : [])]; }
  private clone<T>(value: T): T { return structuredClone(value); }
}

function latest<T extends { effectiveFrom?: string; observedAt?: string; date?: string }>(items: T[]): T | undefined { return [...items].sort((a, b) => String(b.effectiveFrom ?? b.observedAt ?? b.date).localeCompare(String(a.effectiveFrom ?? a.observedAt ?? a.date)))[0]; }
function currentTrainer(profile: EquineProfile): TrainerAssignment | undefined { return profile.trainerAssignments.find((assignment) => !assignment.effectiveTo) ?? latest(profile.trainerAssignments); }
