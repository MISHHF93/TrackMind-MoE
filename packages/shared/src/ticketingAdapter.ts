export type TicketingConnectorStatus = 'connected' | 'degraded' | 'disconnected' | 'mock';

export type TicketingAdapterCapability = 'inventory' | 'attendance' | 'refunds';

export interface TicketingAdapterDescriptor {
  adapterId: string;
  vendor: string;
  status: TicketingConnectorStatus;
  capabilities: TicketingAdapterCapability[];
  lastSyncAt: string;
  mock: boolean;
}

export interface TicketingInventorySyncResult {
  adapterId: string;
  syncedAt: string;
  available: number;
  sold: number;
  held: number;
  degraded: boolean;
  evidence: string[];
}

export interface TicketingAttendanceSyncResult {
  adapterId: string;
  syncedAt: string;
  current: number;
  capacity: number;
  entryRatePerMinute: number;
  degraded: boolean;
  evidence: string[];
}

export interface TicketingConnectorSnapshot {
  generatedAt: string;
  adapters: TicketingAdapterDescriptor[];
  inventory: TicketingInventorySyncResult | null;
  attendance: TicketingAttendanceSyncResult | null;
  overallStatus: TicketingConnectorStatus;
  degraded: boolean;
  mock: boolean;
}

export interface TicketingAdapter {
  readonly descriptor: TicketingAdapterDescriptor;
  syncInventory(at?: string): TicketingInventorySyncResult;
  syncAttendance(at?: string): TicketingAttendanceSyncResult;
}

export interface TicketingAdapterRegistry {
  list(): TicketingAdapterDescriptor[];
  snapshot(at?: string): TicketingConnectorSnapshot;
  syncAll(at?: string): TicketingConnectorSnapshot;
}
