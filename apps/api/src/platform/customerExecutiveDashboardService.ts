import type {
  CustomerExecutiveDashboardDto,
  CustomerHealthSummaryDto,
  HealthBand,
  TenantScopeContext,
} from '@trackmind/shared';
import { customerManagementSchemaVersion } from '@trackmind/shared';
import type { CustomerConfigRegistry } from './customerConfigRegistry.js';
import type { CustomerManagementService } from './customerManagementService.js';
import type { CustomerOnboardingWorkflowService } from './customerOnboardingWorkflowService.js';
import type { CustomerSuccessService } from './customerSuccessService.js';

const now = () => new Date().toISOString();

export class CustomerExecutiveDashboardService {
  constructor(
    private readonly customers: CustomerManagementService,
    private readonly success: CustomerSuccessService,
    private readonly workflows: CustomerOnboardingWorkflowService,
    private readonly config: CustomerConfigRegistry,
  ) {}

  build(scope: TenantScopeContext): CustomerExecutiveDashboardDto {
    const customerList = this.customers.listCustomers(scope);
    const healthSummaries: CustomerHealthSummaryDto[] = customerList.map((customer) => {
      const metrics = this.success.computeMetrics(customer.id, scope);
      return {
        customerId: customer.id,
        organizationId: customer.organizationId,
        displayName: customer.displayName,
        lifecycleStatus: customer.lifecycleStatus,
        supportTierId: customer.supportTierId,
        health: {
          healthScore: metrics.healthScore,
          healthBand: metrics.healthBand,
          adoptionScore: metrics.adoptionScore,
          subscriptionActive: metrics.subscriptionActive,
          modulesEnabled: metrics.modulesEnabled,
          modulesTotal: metrics.modulesTotal,
          onboardingProgressPercent: metrics.onboardingProgressPercent,
          openRisks: metrics.riskFactors.length,
          contractDaysRemaining: metrics.contractDaysRemaining,
        },
        adoption: {
          workspacesActive: metrics.workspacesActive,
          workspacesEntitled: metrics.workspacesEntitled,
          apiUsagePercent: metrics.apiUsagePercent,
          racetracksLive: metrics.racetracksLive,
          racetracksEntitled: metrics.racetracksLive,
          lastActivityAt: now(),
        },
        generatedAt: now(),
        mock: false,
      };
    });

    const healthDistribution: Array<{ band: HealthBand; count: number }> = [
      'healthy', 'watch', 'at-risk', 'critical',
    ].map((band) => ({
      band: band as HealthBand,
      count: healthSummaries.filter((h) => h.health.healthBand === band).length,
    }));

    const portfolios = this.customers.listPortfolios(scope);
    const allWorkflows = this.workflows.listWorkflows(scope);

    return {
      generatedAt: now(),
      schemaVersion: customerManagementSchemaVersion,
      organizationId: scope.organizationId,
      portfolioSummary: {
        totalCustomers: customerList.length,
        activeCustomers: customerList.filter((c) => c.lifecycleStatus === 'active').length,
        onboardingCustomers: customerList.filter((c) => c.lifecycleStatus === 'onboarding').length,
        atRiskCustomers: customerList.filter((c) => c.lifecycleStatus === 'at-risk').length,
        totalRacetracks: portfolios.reduce((n, p) => n + p.racetrackIds.length, 0),
        operationalRacetracks: portfolios.filter((p) => p.operationalStatus === 'operational').reduce((n, p) => n + p.racetrackIds.length, 0),
      },
      healthDistribution,
      adoptionOverview: {
        averageAdoptionScore: healthSummaries.length
          ? Math.round(healthSummaries.reduce((a, h) => a + h.health.adoptionScore, 0) / healthSummaries.length)
          : 0,
        averageHealthScore: healthSummaries.length
          ? Math.round(healthSummaries.reduce((a, h) => a + h.health.healthScore, 0) / healthSummaries.length)
          : 0,
        modulesAdoptedPercent: healthSummaries.length
          ? Math.round(
            healthSummaries.reduce((a, h) => a + (h.health.modulesEnabled / Math.max(h.health.modulesTotal, 1)) * 100, 0)
            / healthSummaries.length,
          )
          : 0,
      },
      customers: healthSummaries,
      recentOnboarding: allWorkflows
        .filter((w) => w.status !== 'completed')
        .map((w) => ({
          customerId: w.customerId,
          workflowId: w.id,
          status: w.status,
          progressPercent: this.workflows.progress(w),
        })),
      supportTierBreakdown: this.config.supportTiers.map((tier) => ({
        tierId: tier.id,
        tierName: tier.name,
        customerCount: customerList.filter((c) => c.supportTierId === tier.id).length,
      })),
      tenantIsolation: {
        mode: 'strict',
        crossTenantAccessAllowed: false,
        scopedOrganizationId: scope.organizationId,
      },
      mock: false,
    };
  }
}
