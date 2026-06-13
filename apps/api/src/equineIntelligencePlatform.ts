import { ImmutableAuditLog, type AuditLogEntry } from './auditLog.js';
import { DigitalTwinRuntimeEngine, type AssetState } from './enterpriseArchitecture.js';

export type EquinePrivacyScope = 'public' | 'racing-officials' | 'care-team' | 'regulator' | 'veterinary-confidential';
export type EquineLifecycleStatus = 'active' | 'inactive' | 'retired' | 'deceased';
export type EquineComplianceStatus = 'compliant' | 'under-review' | 'suspended' | 'ineligible';

export interface EquineActor { id: string; roles: Array<'owner' | 'trainer' | 'veterinarian' | 'racing-secretary' | 'steward' | 'compliance-officer' | 'welfare-officer' | 'transport-coordinator' | 'auditor'>; tenantId: string }
export interface EquineIdentity { horseId: string; tenantId: string; name: string; microchipId?: string; foaled?: string; sex?: 'colt' | 'filly' | 'gelding' | 'mare' | 'stallion'; breed?: string; lifecycleStatus: EquineLifecycleStatus }
export interface OwnershipRecord { ownerId: string; ownerName: string; effectiveFrom: string; effectiveTo?: string; percentage: number; evidence: string[] }
export interface TrainerAssignment { trainerId: string; trainerName: string; effectiveFrom: string; effectiveTo?: string; licenseStatus: 'active' | 'expired' | 'suspended'; evidence: string[] }
export interface RaceHistoryRecord { raceId: string; date: string; trackId: string; finishPosition?: number; status: 'entered' | 'started' | 'scratched' | 'completed' | 'disqualified'; stewardNotes?: string; evidence: string[] }
export interface WorkoutRecord { workoutId: string; date: string; trackId: string; distanceFurlongs: number; timeSeconds: number; surface: string; source: string }
export interface TransportationRecord { tripId: string; from: string; to: string; departedAt: string; arrivedAt?: string; transporter: string; welfareChecks: string[] }
export interface VeterinaryRecord { recordId: string; recordedAt: string; veterinarianId: string; category: 'exam' | 'medication' | 'injury' | 'clearance' | 'lab'; summary: string; privacyScope: EquinePrivacyScope; restrictions?: string[] }
export interface WelfareRecord { recordId: string; observedAt: string; observerId: string; score: number; notes: string; interventions: string[] }
export interface RetirementRecord { retiredAt: string; reason: string; destination: string; aftercareContact?: string; evidence: string[] }
export interface OperationalEvent { eventId: string; occurredAt: string; type: string; actorId: string; summary: string; evidence: string[] }
export interface EligibilityRule { id: string; description: string; evaluate: (profile: EquineProfile) => boolean; failureStatus: EquineComplianceStatus }

export interface EquineProfile {
  identity: EquineIdentity;
  ownershipHistory: OwnershipRecord[];
  trainerAssignments: TrainerAssignment[];
  racingHistory: RaceHistoryRecord[];
  workouts: WorkoutRecord[];
  transportationRecords: TransportationRecord[];
  veterinaryRecords: VeterinaryRecord[];
  welfareRecords: WelfareRecord[];
  retirementRecord?: RetirementRecord;
  complianceStatus: EquineComplianceStatus;
  eligibilityFlags: string[];
  operationalHistory: OperationalEvent[];
  twinId: string;
  version: number;
  updatedAt: string;
}

const readScopesByRole: Record<EquineActor['roles'][number], EquinePrivacyScope[]> = {
  owner: ['public', 'racing-officials', 'care-team'],
  trainer: ['public', 'racing-officials', 'care-team'],
  veterinarian: ['public', 'racing-officials', 'care-team', 'veterinary-confidential'],
  'racing-secretary': ['public', 'racing-officials'],
  steward: ['public', 'racing-officials', 'regulator'],
  'compliance-officer': ['public', 'racing-officials', 'care-team', 'regulator', 'veterinary-confidential'],
  'welfare-officer': ['public', 'racing-officials', 'care-team', 'regulator'],
  'transport-coordinator': ['public', 'care-team'],
  auditor: ['public', 'racing-officials', 'regulator'],
};

export const defaultEligibilityRules: EligibilityRule[] = [
  { id: 'active-lifecycle', description: 'Horse must be active', evaluate: (p) => p.identity.lifecycleStatus === 'active', failureStatus: 'ineligible' },
  { id: 'no-active-compliance-flags', description: 'No open eligibility flags', evaluate: (p) => p.eligibilityFlags.length === 0, failureStatus: 'under-review' },
  { id: 'trainer-license-active', description: 'Current trainer license must be active', evaluate: (p) => !currentTrainer(p) || currentTrainer(p)?.licenseStatus === 'active', failureStatus: 'suspended' },
  { id: 'recent-welfare-ok', description: 'Latest welfare score must be at least 70', evaluate: (p) => latest(p.welfareRecords)?.score === undefined || latest(p.welfareRecords)!.score >= 70, failureStatus: 'under-review' },
];

export class EquineIntelligencePlatform {
  private readonly profiles = new Map<string, EquineProfile>();
  private readonly audit = new ImmutableAuditLog();
  constructor(private readonly twinRuntime = new DigitalTwinRuntimeEngine(), private readonly rules = defaultEligibilityRules) {}

  createProfile(identity: EquineIdentity, actor: EquineActor): EquineProfile {
    this.requireTenant(identity.tenantId, actor);
    if (!actor.roles.some((role) => ['racing-secretary', 'compliance-officer'].includes(role))) throw new Error('Actor cannot create equine profiles');
    if (this.profiles.has(identity.horseId)) throw new Error('Equine profile already exists');
    const now = new Date().toISOString();
    const profile: EquineProfile = { identity: { ...identity }, ownershipHistory: [], trainerAssignments: [], racingHistory: [], workouts: [], transportationRecords: [], veterinaryRecords: [], welfareRecords: [], complianceStatus: 'under-review', eligibilityFlags: [], operationalHistory: [], twinId: `equine:${identity.horseId}`, version: 1, updatedAt: now };
    this.profiles.set(identity.horseId, structuredClone(profile));
    this.auditChange(profile, actor, 'profile-created', ['identity']);
    this.syncTwin(profile, actor, 'profile-created');
    return this.clone(profile);
  }

  recordLifecycleEvent(horseId: string, patch: Partial<Omit<EquineProfile, 'identity' | 'twinId' | 'version' | 'updatedAt'>> & { identity?: Partial<EquineIdentity>; operationalEvent?: OperationalEvent }, actor: EquineActor, reason: string): EquineProfile {
    const current = this.getWritable(horseId, actor);
    const next: EquineProfile = { ...current, ...patch, identity: { ...current.identity, ...(patch.identity ?? {}) }, operationalHistory: patch.operationalEvent ? [...current.operationalHistory, patch.operationalEvent] : current.operationalHistory, version: current.version + 1, updatedAt: new Date().toISOString() };
    next.complianceStatus = this.evaluateEligibility(next).complianceStatus;
    this.profiles.set(horseId, structuredClone(next));
    this.auditChange(next, actor, reason, Object.keys(patch));
    this.syncTwin(next, actor, reason);
    return this.clone(next);
  }

  evaluateEligibility(profile: EquineProfile): { eligible: boolean; complianceStatus: EquineComplianceStatus; failedRules: string[] } {
    const failed = this.rules.filter((rule) => !rule.evaluate(profile));
    const complianceStatus = failed[0]?.failureStatus ?? (profile.retirementRecord ? 'ineligible' : 'compliant');
    return { eligible: failed.length === 0 && !profile.retirementRecord, complianceStatus, failedRules: failed.map((rule) => rule.id) };
  }

  viewProfile(horseId: string, actor: EquineActor): EquineProfile {
    const profile = this.getWritable(horseId, actor);
    const scopes = new Set(actor.roles.flatMap((role) => readScopesByRole[role]));
    return { ...this.clone(profile), veterinaryRecords: profile.veterinaryRecords.filter((record) => scopes.has(record.privacyScope)) };
  }

  auditTrail(): AuditLogEntry[] { return this.audit.all(); }
  twinSnapshot(tenantId?: string): AssetState[] { return this.twinRuntime.snapshot(tenantId); }

  private getWritable(horseId: string, actor: EquineActor) { const profile = this.profiles.get(horseId); if (!profile) throw new Error('Equine profile not found'); this.requireTenant(profile.identity.tenantId, actor); return this.clone(profile); }
  private requireTenant(tenantId: string, actor: EquineActor) { if (actor.tenantId !== tenantId) throw new Error('Tenant boundary violation'); }
  private auditChange(profile: EquineProfile, actor: EquineActor, action: string, changes: string[]) { this.audit.append({ id: `${profile.identity.horseId}:v${profile.version}:${action}`, type: 'data-change', actor: actor.id, timestamp: profile.updatedAt, payload: { horseId: profile.identity.horseId, tenantId: profile.identity.tenantId, action, changes } }); }
  private syncTwin(profile: EquineProfile, actor: EquineActor, reason: string) { this.twinRuntime.sync({ id: profile.twinId, tenantId: profile.identity.tenantId, updatedAt: profile.updatedAt, state: { horseId: profile.identity.horseId, lifecycleStatus: profile.identity.lifecycleStatus, complianceStatus: profile.complianceStatus, eligibilityFlags: profile.eligibilityFlags, currentOwner: latest(profile.ownershipHistory)?.ownerId, currentTrainer: currentTrainer(profile)?.trainerId, lastSyncedBy: actor.id, syncReason: reason } }); }
  private clone(profile: EquineProfile): EquineProfile { return structuredClone(profile); }
}

function latest<T extends { effectiveFrom?: string; observedAt?: string; date?: string }>(items: T[]): T | undefined { return [...items].sort((a, b) => String(b.effectiveFrom ?? b.observedAt ?? b.date).localeCompare(String(a.effectiveFrom ?? a.observedAt ?? a.date)))[0]; }
function currentTrainer(profile: EquineProfile): TrainerAssignment | undefined { return profile.trainerAssignments.find((assignment) => !assignment.effectiveTo) ?? latest(profile.trainerAssignments); }
