import type {
  ArtifactImplementationStatus,
  RacingOperatingCapability,
  TechnologyArtifactBinding,
} from './racingOperatingModel.js';
import { racingOperatingDomains, type RacingOperatingDomain } from './racingOperatingDomains.js';

export const racingOsConvergenceSchemaVersion = 'trackmind.racing-os-convergence.v1' as const;

export const racingOsConvergencePrinciple =
  'Every major Racing OS domain converges on eleven technology dimensions: domain model, shared types, API layer, database support, events, approvals, audits, KPIs, dashboards, AI context, and documentation.';

/** Eleven convergence dimensions required on every major domain. */
export const racingOsConvergenceDimensions = [
  'domain-model',
  'shared-types',
  'api-contract',
  'database-support',
  'event-model',
  'approval-workflow',
  'audit-artifact',
  'kpi-artifact',
  'dashboard-view',
  'ai-context-source',
  'documentation',
] as const;

export type RacingOsConvergenceDimension = typeof racingOsConvergenceDimensions[number];

/** @deprecated Use racingOsConvergenceDimensions — retained for transitional imports. */
export const technologyArtifactDimensions = racingOsConvergenceDimensions;

export type TechnologyArtifactDimension = RacingOsConvergenceDimension;

export const convergenceDimensionLabels: Record<RacingOsConvergenceDimension, string> = {
  'domain-model': 'Domain model',
  'shared-types': 'Shared types',
  'api-contract': 'API layer',
  'database-support': 'Database support',
  'event-model': 'Events',
  'approval-workflow': 'Approvals',
  'audit-artifact': 'Audits',
  'kpi-artifact': 'KPIs',
  'dashboard-view': 'Dashboards',
  'ai-context-source': 'AI context support',
  documentation: 'Documentation',
};

const STATUS_RANK: Record<ArtifactImplementationStatus, number> = {
  implemented: 5,
  partial: 4,
  'wired-reference': 3,
  'readiness-metadata': 2,
  'next-hardening': 1,
};

const LEGACY_DIMENSION_MAP: Record<string, RacingOsConvergenceDimension> = {
  'reporting-capability': 'documentation',
};

const DOMAIN_SHARED_TYPES: Record<RacingOperatingDomain, string> = {
  racetrack: 'packages/shared/src/trackConfiguration.ts',
  'race-meeting': 'packages/shared/src/racingCalendar.ts',
  'race-card': 'packages/shared/src/raceCardManagement.ts',
  race: 'packages/shared/src/raceOperations.ts',
  horse: 'packages/shared/src/horseRegistry.ts,equineWelfareIntelligence.ts',
  owner: 'packages/shared/src/horseRegistry.ts',
  trainer: 'packages/shared/src/trainerManagement.ts',
  jockey: 'packages/shared/src/jockeyManagement.ts',
  veterinarian: 'packages/shared/src/veterinaryOperations.ts,equineWelfareIntelligence.ts',
  steward: 'packages/shared/src/stewardOperations.ts',
  official: 'packages/shared/src/raceOperations.ts',
  facility: 'packages/shared/src/facilitiesMaintenance.ts',
  fan: 'packages/shared/src/fanExperienceOperations.ts',
  security: 'packages/shared/src/securityOps.ts',
  compliance: 'packages/shared/src/complianceControlLibrary.ts',
  finance: 'packages/shared/src/racingFinanceOperations.ts',
  'data-provider': 'packages/shared/src/racingArtifacts.ts',
  'federation-participant': 'packages/shared/src/industryIntelligence.ts,federation.ts',
};

const DOMAIN_DATABASE: Record<RacingOperatingDomain, string> = {
  racetrack: 'db/migrations/008_canonical_business_domains.sql',
  'race-meeting': 'db/migrations/008_canonical_business_domains.sql',
  'race-card': 'db/migrations/008_canonical_business_domains.sql',
  race: 'db/migrations/008_canonical_business_domains.sql',
  horse: 'db/migrations/002_dtdl_core_entities.sql,db/seeds/*equine*',
  owner: 'db/migrations/002_dtdl_core_entities.sql',
  trainer: 'db/migrations/008_canonical_business_domains.sql',
  jockey: 'db/migrations/008_canonical_business_domains.sql',
  veterinarian: 'db/migrations/008_canonical_business_domains.sql',
  steward: 'db/migrations/008_canonical_business_domains.sql',
  official: 'db/migrations/008_canonical_business_domains.sql',
  facility: 'db/migrations/012_canonical_database_design.sql',
  fan: 'db/migrations/016_nexus_platform_expansion.sql',
  security: 'db/migrations/008_canonical_business_domains.sql',
  compliance: 'db/migrations/010_canonical_audit_contract.sql',
  finance: 'db/migrations/008_canonical_business_domains.sql',
  'data-provider': 'db/migrations/012_canonical_database_design.sql',
  'federation-participant': 'db/migrations/007_kpi_artifacts.sql,db/seeds/002_kpi_seed.sql',
};

const DOMAIN_DOCUMENTATION: Record<RacingOperatingDomain, string> = {
  racetrack: 'docs/architecture/racing-operating-model-expansion-sequence.md',
  'race-meeting': 'docs/architecture/racing-operating-model-expansion-sequence.md',
  'race-card': 'docs/architecture/racing-data-api-hub.md',
  race: 'docs/architecture/event-backbone.md',
  horse: 'docs/architecture/unified-data-model.md',
  owner: 'docs/architecture/racing-operating-model-expansion-sequence.md',
  trainer: 'docs/architecture/racing-operating-model-expansion-sequence.md',
  jockey: 'docs/architecture/racing-operating-model-expansion-sequence.md',
  veterinarian: 'docs/architecture/unified-data-model.md',
  steward: 'docs/architecture/IMPLEMENTATION_TRACEABILITY.md',
  official: 'docs/architecture/racing-operating-model-expansion-sequence.md',
  facility: 'docs/architecture/enterprise-blueprint.md',
  fan: 'docs/architecture/nexus-platform-expansion.md',
  security: 'docs/architecture/enterprise-blueprint.md',
  compliance: 'docs/architecture/universal-artifact-framework.md',
  finance: 'docs/architecture/kpi-artifacts.md',
  'data-provider': 'docs/architecture/racing-data-api-hub.md',
  'federation-participant': 'docs/architecture/racing-operating-system-standardization-framework.md',
};

export interface RacingOsDomainConvergenceDto {
  domainId: RacingOperatingDomain;
  displayName: string;
  osBranch: RacingOperatingCapability['osBranch'];
  kpiDomain: string;
  dimensions: Array<{
    dimension: RacingOsConvergenceDimension;
    label: string;
    status: ArtifactImplementationStatus;
    reference: string;
    description: string;
    converged: boolean;
  }>;
  convergedDimensions: number;
  totalDimensions: number;
  convergencePct: number;
  inconsistencies: string[];
}

export interface RacingOsConvergenceReportDto {
  generatedAt: string;
  schemaVersion: typeof racingOsConvergenceSchemaVersion;
  principle: string;
  dimensions: RacingOsConvergenceDimension[];
  domainProfiles: RacingOsDomainConvergenceDto[];
  summary: {
    totalDomains: number;
    fullyConvergedDomains: number;
    averageConvergencePct: number;
    implementedBindings: number;
    partialBindings: number;
    readinessBindings: number;
    inconsistenciesResolved: number;
  };
  guardrails: {
    singleCoherentOperatingSystem: true;
    rawCrossTrackRecordSharing: false;
    advisoryAiOnly: true;
    approvalGovernedMutations: true;
  };
  mock: false;
}

function defaultArtifact(
  domain: RacingOperatingDomain,
  dimension: RacingOsConvergenceDimension,
): TechnologyArtifactBinding {
  const entity = Array.isArray(getEntityKindPlaceholder(domain))
    ? `domainKernel:${capitalize(domain)}Entity`
    : `domainKernel:${capitalize(String(getEntityKindPlaceholder(domain)))}Entity`;

  switch (dimension) {
    case 'domain-model':
      return { dimension, status: 'implemented', reference: entity, description: `Canonical ${domain} domain entity` };
    case 'shared-types':
      return { dimension, status: 'implemented', reference: DOMAIN_SHARED_TYPES[domain], description: 'Shared TypeScript contracts exported from @trackmind/shared' };
    case 'api-contract':
      return { dimension, status: 'partial', reference: `GET /api/v1/ros/operating-model#${domain}`, description: `${capitalize(domain)} API surface (normalize during convergence)` };
    case 'database-support':
      return { dimension, status: 'wired-reference', reference: DOMAIN_DATABASE[domain], description: 'Canonical migration and seed references' };
    case 'event-model':
      return { dimension, status: 'wired-reference', reference: `${domain.replace(/-/g, '.')}.lifecycle.v1`, description: 'Lifecycle event contract reference' };
    case 'approval-workflow':
      return { dimension, status: 'wired-reference', reference: 'protected:domain-mutation', description: 'Protected action approval reference' };
    case 'audit-artifact':
      return { dimension, status: 'wired-reference', reference: `audit:${domain}.changed`, description: 'Immutable audit binding reference' };
    case 'kpi-artifact':
      return { dimension, status: 'readiness-metadata', reference: `kpi:${domain}:readiness`, description: 'KPI artifact registry binding' };
    case 'dashboard-view':
      return { dimension, status: 'partial', reference: `/dashboard#${domain}`, description: 'Command-center or domain workspace route' };
    case 'ai-context-source':
      return { dimension, status: 'readiness-metadata', reference: `ai-context:${domain}`, description: 'Advisory-only AI context source' };
    case 'documentation':
      return { dimension, status: 'implemented', reference: DOMAIN_DOCUMENTATION[domain], description: 'Architecture documentation anchor' };
    default:
      return { dimension, status: 'readiness-metadata', reference: domain, description: 'Convergence placeholder' };
  }
}

function capitalize(value: string) {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function getEntityKindPlaceholder(domain: RacingOperatingDomain) {
  return domain;
}

function remapDimension(dimension: string): RacingOsConvergenceDimension {
  return (LEGACY_DIMENSION_MAP[dimension] ?? dimension) as RacingOsConvergenceDimension;
}

function isConverged(status: ArtifactImplementationStatus): boolean {
  return status === 'implemented' || status === 'partial' || status === 'wired-reference';
}

export function normalizeCapabilityArtifacts(cap: RacingOperatingCapability): {
  capability: RacingOperatingCapability;
  inconsistencies: string[];
} {
  const inconsistencies: string[] = [];
  const byDimension = new Map<RacingOsConvergenceDimension, TechnologyArtifactBinding>();

  for (const binding of cap.artifacts) {
    const dimension = remapDimension(binding.dimension);
    if (!racingOsConvergenceDimensions.includes(dimension)) {
      inconsistencies.push(`${cap.id}: dropped unknown artifact dimension ${binding.dimension}`);
      continue;
    }
    const existing = byDimension.get(dimension);
    if (!existing || STATUS_RANK[binding.status] > STATUS_RANK[existing.status]) {
      if (existing && existing.reference !== binding.reference) {
        inconsistencies.push(`${cap.id}: merged duplicate ${dimension} artifacts`);
      }
      byDimension.set(dimension, { ...binding, dimension });
    }
  }

  for (const dimension of racingOsConvergenceDimensions) {
    if (!byDimension.has(dimension)) {
      byDimension.set(dimension, defaultArtifact(cap.id, dimension));
      inconsistencies.push(`${cap.id}: filled missing ${dimension} during convergence`);
    }
  }

  return {
    capability: {
      ...cap,
      artifacts: racingOsConvergenceDimensions.map((dimension) => byDimension.get(dimension)!),
    },
    inconsistencies,
  };
}

export function normalizeRacingOperatingCapabilities(
  capabilities: readonly RacingOperatingCapability[],
): { capabilities: RacingOperatingCapability[]; inconsistencies: string[] } {
  const normalized: RacingOperatingCapability[] = [];
  const inconsistencies: string[] = [];
  for (const cap of capabilities) {
    const result = normalizeCapabilityArtifacts(cap);
    normalized.push(result.capability);
    inconsistencies.push(...result.inconsistencies);
  }
  return { capabilities: normalized, inconsistencies };
}

export function buildDomainConvergenceProfile(cap: RacingOperatingCapability): RacingOsDomainConvergenceDto {
  const dimensions = cap.artifacts.map((binding) => ({
    dimension: binding.dimension,
    label: convergenceDimensionLabels[binding.dimension],
    status: binding.status,
    reference: binding.reference,
    description: binding.description,
    converged: isConverged(binding.status),
  }));
  const convergedDimensions = dimensions.filter((entry) => entry.converged).length;
  return {
    domainId: cap.id,
    displayName: cap.displayName,
    osBranch: cap.osBranch,
    kpiDomain: cap.kpiDomain,
    dimensions,
    convergedDimensions,
    totalDimensions: racingOsConvergenceDimensions.length,
    convergencePct: Math.round((convergedDimensions / racingOsConvergenceDimensions.length) * 100),
    inconsistencies: [],
  };
}

export function buildRacingOsConvergenceReport(
  capabilities: readonly RacingOperatingCapability[],
  timestamp = new Date().toISOString(),
  resolvedInconsistencies: string[] = [],
): RacingOsConvergenceReportDto {
  const domainProfiles = capabilities.map(buildDomainConvergenceProfile);
  const implementedBindings = capabilities.reduce(
    (sum, cap) => sum + cap.artifacts.filter((artifact) => artifact.status === 'implemented').length,
    0,
  );
  const partialBindings = capabilities.reduce(
    (sum, cap) => sum + cap.artifacts.filter((artifact) => artifact.status === 'partial' || artifact.status === 'wired-reference').length,
    0,
  );
  const readinessBindings = capabilities.reduce(
    (sum, cap) => sum + cap.artifacts.filter((artifact) => artifact.status === 'readiness-metadata' || artifact.status === 'next-hardening').length,
    0,
  );
  const averageConvergencePct = Math.round(
    domainProfiles.reduce((sum, profile) => sum + profile.convergencePct, 0) / Math.max(1, domainProfiles.length),
  );

  return {
    generatedAt: timestamp,
    schemaVersion: racingOsConvergenceSchemaVersion,
    principle: racingOsConvergencePrinciple,
    dimensions: [...racingOsConvergenceDimensions],
    domainProfiles,
    summary: {
      totalDomains: domainProfiles.length,
      fullyConvergedDomains: domainProfiles.filter((profile) => profile.convergencePct === 100).length,
      averageConvergencePct,
      implementedBindings,
      partialBindings,
      readinessBindings,
      inconsistenciesResolved: resolvedInconsistencies.length,
    },
    guardrails: {
      singleCoherentOperatingSystem: true,
      rawCrossTrackRecordSharing: false,
      advisoryAiOnly: true,
      approvalGovernedMutations: true,
    },
    mock: false,
  };
}

export function validateRacingOsConvergence(capabilities: readonly RacingOperatingCapability[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (capabilities.length !== racingOperatingDomains.length) {
    errors.push(`expected ${racingOperatingDomains.length} domain capabilities, received ${capabilities.length}`);
  }

  for (const cap of capabilities) {
    if (cap.artifacts.length !== racingOsConvergenceDimensions.length) {
      errors.push(`capability ${cap.id} must expose exactly ${racingOsConvergenceDimensions.length} convergence dimensions`);
    }
    for (const dimension of racingOsConvergenceDimensions) {
      if (!cap.artifacts.some((artifact) => artifact.dimension === dimension)) {
        errors.push(`capability ${cap.id} missing convergence dimension: ${dimension}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
