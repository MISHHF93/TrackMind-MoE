import type { PlanLimits, UsageMetricRecord, UsageRecordRequest } from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';
import type { TenantService } from './tenantService.js';

const now = () => new Date().toISOString();

function monthBounds(date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export class UsageTrackingService {
  readonly metrics: KeyValueRepository<UsageMetricRecord>;

  constructor(
    private readonly tenantService?: TenantService,
    seed: UsageMetricRecord[] = [],
  ) {
    this.metrics = createRepository(seed);
  }

  record(input: UsageRecordRequest): UsageMetricRecord {
    const { start, end } = monthBounds();
    const record: UsageMetricRecord = {
      id: `usage-${Date.now().toString(36)}`,
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      racetrackId: input.racetrackId,
      metricKey: input.metricKey,
      quantity: input.quantity ?? 1,
      periodStart: start,
      periodEnd: end,
      recordedAt: now(),
      mock: false,
    };
    return this.metrics.upsert(record);
  }

  list(organizationId: string, tenantId?: string): UsageMetricRecord[] {
    return this.metrics.list().filter((m) => {
      if (m.organizationId !== organizationId) return false;
      if (tenantId && m.tenantId !== tenantId) return false;
      return true;
    });
  }

  summarize(organizationId: string, tenantId: string): Record<keyof PlanLimits, number> {
    const { start } = monthBounds();
    const periodMetrics = this.list(organizationId, tenantId).filter((m) => m.periodStart === start);
    const sum = (key: string) =>
      periodMetrics.filter((m) => m.metricKey === key).reduce((acc, m) => acc + m.quantity, 0);

    const org = this.tenantService?.organizations.get(organizationId);
    const tenants = this.tenantService?.tenants.list().filter((t) => t.organizationId === organizationId) ?? [];
    const tenant = this.tenantService?.tenants.get(tenantId);
    const racetracks = tenant?.racetrackIds.length ?? 0;

    return {
      racetracks: racetracks || sum('racetracks'),
      tenants: (org?.tenantIds.length ?? tenants.length) || sum('tenants'),
      users: sum('users'),
      apiCallsPerMonth: sum('api_call') + sum('apiCallsPerMonth'),
    };
  }
}
