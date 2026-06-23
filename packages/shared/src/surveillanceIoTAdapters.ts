import type { ISODateTime } from './foundation.js';
import type {
  SurveillanceIoTStreamStatus,
} from './surveillanceIoT.js';
import type {
  CameraCapabilitiesMetadata,
  CameraStreamSourceMetadata,
  GatewayHeartbeatReport,
  NvrVmsIntegrationMetadata,
  RecordingRetentionMetadata,
  SurveillanceEventAlertIngestionEnvelope,
  SurveillanceIngestedVendorEvent,
  SurveillanceIntegrationReadiness,
  SurveillanceProviderOperationalStatus,
  SurveillanceVendorContractKind,
  SensorTelemetryIngestionEnvelope,
  SensorTelemetryIngestionReading,
} from './surveillanceVendorIntegrationContracts.js';

export const surveillanceIoTAdapterSchemaVersion = 'trackmind.surveillance-iot-adapters.v2' as const;

/** Integration-hub connector categories — not vendor names. */
export type SurveillanceConnectorCategory = 'camera-vms' | 'sensor-iot' | 'nvr-bridge' | 'gateway';

export type SurveillanceAdapterProtocol =
  | 'rtsp'
  | 'hls'
  | 'webrtc'
  | 'mjpeg'
  | 'onvif'
  | 'rest'
  | 'mqtt'
  | 'opc-ua'
  | 'webhook'
  | 'modbus';

export type SurveillanceAdapterConnectionStatus = 'connected' | 'degraded' | 'disconnected' | 'unconfigured';

export interface SurveillanceAdapterDescriptor {
  adapterId: string;
  /** References integration-hub connector category (e.g. camera-vms), not a vendor product. */
  connectorId: string;
  category: SurveillanceConnectorCategory;
  contractKind: SurveillanceVendorContractKind;
  contractId: string;
  protocols: SurveillanceAdapterProtocol[];
  status: SurveillanceAdapterConnectionStatus;
  integrationReadiness: SurveillanceIntegrationReadiness;
  operationalStatus: SurveillanceProviderOperationalStatus;
  /** True only when a provider configuration is enabled and validated — never for catalog slots. */
  activeIntegrationClaimed: boolean;
  providerConfigId?: string;
  displayName: string;
  lastSyncAt?: ISODateTime;
  providerAgnostic: true;
  mock: boolean;
}

export interface AdapterDiscoveredCamera {
  externalId: string;
  label: string;
  zoneExternalId?: string;
  streamProtocols: SurveillanceAdapterProtocol[];
  lastSeenAt?: ISODateTime;
  metadata?: Record<string, unknown>;
}

export interface AdapterDiscoveredSensor {
  externalId: string;
  label: string;
  sensorType: string;
  unit?: string;
  zoneExternalId?: string;
  lastSeenAt?: ISODateTime;
  metadata?: Record<string, unknown>;
}

export interface AdapterStreamHealthSnapshot {
  externalCameraId: string;
  streamStatus: SurveillanceIoTStreamStatus;
  protocol: SurveillanceAdapterProtocol;
  bitrateKbps?: number;
  frameRate?: number;
  recordingActive?: boolean;
  observedAt: ISODateTime;
  evidence: string[];
}

export interface AdapterTelemetryReading {
  externalDeviceId: string;
  metric: string;
  value: number | string | boolean;
  unit?: string;
  observedAt: ISODateTime;
  quality: 'good' | 'estimated' | 'bad' | 'missing';
  evidence: string[];
}

export interface AdapterRetentionPolicyDescriptor {
  externalPolicyId: string;
  displayName: string;
  retentionDays: number;
  appliesToExternalCameraIds: string[];
}

export interface AdapterEvidenceClipDescriptor {
  externalClipId: string;
  externalCameraId: string;
  clipStartAt: ISODateTime;
  clipEndAt: ISODateTime;
  storageUri?: string;
  checksum?: string;
  privacyMasked: boolean;
}

/** Vendor-neutral camera stream source + health integration surface. */
export interface CameraStreamSourceIntegrationAdapter {
  readonly descriptor: SurveillanceAdapterDescriptor;
  listStreamSources(at?: ISODateTime): CameraStreamSourceMetadata[];
  discoverCameras(): AdapterDiscoveredCamera[];
  pollStreamHealth(at?: ISODateTime): AdapterStreamHealthSnapshot[];
  listCapabilities(at?: ISODateTime): CameraCapabilitiesMetadata[];
}

/** @deprecated Use CameraStreamSourceIntegrationAdapter */
export type CameraIntegrationAdapter = CameraStreamSourceIntegrationAdapter;

/** Vendor-neutral NVR / VMS integration surface. */
export interface NvrVmsIntegrationAdapter {
  readonly descriptor: SurveillanceAdapterDescriptor;
  describeIntegration(at?: ISODateTime): NvrVmsIntegrationMetadata | undefined;
  listRetentionPolicies(): AdapterRetentionPolicyDescriptor[];
  listRecordingRetention(at?: ISODateTime): RecordingRetentionMetadata[];
  listEvidenceClips(since?: ISODateTime): AdapterEvidenceClipDescriptor[];
}

/** @deprecated Use NvrVmsIntegrationAdapter */
export type NvrIntegrationAdapter = NvrVmsIntegrationAdapter;

/** Vendor-neutral sensor telemetry ingestion surface. */
export interface SensorTelemetryIntegrationAdapter {
  readonly descriptor: SurveillanceAdapterDescriptor;
  discoverSensors(): AdapterDiscoveredSensor[];
  pollReadings(at?: ISODateTime): AdapterTelemetryReading[];
  normalizeIngestion(envelope: SensorTelemetryIngestionEnvelope): SensorTelemetryIngestionReading[];
}

/** @deprecated Use SensorTelemetryIntegrationAdapter */
export type SensorIntegrationAdapter = SensorTelemetryIntegrationAdapter;

/** Vendor-neutral gateway heartbeat reporting surface. */
export interface GatewayHeartbeatIntegrationAdapter {
  readonly descriptor: SurveillanceAdapterDescriptor;
  pollHeartbeats(at?: ISODateTime): GatewayHeartbeatReport[];
}

/** Vendor-neutral event / alert ingestion surface. */
export interface EventAlertIntegrationAdapter {
  readonly descriptor: SurveillanceAdapterDescriptor;
  normalizeEvents(envelope: SurveillanceEventAlertIngestionEnvelope): SurveillanceIngestedVendorEvent[];
  pollRecentEvents(at?: ISODateTime): SurveillanceIngestedVendorEvent[];
}

export interface SurveillanceAdapterSnapshot {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceIoTAdapterSchemaVersion;
  adapters: SurveillanceAdapterDescriptor[];
  discoveredCameras: AdapterDiscoveredCamera[];
  discoveredSensors: AdapterDiscoveredSensor[];
  streamHealth: AdapterStreamHealthSnapshot[];
  readings: AdapterTelemetryReading[];
  streamSources: CameraStreamSourceMetadata[];
  gatewayHeartbeats: GatewayHeartbeatReport[];
  recentEvents: SurveillanceIngestedVendorEvent[];
  mock: boolean;
  activeIntegrationClaimed: boolean;
}

export interface SurveillanceAdapterRegistry {
  list(): SurveillanceAdapterDescriptor[];
  cameraAdapters(): CameraStreamSourceIntegrationAdapter[];
  sensorAdapters(): SensorTelemetryIntegrationAdapter[];
  nvrAdapters(): NvrVmsIntegrationAdapter[];
  gatewayAdapters(): GatewayHeartbeatIntegrationAdapter[];
  eventAdapters(): EventAlertIntegrationAdapter[];
  snapshot(at?: ISODateTime): SurveillanceAdapterSnapshot;
}

export function surveillanceAdapterClaimsActiveIntegration(descriptor: SurveillanceAdapterDescriptor): boolean {
  return descriptor.activeIntegrationClaimed
    && descriptor.operationalStatus !== 'unconfigured'
    && descriptor.integrationReadiness !== 'provider-ready';
}
