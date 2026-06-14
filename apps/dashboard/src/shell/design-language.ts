import { domainScreens, type DomainScreenDefinition } from './domains.js';
import { navItems, navSections, type NavItem } from './navigation.js';

export const commandLanguageRequirementKeywords = [
  'spacing',
  'grid',
  'hierarchy',
  'accessibility',
  'safety',
  'evidence',
  'approval',
  'audit',
  'twin',
] as const;

export type CommandLanguageRequirementKeyword = typeof commandLanguageRequirementKeywords[number];

export interface CommandLanguagePrinciple {
  id: string;
  title: string;
  summary: string;
  requirements: CommandLanguageRequirementKeyword[];
}

export interface CommandLanguageComponentCategory {
  id: string;
  title: string;
  components: string[];
  requirements: CommandLanguageRequirementKeyword[];
  usage: string;
}

export interface WorkspaceCommandLanguageRequirement {
  id: NavItem['id'];
  label: string;
  route: string;
  section: string;
  owner: string;
  layoutRequirements: CommandLanguageRequirementKeyword[];
  safetyRequirements: CommandLanguageRequirementKeyword[];
  deepLinks: string[];
  source: 'navigation-and-domain-registry';
}

export interface CommandLanguageAuditResult {
  workspaceIds: string[];
  missingInNavigation: string[];
  missingInDomainScreens: string[];
  missingInCommandLanguage: string[];
  missingRequirementKeywords: string[];
}

const domainScreenById = new Map(domainScreens.map((screen) => [screen.id, screen]));
const navSectionLabelById = new Map(navSections.map((section) => [section.id, section.label]));

function screenForNavItem(item: NavItem): DomainScreenDefinition {
  const screen = domainScreenById.get(item.id);
  if (!screen) throw new Error(`Command language missing domain screen for ${item.id}`);
  return screen;
}

export const commandLanguagePrinciples: CommandLanguagePrinciple[] = [
  {
    id: 'command-first-hierarchy',
    title: 'Command-first information hierarchy',
    summary: 'Every workspace starts with operator intent, route context, freshness, and evidence before secondary detail.',
    requirements: ['hierarchy', 'spacing', 'grid', 'evidence'],
  },
  {
    id: 'workspace-grid-consistency',
    title: 'Responsive workspace grid',
    summary: 'Shell, command bar, cards, tables, split panes, maps, and drawers use shared grid and spacing tokens instead of local layout inventions.',
    requirements: ['grid', 'spacing', 'hierarchy', 'accessibility'],
  },
  {
    id: 'accessible-command-surfaces',
    title: 'Accessible command surfaces',
    summary: 'Navigation, status, tables, controls, loading, empty, error, mock, and degraded states expose names, roles, keyboard paths, and focus visibility.',
    requirements: ['accessibility', 'hierarchy', 'safety'],
  },
  {
    id: 'human-governed-safety',
    title: 'Human-governed safety',
    summary: 'Safety-critical actions remain approval-gated, evidence-backed, audited, and never autonomously executed from the dashboard.',
    requirements: ['safety', 'approval', 'evidence', 'audit', 'twin'],
  },
  {
    id: 'evidence-over-assertion',
    title: 'Evidence over assertion',
    summary: 'AI, API Hub, Digital Twin, compliance, approval, and audit views must show source, lineage, mock/live posture, and no-overclaim boundaries.',
    requirements: ['evidence', 'audit', 'twin', 'approval', 'safety'],
  },
];

export const componentCategories: CommandLanguageComponentCategory[] = [
  {
    id: 'shell-navigation',
    title: 'Shell and navigation',
    components: ['WorkspaceLayout', 'PageHeader', 'CommandBar', 'NavigationGroupLinks', 'MobileNavigationDrawer'],
    requirements: ['hierarchy', 'grid', 'spacing', 'accessibility'],
    usage: 'Owns persistent sidebar, top command bar, breadcrumbs, tenant context, jump links, route badges, and active workspace framing.',
  },
  {
    id: 'status-and-state',
    title: 'Status and state feedback',
    components: ['StatusIndicator', 'RiskBadge', 'ApprovalChip', 'LoadingSkeleton', 'EmptyState', 'ErrorState', 'MockDataBanner'],
    requirements: ['accessibility', 'safety', 'evidence', 'hierarchy'],
    usage: 'Keeps loading, empty, error, degraded, mock, readiness, and risk posture visible without implying operational authority.',
  },
  {
    id: 'evidence-and-governance',
    title: 'Evidence and governance',
    components: ['EvidenceList', 'RecordSourceLabel', 'AuditEventRow', 'GovernedActionButton', 'SafetyCriticalButton', 'ActionRail'],
    requirements: ['evidence', 'approval', 'audit', 'safety', 'accessibility'],
    usage: 'Displays evidence, source labels, locked controls, approval APIs, audit records, and protected-action reasons.',
  },
  {
    id: 'workspace-content',
    title: 'Workspace content structures',
    components: ['NexusCard', 'KpiTile', 'MetricStrip', 'DataTableShell', 'SplitPane', 'DetailDrawer', 'TrackMapPanel'],
    requirements: ['grid', 'spacing', 'hierarchy', 'twin', 'accessibility'],
    usage: 'Provides reusable cards, KPI strips, tables, panes, drawers, and map/twin panels that keep workspace content aligned to the shell.',
  },
  {
    id: 'artifact-api-hub',
    title: 'Artifact and API Hub visibility',
    components: ['ArtifactFrameworkPanel', 'Racing Data API Hub workspace', 'API Hub deep links'],
    requirements: ['evidence', 'audit', 'approval', 'twin', 'safety', 'hierarchy'],
    usage: 'Presents provider, ingestion, lineage, artifact, training, and storage metadata as read-only evidence surfaces with no execution controls.',
  },
];

export const routeWorkspaceLayoutRequirements = {
  shell: [
    'Use the shared two-column Nexus shell with persistent role-aware navigation and responsive mobile drawer.',
    'Frame every active route inside the command-center content region with skip-link access and canonical route metadata.',
  ],
  spacingAndGrid: [
    'Use --tm-space-* tokens, --tm-layout-gutter, --tm-layout-section-gap, and auto-fit workspace grids for cards, panels, tables, and maps.',
    'Avoid one-off margins or stacked legacy islands that bypass the route-content frame.',
  ],
  hierarchy: [
    'Start with PageHeader, command/status context, active route summary, source/freshness, and mutation boundary before detailed panels.',
    'Keep executive, platform, safety, and workspace-specific drill-downs route-scoped instead of stacking all workspaces at once.',
  ],
} as const;

export const accessibilityRequirements = [
  'Every route, navigation group, command bar, drawer, table, filter, alert, status, and control must have an accessible name.',
  'Keyboard navigation must preserve active route state, focus visibility, skip links, and mobile navigation semantics.',
  'Loading, empty, error, degraded, mock, permission denied, and not-found states must be announced with role=status or role=alert as appropriate.',
  'Color, risk, approval, and readiness signals must also be conveyed through text, data attributes, or labels.',
] as const;

export const safetyApprovalUiRules = [
  'Safety-critical controls stay disabled unless authentication, live backend state, and matching human approval evidence are present.',
  'Mock, degraded, offline, artifact, API Hub, and Digital Twin views are read-only decision-support surfaces unless a backend approval API issues authority.',
  'Protected actions must show required approval API, locked reason, evidence requirement, audit linkage, and human authority boundary.',
  'AI outputs remain advisory; recommendations, forecasts, simulations, and draft actions cannot mutate operations, approve themselves, patch twins, or execute protected commands.',
] as const;

export const workspaceCommandLanguageRequirements: WorkspaceCommandLanguageRequirement[] = navItems.map((item) => {
  const screen = screenForNavItem(item);
  const hasStateChangingActions = screen.stateChangingActions.length > 0;
  return {
    id: item.id,
    label: item.label,
    route: item.path,
    section: navSectionLabelById.get(item.section) ?? item.section,
    owner: screen.owner,
    layoutRequirements: ['spacing', 'grid', 'hierarchy', 'accessibility'],
    safetyRequirements: hasStateChangingActions
      ? ['safety', 'evidence', 'approval', 'audit', 'twin']
      : ['safety', 'evidence', 'audit', 'twin'],
    deepLinks: item.deepLinks?.map((link) => link.path) ?? [],
    source: 'navigation-and-domain-registry',
  };
});

export const currentDesignStateFound = [
  'Dashboard shell uses a persistent sidebar, top command bar, breadcrumbs, tenant selector, notifications, command palette, jump links, and active route frame.',
  'CSS custom properties in server-rendered tokens define TrackMind spacing, grid, density, radius, elevation, color, risk, status, focus, and layout primitives.',
  'Shared Nexus UI primitives cover page headers, layout, cards, KPIs, tables, filters, mock/error/loading states, split panes, drawers, evidence, approvals, audit rows, and safety-critical buttons.',
  'Navigation and domain metadata register first-class workspaces, role visibility, mock/live boundaries, readiness, OS coverage, Universal Schema coverage, approval-required actions, evidence, audit, and Digital Twin posture.',
  'API Hub and Universal Artifact views are present as read-only governance/evidence surfaces with no execution endpoints or browser-side mutation path.',
] as const;

export const oldDesignIssuesDiscovered = [
  'Legacy one-page route assumptions are quarantined through redirects and the shared command-center shell.',
  'Older route coverage assertions counted 21 workspaces and missed the first-class Racing Data API Hub route.',
  'Shared upgrade metadata lagged dashboard navigation for API Hub workspace coverage.',
  'Some legacy CSS aliases remain intentionally quarantined while component rules migrate to --tm-* tokens.',
  'Artifact framework visibility lives under Platform Health today, so the design language must keep artifact/API Hub surfaces explicit until a dedicated workspace presentation is expanded.',
] as const;

export const trackMindCommandLanguage = {
  id: 'trackmind-command-language',
  version: 'trackmind.command-language.v1',
  name: 'TrackMind Nexus Command Language',
  principles: commandLanguagePrinciples,
  componentCategories,
  routeWorkspaceLayoutRequirements,
  accessibilityRequirements,
  safetyApprovalUiRules,
  workspaceRequirements: workspaceCommandLanguageRequirements,
  currentDesignStateFound,
  oldDesignIssuesDiscovered,
} as const;

export function auditCommandLanguageCoverage(): CommandLanguageAuditResult {
  const navIds = new Set(navItems.map((item) => item.id));
  const screenIds = new Set(domainScreens.map((screen) => screen.id));
  const languageIds = new Set(workspaceCommandLanguageRequirements.map((workspace) => workspace.id));
  const serialized = JSON.stringify(trackMindCommandLanguage).toLowerCase();

  return {
    workspaceIds: [...languageIds],
    missingInNavigation: [...languageIds].filter((id) => !navIds.has(id)),
    missingInDomainScreens: [...languageIds].filter((id) => !screenIds.has(id)),
    missingInCommandLanguage: [...new Set([...navIds, ...screenIds])].filter((id) => !languageIds.has(id)),
    missingRequirementKeywords: commandLanguageRequirementKeywords.filter((keyword) => !serialized.includes(keyword)),
  };
}
