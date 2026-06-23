import type {
  EquineStableBarnEnvironmentalSensorDto,
  EquineSurveillanceAccessPolicyDto,
  EquineSurveillanceContextWorkspaceDto,
  EquineSurveillancePrivacyTier,
  EquineTransportBayMonitoringPlaceholderDto,
  EquineTransportMovementObservationDto,
  EquineVeterinaryAreaZoneReferenceDto,
  EquineWelfareIncidentEvidenceReferenceDto,
  EquineWelfareIntelligenceOperationsDto,
  Role,
  SurveillanceIoTWorkspaceDto,
} from '@trackmind/shared';
import {
  equineSurveillanceContextSchemaVersion,
  hasPermission,
  normalizeRole,
  veterinaryPrivacyScopesByRole,
} from '@trackmind/shared';
import type { SecurityActor } from './securityOps.js';
import type { SurveillanceIoTModule } from './surveillanceIoT/surveillanceIoTModule.js';

const PLACEHOLDER_NOTICE =
  'Contract placeholder — no automated detection or analytics ingest is connected. Privacy-safe metadata only; playback is never exposed in equine workflows.';

const BARN_ZONE_KINDS = new Set(['barn', 'paddock', 'veterinary']);
const VET_ZONE_KINDS = new Set(['veterinary']);
const TRANSPORT_ZONE_KINDS = new Set(['barn', 'paddock', 'veterinary', 'parking-logistics']);

function buildAccessPolicy(role: Role): EquineSurveillanceAccessPolicyDto {
  const scopes = veterinaryPrivacyScopesByRole[role] ?? ['public'];
  const allowedPrivacyTiers: EquineSurveillancePrivacyTier[] = ['public-operational'];
  if (scopes.includes('care-team')) allowedPrivacyTiers.push('care-team');
  if (scopes.includes('veterinary-confidential')) allowedPrivacyTiers.push('veterinary-confidential');

  const redactedSections: string[] = [];
  if (!scopes.includes('care-team')) {
    redactedSections.push('welfareIncidentEvidenceReferences');
  }
  if (!scopes.includes('veterinary-confidential')) {
    redactedSections.push('veterinaryAreaZoneReferences');
  }
  if (!scopes.includes('care-team') && !hasPermission(role, 'track:readings')) {
    redactedSections.push('stableBarnEnvironmentalSensors');
  }
  if (!scopes.includes('care-team') && !scopes.includes('racing-officials')) {
    redactedSections.push('transportMovementObservations');
  }

  const accessNotice =
    redactedSections.length === 0
      ? 'Full equine surveillance metadata visibility for your role within privacy policy boundaries.'
      : `Sections redacted for role ${role}: ${redactedSections.join(', ')}. Sensitive welfare and veterinary contexts require authorized care-team or veterinary-confidential scope.`;

  return { viewerRole: role, allowedPrivacyTiers: allowedPrivacyTiers, redactedSections, accessNotice };
}

function canViewTier(policy: EquineSurveillanceAccessPolicyDto, tier: EquineSurveillancePrivacyTier): boolean {
  return policy.allowedPrivacyTiers.includes(tier);
}

function redactHorseId(horseId: string | undefined, policy: EquineSurveillanceAccessPolicyDto): {
  horseId?: string;
  horseIdRedacted?: boolean;
} {
  if (!horseId) return {};
  if (canViewTier(policy, 'care-team')) return { horseId };
  return { horseIdRedacted: true };
}

export class EquineSurveillanceContextService {
  buildContext(
    viewerRole: Role,
    actor: SecurityActor,
    surveillanceModule: SurveillanceIoTModule,
    welfareWorkspace: EquineWelfareIntelligenceOperationsDto | undefined,
    now: string,
  ): EquineSurveillanceContextWorkspaceDto {
    const surveillanceWorkspace = surveillanceModule.buildWorkspace(actor);
    const zoneMapping = surveillanceModule.getZoneMappingWorkspace(actor);
    const accessPolicy = buildAccessPolicy(viewerRole);

    const transportBayMonitoringPlaceholders = this.buildTransportPlaceholders(zoneMapping.operationalZones, surveillanceWorkspace);
    const stableBarnEnvironmentalSensors = this.buildBarnSensors(surveillanceWorkspace, zoneMapping.operationalZones);
    const welfareIncidentEvidenceReferences = this.buildWelfareEvidence(welfareWorkspace, surveillanceWorkspace, accessPolicy);
    const veterinaryAreaZoneReferences = this.buildVeterinaryZones(zoneMapping.operationalZones, accessPolicy);
    const transportMovementObservations = this.buildTransportObservations(welfareWorkspace, zoneMapping.operationalZones, accessPolicy, now);

    const filtered = this.applyPolicy({
      transportBayMonitoringPlaceholders,
      stableBarnEnvironmentalSensors,
      welfareIncidentEvidenceReferences,
      veterinaryAreaZoneReferences,
      transportMovementObservations,
    }, accessPolicy);

    return {
      generatedAt: now,
      schemaVersion: equineSurveillanceContextSchemaVersion,
      organizationId: surveillanceWorkspace.organizationId,
      tenantId: surveillanceWorkspace.tenantId,
      racetrackId: surveillanceWorkspace.racetrackId,
      privacyNotice:
        'Equine surveillance context is metadata-only. Horse-identifiable video playback and veterinary-confidential linkage remain restricted by role.',
      accessPolicy,
      summary: {
        transportBayPlaceholders: filtered.transportBayMonitoringPlaceholders.length,
        barnEnvironmentalSensors: filtered.stableBarnEnvironmentalSensors.length,
        welfareEvidenceReferences: filtered.welfareIncidentEvidenceReferences.length,
        veterinaryAreaZones: filtered.veterinaryAreaZoneReferences.length,
        transportMovementObservations: filtered.transportMovementObservations.length,
        redactedSectionCount: accessPolicy.redactedSections.length,
      },
      ...filtered,
      mock: false,
    };
  }

  resolveViewerRole(roleHeader: string | undefined): Role {
    return normalizeRole(roleHeader ?? 'staff-limited') ?? 'staff-limited';
  }

  private applyPolicy(
    sections: {
      transportBayMonitoringPlaceholders: EquineTransportBayMonitoringPlaceholderDto[];
      stableBarnEnvironmentalSensors: EquineStableBarnEnvironmentalSensorDto[];
      welfareIncidentEvidenceReferences: EquineWelfareIncidentEvidenceReferenceDto[];
      veterinaryAreaZoneReferences: EquineVeterinaryAreaZoneReferenceDto[];
      transportMovementObservations: EquineTransportMovementObservationDto[];
    },
    policy: EquineSurveillanceAccessPolicyDto,
  ) {
    return {
      transportBayMonitoringPlaceholders: canViewTier(policy, 'public-operational')
        ? sections.transportBayMonitoringPlaceholders
        : [],
      stableBarnEnvironmentalSensors: policy.redactedSections.includes('stableBarnEnvironmentalSensors')
        ? []
        : sections.stableBarnEnvironmentalSensors.filter(
            (sensor) =>
              sensor.requiredPrivacyTier === 'public-operational'
              || canViewTier(policy, 'care-team'),
          ),
      welfareIncidentEvidenceReferences: policy.redactedSections.includes('welfareIncidentEvidenceReferences')
        ? []
        : sections.welfareIncidentEvidenceReferences,
      veterinaryAreaZoneReferences: policy.redactedSections.includes('veterinaryAreaZoneReferences')
        ? []
        : sections.veterinaryAreaZoneReferences.filter(
            (zone) =>
              zone.requiredPrivacyTier === 'care-team'
                ? canViewTier(policy, 'care-team')
                : canViewTier(policy, 'veterinary-confidential'),
          ),
      transportMovementObservations: policy.redactedSections.includes('transportMovementObservations')
        ? []
        : sections.transportMovementObservations.filter(
            (observation) =>
              observation.requiredPrivacyTier === 'public-operational'
              || canViewTier(policy, 'care-team'),
          ).map((observation) => {
            if (canViewTier(policy, 'care-team')) return observation;
            return {
              ...observation,
              horseId: undefined,
              horseIdRedacted: observation.horseId ? true : undefined,
              summary: observation.summary.replace(/horse-\S+/gi, '[horse-redacted]'),
            };
          }),
    };
  }

  private buildTransportPlaceholders(
    zones: ReturnType<SurveillanceIoTModule['getZoneMappingWorkspace']>['operationalZones'],
    workspace: SurveillanceIoTWorkspaceDto,
  ): EquineTransportBayMonitoringPlaceholderDto[] {
    const logisticsZones = zones.filter((zone) => TRANSPORT_ZONE_KINDS.has(zone.zoneKind));
    const transportDevices = workspace.iotDevices.filter((device) => {
      const haystack = `${device.displayName} ${device.sensorType}`.toLowerCase();
      return haystack.includes('door') || haystack.includes('gate') || haystack.includes('transport');
    });

    return [
      {
        placeholderId: 'placeholder:equine-transport-bay',
        title: 'Horse transport bay monitoring (placeholder)',
        detail:
          'Reserved contract for correlating horse arrival/departure bay occupancy with door sensors and privacy-masked camera health metadata once approved ingest is connected.',
        readiness: 'placeholder',
        placeholderNotice: PLACEHOLDER_NOTICE,
        relatedZoneIds: logisticsZones.map((zone) => zone.zoneId),
        relatedDeviceIds: transportDevices.map((device) => device.id),
        requiredPrivacyTier: 'public-operational',
      },
    ];
  }

  private buildBarnSensors(
    workspace: SurveillanceIoTWorkspaceDto,
    zones: ReturnType<SurveillanceIoTModule['getZoneMappingWorkspace']>['operationalZones'],
  ): EquineStableBarnEnvironmentalSensorDto[] {
    const barnZones = zones.filter((zone) => BARN_ZONE_KINDS.has(zone.zoneKind));
    const barnDeviceIds = new Set(barnZones.flatMap((zone) => zone.iotDeviceIds));

    return workspace.recentReadings
      .filter((reading) => barnDeviceIds.has(reading.deviceId))
      .map((reading) => {
        const device = workspace.iotDevices.find((item) => item.id === reading.deviceId);
        const zone = barnZones.find((item) => item.iotDeviceIds.includes(reading.deviceId));
        return {
          deviceId: reading.deviceId,
          label: device?.displayName ?? reading.displayName,
          zoneLabel: zone?.zoneLabel ?? 'Barn / stable zone',
          metric: reading.metric,
          value: reading.value,
          unit: reading.unit,
          quality: reading.quality,
          observedAt: reading.observedAt,
          health: device?.health ?? device?.status ?? 'unknown',
          requiredPrivacyTier: reading.quality === 'good' ? 'public-operational' : 'care-team',
        };
      });
  }

  private buildWelfareEvidence(
    welfareWorkspace: EquineWelfareIntelligenceOperationsDto | undefined,
    surveillanceWorkspace: SurveillanceIoTWorkspaceDto,
    policy: EquineSurveillanceAccessPolicyDto,
  ): EquineWelfareIncidentEvidenceReferenceDto[] {
    if (!canViewTier(policy, 'care-team') || !welfareWorkspace) return [];

    const references: EquineWelfareIncidentEvidenceReferenceDto[] = [];

    welfareWorkspace.alerts.forEach((alert) => {
      const horse = redactHorseId(alert.horseId, policy);
      references.push({
        evidenceReferenceId: `evidence:welfare-alert:${alert.alertId}`,
        kind: 'welfare-alert',
        title: alert.title,
        ...horse,
        linkedAlertId: alert.alertId,
        capturedAt: alert.raisedAt,
        evidence: [alert.auditId, alert.summary],
        playbackUnavailable: true,
        linkageReason: 'Welfare alert cross-reference for incident traceability — metadata only.',
        requiredPrivacyTier: 'care-team',
      });
    });

    welfareWorkspace.observations.forEach((observation) => {
      const horse = redactHorseId(observation.horseId, policy);
      references.push({
        evidenceReferenceId: `evidence:welfare-observation:${observation.observationId}`,
        kind: 'welfare-observation',
        title: `Welfare observation — ${observation.category}`,
        ...horse,
        capturedAt: observation.observedAt,
        evidence: observation.evidence.length ? observation.evidence : [observation.auditId],
        playbackUnavailable: true,
        linkageReason: 'Observation evidence declared during welfare intake — no playback exposed.',
        requiredPrivacyTier: 'care-team',
      });
    });

    surveillanceWorkspace.openAlerts
      .filter((alert) => alert.alertCode.includes('STABLE') || alert.alertCode.includes('SENSOR'))
      .slice(0, 4)
      .forEach((alert) => {
        references.push({
          evidenceReferenceId: `evidence:device-alert:${alert.id}`,
          kind: 'device-alert',
          title: alert.title,
          capturedAt: alert.triggeredAt,
          evidence: alert.evidence,
          playbackUnavailable: true,
          linkageReason: 'Barn/stable device alert correlated with welfare monitoring zones.',
          requiredPrivacyTier: 'care-team',
        });
      });

    return references.slice(0, 16);
  }

  private buildVeterinaryZones(
    zones: ReturnType<SurveillanceIoTModule['getZoneMappingWorkspace']>['operationalZones'],
    policy: EquineSurveillanceAccessPolicyDto,
  ): EquineVeterinaryAreaZoneReferenceDto[] {
    const vetZones = zones.filter((zone) => VET_ZONE_KINDS.has(zone.zoneKind));
    const includeDeviceIds = canViewTier(policy, 'veterinary-confidential');

    return vetZones.map((zone) => ({
      zoneId: zone.zoneId,
      zoneLabel: zone.zoneLabel,
      zoneKind: zone.zoneKind,
      deviceCount: zone.healthSummary.totalDeviceCount,
      cameraCount: zone.healthSummary.cameraCount,
      healthBand: zone.healthSummary.healthBand,
      linkedDeviceIds: includeDeviceIds ? zone.iotDeviceIds : [],
      coverageNotice: includeDeviceIds
        ? undefined
        : 'Device identifiers redacted — veterinary-confidential scope required for device-level linkage.',
      requiredPrivacyTier: includeDeviceIds ? 'veterinary-confidential' : 'care-team',
    }));
  }

  private buildTransportObservations(
    welfareWorkspace: EquineWelfareIntelligenceOperationsDto | undefined,
    zones: ReturnType<SurveillanceIoTModule['getZoneMappingWorkspace']>['operationalZones'],
    policy: EquineSurveillanceAccessPolicyDto,
    now: string,
  ): EquineTransportMovementObservationDto[] {
    const observations: EquineTransportMovementObservationDto[] = [];
    const paddockZone = zones.find((zone) => zone.zoneKind === 'paddock');
    const barnZone = zones.find((zone) => zone.zoneKind === 'barn');
    const vetZone = zones.find((zone) => zone.zoneKind === 'veterinary');

    welfareWorkspace?.observations
      .filter((observation) => {
        const haystack = `${observation.category} ${observation.notes ?? ''}`.toLowerCase();
        return haystack.includes('transport') || haystack.includes('barn') || haystack.includes('paddock');
      })
      .forEach((observation) => {
        const horse = redactHorseId(observation.horseId, policy);
        const haystack = `${observation.category} ${observation.notes ?? ''}`.toLowerCase();
        observations.push({
          observationId: `transport-obs:${observation.observationId}`,
          occurredAt: observation.observedAt,
          fromZoneLabel: haystack.includes('transport') ? 'Transport ingress' : barnZone?.zoneLabel,
          toZoneLabel: haystack.includes('paddock') ? paddockZone?.zoneLabel : vetZone?.zoneLabel ?? barnZone?.zoneLabel,
          movementKind: haystack.includes('transport')
            ? 'transport-arrival'
            : haystack.includes('paddock')
              ? 'paddock-move'
              : haystack.includes('vet')
                ? 'vet-area-transit'
                : 'barn-transfer',
          summary: canViewTier(policy, 'care-team')
            ? observation.notes ?? observation.category
            : 'Movement observation recorded — detail restricted to care-team scope.',
          ...horse,
          traceRefs: observation.evidence.length ? observation.evidence : [observation.auditId],
          requiredPrivacyTier: 'care-team',
        });
      });

    if (observations.length === 0 && canViewTier(policy, 'public-operational')) {
      observations.push({
        observationId: 'transport-obs:seed-context',
        occurredAt: now,
        fromZoneLabel: barnZone?.zoneLabel ?? 'Backstretch barn block',
        toZoneLabel: paddockZone?.zoneLabel ?? 'Paddock restricted gate',
        movementKind: 'observation',
        summary: 'Nominal transport corridor posture — correlate with transport bay placeholder when ingest is approved.',
        traceRefs: ['placeholder:equine-transport-bay'],
        requiredPrivacyTier: 'public-operational',
      });
    }

    return observations.slice(0, 12);
  }
}
