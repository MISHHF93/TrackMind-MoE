import type {
  TicketingAdapter,
  TicketingAdapterDescriptor,
  TicketingAdapterRegistry,
  TicketingAttendanceSyncResult,
  TicketingConnectorSnapshot,
  TicketingConnectorStatus,
  TicketingInventorySyncResult,
} from '@trackmind/shared';

const now = () => new Date().toISOString();

class MockTicketingAdapter implements TicketingAdapter {
  constructor(
    readonly descriptor: TicketingAdapterDescriptor,
    private readonly inventorySeed: Pick<TicketingInventorySyncResult, 'available' | 'sold' | 'held'>,
    private readonly attendanceSeed: Pick<TicketingAttendanceSyncResult, 'current' | 'capacity' | 'entryRatePerMinute'>,
  ) {}

  syncInventory(at = now()): TicketingInventorySyncResult {
    const degraded = this.descriptor.status === 'degraded';
    return {
      adapterId: this.descriptor.adapterId,
      syncedAt: at,
      ...this.inventorySeed,
      degraded,
      evidence: [
        `connector:${this.descriptor.adapterId}`,
        `vendor:${this.descriptor.vendor}`,
        `status:${this.descriptor.status}`,
        degraded ? 'label:degraded-connector' : 'label:live-connector',
      ],
    };
  }

  syncAttendance(at = now()): TicketingAttendanceSyncResult {
    const degraded = this.descriptor.status === 'degraded';
    return {
      adapterId: this.descriptor.adapterId,
      syncedAt: at,
      ...this.attendanceSeed,
      degraded,
      evidence: [
        `connector:${this.descriptor.adapterId}`,
        `vendor:${this.descriptor.vendor}`,
        `status:${this.descriptor.status}`,
        degraded ? 'label:degraded-connector' : 'label:live-connector',
      ],
    };
  }
}

function worstStatus(statuses: TicketingConnectorStatus[]): TicketingConnectorStatus {
  if (statuses.includes('disconnected')) return 'disconnected';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.includes('connected')) return 'connected';
  return 'mock';
}

export class TicketingAdapterRegistryImpl implements TicketingAdapterRegistry {
  private readonly adapters: MockTicketingAdapter[];

  constructor(seedAt = now()) {
    this.adapters = [
      new MockTicketingAdapter(
        {
          adapterId: 'adapter-ticketing-primary',
          vendor: 'ticketing-gateway-mock',
          status: 'connected',
          capabilities: ['inventory', 'attendance', 'refunds'],
          lastSyncAt: seedAt,
          mock: true,
        },
        { available: 3510, sold: 8490, held: 120 },
        { current: 8490, capacity: 12000, entryRatePerMinute: 44 },
      ),
      new MockTicketingAdapter(
        {
          adapterId: 'adapter-ticketing-secondary',
          vendor: 'box-office-pos-mock',
          status: 'degraded',
          capabilities: ['inventory', 'attendance'],
          lastSyncAt: seedAt,
          mock: true,
        },
        { available: 3580, sold: 8420, held: 120 },
        { current: 8420, capacity: 12000, entryRatePerMinute: 42 },
      ),
    ];
  }

  list(): TicketingAdapterDescriptor[] {
    return this.adapters.map((adapter) => ({ ...adapter.descriptor }));
  }

  snapshot(at = now()): TicketingConnectorSnapshot {
    return this.syncAll(at);
  }

  syncAll(at = now()): TicketingConnectorSnapshot {
    const descriptors = this.list().map((descriptor) => ({ ...descriptor, lastSyncAt: at }));
    const primary = this.adapters.find((adapter) => adapter.descriptor.status === 'connected') ?? this.adapters[0];
    const inventory = primary.syncInventory(at);
    const attendance = primary.syncAttendance(at);
    const overallStatus = worstStatus(descriptors.map((descriptor) => descriptor.status));
    const degraded = overallStatus === 'degraded' || inventory.degraded || attendance.degraded;
    return {
      generatedAt: at,
      adapters: descriptors,
      inventory,
      attendance,
      overallStatus,
      degraded,
      mock: true,
    };
  }
}

export function createTicketingAdapterRegistry(seedAt?: string): TicketingAdapterRegistry {
  return new TicketingAdapterRegistryImpl(seedAt);
}
