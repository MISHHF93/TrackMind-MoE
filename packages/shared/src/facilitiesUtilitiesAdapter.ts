export type UtilitiesAdapterKind = 'electrical' | 'water' | 'hvac' | 'lighting' | 'irrigation' | 'generator';

export type UtilitiesAdapterStatus = 'connected' | 'degraded' | 'disconnected' | 'mock';

export interface UtilitiesReading {
  adapterId: string;
  kind: UtilitiesAdapterKind;
  metric: string;
  value: number;
  unit: string;
  observedAt: string;
  assetId?: string;
  status: 'nominal' | 'watch' | 'critical';
  evidence: string[];
}

export interface UtilitiesAdapterDescriptor {
  adapterId: string;
  kind: UtilitiesAdapterKind;
  vendor: string;
  status: UtilitiesAdapterStatus;
  assetIds: string[];
  streams: string[];
  lastSyncAt: string;
  mock: boolean;
}

export interface UtilitiesAdapterSnapshot {
  generatedAt: string;
  adapters: UtilitiesAdapterDescriptor[];
  readings: UtilitiesReading[];
  coveragePct: number;
  mock: boolean;
}

export interface UtilitiesAdapter {
  readonly descriptor: UtilitiesAdapterDescriptor;
  poll(now?: string): UtilitiesReading[];
}

export interface UtilitiesAdapterRegistry {
  list(): UtilitiesAdapterDescriptor[];
  snapshot(now?: string): UtilitiesAdapterSnapshot;
}
