import type { EntityId, ISODateTime } from './foundation.js';
import type {
  SurveillanceIoTAlertSeverity,
  SurveillanceIoTStreamStatus,
} from './surveillanceIoT.js';
import type { SurveillanceAdapterProtocol } from './surveillanceIoTAdapters.js';

export const surveillanceVendorIntegrationSchemaVersion = 'trackmind.surveillance-vendor-integration.v1' as const;

/** Canonical vendor-neutral integration contract slots — not vendor product names. */
export const surveillanceVendorContractKinds = [
  'camera-stream-source',
  'nvr-vms-integration',
  'sensor-telemetry-ingestion',
  'gateway-heartbeat',
  'event-alert-ingestion',
  'recording-retention',
  'camera-capabilities',
] as const;

export type SurveillanceVendorContractKind = (typeof surveillanceVendorContractKinds)[number];

export const surveillanceVendorConnectionTypes = [
  'rest',
  'graphql',
  'webhook',
  'mqtt',
  'opc-ua',
  'rtsp-bridge',
  'onvif-bridge',
  'sdk',
  'file-drop',
  'stream',
] as const;

export type SurveillanceVendorConnectionType = (typeof surveillanceVendorConnectionTypes)[number];

export const surveillanceVendorSyncModes = ['pull', 'push', 'streaming', 'batch', 'bidirectional', 'heartbeat'] as const;
export type SurveillanceVendorSyncMode = (typeof surveillanceVendorSyncModes)[number];

/** Catalog entries are always provider-ready templates until an operator configures a provider. */
export type SurveillanceIntegrationReadiness = 'provider-ready' | 'configured' | 'validated' | 'deprecated';

export type SurveillanceProviderOperationalStatus =
  | 'unconfigured'
  | 'configured'
  | 'healthy'
  | 'degraded'
  | 'auth-required'
  | 'offline';

export interface SurveillanceVendorTenantScope {
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
}

export interface SurveillanceVendorCredentialRequirement {
  name: string;
  required: boolean;
  secret: true;
  description: string;
}

export interface SurveillanceVendorLineageMetadata {
  sourceSystem: string;
  providerConfigId?: string;
  externalDeviceId?: string;
  correlationId: string;
  causationIds: string[];
  ingestionJobId?: string;
  rawPayloadRefs: string[];
  auditRefs: string[];
  evidenceRefs: string[];
}

export interface SurveillanceVendorIntegrationGovernance {
  providerAgnostic: true;
  hardCodedProviderBehaviorAllowed: false;
  activeIntegrationsRequireConfiguration: true;
  catalogOnlyUntilConfigured: true;
}

/** Provider-ready contract descriptor — documents an integration slot, not an active vendor. */
export interface SurveillanceVendorIntegrationContractDescriptor {
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  contractId: string;
  contractKind: SurveillanceVendorContractKind;
  title: string;
  description: string;
  integrationReadiness: 'provider-ready';
  activeIntegrationClaimed: false;
  providerAgnostic: true;
  hardCodedProviderBehaviorAllowed: false;
  connectorCategory: 'camera-vms' | 'sensor-iot' | 'nvr-bridge' | 'gateway';
  supportedProtocols: SurveillanceAdapterProtocol[];
  supportedConnectionTypes: SurveillanceVendorConnectionType[];
  supportedSyncModes: SurveillanceVendorSyncMode[];
  credentialRequirements: SurveillanceVendorCredentialRequirement[];
  normalizationRequired: true;
  emits: string[];
  audits: string[];
  evidenceRefs: string[];
}

/** Operator-configured provider binding. Active claims require enabled + configured status. */
export interface SurveillanceVendorProviderConfig {
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  providerConfigId: string;
  contractKind: SurveillanceVendorContractKind;
  contractId: string;
  displayName: string;
  vendorProductFamily?: string;
  enabled: boolean;
  integrationReadiness: SurveillanceIntegrationReadiness;
  operationalStatus: SurveillanceProviderOperationalStatus;
  activeIntegrationClaimed: boolean;
  tenant: SurveillanceVendorTenantScope;
  connectorId: string;
  connectionType: SurveillanceVendorConnectionType;
  syncMode: SurveillanceVendorSyncMode;
  endpointRefs: string[];
  credentialRefs: string[];
  configuredAt?: ISODateTime;
  lastValidatedAt?: ISODateTime;
  providerAgnostic: true;
  mock: boolean;
}

/** 1 — Camera stream source metadata (vendor-neutral stream endpoint projection). */
export interface CameraStreamSourceMetadata {
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  contractKind: 'camera-stream-source';
  providerConfigId?: string;
  externalCameraId: string;
  streamId: string;
  label: string;
  primaryProtocol: SurveillanceAdapterProtocol;
  alternateProtocols: SurveillanceAdapterProtocol[];
  ingestEndpointRef?: string;
  playbackEndpointRef?: string;
  snapshotEndpointRef?: string;
  transportSecurity: 'tls' | 'trusted-network' | 'unknown';
  authenticationMethod: 'token' | 'basic' | 'certificate' | 'signed-url' | 'none' | 'unknown';
  zoneExternalId?: string;
  observedAt: ISODateTime;
  lineage: SurveillanceVendorLineageMetadata;
  activeIntegrationClaimed: boolean;
}

/** 2 — NVR / VMS integration metadata (recorder control plane, not a vendor name). */
export interface NvrVmsIntegrationMetadata {
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  contractKind: 'nvr-vms-integration';
  providerConfigId?: string;
  integrationId: string;
  displayName: string;
  recorderRole: 'nvr' | 'vms' | 'cloud-vms' | 'hybrid';
  supportedCapabilities: Array<'live-view' | 'playback' | 'export' | 'ptz' | 'analytics-bridge' | 'event-subscription'>;
  managementEndpointRef?: string;
  eventWebhookRef?: string;
  timezone: string;
  firmwareVersion?: string;
  vendorNeutralProductFamily?: string;
  connectedCameraExternalIds: string[];
  operationalStatus: SurveillanceProviderOperationalStatus;
  observedAt: ISODateTime;
  lineage: SurveillanceVendorLineageMetadata;
  activeIntegrationClaimed: boolean;
}

/** 3 — Sensor telemetry ingestion (normalized reading envelope). */
export interface SensorTelemetryIngestionEnvelope {
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  contractKind: 'sensor-telemetry-ingestion';
  providerConfigId?: string;
  adapterId: string;
  readings: SensorTelemetryIngestionReading[];
  receivedAt: ISODateTime;
  lineage: SurveillanceVendorLineageMetadata;
  activeIntegrationClaimed: boolean;
}

export interface SensorTelemetryIngestionReading {
  externalDeviceId: string;
  metric: string;
  value: number | string | boolean;
  unit?: string;
  observedAt: ISODateTime;
  quality: 'good' | 'estimated' | 'bad' | 'missing';
  sensorType?: string;
  zoneExternalId?: string;
  evidence: string[];
}

/** 4 — Gateway heartbeat reporting. */
export interface GatewayHeartbeatReport {
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  contractKind: 'gateway-heartbeat';
  providerConfigId?: string;
  externalGatewayId: string;
  gatewayLabel: string;
  status: 'online' | 'degraded' | 'offline' | 'unknown';
  integrationStatus: SurveillanceProviderOperationalStatus;
  connectedDeviceCount: number;
  lastTelemetryAt?: ISODateTime;
  firmwareVersion?: string;
  reportedAt: ISODateTime;
  lineage: SurveillanceVendorLineageMetadata;
  activeIntegrationClaimed: boolean;
}

/** 5 — Event / alert ingestion (device-originated events normalized for alerting layer). */
export interface SurveillanceEventAlertIngestionEnvelope {
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  contractKind: 'event-alert-ingestion';
  providerConfigId?: string;
  adapterId: string;
  events: SurveillanceIngestedVendorEvent[];
  receivedAt: ISODateTime;
  lineage: SurveillanceVendorLineageMetadata;
  activeIntegrationClaimed: boolean;
}

export interface SurveillanceIngestedVendorEvent {
  externalEventId: string;
  externalDeviceId: string;
  eventType: string;
  severity: SurveillanceIoTAlertSeverity;
  title: string;
  detail?: string;
  zoneExternalId?: string;
  occurredAt: ISODateTime;
  acknowledgedExternally?: boolean;
  evidence: string[];
}

/** 6 — Recording / retention metadata. */
export interface RecordingRetentionMetadata {
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  contractKind: 'recording-retention';
  providerConfigId?: string;
  externalPolicyId: string;
  displayName: string;
  retentionDays: number;
  recordingMode: 'continuous' | 'motion' | 'scheduled' | 'manual' | 'disabled' | 'unknown';
  legalHoldEligible: boolean;
  privacyMaskingRequired: boolean;
  disposition: 'delete' | 'archive' | 'legal-hold' | 'unknown';
  appliesToExternalCameraIds: string[];
  storageTier?: 'hot' | 'warm' | 'cold' | 'unknown';
  observedAt: ISODateTime;
  lineage: SurveillanceVendorLineageMetadata;
  activeIntegrationClaimed: boolean;
}

/** 7 — Camera capabilities metadata (PTZ, analytics, audio, etc.). */
export interface CameraCapabilitiesMetadata {
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  contractKind: 'camera-capabilities';
  providerConfigId?: string;
  externalCameraId: string;
  label: string;
  ptzSupported: boolean;
  audioInSupported: boolean;
  audioOutSupported: boolean;
  analyticsProfiles: string[];
  maxResolution?: string;
  supportedStreamProfiles: string[];
  privacyMaskingSupported: boolean;
  onvifProfile?: string;
  observedAt: ISODateTime;
  lineage: SurveillanceVendorLineageMetadata;
  activeIntegrationClaimed: boolean;
}

export interface SurveillanceVendorIntegrationWorkspaceDto {
  generatedAt: ISODateTime;
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  contracts: SurveillanceVendorIntegrationContractDescriptor[];
  providerConfigs: SurveillanceVendorProviderConfig[];
  governance: SurveillanceVendorIntegrationGovernance;
  disclaimer: string;
  mock: boolean;
}

export interface SurveillanceVendorIntegrationConnectorDescriptor {
  schemaVersion: typeof surveillanceVendorIntegrationSchemaVersion;
  connectorId: string;
  contractKind: SurveillanceVendorContractKind;
  title: string;
  description: string;
  providerAgnostic: true;
  hardCodedProviderBehaviorAllowed: false;
  supportedConnectionTypes: SurveillanceVendorConnectionType[];
  supportedSyncModes: SurveillanceVendorSyncMode[];
  supportedProtocols: SurveillanceAdapterProtocol[];
  credentialRequirements: SurveillanceVendorCredentialRequirement[];
  healthCheck: { supported: boolean; interval?: string; auditAction: string };
  emits: string[];
  audits: string[];
  evidenceRefs: string[];
}

function contractBase(
  contractId: string,
  contractKind: SurveillanceVendorContractKind,
  title: string,
  description: string,
  connectorCategory: SurveillanceVendorIntegrationContractDescriptor['connectorCategory'],
  supportedProtocols: SurveillanceAdapterProtocol[],
  supportedConnectionTypes: SurveillanceVendorConnectionType[],
  supportedSyncModes: SurveillanceVendorSyncMode[],
  credentialRequirements: SurveillanceVendorCredentialRequirement[],
  emits: string[],
  audits: string[],
): SurveillanceVendorIntegrationContractDescriptor {
  return {
    schemaVersion: surveillanceVendorIntegrationSchemaVersion,
    contractId,
    contractKind,
    title,
    description,
    integrationReadiness: 'provider-ready',
    activeIntegrationClaimed: false,
    providerAgnostic: true,
    hardCodedProviderBehaviorAllowed: false,
    connectorCategory,
    supportedProtocols,
    supportedConnectionTypes,
    supportedSyncModes,
    credentialRequirements,
    normalizationRequired: true,
    emits,
    audits,
    evidenceRefs: [`evidence:surveillance-vendor-contract:${contractId}`],
  };
}

export function buildSurveillanceVendorIntegrationCatalog(): SurveillanceVendorIntegrationContractDescriptor[] {
  return [
    contractBase(
      'contract-camera-stream-source',
      'camera-stream-source',
      'Camera stream source metadata',
      'Vendor-neutral projection of live and playback stream endpoints, protocols, and transport metadata for registered cameras.',
      'camera-vms',
      ['rtsp', 'hls', 'webrtc', 'mjpeg', 'onvif', 'rest'],
      ['rtsp-bridge', 'onvif-bridge', 'rest', 'webhook', 'sdk'],
      ['pull', 'streaming', 'bidirectional'],
      [
        { name: 'streamCredentialsRef', required: true, secret: true, description: 'Secret reference for stream authentication material.' },
        { name: 'ingestEndpointRef', required: false, secret: true, description: 'Optional ingest endpoint reference when vendor uses push ingest.' },
      ],
      ['surveillance.stream.discovered', 'surveillance.stream.health.updated'],
      ['surveillance-vendor.stream-source.read', 'surveillance-vendor.stream-source.validated'],
    ),
    contractBase(
      'contract-nvr-vms-integration',
      'nvr-vms-integration',
      'NVR / VMS integration metadata',
      'Recorder and video-management control-plane metadata including capabilities, connected cameras, and event subscription hooks.',
      'nvr-bridge',
      ['rest', 'webhook', 'onvif'],
      ['rest', 'webhook', 'sdk'],
      ['pull', 'push', 'bidirectional'],
      [
        { name: 'managementApiCredentialsRef', required: true, secret: true, description: 'Secret reference for recorder management API credentials.' },
        { name: 'eventWebhookSecretRef', required: false, secret: true, description: 'Optional webhook signing secret for inbound recorder events.' },
      ],
      ['surveillance.nvr.discovered', 'surveillance.nvr.status.updated'],
      ['surveillance-vendor.nvr.read', 'surveillance-vendor.nvr.validated'],
    ),
    contractBase(
      'contract-sensor-telemetry-ingestion',
      'sensor-telemetry-ingestion',
      'Sensor telemetry ingestion',
      'Normalized telemetry envelope for IoT sensors and facility devices ingested through gateway or direct connectors.',
      'sensor-iot',
      ['mqtt', 'opc-ua', 'webhook', 'modbus', 'rest'],
      ['mqtt', 'opc-ua', 'webhook', 'rest', 'stream'],
      ['push', 'streaming', 'batch', 'pull'],
      [
        { name: 'deviceCredentialsRef', required: true, secret: true, description: 'Secret reference for device or gateway authentication.' },
      ],
      ['surveillance.telemetry.ingested', 'surveillance.sensor.discovered'],
      ['surveillance-vendor.telemetry.ingested', 'surveillance-vendor.telemetry.validated'],
    ),
    contractBase(
      'contract-gateway-heartbeat',
      'gateway-heartbeat',
      'Gateway heartbeat reporting',
      'Periodic gateway liveness, firmware, and connected-device counts for IoT edge gateways.',
      'gateway',
      ['mqtt', 'rest', 'webhook'],
      ['mqtt', 'rest', 'webhook'],
      ['heartbeat', 'push'],
      [
        { name: 'gatewayCredentialsRef', required: true, secret: true, description: 'Secret reference for gateway authentication.' },
      ],
      ['surveillance.gateway.heartbeat'],
      ['surveillance-vendor.gateway.heartbeat.read'],
    ),
    contractBase(
      'contract-event-alert-ingestion',
      'event-alert-ingestion',
      'Event / alert ingestion',
      'Normalized vendor event and alert ingestion for the surveillance alerting layer.',
      'sensor-iot',
      ['webhook', 'mqtt', 'rest'],
      ['webhook', 'mqtt', 'rest', 'stream'],
      ['push', 'streaming'],
      [
        { name: 'eventWebhookSecretRef', required: true, secret: true, description: 'Secret reference for signed event webhook validation.' },
      ],
      ['surveillance.alert.raised', 'surveillance.event.ingested'],
      ['surveillance-vendor.event.ingested', 'surveillance-vendor.alert.normalized'],
    ),
    contractBase(
      'contract-recording-retention',
      'recording-retention',
      'Recording / retention metadata',
      'Recorder retention policies, recording modes, and storage disposition metadata linked to camera external IDs.',
      'nvr-bridge',
      ['rest', 'webhook'],
      ['rest', 'webhook', 'sdk'],
      ['pull', 'batch'],
      [
        { name: 'recorderCredentialsRef', required: true, secret: true, description: 'Secret reference for recorder policy API credentials.' },
      ],
      ['surveillance.retention.discovered', 'surveillance.recording.status.updated'],
      ['surveillance-vendor.retention.read'],
    ),
    contractBase(
      'contract-camera-capabilities',
      'camera-capabilities',
      'Camera capabilities metadata',
      'PTZ, audio, analytics, resolution, and privacy-masking capability metadata for discovered cameras.',
      'camera-vms',
      ['onvif', 'rest'],
      ['onvif-bridge', 'rest', 'sdk'],
      ['pull', 'batch'],
      [
        { name: 'deviceCredentialsRef', required: true, secret: true, description: 'Secret reference for camera or VMS discovery credentials.' },
      ],
      ['surveillance.camera.capabilities.discovered'],
      ['surveillance-vendor.camera-capabilities.read'],
    ),
  ];
}

export function buildSurveillanceVendorIntegrationConnectors(): SurveillanceVendorIntegrationConnectorDescriptor[] {
  return buildSurveillanceVendorIntegrationCatalog().map((contract) => ({
    schemaVersion: surveillanceVendorIntegrationSchemaVersion,
    connectorId: `connector-${contract.contractKind}`,
    contractKind: contract.contractKind,
    title: contract.title,
    description: contract.description,
    providerAgnostic: true,
    hardCodedProviderBehaviorAllowed: false,
    supportedConnectionTypes: contract.supportedConnectionTypes,
    supportedSyncModes: contract.supportedSyncModes,
    supportedProtocols: contract.supportedProtocols,
    credentialRequirements: contract.credentialRequirements,
    healthCheck: {
      supported: true,
      interval: contract.contractKind === 'gateway-heartbeat' ? '60s' : '5m',
      auditAction: `surveillance-vendor.${contract.contractKind}.health-checked`,
    },
    emits: contract.emits,
    audits: contract.audits,
    evidenceRefs: contract.evidenceRefs,
  }));
}

export function isSurveillanceActiveIntegrationClaimed(input: {
  enabled: boolean;
  operationalStatus: SurveillanceProviderOperationalStatus;
}): boolean {
  return input.enabled && input.operationalStatus !== 'unconfigured';
}

export function buildSurveillanceVendorIntegrationWorkspace(input: {
  generatedAt: ISODateTime;
  organizationId: EntityId;
  tenantId: EntityId;
  racetrackId: EntityId;
  providerConfigs?: SurveillanceVendorProviderConfig[];
  mock?: boolean;
}): SurveillanceVendorIntegrationWorkspaceDto {
  return {
    generatedAt: input.generatedAt,
    schemaVersion: surveillanceVendorIntegrationSchemaVersion,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    racetrackId: input.racetrackId,
    contracts: buildSurveillanceVendorIntegrationCatalog(),
    providerConfigs: input.providerConfigs ?? [],
    governance: {
      providerAgnostic: true,
      hardCodedProviderBehaviorAllowed: false,
      activeIntegrationsRequireConfiguration: true,
      catalogOnlyUntilConfigured: true,
    },
    disclaimer:
      'Provider-ready integration contracts only. No vendor is active until an operator registers and validates a provider configuration.',
    mock: input.mock ?? false,
  };
}

export const surveillanceVendorIntegrationContractSchemas = {
  SurveillanceVendorIntegrationWorkspaceDto: [
    { path: 'generatedAt', required: true, type: 'string' },
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceVendorIntegrationSchemaVersion] },
    { path: 'organizationId', required: true, type: 'string' },
    { path: 'tenantId', required: true, type: 'string' },
    { path: 'racetrackId', required: true, type: 'string' },
    { path: 'contracts', required: true, type: 'array' },
    { path: 'providerConfigs', required: true, type: 'array' },
    { path: 'governance', required: true, type: 'object' },
    { path: 'disclaimer', required: true, type: 'string' },
    { path: 'mock', required: true, type: 'boolean' },
  ],
  CameraStreamSourceMetadata: [
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceVendorIntegrationSchemaVersion] },
    { path: 'contractKind', required: true, type: 'string', values: ['camera-stream-source'] },
    { path: 'externalCameraId', required: true, type: 'string' },
    { path: 'streamId', required: true, type: 'string' },
    { path: 'primaryProtocol', required: true, type: 'string' },
    { path: 'observedAt', required: true, type: 'string' },
    { path: 'activeIntegrationClaimed', required: true, type: 'boolean' },
  ],
  NvrVmsIntegrationMetadata: [
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceVendorIntegrationSchemaVersion] },
    { path: 'contractKind', required: true, type: 'string', values: ['nvr-vms-integration'] },
    { path: 'integrationId', required: true, type: 'string' },
    { path: 'recorderRole', required: true, type: 'string' },
    { path: 'operationalStatus', required: true, type: 'string' },
    { path: 'activeIntegrationClaimed', required: true, type: 'boolean' },
  ],
  SensorTelemetryIngestionEnvelope: [
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceVendorIntegrationSchemaVersion] },
    { path: 'contractKind', required: true, type: 'string', values: ['sensor-telemetry-ingestion'] },
    { path: 'adapterId', required: true, type: 'string' },
    { path: 'readings', required: true, type: 'array' },
    { path: 'activeIntegrationClaimed', required: true, type: 'boolean' },
  ],
  GatewayHeartbeatReport: [
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceVendorIntegrationSchemaVersion] },
    { path: 'contractKind', required: true, type: 'string', values: ['gateway-heartbeat'] },
    { path: 'externalGatewayId', required: true, type: 'string' },
    { path: 'status', required: true, type: 'string' },
    { path: 'activeIntegrationClaimed', required: true, type: 'boolean' },
  ],
  SurveillanceEventAlertIngestionEnvelope: [
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceVendorIntegrationSchemaVersion] },
    { path: 'contractKind', required: true, type: 'string', values: ['event-alert-ingestion'] },
    { path: 'adapterId', required: true, type: 'string' },
    { path: 'events', required: true, type: 'array' },
    { path: 'activeIntegrationClaimed', required: true, type: 'boolean' },
  ],
  RecordingRetentionMetadata: [
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceVendorIntegrationSchemaVersion] },
    { path: 'contractKind', required: true, type: 'string', values: ['recording-retention'] },
    { path: 'externalPolicyId', required: true, type: 'string' },
    { path: 'retentionDays', required: true, type: 'number' },
    { path: 'activeIntegrationClaimed', required: true, type: 'boolean' },
  ],
  CameraCapabilitiesMetadata: [
    { path: 'schemaVersion', required: true, type: 'string', values: [surveillanceVendorIntegrationSchemaVersion] },
    { path: 'contractKind', required: true, type: 'string', values: ['camera-capabilities'] },
    { path: 'externalCameraId', required: true, type: 'string' },
    { path: 'ptzSupported', required: true, type: 'boolean' },
    { path: 'activeIntegrationClaimed', required: true, type: 'boolean' },
  ],
} as const;
