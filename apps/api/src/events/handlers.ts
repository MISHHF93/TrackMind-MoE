import { eventCategoryFor, type CqrsCommand, type EventEnvelope } from './definitions.js';
import { EventSourcedStore } from './eventStore.js';
import { CqrsProjectionRebuilder, type CqrsProjectionState } from './projections.js';
import { evaluateSafetyCriticalGovernance } from '../compliance/governanceRules.js';

export interface CommandHandlingResult {
  accepted: boolean;
  event?: EventEnvelope;
  projection?: CqrsProjectionState;
  blockedReason?: string;
}

export interface RaceStartCommandBody {
  raceId: string;
  starterId: string;
  gateId?: string;
  approval_id?: string;
  approver_id?: string;
  approval_timestamp?: string;
  model_id?: string;
  confidence?: number;
  evidence_links?: string[];
  annex_iv_uri?: string;
}

export interface SafetyCriticalCommandBody extends RaceStartCommandBody {
  horseId?: string;
  medication?: string;
  dose?: string;
  reason?: string;
  stoppedAt?: string;
  administeredAt?: string;
  scratchedAt?: string;
}

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

export class CqrsCommandHandler {
  constructor(private readonly store = new EventSourcedStore(), private readonly projections = new CqrsProjectionRebuilder()) {}

  async handle<TPayload extends Record<string, unknown>>(command: CqrsCommand<TPayload>): Promise<CommandHandlingResult> {
    const governance = this.validateGovernance(command);
    if (!governance.accepted) return governance;
    const event = await this.store.append(command);
    const projection = this.projections.rebuild(this.store.all());
    return { accepted: true, event, projection };
  }

  async startRace(raceId: string, body: RaceStartCommandBody, context: { tenantId?: string; racetrackId?: string; actorId?: string } = {}): Promise<CommandHandlingResult> {
    return this.handle({
      id: id('cmd-race-start'),
      type: 'race_start',
      aggregateId: raceId,
      tenantId: context.tenantId ?? 'trackmind',
      racetrackId: context.racetrackId ?? 'main-track',
      actorId: context.actorId ?? body.starterId,
      approvalRequired: true,
      approvalId: body.approval_id,
      approverId: body.approver_id,
      approvalTimestamp: body.approval_timestamp,
      ai: { model_id: body.model_id, confidence: body.confidence, evidence_links: body.evidence_links ?? [], annex_iv_uri: body.annex_iv_uri },
      payload: { raceId, startedAt: body.approval_timestamp ?? new Date().toISOString(), starterId: body.starterId, gateId: body.gateId },
    });
  }

  async stopRace(raceId: string, body: SafetyCriticalCommandBody, context: { tenantId?: string; racetrackId?: string; actorId?: string } = {}): Promise<CommandHandlingResult> {
    return this.handle({
      id: id('cmd-race-stop'),
      type: 'race_stop',
      aggregateId: raceId,
      tenantId: context.tenantId ?? 'trackmind',
      racetrackId: context.racetrackId ?? 'main-track',
      actorId: context.actorId ?? body.starterId ?? 'race-control',
      approvalRequired: true,
      approvalId: body.approval_id,
      approverId: body.approver_id,
      approvalTimestamp: body.approval_timestamp,
      ai: { model_id: body.model_id, confidence: body.confidence, evidence_links: body.evidence_links ?? [], annex_iv_uri: body.annex_iv_uri },
      payload: { raceId, stoppedAt: body.stoppedAt ?? body.approval_timestamp ?? new Date().toISOString(), reason: body.reason ?? 'race stop requested' },
    });
  }

  async scratchHorse(raceId: string, body: SafetyCriticalCommandBody, context: { tenantId?: string; racetrackId?: string; actorId?: string } = {}): Promise<CommandHandlingResult> {
    return this.handle({
      id: id('cmd-scratch'),
      type: 'scratch_decision',
      aggregateId: raceId,
      tenantId: context.tenantId ?? 'trackmind',
      racetrackId: context.racetrackId ?? 'main-track',
      actorId: context.actorId ?? 'equine-service',
      approvalRequired: true,
      approvalId: body.approval_id,
      approverId: body.approver_id,
      approvalTimestamp: body.approval_timestamp,
      ai: { model_id: body.model_id, confidence: body.confidence, evidence_links: body.evidence_links ?? [], annex_iv_uri: body.annex_iv_uri },
      payload: { raceId, horseId: body.horseId, reason: body.reason ?? 'scratch requested', scratchedAt: body.scratchedAt ?? body.approval_timestamp ?? new Date().toISOString() },
    });
  }

  async administerMedication(horseId: string, body: SafetyCriticalCommandBody, context: { tenantId?: string; racetrackId?: string; actorId?: string } = {}): Promise<CommandHandlingResult> {
    return this.handle({
      id: id('cmd-medication'),
      type: 'medication_admin',
      aggregateId: horseId,
      tenantId: context.tenantId ?? 'trackmind',
      racetrackId: context.racetrackId ?? 'main-track',
      actorId: context.actorId ?? 'veterinary-service',
      approvalRequired: true,
      approvalId: body.approval_id,
      approverId: body.approver_id,
      approvalTimestamp: body.approval_timestamp,
      ai: { model_id: body.model_id, confidence: body.confidence, evidence_links: body.evidence_links ?? [], annex_iv_uri: body.annex_iv_uri },
      payload: { horseId, medication: body.medication, dose: body.dose, reason: body.reason ?? 'medication administration requested', administeredAt: body.administeredAt ?? body.approval_timestamp ?? new Date().toISOString() },
    });
  }

  async reportIncident(input: { incidentId: string; raceId?: string; zoneId?: string; incidentType: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string; tenantId: string; racetrackId: string; actorId: string; approval_id?: string; approver_id?: string; approval_timestamp?: string; evidence_links?: string[]; confidence?: number }): Promise<CommandHandlingResult> {
    return this.handle({
      id: id('cmd-incident'),
      type: input.severity === 'critical' ? 'emergency_action' : 'sensor_reading',
      aggregateId: input.raceId ?? input.zoneId ?? input.incidentId,
      tenantId: input.tenantId,
      racetrackId: input.racetrackId,
      actorId: input.actorId,
      approvalRequired: input.severity === 'critical',
      approvalId: input.approval_id,
      approverId: input.approver_id,
      approvalTimestamp: input.approval_timestamp,
      ai: { confidence: input.confidence, evidence_links: input.evidence_links ?? [] },
      payload: { incidentId: input.incidentId, raceId: input.raceId, zoneId: input.zoneId, incidentType: input.incidentType, severity: input.severity, description: input.description },
    });
  }

  async recordMonitoring(command: Omit<CqrsCommand<Record<string, unknown>>, 'id' | 'approvalRequired'>): Promise<CommandHandlingResult> {
    if (eventCategoryFor(command.type) !== 'monitoring') return { accepted: false, blockedReason: 'recordMonitoring accepts only monitoring event categories' };
    return this.handle({ ...command, id: id('cmd-monitoring'), approvalRequired: false });
  }

  rebuildProjections(): CqrsProjectionState {
    return this.projections.rebuild(this.store.all());
  }

  events(): EventEnvelope[] {
    return this.store.all();
  }

  verifyHashChain() {
    return this.store.verifyHashChain();
  }

  private validateGovernance(command: CqrsCommand): CommandHandlingResult {
    const category = eventCategoryFor(command.type);
    if (category === 'safety-critical') {
      const governance = evaluateSafetyCriticalGovernance(command);
      if (!governance.allowed) return { accepted: false, blockedReason: `Safety-critical command requires human governance metadata: ${governance.violations.join(', ')}` };
    }
    if (category === 'administrative' && command.approvalRequired !== false && !command.approvalId) return { accepted: false, blockedReason: 'Administrative command requires batch approval metadata or explicit auto-batch policy' };
    return { accepted: true, projection: clone(this.projections.snapshot()) };
  }
}

export function createCqrsCommandHandler(store?: EventSourcedStore) {
  return new CqrsCommandHandler(store);
}
