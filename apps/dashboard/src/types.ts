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
export interface TrackMapDto { trackId: string; distanceMeters: number; startingGate: { sectorId: string; metersFromStart: number }; sectors: TrackSectorDto[]; measurements: SurfaceMeasurementDto[]; assets: AssetMarkerDto[]; mock: boolean }
export interface ActionResultDto { accepted: boolean; approvalId: string; eventType: string; audited: boolean; message: string; mock: boolean }
