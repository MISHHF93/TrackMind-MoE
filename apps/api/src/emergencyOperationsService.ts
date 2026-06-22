import type { Role } from '@trackmind/shared';
import {
  EmergencyOperationsPlatform,
  type EmergencyScenario,
  type EmergencyWorkflowInput,
  type IncidentCommandRole,
} from './emergencyOperations.js';
import type { SafetyService } from './services/safetyService.js';

type JsonRecord = Record<string, unknown>;

export interface EmergencyMutationResult {
  accepted: true;
  subjectId: string;
  auditId: string;
  eventType: string;
  message: string;
  approvalPosture: ReturnType<EmergencyOperationsPlatform['postActionEvidencePosture']>;
  evidencePackage: string[];
  workspace: JsonRecord;
  mock: false;
  workflowId?: string;
}

export interface EmergencyOperationsServiceOptions {
  platform: EmergencyOperationsPlatform;
  safety?: SafetyService;
  clock?: () => string;
}

const isRole = (value: unknown): value is Role => typeof value === 'string';

export function emergencyRolesFromInput(input: JsonRecord, headerRole?: string): Role[] {
  const roles = (Array.isArray(input.roles) ? input.roles : headerRole ? [headerRole] : ['admin']).filter(isRole);
  return roles.length > 0 ? roles : (['admin'] as Role[]);
}

export function defaultCommandRoles(assignee: string): IncidentCommandRole[] {
  return [{
    id: 'role-ic',
    role: 'incident-commander',
    assignee,
    permissions: ['activate-workflow', 'override-ai', 'dispatch-resource', 'send-communication', 'close-incident'],
  }];
}

export class EmergencyOperationsService {
  private readonly clock: () => string;

  constructor(private readonly options: EmergencyOperationsServiceOptions) {
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  get platform() {
    return this.options.platform;
  }

  workspace() {
    return this.options.platform.workspace(false) as unknown as JsonRecord;
  }

  private mutationBody(input: {
    subjectId: string;
    auditId: string;
    eventType: string;
    message: string;
    workflowId?: string;
    approvalRequestId?: string;
  }): EmergencyMutationResult {
    const posture = this.options.platform.postActionEvidencePosture(input.subjectId, input.auditId, input.approvalRequestId);
    const evidencePackage = ['command-log', input.auditId, input.eventType];
    const base: EmergencyMutationResult = {
      accepted: true,
      subjectId: input.subjectId,
      auditId: input.auditId,
      eventType: input.eventType,
      message: input.message,
      approvalPosture: posture,
      evidencePackage,
      workspace: this.workspace(),
      mock: false,
    };
    return input.workflowId ? { ...base, workflowId: input.workflowId } : base;
  }

  private recordSafetyEvidence(incidentId: string, action: string, requestedBy: string, auditId: string, evidenceLinks: string[]) {
    this.options.safety?.recordPostActionEmergencyEvidence({
      incidentId,
      action,
      requestedBy,
      auditId,
      evidenceLinks,
    });
  }

  activateWorkflow(input: JsonRecord, roles: Role[]): EmergencyMutationResult {
    const scenario = String(input.scenario ?? 'severe-weather') as EmergencyWorkflowInput['incident']['scenario'];
    const severity = String(input.severity ?? 'major') as EmergencyWorkflowInput['incident']['severity'];
    const workflowId = String(input.id ?? `wf-${Date.now()}`);
    const planId = String(input.planId ?? 'plan-weather');
    const location = String(input.location ?? 'Track perimeter');
    const activatedBy = String(input.activatedBy ?? 'incident-commander');
    const tenantId = String(input.tenantId ?? 'trackmind');
    const racetrackId = String(input.racetrackId ?? 'main-track');
    const commandRoles = Array.isArray(input.commandRoles) && input.commandRoles.length > 0
      ? input.commandRoles as IncidentCommandRole[]
      : defaultCommandRoles(activatedBy);

    const workflow = this.options.platform.createEmergencyWorkflow({
      id: workflowId,
      planId,
      activatedBy,
      activatedByRoles: roles,
      tenantId,
      racetrackId,
      incident: {
        id: String(input.incidentId ?? `inc-${workflowId}`),
        scenario,
        severity,
        location,
        reportedAt: this.clock(),
        populationAtRisk: Number(input.populationAtRisk ?? 0),
        affectedAssets: [{ assetId: 'grandstand', zone: 'zone-grandstand', risk: severity === 'critical' ? 'critical' : 'major' }],
        systems: [{ system: 'workflow-engine', status: 'online', dataFeeds: ['workflow-state'] }],
      },
      commandRoles,
      resources: [{ id: `res-${workflowId}`, kind: 'personnel', label: 'Incident response team', status: 'assigned', zoneId: 'zone-grandstand', coordinates: { latitude: 38.044, longitude: -76.949 } }],
      evacuationZones: [{ id: 'zone-grandstand', name: 'Grandstand', status: 'open', route: ['main concourse'], assemblyArea: 'South Plaza', capacity: 1200 }],
      communicationChecklist: [{ id: `comm-${workflowId}`, audience: 'field teams', channel: 'radio', message: `Emergency workflow ${workflowId} activated`, completed: false }],
    });

    const auditId = workflow.auditTimeline.at(-1)?.id ?? `audit-emergency-${workflowId}`;
    const evidencePackage = ['command-log', auditId, 'emergency.workflow.activated'];
    this.recordSafetyEvidence(workflow.incident.incidentId, 'emergency-workflow-activated', activatedBy, auditId, evidencePackage);

    return this.mutationBody({
      subjectId: workflow.id,
      workflowId: workflow.id,
      auditId,
      eventType: 'emergency.workflow.activated',
      message: `Emergency workflow ${workflow.id} activated under human incident command authority.`,
      approvalRequestId: workflow.approvalPosture.approvalRequestId,
    });
  }

  completeCommunication(workflowId: string, input: JsonRecord): EmergencyMutationResult {
    const actor = String(input.actor ?? input.completedBy ?? 'incident-commander');
    const itemId = String(input.itemId ?? input.communicationId ?? '');
    const workflow = this.options.platform.recordCommunication(workflowId, itemId, actor);
    const auditId = workflow.auditTimeline.at(-1)?.id ?? `audit-emergency-${workflowId}`;
    this.recordSafetyEvidence(workflow.incident.incidentId, 'emergency-communication-completed', actor, auditId, ['command-log', auditId, 'emergency.communication.completed']);

    return this.mutationBody({
      subjectId: itemId,
      workflowId,
      auditId,
      eventType: 'emergency.communication.completed',
      message: `Communication ${itemId} marked complete under incident command authority.`,
    });
  }

  scheduleDrill(input: JsonRecord): EmergencyMutationResult {
    const drillId = String(input.id ?? `drill-${Date.now()}`);
    const scenario = String(input.scenario ?? 'severe-weather') as EmergencyScenario;
    const participants = Array.isArray(input.participants) ? input.participants.map(String) : ['ops', 'security'];
    const drill = this.options.platform.runSimulationExercise(drillId, scenario, participants);
    const auditId = `audit-emergency-drill-${drill.id}`;

    return this.mutationBody({
      subjectId: drill.id,
      auditId,
      eventType: 'emergency.drill.scheduled',
      message: `Emergency drill ${drill.id} scheduled for ${scenario} scenario.`,
    });
  }

  completeDrill(drillId: string, input: JsonRecord): EmergencyMutationResult {
    const actor = String(input.actor ?? 'incident-commander');
    const workflowId = input.workflowId ? String(input.workflowId) : undefined;
    const observations = Array.isArray(input.observations) ? input.observations.map(String) : [];
    const drill = this.options.platform.completeDrill(drillId, actor, observations, workflowId);
    const auditId = drill.auditId ?? `audit-emergency-drill-${drillId}`;

    return this.mutationBody({
      subjectId: drill.id,
      auditId,
      eventType: 'emergency.drill.completed',
      message: `Emergency drill ${drill.id} completed with post-action evidence recorded.`,
    });
  }

  createAfterActionReport(input: JsonRecord): EmergencyMutationResult {
    const incidentId = String(input.incidentId ?? 'inc-100');
    const actor = String(input.actor ?? 'incident-commander');
    const workflowId = input.workflowId ? String(input.workflowId) : undefined;
    const findings = Array.isArray(input.findings)
      ? input.findings as Array<{ finding: string; severity: EmergencyWorkflowInput['incident']['severity']; owner: string }>
      : [{ finding: 'Command log reviewed', severity: 'major' as const, owner: 'safety' }];

    const report = this.options.platform.afterActionReport(incidentId, findings, actor, workflowId);
    const auditId = report.evidencePackage.at(-1) ?? `audit-emergency-${incidentId}`;

    try {
      this.options.safety?.submitPostIncidentReview({
        incidentId,
        findings: findings.map((finding) => ({
          finding: finding.finding,
          severity:
            finding.severity === 'critical' ? 'critical'
              : finding.severity === 'major' ? 'high'
                : finding.severity === 'minor' ? 'low'
                  : 'medium',
          owner: finding.owner,
        })),
        submittedBy: actor,
        evidence: report.evidencePackage,
      });
    } catch {
      // Safety incident service may be unavailable in facade-only contexts; emergency report still stands.
    }

    return this.mutationBody({
      subjectId: incidentId,
      auditId,
      eventType: 'emergency.after-action.created',
      message: `After-action report created for incident ${incidentId} with post-action evidence package.`,
      approvalRequestId: (report.approvalPosture as { approvalRequestId?: string }).approvalRequestId,
    });
  }
}

export function createEmergencyOperationsService(options: EmergencyOperationsServiceOptions) {
  return new EmergencyOperationsService(options);
}
