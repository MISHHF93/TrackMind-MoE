import type { EntityId, ISODateTime } from './foundation.js';
import type { SurveillanceIoTStreamStatus } from './surveillanceIoT.js';

export const surveillanceCctvViewerSchemaVersion = 'trackmind.surveillance-cctv-viewer.v1' as const;

/** How the in-house viewer should render a camera tile. */
export type SurveillanceCctvViewerPlaybackMode =
  | 'gateway-required'
  | 'hls'
  | 'mjpeg'
  | 'webrtc'
  | 'simulated-preview';

export type SurveillanceCctvViewerGridLayout = '1x1' | '2x2' | '3x3' | '4x4' | 'focus';

export interface SurveillanceCctvViewerStreamTileDto {
  cameraId: EntityId;
  displayName: string;
  zoneId?: EntityId;
  zoneLabel?: string;
  streamStatus: SurveillanceIoTStreamStatus;
  protocol: string;
  playbackMode: SurveillanceCctvViewerPlaybackMode;
  /** Populated only when a stream gateway adapter is configured and validated. */
  mediaUrl?: string;
  privacyMaskingEnabled: boolean;
  recordingActive: boolean;
  ptzCapable: boolean;
  lastSeenAt: ISODateTime;
  viewerSlot: number;
}

export interface SurveillanceCctvViewerWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceCctvViewerSchemaVersion | 'trackmind.media-viewer.v1';
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  streamGatewayConfigured: boolean;
  activeIntegrationClaimed: boolean;
  defaultLayout: SurveillanceCctvViewerGridLayout;
  focusedCameraId?: EntityId;
  tiles: SurveillanceCctvViewerStreamTileDto[];
  zoneFilterOptions: Array<{ zoneId: string; label: string; cameraCount: number }>;
  disclaimer: string;
  mock: boolean;
}

export const surveillanceCctvViewerContractSchemas = {} as const;
