export type GnssConstellation = 'GPS' | 'GLONASS' | 'Galileo' | 'BeiDou';
export type RtkFixType = 'rtk-fixed' | 'rtk-float' | 'dgps' | 'standalone';

export interface GnssObservation {
  constellation: GnssConstellation;
  satelliteId: string;
  signalId: string;
  pseudorangeMeters: number;
  carrierPhaseCycles?: number;
  dopplerHz?: number;
  cn0DbHz: number;
  lockTimeMs: number;
  observedAt: string;
}

export interface RtkPositionSample {
  sampleId: string;
  deviceId: string;
  horseId: string;
  raceId: string;
  tenantId: string;
  racetrackId: string;
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  zoneId: string;
  observedAt: string;
  sequence: number;
  updateRateHz: number;
  horizontalAccuracyCm: number;
  verticalAccuracyCm: number;
  fixType: RtkFixType;
  correctionSource: 'ntrip' | 'local-base-station' | 'network-rtk';
  baseStationId: string;
  observations: GnssObservation[];
  evidenceLinks: string[];
}

export interface SynchronizedGnssFix {
  sample: RtkPositionSample;
  constellations: GnssConstellation[];
  observationCount: number;
  maxTimeSkewMs: number;
  qualityScore: number;
  synchronizedAt: string;
}

export interface RtkValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RtkIngestionResult {
  accepted: boolean;
  blockedReason?: string;
  validation: RtkValidationResult;
  synchronized?: SynchronizedGnssFix;
  event?: unknown;
  projection?: unknown;
}

export interface RaceReplayPoint {
  raceId: string;
  horseId: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  zoneId: string;
  observedAt: string;
  sequence: number;
  horizontalAccuracyCm: number;
  verticalAccuracyCm: number;
  speedMetersPerSecond?: number;
  headingDegrees?: number;
  eventId: string;
  eventHash: string;
  constellations: GnssConstellation[];
}

export interface RaceReplayProjection {
  raceId: string;
  current: RaceReplayPoint[];
  historicalTrace: RaceReplayPoint[];
  generatedAt: string;
  replayMetadata: {
    sampleCount: number;
    updateRateHz: number;
    accuracyTargetCm: number;
    source: 'event-sourced-rtk-gnss';
  };
}
