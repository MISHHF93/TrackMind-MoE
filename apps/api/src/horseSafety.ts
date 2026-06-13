export interface HorseSafetyProfile {
  horseId: string;
  workoutHistory: Array<{ date: string; distanceFurlongs: number; notes?: string }>;
  raceHistory: Array<{ date: string; raceId: string; finishPosition?: number }>;
  vetFlags: Array<{ id: string; status: 'open' | 'cleared'; reason: string }>;
  restDays: number;
  medicationStatus: 'placeholder-unknown' | 'recorded' | 'not-applicable';
  shoeingEquipmentNotes: string[];
}

export interface HorseRiskScore {
  score: number;
  factors: string[];
  requiresVeterinaryReview: true;
  disclaimer: string;
}

export function nonDiagnosticRiskScore(profile: HorseSafetyProfile): HorseRiskScore {
  const factors: string[] = [];
  let score = 0;

  if (profile.restDays < 14) {
    score += (14 - profile.restDays) * 3;
    factors.push('short rest interval');
  }
  const openVetFlags = profile.vetFlags.filter((flag) => flag.status === 'open').length;
  if (openVetFlags > 0) {
    score += openVetFlags * 25;
    factors.push('open veterinary flags');
  }
  if (profile.workoutHistory.length >= 4) {
    score += 10;
    factors.push('high recent workout volume placeholder');
  }
  if (profile.medicationStatus === 'placeholder-unknown') {
    score += 5;
    factors.push('medication status requires authoritative review');
  }

  return {
    score: Math.min(100, score),
    factors,
    requiresVeterinaryReview: true,
    disclaimer: 'Non-diagnostic operational risk score; only a licensed veterinarian can make medical decisions.',
  };
}
