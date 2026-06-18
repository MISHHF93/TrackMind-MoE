export const racingFinanceOperationsSchemaVersion = 'trackmind.racing-finance-operations.v1' as const;

export const racingFinanceAuditabilityStatement =
  'Racing finance records remain hash-chained and approval-governed; purse releases and payouts require authorized human workflows with immutable audit linkage.';

export type PurseStatus = 'allocated' | 'pending-approval' | 'approved' | 'released' | 'held';
export type ExpenseCategory = 'race-day' | 'operational' | 'facility' | 'hospitality' | 'payroll' | 'vendor';
export type ExpenseStatus = 'recorded' | 'pending-approval' | 'approved' | 'reconciled';
export type RevenueSource = 'ticketing' | 'hospitality' | 'premium-seating' | 'concessions' | 'parking';
export type FinanceKpiStatus = 'nominal' | 'watch' | 'warning' | 'critical';

export interface RacePurseDto {
  purseId: string;
  raceId: string;
  raceNumber?: number;
  allocatedAmount: number;
  releasedAmount: number;
  currency: string;
  status: PurseStatus;
  beneficiaries: Array<{ recipientId: string; label: string; sharePercent: number; amount: number }>;
  approvalRequestId?: string;
  auditId: string;
}

export interface RaceDayExpenseDto {
  expenseId: string;
  raceDayId: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  currency: string;
  status: ExpenseStatus;
  incurredAt: string;
  vendorId?: string;
  approvalRequestId?: string;
  auditId: string;
}

export interface OperationalCostDto {
  costId: string;
  costCenter: string;
  label: string;
  amount: number;
  currency: string;
  period: string;
  status: ExpenseStatus;
  incurredAt: string;
  auditId: string;
}

export interface FacilityCostDto {
  facilityCostId: string;
  facilityId: string;
  facilityName: string;
  workOrderId?: string;
  label: string;
  amount: number;
  currency: string;
  status: ExpenseStatus;
  incurredAt: string;
  auditId: string;
}

export interface TicketRevenueDto {
  revenueId: string;
  raceDayId: string;
  source: RevenueSource;
  label: string;
  grossAmount: number;
  netAmount: number;
  currency: string;
  ticketCount: number;
  recordedAt: string;
  fanExperienceReference?: string;
  auditId: string;
}

export interface HospitalityRevenueDto {
  revenueId: string;
  raceDayId: string;
  packageId: string;
  packageName: string;
  grossAmount: number;
  netAmount: number;
  currency: string;
  guestCount: number;
  recordedAt: string;
  fanExperienceReference?: string;
  auditId: string;
}

export interface RacingFinanceKpiDto {
  kpiId: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  target: number;
  status: FinanceKpiStatus;
  trend: 'up' | 'down' | 'flat' | 'insufficient-history';
  sourceEntities: Array<{ entityType: string; entityId: string }>;
  auditReference: { auditIds: string[]; eventIds: string[] };
}

export interface RacingFinanceKpiDashboardDto {
  grossRevenueToday: number;
  totalExpensesToday: number;
  netPositionToday: number;
  purseObligations: number;
  reconciliationExceptions: number;
  budgetUtilizationPercent: number;
  readinessScore: number;
  panels: RacingFinanceKpiDto[];
}

export interface RacingFinanceAuditRecordDto {
  auditId: string;
  recordId?: string;
  raceDayId?: string;
  action: string;
  actor: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  changeSummary: string;
  evidence: string[];
}

export interface RacingFinanceGuardrailsDto {
  payoutsRequireApproval: true;
  purseReleaseRequiresApproval: true;
  financialMutationsAudited: true;
  guardrailStatement: string;
}

export interface RacingFinanceOperationsDto {
  generatedAt: string;
  schemaVersion: typeof racingFinanceOperationsSchemaVersion;
  tenantId: string;
  racetrackId: string;
  raceDayId?: string;
  purses: RacePurseDto[];
  raceDayExpenses: RaceDayExpenseDto[];
  operationalCosts: OperationalCostDto[];
  facilityCosts: FacilityCostDto[];
  ticketRevenue: TicketRevenueDto[];
  hospitalityRevenue: HospitalityRevenueDto[];
  guardrails: RacingFinanceGuardrailsDto;
  dashboard: RacingFinanceKpiDashboardDto;
  auditTrail: RacingFinanceAuditRecordDto[];
  revenue: { today: number; mtd: number; currency: string };
  expenses: { today: number; mtd: number; currency: string };
  budget: { allocated: number; spent: number; remaining: number; currency: string };
  payouts: Array<{ id: string; amount: number; status: string; approvalId?: string }>;
  reconciliation: { pending: number; matched: number; exceptions: number };
  mock: false;
}

export interface RacingFinanceMutationResultDto {
  accepted: true;
  recordId?: string;
  auditId: string;
  eventType: string;
  message: string;
  approvalRequestId?: string;
  mock: false;
}

export interface RacingFinanceAuditTrailDto {
  generatedAt: string;
  schemaVersion: typeof racingFinanceOperationsSchemaVersion;
  records: RacingFinanceAuditRecordDto[];
  mock: false;
}
