import type { OnboardingWorkflowInstanceDto, OnboardingWorkflowStatus, TenantScopeContext } from '@trackmind/shared';
import { assertTenantScope, workflowProgressPercent } from '@trackmind/shared';
import { createRepository, type KeyValueRepository } from '../repository/index.js';
import type { CustomerConfigRegistry } from './customerConfigRegistry.js';
import type { CustomerManagementService } from './customerManagementService.js';

const now = () => new Date().toISOString();

const seedWorkflows = (): OnboardingWorkflowInstanceDto[] => [
  {
    id: 'wf-demo-org',
    organizationId: 'org-trackmind-network',
    customerId: 'cust-trackmind-demo',
    workflowTemplateId: 'workflow-org-launch',
    status: 'completed',
    steps: [
      { stepId: 'contract-signed', title: 'Contract signed', required: true, status: 'completed', completedAt: '2026-01-02T00:00:00.000Z' },
      { stepId: 'identity-provisioned', title: 'Identity provisioned', required: true, status: 'completed', completedAt: '2026-01-03T00:00:00.000Z' },
      { stepId: 'subscription-active', title: 'Subscription activated', required: true, status: 'completed', completedAt: '2026-01-04T00:00:00.000Z' },
      { stepId: 'admin-training', title: 'Admin training completed', required: false, status: 'completed', completedAt: '2026-01-10T00:00:00.000Z' },
    ],
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-10T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
  {
    id: 'wf-demo-track',
    organizationId: 'org-trackmind-network',
    customerId: 'cust-trackmind-demo',
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    workflowTemplateId: 'workflow-racetrack-onboarding',
    status: 'in-progress',
    steps: [
      { stepId: 'track-metadata', title: 'Track metadata captured', required: true, status: 'completed', completedAt: '2026-01-05T00:00:00.000Z' },
      { stepId: 'jurisdiction-mapped', title: 'Jurisdiction mapped', required: true, status: 'completed', completedAt: '2026-01-06T00:00:00.000Z' },
      { stepId: 'digital-twin-seed', title: 'Digital Twin seed reviewed', required: false, status: 'in-progress' },
      { stepId: 'operational-handoff', title: 'Operational handoff complete', required: true, status: 'pending' },
    ],
    startedAt: '2026-01-05T00:00:00.000Z',
    updatedAt: now(),
    mock: false,
  },
];

export class CustomerOnboardingWorkflowService {
  readonly workflows: KeyValueRepository<OnboardingWorkflowInstanceDto>;

  constructor(
    private readonly config: CustomerConfigRegistry,
    private readonly customers: CustomerManagementService,
  ) {
    this.workflows = createRepository(seedWorkflows());
  }

  listWorkflows(scope: TenantScopeContext, customerId?: string): OnboardingWorkflowInstanceDto[] {
    assertTenantScope(scope);
    return this.workflows.list().filter((w) => {
      if (w.organizationId !== scope.organizationId) return false;
      if (scope.tenantId && w.tenantId && w.tenantId !== scope.tenantId) return false;
      if (customerId && w.customerId !== customerId) return false;
      return true;
    });
  }

  getWorkflow(id: string, scope: TenantScopeContext): OnboardingWorkflowInstanceDto | undefined {
    assertTenantScope(scope);
    const wf = this.workflows.get(id);
    if (!wf || wf.organizationId !== scope.organizationId) return undefined;
    if (scope.tenantId && wf.tenantId && wf.tenantId !== scope.tenantId) return undefined;
    return wf;
  }

  startWorkflow(
    scope: TenantScopeContext,
    input: { customerId: string; workflowTemplateId: string; tenantId?: string; racetrackId?: string },
  ): OnboardingWorkflowInstanceDto {
    assertTenantScope(scope);
    const customer = this.customers.getCustomer(input.customerId, scope);
    if (!customer) throw new Error(`customer_not_found:${input.customerId}`);
    const template = this.config.getWorkflowTemplate(input.workflowTemplateId);
    if (!template) throw new Error(`workflow_template_not_found:${input.workflowTemplateId}`);
    const ts = now();
    const record: OnboardingWorkflowInstanceDto = {
      id: `wf-${Date.now().toString(36)}`,
      organizationId: scope.organizationId,
      customerId: input.customerId,
      tenantId: input.tenantId ?? customer.tenantId,
      racetrackId: input.racetrackId,
      workflowTemplateId: input.workflowTemplateId,
      status: 'in-progress',
      steps: template.steps.map((s) => ({
        stepId: s.id,
        title: s.title,
        required: s.required,
        status: 'pending' as const,
      })),
      startedAt: ts,
      updatedAt: ts,
      mock: false,
    };
    this.customers.updateCustomerLifecycle(input.customerId, scope, 'onboarding');
    return this.workflows.upsert(record);
  }

  completeStep(
    workflowId: string,
    scope: TenantScopeContext,
    stepId: string,
    completedBy?: string,
  ): OnboardingWorkflowInstanceDto {
    const wf = this.getWorkflow(workflowId, scope);
    if (!wf) throw new Error(`workflow_not_found:${workflowId}`);
    const ts = now();
    const steps = wf.steps.map((s) =>
      s.stepId === stepId
        ? { ...s, status: 'completed' as const, completedAt: ts, completedBy }
        : s,
    );
    const requiredPending = steps.some((s) => s.required && s.status !== 'completed');
    const status: OnboardingWorkflowStatus = requiredPending ? 'in-progress' : 'completed';
    return this.workflows.upsert({
      ...wf,
      steps,
      status,
      completedAt: status === 'completed' ? ts : wf.completedAt,
      updatedAt: ts,
    });
  }

  progress(wf: OnboardingWorkflowInstanceDto): number {
    return workflowProgressPercent(wf.steps);
  }
}
