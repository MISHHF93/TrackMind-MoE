import type {
  SurveillanceIoTKpiComputedInput,
  SurveillanceIoTKpiPackDto,
  SurveillanceIoTWorkspaceDto,
  SurveillanceIoTZoneMappingWorkspaceDto,
} from '@trackmind/shared';
import { buildSurveillanceIoTKpiPackDto } from '@trackmind/shared';
import type { SurveillanceIoTModuleContext } from '../types.js';

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 100;
  return Math.round((numerator / denominator) * 100);
}

export class SurveillanceIoTKpiService {
  computeFromWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    zoneMapping?: SurveillanceIoTZoneMappingWorkspaceDto,
  ): SurveillanceIoTKpiPackDto {
    const cameras = workspace.cameras;
    const iotDevices = workspace.iotDevices;
    const gateways = workspace.gateways;
    const streams = workspace.videoStreams;

    const onlineCameras = cameras.filter((camera) => camera.status === 'online').length;
    const cameraUptime = pct(onlineCameras, cameras.length);

    const availableStreams = streams.filter((stream) => stream.streamStatus === 'live' || stream.streamStatus === 'buffering').length;
    const streamAvailability = pct(availableStreams, streams.length);

    const onlineDevices = cameras.filter((device) => device.status === 'online').length
      + iotDevices.filter((device) => device.status === 'online').length;
    const totalDevices = cameras.length + iotDevices.length;
    const deviceConnectivityRate = pct(onlineDevices, totalDevices);

    const openAlerts = workspace.openAlerts.filter((alert) => alert.alertStatus !== 'resolved' && alert.alertStatus !== 'suppressed');
    const alertVolume = openAlerts.length;
    const unresolvedAlerts = openAlerts.filter((alert) => alert.alertStatus === 'open' || alert.alertStatus === 'acknowledged').length;

    const onlineGateways = gateways.filter((gateway) => gateway.status === 'online').length;
    const gatewayUptime = pct(onlineGateways, gateways.length);

    const facilitySensors = iotDevices.filter((device) => device.domainScope === 'facilities-iot' || device.domainScope === 'shared');
    const healthyFacilitySensors = facilitySensors.filter((device) => device.status !== 'offline' && device.health !== 'critical').length;
    const facilitySensorHealth = pct(healthyFacilitySensors, facilitySensors.length);

    const operationalZones = zoneMapping?.operationalZones ?? [];
    const zonesWithDevices = operationalZones.filter((zone) => zone.healthSummary.totalDeviceCount > 0).length;
    const zoneCoverageCompleteness = pct(zonesWithDevices, operationalZones.length || 1);

    const maintenanceBacklog = workspace.maintenanceRecords.filter(
      (record) => record.maintenanceStatus === 'scheduled' || record.maintenanceStatus === 'in-progress',
    ).length;

    const incidentLinkedEvidenceCount = workspace.incidentReferences.length + workspace.videoEvidence.length;

    const metrics: SurveillanceIoTKpiComputedInput[] = [
      { slug: 'camera-uptime', value: cameraUptime, trend: cameraUptime >= 98 ? 'flat' : 'down' },
      { slug: 'stream-availability', value: streamAvailability, trend: streamAvailability >= 97 ? 'flat' : 'down' },
      { slug: 'device-connectivity-rate', value: deviceConnectivityRate, trend: 'flat' },
      { slug: 'alert-volume', value: alertVolume, trend: alertVolume > 5 ? 'up' : 'flat' },
      { slug: 'unresolved-surveillance-alerts', value: unresolvedAlerts, trend: unresolvedAlerts > 2 ? 'up' : 'flat' },
      { slug: 'gateway-uptime', value: gatewayUptime, trend: 'flat' },
      { slug: 'facility-sensor-health', value: facilitySensorHealth, trend: 'flat' },
      { slug: 'zone-coverage-completeness', value: zoneCoverageCompleteness, trend: 'flat' },
      { slug: 'maintenance-backlog', value: maintenanceBacklog, trend: maintenanceBacklog > 3 ? 'up' : 'flat' },
      { slug: 'incident-linked-evidence-count', value: incidentLinkedEvidenceCount, trend: 'flat' },
    ];

    return buildSurveillanceIoTKpiPackDto({
      generatedAt: ctx.now,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      metrics,
      mock: false,
    });
  }
}
