import type { FeatureFlagDefinitionDto, FeatureFlagEvaluationDto } from '@trackmind/shared';

export function seedFeatureFlags(): FeatureFlagDefinitionDto[] {
  return [
    { key: 'platform-health', description: 'Platform health workspace', defaultEnabled: true, environments: { development: true, staging: true, production: true }, moduleKeys: ['platform-super-admin'], mock: false },
    { key: 'race-day-ops', description: 'Race day operations module', defaultEnabled: true, environments: { development: true, staging: true, production: true }, moduleKeys: ['raceDay', 'surface', 'workforce'], mock: false },
    { key: 'equine-intelligence', description: 'Equine intelligence module', defaultEnabled: true, environments: { development: true, staging: true, production: true }, moduleKeys: ['equine'], mock: false },
    { key: 'fan-experience', description: 'Fan experience module', defaultEnabled: true, environments: { development: true, staging: false, production: false }, moduleKeys: ['fanExperience'], mock: false },
    { key: 'analytics', description: 'Executive analytics module', defaultEnabled: true, environments: { development: true, staging: true, production: true }, moduleKeys: ['analytics'], mock: false },
    { key: 'executive-read-only', description: 'Executive read-only posture', defaultEnabled: false, environments: { development: true, staging: true, production: true }, moduleKeys: ['dashboard'], mock: false },
  ];
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
