import type { SurveillanceIoTMonitoringWorkspaceDto } from '@trackmind/shared';
import { surveillanceIoTArchitectureSchemaVersion } from '@trackmind/shared';
import type { SurveillanceIoTWorkspaceDto } from '@trackmind/shared';
import type { SurveillanceAdapterRegistry } from '@trackmind/shared';
import type { SurveillanceIoTModuleContext } from '../types.js';

export { SurveillanceHealthService } from './surveillanceHealthService.js';

export class StreamHealthService {
  listFromWorkspace(workspace: SurveillanceIoTWorkspaceDto) {
    return workspace.videoStreams;
  }

  mergeAdapterHealth(
    workspace: SurveillanceIoTWorkspaceDto,
    adapterRegistry: SurveillanceAdapterRegistry,
    at: string,
  ) {
    const adapterHealth = adapterRegistry.snapshot(at).streamHealth;
    return workspace.videoStreams.map((stream) => {
      const externalId = stream.cameraId;
      const adapterEntry = adapterHealth.find((entry) => entry.externalCameraId === externalId || stream.id.includes(externalId));
      if (!adapterEntry) return stream;
      return {
        ...stream,
        streamStatus: adapterEntry.streamStatus,
        bitrateKbps: adapterEntry.bitrateKbps,
        frameRate: adapterEntry.frameRate,
        recordingActive: adapterEntry.recordingActive ?? stream.recordingActive,
      };
    });
  }
}

export class OperationalMonitoringService {
  buildMonitoringWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    adapterRegistry: SurveillanceAdapterRegistry,
    streamHealth: StreamHealthService,
  ): SurveillanceIoTMonitoringWorkspaceDto {
    const videoStreams = streamHealth.mergeAdapterHealth(workspace, adapterRegistry, ctx.now);
    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceIoTArchitectureSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      videoStreams,
      healthStatuses: workspace.healthStatuses,
      readiness: workspace.readiness,
      adapterSnapshot: adapterRegistry.snapshot(ctx.now),
      coverage: workspace.coverage,
      mock: false,
    };
  }
}
