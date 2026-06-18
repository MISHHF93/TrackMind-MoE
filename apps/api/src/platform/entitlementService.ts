import {
  checkApiContractEntitlement,
  checkFeatureEntitlement,
  enforcePlanLimits,
  evaluateModuleLicensing,
  isSubscriptionActive,
  type EntitlementCheckResult,
  type EntitlementEvaluation,
  type PlanLimits,
  type PlanRegistry,
  type SubscriptionStatus,
} from '@trackmind/shared';
import type { PlanRegistryService } from './planRegistry.js';
import type { SubscriptionService } from './subscriptionService.js';
import type { UsageTrackingService } from './usageTrackingService.js';

const now = () => new Date().toISOString();

export class EntitlementService {
  constructor(
    private readonly registry: PlanRegistryService,
    private readonly subscriptions: SubscriptionService,
    private readonly usage: UsageTrackingService,
  ) {}

  private resolveSubscription(organizationId: string, tenantId?: string) {
    return this.subscriptions.resolveForScope(organizationId, tenantId);
  }

  evaluate(organizationId: string, tenantId: string): EntitlementEvaluation {
    const registry = this.registry.get();
    const subscription = this.resolveSubscription(organizationId, tenantId);
    const planId = subscription?.planId ?? 'plan-starter-monthly';
    const status = subscription?.status ?? 'expired';
    const plan = this.registry.getPlan(planId);
    const limits = plan?.limits ?? { racetracks: 0, tenants: 0, users: 0, apiCallsPerMonth: 0 };
    const usageSummary = this.usage.summarize(organizationId, tenantId);
    const limitCheck = enforcePlanLimits(limits, usageSummary);
    const modules = evaluateModuleLicensing(registry, planId, status);
    const entitled = isSubscriptionActive(status) && limitCheck.withinLimits;

    return {
      organizationId,
      tenantId,
      planId,
      subscriptionStatus: status,
      entitled,
      modules,
      features: plan?.entitlements.features ?? [],
      workspaces: plan?.entitlements.workspaces ?? [],
      apiContracts: plan?.entitlements.apiContracts ?? [],
      limits,
      usage: {
        racetracks: { used: usageSummary.racetracks, limit: limits.racetracks, withinLimit: usageSummary.racetracks <= limits.racetracks },
        tenants: { used: usageSummary.tenants, limit: limits.tenants, withinLimit: usageSummary.tenants <= limits.tenants },
        users: { used: usageSummary.users, limit: limits.users, withinLimit: usageSummary.users <= limits.users },
        apiCallsPerMonth: {
          used: usageSummary.apiCallsPerMonth,
          limit: limits.apiCallsPerMonth,
          withinLimit: usageSummary.apiCallsPerMonth <= limits.apiCallsPerMonth,
        },
      },
      enforcement: {
        blocked: !entitled,
        reasons: [
          ...(!isSubscriptionActive(status) ? ['subscription_inactive'] : []),
          ...limitCheck.violations,
        ],
      },
      generatedAt: now(),
      mock: false,
    };
  }

  checkFeature(organizationId: string, tenantId: string, featureId: string): EntitlementCheckResult {
    const subscription = this.resolveSubscription(organizationId, tenantId);
    const planId = subscription?.planId ?? 'plan-starter-monthly';
    const status = subscription?.status ?? 'expired';
    return checkFeatureEntitlement(this.registry.get(), planId, status, featureId);
  }

  checkApi(organizationId: string, tenantId: string, apiPath: string): EntitlementCheckResult {
    const subscription = this.resolveSubscription(organizationId, tenantId);
    const planId = subscription?.planId ?? 'plan-starter-monthly';
    const status = subscription?.status ?? 'expired';
    return checkApiContractEntitlement(this.registry.get(), planId, status, apiPath);
  }

  isModuleEnabled(organizationId: string, tenantId: string, moduleKey: string): boolean {
    const evaluation = this.evaluate(organizationId, tenantId);
    return evaluation.modules.find((m) => m.key === moduleKey)?.enabled ?? false;
  }

  enforceOrThrow(organizationId: string, tenantId: string, apiPath: string): void {
    const check = this.checkApi(organizationId, tenantId, apiPath);
    if (!check.allowed) {
      throw new PlanEnforcementError(check.reason ?? 'plan_enforcement_failed', check);
    }
  }
}

export class PlanEnforcementError extends Error {
  readonly code: string;
  readonly check: EntitlementCheckResult;

  constructor(code: string, check: EntitlementCheckResult) {
    super(code);
    this.code = code;
    this.check = check;
  }
}

export function mergeEntitlements(registry: PlanRegistry, planId: string, status: SubscriptionStatus): PlanLimits | undefined {
  if (!isSubscriptionActive(status)) return undefined;
  return registry.plans.find((p) => p.id === planId)?.limits;
}
