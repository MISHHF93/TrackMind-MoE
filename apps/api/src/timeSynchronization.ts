export interface TimestampSource {
  source: string;
  timestamp: string;
}

export interface TimestampSynchronizationMetadata {
  synchronizedAt: string;
  sources: TimestampSource[];
  maxSkewMs: number;
  withinTolerance: boolean;
  toleranceMs: number;
  clockAuthority: 'trackmind-api-monotonic-clock';
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function synchronizeTimestamps(sources: TimestampSource[], toleranceMs = 250): TimestampSynchronizationMetadata {
  const normalized = sources
    .filter((source) => source.timestamp && validTimestamp(source.timestamp))
    .map((source) => ({ source: source.source, timestamp: new Date(Date.parse(source.timestamp)).toISOString() }));
  const times = normalized.map((source) => Date.parse(source.timestamp));
  const maxSkewMs = times.length ? Math.max(...times) - Math.min(...times) : 0;
  const synchronizedAt = times.length ? new Date(Math.max(...times)).toISOString() : new Date().toISOString();
  return {
    synchronizedAt,
    sources: normalized,
    maxSkewMs,
    withinTolerance: maxSkewMs <= toleranceMs,
    toleranceMs,
    clockAuthority: 'trackmind-api-monotonic-clock',
  };
}
