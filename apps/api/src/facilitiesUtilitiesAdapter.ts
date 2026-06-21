import type {
  UtilitiesAdapter,
  UtilitiesAdapterDescriptor,
  UtilitiesAdapterRegistry,
  UtilitiesAdapterSnapshot,
  UtilitiesReading,
} from '@trackmind/shared';

const now = () => new Date().toISOString();

class MockUtilitiesAdapter implements UtilitiesAdapter {
  constructor(readonly descriptor: UtilitiesAdapterDescriptor, private readonly readings: UtilitiesReading[]) {}

  poll(at = now()): UtilitiesReading[] {
    return this.readings.map((reading) => ({ ...reading, observedAt: at }));
  }
}

export class FacilitiesUtilitiesAdapterRegistry implements UtilitiesAdapterRegistry {
  private readonly adapters: MockUtilitiesAdapter[];

  constructor(seedAt = now()) {
    this.adapters = [
      new MockUtilitiesAdapter(
        {
          adapterId: 'adapter-electrical-main',
          kind: 'electrical',
          vendor: 'facilities-scada-mock',
          status: 'connected',
          assetIds: ['BACKUP_GENERATOR_A'],
          streams: ['telemetry.facility.power'],
          lastSyncAt: seedAt,
          mock: true,
        },
        [{
          adapterId: 'adapter-electrical-main',
          kind: 'electrical',
          metric: 'loadPct',
          value: 74,
          unit: '%',
          observedAt: seedAt,
          assetId: 'BACKUP_GENERATOR_A',
          status: 'nominal',
          evidence: ['telemetry:generator-load-a'],
        }],
      ),
      new MockUtilitiesAdapter(
        {
          adapterId: 'adapter-hvac-grandstand',
          kind: 'hvac',
          vendor: 'facilities-bms-mock',
          status: 'connected',
          assetIds: ['GRANDSTAND_HVAC_01'],
          streams: ['telemetry.facility.hvac'],
          lastSyncAt: seedAt,
          mock: true,
        },
        [{
          adapterId: 'adapter-hvac-grandstand',
          kind: 'hvac',
          metric: 'filterDeltaPressure',
          value: 68,
          unit: 'Pa',
          observedAt: seedAt,
          assetId: 'GRANDSTAND_HVAC_01',
          status: 'watch',
          evidence: ['telemetry:filterDeltaPressure=68'],
        }],
      ),
      new MockUtilitiesAdapter(
        {
          adapterId: 'adapter-water-irrigation',
          kind: 'water',
          vendor: 'irrigation-gateway-mock',
          status: 'degraded',
          assetIds: ['IRRIGATION_ZONE_FAR_TURN'],
          streams: ['telemetry.surface.irrigation'],
          lastSyncAt: seedAt,
          mock: true,
        },
        [{
          adapterId: 'adapter-water-irrigation',
          kind: 'water',
          metric: 'flowRate',
          value: 0,
          unit: 'L/min',
          observedAt: seedAt,
          assetId: 'IRRIGATION_ZONE_FAR_TURN',
          status: 'watch',
          evidence: ['telemetry:irrigation-far-turn-flow'],
        }],
      ),
    ];
  }

  list(): UtilitiesAdapterDescriptor[] {
    return this.adapters.map((adapter) => ({ ...adapter.descriptor }));
  }

  snapshot(at = now()): UtilitiesAdapterSnapshot {
    const adapters = this.list();
    const readings = this.adapters.flatMap((adapter) => adapter.poll(at));
    const connected = adapters.filter((adapter) => adapter.status === 'connected').length;
    return {
      generatedAt: at,
      adapters,
      readings,
      coveragePct: adapters.length ? Math.round((connected / adapters.length) * 100) : 0,
      mock: true,
    };
  }
}

export function createFacilitiesUtilitiesAdapterRegistry(seedAt?: string): FacilitiesUtilitiesAdapterRegistry {
  return new FacilitiesUtilitiesAdapterRegistry(seedAt);
}
