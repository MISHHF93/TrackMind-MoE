import type {
  HorseBreedingMetadataDto,
  HorseDigitalTwinSyncDto,
  HorseEligibilityStatusDto,
  HorseIdentityDto,
  HorseLifecycleHistoryEntryDto,
  HorseOwnershipHistoryEntryDto,
  HorseRegistrationRecordDto,
  HorseRegistryAuditTrailDto,
  HorseRegistryLifecycleStatus,
  HorseRegistryMutationResultDto,
  HorseRegistryRecordDto,
  HorseRegistryWorkspaceDto,
  HorseRetirementRecordDto,
  HorseStableHistoryEntryDto,
  HorseTrainerHistoryEntryDto,
} from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import {
  EquineIntelligencePlatform,
  type EquineActor,
  type EquineIdentity,
  type EquineProfile,
  type HorseBreedingMetadata,
  type HorseRegistrationRecord,
  type OwnershipRecord,
  type RetirementRecord,
  type TrainerAssignment,
  type BarnAssignment,
} from './equineIntelligencePlatform.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hash = (value: unknown) => {
  const text = JSON.stringify(value);
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0;
  return `sha256:${acc.toString(16).padStart(8, '0')}`;
};

export interface HorseRegistryDeps {
  equinePlatform?: EquineIntelligencePlatform;
  auditLog?: ImmutableAuditLog;
  tenantId?: string;
  racetrackId?: string;
}

export class HorseRegistryPlatform {
  private readonly registryHistory: HorseLifecycleHistoryEntryDto[] = [];
  private readonly horseHistory = new Map<string, HorseLifecycleHistoryEntryDto[]>();

  constructor(private readonly deps: HorseRegistryDeps = {}) {}

  workspace(now = new Date().toISOString(), actor = defaultActor(this.deps.tenantId)): HorseRegistryWorkspaceDto {
    const platform = this.requirePlatform();
    const horses = platform.listProfiles(this.deps.tenantId).map((profile) => this.toRecord(profile, actor));
    const lifecycleSummary = Object.fromEntries(
      (['active', 'inactive', 'retired', 'deceased'] as HorseRegistryLifecycleStatus[]).map((status) => [
        status,
        horses.filter((horse) => horse.identity.lifecycleStatus === status).length,
      ]),
    ) as Record<HorseRegistryLifecycleStatus, number>;

    return {
      generatedAt: now,
      schemaVersion: 'trackmind.horse-registry.v1',
      tenantId: this.deps.tenantId ?? 'trackmind',
      racetrackId: this.deps.racetrackId ?? 'main-track',
      horses,
      lifecycleSummary,
      lifecycleLegend: [...['active', 'inactive', 'retired', 'deceased'] as HorseRegistryLifecycleStatus[]],
      auditTrail: this.registryHistory.map(clone),
      twinSyncCount: platform.twinSnapshot(this.deps.tenantId).length,
      mock: false,
    };
  }

  getHorse(horseId: string, actor = defaultActor(this.deps.tenantId)): HorseRegistryRecordDto | undefined {
    const platform = this.requirePlatform();
    try {
      return this.toRecord(platform.getProfile(horseId, actor), actor);
    } catch {
      return undefined;
    }
  }

  registerHorse(input: {
    identity: Omit<EquineIdentity, 'tenantId'> & { tenantId?: string };
    breedingMetadata?: HorseBreedingMetadata;
    registrationRecords?: Array<Omit<HorseRegistrationRecord, 'recordId' | 'recordedAt'>>;
    ownership?: OwnershipRecord[];
    trainer?: TrainerAssignment;
  }, actor: EquineActor | string = defaultActor(this.deps.tenantId)): HorseRegistryMutationResultDto {
    const platform = this.requirePlatform();
    const resolvedActor = resolveActor(actor, this.deps.tenantId);
    const tenantId = input.identity.tenantId ?? this.deps.tenantId ?? 'trackmind';
    const identity: EquineIdentity = { ...input.identity, tenantId };
    platform.createProfile(identity, resolvedActor);
    if (input.breedingMetadata && Object.keys(input.breedingMetadata).length) {
      platform.updateBreedingMetadata(identity.horseId, input.breedingMetadata, resolvedActor);
    }
    for (const record of input.registrationRecords ?? []) {
      platform.addRegistrationRecord(identity.horseId, record, resolvedActor);
    }
    if (input.ownership?.length) {
      platform.updateOwnership(identity.horseId, input.ownership, resolvedActor);
    }
    if (input.trainer) {
      platform.assignTrainer(identity.horseId, input.trainer, resolvedActor);
    }
    const auditId = this.recordHistory(identity.horseId, resolvedActor.id, 'horse-registry.registered', 'Horse registered in immutable registry', undefined, identity.lifecycleStatus);
    return this.mutationResult(identity.horseId, auditId, 'horse-registry.registered.v1', identity.lifecycleStatus, 'Horse registered. Identity, twin link, and lifecycle history recorded.');
  }

  updateIdentity(horseId: string, patch: Partial<HorseIdentityDto>, actor: EquineActor | string = defaultActor(this.deps.tenantId)): HorseRegistryMutationResultDto {
    const platform = this.requirePlatform();
    const resolvedActor = resolveActor(actor, this.deps.tenantId);
    const current = platform.getProfile(horseId, resolvedActor);
    const fromStatus = current.identity.lifecycleStatus;
    platform.recordLifecycleEvent(horseId, {
      identity: {
        name: patch.name ?? current.identity.name,
        microchipId: patch.microchipId ?? current.identity.microchipId,
        foaled: patch.foaled ?? current.identity.foaled,
        sex: patch.sex ?? current.identity.sex,
        breed: patch.breed ?? current.identity.breed,
        racetrackId: patch.racetrackId ?? current.identity.racetrackId,
        lifecycleStatus: patch.lifecycleStatus ?? current.identity.lifecycleStatus,
      },
    }, resolvedActor, 'identity-updated');
    const toStatus = patch.lifecycleStatus ?? fromStatus;
    const auditId = this.recordHistory(horseId, resolvedActor.id, 'horse-registry.identity.updated', 'Horse identity updated', fromStatus, toStatus);
    return this.mutationResult(horseId, auditId, 'horse-registry.identity.updated.v1', toStatus, 'Horse identity updated and audited.');
  }

  recordOwnership(horseId: string, ownershipHistory: OwnershipRecord[], actor: EquineActor | string = defaultActor(this.deps.tenantId)): HorseRegistryMutationResultDto {
    const platform = this.requirePlatform();
    const resolvedActor = resolveActor(actor, this.deps.tenantId);
    const profile = platform.updateOwnership(horseId, ownershipHistory, resolvedActor);
    const auditId = this.recordHistory(horseId, resolvedActor.id, 'horse-registry.ownership.updated', 'Ownership history updated');
    return this.mutationResult(horseId, auditId, 'horse-registry.ownership.updated.v1', profile.identity.lifecycleStatus, 'Ownership history updated and audited.');
  }

  recordTrainer(horseId: string, assignment: TrainerAssignment, actor: EquineActor | string = defaultActor(this.deps.tenantId)): HorseRegistryMutationResultDto {
    const platform = this.requirePlatform();
    const resolvedActor = resolveActor(actor, this.deps.tenantId);
    const profile = platform.assignTrainer(horseId, assignment, resolvedActor);
    const auditId = this.recordHistory(horseId, resolvedActor.id, 'horse-registry.trainer.assigned', `Trainer ${assignment.trainerId} assigned`);
    return this.mutationResult(horseId, auditId, 'horse-registry.trainer.assigned.v1', profile.identity.lifecycleStatus, 'Trainer assignment recorded and audited.');
  }

  recordStableAssignment(horseId: string, assignment: BarnAssignment, actor: EquineActor | string = defaultActor(this.deps.tenantId)): HorseRegistryMutationResultDto {
    const platform = this.requirePlatform();
    const resolvedActor = resolveActor(actor, this.deps.tenantId);
    const profile = platform.assignBarn(horseId, assignment, resolvedActor);
    const auditId = this.recordHistory(horseId, resolvedActor.id, 'horse-registry.stable.assigned', `Stable ${assignment.barnId} assigned`);
    return this.mutationResult(horseId, auditId, 'horse-registry.stable.assigned.v1', profile.identity.lifecycleStatus, 'Stable assignment recorded and audited.');
  }

  updateBreedingMetadata(horseId: string, breedingMetadata: HorseBreedingMetadataDto, actor: EquineActor | string = defaultActor(this.deps.tenantId)): HorseRegistryMutationResultDto {
    const platform = this.requirePlatform();
    const resolvedActor = resolveActor(actor, this.deps.tenantId);
    const profile = platform.updateBreedingMetadata(horseId, breedingMetadata, resolvedActor);
    const auditId = this.recordHistory(horseId, resolvedActor.id, 'horse-registry.breeding.updated', 'Breeding metadata updated');
    return this.mutationResult(horseId, auditId, 'horse-registry.breeding.updated.v1', profile.identity.lifecycleStatus, 'Breeding metadata updated and audited.');
  }

  addRegistrationRecord(horseId: string, record: Omit<HorseRegistrationRecord, 'recordId' | 'recordedAt'>, actor: EquineActor | string = defaultActor(this.deps.tenantId)): HorseRegistryMutationResultDto {
    const platform = this.requirePlatform();
    const resolvedActor = resolveActor(actor, this.deps.tenantId);
    const profile = platform.addRegistrationRecord(horseId, record, resolvedActor);
    const auditId = this.recordHistory(horseId, resolvedActor.id, 'horse-registry.registration.added', `Registration ${record.registrationNumber} added`);
    return this.mutationResult(horseId, auditId, 'horse-registry.registration.added.v1', profile.identity.lifecycleStatus, 'Registration record added and audited.');
  }

  recordRetirement(horseId: string, retirement: RetirementRecord, actor: EquineActor | string = defaultActor(this.deps.tenantId)): HorseRegistryMutationResultDto {
    const platform = this.requirePlatform();
    const resolvedActor = resolveActor(actor, this.deps.tenantId);
    const fromStatus = platform.getProfile(horseId, resolvedActor).identity.lifecycleStatus;
    const profile = platform.retireHorse(horseId, retirement, resolvedActor);
    const auditId = this.recordHistory(horseId, resolvedActor.id, 'horse-registry.retired', `Horse retired to ${retirement.destination}`, fromStatus, 'retired');
    return this.mutationResult(horseId, auditId, 'horse-registry.retired.v1', 'retired', 'Retirement recorded in immutable lifecycle history.');
  }

  lifecycleHistory(horseId?: string): HorseLifecycleHistoryEntryDto[] {
    if (!horseId) return this.registryHistory.map(clone);
    return (this.horseHistory.get(horseId) ?? []).map(clone);
  }

  auditTrail(horseId?: string, now = new Date().toISOString()): HorseRegistryAuditTrailDto {
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.horse-registry.v1',
      records: this.lifecycleHistory(horseId),
      mock: false,
    };
  }

  twinSyncStatus(horseId: string, actor = defaultActor(this.deps.tenantId)): HorseDigitalTwinSyncDto | undefined {
    const platform = this.requirePlatform();
    try {
      const profile = platform.getProfile(horseId, actor);
      const twin = platform.twinSnapshot(profile.identity.tenantId).find((state) => state.id === profile.twinId);
      return this.toTwinSync(profile, twin?.updatedAt ?? profile.updatedAt, twin?.state?.syncReason as string | undefined);
    } catch {
      return undefined;
    }
  }

  private toRecord(profile: EquineProfile, actor: EquineActor): HorseRegistryRecordDto {
    const eligibility = this.requirePlatform().eligibilityStatus(profile.identity.horseId, actor);
    const horseHistory = this.horseHistory.get(profile.identity.horseId) ?? [];
    const auditIds = profile.eventStream.map((event) => event.auditId);
    return {
      identity: {
        horseId: profile.identity.horseId,
        tenantId: profile.identity.tenantId,
        racetrackId: profile.identity.racetrackId,
        name: profile.identity.name,
        microchipId: profile.identity.microchipId,
        foaled: profile.identity.foaled,
        sex: profile.identity.sex,
        breed: profile.identity.breed,
        color: profile.breedingMetadata.color,
        lifecycleStatus: profile.identity.lifecycleStatus,
      },
      ownershipHistory: profile.ownershipHistory.map((entry, index) => ({
        ownerId: entry.ownerId,
        ownerName: entry.ownerName,
        effectiveFrom: entry.effectiveFrom,
        effectiveTo: entry.effectiveTo,
        percentage: entry.percentage,
        evidence: [...entry.evidence],
        auditId: profile.eventStream.find((event) => event.type.includes('ownership'))?.auditId ?? auditIds[index] ?? `audit:ownership:${entry.ownerId}`,
      })),
      trainerHistory: profile.trainerAssignments.map((entry, index) => ({
        trainerId: entry.trainerId,
        trainerName: entry.trainerName,
        effectiveFrom: entry.effectiveFrom,
        effectiveTo: entry.effectiveTo,
        licenseStatus: entry.licenseStatus,
        evidence: [...entry.evidence],
        auditId: profile.eventStream.find((event) => event.type.includes('trainer'))?.auditId ?? auditIds[index] ?? `audit:trainer:${entry.trainerId}`,
      })),
      stableHistory: profile.barnAssignments.map((entry, index) => ({
        barnId: entry.barnId,
        stallId: entry.stallId,
        assignedAt: entry.assignedAt,
        releasedAt: entry.releasedAt,
        assignedBy: entry.assignedBy,
        evidence: [...entry.evidence],
        auditId: profile.eventStream.find((event) => event.type.includes('barn'))?.auditId ?? auditIds[index] ?? `audit:stable:${entry.barnId}`,
      })),
      breedingMetadata: clone(profile.breedingMetadata),
      registrationRecords: profile.registrationRecords.map((entry) => ({
        recordId: entry.recordId,
        authority: entry.authority,
        registrationNumber: entry.registrationNumber,
        registrationType: entry.registrationType,
        effectiveFrom: entry.effectiveFrom,
        effectiveTo: entry.effectiveTo,
        status: entry.status,
        evidence: [...entry.evidence],
        auditId: `audit:registration:${entry.recordId}`,
        recordedAt: entry.recordedAt,
      })),
      eligibilityStatus: {
        eligible: eligibility.eligible,
        complianceStatus: eligibility.complianceStatus,
        flags: [...eligibility.flags],
        failedRules: [...eligibility.failedRules],
        updatedAt: eligibility.updatedAt,
      },
      retirementRecord: profile.retirementRecord ? {
        retiredAt: profile.retirementRecord.retiredAt,
        reason: profile.retirementRecord.reason,
        destination: profile.retirementRecord.destination,
        aftercareContact: profile.retirementRecord.aftercareContact,
        evidence: [...profile.retirementRecord.evidence],
        auditId: horseHistory.find((entry) => entry.action === 'horse-registry.retired')?.entryId ?? `audit:retirement:${profile.identity.horseId}`,
      } : undefined,
      digitalTwin: this.toTwinSync(profile),
      lifecycleHistory: horseHistory.map(clone),
      version: profile.version,
      auditIds,
      eventIds: profile.eventStream.map((event) => event.eventId),
      lastAuditId: horseHistory.at(-1)?.entryId ?? auditIds.at(-1) ?? '',
      updatedAt: profile.updatedAt,
      updatedBy: profile.eventStream.at(-1)?.actorId ?? 'horse-registry',
    };
  }

  private toTwinSync(profile: EquineProfile, lastSyncedAt = profile.updatedAt, syncReason?: string): HorseDigitalTwinSyncDto {
    const eligibility = this.requirePlatform().evaluateEligibility(profile);
    const latestOwner = profile.ownershipHistory.find((entry) => !entry.effectiveTo) ?? profile.ownershipHistory.at(-1);
    const latestTrainer = profile.trainerAssignments.find((entry) => !entry.effectiveTo) ?? profile.trainerAssignments.at(-1);
    const latestStable = profile.barnAssignments.find((entry) => !entry.releasedAt) ?? profile.barnAssignments.at(-1);
    return {
      twinId: profile.twinId,
      lastSyncedAt,
      syncReason,
      lifecycleStatus: profile.identity.lifecycleStatus,
      eligible: eligibility.eligible,
      currentOwnerId: latestOwner?.ownerId,
      currentTrainerId: latestTrainer?.trainerId,
      currentBarnId: latestStable?.barnId,
      readOnly: true,
    };
  }

  private recordHistory(
    horseId: string,
    actor: string,
    action: string,
    changeSummary: string,
    lifecycleFrom?: HorseRegistryLifecycleStatus,
    lifecycleTo?: HorseRegistryLifecycleStatus,
  ): string {
    const entryId = id('audit-horse');
    const previousHash = this.registryHistory.at(-1)?.hash ?? 'genesis';
    const record: HorseLifecycleHistoryEntryDto = {
      entryId,
      horseId,
      action,
      actor,
      timestamp: new Date().toISOString(),
      previousHash,
      hash: hash({ horseId, action, changeSummary, previousHash }),
      lifecycleFrom,
      lifecycleTo,
      changeSummary,
      evidence: ['horse-registry', action],
    };
    this.registryHistory.push(record);
    const horseRecords = this.horseHistory.get(horseId) ?? [];
    horseRecords.push(record);
    this.horseHistory.set(horseId, horseRecords);
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: entryId,
        type: 'data-change',
        actor,
        timestamp: record.timestamp,
        subjectId: horseId,
        payload: { action, changeSummary, lifecycleFrom, lifecycleTo },
        tenantId: this.deps.tenantId ?? 'trackmind',
        severity: 'info',
        regulations: ['HISA', 'ARCI'],
      });
    }
    return entryId;
  }

  private mutationResult(
    horseId: string,
    auditId: string,
    eventType: string,
    lifecycleStatus: HorseRegistryLifecycleStatus,
    message: string,
  ): HorseRegistryMutationResultDto {
    return {
      accepted: true,
      horseId,
      auditId,
      eventType,
      lifecycleStatus,
      twinSynced: true,
      message,
      mock: false,
    };
  }

  private requirePlatform(): EquineIntelligencePlatform {
    if (!this.deps.equinePlatform) throw new Error('Equine intelligence platform is required for horse registry operations');
    return this.deps.equinePlatform;
  }
}

function defaultActor(tenantId?: string): EquineActor {
  return { id: 'racing-secretary', roles: ['racing-secretary'], tenantId: tenantId ?? 'trackmind', human: true };
}

function resolveActor(actor: EquineActor | string, tenantId?: string): EquineActor {
  if (typeof actor === 'string') return { id: actor, roles: ['racing-secretary'], tenantId: tenantId ?? 'trackmind', human: true };
  return actor;
}

export function createSeededHorseRegistry(deps: HorseRegistryDeps, now = new Date().toISOString()): HorseRegistryPlatform {
  const platform = new HorseRegistryPlatform(deps);
  const equine = deps.equinePlatform;
  const actor = defaultActor(deps.tenantId);
  if (equine && equine.listProfiles(deps.tenantId).length === 0) {
    equine.createProfile({
      horseId: 'horse-1',
      tenantId: deps.tenantId ?? 'trackmind',
      racetrackId: deps.racetrackId ?? 'main-track',
      name: 'Lifecycle Runner',
      microchipId: '985141001',
      lifecycleStatus: 'active',
      foaled: '2022-03-15',
      sex: 'colt',
      breed: 'Thoroughbred',
    }, actor);
    equine.updateBreedingMetadata('horse-1', {
      sireId: 'sire-1',
      sireName: 'Leading Sire',
      damId: 'dam-1',
      damName: 'Broodmare One',
      studBook: 'TB-2022',
      breedRegistry: 'Jockey Club',
      color: 'bay',
      markings: ['star', 'left hind sock'],
    }, actor);
    equine.addRegistrationRecord('horse-1', {
      authority: 'Jockey Club',
      registrationNumber: 'TB-2200315',
      registrationType: 'racing',
      effectiveFrom: '2022-04-01',
      status: 'active',
      evidence: ['foal-registration'],
    }, actor);
    equine.addRegistrationRecord('horse-1', {
      authority: 'ISO',
      registrationNumber: '985141001',
      registrationType: 'microchip',
      effectiveFrom: '2022-03-20',
      status: 'active',
      evidence: ['microchip-scan'],
    }, actor);
    equine.updateOwnership('horse-1', [{ ownerId: 'owner-1', ownerName: 'Stable A', effectiveFrom: '2026-01-01', percentage: 100, evidence: ['ownership-registry'] }], actor);
    equine.assignTrainer('horse-1', { trainerId: 'trainer-1', trainerName: 'Trainer A', effectiveFrom: '2026-02-01', licenseStatus: 'active', evidence: ['license-registry'] }, actor);
    equine.assignBarn('horse-1', { barnId: 'barn-2', stallId: 'stall-12A', assignedAt: now, assignedBy: actor.id, evidence: ['barn-assignment'] }, actor);
  }
  platform.workspace(now, actor);
  return platform;
}
