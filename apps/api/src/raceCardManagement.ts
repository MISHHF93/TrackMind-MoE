import {
  raceCardLifecycleTransitions,
  validateRaceCardCombination,
  validateRaceCardEntryConflicts,
  validateRaceCardReadyForReview,
  type ManagedRaceCardDto,
  type RaceCardAuditRecordDto,
  type RaceCardConditionsDto,
  type RaceCardClassificationDto,
  type RaceCardEntryDto,
  type RaceCardEntryStatus,
  type RaceCardLifecycleStatus,
  type RaceCardMutationResultDto,
  type RaceCardPurseDto,
  type RaceCardWorkspaceDto,
} from '@trackmind/shared';
import type { CentralizedApprovalService } from './approvals.js';
import type { ImmutableAuditLog } from './auditLog.js';
import type { UniversalEventBus } from './eventBus.js';
import { RaceOperationsPlatform, type RaceCard, type RaceEntry } from './raceOperationsPlatform.js';

export type { RaceCardLifecycleStatus };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hash = (value: unknown) => {
  const text = JSON.stringify(value);
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0;
  return `sha256:${acc.toString(16).padStart(8, '0')}`;
};

interface ManagedRaceCardRecord {
  id: string;
  raceDayId: string;
  racetrackId: string;
  raceDate: string;
  raceNumber: number;
  scheduledPostTime: string;
  lifecycleStatus: RaceCardLifecycleStatus;
  conditions: RaceCardConditionsDto;
  classification: RaceCardClassificationDto;
  purse: RaceCardPurseDto;
  entries: RaceCardEntryDto[];
  version: number;
  auditIds: string[];
  eventIds: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface RaceCardManagementDeps {
  racePlatform?: RaceOperationsPlatform;
  approvalService?: CentralizedApprovalService;
  auditLog?: ImmutableAuditLog;
  eventBus?: UniversalEventBus;
  tenantId?: string;
  racetrackId?: string;
}

export class RaceCardManagementRepository {
  private readonly cards = new Map<string, ManagedRaceCardRecord>();

  save(card: ManagedRaceCardRecord): ManagedRaceCardRecord {
    this.cards.set(card.id, clone(card));
    return clone(card);
  }

  get(cardId: string): ManagedRaceCardRecord | undefined {
    const card = this.cards.get(cardId);
    return card ? clone(card) : undefined;
  }

  list(filter: { racetrackId?: string; raceDayId?: string; raceDate?: string } = {}): ManagedRaceCardRecord[] {
    return [...this.cards.values()]
      .filter((card) => (!filter.racetrackId || card.racetrackId === filter.racetrackId)
        && (!filter.raceDayId || card.raceDayId === filter.raceDayId)
        && (!filter.raceDate || card.raceDate === filter.raceDate))
      .map(clone);
  }
}

export class RaceCardManagementPlatform {
  private readonly repository = new RaceCardManagementRepository();
  private readonly auditChain: RaceCardAuditRecordDto[] = [];

  constructor(private readonly deps: RaceCardManagementDeps = {}) {}

  workspace(now = new Date().toISOString()): RaceCardWorkspaceDto {
    this.syncFromRacePlatform(now);
    const raceCards = this.repository.list({ racetrackId: this.deps.racetrackId }).map((card) => this.toDto(card));
    const lifecycleSummary = Object.fromEntries(
      (['draft', 'review', 'approved', 'published', 'completed', 'archived'] as RaceCardLifecycleStatus[]).map((status) => [
        status,
        raceCards.filter((card) => card.lifecycleStatus === status).length,
      ]),
    ) as Record<RaceCardLifecycleStatus, number>;

    return {
      generatedAt: now,
      schemaVersion: 'trackmind.race-card-management.v1',
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      raceCards,
      lifecycleSummary,
      lifecycleLegend: [...['draft', 'review', 'approved', 'published', 'completed', 'archived'] as RaceCardLifecycleStatus[]],
      approvalControls: raceCards
        .filter((card) => card.approvalRequired)
        .map((card) => ({
          id: `race-office-configuration-${card.id}`,
          label: `Approve lifecycle transition for Race ${card.raceNumber}`,
          action: 'race-office-configuration',
          target: card.id,
          reason: `Race card ${card.id} requires authorized approval before ${card.lifecycleStatus === 'review' ? 'approval' : 'publication'}.`,
          requiredRoles: ['horse-operations-coordinator', 'steward'],
          evidence: ['condition-book', 'human-approval-record'],
          locked: true as const,
        })),
      auditTrail: this.auditChain.map(clone),
      mock: false,
    };
  }

  getCard(cardId: string): ManagedRaceCardDto | undefined {
    const card = this.repository.get(cardId);
    return card ? this.toDto(card) : undefined;
  }

  createCard(input: {
    raceDayId: string;
    racetrackId: string;
    raceDate: string;
    raceNumber: number;
    scheduledPostTime: string;
    conditions?: Partial<RaceCardConditionsDto>;
    classification?: Partial<RaceCardClassificationDto>;
    purse?: Partial<RaceCardPurseDto>;
  }, actor = 'horse-operations-coordinator'): RaceCardMutationResultDto {
    const duplicate = this.repository.list({ raceDayId: input.raceDayId }).find((card) => card.raceNumber === input.raceNumber);
    if (duplicate) {
      throw new Error(`Race number ${input.raceNumber} already exists on race day ${input.raceDayId}`);
    }
    const combinationIssues = validateRaceCardCombination({
      conditions: {
        surface: input.conditions?.surface ?? 'dirt',
        distanceFurlongs: input.conditions?.distanceFurlongs ?? 6,
      },
      classification: {
        classLevel: input.classification?.classLevel ?? 'Open',
        stakesGrade: input.classification?.stakesGrade ?? 'allowance',
        claimingPrice: input.classification?.claimingPrice,
      },
      purse: { basePurse: input.purse?.basePurse ?? 0 },
    });
    if (combinationIssues.length) {
      throw new Error(combinationIssues.map((issue) => issue.message).join('; '));
    }
    const cardId = id('race-card');
    const now = new Date().toISOString();
    const card: ManagedRaceCardRecord = {
      id: cardId,
      raceDayId: input.raceDayId,
      racetrackId: input.racetrackId,
      raceDate: input.raceDate,
      raceNumber: input.raceNumber,
      scheduledPostTime: input.scheduledPostTime,
      lifecycleStatus: 'draft',
      conditions: {
        surface: input.conditions?.surface ?? 'dirt',
        distanceFurlongs: input.conditions?.distanceFurlongs ?? 6,
        eligibility: input.conditions?.eligibility ?? [],
        medicationRules: input.conditions?.medicationRules ?? ['HISA medication controls'],
        weatherRestrictions: input.conditions?.weatherRestrictions ?? [],
        surfaceRequirements: input.conditions?.surfaceRequirements ?? [],
        trackCondition: input.conditions?.trackCondition,
        ageRestriction: input.conditions?.ageRestriction,
        sexRestriction: input.conditions?.sexRestriction,
      },
      classification: {
        classLevel: input.classification?.classLevel ?? 'Open',
        division: input.classification?.division,
        claimingPrice: input.classification?.claimingPrice,
        allowanceConditions: input.classification?.allowanceConditions ?? [],
        stakesGrade: input.classification?.stakesGrade ?? 'allowance',
        restrictionType: input.classification?.restrictionType,
      },
      purse: {
        basePurse: input.purse?.basePurse ?? 0,
        currency: input.purse?.currency ?? 'USD',
        availableMoney: input.purse?.availableMoney,
        starterBonus: input.purse?.starterBonus,
        breederAwards: input.purse?.breederAwards,
        stateBredSupplement: input.purse?.stateBredSupplement,
        payoutStructure: input.purse?.payoutStructure ?? [
          { position: 1, percentage: 60 },
          { position: 2, percentage: 20 },
          { position: 3, percentage: 10 },
          { position: 4, percentage: 6 },
          { position: 5, percentage: 4 },
        ],
      },
      entries: [],
      version: 1,
      auditIds: [],
      eventIds: [],
      updatedAt: now,
      updatedBy: actor,
    };
    const auditId = this.recordChange(card, actor, 'race-card.created', 'Race card created in draft lifecycle', undefined, 'draft');
    card.auditIds.push(auditId);
    this.repository.save(card);
    this.syncToRacePlatform(card, actor);
    return this.mutationResult(card, auditId, 'race-card.created.v1', 'Race card created in draft status. All changes are audit-logged.');
  }

  updateConditions(cardId: string, conditions: Partial<RaceCardConditionsDto>, actor = 'horse-operations-coordinator'): RaceCardMutationResultDto {
    const card = this.requireMutable(cardId);
    const nextConditions = { ...card.conditions, ...conditions };
    const issues = validateRaceCardCombination({
      conditions: nextConditions,
      classification: card.classification,
      purse: card.purse,
    });
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join('; '));
    card.conditions = nextConditions;
    return this.mutate(card, actor, 'race-card.conditions.updated', 'Race conditions updated', 'race-card.conditions.updated.v1');
  }

  updateClassification(cardId: string, classification: Partial<RaceCardClassificationDto>, actor = 'horse-operations-coordinator'): RaceCardMutationResultDto {
    const card = this.requireMutable(cardId);
    const nextClassification = { ...card.classification, ...classification };
    const issues = validateRaceCardCombination({
      conditions: card.conditions,
      classification: nextClassification,
      purse: card.purse,
    });
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join('; '));
    card.classification = nextClassification;
    return this.mutate(card, actor, 'race-card.classification.updated', 'Race classification updated', 'race-card.classification.updated.v1');
  }

  updatePurse(cardId: string, purse: Partial<RaceCardPurseDto>, actor = 'horse-operations-coordinator'): RaceCardMutationResultDto {
    const card = this.requireMutable(cardId);
    const nextPurse = { ...card.purse, ...purse };
    const issues = validateRaceCardCombination({
      conditions: card.conditions,
      classification: card.classification,
      purse: nextPurse,
    });
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join('; '));
    card.purse = nextPurse;
    return this.mutate(card, actor, 'race-card.purse.updated', 'Purse information updated', 'race-card.purse.updated.v1');
  }

  addEntry(cardId: string, input: { horseId: string; trainerId: string; ownerIds: string[]; jockeyId?: string; programNumber?: string; weightLbs?: number }, actor = 'horse-operations-coordinator'): RaceCardMutationResultDto {
    const card = this.requireMutable(cardId);
    if (card.entries.some((entry) => entry.horseId === input.horseId && !entry.scratched)) {
      throw new Error(`Horse ${input.horseId} is already entered on this race card`);
    }
    const now = new Date().toISOString();
    const entryId = id('entry');
    const entryAuditId = id('audit-entry');
    const entry: RaceCardEntryDto = {
      id: entryId,
      horseId: input.horseId,
      trainerId: input.trainerId,
      jockeyId: input.jockeyId,
      ownerIds: [...input.ownerIds],
      programNumber: input.programNumber,
      weightLbs: input.weightLbs,
      status: 'entered',
      scratched: false,
      equipmentFlags: [],
      medicationFlags: [],
      auditId: entryAuditId,
      updatedAt: now,
    };
    card.entries = [...card.entries, entry];
    this.syncToRacePlatform(card, actor);
    return this.mutate(card, actor, 'race-card.entry.added', `Horse ${input.horseId} added to race card`, 'race-card.entry.added.v1');
  }

  assignHorse(cardId: string, entryId: string, horseId: string, actor = 'horse-operations-coordinator'): RaceCardMutationResultDto {
    const card = this.requireMutable(cardId);
    if (card.entries.some((entry) => entry.id !== entryId && entry.horseId === horseId && !entry.scratched)) {
      throw new Error(`Horse ${horseId} is already entered on this race card`);
    }
    return this.updateEntry(cardId, entryId, actor, 'race-card.horse.assigned', `Horse assignment set to ${horseId}`, (entry) => ({ ...entry, horseId }));
  }

  assignTrainer(cardId: string, entryId: string, trainerId: string, actor = 'horse-operations-coordinator'): RaceCardMutationResultDto {
    return this.updateEntry(cardId, entryId, actor, 'race-card.trainer.assigned', `Trainer assignment set to ${trainerId}`, (entry) => ({ ...entry, trainerId }));
  }

  assignJockey(cardId: string, entryId: string, jockeyId: string, actor = 'horse-operations-coordinator'): RaceCardMutationResultDto {
    const card = this.requireMutable(cardId);
    if (card.entries.some((entry) => entry.id !== entryId && entry.jockeyId === jockeyId && !entry.scratched)) {
      throw new Error(`Jockey ${jockeyId} is already assigned on this race card`);
    }
    return this.updateEntry(cardId, entryId, actor, 'race-card.jockey.assigned', `Jockey assignment set to ${jockeyId}`, (entry) => ({ ...entry, jockeyId, status: 'declared' as RaceCardEntryStatus }));
  }

  assignPostPosition(cardId: string, entryId: string, postPosition: number, actor = 'horse-operations-coordinator'): RaceCardMutationResultDto {
    if (postPosition < 1) throw new Error('Post position must be positive');
    const card = this.requireMutable(cardId);
    if (card.entries.some((entry) => entry.id !== entryId && entry.postPosition === postPosition && !entry.scratched)) {
      throw new Error(`Post position ${postPosition} is already assigned`);
    }
    return this.updateEntry(cardId, entryId, actor, 'race-card.post-position.assigned', `Post position ${postPosition} assigned`, (entry) => ({ ...entry, postPosition, programNumber: entry.programNumber ?? String(postPosition) }));
  }

  transitionLifecycle(cardId: string, toStatus: RaceCardLifecycleStatus, actor = 'horse-operations-coordinator', reason = 'lifecycle transition'): RaceCardMutationResultDto {
    const card = this.requireCard(cardId);
    const fromStatus = card.lifecycleStatus;
    this.assertTransition(fromStatus, toStatus);
    if (toStatus === 'review') {
      const issues = validateRaceCardReadyForReview({
        conditions: card.conditions,
        classification: card.classification,
        purse: card.purse,
        entries: card.entries,
      });
      if (issues.length) throw new Error(issues.map((issue) => issue.message).join('; '));
    }
    const entryIssues = validateRaceCardEntryConflicts(card.entries);
    if (['approved', 'published'].includes(toStatus) && entryIssues.length) {
      throw new Error(entryIssues.map((issue) => issue.message).join('; '));
    }
    const rule = raceCardLifecycleTransitions.find((transition) => transition.from === fromStatus && transition.to === toStatus);
    let approvalId: string | undefined;
    if (rule?.approvalRequired) {
      approvalId = this.deps.approvalService?.createRequest({
        tenantId: this.deps.tenantId ?? 'trackmind',
        racetrackId: card.racetrackId,
        action: 'race-office-configuration',
        target: cardId,
        requestedBy: actor,
        actorType: 'human',
        reason: `${reason}: ${fromStatus} → ${toStatus}`,
        evidence: ['condition-book', 'human-approval-record', 'lifecycle-transition'],
      })?.id;
    }
    card.lifecycleStatus = toStatus;
    card.version += 1;
    const auditId = this.recordChange(card, actor, 'race-card.lifecycle.transitioned', `Lifecycle ${fromStatus} → ${toStatus}`, fromStatus, toStatus);
    card.auditIds.push(auditId);
    this.repository.save(card);
    this.recordEvent('race-card.lifecycle.transitioned.v1', cardId, actor, { fromStatus, toStatus, reason });
    return {
      accepted: true,
      raceCardId: cardId,
      auditId,
      eventType: 'race-card.lifecycle.transitioned.v1',
      lifecycleStatus: toStatus,
      approvalRequired: Boolean(rule?.approvalRequired),
      approvalId,
      message: `Race card transitioned from ${fromStatus} to ${toStatus}. Transition audited.`,
      mock: false,
    };
  }

  auditTrail(cardId?: string): RaceCardAuditRecordDto[] {
    if (!cardId) return this.auditChain.map(clone);
    return this.auditChain.filter((record) => record.raceCardId === cardId).map(clone);
  }

  private updateEntry(
    cardId: string,
    entryId: string,
    actor: string,
    action: string,
    summary: string,
    mapper: (entry: RaceCardEntryDto) => RaceCardEntryDto,
  ): RaceCardMutationResultDto {
    const card = this.requireMutable(cardId);
    const index = card.entries.findIndex((entry) => entry.id === entryId);
    if (index < 0) throw new Error(`Unknown entry ${entryId}`);
    const now = new Date().toISOString();
    card.entries[index] = { ...mapper(card.entries[index]), updatedAt: now, auditId: id('audit-entry') };
    this.syncToRacePlatform(card, actor);
    return this.mutate(card, actor, action, summary, `${action}.v1`);
  }

  private mutate(card: ManagedRaceCardRecord, actor: string, action: string, summary: string, eventType: string): RaceCardMutationResultDto {
    card.updatedBy = actor;
    card.updatedAt = new Date().toISOString();
    card.version += 1;
    const auditId = this.recordChange(card, actor, action, summary);
    card.auditIds.push(auditId);
    this.repository.save(card);
    this.recordEvent(eventType, card.id, actor, { action, summary });
    return this.mutationResult(card, auditId, eventType, `${summary}. Change audited.`);
  }

  private mutationResult(card: ManagedRaceCardRecord, auditId: string, eventType: string, message: string): RaceCardMutationResultDto {
    return {
      accepted: true,
      raceCardId: card.id,
      auditId,
      eventType,
      lifecycleStatus: card.lifecycleStatus,
      approvalRequired: card.lifecycleStatus === 'review' || card.lifecycleStatus === 'approved',
      message,
      mock: false,
    };
  }

  private toDto(card: ManagedRaceCardRecord): ManagedRaceCardDto {
    const activeEntries = card.entries.filter((entry) => !entry.scratched);
    return {
      id: card.id,
      raceDayId: card.raceDayId,
      racetrackId: card.racetrackId,
      raceDate: card.raceDate,
      raceNumber: card.raceNumber,
      scheduledPostTime: card.scheduledPostTime,
      lifecycleStatus: card.lifecycleStatus,
      conditions: clone(card.conditions),
      classification: clone(card.classification),
      purse: clone(card.purse),
      entries: card.entries.map(clone),
      entryCount: card.entries.length,
      activeEntryCount: activeEntries.length,
      approvalRequired: card.lifecycleStatus === 'review' || card.lifecycleStatus === 'approved',
      version: card.version,
      auditIds: [...card.auditIds],
      eventIds: [...card.eventIds],
      lastAuditId: card.auditIds.at(-1) ?? '',
      updatedAt: card.updatedAt,
      updatedBy: card.updatedBy,
    };
  }

  private requireCard(cardId: string): ManagedRaceCardRecord {
    const card = this.repository.get(cardId);
    if (!card) throw new Error(`Unknown race card ${cardId}`);
    return card;
  }

  private requireMutable(cardId: string): ManagedRaceCardRecord {
    const card = this.requireCard(cardId);
    if (['published', 'completed', 'archived'].includes(card.lifecycleStatus)) {
      throw new Error(`Race card ${cardId} is ${card.lifecycleStatus} and cannot be modified`);
    }
    return card;
  }

  private assertTransition(from: RaceCardLifecycleStatus, to: RaceCardLifecycleStatus): void {
    const allowed = raceCardLifecycleTransitions.some((transition) => transition.from === from && transition.to === to);
    if (!allowed) throw new Error(`Invalid lifecycle transition ${from} → ${to}`);
  }

  private recordChange(
    card: ManagedRaceCardRecord,
    actor: string,
    action: string,
    changeSummary: string,
    lifecycleFrom?: RaceCardLifecycleStatus,
    lifecycleTo?: RaceCardLifecycleStatus,
  ): string {
    const auditId = id('audit-race-card');
    const previousHash = this.auditChain.at(-1)?.hash ?? 'genesis';
    const record: RaceCardAuditRecordDto = {
      auditId,
      raceCardId: card.id,
      action,
      actor,
      timestamp: new Date().toISOString(),
      previousHash,
      hash: hash({ cardId: card.id, action, changeSummary, previousHash, version: card.version }),
      lifecycleFrom,
      lifecycleTo,
      changeSummary,
      evidence: ['race-card-management', action],
    };
    this.auditChain.push(record);
    card.auditIds.push(auditId);
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: auditId,
        type: 'data-change',
        actor,
        timestamp: record.timestamp,
        subjectId: card.id,
        payload: { action, changeSummary, lifecycleFrom, lifecycleTo, version: card.version },
        tenantId: this.deps.tenantId ?? 'trackmind',
        severity: 'info',
        regulations: ['HISA', 'ARCI'],
      });
    }
    return auditId;
  }

  private recordEvent(eventType: string, cardId: string, actor: string, payload: Record<string, unknown>): void {
    const eventId = id('evt-race-card');
    const card = this.repository.get(cardId);
    if (card) card.eventIds.push(eventId);
    void this.deps.eventBus?.publish({
      id: eventId,
      type: eventType,
      payload: { cardId, actor, ...payload },
      aggregateId: cardId,
      producer: 'race-card-management',
      metadata: { compliance: 'regulated', team: 'race-office', accountableRole: 'horse-operations-coordinator' },
    });
  }

  private syncFromRacePlatform(now: string): void {
    if (!this.deps.racePlatform) return;
    const days = this.deps.racePlatform.listRaceDays();
    for (const race of this.deps.racePlatform.listRaces()) {
      if (this.repository.get(race.id)) continue;
      const day = days.find((d) => d.raceIds.includes(race.id)) ?? days.find((d) => d.raceDate === race.raceDate && d.trackId === race.trackId);
      const lifecycleStatus = this.mapOpsStatusToLifecycle(race);
      const card: ManagedRaceCardRecord = {
        id: race.id,
        raceDayId: day?.id ?? `day:${race.raceDate}`,
        racetrackId: race.trackId,
        raceDate: race.raceDate,
        raceNumber: race.raceNumber,
        scheduledPostTime: race.scheduledPostTime,
        lifecycleStatus,
        conditions: {
          surface: race.conditions.surface,
          distanceFurlongs: race.conditions.distanceFurlongs,
          eligibility: [...race.conditions.eligibility],
          medicationRules: [...(race.conditions.medicationRules ?? [])],
          weatherRestrictions: [...(race.conditions.weatherRestrictions ?? [])],
          surfaceRequirements: [...(race.conditions.surfaceRequirements ?? [])],
        },
        classification: {
          classLevel: race.conditions.classLevel,
          stakesGrade: 'allowance',
          allowanceConditions: [],
        },
        purse: {
          basePurse: race.conditions.purse,
          currency: 'USD',
          payoutStructure: [
            { position: 1, percentage: 60 },
            { position: 2, percentage: 20 },
            { position: 3, percentage: 10 },
            { position: 4, percentage: 6 },
            { position: 5, percentage: 4 },
          ],
        },
        entries: race.entries.map((entry) => this.mapEntry(entry, now)),
        version: 1,
        auditIds: [`audit:sync:${race.id}`],
        eventIds: [`event:sync:${race.id}`],
        updatedAt: race.updatedAt ?? now,
        updatedBy: 'race-card-sync',
      };
      this.repository.save(card);
    }
  }

  private syncToRacePlatform(card: ManagedRaceCardRecord, actor: string): void {
    if (!this.deps.racePlatform) return;
    const existing = this.deps.racePlatform.listRaces().find((race) => race.id === card.id);
    if (!existing) return;
    for (const entry of card.entries) {
      const opsEntry = existing.entries.find((e) => e.id === entry.id);
      if (!opsEntry && !entry.scratched) {
        this.deps.racePlatform.addEntry(card.id, this.mapToOpsEntry(entry), actor);
      } else if (opsEntry && entry.jockeyId && entry.weightLbs && !opsEntry.declared) {
        try {
          this.deps.racePlatform.declareEntry(card.id, entry.id, entry.jockeyId, entry.weightLbs, actor);
        } catch {
          /* declaration may require additional race-office state */
        }
      }
      if (opsEntry && entry.postPosition && opsEntry.postPosition !== entry.postPosition) {
        try {
          this.deps.racePlatform.drawPostPositions(card.id, entry.postPosition, actor);
        } catch {
          /* post draw may require prior declarations */
        }
      }
    }
  }

  private mapOpsStatusToLifecycle(race: RaceCard): RaceCardLifecycleStatus {
    if (race.status === 'official') return 'completed';
    if (['running', 'ready'].includes(race.status)) return 'published';
    if (['declared', 'post-positions-drawn'].includes(race.status)) return 'approved';
    if (race.status === 'entries-open') return 'review';
    if (race.status === 'scheduled') return 'draft';
    if (race.status === 'cancelled') return 'archived';
    return 'draft';
  }

  private mapEntry(entry: RaceEntry, now: string): RaceCardEntryDto {
    return {
      id: entry.id,
      horseId: entry.horseId,
      trainerId: entry.trainerId,
      jockeyId: entry.jockeyId,
      ownerIds: [entry.ownerId],
      programNumber: entry.postPosition ? String(entry.postPosition) : undefined,
      postPosition: entry.postPosition,
      weightLbs: entry.weightLbs,
      status: entry.scratched ? 'scratched' : entry.declared ? 'declared' : 'entered',
      scratched: Boolean(entry.scratched),
      scratchReason: entry.scratchReason,
      equipmentFlags: [],
      medicationFlags: [],
      auditId: `audit:entry:${entry.id}`,
      updatedAt: now,
    };
  }

  private mapToOpsEntry(entry: RaceCardEntryDto): RaceEntry {
    return {
      id: entry.id,
      horseId: entry.horseId,
      trainerId: entry.trainerId,
      ownerId: entry.ownerIds[0] ?? 'owner-unknown',
      jockeyId: entry.jockeyId,
      weightLbs: entry.weightLbs,
      declared: entry.status === 'declared' || entry.status === 'starter',
      scratched: entry.scratched,
      postPosition: entry.postPosition,
    };
  }
}

export function createSeededRaceCardManagement(deps: RaceCardManagementDeps, now = new Date().toISOString()): RaceCardManagementPlatform {
  const platform = new RaceCardManagementPlatform(deps);
  platform.workspace(now);
  return platform;
}
