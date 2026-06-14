import type {
  ArtifactRegistryPrincipal,
  UniversalArtifactEntry,
  UniversalArtifactRegistryService,
} from './universalArtifactRegistry.js';

export type DataQualityBand = 'high' | 'medium' | 'low';
export type ExportReadiness = 'ready' | 'review' | 'restricted';

export type DataQualityMetricId =
  | 'required_fields_present'
  | 'distance_unit_normalized'
  | 'horse_identity_resolved'
  | 'license_policy_checked'
  | 'source_payload_preserved'
  | 'provider_attribution_present'
  | (string & {});

export interface DataQualityCheck {
  id: DataQualityMetricId;
  label: string;
  score: number;
  weight: number;
  passed: boolean;
  evidence: string[];
  issues: string[];
}

export interface DataQualityReport {
  schemaVersion: 'trackmind.api-hub.data-quality.v1';
  generatedAt: string;
  artifactId: string;
  artifactType: string;
  score: number;
  band: DataQualityBand;
  exportReadiness: ExportReadiness;
  checks: Record<string, DataQualityCheck>;
  domainSpecificChecks: DataQualityCheck[];
  requiredFields: string[];
  missingFields: string[];
  normalizedDistance?: { value: number; unit: 'meters'; sourceValue?: number; sourceUnit?: string };
  horseIdentity: { resolved: boolean; horseIds: string[]; unresolvedEntries: string[]; confidence?: number };
  licensePolicy: { checked: boolean; exportAllowed: boolean; restrictions: string[]; attributionRequired: boolean; policyRef?: string };
  sourcePayload: { preserved: boolean; rawPayloadId?: string };
  providerAttribution: { present: boolean; providerRefs: string[] };
  issues: string[];
  warnings: string[];
  mock: false;
}

export interface DataQualityAssessmentOptions {
  requiredFields?: string[];
  generatedAt?: string;
}

export interface DataQualityServiceOptions {
  requiredFieldsByType?: Record<string, string[]>;
}

export interface ApiHubLineageArtifactRef {
  artifactId: string;
  artifactType: string;
  schemaVersion: string;
  owner: string;
  sourceSystem: string;
}

export interface ApiHubLineageGraphNode extends ApiHubLineageArtifactRef {
  role: 'target' | 'source' | 'derived' | 'related';
}

export interface ApiHubLineageGraphEdge {
  from: string;
  to: string;
  relationship: string;
  timestamp?: string;
}

export interface ApiHubArtifactLineageLookup {
  schemaVersion: 'trackmind.api-hub.lineage.v1';
  generatedAt: string;
  artifactId: string;
  sourceArtifacts: ApiHubLineageArtifactRef[];
  rawPayloadId?: string;
  providerRefs: string[];
  transformations: string[];
  eventRefs: string[];
  auditRefs: string[];
  twinRefs: string[];
  featureRefs: string[];
  graph: {
    nodes: ApiHubLineageGraphNode[];
    edges: ApiHubLineageGraphEdge[];
  };
  mock: false;
}

const baseRequiredFields = ['artifactId', 'artifactType', 'schemaVersion', 'owner', 'tenantId', 'racetrackId', 'source.system'];

const domainRequiredFields: Record<string, string[]> = {
  'canonical-race': ['metadata.raceId', 'metadata.raceDate', 'metadata.entries'],
  'race': ['metadata.raceId', 'metadata.raceDate', 'metadata.entries'],
  'feature-record': ['metadata.featureSetId'],
  'canonical-horse': ['metadata.canonicalHorseId'],
};

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const unique = (values: readonly string[]): string[] => [...new Set(values.filter((value) => value.trim().length > 0))];

export class DataQualityService {
  constructor(private readonly options: DataQualityServiceOptions = {}) {}

  assess(artifact: UniversalArtifactEntry, options: DataQualityAssessmentOptions = {}): DataQualityReport {
    const requiredFields = unique([
      ...baseRequiredFields,
      ...(domainRequiredFields[artifact.artifactType] ?? []),
      ...(this.options.requiredFieldsByType?.[artifact.artifactType] ?? []),
      ...(options.requiredFields ?? []),
    ]);
    const missingFields = requiredFields.filter((field) => missing(getPath(artifact, field)));
    const checks: Record<string, DataQualityCheck> = {};

    const add = (check: DataQualityCheck): void => {
      checks[check.id] = check;
    };

    add(check(
      'required_fields_present',
      'Required fields present',
      requiredFields.length === 0 ? 100 : Math.round(((requiredFields.length - missingFields.length) / requiredFields.length) * 100),
      24,
      missingFields.length ? [`Missing required fields: ${missingFields.join(', ')}`] : [],
      requiredFields.filter((field) => !missingFields.includes(field)),
    ));

    const distance = distanceEvidence(artifact);
    add(check(
      'distance_unit_normalized',
      'Distance unit normalized',
      distance.score,
      12,
      distance.issues,
      distance.evidence,
    ));

    const horseIdentity = horseIdentityEvidence(artifact);
    add(check(
      'horse_identity_resolved',
      'Horse identity resolved',
      horseIdentity.score,
      18,
      horseIdentity.issues,
      horseIdentity.horseIds,
    ));

    const licensePolicy = licensePolicyEvidence(artifact);
    add(check(
      'license_policy_checked',
      'License policy checked',
      licensePolicy.checked ? 100 : 0,
      14,
      licensePolicy.checked ? [] : ['License policy was not checked for this artifact'],
      licensePolicy.policyRef ? [licensePolicy.policyRef] : [],
    ));

    const sourcePayload = sourcePayloadEvidence(artifact);
    add(check(
      'source_payload_preserved',
      'Source payload preserved',
      sourcePayload.preserved ? 100 : 0,
      14,
      sourcePayload.preserved ? [] : ['Raw source payload reference is missing'],
      sourcePayload.rawPayloadId ? [sourcePayload.rawPayloadId] : [],
    ));

    const providerAttribution = providerAttributionEvidence(artifact);
    add(check(
      'provider_attribution_present',
      'Provider attribution present',
      providerAttribution.present ? 100 : 0,
      10,
      providerAttribution.present ? [] : ['Provider attribution is missing'],
      providerAttribution.providerRefs,
    ));

    const domainSpecificChecks = domainChecks(artifact);
    for (const domainCheck of domainSpecificChecks) add(domainCheck);

    const score = weightedScore(Object.values(checks));
    const restrictedByLicense = !licensePolicy.exportAllowed || licensePolicy.restrictions.length > 0;
    const exportReadiness: ExportReadiness = restrictedByLicense ? 'restricted' : score >= 90 ? 'ready' : score >= 70 ? 'review' : 'restricted';
    const issues = Object.values(checks).flatMap((item) => item.issues);
    const warnings = restrictedByLicense ? ['License policy restricts downstream export readiness'] : [];

    return {
      schemaVersion: 'trackmind.api-hub.data-quality.v1',
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      artifactId: artifact.artifactId,
      artifactType: artifact.artifactType,
      score,
      band: score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low',
      exportReadiness,
      checks,
      domainSpecificChecks,
      requiredFields,
      missingFields,
      normalizedDistance: distance.normalizedDistance,
      horseIdentity: {
        resolved: horseIdentity.score === 100,
        horseIds: horseIdentity.horseIds,
        unresolvedEntries: horseIdentity.unresolvedEntries,
        confidence: horseIdentity.confidence,
      },
      licensePolicy,
      sourcePayload,
      providerAttribution,
      issues,
      warnings,
      mock: false,
    };
  }
}

export class LineageService {
  constructor(private readonly registry: UniversalArtifactRegistryService) {}

  lookup(artifactId: string, principal: ArtifactRegistryPrincipal, generatedAt = new Date().toISOString()): ApiHubArtifactLineageLookup {
    const target = this.registry.get(artifactId, principal);
    const artifacts = this.registry.query({}, principal).artifacts;
    const byId = new Map(artifacts.map((artifact) => [artifact.artifactId, artifact]));
    const ancestorIds = walkAncestors(target, byId);
    const descendantIds = walkDescendants(target, artifacts);
    const relatedIds = unique([target.artifactId, ...ancestorIds, ...descendantIds]);
    const relatedArtifacts = relatedIds.map((id) => byId.get(id)).filter((artifact): artifact is UniversalArtifactEntry => Boolean(artifact));
    const sourceArtifacts = ancestorIds
      .map((id) => byId.get(id))
      .filter((artifact): artifact is UniversalArtifactEntry => Boolean(artifact))
      .map(lineageRef);

    const graph = lineageGraph(target.artifactId, relatedArtifacts);
    const rawPayloadId = firstString(relatedArtifacts.flatMap(rawPayloadIds));

    return {
      schemaVersion: 'trackmind.api-hub.lineage.v1',
      generatedAt,
      artifactId: target.artifactId,
      sourceArtifacts,
      rawPayloadId,
      providerRefs: unique(relatedArtifacts.flatMap(providerRefs)),
      transformations: unique(relatedArtifacts.flatMap(transformationRefs)),
      eventRefs: unique(relatedArtifacts.flatMap(eventRefs)),
      auditRefs: unique(relatedArtifacts.flatMap(auditRefs)),
      twinRefs: unique(relatedArtifacts.flatMap(twinRefs)),
      featureRefs: unique(relatedArtifacts.flatMap(featureRefs)),
      graph,
      mock: false,
    };
  }
}

function check(id: DataQualityMetricId, label: string, score: number, weight: number, issues: string[], evidence: string[]): DataQualityCheck {
  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  return { id, label, score: bounded, weight, passed: bounded >= 90, evidence: unique(evidence), issues };
}

function weightedScore(checks: DataQualityCheck[]): number {
  const totalWeight = checks.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;
  return Math.round(checks.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
}

function domainChecks(artifact: UniversalArtifactEntry): DataQualityCheck[] {
  if (/race/i.test(artifact.artifactType) || stringValue(artifact.metadata.domain) === 'race') {
    const entries = arrayOfRecords(artifact.metadata.entries);
    const scoreParts = [
      stringValue(artifact.metadata.raceId) || stringValue(artifact.metadata.canonicalRaceId) ? 1 : 0,
      stringValue(artifact.metadata.raceDate) ? 1 : 0,
      entries.length > 0 ? 1 : 0,
      entries.length > 0 && entries.every((entry) => typeof entry.postPosition === 'number' || typeof entry.programNumber === 'string') ? 1 : 0,
    ];
    const score = Math.round((scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length) * 100);
    return [check('domain_race_checks', 'Race artifact domain checks', score, 12, score === 100 ? [] : ['Race artifact is missing one or more canonical race fields'], ['raceId', 'raceDate', 'entries', 'postPosition'])];
  }

  if (/feature/i.test(artifact.artifactType) || stringValue(artifact.metadata.domain) === 'feature') {
    const scoreParts = [
      stringValue(artifact.metadata.featureSetId) ? 1 : 0,
      Object.keys(recordValue(artifact.metadata.features)).length > 0 ? 1 : 0,
      artifact.lineage.parentArtifactIds.length > 0 ? 1 : 0,
      auditRefs(artifact).length > 0 ? 1 : 0,
    ];
    const score = Math.round((scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length) * 100);
    return [check('domain_feature_checks', 'Feature artifact domain checks', score, 12, score === 100 ? [] : ['Feature artifact is missing feature-set, source, or audit traceability'], featureRefs(artifact))];
  }

  if (/horse/i.test(artifact.artifactType) || stringValue(artifact.metadata.domain) === 'horse') {
    const evidence = horseIdentityEvidence(artifact);
    return [check('domain_horse_checks', 'Horse artifact domain checks', evidence.score, 12, evidence.issues, evidence.horseIds)];
  }

  const refs = unique([...eventRefs(artifact), ...auditRefs(artifact), ...twinRefs(artifact)]);
  return [check('domain_traceability_checks', 'Generic traceability checks', refs.length >= 2 ? 100 : refs.length === 1 ? 50 : 0, 8, refs.length >= 2 ? [] : ['Artifact has limited event, audit, or twin traceability'], refs)];
}

function distanceEvidence(artifact: UniversalArtifactEntry): { score: number; issues: string[]; evidence: string[]; normalizedDistance?: DataQualityReport['normalizedDistance'] } {
  const distanceMeters = numberValue(artifact.metadata.distanceMeters) ?? numberValue(getPath(artifact.metadata, 'distance.meters')) ?? numberValue(getPath(artifact.metadata, 'distance.valueMeters'));
  if (distanceMeters !== undefined && distanceMeters > 0) {
    return { score: 100, issues: [], evidence: [`${distanceMeters}m`], normalizedDistance: { value: distanceMeters, unit: 'meters', sourceValue: numberValue(getPath(artifact.metadata, 'sourceDistance.value')), sourceUnit: stringValue(getPath(artifact.metadata, 'sourceDistance.unit')) } };
  }

  const distance = recordValue(artifact.metadata.distance);
  const unit = stringValue(distance.unit) ?? stringValue(distance.normalizedUnit);
  const value = numberValue(distance.value);
  if (value !== undefined && unit && ['m', 'meter', 'meters'].includes(unit.toLowerCase())) {
    return { score: 100, issues: [], evidence: [`${value}m`], normalizedDistance: { value, unit: 'meters' } };
  }

  const furlongs = numberValue(artifact.metadata.distanceFurlongs) ?? numberValue(getPath(artifact.metadata, 'sourceDistance.furlongs'));
  if (furlongs !== undefined) return { score: 50, issues: ['Distance is present only in source units and needs normalized meters'], evidence: [`${furlongs}f`] };

  if (!/race/i.test(artifact.artifactType) && stringValue(artifact.metadata.domain) !== 'race') return { score: 100, issues: [], evidence: ['not-applicable'] };
  return { score: 0, issues: ['Race distance is missing normalized meters'], evidence: [] };
}

function horseIdentityEvidence(artifact: UniversalArtifactEntry): { score: number; horseIds: string[]; unresolvedEntries: string[]; issues: string[]; confidence?: number } {
  const explicitResolved = booleanValue(artifact.metadata.horseIdentityResolved) ?? booleanValue(getPath(artifact.metadata, 'horseIdentity.resolved'));
  const confidence = numberValue(getPath(artifact.metadata, 'horseIdentity.confidence'));
  const entries = arrayOfRecords(artifact.metadata.entries);
  const horseIds = unique([
    ...strings(artifact.metadata.horseIds),
    ...entries.map((entry) => stringValue(entry.canonicalHorseId) ?? stringValue(entry.horseId) ?? ''),
    stringValue(artifact.metadata.canonicalHorseId) ?? '',
  ]);
  const unresolvedEntries = unique([
    ...strings(artifact.metadata.unresolvedHorseIds),
    ...entries
      .filter((entry) => !(stringValue(entry.canonicalHorseId) ?? stringValue(entry.horseId)) || booleanValue(entry.unresolved) === true)
      .map((entry, index) => stringValue(entry.entryId) ?? stringValue(entry.id) ?? `entry-${index + 1}`),
  ]);

  if (explicitResolved === false) return { score: 0, horseIds, unresolvedEntries: unresolvedEntries.length ? unresolvedEntries : ['identity-resolution-failed'], issues: ['Horse identity resolution failed'], confidence };
  if (entries.length === 0 && horseIds.length === 0 && !/horse|race/i.test(artifact.artifactType) && stringValue(artifact.metadata.domain) !== 'race') return { score: 100, horseIds, unresolvedEntries: [], issues: [], confidence };
  if (unresolvedEntries.length > 0) return { score: Math.max(0, Math.round((horseIds.length / (horseIds.length + unresolvedEntries.length)) * 100)), horseIds, unresolvedEntries, issues: [`Unresolved horse identities: ${unresolvedEntries.join(', ')}`], confidence };
  if (horseIds.length > 0 || explicitResolved === true) return { score: 100, horseIds, unresolvedEntries: [], issues: [], confidence };
  return { score: 0, horseIds, unresolvedEntries: ['horse-identity'], issues: ['Horse identity reference is missing'], confidence };
}

function licensePolicyEvidence(artifact: UniversalArtifactEntry): DataQualityReport['licensePolicy'] {
  const policy = recordValue(artifact.metadata.licensePolicy);
  const checked = booleanValue(policy.checked) ?? booleanValue(artifact.metadata.licensePolicyChecked) ?? false;
  const restrictions = unique([...strings(policy.restrictions), ...strings(artifact.metadata.licenseRestrictions)]);
  return {
    checked,
    exportAllowed: booleanValue(policy.exportAllowed) ?? booleanValue(artifact.metadata.exportAllowed) ?? restrictions.length === 0,
    restrictions,
    attributionRequired: booleanValue(policy.attributionRequired) ?? true,
    policyRef: stringValue(policy.policyRef) ?? stringValue(artifact.metadata.licensePolicyRef),
  };
}

function sourcePayloadEvidence(artifact: UniversalArtifactEntry): DataQualityReport['sourcePayload'] {
  const rawPayloadId = firstString(rawPayloadIds(artifact));
  const preserved = booleanValue(artifact.metadata.sourcePayloadPreserved) ?? Boolean(rawPayloadId);
  return { preserved, rawPayloadId };
}

function providerAttributionEvidence(artifact: UniversalArtifactEntry): DataQualityReport['providerAttribution'] {
  const providerRefsValue = providerRefs(artifact);
  return { present: providerRefsValue.length > 0, providerRefs: providerRefsValue };
}

function rawPayloadIds(artifact: UniversalArtifactEntry): string[] {
  return unique([
    stringValue(artifact.metadata.rawPayloadId) ?? '',
    stringValue(getPath(artifact.metadata, 'rawPayload.id')) ?? '',
    stringValue(getPath(artifact.source.metadata, 'rawPayloadId')) ?? '',
    /raw|payload/i.test(artifact.artifactType) ? artifact.source.id ?? artifact.artifactId : '',
  ]);
}

function providerRefs(artifact: UniversalArtifactEntry): string[] {
  return unique([
    ...strings(artifact.metadata.providerRefs),
    ...strings(getPath(artifact.source.metadata, 'providerRefs')),
    stringValue(artifact.metadata.provider) ?? '',
    stringValue(getPath(artifact.metadata, 'provider.name')) ?? '',
    artifact.source.system,
    ...artifact.storageRefs.map((ref) => ref.provider ?? ''),
  ]);
}

function transformationRefs(artifact: UniversalArtifactEntry): string[] {
  return unique([
    ...strings(artifact.metadata.transformations),
    ...strings(artifact.metadata.transformationRefs),
    artifact.lineage.derivedFrom ?? '',
    ...(artifact.lineage.relationships ?? []).map((relationship) => relationship.relationship),
  ]);
}

function eventRefs(artifact: UniversalArtifactEntry): string[] {
  return unique([
    ...artifact.eventRefs,
    ...artifact.lineage.sourceEventIds,
    ...strings(artifact.metadata.eventRefs),
    ...strings(artifact.metadata.eventIds),
    artifact.source.eventId ?? '',
  ]);
}

function auditRefs(artifact: UniversalArtifactEntry): string[] {
  return unique([
    ...artifact.auditRefs,
    ...artifact.lineage.sourceAuditIds,
    ...strings(artifact.metadata.auditRefs),
    ...strings(artifact.metadata.auditIds),
    artifact.source.auditRef ?? '',
  ]);
}

function twinRefs(artifact: UniversalArtifactEntry): string[] {
  return unique([
    ...artifact.lineage.relatedTwinIds,
    ...strings(artifact.metadata.twinRefs),
    ...strings(artifact.metadata.digitalTwinRefs),
    ...strings(artifact.metadata.relatedTwinIds),
  ]);
}

function featureRefs(artifact: UniversalArtifactEntry): string[] {
  const refs = unique([
    ...strings(artifact.metadata.featureRefs),
    stringValue(artifact.metadata.featureSetId) ?? '',
  ]);
  if (/feature/i.test(artifact.artifactType)) refs.push(artifact.artifactId);
  return unique(refs);
}

function lineageRef(artifact: UniversalArtifactEntry): ApiHubLineageArtifactRef {
  return {
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    schemaVersion: artifact.schemaVersion,
    owner: artifact.owner,
    sourceSystem: artifact.source.system,
  };
}

function lineageGraph(targetId: string, artifacts: UniversalArtifactEntry[]): ApiHubArtifactLineageLookup['graph'] {
  const ids = new Set(artifacts.map((artifact) => artifact.artifactId));
  const ancestorIds = new Set(artifacts.flatMap((artifact) => artifact.lineage.parentArtifactIds));
  const nodes = artifacts.map((artifact): ApiHubLineageGraphNode => ({
    ...lineageRef(artifact),
    role: artifact.artifactId === targetId ? 'target' : ancestorIds.has(artifact.artifactId) ? 'source' : /feature|audit/i.test(artifact.artifactType) ? 'derived' : 'related',
  }));
  const edges: ApiHubLineageGraphEdge[] = [];
  for (const artifact of artifacts) {
    for (const parentId of artifact.lineage.parentArtifactIds) {
      if (ids.has(parentId)) edges.push({ from: parentId, to: artifact.artifactId, relationship: 'parentArtifact' });
    }
    for (const relationship of artifact.lineage.relationships ?? []) {
      if (ids.has(relationship.artifactId)) edges.push({ from: relationship.artifactId, to: artifact.artifactId, relationship: relationship.relationship, timestamp: relationship.timestamp });
    }
  }
  return { nodes, edges };
}

function walkAncestors(target: UniversalArtifactEntry, byId: Map<string, UniversalArtifactEntry>): string[] {
  const visited = new Set<string>();
  const queue = [...target.lineage.parentArtifactIds];
  while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const artifact = byId.get(id);
    if (artifact) queue.push(...artifact.lineage.parentArtifactIds);
  }
  return [...visited];
}

function walkDescendants(target: UniversalArtifactEntry, artifacts: UniversalArtifactEntry[]): string[] {
  const visited = new Set<string>();
  const queue = [target.artifactId];
  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId) continue;
    const children = artifacts.filter((artifact) => artifact.lineage.parentArtifactIds.includes(currentId) || (artifact.lineage.relationships ?? []).some((relationship) => relationship.artifactId === currentId));
    for (const child of children) {
      if (visited.has(child.artifactId)) continue;
      visited.add(child.artifactId);
      queue.push(child.artifactId);
    }
  }
  visited.delete(target.artifactId);
  return [...visited];
}

function getPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => isRecord(current) ? current[segment] : undefined, value);
}

function missing(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map(clone);
}

function firstString(values: string[]): string | undefined {
  return values.find((value) => value.trim().length > 0);
}
