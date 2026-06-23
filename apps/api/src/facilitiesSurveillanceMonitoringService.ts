import type {
  FacilitiesEnvironmentalReadingDto,
  FacilitiesInspectionDeviceEvidenceDto,
  FacilitiesMaintenanceOutageLinkDto,
  FacilitiesMonitoringUseCase,
  FacilitiesScopedDeviceDto,
  FacilitiesSurveillanceAlertSummaryDto,
  FacilitiesSurveillanceMonitoringWorkspaceDto,
  FacilitiesUtilitiesMonitoringDto,
  SurveillanceAlertEventDto,
  SurveillanceAlertRuleKind,
  SurveillanceIoTWorkspaceDto,
} from '@trackmind/shared';
import { facilitiesSurveillanceMonitoringSchemaVersion } from '@trackmind/shared';
import type {
  FacilitiesMaintenanceService,
  FacilityInspectionRecord,
  FacilityWorkOrder,
} from './facilitiesMaintenance.js';
import type { AssetPrincipal } from './racetrackAssetRegistryService.js';
import type { SecurityActor } from './securityOps.js';
import type { SurveillanceIoTModule } from './surveillanceIoT/surveillanceIoTModule.js';

const FACILITIES_RULE_KINDS = new Set<SurveillanceAlertRuleKind>([
  'environmental-anomaly',
  'stable-facility-condition',
  'sensor-threshold-breach',
  'gateway-disconnected',
  'camera-offline',
  'stream-degraded',
  'track-surface-condition',
]);

function isFacilitiesDomain(domainScope: string): boolean {
  return domainScope === 'facilities-iot' || domainScope === 'operations' || domainScope === 'shared';
}

function inferUseCases(input: {
  displayName: string;
  sensorType?: string;
  domainScope: string;
  deviceKind: FacilitiesScopedDeviceDto['deviceKind'];
}): FacilitiesMonitoringUseCase[] {
  const haystack = `${input.displayName} ${input.sensorType ?? ''} ${input.domainScope}`.toLowerCase();
  const cases = new Set<FacilitiesMonitoringUseCase>();
  if (
    input.domainScope === 'facilities-iot'
    || haystack.includes('util')
    || haystack.includes('hvac')
    || haystack.includes('power')
    || haystack.includes('water')
  ) {
    cases.add('utilities-monitoring');
  }
  if (haystack.includes('barn') || haystack.includes('stable') || haystack.includes('paddock')) {
    cases.add('barn-stable-monitoring');
  }
  if (haystack.includes('gate') || haystack.includes('door') || haystack.includes('access')) {
    cases.add('gate-access-hardware');
  }
  if (haystack.includes('track') || haystack.includes('surface') || haystack.includes('rail')) {
    cases.add('track-infrastructure');
  }
  if (haystack.includes('environment') || haystack.includes('temp') || haystack.includes('humid')) {
    cases.add('environmental-conditions');
  }
  if (cases.size === 0 && isFacilitiesDomain(input.domainScope)) {
    cases.add('utilities-monitoring');
  }
  if (input.deviceKind === 'device-gateway') {
    cases.add('utilities-monitoring');
  }
  return [...cases];
}

function useCaseForRuleKind(ruleKind: SurveillanceAlertRuleKind): FacilitiesMonitoringUseCase {
  if (ruleKind === 'stable-facility-condition') return 'barn-stable-monitoring';
  if (ruleKind === 'environmental-anomaly') return 'environmental-conditions';
  if (ruleKind === 'track-surface-condition') return 'track-infrastructure';
  if (ruleKind === 'gateway-disconnected') return 'utilities-monitoring';
  if (ruleKind === 'camera-offline' || ruleKind === 'stream-degraded') return 'track-infrastructure';
  return 'utilities-monitoring';
}

function zoneLabelForDevice(workspace: SurveillanceIoTWorkspaceDto, zoneId?: string): string | undefined {
  if (!zoneId) return undefined;
  return (
    workspace.deviceZones.find((zone) => zone.id === zoneId)?.displayName
    ?? workspace.facilityZones.find((zone) => zone.id === zoneId)?.zoneLabel
  );
}

function mapFacilityAlert(event: SurveillanceAlertEventDto): FacilitiesSurveillanceAlertSummaryDto | null {
  if (!FACILITIES_RULE_KINDS.has(event.ruleKind)) return null;
  return {
    eventId: event.eventId,
    ruleKind: event.ruleKind,
    useCase: useCaseForRuleKind(event.ruleKind),
    title: event.title,
    severity: event.severity,
    resolutionStatus: event.resolutionStatus,
    sourceDeviceLabel: event.sourceDevice?.displayName,
    sourceZoneLabel: event.sourceZone?.zoneLabel,
    triggeredAt: event.triggeredAt,
    placeholderDerived: event.placeholderDerived,
  };
}

export class FacilitiesSurveillanceMonitoringService {
  buildMonitoringWorkspace(
    actor: SecurityActor,
    facilities: FacilitiesMaintenanceService,
    facilitiesPrincipal: AssetPrincipal,
    surveillanceModule: SurveillanceIoTModule,
    now: string,
  ): FacilitiesSurveillanceMonitoringWorkspaceDto {
    const facilitiesWorkspace = facilities.workspace(facilitiesPrincipal);
    const surveillanceWorkspace = surveillanceModule.buildWorkspace(actor);
    const alertingWorkspace = surveillanceModule.getAlertingWorkspace(actor);

    const scopedDevices: FacilitiesScopedDeviceDto[] = [
      ...surveillanceWorkspace.iotDevices
        .filter((device) => isFacilitiesDomain(device.domainScope) || device.sensorType.includes('environment') || device.sensorType.includes('door'))
        .map((device) => ({
          deviceId: device.id,
          deviceKind: 'iot-device' as const,
          displayName: device.displayName,
          domainScope: device.domainScope,
          health: device.health,
          status: device.status,
          sensorType: device.sensorType,
          zoneLabel: zoneLabelForDevice(surveillanceWorkspace, device.securityZoneId),
          useCases: inferUseCases({
            displayName: device.displayName,
            sensorType: device.sensorType,
            domainScope: device.domainScope,
            deviceKind: 'iot-device',
          }),
          lastSeenAt: device.lastSeenAt,
        })),
      ...surveillanceWorkspace.cameras
        .filter((camera) => {
          const facilityZoneIds = new Set(surveillanceWorkspace.facilityZones.map((zone) => zone.id));
          return isFacilitiesDomain(camera.domainScope)
            || Boolean(camera.securityZoneId && facilityZoneIds.has(camera.securityZoneId));
        })
        .map((camera) => ({
          deviceId: camera.id,
          deviceKind: 'camera-device' as const,
          displayName: camera.displayName,
          domainScope: camera.domainScope,
          health: camera.health,
          status: camera.status,
          zoneLabel: zoneLabelForDevice(surveillanceWorkspace, camera.securityZoneId),
          useCases: inferUseCases({
            displayName: camera.displayName,
            domainScope: camera.domainScope,
            deviceKind: 'camera-device',
          }),
          lastSeenAt: camera.lastSeenAt,
        })),
      ...surveillanceWorkspace.gateways
        .filter((gateway) => isFacilitiesDomain(gateway.domainScope) || gateway.connectorId === 'sensor-iot')
        .map((gateway) => ({
          deviceId: gateway.id,
          deviceKind: 'device-gateway' as const,
          displayName: gateway.displayName,
          domainScope: gateway.domainScope,
          health: gateway.health,
          status: gateway.status,
          zoneLabel: undefined,
          useCases: inferUseCases({
            displayName: gateway.displayName,
            domainScope: gateway.domainScope,
            deviceKind: 'device-gateway',
          }),
          lastSeenAt: gateway.lastSeenAt,
        })),
    ];

    const scopedDeviceIds = new Set(scopedDevices.map((device) => device.deviceId));

    const utilitiesMonitoring: FacilitiesUtilitiesMonitoringDto[] = facilitiesWorkspace.utilities.adapters.map((adapter) => ({
      adapterId: adapter.adapterId,
      kind: adapter.kind,
      vendor: adapter.vendor,
      status: adapter.status,
      linkedDeviceIds: adapter.assetIds.filter((assetId) =>
        scopedDevices.some((device) => device.displayName.toLowerCase().includes(assetId.toLowerCase().slice(0, 6))),
      ),
      lastSyncAt: adapter.lastSyncAt,
      coverageNotice:
        adapter.status !== 'connected'
          ? 'Utilities adapter degraded — verify linked IoT device telemetry before maintenance decisions.'
          : undefined,
    }));

    const environmentalConditions: FacilitiesEnvironmentalReadingDto[] = surveillanceWorkspace.recentReadings
      .filter((reading) => scopedDeviceIds.has(reading.deviceId))
      .map((reading) => {
        const device = surveillanceWorkspace.iotDevices.find((item) => item.id === reading.deviceId);
        return {
          deviceId: reading.deviceId,
          deviceLabel: device?.displayName ?? reading.displayName,
          metric: reading.metric,
          value: typeof reading.value === 'number' ? reading.value : Number(reading.value) || 0,
          unit: reading.unit ?? 'state',
          observedAt: reading.observedAt,
          quality: reading.quality,
        };
      });

    const maintenanceOutageLinks = this.buildMaintenanceOutageLinks(
      scopedDevices,
      facilitiesWorkspace.workOrders,
      surveillanceWorkspace,
      now,
    );

    const inspectionDeviceEvidence = this.buildInspectionEvidence(
      facilitiesWorkspace.inspections,
      scopedDevices,
      surveillanceWorkspace,
    );

    const facilityAlerts = alertingWorkspace.framework.alertEvents
      .map(mapFacilityAlert)
      .filter((event): event is FacilitiesSurveillanceAlertSummaryDto => event !== null)
      .filter((event) => {
        if (event.placeholderDerived) return true;
        return scopedDevices.some((device) => event.sourceDeviceLabel?.includes(device.displayName.split(' ')[0] ?? ''));
      });

    if (!facilityAlerts.some((alert) => alert.ruleKind === 'track-surface-condition')) {
      facilityAlerts.push({
        eventId: 'placeholder:facilities-track-infrastructure',
        ruleKind: 'track-infrastructure-placeholder',
        useCase: 'track-infrastructure',
        title: 'Track infrastructure visibility — contract placeholder',
        severity: 'info',
        resolutionStatus: 'open',
        triggeredAt: now,
        placeholderDerived: true,
        sourceZoneLabel: 'Track surface / rail corridor',
      });
    }

    const offlineDevices = scopedDevices.filter((device) => device.status === 'offline' || device.health === 'critical').length;
    const openFacilityAlerts = facilityAlerts.filter((alert) =>
      alert.resolutionStatus === 'open' || alert.resolutionStatus === 'acknowledged' || alert.resolutionStatus === 'escalated',
    ).length;

    return {
      generatedAt: now,
      schemaVersion: facilitiesSurveillanceMonitoringSchemaVersion,
      organizationId: surveillanceWorkspace.organizationId,
      tenantId: surveillanceWorkspace.tenantId,
      racetrackId: surveillanceWorkspace.racetrackId,
      summary: {
        scopedDevices: scopedDevices.length,
        offlineDevices,
        openFacilityAlerts,
        utilitiesAdapters: utilitiesMonitoring.length,
        maintenanceOutages: maintenanceOutageLinks.length,
        inspectionEvidenceRefs: inspectionDeviceEvidence.length,
        environmentalReadings: environmentalConditions.length,
      },
      scopedDevices,
      utilitiesMonitoring,
      environmentalConditions,
      maintenanceOutageLinks,
      inspectionDeviceEvidence,
      facilityAlerts,
      filterOptions: {
        useCases: [
          'utilities-monitoring',
          'barn-stable-monitoring',
          'gate-access-hardware',
          'track-infrastructure',
          'environmental-conditions',
        ],
        severities: ['info', 'low', 'medium', 'high', 'critical'],
        ruleKinds: [
          'environmental-anomaly',
          'stable-facility-condition',
          'sensor-threshold-breach',
          'gateway-disconnected',
          'camera-offline',
          'stream-degraded',
          'track-surface-condition',
          'track-infrastructure-placeholder',
        ],
      },
      mock: false,
    };
  }

  private buildMaintenanceOutageLinks(
    scopedDevices: FacilitiesScopedDeviceDto[],
    workOrders: FacilityWorkOrder[],
    surveillanceWorkspace: SurveillanceIoTWorkspaceDto,
    now: string,
  ): FacilitiesMaintenanceOutageLinkDto[] {
    const links: FacilitiesMaintenanceOutageLinkDto[] = [];
    const openOrders = workOrders.filter((order) => order.status !== 'completed' && order.status !== 'cancelled');

    surveillanceWorkspace.openAlerts.forEach((alert) => {
      if (!scopedDeviceIdsFromDevices(scopedDevices).has(alert.deviceId)) return;
      const device = scopedDevices.find((item) => item.deviceId === alert.deviceId);
      const relatedOrder = openOrders.find(
        (order) =>
          order.evidence.some((item) => item.includes(alert.deviceId) || item.includes(device?.displayName ?? ''))
          || order.title.toLowerCase().includes(device?.displayName.toLowerCase().split(' ')[0] ?? ''),
      );
      links.push({
        outageId: alert.id,
        workOrderId: relatedOrder?.id,
        deviceId: alert.deviceId,
        deviceLabel: device?.displayName ?? alert.displayName,
        title: alert.title,
        severity: alert.severity,
        detail: alert.detail,
        linkedAt: alert.triggeredAt,
      });
    });

    scopedDevices
      .filter((device) => device.status === 'offline' || device.health === 'critical')
      .forEach((device) => {
        if (links.some((link) => link.deviceId === device.deviceId)) return;
        const relatedOrder = openOrders.find((order) => order.evidence.some((item) => item.includes(device.deviceId)));
        links.push({
          outageId: `outage:${device.deviceId}`,
          workOrderId: relatedOrder?.id,
          deviceId: device.deviceId,
          deviceLabel: device.displayName,
          title: `${device.displayName} device outage`,
          severity: device.status === 'offline' ? 'high' : 'medium',
          detail: 'Device offline or critical health — review maintenance schedule and readiness impact.',
          linkedAt: device.lastSeenAt ?? now,
        });
      });

    return links;
  }

  private buildInspectionEvidence(
    inspections: FacilityInspectionRecord[],
    scopedDevices: FacilitiesScopedDeviceDto[],
    surveillanceWorkspace: SurveillanceIoTWorkspaceDto,
  ): FacilitiesInspectionDeviceEvidenceDto[] {
    const evidence: FacilitiesInspectionDeviceEvidenceDto[] = [];

    inspections.forEach((inspection) => {
      (inspection.attachmentRefs ?? []).forEach((ref, index) => {
        evidence.push({
          evidenceId: `inspection-evidence:${inspection.id}:${index}`,
          inspectionId: inspection.id,
          assetId: inspection.assetId,
          title: `Inspection attachment — ${inspection.inspectionType ?? 'facility inspection'}`,
          capturedAt: inspection.inspectedAt,
          evidence: [ref, inspection.auditId],
          playbackUnavailable: true,
        });
      });

      const snapshot = surveillanceWorkspace.telemetrySnapshots.find((item) =>
        scopedDevices.some((device) => device.deviceId === item.deviceId && device.useCases.includes('environmental-conditions')),
      );
      if (snapshot && inspection.findings.length > 0) {
        evidence.push({
          evidenceId: `inspection-telemetry:${inspection.id}`,
          inspectionId: inspection.id,
          assetId: inspection.assetId,
          deviceId: snapshot.deviceId,
          title: `Inspection-linked telemetry snapshot — ${inspection.facilityCategory ?? 'facility'}`,
          capturedAt: snapshot.capturedAt,
          evidence: [`telemetry:${snapshot.deviceId}`, inspection.auditId, ...inspection.findings.slice(0, 2)],
          playbackUnavailable: true,
        });
      }
    });

    return evidence;
  }
}

function scopedDeviceIdsFromDevices(devices: FacilitiesScopedDeviceDto[]): Set<string> {
  return new Set(devices.map((device) => device.deviceId));
}
