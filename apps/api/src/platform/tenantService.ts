import type {
  EnvironmentConfigDto,
  OrganizationDto,
  PlatformFoundationWorkspaceDto,
  RacetrackDto,
  TenantDto,
} from '@trackmind/shared';
import { createNamespacedRepository, getRepositoryEnvironment, type KeyValueRepository } from '../repository/repositoryAdapter.js';
import { seedFeatureFlags } from './featureFlags.js';

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
    racetrackIds: ['main-track', 'north-chute'],
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
  {
    id: 'north-chute',
    tenantId: 'trackmind',
    organizationId: 'org-trackmind-network',
    name: 'North Chute',
    jurisdiction: 'US-KY',
    status: 'operational',
    timezone: 'America/New_York',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

export class TenantService {
  /** Namespaced repositories — honor `PERSISTENCE_MODE` / `DATABASE_URL` via `createNamespacedRepository`. */
  readonly organizations: KeyValueRepository<OrganizationDto>;
  readonly tenants: KeyValueRepository<TenantDto>;
  readonly racetracks: KeyValueRepository<RacetrackDto>;

  constructor() {
    this.organizations = createNamespacedRepository('platform.organizations', seedOrganizations());
    this.tenants = createNamespacedRepository('platform.tenants', seedTenants());
    this.racetracks = createNamespacedRepository('platform.racetracks', seedRacetracks());
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
    const repository = getRepositoryEnvironment();
    return {
      environment: env === 'production' || env === 'staging' ? env : 'development',
      apiBasePath: '/api/v1',
      persistenceMode: repository.mode,
      repository: {
        mode: repository.mode,
        wired: repository.wired,
        postgresReady: repository.postgresReady,
        usingFallback: repository.usingFallback,
        pgClientAvailable: repository.pgClientAvailable,
      },
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
