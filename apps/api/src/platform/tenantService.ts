import type {
  EnvironmentConfigDto,
  FeatureFlagDefinitionDto,
  FeatureFlagEvaluationDto,
  OrganizationDto,
  PlatformFoundationWorkspaceDto,
  RacetrackDto,
  TenantDto,
} from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';

const now = () => new Date().toISOString();

const seedOrganizations = (): OrganizationDto[] => [
  {
    id: 'org-trackmind-network',
    name: 'TrackMind Network',
    status: 'active',
    tenantIds: ['trackmind'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

const seedTenants = (): TenantDto[] => [
  {
    id: 'trackmind',
    organizationId: 'org-trackmind-network',
    name: 'TrackMind Demo Tenant',
    status: 'active',
    racetrackIds: ['main-track'],
    dataBoundary: 'us-east',
    isolationMode: 'shared-schema',
    featureFlags: ['platform-health', 'executive-read-only', 'race-day-ops', 'equine-intelligence', 'fan-experience'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

const seedRacetracks = (): RacetrackDto[] => [
  {
    id: 'main-track',
    tenantId: 'trackmind',
    organizationId: 'org-trackmind-network',
    name: 'Main Track',
    jurisdiction: 'US-KY',
    status: 'operational',
    timezone: 'America/New_York',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

const seedFeatureFlags = (): FeatureFlagDefinitionDto[] => [
  { key: 'platform-health', description: 'Platform health workspace', defaultEnabled: true, environments: { development: true, staging: true, production: true }, moduleKeys: ['admin'], mock: false },
  { key: 'race-day-ops', description: 'Race day operations module', defaultEnabled: true, environments: { development: true, staging: true, production: true }, moduleKeys: ['raceDay', 'surface', 'workforce'], mock: false },
  { key: 'equine-intelligence', description: 'Equine intelligence module', defaultEnabled: true, environments: { development: true, staging: true, production: true }, moduleKeys: ['equine'], mock: false },
  { key: 'fan-experience', description: 'Fan experience module', defaultEnabled: true, environments: { development: true, staging: false, production: false }, moduleKeys: ['fanExperience'], mock: false },
  { key: 'analytics', description: 'Executive analytics module', defaultEnabled: true, environments: { development: true, staging: true, production: true }, moduleKeys: ['analytics'], mock: false },
  { key: 'executive-read-only', description: 'Executive read-only posture', defaultEnabled: false, environments: { development: true, staging: true, production: true }, moduleKeys: ['dashboard'], mock: false },
];

export class TenantService {
  readonly organizations: KeyValueRepository<OrganizationDto>;
  readonly tenants: KeyValueRepository<TenantDto>;
  readonly racetracks: KeyValueRepository<RacetrackDto>;

  constructor() {
    this.organizations = createRepository(seedOrganizations());
    this.tenants = createRepository(seedTenants());
    this.racetracks = createRepository(seedRacetracks());
  }

  workspace(): PlatformFoundationWorkspaceDto {
    return {
      generatedAt: now(),
      organizations: this.organizations.list(),
      tenants: this.tenants.list(),
      racetracks: this.racetracks.list(),
      users: [],
      featureFlags: seedFeatureFlags(),
      environment: this.environmentConfig(),
      mock: false,
    };
  }

  environmentConfig(): EnvironmentConfigDto {
    const env = (process.env.NODE_ENV ?? 'development') as EnvironmentConfigDto['environment'];
    return {
      environment: env === 'production' || env === 'staging' ? env : 'development',
      apiBasePath: '/api/v1',
      persistenceMode: process.env.TRACKMIND_PERSISTENCE_MODE === 'postgres' ? 'postgres' : 'in-memory',
      featureFlagDefaults: seedFeatureFlags().filter((f) => f.defaultEnabled).map((f) => f.key),
      retentionDays: 2555,
      observabilityEnabled: true,
      generatedAt: now(),
      mock: false,
    };
  }

  createOrganization(input: Pick<OrganizationDto, 'name'>): OrganizationDto {
    const id = `org-${Date.now().toString(36)}`;
    return this.organizations.upsert({
      id,
      name: input.name,
      status: 'pending',
      tenantIds: [],
      createdAt: now(),
      updatedAt: now(),
      mock: false,
    });
  }

  createTenant(input: Pick<TenantDto, 'organizationId' | 'name'>): TenantDto {
    const id = `tenant-${Date.now().toString(36)}`;
    const org = this.organizations.get(input.organizationId);
    const record: TenantDto = {
      id,
      organizationId: input.organizationId,
      name: input.name,
      status: 'provisioning',
      racetrackIds: [],
      dataBoundary: 'us-east',
      isolationMode: 'shared-schema',
      featureFlags: ['platform-health'],
      createdAt: now(),
      updatedAt: now(),
      mock: false,
    };
    this.tenants.upsert(record);
    if (org) {
      this.organizations.upsert({ ...org, tenantIds: [...org.tenantIds, id], updatedAt: now() });
    }
    return record;
  }

  createRacetrack(input: Pick<RacetrackDto, 'tenantId' | 'organizationId' | 'name' | 'jurisdiction'>): RacetrackDto {
    const id = `track-${Date.now().toString(36)}`;
    const tenant = this.tenants.get(input.tenantId);
    const record: RacetrackDto = {
      id,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      name: input.name,
      jurisdiction: input.jurisdiction,
      status: 'operational',
      timezone: 'America/New_York',
      createdAt: now(),
      updatedAt: now(),
      mock: false,
    };
    this.racetracks.upsert(record);
    if (tenant) {
      this.tenants.upsert({ ...tenant, racetrackIds: [...tenant.racetrackIds, id], updatedAt: now() });
    }
    return record;
  }
}

export class FeatureFlagService {
  private definitions: FeatureFlagDefinitionDto[];

  constructor(definitions: FeatureFlagDefinitionDto[] = seedFeatureFlags()) {
    this.definitions = definitions;
  }

  list(): FeatureFlagDefinitionDto[] {
    return this.definitions;
  }

  evaluate(key: string, tenantFlags: string[] = [], environment?: string): FeatureFlagEvaluationDto {
    const def = this.definitions.find((d) => d.key === key);
    const env = environment ?? process.env.NODE_ENV ?? 'development';
    if (tenantFlags.includes(key)) {
      return { key, enabled: true, source: 'tenant', environment: env, mock: false };
    }
    if (def?.environments[env] !== undefined) {
      return { key, enabled: def.environments[env], source: 'environment', environment: env, mock: false };
    }
    return { key, enabled: def?.defaultEnabled ?? false, source: 'default', environment: env, mock: false };
  }

  evaluateAll(tenantFlags: string[] = []): FeatureFlagEvaluationDto[] {
    return this.definitions.map((d) => this.evaluate(d.key, tenantFlags));
  }

  isModuleEnabled(moduleKey: string, tenantFlags: string[] = []): boolean {
    return this.definitions.some((d) => d.moduleKeys.includes(moduleKey) && this.evaluate(d.key, tenantFlags).enabled);
  }
}
