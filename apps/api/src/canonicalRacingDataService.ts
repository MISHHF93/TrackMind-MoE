import type { SurfaceType } from './trackSurface.js';

export type CanonicalRacingArtifactKind =
  | 'RaceCard'
  | 'Race'
  | 'RaceEntry'
  | 'RaceResult'
  | 'HorseIdentity'
  | 'PersonIdentity'
  | 'Workout'
  | 'PastPerformance'
  | 'SurfaceCondition'
  | 'StewardRuling'
  | 'RegulatoryRecord';

export interface CanonicalProviderRef {
  providerId: string;
  sourceSystem: string;
  sourceRecordId: string;
  sourceEntityType?: string;
  sourceFieldPath?: string;
  uri?: string;
}

export interface CanonicalProvenance {
  providerRef: CanonicalProviderRef;
  receivedAt: string;
  normalizedAt: string;
  normalizedBy: string;
  feedId?: string;
  evidence: string[];
  official?: boolean;
  confidence?: number;
}

export interface CanonicalReadOnlySafetySemantics {
  readMostly: true;
  operationalMutationAllowed: false;
  normalizedIngestionOnly: true;
  officialResultLocked?: boolean;
  officialResultChangeRequiresControlledWorkflow?: boolean;
  stewardNotesMayModifyOfficialResults: false;
  aiMayIssueOfficialRuling: false;
}

export interface CanonicalArtifact<TKind extends CanonicalRacingArtifactKind = CanonicalRacingArtifactKind, TPayload = unknown> {
  schemaVersion: 'trackmind.canonical-racing-data.v1';
  kind: TKind;
  id: string;
  tenantId: string;
  racetrackId?: string;
  raceId?: string;
  horseId?: string;
  providerRefs: CanonicalProviderRef[];
  provenance: CanonicalProvenance[];
  payload: TPayload;
  safetySemantics: CanonicalReadOnlySafetySemantics;
  artifactVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalRaceCard {
  id: string;
  tenantId: string;
  racetrackId: string;
  raceDate: string;
  status: 'draft' | 'entries-open' | 'ready' | 'official' | 'cancelled' | string;
  raceIds: string[];
  providerRefs?: CanonicalProviderRef[];
}

export interface CanonicalRace {
  id: string;
  tenantId: string;
  racetrackId: string;
  raceCardId: string;
  raceDate: string;
  raceNumber: number;
  scheduledPostTime?: string;
  surface: SurfaceType;
  distanceFurlongs?: number;
  status: 'scheduled' | 'running' | 'official' | 'cancelled' | string;
  entryIds: string[];
  resultId?: string;
  providerRefs?: CanonicalProviderRef[];
}

export interface CanonicalRaceEntry {
  id: string;
  tenantId: string;
  raceId: string;
  horseId: string;
  trainerId?: string;
  ownerId?: string;
  jockeyId?: string;
  programNumber?: string;
  postPosition?: number;
  scratched?: boolean;
  finishPosition?: number;
  providerRefs?: CanonicalProviderRef[];
}

export interface CanonicalRaceResult {
  id: string;
  tenantId: string;
  raceId: string;
  status: 'unofficial' | 'official';
  official: boolean;
  officialAt?: string;
  finishOrder: Array<{ entryId: string; horseId: string; position: number; disqualified?: boolean }>;
  chartUri?: string;
  stewardRulingIds: string[];
  providerRefs?: CanonicalProviderRef[];
}

export interface CanonicalHorseIdentity {
  id: string;
  tenantId: string;
  name: string;
  registrationNumber?: string;
  microchipId?: string;
  foaled?: string;
  sex?: 'colt' | 'filly' | 'gelding' | 'mare' | 'stallion';
  breed?: string;
  providerRefs?: CanonicalProviderRef[];
}

export interface CanonicalPersonIdentity {
  id: string;
  tenantId: string;
  personType: 'owner' | 'trainer' | 'jockey' | 'veterinarian' | 'steward' | 'racing-official' | 'other';
  displayName: string;
  licenseNumber?: string;
  jurisdiction?: string;
  providerRefs?: CanonicalProviderRef[];
}

export interface CanonicalWorkout {
  id: string;
  tenantId: string;
  horseId: string;
  racetrackId: string;
  workedAt: string;
  distanceFurlongs: number;
  timeSeconds: number;
  surface: SurfaceType | string;
  sourceNote?: string;
  providerRefs?: CanonicalProviderRef[];
}

export interface CanonicalPastPerformance {
  id: string;
  tenantId: string;
  horseId: string;
  raceId: string;
  raceDate: string;
  racetrackId: string;
  finishPosition?: number;
  officialResultRef?: string;
  providerRefs?: CanonicalProviderRef[];
}

export interface CanonicalSurfaceCondition {
  id: string;
  tenantId: string;
  racetrackId: string;
  raceId?: string;
  observedAt: string;
  surface: SurfaceType;
  condition: string;
  moisture?: number;
  sealed?: boolean;
  providerRefs?: CanonicalProviderRef[];
}

export interface CanonicalStewardRuling {
  id: string;
  tenantId: string;
  raceId: string;
  issuedAt: string;
  issuedBy: string;
  decision: string;
  notes: string;
  evidenceIds: string[];
  officialResultsModified: false;
  officialResultRef?: string;
  providerRefs?: CanonicalProviderRef[];
}

export interface CanonicalRegulatoryRecord {
  id: string;
  tenantId: string;
  subjectType: CanonicalRacingArtifactKind | 'provider-feed' | 'jurisdiction-rule';
  subjectId: string;
  authority: string;
  recordType: string;
  recordedAt: string;
  summary: string;
  evidence: string[];
  providerRefs?: CanonicalProviderRef[];
}

export type CanonicalRaceCardArtifact = CanonicalArtifact<'RaceCard', CanonicalRaceCard>;
export type CanonicalRaceArtifact = CanonicalArtifact<'Race', CanonicalRace>;
export type CanonicalRaceEntryArtifact = CanonicalArtifact<'RaceEntry', CanonicalRaceEntry>;
export type CanonicalRaceResultArtifact = CanonicalArtifact<'RaceResult', CanonicalRaceResult>;
export type CanonicalHorseIdentityArtifact = CanonicalArtifact<'HorseIdentity', CanonicalHorseIdentity>;
export type CanonicalPersonIdentityArtifact = CanonicalArtifact<'PersonIdentity', CanonicalPersonIdentity>;
export type CanonicalWorkoutArtifact = CanonicalArtifact<'Workout', CanonicalWorkout>;
export type CanonicalPastPerformanceArtifact = CanonicalArtifact<'PastPerformance', CanonicalPastPerformance>;
export type CanonicalSurfaceConditionArtifact = CanonicalArtifact<'SurfaceCondition', CanonicalSurfaceCondition>;
export type CanonicalStewardRulingArtifact = CanonicalArtifact<'StewardRuling', CanonicalStewardRuling>;
export type CanonicalRegulatoryRecordArtifact = CanonicalArtifact<'RegulatoryRecord', CanonicalRegulatoryRecord>;

export interface NormalizedRaceCardIngestion {
  tenantId: string;
  raceCard: CanonicalRaceCard;
  races?: CanonicalRace[];
  entries?: CanonicalRaceEntry[];
  result?: CanonicalRaceResult;
  provenance: CanonicalProvenance;
}

export interface CanonicalRaceBundle {
  tenantId: string;
  raceId: string;
  race?: CanonicalRaceArtifact;
  raceCard?: CanonicalRaceCardArtifact;
  entries: CanonicalRaceEntryArtifact[];
  result?: CanonicalRaceResultArtifact;
  stewardRulings: CanonicalStewardRulingArtifact[];
  surfaceConditions: CanonicalSurfaceConditionArtifact[];
  regulatoryRecords: CanonicalRegulatoryRecordArtifact[];
  pastPerformances: CanonicalPastPerformanceArtifact[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function artifactKey(tenantId: string, kind: CanonicalRacingArtifactKind, id: string): string {
  return `${tenantId}:${kind}:${id}`;
}

function providerRefMatches(candidate: CanonicalProviderRef, query: Partial<CanonicalProviderRef>): boolean {
  return (!query.providerId || candidate.providerId === query.providerId)
    && (!query.sourceSystem || candidate.sourceSystem === query.sourceSystem)
    && (!query.sourceRecordId || candidate.sourceRecordId === query.sourceRecordId)
    && (!query.sourceEntityType || candidate.sourceEntityType === query.sourceEntityType)
    && (!query.sourceFieldPath || candidate.sourceFieldPath === query.sourceFieldPath)
    && (!query.uri || candidate.uri === query.uri);
}

function uniqueProviderRefs(refs: CanonicalProviderRef[]): CanonicalProviderRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = JSON.stringify([ref.providerId, ref.sourceSystem, ref.sourceEntityType ?? '', ref.sourceRecordId, ref.sourceFieldPath ?? '', ref.uri ?? '']);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(clone);
}

function baseSafety(officialResultLocked = false): CanonicalReadOnlySafetySemantics {
  return {
    readMostly: true,
    operationalMutationAllowed: false,
    normalizedIngestionOnly: true,
    officialResultLocked,
    officialResultChangeRequiresControlledWorkflow: officialResultLocked,
    stewardNotesMayModifyOfficialResults: false,
    aiMayIssueOfficialRuling: false,
  };
}

export class CanonicalRacingDataService {
  private readonly artifacts = new Map<string, CanonicalArtifact>();

  ingestNormalizedRaceCard(input: NormalizedRaceCardIngestion): CanonicalRaceBundle {
    this.assertTenant(input.tenantId, input.raceCard);
    const raceCard = this.upsert('RaceCard', input.raceCard.id, input.tenantId, input.raceCard, input.provenance, { racetrackId: input.raceCard.racetrackId });
    for (const race of input.races ?? []) this.ingestNormalizedRace({ tenantId: input.tenantId, race, provenance: input.provenance });
    for (const entry of input.entries ?? []) this.ingestNormalizedRaceEntry({ tenantId: input.tenantId, entry, provenance: input.provenance });
    if (input.result) this.ingestNormalizedRaceResult({ tenantId: input.tenantId, result: input.result, provenance: input.provenance });
    return this.queryByRace(input.tenantId, input.races?.[0]?.id ?? input.raceCard.raceIds[0] ?? raceCard.payload.id);
  }

  ingestNormalizedRace(input: { tenantId: string; race: CanonicalRace; provenance: CanonicalProvenance }): CanonicalRaceArtifact {
    this.assertTenant(input.tenantId, input.race);
    if (input.race.raceNumber < 1) throw new Error('Race number must be positive');
    return this.upsert('Race', input.race.id, input.tenantId, input.race, input.provenance, { racetrackId: input.race.racetrackId, raceId: input.race.id });
  }

  ingestNormalizedRaceEntry(input: { tenantId: string; entry: CanonicalRaceEntry; provenance: CanonicalProvenance }): CanonicalRaceEntryArtifact {
    this.assertTenant(input.tenantId, input.entry);
    return this.upsert('RaceEntry', input.entry.id, input.tenantId, input.entry, input.provenance, { raceId: input.entry.raceId, horseId: input.entry.horseId });
  }

  ingestNormalizedRaceResult(input: { tenantId: string; result: CanonicalRaceResult; provenance: CanonicalProvenance }): CanonicalRaceResultArtifact {
    this.assertTenant(input.tenantId, input.result);
    if (input.result.official && input.result.status !== 'official') throw new Error('Official race results must use official status');
    if (new Set(input.result.finishOrder.map((item) => item.position)).size !== input.result.finishOrder.length) throw new Error('Race result finish positions must be unique');
    return this.upsert('RaceResult', input.result.id, input.tenantId, input.result, { ...input.provenance, official: input.result.official || input.provenance.official }, { raceId: input.result.raceId, lockedOfficialResult: input.result.official || input.result.status === 'official' });
  }

  ingestNormalizedHorseIdentity(input: { tenantId: string; horse: CanonicalHorseIdentity; provenance: CanonicalProvenance }): CanonicalHorseIdentityArtifact {
    this.assertTenant(input.tenantId, input.horse);
    return this.upsert('HorseIdentity', input.horse.id, input.tenantId, input.horse, input.provenance, { horseId: input.horse.id });
  }

  ingestNormalizedPersonIdentity(input: { tenantId: string; person: CanonicalPersonIdentity; provenance: CanonicalProvenance }): CanonicalPersonIdentityArtifact {
    this.assertTenant(input.tenantId, input.person);
    return this.upsert('PersonIdentity', input.person.id, input.tenantId, input.person, input.provenance);
  }

  ingestNormalizedWorkout(input: { tenantId: string; workout: CanonicalWorkout; provenance: CanonicalProvenance }): CanonicalWorkoutArtifact {
    this.assertTenant(input.tenantId, input.workout);
    if (input.workout.distanceFurlongs <= 0 || input.workout.timeSeconds <= 0) throw new Error('Workout distance and time must be positive');
    return this.upsert('Workout', input.workout.id, input.tenantId, input.workout, input.provenance, { racetrackId: input.workout.racetrackId, horseId: input.workout.horseId });
  }

  ingestNormalizedPastPerformance(input: { tenantId: string; pastPerformance: CanonicalPastPerformance; provenance: CanonicalProvenance }): CanonicalPastPerformanceArtifact {
    this.assertTenant(input.tenantId, input.pastPerformance);
    return this.upsert('PastPerformance', input.pastPerformance.id, input.tenantId, input.pastPerformance, input.provenance, { racetrackId: input.pastPerformance.racetrackId, raceId: input.pastPerformance.raceId, horseId: input.pastPerformance.horseId });
  }

  ingestNormalizedSurfaceCondition(input: { tenantId: string; surfaceCondition: CanonicalSurfaceCondition; provenance: CanonicalProvenance }): CanonicalSurfaceConditionArtifact {
    this.assertTenant(input.tenantId, input.surfaceCondition);
    return this.upsert('SurfaceCondition', input.surfaceCondition.id, input.tenantId, input.surfaceCondition, input.provenance, { racetrackId: input.surfaceCondition.racetrackId, raceId: input.surfaceCondition.raceId });
  }

  ingestNormalizedStewardRuling(input: { tenantId: string; ruling: CanonicalStewardRuling; provenance: CanonicalProvenance }): CanonicalStewardRulingArtifact {
    this.assertTenant(input.tenantId, input.ruling);
    if (input.ruling.officialResultsModified !== false) throw new Error('Steward notes and rulings may not mutate official race results in the canonical data service');
    const result = this.queryByRace(input.tenantId, input.ruling.raceId).result;
    const payload = { ...input.ruling, officialResultRef: input.ruling.officialResultRef ?? result?.id };
    return this.upsert('StewardRuling', payload.id, input.tenantId, payload, input.provenance, { raceId: payload.raceId });
  }

  ingestNormalizedRegulatoryRecord(input: { tenantId: string; record: CanonicalRegulatoryRecord; provenance: CanonicalProvenance }): CanonicalRegulatoryRecordArtifact {
    this.assertTenant(input.tenantId, input.record);
    return this.upsert('RegulatoryRecord', input.record.id, input.tenantId, input.record, input.provenance);
  }

  getArtifact<TKind extends CanonicalRacingArtifactKind>(tenantId: string, kind: TKind, id: string): Extract<CanonicalArtifact, { kind: TKind }> | undefined {
    return this.cloneArtifact(this.artifacts.get(artifactKey(tenantId, kind, id))) as Extract<CanonicalArtifact, { kind: TKind }> | undefined;
  }

  listByTenant(tenantId: string, kind?: CanonicalRacingArtifactKind): CanonicalArtifact[] {
    return [...this.artifacts.values()]
      .filter((artifact) => artifact.tenantId === tenantId && (!kind || artifact.kind === kind))
      .map((artifact) => this.cloneArtifact(artifact));
  }

  queryByProviderRef(tenantId: string, providerRef: Partial<CanonicalProviderRef>): CanonicalArtifact[] {
    return this.listByTenant(tenantId)
      .filter((artifact) => artifact.providerRefs.some((ref) => providerRefMatches(ref, providerRef)));
  }

  queryByRace(tenantId: string, raceId: string): CanonicalRaceBundle {
    const artifacts = this.listByTenant(tenantId);
    const race = artifacts.find((artifact): artifact is CanonicalRaceArtifact => artifact.kind === 'Race' && artifact.id === raceId);
    const raceCard = artifacts.find((artifact): artifact is CanonicalRaceCardArtifact => {
      if (artifact.kind !== 'RaceCard') return false;
      const payload = artifact.payload as CanonicalRaceCard;
      return payload.raceIds.includes(raceId) || race?.payload.raceCardId === artifact.id;
    });
    return {
      tenantId,
      raceId,
      race,
      raceCard,
      entries: artifacts.filter((artifact): artifact is CanonicalRaceEntryArtifact => artifact.kind === 'RaceEntry' && artifact.raceId === raceId),
      result: artifacts.find((artifact): artifact is CanonicalRaceResultArtifact => artifact.kind === 'RaceResult' && artifact.raceId === raceId),
      stewardRulings: artifacts.filter((artifact): artifact is CanonicalStewardRulingArtifact => artifact.kind === 'StewardRuling' && artifact.raceId === raceId),
      surfaceConditions: artifacts.filter((artifact): artifact is CanonicalSurfaceConditionArtifact => artifact.kind === 'SurfaceCondition' && artifact.raceId === raceId),
      regulatoryRecords: artifacts.filter((artifact): artifact is CanonicalRegulatoryRecordArtifact => artifact.kind === 'RegulatoryRecord' && (artifact.payload as CanonicalRegulatoryRecord).subjectId === raceId),
      pastPerformances: artifacts.filter((artifact): artifact is CanonicalPastPerformanceArtifact => artifact.kind === 'PastPerformance' && artifact.raceId === raceId),
    };
  }

  canonicalState(tenantId?: string): { artifacts: CanonicalArtifact[]; totals: Record<string, number>; readMostly: true } {
    const artifacts = tenantId ? this.listByTenant(tenantId) : [...this.artifacts.values()].map((artifact) => this.cloneArtifact(artifact));
    const totals = artifacts.reduce<Record<string, number>>((acc, artifact) => {
      acc[artifact.kind] = (acc[artifact.kind] ?? 0) + 1;
      return acc;
    }, {});
    return { artifacts, totals, readMostly: true };
  }

  private upsert<TKind extends CanonicalRacingArtifactKind, TPayload extends { providerRefs?: CanonicalProviderRef[]; tenantId: string }>(
    kind: TKind,
    id: string,
    tenantId: string,
    payload: TPayload,
    provenance: CanonicalProvenance,
    scope: { racetrackId?: string; raceId?: string; horseId?: string; lockedOfficialResult?: boolean } = {},
  ): CanonicalArtifact<TKind, TPayload> {
    if (!provenance.evidence.length) throw new Error('Canonical ingestion requires provenance evidence');
    const key = artifactKey(tenantId, kind, id);
    const current = this.artifacts.get(key) as CanonicalArtifact<TKind, TPayload> | undefined;
    const lockedOfficialResult = scope.lockedOfficialResult ?? (kind === 'RaceResult' && (payload as unknown as CanonicalRaceResult).official);
    if (current?.kind === 'RaceResult' && current.safetySemantics.officialResultLocked && !this.sameOfficialResult(current.payload as unknown as CanonicalRaceResult, payload as unknown as CanonicalRaceResult)) {
      throw new Error('Official race results are locked; changes require a controlled results-modification workflow');
    }
    const now = provenance.normalizedAt;
    const providerRefs = uniqueProviderRefs([...(current?.providerRefs ?? []), ...(payload.providerRefs ?? []), provenance.providerRef]);
    const artifact: CanonicalArtifact<TKind, TPayload> = {
      schemaVersion: 'trackmind.canonical-racing-data.v1',
      kind,
      id,
      tenantId,
      racetrackId: scope.racetrackId ?? current?.racetrackId,
      raceId: scope.raceId ?? current?.raceId,
      horseId: scope.horseId ?? current?.horseId,
      providerRefs,
      provenance: [...(current?.provenance ?? []), clone(provenance)],
      payload: clone({ ...payload, providerRefs }),
      safetySemantics: baseSafety(Boolean(current?.safetySemantics.officialResultLocked || lockedOfficialResult)),
      artifactVersion: (current?.artifactVersion ?? 0) + 1,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    this.artifacts.set(key, clone(artifact));
    return clone(artifact);
  }

  private sameOfficialResult(a: CanonicalRaceResult, b: CanonicalRaceResult): boolean {
    const materialA = { status: a.status, official: a.official, officialAt: a.officialAt, finishOrder: a.finishOrder };
    const materialB = { status: b.status, official: b.official, officialAt: b.officialAt, finishOrder: b.finishOrder };
    return JSON.stringify(materialA) === JSON.stringify(materialB);
  }

  private assertTenant(tenantId: string, value: { tenantId: string }): void {
    if (value.tenantId !== tenantId) throw new Error('Tenant boundary violation');
  }

  private cloneArtifact<T extends CanonicalArtifact | undefined>(artifact: T): T {
    return artifact ? clone(artifact) as T : artifact;
  }
}

export function canonicalRacingDataServiceBlueprint() {
  return {
    service: 'canonical-racing-data',
    apiBasePath: '/api/v1/canonical-racing-data',
    artifacts: ['RaceCard', 'Race', 'RaceEntry', 'RaceResult', 'HorseIdentity', 'PersonIdentity', 'Workout', 'PastPerformance', 'SurfaceCondition', 'StewardRuling', 'RegulatoryRecord'] as CanonicalRacingArtifactKind[],
    writeModel: 'normalized-ingestion-only',
    readModel: 'tenant-scoped provider-reference and race bundle queries',
    safetySemantics: 'Official results are locked; steward notes are preserved as provenance-aware records and cannot mutate official finish order.',
  };
}
