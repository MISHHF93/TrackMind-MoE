import type { SurveillanceIoTAdminConfigurationDto, SurveillanceIoTAdministrationWorkspaceDto } from '@trackmind/shared';
import { surveillanceIoTArchitectureSchemaVersion } from '@trackmind/shared';
import type { SurveillanceIoTWorkspaceDto } from '@trackmind/shared';
import type { SurveillanceAdapterRegistry } from '@trackmind/shared';
import type { SurveillanceIoTModuleContext } from '../types.js';

export class DeviceRegistryService {
  listFromWorkspace(workspace: SurveillanceIoTWorkspaceDto) {
    return [
      ...workspace.cameras.map((camera) => ({
        id: camera.id,
        displayName: camera.displayName,
        kind: camera.kind,
        status: camera.status,
        health: camera.health,
        domainScope: camera.domainScope,
        assetId: camera.assetId,
      })),
      ...workspace.iotDevices.map((sensor) => ({
        id: sensor.id,
        displayName: sensor.displayName,
        kind: sensor.kind,
        status: sensor.status,
        health: sensor.health,
        domainScope: sensor.domainScope,
        assetId: sensor.assetId,
      })),
    ];
  }
}

export class CameraRegistryService {
  list(workspace: SurveillanceIoTWorkspaceDto) {
    return workspace.cameras;
  }
}

export class SensorRegistryService {
  list(workspace: SurveillanceIoTWorkspaceDto) {
    return workspace.iotDevices;
  }
}

export class AdminConfigurationService {
  buildConfiguration(adapterRegistry: SurveillanceAdapterRegistry): SurveillanceIoTAdminConfigurationDto {
    const adapters = adapterRegistry.list();
    return {
      connectorIds: [...new Set(adapters.map((adapter) => adapter.connectorId))],
      retentionPolicyIds: ['retention-security-default'],
      defaultRecordingMode: 'continuous',
      privacyMaskingDefault: true,
      webhookIngestEnabled: true,
      twinSyncEnabled: true,
      approvalRequiredForSensitiveRead: true,
    };
  }

  buildAdministrationWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    adapterRegistry: SurveillanceAdapterRegistry,
    deviceRegistry: DeviceRegistryService,
    cameraRegistry: CameraRegistryService,
    sensorRegistry: SensorRegistryService,
  ): SurveillanceIoTAdministrationWorkspaceDto {
    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      devices: deviceRegistry.listFromWorkspace(workspace),
      cameras: cameraRegistry.list(workspace),
      sensors: sensorRegistry.list(workspace),
      gateways: workspace.gateways,
      configuration: this.buildConfiguration(adapterRegistry),
      adapters: adapterRegistry.list(),
      mock: false,
    };
  }
}
