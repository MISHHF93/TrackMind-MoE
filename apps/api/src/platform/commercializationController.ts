import type { BillingProvider, SubscriptionStatus } from '@trackmind/shared';
import { billingProviderWorkspace, createBillingProvider } from './billingAbstractions.js';
import { EntitlementService } from './entitlementService.js';
import { PlanRegistryService } from './planRegistry.js';
import { SubscriptionService } from './subscriptionService.js';
import type { TenantService } from './tenantService.js';
import { UsageTrackingService } from './usageTrackingService.js';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type HandlerResult = { status: number; body: unknown } | undefined;

export interface CommercializationServices {
  planRegistry: PlanRegistryService;
  subscriptions: SubscriptionService;
  usage: UsageTrackingService;
  entitlements: EntitlementService;
  billing: BillingProvider;
}

export function createCommercializationServices(tenant: TenantService): CommercializationServices {
  const planRegistry = new PlanRegistryService();
  const subscriptions = new SubscriptionService(planRegistry, tenant);
  const usage = new UsageTrackingService(tenant);
  const entitlements = new EntitlementService(planRegistry, subscriptions, usage);
  const billing = createBillingProvider();
  return { planRegistry, subscriptions, usage, entitlements, billing };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function handleCommercializationRequest(
  method: HttpMethod,
  path: string,
  body: unknown,
  services: CommercializationServices,
  searchParams: URLSearchParams,
): HandlerResult {
  const organizationId = searchParams.get('organizationId') ?? 'org-trackmind-network';
  const tenantId = searchParams.get('tenantId') ?? 'trackmind';

  if (method === 'GET' && path === '/subscriptions/workspace') {
    const registry = services.planRegistry.get();
    return {
      status: 200,
      body: {
        generatedAt: new Date().toISOString(),
        schemaVersion: 'trackmind.commercialization.v1',
        planCount: registry.plans.length,
        moduleCount: registry.modules.length,
        subscriptions: services.subscriptions.list(),
        configPaths: registry.configPaths,
        billingProvider: services.billing.descriptor,
        mock: false,
      },
    };
  }

  if (method === 'GET' && path === '/subscriptions/plans') {
    return { status: 200, body: services.planRegistry.listPlans() };
  }

  const planMatch = path.match(/^\/subscriptions\/plans\/([^/]+)$/);
  if (method === 'GET' && planMatch) {
    const plan = services.planRegistry.getPlan(decodeURIComponent(planMatch[1]));
    return plan
      ? { status: 200, body: plan }
      : { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Plan not found' } } };
  }

  if (method === 'GET' && path === '/subscriptions/modules') {
    return { status: 200, body: services.planRegistry.listModules() };
  }

  if (method === 'GET' && path === '/subscriptions/entitlements') {
    return { status: 200, body: services.entitlements.evaluate(organizationId, tenantId) };
  }

  if (method === 'GET' && path === '/subscriptions/entitlements/check') {
    const feature = searchParams.get('feature');
    const apiPath = searchParams.get('apiPath');
    if (feature) {
      return { status: 200, body: services.entitlements.checkFeature(organizationId, tenantId, feature) };
    }
    if (apiPath) {
      return { status: 200, body: services.entitlements.checkApi(organizationId, tenantId, apiPath) };
    }
    return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: 'feature or apiPath required' } } };
  }

  if (method === 'POST' && path === '/subscriptions/usage') {
    const input = isRecord(body) ? body : {};
    const recorded = services.usage.record({
      organizationId: String(input.organizationId ?? organizationId),
      tenantId: String(input.tenantId ?? tenantId),
      racetrackId: input.racetrackId ? String(input.racetrackId) : undefined,
      metricKey: (input.metricKey ?? 'api_call') as 'api_call',
      quantity: input.quantity ? Number(input.quantity) : 1,
    });
    return { status: 201, body: recorded };
  }

  if (method === 'GET' && path === '/subscriptions/usage') {
    return {
      status: 200,
      body: {
        organizationId,
        tenantId,
        metrics: services.usage.list(organizationId, tenantId),
        summary: services.usage.summarize(organizationId, tenantId),
        generatedAt: new Date().toISOString(),
        mock: false,
      },
    };
  }

  if (method === 'GET' && path === '/subscriptions') {
    const orgFilter = searchParams.get('organizationId') ?? undefined;
    const tenantFilter = searchParams.get('tenantId') ?? undefined;
    return { status: 200, body: services.subscriptions.list(orgFilter, tenantFilter) };
  }

  if (method === 'POST' && path === '/subscriptions') {
    const input = isRecord(body) ? body : {};
    try {
      const created = services.subscriptions.create({
        organizationId: String(input.organizationId ?? organizationId),
        tenantId: input.tenantId ? String(input.tenantId) : undefined,
        planId: String(input.planId ?? 'plan-starter-monthly'),
        status: input.status as SubscriptionStatus | undefined,
        trialDays: input.trialDays ? Number(input.trialDays) : undefined,
      });
      return { status: 201, body: created };
    } catch (err) {
      return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: String(err) } } };
    }
  }

  const subscriptionMatch = path.match(/^\/subscriptions\/([^/]+)$/);
  const reservedSubscriptionPaths = new Set(['plans', 'modules', 'entitlements', 'usage', 'workspace']);
  if (method === 'GET' && subscriptionMatch && !reservedSubscriptionPaths.has(subscriptionMatch[1])) {
    const sub = services.subscriptions.get(decodeURIComponent(subscriptionMatch[1]));
    return sub
      ? { status: 200, body: sub }
      : { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Subscription not found' } } };
  }

  const statusMatch = path.match(/^\/subscriptions\/([^/]+)\/status$/);
  if (method === 'POST' && statusMatch) {
    const input = isRecord(body) ? body : {};
    try {
      const updated = services.subscriptions.updateStatus(
        decodeURIComponent(statusMatch[1]),
        String(input.status ?? 'active') as SubscriptionStatus,
      );
      return { status: 200, body: updated };
    } catch {
      return { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Subscription not found' } } };
    }
  }

  if (method === 'POST' && path === '/onboarding/organization') {
    const input = isRecord(body) ? body : {};
    try {
      const result = services.subscriptions.onboardOrganization({
        organizationName: String(input.organizationName ?? 'New Organization'),
        planId: String(input.planId ?? 'plan-starter-monthly'),
        adminEmail: input.adminEmail ? String(input.adminEmail) : undefined,
        dataResidency: input.dataResidency ? String(input.dataResidency) : undefined,
      });
      return { status: 201, body: result };
    } catch (err) {
      return { status: 400, body: { ok: false, error: { code: 'onboarding_failed', message: String(err) } } };
    }
  }

  if (method === 'POST' && path === '/onboarding/tenant') {
    const input = isRecord(body) ? body : {};
    try {
      const result = services.subscriptions.onboardTenant({
        organizationId: String(input.organizationId ?? organizationId),
        tenantName: String(input.tenantName ?? 'New Tenant'),
        planId: input.planId ? String(input.planId) : undefined,
      });
      return { status: 201, body: result };
    } catch (err) {
      return { status: 400, body: { ok: false, error: { code: 'onboarding_failed', message: String(err) } } };
    }
  }

  if (method === 'POST' && path === '/onboarding/racetrack') {
    const input = isRecord(body) ? body : {};
    try {
      const result = services.subscriptions.onboardRacetrack({
        organizationId: String(input.organizationId ?? organizationId),
        tenantId: String(input.tenantId ?? tenantId),
        racetrackName: String(input.racetrackName ?? 'New Racetrack'),
        jurisdiction: String(input.jurisdiction ?? 'US'),
        timezone: input.timezone ? String(input.timezone) : undefined,
      });
      return { status: 201, body: result };
    } catch (err) {
      const code = String(err).includes('racetrack_limit') ? 'plan_limit_exceeded' : 'onboarding_failed';
      return { status: 400, body: { ok: false, error: { code, message: String(err) } } };
    }
  }

  if (method === 'GET' && path === '/billing/provider') {
    return { status: 200, body: billingProviderWorkspace(services.billing) };
  }

  if (method === 'POST' && path === '/billing/checkout-session') {
    const input = isRecord(body) ? body : {};
    const orgId = String(input.organizationId ?? organizationId);
    const planId = String(input.planId ?? 'plan-starter-monthly');
    const subscription = services.subscriptions.resolveForScope(orgId)
      ?? services.subscriptions.create({ organizationId: orgId, planId, status: 'trialing', trialDays: 14 });
    const result = services.billing.createCheckoutSession({
      organizationId: orgId,
      planId,
      subscriptionId: subscription.id,
      successUrl: input.successUrl ? String(input.successUrl) : undefined,
      cancelUrl: input.cancelUrl ? String(input.cancelUrl) : undefined,
    });
    return { status: 202, body: result };
  }

  return undefined;
}
