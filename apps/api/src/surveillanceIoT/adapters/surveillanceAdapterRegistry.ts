import type {
  AdapterDiscoveredCamera,
  AdapterDiscoveredSensor,
  AdapterEvidenceClipDescriptor,
  AdapterRetentionPolicyDescriptor,
  AdapterStreamHealthSnapshot,
  AdapterTelemetryReading,
  CameraStreamSourceIntegrationAdapter,
  EventAlertIntegrationAdapter,
  GatewayHeartbeatIntegrationAdapter,
  NvrVmsIntegrationAdapter,
  SensorTelemetryIntegrationAdapter,
  SurveillanceAdapterDescriptor,
  SurveillanceAdapterRegistry,
  SurveillanceAdapterSnapshot,
} from '@trackmind/shared';
import {
  buildSurveillanceVendorIntegrationCatalog,
  surveillanceAdapterClaimsActiveIntegration,
  surveillanceIoTAdapterSchemaVersion,
} from '@trackmind/shared';

const now = () => new Date().toISOString();

function catalogDescriptor(
  contractId: string,
  contractKind: SurveillanceAdapterDescriptor['contractKind'],
  adapterId: string,
  connectorId: SurveillanceAdapterDescriptor['connectorId'],
  category: SurveillanceAdapterDescriptor['category'],
  protocols: SurveillanceAdapterDescriptor['protocols'],
  displayName: string,
): SurveillanceAdapterDescriptor {
  return {
    adapterId,
    connectorId,
    category,
    contractKind,
    contractId,
    protocols,
    status: 'unconfigured',
    integrationReadiness: 'provider-ready',
    operationalStatus: 'unconfigured',
    activeIntegrationClaimed: false,
    displayName,
    providerAgnostic: true,
    mock: false,
  };
}

class UnconfiguredCameraAdapter implements CameraStreamSourceIntegrationAdapter {
  constructor(readonly descriptor: SurveillanceAdapterDescriptor) {}

  listStreamSources() {
    return [];
  }

  discoverCameras(): AdapterDiscoveredCamera[] {
    return [];
  }

  pollStreamHealth(at = now()): AdapterStreamHealthSnapshot[] {
    void at;
    return [];
  }

  listCapabilities() {
    return [];
  }
}

class UnconfiguredSensorAdapter implements SensorTelemetryIntegrationAdapter {
  constructor(readonly descriptor: SurveillanceAdapterDescriptor) {}

  discoverSensors(): AdapterDiscoveredSensor[] {
    return [];
  }

  pollReadings(at = now()): AdapterTelemetryReading[] {
    void at;
    return [];
  }

  normalizeIngestion(envelope: Parameters<SensorTelemetryIntegrationAdapter['normalizeIngestion']>[0]) {
    void envelope;
    return [];
  }
}

class UnconfiguredNvrAdapter implements NvrVmsIntegrationAdapter {
  constructor(readonly descriptor: SurveillanceAdapterDescriptor) {}

  describeIntegration() {
    return undefined;
  }

  listRetentionPolicies(): AdapterRetentionPolicyDescriptor[] {
    return [];
  }

  listRecordingRetention() {
    return [];
  }

  listEvidenceClips(): AdapterEvidenceClipDescriptor[] {
    return [];
  }
}

class UnconfiguredGatewayAdapter implements GatewayHeartbeatIntegrationAdapter {
  constructor(readonly descriptor: SurveillanceAdapterDescriptor) {}

  pollHeartbeats() {
    return [];
  }
}

class UnconfiguredEventAdapter implements EventAlertIntegrationAdapter {
  constructor(readonly descriptor: SurveillanceAdapterDescriptor) {}

  normalizeEvents(envelope: Parameters<EventAlertIntegrationAdapter['normalizeEvents']>[0]) {
    void envelope;
    return [];
  }

  pollRecentEvents() {
    return [];
  }
}

export interface SurveillanceAdapterRegistryOptions {
  seedAt?: string;
  /** Optional reference slice for demos — still marked unconfigured with no active integration claim. */
  includeReferenceSlice?: boolean;
}

export class SurveillanceAdapterRegistryImpl implements SurveillanceAdapterRegistry {
  private readonly cameraAdaptersList: CameraStreamSourceIntegrationAdapter[];
  private readonly sensorAdaptersList: SensorTelemetryIntegrationAdapter[];
  private readonly nvrAdaptersList: NvrVmsIntegrationAdapter[];
  private readonly gatewayAdaptersList: GatewayHeartbeatIntegrationAdapter[];
  private readonly eventAdaptersList: EventAlertIntegrationAdapter[];

  constructor(options: SurveillanceAdapterRegistryOptions = {}) {
    const catalog = buildSurveillanceVendorIntegrationCatalog();
    const byKind = Object.fromEntries(catalog.map((entry) => [entry.contractKind, entry])) as Record<
      SurveillanceAdapterDescriptor['contractKind'],
      (typeof catalog)[number]
    >;

    this.cameraAdaptersList = [
      new UnconfiguredCameraAdapter(
        catalogDescriptor(
          byKind['camera-stream-source'].contractId,
          'camera-stream-source',
          'adapter-slot-camera-stream-source',
          'camera-vms',
          'camera-vms',
          byKind['camera-stream-source'].supportedProtocols,
          'Camera stream source slot',
        ),
      ),
      new UnconfiguredCameraAdapter(
        catalogDescriptor(
          byKind['camera-capabilities'].contractId,
          'camera-capabilities',
          'adapter-slot-camera-capabilities',
          'camera-vms',
          'camera-vms',
          byKind['camera-capabilities'].supportedProtocols,
          'Camera capabilities slot',
        ),
      ),
    ];

    this.sensorAdaptersList = [
      new UnconfiguredSensorAdapter(
        catalogDescriptor(
          byKind['sensor-telemetry-ingestion'].contractId,
          'sensor-telemetry-ingestion',
          'adapter-slot-sensor-telemetry',
          'sensor-iot',
          'sensor-iot',
          byKind['sensor-telemetry-ingestion'].supportedProtocols,
          'Sensor telemetry ingestion slot',
        ),
      ),
    ];

    this.nvrAdaptersList = [
      new UnconfiguredNvrAdapter(
        catalogDescriptor(
          byKind['nvr-vms-integration'].contractId,
          'nvr-vms-integration',
          'adapter-slot-nvr-vms',
          'camera-vms',
          'nvr-bridge',
          byKind['nvr-vms-integration'].supportedProtocols,
          'NVR / VMS integration slot',
        ),
      ),
      new UnconfiguredNvrAdapter(
        catalogDescriptor(
          byKind['recording-retention'].contractId,
          'recording-retention',
          'adapter-slot-recording-retention',
          'camera-vms',
          'nvr-bridge',
          byKind['recording-retention'].supportedProtocols,
          'Recording / retention slot',
        ),
      ),
    ];

    this.gatewayAdaptersList = [
      new UnconfiguredGatewayAdapter(
        catalogDescriptor(
          byKind['gateway-heartbeat'].contractId,
          'gateway-heartbeat',
          'adapter-slot-gateway-heartbeat',
          'sensor-iot',
          'gateway',
          byKind['gateway-heartbeat'].supportedProtocols,
          'Gateway heartbeat slot',
        ),
      ),
    ];

    this.eventAdaptersList = [
      new UnconfiguredEventAdapter(
        catalogDescriptor(
          byKind['event-alert-ingestion'].contractId,
          'event-alert-ingestion',
          'adapter-slot-event-alert',
          'sensor-iot',
          'sensor-iot',
          byKind['event-alert-ingestion'].supportedProtocols,
          'Event / alert ingestion slot',
        ),
      ),
    ];

    void options.includeReferenceSlice;
    void options.seedAt;
  }

  list(): SurveillanceAdapterDescriptor[] {
    return [
      ...this.cameraAdaptersList.map((adapter) => ({ ...adapter.descriptor })),
      ...this.sensorAdaptersList.map((adapter) => ({ ...adapter.descriptor })),
      ...this.nvrAdaptersList.map((adapter) => ({ ...adapter.descriptor })),
      ...this.gatewayAdaptersList.map((adapter) => ({ ...adapter.descriptor })),
      ...this.eventAdaptersList.map((adapter) => ({ ...adapter.descriptor })),
    ];
  }

  cameraAdapters(): CameraStreamSourceIntegrationAdapter[] {
    return [...this.cameraAdaptersList];
  }

  sensorAdapters(): SensorTelemetryIntegrationAdapter[] {
    return [...this.sensorAdaptersList];
  }

  nvrAdapters(): NvrVmsIntegrationAdapter[] {
    return [...this.nvrAdaptersList];
  }

  gatewayAdapters(): GatewayHeartbeatIntegrationAdapter[] {
    return [...this.gatewayAdaptersList];
  }

  eventAdapters(): EventAlertIntegrationAdapter[] {
    return [...this.eventAdaptersList];
  }

  snapshot(at = now()): SurveillanceAdapterSnapshot {
    const activeAdapters = this.list().filter(surveillanceAdapterClaimsActiveIntegration);
    const discoveredCameras = activeAdapters.length
      ? this.cameraAdaptersList.flatMap((adapter) => adapter.discoverCameras())
      : [];
    const discoveredSensors = activeAdapters.length
      ? this.sensorAdaptersList.flatMap((adapter) => adapter.discoverSensors())
      : [];
    const streamHealth = activeAdapters.length
      ? this.cameraAdaptersList.flatMap((adapter) => adapter.pollStreamHealth(at))
      : [];
    const readings = activeAdapters.length
      ? this.sensorAdaptersList.flatMap((adapter) => adapter.pollReadings(at))
      : [];
    const streamSources = activeAdapters.length
      ? this.cameraAdaptersList.flatMap((adapter) => adapter.listStreamSources(at))
      : [];
    const gatewayHeartbeats = activeAdapters.length
      ? this.gatewayAdaptersList.flatMap((adapter) => adapter.pollHeartbeats(at))
      : [];
    const recentEvents = activeAdapters.length
      ? this.eventAdaptersList.flatMap((adapter) => adapter.pollRecentEvents(at))
      : [];

    return {
      generatedAt: at,
      schemaVersion: surveillanceIoTAdapterSchemaVersion,
      adapters: this.list(),
      discoveredCameras,
      discoveredSensors,
      streamHealth,
      readings,
      streamSources,
      gatewayHeartbeats,
      recentEvents,
      mock: false,
      activeIntegrationClaimed: activeAdapters.length > 0,
    };
  }
}

export function createSurveillanceAdapterRegistry(options?: SurveillanceAdapterRegistryOptions): SurveillanceAdapterRegistry {
  return new SurveillanceAdapterRegistryImpl(options);
}
