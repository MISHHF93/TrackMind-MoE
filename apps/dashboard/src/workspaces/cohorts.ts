import { canonicalRoutes, type BackendDependency, type CanonicalRoute } from '../routes/registry.js';

export type WorkspaceCohortId = 'operations' | 'track-race' | 'equine-safety' | 'facilities-governance' | 'executive-platform';
export type WorkspaceRenderStrategy = 'module' | 'command-center-compat';

export interface WorkspaceModuleRecord {
  routeId: CanonicalRoute['id'];
  path: string;
  title: string;
  cohort: WorkspaceCohortId;
  moduleId: string;
  renderStrategy: WorkspaceRenderStrategy;
  approvalActions: CanonicalRoute['approvalActions'];
  auditDependencies: BackendDependency[];
  realtimeDependencies: BackendDependency[];
  mockBoundary: {
    allowed: boolean;
    labelled: true;
  };
  safetyPosture: CanonicalRoute['safetyPosture'];
}

const cohortByRouteId: Record<CanonicalRoute['id'], WorkspaceCohortId> = {
  operations: 'operations',
  'race-office': 'track-race',
  'track-configuration': 'track-race',
  'starting-gate': 'track-race',
  surface: 'track-race',
  equine: 'equine-safety',
  barns: 'equine-safety',
  stewards: 'equine-safety',
  safety: 'equine-safety',
  security: 'equine-safety',
  emergency: 'equine-safety',
  assets: 'facilities-governance',
  'digital-twin': 'facilities-governance',
  facilities: 'facilities-governance',
  workforce: 'facilities-governance',
  approvals: 'facilities-governance',
  audit: 'facilities-governance',
  compliance: 'facilities-governance',
  'ai-governance': 'facilities-governance',
  'api-hub': 'executive-platform',
  executive: 'executive-platform',
  'platform-health': 'executive-platform',
};

function renderStrategyFor(route: CanonicalRoute): WorkspaceRenderStrategy {
  const extractedModules = new Set<CanonicalRoute['id']>(['race-office', 'track-configuration', 'starting-gate', 'surface', 'approvals', 'audit', 'api-hub']);
  return extractedModules.has(route.id) ? 'module' : 'command-center-compat';
}

function recordForRoute(route: CanonicalRoute): WorkspaceModuleRecord {
  return {
    routeId: route.id,
    path: route.path,
    title: route.title,
    cohort: cohortByRouteId[route.id],
    moduleId: `workspaces/${cohortByRouteId[route.id]}/${route.component}`,
    renderStrategy: renderStrategyFor(route),
    approvalActions: route.approvalActions,
    auditDependencies: route.backendDependencies.filter((dependency) => dependency.kind === 'audit'),
    realtimeDependencies: route.backendDependencies.filter((dependency) => dependency.kind === 'event-stream'),
    mockBoundary: {
      allowed: route.backendDependencies.some((dependency) => dependency.kind === 'mock-fixture'),
      labelled: true,
    },
    safetyPosture: route.safetyPosture,
  };
}

export const workspaceModules: WorkspaceModuleRecord[] = canonicalRoutes.map(recordForRoute);
export const workspaceModuleByRouteId = Object.fromEntries(workspaceModules.map((workspace) => [workspace.routeId, workspace])) as Record<CanonicalRoute['id'], WorkspaceModuleRecord>;

export function workspaceModulesForCohort(cohort: WorkspaceCohortId) {
  return workspaceModules.filter((workspace) => workspace.cohort === cohort);
}

export function auditWorkspaceCohorts() {
  return {
    workspaceCount: workspaceModules.length,
    compatibilityRendered: workspaceModules.filter((workspace) => workspace.renderStrategy === 'command-center-compat').map((workspace) => workspace.routeId),
    moduleRendered: workspaceModules.filter((workspace) => workspace.renderStrategy === 'module').map((workspace) => workspace.routeId),
    missingApprovalBoundaries: workspaceModules.filter((workspace) => workspace.safetyPosture.posture !== 'read-only' && workspace.approvalActions.length === 0).map((workspace) => workspace.routeId),
    missingMockLabels: workspaceModules.filter((workspace) => workspace.mockBoundary.allowed && !workspace.mockBoundary.labelled).map((workspace) => workspace.routeId),
  };
}
