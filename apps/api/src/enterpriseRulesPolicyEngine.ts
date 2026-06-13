export type PolicyDomain = 'business' | 'racing' | 'operations' | 'compliance' | 'ai-guardrail' | 'approval' | 'emergency' | 'maintenance' | 'regulatory';
export type RuleEffect = 'allow' | 'deny' | 'require-approval' | 'require-action' | 'escalate';
export type RolloutStrategy = 'draft' | 'shadow' | 'canary' | 'phased' | 'active' | 'retired';
export type RuleOperator = 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'includes' | 'exists';

export interface RuleCondition { field: string; operator: RuleOperator; value?: unknown }
export interface PolicyIntegration { target: 'workflow' | 'ai-system' | 'digital-twin' | 'operational-service'; endpoint: string; event: string }
export interface ApprovalRequirement { role: string; count: number; protectedAction?: string }
export interface EnterpriseRuleDefinition {
  id: string;
  name: string;
  domain: PolicyDomain;
  priority: number;
  effect: RuleEffect;
  conditions: RuleCondition[];
  actions: string[];
  regulatoryRefs: string[];
  approvalRequirements?: ApprovalRequirement[];
  inheritsFrom?: string;
  rollout?: RolloutStrategy;
  rolloutPercent?: number;
  integrations?: PolicyIntegration[];
}
export interface RuleVersion extends EnterpriseRuleDefinition { version: number; status: RolloutStrategy; createdAt: string; createdBy: string; changeSummary: string }
export interface PolicyEvaluationContext { subjectId: string; tenantId?: string; action: string; attributes: Record<string, unknown>; timestamp?: string; simulation?: boolean }
export interface PolicyDecision { allowed: boolean; effects: RuleEffect[]; matchedRules: string[]; requiredApprovals: ApprovalRequirement[]; actions: string[]; integrations: PolicyIntegration[]; conflicts: PolicyConflict[]; audit: string[] }
export interface PolicyConflict { ruleIds: string[]; reason: string; severity: 'medium' | 'high' | 'critical' }
export interface RuleTestCase { name: string; context: PolicyEvaluationContext; expectedEffects: RuleEffect[]; expectedAllowed: boolean }
export interface RuleTestResult { name: string; passed: boolean; actual: PolicyDecision }
export interface PolicyApprovalRequest { id: string; ruleId: string; version: number; requestedBy: string; status: 'pending' | 'approved' | 'rejected'; approvers: string[]; evidence: string[] }

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export class EnterpriseRulesPolicyEngine {
  private readonly versions = new Map<string, RuleVersion[]>();
  private readonly approvals = new Map<string, PolicyApprovalRequest>();

  publishRule(rule: EnterpriseRuleDefinition, actor: string, changeSummary: string, createdAt = new Date().toISOString()): RuleVersion {
    const existing = this.versions.get(rule.id) ?? [];
    const inherited = rule.inheritsFrom ? this.current(rule.inheritsFrom) : undefined;
    const merged: EnterpriseRuleDefinition = inherited ? {
      ...inherited,
      ...rule,
      conditions: [...inherited.conditions, ...rule.conditions],
      actions: [...new Set([...inherited.actions, ...rule.actions])],
      regulatoryRefs: [...new Set([...inherited.regulatoryRefs, ...rule.regulatoryRefs])],
      approvalRequirements: [...(inherited.approvalRequirements ?? []), ...(rule.approvalRequirements ?? [])],
      integrations: [...(inherited.integrations ?? []), ...(rule.integrations ?? [])],
      id: rule.id,
      name: rule.name,
    } : rule;
    const version: RuleVersion = { ...clone(merged), version: existing.length + 1, status: rule.rollout ?? 'draft', createdAt, createdBy: actor, changeSummary };
    this.versions.set(rule.id, [...existing, version]);
    return clone(version);
  }

  current(ruleId: string): RuleVersion {
    const history = this.versions.get(ruleId);
    if (!history?.length) throw new Error(`Unknown rule ${ruleId}`);
    return clone(history[history.length - 1]);
  }

  history(ruleId: string): RuleVersion[] { return clone(this.versions.get(ruleId) ?? []); }

  createApprovalRequest(ruleId: string, requestedBy: string, evidence: string[]): PolicyApprovalRequest {
    const rule = this.current(ruleId);
    const request = { id: `policy-approval-${this.approvals.size + 1}`, ruleId, version: rule.version, requestedBy, status: 'pending' as const, approvers: [], evidence: [...evidence] };
    this.approvals.set(request.id, request);
    return clone(request);
  }

  approve(requestId: string, approver: string): PolicyApprovalRequest {
    const request = this.approvals.get(requestId);
    if (!request) throw new Error(`Unknown approval request ${requestId}`);
    const next = { ...request, status: 'approved' as const, approvers: [...new Set([...request.approvers, approver])] };
    this.approvals.set(requestId, next);
    return clone(next);
  }

  evaluate(context: PolicyEvaluationContext): PolicyDecision {
    const active = [...this.versions.values()].map((v) => v[v.length - 1]).filter((rule) => this.inRollout(rule, context) && this.matches(rule, context));
    const conflicts = this.detectConflicts(active);
    const effects = active.map((rule) => rule.effect);
    return {
      allowed: !effects.includes('deny') && conflicts.every((conflict) => conflict.severity !== 'critical'),
      effects,
      matchedRules: active.map((rule) => `${rule.id}@v${rule.version}`),
      requiredApprovals: active.flatMap((rule) => rule.approvalRequirements ?? []),
      actions: active.flatMap((rule) => rule.actions),
      integrations: active.flatMap((rule) => rule.integrations ?? []),
      conflicts,
      audit: active.map((rule) => `${rule.domain}:${rule.name}:${rule.status}`),
    };
  }

  simulate(contexts: PolicyEvaluationContext[]): PolicyDecision[] { return contexts.map((context) => this.evaluate({ ...context, simulation: true })); }
  testRule(testCase: RuleTestCase): RuleTestResult { const actual = this.evaluate(testCase.context); return { name: testCase.name, actual, passed: actual.allowed === testCase.expectedAllowed && testCase.expectedEffects.every((effect) => actual.effects.includes(effect)) }; }

  detectConflicts(rules = [...this.versions.values()].map((v) => v[v.length - 1])): PolicyConflict[] {
    const conflicts: PolicyConflict[] = [];
    for (let i = 0; i < rules.length; i += 1) for (let j = i + 1; j < rules.length; j += 1) {
      const a = rules[i], b = rules[j];
      const samePriority = a.priority === b.priority;
      const overlappingAction = a.actions.some((action) => b.actions.includes(action));
      const opposing = (a.effect === 'allow' && b.effect === 'deny') || (a.effect === 'deny' && b.effect === 'allow');
      if (samePriority && overlappingAction && opposing) conflicts.push({ ruleIds: [a.id, b.id], reason: 'same-priority rules have opposing effects for the same controlled action', severity: 'critical' });
    }
    return conflicts;
  }

  private inRollout(rule: RuleVersion, context: PolicyEvaluationContext): boolean {
    if (context.simulation) return rule.status !== 'retired';
    if (rule.status === 'active') return true;
    if (rule.status === 'shadow') return true;
    if (rule.status === 'canary' || rule.status === 'phased') return this.bucket(context.subjectId) < (rule.rolloutPercent ?? 10);
    return false;
  }

  private matches(rule: RuleVersion, context: PolicyEvaluationContext): boolean { return rule.conditions.every((condition) => this.compare(context.attributes[condition.field], condition)); }
  private compare(actual: unknown, condition: RuleCondition): boolean {
    if (condition.operator === 'exists') return actual !== undefined && actual !== null;
    if (condition.operator === 'equals') return actual === condition.value;
    if (condition.operator === 'not-equals') return actual !== condition.value;
    if (condition.operator === 'greater-than') return Number(actual) > Number(condition.value);
    if (condition.operator === 'less-than') return Number(actual) < Number(condition.value);
    if (condition.operator === 'includes') return Array.isArray(actual) && actual.includes(condition.value);
    return false;
  }
  private bucket(subjectId: string): number { return [...subjectId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100; }
}
