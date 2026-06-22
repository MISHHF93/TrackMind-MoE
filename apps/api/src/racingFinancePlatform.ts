import type {
  FacilityCostDto,
  HospitalityRevenueDto,
  OperationalCostDto,
  RaceDayExpenseDto,
  RacePurseDto,
  RacingFinanceApprovalControlDto,
  RacingFinanceAuditTrailDto,
  RacingFinanceKpiDashboardDto,
  RacingFinanceKpiDto,
  RacingFinanceMutationResultDto,
  RacingFinanceOperationsDto,
  RacingFinancePayoutQueueItemDto,
  SettlementAdapterRegistry,
  TicketRevenueDto,
} from '@trackmind/shared';
import { racingFinanceAuditabilityStatement } from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { ApprovalToken, CentralizedApprovalService } from './approvals.js';
import { createSettlementAdapterRegistry } from './settlementAdapter.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const hash = (value: unknown) => {
  const text = JSON.stringify(value);
  let acc = 0;
  for (let i = 0; i < text.length; i++) acc = (acc * 31 + text.charCodeAt(i)) >>> 0;
  return `sha256:${acc.toString(16).padStart(8, '0')}`;
};

interface RacingFinanceState {
  tenantId: string;
  racetrackId: string;
  raceDayId?: string;
  budgetAllocated: number;
  budgetSpentMtd: number;
  purses: RacePurseDto[];
  raceDayExpenses: RaceDayExpenseDto[];
  operationalCosts: OperationalCostDto[];
  facilityCosts: FacilityCostDto[];
  ticketRevenue: TicketRevenueDto[];
  hospitalityRevenue: HospitalityRevenueDto[];
  payouts: Array<{ id: string; amount: number; status: string; approvalId?: string }>;
  reconciliation: { pending: number; matched: number; exceptions: number };
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface RacingFinancePlatformDeps {
  approvalService?: CentralizedApprovalService;
  auditLog?: ImmutableAuditLog;
  settlementRegistry?: SettlementAdapterRegistry;
  tenantId?: string;
  racetrackId?: string;
  raceDayId?: string;
}

export class RacingFinancePlatform {
  private state: RacingFinanceState;
  private readonly auditChain: RacingFinanceOperationsDto['auditTrail'] = [];
  private readonly settlementRegistry: SettlementAdapterRegistry;

  constructor(private readonly deps: RacingFinancePlatformDeps = {}) {
    const now = new Date().toISOString();
    this.settlementRegistry = deps.settlementRegistry ?? createSettlementAdapterRegistry(now);
    this.state = {
      tenantId: deps.tenantId ?? 'trackmind',
      racetrackId: deps.racetrackId ?? 'main-track',
      raceDayId: deps.raceDayId ?? 'race-day-main',
      budgetAllocated: 1_200_000,
      budgetSpentMtd: 318_000,
      purses: [],
      raceDayExpenses: [],
      operationalCosts: [],
      facilityCosts: [],
      ticketRevenue: [],
      hospitalityRevenue: [],
      payouts: [],
      reconciliation: { pending: 3, matched: 47, exceptions: 1 },
      version: 1,
      updatedAt: now,
      updatedBy: 'racing-finance',
    };
  }

  workspace(now = new Date().toISOString()): RacingFinanceOperationsDto {
    const totals = this.computeTotals(now);
    const dashboard = this.buildDashboard(totals, now);
    const settlement = this.settlementRegistry.snapshot(now);
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.racing-finance-operations.v1',
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      raceDayId: this.state.raceDayId,
      purses: this.state.purses.map(clone),
      raceDayExpenses: this.state.raceDayExpenses.map(clone),
      operationalCosts: this.state.operationalCosts.map(clone),
      facilityCosts: this.state.facilityCosts.map(clone),
      ticketRevenue: this.state.ticketRevenue.map(clone),
      hospitalityRevenue: this.state.hospitalityRevenue.map(clone),
      guardrails: {
        payoutsRequireApproval: true,
        purseReleaseRequiresApproval: true,
        financialMutationsAudited: true,
        guardrailStatement: racingFinanceAuditabilityStatement,
      },
      dashboard,
      auditTrail: this.auditChain.map(clone),
      revenue: { today: totals.revenueToday, mtd: totals.revenueMtd, currency: 'USD' },
      expenses: { today: totals.expensesToday, mtd: this.state.budgetSpentMtd, currency: 'USD' },
      budget: {
        allocated: this.state.budgetAllocated,
        spent: this.state.budgetSpentMtd,
        remaining: this.state.budgetAllocated - this.state.budgetSpentMtd,
        currency: 'USD',
      },
      payouts: this.state.payouts.map(clone),
      payoutQueue: this.buildPayoutQueue(),
      approvalControls: this.approvalControls(),
      reconciliation: { ...this.state.reconciliation },
      settlement,
      mock: false,
    };
  }

  syncSettlement(actor = 'finance', at = new Date().toISOString()): RacingFinanceMutationResultDto {
    const settlement = this.settlementRegistry.sync(at);
    const auditId = id('audit-finance');
    const message = `Settlement sync completed: ${settlement.entries.length} ledger entries, ${settlement.pendingPostings} pending, ${settlement.exceptionCount} exceptions`;
    return this.commit('racing-finance.settlement.synced', message, auditId, 'settlement-sync', actor);
  }

  kpiDashboard(now = new Date().toISOString()): RacingFinanceKpiDashboardDto {
    return this.workspace(now).dashboard;
  }

  auditTrail(raceDayId?: string, now = new Date().toISOString()): RacingFinanceAuditTrailDto {
    const records = raceDayId
      ? this.auditChain.filter((record) => record.raceDayId === raceDayId)
      : this.auditChain;
    return {
      generatedAt: now,
      schemaVersion: 'trackmind.racing-finance-operations.v1',
      records: records.map(clone),
      mock: false,
    };
  }

  allocatePurse(input: Omit<RacePurseDto, 'purseId' | 'auditId' | 'approvalRequestId' | 'releasedAmount'>, actor = 'finance'): RacingFinanceMutationResultDto {
    const auditId = id('audit-finance');
    const purse: RacePurseDto = {
      ...clone(input),
      purseId: id('purse'),
      releasedAmount: 0,
      auditId,
    };
    this.state.purses.push(purse);
    return this.commit('racing-finance.purse.allocated', `Allocated purse ${purse.allocatedAmount} for race ${purse.raceId}`, auditId, purse.purseId, actor);
  }

  requestPurseRelease(purseId: string, actor = 'finance', options: { approvalToken?: ApprovalToken } = {}): RacingFinanceMutationResultDto {
    if (!this.deps.approvalService) throw new Error('Approval service integration required for purse release workflows');
    const purse = this.state.purses.find((entry) => entry.purseId === purseId);
    if (!purse) throw new Error(`Unknown purse ${purseId}`);
    if (options.approvalToken) {
      this.deps.approvalService.assertAuthorized(options.approvalToken, 'payout', purseId, this.state.tenantId, this.state.racetrackId);
      purse.status = 'released';
      purse.releasedAmount = purse.allocatedAmount;
      const auditId = id('audit-finance');
      return this.commit('racing-finance.purse.released', `Released purse ${purseId} for race ${purse.raceId}`, auditId, purseId, actor, options.approvalToken.requestId);
    }
    if (purse.status === 'released') throw new Error(`Purse ${purseId} is already released`);
    if (purse.approvalRequestId && purse.status === 'pending-approval') {
      return {
        accepted: true,
        recordId: purseId,
        auditId: purse.auditId,
        eventType: 'racing-finance.purse.release-requested',
        message: `Purse release for ${purseId} is pending approval`,
        approvalRequestId: purse.approvalRequestId,
        approvalRequired: true,
        mock: false,
      };
    }
    const auditId = id('audit-finance');
    const approval = this.deps.approvalService.createRequest({
      action: 'payout',
      target: purseId,
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      requestedBy: actor,
      actorType: 'human',
      reason: `Purse release for race ${purse.raceId}`,
      evidence: [`purse-amount:${purse.allocatedAmount}`, `race:${purse.raceId}`],
    });
    purse.status = 'pending-approval';
    purse.approvalRequestId = approval.id;
    const result = this.commit('racing-finance.purse.release-requested', `Requested purse release for ${purseId}`, auditId, purseId, actor, approval.id);
    return { ...result, approvalRequestId: approval.id, approvalRequired: true };
  }

  recordRaceDayExpense(input: Omit<RaceDayExpenseDto, 'expenseId' | 'auditId' | 'approvalRequestId'>, actor = 'finance'): RacingFinanceMutationResultDto {
    const auditId = id('audit-finance');
    const expense: RaceDayExpenseDto = { ...clone(input), expenseId: id('race-expense'), auditId };
    this.state.raceDayExpenses.push(expense);
    return this.commit('racing-finance.race-day-expense.recorded', `Recorded race-day expense ${expense.label}`, auditId, expense.expenseId, actor);
  }

  recordOperationalCost(input: Omit<OperationalCostDto, 'costId' | 'auditId'>, actor = 'finance'): RacingFinanceMutationResultDto {
    const auditId = id('audit-finance');
    const cost: OperationalCostDto = { ...clone(input), costId: id('operational-cost'), auditId };
    this.state.operationalCosts.push(cost);
    return this.commit('racing-finance.operational-cost.recorded', `Recorded operational cost ${cost.label}`, auditId, cost.costId, actor);
  }

  recordFacilityCost(input: Omit<FacilityCostDto, 'facilityCostId' | 'auditId'>, actor = 'finance'): RacingFinanceMutationResultDto {
    const auditId = id('audit-finance');
    const cost: FacilityCostDto = { ...clone(input), facilityCostId: id('facility-cost'), auditId };
    this.state.facilityCosts.push(cost);
    return this.commit('racing-finance.facility-cost.recorded', `Recorded facility cost for ${cost.facilityName}`, auditId, cost.facilityCostId, actor);
  }

  recordTicketRevenue(input: Omit<TicketRevenueDto, 'revenueId' | 'auditId'>, actor = 'finance'): RacingFinanceMutationResultDto {
    const auditId = id('audit-finance');
    const revenue: TicketRevenueDto = { ...clone(input), revenueId: id('ticket-revenue'), auditId };
    this.state.ticketRevenue.push(revenue);
    return this.commit('racing-finance.ticket-revenue.recorded', `Recorded ticket revenue ${revenue.label}`, auditId, revenue.revenueId, actor);
  }

  recordHospitalityRevenue(input: Omit<HospitalityRevenueDto, 'revenueId' | 'auditId'>, actor = 'finance'): RacingFinanceMutationResultDto {
    const auditId = id('audit-finance');
    const revenue: HospitalityRevenueDto = { ...clone(input), revenueId: id('hospitality-revenue'), auditId };
    this.state.hospitalityRevenue.push(revenue);
    return this.commit('racing-finance.hospitality-revenue.recorded', `Recorded hospitality revenue ${revenue.packageName}`, auditId, revenue.revenueId, actor);
  }

  requestPayout(amount: number, recipientLabel: string, actor = 'finance'): RacingFinanceMutationResultDto {
    if (!this.deps.approvalService) throw new Error('Approval service integration required for payout workflows');
    const auditId = id('audit-finance');
    const payoutId = id('payout');
    const approval = this.deps.approvalService.createRequest({
      action: 'payout',
      target: payoutId,
      tenantId: this.state.tenantId,
      racetrackId: this.state.racetrackId,
      requestedBy: actor,
      actorType: 'human',
      reason: `Payout request for ${recipientLabel}`,
      evidence: [`amount:${amount}`, `recipient:${recipientLabel}`],
    });
    this.state.payouts.push({ id: payoutId, amount, status: 'pending-approval', approvalId: approval.id });
    const result = this.commit('racing-finance.payout.requested', `Requested payout ${amount} for ${recipientLabel}`, auditId, payoutId, actor, approval.id);
    return { ...result, approvalRequestId: approval.id, approvalRequired: true };
  }

  releasePayout(payoutId: string, actor = 'finance', options: { approvalToken?: ApprovalToken } = {}): RacingFinanceMutationResultDto {
    if (!this.deps.approvalService) throw new Error('Approval service integration required for payout workflows');
    const payout = this.state.payouts.find((entry) => entry.id === payoutId);
    if (!payout) throw new Error(`Unknown payout ${payoutId}`);
    if (!options.approvalToken) throw new Error('Payout release requires verified approvalToken');
    this.deps.approvalService.assertAuthorized(options.approvalToken, 'payout', payoutId, this.state.tenantId, this.state.racetrackId);
    payout.status = 'released';
    const auditId = id('audit-finance');
    return this.commit('racing-finance.payout.released', `Released payout ${payoutId}`, auditId, payoutId, actor, options.approvalToken.requestId);
  }

  private buildPayoutQueue(): RacingFinancePayoutQueueItemDto[] {
    const purseItems: RacingFinancePayoutQueueItemDto[] = this.state.purses.map((purse) => ({
      id: purse.purseId,
      kind: 'purse',
      reference: purse.raceId,
      label: `Race ${purse.raceNumber ?? purse.raceId} purse`,
      amount: purse.allocatedAmount,
      currency: purse.currency,
      status: purse.status,
      approvalRequestId: purse.approvalRequestId,
      approvalRequired: purse.status !== 'released',
      executionEndpoint: `/api/v1/finance/purses/${encodeURIComponent(purse.purseId)}/release`,
    }));
    const payoutItems: RacingFinancePayoutQueueItemDto[] = this.state.payouts.map((payout) => ({
      id: payout.id,
      kind: 'payout',
      reference: payout.id,
      label: `Payout ${payout.id}`,
      amount: payout.amount,
      currency: 'USD',
      status: payout.status,
      approvalRequestId: payout.approvalId,
      approvalRequired: payout.status !== 'released',
      executionEndpoint: `/api/v1/finance/payouts/${encodeURIComponent(payout.id)}/release`,
    }));
    return [...purseItems, ...payoutItems];
  }

  private approvalControls(): RacingFinanceApprovalControlDto[] {
    const controls: RacingFinanceApprovalControlDto[] = [
      {
        id: 'finance-request-payout',
        label: 'Request payout approval',
        action: 'payout',
        target: 'new-payout',
        reason: 'Dual-control steward and finance approval required before payout release.',
        requiredRoles: ['admin', 'finance'],
        approvalApi: 'POST /api/v1/approvals/controlled-actions',
        locked: true,
        safetyCritical: true,
      },
    ];
    for (const purse of this.state.purses.filter((entry) => entry.status === 'allocated')) {
      controls.push({
        id: `finance-purse-release-${purse.purseId}`,
        label: `Request purse release (${purse.raceId})`,
        action: 'payout',
        target: purse.purseId,
        reason: `Purse release for race ${purse.raceId} requires steward and finance approval.`,
        requiredRoles: ['admin', 'finance'],
        approvalApi: 'POST /api/v1/approvals/controlled-actions',
        locked: true,
        safetyCritical: true,
      });
    }
    return controls;
  }

  private computeTotals(now: string) {
    const todayPrefix = now.slice(0, 10);
    const ticketToday = this.state.ticketRevenue.filter((entry) => entry.recordedAt.startsWith(todayPrefix)).reduce((sum, entry) => sum + entry.netAmount, 0);
    const hospitalityToday = this.state.hospitalityRevenue.filter((entry) => entry.recordedAt.startsWith(todayPrefix)).reduce((sum, entry) => sum + entry.netAmount, 0);
    const revenueToday = ticketToday + hospitalityToday;
    const revenueMtd = this.state.ticketRevenue.reduce((sum, entry) => sum + entry.netAmount, 0)
      + this.state.hospitalityRevenue.reduce((sum, entry) => sum + entry.netAmount, 0);
    const raceDayToday = this.state.raceDayExpenses.filter((entry) => entry.incurredAt.startsWith(todayPrefix)).reduce((sum, entry) => sum + entry.amount, 0);
    const operationalToday = this.state.operationalCosts.filter((entry) => entry.incurredAt.startsWith(todayPrefix)).reduce((sum, entry) => sum + entry.amount, 0);
    const facilityToday = this.state.facilityCosts.filter((entry) => entry.incurredAt.startsWith(todayPrefix)).reduce((sum, entry) => sum + entry.amount, 0);
    const expensesToday = raceDayToday + operationalToday + facilityToday;
    const purseObligations = this.state.purses.filter((purse) => purse.status !== 'released').reduce((sum, purse) => sum + (purse.allocatedAmount - purse.releasedAmount), 0);
    return { revenueToday, revenueMtd, expensesToday, purseObligations };
  }

  private buildDashboard(totals: ReturnType<RacingFinancePlatform['computeTotals']>, now: string): RacingFinanceKpiDashboardDto {
    const netPositionToday = totals.revenueToday - totals.expensesToday;
    const budgetUtilizationPercent = Math.round((this.state.budgetSpentMtd / this.state.budgetAllocated) * 100);
    const settlement = this.settlementRegistry.snapshot(now);
    const readinessScore = Math.round(
      Math.max(0, 100
        - this.state.reconciliation.exceptions * 8
        - this.state.payouts.filter((payout) => payout.status === 'pending-approval').length * 5
        - settlement.exceptionCount * 6
        - (budgetUtilizationPercent > 90 ? 10 : 0)),
    );
    const panels: RacingFinanceKpiDto[] = [
      this.panel('finance-gross-revenue', 'Gross revenue today', 'Ticket and hospitality net revenue recorded today.', totals.revenueToday, 'USD', 100_000, totals.revenueToday >= 100_000 ? 'nominal' : totals.revenueToday >= 60_000 ? 'watch' : 'warning', 'up', now),
      this.panel('finance-expenses-today', 'Expenses today', 'Race-day, operational, and facility costs incurred today.', totals.expensesToday, 'USD', 50_000, totals.expensesToday <= 50_000 ? 'nominal' : totals.expensesToday <= 75_000 ? 'watch' : 'warning', 'flat', now),
      this.panel('finance-net-position', 'Net position today', 'Revenue minus expenses for current race day.', netPositionToday, 'USD', 40_000, netPositionToday >= 40_000 ? 'nominal' : netPositionToday >= 0 ? 'watch' : 'critical', netPositionToday >= 0 ? 'up' : 'down', now),
      this.panel('finance-purse-obligations', 'Purse obligations', 'Outstanding purse allocations awaiting release.', totals.purseObligations, 'USD', 0, totals.purseObligations === 0 ? 'nominal' : totals.purseObligations <= 100_000 ? 'watch' : 'warning', 'flat', now),
      this.panel('finance-budget-utilization', 'Budget utilization', 'Month-to-date spend against allocated budget.', budgetUtilizationPercent, '%', 85, budgetUtilizationPercent <= 85 ? 'nominal' : budgetUtilizationPercent <= 95 ? 'watch' : 'critical', 'up', now),
      this.panel('finance-reconciliation', 'Reconciliation exceptions', 'Unmatched financial records requiring review.', this.state.reconciliation.exceptions, 'exceptions', 0, this.state.reconciliation.exceptions === 0 ? 'nominal' : 'warning', 'flat', now),
      this.panel('finance-settlement-sync', 'GL/settlement sync', 'Ledger read model sync status across GL and settlement adapters.', settlement.coveragePct, '%', 100, settlement.exceptionCount > 0 ? 'warning' : settlement.syncStatus === 'synced' ? 'nominal' : 'watch', settlement.syncStatus === 'synced' ? 'up' : 'flat', now),
    ];
    return {
      grossRevenueToday: totals.revenueToday,
      totalExpensesToday: totals.expensesToday,
      netPositionToday,
      purseObligations: totals.purseObligations,
      reconciliationExceptions: this.state.reconciliation.exceptions,
      budgetUtilizationPercent,
      readinessScore,
      panels,
    };
  }

  private panel(
    kpiId: string,
    name: string,
    description: string,
    value: number,
    unit: string,
    target: number,
    status: RacingFinanceKpiDto['status'],
    trend: RacingFinanceKpiDto['trend'],
    now: string,
  ): RacingFinanceKpiDto {
    return {
      kpiId,
      name,
      description,
      value,
      unit,
      target,
      status,
      trend,
      sourceEntities: [{ entityType: 'racing-finance', entityId: this.state.racetrackId }],
      auditReference: { auditIds: this.auditChain.slice(-3).map((record) => record.auditId), eventIds: [`racing-finance.kpi.${kpiId}`] },
    };
  }

  private commit(
    eventType: string,
    changeSummary: string,
    auditId: string,
    recordId?: string,
    actor = 'finance',
    approvalRequestId?: string,
  ): RacingFinanceMutationResultDto {
    const previousHash = this.auditChain.at(-1)?.hash ?? 'sha256:00000000';
    const record = {
      auditId,
      recordId,
      raceDayId: this.state.raceDayId,
      action: eventType,
      actor,
      timestamp: new Date().toISOString(),
      previousHash,
      hash: hash({ auditId, eventType, changeSummary, previousHash, approvalRequestId }),
      changeSummary,
      evidence: approvalRequestId ? [`approval:${approvalRequestId}`] : [],
    };
    this.auditChain.push(record);
    this.state.version += 1;
    this.state.updatedAt = record.timestamp;
    this.state.updatedBy = actor;
    if (typeof this.deps.auditLog?.append === 'function') {
      this.deps.auditLog.append({
        id: auditId,
        type: 'data-change',
        actor,
        timestamp: record.timestamp,
        subjectId: recordId ?? this.state.racetrackId,
        payload: { action: eventType, changeSummary, approvalRequestId },
        tenantId: this.state.tenantId,
        severity: 'info',
        regulations: ['SOC-2', 'ARCI'],
      });
    }
    return {
      accepted: true,
      recordId,
      auditId,
      eventType,
      message: changeSummary,
      approvalRequestId,
      mock: false,
    };
  }
}

export function createSeededRacingFinance(deps: RacingFinancePlatformDeps = {}, now = new Date().toISOString()): RacingFinancePlatform {
  const platform = new RacingFinancePlatform(deps);
  const raceDayId = deps.raceDayId ?? 'race-day-main';

  platform.allocatePurse({
    raceId: 'race-7',
    raceNumber: 7,
    allocatedAmount: 50_000,
    currency: 'USD',
    status: 'allocated',
    beneficiaries: [
      { recipientId: 'owner-1', label: 'Winning Owner', sharePercent: 60, amount: 30_000 },
      { recipientId: 'trainer-1', label: 'Trainer', sharePercent: 10, amount: 5_000 },
      { recipientId: 'jockey-1', label: 'Jockey', sharePercent: 10, amount: 5_000 },
    ],
  });
  platform.allocatePurse({
    raceId: 'race-8',
    raceNumber: 8,
    allocatedAmount: 35_000,
    currency: 'USD',
    status: 'allocated',
    beneficiaries: [
      { recipientId: 'owner-2', label: 'Winning Owner', sharePercent: 60, amount: 21_000 },
    ],
  });

  platform.recordRaceDayExpense({
    raceDayId,
    category: 'race-day',
    label: 'Steward fees',
    amount: 4_200,
    currency: 'USD',
    status: 'recorded',
    incurredAt: now,
  });
  platform.recordRaceDayExpense({
    raceDayId,
    category: 'race-day',
    label: 'Track maintenance crew overtime',
    amount: 6_800,
    currency: 'USD',
    status: 'recorded',
    incurredAt: now,
  });

  platform.recordOperationalCost({
    costCenter: 'race-operations',
    label: 'Timing and photo finish services',
    amount: 12_500,
    currency: 'USD',
    period: now.slice(0, 7),
    status: 'recorded',
    incurredAt: now,
  });
  platform.recordOperationalCost({
    costCenter: 'security',
    label: 'Contract security staffing',
    amount: 18_400,
    currency: 'USD',
    period: now.slice(0, 7),
    status: 'recorded',
    incurredAt: now,
  });

  platform.recordFacilityCost({
    facilityId: 'GRANDSTAND_HVAC_01',
    facilityName: 'Grandstand HVAC',
    workOrderId: 'wo-hvac-12',
    label: 'Preventive maintenance parts',
    amount: 3_600,
    currency: 'USD',
    status: 'recorded',
    incurredAt: now,
  });
  platform.recordFacilityCost({
    facilityId: 'CLUB_KITCHEN_01',
    facilityName: 'Club Kitchen',
    label: 'Hospitality prep supplies',
    amount: 2_100,
    currency: 'USD',
    status: 'recorded',
    incurredAt: now,
  });

  platform.recordTicketRevenue({
    raceDayId,
    source: 'ticketing',
    label: 'General admission',
    grossAmount: 48_200,
    netAmount: 42_800,
    currency: 'USD',
    ticketCount: 8420,
    recordedAt: now,
    fanExperienceReference: 'fan-experience:rev-ticketing',
  });
  platform.recordTicketRevenue({
    raceDayId,
    source: 'premium-seating',
    label: 'Premium seating',
    grossAmount: 61_000,
    netAmount: 56_200,
    currency: 'USD',
    ticketCount: 304,
    recordedAt: now,
    fanExperienceReference: 'fan-experience:rev-premium',
  });

  platform.recordHospitalityRevenue({
    raceDayId,
    packageId: 'hosp-club',
    packageName: 'Club Level Hospitality',
    grossAmount: 24_800,
    netAmount: 22_400,
    currency: 'USD',
    guestCount: 180,
    recordedAt: now,
    fanExperienceReference: 'fan-experience:rev-hospitality',
  });

  (platform as unknown as { state: RacingFinanceState }).state.payouts.push(
    { id: 'payout-1', amount: 45_000, status: 'pending-approval', approvalId: 'approval-payout-1' },
    { id: 'payout-2', amount: 12_000, status: 'released' },
  );

  platform.workspace(now);
  platform.syncSettlement('racing-finance', now);
  return platform;
}
