export const customerManagementSchemaVersion = 'trackmind.customer-management.v1' as const;

export type CustomerLifecycleStatus = 'prospect' | 'onboarding' | 'active' | 'at-risk' | 'churned' | 'suspended';
export type CustomerContractStatus = 'draft' | 'pending-signature' | 'active' | 'renewal-pending' | 'expired' | 'terminated';
export type ContactRole = 'executive-sponsor' | 'operations-lead' | 'technical-admin' | 'billing' | 'compliance' | 'success-liaison';
export type OnboardingWorkflowStatus = 'not-started' | 'in-progress' | 'blocked' | 'completed';
export type HealthBand = 'healthy' | 'watch' | 'at-risk' | 'critical';

export interface SupportTierDefinition {
  id: string;
  name: string;
  order: number;
  responseTimeHours: number;
  channels: string[];
  successManagerAssigned: boolean;
  quarterlyBusinessReview: boolean;
  slaUptimePercent: number;
}

export interface SupportTiersConfig {
  schemaVersion: 'trackmind.support-tiers.v1';
  tiers: SupportTierDefinition[];
}

export interface OnboardingWorkflowStepTemplate {
  id: string;
  title: string;
  required: boolean;
}

export interface OnboardingWorkflowTemplate {
  id: string;
  name: string;
  scope: 'organization' | 'tenant' | 'racetrack';
  steps: OnboardingWorkflowStepTemplate[];
}

export interface OnboardingWorkflowsConfig {
  schemaVersion: 'trackmind.onboarding-workflows.v1';
  workflows: OnboardingWorkflowTemplate[];
}

export interface EnterpriseCustomerDto {
  id: string;
  organizationId: string;
  tenantId?: string;
  legalName: string;
  displayName: string;
  industry: string;
  region: string;
  lifecycleStatus: CustomerLifecycleStatus;
  supportTierId: string;
  subscriptionPlanId?: string;
  accountOwnerId?: string;
  successManagerId?: string;
  primaryContactId?: string;
  racetrackPortfolioIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface CustomerContactDto {
  id: string;
  organizationId: string;
  customerId: string;
  tenantId?: string;
  fullName: string;
  email: string;
  phone?: string;
  role: ContactRole;
  isPrimary: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface CustomerContractDto {
  id: string;
  organizationId: string;
  customerId: string;
  tenantId?: string;
  contractNumber: string;
  title: string;
  status: CustomerContractStatus;
  planId?: string;
  supportTierId: string;
  valueUsd: number;
  currency: string;
  effectiveDate: string;
  expirationDate: string;
  autoRenew: boolean;
  signedByContactId?: string;
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface RacetrackPortfolioDto {
  id: string;
  organizationId: string;
  customerId: string;
  tenantId: string;
  name: string;
  racetrackIds: string[];
  jurisdiction: string;
  operationalStatus: 'planning' | 'onboarding' | 'operational' | 'seasonal' | 'closed';
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface CustomerSuccessPlanDto {
  id: string;
  organizationId: string;
  customerId: string;
  tenantId?: string;
  successManagerId: string;
  successManagerName: string;
  objectives: string[];
  nextReviewAt: string;
  healthScore: number;
  healthBand: HealthBand;
  adoptionScore: number;
  riskFactors: string[];
  createdAt: string;
  updatedAt: string;
  mock: boolean;
}

export interface OnboardingWorkflowInstanceDto {
  id: string;
  organizationId: string;
  customerId: string;
  tenantId?: string;
  racetrackId?: string;
  workflowTemplateId: string;
  status: OnboardingWorkflowStatus;
  steps: Array<{
    stepId: string;
    title: string;
    required: boolean;
    status: 'pending' | 'in-progress' | 'completed' | 'blocked';
    completedAt?: string;
    completedBy?: string;
  }>;
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
  mock: boolean;
}

export interface CustomerHealthMetrics {
  healthScore: number;
  healthBand: HealthBand;
  adoptionScore: number;
  subscriptionActive: boolean;
  modulesEnabled: number;
  modulesTotal: number;
  onboardingProgressPercent: number;
  openRisks: number;
  contractDaysRemaining: number;
}

export interface CustomerAdoptionMetrics {
  workspacesActive: number;
  workspacesEntitled: number;
  apiUsagePercent: number;
  racetracksLive: number;
  racetracksEntitled: number;
  lastActivityAt?: string;
}

export interface CustomerHealthSummaryDto {
  customerId: string;
  organizationId: string;
  displayName: string;
  lifecycleStatus: CustomerLifecycleStatus;
  supportTierId: string;
  health: CustomerHealthMetrics;
  adoption: CustomerAdoptionMetrics;
  generatedAt: string;
  mock: boolean;
}

export interface CustomerExecutiveDashboardDto {
  generatedAt: string;
  schemaVersion: typeof customerManagementSchemaVersion;
  organizationId: string;
  portfolioSummary: {
    totalCustomers: number;
    activeCustomers: number;
    onboardingCustomers: number;
    atRiskCustomers: number;
    totalRacetracks: number;
    operationalRacetracks: number;
  };
  healthDistribution: Array<{ band: HealthBand; count: number }>;
  adoptionOverview: {
    averageAdoptionScore: number;
    averageHealthScore: number;
    modulesAdoptedPercent: number;
  };
  customers: CustomerHealthSummaryDto[];
  recentOnboarding: Array<{ customerId: string; workflowId: string; status: OnboardingWorkflowStatus; progressPercent: number }>;
  supportTierBreakdown: Array<{ tierId: string; tierName: string; customerCount: number }>;
  tenantIsolation: {
    mode: 'strict';
    crossTenantAccessAllowed: false;
    scopedOrganizationId: string;
  };
  mock: boolean;
}

export interface CustomerHealthRefreshResultDto {
  generatedAt: string;
  plans: CustomerSuccessPlanDto[];
  mock: boolean;
}

export interface CustomerManagementWorkspaceDto {
  generatedAt: string;
  schemaVersion: typeof customerManagementSchemaVersion;
  organizationId: string;
  customers: EnterpriseCustomerDto[];
  contacts: CustomerContactDto[];
  contracts: CustomerContractDto[];
  portfolios: RacetrackPortfolioDto[];
  successPlans: CustomerSuccessPlanDto[];
  onboardingWorkflows: OnboardingWorkflowInstanceDto[];
  supportTiers: SupportTierDefinition[];
  configPaths: { supportTiers: string; onboardingWorkflows: string };
  tenantIsolation: { mode: 'strict'; organizationId: string };
  mock: boolean;
}

export interface TenantScopeContext {
  organizationId: string;
  tenantId?: string;
  actorOrganizationId?: string;
}

export function assertTenantScope(scope: TenantScopeContext): void {
  if (scope.actorOrganizationId && scope.actorOrganizationId !== scope.organizationId) {
    throw new Error('tenant_isolation_violation: cross-organization access denied');
  }
}

export function computeHealthBand(score: number): HealthBand {
  if (score >= 80) return 'healthy';
  if (score >= 65) return 'watch';
  if (score >= 45) return 'at-risk';
  return 'critical';
}

export function computeHealthScore(input: {
  subscriptionActive: boolean;
  adoptionScore: number;
  onboardingProgressPercent: number;
  contractDaysRemaining: number;
  openRisks: number;
}): number {
  let score = 0;
  score += input.subscriptionActive ? 25 : 0;
  score += Math.round(input.adoptionScore * 0.35);
  score += Math.round(input.onboardingProgressPercent * 0.2);
  score += input.contractDaysRemaining > 90 ? 10 : input.contractDaysRemaining > 30 ? 5 : 0;
  score -= Math.min(input.openRisks * 8, 24);
  return Math.max(0, Math.min(100, score));
}

export function computeAdoptionScore(modulesEnabled: number, modulesTotal: number, apiUsagePercent: number): number {
  if (modulesTotal === 0) return 0;
  const moduleRatio = (modulesEnabled / modulesTotal) * 70;
  const usageRatio = Math.min(apiUsagePercent, 100) * 0.3;
  return Math.round(Math.min(100, moduleRatio + usageRatio));
}

export function workflowProgressPercent(steps: OnboardingWorkflowInstanceDto['steps']): number {
  if (steps.length === 0) return 0;
  const completed = steps.filter((s) => s.status === 'completed').length;
  return Math.round((completed / steps.length) * 100);
}

export function validateSupportTiersConfig(config: SupportTiersConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (config.schemaVersion !== 'trackmind.support-tiers.v1') errors.push('invalid support tiers schemaVersion');
  const ids = new Set<string>();
  for (const tier of config.tiers) {
    if (ids.has(tier.id)) errors.push(`duplicate support tier: ${tier.id}`);
    ids.add(tier.id);
  }
  return { valid: errors.length === 0, errors };
}

export function validateOnboardingWorkflowsConfig(config: OnboardingWorkflowsConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (config.schemaVersion !== 'trackmind.onboarding-workflows.v1') errors.push('invalid onboarding workflows schemaVersion');
  for (const wf of config.workflows) {
    if (wf.steps.length === 0) errors.push(`${wf.id} must declare steps`);
  }
  return { valid: errors.length === 0, errors };
}
