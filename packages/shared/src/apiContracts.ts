import type { ApprovalStatus, ProtectedAction, Role } from './index.js';

export type NexusRole = Role;
export type ApiResponse<T> = { ok: true; data: T; auditId?: string; eventId?: string } | { ok: false; error: { code: string; message: string; details?: string[] }; auditId?: string };
export type ContractFieldType = 'string'|'number'|'boolean'|'array'|'object';
export interface ContractRule { path: string; required?: boolean; type?: ContractFieldType; values?: readonly string[]; min?: number; max?: number }
export interface EndpointContract { method: 'GET'|'POST'; path: string; operationId: string; response: string; roles: NexusRole[]|'authenticated'; emits: string[]; audits: string[]; description: string }

const get = (obj: unknown, path: string): unknown => path.split('.').reduce((acc: any, key) => acc?.[key], obj as any);
export function validateContract(name: string, value: unknown, rules: readonly ContractRule[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const rule of rules) {
    const v = get(value, rule.path);
    if (rule.required && (v === undefined || v === null || v === '')) errors.push(`${name}.${rule.path} is required`);
    if (v !== undefined && rule.type) {
      const ok = rule.type === 'array' ? Array.isArray(v) : typeof v === rule.type;
      if (!ok) errors.push(`${name}.${rule.path} must be ${rule.type}`);
    }
    if (rule.values && v !== undefined && !rule.values.includes(String(v))) errors.push(`${name}.${rule.path} must be one of ${rule.values.join(',')}`);
    if (typeof v === 'number' && rule.min !== undefined && v < rule.min) errors.push(`${name}.${rule.path} must be >= ${rule.min}`);
    if (typeof v === 'number' && rule.max !== undefined && v > rule.max) errors.push(`${name}.${rule.path} must be <= ${rule.max}`);
  }
  return { valid: errors.length === 0, errors };
}
export function assertContract<T>(name: string, value: T, rules: readonly ContractRule[]): T { const result = validateContract(name, value, rules); if (!result.valid) throw new Error(result.errors.join('; ')); return value; }

export interface ApprovalDto { id: string; action: ProtectedAction | string; target: string; requestedBy: string; status: ApprovalStatus | 'pending' | 'escalated'; createdAt: string; expiresAt: string; evidence: string[]; mock: boolean }
export interface AuditEventDto { id: string; type: string; actor: string; timestamp: string; subjectId?: string; severity: 'info'|'warning'|'critical'; hash: string; previousHash: string; mock: boolean }
export interface RaceDto { raceId: string; trackId: string; postTime: string; score: number; status: 'ready'|'watch'|'blocked'; warnings: number; approvals: number; mock: boolean }
export interface TrackSectorDto { id: string; name: string; startMeters: number; endMeters: number; condition: 'fast'|'good'|'muddy'|'maintenance' }
export interface SurfaceMeasurementDto { sectorId: string; moisture: number; compaction: number; measuredAt: string; eventId: string; auditId: string }
export interface AssetMarkerDto { id: string; type: 'gate'|'sensor'|'vehicle'|'camera'|'crew'; label: string; sectorId: string; status: 'online'|'offline'|'standby'|'warning'; twinId?: string }
export interface GatePositionDto { gateId: string; sectorId: string; metersFromStart: number; gpsVerified: boolean; lastApprovedRequestId?: string; mock: boolean }
export interface RaceDistanceConfigurationDto { raceId: string; distanceMeters: number; gateSectorId: string; configuredBy: string; approvedRequestId?: string; mock: boolean }
export interface DigitalTwinStateDto { twinId: string; assetId: string; health: string; version: number; lastUpdatedAt: string; state: Record<string, unknown>; mock: boolean }
export interface AIRecommendationDto { id: string; recommendation: string; confidence: number; evidence: string[]; requiresApproval: boolean; actionPath?: string; eventId: string; auditId: string; mock: boolean }

const dto = {
  ApprovalDto: [{path:'id',required:true,type:'string'},{path:'action',required:true,type:'string'},{path:'target',required:true,type:'string'},{path:'requestedBy',required:true,type:'string'},{path:'status',required:true,type:'string'},{path:'createdAt',required:true,type:'string'},{path:'expiresAt',required:true,type:'string'},{path:'evidence',required:true,type:'array'},{path:'mock',required:true,type:'boolean'}],
  AuditEventDto: [{path:'id',required:true,type:'string'},{path:'type',required:true,type:'string'},{path:'actor',required:true,type:'string'},{path:'timestamp',required:true,type:'string'},{path:'severity',required:true,type:'string',values:['info','warning','critical']},{path:'hash',required:true,type:'string'},{path:'previousHash',required:true,type:'string'},{path:'mock',required:true,type:'boolean'}],
  RaceDto: [{path:'raceId',required:true,type:'string'},{path:'trackId',required:true,type:'string'},{path:'postTime',required:true,type:'string'},{path:'score',required:true,type:'number',min:0,max:100},{path:'status',required:true,type:'string',values:['ready','watch','blocked']},{path:'warnings',required:true,type:'number'},{path:'approvals',required:true,type:'number'},{path:'mock',required:true,type:'boolean'}],
  AssetMarkerDto: [{path:'id',required:true,type:'string'},{path:'type',required:true,type:'string'},{path:'label',required:true,type:'string'},{path:'sectorId',required:true,type:'string'},{path:'status',required:true,type:'string'},{path:'twinId',type:'string'}],
  SurfaceMeasurementDto: [{path:'sectorId',required:true,type:'string'},{path:'moisture',required:true,type:'number',min:0,max:100},{path:'compaction',required:true,type:'number',min:0},{path:'measuredAt',required:true,type:'string'},{path:'eventId',required:true,type:'string'},{path:'auditId',required:true,type:'string'}],
  GatePositionDto: [{path:'gateId',required:true,type:'string'},{path:'sectorId',required:true,type:'string'},{path:'metersFromStart',required:true,type:'number',min:0},{path:'gpsVerified',required:true,type:'boolean'},{path:'mock',required:true,type:'boolean'}],
  RaceDistanceConfigurationDto: [{path:'raceId',required:true,type:'string'},{path:'distanceMeters',required:true,type:'number',min:200},{path:'gateSectorId',required:true,type:'string'},{path:'configuredBy',required:true,type:'string'},{path:'mock',required:true,type:'boolean'}],
  DigitalTwinStateDto: [{path:'twinId',required:true,type:'string'},{path:'assetId',required:true,type:'string'},{path:'health',required:true,type:'string'},{path:'version',required:true,type:'number',min:1},{path:'lastUpdatedAt',required:true,type:'string'},{path:'state',required:true,type:'object'},{path:'mock',required:true,type:'boolean'}],
  AIRecommendationDto: [{path:'id',required:true,type:'string'},{path:'recommendation',required:true,type:'string'},{path:'confidence',required:true,type:'number',min:0,max:1},{path:'evidence',required:true,type:'array'},{path:'requiresApproval',required:true,type:'boolean'},{path:'eventId',required:true,type:'string'},{path:'auditId',required:true,type:'string'},{path:'mock',required:true,type:'boolean'}],
} as const satisfies Record<string, readonly ContractRule[]>;
export const apiContractSchemas = dto;
export const apiEndpointContracts: EndpointContract[] = [
  { method:'GET', path:'/api/v1/assets', operationId:'listAssets', response:'AssetMarkerDto[]', roles:'authenticated', emits:[], audits:['asset.read'], description:'List racetrack assets with twin references.' },
  { method:'GET', path:'/api/v1/races', operationId:'listRaces', response:'RaceDto[]', roles:'authenticated', emits:[], audits:['race.read'], description:'List race readiness summaries.' },
  { method:'GET', path:'/api/v1/approvals/requests', operationId:'listApprovals', response:'ApprovalDto[]', roles:'authenticated', emits:[], audits:['approval.read'], description:'List governed approval requests.' },
  { method:'GET', path:'/api/v1/audit/events', operationId:'listAuditEvents', response:'AuditEventDto[]', roles:['compliance-officer','read-only-auditor','admin'], emits:[], audits:['audit.read'], description:'Read hash-chained audit events.' },
  { method:'GET', path:'/api/v1/digital-twin/state', operationId:'listDigitalTwinState', response:'DigitalTwinStateDto[]', roles:'authenticated', emits:[], audits:['digital-twin.read'], description:'Read current Digital Twin objects.' },
  { method:'GET', path:'/api/v1/track-surface/measurements', operationId:'listSurfaceMeasurements', response:'SurfaceMeasurementDto[]', roles:'authenticated', emits:[], audits:['surface.read'], description:'Read surface measurements with event and audit links.' },
  { method:'GET', path:'/api/v1/starting-gate/position', operationId:'getGatePosition', response:'GatePositionDto', roles:'authenticated', emits:[], audits:['starting-gate.read'], description:'Read starting-gate control position.' },
  { method:'POST', path:'/api/v1/approvals/draft-requests', operationId:'createDraftRequest', response:'ApprovalDto', roles:['admin','racing-secretary','track-superintendent','steward'], emits:['approval.requested'], audits:['approval.requested'], description:'Create approval-gated control request.' },
  { method:'GET', path:'/api/v1/ai/recommendations', operationId:'listAIRecommendations', response:'AIRecommendationDto[]', roles:'authenticated', emits:[], audits:['ai.recommendation.read'], description:'List advisory AI recommendations.' },
];
