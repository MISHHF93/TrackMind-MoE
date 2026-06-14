export const entityResolutionSchemaVersion = 'trackmind.entity-resolution.v1' as const;
export const entityResolutionScorerVersion = 'trackmind.entity-resolution.scorer.v1' as const;

export const entityResolutionDecisions = ['auto_merged', 'review_required', 'rejected', 'new_entity'] as const;
export type EntityResolutionDecisionType = typeof entityResolutionDecisions[number];
export type EntityResolutionKind = 'horse' | 'person';

export interface EntityResolutionExternalId {
  provider: string;
  id: string;
  type?: 'provider' | 'registry' | 'license' | 'microchip' | 'other';
  scope?: string;
}

export interface EntityResolutionHistoryRef {
  id?: string;
  name?: string;
  provider?: string;
  externalId?: string;
  from?: string;
  to?: string;
}

export interface EntityResolutionRaceRef {
  raceId?: string;
  raceDate?: string;
  racetrackId?: string;
  raceNumber?: number;
  provider?: string;
  externalId?: string;
}

export interface ProviderIdentityBase {
  kind: EntityResolutionKind;
  canonicalId?: string;
  tenantId: string;
  racetrackId: string;
  sourceSystem?: string;
  name: string;
  country?: string;
  externalIds?: Record<string, string>;
  providerIds?: EntityResolutionExternalId[];
  registryRefs?: EntityResolutionExternalId[];
  evidenceRefs?: string[];
  lineage?: string[];
}

export interface HorseProviderIdentity extends ProviderIdentityBase {
  kind: 'horse';
  foalingDate?: string;
  sireName?: string;
  damName?: string;
  registrationNumber?: string;
  microchipId?: string;
  trainerHistory?: EntityResolutionHistoryRef[];
  ownerHistory?: EntityResolutionHistoryRef[];
  raceHistory?: EntityResolutionRaceRef[];
}

export interface PersonProviderIdentity extends ProviderIdentityBase {
  kind: 'person';
  roles?: Array<'trainer' | 'owner' | 'jockey' | 'veterinarian' | 'steward' | 'employee' | string>;
  licenseNumber?: string;
  licenseJurisdiction?: string;
  licenseRefs?: EntityResolutionExternalId[];
  affiliations?: EntityResolutionHistoryRef[];
  raceHistory?: EntityResolutionRaceRef[];
}

export type ProviderEntityIdentity = HorseProviderIdentity | PersonProviderIdentity;

export interface EntityResolutionEvidence {
  field: string;
  weight: number;
  score: number;
  contribution: number;
  comparable: boolean;
  matched: boolean;
  reason: string;
  sourceValue?: string;
  candidateValue?: string;
}

export interface EntityResolutionCandidateScore {
  canonicalId: string;
  candidateExternalIds: string[];
  matchConfidence: number;
  exactProviderIdMatch: boolean;
  exactRegistryMatch: boolean;
  evidence: EntityResolutionEvidence[];
}

export interface EntityResolutionLineage {
  sourceSystem: string;
  correlationId: string;
  inputExternalIds: string[];
  candidateCanonicalIds: string[];
  scorerVersion: typeof entityResolutionScorerVersion;
  inputEvidenceRefs: string[];
  inputLineage: string[];
}

export interface EntityResolutionDecisionArtifact {
  schemaVersion: typeof entityResolutionSchemaVersion;
  artifactType: 'entity-resolution-decision';
  artifactId: string;
  entityKind: EntityResolutionKind;
  tenant: { tenantId: string; racetrackId: string };
  tenantId: string;
  racetrackId: string;
  canonicalId: string;
  candidateCanonicalIds: string[];
  candidateExternalIds: string[];
  matchConfidence: number;
  decision: EntityResolutionDecisionType;
  reviewRequired: boolean;
  evidence: EntityResolutionEvidence[];
  lineage: EntityResolutionLineage;
  createdAt: string;
}

export interface EntityResolutionOptions {
  autoMergeThreshold?: number;
  reviewThreshold?: number;
  newEntityThreshold?: number;
  ambiguityDelta?: number;
  allowCreateNewEntity?: boolean;
  sourceSystem?: string;
  correlationId?: string;
  now?: string;
}

const defaultOptions = {
  autoMergeThreshold: 0.86,
  reviewThreshold: 0.65,
  newEntityThreshold: 0.35,
  ambiguityDelta: 0.08,
  allowCreateNewEntity: true,
} as const;

const horseWeights = {
  providerIds: 0.28,
  registryRefs: 0.22,
  name: 0.18,
  foalingDate: 0.12,
  sireName: 0.07,
  damName: 0.07,
  country: 0.03,
  trainerHistory: 0.04,
  ownerHistory: 0.04,
  raceHistory: 0.05,
} as const;

const personWeights = {
  providerIds: 0.35,
  licenseRefs: 0.25,
  name: 0.25,
  country: 0.05,
  roles: 0.05,
  affiliations: 0.05,
  raceHistory: 0.05,
} as const;

export class EntityResolutionEngine {
  constructor(private readonly candidates: readonly ProviderEntityIdentity[] = [], private readonly options: EntityResolutionOptions = {}) {}

  resolve(source: ProviderEntityIdentity, candidates: readonly ProviderEntityIdentity[] = this.candidates, options: EntityResolutionOptions = {}): EntityResolutionDecisionArtifact {
    return resolveEntityIdentity(source, candidates, { ...this.options, ...options });
  }

  resolveHorse(source: HorseProviderIdentity, candidates: readonly HorseProviderIdentity[] = this.candidates.filter(isHorseIdentity), options: EntityResolutionOptions = {}): EntityResolutionDecisionArtifact {
    return resolveEntityIdentity(source, candidates, { ...this.options, ...options });
  }

  resolvePerson(source: PersonProviderIdentity, candidates: readonly PersonProviderIdentity[] = this.candidates.filter(isPersonIdentity), options: EntityResolutionOptions = {}): EntityResolutionDecisionArtifact {
    return resolveEntityIdentity(source, candidates, { ...this.options, ...options });
  }
}

export function resolveEntityIdentity(source: ProviderEntityIdentity, candidates: readonly ProviderEntityIdentity[], options: EntityResolutionOptions = {}): EntityResolutionDecisionArtifact {
  const resolvedOptions = { ...defaultOptions, ...options };
  const scopedCandidates = candidates.filter((candidate) => candidate.kind === source.kind && candidate.tenantId === source.tenantId && candidate.racetrackId === source.racetrackId);
  const scores = scopedCandidates.map((candidate) => scoreEntityIdentityMatch(source, candidate)).sort(compareCandidateScores);
  const best = scores[0];
  const second = scores[1];
  const ambiguous = Boolean(best && second && best.matchConfidence - second.matchConfidence < resolvedOptions.ambiguityDelta && second.matchConfidence >= resolvedOptions.reviewThreshold);

  let decision: EntityResolutionDecisionType;
  if (!best || best.matchConfidence < resolvedOptions.newEntityThreshold) {
    decision = resolvedOptions.allowCreateNewEntity ? 'new_entity' : 'rejected';
  } else if (!ambiguous && best.matchConfidence >= resolvedOptions.autoMergeThreshold) {
    decision = 'auto_merged';
  } else if (best.matchConfidence >= resolvedOptions.reviewThreshold) {
    decision = 'review_required';
  } else {
    decision = resolvedOptions.allowCreateNewEntity ? 'new_entity' : 'rejected';
  }

  const matchedScores = best ? scores.filter((score) => decision === 'review_required' ? score.matchConfidence >= resolvedOptions.reviewThreshold && best.matchConfidence - score.matchConfidence < resolvedOptions.ambiguityDelta : score.canonicalId === best.canonicalId) : [];
  const canonicalId = decision === 'new_entity' ? createEntityResolutionCanonicalId(source) : best?.canonicalId ?? createEntityResolutionCanonicalId(source);
  const createdAt = resolvedOptions.now ?? new Date().toISOString();
  const inputExternalIds = externalIdLabels(source);
  const candidateCanonicalIds = uniqueStrings(matchedScores.map((score) => score.canonicalId));
  const candidateExternalIds = uniqueStrings([...(decision === 'new_entity' ? inputExternalIds : []), ...matchedScores.flatMap((score) => score.candidateExternalIds)]);
  const evidence = best ? [...best.evidence] : [evidenceItem('candidateSearch', 1, 0, false, 'no in-scope candidates available')];

  if (ambiguous && best) {
    evidence.push(evidenceItem('candidateAmbiguity', 1, second?.matchConfidence ?? 0, true, `multiple candidates within ${resolvedOptions.ambiguityDelta} confidence of best score`, best.canonicalId, second?.canonicalId));
  }

  return {
    schemaVersion: entityResolutionSchemaVersion,
    artifactType: 'entity-resolution-decision',
    artifactId: `er-decision:${stablePart(source.tenantId)}:${stablePart(source.racetrackId)}:${stablePart(source.kind)}:${stablePart(canonicalId)}:${stablePart(createdAt)}`,
    entityKind: source.kind,
    tenant: { tenantId: source.tenantId, racetrackId: source.racetrackId },
    tenantId: source.tenantId,
    racetrackId: source.racetrackId,
    canonicalId,
    candidateCanonicalIds,
    candidateExternalIds,
    matchConfidence: best?.matchConfidence ?? 0,
    decision,
    reviewRequired: decision === 'review_required',
    evidence,
    lineage: {
      sourceSystem: resolvedOptions.sourceSystem ?? source.sourceSystem ?? 'provider-identity-feed',
      correlationId: resolvedOptions.correlationId ?? `er:${stablePart(source.tenantId)}:${stablePart(source.racetrackId)}:${stablePart(source.kind)}:${stablePart(source.name)}`,
      inputExternalIds,
      candidateCanonicalIds,
      scorerVersion: entityResolutionScorerVersion,
      inputEvidenceRefs: [...(source.evidenceRefs ?? [])],
      inputLineage: [...(source.lineage ?? [])],
    },
    createdAt,
  };
}

export function scoreEntityIdentityMatch(source: ProviderEntityIdentity, candidate: ProviderEntityIdentity): EntityResolutionCandidateScore {
  if (source.kind !== candidate.kind) {
    return {
      canonicalId: candidate.canonicalId ?? createEntityResolutionCanonicalId(candidate),
      candidateExternalIds: externalIdLabels(candidate),
      matchConfidence: 0,
      exactProviderIdMatch: false,
      exactRegistryMatch: false,
      evidence: [evidenceItem('kind', 1, 0, true, 'entity kinds differ', source.kind, candidate.kind)],
    };
  }
  return source.kind === 'horse' && candidate.kind === 'horse'
    ? scoreHorseIdentityMatch(source, candidate)
    : scorePersonIdentityMatch(source as PersonProviderIdentity, candidate as PersonProviderIdentity);
}

export function scoreHorseIdentityMatch(source: HorseProviderIdentity, candidate: HorseProviderIdentity): EntityResolutionCandidateScore {
  const providerScore = scoreIdentifierSet('providerIds', horseWeights.providerIds, providerIdKeys(source), providerIdKeys(candidate), 'provider external id');
  const registryScore = scoreIdentifierSet('registryRefs', horseWeights.registryRefs, registryIdKeys(source), registryIdKeys(candidate), 'registry reference');
  const evidence = [
    providerScore.evidence,
    registryScore.evidence,
    scoreNameField('name', horseWeights.name, source.name, candidate.name),
    scoreExactField('foalingDate', horseWeights.foalingDate, normalizeDate(source.foalingDate), normalizeDate(candidate.foalingDate)),
    scoreNameField('sireName', horseWeights.sireName, source.sireName, candidate.sireName),
    scoreNameField('damName', horseWeights.damName, source.damName, candidate.damName),
    scoreExactField('country', horseWeights.country, normalizeCountry(source.country), normalizeCountry(candidate.country)),
    scoreOverlapField('trainerHistory', horseWeights.trainerHistory, historyKeys(source.trainerHistory), historyKeys(candidate.trainerHistory)),
    scoreOverlapField('ownerHistory', horseWeights.ownerHistory, historyKeys(source.ownerHistory), historyKeys(candidate.ownerHistory)),
    scoreOverlapField('raceHistory', horseWeights.raceHistory, raceKeys(source.raceHistory), raceKeys(candidate.raceHistory)),
  ];
  const confidence = finalizeConfidence(evidence, providerScore.exact, registryScore.exact, 'horse');
  return {
    canonicalId: candidate.canonicalId ?? createEntityResolutionCanonicalId(candidate),
    candidateExternalIds: externalIdLabels(candidate),
    matchConfidence: confidence,
    exactProviderIdMatch: providerScore.exact,
    exactRegistryMatch: registryScore.exact,
    evidence,
  };
}

export function scorePersonIdentityMatch(source: PersonProviderIdentity, candidate: PersonProviderIdentity): EntityResolutionCandidateScore {
  const providerScore = scoreIdentifierSet('providerIds', personWeights.providerIds, providerIdKeys(source), providerIdKeys(candidate), 'provider external id');
  const licenseScore = scoreIdentifierSet('licenseRefs', personWeights.licenseRefs, personLicenseKeys(source), personLicenseKeys(candidate), 'license or registry reference');
  const evidence = [
    providerScore.evidence,
    licenseScore.evidence,
    scoreNameField('name', personWeights.name, source.name, candidate.name),
    scoreExactField('country', personWeights.country, normalizeCountry(source.country), normalizeCountry(candidate.country)),
    scoreOverlapField('roles', personWeights.roles, stringKeys(source.roles), stringKeys(candidate.roles)),
    scoreOverlapField('affiliations', personWeights.affiliations, historyKeys(source.affiliations), historyKeys(candidate.affiliations)),
    scoreOverlapField('raceHistory', personWeights.raceHistory, raceKeys(source.raceHistory), raceKeys(candidate.raceHistory)),
  ];
  const confidence = finalizeConfidence(evidence, providerScore.exact, licenseScore.exact, 'person');
  return {
    canonicalId: candidate.canonicalId ?? createEntityResolutionCanonicalId(candidate),
    candidateExternalIds: externalIdLabels(candidate),
    matchConfidence: confidence,
    exactProviderIdMatch: providerScore.exact,
    exactRegistryMatch: licenseScore.exact,
    evidence,
  };
}

export function normalizeEntityName(value?: string): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function createEntityResolutionCanonicalId(identity: Pick<ProviderIdentityBase, 'tenantId' | 'racetrackId' | 'kind' | 'name'>): string {
  return `canonical:${stablePart(identity.tenantId)}:${stablePart(identity.racetrackId)}:${stablePart(identity.kind)}:${stablePart(identity.name)}`;
}

function finalizeConfidence(evidence: readonly EntityResolutionEvidence[], exactProviderIdMatch: boolean, exactRegistryMatch: boolean, kind: EntityResolutionKind): number {
  if (exactProviderIdMatch) return 1;
  const comparable = evidence.filter((item) => item.comparable);
  const denominator = comparable.reduce((sum, item) => sum + item.weight, 0);
  const weighted = denominator === 0 ? 0 : comparable.reduce((sum, item) => sum + item.contribution, 0) / denominator;
  const rounded = roundConfidence(weighted);
  if (exactRegistryMatch) return Math.max(rounded, 0.92);

  const nameMatch = evidence.some((item) => item.field === 'name' && item.score >= 0.9);
  const supportingSignals = evidence.filter((item) => item.field !== 'name' && item.field !== 'providerIds' && item.score > 0).length;
  if (!nameMatch && supportingSignals === 0) return Math.min(rounded, 0.5);
  if (nameMatch && supportingSignals === 0) return Math.min(rounded, 0.62);
  if (kind === 'person' && nameMatch && supportingSignals === 1) return Math.min(rounded, 0.74);
  return rounded;
}

function scoreIdentifierSet(field: string, weight: number, source: readonly string[], candidate: readonly string[], label: string): { evidence: EntityResolutionEvidence; exact: boolean } {
  const sharedNamespaces = [...new Set(source.map(identifierNamespace))].filter((namespace) => candidate.map(identifierNamespace).includes(namespace));
  const sourceComparable = source.filter((item) => sharedNamespaces.includes(identifierNamespace(item)));
  const candidateComparable = candidate.filter((item) => sharedNamespaces.includes(identifierNamespace(item)));
  const comparable = sourceComparable.length > 0 && candidateComparable.length > 0;
  const matches = comparable ? sourceComparable.filter((item) => candidateComparable.includes(item)) : [];
  const score = matches.length > 0 ? 1 : 0;
  const reason = !comparable ? `${label} missing from source, candidate, or shared namespace` : matches.length > 0 ? `${label} exact match` : `${label} did not match`;
  return { evidence: evidenceItem(field, weight, score, comparable, reason, sourceComparable.join('|') || undefined, candidateComparable.join('|') || undefined), exact: matches.length > 0 };
}

function scoreExactField(field: string, weight: number, source?: string, candidate?: string): EntityResolutionEvidence {
  const comparable = Boolean(source && candidate);
  const score = comparable && source === candidate ? 1 : 0;
  const reason = !comparable ? `${field} missing from source or candidate` : score === 1 ? `${field} exact match` : `${field} differs`;
  return evidenceItem(field, weight, score, comparable, reason, source, candidate);
}

function scoreNameField(field: string, weight: number, source?: string, candidate?: string): EntityResolutionEvidence {
  const sourceName = normalizeEntityName(source);
  const candidateName = normalizeEntityName(candidate);
  const comparable = Boolean(sourceName && candidateName);
  const score = comparable ? nameSimilarity(sourceName, candidateName) : 0;
  const reason = !comparable ? `${field} missing from source or candidate` : score === 1 ? `${field} exact normalized match` : score >= 0.9 ? `${field} token order match` : score >= 0.5 ? `${field} partial token match` : `${field} differs`;
  return evidenceItem(field, weight, score, comparable, reason, sourceName || undefined, candidateName || undefined);
}

function scoreOverlapField(field: string, weight: number, source: readonly string[], candidate: readonly string[]): EntityResolutionEvidence {
  const comparable = source.length > 0 && candidate.length > 0;
  const sourceSet = new Set(source);
  const candidateSet = new Set(candidate);
  const matches = [...sourceSet].filter((item) => candidateSet.has(item));
  const denominator = Math.min(sourceSet.size, candidateSet.size);
  const score = comparable && denominator > 0 ? matches.length / denominator : 0;
  const reason = !comparable ? `${field} missing from source or candidate` : matches.length > 0 ? `${field} overlap: ${matches.join('|')}` : `${field} did not overlap`;
  return evidenceItem(field, weight, score, comparable, reason, source.join('|') || undefined, candidate.join('|') || undefined);
}

function evidenceItem(field: string, weight: number, score: number, comparable: boolean, reason: string, sourceValue?: string, candidateValue?: string): EntityResolutionEvidence {
  const roundedScore = roundConfidence(score);
  return {
    field,
    weight,
    score: roundedScore,
    contribution: roundConfidence(weight * roundedScore),
    comparable,
    matched: roundedScore > 0,
    reason,
    sourceValue,
    candidateValue,
  };
}

function nameSimilarity(source: string, candidate: string): number {
  if (!source || !candidate) return 0;
  if (source === candidate) return 1;
  const sourceTokens = source.split(' ').filter(Boolean).sort();
  const candidateTokens = candidate.split(' ').filter(Boolean).sort();
  if (sourceTokens.join(' ') === candidateTokens.join(' ')) return 0.95;
  const sourceSet = new Set(sourceTokens);
  const candidateSet = new Set(candidateTokens);
  const intersection = [...sourceSet].filter((token) => candidateSet.has(token)).length;
  const union = new Set([...sourceTokens, ...candidateTokens]).size;
  return union === 0 ? 0 : roundConfidence(intersection / union);
}

function providerIdKeys(identity: ProviderIdentityBase): string[] {
  return uniqueStrings([
    ...Object.entries(identity.externalIds ?? {}).map(([provider, id]) => externalIdKey(provider, id)),
    ...(identity.providerIds ?? []).map((ref) => externalIdKey(ref.provider, ref.id)),
  ].filter((item): item is string => Boolean(item)));
}

function registryIdKeys(identity: HorseProviderIdentity): string[] {
  return uniqueStrings([
    ...(identity.registryRefs ?? []).map((ref) => externalIdKey(ref.provider, ref.id)),
    identity.registrationNumber ? externalIdKey('registration', identity.registrationNumber) : undefined,
    identity.microchipId ? externalIdKey('microchip', identity.microchipId) : undefined,
  ].filter((item): item is string => Boolean(item)));
}

function personLicenseKeys(identity: PersonProviderIdentity): string[] {
  return uniqueStrings([
    ...(identity.registryRefs ?? []).map((ref) => externalIdKey(ref.provider, ref.id)),
    ...(identity.licenseRefs ?? []).map((ref) => externalIdKey(ref.provider, ref.id)),
    identity.licenseNumber ? externalIdKey(identity.licenseJurisdiction ?? 'license', identity.licenseNumber) : undefined,
  ].filter((item): item is string => Boolean(item)));
}

function externalIdLabels(identity: ProviderEntityIdentity): string[] {
  const typedRefs = [
    ...(identity.providerIds ?? []),
    ...(identity.registryRefs ?? []),
    ...(identity.kind === 'person' ? identity.licenseRefs ?? [] : []),
  ].map((ref) => `${normalizeToken(ref.provider)}:${normalizeToken(ref.id)}`);
  return uniqueStrings([
    ...Object.entries(identity.externalIds ?? {}).map(([provider, id]) => `${normalizeToken(provider)}:${normalizeToken(id)}`),
    ...typedRefs,
    ...(identity.kind === 'horse' && identity.registrationNumber ? [`registration:${normalizeToken(identity.registrationNumber)}`] : []),
    ...(identity.kind === 'horse' && identity.microchipId ? [`microchip:${normalizeToken(identity.microchipId)}`] : []),
    ...(identity.kind === 'person' && identity.licenseNumber ? [`${normalizeToken(identity.licenseJurisdiction ?? 'license')}:${normalizeToken(identity.licenseNumber)}`] : []),
  ]);
}

function historyKeys(history?: readonly EntityResolutionHistoryRef[]): string[] {
  return uniqueStrings((history ?? []).flatMap((item) => [
    item.id ? normalizeToken(item.id) : undefined,
    item.name ? normalizeEntityName(item.name) : undefined,
    item.provider && item.externalId ? externalIdKey(item.provider, item.externalId) : undefined,
  ]).filter((item): item is string => Boolean(item)));
}

function raceKeys(races?: readonly EntityResolutionRaceRef[]): string[] {
  return uniqueStrings((races ?? []).map((race) => {
    if (race.provider && race.externalId) return externalIdKey(race.provider, race.externalId);
    if (race.raceId) return normalizeToken(race.raceId);
    const parts = [race.racetrackId, race.raceDate, race.raceNumber === undefined ? undefined : String(race.raceNumber)].filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.map(normalizeToken).join(':') : undefined;
  }).filter((item): item is string => Boolean(item)));
}

function stringKeys(values?: readonly string[]): string[] {
  return uniqueStrings((values ?? []).map(normalizeToken).filter(Boolean));
}

function externalIdKey(provider?: string, id?: string): string | undefined {
  const providerPart = normalizeToken(provider);
  const idPart = normalizeToken(id);
  return providerPart && idPart ? `${providerPart}:${idPart}` : undefined;
}

function identifierNamespace(value: string): string {
  return value.split(':')[0] ?? value;
}

function normalizeCountry(value?: string): string | undefined {
  return normalizeToken(value);
}

function normalizeDate(value?: string): string | undefined {
  return value?.trim().slice(0, 10);
}

function normalizeToken(value?: string): string {
  return normalizeEntityName(value).replace(/\s+/g, '-');
}

function stablePart(value: string): string {
  return normalizeToken(value) || 'unknown';
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function roundConfidence(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 1_000) / 1_000));
}

function compareCandidateScores(left: EntityResolutionCandidateScore, right: EntityResolutionCandidateScore): number {
  if (right.matchConfidence !== left.matchConfidence) return right.matchConfidence - left.matchConfidence;
  return left.canonicalId.localeCompare(right.canonicalId);
}

function isHorseIdentity(identity: ProviderEntityIdentity): identity is HorseProviderIdentity {
  return identity.kind === 'horse';
}

function isPersonIdentity(identity: ProviderEntityIdentity): identity is PersonProviderIdentity {
  return identity.kind === 'person';
}
