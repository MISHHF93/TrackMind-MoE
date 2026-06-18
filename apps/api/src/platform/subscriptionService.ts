import type {
  OrganizationOnboardingRequest,
  RacetrackOnboardingRequest,
  SubscriptionRecord,
  SubscriptionStatus,
  TenantOnboardingRequest,
} from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';
import type { PlanRegistryService } from './planRegistry.js';
import type { TenantService } from './tenantService.js';

const now = () => new Date().toISOString();

function periodEnd(interval: 'monthly' | 'annual'): string {
  const d = new Date();
  if (interval === 'annual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

const seedSubscriptions = (): SubscriptionRecord[] => [
  {
    id: 'sub-trackmind-demo',
    organizationId: 'org-trackmind-network',
    tenantId: 'trackmind',
    planId: 'plan-enterprise-monthly',
    status: 'active',
    currentPeriodStart: '2026-01-01T00:00:00.000Z',
    currentPeriodEnd: '2026-07-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

export class SubscriptionService {
  readonly subscriptions: KeyValueRepository<SubscriptionRecord>;

  constructor(
    private readonly planRegistry: PlanRegistryService,
    private readonly tenantService?: TenantService,
    seed = seedSubscriptions(),
  ) {
    this.subscriptions = createRepository(seed);
  }

  list(organizationId?: string, tenantId?: string): SubscriptionRecord[] {
    return this.subscriptions.list().filter((sub) => {
      if (organizationId && sub.organizationId !== organizationId) return false;
      if (tenantId && sub.tenantId && sub.tenantId !== tenantId) return false;
      return true;
    });
  }

  get(id: string): SubscriptionRecord | undefined {
    return this.subscriptions.get(id);
  }

  resolveForScope(organizationId: string, tenantId?: string): SubscriptionRecord | undefined {
    const scoped = this.list(organizationId, tenantId);
    const tenantSub = scoped.find((s) => s.tenantId === tenantId && (s.status === 'active' || s.status === 'trialing'));
    if (tenantSub) return tenantSub;
    return scoped.find((s) => !s.tenantId && (s.status === 'active' || s.status === 'trialing'))
      ?? scoped.find((s) => s.status === 'active' || s.status === 'trialing');
  }

  create(input: {
    organizationId: string;
    tenantId?: string;
    planId: string;
    status?: SubscriptionStatus;
    trialDays?: number;
  }): SubscriptionRecord {
    const plan = this.planRegistry.getPlan(input.planId);
    if (!plan) throw new Error(`plan_not_found:${input.planId}`);
    const ts = now();
    const trialEndsAt = input.trialDays
      ? new Date(Date.now() + input.trialDays * 86_400_000).toISOString()
      : undefined;
    const record: SubscriptionRecord = {
      id: `sub-${Date.now().toString(36)}`,
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      planId: input.planId,
      status: input.status ?? (trialEndsAt ? 'trialing' : 'active'),
      currentPeriodStart: ts,
      currentPeriodEnd: periodEnd(plan.billingInterval),
      trialEndsAt,
      createdAt: ts,
      updatedAt: ts,
      mock: false,
    };
    return this.subscriptions.upsert(record);
  }

  updateStatus(id: string, status: SubscriptionStatus): SubscriptionRecord {
    const existing = this.subscriptions.get(id);
    if (!existing) throw new Error(`subscription_not_found:${id}`);
    const ts = now();
    return this.subscriptions.upsert({
      ...existing,
      status,
      cancelledAt: status === 'cancelled' ? ts : existing.cancelledAt,
      updatedAt: ts,
    });
  }

  onboardOrganization(input: OrganizationOnboardingRequest) {
    if (!this.planRegistry.getPlan(input.planId)) throw new Error(`plan_not_found:${input.planId}`);
    const org = this.tenantService?.createOrganization({ name: input.organizationName })
      ?? { id: `org-${Date.now().toString(36)}`, name: input.organizationName };
    const subscription = this.create({
      organizationId: org.id,
      planId: input.planId,
      status: 'trialing',
      trialDays: 14,
    });
    return {
      organizationId: org.id,
      subscriptionId: subscription.id,
      planId: input.planId,
      status: subscription.status,
      createdAt: subscription.createdAt,
      mock: false,
    };
  }

  onboardTenant(input: TenantOnboardingRequest) {
    const planId = input.planId ?? this.resolveForScope(input.organizationId)?.planId ?? 'plan-starter-monthly';
    if (!this.planRegistry.getPlan(planId)) throw new Error(`plan_not_found:${planId}`);
    const tenant = this.tenantService?.createTenant({ organizationId: input.organizationId, name: input.tenantName })
      ?? { id: `tenant-${Date.now().toString(36)}` };
    const subscription = this.create({
      organizationId: input.organizationId,
      tenantId: tenant.id,
      planId,
      status: 'active',
    });
    return {
      organizationId: input.organizationId,
      tenantId: tenant.id,
      subscriptionId: subscription.id,
      planId,
      status: subscription.status,
      createdAt: subscription.createdAt,
      mock: false,
    };
  }

  onboardRacetrack(input: RacetrackOnboardingRequest) {
    const subscription = this.resolveForScope(input.organizationId, input.tenantId);
    const planId = subscription?.planId ?? 'plan-starter-monthly';
    const plan = this.planRegistry.getPlan(planId);
    if (!plan) throw new Error(`plan_not_found:${planId}`);
    const tenant = this.tenantService?.tenants.get(input.tenantId);
    const racetrackCount = tenant?.racetrackIds.length ?? 0;
    if (racetrackCount >= plan.limits.racetracks) throw new Error('racetrack_limit_exceeded');
    const racetrack = this.tenantService?.createRacetrack({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      name: input.racetrackName,
      jurisdiction: input.jurisdiction,
    }) ?? { id: `track-${Date.now().toString(36)}` };
    return {
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      racetrackId: racetrack.id,
      subscriptionId: subscription?.id ?? 'none',
      planId,
      status: subscription?.status ?? 'active',
      createdAt: now(),
      mock: false,
    };
  }
}
