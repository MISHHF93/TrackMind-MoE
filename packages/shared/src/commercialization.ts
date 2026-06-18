import type { TrackMindCloudTierId } from './saasModel.js';

export const commercializationSchemaVersion = 'trackmind.commercialization.v1' as const;

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'expired';

export type BillingInterval = 'monthly' | 'annual';

export interface PlanEntitlements {
  modules: string[];
  features: string[];
  workspaces: string[];
  apiContracts: string[];
}

export interface PlanLimits {
  racetracks: number;
  tenants: number;
  users: number;
  apiCallsPerMonth: number;
}

export interface SubscriptionPlanDefinition {
  id: string;
  tierId: TrackMindCloudTierId;
  name: string;
  summary: string;
  billingInterval: BillingInterval;
  priceUsd: number;
  currency: string;
  visible: boolean;
  entitlements: PlanEntitlements;
  limits: PlanLimits;
}

export interface SaasPlansConfig {
  schemaVersion: 'trackmind.saas-plans.v1';
  plans: SubscriptionPlanDefinition[];
}

export interface LicensedModuleDefinition {
  key: string;
  name: string;
  description: string;
  requiredEntitlements: string[];
  featureFlagKey: string;
  enforceable: boolean;
}

export interface SaasModulesConfig {
  schemaVersion: 'trackmind.saas-modules.v1';
  modules: LicensedModuleDefinition[];
}

export interface PlanRegistry {
  schemaVersion: typeof commercializationSchemaVersion;
  plans: SubscriptionPlanDefinition[];
  modules: LicensedModuleDefinition[];
  loadedAt: string;
  configPaths: { plans: string; modules: string };
}

export interface SubscriptionRecord {
  id: string;
  organizationId: string;
  tenantId?: string;
  planId: string;
  status: SubscriptionStatus;
  billingProviderRef?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface UsageMetricRecord {
  id: string;
  organizationId: string;
  tenantId: string;
  racetrackId?: string;
  metricKey: string;
  quantity: number;
  periodStart: string;
  periodEnd: string;
  recordedAt: string;
  mock: boolean;
}

export interface EntitlementEvaluation {
  organizationId: string;
  tenantId: string;
  planId: string;
  subscriptionStatus: SubscriptionStatus;
  entitled: boolean;
  modules: Array<{ key: string; enabled: boolean; reason?: string }>;
  features: string[];
  workspaces: string[];
  apiContracts: string[];
  limits: PlanLimits;
  usage: Partial<Record<keyof PlanLimits, { used: number; limit: number; withinLimit: boolean }>>;
  enforcement: { blocked: boolean; reasons: string[] };
  generatedAt: string;
  mock: boolean;
}

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
  planId?: string;
  subscriptionStatus?: SubscriptionStatus;
}

export interface OrganizationOnboardingRequest {
  organizationName: string;
  planId: string;
  adminEmail?: string;
  dataResidency?: string;
}

export interface TenantOnboardingRequest {
  organizationId: string;
  tenantName: string;
  planId?: string;
}

export interface RacetrackOnboardingRequest {
  organizationId: string;
  tenantId: string;
  racetrackName: string;
  jurisdiction: string;
  timezone?: string;
}

export interface OnboardingResultDto {
  organizationId: string;
  tenantId?: string;
  racetrackId?: string;
  subscriptionId: string;
  planId: string;
  status: SubscriptionStatus;
  createdAt: string;
  mock: boolean;
}

export interface CommercializationWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof commercializationSchemaVersion;
  planCount: number;
  moduleCount: number;
  subscriptions: SubscriptionRecord[];
  configPaths: { plans: string; modules: string };
  billingProvider: BillingProviderDescriptor;
  mock: boolean;
}

export interface BillingCheckoutSessionRequest {
  organizationId: string;
  planId: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface BillingCheckoutSessionResult {
  sessionId: string;
  provider: string;
  status: 'draft' | 'redirect-required';
  checkoutUrl?: string;
  expiresAt: string;
  mock: boolean;
}

export interface BillingProviderDescriptor {
  providerId: string;
  mode: 'abstract' | 'noop' | 'stripe' | 'azure-marketplace';
  paymentCollectionImplemented: boolean;
  webhookImplemented: boolean;
  summary: string;
}

export interface BillingProvider {
  descriptor: BillingProviderDescriptor;
  createCheckoutSession(input: BillingCheckoutSessionRequest & { subscriptionId: string }): BillingCheckoutSessionResult;
  syncSubscriptionStatus(externalRef: string): SubscriptionStatus;
}

export interface UsageRecordRequest {
  organizationId: string;
  tenantId: string;
  racetrackId?: string;
  metricKey: keyof PlanLimits | 'api_call';
  quantity?: number;
}

export function createPlanRegistryFromConfig(
  plansConfig: SaasPlansConfig,
  modulesConfig: SaasModulesConfig,
  configPaths: PlanRegistry['configPaths'],
  loadedAt = new Date().toISOString(),
): PlanRegistry {
  return {
    schemaVersion: commercializationSchemaVersion,
    plans: plansConfig.plans,
    modules: modulesConfig.modules,
    loadedAt,
    configPaths,
  };
}

export function validateSaasPlansConfig(config: SaasPlansConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (config.schemaVersion !== 'trackmind.saas-plans.v1') errors.push('plans config schemaVersion must be trackmind.saas-plans.v1');
  const ids = new Set<string>();
  for (const plan of config.plans) {
    if (!plan.id) errors.push('plan missing id');
    if (ids.has(plan.id)) errors.push(`duplicate plan id: ${plan.id}`);
    ids.add(plan.id);
    if (!plan.tierId) errors.push(`${plan.id} missing tierId`);
    if (!plan.entitlements?.modules?.length && !plan.entitlements?.features?.length) {
      errors.push(`${plan.id} must declare module or feature entitlements`);
    }
    for (const key of ['racetracks', 'tenants', 'users', 'apiCallsPerMonth'] as const) {
      if (typeof plan.limits?.[key] !== 'number' || plan.limits[key] < 0) errors.push(`${plan.id} invalid limit ${key}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateSaasModulesConfig(config: SaasModulesConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (config.schemaVersion !== 'trackmind.saas-modules.v1') errors.push('modules config schemaVersion must be trackmind.saas-modules.v1');
  const keys = new Set<string>();
  for (const mod of config.modules) {
    if (!mod.key) errors.push('module missing key');
    if (keys.has(mod.key)) errors.push(`duplicate module key: ${mod.key}`);
    keys.add(mod.key);
  }
  return { valid: errors.length === 0, errors };
}

export function validatePlanRegistry(registry: PlanRegistry): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (registry.schemaVersion !== commercializationSchemaVersion) errors.push('plan registry schemaVersion mismatch');
  if (registry.plans.length === 0) errors.push('plan registry must include at least one plan');
  const planIds = new Set(registry.plans.map((p) => p.id));
  for (const mod of registry.modules) {
    for (const ent of mod.requiredEntitlements) {
      const covered = registry.plans.some((plan) => plan.entitlements.features.includes(ent));
      if (!covered && ent) errors.push(`module ${mod.key} references unknown entitlement ${ent} not covered by any plan feature`);
    }
  }
  if (planIds.size !== registry.plans.length) errors.push('duplicate plan ids in registry');
  return { valid: errors.length === 0, errors };
}

export function resolvePlanEntitlements(registry: PlanRegistry, planId: string): PlanEntitlements | undefined {
  return registry.plans.find((p) => p.id === planId)?.entitlements;
}

export function resolvePlanLimits(registry: PlanRegistry, planId: string): PlanLimits | undefined {
  return registry.plans.find((p) => p.id === planId)?.limits;
}

export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing';
}

export function evaluateModuleLicensing(
  registry: PlanRegistry,
  planId: string,
  subscriptionStatus: SubscriptionStatus,
): EntitlementEvaluation['modules'] {
  const plan = registry.plans.find((p) => p.id === planId);
  if (!plan || !isSubscriptionActive(subscriptionStatus)) {
    return registry.modules.map((mod) => ({ key: mod.key, enabled: false, reason: 'subscription_inactive' }));
  }
  const features = new Set(plan.entitlements.features);
  const entitledModules = new Set(plan.entitlements.modules);
  return registry.modules.map((mod) => {
    if (!mod.enforceable) return { key: mod.key, enabled: true };
    if (entitledModules.has(mod.key)) return { key: mod.key, enabled: true };
    const missing = mod.requiredEntitlements.filter((e) => !features.has(e));
    if (missing.length === 0) return { key: mod.key, enabled: true };
    return { key: mod.key, enabled: false, reason: `missing_entitlements:${missing.join(',')}` };
  });
}

export function checkFeatureEntitlement(
  registry: PlanRegistry,
  planId: string,
  subscriptionStatus: SubscriptionStatus,
  featureId: string,
): EntitlementCheckResult {
  if (!isSubscriptionActive(subscriptionStatus)) {
    return { allowed: false, reason: 'subscription_inactive', planId, subscriptionStatus };
  }
  const plan = registry.plans.find((p) => p.id === planId);
  if (!plan) return { allowed: false, reason: 'plan_not_found', planId, subscriptionStatus };
  const allowed = plan.entitlements.features.includes(featureId)
    || plan.entitlements.workspaces.includes(featureId)
    || plan.entitlements.apiContracts.includes(featureId);
  return {
    allowed,
    reason: allowed ? undefined : 'feature_not_entitled',
    planId,
    subscriptionStatus,
  };
}

export function checkApiContractEntitlement(
  registry: PlanRegistry,
  planId: string,
  subscriptionStatus: SubscriptionStatus,
  apiPath: string,
): EntitlementCheckResult {
  if (!isSubscriptionActive(subscriptionStatus)) {
    return { allowed: false, reason: 'subscription_inactive', planId, subscriptionStatus };
  }
  const plan = registry.plans.find((p) => p.id === planId);
  if (!plan) return { allowed: false, reason: 'plan_not_found', planId, subscriptionStatus };
  const normalized = apiPath.startsWith('/api/v1') ? apiPath : `/api/v1${apiPath.startsWith('/') ? '' : '/'}${apiPath}`;
  const allowed = plan.entitlements.apiContracts.some(
    (contract) => normalized === contract || normalized.startsWith(contract.replace(/\{[^}]+\}/g, '')),
  );
  return { allowed, reason: allowed ? undefined : 'api_not_entitled', planId, subscriptionStatus };
}

export function enforcePlanLimits(
  limits: PlanLimits,
  usage: { racetracks: number; tenants: number; users: number; apiCallsPerMonth: number },
): { withinLimits: boolean; violations: string[] } {
  const violations: string[] = [];
  if (usage.racetracks > limits.racetracks) violations.push('racetrack_limit_exceeded');
  if (usage.tenants > limits.tenants) violations.push('tenant_limit_exceeded');
  if (usage.users > limits.users) violations.push('user_limit_exceeded');
  if (usage.apiCallsPerMonth > limits.apiCallsPerMonth) violations.push('api_call_limit_exceeded');
  return { withinLimits: violations.length === 0, violations };
}
