import type { CustomerSuccessPlanDto, TenantScopeContext } from '@trackmind/shared';
import {
  assertTenantScope,
  computeAdoptionScore,
  computeHealthBand,
  computeHealthScore,
} from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';
import type { CommercializationServices } from './commercializationController.js';
import type { CustomerManagementService } from './customerManagementService.js';
import type { CustomerOnboardingWorkflowService } from './customerOnboardingWorkflowService.js';

const now = () => new Date().toISOString();

const seedSuccessPlans = (): CustomerSuccessPlanDto[] => [
  {
    id: 'success-plan-demo',
    organizationId: 'org-trackmind-network',
    customerId: 'cust-trackmind-demo',
    tenantId: 'trackmind',
    successManagerId: 'csm-alex-morgan',
    successManagerName: 'Alex Morgan',
    objectives: ['Increase race-day module adoption', 'Complete Digital Twin onboarding', 'Quarterly executive review'],
    nextReviewAt: '2026-07-01T00:00:00.000Z',
    healthScore: 86,
    healthBand: 'healthy',
    adoptionScore: 78,
    riskFactors: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

export class CustomerSuccessService {
  readonly successPlans: KeyValueRepository<CustomerSuccessPlanDto>;

  constructor(
    private readonly customers: CustomerManagementService,
    private readonly workflows: CustomerOnboardingWorkflowService,
    private readonly commercialization?: CommercializationServices,
  ) {
    this.successPlans = createRepository(seedSuccessPlans());
  }

  listSuccessPlans(scope: TenantScopeContext): CustomerSuccessPlanDto[] {
    assertTenantScope(scope);
    return this.successPlans.list().filter((p) => {
      if (p.organizationId !== scope.organizationId) return false;
      if (scope.tenantId && p.tenantId && p.tenantId !== scope.tenantId) return false;
      return true;
    });
  }

  assignSuccessManager(
    scope: TenantScopeContext,
    input: { customerId: string; successManagerId: string; successManagerName: string; objectives?: string[] },
  ): CustomerSuccessPlanDto {
    assertTenantScope(scope);
    const customer = this.customers.getCustomer(input.customerId, scope);
    if (!customer) throw new Error(`customer_not_found:${input.customerId}`);
    const metrics = this.computeMetrics(customer.id, scope);
    const ts = now();
    const existing = this.successPlans.list().find((p) => p.customerId === input.customerId);
    const record: CustomerSuccessPlanDto = {
      id: existing?.id ?? `success-${Date.now().toString(36)}`,
      organizationId: scope.organizationId,
      customerId: input.customerId,
      tenantId: customer.tenantId,
      successManagerId: input.successManagerId,
      successManagerName: input.successManagerName,
      objectives: input.objectives ?? ['Drive platform adoption', 'Ensure onboarding completion'],
      nextReviewAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      healthScore: metrics.healthScore,
      healthBand: metrics.healthBand,
      adoptionScore: metrics.adoptionScore,
      riskFactors: metrics.riskFactors,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
      mock: false,
    };
    this.customers.customers.upsert({
      ...customer,
      successManagerId: input.successManagerId,
      lifecycleStatus: customer.lifecycleStatus === 'prospect' ? 'onboarding' : customer.lifecycleStatus,
      updatedAt: ts,
    });
    return this.successPlans.upsert(record);
  }

  computeMetrics(customerId: string, scope: TenantScopeContext) {
    const customer = this.customers.getCustomer(customerId, scope);
    if (!customer) throw new Error(`customer_not_found:${customerId}`);
    const tenantId = customer.tenantId ?? scope.tenantId ?? 'trackmind';
    const subscription = this.commercialization?.subscriptions.resolveForScope(scope.organizationId, tenantId);
    const subscriptionActive = subscription?.status === 'active' || subscription?.status === 'trialing';
    const entitlement = this.commercialization?.entitlements.evaluate(scope.organizationId, tenantId);
    const modulesEnabled = entitlement?.modules.filter((m) => m.enabled).length ?? 0;
    const modulesTotal = entitlement?.modules.length ?? 1;
    const apiLimit = entitlement?.limits.apiCallsPerMonth ?? 1;
    const apiUsed = entitlement?.usage.apiCallsPerMonth?.used ?? 0;
    const apiUsagePercent = Math.round((apiUsed / apiLimit) * 100);
    const adoptionScore = computeAdoptionScore(modulesEnabled, modulesTotal, apiUsagePercent);
    const customerWorkflows = this.workflows.listWorkflows(scope, customerId);
    const onboardingProgressPercent = customerWorkflows.length
      ? Math.round(customerWorkflows.reduce((acc, w) => acc + this.workflows.progress(w), 0) / customerWorkflows.length)
      : 100;
    const contracts = this.customers.listContracts(scope, customerId).filter((c) => c.status === 'active');
    const contractDaysRemaining = contracts.length
      ? Math.max(0, Math.ceil((new Date(contracts[0].expirationDate).getTime() - Date.now()) / 86_400_000))
      : 0;
    const riskFactors: string[] = [];
    if (!subscriptionActive) riskFactors.push('subscription_inactive');
    if (adoptionScore < 50) riskFactors.push('low_adoption');
    if (onboardingProgressPercent < 100) riskFactors.push('onboarding_incomplete');
    if (contractDaysRemaining > 0 && contractDaysRemaining < 60) riskFactors.push('contract_renewal_soon');
    const healthScore = computeHealthScore({
      subscriptionActive,
      adoptionScore,
      onboardingProgressPercent,
      contractDaysRemaining,
      openRisks: riskFactors.length,
    });
    return {
      healthScore,
      healthBand: computeHealthBand(healthScore),
      adoptionScore,
      riskFactors,
      subscriptionActive,
      modulesEnabled,
      modulesTotal,
      onboardingProgressPercent,
      contractDaysRemaining,
      apiUsagePercent,
      workspacesEntitled: entitlement?.workspaces.length ?? 0,
      workspacesActive: entitlement?.workspaces.length ?? 0,
      racetracksLive: this.customers.listPortfolios(scope, customerId).reduce((n, p) => n + p.racetrackIds.length, 0),
    };
  }

  refreshHealthScores(scope: TenantScopeContext): CustomerSuccessPlanDto[] {
    return this.listSuccessPlans(scope).map((plan) => {
      const metrics = this.computeMetrics(plan.customerId, scope);
      return this.successPlans.upsert({
        ...plan,
        healthScore: metrics.healthScore,
        healthBand: metrics.healthBand,
        adoptionScore: metrics.adoptionScore,
        riskFactors: metrics.riskFactors,
        updatedAt: now(),
      });
    });
  }
}
