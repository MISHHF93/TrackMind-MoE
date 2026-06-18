/** Canonical lifecycle domains that TrackMind Nexus models as first-class operating objects. */
export const racingOperatingDomains = [
  'racetrack',
  'race-meeting',
  'race-card',
  'race',
  'horse',
  'owner',
  'trainer',
  'jockey',
  'veterinarian',
  'steward',
  'official',
  'facility',
  'fan',
  'security',
  'compliance',
  'finance',
  'data-provider',
  'federation-participant',
] as const;

export type RacingOperatingDomain = typeof racingOperatingDomains[number];
