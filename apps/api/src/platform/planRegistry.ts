import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPlanRegistryFromConfig,
  validatePlanRegistry,
  validateSaasModulesConfig,
  validateSaasPlansConfig,
  type PlanRegistry,
  type SaasModulesConfig,
  type SaasPlansConfig,
} from '@trackmind/shared';

const moduleDir = dirname(fileURLToPath(import.meta.url));

function resolveRepoRoot(): string {
  const envRoot = process.env.TRACKMIND_REPO_ROOT;
  if (envRoot) return resolve(envRoot);
  return resolve(moduleDir, '../../../../');
}

function configPath(...segments: string[]): string {
  return join(resolveRepoRoot(), 'config', 'saas', ...segments);
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadPlanRegistry(overrides?: {
  plansPath?: string;
  modulesPath?: string;
}): PlanRegistry {
  const plansPath = overrides?.plansPath ?? configPath('plans.json');
  const modulesPath = overrides?.modulesPath ?? configPath('modules.json');
  const plansConfig = readJsonFile<SaasPlansConfig>(plansPath);
  const modulesConfig = readJsonFile<SaasModulesConfig>(modulesPath);
  const plansValidation = validateSaasPlansConfig(plansConfig);
  if (!plansValidation.valid) throw new Error(`Invalid plans config: ${plansValidation.errors.join('; ')}`);
  const modulesValidation = validateSaasModulesConfig(modulesConfig);
  if (!modulesValidation.valid) throw new Error(`Invalid modules config: ${modulesValidation.errors.join('; ')}`);
  const registry = createPlanRegistryFromConfig(plansConfig, modulesConfig, { plans: plansPath, modules: modulesPath });
  const registryValidation = validatePlanRegistry(registry);
  if (!registryValidation.valid) throw new Error(`Invalid plan registry: ${registryValidation.errors.join('; ')}`);
  return registry;
}

export class PlanRegistryService {
  private registry: PlanRegistry;

  constructor(registry?: PlanRegistry) {
    this.registry = registry ?? loadPlanRegistry();
  }

  reload(): PlanRegistry {
    this.registry = loadPlanRegistry();
    return this.registry;
  }

  get(): PlanRegistry {
    return this.registry;
  }

  listPlans(visibleOnly = true) {
    return visibleOnly ? this.registry.plans.filter((p) => p.visible) : this.registry.plans;
  }

  getPlan(planId: string) {
    return this.registry.plans.find((p) => p.id === planId);
  }

  listModules() {
    return this.registry.modules;
  }
}
