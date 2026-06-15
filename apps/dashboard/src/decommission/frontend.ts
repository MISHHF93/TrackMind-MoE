import { canonicalRoutes } from '../routes/registry.js';
import { legacyRouteAliases } from '../shell/navigation.js';

export type DecommissionDecision = 'active' | 'quarantined' | 'compatibility' | 'remove-after-stabilization';

export interface FrontendDecommissionItem {
  id: string;
  target: string;
  decision: DecommissionDecision;
  replacement: string;
  reason: string;
}

export const frontendDecommissionManifest: FrontendDecommissionItem[] = [
  {
    id: 'legacy-one-page-dashboard',
    target: '/legacy-one-page-dashboard',
    decision: 'quarantined',
    replacement: 'Canonical AppShell routes from routes/registry.ts',
    reason: 'Deprecated one-page shell must never render an active workspace.',
  },
  {
    id: 'nexus-operational-workspace-blueprint',
    target: '/nexus-operational-workspace-blueprint',
    decision: 'quarantined',
    replacement: 'Workspace cohort registry and AppShell route renderer',
    reason: 'Blueprint page is superseded by canonical workspace cohorts.',
  },
  {
    id: 'app-tsx-compat-command-center',
    target: 'apps/dashboard/src/App.tsx',
    decision: 'compatibility',
    replacement: 'shell/AppShell.tsx, routes/RouteRenderer.tsx, and workspaces/cohorts.ts',
    reason: 'Current SSR fallback and existing tests still rely on CommandCenter while page bodies are extracted.',
  },
  {
    id: 'state-wrapper-duplicates',
    target: 'apps/dashboard/src/components/states.tsx',
    decision: 'remove-after-stabilization',
    replacement: 'components/nexus-ui.tsx state primitives',
    reason: 'Wrappers remain only to preserve import compatibility during staged migration.',
  },
  {
    id: 'embedded-api-fixtures',
    target: 'apps/dashboard/src/api/client.ts',
    decision: 'remove-after-stabilization',
    replacement: 'api/typedApi.ts and explicit fixture adapters',
    reason: 'Mock data must remain labelled and eventually leave the monolithic client.',
  },
];

export function auditFrontendDecommission() {
  const activePaths = new Set(canonicalRoutes.map((route) => route.path));
  const quarantinedAliases = legacyRouteAliases.filter((alias) => alias.status === 'deprecated').map((alias) => alias.from);
  return {
    activeRouteCount: activePaths.size,
    quarantinedAliases,
    activeRoutesUsingQuarantinedPaths: quarantinedAliases.filter((path) => activePaths.has(path)),
    compatibilityItems: frontendDecommissionManifest.filter((item) => item.decision === 'compatibility').map((item) => item.id),
    removalCandidates: frontendDecommissionManifest.filter((item) => item.decision === 'remove-after-stabilization').map((item) => item.id),
  };
}
