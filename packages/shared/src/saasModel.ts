export const trackMindSaasModelVersion = 'trackmind.saas-model.v1' as const;

export const trackMindCloudTierIds = ['starter', 'professional', 'enterprise', 'national'] as const;
export type TrackMindCloudTierId = typeof trackMindCloudTierIds[number];

export const trackMindDeployableModeIds = ['saas', 'private-cloud', 'managed-service', 'franchise-certified-track'] as const;
export type TrackMindDeployableModeId = typeof trackMindDeployableModeIds[number];

export const trackMindSaasRequiredDomains = [
  'race-office',
  'entries',
  'scheduling',
  'approvals',
  'digital-twins',
  'surface-intelligence',
  'asset-registry',
  'compliance',
  'ai-governance',
  'executive-intelligence',
  'command-center',
  'multi-track-federation',
  'benchmarking',
  'industry-analytics',
] as const;
export type TrackMindSaasRequiredDomain = typeof trackMindSaasRequiredDomains[number];

export const trackMindSaasRequiredControls = [
  'tenant-rbac',
  'immutable-audit-ledger',
  'approval-governance',
  'human-in-loop-ai',
  'data-residency',
  'encrypted-secrets',
  'observability',
  'regulated-data-retention',
  'cross-tenant-analytics-guardrails',
] as const;
export type TrackMindSaasRequiredControl = typeof trackMindSaasRequiredControls[number];

export interface TrackMindSaasTenantIsolationPosture {
  model: string;
  dataBoundary: string;
  identityBoundary: string;
  keyManagement: string;
  analyticsBoundary: string;
}

export interface TrackMindSaasFeatureEntitlement {
  id: string;
  title: string;
  domain: TrackMindSaasRequiredDomain;
  workspaceIds: string[];
  apiContracts: string[];
  summary: string;
}

export interface TrackMindCloudTier {
  id: TrackMindCloudTierId;
  name: string;
  order: number;
  summary: string;
  featureEntitlements: TrackMindSaasFeatureEntitlement[];
  requiredControls: TrackMindSaasRequiredControl[];
  deploymentAssumptions: string[];
  tenantIsolationPosture: TrackMindSaasTenantIsolationPosture;
  upgradePath: {
    from?: TrackMindCloudTierId;
    next?: TrackMindCloudTierId;
    unlocks: string[];
    prerequisites: string[];
  };
}

export interface TrackMindDeployableMode {
  id: TrackMindDeployableModeId;
  title: string;
  summary: string;
  defaultForTiers: TrackMindCloudTierId[];
  deploymentAssumptions: string[];
  tenantIsolationPosture: string;
  operationalOwnership: string;
  provisioningImplemented: false;
}

export type TrackMindCertifiedTrackCandidateStatus = 'candidate' | 'ready-for-trackmind-review' | 'action-required';

export interface TrackMindTenantScorecard {
  safetyScore: number;
  complianceScore: number;
  operationalScore: number;
  accreditationScore: number;
}

export interface TrackMindTenantConfiguration {
  timezone: string;
  raceDayStatus: 'open' | 'scheduled' | 'degraded' | 'emergency';
  cloudTier: TrackMindCloudTierId;
  deployableMode: TrackMindDeployableModeId;
  dataResidency: string;
  featureFlags: string[];
}

export interface TrackMindTenantFederationBoundary {
  enabled: boolean;
  aggregationScope: 'tenant-only' | 'explicit-federation';
  aggregationLabel: string;
  allowsCrossTenantAggregation: boolean;
}

export interface TrackMindTenantUxBoundaryMetadata {
  tenantId: string;
  racetrackId: string;
  racetrackName: string;
  tenantIsolationLabel: string;
  roleBoundaryLabel: string;
  configuration: TrackMindTenantConfiguration;
  certifiedTrackCandidateStatus: TrackMindCertifiedTrackCandidateStatus;
  certifiedTrackCandidateStatement: string;
  externalCertificationClaimed: false;
  scorecard: TrackMindTenantScorecard;
  federation: TrackMindTenantFederationBoundary;
  leakageGuardrails: string[];
}

export interface TrackMindSaasModel {
  schemaVersion: typeof trackMindSaasModelVersion;
  title: 'TrackMind OS Tier 7 SaaS Model';
  billingImplemented: false;
  provisioningImplemented: false;
  tiers: TrackMindCloudTier[];
  deployableModes: TrackMindDeployableMode[];
  requiredDomains: TrackMindSaasRequiredDomain[];
  requiredControls: TrackMindSaasRequiredControl[];
  notes: string[];
}

const sharedControls: TrackMindSaasRequiredControl[] = [
  'tenant-rbac',
  'immutable-audit-ledger',
  'approval-governance',
  'encrypted-secrets',
  'observability',
];

const regulatedControls: TrackMindSaasRequiredControl[] = [
  ...sharedControls,
  'human-in-loop-ai',
  'data-residency',
  'regulated-data-retention',
];

const isolation = (model: string, analyticsBoundary: string): TrackMindSaasTenantIsolationPosture => ({
  model,
  dataBoundary: 'Tenant-scoped records, audit events, approvals, Digital Twin references, and operational telemetry remain partitioned by tenant and racetrack identifiers.',
  identityBoundary: 'Microsoft Entra ID or equivalent IdP integration maps users to tenant-scoped TrackMind roles and approval authority.',
  keyManagement: 'Secrets and signing keys are isolated by tenant or deployment boundary through managed identity and key vault assumptions.',
  analyticsBoundary,
});

const entitlement = (id: string, title: string, domain: TrackMindSaasRequiredDomain, workspaceIds: string[], apiContracts: string[], summary: string): TrackMindSaasFeatureEntitlement => ({
  id,
  title,
  domain,
  workspaceIds,
  apiContracts,
  summary,
});

const scorecard = (safetyScore: number, complianceScore: number, operationalScore: number, accreditationScore: number): TrackMindTenantScorecard => ({
  safetyScore,
  complianceScore,
  operationalScore,
  accreditationScore,
});

const tenantOnlyFederationBoundary = (racetrackName: string): TrackMindTenantFederationBoundary => ({
  enabled: false,
  aggregationScope: 'tenant-only',
  aggregationLabel: `${racetrackName} tenant-only view; no cross-tenant aggregation is displayed.`,
  allowsCrossTenantAggregation: false,
});

const certifiedTrackCandidateStatement = 'TrackMind Certified Track candidate status is internal TrackMind readiness metadata only; no external certification, accreditation, regulator approval, or third-party endorsement is claimed.';

export function createTrackMindTenantUxBoundaryMetadata(): TrackMindTenantUxBoundaryMetadata[] {
  return [
    {
      tenantId: 'tenant-saratoga',
      racetrackId: 'saratoga',
      racetrackName: 'Saratoga Race Course',
      tenantIsolationLabel: 'Tenant isolated: Saratoga records, approvals, telemetry, audit, and Digital Twin references stay in tenant-saratoga.',
      roleBoundaryLabel: 'Role boundary: Saratoga users see route metadata through tenant-scoped TrackMind roles only.',
      configuration: {
        timezone: 'America/New_York',
        raceDayStatus: 'open',
        cloudTier: 'enterprise',
        deployableMode: 'saas',
        dataResidency: 'US-East regulated racing operations boundary',
        featureFlags: ['platform-health', 'executive-read-only', 'api-hub-read-only', 'certified-track-candidate'],
      },
      certifiedTrackCandidateStatus: 'candidate',
      certifiedTrackCandidateStatement,
      externalCertificationClaimed: false,
      scorecard: scorecard(88, 91, 87, 84),
      federation: tenantOnlyFederationBoundary('Saratoga Race Course'),
      leakageGuardrails: [
        'Render tenant and racetrack labels on executive, platform health, and API Hub routes.',
        'Do not mix Belmont, mock fallback, or future track records into Saratoga route totals.',
        'Show federation rollups only when an explicit federation aggregate label and authorization exist.',
      ],
    },
    {
      tenantId: 'tenant-belmont',
      racetrackId: 'belmont',
      racetrackName: 'Belmont Park',
      tenantIsolationLabel: 'Tenant isolated: Belmont records, approvals, telemetry, audit, and Digital Twin references stay in tenant-belmont.',
      roleBoundaryLabel: 'Role boundary: Belmont users see route metadata through tenant-scoped TrackMind roles only.',
      configuration: {
        timezone: 'America/New_York',
        raceDayStatus: 'scheduled',
        cloudTier: 'professional',
        deployableMode: 'saas',
        dataResidency: 'US-East regulated racing operations boundary',
        featureFlags: ['platform-health', 'api-hub-read-only', 'certified-track-candidate'],
      },
      certifiedTrackCandidateStatus: 'action-required',
      certifiedTrackCandidateStatement,
      externalCertificationClaimed: false,
      scorecard: scorecard(82, 86, 80, 78),
      federation: tenantOnlyFederationBoundary('Belmont Park'),
      leakageGuardrails: [
        'Render tenant and racetrack labels on executive, platform health, and API Hub routes.',
        'Do not mix Saratoga, mock fallback, or future track records into Belmont route totals.',
        'Show federation rollups only when an explicit federation aggregate label and authorization exist.',
      ],
    },
    {
      tenantId: 'tenant-mock-fallback',
      racetrackId: 'mock-fallback',
      racetrackName: 'Mock Training Track',
      tenantIsolationLabel: 'Tenant isolated: mock training records stay in tenant-mock-fallback and must remain labelled as mock data.',
      roleBoundaryLabel: 'Role boundary: mock fallback users see route metadata through tenant-scoped TrackMind roles only.',
      configuration: {
        timezone: 'UTC',
        raceDayStatus: 'degraded',
        cloudTier: 'starter',
        deployableMode: 'saas',
        dataResidency: 'Mock-only local development boundary',
        featureFlags: ['platform-health', 'api-hub-read-only'],
      },
      certifiedTrackCandidateStatus: 'action-required',
      certifiedTrackCandidateStatement,
      externalCertificationClaimed: false,
      scorecard: scorecard(62, 65, 58, 55),
      federation: tenantOnlyFederationBoundary('Mock Training Track'),
      leakageGuardrails: [
        'Render mock tenant and racetrack labels wherever fallback data appears.',
        'Do not mix mock fallback records into Saratoga, Belmont, or future production route totals.',
        'Show federation rollups only when an explicit federation aggregate label and authorization exist.',
      ],
    },
  ];
}

export function validateTrackMindTenantUxBoundaryMetadata(metadata: TrackMindTenantUxBoundaryMetadata[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tenantIds = new Set<string>();
  const racetrackIds = new Set<string>();
  for (const tenant of metadata) {
    if (!tenant.tenantId) errors.push('tenant boundary missing tenantId');
    if (!tenant.racetrackId) errors.push(`${tenant.tenantId} missing racetrackId`);
    if (tenantIds.has(tenant.tenantId)) errors.push(`duplicate tenantId: ${tenant.tenantId}`);
    if (racetrackIds.has(tenant.racetrackId)) errors.push(`duplicate racetrackId: ${tenant.racetrackId}`);
    tenantIds.add(tenant.tenantId);
    racetrackIds.add(tenant.racetrackId);
    if (!tenant.tenantIsolationLabel.toLowerCase().includes('tenant')) errors.push(`${tenant.tenantId} missing tenant isolation label`);
    if (!tenant.roleBoundaryLabel.toLowerCase().includes('role')) errors.push(`${tenant.tenantId} missing role boundary label`);
    if (tenant.externalCertificationClaimed !== false) errors.push(`${tenant.tenantId} must not claim external certification`);
    if (!/candidate|readiness/i.test(tenant.certifiedTrackCandidateStatement)) errors.push(`${tenant.tenantId} missing certified-track candidate wording`);
    for (const [field, value] of Object.entries(tenant.scorecard)) {
      if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(`${tenant.tenantId} ${field} must be 0-100`);
    }
    if (tenant.federation.allowsCrossTenantAggregation && tenant.federation.aggregationScope !== 'explicit-federation') {
      errors.push(`${tenant.tenantId} cross-tenant aggregation requires explicit federation scope`);
    }
    if (!tenant.federation.allowsCrossTenantAggregation && !/no cross-tenant|tenant-only/i.test(tenant.federation.aggregationLabel)) {
      errors.push(`${tenant.tenantId} tenant-only aggregation label must block cross-tenant rollups`);
    }
    if (!tenant.leakageGuardrails.some((guardrail) => /cross-tenant|mix/i.test(guardrail))) {
      errors.push(`${tenant.tenantId} missing no-leakage guardrail`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export const trackMindCloudTiers: TrackMindCloudTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    order: 1,
    summary: 'Race-office operating core for a single tenant or racetrack launch.',
    featureEntitlements: [
      entitlement('starter-race-office', 'Race Office', 'race-office', ['race-office'], ['/api/v1/race-operations/race-office'], 'Meet, race-day, card, lifecycle, and official configuration workspace metadata.'),
      entitlement('starter-entries', 'Entries', 'entries', ['race-office', 'equine'], ['/api/v1/race-operations/race-office', '/api/v1/equine-intelligence/horses/{horseId}'], 'Entry, declaration, scratch, horse, trainer, owner, and veterinarian review context.'),
      entitlement('starter-scheduling', 'Scheduling', 'scheduling', ['race-office', 'operations', 'workforce'], ['/api/v1/race-day-readiness/dashboard', '/api/v1/workforce-operations/workspace'], 'Race-day scheduling, readiness, staffing, and operational calendar assumptions.'),
      entitlement('starter-approvals', 'Approvals', 'approvals', ['approvals', 'audit'], ['/api/v1/approvals/requests', '/api/v1/approvals/draft-requests'], 'Approval queues, protected action requests, evidence, and audit handoff for human-governed operations.'),
    ],
    requiredControls: sharedControls,
    deploymentAssumptions: ['Single-tenant SaaS default with mock/live adapter parity.', 'No billing, payment collection, or autonomous provisioning is implied by this metadata.'],
    tenantIsolationPosture: isolation('tenant-scoped shared SaaS', 'Tenant analytics are isolated; cross-tenant comparisons are unavailable in Starter.'),
    upgradePath: { next: 'professional', unlocks: ['digital-twins', 'surface-intelligence', 'asset-registry', 'compliance'], prerequisites: ['baseline approvals enabled', 'tenant identity mapping complete'] },
  },
  {
    id: 'professional',
    name: 'Professional',
    order: 2,
    summary: 'Operational intelligence tier for track assets, surfaces, twins, and compliance readiness.',
    featureEntitlements: [
      entitlement('professional-digital-twins', 'Digital Twins', 'digital-twins', ['digital-twin', 'track-configuration', 'assets'], ['/api/v1/digital-twin/state', '/api/v1/track-configuration/map'], 'Read-only Digital Twin state, map overlays, dependencies, and approval-gated sync posture.'),
      entitlement('professional-surface-intelligence', 'Surface Intelligence', 'surface-intelligence', ['surface', 'track-configuration'], ['/api/v1/surface-intelligence/workspace', '/api/v1/track-surface/measurements'], 'Surface scorecards, heatmaps, inspections, forecasts, anomalies, and locked maintenance recommendations.'),
      entitlement('professional-asset-registry', 'Asset Registry', 'asset-registry', ['assets', 'facilities'], ['/api/v1/assets', '/api/v1/facilities-maintenance/workspace'], 'Racetrack asset registry, facility assets, controls, lifecycle posture, and safety-critical approval coverage.'),
      entitlement('professional-compliance', 'Compliance', 'compliance', ['compliance', 'audit'], ['/api/v1/compliance/control-library', '/api/v1/audit/events'], 'Compliance controls, evidence packages, framework mappings, audit readiness, and regulated retention assumptions.'),
    ],
    requiredControls: regulatedControls,
    deploymentAssumptions: ['SaaS or private-cloud deployment can be selected based on data residency needs.', 'Operational controls remain approval-gated; this tier does not provision live actuators.'],
    tenantIsolationPosture: isolation('tenant-scoped SaaS or private cloud', 'Tenant analytics remain isolated unless an Enterprise governance agreement enables aggregate executive rollups.'),
    upgradePath: { from: 'starter', next: 'enterprise', unlocks: ['ai-governance', 'executive-intelligence', 'command-center'], prerequisites: ['asset registry source-of-truth identified', 'compliance owner assigned'] },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    order: 3,
    summary: 'Executive and AI-governed command tier for multi-domain operational leadership.',
    featureEntitlements: [
      entitlement('enterprise-ai-governance', 'AI Governance', 'ai-governance', ['ai-governance', 'approvals', 'audit'], ['/api/v1/ai-governance/workspace', '/api/v1/ai-control-plane/workspace'], 'Responsible AI governance, model registry, advisory-only recommendations, safety blocks, and human approval workflows.'),
      entitlement('enterprise-executive-intelligence', 'Executive Intelligence', 'executive-intelligence', ['executive', 'platform-health'], ['/api/v1/operations/command-center', '/api/v1/platform/health'], 'Executive KPI rollups across safety, operations, compliance, assets, AI, and platform posture.'),
      entitlement('enterprise-command-center', 'Command Center', 'command-center', ['operations', 'platform-health', 'emergency', 'security'], ['/api/v1/operations/command-center', '/api/v1/platform/health'], 'Unified command-center telemetry, events, alerts, Platform Health, security, emergency, and operational readiness views.'),
    ],
    requiredControls: [...regulatedControls, 'cross-tenant-analytics-guardrails'],
    deploymentAssumptions: ['SaaS, private cloud, or managed-service operating models are eligible.', 'Customer-specific command runbooks, incident response, and AI governance boards are assumed.'],
    tenantIsolationPosture: isolation('enterprise tenant boundary with governed rollups', 'Executive analytics may aggregate multiple racetracks only within the same enterprise tenant boundary.'),
    upgradePath: { from: 'professional', next: 'national', unlocks: ['multi-track-federation', 'benchmarking', 'industry-analytics'], prerequisites: ['AI governance board operating', 'executive KPI sources approved', 'platform observability baselined'] },
  },
  {
    id: 'national',
    name: 'National',
    order: 4,
    summary: 'Federation tier for national operators, certified-track programs, and governed industry analytics.',
    featureEntitlements: [
      entitlement('national-multi-track-federation', 'Multi-Track Federation', 'multi-track-federation', ['executive', 'platform-health', 'compliance'], ['/api/v1/platform/nexus-upgrade', '/api/v1/platform/health'], 'Federated tenant metadata for multi-track operators, certification programs, and national oversight.'),
      entitlement('national-benchmarking', 'Benchmarking', 'benchmarking', ['executive', 'platform-health'], ['/api/v1/platform/nexus-upgrade'], 'Governed benchmarking assumptions across tracks without exposing raw tenant operational records.'),
      entitlement('national-industry-analytics', 'Industry Analytics', 'industry-analytics', ['executive', 'compliance', 'ai-governance'], ['/api/v1/platform/nexus-upgrade'], 'Industry analytics metadata with anonymization, approval, compliance, and cross-tenant analytics guardrails.'),
    ],
    requiredControls: [...regulatedControls, 'cross-tenant-analytics-guardrails'],
    deploymentAssumptions: ['National deployments require explicit federation governance and data-sharing agreements.', 'Franchise or certified-track modes can be represented, but no franchise operations workflow is implemented here.'],
    tenantIsolationPosture: isolation('federated tenant boundary with anonymized aggregate analytics', 'Cross-tenant benchmarking and industry analytics require de-identification, contractual authorization, and regulator-ready evidence.'),
    upgradePath: { from: 'enterprise', unlocks: ['certified-track governance', 'industry-level benchmarking', 'federated compliance analytics'], prerequisites: ['multi-track governance agreement', 'analytics anonymization review', 'data-sharing approval evidence'] },
  },
];

export const trackMindDeployableModes: TrackMindDeployableMode[] = [
  {
    id: 'saas',
    title: 'SaaS',
    summary: 'TrackMind-operated shared cloud service with tenant-scoped records and no customer-managed infrastructure.',
    defaultForTiers: ['starter', 'professional', 'enterprise'],
    deploymentAssumptions: ['Azure-first shared services are assumed.', 'Tenant onboarding is metadata-only in this package.'],
    tenantIsolationPosture: 'Logical tenant isolation with tenant IDs, RBAC, audit scopes, and managed keys.',
    operationalOwnership: 'TrackMind owns platform operations; customer owns domain approvals and regulated decisions.',
    provisioningImplemented: false,
  },
  {
    id: 'private-cloud',
    title: 'Private Cloud',
    summary: 'Dedicated cloud boundary for enterprises with stricter residency, network, or procurement requirements.',
    defaultForTiers: ['professional', 'enterprise', 'national'],
    deploymentAssumptions: ['Dedicated Azure subscription, network, or resource group boundary may be required.', 'Provisioning automation is outside this metadata contract.'],
    tenantIsolationPosture: 'Dedicated environment boundary plus tenant-scoped application records.',
    operationalOwnership: 'Shared responsibility between TrackMind and the customer platform owner.',
    provisioningImplemented: false,
  },
  {
    id: 'managed-service',
    title: 'Managed Service',
    summary: 'TrackMind-operated service wrap for customers that need governance, support, and operating runbooks.',
    defaultForTiers: ['enterprise', 'national'],
    deploymentAssumptions: ['Runbooks, incident response, evidence collection, and AI governance cadence are part of service operations.', 'No staffing or SLA billing workflow is implemented.'],
    tenantIsolationPosture: 'Tenant data remains isolated; TrackMind support access is approval, audit, and least-privilege controlled.',
    operationalOwnership: 'TrackMind operates the platform; customer officials retain racing, compliance, and safety authority.',
    provisioningImplemented: false,
  },
  {
    id: 'franchise-certified-track',
    title: 'Franchise / Certified Track',
    summary: 'Certified-track model for federated programs, standard controls, benchmarking, and national governance.',
    defaultForTiers: ['national'],
    deploymentAssumptions: ['Certification controls, federation agreements, and anonymized benchmarking rules must be established outside this code path.', 'No franchise billing, certification workflow, or provisioning workflow is implemented.'],
    tenantIsolationPosture: 'Per-track tenant isolation with approved aggregate analytics only.',
    operationalOwnership: 'Certified track operates local racing decisions; federation owners govern standards and aggregate analytics.',
    provisioningImplemented: false,
  },
];

export function createTrackMindSaasModel(): TrackMindSaasModel {
  return {
    schemaVersion: trackMindSaasModelVersion,
    title: 'TrackMind OS Tier 7 SaaS Model',
    billingImplemented: false,
    provisioningImplemented: false,
    tiers: trackMindCloudTiers,
    deployableModes: trackMindDeployableModes,
    requiredDomains: [...trackMindSaasRequiredDomains],
    requiredControls: [...trackMindSaasRequiredControls],
    notes: [
      'Tier metadata defines entitlements, required controls, deployment assumptions, tenant isolation posture, and upgrade paths only.',
      'Billing, metering, tenant provisioning, cloud resource creation, and franchise certification workflows are intentionally not implemented.',
      'All operational and AI actions inherit TrackMind Nexus human approval, audit, and advisory-only safety boundaries.',
    ],
  };
}

export function validateTrackMindSaasModel(model: TrackMindSaasModel): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (model.schemaVersion !== trackMindSaasModelVersion) errors.push('SaaS model schemaVersion must match trackmind.saas-model.v1');
  if (model.billingImplemented !== false) errors.push('SaaS model must not claim billing implementation');
  if (model.provisioningImplemented !== false) errors.push('SaaS model must not claim provisioning implementation');
  for (const tierId of trackMindCloudTierIds) if (!model.tiers.some((tier) => tier.id === tierId)) errors.push(`cloud tier missing: ${tierId}`);
  for (const modeId of trackMindDeployableModeIds) if (!model.deployableModes.some((mode) => mode.id === modeId)) errors.push(`deployable mode missing: ${modeId}`);
  for (const domain of trackMindSaasRequiredDomains) {
    if (!model.requiredDomains.includes(domain)) errors.push(`required SaaS domain missing: ${domain}`);
    if (!model.tiers.some((tier) => tier.featureEntitlements.some((feature) => feature.domain === domain))) errors.push(`required SaaS domain has no entitlement: ${domain}`);
  }
  for (const control of trackMindSaasRequiredControls) if (!model.requiredControls.includes(control)) errors.push(`required SaaS control missing: ${control}`);
  for (const tier of model.tiers) {
    if (tier.featureEntitlements.length === 0) errors.push(`${tier.id} must declare feature entitlements`);
    if (tier.requiredControls.length === 0) errors.push(`${tier.id} must declare required controls`);
    if (tier.deploymentAssumptions.length === 0) errors.push(`${tier.id} must declare deployment assumptions`);
    if (!tier.tenantIsolationPosture.model || !tier.tenantIsolationPosture.dataBoundary) errors.push(`${tier.id} must declare tenant isolation posture`);
  }
  for (const mode of model.deployableModes) {
    if (mode.provisioningImplemented !== false) errors.push(`${mode.id} must not claim provisioning implementation`);
    if (mode.defaultForTiers.length === 0) errors.push(`${mode.id} must declare default tiers`);
  }
  return { valid: errors.length === 0, errors };
}
