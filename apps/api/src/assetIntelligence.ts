export type MaintainableAssetType = 'irrigation' | 'gate' | 'camera' | 'lighting' | 'generator' | 'emergency-equipment' | 'hvac' | 'elevator' | 'vehicle' | 'communications' | 'security';
export interface MaintenanceSignal { assetId: string; type: MaintainableAssetType; ageDays: number; faultCount30d: number; runtimeHours: number; criticality: number }
export function predictMaintenance(signal: MaintenanceSignal) {
  const risk = Math.min(100, Math.round(signal.ageDays / 20 + signal.faultCount30d * 12 + signal.runtimeHours / 250 + signal.criticality * 8));
  return { assetId: signal.assetId, type: signal.type, failureProbability: risk / 100, priority: risk > 70 ? 'urgent' : risk > 40 ? 'planned' : 'monitor' } as const;
}

export interface BiometricSample { horseId: string; observedAt: string; deviceId: string; strideLength?: number; heartRate?: number; speed?: number; acceleration?: number; gaitSymmetry?: number }
export function ingestBiometrics(sample: BiometricSample) {
  if (!sample.horseId || !sample.deviceId || Number.isNaN(Date.parse(sample.observedAt))) throw new Error('Invalid biometric sample');
  return { ...sample, normalized: true, schemaVersion: 'wearable-gps-v1' };
}

export function analyzeBiomechanics(samples: BiometricSample[]) {
  const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const acceleration = avg(samples.map((s) => s.acceleration ?? 0));
  const gait = avg(samples.map((s) => s.gaitSymmetry ?? 1));
  const fatigueIndicators = samples.filter((s) => (s.heartRate ?? 0) > 190 || (s.gaitSymmetry ?? 1) < 0.85).length;
  return { strideAverage: avg(samples.map((s) => s.strideLength ?? 0)), acceleration, fatigueIndicators, gaitConsistency: Math.round(gait * 100) / 100 };
}

export function predictiveInjuryRisk(samples: BiometricSample[], vetFlags: number) {
  const biomechanics = analyzeBiomechanics(samples);
  const score = Math.min(100, vetFlags * 25 + biomechanics.fatigueIndicators * 15 + (biomechanics.gaitConsistency < 0.9 ? 20 : 0));
  return { score, confidence: samples.length >= 5 ? 0.78 : 0.45, veterinarianReviewOnly: true, alert: score >= 50 };
}
