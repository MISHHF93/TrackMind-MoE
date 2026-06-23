import type { EntityId, ISODateTime } from './foundation.js';
import type { SurveillanceIoTStreamStatus } from './surveillanceIoT.js';
import type {
  SurveillanceCctvViewerGridLayout,
  SurveillanceCctvViewerStreamTileDto,
  SurveillanceCctvViewerWorkspaceDto,
} from './surveillanceCctvViewer.js';

export const mediaViewerSchemaVersion = 'trackmind.media-viewer.v1' as const;

export type MediaSourceKind =
  | 'live-camera'
  | 'recorded-clip'
  | 'steward-evidence'
  | 'incident-evidence'
  | 'artifact';

export type MediaPlaybackKind =
  | 'hls'
  | 'mjpeg'
  | 'webrtc'
  | 'file'
  | 'gateway-required'
  | 'unavailable';

export type MediaOutputAction = 'snapshot' | 'export' | 'share-link';

export interface MediaAssetRef {
  kind: MediaSourceKind;
  id: EntityId;
  cameraId?: EntityId;
  incidentId?: EntityId;
  inquiryId?: EntityId;
}

const mediaSourceKinds: MediaSourceKind[] = [
  'live-camera',
  'recorded-clip',
  'steward-evidence',
  'incident-evidence',
  'artifact',
];

export function encodeMediaAssetRef(ref: MediaAssetRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function parseMediaAssetRef(value: string): MediaAssetRef | undefined {
  const separator = value.indexOf(':');
  if (separator <= 0) return undefined;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!id || !mediaSourceKinds.includes(kind as MediaSourceKind)) return undefined;
  return { kind: kind as MediaSourceKind, id };
}

export interface MediaPlaybackDescriptorDto {
  ref: MediaAssetRef;
  title: string;
  playbackKind: MediaPlaybackKind;
  mediaUrl?: string;
  startAt?: ISODateTime;
  endAt?: ISODateTime;
  privacyMasked: boolean;
  legalHold: boolean;
  redactionTier?: 'none' | 'welfare' | 'restricted';
  custodySummary?: string;
  mock: boolean;
}

export interface MediaViewerClipDto {
  ref: MediaAssetRef;
  title: string;
  sourceDomain: 'cctv' | 'steward' | 'incident' | 'security' | 'artifact';
  durationSeconds?: number;
  capturedAt?: ISODateTime;
  clipStartAt?: ISODateTime;
  clipEndAt?: ISODateTime;
  cameraId?: EntityId;
  incidentId?: EntityId;
  inquiryId?: EntityId;
  playbackCapable: boolean;
  custodySummary?: string;
  legalHold: boolean;
  privacyMasked: boolean;
}

export interface MediaViewerInputDto {
  inputId: EntityId;
  label: string;
  sourceKind: 'camera' | 'gateway' | 'adapter' | 'nvr';
  protocol?: string;
  status: SurveillanceIoTStreamStatus | 'configured' | 'unconfigured';
  ingestEndpointRef?: string;
  playbackEndpointRef?: string;
  cameraId?: EntityId;
  gatewayId?: EntityId;
}

export interface MediaViewerOutputCapabilityDto {
  action: MediaOutputAction;
  enabled: boolean;
  reason?: string;
}

export interface MediaViewerWorkspaceDto extends SurveillanceCctvViewerWorkspaceDto {
  schemaVersion: typeof mediaViewerSchemaVersion;
  activeRef?: MediaAssetRef;
  clips: MediaViewerClipDto[];
  inputs: MediaViewerInputDto[];
  outputCapabilities: MediaViewerOutputCapabilityDto[];
}

export interface MediaSnapshotRequestDto {
  ref: MediaAssetRef;
  reason?: string;
}

export interface MediaSnapshotResultDto {
  accepted: boolean;
  jobId: string;
  snapshotUrl?: string;
  capturedAt: ISODateTime;
  mock: boolean;
}

export interface MediaExportRequestDto {
  ref: MediaAssetRef;
  format?: 'mp4' | 'mkv';
  reason?: string;
}

export interface MediaExportResultDto {
  accepted: boolean;
  jobId: string;
  exportUrl?: string;
  expiresAt?: ISODateTime;
  mock: boolean;
}

export interface MediaShareLinkRequestDto {
  ref: MediaAssetRef;
  expiresInMinutes?: number;
  reason?: string;
}

export interface MediaShareLinkResultDto {
  accepted: boolean;
  shareUrl: string;
  expiresAt: ISODateTime;
  mock: boolean;
}

/** @deprecated Use MediaViewerWorkspaceDto */
export type { SurveillanceCctvViewerWorkspaceDto as LegacyCctvViewerWorkspaceDto };

export const mediaViewerContractSchemas = {
  MediaViewerWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [mediaViewerSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'streamGatewayConfigured', required: true, type: 'boolean' },
    { path: 'activeIntegrationClaimed', required: true, type: 'boolean' },
    { path: 'defaultLayout', required: true, type: 'string' },
    { path: 'tiles', required: true, type: 'array' },
    { path: 'clips', required: true, type: 'array' },
    { path: 'inputs', required: true, type: 'array' },
    { path: 'outputCapabilities', required: true, type: 'array' },
    { path: 'zoneFilterOptions', required: true, type: 'array' },
    { path: 'disclaimer', required: true, type: 'string' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  MediaPlaybackDescriptorDto: [
    { path: 'ref', required: true, type: 'object' },
    { path: 'ref.kind', required: true, type: 'string' },
    { path: 'ref.id', required: true, type: 'string' },
    { path: 'title', required: true, type: 'string' },
    { path: 'playbackKind', required: true, type: 'string' },
    { path: 'privacyMasked', required: true, type: 'boolean' },
    { path: 'legalHold', required: true, type: 'boolean' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  MediaSnapshotResultDto: [
    { path: 'accepted', required: true, type: 'boolean' },
    { path: 'jobId', required: true, type: 'string' },
    { path: 'capturedAt', required: true, type: 'string' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  MediaExportResultDto: [
    { path: 'accepted', required: true, type: 'boolean' },
    { path: 'jobId', required: true, type: 'string' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  MediaShareLinkResultDto: [
    { path: 'accepted', required: true, type: 'boolean' },
    { path: 'shareUrl', required: true, type: 'string' },
    { path: 'expiresAt', required: true, type: 'string' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  SurveillanceCctvViewerWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string' },
    { path: 'tiles', required: true, type: 'array' },
    { path: 'clips', required: true, type: 'array' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
} as const;
