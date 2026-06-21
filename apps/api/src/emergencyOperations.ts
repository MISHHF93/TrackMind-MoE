import { hasPermission, type CanonicalEventRef, type Role } from '@trackmind/shared';
import type { ImmutableAuditLog } from './auditLog.js';
import type { CentralizedApprovalService } from './approvals.js';
import type { UniversalEventBus } from './eventBus.js';
import type { WorkforceReadinessSummary } from './workforceOperations.js';
import type { WorkflowDefinition, WorkflowOrchestrationEngine } from './workflowEngine.js';

export type EmergencyScenario =
  | 'severe-weather'
  | 'medical-emergency'
  | 'fire-incident'
  | 'infrastructure-failure'
  | 'evacuation'
  | 'security-incident'
  | 'business-continuity'
  | 'disaster-recovery';

export type IncidentSeverity = 'watch' | 'minor' | 'major' | 'critical';
export type EmergencyRoleName = 'incident-commander' | 'safety-officer' | 'public-information-officer' | 'operations-section' | 'planning-section' | 'logistics-section' | 'medical-lead' | 'fire-lead' | 'weather-lead' | 'evacuation-lead';
export type EmergencyResourceKind = 'personnel' | 'medical' | 'fire' | 'weather' | 'transport' | 'shelter' | 'communications' | 'equipment';
export type EmergencyWorkflowStatus = 'draft' | 'active' | 'demobilizing' | 'closed';
export type EmergencyEventType = 'emergency.incident.opened' | 'emergency.workflow.activated' | 'emergency.communication.completed' | 'emergency.drill.completed' | 'emergency.after-action.created' | 'emergency.digital-twin.patch.requested' | 'incident.post-incident-review.synced';

export interface OperationalSystemLink { system: string; status: 'online' | 'degraded' | 'offline'; dataFeeds: string[]; }
export interface DigitalTwinImpact { assetId: string; zone: string; risk: IncidentSeverity; dependencies?: string[]; }
export interface EmergencyIncidentInput { id: string; scenario: EmergencyScenario; severity: IncidentSeverity; location: string; reportedAt: string; affectedAssets: DigitalTwinImpact[]; systems: OperationalSystemLink[]; populationAtRisk?: number; }
export interface ContinuityPlan { id: string; name: string; criticalProcesses: string[]; recoveryTimeObjectiveMinutes: number; recoveryPointObjectiveMinutes: number; alternateSites: string[]; manualWorkarounds: string[]; }
export interface EmergencyPlan { id: string; name: string; scenarios: EmergencyScenario[]; ownerRole: string; activationCriteria: string[]; communicationChannels: string[]; evacuationZoneIds: string[]; drillCadenceDays: number; }
export interface IncidentCommandRole { id: string; role: EmergencyRoleName; assignee: string; backup?: string; permissions: Array<'activate-workflow' | 'override-ai' | 'dispatch-resource' | 'send-communication' | 'close-incident'>; }
export interface EmergencyResource { id: string; kind: EmergencyResourceKind; label: string; status: 'available' | 'assigned' | 'depleted' | 'offline'; zoneId: string; coordinates: { latitude: number; longitude: number }; capacity?: number; }
export interface EvacuationZone { id: string; name: string; status: 'open' | 'evacuating' | 'cleared' | 'closed'; route: string[]; assemblyArea: string; capacity: number; }
export interface CommunicationChecklistItem { id: string; audience: string; channel: string; message: string; completed: boolean; completedBy?: string; completedAt?: string; }
export interface EmergencyWorkflowInput { id: string; planId: string; incident: EmergencyIncidentInput; activatedBy: string; activatedByRoles: Role[]; commandRoles: IncidentCommandRole[]; resources: EmergencyResource[]; evacuationZones: EvacuationZone[]; communicationChecklist: CommunicationChecklistItem[]; aiRecommendationId?: string; tenantId?: string; racetrackId?: string; workforceResources?: EmergencyResource[]; workforceReadiness?: Pick<WorkforceReadinessSummary, 'status' | 'score' | 'emergencyGaps' | 'complianceStatus'>; }
export interface EmergencyAuditRecord { id: string; action: string; actor: string; subjectId: string; timestamp: string; humanOverride: boolean; aiBlocked: false; previousHash: string; hash: string; externalAuditId?: string; }
export interface EmergencyDomainEvent extends Pick<CanonicalEventRef, 'eventId' | 'eventType' | 'tenantId' | 'racetrackId' | 'actorId' | 'source' | 'timestamp' | 'version'> { id: string; type: EmergencyEventType | string; subjectId: string; severity: IncidentSeverity; auditId: string; payload: Record<string, unknown>; eventBusId?: string; }
export interface EmergencyResponseProcedure { scenario: EmergencyScenario; lead: string; checklist: string[]; workflowDefinitionId: string; slaMinutes: number; humanOverrideSupported: true; aiMayBlock: false; authorityStatement: string; }
export interface EmergencyDrillRecord { id: string; scenario: EmergencyScenario; participants: string[]; injects: Array<{ minute: number; prompt: string }>; successCriteria: string[]; completedAt?: string; eventId?: string; auditId?: string; }
export interface EmergencyAfterActionReport { incidentId: string; scenario: EmergencyScenario; timelineEntries: number; findings: Array<{ finding: string; severity: IncidentSeverity; owner: string }>; correctiveActions: Array<{ id: string; owner: string; action: string; dueDays: number }>; evidencePackage: string[]; approvalPosture: EmergencyApprovalPosture; }
export interface EmergencyTwinPatch { twinId: string; patch: Record<string, unknown>; actor: string; observedAt: string; eventId?: string; status: 'planned' | 'published' | 'applied' | 'queued-for-existing-twin'; }
export interface EmergencyWorkflowIntegration { engine: 'workflow-orchestration'; definitionIds: string[]; instanceId?: string; status: 'registered' | 'started' | 'not-configured'; humanTaskRoles: string[]; }
export interface EmergencyApprovalPosture { mode: 'post-action-evidence' | 'approval-request-created'; action: 'emergency-action'; target: string; aiMayBlock: false; emergencyPersonnelAuthority: true; approvalRequestId?: string; reason: string; }
export interface EmergencyObservabilitySummary { serviceId: 'emergency-operations'; healthSignal: 'healthy' | 'degraded' | 'critical'; activeWorkflows: number; openIncidents: number; criticalIncidents: number; communicationsPending: number; lastSignalAt: string; traceIds: string[]; }

export interface EmergencyWorkflow {
  id: string;
  planId: string;
  status: EmergencyWorkflowStatus;
  activeEmergencyStatus: string;
  incident: ReturnType<EmergencyOperationsPlatform['openIncident']>;
  commandRoles: IncidentCommandRole[];
  resources: EmergencyResource[];
  resourceMap: Array<{ id: string; label: string; kind: EmergencyResourceKind; status: EmergencyResource['status']; zoneId: string; coordinates: EmergencyResource['coordinates'] }>;
  workforceReadiness?: EmergencyWorkflowInput['workforceReadiness'];
  evacuationZones: EvacuationZone[];
  medicalResponse: EmergencyResponseProcedure;
  fireResponse: EmergencyResponseProcedure;
  severeWeatherResponse: EmergencyResponseProcedure;
  evacuationProcedure: EmergencyResponseProcedure;
  checklist: Array<{ id: string; label: string; completed: boolean; humanOverrideAvailable: true; aiBlockingAllowed: false }>;
  communicationLog: CommunicationChecklistItem[];
  auditTimeline: EmergencyAuditRecord[];
  events: EmergencyDomainEvent[];
  digitalTwinPatches: EmergencyTwinPatch[];
  workflowIntegration: EmergencyWorkflowIntegration;
  approvalPosture: EmergencyApprovalPosture;
  observability: EmergencyObservabilitySummary;
  emergencyActions: { humanOverrideSupported: true; aiMayBlock: false; reason: string };
}

export interface EmergencyOperationsWorkspace {
  activeEmergencyStatus: string;
  plans: EmergencyPlan[];
  commandRoles: IncidentCommandRole[];
  resources: EmergencyResource[];
  resourceMap: EmergencyWorkflow['resourceMap'];
  workforceReadiness?: EmergencyWorkflow['workforceReadiness'];
  medicalResponse: EmergencyResponseProcedure;
  fireResponse: EmergencyResponseProcedure;
  severeWeatherResponse: EmergencyResponseProcedure;
  evacuationProcedure: EmergencyResponseProcedure;
  evacuationZones: EvacuationZone[];
  checklist: EmergencyWorkflow['checklist'];
  communicationLog: CommunicationChecklistItem[];
  drills: EmergencyDrillRecord[];
  afterActionReports: EmergencyAfterActionReport[];
  auditTimeline: EmergencyAuditRecord[];
  events: EmergencyDomainEvent[];
  digitalTwinPatches: EmergencyTwinPatch[];
  workflowIntegrations: EmergencyWorkflowIntegration[];
  approvalPosture: EmergencyApprovalPosture;
  observability: EmergencyObservabilitySummary;
  emergencyActions: EmergencyWorkflow['emergencyActions'];
  mock: boolean;
}

export interface EmergencyOperationsDependencies {
  auditLog?: ImmutableAuditLog;
  eventBus?: UniversalEventBus;
  approvals?: CentralizedApprovalService;
  twins?: { updateState(input: { twinId: string; patch: Record<string, unknown>; actor: string; observedAt?: string; sourceEventId?: string }): unknown };
  observability?: { recordApiLatency(serviceId: string, route: string, latencyMs: number, statusCode?: number): unknown };
  workflows?: WorkflowOrchestrationEngine;
}

const nowIso = () => new Date().toISOString();
const commandByScenario: Record<EmergencyScenario, string> = { 'severe-weather': 'incident-commander-weather-ops', 'medical-emergency': 'medical-branch-director', 'fire-incident': 'fire-safety-incident-commander', 'infrastructure-failure': 'facilities-branch-director', evacuation: 'public-safety-incident-commander', 'security-incident': 'security-operations-commander', 'business-continuity': 'continuity-manager', 'disaster-recovery': 'technology-recovery-lead' };
const workflowByScenario: Record<EmergencyScenario, string[]> = { 'severe-weather': ['monitor nws alerts', 'pause exposed operations', 'shelter horses and guests', 'inspect surface', 'resume by human incident-command approval'], 'medical-emergency': ['triage patient', 'dispatch ems and veterinarian if needed', 'secure access lane', 'document treatment', 'family or owner notification'], 'fire-incident': ['activate alarm', 'dispatch fire brigade', 'isolate utilities', 'evacuate affected zone', 'all-clear inspection'], 'infrastructure-failure': ['isolate failed asset', 'switch to redundant service', 'dispatch maintenance', 'validate life safety systems', 'restore normal operations'], evacuation: ['open evacuation routes', 'stage transportation', 'account for people and horses', 'communicate assembly areas', 'controlled re-entry by human command'], 'security-incident': ['lock down affected zone', 'notify law enforcement', 'preserve evidence', 'screen access points', 'return to normal posture'], 'business-continuity': ['activate continuity team', 'prioritize critical processes', 'move to alternate work mode', 'track service levels', 'demobilize'], 'disaster-recovery': ['declare dr event', 'restore priority platforms', 'validate data integrity', 'fail back services', 'complete recovery report'] };

const procedureSla: Record<EmergencyScenario, number> = { 'medical-emergency': 3, 'fire-incident': 2, 'severe-weather': 10, evacuation: 5, 'infrastructure-failure': 15, 'security-incident': 5, 'business-continuity': 30, 'disaster-recovery': 30 };
const clone = <T>(value: T): T => structuredClone(value);

export class EmergencyOperationsPlatform {
  private incidents = new Map<string, EmergencyIncidentInput>();
  private plans = new Map<string, ContinuityPlan | EmergencyPlan>();
  private resources = new Map<string, EmergencyResource>();
  private evacuationProcedures = new Map<string, EvacuationZone>();
  private workflows = new Map<string, EmergencyWorkflow>();
  private auditRecords: EmergencyAuditRecord[] = [];
  private events: EmergencyDomainEvent[] = [];
  private drills: EmergencyDrillRecord[] = [];
  private afterActions: EmergencyAfterActionReport[] = [];
  private twinPatches: EmergencyTwinPatch[] = [];
  private workflowIntegrations: EmergencyWorkflowIntegration[] = [];

  constructor(private readonly deps: EmergencyOperationsDependencies = {}) {
    this.registerEventSchemas();
  }

  registerContinuityPlan(plan: ContinuityPlan) { this.plans.set(plan.id, plan); return { ...plan, tested: false, governance: ['ISO 22301', 'NIMS/ICS', 'local emergency action plan'] }; }
  registerEmergencyPlan(plan: EmergencyPlan) { this.plans.set(plan.id, plan); return { ...plan, aiMayBlockActivation: false, humanOverrideRequired: true, workflows: plan.scenarios.map((scenario) => workflowByScenario[scenario]) }; }
  registerResource(resource: EmergencyResource): EmergencyResource { this.resources.set(resource.id, resource); return clone(resource); }
  registerEvacuationZone(zone: EvacuationZone): EvacuationZone { this.evacuationProcedures.set(zone.id, zone); return clone(zone); }
  canManageEmergency(roles: Role[]) { return roles.some((role) => hasPermission(role, 'incident:manage')); }

  registerWorkflowDefinitions(tenantId: string): WorkflowDefinition[] {
    const definitions = buildEmergencyWorkflowDefinitions(tenantId);
    definitions.forEach((definition) => this.deps.workflows?.register(definition));
    const integration: EmergencyWorkflowIntegration = { engine: 'workflow-orchestration', definitionIds: definitions.map((definition) => definition.id), status: this.deps.workflows ? 'registered' : 'not-configured', humanTaskRoles: ['incident-commander', 'medical-lead', 'fire-lead', 'weather-lead', 'evacuation-lead'] };
    this.workflowIntegrations.push(integration);
    return definitions;
  }

  openIncident(input: EmergencyIncidentInput) {
    this.incidents.set(input.id, input);
    const offlineSystems = input.systems.filter((system) => system.status !== 'online').map((system) => system.system);
    const audit = this.appendAudit('emergency.incident.opened', 'incident-command', input.id, true, input.severity);
    this.appendEvent('emergency.incident.opened', input.id, input.severity, audit.id, { scenario: input.scenario, location: input.location });
    return { incidentId: input.id, scenario: input.scenario, severity: input.severity, incidentCommander: commandByScenario[input.scenario], commandStructure: ['incident commander', 'safety officer', 'public information officer', 'operations', 'planning', 'logistics', 'finance/admin'], workflows: workflowByScenario[input.scenario], communicationChannels: ['mass-notification', 'radio-ops', 'executive-briefing', 'public-address', 'regulator-update'], integratedSystems: input.systems.map((system) => system.system), degradedSystems: offlineSystems, twinImpactMap: input.affectedAssets, evacuationRequired: input.scenario === 'evacuation' || input.severity === 'critical' || (input.populationAtRisk ?? 0) > 500, resourceRequests: this.resourcePlan(input), aiMayBlockEmergencyAction: false, humanOverrideSupported: true, authority: 'Human emergency personnel retain authority; AI recommendations are advisory and never block life-safety actions.' };
  }

  createEmergencyWorkflow(input: EmergencyWorkflowInput): EmergencyWorkflow {
    if (!this.canManageEmergency(input.activatedByRoles)) throw new Error('incident:manage permission required');
    const incidentView = this.openIncident(input.incident);
    const resources = [...input.resources, ...(input.workforceResources ?? [])];
    resources.forEach((resource) => this.resources.set(resource.id, resource));
    input.evacuationZones.forEach((zone) => this.evacuationProcedures.set(zone.id, zone));
    const audit = this.appendAudit('emergency.workflow.activated', input.activatedBy, input.id, true, input.incident.severity, input.tenantId);
    const event = this.appendEvent('emergency.workflow.activated', input.id, input.incident.severity, audit.id, { planId: input.planId, scenario: input.incident.scenario, aiRecommendationId: input.aiRecommendationId, workforceReadiness: input.workforceReadiness });
    const workforceSteps = (input.workforceReadiness?.emergencyGaps ?? []).map((gap) => `resolve workforce emergency gap: ${gap}`);
    const checklist = [...workflowByScenario[input.incident.scenario], ...workforceSteps].map((label, index) => ({ id: `${input.id}-step-${index + 1}`, label, completed: false, humanOverrideAvailable: true as const, aiBlockingAllowed: false as const }));
    const digitalTwinPatches = this.planDigitalTwinPatches(input, event.id);
    const workflowIntegration = this.startWorkflowIntegration(input, digitalTwinPatches);
    const approvalPosture = this.createApprovalPosture(input, audit.id);
    const workflow: EmergencyWorkflow = { id: input.id, planId: input.planId, status: 'active', activeEmergencyStatus: `${input.incident.severity} ${input.incident.scenario}`, incident: incidentView, commandRoles: input.commandRoles, resources, resourceMap: resources.map((resource) => ({ id: resource.id, label: resource.label, kind: resource.kind, status: resource.status, zoneId: resource.zoneId, coordinates: resource.coordinates })), workforceReadiness: input.workforceReadiness, evacuationZones: input.evacuationZones, medicalResponse: this.responsePlan('medical-emergency'), fireResponse: this.responsePlan('fire-incident'), severeWeatherResponse: this.responsePlan('severe-weather'), evacuationProcedure: this.responsePlan('evacuation'), checklist, communicationLog: input.communicationChecklist, auditTimeline: [audit], events: [event], digitalTwinPatches, workflowIntegration, approvalPosture, observability: this.observabilitySummary(), emergencyActions: { humanOverrideSupported: true, aiMayBlock: false, reason: 'Emergency life-safety actions remain executable by authorized humans even when AI is unavailable or disagrees.' } };
    this.workflows.set(input.id, workflow);
    return clone(workflow);
  }

  recordCommunication(workflowId: string, itemId: string, actor: string) {
    const workflow = this.requireWorkflow(workflowId);
    workflow.communicationLog = workflow.communicationLog.map((item) => item.id === itemId ? { ...item, completed: true, completedBy: actor, completedAt: nowIso() } : item);
    const audit = this.appendAudit('emergency.communication.completed', actor, itemId, true, workflow.incident.severity);
    const event = this.appendEvent('emergency.communication.completed', workflowId, workflow.incident.severity, audit.id, { itemId });
    workflow.auditTimeline.push(audit); workflow.events.push(event); workflow.observability = this.observabilitySummary(); return clone(workflow);
  }

  runSimulationExercise(id: string, scenario: EmergencyScenario, participants: string[]): EmergencyDrillRecord {
    const drill = { id, scenario, participants, injects: workflowByScenario[scenario].map((step, index) => ({ minute: index * 10, prompt: step })), successCriteria: ['notifications under 5 minutes', 'asset status reconciled with digital twin', 'command log complete', 'recovery objectives met'] };
    this.drills.push(drill);
    return clone(drill);
  }

  completeDrill(id: string, actor: string, observations: string[] = []): EmergencyDrillRecord {
    const drill = this.drills.find((candidate) => candidate.id === id);
    if (!drill) throw new Error(`Unknown drill: ${id}`);
    const audit = this.appendAudit('emergency.drill.completed', actor, id, true, drill.scenario === 'fire-incident' ? 'major' : 'minor');
    const event = this.appendEvent('emergency.drill.completed', id, drill.scenario === 'fire-incident' ? 'major' : 'minor', audit.id, { observations });
    Object.assign(drill, { completedAt: audit.timestamp, eventId: event.id, auditId: audit.id });
    return clone(drill);
  }

  afterActionReport(incidentId: string, observations: Array<{ finding: string; severity: IncidentSeverity; owner: string }>): EmergencyAfterActionReport {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Unknown incident: ${incidentId}`);
    const audit = this.appendAudit('emergency.after-action.created', 'after-action-coordinator', incidentId, true, incident.severity);
    const report = { incidentId, scenario: incident.scenario, timelineEntries: workflowByScenario[incident.scenario].length, findings: observations, correctiveActions: observations.map((observation, index) => ({ id: `${incidentId}-ca-${index + 1}`, owner: observation.owner, action: `Resolve: ${observation.finding}`, dueDays: observation.severity === 'critical' ? 7 : 30 })), evidencePackage: ['command-log', 'communications-transcript', 'digital-twin-state-history', 'resource-ledger', audit.id], approvalPosture: { mode: 'post-action-evidence' as const, action: 'emergency-action' as const, target: incidentId, aiMayBlock: false as const, emergencyPersonnelAuthority: true as const, reason: 'After-action reports document command decisions and corrective actions; they do not retroactively block emergency personnel.' } };
    this.afterActions.push(report);
    this.appendEvent('emergency.after-action.created', incidentId, incident.severity, audit.id, { correctiveActions: report.correctiveActions.length });
    return clone(report);
  }

  syncPostIncidentReview(incidentId: string, platformIncidentId: string, findings: Array<{ finding: string; severity: IncidentSeverity; owner: string }>) {
    const report = this.afterActionReport(incidentId, findings);
    this.appendEvent('incident.post-incident-review.synced', platformIncidentId, report.findings[0]?.severity ?? 'major', report.evidencePackage.at(-1) ?? incidentId, {
      platformIncidentId,
      emergencyIncidentId: incidentId,
      correctiveActions: report.correctiveActions.length,
    });
    return { emergencyReport: report, platformIncidentId };
  }

  continuityStatus() { return [...this.plans.values()].filter((plan): plan is ContinuityPlan => 'criticalProcesses' in plan).map((plan) => ({ planId: plan.id, name: plan.name, criticalProcesses: plan.criticalProcesses.length, rtoMinutes: plan.recoveryTimeObjectiveMinutes, rpoMinutes: plan.recoveryPointObjectiveMinutes, ready: plan.alternateSites.length > 0 && plan.manualWorkarounds.length > 0 })); }
  listAuditRecords() { return this.auditRecords.map(clone); }
  listEvents() { return this.events.map(clone); }
  listDigitalTwinPatches() { return this.twinPatches.map(clone); }
  listWorkflowIntegrations() { return this.workflowIntegrations.map(clone); }
  listWorkflows() { return [...this.workflows.values()].map(clone); }

  workspace(mock = false): EmergencyOperationsWorkspace {
    const workflow = [...this.workflows.values()].at(-1);
    const plans = [...this.plans.values()].filter((plan): plan is EmergencyPlan => 'scenarios' in plan);
    const fallbackPosture: EmergencyApprovalPosture = { mode: 'post-action-evidence', action: 'emergency-action', target: workflow?.id ?? 'no-active-emergency', aiMayBlock: false, emergencyPersonnelAuthority: true, reason: 'Emergency personnel retain command authority; approvals collect evidence and controlled re-entry decisions.' };
    return {
      activeEmergencyStatus: workflow?.activeEmergencyStatus ?? 'normal',
      plans: plans.map(clone),
      commandRoles: workflow?.commandRoles ?? [],
      resources: [...this.resources.values()].map(clone),
      resourceMap: workflow?.resourceMap ?? [...this.resources.values()].map((resource) => ({ id: resource.id, label: resource.label, kind: resource.kind, status: resource.status, zoneId: resource.zoneId, coordinates: resource.coordinates })),
      workforceReadiness: workflow?.workforceReadiness,
      medicalResponse: this.responsePlan('medical-emergency'),
      fireResponse: this.responsePlan('fire-incident'),
      severeWeatherResponse: this.responsePlan('severe-weather'),
      evacuationProcedure: this.responsePlan('evacuation'),
      evacuationZones: workflow?.evacuationZones ?? [...this.evacuationProcedures.values()].map(clone),
      checklist: workflow?.checklist ?? [],
      communicationLog: workflow?.communicationLog ?? [],
      drills: this.drills.map(clone),
      afterActionReports: this.afterActions.map(clone),
      auditTimeline: this.listAuditRecords(),
      events: this.listEvents(),
      digitalTwinPatches: this.listDigitalTwinPatches(),
      workflowIntegrations: this.listWorkflowIntegrations(),
      approvalPosture: workflow?.approvalPosture ?? fallbackPosture,
      observability: this.observabilitySummary(),
      emergencyActions: workflow?.emergencyActions ?? { humanOverrideSupported: true, aiMayBlock: false, reason: 'Human commanders retain authority; AI cannot block emergency actions.' },
      mock,
    };
  }

  private responsePlan(scenario: EmergencyScenario): EmergencyResponseProcedure { return { scenario, lead: commandByScenario[scenario], checklist: workflowByScenario[scenario], workflowDefinitionId: `emergency-${scenario}-workflow`, slaMinutes: procedureSla[scenario], humanOverrideSupported: true, aiMayBlock: false, authorityStatement: 'Emergency personnel may proceed based on field command authority; AI is advisory only.' }; }
  private requireWorkflow(workflowId: string): EmergencyWorkflow { const workflow = this.workflows.get(workflowId); if (!workflow) throw new Error(`Unknown workflow: ${workflowId}`); return workflow; }

  private appendAudit(action: string, actor: string, subjectId: string, humanOverride: boolean, severity: IncidentSeverity = 'major', tenantId?: string) {
    const previousHash = this.auditRecords.at(-1)?.hash ?? 'genesis';
    const record = { id: `audit-emergency-${this.auditRecords.length + 1}`, action, actor, subjectId, timestamp: nowIso(), humanOverride, aiBlocked: false as const, previousHash, hash: `sha256:emergency-${this.auditRecords.length + 1}-${subjectId}` };
    const external = this.deps.auditLog?.append({ id: `audit:emergency:${this.auditRecords.length + 1}`, type: action.includes('workflow') ? 'workflow-action' : 'system-event', actor, timestamp: record.timestamp, payload: { action, subjectId, humanOverride, aiBlocked: false }, subjectId, tenantId, severity: severity === 'critical' ? 'critical' : severity === 'major' ? 'warning' : 'info', regulations: ['NIMS/ICS', 'ISO 22301'], evidenceIds: [record.id] });
    const enriched = { ...record, externalAuditId: external?.id };
    this.auditRecords.push(enriched);
    return enriched;
  }

  private appendEvent(type: EmergencyEventType, subjectId: string, severity: IncidentSeverity, auditId: string, payload: Record<string, unknown>) {
    const eventId = `evt-emergency-${this.events.length + 1}`;
    const event: EmergencyDomainEvent = { eventId, eventType: `${type}.v1` as CanonicalEventRef['eventType'], tenantId: 'trackmind', racetrackId: 'main-track', actorId: 'emergency-operations', source: 'emergency-operations', timestamp: nowIso(), version: 1, id: eventId, type, subjectId, severity, auditId, payload };
    this.events.push(event);
    void this.deps.eventBus?.publish({ id: event.eventId, type: event.eventType, tenantId: event.tenantId, racetrackId: event.racetrackId, actor: { id: event.actorId, type: 'service' }, subject: { id: subjectId, type: 'emergency', tenantId: event.tenantId }, evidence: [auditId], auditRef: auditId, payload: { subjectId, severity, auditId, ...payload }, aggregateId: subjectId, producer: event.source, correlationId: auditId, metadata: { compliance: 'regulated', team: 'emergency-operations', accountableRole: 'incident-commander', description: `Emergency Operations ${type}` } }).then((published) => { event.eventBusId = published.eventId; });
    return event;
  }

  private planDigitalTwinPatches(input: EmergencyWorkflowInput, sourceEventId: string): EmergencyTwinPatch[] {
    const patches: EmergencyTwinPatch[] = input.incident.affectedAssets.map((asset) => ({ twinId: asset.assetId.startsWith('twin:') ? asset.assetId : `twin:${asset.assetId}`, actor: input.activatedBy, observedAt: nowIso(), eventId: sourceEventId, status: 'published', patch: { emergencyStatus: input.incident.severity, emergencyScenario: input.incident.scenario, emergencyZone: asset.zone, commandWorkflowId: input.id, aiMayBlock: false } }));
    patches.forEach((patch) => {
      this.twinPatches.push(patch);
      void this.deps.eventBus?.publish({ type: 'digital-twin.state.patch', payload: { twinId: patch.twinId, patch: patch.patch, actor: patch.actor, observedAt: patch.observedAt }, aggregateId: patch.twinId, producer: 'emergency-operations', correlationId: patch.eventId, metadata: { team: 'emergency-operations', accountableRole: 'incident-commander', compliance: 'regulated' } });
      try { this.deps.twins?.updateState({ twinId: patch.twinId, patch: patch.patch, actor: patch.actor, observedAt: patch.observedAt, sourceEventId: patch.eventId }); patch.status = 'applied'; } catch { patch.status = this.deps.twins ? 'queued-for-existing-twin' : patch.status; }
    });
    if (patches.length) this.appendEvent('emergency.digital-twin.patch.requested', input.id, input.incident.severity, `audit-emergency-${this.auditRecords.length}`, { twinIds: patches.map((patch) => patch.twinId) });
    return patches;
  }

  private startWorkflowIntegration(input: EmergencyWorkflowInput, digitalTwinPatches: EmergencyTwinPatch[]): EmergencyWorkflowIntegration {
    const definitions = this.registerWorkflowDefinitions(input.tenantId ?? 'trackmind');
    const definition = definitions.find((candidate) => candidate.id === `emergency-${input.incident.scenario}-workflow`) ?? definitions[0];
    if (!this.deps.workflows || !definition) return { engine: 'workflow-orchestration', definitionIds: definitions.map((candidate) => candidate.id), status: 'not-configured', humanTaskRoles: ['incident-commander'] };
    const instance = this.deps.workflows.start(definition.id, { tenantId: input.tenantId ?? 'trackmind', priority: input.incident.severity === 'critical' ? 'critical' : 'high', digitalTwinRefs: digitalTwinPatches.map((patch) => patch.twinId), payload: { incidentId: input.incident.id, scenario: input.incident.scenario, humanAuthority: true, aiMayBlock: false } }, input.activatedBy);
    const integration = { engine: 'workflow-orchestration' as const, definitionIds: definitions.map((candidate) => candidate.id), instanceId: instance.id, status: 'started' as const, humanTaskRoles: [...new Set(definition.steps.map((step) => step.role).filter((role): role is string => Boolean(role)))] };
    this.workflowIntegrations.push(integration);
    return integration;
  }

  private createApprovalPosture(input: EmergencyWorkflowInput, auditId: string): EmergencyApprovalPosture {
    const base = { mode: 'post-action-evidence' as const, action: 'emergency-action' as const, target: input.id, aiMayBlock: false as const, emergencyPersonnelAuthority: true as const, reason: 'Emergency personnel may act immediately; approval service records evidence and follow-up controlled decisions without blocking response.' };
    const request = this.deps.approvals?.createRequest({ tenantId: input.tenantId ?? 'trackmind', racetrackId: input.racetrackId ?? input.incident.location, action: 'emergency-action', target: input.id, requestedBy: input.activatedBy, actorType: 'human', reason: base.reason, evidence: [auditId, ...(input.aiRecommendationId ? [input.aiRecommendationId] : [])], workflowInstanceId: this.workflowIntegrations.at(-1)?.instanceId });
    return request ? { ...base, mode: 'approval-request-created', approvalRequestId: request.id } : base;
  }

  private observabilitySummary(): EmergencyObservabilitySummary {
    const workflows = [...this.workflows.values()];
    const criticalIncidents = [...this.incidents.values()].filter((incident) => incident.severity === 'critical').length;
    const communicationsPending = workflows.reduce((sum, workflow) => sum + workflow.communicationLog.filter((item) => !item.completed).length, 0);
    this.deps.observability?.recordApiLatency('emergency-operations', '/api/v1/emergency-operations/workspace', criticalIncidents ? 96 : 42);
    return { serviceId: 'emergency-operations', healthSignal: criticalIncidents ? 'critical' : communicationsPending ? 'degraded' : 'healthy', activeWorkflows: workflows.filter((workflow) => workflow.status === 'active').length, openIncidents: this.incidents.size, criticalIncidents, communicationsPending, lastSignalAt: nowIso(), traceIds: this.events.map((event) => `trace-${event.id}`) };
  }

  private registerEventSchemas(): void {
    const owner = { service: 'emergency-operations', team: 'emergency-operations', accountableRole: 'incident-commander' };
    (['emergency.incident.opened', 'emergency.workflow.activated', 'emergency.communication.completed', 'emergency.drill.completed', 'emergency.after-action.created', 'emergency.digital-twin.patch.requested', 'incident.post-incident-review.synced'] satisfies EmergencyEventType[]).forEach((type) => this.deps.eventBus?.registerEvent({ type, version: 1, description: `Emergency Operations ${type}`, owner, payloadFields: ['subjectId', 'severity', 'auditId'], compliance: 'regulated', operationalMetadata: { humanAuthority: true, aiMayBlock: false } }));
  }

  private resourcePlan(input: EmergencyIncidentInput) { const base = ['incident command post', 'first-aid kits', 'radios', 'access-control staff']; const scenarioResources: Record<EmergencyScenario, string[]> = { 'severe-weather': ['weather radar feed', 'surface inspection crew', 'shelter capacity'], 'medical-emergency': ['ems unit', 'veterinary response', 'stretcher cart'], 'fire-incident': ['fire extinguishers', 'utility shutoff team', 'mutual-aid fire department'], 'infrastructure-failure': ['generator', 'maintenance crew', 'spare parts cache'], evacuation: ['buses', 'horse transport', 'assembly-area marshals'], 'security-incident': ['law enforcement liaison', 'camera review team', 'perimeter barriers'], 'business-continuity': ['alternate workspace', 'manual forms', 'vendor contact bridge'], 'disaster-recovery': ['backup restore team', 'clean-room credentials', 'network failover'] }; return [...base, ...scenarioResources[input.scenario]]; }
}

export function buildEmergencyWorkflowDefinitions(tenantId: string): WorkflowDefinition[] {
  const definition = (scenario: EmergencyScenario, name: string, ownerRole: string, leadRole: string): WorkflowDefinition => ({ id: `emergency-${scenario}-workflow`, name, domain: 'emergency', version: '1.0.0', bpmnProcessId: `Process_Emergency_${scenario.replace(/-/g, '_')}`, startStepId: 'assume-command', ownerRole, tenantId, triggerEvents: ['emergency.workflow.activated'], description: 'Human-commanded emergency workflow. AI may recommend and summarize, but cannot block emergency personnel.', steps: [
    { id: 'assume-command', name: 'Assume human incident command', type: 'userTask', role: 'incident-commander', sla: { minutes: 1, escalationRole: ownerRole, severity: 'critical' }, digitalTwin: { refs: [`twin:emergency:${scenario}`], syncMode: 'read-write', statePatch: { emergencyCommand: 'active', aiMayBlock: false } }, next: ['dispatch-response'] },
    { id: 'dispatch-response', name: `Dispatch ${scenario} resources`, type: 'userTask', role: leadRole, sla: { minutes: procedureSla[scenario], escalationRole: 'incident-commander', severity: scenario === 'severe-weather' ? 'breach' : 'critical' }, next: ['communicate'] },
    { id: 'communicate', name: 'Issue emergency communications', type: 'userTask', role: 'public-information-officer', sla: { minutes: 5, escalationRole: 'incident-commander', severity: 'critical' }, next: ['stabilize'] },
    { id: 'stabilize', name: 'Stabilize scene and account for people and horses', type: 'userTask', role: 'operations-section', sla: { minutes: 20, escalationRole: 'incident-commander', severity: 'critical' }, next: ['after-action'] },
    { id: 'after-action', name: 'Complete after-action and corrective actions', type: 'approvalTask', role: 'safety-officer', approvalRoles: ['compliance-officer', 'admin'], requiredApprovals: 1, sla: { minutes: 1440, escalationRole: 'general-manager', severity: 'breach' }, next: ['closed'] },
    { id: 'closed', name: `${name} closed`, type: 'endEvent' },
  ] });
  return [
    definition('medical-emergency', 'Medical Response Workflow', 'incident-commander', 'medical-lead'),
    definition('fire-incident', 'Fire Response Workflow', 'incident-commander', 'fire-lead'),
    definition('severe-weather', 'Severe Weather Workflow', 'incident-commander', 'weather-lead'),
    definition('evacuation', 'Evacuation Procedure Workflow', 'incident-commander', 'evacuation-lead'),
  ];
}

export function buildEmergencyOperationsBlueprint(systems: OperationalSystemLink[], assets: DigitalTwinImpact[]) { return { supportedScenarios: Object.keys(commandByScenario) as EmergencyScenario[], operationalIntegrations: systems.map((system) => ({ ...system, monitored: true })), digitalTwinAssets: assets, minimumCapabilities: ['incident command', 'resource management', 'communications', 'evacuation routing', 'continuity planning', 'disaster recovery', 'simulation exercises', 'after-action reporting', 'human override', 'non-blocking emergency AI guardrails', 'workflow orchestration', 'immutable audit', 'event bus contracts', 'digital twin patch planning', 'platform observability'] }; }

export function createMockEmergencyOperationsWorkspace(): EmergencyOperationsWorkspace {
  const platform = new EmergencyOperationsPlatform();
  platform.registerEmergencyPlan({ id: 'plan-fire', name: 'Barn fire and evacuation plan', scenarios: ['fire-incident', 'evacuation'], ownerRole: 'incident-commander', activationCriteria: ['alarm activation', 'smoke report', 'human commander declaration'], communicationChannels: ['radio', 'public-address', 'mass-notification'], evacuationZoneIds: ['zone-barn'], drillCadenceDays: 90 });
  platform.registerEmergencyPlan({ id: 'plan-weather', name: 'Severe weather shelter plan', scenarios: ['severe-weather'], ownerRole: 'weather-lead', activationCriteria: ['lightning within 10 miles', 'tornado warning', 'human weather lead override'], communicationChannels: ['radio', 'sms', 'public-address'], evacuationZoneIds: ['zone-grandstand'], drillCadenceDays: 60 });
  const workflow = platform.createEmergencyWorkflow({
    id: 'wf-fire-1',
    planId: 'plan-fire',
    activatedBy: 'Avery Chen',
    activatedByRoles: ['admin'],
    incident: { id: 'inc-100', scenario: 'fire-incident', severity: 'critical', location: 'Barn 2', reportedAt: '2026-06-13T18:00:00Z', populationAtRisk: 40, affectedAssets: [{ assetId: 'barn:2', zone: 'zone-barn', risk: 'critical', dependencies: ['power-feed-2'] }, { assetId: 'grandstand', zone: 'zone-grandstand', risk: 'major' }], systems: [{ system: 'workflow-engine', status: 'online', dataFeeds: ['workflow-state'] }, { system: 'digital-twin-runtime', status: 'online', dataFeeds: ['asset-state', 'occupancy'] }, { system: 'access-control', status: 'degraded', dataFeeds: ['badges'] }, { system: 'platform-observability', status: 'online', dataFeeds: ['logs', 'metrics', 'traces'] }] },
    commandRoles: [{ id: 'role-ic', role: 'incident-commander', assignee: 'Avery Chen', permissions: ['activate-workflow', 'override-ai', 'dispatch-resource', 'send-communication', 'close-incident'] }, { id: 'role-med', role: 'medical-lead', assignee: 'Dr. Rivera', permissions: ['dispatch-resource', 'send-communication'] }, { id: 'role-fire', role: 'fire-lead', assignee: 'Captain Morgan', permissions: ['dispatch-resource', 'override-ai'] }, { id: 'role-weather', role: 'weather-lead', assignee: 'Sam Patel', permissions: ['send-communication', 'override-ai'] }, { id: 'role-evac', role: 'evacuation-lead', assignee: 'Jordan Lee', permissions: ['dispatch-resource', 'send-communication'] }],
    resources: [{ id: 'res-ambulance', kind: 'medical', label: 'EMS ambulance', status: 'assigned', zoneId: 'zone-grandstand', coordinates: { latitude: 38.044, longitude: -76.949 }, capacity: 2 }, { id: 'res-equine-ambulance', kind: 'medical', label: 'Equine ambulance', status: 'available', zoneId: 'zone-track', coordinates: { latitude: 38.052, longitude: -76.951 }, capacity: 1 }, { id: 'res-fire', kind: 'fire', label: 'Mutual-aid fire unit', status: 'assigned', zoneId: 'zone-barn', coordinates: { latitude: 38.061, longitude: -76.955 }, capacity: 4 }, { id: 'res-shelter', kind: 'shelter', label: 'Grandstand shelter level 1', status: 'available', zoneId: 'zone-grandstand', coordinates: { latitude: 38.043, longitude: -76.952 }, capacity: 900 }],
    evacuationZones: [{ id: 'zone-barn', name: 'Barn zone', status: 'evacuating', route: ['north service gate', 'lot A'], assemblyArea: 'Lot A', capacity: 120 }, { id: 'zone-grandstand', name: 'Grandstand', status: 'open', route: ['main concourse', 'south plaza'], assemblyArea: 'South Plaza', capacity: 1200 }],
    communicationChecklist: [{ id: 'comm-radio', audience: 'field teams', channel: 'radio', message: 'Barn 2 evacuation in progress', completed: false }, { id: 'comm-pa', audience: 'patrons', channel: 'public-address', message: 'Avoid backstretch service road', completed: false }, { id: 'comm-regulator', audience: 'regulators', channel: 'email', message: 'Critical emergency workflow activated under human incident command', completed: false }],
    aiRecommendationId: 'ai-fire-advice-1',
    tenantId: 'trackmind',
  });
  platform.recordCommunication(workflow.id, 'comm-radio', 'Avery Chen');
  platform.runSimulationExercise('drill-weather-1', 'severe-weather', ['ops', 'security', 'facilities']);
  platform.completeDrill('drill-weather-1', 'Sam Patel', ['Shelter capacity reconciled with digital twin']);
  platform.afterActionReport('inc-100', [{ finding: 'Access-control feed failed over slowly', severity: 'major', owner: 'security' }]);
  return platform.workspace(true);
}
