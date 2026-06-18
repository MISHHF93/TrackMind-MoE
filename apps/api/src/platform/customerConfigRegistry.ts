import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateOnboardingWorkflowsConfig,
  validateSupportTiersConfig,
  type OnboardingWorkflowsConfig,
  type OnboardingWorkflowTemplate,
  type SupportTierDefinition,
  type SupportTiersConfig,
} from '@trackmind/shared';

const moduleDir = dirname(fileURLToPath(import.meta.url));

function resolveRepoRoot(): string {
  const envRoot = process.env.TRACKMIND_REPO_ROOT;
  if (envRoot) return resolve(envRoot);
  return resolve(moduleDir, '../../../../');
}

function configPath(...segments: string[]): string {
  return join(resolveRepoRoot(), 'config', 'customer-management', ...segments);
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export class CustomerConfigRegistry {
  readonly supportTiers: SupportTierDefinition[];
  readonly onboardingWorkflows: OnboardingWorkflowTemplate[];
  readonly configPaths: { supportTiers: string; onboardingWorkflows: string };

  constructor(overrides?: { supportTiersPath?: string; onboardingWorkflowsPath?: string }) {
    const supportTiersPath = overrides?.supportTiersPath ?? configPath('support-tiers.json');
    const onboardingWorkflowsPath = overrides?.onboardingWorkflowsPath ?? configPath('onboarding-workflows.json');
    const tiersConfig = readJsonFile<SupportTiersConfig>(supportTiersPath);
    const workflowsConfig = readJsonFile<OnboardingWorkflowsConfig>(onboardingWorkflowsPath);
    const tiersValidation = validateSupportTiersConfig(tiersConfig);
    if (!tiersValidation.valid) throw new Error(`Invalid support tiers config: ${tiersValidation.errors.join('; ')}`);
    const workflowsValidation = validateOnboardingWorkflowsConfig(workflowsConfig);
    if (!workflowsValidation.valid) throw new Error(`Invalid onboarding workflows config: ${workflowsValidation.errors.join('; ')}`);
    this.supportTiers = tiersConfig.tiers;
    this.onboardingWorkflows = workflowsConfig.workflows;
    this.configPaths = { supportTiers: supportTiersPath, onboardingWorkflows: onboardingWorkflowsPath };
  }

  getSupportTier(tierId: string): SupportTierDefinition | undefined {
    return this.supportTiers.find((t) => t.id === tierId);
  }

  getWorkflowTemplate(templateId: string): OnboardingWorkflowTemplate | undefined {
    return this.onboardingWorkflows.find((w) => w.id === templateId);
  }
}
