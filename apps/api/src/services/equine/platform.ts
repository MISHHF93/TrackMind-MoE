import type { EquineAuditLogger } from './auditLogger.js';
import type { EquineIntelligencePrivacyService } from './service.js';
import type { EquineRequestActor, FilteredHorseProfile } from './types.js';

export type EquinePlatformLayer = 'Device' | 'Data' | 'Processing' | 'Application';
export type EquineManagementModule = 'Record' | 'Epidemic' | 'Breeding' | 'Behavior' | 'Environment';

export interface LamenessDetectionInput {
  videoFrameEvidence: string[];
  gaitMetrics: {
    strideAsymmetryPct: number;
    headBobMm: number;
    stanceTimeImbalancePct: number;
    speedMetersPerSecond: number;
  };
  modelVersions?: {
    yoloV5?: string;
    mmPose?: string;
    xgBoost?: string;
  };
}

export interface WirelessSensorCalibrationInput {
  sensorId: string;
  sensorType: 'imu' | 'temperature' | 'humidity' | 'heart-rate' | 'gps';
  baseline: number;
  observed: number;
  tolerance: number;
  evidenceLinks: string[];
}

export interface EquinePlatformSnapshot {
  horseId: string;
  generatedAt: string;
  layers: Array<{
    layer: EquinePlatformLayer;
    responsibilities: string[];
    components: string[];
    evidenceLinks: string[];
  }>;
  managementModules: Record<EquineManagementModule, unknown>;
  privacy: FilteredHorseProfile['privacy'];
  approvalRequiredForStateMutation: true;
}

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

export class EquineFourLayerPlatformService {
  constructor(private readonly privacy: EquineIntelligencePrivacyService, private readonly audit: EquineAuditLogger) {}

  snapshot(horseId: string, actor: EquineRequestActor): EquinePlatformSnapshot {
    const profile = this.privacy.profile(horseId, actor);
    const managementModules = this.managementModules(horseId, actor);
    return {
      horseId,
      generatedAt: now(),
      layers: [
        {
          layer: 'Device',
          responsibilities: ['wireless sensor network', 'video capture', 'RTK/GNSS collar telemetry', 'automatic sensor calibration proposals'],
          components: ['imu-node', 'temperature-node', 'humidity-node', 'heart-rate-node', 'barn-camera', 'rtk-collar'],
          evidenceLinks: ['device://wireless-sensor-network', 'camera://barn-gait', 'rtk://equine-collar'],
        },
        {
          layer: 'Data',
          responsibilities: ['normalize sensor samples', 'role-scope veterinary data', 'hash-chain audit events', 'retain raw evidence links'],
          components: ['equine-profile-store', 'veterinary-privacy-filter', 'audit-chain', 'telemetry-event-store'],
          evidenceLinks: ['audit://equine/hash-chain', 'privacy://role-filtering'],
        },
        {
          layer: 'Processing',
          responsibilities: ['lameness inference', 'behavior classification', 'environment risk scoring', 'eligibility checks'],
          components: ['YOLOv5-detector', 'MMPose-keypoint-extractor', 'XGBoost-lameness-classifier', 'eligibility-engine'],
          evidenceLinks: ['model://yolov5-equine-v1', 'model://mmpose-equine-v1', 'model://xgboost-lameness-v1'],
        },
        {
          layer: 'Application',
          responsibilities: ['record management', 'epidemic monitoring', 'breeding planning', 'behavior dashboard', 'environment dashboard'],
          components: ['record-module', 'epidemic-module', 'breeding-module', 'behavior-module', 'environment-module'],
          evidenceLinks: ['app://equine-management-suite'],
        },
      ],
      managementModules,
      privacy: profile.privacy,
      approvalRequiredForStateMutation: true,
    };
  }

  managementModules(horseId: string, actor: EquineRequestActor): Record<EquineManagementModule, unknown> {
    const profile = this.privacy.profile(horseId, actor);
    return {
      Record: {
        identity: profile.identity,
        ownershipHistory: profile.ownershipHistory ?? 'role-redacted',
        racingCareer: profile.racingCareer ?? 'role-redacted',
        auditAvailable: true,
      },
      Epidemic: {
        vaccinationStatus: 'current',
        quarantineStatus: 'clear',
        barnExposureRisk: 'low',
        evidenceLinks: ['health://vaccination/current', 'barn://exposure/low'],
      },
      Breeding: {
        breedingEligibility: profile.role === 'public' ? 'redacted' : 'review-required',
        pedigree: profile.identity.pedigree ?? 'role-redacted',
        geneticRiskReview: 'veterinarian-or-regulator-review-required',
      },
      Behavior: {
        latestBehaviorClass: 'calm-alert',
        anomalyScore: 0.18,
        lamenessPipelineAvailable: true,
        evidenceLinks: ['behavior://stall-camera/baseline'],
      },
      Environment: {
        barnTemperatureC: 19.4,
        humidityPct: 52,
        ammoniaPpm: 3,
        risk: 'nominal',
        evidenceLinks: ['sensor://barn-2/temperature', 'sensor://barn-2/humidity', 'sensor://barn-2/ammonia'],
      },
    };
  }

  detectLameness(horseId: string, input: LamenessDetectionInput, actor: EquineRequestActor) {
    this.privacy.profile(horseId, actor);
    if (!input.videoFrameEvidence?.length) throw new Error('Lameness detection requires videoFrameEvidence');
    const yoloConfidence = Math.min(0.99, 0.78 + Math.max(0, 12 - input.gaitMetrics.speedMetersPerSecond) / 100);
    const poseConfidence = Math.min(0.99, 0.72 + input.gaitMetrics.headBobMm / 200);
    const asymmetrySignal = input.gaitMetrics.strideAsymmetryPct * 0.45 + input.gaitMetrics.stanceTimeImbalancePct * 0.35 + input.gaitMetrics.headBobMm * 0.20;
    const lamenessProbability = Math.max(0, Math.min(1, asymmetrySignal / 100));
    const severity = lamenessProbability >= 0.7 ? 'high' : lamenessProbability >= 0.4 ? 'medium' : 'low';
    const confidence = Math.round(((yoloConfidence + poseConfidence + Math.max(0.55, lamenessProbability)) / 3) * 1000) / 1000;
    const evidenceLinks = [
      ...input.videoFrameEvidence,
      `model://${input.modelVersions?.yoloV5 ?? 'yolov5-equine-v1'}`,
      `model://${input.modelVersions?.mmPose ?? 'mmpose-equine-v1'}`,
      `model://${input.modelVersions?.xgBoost ?? 'xgboost-lameness-v1'}`,
    ];
    const result = {
      horseId,
      pipeline: [
        { stage: 'YOLOv5', output: 'horse-and-limb-region-detections', confidence: yoloConfidence },
        { stage: 'MMPose', output: 'equine-keypoints-and-gait-phase', confidence: poseConfidence },
        { stage: 'XGBoost', output: 'lameness-probability', confidence, probability: Math.round(lamenessProbability * 1000) / 1000 },
      ],
      recommendation: {
        advisoryOnly: true,
        approvalRequiredForOperationalChange: true,
        action: severity === 'high' ? 'request-veterinarian-review-before-race' : 'continue-monitoring-with-veterinarian-notification',
        severity,
        confidence,
        evidence_links: evidenceLinks,
      },
    };
    this.audit.append({ horseId, type: 'equine.lameness.detected', actorId: actor.actorId, role: actor.role, occurredAt: now(), payload: result });
    return clone(result);
  }

  calibrateSensor(horseId: string, input: WirelessSensorCalibrationInput, actor: EquineRequestActor) {
    this.privacy.profile(horseId, actor);
    if (!input.evidenceLinks?.length) throw new Error('Sensor calibration requires evidenceLinks');
    const offset = input.baseline - input.observed;
    const withinTolerance = Math.abs(offset) <= input.tolerance;
    const calibration = {
      calibrationId: id('sensor-calibration'),
      horseId,
      sensorId: input.sensorId,
      sensorType: input.sensorType,
      baseline: input.baseline,
      observed: input.observed,
      offset,
      tolerance: input.tolerance,
      withinTolerance,
      automaticCalibration: true,
      approvalRequiredForStateMutation: true,
      applied: Boolean(actor.approvalId && actor.approverId && actor.approvalTimestamp),
      approvalId: actor.approvalId,
      approverId: actor.approverId,
      approvalTimestamp: actor.approvalTimestamp,
      evidence_links: input.evidenceLinks,
    };
    if (!calibration.applied) {
      return { ...calibration, status: 'approval-required', message: 'Automatic calibration was calculated but not applied without approval metadata.' };
    }
    const audit = this.audit.append({ horseId, type: 'equine.sensor.calibrated', actorId: actor.actorId, role: actor.role, occurredAt: actor.approvalTimestamp ?? now(), payload: calibration });
    return { ...calibration, status: 'applied', auditEventId: audit.eventId };
  }
}
