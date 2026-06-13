export type WorkflowDomain = 'race-day' | 'maintenance' | 'stewarding' | 'veterinary' | 'compliance' | 'investigation' | 'emergency' | 'inspection' | 'staffing' | 'security' | 'ai-review';
export type WorkflowTaskType = 'userTask' | 'serviceTask' | 'approvalTask' | 'parallelApproval' | 'exclusiveGateway' | 'parallelGateway' | 'timerEvent' | 'endEvent';
export type WorkflowStatus = 'defined' | 'running' | 'waiting' | 'completed' | 'escalated' | 'exception' | 'recovering';
export type TaskStatus = 'open' | 'claimed' | 'approved' | 'rejected' | 'completed' | 'escalated' | 'skipped' | 'failed' | 'retrying';
export type WorkflowEventType = 'workflow.started' | 'task.created' | 'task.completed' | 'task.failed' | 'task.retried' | 'approval.recorded' | 'sla.breached' | 'workflow.completed' | 'workflow.exception' | 'workflow.recovered' | 'digitalTwin.updated';

export interface WorkflowRetryPolicy { maxAttempts: number; backoffMinutes: number; retryableErrors?: string[]; }
export interface WorkflowSlaPolicy { minutes: number; escalationRole: string; severity: 'warning' | 'breach' | 'critical'; }
export interface DigitalTwinBinding { refs: string[]; syncMode: 'read' | 'write' | 'read-write'; statePatch?: Record<string, unknown>; }

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
  approvals: Array<{ role: string; actor: string; decision: 'approved' | 'rejected'; reason: string; timestamp: string }>;
}

export interface WorkflowAuditEntry { id: string; timestamp: string; actor: string; action: WorkflowEventType | string; details: Record<string, unknown>; }
export interface WorkflowRuntimeEvent { id: string; type: WorkflowEventType | string; tenantId: string; instanceId?: string; timestamp: string; payload: Record<string, unknown>; }

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

const minutesAfter = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

export class WorkflowOrchestrationEngine {
  private definitions = new Map<string, WorkflowDefinition>();
  private instances = new Map<string, WorkflowInstance>();
  private eventLog: WorkflowRuntimeEvent[] = [];

  register(definition: WorkflowDefinition): WorkflowDefinition {
    if (!definition.steps.some((step) => step.id === definition.startStepId)) throw new Error(`Unknown start step ${definition.startStepId}`);
    const ids = new Set(definition.steps.map((step) => step.id));
    for (const step of definition.steps) for (const next of step.next ?? []) if (!ids.has(next)) throw new Error(`Step ${step.id} points to unknown step ${next}`);
    this.definitions.set(definition.id, definition);
    return definition;
  }

  templates(tenantId?: string): WorkflowDefinition[] { return [...this.definitions.values()].filter((definition) => !tenantId || definition.tenantId === tenantId).map((definition) => structuredClone(definition)); }

  start(definitionId: string, context: WorkflowContext, actor = 'system', now = new Date().toISOString()): WorkflowInstance {
    const definition = this.requireDefinition(definitionId);
    if (definition.tenantId !== context.tenantId) throw new Error('Workflow tenant mismatch');
    const instance: WorkflowInstance = { id: `${definitionId}-${this.instances.size + 1}`, definitionId, definitionVersion: definition.version, tenantId: context.tenantId, status: 'running', context, activeStepIds: [], completedStepIds: [], tasks: [], audit: [], events: [], exceptions: [], digitalTwinRefs: [...new Set(context.digitalTwinRefs)], digitalTwinState: {} };
    this.instances.set(instance.id, instance);
    this.audit(instance, now, actor, 'workflow.started', { definitionId, bpmnProcessId: definition.bpmnProcessId });
    this.activate(instance, [definition.startStepId], now, actor);
    return this.snapshot(instance);
  }

  emit(event: Omit<WorkflowRuntimeEvent, 'id' | 'timestamp'>, now = new Date().toISOString()): WorkflowInstance[] {
    const runtimeEvent: WorkflowRuntimeEvent = { ...event, id: `event-${this.eventLog.length + 1}`, timestamp: now };
    this.eventLog.push(runtimeEvent);
    const affected: WorkflowInstance[] = [];
    for (const instance of this.instances.values()) {
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
    task.status = 'completed';
    delete task.retryAt;
    instance.context.payload = { ...instance.context.payload, ...output };
    this.audit(instance, now, actor, 'task.completed', { taskId, stepId: task.stepId, output });
    this.advanceFrom(instance, task.stepId, now, actor);
    return this.snapshot(instance);
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
          instance.tasks.push({ id: `${instance.id}-${step.id}-${instance.tasks.length + 1}`, stepId: step.id, name: step.name, type: step.type, status: 'open', role: step.role, assignees: step.assignees ?? [], dueAt: slaMinutes ? minutesAfter(now, slaMinutes) : undefined, attempt: 0, approvals: [] });
          this.audit(instance, now, 'system', 'task.created', { stepId: step.id, type: step.type, dueAt: slaMinutes ? minutesAfter(now, slaMinutes) : undefined });
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
  }

  private criticalPath(definition: WorkflowDefinition): string[] { const path: string[] = []; let current: string | undefined = definition.startStepId; const seen = new Set<string>(); while (current && !seen.has(current)) { seen.add(current); path.push(current); current = definition.steps.find((step) => step.id === current)?.next?.[0]; } return path; }
  private audit(instance: WorkflowInstance, timestamp: string, actor: string, action: WorkflowEventType | string, details: Record<string, unknown>): void { instance.audit.push({ id: `${instance.id}-audit-${instance.audit.length + 1}`, timestamp, actor, action, details }); }
  private raiseException(instance: WorkflowInstance, timestamp: string, message: string): void { instance.status = 'exception'; instance.exceptions.push(message); this.audit(instance, timestamp, 'system', 'workflow.exception', { message }); }
  private requireDefinition(id: string): WorkflowDefinition { const definition = this.definitions.get(id); if (!definition) throw new Error(`Unknown workflow definition ${id}`); return definition; }
  private requireInstance(id: string): WorkflowInstance { const instance = this.instances.get(id); if (!instance) throw new Error(`Unknown workflow instance ${id}`); return instance; }
  private requireTask(instance: WorkflowInstance, taskId: string): WorkflowTask { const task = instance.tasks.find((candidate) => candidate.id === taskId); if (!task) throw new Error(`Unknown task ${taskId}`); return task; }
  private snapshot(instance: WorkflowInstance): WorkflowInstance { return structuredClone(instance); }
}

const opsSla = (minutes: number, escalationRole: string, severity: WorkflowSlaPolicy['severity'] = 'breach'): WorkflowSlaPolicy => ({ minutes, escalationRole, severity });

export function raceDayOperationsWorkflow(tenantId: string): WorkflowDefinition {
  return { id: 'race-day-ops', name: 'Race-Day Operations Command', domain: 'race-day', version: '2.0.0', bpmnProcessId: 'Process_RaceDayOperations', startStepId: 'pre-race-inspection', ownerRole: 'operations-director', tenantId, triggerEvents: ['race-day.opened'], steps: [
    { id: 'pre-race-inspection', name: 'Pre-race safety and surface inspection', type: 'userTask', role: 'track-superintendent', sla: opsSla(30, 'operations-director'), digitalTwin: { refs: ['twin:track:surface'], syncMode: 'read-write', statePatch: { inspection: 'started' } }, next: ['sync-digital-twin'] },
    { id: 'sync-digital-twin', name: 'Sync operational state to Digital Twin', type: 'serviceTask', retryPolicy: { maxAttempts: 2, backoffMinutes: 2, retryableErrors: ['twin-timeout'] }, recoveryStepId: 'manual-twin-recovery', action: (context) => ({ twinSync: { refs: context.digitalTwinRefs, status: 'updated' } }), digitalTwin: { refs: ['twin:operations:command'], syncMode: 'write', statePatch: { status: 'pre-race-validated' } }, next: ['parallel-approvals'] },
    { id: 'manual-twin-recovery', name: 'Manual Digital Twin reconciliation', type: 'userTask', role: 'digital-twin-operator', sla: opsSla(15, 'operations-director', 'critical'), next: ['parallel-approvals'] },
    { id: 'parallel-approvals', name: 'Steward, veterinary, and operations approvals', type: 'parallelApproval', approvalRoles: ['chief-steward', 'veterinarian', 'operations-director'], requiredApprovals: 3, sla: opsSla(10, 'general-manager', 'critical'), dependencies: ['pre-race-inspection', 'sync-digital-twin'], next: ['publish-race-ready'] },
    { id: 'publish-race-ready', name: 'Publish race-ready command decision', type: 'serviceTask', action: () => ({ raceDayDecision: 'race-ready' }), digitalTwin: { refs: ['twin:race-day:readiness'], syncMode: 'write', statePatch: { raceReady: true } }, next: ['done'] },
    { id: 'done', name: 'Race-day workflow completed', type: 'endEvent' },
  ] };
}

function linearWorkflow(id: string, name: string, domain: WorkflowDomain, ownerRole: string, tenantId: string, steps: Array<[string, string, string, number]>): WorkflowDefinition {
  return { id, name, domain, version: '1.0.0', bpmnProcessId: `Process_${id.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`, startStepId: steps[0][0], ownerRole, tenantId, triggerEvents: [`${domain}.requested`], steps: [
    ...steps.map(([stepId, stepName, role, minutes], index) => ({ id: stepId, name: stepName, type: index === steps.length - 1 ? 'approvalTask' as const : 'userTask' as const, role, sla: opsSla(minutes, ownerRole), digitalTwin: { refs: [`twin:${domain}:${stepId}`], syncMode: 'read-write' as const, statePatch: { [stepId]: 'active' } }, next: index + 1 < steps.length ? [steps[index + 1][0]] : ['closed'] })),
    { id: 'closed', name: `${name} closed`, type: 'endEvent' as const },
  ] };
}

export function workflowPortfolio(tenantId: string): WorkflowDefinition[] {
  return [
    raceDayOperationsWorkflow(tenantId),
    linearWorkflow('maintenance-work-order', 'Maintenance Work Order', 'maintenance', 'maintenance-manager', tenantId, [['triage', 'Triage maintenance request', 'maintenance-dispatcher', 20], ['isolate-asset', 'Isolate asset and assign crew', 'maintenance-lead', 45], ['verify-repair', 'Verify repair and return to service', 'maintenance-manager', 60]]),
    linearWorkflow('steward-investigation', 'Steward Investigation', 'stewarding', 'chief-steward', tenantId, [['collect-evidence', 'Collect incident evidence', 'steward', 30], ['conduct-review', 'Conduct steward panel review', 'chief-steward', 120], ['issue-ruling', 'Issue ruling and notifications', 'chief-steward', 30]]),
    linearWorkflow('veterinary-review', 'Veterinary Review', 'veterinary', 'chief-veterinarian', tenantId, [['intake-horse', 'Intake veterinary concern', 'veterinary-technician', 10], ['clinical-review', 'Complete clinical review', 'veterinarian', 45], ['clearance-decision', 'Approve clearance decision', 'chief-veterinarian', 20]]),
    linearWorkflow('inspection-program', 'Inspection Program', 'inspection', 'inspection-manager', tenantId, [['schedule-inspection', 'Schedule inspection', 'inspection-coordinator', 60], ['perform-inspection', 'Perform inspection checklist', 'inspector', 240], ['approve-findings', 'Approve inspection findings', 'inspection-manager', 120]]),
    linearWorkflow('security-incident', 'Security Incident Response', 'security', 'security-director', tenantId, [['classify-threat', 'Classify security threat', 'security-operator', 5], ['contain-incident', 'Contain incident and preserve evidence', 'security-lead', 15], ['executive-briefing', 'Approve executive security briefing', 'security-director', 30]]),
    linearWorkflow('compliance-review', 'Compliance Review', 'compliance', 'compliance-director', tenantId, [['scope-review', 'Scope compliance review', 'compliance-analyst', 120], ['control-testing', 'Perform control testing', 'control-owner', 1440], ['approve-remediation', 'Approve remediation plan', 'compliance-director', 240]]),
    linearWorkflow('staffing-workflow', 'Staffing Workflow', 'staffing', 'workforce-manager', tenantId, [['forecast-coverage', 'Forecast race-day coverage', 'workforce-planner', 240], ['assign-staff', 'Assign and notify staff', 'workforce-coordinator', 120], ['approve-roster', 'Approve staffing roster', 'workforce-manager', 60]]),
    linearWorkflow('emergency-response', 'Emergency Procedure Orchestration', 'emergency', 'incident-commander', tenantId, [['dispatch', 'Dispatch incident resources', 'incident-commander', 5], ['stabilize-scene', 'Stabilize scene and coordinate agencies', 'emergency-liaison', 20], ['after-action', 'Approve after-action audit', 'compliance-manager', 1440]]),
    linearWorkflow('ai-recommendation-review', 'AI Recommendation Review', 'ai-review', 'responsible-ai-officer', tenantId, [['evidence-check', 'Validate evidence and model lineage', 'model-risk-analyst', 60], ['domain-review', 'Complete domain expert review', 'domain-expert', 120], ['approval', 'Approve human-in-the-loop decision', 'responsible-ai-officer', 120]]),
  ];
}
