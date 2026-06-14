import { hasPermission, roles as nexusRoles, type Permission, type ProtectedAction, type Role } from '@trackmind/shared';
import { navItems, navSections, routeMetadataById, type NavItem, type NavSection, type RouteMetadata, type RouteRoleVisibility } from './navigation.js';

export type ProductPersonaId =
  | 'race-day-commander'
  | 'race-office-operator'
  | 'track-superintendent'
  | 'gate-crew'
  | 'veterinary-safety'
  | 'barn-manager'
  | 'steward'
  | 'safety-director'
  | 'security-operator'
  | 'emergency-commander'
  | 'facilities-manager'
  | 'workforce-coordinator'
  | 'approval-manager'
  | 'auditor'
  | 'compliance-officer'
  | 'ai-governor'
  | 'executive'
  | 'platform-operator'
  | 'data-platform-admin';

export interface ProductPersona { id: ProductPersonaId; label: string; roles: Role[]; primaryNeed: string }
export interface WorkspaceListEntry { group: NavSection; groupLabel: string; label: string; path: string; summary: string }
export interface RoleVisibilityMetadata extends RouteRoleVisibility { personas: ProductPersonaId[]; rationale: string }
export interface RouteProductCopy { eyebrow: string; title: string; summary: string; loading: string; empty: string; error: string; mock: string; degraded: string }
export interface ProductActionMetadata { id: string; label: string; protectedAction: ProtectedAction | string; approvalApi: string; requiredRoles: Role[]; evidenceRequired: string[]; safetyCritical: boolean; approvalRequired: true; autonomousExecutionAllowed: false; lockReason: string }
export interface MockDataRouteState { allowed: boolean; reason: string; safeForDecisioning: false; operatorCopy: string }
export interface DegradedServiceRouteState { readOnlyAvailable: true; safetyControlsLocked: true; message: string; lockedActions: string[] }

export interface DomainScreenDefinition extends RouteMetadata {
  id: NavItem['id'];
  title: string;
  route: string;
  owner: string;
  liveApi?: string;
  mockReason?: string;
  eventStreams: string[];
  stateChangingActions: string[];
  personas: ProductPersonaId[];
  primaryTasks: string[];
  workspace: WorkspaceListEntry;
  roleVisibility: RoleVisibilityMetadata;
  safetyCriticalActions: ProductActionMetadata[];
  approvalRequiredActions: ProductActionMetadata[];
  mockDataState: MockDataRouteState;
  degradedServiceState: DegradedServiceRouteState;
  productCopy: RouteProductCopy;
}

type BaseDomainScreenDefinition = Omit<DomainScreenDefinition, keyof RouteMetadata>;
type DomainScreenInput = Omit<BaseDomainScreenDefinition, 'route' | 'title' | 'personas' | 'primaryTasks' | 'workspace' | 'roleVisibility' | 'safetyCriticalActions' | 'approvalRequiredActions' | 'mockDataState' | 'degradedServiceState' | 'productCopy'>;

export const productPersonas: ProductPersona[] = [
  { id: 'race-day-commander', label: 'Race Day Commander', roles: ['admin','steward'], primaryNeed: 'Coordinate race-day posture, incidents, approvals, and live event context.' },
  { id: 'race-office-operator', label: 'Race Office Operator', roles: ['racing-secretary','steward'], primaryNeed: 'Prepare cards, scratches, lifecycle changes, and official configuration approvals.' },
  { id: 'track-superintendent', label: 'Track Superintendent', roles: ['track-superintendent'], primaryNeed: 'Manage track configuration, surface conditions, inspections, and maintenance recommendations.' },
  { id: 'gate-crew', label: 'Starting Gate Crew', roles: ['racing-secretary','track-superintendent'], primaryNeed: 'Plan gate moves and GPS verification without direct frontend actuation.' },
  { id: 'veterinary-safety', label: 'Veterinary Safety Team', roles: ['veterinarian'], primaryNeed: 'Review welfare, eligibility, and advisory AI health signals.' },
  { id: 'barn-manager', label: 'Barn Manager', roles: ['racing-secretary','veterinarian'], primaryNeed: 'Coordinate stalls, restrictions, access, and barn readiness.' },
  { id: 'steward', label: 'Steward', roles: ['steward'], primaryNeed: 'Review inquiries, evidence, rules, appeal packages, and human-only rulings.' },
  { id: 'safety-director', label: 'Safety Director', roles: ['admin','steward','security'], primaryNeed: 'See safety posture across surface, equine, stewarding, security, emergency, and workforce feeds.' },
  { id: 'security-operator', label: 'Security Operator', roles: ['security'], primaryNeed: 'Monitor restricted zones, credentials, incidents, camera health, and escalations.' },
  { id: 'emergency-commander', label: 'Emergency Commander', roles: ['admin','security'], primaryNeed: 'Coordinate emergency resources, communications, human overrides, and after-action evidence.' },
  { id: 'facilities-manager', label: 'Facilities Manager', roles: ['admin','track-superintendent'], primaryNeed: 'Manage facility assets, inspections, work orders, predictions, and return-to-service gates.' },
  { id: 'workforce-coordinator', label: 'Workforce Coordinator', roles: ['admin','security','track-superintendent'], primaryNeed: 'Review staffing, assignments, certifications, training, and emergency coverage gaps.' },
  { id: 'approval-manager', label: 'Approval Manager', roles: ['admin','steward','compliance-officer'], primaryNeed: 'Review approval queues, evidence, required roles, history, and controlled-action authorization.' },
  { id: 'auditor', label: 'Auditor', roles: ['read-only-auditor','compliance-officer'], primaryNeed: 'Inspect hash-chained audit, route coverage, evidence lineage, and exportable records.' },
  { id: 'compliance-officer', label: 'Compliance Officer', roles: ['compliance-officer'], primaryNeed: 'Own frameworks, controls, evidence packages, filings, and readiness metadata.' },
  { id: 'ai-governor', label: 'AI Governor', roles: ['admin','compliance-officer','steward','track-superintendent','veterinarian'], primaryNeed: 'Review AI recommendations, blocked actions, confidence, evidence, and approvals.' },
  { id: 'executive', label: 'Executive', roles: ['admin','read-only-auditor'], primaryNeed: 'Consume read-only KPIs, trends, and governed decision context.' },
  { id: 'platform-operator', label: 'Platform Operator', roles: ['admin','read-only-auditor'], primaryNeed: 'Monitor service health, degraded frontend state, telemetry, audit, approvals, and route safety.' },
  { id: 'data-platform-admin', label: 'Data Platform Admin', roles: ['admin','compliance-officer','read-only-auditor'], primaryNeed: 'Review racing data providers, ingestion posture, canonical records, license policy, quality, lineage, and exports.' },
];

const personasByRoute: Record<NavItem['id'], ProductPersonaId[]> = {
  operations: ['race-day-commander','executive','platform-operator'],
  'race-office': ['race-office-operator','steward','race-day-commander'],
  'track-configuration': ['track-superintendent','gate-crew','race-office-operator'],
  assets: ['facilities-manager','platform-operator','auditor'],
  facilities: ['facilities-manager','workforce-coordinator','track-superintendent'],
  workforce: ['workforce-coordinator','emergency-commander','facilities-manager'],
  'digital-twin': ['platform-operator','track-superintendent','ai-governor'],
  'starting-gate': ['gate-crew','race-day-commander','track-superintendent'],
  surface: ['track-superintendent','race-day-commander','ai-governor'],
  equine: ['veterinary-safety','barn-manager','ai-governor'],
  barns: ['barn-manager','veterinary-safety','security-operator'],
  stewards: ['steward','auditor','ai-governor'],
  safety: ['safety-director','race-day-commander','emergency-commander'],
  approvals: ['approval-manager','race-day-commander','compliance-officer','ai-governor'],
  audit: ['auditor','compliance-officer','platform-operator'],
  security: ['security-operator','emergency-commander','auditor'],
  emergency: ['emergency-commander','security-operator','workforce-coordinator'],
  compliance: ['compliance-officer','auditor','executive'],
  'ai-governance': ['ai-governor','compliance-officer','track-superintendent','steward'],
  'api-hub': ['data-platform-admin','platform-operator','compliance-officer','auditor'],
  executive: ['executive','race-day-commander','auditor'],
  'platform-health': ['platform-operator','auditor','executive'],
};

const safetyCriticalRouteIds = new Set<NavItem['id']>(['operations','race-office','track-configuration','starting-gate','surface','equine','barns','stewards','safety','security','emergency','assets','digital-twin','facilities','workforce','approvals','compliance','ai-governance']);
const protectedActionByRoute: Partial<Record<NavItem['id'], ProtectedAction | string>> = {
  operations: 'safety-critical-control',
  'race-office': 'race-start',
  'track-configuration': 'safety-critical-control',
  'starting-gate': 'starting-gate-move',
  surface: 'track-closure',
  equine: 'clear-vet-flag',
  barns: 'safety-critical-control',
  stewards: 'steward-ruling',
  safety: 'safety-critical-control',
  security: 'safety-critical-control',
  emergency: 'emergency-action',
  assets: 'safety-critical-control',
  'digital-twin': 'safety-critical-control',
  facilities: 'safety-critical-control',
  workforce: 'emergency-personnel-override',
  approvals: 'safety-critical-control',
  compliance: 'compliance-filing-approval',
  'ai-governance': 'safety-critical-control',
};

function rolesForPermissions(required?: Permission[]): Role[] {
  if (!required?.length) return [...nexusRoles];
  return nexusRoles.filter((role) => required.some((permission) => hasPermission(role, permission)));
}

function productCopy(screen: DomainScreenInput, navItem: NavItem, groupLabel: string): RouteProductCopy {
  const title = navItem.label;
  return {
    eyebrow: groupLabel,
    title,
    summary: `${title} is the ${screen.owner} workspace for ${screen.eventStreams.join(', ')} context inside the shared command-center shell.`,
    loading: `Loading ${title.toLowerCase()} from governed live services.`,
    empty: `No ${title.toLowerCase()} records are available for this racetrack, route, and role.`,
    error: `${title} live data failed to load. Keep the view read-only and verify operational facts outside the frontend before action.`,
    mock: screen.mockReason ?? `${title} has no approved mock fallback; live records are required.`,
    degraded: `${title} remains read-only while degraded services recover; protected controls stay locked.`,
  };
}

function productActions(screen: DomainScreenInput, navItem: NavItem): ProductActionMetadata[] {
  return screen.stateChangingActions.map((action, index) => ({
    id: `${screen.id}-approval-${index + 1}`,
    label: action,
    protectedAction: protectedActionByRoute[screen.id] ?? 'safety-critical-control',
    approvalApi: screen.id === 'track-configuration' || screen.id === 'starting-gate' ? 'POST /api/v1/track-configuration/draft-requests' : 'POST /api/v1/approvals/controlled-actions',
    requiredRoles: rolesForPermissions(navItem.required),
    evidenceRequired: ['operator reason', 'source record', 'audit correlation'],
    safetyCritical: safetyCriticalRouteIds.has(screen.id),
    approvalRequired: true,
    autonomousExecutionAllowed: false,
    lockReason: 'Requires authenticated live backend approval token, audit evidence, and human authorization.',
  }));
}

function domainScreen(screen: DomainScreenInput): DomainScreenDefinition {
  const navItem = navItems.find((item) => item.id === screen.id);
  if (!navItem) throw new Error(`Missing navigation item for domain screen ${screen.id}`);
  const routeMetadata = routeMetadataById[screen.id];
  const section = navSections.find((candidate) => candidate.id === navItem.section);
  const groupLabel = section?.label ?? navItem.section;
  const actions = productActions(screen, navItem);
  const personas = personasByRoute[screen.id];
  return {
    ...screen,
    title: navItem.label,
    route: navItem.path,
    ...routeMetadata,
    personas,
    primaryTasks: [
      `Review ${navItem.label.toLowerCase()} status and exceptions`,
      `Monitor ${screen.eventStreams.join(', ') || 'route'} feeds`,
      ...(screen.stateChangingActions.length ? [`Queue approval-gated actions: ${screen.stateChangingActions.join(', ')}`] : ['Use read-only evidence for decision support']),
    ],
    workspace: { group: navItem.section, groupLabel, label: navItem.label, path: navItem.path, summary: `${navItem.label} appears in the ${groupLabel} workspace list.` },
    roleVisibility: {
      ...routeMetadata.roleVisibility,
      permissions: navItem.required ?? [],
      roles: rolesForPermissions(navItem.required),
      personas,
      rationale: navItem.required?.length ? `Visible to roles with ${navItem.required.join(' or ')} permission.` : 'Visible to authenticated users.',
    },
    safetyCriticalActions: actions.filter((action) => action.safetyCritical),
    approvalRequiredActions: actions,
    mockDataState: {
      allowed: navItem.mockAllowed,
      reason: screen.mockReason ?? 'Live governed records required for this route.',
      safeForDecisioning: false,
      operatorCopy: navItem.mockAllowed ? 'Mock or placeholder data is allowed only when labelled and read-only.' : 'Mock data is blocked for governed decision records on this route.',
    },
    degradedServiceState: {
      readOnlyAvailable: true,
      safetyControlsLocked: true,
      message: 'Show cached or partial read-only context, label delayed feeds, and lock protected controls until live services recover.',
      lockedActions: screen.stateChangingActions,
    },
    productCopy: productCopy(screen, navItem, groupLabel),
  };
}

export const domainScreens: DomainScreenDefinition[] = [
  domainScreen({ id: 'operations', owner: 'Operations Command', liveApi: '/operations/command-center', mockReason: 'backend command-center summary API not implemented in this repo yet', eventStreams: ['race-day', 'incident'], stateChangingActions: ['request incident workflow approval'] }),
  domainScreen({ id: 'race-office', owner: 'Race Office', liveApi: '/race-operations/race-office', mockReason: 'race office write APIs remain approval-gated', eventStreams: ['race-operations'], stateChangingActions: ['request race-start approval', 'request scratch approval', 'request race cancellation approval', 'request official configuration approval', 'request lifecycle status approval'] }),
  domainScreen({ id: 'track-configuration', owner: 'Track Configuration', liveApi: '/track-configuration/map', mockReason: 'configuration execution is approval-gated; map reads are safe', eventStreams: ['track-configuration'], stateChangingActions: ['request rail position approval', 'request turf configuration approval'] }),
  domainScreen({ id: 'assets', owner: 'Asset Intelligence', liveApi: '/assets', mockReason: 'asset registry writes require approval-aware backend commands', eventStreams: ['asset-status'], stateChangingActions: ['request asset status change approval'] }),
  domainScreen({ id: 'facilities', owner: 'Facilities Maintenance', liveApi: '/facilities-maintenance/workspace', mockReason: 'facility work order execution requires approval, audit, workflow, and Digital Twin sync', eventStreams: ['facilities-maintenance'], stateChangingActions: ['request facility work order approval', 'request return-to-service approval'] }),
  domainScreen({ id: 'workforce', owner: 'Workforce Operations', liveApi: '/workforce-operations/workspace', mockReason: 'workforce scheduling actions are governed through approval, audit, and identity evidence', eventStreams: ['workforce-operations'], stateChangingActions: ['request workforce schedule approval'] }),
  domainScreen({ id: 'digital-twin', owner: 'Digital Twin', liveApi: '/digital-twin/state', mockReason: 'digital twin command patches require approval; reads are safe', eventStreams: ['twin-telemetry'], stateChangingActions: ['request twin command approval'] }),
  domainScreen({ id: 'starting-gate', owner: 'Race Control', liveApi: '/starting-gate/position', mockReason: 'starting gate execution is never mocked; only read-only readiness is mocked', eventStreams: ['gate-control'], stateChangingActions: ['request race-start controlled action'] }),
  domainScreen({ id: 'surface', owner: 'Track Surface', liveApi: '/surface-intelligence/workspace', mockReason: 'surface actions such as irrigation or harrowing require approval', eventStreams: ['surface-readings'], stateChangingActions: ['request maintenance closure approval'] }),
  domainScreen({ id: 'equine', owner: 'Equine Safety', liveApi: '/equine-intelligence/horses/{horseId}', mockReason: 'health-related AI is advisory and requires veterinarian review', eventStreams: ['horse-safety'], stateChangingActions: ['request vet flag clearance approval'] }),
  domainScreen({ id: 'barns', owner: 'Barn Operations', liveApi: '/barn-operations/workspace', mockReason: 'barn operations API may be absent in early environments', eventStreams: ['barn-operations'], stateChangingActions: ['request stall move approval', 'request barn restriction approval'] }),
  domainScreen({ id: 'stewards', owner: 'Stewarding', liveApi: '/stewarding/inquiries', mockReason: 'stewarding inquiry API may be absent in early environments', eventStreams: ['steward-inquiry', 'steward-evidence', 'steward-appeal'], stateChangingActions: ['open investigation workflow', 'request human-only ruling approval', 'export appeal package'] }),
  domainScreen({ id: 'safety', owner: 'Safety Operations', mockReason: 'Safety Center composes stewarding, security, emergency, equine, surface, and workforce readiness feeds inside the shared shell', eventStreams: ['race-day', 'horse-safety', 'steward-inquiry', 'security', 'emergency', 'surface-readings'], stateChangingActions: ['route to steward approval workflow', 'route to security approval gate', 'route to emergency authority handoff'] }),
  domainScreen({ id: 'approvals', owner: 'Human Approval Service', liveApi: '/approvals/requests', eventStreams: ['approval'], stateChangingActions: ['approve or reject via approval service'] }),
  domainScreen({ id: 'audit', owner: 'Audit Ledger', liveApi: '/audit/events', eventStreams: ['audit'], stateChangingActions: [] }),
  domainScreen({ id: 'security', owner: 'Security Operations', liveApi: '/security-operations/workspace', mockReason: 'restricted security actions require approval and audit evidence', eventStreams: ['security'], stateChangingActions: ['request security response approval'] }),
  domainScreen({ id: 'emergency', owner: 'Emergency Operations', liveApi: '/emergency-operations/workspace', mockReason: 'human commanders retain authority over emergency workflows', eventStreams: ['emergency'], stateChangingActions: ['request emergency action approval'] }),
  domainScreen({ id: 'compliance', owner: 'Regulatory Compliance', liveApi: '/compliance/control-library', mockReason: 'compliance evidence collection is connected to audit/workflow records', eventStreams: ['compliance'], stateChangingActions: ['request filing approval'] }),
  domainScreen({ id: 'ai-governance', owner: 'Responsible AI Governor', liveApi: '/ai-governance/workspace', mockReason: 'AI Control Plane inputs, feature metadata, model selections, and recommendations remain advisory until approved', eventStreams: ['ai-governance','ai-control-plane-observability'], stateChangingActions: ['approve AI recommendation'] }),
  domainScreen({ id: 'api-hub', owner: 'Racing Data API Hub', liveApi: '/racing-data', mockReason: 'Racing Data API Hub uses shared contract metadata until provider management is live; provider, license, quality, lineage, and export views stay read-only and source-labelled.', eventStreams: ['racing-data-api-hub.provider-status','racing-data-api-hub.ingestion','racing-data-api-hub.lineage'], stateChangingActions: [] }),
  domainScreen({ id: 'executive', owner: 'Executive Decision Support', liveApi: '/operations/command-center', mockReason: 'executive view is derived from governed operations, readiness, compliance, AI, and platform health feeds', eventStreams: ['executive-kpi'], stateChangingActions: [] }),
  domainScreen({ id: 'platform-health', owner: 'Platform Observability', liveApi: '/platform/health', mockReason: 'platform health falls back to cached read-only status when degraded', eventStreams: ['platform-health'], stateChangingActions: [] }),
];
