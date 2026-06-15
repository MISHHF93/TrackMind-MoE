export type SafetySeverity = 'info' | 'advisory' | 'warning' | 'critical';
export type PersonaId = 'AJ' | 'Ross' | 'Gemini';

export interface SafetyTelemetryFrame {
  frameId: string;
  raceId: string;
  subjectId: string;
  subjectType: 'horse' | 'jockey' | 'vehicle' | 'staff';
  observedAt: string;
  speedMetersPerSecond: number;
  accelerationMetersPerSecond2?: number;
  lateralAccelerationG?: number;
  distanceToRailMeters?: number;
  distanceToNearestSubjectMeters?: number;
  closingSpeedMetersPerSecond?: number;
  trackZoneId: string;
  trackCondition: 'fast' | 'good' | 'wet' | 'unsafe';
  confidence: number;
  evidenceLinks: string[];
}

export interface SafetyAlert {
  id: string;
  raceId: string;
  subjectId: string;
  severity: SafetySeverity;
  priority: number;
  title: string;
  unifiedVoice: string;
  recommendedAction: string;
  approvalRequiredForControlAction: boolean;
  confidence: number;
  evidenceLinks: string[];
  createdAt: string;
  refractoryKey: string;
  source: 'hot-path-edge' | 'warm-path-cloud' | 'learning-loop';
}

export interface HotPathResult {
  accepted: boolean;
  targetLatencyMs: number;
  measuredLatencyMs: number;
  withinBudget: boolean;
  alerts: SafetyAlert[];
  evidenceLinks: string[];
}

export interface PersonaRecommendation {
  persona: PersonaId;
  role: string;
  summary: string;
  recommendation: string;
  confidence: number;
  evidenceLinks: string[];
}

export interface WarmPathAnalysisResult {
  targetLatencyMs: number;
  estimatedLatencyMs: number;
  personas: PersonaRecommendation[];
  synthesizedAlert?: SafetyAlert;
  evidenceLinks: string[];
}

export interface AlertDeliveryResult {
  delivered: SafetyAlert[];
  suppressed: Array<{ alert: SafetyAlert; reason: string; retryAfterMs: number }>;
  queued: SafetyAlert[];
  refractoryPeriodMs: number;
  unifiedVoice: string;
}

export interface RaceDebriefInput {
  raceId: string;
  driverId: string;
  generatedAt?: string;
  telemetryFrames: SafetyTelemetryFrame[];
  alerts: SafetyAlert[];
  incidents: Array<{ severity: SafetySeverity; summary: string; evidenceLinks: string[] }>;
}

export interface RaceDebriefReport {
  raceId: string;
  driverId: string;
  generatedAt: string;
  driverScore: number;
  scoreBreakdown: {
    safety: number;
    smoothness: number;
    situationalAwareness: number;
    compliance: number;
  };
  actionPlan: Array<{ priority: 'high' | 'medium' | 'low'; action: string; evidenceLinks: string[] }>;
  evidenceLinks: string[];
  approvalRequiredForOperationalChanges: true;
}
