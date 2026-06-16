import type { AdapterSource } from '../api/client';
import { backendSupportLabels, type BackendSupportStatus, type DomainRouteId, type RouteSupportMetadata } from './support';

export type OperatingPhase = 'command' | 'race-day' | 'safety' | 'governance' | 'business' | 'data' | 'platform';

export type CapabilityMode = 'live-review' | 'reference-review' | 'offline-fallback' | 'planned';

export interface OperatingModule {
  id: DomainRouteId;
  phase: OperatingPhase;
  operatorRole: string;
  mission: string;
  functionalToday: string;
  protectedBoundary: string;
  upstreamModules: DomainRouteId[];
  downstreamModules: DomainRouteId[];
}

export interface RecordWiring {
  capabilityMode: CapabilityMode;
  serviceLabel: string;
  evidenceRefs: string[];
  functionalNote: string;
}

const operatingModules: Record<DomainRouteId, OperatingModule> = {
  dashboard: {
    id: 'dashboard',
    phase: 'command',
    operatorRole: 'Race-day command staff',
    mission: 'Scan cross-workstream posture and route operators into the owning console before post time.',
    functionalToday: 'Command widgets, supplemental alerts, governance previews, and workstream launcher are wired to operations and platform health services.',
    protectedBoundary: 'No protected race, payout, or emergency execution starts from the command center.',
    upstreamModules: [],
    downstreamModules: ['raceDay', 'incidents', 'approvals', 'audit', 'settings'],
  },
  raceDay: {
    id: 'raceDay',
    phase: 'race-day',
    operatorRole: 'Racing office and stewards',
    mission: 'Clear readiness, surface, gate, and approval posture before the race office releases the card.',
    functionalToday: 'Race office, readiness dashboard, surface intelligence, and track configuration map services are loaded into the operating board.',
    protectedBoundary: 'Race starts, stops, results, scratches, and gate moves remain backend approval workflows only.',
    upstreamModules: ['dashboard'],
    downstreamModules: ['approvals', 'audit', 'equine', 'facilities'],
  },
  equine: {
    id: 'equine',
    phase: 'race-day',
    operatorRole: 'Veterinary and barn teams',
    mission: 'Confirm horse welfare, eligibility, barn readiness, and privacy-scoped veterinary status.',
    functionalToday: 'Equine intelligence and barn operations workspaces are wired for profile, eligibility, and barn readiness review.',
    protectedBoundary: 'Medical clearance and medication decisions are not exposed as frontend actions.',
    upstreamModules: ['raceDay'],
    downstreamModules: ['approvals', 'audit'],
  },
  approvals: {
    id: 'approvals',
    phase: 'governance',
    operatorRole: 'Authorized human approvers',
    mission: 'Review protected-action requests, escalation posture, required roles, and evidence before backend workflows proceed.',
    functionalToday: 'Live approval request records are loaded from the approvals service; decision handlers remain service-owned.',
    protectedBoundary: 'Approval decisions execute in backend workflows, not from this review console.',
    upstreamModules: ['dashboard', 'raceDay', 'finance', 'facilities'],
    downstreamModules: ['audit'],
  },
  incidents: {
    id: 'incidents',
    phase: 'safety',
    operatorRole: 'Security and operations command',
    mission: 'Maintain incident posture, emergency resources, and response evidence while humans retain command authority.',
    functionalToday: 'Security operations and emergency operations workspaces are merged into the incident command board.',
    protectedBoundary: 'Emergency dispatch and zone command execute outside this read-only console; AI cannot block humans.',
    upstreamModules: ['dashboard'],
    downstreamModules: ['security', 'audit', 'approvals'],
  },
  compliance: {
    id: 'compliance',
    phase: 'governance',
    operatorRole: 'Compliance officers',
    mission: 'Map frameworks, controls, and internal readiness without claiming external certification.',
    functionalToday: 'Compliance control-library facade is wired for framework and control review.',
    protectedBoundary: 'No regulator approval or certification is claimed from this workspace.',
    upstreamModules: ['dataHub', 'federation'],
    downstreamModules: ['audit'],
  },
  security: {
    id: 'security',
    phase: 'safety',
    operatorRole: 'Security operations',
    mission: 'Review masked incidents, camera health, and investigation references for authorized roles.',
    functionalToday: 'Security operations workspace is wired with masked incident and camera-health metadata.',
    protectedBoundary: 'Sensitive-read elevation and investigation mutation remain backend-governed.',
    upstreamModules: ['incidents'],
    downstreamModules: ['audit', 'approvals'],
  },
  facilities: {
    id: 'facilities',
    phase: 'safety',
    operatorRole: 'Track superintendent',
    mission: 'Track asset health, work orders, inspections, and return-to-service approval boundaries.',
    functionalToday: 'Facilities maintenance service is live-wired for assets, work orders, and approval-linked maintenance records.',
    protectedBoundary: 'Return-to-service and safety-critical maintenance transitions are not frontend execution controls.',
    upstreamModules: ['raceDay', 'dashboard'],
    downstreamModules: ['approvals', 'audit'],
  },
  ticketing: {
    id: 'ticketing',
    phase: 'business',
    operatorRole: 'Ticketing and guest services',
    mission: 'Review ticket state, active face value, and race-day coverage without payment capture.',
    functionalToday: 'Finance ticketing workspace is wired for ticket ledger review.',
    protectedBoundary: 'Payment capture and attendee identity mutation are not exposed from the frontend.',
    upstreamModules: ['dashboard'],
    downstreamModules: ['finance', 'audit'],
  },
  finance: {
    id: 'finance',
    phase: 'business',
    operatorRole: 'Finance controllers',
    mission: 'Inspect payout records, dual-control posture, and protected payout boundaries.',
    functionalToday: 'Finance ticketing workspace exposes payout records and dual-control metadata for review.',
    protectedBoundary: 'Payout release requires steward and finance approval in backend workflows.',
    upstreamModules: ['ticketing'],
    downstreamModules: ['approvals', 'audit'],
  },
  federation: {
    id: 'federation',
    phase: 'data',
    operatorRole: 'Federation and compliance ops',
    mission: 'Compare aggregate racetrack readiness without raw cross-track record exposure.',
    functionalToday: 'Federation workspace facade is wired for aggregate profiles and sharing policy review.',
    protectedBoundary: 'No raw cross-track export or tenant provisioning is exposed.',
    upstreamModules: ['compliance'],
    downstreamModules: ['dataHub', 'audit'],
  },
  dataHub: {
    id: 'dataHub',
    phase: 'data',
    operatorRole: 'Data governance operators',
    mission: 'Review provider readiness, lineage, quality, export controls, and license posture.',
    functionalToday: 'Racing data workspace is wired for provider, quality, and export-control metadata.',
    protectedBoundary: 'No live provider pull, scraping, or export execution is exposed from the frontend.',
    upstreamModules: ['federation', 'compliance'],
    downstreamModules: ['audit'],
  },
  audit: {
    id: 'audit',
    phase: 'governance',
    operatorRole: 'Auditors and compliance staff',
    mission: 'Preserve immutable audit events with hash references, actor linkage, and approval context.',
    functionalToday: 'Live audit event ledger is wired from the audit service.',
    protectedBoundary: 'Hash verification workflows remain reference-level until durable storage is fully wired.',
    upstreamModules: ['dashboard', 'approvals', 'raceDay'],
    downstreamModules: [],
  },
  admin: {
    id: 'admin',
    phase: 'platform',
    operatorRole: 'Platform operators',
    mission: 'Monitor reference platform health, dependency declarations, and deployment boundary assumptions.',
    functionalToday: 'Platform health workspace is wired for service status and dependency metadata.',
    protectedBoundary: 'This is reference health metadata, not deployed infrastructure attestation.',
    upstreamModules: ['dashboard'],
    downstreamModules: [],
  },
  settings: {
    id: 'settings',
    phase: 'governance',
    operatorRole: 'AI safety and policy teams',
    mission: 'Review read-only AI guardrails, protected actions, and human approval mappings.',
    functionalToday: 'AI control-plane policy facade is wired for protected-action and governance mapping review.',
    protectedBoundary: 'No model-serving switch, runtime policy mutation, or execution toggles are exposed.',
    upstreamModules: ['dashboard'],
    downstreamModules: ['approvals', 'audit'],
  },
};

export const operatingPhaseLabels: Record<OperatingPhase, string> = {
  command: 'Command',
  'race-day': 'Race day',
  safety: 'Safety',
  governance: 'Governance',
  business: 'Business',
  data: 'Data',
  platform: 'Platform',
};

export function operatingModule(routeId: DomainRouteId): OperatingModule {
  return operatingModules[routeId];
}

export function capabilityModeFor(source: AdapterSource, supportStatus: BackendSupportStatus): CapabilityMode {
  if (source === 'documented-stub') return 'offline-fallback';
  if (supportStatus === 'documented-stub') return 'planned';
  if (source === 'live-api' || supportStatus === 'live-api') return 'live-review';
  return 'reference-review';
}

export function capabilityModeLabel(mode: CapabilityMode): string {
  if (mode === 'live-review') return 'Live review';
  if (mode === 'reference-review') return 'Reference review';
  if (mode === 'offline-fallback') return 'Offline fallback';
  return 'Planned';
}

export function recordWiringForPanel(route: RouteSupportMetadata, panelStatus: string, evidence: string[] | undefined, source: AdapterSource): RecordWiring {
  const capabilityMode = panelStatus === 'implemented'
    ? capabilityModeFor(source, 'live-api')
    : panelStatus === 'facade-only'
      ? capabilityModeFor(source, 'facade-api')
      : capabilityModeFor(source, 'documented-stub');
  const module = operatingModule(route.id);
  const evidenceRefs = Array.isArray(evidence) ? evidence.filter((item) => typeof item === 'string' && item.trim()) : [];
  const serviceHint = evidenceRefs.find((item) => item.startsWith('/api/')) ?? route.backendPaths[0] ?? 'service route unavailable';
  return {
    capabilityMode,
    serviceLabel: backendSupportLabels[route.supportStatus],
    evidenceRefs: evidenceRefs.length ? evidenceRefs.slice(0, 4) : route.backendPaths.slice(0, 2),
    functionalNote: capabilityMode === 'live-review'
      ? `${module.mission} This record is backed by a live service route.`
      : capabilityMode === 'reference-review'
        ? `${module.mission} This record is a reference read model until live telemetry is wired.`
        : `${module.mission} This record is visible from route metadata while service data is unavailable.`,
  };
}

export function linkedModuleLabels(routeId: DomainRouteId): { upstream: string[]; downstream: string[] } {
  const module = operatingModule(routeId);
  return {
    upstream: module.upstreamModules.map((id) => operatingModules[id].id),
    downstream: module.downstreamModules.map((id) => operatingModules[id].id),
  };
}
