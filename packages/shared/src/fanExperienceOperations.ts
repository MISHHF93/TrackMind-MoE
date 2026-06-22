import type { TicketingAdapterDescriptor, TicketingConnectorStatus } from './ticketingAdapter.js';

export const fanExperienceOperationsSchemaVersion = 'trackmind.fan-experience-operations.v1' as const;

export const fanExperienceServiceGuardrailStatement =
  'Fan experience compensations, refunds, and premium access overrides remain draft or approval-governed; automated payouts and seating overrides require authorized human workflows.';

export type AttendanceZoneLevel = 'low' | 'medium' | 'high' | 'at-capacity';
export type GuestServiceCategory =
  | 'accessibility'
  | 'guest-relations'
  | 'parking'
  | 'lost-found'
  | 'hospitality'
  | 'premium-seating'
  | 'refund'
  | 'crowd-density';
export type GuestServiceStatus = 'open' | 'in-progress' | 'resolved' | 'escalated';
export type HospitalityPackageStatus = 'ready' | 'watch' | 'blocked';
export type PremiumSeatingStatus = 'available' | 'sold-out' | 'held' | 'comp';
export type SatisfactionBand = 'promoter' | 'passive' | 'detractor';
export type FanExperienceReadinessStatus = 'nominal' | 'watch' | 'warning' | 'critical';

export interface AttendanceSnapshotDto {
  snapshotId: string;
  recordedAt: string;
  current: number;
  capacity: number;
  utilizationPercent: number;
  entryRatePerMinute: number;
  auditId: string;
}

export interface AttendanceZoneDto {
  zoneId: string;
  zone: string;
  occupancy: number;
  capacity: number;
  level: AttendanceZoneLevel;
  lastUpdatedAt: string;
}

export interface AttendanceTrackingDto {
  current: number;
  capacity: number;
  utilizationPercent: number;
  snapshots: AttendanceSnapshotDto[];
  zones: AttendanceZoneDto[];
}

export interface HospitalityPackageDto {
  packageId: string;
  name: string;
  zone: string;
  guestCount: number;
  capacity: number;
  status: HospitalityPackageStatus;
  openIssues: number;
  readinessScore: number;
  auditId: string;
}

export interface HospitalityOperationsDto {
  readinessScore: number;
  openIssues: number;
  packages: HospitalityPackageDto[];
}

export interface PremiumSeatingSectionDto {
  sectionId: string;
  name: string;
  tier: 'club' | 'suite' | 'box' | 'reserved';
  seatsTotal: number;
  seatsSold: number;
  seatsHeld: number;
  status: PremiumSeatingStatus;
  revenueToday: number;
  currency: string;
  auditId: string;
}

export interface GuestServiceRequestDto {
  requestId: string;
  category: GuestServiceCategory;
  status: GuestServiceStatus;
  priority: 'low' | 'medium' | 'high';
  submittedAt: string;
  resolvedAt?: string;
  guestLabel: string;
  zone?: string;
  waitMinutes: number;
  details: string;
  approvalRequestId?: string;
  auditId: string;
}

export interface EventSatisfactionSurveyDto {
  surveyId: string;
  eventId: string;
  submittedAt: string;
  overallRating: number;
  npsScore: number;
  band: SatisfactionBand;
  categories: Array<{ category: string; rating: number }>;
  comment?: string;
  auditId: string;
}

export interface FanAnalyticsTrendPointDto {
  at: string;
  value: number;
}

export interface FanAnalyticsTrendDto {
  metric: 'attendance' | 'satisfaction' | 'guest-service-wait' | 'premium-revenue' | 'hospitality-readiness';
  trend: 'up' | 'down' | 'flat' | 'insufficient-history';
  points: FanAnalyticsTrendPointDto[];
  summary: string;
}

export interface FanAnalyticsDto {
  engagementScore: number;
  repeatVisitorRate: number;
  averageWaitMinutes: number;
  premiumConversionRate: number;
  trends: FanAnalyticsTrendDto[];
}

export interface FanExperienceRevenueLinkDto {
  linkId: string;
  source: 'ticketing' | 'premium-seating' | 'hospitality' | 'concessions' | 'parking';
  label: string;
  amountToday: number;
  amountMtd: number;
  currency: string;
  financeReference?: string;
  ticketInventoryReference?: string;
  auditId: string;
}

export interface FanExperienceKpiDto {
  kpiId: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  target: number;
  status: FanExperienceReadinessStatus;
  trend: 'up' | 'down' | 'flat' | 'insufficient-history';
  sourceEntities: Array<{ entityType: string; entityId: string }>;
  auditReference: { auditIds: string[]; eventIds: string[] };
}

export interface FanExperienceKpiDashboardDto {
  attendanceUtilization: number;
  guestServiceOpenCount: number;
  hospitalityReadinessScore: number;
  premiumSeatingOccupancy: number;
  satisfactionScore: number;
  revenueToday: number;
  readinessScore: number;
  panels: FanExperienceKpiDto[];
}

export interface FanExperienceAuditRecordDto {
  auditId: string;
  requestId?: string;
  eventId?: string;
  action: string;
  actor: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  changeSummary: string;
  evidence: string[];
}

export interface FanExperienceOperationsGuardrailsDto {
  compensationsRequireApproval: true;
  refundsRequireApproval: true;
  premiumOverridesRequireApproval: true;
  guardrailStatement: string;
}

export type FanExperienceDataSource = 'platform' | 'connector' | 'degraded-connector';

export interface FanExperienceTicketingConnectorDto {
  overallStatus: TicketingConnectorStatus;
  degraded: boolean;
  adapters: TicketingAdapterDescriptor[];
  lastSyncAt: string;
  inventorySource: FanExperienceDataSource;
  attendanceSource: FanExperienceDataSource;
  syncAuditIds: string[];
}

export interface FanExperienceOperationsDto {
  generatedAt: string;
  schemaVersion: typeof fanExperienceOperationsSchemaVersion;
  tenantId: string;
  racetrackId: string;
  eventId?: string;
  attendanceTracking: AttendanceTrackingDto;
  hospitality: HospitalityOperationsDto;
  premiumSeating: PremiumSeatingSectionDto[];
  guestServices: GuestServiceRequestDto[];
  eventSatisfaction: EventSatisfactionSurveyDto[];
  fanAnalytics: FanAnalyticsDto;
  revenueLinkage: FanExperienceRevenueLinkDto[];
  satisfactionScore: number;
  readinessScore: number;
  guardrails: FanExperienceOperationsGuardrailsDto;
  crowdDensity: Array<{ zone: string; level: AttendanceZoneLevel }>;
  ticketInventory: { available: number; sold: number; held: number };
  dashboard: FanExperienceKpiDashboardDto;
  auditTrail: FanExperienceAuditRecordDto[];
  attendance: { current: number; capacity: number; utilizationPercent: number };
  hospitalityReadiness: { score: number; openIssues: number };
  ticketingConnector: FanExperienceTicketingConnectorDto;
  mock: false;
}

export interface FanExperienceMutationResultDto {
  accepted: true;
  requestId?: string;
  auditId: string;
  eventType: string;
  message: string;
  approvalRequestId?: string;
  mock: false;
}

export interface FanExperienceOperationsAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof fanExperienceOperationsSchemaVersion;
  records: FanExperienceAuditRecordDto[];
  mock: false;
}
