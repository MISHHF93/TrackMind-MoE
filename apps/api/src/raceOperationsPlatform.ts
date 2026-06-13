import type { ApprovalToken, CentralizedApprovalService } from './approvals.js';

export type RaceStatus = 'draft' | 'scheduled' | 'entries-open' | 'declared' | 'post-positions-drawn' | 'ready' | 'running' | 'official' | 'cancelled';
export type ApprovalState = 'not-required' | 'pending' | 'approved' | 'rejected';

export interface RaceCondition {
  surface: 'dirt' | 'turf' | 'synthetic';
  distanceFurlongs: number;
  classLevel: string;
  purse: number;
  eligibility: string[];
  medicationRules?: string[];
}

export interface RaceEntry {
  id: string;
  horseId: string;
  trainerId: string;
  ownerId: string;
  jockeyId?: string;
  weightLbs?: number;
  declared?: boolean;
  scratched?: boolean;
  scratchReason?: string;
  postPosition?: number;
  gate?: string;
}

export interface RaceCard {
  id: string;
  trackId: string;
  raceDate: string;
  raceNumber: number;
  scheduledPostTime: string;
  status: RaceStatus;
  conditions: RaceCondition;
  entries: RaceEntry[];
  approvals: Record<string, ApprovalState>;
  regulatoryControls: string[];
  twinLinks: string[];
  telemetryStreams: string[];
  staffingPlan?: StaffingPlan;
  resources?: ResourceAllocation[];
}

export interface StaffingPlan {
  stewards: string[];
  veterinarians: string[];
  gateCrew: string[];
  outriders: string[];
  trackMaintenance: string[];
  security: string[];
}

export interface ResourceAllocation {
  id: string;
  type: 'starting-gate' | 'ambulance' | 'tractor' | 'harrow' | 'camera' | 'sensor' | 'tote' | 'security-post';
  zone: string;
  status: 'allocated' | 'standby' | 'unavailable';
}

export interface RaceTelemetrySignal {
  streamId: string;
  type: 'gate' | 'surface' | 'weather' | 'gps' | 'vision' | 'biometric' | 'tote';
  observedAt: string;
  healthy: boolean;
  value: number | string | boolean;
}

export interface RaceExecutionEvent {
  timestamp: string;
  type: 'loaded' | 'off' | 'fraction' | 'incident' | 'objection' | 'finish' | 'official';
  message: string;
  severity?: 'info' | 'warning' | 'critical';
}

export class RaceOperationsPlatform {
  private races = new Map<string, RaceCard>();
  private execution = new Map<string, RaceExecutionEvent[]>();

  constructor(private readonly approvalService?: CentralizedApprovalService, private readonly tenantId = 'default-tenant') {}

  scheduleRace(input: Omit<RaceCard, 'status' | 'entries' | 'approvals' | 'regulatoryControls' | 'twinLinks' | 'telemetryStreams'> & Partial<Pick<RaceCard, 'entries' | 'approvals' | 'regulatoryControls' | 'twinLinks' | 'telemetryStreams'>>): RaceCard {
    const race: RaceCard = {
      ...input,
      status: 'scheduled',
      entries: input.entries ?? [],
      approvals: { racingOffice: 'pending', stewards: 'pending', veterinarian: 'pending', ...(input.approvals ?? {}) },
      regulatoryControls: input.regulatoryControls ?? ['HISA', 'ARCI', 'state-racing-commission'],
      twinLinks: input.twinLinks ?? [`track:${input.trackId}`, `race:${input.id}`],
      telemetryStreams: input.telemetryStreams ?? ['gate-status', 'surface-condition', 'weather', 'vision']
    };
    this.races.set(race.id, race);
    return race;
  }

  addEntry(raceId: string, entry: RaceEntry): RaceCard {
    return this.update(raceId, (race) => ({ ...race, status: 'entries-open', entries: [...race.entries.filter((e) => e.id !== entry.id), { ...entry, declared: entry.declared ?? false, scratched: false }] }));
  }

  declareEntry(raceId: string, entryId: string, jockeyId: string, weightLbs: number): RaceCard {
    return this.mapEntry(raceId, entryId, (entry) => ({ ...entry, jockeyId, weightLbs, declared: true }));
  }

  scratchEntry(raceId: string, entryId: string, reason: string, approvedBy: string): RaceCard {
    return this.mapEntry(raceId, entryId, (entry) => ({ ...entry, scratched: true, scratchReason: `${reason}; approvedBy=${approvedBy}` }));
  }

  drawPostPositions(raceId: string, seed = 1): RaceCard {
    const race = this.requireRace(raceId);
    const active = race.entries.filter((entry) => entry.declared && !entry.scratched).sort((a, b) => `${a.id}:${seed}`.localeCompare(`${b.id}:${seed}`));
    const positions = new Map(active.map((entry, index) => [entry.id, index + 1]));
    return this.update(raceId, (current) => ({ ...current, status: 'post-positions-drawn', entries: current.entries.map((entry) => positions.has(entry.id) ? { ...entry, postPosition: positions.get(entry.id) } : entry) }));
  }

  assignGates(raceId: string, gatePrefix = 'G'): RaceCard {
    return this.update(raceId, (race) => ({ ...race, entries: race.entries.map((entry) => entry.postPosition && !entry.scratched ? { ...entry, gate: `${gatePrefix}-${entry.postPosition}` } : entry) }));
  }

  coordinateStaffing(raceId: string, staffingPlan: StaffingPlan): RaceCard {
    return this.update(raceId, (race) => ({ ...race, staffingPlan }));
  }

  allocateResources(raceId: string, resources: ResourceAllocation[]): RaceCard {
    return this.update(raceId, (race) => ({ ...race, resources }));
  }

  approveWorkflow(raceId: string, step: string, state: ApprovalState): RaceCard {
    return this.update(raceId, (race) => ({ ...race, approvals: { ...race.approvals, [step]: state } }));
  }

  assessReadiness(raceId: string, telemetry: RaceTelemetrySignal[]) {
    const race = this.requireRace(raceId);
    const activeEntries = race.entries.filter((entry) => entry.declared && !entry.scratched);
    const approvalsOk = Object.values(race.approvals).every((state) => state === 'approved' || state === 'not-required');
    const telemetryOk = telemetry.every((signal) => signal.healthy);
    const staffingOk = Boolean(race.staffingPlan?.stewards.length && race.staffingPlan.veterinarians.length && race.staffingPlan.gateCrew.length);
    const resourceOk = Boolean(race.resources?.some((r) => r.type === 'starting-gate' && r.status === 'allocated'));
    const ready = activeEntries.length > 0 && approvalsOk && telemetryOk && staffingOk && resourceOk;
    if (ready) this.update(raceId, (current) => ({ ...current, status: 'ready' }));
    return { raceId, ready, activeEntries: activeEntries.length, blockers: [activeEntries.length ? '' : 'no active declared entries', approvalsOk ? '' : 'workflow approvals pending', telemetryOk ? '' : 'telemetry unhealthy', staffingOk ? '' : 'staffing incomplete', resourceOk ? '' : 'starting gate unavailable'].filter(Boolean) };
  }

  startRace(raceId: string, token?: ApprovalToken, now = new Date().toISOString()): RaceCard {
    this.approvalService?.assertAuthorized(token, 'race-start', raceId, this.tenantId, now);
    this.monitorExecution(raceId, { timestamp: now, type: 'off', message: 'approved race start' });
    return this.requireRace(raceId);
  }

  cancelRace(raceId: string, token?: ApprovalToken, now = new Date().toISOString()): RaceCard {
    this.approvalService?.assertAuthorized(token, 'race-cancellation', raceId, this.tenantId, now);
    return this.update(raceId, (race) => ({ ...race, status: 'cancelled' }));
  }

  publishOfficialResults(raceId: string, token?: ApprovalToken, now = new Date().toISOString()): RaceCard {
    this.approvalService?.assertAuthorized(token, 'official-results', raceId, this.tenantId, now);
    this.monitorExecution(raceId, { timestamp: now, type: 'official', message: 'approved official result' });
    return this.requireRace(raceId);
  }

  monitorExecution(raceId: string, event: RaceExecutionEvent): RaceExecutionEvent[] {
    const events = [...(this.execution.get(raceId) ?? []), event].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    this.execution.set(raceId, events);
    if (event.type === 'off') this.update(raceId, (race) => ({ ...race, status: 'running' }));
    if (event.type === 'official') this.update(raceId, (race) => ({ ...race, status: 'official' }));
    return events;
  }

  operationalReport(raceId: string) {
    const race = this.requireRace(raceId);
    const events = this.execution.get(raceId) ?? [];
    return { raceId, status: race.status, entries: race.entries.length, activeEntries: race.entries.filter((e) => e.declared && !e.scratched).length, scratches: race.entries.filter((e) => e.scratched).length, approvals: race.approvals, regulatoryControls: race.regulatoryControls, twinLinks: race.twinLinks, telemetryStreams: race.telemetryStreams, criticalEvents: events.filter((e) => e.severity === 'critical').length, events: events.length };
  }

  aiRecommendations(raceId: string, telemetry: RaceTelemetrySignal[]) {
    const readiness = this.assessReadiness(raceId, telemetry);
    return { raceId, humanApprovalRequired: true, recommendations: readiness.ready ? ['proceed-to-post-parade'] : readiness.blockers.map((blocker) => `resolve:${blocker}`), evidence: telemetry.map((signal) => signal.streamId), policy: 'AI recommendations are advisory until approved by racing officials' };
  }

  getRace(raceId: string): RaceCard { return this.requireRace(raceId); }

  private mapEntry(raceId: string, entryId: string, mapper: (entry: RaceEntry) => RaceEntry): RaceCard {
    return this.update(raceId, (race) => ({ ...race, status: 'declared', entries: race.entries.map((entry) => entry.id === entryId ? mapper(entry) : entry) }));
  }

  private update(raceId: string, mapper: (race: RaceCard) => RaceCard): RaceCard {
    const next = mapper(this.requireRace(raceId));
    this.races.set(raceId, next);
    return next;
  }

  private requireRace(raceId: string): RaceCard {
    const race = this.races.get(raceId);
    if (!race) throw new Error(`Unknown race ${raceId}`);
    return race;
  }
}

export function raceOperationsControlMatrix() {
  return [
    { workflow: 'schedule-to-card', approvals: ['racingOffice', 'stewards'], controls: ['condition-book', 'commission-rules'], systems: ['digital-twin', 'telemetry', 'event-bus'] },
    { workflow: 'entries-declarations-scratches', approvals: ['racingOffice', 'veterinarian', 'stewards'], controls: ['eligibility', 'medication', 'welfare'], systems: ['passport', 'approval-store', 'audit-log'] },
    { workflow: 'race-day-readiness', approvals: ['operations', 'safety', 'stewards'], controls: ['surface', 'weather', 'gate', 'staffing'], systems: ['iot', 'vision', 'ai-recommendations'] },
    { workflow: 'execution-reporting', approvals: ['stewards'], controls: ['official-order', 'incident-evidence', 'regulatory-retention'], systems: ['telemetry', 'video', 'compliance-vault'] }
  ];
}
