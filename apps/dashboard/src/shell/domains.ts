import type { NavItem } from './navigation.js';

export interface DomainScreenDefinition {
  id: NavItem['id'];
  title: string;
  route: string;
  owner: string;
  liveApi?: string;
  mockReason?: string;
  eventStreams: string[];
  stateChangingActions: string[];
}

export const domainScreens: DomainScreenDefinition[] = [
  { id: 'operations', title: 'Operations Command', route: '/operations', owner: 'Operations Command', liveApi: '/operations/command-center', mockReason: 'backend command-center summary API not implemented in this repo yet', eventStreams: ['race-day', 'incident'], stateChangingActions: ['request incident workflow approval'] },
  { id: 'race-office', title: 'Race Office', route: '/race-office', owner: 'Race Office', liveApi: '/race-operations/race-days', mockReason: 'race office write APIs are incomplete', eventStreams: ['race-operations'], stateChangingActions: ['request race start approval'] },
  { id: 'assets', title: 'Asset Registry', route: '/assets', owner: 'Asset Intelligence', liveApi: '/racr/assets', mockReason: 'asset registry list endpoint may be absent in early environments', eventStreams: ['asset-status'], stateChangingActions: ['request asset status change approval'] },
  { id: 'digital-twin', title: 'Digital Twin View', route: '/digital-twin', owner: 'Digital Twin', liveApi: '/digital-twin/graph', mockReason: 'digital twin graph API may be absent in early environments', eventStreams: ['twin-telemetry'], stateChangingActions: ['request twin command approval'] },
  { id: 'starting-gate', title: 'Starting Gate Control', route: '/starting-gate', owner: 'Race Control', liveApi: '/track-configuration/map', mockReason: 'starting gate execution is never mocked; only read-only readiness is mocked', eventStreams: ['gate-control'], stateChangingActions: ['request race-start controlled action'] },
  { id: 'surface', title: 'Surface Intelligence', route: '/surface', owner: 'Track Surface', liveApi: '/track-surface/readings', mockReason: 'surface readings API may be absent in early environments', eventStreams: ['surface-readings'], stateChangingActions: ['request maintenance closure approval'] },
  { id: 'equine', title: 'Equine Intelligence', route: '/equine', owner: 'Equine Safety', liveApi: '/equine-intelligence/flags', mockReason: 'equine intelligence API may be absent in early environments', eventStreams: ['horse-safety'], stateChangingActions: ['request vet flag clearance approval'] },
  { id: 'barns', title: 'Barn Operations', route: '/barns', owner: 'Barn Operations', liveApi: '/barn-operations/workspace', mockReason: 'barn operations API may be absent in early environments', eventStreams: ['barn-operations'], stateChangingActions: ['request stall move approval', 'request barn restriction approval'] },
  { id: 'stewards', title: 'Steward Center', route: '/stewards', owner: 'Stewarding', liveApi: '/stewarding/inquiries', mockReason: 'stewarding inquiry API may be absent in early environments', eventStreams: ['steward-inquiry'], stateChangingActions: ['request ruling approval'] },
  { id: 'approvals', title: 'Approvals', route: '/approvals', owner: 'Human Approval Service', liveApi: '/approvals/requests', eventStreams: ['approval'], stateChangingActions: ['approve or reject via approval service'] },
  { id: 'audit', title: 'Audit Ledger', route: '/audit', owner: 'Audit Ledger', liveApi: '/audit/events', eventStreams: ['audit'], stateChangingActions: [] },
  { id: 'security', title: 'Security', route: '/security', owner: 'Security Operations', liveApi: '/security/incidents', mockReason: 'security operations API may be absent in early environments', eventStreams: ['security'], stateChangingActions: ['request security response approval'] },
  { id: 'emergency', title: 'Emergency Ops', route: '/emergency', owner: 'Emergency Operations', liveApi: '/emergency/incidents', mockReason: 'emergency operations API may be absent in early environments', eventStreams: ['emergency'], stateChangingActions: ['request emergency action approval'] },
  { id: 'compliance', title: 'Compliance', route: '/compliance', owner: 'Regulatory Compliance', liveApi: '/regulatory/compliance', mockReason: 'compliance dashboard API may be absent in early environments', eventStreams: ['compliance'], stateChangingActions: ['request filing approval'] },
  { id: 'ai-governance', title: 'AI Governance', route: '/ai-governance', owner: 'Responsible AI Governor', liveApi: '/ai-governance/recommendations', mockReason: 'AI governance API may be absent in early environments', eventStreams: ['ai-governance'], stateChangingActions: ['approve AI recommendation'] },
  { id: 'executive', title: 'Executive Center', route: '/executive', owner: 'Executive Decision Support', liveApi: '/executive/summary', mockReason: 'executive summary API may be absent in early environments', eventStreams: ['executive-kpi'], stateChangingActions: [] },
];
