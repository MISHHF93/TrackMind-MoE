import type {
  MediaAssetRef,
  MediaPlaybackDescriptorDto,
  MediaViewerClipDto,
  MediaViewerInputDto,
  MediaViewerOutputCapabilityDto,
  MediaViewerWorkspaceDto,
  SurveillanceAdapterRegistry,
  SurveillanceIoTWorkspaceDto,
  VideoEvidenceReferenceDto,
} from '@trackmind/shared';
import {
  encodeMediaAssetRef,
  mediaViewerSchemaVersion,
  parseMediaAssetRef,
} from '@trackmind/shared';
import type { SurveillanceIoTModuleContext } from '../types.js';
import { CctvViewerService } from './cctvViewerService.js';
import { MediaPlaybackResolver } from './mediaPlaybackResolver.js';

export interface ExternalMediaClipSource {
  ref: MediaAssetRef;
  title: string;
  sourceDomain: MediaViewerClipDto['sourceDomain'];
  capturedAt?: string;
  clipStartAt?: string;
  clipEndAt?: string;
  cameraId?: string;
  incidentId?: string;
  inquiryId?: string;
  storageUri?: string;
  custodySummary?: string;
  legalHold?: boolean;
  privacyMasked?: boolean;
}

export interface MediaViewerBuildOptions {
  focusedCameraId?: string;
  activeRef?: string;
  externalClips?: ExternalMediaClipSource[];
}

function clipDurationSeconds(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const delta = (Date.parse(end) - Date.parse(start)) / 1000;
  return Number.isFinite(delta) && delta > 0 ? Math.round(delta) : undefined;
}

export class MediaViewerService {
  private readonly cctvViewer = new CctvViewerService();
  private readonly playbackResolver = new MediaPlaybackResolver();

  buildWorkspace(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    adapterRegistry: SurveillanceAdapterRegistry,
    options: MediaViewerBuildOptions = {},
  ): MediaViewerWorkspaceDto {
    const base = this.cctvViewer.buildWorkspace(ctx, workspace, adapterRegistry, options.focusedCameraId);
    const snapshot = adapterRegistry.snapshot(ctx.now);
    const streamSources = snapshot.streamSources;
    const gatewayActive = base.streamGatewayConfigured;

    const recordedClips = this.buildRecordedClips(workspace, options.externalClips ?? []);
    const inputs = this.buildInputs(workspace, streamSources, gatewayActive);
    const outputCapabilities = this.buildOutputCapabilities(gatewayActive);
    const activeRef = options.activeRef ? parseMediaAssetRef(options.activeRef) : undefined;

    return {
      ...base,
      schemaVersion: mediaViewerSchemaVersion,
      activeRef,
      clips: recordedClips,
      inputs,
      outputCapabilities,
      disclaimer: gatewayActive
        ? 'Media viewer — live streams use the configured gateway; recorded clips resolve through governed storage.'
        : 'Media viewer — connect a stream gateway for live URLs. Recorded clips may use demo playback URLs until storage signing is configured.',
    };
  }

  resolvePlayback(
    ctx: SurveillanceIoTModuleContext,
    workspace: SurveillanceIoTWorkspaceDto,
    adapterRegistry: SurveillanceAdapterRegistry,
    refValue: string,
    externalClips: ExternalMediaClipSource[] = [],
  ): MediaPlaybackDescriptorDto | undefined {
    const ref = parseMediaAssetRef(refValue);
    if (!ref) return undefined;

    if (ref.kind === 'live-camera') {
      const base = this.cctvViewer.buildWorkspace(ctx, workspace, adapterRegistry, ref.id);
      const tile = base.tiles.find((entry) => entry.cameraId === ref.id);
      if (!tile) return undefined;
      const playbackKind = tile.playbackMode === 'hls' ? 'hls'
        : tile.playbackMode === 'mjpeg' ? 'mjpeg'
          : tile.playbackMode === 'webrtc' ? 'webrtc'
            : tile.mediaUrl ? 'file' : 'unavailable';
      return this.playbackResolver.resolve({
        ref,
        title: tile.displayName,
        privacyMasked: tile.privacyMaskingEnabled,
        livePlayback: { playbackKind, mediaUrl: tile.mediaUrl },
      });
    }

    const clip = [...this.buildRecordedClips(workspace, externalClips)].find(
      (entry) => encodeMediaAssetRef(entry.ref) === refValue || entry.ref.id === ref.id,
    );
    if (!clip) return undefined;

    const external = externalClips.find((entry) => entry.ref.id === ref.id && entry.ref.kind === ref.kind);
    const evidence = workspace.videoEvidence.find((entry) => entry.id === ref.id);

    return this.playbackResolver.resolve({
      ref: clip.ref,
      title: clip.title,
      storageUri: external?.storageUri ?? evidence?.storageUri,
      clipStartAt: clip.clipStartAt,
      clipEndAt: clip.clipEndAt,
      privacyMasked: clip.privacyMasked,
      legalHold: clip.legalHold,
      custodySummary: clip.custodySummary,
    });
  }

  private buildRecordedClips(
    workspace: SurveillanceIoTWorkspaceDto,
    externalClips: ExternalMediaClipSource[],
  ): MediaViewerClipDto[] {
    const clips: MediaViewerClipDto[] = workspace.videoEvidence.map((evidence) => this.clipFromEvidence(evidence));

    for (const external of externalClips) {
      if (clips.some((clip) => clip.ref.kind === external.ref.kind && clip.ref.id === external.ref.id)) continue;
      clips.push({
        ref: external.ref,
        title: external.title,
        sourceDomain: external.sourceDomain,
        durationSeconds: clipDurationSeconds(external.clipStartAt, external.clipEndAt),
        capturedAt: external.capturedAt,
        clipStartAt: external.clipStartAt,
        clipEndAt: external.clipEndAt,
        cameraId: external.cameraId,
        incidentId: external.incidentId,
        inquiryId: external.inquiryId,
        playbackCapable: Boolean(external.storageUri),
        custodySummary: external.custodySummary,
        legalHold: external.legalHold ?? false,
        privacyMasked: external.privacyMasked ?? false,
      });
    }

    return clips;
  }

  private clipFromEvidence(evidence: VideoEvidenceReferenceDto): MediaViewerClipDto {
    return {
      ref: { kind: 'recorded-clip', id: evidence.id, cameraId: evidence.cameraId, incidentId: evidence.incidentId },
      title: evidence.displayName,
      sourceDomain: evidence.incidentId ? 'incident' : 'cctv',
      durationSeconds: clipDurationSeconds(evidence.clipStartAt, evidence.clipEndAt),
      capturedAt: evidence.clipEndAt,
      clipStartAt: evidence.clipStartAt,
      clipEndAt: evidence.clipEndAt,
      cameraId: evidence.cameraId,
      incidentId: evidence.incidentId,
      playbackCapable: Boolean(evidence.storageUri),
      custodySummary: evidence.legalHold ? 'Legal hold — export restricted' : 'NVR evidence archive',
      legalHold: evidence.legalHold ?? false,
      privacyMasked: evidence.privacyMasked ?? false,
    };
  }

  private buildInputs(
    workspace: SurveillanceIoTWorkspaceDto,
    streamSources: Array<{ externalCameraId: string; ingestEndpointRef?: string; playbackEndpointRef?: string; primaryProtocol: string }>,
    gatewayActive: boolean,
  ): MediaViewerInputDto[] {
    const inputs: MediaViewerInputDto[] = workspace.cameras.map((camera) => {
      const stream = workspace.videoStreams.find((entry) => entry.cameraId === camera.id);
      const source = streamSources.find((entry) => entry.externalCameraId === camera.id);
      return {
        inputId: camera.id,
        label: camera.displayName,
        sourceKind: 'camera',
        protocol: stream?.protocol,
        status: stream?.streamStatus ?? 'offline',
        ingestEndpointRef: source?.ingestEndpointRef,
        playbackEndpointRef: gatewayActive ? source?.playbackEndpointRef : undefined,
        cameraId: camera.id,
      };
    });

    for (const gateway of workspace.gateways ?? []) {
      inputs.push({
        inputId: gateway.id,
        label: gateway.displayName,
        sourceKind: 'gateway',
        status: gateway.status === 'online' ? 'live' : 'offline',
        gatewayId: gateway.id,
      });
    }

    return inputs;
  }

  private buildOutputCapabilities(gatewayActive: boolean): MediaViewerOutputCapabilityDto[] {
    return [
      {
        action: 'snapshot',
        enabled: gatewayActive,
        reason: gatewayActive ? undefined : 'Configure stream gateway to capture live snapshots.',
      },
      {
        action: 'export',
        enabled: true,
        reason: undefined,
      },
      {
        action: 'share-link',
        enabled: true,
        reason: undefined,
      },
    ];
  }
}
