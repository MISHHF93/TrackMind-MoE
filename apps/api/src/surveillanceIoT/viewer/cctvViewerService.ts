import type {
  CameraDeviceDto,
  SurveillanceAdapterRegistry,
  SurveillanceCctvViewerPlaybackMode,
  SurveillanceCctvViewerStreamTileDto,
  SurveillanceCctvViewerWorkspaceDto,
  SurveillanceIoTWorkspaceDto,
  VideoStreamDto,
} from '@trackmind/shared';
import {
  surveillanceAdapterClaimsActiveIntegration,
  surveillanceCctvViewerSchemaVersion,
} from '@trackmind/shared';
import type { SurveillanceIoTModuleContext } from '../types.js';

function playbackModeForStream(input: {
  stream: VideoStreamDto | undefined;
  camera: CameraDeviceDto;
  gatewayActive: boolean;
  streamSources: Array<{ externalCameraId: string; playbackEndpointRef?: string; primaryProtocol: string }>;
}): SurveillanceCctvViewerPlaybackMode {
  const { stream, camera, gatewayActive, streamSources } = input;
  if (camera.status === 'offline' || stream?.streamStatus === 'offline' || stream?.streamStatus === 'archived') {
    return 'gateway-required';
  }

  if (gatewayActive) {
    const source = streamSources.find((entry) => entry.externalCameraId === camera.id);
    if (source?.playbackEndpointRef) {
      const protocol = source.primaryProtocol;
      if (protocol === 'hls') return 'hls';
      if (protocol === 'mjpeg') return 'mjpeg';
      if (protocol === 'webrtc') return 'webrtc';
    }
  }

  if (stream?.streamStatus === 'live' || stream?.streamStatus === 'buffering') {
    return 'simulated-preview';
  }

  return 'gateway-required';
}

export class CctvViewerService {
  buildWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    adapterRegistry: SurveillanceAdapterRegistry,
    focusedCameraId?: string,
  ): SurveillanceCctvViewerWorkspaceDto {
    const snapshot = adapterRegistry.snapshot(ctx.now);
    const gatewayActive = snapshot.activeIntegrationClaimed
      && adapterRegistry.list().some(surveillanceAdapterClaimsActiveIntegration);
    const streamSources = snapshot.streamSources;

    const zoneLabels = new Map(
      workspace.facilityZones.map((zone) => [zone.id, zone.zoneLabel ?? zone.displayName]),
    );

    const tiles: SurveillanceCctvViewerStreamTileDto[] = workspace.cameras.map((camera, index) => {
      const stream = workspace.videoStreams.find((entry) => entry.cameraId === camera.id);
      const playbackMode = playbackModeForStream({
        stream,
        camera,
        gatewayActive,
        streamSources,
      });
      const source = streamSources.find((entry) => entry.externalCameraId === camera.id);
      const mediaUrl = gatewayActive && source?.playbackEndpointRef
        ? source.playbackEndpointRef
        : undefined;

      return {
        cameraId: camera.id,
        displayName: camera.displayName,
        zoneId: camera.facilityZoneId,
        zoneLabel: camera.facilityZoneId ? zoneLabels.get(camera.facilityZoneId) : undefined,
        streamStatus: stream?.streamStatus ?? 'offline',
        protocol: stream?.protocol ?? 'rtsp',
        playbackMode,
        mediaUrl,
        privacyMaskingEnabled: camera.privacyMaskingEnabled ?? false,
        recordingActive: stream?.recordingActive ?? false,
        ptzCapable: camera.ptzCapable ?? false,
        lastSeenAt: camera.lastSeenAt,
        viewerSlot: index + 1,
      };
    });

    const zoneCounts = new Map<string, { label: string; count: number }>();
    for (const tile of tiles) {
      const zoneId = tile.zoneId ?? 'unassigned';
      const label = tile.zoneLabel ?? 'Unassigned';
      const current = zoneCounts.get(zoneId) ?? { label, count: 0 };
      zoneCounts.set(zoneId, { label: current.label, count: current.count + 1 });
    }

    const zoneFilterOptions = [...zoneCounts.entries()].map(([zoneId, entry]) => ({
      zoneId,
      label: entry.label,
      cameraCount: entry.count,
    }));

    const focused = focusedCameraId && tiles.some((tile) => tile.cameraId === focusedCameraId)
      ? focusedCameraId
      : undefined;

    return {
      generatedAt: ctx.now,
      schemaVersion: surveillanceCctvViewerSchemaVersion,
      organizationId: ctx.scope.organizationId,
      tenantId: ctx.scope.tenantId,
      racetrackId: ctx.scope.racetrackId,
      streamGatewayConfigured: gatewayActive,
      activeIntegrationClaimed: snapshot.activeIntegrationClaimed,
      defaultLayout: focused ? 'focus' : tiles.length > 4 ? '3x3' : '2x2',
      focusedCameraId: focused,
      tiles,
      zoneFilterOptions,
      disclaimer: gatewayActive
        ? 'In-house CCTV viewer — live media URLs are served through the configured stream gateway adapter only.'
        : 'In-house CCTV viewer shell — connect and validate a camera stream gateway adapter to enable live media URLs. Online cameras show a simulated preview until then.',
      mock: false,
    };
  }
}
