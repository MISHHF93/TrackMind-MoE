import type { ApprovalViewStatusDto, CanonicalEventRef } from '@trackmind/shared';
import type { CentralizedApprovalService, ControlledAction, ControlledActionRequest } from './approvals.js';
import type { AuditSeverity, ImmutableAuditLog } from './auditLog.js';
import type { EventName, UniversalEventBus } from './eventBus.js';

export type WorkflowDomain = 'race-day' | 'maintenance' | 'stewarding' | 'veterinary' | 'compliance' | 'investigation' | 'emergency' | 'inspection' | 'staffing' | 'security' | 'ai-review';
export type WorkflowTaskType = 'userTask' | 'serviceTask' | 'approvalTask' | 'parallelApproval' | 'exclusiveGateway' | 'parallelGateway' | 'timerEvent' | 'inspectionTask' | 'investigationTask' | 'complianceReviewTask' | 'emergencyTask' | 'endEvent';
export type WorkflowStatus = 'defined' | 'running' | 'waiting' | 'completed' | 'escalated' | 'exception' | 'recovering';
export type TaskStatus = 'open' | 'claimed' | 'approved' | 'rejected' | 'completed' | 'escalated' | 'skipped' | 'failed' | 'retrying';
export type WorkflowEventType = 'workflow.template.registered' | 'workflow.started' | 'workflow.transitioned' | 'task.created' | 'task.claimed' | 'task.completed' | 'task.failed' | 'task.retried' | 'task.escalated' | 'approval.requested' | 'approval.recorded' | 'sla.breached' | 'workflow.completed' | 'workflow.exception' | 'workflow.recovered' | 'digitalTwin.updated' | 'service.executed';

export interface WorkflowRetryPolicy { maxAttempts: number; backoffMinutes: number; retryableErrors?: string[]; }
export interface WorkflowSlaPolicy { minutes: number; escalationRole: string; severity: 'warning' | 'breach' | 'critical'; }
export interface DigitalTwinBinding { refs: string[]; syncMode: 'read' | 'write' | 'read-write'; statePatch?: Record<string, unknown>; }
export interface WorkflowApprovalBinding { action: ControlledAction; target?: string; targetPath?: string; reason?: string; evidence?: string[]; evidencePath?: string; requestedBy?: string; actorType?: ControlledActionRequest['actorType']; requestId?: string; }
export interface WorkflowEngineDeps { approvalService?: CentralizedApprovalService; auditLog?: ImmutableAuditLog; eventBus?: UniversalEventBus; observability?: (signal: WorkflowObservabilitySignal) => void; }
export interface WorkflowObservabilitySignal { name: WorkflowEventType | string; timestamp: string; serviceId: 'workflow-orchestration-engine'; severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'; traceId: string; attributes: Record<string, unknown>; }
export type CanonicalWorkflowId = 'tmwf.gate-move.v1' | 'tmwf.horse-entry.v1' | 'tmwf.scratch.v1' | 'tmwf.inspection.v1' | 'tmwf.incident.v1' | 'tmwf.race-readiness.v1' | 'tmwf.emergency.v1';
export type WorkflowCertificationEvidenceKind = 'approval-policy' | 'audit-record' | 'event-contract' | 'digital-twin-sync' | 'role-attestation' | 'sla-clock' | 'evidence-package';
export interface WorkflowApprovalPointMetadata { stepId: string; action: ControlledAction; requiredRoles: string[]; minimumApprovals: number; evidenceRequired: string[]; deadlineMinutes: number; policy: string; }
export interface WorkflowAuditRequirementMetadata { action: WorkflowEventType | string; severity: AuditSeverity; evidenceRequired: string[]; retention: string; }
export interface WorkflowEventRequirementMetadata { type: WorkflowEventType | string; requiredReferences: string[]; producer: string; }
export interface WorkflowTwinSyncPointMetadata { stepId: string; refs: string[]; syncMode: DigitalTwinBinding['syncMode']; requiredBeforeApproval: boolean; }
export interface WorkflowSlaMetadata { startWithinMinutes: number; completeWithinMinutes: number; escalationRole: string; deadlineField: string; breachEvent: 'sla.breached'; }
export interface WorkflowCertificationEvidenceRequirement { id: string; kind: WorkflowCertificationEvidenceKind; label: string; required: true; }
export interface WorkflowTemplateMetadata {
  canonicalId: CanonicalWorkflowId;
  templateName: string;
  certifiedRacetrackRequired: true;
  safetyCritical: boolean;
  requiredRoles: string[];
  protectedActions: ControlledAction[];
  approvalPoints: WorkflowApprovalPointMetadata[];
  auditRequirements: WorkflowAuditRequirementMetadata[];
  eventRequirements: WorkflowEventRequirementMetadata[];
  digitalTwinSyncPoints: WorkflowTwinSyncPointMetadata[];
  sla: WorkflowSlaMetadata;
  certificationEvidence: WorkflowCertificationEvidenceRequirement[];
  apiFacadePath: '/api/v1/workflows/templates';
}
export interface WorkflowTemplateRegistry { tenantId: string; certificationTier: 'Tier 4'; generatedAt: string; templates: WorkflowTemplateMetadata[]; }
export type WorkflowArtifactStatus = Extract<ApprovalViewStatusDto, 'pending' | 'approved' | 'rejected' | 'expired' | 'escalated'>;
export interface WorkflowArtifactTask {
  id: string;
  stepId: string;
  name: string;
  type: WorkflowTaskType;
  status: WorkflowArtifactStatus;
  sourceStatus: TaskStatus | WorkflowStatus | 'defined';
  role?: string;
  assignees: string[];
  dueAt?: string;
  escalation?: { role?: string; escalatedTo?: string; severity?: WorkflowSlaPolicy['severity'] };
  approvalRequestId?: string;
  approvalAction?: ControlledAction;
  approvalTarget?: string;
  requiredApprovers: string[];
  minimumApprovals: number;
  approvals: Array<{ role: string; actor: string; decision: 'approved' | 'rejected'; reason: string; timestamp: string }>;
  evidence: string[];
  auditRefs: string[];
  eventRefs: string[];
}
export interface WorkflowArtifactApproval {
  id: string;
  taskId?: string;
  stepId: string;
  action?: ControlledAction;
  target?: string;
  status: WorkflowArtifactStatus;
  sourceStatus: TaskStatus | WorkflowStatus | 'defined';
  requiredApprovers: string[];
  minimumApprovals: number;
  evidence: string[];
  approvals: Array<{ role: string; actor: string; decision: 'approved' | 'rejected'; reason: string; timestamp: string }>;
  expiresAt?: string;
  escalation?: { role?: string; escalatedTo?: string; severity?: WorkflowSlaPolicy['severity'] };
}
export interface WorkflowArtifact {
  schemaVersion: 'trackmind.workflow-artifact.v1';
  id: string;
  artifactType: 'workflow';
  workflowType: string;
  definitionId: string;
  definitionVersion: string;
  templateName?: string;
  status: WorkflowArtifactStatus;
  sourceStatus: WorkflowStatus | 'defined';
  tenantId: string;
  racetrackId: string;
  tasks: WorkflowArtifactTask[];
  approvals: WorkflowArtifactApproval[];
  requiredApprovers: string[];
  evidence: string[];
  expiresAt?: string;
  escalation?: { role?: string; severity?: WorkflowSlaPolicy['severity']; deadlineField?: string; completeWithinMinutes?: number };
  correlationId: string;
  auditRefs: string[];
  eventRefs: string[];
  digitalTwinRefs: string[];
  protectedActions: ControlledAction[];
  mutationPolicy: { localMutationAllowed: false; writeModel: 'server-authoritative'; updatePath: '/api/v1/workflows' };
  generatedAt: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowTaskType;
  role?: string;
  assignees?: string[];
  next?: string[];
  slaMinutes?: number;
  sla?: WorkflowSlaPolicy;
  escalationRole?: string;
  approvalRoles?: string[];
  requiredApprovals?: number;
  retryPolicy?: WorkflowRetryPolicy;
  recoveryStepId?: string;
  eventTrigger?: string;
  digitalTwin?: DigitalTwinBinding;
  approval?: WorkflowApprovalBinding;
  dependencies?: string[];
  condition?: (context: WorkflowContext) => boolean;
  action?: (context: WorkflowContext) => Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  domain: WorkflowDomain;
  version: string;
  bpmnProcessId: string;
  startStepId: string;
  ownerRole: string;
  tenantId: string;
  description?: string;
  triggerEvents?: string[];
  templateMetadata?: WorkflowTemplateMetadata;
  steps: WorkflowStep[];
}

export interface WorkflowContext {
  tenantId: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  digitalTwinRefs: string[];
  payload: Record<string, unknown>;
}

export interface WorkflowTask {
  id: string;
  stepId: string;
  name: string;
  type: WorkflowTaskType;
  status: TaskStatus;
  role?: string;
  assignees: string[];
  dueAt?: string;
  escalatedTo?: string;
  attempt: number;
  retryAt?: string;
  failure?: { error: string; timestamp: string; recoverable: boolean };
  claimedBy?: string;
  claimedAt?: string;
  completedAt?: string;
  approvalRequestId?: string;
  approvalAction?: ControlledAction;
  approvalTarget?: string;
  approvals: Array<{ role: string; actor: string; decision: 'approved' | 'rejected'; reason: string; timestamp: string }>;
}

export interface WorkflowAuditEntry { id: string; timestamp: string; actor: string; action: WorkflowEventType | string; details: Record<string, unknown>; }
export interface WorkflowRuntimeEvent extends Pick<CanonicalEventRef, 'eventId' | 'eventType' | 'tenantId' | 'racetrackId' | 'actorId' | 'source' | 'timestamp' | 'version'> { id: string; type: WorkflowEventType | string; instanceId?: string; payload: Record<string, unknown>; }

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  definitionVersion: string;
  tenantId: string;
  status: WorkflowStatus;
  context: WorkflowContext;
  activeStepIds: string[];
  completedStepIds: string[];
  tasks: WorkflowTask[];
  audit: WorkflowAuditEntry[];
  events: WorkflowRuntimeEvent[];
  exceptions: string[];
  digitalTwinRefs: string[];
  digitalTwinState: Record<string, unknown>;
}

export interface VisualWorkflowNode { id: string; label: string; type: WorkflowTaskType; status: 'pending' | 'active' | TaskStatus | WorkflowStatus; role?: string; assignees: string[]; dueAt?: string; slaMinutes?: number; digitalTwinRefs: string[]; position: { x: number; y: number }; }
export interface VisualWorkflowEdge { id: string; source: string; target: string; label?: string; status: 'pending' | 'active' | 'completed' | 'blocked'; }
export interface VisualWorkflowGraph { instanceId: string; definitionId: string; status: WorkflowStatus; nodes: VisualWorkflowNode[]; edges: VisualWorkflowEdge[]; dependencies: Array<{ stepId: string; dependsOn: string[] }>; criticalPath: string[]; }
export interface WorkflowSlaSnapshot { instanceId: string; taskId: string; stepId: string; name: string; status: TaskStatus; dueAt?: string; minutesRemaining?: number; breached: boolean; severity: WorkflowSlaPolicy['severity']; escalatedTo?: string; ownerRole: string; digitalTwinRefs: string[]; }

const minutesAfter = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
const cloneRecord = <T>(value: T): T => value === undefined ? value : structuredClone(value);
const unique = <T>(values: T[]): T[] => [...new Set(values)];
const normalizeWorkflowArtifactStatus = (status: WorkflowStatus | TaskStatus | 'defined' | string): WorkflowArtifactStatus => {
  if (status === 'approved' || status === 'completed' || status === 'skipped') return 'approved';
  if (status === 'rejected' || status === 'failed' || status === 'exception') return 'rejected';
  if (status === 'escalated') return 'escalated';
  return 'pending';
};
const valueAtPath = (source: Record<string, unknown> | undefined, path?: string): unknown => !source || !path ? undefined : path.split('.').reduce<unknown>((value, segment) => value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined, source);
const evidenceFromStep = (step: WorkflowStep | undefined, payload?: Record<string, unknown>): string[] => {
  const pathValue = valueAtPath(payload, step?.approval?.evidencePath);
  return unique([...(step?.approval?.evidence ?? []), ...(Array.isArray(pathValue) ? pathValue.map(String) : pathValue ? [String(pathValue)] : [])]);
};
const workflowTypeFor = (definition?: WorkflowDefinition, instance?: WorkflowInstance): string => definition?.templateMetadata?.canonicalId ?? definition?.id ?? instance?.definitionId ?? 'unknown-workflow';
const racetrackFor = (tenantId: string, payload?: Record<string, unknown>, racetrackId?: string): string => racetrackId ?? String(payload?.racetrackId ?? payload?.trackId ?? tenantId);
const definitionFromInstance = (instance: WorkflowInstance): WorkflowDefinition => ({
  id: instance.definitionId,
  name: instance.definitionId,
  domain: 'race-day',
  version: instance.definitionVersion,
  bpmnProcessId: `Process_${instance.definitionId.replace(/[^a-zA-Z0-9]+/g, '_')}`,
  startStepId: instance.tasks[0]?.stepId ?? 'unknown',
  ownerRole: 'workflow-owner',
  tenantId: instance.tenantId,
  steps: instance.tasks.map((task, index) => ({
    id: task.stepId,
    name: task.name,
    type: task.type,
    role: task.role,
    assignees: [...task.assignees],
    next: instance.tasks[index + 1] ? [instance.tasks[index + 1].stepId] : [],
    approvalRoles: unique(task.approvals.map((approval) => approval.role)),
    requiredApprovals: task.approvals.length,
  })),
});

export function buildWorkflowArtifact(source: WorkflowDefinition | WorkflowInstance, options: { definition?: WorkflowDefinition; racetrackId?: string; correlationId?: string; auditRefs?: string[]; eventRefs?: string[]; generatedAt?: string } = {}): WorkflowArtifact {
  const isInstance = 'definitionId' in source && 'context' in source;
  const definition = isInstance ? options.definition ?? definitionFromInstance(source) : source;
  const instance = isInstance ? source : undefined;
  const tenantId = instance?.tenantId ?? definition.tenantId;
  const payload = instance?.context.payload;
  const auditRefs = unique([...(options.auditRefs ?? []), ...(instance?.audit.map((entry) => entry.id) ?? [])]);
  const eventRefs = unique([...(options.eventRefs ?? []), ...(instance?.events.map((event) => event.id) ?? [])]);
  const stepTasks = definition.steps.map((step) => {
    const runtimeTask = instance?.tasks.find((task) => task.stepId === step.id);
    const sourceStatus = runtimeTask?.status ?? (instance?.completedStepIds.includes(step.id) ? 'completed' : 'defined');
    const dueAt = runtimeTask?.dueAt;
    return {
      id: runtimeTask?.id ?? step.id,
      stepId: step.id,
      name: runtimeTask?.name ?? step.name,
      type: runtimeTask?.type ?? step.type,
      status: normalizeWorkflowArtifactStatus(sourceStatus),
      sourceStatus,
      role: runtimeTask?.role ?? step.role,
      assignees: [...(runtimeTask?.assignees ?? step.assignees ?? [])],
      dueAt,
      escalation: step.sla || step.escalationRole || runtimeTask?.escalatedTo ? { role: step.sla?.escalationRole ?? step.escalationRole, escalatedTo: runtimeTask?.escalatedTo, severity: step.sla?.severity } : undefined,
      approvalRequestId: runtimeTask?.approvalRequestId,
      approvalAction: runtimeTask?.approvalAction ?? step.approval?.action,
      approvalTarget: runtimeTask?.approvalTarget,
      requiredApprovers: [...(step.approvalRoles ?? [])],
      minimumApprovals: step.requiredApprovals ?? step.approvalRoles?.length ?? 0,
      approvals: (runtimeTask?.approvals ?? []).map((approval) => ({ ...approval })),
      evidence: evidenceFromStep(step, payload),
      auditRefs: auditRefsForStep(instance, step.id, runtimeTask?.id),
      eventRefs: eventRefsForStep(instance, step.id, runtimeTask?.id),
    } satisfies WorkflowArtifactTask;
  });
  const runtimeOnlyTasks = (instance?.tasks ?? []).filter((task) => !definition.steps.some((step) => step.id === task.stepId)).map((task) => ({
    id: task.id,
    stepId: task.stepId,
    name: task.name,
    type: task.type,
    status: normalizeWorkflowArtifactStatus(task.status),
    sourceStatus: task.status,
    role: task.role,
    assignees: [...task.assignees],
    dueAt: task.dueAt,
    escalation: task.escalatedTo ? { escalatedTo: task.escalatedTo } : undefined,
    approvalRequestId: task.approvalRequestId,
    approvalAction: task.approvalAction,
    approvalTarget: task.approvalTarget,
    requiredApprovers: [],
    minimumApprovals: 0,
    approvals: task.approvals.map((approval) => ({ ...approval })),
    evidence: [],
    auditRefs: auditRefsForStep(instance, task.stepId, task.id),
    eventRefs: eventRefsForStep(instance, task.stepId, task.id),
  } satisfies WorkflowArtifactTask));
  const tasks = [...stepTasks, ...runtimeOnlyTasks];
  const approvals = tasks.filter((task) => task.type === 'approvalTask' || task.type === 'parallelApproval' || task.requiredApprovers.length || task.approvalAction).map((task) => ({
    id: task.approvalRequestId ?? `${workflowTypeFor(definition, instance)}:${task.stepId}:approval`,
    taskId: task.id,
    stepId: task.stepId,
    action: task.approvalAction,
    target: task.approvalTarget,
    status: task.status,
    sourceStatus: task.sourceStatus,
    requiredApprovers: [...task.requiredApprovers],
    minimumApprovals: task.minimumApprovals,
    evidence: [...task.evidence],
    approvals: task.approvals.map((approval) => ({ ...approval })),
    expiresAt: task.dueAt,
    escalation: task.escalation,
  } satisfies WorkflowArtifactApproval));
  const templateApprovalEvidence = definition.templateMetadata?.approvalPoints.flatMap((point) => point.evidenceRequired) ?? [];
  const artifact: WorkflowArtifact = {
    schemaVersion: 'trackmind.workflow-artifact.v1',
    id: `workflow-artifact:${instance?.id ?? definition.id}`,
    artifactType: 'workflow',
    workflowType: workflowTypeFor(definition, instance),
    definitionId: definition.id,
    definitionVersion: instance?.definitionVersion ?? definition.version,
    templateName: definition.templateMetadata?.templateName ?? definition.name,
    status: normalizeWorkflowArtifactStatus(instance?.status ?? 'defined'),
    sourceStatus: instance?.status ?? 'defined',
    tenantId,
    racetrackId: racetrackFor(tenantId, payload, options.racetrackId),
    tasks,
    approvals,
    requiredApprovers: unique([...approvals.flatMap((approval) => approval.requiredApprovers), ...(definition.templateMetadata?.requiredRoles ?? [])]),
    evidence: unique([...tasks.flatMap((task) => task.evidence), ...templateApprovalEvidence]),
    expiresAt: tasks.map((task) => task.dueAt).filter(Boolean).sort()[0],
    escalation: definition.templateMetadata?.sla ? { role: definition.templateMetadata.sla.escalationRole, deadlineField: definition.templateMetadata.sla.deadlineField, completeWithinMinutes: definition.templateMetadata.sla.completeWithinMinutes } : undefined,
    correlationId: options.correlationId ?? `${instance?.id ?? definition.id}:${instance?.status ?? 'defined'}`,
    auditRefs,
    eventRefs,
    digitalTwinRefs: unique([...(instance?.digitalTwinRefs ?? []), ...definition.steps.flatMap((step) => step.digitalTwin?.refs ?? [])]),
    protectedActions: [...(definition.templateMetadata?.protectedActions ?? unique(definition.steps.flatMap((step) => step.approval?.action ? [step.approval.action] : [])))],
    mutationPolicy: { localMutationAllowed: false, writeModel: 'server-authoritative', updatePath: '/api/v1/workflows' },
    generatedAt: options.generatedAt ?? new Date().toISOString(),
  };
  return cloneRecord(artifact);
}

function auditRefsForStep(instance: WorkflowInstance | undefined, stepId: string, taskId?: string): string[] {
  return instance?.audit.filter((entry) => entry.details.stepId === stepId || entry.details.taskId === taskId).map((entry) => entry.id) ?? [];
}

function eventRefsForStep(instance: WorkflowInstance | undefined, stepId: string, taskId?: string): string[] {
  return instance?.events.filter((event) => event.payload.stepId === stepId || event.payload.taskId === taskId).map((event) => event.id) ?? [];
}

export class WorkflowOrchestrationEngine {
  private definitions = new Map<string, WorkflowDefinition>();
  private workflowInstances = new Map<string, WorkflowInstance>();
  private eventLog: WorkflowRuntimeEvent[] = [];
  constructor(private readonly deps: WorkflowEngineDeps = {}) { this.registerWorkflowEventContracts(); }

  register(definition: WorkflowDefinition): WorkflowDefinition {
    if (!definition.steps.some((step) => step.id === definition.startStepId)) throw new Error(`Unknown start step ${definition.startStepId}`);
    const ids = new Set(definition.steps.map((step) => step.id));
    for (const step of definition.steps) for (const next of step.next ?? []) if (!ids.has(next)) throw new Error(`Step ${step.id} points to unknown step ${next}`);
    this.definitions.set(definition.id, definition);
    this.recordDefinitionEvent(definition, 'workflow.template.registered', { bpmnProcessId: definition.bpmnProcessId, domain: definition.domain, version: definition.version });
    return definition;
  }

  registerPortfolio(definitions: WorkflowDefinition[]): WorkflowDefinition[] { return definitions.map((definition) => this.register(definition)); }

  templates(tenantId?: string): WorkflowDefinition[] { return [...this.definitions.values()].filter((definition) => !tenantId || definition.tenantId === tenantId).map((definition) => this.cloneDefinition(definition)); }
  instancesForTenant(tenantId?: string): WorkflowInstance[] { return [...this.workflowInstances.values()].filter((instance) => !tenantId || instance.tenantId === tenantId).map((instance) => this.snapshot(instance)); }
  instances(tenantId?: string): WorkflowInstance[] { return this.instancesForTenant(tenantId); }

  start(definitionId: string, context: WorkflowContext, actor = 'system', now = new Date().toISOString()): WorkflowInstance {
    const definition = this.requireDefinition(definitionId);
    if (definition.tenantId !== context.tenantId) throw new Error('Workflow tenant mismatch');
    const instance: WorkflowInstance = { id: `${definitionId}-${this.workflowInstances.size + 1}`, definitionId, definitionVersion: definition.version, tenantId: context.tenantId, status: 'running', context, activeStepIds: [], completedStepIds: [], tasks: [], audit: [], events: [], exceptions: [], digitalTwinRefs: [...new Set(context.digitalTwinRefs)], digitalTwinState: {} };
    this.workflowInstances.set(instance.id, instance);
    this.audit(instance, now, actor, 'workflow.started', { definitionId, bpmnProcessId: definition.bpmnProcessId });
    this.activate(instance, [definition.startStepId], now, actor);
    return this.snapshot(instance);
  }

  emit(event: Omit<WorkflowRuntimeEvent, 'id' | 'timestamp' | 'eventId' | 'eventType' | 'racetrackId' | 'actorId' | 'source' | 'version'> & Partial<Pick<WorkflowRuntimeEvent, 'eventId' | 'eventType' | 'racetrackId' | 'actorId' | 'source' | 'version'>>, now = new Date().toISOString()): WorkflowInstance[] {
    const eventId = event.eventId ?? `event-${this.eventLog.length + 1}`;
    const runtimeEvent: WorkflowRuntimeEvent = { ...event, eventId, eventType: event.eventType ?? `${event.type}.v1` as CanonicalEventRef['eventType'], racetrackId: event.racetrackId ?? 'main-track', actorId: event.actorId ?? 'workflow-orchestration-engine', source: event.source ?? 'workflow-orchestration-engine', version: event.version ?? 1, id: eventId, timestamp: now };
    this.eventLog.push(runtimeEvent);
    const affected: WorkflowInstance[] = [];
    for (const instance of this.workflowInstances.values()) {
      if (event.instanceId && instance.id !== event.instanceId) continue;
      const definition = this.requireDefinition(instance.definitionId);
      const triggered = definition.steps.filter((step) => step.eventTrigger === event.type && (!event.instanceId || instance.activeStepIds.includes(step.id)));
      if (triggered.length) {
        instance.events.push(runtimeEvent);
        this.audit(instance, now, 'event-bus', event.type, event.payload);
        this.activate(instance, triggered.map((step) => step.id), now, 'event-bus');
        affected.push(this.snapshot(instance));
      }
    }
    return affected;
  }

  completeTask(instanceId: string, taskId: string, actor: string, output: Record<string, unknown> = {}, now = new Date().toISOString()): WorkflowInstance {
    const instance = this.requireInstance(instanceId);
    const task = this.requireTask(instance, taskId);
    if (!['open', 'claimed', 'retrying', 'escalated'].includes(task.status)) throw new Error(`Task ${taskId} is not open`);
    if (task.type === 'approvalTask' || task.type === 'parallelApproval') throw new Error(`Task ${taskId} requires explicit approval`);
    task.status = 'completed';
    task.completedAt = now;
    delete task.retryAt;
    instance.context.payload = { ...instance.context.payload, ...output };
    this.audit(instance, now, actor, 'task.completed', { taskId, stepId: task.stepId, output });
    this.advanceFrom(instance, task.stepId, now, actor);
    return this.snapshot(instance);
  }

  claimTask(instanceId: string, taskId: string, actor: string, now = new Date().toISOString()): WorkflowInstance {
    const instance = this.requireInstance(instanceId);
    const task = this.requireTask(instance, taskId);
    if (task.status !== 'open' && task.status !== 'escalated') throw new Error(`Task ${taskId} cannot be claimed`);
    task.status = 'claimed';
    task.claimedBy = actor;
    task.claimedAt = now;
    this.audit(instance, now, actor, 'task.claimed', { taskId, stepId: task.stepId });
    return this.snapshot(instance);
  }

  executeTask(instanceId: string, taskId: string, actor: string, input: Record<string, unknown> = {}, now = new Date().toISOString()): WorkflowInstance {
    const instance = this.requireInstance(instanceId);
    const definition = this.requireDefinition(instance.definitionId);
    const task = this.requireTask(instance, taskId);
    const step = definition.steps.find((candidate) => candidate.id === task.stepId);
    if (!step) throw new Error(`Unknown workflow step ${task.stepId}`);
    const output = { ...input, ...(step.action?.({ ...instance.context, payload: { ...instance.context.payload, ...input } }) ?? {}) };
    return this.completeTask(instanceId, taskId, actor, output, now);
  }

  failTask(instanceId: string, taskId: string, error: string, actor = 'system', now = new Date().toISOString()): WorkflowInstance {
    const instance = this.requireInstance(instanceId);
    const definition = this.requireDefinition(instance.definitionId);
    const task = this.requireTask(instance, taskId);
    const step = definition.steps.find((candidate) => candidate.id === task.stepId)!;
    const retryPolicy = step.retryPolicy;
    task.attempt += 1;
    const canRetry = Boolean(retryPolicy && task.attempt <= retryPolicy.maxAttempts && (!retryPolicy.retryableErrors?.length || retryPolicy.retryableErrors.includes(error)));
    task.failure = { error, timestamp: now, recoverable: canRetry || Boolean(step.recoveryStepId) };
    this.audit(instance, now, actor, 'task.failed', { taskId, stepId: step.id, error, attempt: task.attempt, canRetry });
    if (canRetry) {
      task.status = 'retrying';
      task.retryAt = minutesAfter(now, retryPolicy!.backoffMinutes * task.attempt);
      instance.status = 'recovering';
    } else if (step.recoveryStepId) {
      task.status = 'failed';
      instance.status = 'recovering';
      this.activate(instance, [step.recoveryStepId], now, actor);
    } else {
      task.status = 'failed';
      this.raiseException(instance, now, `Task ${taskId} failed: ${error}`);
    }
    return this.snapshot(instance);
  }

  retryReadyTasks(instanceId: string, now = new Date().toISOString()): WorkflowInstance {
    const instance = this.requireInstance(instanceId);
    for (const task of instance.tasks.filter((candidate) => candidate.status === 'retrying' && candidate.retryAt && candidate.retryAt <= now)) {
      task.status = 'open';
      this.audit(instance, now, 'system', 'task.retried', { taskId: task.id, attempt: task.attempt });
    }
    if (instance.status === 'recovering') instance.status = 'waiting';
    return this.snapshot(instance);
  }

  recordApproval(instanceId: string, taskId: string, role: string, actor: string, decision: 'approved' | 'rejected', reason: string, now = new Date().toISOString()): WorkflowInstance {
    const instance = this.requireInstance(instanceId);
    const definition = this.requireDefinition(instance.definitionId);
    const task = this.requireTask(instance, taskId);
    const step = definition.steps.find((candidate) => candidate.id === task.stepId)!;
    if (!step.approvalRoles?.includes(role)) throw new Error(`Role ${role} cannot approve ${task.stepId}`);
    task.approvals.push({ role, actor, decision, reason, timestamp: now });
    this.audit(instance, now, actor, 'approval.recorded', { taskId, role, decision, reason });
    if (decision === 'rejected') { task.status = 'rejected'; this.raiseException(instance, now, `Approval rejected by ${role}: ${reason}`); return this.snapshot(instance); }
    const uniqueApprovals = new Set(task.approvals.filter((approval) => approval.decision === 'approved').map((approval) => approval.role));
    if (uniqueApprovals.size >= (step.requiredApprovals ?? step.approvalRoles.length)) { task.status = 'approved'; this.advanceFrom(instance, task.stepId, now, actor); } else instance.status = 'waiting';
    return this.snapshot(instance);
  }

  evaluateEscalations(instanceId: string, now = new Date().toISOString()): WorkflowInstance {
    const instance = this.requireInstance(instanceId);
    const definition = this.requireDefinition(instance.definitionId);
    for (const task of instance.tasks.filter((candidate) => ['open', 'claimed'].includes(candidate.status) && candidate.dueAt && candidate.dueAt <= now)) {
      const step = definition.steps.find((candidate) => candidate.id === task.stepId);
      task.status = 'escalated';
      task.escalatedTo = step?.sla?.escalationRole ?? step?.escalationRole ?? definition.ownerRole;
      instance.status = 'escalated';
      this.audit(instance, now, 'system', 'sla.breached', { taskId: task.id, escalatedTo: task.escalatedTo, severity: step?.sla?.severity ?? 'breach' });
      this.audit(instance, now, 'system', 'task.escalated', { taskId: task.id, escalatedTo: task.escalatedTo });
    }
    return this.snapshot(instance);
  }

  slaSnapshot(instanceId: string, now = new Date().toISOString()): WorkflowSlaSnapshot[] {
    const instance = this.requireInstance(instanceId);
    const definition = this.requireDefinition(instance.definitionId);
    return instance.tasks
      .filter((task) => !['completed', 'approved', 'skipped', 'failed'].includes(task.status))
      .map((task) => {
        const step = definition.steps.find((candidate) => candidate.id === task.stepId);
        const due = task.dueAt ? Date.parse(task.dueAt) : undefined;
        const remaining = due === undefined ? undefined : Math.ceil((due - Date.parse(now)) / 60_000);
        return {
          instanceId: instance.id,
          taskId: task.id,
          stepId: task.stepId,
          name: task.name,
          status: task.status,
          dueAt: task.dueAt,
          minutesRemaining: remaining,
          breached: remaining !== undefined && remaining <= 0,
          severity: step?.sla?.severity ?? 'breach',
          escalatedTo: task.escalatedTo ?? step?.sla?.escalationRole ?? step?.escalationRole,
          ownerRole: step?.role ?? definition.ownerRole,
          digitalTwinRefs: step?.digitalTwin?.refs ?? [],
        } satisfies WorkflowSlaSnapshot;
      });
  }

  visualGraph(instanceId: string): VisualWorkflowGraph {
    const instance = this.requireInstance(instanceId);
    const definition = this.requireDefinition(instance.definitionId);
    const completed = new Set(instance.completedStepIds);
    const active = new Set(instance.activeStepIds);
    const nodes = definition.steps.map((step, index) => {
      const task = instance.tasks.find((candidate) => candidate.stepId === step.id);
      return { id: step.id, label: step.name, type: step.type, status: task?.status ?? (completed.has(step.id) ? 'completed' : active.has(step.id) ? 'active' : 'pending'), role: step.role, assignees: task?.assignees ?? step.assignees ?? [], dueAt: task?.dueAt, slaMinutes: step.slaMinutes ?? step.sla?.minutes, digitalTwinRefs: step.digitalTwin?.refs ?? [], position: { x: (index % 4) * 260, y: Math.floor(index / 4) * 150 } } satisfies VisualWorkflowNode;
    });
    const edges = definition.steps.flatMap((step) => (step.next ?? []).map((next) => ({ id: `${step.id}->${next}`, source: step.id, target: next, status: completed.has(step.id) ? 'completed' : active.has(step.id) ? 'active' : 'pending' } satisfies VisualWorkflowEdge)));
    return { instanceId: instance.id, definitionId: definition.id, status: instance.status, nodes, edges, dependencies: definition.steps.filter((step) => step.dependencies?.length).map((step) => ({ stepId: step.id, dependsOn: step.dependencies! })), criticalPath: this.criticalPath(definition) };
  }

  private activate(instance: WorkflowInstance, stepIds: string[], now: string, actor: string): void {
    const definition = this.requireDefinition(instance.definitionId);
    instance.activeStepIds = [...new Set(stepIds)];
    for (const stepId of stepIds) {
      const step = definition.steps.find((candidate) => candidate.id === stepId);
      if (!step) { this.raiseException(instance, now, `Missing step ${stepId}`); continue; }
      if (step.dependencies?.some((dependency) => !instance.completedStepIds.includes(dependency))) continue;
      if (step.condition && !step.condition(instance.context)) { this.advanceFrom(instance, step.id, now, actor); continue; }
      if (step.digitalTwin) this.applyDigitalTwinBinding(instance, step, now);
      if (step.type === 'serviceTask') {
        const patch = step.action?.(instance.context) ?? {};
        instance.context.payload = { ...instance.context.payload, ...patch };
        this.audit(instance, now, 'system', 'service.executed', { stepId: step.id, patch });
        this.advanceFrom(instance, step.id, now, actor);
      } else if (step.type === 'endEvent') {
        instance.status = 'completed'; instance.activeStepIds = []; instance.completedStepIds.push(step.id); this.audit(instance, now, 'system', 'workflow.completed', { stepId: step.id });
      } else {
        instance.status = 'waiting';
        if (!instance.tasks.some((task) => task.stepId === step.id && !['completed', 'approved', 'skipped'].includes(task.status))) {
          const slaMinutes = step.slaMinutes ?? step.sla?.minutes;
          const task: WorkflowTask = { id: `${instance.id}-${step.id}-${instance.tasks.length + 1}`, stepId: step.id, name: step.name, type: step.type, status: 'open', role: step.role, assignees: step.assignees ?? [], dueAt: slaMinutes ? minutesAfter(now, slaMinutes) : undefined, attempt: 0, approvals: [] };
          instance.tasks.push(task);
          this.audit(instance, now, 'system', 'task.created', { stepId: step.id, type: step.type, dueAt: slaMinutes ? minutesAfter(now, slaMinutes) : undefined });
          this.createCentralApprovalRequest(instance, step, task, now, actor);
        }
      }
    }
  }

  private advanceFrom(instance: WorkflowInstance, stepId: string, now: string, actor: string): void {
    if (!instance.completedStepIds.includes(stepId)) instance.completedStepIds.push(stepId);
    const definition = this.requireDefinition(instance.definitionId);
    const step = definition.steps.find((candidate) => candidate.id === stepId);
    if (!step) return this.raiseException(instance, now, `Cannot advance unknown step ${stepId}`);
    this.activate(instance, step.next ?? [], now, actor);
  }

  private applyDigitalTwinBinding(instance: WorkflowInstance, step: WorkflowStep, now: string): void {
    const binding = step.digitalTwin!;
    instance.digitalTwinRefs = [...new Set([...instance.digitalTwinRefs, ...binding.refs])];
    if (binding.syncMode !== 'read') instance.digitalTwinState = { ...instance.digitalTwinState, ...binding.statePatch, lastStepId: step.id, syncedAt: now };
    this.audit(instance, now, 'digital-twin-runtime', 'digitalTwin.updated', { stepId: step.id, refs: binding.refs, syncMode: binding.syncMode, statePatch: binding.statePatch ?? {} });
    if (binding.syncMode !== 'read') {
      for (const twinId of binding.refs.filter((ref) => ref.startsWith('twin:'))) {
        this.publishEvent('digital-twin.state.patch', instance, {
          twinId,
          patch: { ...(binding.statePatch ?? {}), workflowInstanceId: instance.id, workflowStepId: step.id },
          actor: 'workflow-orchestration-engine',
          observedAt: now,
        }, now, 'workflow-orchestration-engine');
      }
    }
  }

  private criticalPath(definition: WorkflowDefinition): string[] { const path: string[] = []; let current: string | undefined = definition.startStepId; const seen = new Set<string>(); while (current && !seen.has(current)) { seen.add(current); path.push(current); current = definition.steps.find((step) => step.id === current)?.next?.[0]; } return path; }
  private audit(instance: WorkflowInstance, timestamp: string, actor: string, action: WorkflowEventType | string, details: Record<string, unknown>): void {
    const entry = { id: `${instance.id}-audit-${instance.audit.length + 1}`, timestamp, actor, action, details };
    instance.audit.push(entry);
    const severity = this.auditSeverity(action, details);
    const definition = this.definitions.get(instance.definitionId);
    this.deps.auditLog?.append({
      id: entry.id,
      type: action === 'digitalTwin.updated' ? 'digital-twin-update' : action === 'approval.requested' || action === 'approval.recorded' ? 'approval' : 'workflow-action',
      actor,
      timestamp,
      payload: { action, ...details },
      subjectId: String(instance.context.payload.raceId ?? instance.context.payload.incidentId ?? instance.context.payload.controlId ?? instance.id),
      tenantId: instance.tenantId,
      workflowId: instance.id,
      correlationId: `${instance.id}:${action}`,
      severity,
      regulations: this.regulationsFor(definition?.domain),
      evidenceIds: this.evidenceIds(details),
    });
    this.publishEvent(action, instance, { auditId: entry.id, ...details }, timestamp, actor);
    this.deps.observability?.({
      name: action,
      timestamp,
      serviceId: 'workflow-orchestration-engine',
      severity: severity === 'critical' ? 'critical' : severity === 'warning' ? 'warning' : 'info',
      traceId: `${instance.id}:${action}`,
      attributes: { instanceId: instance.id, definitionId: instance.definitionId, tenantId: instance.tenantId, status: instance.status, ...details },
    });
  }
  private raiseException(instance: WorkflowInstance, timestamp: string, message: string): void { instance.status = 'exception'; instance.exceptions.push(message); this.audit(instance, timestamp, 'system', 'workflow.exception', { message }); }
  private createCentralApprovalRequest(instance: WorkflowInstance, step: WorkflowStep, task: WorkflowTask, now: string, actor: string): void {
    if (!step.approval || !this.deps.approvalService || task.approvalRequestId) return;
    const target = step.approval.target ?? this.resolvePath(instance.context.payload, step.approval.targetPath) ?? instance.id;
    const evidenceFromPath = this.resolvePath(instance.context.payload, step.approval.evidencePath);
    const evidence = [...(step.approval.evidence ?? []), ...(Array.isArray(evidenceFromPath) ? evidenceFromPath.map(String) : evidenceFromPath ? [String(evidenceFromPath)] : [])];
    const request = this.deps.approvalService.createRequest({
      id: step.approval.requestId,
      tenantId: instance.tenantId,
      racetrackId: racetrackFor(instance.tenantId, instance.context.payload),
      action: step.approval.action,
      target: String(target),
      requestedBy: step.approval.requestedBy ?? actor,
      actorType: step.approval.actorType ?? 'service',
      reason: step.approval.reason ?? `${step.name} requires controlled action approval`,
      evidence: evidence.length ? evidence : ['workflow-task'],
      workflowInstanceId: instance.id,
      workflowTaskId: task.id,
      now,
    });
    task.approvalRequestId = request.id;
    task.approvalAction = request.action;
    task.approvalTarget = request.target;
    this.audit(instance, now, 'workflow-orchestration-engine', 'approval.requested', { taskId: task.id, stepId: step.id, approvalRequestId: request.id, action: request.action, target: request.target });
  }
  private publishEvent(type: WorkflowEventType | EventName | string, instance: WorkflowInstance, payload: Record<string, unknown>, occurredAt: string, actor: string): void {
    const eventType = String(type).endsWith('.v1') ? String(type) : `${String(type)}.v1`;
    const racetrackId = racetrackFor(instance.tenantId, instance.context.payload);
    void this.deps.eventBus?.publish({
      type: eventType as EventName,
      occurredAt,
      tenantId: instance.tenantId,
      racetrackId,
      actor: { id: actor, type: actor.includes('ai') ? 'ai-agent' : 'service' },
      subject: { id: instance.id, type: 'workflow', tenantId: instance.tenantId },
      payload: { instanceId: instance.id, definitionId: instance.definitionId, tenantId: instance.tenantId, racetrackId, status: instance.status, actor, ...payload },
      aggregateId: instance.id,
      correlationId: `${instance.id}:${String(type)}`,
      producer: 'workflow-orchestration-engine',
      trace: { traceId: `${instance.id}:${String(type)}`, spanId: `span-${String(type).replaceAll('.', '-')}` },
      metadata: { compliance: 'regulated', team: 'platform-workflows', accountableRole: this.definitions.get(instance.definitionId)?.ownerRole ?? 'workflow-owner' },
    }).catch(() => undefined);
  }
  private recordDefinitionEvent(definition: WorkflowDefinition, type: WorkflowEventType, payload: Record<string, unknown>): void {
    const eventId = `event-${this.eventLog.length + 1}`;
    const event: WorkflowRuntimeEvent = { eventId, eventType: `${type}.v1` as CanonicalEventRef['eventType'], tenantId: definition.tenantId, racetrackId: 'main-track', actorId: 'workflow-orchestration-engine', source: 'workflow-orchestration-engine', timestamp: new Date().toISOString(), version: 1, id: eventId, type, payload: { definitionId: definition.id, ...payload } };
    this.eventLog.push(event);
    void this.deps.eventBus?.publish({
      id: event.eventId,
      type: event.eventType,
      tenantId: event.tenantId,
      racetrackId: event.racetrackId,
      actor: { id: event.actorId, type: 'service' },
      subject: { id: definition.id, type: 'workflow-definition', tenantId: event.tenantId },
      payload: event.payload,
      aggregateId: definition.id,
      producer: event.source,
      metadata: { compliance: 'internal', team: 'platform-workflows', accountableRole: definition.ownerRole },
    }).catch(() => undefined);
  }
  private registerWorkflowEventContracts(): void {
    const owner = { service: 'workflow-orchestration-engine', team: 'platform-workflows', accountableRole: 'workflow-owner' };
    for (const type of ['workflow.template.registered','workflow.started','workflow.transitioned','task.created','task.claimed','task.completed','task.failed','task.retried','task.escalated','approval.requested','approval.recorded','sla.breached','workflow.completed','workflow.exception','workflow.recovered','digitalTwin.updated','service.executed','digital-twin.state.patch']) {
      this.deps.eventBus?.registerEvent({ type: `${type}.v1`, version: 1, description: `Workflow orchestration ${type}`, owner, payloadFields: [], compliance: type.includes('digital-twin') || type.includes('approval') || type.includes('sla') ? 'regulated' : 'internal' });
    }
  }
  private cloneDefinition(definition: WorkflowDefinition): WorkflowDefinition {
    return {
      ...definition,
      triggerEvents: [...(definition.triggerEvents ?? [])],
      steps: definition.steps.map((step) => ({
        ...step,
        assignees: [...(step.assignees ?? [])],
        next: [...(step.next ?? [])],
        approvalRoles: [...(step.approvalRoles ?? [])],
        dependencies: [...(step.dependencies ?? [])],
        retryPolicy: step.retryPolicy ? { ...step.retryPolicy, retryableErrors: [...(step.retryPolicy.retryableErrors ?? [])] } : undefined,
        sla: step.sla ? { ...step.sla } : undefined,
        digitalTwin: step.digitalTwin ? { ...step.digitalTwin, refs: [...step.digitalTwin.refs], statePatch: cloneRecord(step.digitalTwin.statePatch) } : undefined,
        approval: step.approval ? { ...step.approval, evidence: [...(step.approval.evidence ?? [])] } : undefined,
      })),
      templateMetadata: definition.templateMetadata ? cloneRecord(definition.templateMetadata) : undefined,
    };
  }
  private resolvePath(source: Record<string, unknown>, path?: string): unknown {
    if (!path) return undefined;
    return path.split('.').reduce<unknown>((value, segment) => value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined, source);
  }
  private auditSeverity(action: WorkflowEventType | string, details: Record<string, unknown>): AuditSeverity {
    if (action === 'workflow.exception' || details.severity === 'critical') return 'critical';
    if (String(action).includes('approval') || String(action).includes('sla') || String(action).includes('escalated') || String(action).includes('failed')) return 'warning';
    return 'info';
  }
  private regulationsFor(domain?: WorkflowDomain): string[] { return domain && ['race-day','stewarding','veterinary','compliance','investigation','emergency','inspection'].includes(domain) ? ['HISA', 'ARCI', 'LOCAL-RACING-COMMISSION'] : ['SOC-2']; }
  private evidenceIds(details: Record<string, unknown>): string[] { const evidence = details.evidenceIds ?? details.evidence; return Array.isArray(evidence) ? evidence.map(String) : []; }
  private requireDefinition(id: string): WorkflowDefinition { const definition = this.definitions.get(id); if (!definition) throw new Error(`Unknown workflow definition ${id}`); return definition; }
  private requireInstance(id: string): WorkflowInstance { const instance = this.workflowInstances.get(id); if (!instance) throw new Error(`Unknown workflow instance ${id}`); return instance; }
  private requireTask(instance: WorkflowInstance, taskId: string): WorkflowTask { const task = instance.tasks.find((candidate) => candidate.id === taskId); if (!task) throw new Error(`Unknown task ${taskId}`); return task; }
  private snapshot(instance: WorkflowInstance): WorkflowInstance { return structuredClone(instance); }
}

const opsSla = (minutes: number, escalationRole: string, severity: WorkflowSlaPolicy['severity'] = 'breach'): WorkflowSlaPolicy => ({ minutes, escalationRole, severity });
const certificationEvidence = (prefix: string): WorkflowCertificationEvidenceRequirement[] => [
  { id: `${prefix}:approval-policy`, kind: 'approval-policy', label: 'Registered centralized approval policy with human roles', required: true },
  { id: `${prefix}:audit-record`, kind: 'audit-record', label: 'Immutable audit record for each protected transition', required: true },
  { id: `${prefix}:event-contract`, kind: 'event-contract', label: 'Workflow, approval, and domain event contracts emitted', required: true },
  { id: `${prefix}:digital-twin-sync`, kind: 'digital-twin-sync', label: 'Digital Twin sync point and evidence package recorded', required: true },
  { id: `${prefix}:role-attestation`, kind: 'role-attestation', label: 'Required role assignment attested for certified racetrack', required: true },
  { id: `${prefix}:sla-clock`, kind: 'sla-clock', label: 'SLA deadline and escalation clock configured', required: true },
];

function templateMetadata(input: {
  canonicalId: CanonicalWorkflowId;
  templateName: string;
  requiredRoles: string[];
  protectedActions: ControlledAction[];
  approval: WorkflowApprovalPointMetadata;
  twin: WorkflowTwinSyncPointMetadata;
  completeWithinMinutes: number;
  escalationRole: string;
  eventTypes: string[];
  auditActions?: Array<WorkflowEventType | string>;
}): WorkflowTemplateMetadata {
  const auditActions = input.auditActions ?? ['workflow.started', 'approval.requested', 'approval.recorded', 'digitalTwin.updated', 'workflow.completed'];
  return {
    canonicalId: input.canonicalId,
    templateName: input.templateName,
    certifiedRacetrackRequired: true,
    safetyCritical: true,
    requiredRoles: [...new Set(input.requiredRoles)],
    protectedActions: [...new Set(input.protectedActions)],
    approvalPoints: [input.approval],
    auditRequirements: auditActions.map((action) => ({ action, severity: String(action).includes('approval') || String(action).includes('sla') ? 'warning' : 'info', evidenceRequired: ['human-approval-record', 'reason', 'workflow-task'], retention: 'regulated-racing-record' })),
    eventRequirements: input.eventTypes.map((type) => ({ type, producer: 'workflow-orchestration-engine', requiredReferences: ['tenantId', 'racetrackId', 'workflowInstanceId', 'auditId', 'correlationId'] })),
    digitalTwinSyncPoints: [input.twin],
    sla: { startWithinMinutes: Math.min(5, input.completeWithinMinutes), completeWithinMinutes: input.completeWithinMinutes, escalationRole: input.escalationRole, deadlineField: 'dueAt', breachEvent: 'sla.breached' },
    certificationEvidence: certificationEvidence(input.canonicalId),
    apiFacadePath: '/api/v1/workflows/templates',
  };
}

export function raceDayOperationsWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'race-day-ops', name: 'Race-Day Operations Command', domain: 'race-day', version: '2.0.0', bpmnProcessId: 'Process_RaceDayOperations', startStepId: 'pre-race-inspection', ownerRole: 'operations-director', tenantId, triggerEvents: ['race-day.opened'], steps: [
    { id: 'pre-race-inspection', name: 'Pre-race safety and surface inspection', type: 'userTask', role: 'track-superintendent', sla: opsSla(30, 'operations-director'), digitalTwin: { refs: ['twin:track:surface'], syncMode: 'read-write', statePatch: { inspection: 'started' } }, next: ['sync-digital-twin'] },
    { id: 'sync-digital-twin', name: 'Sync operational state to Digital Twin', type: 'serviceTask', retryPolicy: { maxAttempts: 2, backoffMinutes: 2, retryableErrors: ['twin-timeout'] }, recoveryStepId: 'manual-twin-recovery', action: (context) => ({ twinSync: { refs: context.digitalTwinRefs, status: 'updated' } }), digitalTwin: { refs: ['twin:operations:command'], syncMode: 'write', statePatch: { status: 'pre-race-validated' } }, next: ['parallel-approvals'] },
    { id: 'manual-twin-recovery', name: 'Manual Digital Twin reconciliation', type: 'userTask', role: 'digital-twin-operator', sla: opsSla(15, 'operations-director', 'critical'), next: ['parallel-approvals'] },
    { id: 'parallel-approvals', name: 'Steward, veterinary, and operations approvals', type: 'parallelApproval', approvalRoles: ['chief-steward', 'veterinarian', 'operations-director'], requiredApprovals: 3, sla: opsSla(10, 'general-manager', 'critical'), dependencies: ['pre-race-inspection', 'sync-digital-twin'], approval: { action: 'race-start', targetPath: 'raceId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Race-day command requires human controlled start approval', evidence: ['workflow-task'], evidencePath: 'evidenceIds' }, next: ['publish-race-ready'] },
    { id: 'publish-race-ready', name: 'Publish race-ready command decision', type: 'serviceTask', action: () => ({ raceDayDecision: 'race-ready' }), digitalTwin: { refs: ['twin:race-day:readiness'], syncMode: 'write', statePatch: { raceReady: true } }, next: ['done'] },
    { id: 'done', name: 'Race-day workflow completed', type: 'endEvent' },
  ] };
}

export function raceDayReadinessWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'race-day-readiness-workflow', name: 'Race-Day Readiness Workflow', domain: 'race-day', version: '1.0.0', bpmnProcessId: 'Process_RaceDayReadinessWorkflow', startStepId: 'surface-inspection', ownerRole: 'race-day-commander', tenantId, triggerEvents: ['readiness.approval-required'], steps: [
    { id: 'surface-inspection', name: 'Complete surface and weather inspection', type: 'inspectionTask', role: 'track-superintendent', sla: opsSla(20, 'race-day-commander', 'critical'), digitalTwin: { refs: ['twin:track:surface', 'twin:weather:station'], syncMode: 'read-write', statePatch: { readinessInspection: 'active' } }, next: ['gate-and-staffing'] },
    { id: 'gate-and-staffing', name: 'Verify gate, staffing, and emergency lanes', type: 'userTask', role: 'operations-coordinator', sla: opsSla(15, 'operations-director'), digitalTwin: { refs: ['twin:starting-gate', 'twin:staffing:race-day', 'twin:emergency:lanes'], syncMode: 'read' }, next: ['readiness-decision'] },
    { id: 'readiness-decision', name: 'Approve race readiness decision', type: 'approvalTask', approvalRoles: ['chief-steward', 'veterinarian', 'operations-director'], requiredApprovals: 2, sla: opsSla(10, 'general-manager', 'critical'), approval: { action: 'race-start', targetPath: 'raceId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Readiness workflow requires controlled race start approval', evidence: ['workflow-task'], evidencePath: 'evidenceIds' }, next: ['publish-readiness'] },
    { id: 'publish-readiness', name: 'Publish readiness state', type: 'serviceTask', action: () => ({ readinessWorkflow: 'approved' }), digitalTwin: { refs: ['twin:race-day:readiness'], syncMode: 'write', statePatch: { readinessWorkflow: 'approved' } }, next: ['closed'] },
    { id: 'closed', name: 'Readiness workflow closed', type: 'endEvent' },
  ] };
}

export function inspectionWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'inspection-program', name: 'Inspection Program', domain: 'inspection', version: '2.0.0', bpmnProcessId: 'Process_InspectionProgram', startStepId: 'schedule-inspection', ownerRole: 'inspection-manager', tenantId, triggerEvents: ['inspection.requested'], steps: [
    { id: 'schedule-inspection', name: 'Schedule inspection and assign inspector', type: 'userTask', role: 'inspection-coordinator', sla: opsSla(60, 'inspection-manager'), digitalTwin: { refs: ['twin:inspection:calendar'], syncMode: 'write', statePatch: { inspection: 'scheduled' } }, next: ['perform-checklist'] },
    { id: 'perform-checklist', name: 'Perform field checklist', type: 'inspectionTask', role: 'inspector', sla: opsSla(240, 'inspection-manager'), digitalTwin: { refs: ['twin:facility:inspection-zone'], syncMode: 'read-write', statePatch: { inspection: 'in-progress' } }, next: ['evidence-package'] },
    { id: 'evidence-package', name: 'Package inspection evidence', type: 'serviceTask', action: (context) => ({ inspectionEvidence: context.payload.evidenceIds ?? [] }), digitalTwin: { refs: ['twin:inspection:evidence'], syncMode: 'write', statePatch: { evidencePackaged: true } }, next: ['approve-findings'] },
    { id: 'approve-findings', name: 'Approve inspection findings', type: 'approvalTask', approvalRoles: ['inspection-manager'], requiredApprovals: 1, sla: opsSla(120, 'operations-director'), next: ['closed'] },
    { id: 'closed', name: 'Inspection workflow closed', type: 'endEvent' },
  ] };
}

export function investigationWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'steward-investigation', name: 'Steward Investigation', domain: 'investigation', version: '2.0.0', bpmnProcessId: 'Process_StewardInvestigation', startStepId: 'preserve-evidence', ownerRole: 'chief-steward', tenantId, triggerEvents: ['investigation.requested', 'race.objection.opened'], steps: [
    { id: 'preserve-evidence', name: 'Preserve video, telemetry, and witness evidence', type: 'investigationTask', role: 'steward', sla: opsSla(20, 'chief-steward', 'critical'), digitalTwin: { refs: ['twin:race:incident', 'twin:camera:finish'], syncMode: 'read' }, next: ['organize-evidence'] },
    { id: 'organize-evidence', name: 'AI organizes evidence for steward review only', type: 'serviceTask', retryPolicy: { maxAttempts: 2, backoffMinutes: 1, retryableErrors: ['ai-timeout'] }, action: (context) => ({ stewardEvidenceOrganization: { inquiryId: context.payload.inquiryId ?? context.payload.incidentId, advisoryOnly: true, officialRuling: false, mayModifyOfficialResults: false } }), digitalTwin: { refs: ['twin:race:incident', 'twin:case:investigation'], syncMode: 'read', statePatch: { aiEvidenceOrganization: 'complete' } }, next: ['panel-review'] },
    { id: 'panel-review', name: 'Conduct human steward panel review', type: 'userTask', role: 'chief-steward', sla: opsSla(120, 'racing-commission-liaison'), dependencies: ['preserve-evidence', 'organize-evidence'], digitalTwin: { refs: ['twin:case:investigation'], syncMode: 'read-write', statePatch: { panelReview: 'active' } }, next: ['ruling-approval'] },
    { id: 'ruling-approval', name: 'Approve human-only steward ruling package', type: 'approvalTask', approvalRoles: ['chief-steward'], requiredApprovals: 1, sla: opsSla(30, 'compliance-officer'), approval: { action: 'steward-decision', targetPath: 'incidentId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Steward investigation ruling requires controlled approval by an authorized human steward', evidence: ['workflow-task'], evidencePath: 'evidenceIds' }, next: ['notify-parties'] },
    { id: 'notify-parties', name: 'Notify parties and update case timeline', type: 'serviceTask', action: () => ({ investigationStatus: 'ruling-issued' }), digitalTwin: { refs: ['twin:case:investigation'], syncMode: 'write', statePatch: { status: 'ruling-issued' } }, next: ['closed'] },
    { id: 'closed', name: 'Investigation workflow closed', type: 'endEvent' },
  ] };
}

export function complianceReviewWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'compliance-review', name: 'Compliance Review', domain: 'compliance', version: '2.0.0', bpmnProcessId: 'Process_ComplianceReview', startStepId: 'scope-review', ownerRole: 'compliance-director', tenantId, triggerEvents: ['compliance.requested'], steps: [
    { id: 'scope-review', name: 'Scope compliance review', type: 'complianceReviewTask', role: 'compliance-analyst', sla: opsSla(120, 'compliance-director'), digitalTwin: { refs: ['twin:compliance:cycle'], syncMode: 'read-write', statePatch: { review: 'scoped' } }, next: ['control-testing'] },
    { id: 'control-testing', name: 'Perform control testing and collect evidence', type: 'complianceReviewTask', role: 'control-owner', sla: opsSla(1440, 'compliance-director'), digitalTwin: { refs: ['twin:compliance:controls', 'twin:audit:evidence'], syncMode: 'read-write', statePatch: { testing: 'active' } }, next: ['remediation-plan'] },
    { id: 'remediation-plan', name: 'Draft remediation and corrective actions', type: 'serviceTask', action: (context) => ({ complianceReview: { controlId: context.payload.controlId, findingId: context.payload.findingId, status: 'ready-for-approval' } }), digitalTwin: { refs: ['twin:compliance:remediation'], syncMode: 'write', statePatch: { remediationPlan: 'drafted' } }, next: ['approve-remediation'] },
    { id: 'approve-remediation', name: 'Approve remediation plan', type: 'approvalTask', approvalRoles: ['compliance-director'], requiredApprovals: 1, sla: opsSla(240, 'general-counsel'), next: ['closed'] },
    { id: 'closed', name: 'Compliance review closed', type: 'endEvent' },
  ] };
}

export function emergencyResponseWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'emergency-response', name: 'Emergency Procedure Orchestration', domain: 'emergency', version: '2.0.0', bpmnProcessId: 'Process_EmergencyResponse', startStepId: 'dispatch', ownerRole: 'incident-commander', tenantId, triggerEvents: ['emergency.workflow.activated'], steps: [
    { id: 'dispatch', name: 'Dispatch incident resources', type: 'emergencyTask', role: 'incident-commander', sla: opsSla(5, 'general-manager', 'critical'), digitalTwin: { refs: ['twin:incident:command', 'twin:emergency:resources'], syncMode: 'read-write', statePatch: { incidentCommand: 'active' } }, next: ['stabilize-scene'] },
    { id: 'stabilize-scene', name: 'Stabilize scene and coordinate agencies', type: 'emergencyTask', role: 'emergency-liaison', sla: opsSla(20, 'incident-commander', 'critical'), digitalTwin: { refs: ['twin:incident:scene', 'twin:agency:mutual-aid'], syncMode: 'read-write', statePatch: { scene: 'stabilizing' } }, next: ['communications'] },
    { id: 'communications', name: 'Complete regulator and public communications', type: 'userTask', role: 'public-information-officer', sla: opsSla(15, 'incident-commander'), next: ['after-action'] },
    { id: 'after-action', name: 'Approve after-action audit', type: 'approvalTask', approvalRoles: ['incident-commander', 'compliance-manager'], requiredApprovals: 1, sla: opsSla(1440, 'compliance-director'), next: ['closed'] },
    { id: 'closed', name: 'Emergency workflow closed', type: 'endEvent' },
  ] };
}

export function controlledRaceStartApprovalWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'race-start-approval-workflow', name: 'Controlled Race Start Approval', domain: 'race-day', version: '1.0.0', bpmnProcessId: 'Process_ControlledRaceStartApproval', startStepId: 'compile-start-evidence', ownerRole: 'racing-secretary', tenantId, triggerEvents: ['race.approval.requested'], steps: [
    { id: 'compile-start-evidence', name: 'Compile race-start evidence packet', type: 'serviceTask', action: (context) => ({ startEvidencePacket: { raceId: context.payload.raceId, evidenceIds: context.payload.evidenceIds ?? [] } }), digitalTwin: { refs: ['twin:race-day:readiness'], syncMode: 'read' }, next: ['start-approval'] },
    { id: 'start-approval', name: 'Request race-start controlled approval', type: 'parallelApproval', approvalRoles: ['racing-secretary', 'steward', 'veterinarian'], requiredApprovals: 3, sla: opsSla(15, 'general-manager', 'critical'), approval: { action: 'race-start', targetPath: 'raceId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Race start requires racing secretary, steward, and veterinarian authorization', evidence: ['workflow-task'], evidencePath: 'evidenceIds' }, next: ['approved'] },
    { id: 'approved', name: 'Race-start approval workflow closed', type: 'endEvent' },
  ] };
}

export function canonicalGateMoveWorkflow(tenantId: string): WorkflowDefinition {
  const metadata = templateMetadata({
    canonicalId: 'tmwf.gate-move.v1',
    templateName: 'Gate Move Workflow',
    requiredRoles: ['racing-secretary', 'track-superintendent', 'steward'],
    protectedActions: ['starting-gate-move'],
    approval: { stepId: 'approve-gate-move', action: 'starting-gate-move', requiredRoles: ['racing-secretary', 'track-superintendent'], minimumApprovals: 2, evidenceRequired: ['human-approval-record', 'gps-fix', 'photo', 'reason'], deadlineMinutes: 15, policy: 'starting-gate-move' },
    twin: { stepId: 'sync-gate-twin', refs: ['twin:main-track:gate-1', 'twin:race-day:readiness'], syncMode: 'read-write', requiredBeforeApproval: false },
    completeWithinMinutes: 30,
    escalationRole: 'operations-director',
    eventTypes: ['workflow.started', 'approval.requested', 'approval.recorded', 'digital-twin.state.patch', 'workflow.completed'],
  });
  return { id: metadata.canonicalId, name: metadata.templateName, domain: 'race-day', version: '1.0.0', bpmnProcessId: 'Process_Tier4_GateMove', startStepId: 'survey-gate-location', ownerRole: 'racing-secretary', tenantId, triggerEvents: ['starting-gate.move.requested'], templateMetadata: metadata, steps: [
    { id: 'survey-gate-location', name: 'Survey target gate location and collect GPS evidence', type: 'inspectionTask', role: 'track-superintendent', sla: opsSla(10, 'operations-director', 'critical'), digitalTwin: { refs: ['twin:main-track:gate-1'], syncMode: 'read', statePatch: { gateMoveSurvey: 'started' } }, next: ['approve-gate-move'] },
    { id: 'approve-gate-move', name: 'Approve starting gate move', type: 'parallelApproval', approvalRoles: ['racing-secretary', 'track-superintendent'], requiredApprovals: 2, sla: opsSla(15, 'operations-director', 'critical'), approval: { action: 'starting-gate-move', targetPath: 'gateId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Starting gate moves require racing office and surface operations approval', evidence: ['human-approval-record', 'workflow-task'], evidencePath: 'evidenceIds' }, next: ['sync-gate-twin'] },
    { id: 'sync-gate-twin', name: 'Sync approved gate move to Digital Twin', type: 'serviceTask', action: () => ({ gateMoveWorkflow: 'approved' }), digitalTwin: { refs: ['twin:main-track:gate-1', 'twin:race-day:readiness'], syncMode: 'write', statePatch: { gateMoveApproved: true } }, next: ['closed'] },
    { id: 'closed', name: 'Gate move workflow closed', type: 'endEvent' },
  ] };
}

export function canonicalHorseEntryWorkflow(tenantId: string): WorkflowDefinition {
  const metadata = templateMetadata({
    canonicalId: 'tmwf.horse-entry.v1',
    templateName: 'Horse Entry Workflow',
    requiredRoles: ['racing-secretary', 'veterinarian', 'steward'],
    protectedActions: ['race-office-configuration'],
    approval: { stepId: 'approve-entry', action: 'race-office-configuration', requiredRoles: ['racing-secretary', 'steward'], minimumApprovals: 1, evidenceRequired: ['human-approval-record', 'eligibility-check', 'reason'], deadlineMinutes: 45, policy: 'race-office-configuration' },
    twin: { stepId: 'sync-entry-twin', refs: ['twin:race-card', 'twin:horse-entry'], syncMode: 'read-write', requiredBeforeApproval: false },
    completeWithinMinutes: 90,
    escalationRole: 'racing-secretary',
    eventTypes: ['race.entry.added', 'approval.requested', 'approval.recorded', 'digital-twin.state.patch', 'workflow.completed'],
  });
  return { id: metadata.canonicalId, name: metadata.templateName, domain: 'race-day', version: '1.0.0', bpmnProcessId: 'Process_Tier4_HorseEntry', startStepId: 'validate-entry', ownerRole: 'racing-secretary', tenantId, triggerEvents: ['race.entry.requested'], templateMetadata: metadata, steps: [
    { id: 'validate-entry', name: 'Validate condition book and ownership entry', type: 'userTask', role: 'racing-secretary', sla: opsSla(30, 'racing-secretary'), digitalTwin: { refs: ['twin:race-card'], syncMode: 'read-write', statePatch: { entryValidation: 'active' } }, next: ['veterinary-eligibility'] },
    { id: 'veterinary-eligibility', name: 'Confirm veterinary eligibility and welfare status', type: 'userTask', role: 'veterinarian', sla: opsSla(30, 'racing-secretary'), digitalTwin: { refs: ['twin:horse-entry'], syncMode: 'read' }, next: ['approve-entry'] },
    { id: 'approve-entry', name: 'Approve official horse entry', type: 'approvalTask', approvalRoles: ['racing-secretary', 'steward'], requiredApprovals: 1, sla: opsSla(30, 'steward'), approval: { action: 'race-office-configuration', targetPath: 'raceId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Official horse entry changes require controlled race-office approval', evidence: ['human-approval-record', 'workflow-task'], evidencePath: 'evidenceIds' }, next: ['sync-entry-twin'] },
    { id: 'sync-entry-twin', name: 'Sync approved entry to race card twins', type: 'serviceTask', action: () => ({ horseEntryWorkflow: 'approved' }), digitalTwin: { refs: ['twin:race-card', 'twin:horse-entry'], syncMode: 'write', statePatch: { entryApproved: true } }, next: ['closed'] },
    { id: 'closed', name: 'Horse entry workflow closed', type: 'endEvent' },
  ] };
}

export function canonicalScratchWorkflow(tenantId: string): WorkflowDefinition {
  const metadata = templateMetadata({
    canonicalId: 'tmwf.scratch.v1',
    templateName: 'Scratch Workflow',
    requiredRoles: ['veterinarian', 'steward', 'racing-secretary'],
    protectedActions: ['race-office-scratch'],
    approval: { stepId: 'approve-scratch', action: 'race-office-scratch', requiredRoles: ['veterinarian', 'steward'], minimumApprovals: 2, evidenceRequired: ['human-approval-record', 'scratch-reason', 'veterinary-note'], deadlineMinutes: 30, policy: 'race-office-scratch' },
    twin: { stepId: 'sync-scratch-twin', refs: ['twin:race-card', 'twin:horse-entry'], syncMode: 'read-write', requiredBeforeApproval: false },
    completeWithinMinutes: 45,
    escalationRole: 'chief-steward',
    eventTypes: ['race.entry.scratched', 'approval.requested', 'approval.recorded', 'digital-twin.state.patch', 'workflow.completed'],
  });
  return { id: metadata.canonicalId, name: metadata.templateName, domain: 'veterinary', version: '1.0.0', bpmnProcessId: 'Process_Tier4_Scratch', startStepId: 'collect-scratch-evidence', ownerRole: 'chief-steward', tenantId, triggerEvents: ['race.scratch.requested'], templateMetadata: metadata, steps: [
    { id: 'collect-scratch-evidence', name: 'Collect scratch reason and veterinary evidence', type: 'userTask', role: 'veterinarian', sla: opsSla(10, 'chief-steward', 'critical'), digitalTwin: { refs: ['twin:horse-entry'], syncMode: 'read' }, next: ['approve-scratch'] },
    { id: 'approve-scratch', name: 'Approve scratch decision', type: 'parallelApproval', approvalRoles: ['veterinarian', 'steward'], requiredApprovals: 2, sla: opsSla(30, 'chief-steward', 'critical'), approval: { action: 'race-office-scratch', targetPath: 'raceId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Horse scratch changes require veterinarian and steward approval', evidence: ['human-approval-record', 'workflow-task'], evidencePath: 'evidenceIds' }, next: ['sync-scratch-twin'] },
    { id: 'sync-scratch-twin', name: 'Publish approved scratch to race card twins', type: 'serviceTask', action: () => ({ scratchWorkflow: 'approved' }), digitalTwin: { refs: ['twin:race-card', 'twin:horse-entry'], syncMode: 'write', statePatch: { scratched: true } }, next: ['closed'] },
    { id: 'closed', name: 'Scratch workflow closed', type: 'endEvent' },
  ] };
}

export function canonicalInspectionWorkflow(tenantId: string): WorkflowDefinition {
  const metadata = templateMetadata({
    canonicalId: 'tmwf.inspection.v1',
    templateName: 'Inspection Workflow',
    requiredRoles: ['track-superintendent', 'inspection-manager', 'steward'],
    protectedActions: ['safety-critical-control'],
    approval: { stepId: 'approve-inspection', action: 'safety-critical-control', requiredRoles: ['track-superintendent', 'steward'], minimumApprovals: 1, evidenceRequired: ['human-approval-record', 'inspection-report', 'reason'], deadlineMinutes: 60, policy: 'safety-critical-control' },
    twin: { stepId: 'sync-inspection-twin', refs: ['twin:inspection:zone', 'twin:track:surface'], syncMode: 'read-write', requiredBeforeApproval: true },
    completeWithinMinutes: 120,
    escalationRole: 'operations-director',
    eventTypes: ['inspection.requested', 'approval.requested', 'approval.recorded', 'digital-twin.state.patch', 'workflow.completed'],
  });
  return { id: metadata.canonicalId, name: metadata.templateName, domain: 'inspection', version: '1.0.0', bpmnProcessId: 'Process_Tier4_Inspection', startStepId: 'perform-inspection', ownerRole: 'inspection-manager', tenantId, triggerEvents: ['inspection.requested'], templateMetadata: metadata, steps: [
    { id: 'perform-inspection', name: 'Perform certified inspection checklist', type: 'inspectionTask', role: 'track-superintendent', sla: opsSla(60, 'inspection-manager'), digitalTwin: { refs: ['twin:inspection:zone', 'twin:track:surface'], syncMode: 'read-write', statePatch: { inspection: 'in-progress' } }, next: ['approve-inspection'] },
    { id: 'approve-inspection', name: 'Approve inspection findings and readiness impact', type: 'approvalTask', approvalRoles: ['track-superintendent', 'steward'], requiredApprovals: 1, sla: opsSla(60, 'operations-director'), approval: { action: 'safety-critical-control', targetPath: 'inspectionId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Inspection findings require human approval before safety-critical state changes', evidence: ['human-approval-record', 'workflow-task'], evidencePath: 'evidenceIds' }, next: ['sync-inspection-twin'] },
    { id: 'sync-inspection-twin', name: 'Sync approved inspection state', type: 'serviceTask', action: () => ({ inspectionWorkflow: 'approved' }), digitalTwin: { refs: ['twin:inspection:zone', 'twin:track:surface'], syncMode: 'write', statePatch: { inspectionApproved: true } }, next: ['closed'] },
    { id: 'closed', name: 'Inspection workflow closed', type: 'endEvent' },
  ] };
}

export function canonicalIncidentWorkflow(tenantId: string): WorkflowDefinition {
  const metadata = templateMetadata({
    canonicalId: 'tmwf.incident.v1',
    templateName: 'Incident Workflow',
    requiredRoles: ['steward', 'security', 'compliance-officer'],
    protectedActions: ['steward-decision'],
    approval: { stepId: 'approve-incident-decision', action: 'steward-decision', requiredRoles: ['steward'], minimumApprovals: 1, evidenceRequired: ['human-approval-record', 'incident-evidence', 'reason'], deadlineMinutes: 60, policy: 'steward-decision' },
    twin: { stepId: 'sync-incident-twin', refs: ['twin:race:incident', 'twin:case:investigation'], syncMode: 'read-write', requiredBeforeApproval: true },
    completeWithinMinutes: 180,
    escalationRole: 'chief-steward',
    eventTypes: ['incident.created', 'approval.requested', 'approval.recorded', 'digital-twin.state.patch', 'workflow.completed'],
  });
  return { id: metadata.canonicalId, name: metadata.templateName, domain: 'investigation', version: '1.0.0', bpmnProcessId: 'Process_Tier4_Incident', startStepId: 'preserve-incident-evidence', ownerRole: 'chief-steward', tenantId, triggerEvents: ['incident.created', 'steward.investigation.opened'], templateMetadata: metadata, steps: [
    { id: 'preserve-incident-evidence', name: 'Preserve incident evidence and chain of custody', type: 'investigationTask', role: 'steward', sla: opsSla(15, 'chief-steward', 'critical'), digitalTwin: { refs: ['twin:race:incident', 'twin:case:investigation'], syncMode: 'read-write', statePatch: { evidencePreserved: true } }, next: ['security-review'] },
    { id: 'security-review', name: 'Complete security and safety review', type: 'userTask', role: 'security', sla: opsSla(45, 'chief-steward'), next: ['approve-incident-decision'] },
    { id: 'approve-incident-decision', name: 'Approve incident decision package', type: 'approvalTask', approvalRoles: ['steward'], requiredApprovals: 1, sla: opsSla(60, 'compliance-officer', 'critical'), approval: { action: 'steward-decision', targetPath: 'incidentId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Incident decisions require authorized human steward approval', evidence: ['human-approval-record', 'workflow-task'], evidencePath: 'evidenceIds' }, next: ['sync-incident-twin'] },
    { id: 'sync-incident-twin', name: 'Sync approved incident state', type: 'serviceTask', action: () => ({ incidentWorkflow: 'approved' }), digitalTwin: { refs: ['twin:race:incident', 'twin:case:investigation'], syncMode: 'write', statePatch: { incidentDecisionApproved: true } }, next: ['closed'] },
    { id: 'closed', name: 'Incident workflow closed', type: 'endEvent' },
  ] };
}

export function canonicalRaceReadinessWorkflow(tenantId: string): WorkflowDefinition {
  const metadata = templateMetadata({
    canonicalId: 'tmwf.race-readiness.v1',
    templateName: 'Race Readiness Workflow',
    requiredRoles: ['chief-steward', 'veterinarian', 'operations-director', 'track-superintendent'],
    protectedActions: ['race-start'],
    approval: { stepId: 'approve-race-readiness', action: 'race-start', requiredRoles: ['racing-secretary', 'steward', 'veterinarian'], minimumApprovals: 3, evidenceRequired: ['human-approval-record', 'readiness-check', 'reason'], deadlineMinutes: 15, policy: 'race-start' },
    twin: { stepId: 'publish-race-readiness', refs: ['twin:race-day:readiness', 'twin:starting-gate', 'twin:track:surface'], syncMode: 'read-write', requiredBeforeApproval: false },
    completeWithinMinutes: 45,
    escalationRole: 'general-manager',
    eventTypes: ['race.readiness.assessed', 'approval.requested', 'approval.recorded', 'digital-twin.state.patch', 'workflow.completed'],
  });
  return { id: metadata.canonicalId, name: metadata.templateName, domain: 'race-day', version: '1.0.0', bpmnProcessId: 'Process_Tier4_RaceReadiness', startStepId: 'verify-readiness-domains', ownerRole: 'race-day-commander', tenantId, triggerEvents: ['readiness.approval-required'], templateMetadata: metadata, steps: [
    { id: 'verify-readiness-domains', name: 'Verify track, gate, staffing, veterinary, emergency, and weather readiness', type: 'inspectionTask', role: 'operations-director', sla: opsSla(20, 'race-day-commander', 'critical'), digitalTwin: { refs: ['twin:starting-gate', 'twin:track:surface', 'twin:emergency:lanes'], syncMode: 'read' }, next: ['approve-race-readiness'] },
    { id: 'approve-race-readiness', name: 'Approve race readiness and controlled start posture', type: 'parallelApproval', approvalRoles: ['racing-secretary', 'steward', 'veterinarian'], requiredApprovals: 3, sla: opsSla(15, 'general-manager', 'critical'), approval: { action: 'race-start', targetPath: 'raceId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Race readiness workflow requires controlled race-start approval', evidence: ['human-approval-record', 'workflow-task'], evidencePath: 'evidenceIds' }, next: ['publish-race-readiness'] },
    { id: 'publish-race-readiness', name: 'Publish approved readiness state to Digital Twin', type: 'serviceTask', action: () => ({ raceReadinessWorkflow: 'approved' }), digitalTwin: { refs: ['twin:race-day:readiness', 'twin:starting-gate', 'twin:track:surface'], syncMode: 'write', statePatch: { readinessApproved: true } }, next: ['closed'] },
    { id: 'closed', name: 'Race readiness workflow closed', type: 'endEvent' },
  ] };
}

export function canonicalEmergencyWorkflow(tenantId: string): WorkflowDefinition {
  const metadata = templateMetadata({
    canonicalId: 'tmwf.emergency.v1',
    templateName: 'Emergency Workflow',
    requiredRoles: ['incident-commander', 'security', 'public-information-officer', 'compliance-officer'],
    protectedActions: ['emergency-action'],
    approval: { stepId: 'approve-emergency-record', action: 'emergency-action', requiredRoles: ['security'], minimumApprovals: 1, evidenceRequired: ['human-approval-record', 'command-log', 'reason'], deadlineMinutes: 5, policy: 'emergency-action' },
    twin: { stepId: 'sync-emergency-twin', refs: ['twin:incident:command', 'twin:emergency:resources'], syncMode: 'read-write', requiredBeforeApproval: true },
    completeWithinMinutes: 60,
    escalationRole: 'general-manager',
    eventTypes: ['emergency.workflow.activated', 'approval.requested', 'approval.recorded', 'digital-twin.state.patch', 'workflow.completed'],
  });
  return { id: metadata.canonicalId, name: metadata.templateName, domain: 'emergency', version: '1.0.0', bpmnProcessId: 'Process_Tier4_Emergency', startStepId: 'assume-incident-command', ownerRole: 'incident-commander', tenantId, triggerEvents: ['emergency.workflow.activated'], description: 'Human-commanded emergency workflow. AI may recommend, but cannot block emergency personnel.', templateMetadata: metadata, steps: [
    { id: 'assume-incident-command', name: 'Assume human incident command', type: 'emergencyTask', role: 'incident-commander', sla: opsSla(1, 'general-manager', 'critical'), digitalTwin: { refs: ['twin:incident:command'], syncMode: 'read-write', statePatch: { incidentCommand: 'active', aiMayBlock: false } }, next: ['dispatch-response'] },
    { id: 'dispatch-response', name: 'Dispatch emergency resources', type: 'emergencyTask', role: 'security', sla: opsSla(5, 'incident-commander', 'critical'), digitalTwin: { refs: ['twin:emergency:resources'], syncMode: 'read-write', statePatch: { resourcesDispatched: true } }, next: ['approve-emergency-record'] },
    { id: 'approve-emergency-record', name: 'Approve emergency action record and controlled re-entry posture', type: 'approvalTask', approvalRoles: ['security'], requiredApprovals: 1, sla: opsSla(5, 'general-manager', 'critical'), approval: { action: 'emergency-action', targetPath: 'incidentId', requestedBy: 'workflow-orchestration-engine', actorType: 'service', reason: 'Emergency workflow requires human command evidence and approval record', evidence: ['human-approval-record', 'workflow-task'], evidencePath: 'evidenceIds' }, next: ['sync-emergency-twin'] },
    { id: 'sync-emergency-twin', name: 'Sync emergency command record', type: 'serviceTask', action: () => ({ emergencyWorkflow: 'approved' }), digitalTwin: { refs: ['twin:incident:command', 'twin:emergency:resources'], syncMode: 'write', statePatch: { emergencyRecordApproved: true } }, next: ['closed'] },
    { id: 'closed', name: 'Emergency workflow closed', type: 'endEvent' },
  ] };
}

export function canonicalWorkflowTemplates(tenantId: string): WorkflowDefinition[] {
  return [
    canonicalGateMoveWorkflow(tenantId),
    canonicalHorseEntryWorkflow(tenantId),
    canonicalScratchWorkflow(tenantId),
    canonicalInspectionWorkflow(tenantId),
    canonicalIncidentWorkflow(tenantId),
    canonicalRaceReadinessWorkflow(tenantId),
    canonicalEmergencyWorkflow(tenantId),
  ];
}

export function workflowTemplateRegistry(tenantId: string, generatedAt = new Date().toISOString()): WorkflowTemplateRegistry {
  return { tenantId, certificationTier: 'Tier 4', generatedAt, templates: canonicalWorkflowTemplates(tenantId).map((definition) => cloneRecord(definition.templateMetadata!)) };
}

function linearWorkflow(id: string, name: string, domain: WorkflowDomain, ownerRole: string, tenantId: string, steps: Array<[string, string, string, number]>): WorkflowDefinition {
  return { id, name, domain, version: '1.0.0', bpmnProcessId: `Process_${id.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`, startStepId: steps[0][0], ownerRole, tenantId, triggerEvents: [`${domain}.requested`], steps: [
    ...steps.map(([stepId, stepName, role, minutes], index) => ({ id: stepId, name: stepName, type: index === steps.length - 1 ? 'approvalTask' as const : 'userTask' as const, role, sla: opsSla(minutes, ownerRole), digitalTwin: { refs: [`twin:${domain}:${stepId}`], syncMode: 'read-write' as const, statePatch: { [stepId]: 'active' } }, next: index + 1 < steps.length ? [steps[index + 1][0]] : ['closed'] })),
    { id: 'closed', name: `${name} closed`, type: 'endEvent' as const },
  ] };
}

export function workflowPortfolio(tenantId: string): WorkflowDefinition[] {
  return [
    ...canonicalWorkflowTemplates(tenantId),
    raceDayOperationsWorkflow(tenantId),
    raceDayReadinessWorkflow(tenantId),
    linearWorkflow('maintenance-work-order', 'Maintenance Work Order', 'maintenance', 'maintenance-manager', tenantId, [['triage', 'Triage maintenance request', 'maintenance-dispatcher', 20], ['isolate-asset', 'Isolate asset and assign crew', 'maintenance-lead', 45], ['verify-repair', 'Verify repair and return to service', 'maintenance-manager', 60]]),
    linearWorkflow('stewarding-panel-review', 'Stewarding Panel Review', 'stewarding', 'chief-steward', tenantId, [['collect-evidence', 'Collect race evidence', 'steward', 30], ['conduct-review', 'Conduct steward panel review', 'chief-steward', 120], ['issue-ruling', 'Issue ruling and notifications', 'chief-steward', 30]]),
    investigationWorkflow(tenantId),
    linearWorkflow('veterinary-review', 'Veterinary Review', 'veterinary', 'chief-veterinarian', tenantId, [['intake-horse', 'Intake veterinary concern', 'veterinary-technician', 10], ['clinical-review', 'Complete clinical review', 'veterinarian', 45], ['clearance-decision', 'Approve clearance decision', 'chief-veterinarian', 20]]),
    inspectionWorkflow(tenantId),
    linearWorkflow('security-incident', 'Security Incident Response', 'security', 'security-director', tenantId, [['classify-threat', 'Classify security threat', 'security-operator', 5], ['contain-incident', 'Contain incident and preserve evidence', 'security-lead', 15], ['executive-briefing', 'Approve executive security briefing', 'security-director', 30]]),
    complianceReviewWorkflow(tenantId),
    linearWorkflow('staffing-workflow', 'Staffing Workflow', 'staffing', 'workforce-manager', tenantId, [['forecast-coverage', 'Forecast race-day coverage', 'workforce-planner', 240], ['assign-staff', 'Assign and notify staff', 'workforce-coordinator', 120], ['approve-roster', 'Approve staffing roster', 'workforce-manager', 60]]),
    emergencyResponseWorkflow(tenantId),
    controlledRaceStartApprovalWorkflow(tenantId),
    linearWorkflow('ai-recommendation-review', 'AI Recommendation Review', 'ai-review', 'responsible-ai-officer', tenantId, [['evidence-check', 'Validate evidence and model lineage', 'model-risk-analyst', 60], ['domain-review', 'Complete domain expert review', 'domain-expert', 120], ['approval', 'Approve human-in-the-loop decision', 'responsible-ai-officer', 120]]),
  ];
}
