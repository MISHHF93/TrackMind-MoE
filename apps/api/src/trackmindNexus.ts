import { normalizeProtectedActionIntent, protectedActions, type ProtectedAction } from '@trackmind/shared';
import { ImmutableAuditLog } from './auditLog.js';
import { CentralizedApprovalService, type ApprovalActor, type ControlledAction } from './approvals.js';
import { DigitalTwinRuntime } from './digitalTwinRuntime.js';
import { EnterpriseServiceRegistry, type ApiServiceDefinition } from './enterpriseApiGateway.js';
import { UniversalEventBus, bindAuditLogToEvents, type EventContract } from './eventBus.js';
import { facilitiesMaintenanceApiDefinition } from './facilitiesMaintenance.js';
import { RacetrackAssetRegistryService, type AssetPrincipal } from './racetrackAssetRegistryService.js';
import { racetrackAssetControlRegistry } from './racetrackControlRegistry.js';

export const nexusCapabilityAreas = ['operations','race-office','surface-intelligence','starting-gate-control','asset-registry','approvals','audit-review'] as const;
export type NexusCapabilityArea = typeof nexusCapabilityAreas[number];

export interface NexusDashboardPanel { area: NexusCapabilityArea; title: string; apiServiceId: string; eventTypes: string[]; safetyControl: string }
export interface NexusSafetyDecision { allowed: boolean; reason: string; requiresHumanApproval: boolean; protectedAction?: ProtectedAction | string; }

const owner = { service: 'trackmind-nexus', team: 'racetrack-platform', accountableRole: 'nexus-platform-owner' };
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const controlledActionByIntent: Record<string, ControlledAction> = {
  'start-race': 'race-start',
  'stop-race': 'race-stop',
  'declare-official-results': 'official-results',
  'modify-official-results': 'modify-official-results',
  'scratch-horse': 'scratch-horse',
  'clear-veterinary-flag': 'clear-vet-flag',
  'issue-steward-ruling': 'steward-ruling',
  'trigger-payout': 'payout',
  'override-emergency-personnel': 'emergency-personnel-override',
  'execute-safety-critical-control': 'safety-critical-control',
};

export class TrackMindNexusFoundation {
  readonly eventBus: UniversalEventBus;
  readonly auditLog: ImmutableAuditLog;
  readonly approvals: CentralizedApprovalService;
  readonly assets: RacetrackAssetRegistryService;
  readonly twins: DigitalTwinRuntime;
  readonly apiRegistry: EnterpriseServiceRegistry;
  private readonly auditUnsubscribe: () => void;

  constructor(options: { eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog } = {}) {
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.approvals = new CentralizedApprovalService({ eventBus: this.eventBus, auditLog: this.auditLog });
    this.assets = new RacetrackAssetRegistryService({ eventBus: this.eventBus, auditLog: this.auditLog });
    this.twins = new DigitalTwinRuntime({ eventBus: this.eventBus, auditLog: this.auditLog, approvals: this.approvals });
    this.apiRegistry = new EnterpriseServiceRegistry();
    this.auditUnsubscribe = bindAuditLogToEvents(this.eventBus, this.auditLog, { consumerName: 'nexus-immutable-audit-sink' });
    this.registerNexusEvents();
    this.registerApis();
  }

  async seedControlRegistry(principal: AssetPrincipal): Promise<number> {
    const foundationSeedAssets = racetrackAssetControlRegistry.slice(0, 3);
    for (const asset of foundationSeedAssets) {
      await this.assets.create({
        assetId: asset.assetId, externalIds: [], name: asset.assetType, assetType: asset.assetType, domain: asset.domain, riskLevel: asset.riskLevel,
        maintenance: { status: String((asset.state as Record<string, unknown>).maintenanceStatus ?? 'ok').toLowerCase() === 'out_of_service' ? 'out-of-service' : 'ok' },
        ownership: { ownerAgent: asset.ownerAgent, stewardTeam: `${asset.domain}-stewards` }, location: asset.location, state: asset.state, controls: asset.controls,
        sensors: asset.sensors, regulations: asset.regulations, tags: [asset.domain, asset.assetType.toLowerCase()], digitalTwin: { twinId: `twin:${asset.assetId}`, relationship: 'represents' },
        approvalPolicyId: asset.riskLevel === 'high' || asset.riskLevel === 'critical' ? 'critical-asset-dual-control' : 'standard-asset-approval', metadata: { azureTwinModel: `dtmi:trackmind:${asset.assetType};1` },
      }, principal);
    }
    return foundationSeedAssets.length;
  }

  evaluateAiAction(input: { activity: string; requestedAction?: string; actorType: 'human'|'ai-agent'|'service'; approvalToken?: unknown }): NexusSafetyDecision {
    const advisory = ['recommend','simulate','classify','forecast','create-draft-action','summarize'].includes(input.activity);
    if (!advisory) return { allowed: false, reason: 'AI activity is outside the advisory boundary', requiresHumanApproval: false, protectedAction: input.requestedAction };
    const normalizedAction = input.requestedAction ? normalizeProtectedActionIntent(input.requestedAction) : undefined;
    if (normalizedAction && protectedActions.includes(normalizedAction as ProtectedAction)) return { allowed: true, reason: 'AI may draft or recommend only; execution requires authorized human approval.', requiresHumanApproval: true, protectedAction: normalizedAction };
    return { allowed: true, reason: 'Advisory AI activity permitted with event and audit capture.', requiresHumanApproval: false };
  }

  requestProtectedExecution(input: { tenantId: string; requestedAction: string; target: string; requestedBy: string; actorType: 'human'|'ai-agent'|'service'; reason: string; evidence: string[] }) {
    const action = controlledActionByIntent[input.requestedAction] ?? normalizeProtectedActionIntent(input.requestedAction) as ControlledAction;
    return this.approvals.createRequest({ tenantId: input.tenantId, action, target: input.target, requestedBy: input.requestedBy, actorType: input.actorType, reason: input.reason, evidence: input.evidence });
  }

  approveAndAuthorize(requestId: string, actor: ApprovalActor, reason: string, evidence: string[], request: { action: ControlledAction; target: string; tenantId: string }) {
    this.approvals.decide(requestId, actor, 'approved', reason, evidence);
    return this.approvals.authorizeExecution({ requestId, action: request.action, target: request.target, tenantId: request.tenantId, actor });
  }

  dashboards(): NexusDashboardPanel[] { return [
    { area: 'operations', title: 'Operations command', apiServiceId: 'trackmind-nexus-operations', eventTypes: ['race-start-requested','incident-created'], safetyControl: 'Readiness and incident actions are approval-gated.' },
    { area: 'race-office', title: 'Race office', apiServiceId: 'trackmind-nexus-race-office', eventTypes: ['race-start-requested','approval.requested'], safetyControl: 'Scratches and official results require authorized officials.' },
    { area: 'surface-intelligence', title: 'Surface intelligence', apiServiceId: 'digital-twin-runtime', eventTypes: ['telemetry.observed','digital-twin.state.patch'], safetyControl: 'AI forecasts maintenance; humans execute surface controls.' },
    { area: 'starting-gate-control', title: 'Starting-gate control', apiServiceId: 'racetrack-asset-registry', eventTypes: ['racetrack.asset.updated','approval.execution-authorized'], safetyControl: 'Gate lock/readiness controls remain human-only.' },
    { area: 'asset-registry', title: 'Asset registry', apiServiceId: 'racetrack-asset-registry', eventTypes: ['racetrack.asset.created','racetrack.asset.approved'], safetyControl: 'High-risk assets use dual-control approval policy.' },
    { area: 'approvals', title: 'Approvals workbench', apiServiceId: 'trackmind-nexus-governance', eventTypes: ['approval.requested','approval.approved','approval.rejected'], safetyControl: 'AI agents and services cannot approve controlled actions.' },
    { area: 'audit-review', title: 'Audit review', apiServiceId: 'trackmind-nexus-governance', eventTypes: ['system-event','digital-twin-update'], safetyControl: 'Every event, API, AI, workflow, service, and asset action is hash-chained.' },
  ]; }

  health() { return { events: this.eventBus.events().length, deadLetters: this.eventBus.deadLetterQueue().length, auditValid: this.auditLog.verify().valid, twins: this.twins.queryTwins().length, apis: this.apiRegistry.discover().length, dashboards: this.dashboards().length }; }
  close() { this.auditUnsubscribe(); }

  private registerNexusEvents() { ['nexus.ai.recommendation.created','nexus.workflow.requested','nexus.api.invoked','approval.requested','approval.approved','approval.rejected','approval.execution-authorized'].forEach((type) => this.eventBus.registerEvent({ type, version: 1, description: `TrackMind Nexus ${type}`, owner, payloadFields: [], compliance: type.includes('approval') ? 'regulated' : 'internal' } as EventContract)); }
  private registerApis() { [this.assets.apiDefinition(), this.twins.apiDefinition(), facilitiesMaintenanceApiDefinition(), nexusApiDefinition('trackmind-nexus-operations','operations','/api/v1/operations'), nexusApiDefinition('trackmind-nexus-race-office','race-office','/api/v1/race-office'), nexusApiDefinition('trackmind-nexus-governance','governance','/api/v1/governance')].forEach((api) => this.apiRegistry.register(api)); }
}

function nexusApiDefinition(id: string, domain: string, basePath: string): ApiServiceDefinition { return { id, name: id.split('-').map((p) => p[0].toUpperCase()+p.slice(1)).join(' '), domain, version: 'v1', basePath, description: 'TrackMind Nexus safety-critical Azure-first API surface with approvals, audits, events, and Digital Twin integration.', owner: { team: 'racetrack-platform', productOwner: 'Director of Racing Operations', technicalOwner: 'Nexus Platform Owner', supportChannel: '#trackmind-nexus' }, lifecycle: 'active', auth: ['jwt','oauth2','mtls'], rateLimit: { requests: 600, perSeconds: 60, burst: 100 }, tags: ['nexus','safety-critical','azure'], slo: { availability: 99.95, latencyMs: 250 }, endpoints: [{ method: 'GET', path: '/', summary: 'List operational resources', scopes: ['read:any'] }, { method: 'POST', path: '/workflows', summary: 'Create an approval-gated workflow', scopes: ['ai:approve'] }, { method: 'GET', path: '/audit', summary: 'Review immutable audit evidence', scopes: ['compliance:audit'] }] }; }

export function createTrackMindNexusFoundation() { return new TrackMindNexusFoundation(); }
