import { hasPermission, type Role } from '@trackmind/shared';

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

export interface OperationalSystemLink { system: string; status: 'online' | 'degraded' | 'offline'; dataFeeds: string[]; }
export interface DigitalTwinImpact { assetId: string; zone: string; risk: IncidentSeverity; dependencies?: string[]; }
export interface EmergencyIncidentInput { id: string; scenario: EmergencyScenario; severity: IncidentSeverity; location: string; reportedAt: string; affectedAssets: DigitalTwinImpact[]; systems: OperationalSystemLink[]; populationAtRisk?: number; }
export interface ContinuityPlan { id: string; name: string; criticalProcesses: string[]; recoveryTimeObjectiveMinutes: number; recoveryPointObjectiveMinutes: number; alternateSites: string[]; manualWorkarounds: string[]; }
export interface EmergencyPlan { id: string; name: string; scenarios: EmergencyScenario[]; ownerRole: string; activationCriteria: string[]; communicationChannels: string[]; evacuationZoneIds: string[]; drillCadenceDays: number; }
export interface IncidentCommandRole { id: string; role: EmergencyRoleName; assignee: string; backup?: string; permissions: Array<'activate-workflow' | 'override-ai' | 'dispatch-resource' | 'send-communication' | 'close-incident'>; }
export interface EmergencyResource { id: string; kind: EmergencyResourceKind; label: string; status: 'available' | 'assigned' | 'depleted' | 'offline'; zoneId: string; coordinates: { latitude: number; longitude: number }; capacity?: number; }
export interface EvacuationZone { id: string; name: string; status: 'open' | 'evacuating' | 'cleared' | 'closed'; route: string[]; assemblyArea: string; capacity: number; }
export interface CommunicationChecklistItem { id: string; audience: string; channel: string; message: string; completed: boolean; completedBy?: string; completedAt?: string; }
export interface EmergencyWorkflowInput { id: string; planId: string; incident: EmergencyIncidentInput; activatedBy: string; activatedByRoles: Role[]; commandRoles: IncidentCommandRole[]; resources: EmergencyResource[]; evacuationZones: EvacuationZone[]; communicationChecklist: CommunicationChecklistItem[]; aiRecommendationId?: string; }
export interface EmergencyAuditRecord { id: string; action: string; actor: string; subjectId: string; timestamp: string; humanOverride: boolean; aiBlocked: false; previousHash: string; hash: string; }
export interface EmergencyDomainEvent { id: string; type: string; subjectId: string; severity: IncidentSeverity; timestamp: string; auditId: string; payload: Record<string, unknown>; }

const nowIso = () => new Date().toISOString();
const commandByScenario: Record<EmergencyScenario, string> = { 'severe-weather': 'incident-commander-weather-ops', 'medical-emergency': 'medical-branch-director', 'fire-incident': 'fire-safety-incident-commander', 'infrastructure-failure': 'facilities-branch-director', evacuation: 'public-safety-incident-commander', 'security-incident': 'security-operations-commander', 'business-continuity': 'continuity-manager', 'disaster-recovery': 'technology-recovery-lead' };
const workflowByScenario: Record<EmergencyScenario, string[]> = { 'severe-weather': ['monitor nws alerts', 'pause exposed operations', 'shelter horses and guests', 'inspect surface', 'resume by approval'], 'medical-emergency': ['triage patient', 'dispatch ems and veterinarian if needed', 'secure access lane', 'document treatment', 'family or owner notification'], 'fire-incident': ['activate alarm', 'dispatch fire brigade', 'isolate utilities', 'evacuate affected zone', 'all-clear inspection'], 'infrastructure-failure': ['isolate failed asset', 'switch to redundant service', 'dispatch maintenance', 'validate life safety systems', 'restore normal operations'], evacuation: ['open evacuation routes', 'stage transportation', 'account for people and horses', 'communicate assembly areas', 'controlled re-entry'], 'security-incident': ['lock down affected zone', 'notify law enforcement', 'preserve evidence', 'screen access points', 'return to normal posture'], 'business-continuity': ['activate continuity team', 'prioritize critical processes', 'move to alternate work mode', 'track service levels', 'demobilize'], 'disaster-recovery': ['declare dr event', 'restore priority platforms', 'validate data integrity', 'fail back services', 'complete recovery report'] };

export class EmergencyOperationsPlatform {
  private incidents = new Map<string, EmergencyIncidentInput>();
  private plans = new Map<string, ContinuityPlan | EmergencyPlan>();
  private workflows = new Map<string, ReturnType<EmergencyOperationsPlatform['createEmergencyWorkflow']>>();
  private auditRecords: EmergencyAuditRecord[] = [];
  private events: EmergencyDomainEvent[] = [];

  registerContinuityPlan(plan: ContinuityPlan) { this.plans.set(plan.id, plan); return { ...plan, tested: false, governance: ['ISO 22301', 'NIMS/ICS', 'local emergency action plan'] }; }
  registerEmergencyPlan(plan: EmergencyPlan) { this.plans.set(plan.id, plan); return { ...plan, aiMayBlockActivation: false, humanOverrideRequired: true, workflows: plan.scenarios.map((scenario) => workflowByScenario[scenario]) }; }
  canManageEmergency(roles: Role[]) { return roles.some((role) => hasPermission(role, 'incident:manage')); }

  openIncident(input: EmergencyIncidentInput) {
    this.incidents.set(input.id, input);
    const offlineSystems = input.systems.filter((system) => system.status !== 'online').map((system) => system.system);
    return { incidentId: input.id, scenario: input.scenario, severity: input.severity, incidentCommander: commandByScenario[input.scenario], commandStructure: ['incident commander', 'safety officer', 'public information officer', 'operations', 'planning', 'logistics', 'finance/admin'], workflows: workflowByScenario[input.scenario], communicationChannels: ['mass-notification', 'radio-ops', 'executive-briefing', 'public-address', 'regulator-update'], integratedSystems: input.systems.map((system) => system.system), degradedSystems: offlineSystems, twinImpactMap: input.affectedAssets, evacuationRequired: input.scenario === 'evacuation' || input.severity === 'critical' || (input.populationAtRisk ?? 0) > 500, resourceRequests: this.resourcePlan(input), aiMayBlockEmergencyAction: false, humanOverrideSupported: true };
  }

  createEmergencyWorkflow(input: EmergencyWorkflowInput) {
    if (!this.canManageEmergency(input.activatedByRoles)) throw new Error('incident:manage permission required');
    const incidentView = this.openIncident(input.incident);
    const audit = this.appendAudit('emergency.workflow.activated', input.activatedBy, input.id, true);
    const event = this.appendEvent('emergency.workflow.activated', input.id, input.incident.severity, audit.id, { planId: input.planId, scenario: input.incident.scenario });
    const checklist = workflowByScenario[input.incident.scenario].map((label, index) => ({ id: `${input.id}-step-${index + 1}`, label, completed: false, humanOverrideAvailable: true, aiBlockingAllowed: false }));
    const workflow = { id: input.id, planId: input.planId, status: 'active' as EmergencyWorkflowStatus, activeEmergencyStatus: `${input.incident.severity} ${input.incident.scenario}`, incident: incidentView, commandRoles: input.commandRoles, resources: input.resources, resourceMap: input.resources.map((resource) => ({ id: resource.id, label: resource.label, kind: resource.kind, status: resource.status, zoneId: resource.zoneId, coordinates: resource.coordinates })), evacuationZones: input.evacuationZones, medicalResponse: this.responsePlan('medical-emergency'), fireResponse: this.responsePlan('fire-incident'), severeWeatherResponse: this.responsePlan('severe-weather'), checklist, communicationLog: input.communicationChecklist, auditTimeline: [audit], events: [event], emergencyActions: { humanOverrideSupported: true, aiMayBlock: false, reason: 'Emergency life-safety actions remain executable by authorized humans even when AI is unavailable or disagrees.' } };
    this.workflows.set(input.id, workflow);
    return workflow;
  }

  recordCommunication(workflowId: string, itemId: string, actor: string) {
    const workflow = this.workflows.get(workflowId); if (!workflow) throw new Error(`Unknown workflow: ${workflowId}`);
    workflow.communicationLog = workflow.communicationLog.map((item) => item.id === itemId ? { ...item, completed: true, completedBy: actor, completedAt: nowIso() } : item);
    const audit = this.appendAudit('emergency.communication.completed', actor, itemId, true); const event = this.appendEvent('emergency.communication.completed', workflowId, workflow.incident.severity, audit.id, { itemId });
    workflow.auditTimeline.push(audit); workflow.events.push(event); return workflow;
  }

  runSimulationExercise(id: string, scenario: EmergencyScenario, participants: string[]) { return { id, scenario, participants, injects: workflowByScenario[scenario].map((step, index) => ({ minute: index * 10, prompt: step })), successCriteria: ['notifications under 5 minutes', 'asset status reconciled with digital twin', 'command log complete', 'recovery objectives met'] }; }
  afterActionReport(incidentId: string, observations: Array<{ finding: string; severity: IncidentSeverity; owner: string }>) { const incident = this.incidents.get(incidentId); if (!incident) throw new Error(`Unknown incident: ${incidentId}`); const audit = this.appendAudit('emergency.after-action.created', 'after-action-coordinator', incidentId, true); return { incidentId, scenario: incident.scenario, timelineEntries: workflowByScenario[incident.scenario].length, findings: observations, correctiveActions: observations.map((observation, index) => ({ id: `${incidentId}-ca-${index + 1}`, owner: observation.owner, action: `Resolve: ${observation.finding}`, dueDays: observation.severity === 'critical' ? 7 : 30 })), evidencePackage: ['command-log', 'communications-transcript', 'digital-twin-state-history', 'resource-ledger', audit.id] }; }
  continuityStatus() { return [...this.plans.values()].filter((plan): plan is ContinuityPlan => 'criticalProcesses' in plan).map((plan) => ({ planId: plan.id, name: plan.name, criticalProcesses: plan.criticalProcesses.length, rtoMinutes: plan.recoveryTimeObjectiveMinutes, rpoMinutes: plan.recoveryPointObjectiveMinutes, ready: plan.alternateSites.length > 0 && plan.manualWorkarounds.length > 0 })); }
  listAuditRecords() { return [...this.auditRecords]; }
  listEvents() { return [...this.events]; }

  private responsePlan(scenario: EmergencyScenario) { return { scenario, lead: commandByScenario[scenario], checklist: workflowByScenario[scenario], humanOverrideSupported: true, aiMayBlock: false }; }
  private appendAudit(action: string, actor: string, subjectId: string, humanOverride: boolean) { const previousHash = this.auditRecords.at(-1)?.hash ?? 'genesis'; const record = { id: `audit-emergency-${this.auditRecords.length + 1}`, action, actor, subjectId, timestamp: nowIso(), humanOverride, aiBlocked: false as const, previousHash, hash: `sha256:emergency-${this.auditRecords.length + 1}-${subjectId}` }; this.auditRecords.push(record); return record; }
  private appendEvent(type: string, subjectId: string, severity: IncidentSeverity, auditId: string, payload: Record<string, unknown>) { const event = { id: `evt-emergency-${this.events.length + 1}`, type, subjectId, severity, timestamp: nowIso(), auditId, payload }; this.events.push(event); return event; }
  private resourcePlan(input: EmergencyIncidentInput) { const base = ['incident command post', 'first-aid kits', 'radios', 'access-control staff']; const scenarioResources: Record<EmergencyScenario, string[]> = { 'severe-weather': ['weather radar feed', 'surface inspection crew', 'shelter capacity'], 'medical-emergency': ['ems unit', 'veterinary response', 'stretcher cart'], 'fire-incident': ['fire extinguishers', 'utility shutoff team', 'mutual-aid fire department'], 'infrastructure-failure': ['generator', 'maintenance crew', 'spare parts cache'], evacuation: ['buses', 'horse transport', 'assembly-area marshals'], 'security-incident': ['law enforcement liaison', 'camera review team', 'perimeter barriers'], 'business-continuity': ['alternate workspace', 'manual forms', 'vendor contact bridge'], 'disaster-recovery': ['backup restore team', 'clean-room credentials', 'network failover'] }; return [...base, ...scenarioResources[input.scenario]]; }
}

export function buildEmergencyOperationsBlueprint(systems: OperationalSystemLink[], assets: DigitalTwinImpact[]) { return { supportedScenarios: Object.keys(commandByScenario) as EmergencyScenario[], operationalIntegrations: systems.map((system) => ({ ...system, monitored: true })), digitalTwinAssets: assets, minimumCapabilities: ['incident command', 'resource management', 'communications', 'evacuation routing', 'continuity planning', 'disaster recovery', 'simulation exercises', 'after-action reporting', 'human override', 'non-blocking emergency AI guardrails'] }; }
