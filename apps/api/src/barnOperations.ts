import type { ExpertDomain, Role } from '@trackmind/shared';
import { ImmutableAuditLog, type AuditEventType, type AuditSeverity } from './auditLog.js';
import { type ApprovalToken, CentralizedApprovalService, type ControlledActionRequest } from './approvals.js';
import { DigitalTwinRuntime, type DigitalTwinRuntimeTwin } from './digitalTwinRuntime.js';
import { EquineIntelligencePlatform, type EquineActor } from './equineIntelligencePlatform.js';
import { UniversalEventBus, type ComplianceClassification, type EventName, type RaceDayEvent } from './eventBus.js';
import { RacetrackAssetRegistryService, type AssetPrincipal, type RegistryAsset } from './racetrackAssetRegistryService.js';
import type { AssetDomain, AssetRiskLevel, ControlDefinition, RegulationDefinition } from './racetrackControlRegistry.js';
import { WorkflowOrchestrationEngine, type WorkflowDefinition, type WorkflowInstance } from './workflowEngine.js';

export type BarnStatus = 'ready' | 'watch' | 'restricted' | 'closed';
export type StallStatus = 'available' | 'occupied' | 'maintenance' | 'restricted';
export type BarnEventType =
  | 'barn.created'
  | 'barn.asset.synced'
  | 'barn.horse.assigned'
  | 'barn.horse.moved'
  | 'barn.access.recorded'
  | 'barn.inspected'
  | 'barn.restriction.created'
  | 'barn.trainer.assigned'
  | 'barn.veterinary-visit.recorded'
  | 'barn.facility-readiness.evaluated'
  | 'digital-twin.state.patch';
export type BarnPermission = 'barn:read' | 'barn:manage' | 'stall:assign' | 'movement:record' | 'access:record' | 'inspection:perform' | 'vet:record' | 'restriction:manage';

export interface BarnActor { id: string; roles: Role[]; tenantId: string; human?: boolean }
export interface Barn { id: string; name: string; tenantId: string; location: string; status: BarnStatus; capacity: number; incidentIds: string[]; trainerIds: string[] }
export interface Stall { id: string; barnId: string; label: string; status: StallStatus; occupancyHorseId?: string; restrictionIds: string[] }
export interface HorseOccupancy { horseId: string; barnId: string; stallId: string; assignedAt: string; assignedBy: string; eventId: string; auditId: string; twinId: string; approvalRequestId?: string }
export interface HorseMovementRecord { id: string; horseId: string; fromBarnId?: string; fromStallId?: string; toBarnId: string; toStallId: string; reason: string; movedAt: string; movedBy: string; eventId: string; auditId: string; approvalRequestId?: string }
export interface BarnAccessRecord { id: string; barnId: string; actorId: string; purpose: string; accessAt: string; decision: 'allowed' | 'denied'; eventId: string; auditId: string; approvalRequestId?: string }
export interface BarnInspection { id: string; barnId: string; inspectedBy: string; inspectedAt: string; score: number; findings: string[]; status: BarnStatus; eventId: string; auditId: string }
export interface BarnRestriction { id: string; barnId: string; stallId?: string; horseId?: string; type: 'quarantine' | 'maintenance' | 'security' | 'veterinary'; reason: string; active: boolean; createdAt: string; createdBy: string; approvalRequestId?: string; eventId: string; auditId: string }
export interface BarnTrainerAssignment { id: string; barnId: string; trainerId: string; assignedBy: string; assignedAt: string; active: boolean; auditId: string; eventId: string; approvalRequestId?: string }
export interface VeterinaryVisitRecord { id: string; horseId: string; barnId: string; stallId?: string; veterinarianId: string; visitAt: string; findings: string[]; restrictionsCreated: string[]; eventId: string; auditId: string }
export interface BarnReadiness { barnId: string; status: BarnStatus; score: number; blockers: string[]; openRestrictions: number; occupiedStalls: number; capacity: number }
export interface BarnFacilityReadiness extends BarnReadiness { inspectionStatus: 'current' | 'due' | 'missing'; approvalRequired: boolean; workflowStatus: WorkflowInstance['status'] | 'not-started'; twinIds: string[]; assetIds: string[] }
export interface BarnAssetLink { assetId: string; barnId: string; stallId?: string; twinId: string; registryStatus: 'pending' | 'synced'; riskLevel: AssetRiskLevel; eventId?: string; auditId?: string }
export interface BarnTwinSyncRecord { twinId: string; horseId?: string; barnId: string; stallId?: string; status: 'synced' | 'queued' | 'failed'; patch: Record<string, unknown>; eventId: string; auditId: string }
export interface BarnDashboardSummary { totalBarns: number; totalStalls: number; occupiedStalls: number; availableStalls: number; restrictedStalls: number; maintenanceStalls: number; occupancyRate: number; readinessStatus: BarnStatus; openRestrictions: number; pendingApprovals: number; eventCount: number; auditRecordCount: number; twinSyncCount: number; assetCount: number; latestMovementAt?: string }
export interface BarnIntegrationSignal { id: string; service: 'asset-registry' | 'equine-intelligence' | 'digital-twin-runtime' | 'workflow' | 'observability'; status: 'synced' | 'queued' | 'failed'; message: string; subjectId: string; at: string }

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const barnEvents: BarnEventType[] = ['barn.created', 'barn.asset.synced', 'barn.horse.assigned', 'barn.horse.moved', 'barn.access.recorded', 'barn.inspected', 'barn.restriction.created', 'barn.trainer.assigned', 'barn.veterinary-visit.recorded', 'barn.facility-readiness.evaluated', 'digital-twin.state.patch'];
const equineRoles = ['trainer', 'veterinarian', 'racing-secretary', 'steward', 'compliance-officer', 'welfare-officer', 'transport-coordinator', 'auditor', 'ai-agent'] as const;
const rolePermissions: Record<Role, BarnPermission[]> = {
  admin: ['barn:read', 'barn:manage', 'stall:assign', 'movement:record', 'access:record', 'inspection:perform', 'vet:record', 'restriction:manage'],
  steward: ['barn:read', 'access:record'],
  veterinarian: ['barn:read', 'access:record', 'vet:record', 'restriction:manage'],
  'track-superintendent': ['barn:read', 'barn:manage', 'stall:assign', 'movement:record', 'inspection:perform', 'restriction:manage'],
  security: ['barn:read', 'access:record', 'restriction:manage'],
  'racing-secretary': ['barn:read', 'stall:assign', 'movement:record'],
  'compliance-officer': ['barn:read', 'access:record'],
  'read-only-auditor': ['barn:read'],
  finance: ['barn:read'],
  'ticketing-manager': ['barn:read'],
};

export class CoordinatedBarnOperationsService {
  readonly eventBus: UniversalEventBus;
  readonly auditLog: ImmutableAuditLog;
  readonly approvals: CentralizedApprovalService;
  readonly equinePlatform?: EquineIntelligencePlatform;
  readonly assetRegistry?: RacetrackAssetRegistryService;
  readonly twinRuntime?: DigitalTwinRuntime;
  readonly workflow?: WorkflowOrchestrationEngine;

  private barns = new Map<string, Barn>();
  private stalls = new Map<string, Stall>();
  private occupancy = new Map<string, HorseOccupancy>();
  private movements: HorseMovementRecord[] = [];
  private access: BarnAccessRecord[] = [];
  private inspections: BarnInspection[] = [];
  private restrictions: BarnRestriction[] = [];
  private trainers: BarnTrainerAssignment[] = [];
  private vetVisits: VeterinaryVisitRecord[] = [];
  private assetLinks = new Map<string, BarnAssetLink>();
  private twinSync: BarnTwinSyncRecord[] = [];
  private workflows: WorkflowInstance[] = [];
  private integrationSignals: BarnIntegrationSignal[] = [];

  constructor(deps: { eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog; approvals?: CentralizedApprovalService; equinePlatform?: EquineIntelligencePlatform; assetRegistry?: RacetrackAssetRegistryService; twinRuntime?: DigitalTwinRuntime; workflow?: WorkflowOrchestrationEngine } = {}) {
    this.eventBus = deps.eventBus ?? new UniversalEventBus();
    this.auditLog = deps.auditLog ?? new ImmutableAuditLog();
    this.approvals = deps.approvals ?? new CentralizedApprovalService({ auditLog: this.auditLog, eventBus: this.eventBus });
    this.equinePlatform = deps.equinePlatform;
    this.assetRegistry = deps.assetRegistry;
    this.twinRuntime = deps.twinRuntime;
    this.workflow = deps.workflow;
    this.registerEventContracts();
    this.registerWorkflowTemplates();
  }

  createBarn(actor: BarnActor, barn: Barn, stalls: Array<Omit<Stall, 'barnId'|'status'|'restrictionIds'|'occupancyHorseId'>>): Barn {
    this.require(actor, 'barn:manage');
    this.requireTenant(actor, barn.tenantId);
    if (stalls.length > barn.capacity) throw new Error('barn capacity cannot be lower than stall count');
    const normalized: Barn = { ...clone(barn), incidentIds: [...barn.incidentIds], trainerIds: [...barn.trainerIds] };
    this.barns.set(normalized.id, normalized);
    for (const stall of stalls) this.stalls.set(stall.id, { ...clone(stall), barnId: normalized.id, status: 'available', restrictionIds: [] });
    const audit = this.audit('barn.created', actor, normalized.id, { barn: normalized, stallIds: stalls.map((stall) => stall.id) }, 'data-change');
    const event = this.publish('barn.created', { barn: normalized, stalls: stalls.map((stall) => ({ ...stall, barnId: normalized.id })), auditId: audit.id }, normalized.id, 'regulated', 'track-superintendent');
    this.syncBarnAndStallAssets(actor, normalized, audit.id, event.id);
    this.evaluateAndPublishReadiness(normalized.id, actor, 'barn.created');
    return clone(normalized);
  }

  assignHorse(input: { actor: BarnActor; horseId: string; barnId: string; stallId: string; assignedAt: string; reason: string; approvalToken?: ApprovalToken }): HorseOccupancy {
    this.require(input.actor, 'stall:assign');
    const barn = this.requireBarn(input.barnId, input.actor);
    const stall = this.requireAssignable(input.stallId, Boolean(input.approvalToken));
    if (input.barnId !== stall.barnId) throw new Error('stall does not belong to barn');
    const previous = this.occupancy.get(input.horseId);
    const approvalTarget = this.approvalTargetForAssignment(input.horseId, barn, stall, previous);
    if (approvalTarget) this.assertSafetyApproval(input.approvalToken, approvalTarget, input.actor, input.assignedAt);
    if (previous?.stallId === input.stallId) return clone(previous);
    if ([...this.occupancy.values()].some((o) => o.stallId === input.stallId && o.horseId !== input.horseId)) throw new Error('stall already occupied');
    if (previous) this.releaseStall(previous.stallId);

    const nextStall: Stall = { ...stall, status: 'occupied', occupancyHorseId: input.horseId };
    this.stalls.set(nextStall.id, nextStall);
    const audit = this.audit('stall.assignment.changed', input.actor, input.horseId, { ...input, previous, approvalRequired: Boolean(approvalTarget) }, 'data-change', approvalTarget ? 'critical' : 'warning');
    const event = this.publish('barn.horse.assigned', { horseId: input.horseId, barnId: input.barnId, stallId: input.stallId, previous, reason: input.reason, auditId: audit.id, approvalRequestId: input.approvalToken?.requestId }, input.horseId, approvalTarget ? 'restricted' : 'regulated', 'racing-secretary');
    const occ: HorseOccupancy = { horseId: input.horseId, barnId: input.barnId, stallId: input.stallId, assignedAt: input.assignedAt, assignedBy: input.actor.id, eventId: 'barn.horse.assigned', auditId: audit.id, twinId: `equine:${input.horseId}`, approvalRequestId: input.approvalToken?.requestId };
    this.occupancy.set(input.horseId, occ);
    this.syncEquineAssignment(input, occ, audit.id, event.id);
    this.evaluateAndPublishReadiness(input.barnId, input.actor, 'barn.horse.assigned');
    return clone(occ);
  }

  moveHorse(input: { actor: BarnActor; horseId: string; toBarnId: string; toStallId: string; reason: string; movedAt: string; approvalToken?: ApprovalToken }): HorseMovementRecord {
    this.require(input.actor, 'movement:record');
    const before = this.occupancy.get(input.horseId);
    const occ = this.assignHorse({ actor: input.actor, horseId: input.horseId, barnId: input.toBarnId, stallId: input.toStallId, reason: input.reason, assignedAt: input.movedAt, approvalToken: input.approvalToken });
    const restrictedMove = Boolean(input.approvalToken?.requestId);
    const audit = this.audit('horse.movement.recorded', input.actor, input.horseId, { ...input, before, occupancy: occ, restrictedMove }, 'data-change', restrictedMove ? 'critical' : 'warning');
    this.publish('barn.horse.moved', { horseId: input.horseId, from: before, to: occ, reason: input.reason, auditId: audit.id, approvalRequestId: input.approvalToken?.requestId }, input.horseId, restrictedMove ? 'restricted' : 'regulated', 'racing-secretary');
    const rec: HorseMovementRecord = { id: id('movement'), horseId: input.horseId, fromBarnId: before?.barnId, fromStallId: before?.stallId, toBarnId: input.toBarnId, toStallId: input.toStallId, reason: input.reason, movedAt: input.movedAt, movedBy: input.actor.id, eventId: 'barn.horse.moved', auditId: audit.id, approvalRequestId: input.approvalToken?.requestId };
    this.movements.push(rec);
    this.startRestrictedWorkflowIfNeeded(input.actor, rec, restrictedMove);
    return clone(rec);
  }

  recordAccess(input: { actor: BarnActor; barnId: string; purpose: string; at: string; decision?: 'allowed' | 'denied'; approvalToken?: ApprovalToken }): BarnAccessRecord {
    this.require(input.actor, 'access:record');
    const barn = this.requireBarn(input.barnId, input.actor);
    const decision = input.decision ?? 'allowed';
    const restrictedAccess = decision === 'allowed' && (barn.status === 'restricted' || barn.status === 'closed' || this.restrictions.some((r) => r.active && r.barnId === barn.id && r.type === 'security'));
    if (restrictedAccess) this.assertSafetyApproval(input.approvalToken, barn.id, input.actor, input.at);
    const audit = this.audit('barn.access.recorded', input.actor, input.barnId, { ...input, decision, restrictedAccess }, 'security-event', restrictedAccess ? 'critical' : 'warning');
    this.publish('barn.access.recorded', { ...input, decision, auditId: audit.id, approvalRequestId: input.approvalToken?.requestId }, input.barnId, restrictedAccess ? 'restricted' : 'regulated', 'security');
    const rec: BarnAccessRecord = { id: id('access'), barnId: input.barnId, actorId: input.actor.id, purpose: input.purpose, accessAt: input.at, decision, eventId: 'barn.access.recorded', auditId: audit.id, approvalRequestId: input.approvalToken?.requestId };
    this.access.push(rec);
    return clone(rec);
  }

  inspect(input: { actor: BarnActor; barnId: string; score: number; findings: string[]; at: string }): BarnInspection {
    this.require(input.actor, 'inspection:perform');
    if (input.score < 0 || input.score > 100) throw new Error('inspection score must be between 0 and 100');
    const barn = this.requireBarn(input.barnId, input.actor);
    const status: BarnStatus = input.score < 60 ? 'restricted' : input.score < 80 ? 'watch' : 'ready';
    const nextBarn = { ...barn, status };
    this.barns.set(input.barnId, nextBarn);
    const audit = this.audit('barn.inspected', input.actor, input.barnId, input, 'data-change', status === 'restricted' ? 'critical' : 'warning');
    this.publish('barn.inspected', { ...input, status, auditId: audit.id }, input.barnId, 'regulated', 'track-superintendent');
    const rec: BarnInspection = { id: id('inspection'), barnId: input.barnId, inspectedBy: input.actor.id, inspectedAt: input.at, score: input.score, findings: [...input.findings], status, eventId: 'barn.inspected', auditId: audit.id };
    this.inspections.push(rec);
    this.syncBarnAndStallAssets(input.actor, nextBarn, audit.id, rec.eventId);
    this.evaluateAndPublishReadiness(input.barnId, input.actor, 'barn.inspected');
    return clone(rec);
  }

  createRestriction(input: { actor: BarnActor; barnId: string; stallId?: string; horseId?: string; type: BarnRestriction['type']; reason: string; at: string; approvalToken?: ApprovalToken }): BarnRestriction {
    this.require(input.actor, 'restriction:manage');
    const barn = this.requireBarn(input.barnId, input.actor);
    if (input.stallId) {
      const stall = this.stalls.get(input.stallId);
      if (!stall || stall.barnId !== barn.id) throw new Error('stall does not belong to barn');
    }
    const target = input.stallId ?? input.horseId ?? input.barnId;
    if (input.type !== 'maintenance') this.assertSafetyApproval(input.approvalToken, target, input.actor, input.at);
    const audit = this.audit('barn.restriction.created', input.actor, target, input, 'data-change', input.type === 'maintenance' ? 'warning' : 'critical');
    this.publish('barn.restriction.created', { ...input, auditId: audit.id, approvalRequestId: input.approvalToken?.requestId }, target, input.type === 'maintenance' ? 'regulated' : 'restricted', 'compliance-officer');
    const rec: BarnRestriction = { id: id('restriction'), active: true, createdBy: input.actor.id, createdAt: input.at, eventId: 'barn.restriction.created', auditId: audit.id, approvalRequestId: input.approvalToken?.requestId, barnId: input.barnId, stallId: input.stallId, horseId: input.horseId, type: input.type, reason: input.reason };
    this.restrictions.push(rec);
    if (input.stallId) {
      const stall = this.stalls.get(input.stallId)!;
      this.stalls.set(input.stallId, { ...stall, status: input.type === 'maintenance' ? 'maintenance' : 'restricted', restrictionIds: [...new Set([...stall.restrictionIds, rec.id])] });
    } else if (input.type !== 'maintenance') {
      this.barns.set(input.barnId, { ...barn, status: 'restricted' });
    }
    this.syncBarnAndStallAssets(input.actor, this.barns.get(input.barnId)!, audit.id, rec.eventId);
    this.evaluateAndPublishReadiness(input.barnId, input.actor, 'barn.restriction.created');
    return clone(rec);
  }

  assignTrainer(input: { actor: BarnActor; barnId: string; trainerId: string; at: string; approvalToken?: ApprovalToken }): BarnTrainerAssignment {
    this.require(input.actor, 'barn:manage');
    const barn = this.requireBarn(input.barnId, input.actor);
    if (barn.status === 'restricted' || barn.status === 'closed') this.assertSafetyApproval(input.approvalToken, barn.id, input.actor, input.at);
    const nextBarn = { ...barn, trainerIds: [...new Set([...barn.trainerIds, input.trainerId])] };
    this.barns.set(input.barnId, nextBarn);
    const audit = this.audit('barn.trainer.assigned', input.actor, input.barnId, input, 'data-change', input.approvalToken ? 'critical' : 'warning');
    this.publish('barn.trainer.assigned', { ...input, auditId: audit.id, approvalRequestId: input.approvalToken?.requestId }, input.barnId, input.approvalToken ? 'restricted' : 'regulated', 'racing-secretary');
    const rec: BarnTrainerAssignment = { id: id('trainer'), barnId: input.barnId, trainerId: input.trainerId, assignedBy: input.actor.id, assignedAt: input.at, active: true, auditId: audit.id, eventId: 'barn.trainer.assigned', approvalRequestId: input.approvalToken?.requestId };
    this.trainers.push(rec);
    this.syncBarnAndStallAssets(input.actor, nextBarn, audit.id, rec.eventId);
    return clone(rec);
  }

  recordVeterinaryVisit(input: { actor: BarnActor; horseId: string; findings: string[]; at: string }): VeterinaryVisitRecord {
    this.require(input.actor, 'vet:record');
    const occ = this.occupancy.get(input.horseId);
    if (!occ) throw new Error('horse is not assigned to a stall');
    const audit = this.audit('barn.veterinary-visit.recorded', input.actor, input.horseId, input, 'data-change', 'warning');
    this.publish('barn.veterinary-visit.recorded', { ...input, occupancy: occ, auditId: audit.id }, input.horseId, 'restricted', 'veterinarian');
    const rec: VeterinaryVisitRecord = { id: id('vet'), horseId: input.horseId, barnId: occ.barnId, stallId: occ.stallId, veterinarianId: input.actor.id, visitAt: input.at, findings: [...input.findings], restrictionsCreated: [], eventId: 'barn.veterinary-visit.recorded', auditId: audit.id };
    this.vetVisits.push(rec);
    this.patchTwin(occ, { latestVeterinaryVisitAt: input.at, veterinaryFindingsCount: input.findings.length }, input.actor, audit.id, rec.eventId);
    return clone(rec);
  }

  readiness(): BarnReadiness[] {
    return [...this.barns.values()].map((barn) => {
      const activeRestrictions = this.restrictions.filter((restriction) => restriction.active && restriction.barnId === barn.id);
      const occupied = [...this.occupancy.values()].filter((item) => item.barnId === barn.id).length;
      const latestInspection = this.inspections.filter((item) => item.barnId === barn.id).sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt))[0];
      const capacityPressure = occupied > barn.capacity ? 30 : occupied === barn.capacity ? 5 : 0;
      const score = Math.max(0, Math.min(100, (latestInspection?.score ?? 92) - activeRestrictions.length * 20 - capacityPressure - (barn.status === 'watch' ? 10 : 0) - (barn.status === 'restricted' ? 35 : 0) - (barn.status === 'closed' ? 100 : 0)));
      return { barnId: barn.id, status: score < 70 ? 'restricted' : score < 85 ? 'watch' : 'ready', score, blockers: activeRestrictions.map((restriction) => restriction.reason), openRestrictions: activeRestrictions.length, occupiedStalls: occupied, capacity: barn.capacity };
    });
  }

  facilityReadiness(): BarnFacilityReadiness[] {
    return this.readiness().map((item) => {
      const latestInspection = this.inspections.filter((inspection) => inspection.barnId === item.barnId).sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt))[0];
      const assetIds = [...this.assetLinks.values()].filter((link) => link.barnId === item.barnId).map((link) => link.assetId);
      const twinIds = [...new Set([
        ...[...this.occupancy.values()].filter((occ) => occ.barnId === item.barnId).map((occ) => occ.twinId),
        ...this.twinSync.filter((sync) => sync.barnId === item.barnId).map((sync) => sync.twinId),
      ])];
      const workflow = [...this.workflows].reverse().find((instance) => instance.context.payload.barnId === item.barnId);
      return { ...item, inspectionStatus: latestInspection ? 'current' : 'missing', approvalRequired: item.openRestrictions > 0 || item.status !== 'ready', workflowStatus: workflow?.status ?? 'not-started', twinIds, assetIds };
    });
  }

  dashboard(): BarnDashboardSummary {
    const stalls = [...this.stalls.values()];
    const readiness = this.readiness();
    const occupiedStalls = stalls.filter((stall) => stall.status === 'occupied').length;
    const restrictedStalls = stalls.filter((stall) => stall.status === 'restricted').length;
    const maintenanceStalls = stalls.filter((stall) => stall.status === 'maintenance').length;
    const statuses = readiness.map((item) => item.status);
    return {
      totalBarns: this.barns.size,
      totalStalls: stalls.length,
      occupiedStalls,
      availableStalls: stalls.filter((stall) => stall.status === 'available').length,
      restrictedStalls,
      maintenanceStalls,
      occupancyRate: stalls.length ? Math.round((occupiedStalls / stalls.length) * 100) : 0,
      readinessStatus: statuses.includes('restricted') ? 'restricted' : statuses.includes('watch') ? 'watch' : 'ready',
      openRestrictions: this.restrictions.filter((restriction) => restriction.active).length,
      pendingApprovals: this.approvals.allRequests().filter((request) => request.action === 'safety-critical-control' && ['pending', 'escalated'].includes(request.status)).length,
      eventCount: this.eventBus.events().filter((event) => String(event.type).startsWith('barn.') || event.type === 'digital-twin.state.patch').length,
      auditRecordCount: this.auditLog.all().filter((entry) => String((entry.payload as { action?: unknown }).action ?? '').startsWith('barn.') || String((entry.payload as { action?: unknown }).action ?? '').includes('movement')).length,
      twinSyncCount: this.twinSync.length,
      assetCount: this.assetLinks.size,
      latestMovementAt: this.movements.map((movement) => movement.movedAt).sort().at(-1),
    };
  }

  approvalQueue(): ControlledActionRequest[] {
    return this.approvals.allRequests().filter((request) => request.action === 'safety-critical-control' && (this.barns.has(request.target) || this.stalls.has(request.target) || this.occupancy.has(request.target)));
  }

  snapshot() {
    return clone({
      barns: [...this.barns.values()],
      stalls: [...this.stalls.values()],
      occupancy: [...this.occupancy.values()],
      movements: this.movements,
      access: this.access,
      inspections: this.inspections,
      restrictions: this.restrictions,
      trainers: this.trainers,
      vetVisits: this.vetVisits,
      readiness: this.readiness(),
      facilityReadiness: this.facilityReadiness(),
      dashboard: this.dashboard(),
      assetLinks: [...this.assetLinks.values()],
      twinSync: this.twinSync,
      approvalRequests: this.approvalQueue(),
      events: this.eventBus.events().filter((event) => String(event.type).startsWith('barn.') || event.type === 'digital-twin.state.patch'),
      integrationSignals: this.integrationSignals,
      mock: false,
    });
  }

  private require(actor: BarnActor, permission: BarnPermission) {
    if (!actor.roles.some((role) => rolePermissions[role]?.includes(permission))) throw new Error(`Actor lacks ${permission}`);
  }

  private requireTenant(actor: BarnActor, tenantId: string): void {
    if (actor.tenantId !== tenantId) throw new Error('Tenant boundary violation');
  }

  private requireBarn(barnId: string, actor?: BarnActor): Barn {
    const barn = this.barns.get(barnId);
    if (!barn) throw new Error(`Unknown barn ${barnId}`);
    if (actor) this.requireTenant(actor, barn.tenantId);
    return clone(barn);
  }

  private requireAssignable(stallId: string, _approvalOverride: boolean): Stall {
    const stall = this.stalls.get(stallId);
    if (!stall) throw new Error(`Unknown stall ${stallId}`);
    return { ...stall, restrictionIds: [...stall.restrictionIds] };
  }

  private releaseStall(stallId: string): void {
    const current = this.stalls.get(stallId);
    if (!current) return;
    const hasRestriction = this.restrictions.some((restriction) => restriction.active && restriction.stallId === stallId);
    const maintenance = this.restrictions.some((restriction) => restriction.active && restriction.stallId === stallId && restriction.type === 'maintenance');
    this.stalls.set(stallId, { ...current, status: maintenance ? 'maintenance' : hasRestriction ? 'restricted' : 'available', occupancyHorseId: undefined });
  }

  private approvalTargetForAssignment(horseId: string, barn: Barn, stall: Stall, previous?: HorseOccupancy): string | undefined {
    if (barn.status === 'restricted' || barn.status === 'closed') return barn.id;
    if (stall.status === 'restricted' || stall.status === 'maintenance') return stall.id;
    const active = this.restrictions.find((restriction) => restriction.active && (restriction.stallId === stall.id || restriction.horseId === horseId || restriction.barnId === barn.id || restriction.stallId === previous?.stallId));
    return active?.stallId ?? active?.horseId ?? active?.barnId;
  }

  private assertSafetyApproval(token: ApprovalToken | undefined, target: string, actor: BarnActor, at: string): void {
    this.approvals.assertAuthorized(token, 'safety-critical-control', target, actor.tenantId, at);
  }

  private audit(action: string, actor: BarnActor, subjectId: string, payload: unknown, type: AuditEventType, severity: AuditSeverity = 'warning') {
    return this.auditLog.append({ id: id('audit-barn'), type, actor: actor.id, timestamp: new Date().toISOString(), subjectId, tenantId: actor.tenantId, payload: { action, ...(payload && typeof payload === 'object' ? payload as Record<string, unknown> : { value: payload }) }, severity, regulations: ['HISA', 'ARCI'] });
  }

  private publish(type: BarnEventType, payload: Record<string, unknown>, aggregateId: string, compliance: ComplianceClassification, accountableRole: string): Pick<RaceDayEvent, 'id'> {
    const pending = { id: id('evt-barn') };
    void this.eventBus.publish({ type, payload, aggregateId, producer: 'barn-operations', metadata: { compliance, team: 'barn-operations', accountableRole } });
    return pending;
  }

  private registerEventContracts(): void {
    for (const type of barnEvents) {
      this.eventBus.registerEvent({
        type,
        version: 1,
        description: `Barn Operations ${type}`,
        owner: { service: 'barn-operations', team: 'barn-operations', accountableRole: type.includes('access') ? 'security' : type.includes('veterinary') ? 'veterinarian' : 'track-superintendent' },
        payloadFields: [],
        compliance: type.includes('restriction') || type.includes('access') ? 'restricted' : 'regulated',
      });
    }
  }

  private registerWorkflowTemplates(): void {
    if (!this.workflow) return;
    this.workflow.register(barnRestrictedMoveWorkflow('tenant-1'));
  }

  private syncBarnAndStallAssets(actor: BarnActor, barn: Barn, auditId: string, eventId: string): void {
    const assets = [this.barnAsset(barn), ...[...this.stalls.values()].filter((stall) => stall.barnId === barn.id).map((stall) => this.stallAsset(barn, stall))];
    for (const asset of assets) this.syncAsset(asset, actor, auditId, eventId, asset.assetId === `barn:${barn.id}` ? undefined : String(asset.metadata.stallId));
    this.publish('barn.asset.synced', { barnId: barn.id, assetIds: assets.map((asset) => asset.assetId), auditId }, barn.id, 'regulated', 'asset-registry-owner');
  }

  private syncAsset(asset: RegistryAsset, actor: BarnActor, auditId: string, eventId: string, stallId?: string): void {
    const link: BarnAssetLink = { assetId: asset.assetId, barnId: String(asset.metadata.barnId), stallId, twinId: asset.digitalTwin?.twinId ?? `twin:${asset.assetId}`, registryStatus: 'pending', riskLevel: asset.riskLevel, eventId, auditId };
    this.assetLinks.set(asset.assetId, link);
    if (this.twinRuntime) this.safeIntegration('digital-twin-runtime', asset.assetId, () => { this.twinRuntime!.registerAsset(asset, actor.id, eventId); });
    if (this.assetRegistry) {
      const principal = this.assetPrincipal(actor);
      const input = { ...asset, assetId: asset.assetId, tenantId: asset.tenantId, lifecycleStatus: 'draft' as const };
      void this.assetRegistry.create(input, principal).then(() => {
        this.assetLinks.set(asset.assetId, { ...link, registryStatus: 'synced' });
        this.integrationSignals.push({ id: id('integration'), service: 'asset-registry', status: 'synced', message: 'barn asset registered', subjectId: asset.assetId, at: new Date().toISOString() });
      }).catch(() => {
        void this.assetRegistry!.update(asset.assetId, input, principal).then(() => {
          this.assetLinks.set(asset.assetId, { ...link, registryStatus: 'synced' });
          this.integrationSignals.push({ id: id('integration'), service: 'asset-registry', status: 'synced', message: 'barn asset updated', subjectId: asset.assetId, at: new Date().toISOString() });
        }).catch((error) => this.integrationSignals.push({ id: id('integration'), service: 'asset-registry', status: 'failed', message: error instanceof Error ? error.message : String(error), subjectId: asset.assetId, at: new Date().toISOString() }));
      });
    }
  }

  private syncEquineAssignment(input: { actor: BarnActor; horseId: string; barnId: string; stallId: string; assignedAt: string; reason: string; approvalToken?: ApprovalToken }, occ: HorseOccupancy, auditId: string, eventId: string): void {
    if (this.equinePlatform) {
      this.safeIntegration('equine-intelligence', input.horseId, () => {
        this.equinePlatform!.assignBarn(input.horseId, { barnId: input.barnId, stallId: input.stallId, assignedAt: input.assignedAt, assignedBy: input.actor.id, evidence: [auditId, eventId, input.reason] }, this.equineActor(input.actor));
      });
    }
    this.patchTwin(occ, { barnId: input.barnId, stallId: input.stallId, occupancyStatus: 'stabled', assignedAt: input.assignedAt, assignedBy: input.actor.id, approvalRequestId: input.approvalToken?.requestId }, input.actor, auditId, eventId);
  }

  private patchTwin(occ: HorseOccupancy, patch: Record<string, unknown>, actor: BarnActor, auditId: string, eventId: string): void {
    const sync: BarnTwinSyncRecord = { twinId: occ.twinId, horseId: occ.horseId, barnId: occ.barnId, stallId: occ.stallId, status: 'queued', patch, eventId: 'digital-twin.state.patch', auditId };
    this.twinSync.push(sync);
    if (this.twinRuntime) {
      this.safeIntegration('digital-twin-runtime', occ.twinId, () => {
        this.ensureHorseTwin(occ, actor, eventId);
        const twin = this.twinRuntime!.updateState({ twinId: occ.twinId, patch, actor: actor.id, observedAt: new Date().toISOString(), sourceEventId: eventId });
        sync.status = twin.health === 'critical' ? 'failed' : 'synced';
      }, () => { sync.status = 'failed'; });
    }
    this.publish('digital-twin.state.patch', { twinId: occ.twinId, patch, actor: actor.id, observedAt: new Date().toISOString(), auditId }, occ.twinId, 'regulated', 'digital-twin-owner');
  }

  private ensureHorseTwin(occ: HorseOccupancy, actor: BarnActor, eventId: string): DigitalTwinRuntimeTwin | undefined {
    if (!this.twinRuntime) return undefined;
    try {
      return this.twinRuntime.getTwin(occ.twinId);
    } catch {
      return this.twinRuntime.registerAsset(this.horseOccupancyAsset(occ, actor.tenantId), actor.id, eventId);
    }
  }

  private evaluateAndPublishReadiness(barnId: string, actor: BarnActor, reason: string): void {
    const readiness = this.readiness().find((item) => item.barnId === barnId);
    if (!readiness) return;
    this.publish('barn.facility-readiness.evaluated', { readiness, reason }, barnId, readiness.status === 'restricted' ? 'restricted' : 'regulated', 'track-superintendent');
  }

  private startRestrictedWorkflowIfNeeded(actor: BarnActor, movement: HorseMovementRecord, restricted: boolean): void {
    if (!restricted || !this.workflow) return;
    try {
      const instance = this.workflow.start('barn-restricted-move', { tenantId: actor.tenantId, priority: 'high', digitalTwinRefs: [`equine:${movement.horseId}`], payload: { barnId: movement.toBarnId, movementId: movement.id, approvalRequestId: movement.approvalRequestId } }, actor.id, movement.movedAt);
      this.workflows.push(instance);
      this.integrationSignals.push({ id: id('integration'), service: 'workflow', status: 'synced', message: 'restricted move workflow started', subjectId: movement.id, at: movement.movedAt });
    } catch (error) {
      this.integrationSignals.push({ id: id('integration'), service: 'workflow', status: 'failed', message: error instanceof Error ? error.message : String(error), subjectId: movement.id, at: new Date().toISOString() });
    }
  }

  private safeIntegration(service: BarnIntegrationSignal['service'], subjectId: string, fn: () => void, onError?: () => void): void {
    try {
      fn();
      this.integrationSignals.push({ id: id('integration'), service, status: 'synced', message: 'integration synchronized', subjectId, at: new Date().toISOString() });
    } catch (error) {
      onError?.();
      this.integrationSignals.push({ id: id('integration'), service, status: 'failed', message: error instanceof Error ? error.message : String(error), subjectId, at: new Date().toISOString() });
    }
  }

  private assetPrincipal(actor: BarnActor): AssetPrincipal {
    return { id: actor.id, tenantId: actor.tenantId, scopes: ['assets:read', 'assets:write', 'assets:approve'], roles: actor.roles };
  }

  private equineActor(actor: BarnActor): EquineActor {
    const mapped = actor.roles.filter((role) => (equineRoles as readonly string[]).includes(role)) as EquineActor['roles'];
    return { id: actor.id, tenantId: actor.tenantId, human: actor.human ?? true, roles: mapped.length ? mapped : ['racing-secretary'] };
  }

  private barnAsset(barn: Barn): RegistryAsset {
    const now = new Date().toISOString();
    return this.registryAsset({ assetId: `barn:${barn.id}`, tenantId: barn.tenantId, name: barn.name, assetType: 'Barn', domain: 'facilities', riskLevel: barn.status === 'restricted' || barn.status === 'closed' ? 'high' : 'medium', location: { barnId: barn.id, name: barn.name, description: barn.location }, state: { status: barn.status, capacity: barn.capacity, occupiedStalls: [...this.occupancy.values()].filter((occ) => occ.barnId === barn.id).length, incidentIds: barn.incidentIds, trainerIds: barn.trainerIds }, tags: ['barn', 'barn-operations', barn.status], metadata: { barnId: barn.id }, twinId: `barn:${barn.id}`, now });
  }

  private stallAsset(barn: Barn, stall: Stall): RegistryAsset {
    const now = new Date().toISOString();
    const riskLevel: AssetRiskLevel = stall.status === 'restricted' || stall.status === 'maintenance' ? 'high' : 'low';
    return this.registryAsset({ assetId: `stall:${stall.id}`, tenantId: barn.tenantId, name: `${barn.name} Stall ${stall.label}`, assetType: 'Stall', domain: 'facilities', riskLevel, location: { barnId: barn.id, stallId: stall.id, label: stall.label }, state: { status: stall.status, occupancyHorseId: stall.occupancyHorseId, restrictionIds: stall.restrictionIds }, tags: ['barn', 'stall', stall.status], metadata: { barnId: barn.id, stallId: stall.id }, twinId: `stall:${stall.id}`, now });
  }

  private horseOccupancyAsset(occ: HorseOccupancy, tenantId: string): RegistryAsset {
    const now = new Date().toISOString();
    return this.registryAsset({ assetId: `horse:${occ.horseId}:occupancy`, tenantId, name: `Horse ${occ.horseId} barn occupancy`, assetType: 'EquineOccupancy', domain: 'safety', riskLevel: 'medium', location: { barnId: occ.barnId, stallId: occ.stallId }, state: { horseId: occ.horseId, barnId: occ.barnId, stallId: occ.stallId, assignedAt: occ.assignedAt }, tags: ['equine', 'barn-occupancy'], metadata: { barnId: occ.barnId, stallId: occ.stallId, horseId: occ.horseId }, twinId: occ.twinId, now, ownerAgent: 'EquineSafety' });
  }

  private registryAsset(input: { assetId: string; tenantId: string; name: string; assetType: string; domain: AssetDomain; riskLevel: AssetRiskLevel; location: Record<string, unknown>; state: Record<string, unknown>; tags: string[]; metadata: Record<string, unknown>; twinId: string; now: string; ownerAgent?: ExpertDomain }): RegistryAsset {
    const controls: ControlDefinition[] = [{ name: 'safety-critical-barn-control', category: 'C_HUMAN_CONTROLLED', description: 'Restricted barn, stall, horse movement, and assignment changes require authorized human approval.', requiresApprovalFrom: ['TrackSuperintendent', 'Steward'], protectedAction: 'safety-critical-control', executionMode: 'human-only' }];
    const regulations: RegulationDefinition[] = [
      { authority: 'HISA', reference: 'Horse welfare and controlled medication environment records', appliesTo: ['barn-operations'] },
      { authority: 'TrackPolicy', reference: 'Backstretch barn access, inspection, and stabling policy', appliesTo: ['barn-operations'] },
    ];
    return {
      assetId: input.assetId,
      tenantId: input.tenantId,
      externalIds: [input.assetId],
      name: input.name,
      assetClass: input.assetType === 'EquineOccupancy' ? 'biological' : 'physical',
      assetType: input.assetType,
      domain: input.domain,
      lifecycleStatus: 'active',
      riskLevel: input.riskLevel,
      safetyCritical: true,
      maintenance: { status: String(input.state.status) === 'maintenance' ? 'due' : 'ok', lastInspectionAt: this.inspections.filter((inspection) => inspection.barnId === input.metadata.barnId).sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt))[0]?.inspectedAt },
      maintenanceHistory: [],
      ownership: { ownerAgent: input.ownerAgent ?? 'FacilitiesIoT', stewardTeam: 'Barn Operations' },
      location: input.location,
      state: input.state,
      controls,
      sensors: [],
      telemetryBindings: [],
      regulations,
      complianceMappings: regulations.map((regulation) => ({ framework: regulation.authority, controlId: 'barn-operations-controlled-movement', obligation: regulation.reference, evidenceRefs: ['barn-operations-audit'] })),
      lifecycleHistory: [{ status: 'active', changedAt: input.now, changedBy: 'barn-operations', reason: 'barn operations registry synchronization' }],
      riskAssessments: [{ level: input.riskLevel, assessedAt: input.now, assessedBy: 'barn-operations', rationale: 'Barn, stall, and equine occupancy records are safety-critical operational assets.', safetyCritical: true, approvalRequired: input.riskLevel === 'high' || input.riskLevel === 'critical', evidence: ['barn-operations-state'] }],
      tags: input.tags,
      digitalTwin: { twinId: input.twinId, relationship: 'represents' },
      approvalPolicyId: input.riskLevel === 'high' || input.riskLevel === 'critical' ? 'critical-asset-dual-control' : 'standard-asset-approval',
      createdAt: input.now,
      updatedAt: input.now,
      version: 1,
      metadata: input.metadata,
    };
  }
}

export function barnRestrictedMoveWorkflow(tenantId: string): WorkflowDefinition {
  return {
    id: 'barn-restricted-move',
    name: 'Restricted Barn Movement Review',
    domain: 'veterinary',
    version: '1.0.0',
    bpmnProcessId: 'Process_BarnRestrictedMove',
    startStepId: 'verify-approval',
    ownerRole: 'track-superintendent',
    tenantId,
    triggerEvents: ['barn.horse.moved', 'barn.restriction.created'],
    steps: [
      { id: 'verify-approval', name: 'Verify safety-critical approval evidence', type: 'approvalTask', role: 'track-superintendent', approvalRoles: ['track-superintendent'], requiredApprovals: 1, sla: { minutes: 10, escalationRole: 'admin', severity: 'critical' }, digitalTwin: { refs: ['equine:restricted-move'], syncMode: 'read', statePatch: {} }, next: ['notify-care-team'] },
      { id: 'notify-care-team', name: 'Notify trainer, security, and veterinary care team', type: 'serviceTask', action: (context) => ({ notifications: ['trainer', 'security', 'veterinary'], movementId: context.payload.movementId }), next: ['closed'] },
      { id: 'closed', name: 'Restricted barn movement review closed', type: 'endEvent' },
    ],
  };
}

export function createSeededBarnOperationsService(): CoordinatedBarnOperationsService {
  const eventBus = new UniversalEventBus();
  const auditLog = new ImmutableAuditLog();
  const twinRuntime = new DigitalTwinRuntime({ eventBus, auditLog });
  const service = new CoordinatedBarnOperationsService({ eventBus, auditLog, twinRuntime });
  const actor = { id: 'ops-admin', roles: ['admin'] as Role[], tenantId: 'tenant-1', human: true };
  service.createBarn(actor, { id: 'barn-2', name: 'Barn 2', tenantId: 'tenant-1', location: 'Backstretch', status: 'ready', capacity: 3, incidentIds: ['incident-credential-1'], trainerIds: ['trainer-1'] }, [{ id: 'stall-12A', label: '12A' }, { id: 'stall-12B', label: '12B' }, { id: 'stall-12C', label: '12C' }]);
  service.assignHorse({ actor, horseId: 'horse-1', barnId: 'barn-2', stallId: 'stall-12A', assignedAt: '2026-06-13T00:00:00.000Z', reason: 'race-day stabling' });
  service.assignTrainer({ actor, barnId: 'barn-2', trainerId: 'trainer-1', at: '2026-06-13T00:01:00.000Z' });
  service.inspect({ actor, barnId: 'barn-2', score: 88, findings: ['aisles clear', 'water available'], at: '2026-06-13T00:02:00.000Z' });
  service.recordAccess({ actor: { id: 'security-1', roles: ['security'], tenantId: 'tenant-1', human: true }, barnId: 'barn-2', purpose: 'credential patrol', at: '2026-06-13T00:03:00.000Z' });
  return service;
}
