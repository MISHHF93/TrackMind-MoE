import type { CustomerContractStatus, CustomerLifecycleStatus, TenantScopeContext } from '@trackmind/shared';
import { customerManagementSchemaVersion } from '@trackmind/shared';
import type { CommercializationServices } from './commercializationController.js';
import { CustomerConfigRegistry } from './customerConfigRegistry.js';
import { CustomerExecutiveDashboardService } from './customerExecutiveDashboardService.js';
import { CustomerManagementService } from './customerManagementService.js';
import { CustomerOnboardingWorkflowService } from './customerOnboardingWorkflowService.js';
import { CustomerSuccessService } from './customerSuccessService.js';
import type { TenantService } from './tenantService.js';

type HttpMethod = 'GET' | 'POST';
type HandlerResult = { status: number; body: unknown } | undefined;

export interface CustomerManagementServices {
  config: CustomerConfigRegistry;
  customers: CustomerManagementService;
  workflows: CustomerOnboardingWorkflowService;
  success: CustomerSuccessService;
  dashboard: CustomerExecutiveDashboardService;
}

export function createCustomerManagementServices(
  tenant: TenantService,
  commercialization?: CommercializationServices,
): CustomerManagementServices {
  const config = new CustomerConfigRegistry();
  const customers = new CustomerManagementService(config, tenant);
  const workflows = new CustomerOnboardingWorkflowService(config, customers);
  const success = new CustomerSuccessService(customers, workflows, commercialization);
  const dashboard = new CustomerExecutiveDashboardService(customers, success, workflows, config);
  return { config, customers, workflows, success, dashboard };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function scopeFromParams(searchParams: URLSearchParams, body?: unknown): TenantScopeContext {
  const input = isRecord(body) ? body : {};
  const organizationId = searchParams.get('organizationId')
    ?? (input.organizationId ? String(input.organizationId) : 'org-trackmind-network');
  const tenantId = searchParams.get('tenantId') ?? (input.tenantId ? String(input.tenantId) : undefined);
  const actorOrganizationId = searchParams.get('actorOrganizationId') ?? organizationId;
  return { organizationId, tenantId, actorOrganizationId };
}

function isolationError(err: unknown): HandlerResult {
  if (String(err).includes('tenant_isolation_violation')) {
    return { status: 403, body: { ok: false, error: { code: 'tenant_isolation_violation', message: 'Cross-organization access denied' } } };
  }
  return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: String(err) } } };
}

export function handleCustomerManagementRequest(
  method: HttpMethod,
  path: string,
  body: unknown,
  services: CustomerManagementServices,
  searchParams: URLSearchParams,
): HandlerResult {
  const scope = scopeFromParams(searchParams, body);

  if (method === 'GET' && path === '/customer-management/workspace') {
    try {
      return {
        status: 200,
        body: {
          generatedAt: new Date().toISOString(),
          schemaVersion: customerManagementSchemaVersion,
          organizationId: scope.organizationId,
          customers: services.customers.listCustomers(scope),
          contacts: services.customers.listContacts(scope),
          contracts: services.customers.listContracts(scope),
          portfolios: services.customers.listPortfolios(scope),
          successPlans: services.success.listSuccessPlans(scope),
          onboardingWorkflows: services.workflows.listWorkflows(scope),
          supportTiers: services.config.supportTiers,
          configPaths: services.config.configPaths,
          tenantIsolation: { mode: 'strict', organizationId: scope.organizationId },
          mock: false,
        },
      };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'GET' && path === '/customer-management/executive-dashboard') {
    try {
      return { status: 200, body: services.dashboard.build(scope) };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'GET' && path === '/customer-management/support-tiers') {
    return { status: 200, body: services.config.supportTiers };
  }

  if (method === 'GET' && path === '/customer-management/onboarding-templates') {
    return { status: 200, body: services.config.onboardingWorkflows };
  }

  if (method === 'GET' && path === '/customers') {
    try {
      return { status: 200, body: services.customers.listCustomers(scope) };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'POST' && path === '/customers') {
    const input = isRecord(body) ? body : {};
    try {
      const created = services.customers.createCustomer(scope, {
        legalName: String(input.legalName ?? 'New Customer'),
        displayName: String(input.displayName ?? 'New Customer'),
        industry: String(input.industry ?? 'Thoroughbred Racing'),
        region: String(input.region ?? 'US'),
        supportTierId: String(input.supportTierId ?? 'support-standard'),
        tenantId: input.tenantId ? String(input.tenantId) : scope.tenantId,
        subscriptionPlanId: input.subscriptionPlanId ? String(input.subscriptionPlanId) : undefined,
      });
      return { status: 201, body: created };
    } catch (err) {
      return isolationError(err);
    }
  }

  const customerMatch = path.match(/^\/customers\/([^/]+)$/);
  if (method === 'GET' && customerMatch) {
    try {
      const customer = services.customers.getCustomer(decodeURIComponent(customerMatch[1]), scope);
      return customer
        ? { status: 200, body: customer }
        : { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Customer not found' } } };
    } catch (err) {
      return isolationError(err);
    }
  }

  const customerLifecycleMatch = path.match(/^\/customers\/([^/]+)\/lifecycle$/);
  if (method === 'POST' && customerLifecycleMatch) {
    const input = isRecord(body) ? body : {};
    try {
      const updated = services.customers.updateCustomerLifecycle(
        decodeURIComponent(customerLifecycleMatch[1]),
        scope,
        String(input.lifecycleStatus ?? 'active') as CustomerLifecycleStatus,
      );
      return { status: 200, body: updated };
    } catch (err) {
      return isolationError(err);
    }
  }

  const customerHealthMatch = path.match(/^\/customers\/([^/]+)\/health$/);
  if (method === 'GET' && customerHealthMatch) {
    try {
      const customerId = decodeURIComponent(customerHealthMatch[1]);
      const customer = services.customers.getCustomer(customerId, scope);
      if (!customer) return { status: 404, body: { ok: false, error: { code: 'not_found', message: 'Customer not found' } } };
      const metrics = services.success.computeMetrics(customerId, scope);
      return {
        status: 200,
        body: {
          customerId,
          organizationId: scope.organizationId,
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
          },
          generatedAt: new Date().toISOString(),
          mock: false,
        },
      };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'GET' && path === '/customer-contacts') {
    try {
      const customerId = searchParams.get('customerId') ?? undefined;
      return { status: 200, body: services.customers.listContacts(scope, customerId) };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'POST' && path === '/customer-contacts') {
    const input = isRecord(body) ? body : {};
    try {
      const created = services.customers.createContact(scope, {
        customerId: String(input.customerId ?? ''),
        fullName: String(input.fullName ?? 'Contact'),
        email: String(input.email ?? 'contact@example.com'),
        role: String(input.role ?? 'operations-lead') as 'operations-lead',
        phone: input.phone ? String(input.phone) : undefined,
        isPrimary: Boolean(input.isPrimary),
      });
      return { status: 201, body: created };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'GET' && path === '/customer-contracts') {
    try {
      const customerId = searchParams.get('customerId') ?? undefined;
      return { status: 200, body: services.customers.listContracts(scope, customerId) };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'POST' && path === '/customer-contracts') {
    const input = isRecord(body) ? body : {};
    try {
      const created = services.customers.createContract(scope, {
        customerId: String(input.customerId ?? ''),
        title: String(input.title ?? 'Service Agreement'),
        supportTierId: String(input.supportTierId ?? 'support-standard'),
        valueUsd: Number(input.valueUsd ?? 0),
        effectiveDate: String(input.effectiveDate ?? new Date().toISOString()),
        expirationDate: String(input.expirationDate ?? new Date(Date.now() + 365 * 86_400_000).toISOString()),
        planId: input.planId ? String(input.planId) : undefined,
        autoRenew: input.autoRenew !== undefined ? Boolean(input.autoRenew) : true,
      });
      return { status: 201, body: created };
    } catch (err) {
      return isolationError(err);
    }
  }

  const contractStatusMatch = path.match(/^\/customer-contracts\/([^/]+)\/status$/);
  if (method === 'POST' && contractStatusMatch) {
    const input = isRecord(body) ? body : {};
    try {
      const updated = services.customers.updateContractStatus(
        decodeURIComponent(contractStatusMatch[1]),
        scope,
        String(input.status ?? 'active') as CustomerContractStatus,
      );
      return { status: 200, body: updated };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'GET' && path === '/customer-portfolios') {
    try {
      const customerId = searchParams.get('customerId') ?? undefined;
      return { status: 200, body: services.customers.listPortfolios(scope, customerId) };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'POST' && path === '/customer-portfolios') {
    const input = isRecord(body) ? body : {};
    try {
      const created = services.customers.createPortfolio(scope, {
        customerId: String(input.customerId ?? ''),
        tenantId: String(input.tenantId ?? scope.tenantId ?? 'trackmind'),
        name: String(input.name ?? 'Portfolio'),
        jurisdiction: String(input.jurisdiction ?? 'US'),
        racetrackIds: Array.isArray(input.racetrackIds) ? input.racetrackIds.map(String) : undefined,
      });
      return { status: 201, body: created };
    } catch (err) {
      return isolationError(err);
    }
  }

  const portfolioTrackMatch = path.match(/^\/customer-portfolios\/([^/]+)\/racetracks$/);
  if (method === 'POST' && portfolioTrackMatch) {
    const input = isRecord(body) ? body : {};
    try {
      const updated = services.customers.addRacetrackToPortfolio(
        decodeURIComponent(portfolioTrackMatch[1]),
        scope,
        String(input.racetrackId ?? ''),
      );
      return { status: 200, body: updated };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'GET' && path === '/customer-success/plans') {
    try {
      return { status: 200, body: services.success.listSuccessPlans(scope) };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'POST' && path === '/customer-success/assign') {
    const input = isRecord(body) ? body : {};
    try {
      const plan = services.success.assignSuccessManager(scope, {
        customerId: String(input.customerId ?? ''),
        successManagerId: String(input.successManagerId ?? 'csm-unassigned'),
        successManagerName: String(input.successManagerName ?? 'Unassigned'),
        objectives: Array.isArray(input.objectives) ? input.objectives.map(String) : undefined,
      });
      return { status: 201, body: plan };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'POST' && path === '/customer-success/refresh') {
    try {
      return {
        status: 200,
        body: {
          generatedAt: new Date().toISOString(),
          plans: services.success.refreshHealthScores(scope),
          mock: false,
        },
      };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'GET' && path === '/customer-onboarding/workflows') {
    try {
      const customerId = searchParams.get('customerId') ?? undefined;
      return { status: 200, body: services.workflows.listWorkflows(scope, customerId) };
    } catch (err) {
      return isolationError(err);
    }
  }

  if (method === 'POST' && path === '/customer-onboarding/workflows') {
    const input = isRecord(body) ? body : {};
    try {
      const wf = services.workflows.startWorkflow(scope, {
        customerId: String(input.customerId ?? ''),
        workflowTemplateId: String(input.workflowTemplateId ?? 'workflow-org-launch'),
        tenantId: input.tenantId ? String(input.tenantId) : undefined,
        racetrackId: input.racetrackId ? String(input.racetrackId) : undefined,
      });
      return { status: 201, body: wf };
    } catch (err) {
      return isolationError(err);
    }
  }

  const workflowStepMatch = path.match(/^\/customer-onboarding\/workflows\/([^/]+)\/steps\/([^/]+)$/);
  if (method === 'POST' && workflowStepMatch) {
    const input = isRecord(body) ? body : {};
    try {
      const updated = services.workflows.completeStep(
        decodeURIComponent(workflowStepMatch[1]),
        scope,
        decodeURIComponent(workflowStepMatch[2]),
        input.completedBy ? String(input.completedBy) : undefined,
      );
      return { status: 200, body: updated };
    } catch (err) {
      return isolationError(err);
    }
  }

  return undefined;
}
