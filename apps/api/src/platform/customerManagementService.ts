import type {
  ContactRole,
  CustomerContactDto,
  CustomerContractDto,
  CustomerContractStatus,
  CustomerLifecycleStatus,
  EnterpriseCustomerDto,
  RacetrackPortfolioDto,
  TenantScopeContext,
} from '@trackmind/shared';
import { assertTenantScope } from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';
import type { CustomerConfigRegistry } from './customerConfigRegistry.js';
import type { TenantService } from './tenantService.js';

const now = () => new Date().toISOString();

const seedCustomers = (): EnterpriseCustomerDto[] => [
  {
    id: 'cust-trackmind-demo',
    organizationId: 'org-trackmind-network',
    tenantId: 'trackmind',
    legalName: 'TrackMind Network LLC',
    displayName: 'TrackMind Demo Customer',
    industry: 'Thoroughbred Racing',
    region: 'US-East',
    lifecycleStatus: 'active',
    supportTierId: 'support-enterprise',
    subscriptionPlanId: 'plan-enterprise-monthly',
    accountOwnerId: 'user-admin-1',
    successManagerId: 'csm-alex-morgan',
    primaryContactId: 'contact-demo-exec',
    racetrackPortfolioIds: ['portfolio-main'],
    tags: ['demo', 'enterprise', 'reference-account'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

const seedContacts = (): CustomerContactDto[] => [
  {
    id: 'contact-demo-exec',
    organizationId: 'org-trackmind-network',
    customerId: 'cust-trackmind-demo',
    tenantId: 'trackmind',
    fullName: 'Jordan Executive',
    email: 'jordan.exec@trackmind.demo',
    phone: '+1-555-0100',
    role: 'executive-sponsor',
    isPrimary: true,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
  {
    id: 'contact-demo-ops',
    organizationId: 'org-trackmind-network',
    customerId: 'cust-trackmind-demo',
    tenantId: 'trackmind',
    fullName: 'Sam Operations',
    email: 'sam.ops@trackmind.demo',
    role: 'operations-lead',
    isPrimary: false,
    status: 'active',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

const seedContracts = (): CustomerContractDto[] => [
  {
    id: 'contract-trackmind-demo',
    organizationId: 'org-trackmind-network',
    customerId: 'cust-trackmind-demo',
    tenantId: 'trackmind',
    contractNumber: 'TM-ENT-2026-001',
    title: 'TrackMind Enterprise Agreement',
    status: 'active',
    planId: 'plan-enterprise-monthly',
    supportTierId: 'support-enterprise',
    valueUsd: 59988,
    currency: 'USD',
    effectiveDate: '2026-01-01T00:00:00.000Z',
    expirationDate: '2026-12-31T23:59:59.999Z',
    autoRenew: true,
    signedByContactId: 'contact-demo-exec',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

const seedPortfolios = (): RacetrackPortfolioDto[] => [
  {
    id: 'portfolio-main',
    organizationId: 'org-trackmind-network',
    customerId: 'cust-trackmind-demo',
    tenantId: 'trackmind',
    name: 'Main Track Portfolio',
    racetrackIds: ['main-track'],
    jurisdiction: 'US-KY',
    operationalStatus: 'operational',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

export class CustomerManagementService {
  readonly customers: KeyValueRepository<EnterpriseCustomerDto>;
  readonly contacts: KeyValueRepository<CustomerContactDto>;
  readonly contracts: KeyValueRepository<CustomerContractDto>;
  readonly portfolios: KeyValueRepository<RacetrackPortfolioDto>;

  constructor(
    private readonly config: CustomerConfigRegistry,
    private readonly tenantService?: TenantService,
  ) {
    this.customers = createRepository(seedCustomers());
    this.contacts = createRepository(seedContacts());
    this.contracts = createRepository(seedContracts());
    this.portfolios = createRepository(seedPortfolios());
  }

  private scoped<T extends { organizationId: string; tenantId?: string }>(
    records: T[],
    scope: TenantScopeContext,
  ): T[] {
    assertTenantScope(scope);
    return records.filter((r) => {
      if (r.organizationId !== scope.organizationId) return false;
      if (scope.tenantId && r.tenantId && r.tenantId !== scope.tenantId) return false;
      return true;
    });
  }

  listCustomers(scope: TenantScopeContext): EnterpriseCustomerDto[] {
    return this.scoped(this.customers.list(), scope);
  }

  getCustomer(id: string, scope: TenantScopeContext): EnterpriseCustomerDto | undefined {
    assertTenantScope(scope);
    const customer = this.customers.get(id);
    if (!customer || customer.organizationId !== scope.organizationId) return undefined;
    if (scope.tenantId && customer.tenantId && customer.tenantId !== scope.tenantId) return undefined;
    return customer;
  }

  createCustomer(
    scope: TenantScopeContext,
    input: Pick<EnterpriseCustomerDto, 'legalName' | 'displayName' | 'industry' | 'region' | 'supportTierId'> & {
      tenantId?: string;
      subscriptionPlanId?: string;
    },
  ): EnterpriseCustomerDto {
    assertTenantScope(scope);
    if (!this.config.getSupportTier(input.supportTierId)) throw new Error(`support_tier_not_found:${input.supportTierId}`);
    const ts = now();
    const org = this.tenantService?.organizations.get(scope.organizationId);
    if (!org && this.tenantService) throw new Error(`organization_not_found:${scope.organizationId}`);
    const record: EnterpriseCustomerDto = {
      id: `cust-${Date.now().toString(36)}`,
      organizationId: scope.organizationId,
      tenantId: input.tenantId ?? scope.tenantId,
      legalName: input.legalName,
      displayName: input.displayName,
      industry: input.industry,
      region: input.region,
      lifecycleStatus: 'prospect',
      supportTierId: input.supportTierId,
      subscriptionPlanId: input.subscriptionPlanId,
      racetrackPortfolioIds: [],
      tags: [],
      createdAt: ts,
      updatedAt: ts,
      mock: false,
    };
    return this.customers.upsert(record);
  }

  listContacts(scope: TenantScopeContext, customerId?: string): CustomerContactDto[] {
    let records = this.scoped(this.contacts.list(), scope);
    if (customerId) records = records.filter((c) => c.customerId === customerId);
    return records;
  }

  createContact(
    scope: TenantScopeContext,
    input: Pick<CustomerContactDto, 'customerId' | 'fullName' | 'email' | 'role'> & { phone?: string; isPrimary?: boolean },
  ): CustomerContactDto {
    assertTenantScope(scope);
    const customer = this.getCustomer(input.customerId, scope);
    if (!customer) throw new Error(`customer_not_found:${input.customerId}`);
    const ts = now();
    if (input.isPrimary) {
      for (const c of this.contacts.list().filter((x) => x.customerId === input.customerId && x.isPrimary)) {
        this.contacts.upsert({ ...c, isPrimary: false, updatedAt: ts });
      }
    }
    const record: CustomerContactDto = {
      id: `contact-${Date.now().toString(36)}`,
      organizationId: scope.organizationId,
      customerId: input.customerId,
      tenantId: customer.tenantId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      role: input.role as ContactRole,
      isPrimary: input.isPrimary ?? false,
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
      mock: false,
    };
    return this.contacts.upsert(record);
  }

  listContracts(scope: TenantScopeContext, customerId?: string): CustomerContractDto[] {
    let records = this.scoped(this.contracts.list(), scope);
    if (customerId) records = records.filter((c) => c.customerId === customerId);
    return records;
  }

  createContract(
    scope: TenantScopeContext,
    input: Pick<CustomerContractDto, 'customerId' | 'title' | 'supportTierId' | 'valueUsd' | 'effectiveDate' | 'expirationDate'> & {
      planId?: string;
      autoRenew?: boolean;
    },
  ): CustomerContractDto {
    assertTenantScope(scope);
    const customer = this.getCustomer(input.customerId, scope);
    if (!customer) throw new Error(`customer_not_found:${input.customerId}`);
    if (!this.config.getSupportTier(input.supportTierId)) throw new Error(`support_tier_not_found:${input.supportTierId}`);
    const ts = now();
    const record: CustomerContractDto = {
      id: `contract-${Date.now().toString(36)}`,
      organizationId: scope.organizationId,
      customerId: input.customerId,
      tenantId: customer.tenantId,
      contractNumber: `TM-${Date.now().toString(36).toUpperCase()}`,
      title: input.title,
      status: 'draft',
      planId: input.planId ?? customer.subscriptionPlanId,
      supportTierId: input.supportTierId,
      valueUsd: input.valueUsd,
      currency: 'USD',
      effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate,
      autoRenew: input.autoRenew ?? true,
      createdAt: ts,
      updatedAt: ts,
      mock: false,
    };
    return this.contracts.upsert(record);
  }

  updateContractStatus(id: string, scope: TenantScopeContext, status: CustomerContractStatus): CustomerContractDto {
    assertTenantScope(scope);
    const existing = this.contracts.get(id);
    if (!existing || existing.organizationId !== scope.organizationId) throw new Error(`contract_not_found:${id}`);
    const ts = now();
    return this.contracts.upsert({ ...existing, status, updatedAt: ts });
  }

  listPortfolios(scope: TenantScopeContext, customerId?: string): RacetrackPortfolioDto[] {
    let records = this.scoped(this.portfolios.list(), scope);
    if (customerId) records = records.filter((p) => p.customerId === customerId);
    return records;
  }

  createPortfolio(
    scope: TenantScopeContext,
    input: Pick<RacetrackPortfolioDto, 'customerId' | 'tenantId' | 'name' | 'jurisdiction'> & { racetrackIds?: string[] },
  ): RacetrackPortfolioDto {
    assertTenantScope(scope);
    const customer = this.getCustomer(input.customerId, scope);
    if (!customer) throw new Error(`customer_not_found:${input.customerId}`);
    const ts = now();
    const record: RacetrackPortfolioDto = {
      id: `portfolio-${Date.now().toString(36)}`,
      organizationId: scope.organizationId,
      customerId: input.customerId,
      tenantId: input.tenantId,
      name: input.name,
      racetrackIds: input.racetrackIds ?? [],
      jurisdiction: input.jurisdiction,
      operationalStatus: 'planning',
      createdAt: ts,
      updatedAt: ts,
      mock: false,
    };
    this.portfolios.upsert(record);
    this.customers.upsert({
      ...customer,
      racetrackPortfolioIds: [...customer.racetrackPortfolioIds, record.id],
      updatedAt: ts,
    });
    return record;
  }

  addRacetrackToPortfolio(portfolioId: string, scope: TenantScopeContext, racetrackId: string): RacetrackPortfolioDto {
    assertTenantScope(scope);
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio || portfolio.organizationId !== scope.organizationId) throw new Error(`portfolio_not_found:${portfolioId}`);
    const ts = now();
    if (portfolio.racetrackIds.includes(racetrackId)) return portfolio;
    return this.portfolios.upsert({
      ...portfolio,
      racetrackIds: [...portfolio.racetrackIds, racetrackId],
      operationalStatus: portfolio.operationalStatus === 'planning' ? 'onboarding' : portfolio.operationalStatus,
      updatedAt: ts,
    });
  }

  updateCustomerLifecycle(id: string, scope: TenantScopeContext, lifecycleStatus: CustomerLifecycleStatus): EnterpriseCustomerDto {
    const existing = this.getCustomer(id, scope);
    if (!existing) throw new Error(`customer_not_found:${id}`);
    return this.customers.upsert({ ...existing, lifecycleStatus, updatedAt: now() });
  }
}
