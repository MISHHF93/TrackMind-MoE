export const roles = ['admin','steward','veterinarian','track-superintendent','security','ticketing-manager','finance','racing-secretary','compliance-officer','read-only-auditor'] as const;
export type Role = typeof roles[number];
export type Permission = 'race:request-start'|'race:finalize-results'|'horse:scratch'|'vet:review'|'vet:clear-flag'|'track:readings'|'incident:manage'|'ticketing:manage'|'finance:payout'|'security:manage'|'compliance:audit'|'ai:approve'|'discipline:issue'|'read:any';
export const rolePermissions: Record<Role, Permission[]> = {
  admin: ['race:request-start','race:finalize-results','horse:scratch','vet:review','vet:clear-flag','track:readings','incident:manage','ticketing:manage','finance:payout','security:manage','compliance:audit','ai:approve','discipline:issue','read:any'],
  steward: ['race:request-start','race:finalize-results','incident:manage','ai:approve','discipline:issue','read:any'],
  veterinarian: ['vet:review','vet:clear-flag','ai:approve','read:any'],
  'track-superintendent': ['track:readings','ai:approve','read:any'],
  security: ['security:manage','incident:manage','ai:approve','read:any'],
  'ticketing-manager': ['ticketing:manage','read:any'],
  finance: ['finance:payout','read:any'],
  'racing-secretary': ['horse:scratch','race:request-start','read:any'],
  'compliance-officer': ['compliance:audit','ai:approve','read:any'],
  'read-only-auditor': ['read:any']
};
export function hasPermission(role: Role, permission: Permission): boolean { return rolePermissions[role]?.includes(permission) ?? false; }
export type ApprovalStatus = 'draft'|'pending-approval'|'approved'|'rejected'|'expired'|'overridden';
export type RaceDayEventType = 'horse-arrived'|'vet-check-completed'|'track-reading-ingested'|'race-start-requested'|'steward-inquiry-opened'|'incident-created'|'ticket-sale-completed'|'emergency-alert-raised';
export type ExpertDomain = 'RaceOps'|'Stewarding'|'EquineSafety'|'VetCompliance'|'TrackSurface'|'WeatherEnvironment'|'WageringIntegrity'|'TicketingFanExperience'|'SecuritySOC'|'FacilitiesIoT'|'MaintenanceOps'|'FinanceRevenue'|'LegalRegulatory'|'ExecutiveDecisionSupport'|'ResponsibleAIGovernor';
export const protectedActions = ['race-start','race-stop','official-results','scratch-horse','medication-decision','clear-vet-flag','emergency-action','payout','disciplinary-decision'] as const;
export type ProtectedAction = typeof protectedActions[number];

export * from './identityGovernance.js';
