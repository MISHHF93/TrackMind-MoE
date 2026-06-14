export const schemaValidationNormalizationVersion = 'trackmind.schema-validation-normalization.v1' as const;

export type SchemaValidationFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';
export type CanonicalSurfaceType = 'dirt' | 'turf' | 'synthetic';
export type CanonicalRaceStatus = 'draft' | 'scheduled' | 'entries-open' | 'declared' | 'ready' | 'running' | 'official' | 'cancelled';

export interface SourceProviderRef {
  provider: string;
  sourceId: string;
  sourceType?: string;
  entityType?: string;
  system?: string;
}

export interface RawPayloadEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  rawPayloadId: string;
  provider: string;
  providerRefs: SourceProviderRef[];
  payloadType: string;
  tenantId: string;
  racetrackId: string;
  receivedAt: string;
  payload: TPayload;
  sourceSchemaVersion?: string;
  correlationId?: string;
}

export interface SchemaValidationRule {
  path: string;
  required?: boolean;
  type?: SchemaValidationFieldType;
  values?: readonly (string | number | boolean)[];
  min?: number;
  max?: number;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

export type FieldTransform =
  | { kind: 'value-map'; values: Record<string, string | number | boolean>; caseInsensitive?: boolean; trim?: boolean; unknown?: 'error' | 'preserve' }
  | { kind: 'distance-to-meters'; unitPath: string; units: Record<string, number>; precision?: number }
  | { kind: 'date'; output: 'date' | 'datetime' }
  | { kind: 'identity'; prefix?: string; stable?: boolean }
  | { kind: 'string'; trim?: boolean }
  | { kind: 'number'; precision?: number };

export interface SourceFieldMapping {
  sourcePath: string;
  canonicalPath: string;
  required?: boolean;
  type?: SchemaValidationFieldType;
  transform?: FieldTransform;
}

export interface ArtifactIdMapping {
  sourcePath: string;
  prefix?: string;
}

export interface SchemaNormalizationMapping {
  mappingId: string;
  artifactType: string;
  sourcePayloadType?: string;
  artifactId: ArtifactIdMapping;
  fields: SourceFieldMapping[];
  defaults?: Record<string, string | number | boolean | null>;
}

export interface FieldProvenance {
  sourcePath: string;
  sourceValue: unknown;
  transform?: FieldTransform['kind'];
}

export interface CanonicalNormalizedArtifact<TCanonical extends Record<string, unknown> = Record<string, unknown>> {
  schemaVersion: typeof schemaValidationNormalizationVersion;
  artifactId: string;
  artifactType: string;
  tenantId: string;
  racetrackId: string;
  producedAt: string;
  canonical: TCanonical;
  rawPayloadId: string;
  providerRefs: SourceProviderRef[];
  source: {
    provider: string;
    payloadType: string;
    rawPayloadId: string;
    providerRefs: SourceProviderRef[];
    receivedAt: string;
    mappingId: string;
    sourceSchemaVersion?: string;
    correlationId?: string;
    fieldProvenance: Record<string, FieldProvenance>;
  };
}

export interface SchemaNormalizationResult<TCanonical extends Record<string, unknown> = Record<string, unknown>> extends SchemaValidationResult {
  artifacts: CanonicalNormalizedArtifact<TCanonical>[];
}

const rawEnvelopeRules: readonly SchemaValidationRule[] = [
  { path: 'rawPayloadId', required: true, type: 'string' },
  { path: 'provider', required: true, type: 'string' },
  { path: 'providerRefs', required: true, type: 'array' },
  { path: 'payloadType', required: true, type: 'string' },
  { path: 'tenantId', required: true, type: 'string' },
  { path: 'racetrackId', required: true, type: 'string' },
  { path: 'receivedAt', required: true, type: 'string' },
  { path: 'payload', required: true, type: 'object' },
  { path: 'sourceSchemaVersion', type: 'string' },
  { path: 'correlationId', type: 'string' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function get(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, value);
}

function set(value: Record<string, unknown>, path: string, next: unknown): void {
  const keys = path.split('.');
  let current = value;
  for (const key of keys.slice(0, -1)) {
    const child = current[key];
    if (!isRecord(child)) current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]!] = next;
}

function matchesType(value: unknown, type: SchemaValidationFieldType): boolean {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  return typeof value === type;
}

function validateRules(name: string, value: unknown, rules: readonly SchemaValidationRule[]): string[] {
  const errors: string[] = [];
  for (const rule of rules) {
    const field = get(value, rule.path);
    if (rule.required && (field === undefined || field === null || field === '')) errors.push(`${name}.${rule.path} is required`);
    if (field !== undefined && rule.type && !matchesType(field, rule.type)) errors.push(`${name}.${rule.path} must be ${rule.type}`);
    if (rule.values && field !== undefined && !rule.values.includes(field as string | number | boolean)) errors.push(`${name}.${rule.path} must be one of ${rule.values.join(',')}`);
    if (typeof field === 'number' && rule.min !== undefined && field < rule.min) errors.push(`${name}.${rule.path} must be >= ${rule.min}`);
    if (typeof field === 'number' && rule.max !== undefined && field > rule.max) errors.push(`${name}.${rule.path} must be <= ${rule.max}`);
  }
  return errors;
}

function stablePart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function readSource(envelope: RawPayloadEnvelope, sourcePath: string): unknown {
  if (sourcePath.startsWith('envelope.')) return get(envelope, sourcePath.slice('envelope.'.length));
  if (sourcePath.startsWith('payload.')) return get(envelope, sourcePath);
  return get(envelope.payload, sourcePath);
}

function normalizeValueMap(value: unknown, transform: Extract<FieldTransform, { kind: 'value-map' }>): string | number | boolean {
  const raw = String(value);
  const key = transform.caseInsensitive ? raw.toLowerCase() : transform.trim ? raw.trim() : raw;
  const values = Object.fromEntries(Object.entries(transform.values).map(([source, target]) => {
    const mappedKey = transform.caseInsensitive ? source.toLowerCase() : transform.trim ? source.trim() : source;
    return [mappedKey, target];
  }));
  const mapped = values[key];
  if (mapped !== undefined) return mapped;
  if (transform.unknown === 'preserve') return raw;
  throw new Error(`value ${raw} is not mapped`);
}

function normalizeDate(value: unknown, transform: Extract<FieldTransform, { kind: 'date' }>): string {
  const raw = String(value).trim();
  const dateOnly = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const normalized = `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
    return transform.output === 'date' ? normalized : `${normalized}T00:00:00.000Z`;
  }
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) throw new Error(`date ${raw} is invalid`);
  const iso = new Date(parsed).toISOString();
  return transform.output === 'date' ? iso.slice(0, 10) : iso;
}

function normalizeFieldValue(envelope: RawPayloadEnvelope, value: unknown, transform?: FieldTransform): unknown {
  if (!transform) return value;
  if (transform.kind === 'value-map') return normalizeValueMap(value, transform);
  if (transform.kind === 'distance-to-meters') {
    const unitValue = readSource(envelope, transform.unitPath);
    const unit = String(unitValue ?? '').trim().toLowerCase();
    const multiplier = transform.units[unit];
    if (multiplier === undefined) throw new Error(`distance unit ${String(unitValue)} is not mapped`);
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new Error(`distance value ${String(value)} must be numeric`);
    const meters = numeric * multiplier;
    return transform.precision === undefined ? meters : Number(meters.toFixed(transform.precision));
  }
  if (transform.kind === 'date') return normalizeDate(value, transform);
  if (transform.kind === 'identity') {
    const source = String(value).trim();
    const normalized = transform.stable ? stablePart(source) : source;
    return transform.prefix ? `${transform.prefix}:${normalized}` : normalized;
  }
  if (transform.kind === 'string') return transform.trim ? String(value).trim() : String(value);
  if (transform.kind === 'number') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new Error(`value ${String(value)} must be numeric`);
    return transform.precision === undefined ? numeric : Number(numeric.toFixed(transform.precision));
  }
  return value;
}

function validateProviderRefs(refs: unknown): string[] {
  if (!Array.isArray(refs)) return [];
  if (refs.length === 0) return ['RawPayloadEnvelope.providerRefs must include at least one provider reference'];
  return refs.flatMap((ref, index) => {
    if (!isRecord(ref)) return [`RawPayloadEnvelope.providerRefs[${index}] must be object`];
    const errors: string[] = [];
    if (typeof ref.provider !== 'string' || ref.provider === '') errors.push(`RawPayloadEnvelope.providerRefs[${index}].provider is required`);
    if (typeof ref.sourceId !== 'string' || ref.sourceId === '') errors.push(`RawPayloadEnvelope.providerRefs[${index}].sourceId is required`);
    return errors;
  });
}

function validateMapping(mapping: SchemaNormalizationMapping): string[] {
  const errors: string[] = [];
  if (!mapping.mappingId) errors.push('SchemaNormalizationMapping.mappingId is required');
  if (!mapping.artifactType) errors.push('SchemaNormalizationMapping.artifactType is required');
  if (!mapping.artifactId?.sourcePath) errors.push('SchemaNormalizationMapping.artifactId.sourcePath is required');
  if (!Array.isArray(mapping.fields) || mapping.fields.length === 0) errors.push('SchemaNormalizationMapping.fields must include at least one field');
  return errors;
}

export function validateRawPayloadEnvelope(envelope: unknown): SchemaValidationResult {
  if (!isRecord(envelope)) return { valid: false, errors: ['RawPayloadEnvelope must be object'] };
  const errors = validateRules('RawPayloadEnvelope', envelope, rawEnvelopeRules);
  errors.push(...validateProviderRefs(envelope.providerRefs));
  if (typeof envelope.receivedAt === 'string' && Number.isNaN(Date.parse(envelope.receivedAt))) errors.push('RawPayloadEnvelope.receivedAt must be a valid timestamp');
  return { valid: errors.length === 0, errors };
}

export function normalizeRawPayloadEnvelope<TCanonical extends Record<string, unknown> = Record<string, unknown>>(
  envelope: RawPayloadEnvelope,
  mapping: SchemaNormalizationMapping,
  producedAt = new Date().toISOString(),
): SchemaNormalizationResult<TCanonical> {
  const errors = [...validateRawPayloadEnvelope(envelope).errors, ...validateMapping(mapping)];
  if (mapping.sourcePayloadType && envelope.payloadType !== mapping.sourcePayloadType) errors.push(`RawPayloadEnvelope.payloadType must be ${mapping.sourcePayloadType} for mapping ${mapping.mappingId}`);

  const canonical: Record<string, unknown> = { ...(mapping.defaults ?? {}) };
  const fieldProvenance: Record<string, FieldProvenance> = {};

  for (const field of mapping.fields ?? []) {
    const sourceValue = readSource(envelope, field.sourcePath);
    if (field.required && (sourceValue === undefined || sourceValue === null || sourceValue === '')) {
      errors.push(`${field.sourcePath} is required`);
      continue;
    }
    if (sourceValue === undefined) continue;
    if (field.type && !matchesType(sourceValue, field.type)) {
      errors.push(`${field.sourcePath} must be ${field.type}`);
      continue;
    }
    try {
      const normalized = normalizeFieldValue(envelope, sourceValue, field.transform);
      set(canonical, field.canonicalPath, normalized);
      fieldProvenance[field.canonicalPath] = { sourcePath: field.sourcePath, sourceValue, transform: field.transform?.kind };
    } catch (error) {
      errors.push(`${field.sourcePath}: ${(error as Error).message}`);
    }
  }

  const artifactSourceId = readSource(envelope, mapping.artifactId.sourcePath);
  if (artifactSourceId === undefined || artifactSourceId === null || artifactSourceId === '') errors.push(`${mapping.artifactId.sourcePath} is required for artifact id`);
  const artifactId = `${mapping.artifactId.prefix ? `${mapping.artifactId.prefix}:` : ''}${stablePart(String(artifactSourceId ?? envelope.rawPayloadId))}`;
  if (errors.length) return { valid: false, errors, artifacts: [] };

  const providerRefs = envelope.providerRefs.map((ref) => ({ ...ref }));
  const artifact: CanonicalNormalizedArtifact<TCanonical> = {
    schemaVersion: schemaValidationNormalizationVersion,
    artifactId,
    artifactType: mapping.artifactType,
    tenantId: envelope.tenantId,
    racetrackId: envelope.racetrackId,
    producedAt,
    canonical: canonical as TCanonical,
    rawPayloadId: envelope.rawPayloadId,
    providerRefs,
    source: {
      provider: envelope.provider,
      payloadType: envelope.payloadType,
      rawPayloadId: envelope.rawPayloadId,
      providerRefs,
      receivedAt: envelope.receivedAt,
      mappingId: mapping.mappingId,
      sourceSchemaVersion: envelope.sourceSchemaVersion,
      correlationId: envelope.correlationId,
      fieldProvenance,
    },
  };
  return { valid: true, errors: [], artifacts: [artifact] };
}

export const raceProviderNormalizationMappings = {
  surfaceValues: {
    D: 'dirt',
    Dirt: 'dirt',
    dirt: 'dirt',
    'ダート': 'dirt',
    '砂': 'dirt',
    T: 'turf',
    Turf: 'turf',
    turf: 'turf',
    '芝': 'turf',
    S: 'synthetic',
    Synthetic: 'synthetic',
    synthetic: 'synthetic',
    AW: 'synthetic',
  },
  distanceUnitsToMeters: {
    f: 201.168,
    furlong: 201.168,
    furlongs: 201.168,
    m: 1,
    meter: 1,
    meters: 1,
    metre: 1,
    metres: 1,
    km: 1000,
    mile: 1609.344,
  },
  raceStatuses: {
    draft: 'draft',
    scheduled: 'scheduled',
    OPEN: 'entries-open',
    entries: 'entries-open',
    declared: 'declared',
    ready: 'ready',
    running: 'running',
    official: 'official',
    cancelled: 'cancelled',
    '発走前': 'scheduled',
    '確定': 'official',
    '取消': 'cancelled',
  },
} as const;

export const raceOfficeRawPayloadNormalizationMapping: SchemaNormalizationMapping = {
  mappingId: 'race-office.raw-payload.v1',
  artifactType: 'race-office-card',
  sourcePayloadType: 'race-card',
  artifactId: { sourcePath: 'race.id', prefix: 'race' },
  fields: [
    { sourcePath: 'race.id', canonicalPath: 'race.id', required: true, type: 'string', transform: { kind: 'identity', prefix: 'race', stable: true } },
    { sourcePath: 'track.id', canonicalPath: 'track.id', required: true, type: 'string', transform: { kind: 'identity', prefix: 'track', stable: true } },
    { sourcePath: 'race.number', canonicalPath: 'race.number', required: true, type: 'number' },
    { sourcePath: 'race.surfaceCode', canonicalPath: 'race.surface', required: true, type: 'string', transform: { kind: 'value-map', values: raceProviderNormalizationMappings.surfaceValues, caseInsensitive: true, trim: true } },
    { sourcePath: 'race.distance.value', canonicalPath: 'race.distanceMeters', required: true, type: 'number', transform: { kind: 'distance-to-meters', unitPath: 'race.distance.unit', units: raceProviderNormalizationMappings.distanceUnitsToMeters, precision: 3 } },
    { sourcePath: 'race.date', canonicalPath: 'race.date', required: true, type: 'string', transform: { kind: 'date', output: 'date' } },
    { sourcePath: 'race.postTime', canonicalPath: 'race.postTime', type: 'string', transform: { kind: 'date', output: 'datetime' } },
    { sourcePath: 'race.status', canonicalPath: 'race.status', required: true, type: 'string', transform: { kind: 'value-map', values: raceProviderNormalizationMappings.raceStatuses, trim: true } },
    { sourcePath: 'race.providerRaceId', canonicalPath: 'identity.providerRaceId', type: 'string', transform: { kind: 'string', trim: true } },
    { sourcePath: 'track.providerTrackId', canonicalPath: 'identity.providerTrackId', type: 'string', transform: { kind: 'string', trim: true } },
  ],
};
