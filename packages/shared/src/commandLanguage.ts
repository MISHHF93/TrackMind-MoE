export const trackMindCommandLanguageVersion = 'trackmind.command-language.v1' as const;

export const commandLanguageWorkspaceIds = [
  'operations',
  'race-office',
  'track-configuration',
  'starting-gate',
  'surface',
  'equine',
  'barns',
  'stewards',
  'safety',
  'security',
  'emergency',
  'assets',
  'digital-twin',
  'facilities',
  'workforce',
  'approvals',
  'audit',
  'compliance',
  'ai-governance',
  'api-hub',
  'executive',
  'platform-health',
] as const;

export type CommandLanguageWorkspaceId = typeof commandLanguageWorkspaceIds[number];

export const commandLanguageWorkspaceSections = [
  'page-header',
  'operational-summary-row',
  'primary-work-area',
  'evidence-detail-side-panel',
  'event-timeline',
  'approval-context',
  'audit-context',
  'digital-twin-context',
] as const;

export type CommandLanguageWorkspaceSection = typeof commandLanguageWorkspaceSections[number];

export const commandLanguageNavGroups = [
  'Operations',
  'Equine',
  'Safety',
  'Facilities',
  'Governance',
  'Intelligence',
  'Executive',
  'Platform Admin',
] as const;

export const commandLanguageComponentCategories = [
  'cards',
  'panels',
  'data-tables',
  'maps',
  'timelines',
  'alerts',
  'approvals',
  'audit-rows',
  'confidence-badges',
  'digital-twin-cards',
  'safety-critical-controls',
] as const;

export type CommandLanguageComponentCategory = typeof commandLanguageComponentCategories[number];

export interface TrackMindCommandLanguagePrinciple {
  id: string;
  title: string;
  description: string;
  requiredSignals: string[];
}

export interface TrackMindCommandLanguage {
  schemaVersion: typeof trackMindCommandLanguageVersion;
  name: 'TrackMind Command Language';
  experienceModel: string;
  principles: TrackMindCommandLanguagePrinciple[];
  navigationGroups: typeof commandLanguageNavGroups;
  requiredWorkspaceSections: typeof commandLanguageWorkspaceSections;
  componentCategories: typeof commandLanguageComponentCategories;
  workspaceIds: typeof commandLanguageWorkspaceIds;
  accessibilityRequirements: string[];
  safetyRequirements: string[];
  routeMetadataRequiredFields: string[];
  collaborationRequirements: string[];
  tenantBoundaryRequirements: string[];
}

export const trackMindCommandLanguage: TrackMindCommandLanguage = {
  schemaVersion: trackMindCommandLanguageVersion,
  name: 'TrackMind Command Language',
  experienceModel: 'Airport operations center + emergency command center + smart-city control room + Digital Twin platform + enterprise SaaS console.',
  principles: [
    {
      id: 'show-what-matters-now',
      title: 'Show what matters now',
      description: 'Surface current operational state, risk, owner, approval posture, and evidence before secondary detail.',
      requiredSignals: ['live-state', 'risk', 'owner', 'approval', 'evidence'],
    },
    {
      id: 'make-actions-governed',
      title: 'Make actions governed',
      description: 'Every state-changing or safety-critical action shows approval requirements and routes through backend approval, event, and audit paths.',
      requiredSignals: ['approval-required', 'audit-ref', 'event-ref', 'disabled-unsafe-control'],
    },
    {
      id: 'preserve-evidence',
      title: 'Preserve evidence',
      description: 'Evidence, lineage, audit, and Digital Twin context remain visible beside decisions and recommendations.',
      requiredSignals: ['evidence-refs', 'lineage', 'audit-refs', 'digital-twin-refs'],
    },
    {
      id: 'reduce-cognitive-load',
      title: 'Reduce cognitive load',
      description: 'Spacing, grids, predictable route groups, and consistent workspace sections organize complex operational information.',
      requiredSignals: ['spacing', 'grid', 'hierarchy', 'route-group'],
    },
    {
      id: 'collaborate-on-artifacts',
      title: 'Collaborate on artifacts',
      description: 'Comments, handoffs, decisions, assignments, and evidence packets attach to operational artifacts, never disconnected chat.',
      requiredSignals: ['targetArtifactId', 'targetArtifactType', 'tenantId', 'auditRefs'],
    },
  ],
  navigationGroups: commandLanguageNavGroups,
  requiredWorkspaceSections: commandLanguageWorkspaceSections,
  componentCategories: commandLanguageComponentCategories,
  workspaceIds: commandLanguageWorkspaceIds,
  accessibilityRequirements: [
    'semantic-landmarks',
    'keyboard-navigation',
    'focus-visible',
    'aria-labels-for-operational-regions',
    'readable-contrast',
    'color-independent-status-indicators',
    'reduced-motion-friendly',
  ],
  safetyRequirements: [
    'AI outputs are labeled, confidence-scored, evidence-linked, and approval-aware.',
    'Safety-critical controls remain disabled until live backend approval and human authorization are verified.',
    'Mock, degraded, incomplete, and placeholder states are explicit.',
    'Official results, steward rulings, veterinary clearances, payouts, emergency overrides, and gate movement execution are never local UI mutations.',
  ],
  routeMetadataRequiredFields: [
    'id',
    'label',
    'path',
    'icon',
    'roleVisibility',
    'requiredPermissions',
    'workspaceGroup',
    'badgeSource',
    'breadcrumbLabel',
    'mockLiveDataState',
    'tenantBoundary',
    'safetyPosture',
  ],
  collaborationRequirements: [
    'tenantId',
    'racetrackId',
    'actorId',
    'targetArtifactId',
    'targetArtifactType',
    'auditRefs',
    'eventRefs',
    'retentionPolicy',
  ],
  tenantBoundaryRequirements: [
    'Tenant and racetrack context visible in command shell.',
    'No cross-tenant data leakage without explicit federation metadata.',
    'SaaS and certified-track candidate labels never claim external certification.',
  ],
};

export function validateTrackMindCommandLanguage(language: TrackMindCommandLanguage = trackMindCommandLanguage) {
  const missingWorkspaceSections = commandLanguageWorkspaceSections.filter((section) => !language.requiredWorkspaceSections.includes(section));
  const missingWorkspaces = commandLanguageWorkspaceIds.filter((workspace) => !language.workspaceIds.includes(workspace));
  return {
    valid: language.schemaVersion === trackMindCommandLanguageVersion && missingWorkspaceSections.length === 0 && missingWorkspaces.length === 0,
    missingWorkspaceSections,
    missingWorkspaces,
    missingRouteMetadataFields: language.routeMetadataRequiredFields.filter((field) => !field),
  };
}
