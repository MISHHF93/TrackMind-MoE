export type WorkflowDomain = 'race-day' | 'maintenance' | 'stewarding' | 'compliance' | 'investigation' | 'emergency' | 'inspection' | 'staffing' | 'ai-review';
export type WorkflowTaskType = 'userTask' | 'serviceTask' | 'approvalTask' | 'parallelApproval' | 'exclusiveGateway' | 'parallelGateway' | 'timerEvent' | 'endEvent';
export type WorkflowStatus = 'defined' | 'running' | 'waiting' | 'completed' | 'escalated' | 'exception';
export type TaskStatus = 'open' | 'claimed' | 'approved' | 'rejected' | 'completed' | 'escalated' | 'skipped';

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowTaskType;
  role?: string;
  assignees?: string[];
  next?: string[];
  slaMinutes?: number;
  escalationRole?: string;
  approvalRoles?: string[];
  requiredApprovals?: number;
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
  approvals: Array<{ role: string; actor: string; decision: 'approved' | 'rejected'; reason: string; timestamp: string }>;
}

export interface WorkflowAuditEntry { id: string; timestamp: string; actor: string; action: string; details: Record<string, unknown>; }

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  definitionVersion: string;
  tenantId: string;
  status: WorkflowStatus;
  context: WorkflowContext;
  activeStepIds: string[];
  tasks: WorkflowTask[];
  audit: WorkflowAuditEntry[];
  exceptions: string[];
  digitalTwinRefs: string[];
}

const minutesAfter = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

export class WorkflowOrchestrationEngine {
  private definitions = new Map<string, WorkflowDefinition>();
  private instances = new Map<string, WorkflowInstance>();

  register(definition: WorkflowDefinition): WorkflowDefinition {
    if (!definition.steps.some((step) => step.id === definition.startStepId)) throw new Error(`Unknown start step ${definition.startStepId}`);
    this.definitions.set(definition.id, definition);
    return definition;
  }

  start(definitionId: string, context: WorkflowContext, actor = 'system', now = new Date().toISOString()): WorkflowInstance {
    const definition = this.requireDefinition(definitionId);
    if (definition.tenantId !== context.tenantId) throw new Error('Workflow tenant mismatch');
    const instance: WorkflowInstance = {
      id: `${definitionId}-${this.instances.size + 1}`,
      definitionId,
      definitionVersion: definition.version,
      tenantId: context.tenantId,
      status: 'running',
      context,
      activeStepIds: [],
      tasks: [],
      audit: [],
      exceptions: [],
      digitalTwinRefs: [...context.digitalTwinRefs],
    };
    this.instances.set(instance.id, instance);
    this.audit(instance, now, actor, 'workflow.started', { definitionId, bpmnProcessId: definition.bpmnProcessId });
    this.activate(instance, [definition.startStepId], now, actor);
    return this.snapshot(instance);
  }

  completeTask(instanceId: string, taskId: string, actor: string, output: Record<string, unknown> = {}, now = new Date().toISOString()): WorkflowInstance {
    const instance = this.requireInstance(instanceId);
    const task = instance.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new Error(`Unknown task ${taskId}`);
    if (!['open', 'claimed'].includes(task.status)) throw new Error(`Task ${taskId} is not open`);
    task.status = 'completed';
    instance.context.payload = { ...instance.context.payload, ...output };
    this.audit(instance, now, actor, 'task.completed', { taskId, stepId: task.stepId, output });
    this.advanceFrom(instance, task.stepId, now, actor);
    return this.snapshot(instance);
  }

  recordApproval(instanceId: string, taskId: string, role: string, actor: string, decision: 'approved' | 'rejected', reason: string, now = new Date().toISOString()): WorkflowInstance {
    const instance = this.requireInstance(instanceId);
    const definition = this.requireDefinition(instance.definitionId);
    const task = instance.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new Error(`Unknown task ${taskId}`);
    const step = definition.steps.find((candidate) => candidate.id === task.stepId)!;
    if (!step.approvalRoles?.includes(role)) throw new Error(`Role ${role} cannot approve ${task.stepId}`);
    task.approvals.push({ role, actor, decision, reason, timestamp: now });
    this.audit(instance, now, actor, 'approval.recorded', { taskId, role, decision, reason });
    if (decision === 'rejected') {
      task.status = 'rejected';
      instance.status = 'exception';
      instance.exceptions.push(`Approval rejected by ${role}: ${reason}`);
      return this.snapshot(instance);
    }
    const uniqueApprovals = new Set(task.approvals.filter((approval) => approval.decision === 'approved').map((approval) => approval.role));
    if (uniqueApprovals.size >= (step.requiredApprovals ?? step.approvalRoles.length)) {
      task.status = 'approved';
      this.advanceFrom(instance, task.stepId, now, actor);
    } else {
      instance.status = 'waiting';
    }
    return this.snapshot(instance);
  }

  evaluateEscalations(instanceId: string, now = new Date().toISOString()): WorkflowInstance {
    const instance = this.requireInstance(instanceId);
    const definition = this.requireDefinition(instance.definitionId);
    for (const task of instance.tasks.filter((candidate) => ['open', 'claimed'].includes(candidate.status) && candidate.dueAt && candidate.dueAt <= now)) {
      const step = definition.steps.find((candidate) => candidate.id === task.stepId);
      task.status = 'escalated';
      task.escalatedTo = step?.escalationRole ?? definition.ownerRole;
      instance.status = 'escalated';
      this.audit(instance, now, 'system', 'task.escalated', { taskId: task.id, escalatedTo: task.escalatedTo });
    }
    return this.snapshot(instance);
  }

  private activate(instance: WorkflowInstance, stepIds: string[], now: string, actor: string): void {
    const definition = this.requireDefinition(instance.definitionId);
    instance.activeStepIds = [...new Set(stepIds)];
    for (const stepId of stepIds) {
      const step = definition.steps.find((candidate) => candidate.id === stepId);
      if (!step) { this.raiseException(instance, now, `Missing step ${stepId}`); continue; }
      if (step.condition && !step.condition(instance.context)) { this.advanceFrom(instance, step.id, now, actor); continue; }
      if (step.type === 'serviceTask') {
        const patch = step.action?.(instance.context) ?? {};
        instance.context.payload = { ...instance.context.payload, ...patch };
        this.audit(instance, now, 'system', 'service.executed', { stepId: step.id, patch });
        this.advanceFrom(instance, step.id, now, actor);
      } else if (step.type === 'endEvent') {
        instance.status = 'completed';
        instance.activeStepIds = [];
        this.audit(instance, now, 'system', 'workflow.completed', { stepId: step.id });
      } else {
        instance.status = 'waiting';
        instance.tasks.push({ id: `${instance.id}-${step.id}`, stepId: step.id, name: step.name, type: step.type, status: 'open', role: step.role, assignees: step.assignees ?? [], dueAt: step.slaMinutes ? minutesAfter(now, step.slaMinutes) : undefined, approvals: [] });
        this.audit(instance, now, 'system', 'task.created', { stepId: step.id, type: step.type, dueAt: step.slaMinutes ? minutesAfter(now, step.slaMinutes) : undefined });
      }
    }
  }

  private advanceFrom(instance: WorkflowInstance, stepId: string, now: string, actor: string): void {
    const definition = this.requireDefinition(instance.definitionId);
    const step = definition.steps.find((candidate) => candidate.id === stepId);
    if (!step) return this.raiseException(instance, now, `Cannot advance unknown step ${stepId}`);
    this.activate(instance, step.next ?? [], now, actor);
  }

  private audit(instance: WorkflowInstance, timestamp: string, actor: string, action: string, details: Record<string, unknown>): void {
    instance.audit.push({ id: `${instance.id}-audit-${instance.audit.length + 1}`, timestamp, actor, action, details });
  }

  private raiseException(instance: WorkflowInstance, timestamp: string, message: string): void { instance.status = 'exception'; instance.exceptions.push(message); this.audit(instance, timestamp, 'system', 'workflow.exception', { message }); }
  private requireDefinition(id: string): WorkflowDefinition { const definition = this.definitions.get(id); if (!definition) throw new Error(`Unknown workflow definition ${id}`); return definition; }
  private requireInstance(id: string): WorkflowInstance { const instance = this.instances.get(id); if (!instance) throw new Error(`Unknown workflow instance ${id}`); return instance; }
  private snapshot(instance: WorkflowInstance): WorkflowInstance { return structuredClone(instance); }
}

export function raceDayOperationsWorkflow(tenantId: string): WorkflowDefinition {
  return {
    id: 'race-day-ops', name: 'Race-Day Operations Command', domain: 'race-day', version: '1.0.0', bpmnProcessId: 'Process_RaceDayOperations', startStepId: 'pre-race-inspection', ownerRole: 'operations-director', tenantId,
    steps: [
      { id: 'pre-race-inspection', name: 'Pre-race safety and surface inspection', type: 'userTask', role: 'track-superintendent', slaMinutes: 30, escalationRole: 'operations-director', next: ['sync-digital-twin'] },
      { id: 'sync-digital-twin', name: 'Sync operational state to Digital Twin', type: 'serviceTask', action: (context) => ({ twinSync: { refs: context.digitalTwinRefs, status: 'updated' } }), next: ['parallel-approvals'] },
      { id: 'parallel-approvals', name: 'Steward, veterinary, and operations approvals', type: 'parallelApproval', approvalRoles: ['chief-steward', 'veterinarian', 'operations-director'], requiredApprovals: 3, slaMinutes: 10, escalationRole: 'general-manager', next: ['publish-race-ready'] },
      { id: 'publish-race-ready', name: 'Publish race-ready command decision', type: 'serviceTask', action: () => ({ raceDayDecision: 'race-ready' }), next: ['done'] },
      { id: 'done', name: 'Race-day workflow completed', type: 'endEvent' },
    ],
  };
}

export function workflowPortfolio(tenantId: string): WorkflowDefinition[] {
  return [
    raceDayOperationsWorkflow(tenantId),
    { id: 'ai-recommendation-review', name: 'AI Recommendation Review', domain: 'ai-review', version: '1.0.0', bpmnProcessId: 'Process_AIReview', startStepId: 'evidence-check', ownerRole: 'responsible-ai-officer', tenantId, steps: [
      { id: 'evidence-check', name: 'Validate evidence and model lineage', type: 'userTask', role: 'model-risk-analyst', slaMinutes: 60, escalationRole: 'responsible-ai-officer', next: ['approval'] },
      { id: 'approval', name: 'Human-in-the-loop approval chain', type: 'parallelApproval', approvalRoles: ['responsible-ai-officer', 'domain-expert'], requiredApprovals: 2, slaMinutes: 120, escalationRole: 'compliance-director', next: ['closed'] },
      { id: 'closed', name: 'Review closed', type: 'endEvent' },
    ] },
    { id: 'emergency-response', name: 'Emergency Procedure Orchestration', domain: 'emergency', version: '1.0.0', bpmnProcessId: 'Process_EmergencyResponse', startStepId: 'dispatch', ownerRole: 'incident-commander', tenantId, steps: [
      { id: 'dispatch', name: 'Dispatch incident resources', type: 'userTask', role: 'incident-commander', slaMinutes: 5, escalationRole: 'general-manager', next: ['after-action'] },
      { id: 'after-action', name: 'After-action audit and compliance review', type: 'userTask', role: 'compliance-manager', slaMinutes: 1440, escalationRole: 'compliance-director', next: ['closed'] },
      { id: 'closed', name: 'Emergency closed', type: 'endEvent' },
    ] },
  ];
}
