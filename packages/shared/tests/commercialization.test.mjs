import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkApiContractEntitlement,
  checkFeatureEntitlement,
  createPlanRegistryFromConfig,
  enforcePlanLimits,
  evaluateModuleLicensing,
  validatePlanRegistry,
  validateSaasModulesConfig,
  validateSaasPlansConfig,
} from '../dist/commercialization.js';

const plansConfig = {
  schemaVersion: 'trackmind.saas-plans.v1',
  plans: [
    {
      id: 'plan-test',
      tierId: 'starter',
      name: 'Test Plan',
      summary: 'Test',
      billingInterval: 'monthly',
      priceUsd: 100,
      currency: 'USD',
      visible: true,
      entitlements: {
        modules: ['dashboard', 'raceDay'],
        features: ['race-office', 'approvals'],
        workspaces: ['race-office'],
        apiContracts: ['/api/v1/race-operations/race-office'],
      },
      limits: { racetracks: 1, tenants: 1, users: 10, apiCallsPerMonth: 1000 },
    },
  ],
};

const modulesConfig = {
  schemaVersion: 'trackmind.saas-modules.v1',
  modules: [
    {
      key: 'raceDay',
      name: 'Race Day',
      description: 'Race day ops',
      requiredEntitlements: ['race-office'],
      featureFlagKey: 'race-day-ops',
      enforceable: true,
    },
  ],
};

test('validates configuration-driven plan and module configs', () => {
  assert.deepEqual(validateSaasPlansConfig(plansConfig), { valid: true, errors: [] });
  assert.deepEqual(validateSaasModulesConfig(modulesConfig), { valid: true, errors: [] });
  const registry = createPlanRegistryFromConfig(plansConfig, modulesConfig, { plans: 'plans.json', modules: 'modules.json' });
  assert.deepEqual(validatePlanRegistry(registry), { valid: true, errors: [] });
});

test('evaluates feature and API entitlements from plan registry', () => {
  const registry = createPlanRegistryFromConfig(plansConfig, modulesConfig, { plans: 'plans.json', modules: 'modules.json' });
  assert.equal(checkFeatureEntitlement(registry, 'plan-test', 'active', 'race-office').allowed, true);
  assert.equal(checkFeatureEntitlement(registry, 'plan-test', 'active', 'ai-governance').allowed, false);
  assert.equal(checkApiContractEntitlement(registry, 'plan-test', 'active', '/api/v1/race-operations/race-office').allowed, true);
  assert.equal(checkApiContractEntitlement(registry, 'plan-test', 'suspended', '/api/v1/race-operations/race-office').allowed, false);
});

test('enforces plan limits and module licensing', () => {
  const registry = createPlanRegistryFromConfig(plansConfig, modulesConfig, { plans: 'plans.json', modules: 'modules.json' });
  const modules = evaluateModuleLicensing(registry, 'plan-test', 'active');
  assert.equal(modules.find((m) => m.key === 'raceDay')?.enabled, true);
  const limits = enforcePlanLimits(
    plansConfig.plans[0].limits,
    { racetracks: 2, tenants: 1, users: 5, apiCallsPerMonth: 500 },
  );
  assert.equal(limits.withinLimits, false);
  assert.ok(limits.violations.includes('racetrack_limit_exceeded'));
});
