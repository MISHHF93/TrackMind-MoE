import type { ApprovalStatus, ProtectedAction, Role } from '@trackmind/shared';

export type NexusRole = Role;
export type AdapterMode = 'live' | 'mock';
export type LoadState<T> = { status: 'loading' } | { status: 'error'; message: string; mock: boolean } | { status: 'empty'; mock: boolean } | { status: 'ready'; data: T; mock: boolean };
export interface UserSession { userId: string; displayName: string; roles: NexusRole[]; authenticated: boolean }
export interface ApprovalDto { id: string; action: ProtectedAction | string; target: string; requestedBy: string; status: ApprovalStatus; createdAt: string; expiresAt: string; evidence: string[]; mock: boolean }
export interface AuditEventDto { id: string; type: string; actor: string; timestamp: string; subjectId?: string; severity: 'info' | 'warning' | 'critical'; hash: string; previousHash: string; mock: boolean }
export interface TrackSectorDto { id: string; name: string; startMeters: number; endMeters: number; condition: 'fast' | 'good' | 'muddy' | 'maintenance' }
export interface SurfaceMeasurementDto { sectorId: string; moisture: number; compaction: number; measuredAt: string }
export interface AssetMarkerDto { id: string; type: 'gate' | 'sensor' | 'vehicle' | 'camera' | 'crew'; label: string; sectorId: string; status: 'online' | 'offline' | 'standby' | 'warning' }

export type GeospatialLayerDto = 'sector' | 'gate' | 'rail' | 'barn' | 'facility' | 'camera' | 'emergency' | 'measurement' | 'incident' | 'maintenance' | 'workforce' | 'twin' | 'simulation';
export interface GeospatialFeatureDto { id: string; layer: GeospatialLayerDto; label: string; status: 'nominal' | 'standby' | 'warning' | 'critical' | 'closed' | 'in-progress' | 'simulated'; source: 'asset-registry' | 'telemetry' | 'event-service' | 'digital-twin' | 'simulation' | 'track-configuration'; coordinates: { latitude: number; longitude: number }; properties: Record<string, unknown> }
export interface GeospatialMapDto { viewport: { center: { latitude: number; longitude: number }; zoom: number; bounds: { north: number; south: number; east: number; west: number } }; overlays: Array<{ id: string; name: string; layer: GeospatialLayerDto; visible: boolean; opacity: number }>; features: GeospatialFeatureDto[]; playback: Array<{ at: string; featureIds: string[]; summary: string }>; simulationOverlays: Array<{ id: string; scenario: string; featureIds: string[]; riskDelta: number; approvalRequired: boolean }>; digitalTwinState: Array<{ twinId: string; assetId: string; health: string; version: number; lastUpdatedAt: string }>; controls: { zoom: { current: number; presets: number[] }; filters: string[]; overlayModes: string[]; playbackEnabled: boolean } }
export interface TrackMapDto { trackId: string; distanceMeters: number; startingGate: { sectorId: string; metersFromStart: number }; sectors: TrackSectorDto[]; measurements: SurfaceMeasurementDto[]; assets: AssetMarkerDto[]; geospatial?: GeospatialMapDto; mock: boolean }

export interface CommandWidgetDto { id: string; title: string; domain: string; status: 'nominal' | 'advisory' | 'warning' | 'critical'; value: string; detail: string; source: 'service' | 'event-stream' | 'digital-twin' | 'approved-mock-adapter'; drillDownPath: string; roleView: NexusRole[] | 'all'; configurable: boolean }
export interface OperationsLayoutDto { id: string; name: string; role: NexusRole | 'all'; widgetIds: string[] }
export interface LiveEventDto { id: string; timestamp: string; type: string; domain: string; summary: string; severity: 'info' | 'advisory' | 'warning' | 'critical'; source: CommandWidgetDto['source'] }
export interface OperationalAlertDto { id: string; title: string; severity: 'advisory' | 'warning' | 'critical'; acknowledged: boolean; actionPath: string; evidence: string[] }
export interface OperationsCommandCenterDto { generatedAt: string; activeLayoutId: string; widgets: CommandWidgetDto[]; savedLayouts: OperationsLayoutDto[]; liveEvents: LiveEventDto[]; alerts: OperationalAlertDto[]; aiRecommendations: Array<{ id: string; recommendation: string; confidence: number; evidence: string[]; requiresApproval: boolean; actionPath: string }> ; dataLineage: Array<{ domain: string; source: CommandWidgetDto['source']; reference: string }> ; mock: boolean }
export interface ActionResultDto { accepted: boolean; approvalId: string; eventType: string; audited: boolean; message: string; mock: boolean }
