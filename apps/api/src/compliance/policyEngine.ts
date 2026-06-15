import { EnterpriseRulesPolicyEngine, type EnterpriseRuleDefinition, type PolicyDecision, type PolicyEvaluationContext, type RuleVersion } from '../enterpriseRulesPolicyEngine.js';
import { safetyCriticalGovernanceRules } from './governanceRules.js';

export type TrustworthyCriterion = 'C1-human-governance' | 'C2-policy-enforced' | 'C6-epistemic-prudence' | 'C7-incremental-knowledge-evolution';
export type ComplianceDecisionStatus = 'allowed' | 'blocked' | 'approval-required' | 'escalated';

export interface TrustworthyPolicyEvaluation {
  status: ComplianceDecisionStatus;
  criteria: TrustworthyCriterion[];
  decision: PolicyDecision;
  requiredApprovals: string[];
  escalation?: { reason: string; routeTo: string[] };
  versionRefs: string[];
  reversibleUpdateAvailable: boolean;
}

export interface VersionedKnowledgeUpdate<TPayload = unknown> {
  id: string;
  subjectId: string;
  version: number;
  createdAt: string;
  createdBy: string;
  changeSummary: string;
  payload: TPayload;
  reversible: true;
  revertedAt?: string;
  revertedBy?: string;
  previousVersion?: number;
}

const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

export class TrustworthyOrchestrationPolicyEngine {
  private readonly policy = new EnterpriseRulesPolicyEngine();
  private readonly knowledge = new Map<string, VersionedKnowledgeUpdate[]>();

  constructor(seed = true) {
    if (seed) this.seed();
  }

  evaluate(input: PolicyEvaluationContext & { actorId?: string; actorType?: string; roles?: string[]; confidence?: number; approvalId?: string }): TrustworthyPolicyEvaluation {
    const enriched = {
      ...input,
      attributes: {
        ...input.attributes,
        actorType: input.actorType,
        roles: input.roles ?? [],
        confidence: input.confidence,
        approvalId: input.approvalId,
      },
    };
    const decision = this.policy.evaluate(enriched);
    const effects = new Set(decision.effects);
    const status: ComplianceDecisionStatus = effects.has('deny')
      ? 'blocked'
      : effects.has('escalate')
        ? 'escalated'
        : effects.has('require-approval')
          ? 'approval-required'
          : decision.allowed ? 'allowed' : 'blocked';
    return {
      status,
      criteria: this.criteriaFor(decision),
      decision,
      requiredApprovals: decision.requiredApprovals.map((approval) => `${approval.role}:${approval.count}${approval.protectedAction ? `:${approval.protectedAction}` : ''}`),
      escalation: effects.has('escalate') ? { reason: 'Uncertainty or unsupported autonomy detected by Trustworthy Orchestration policy.', routeTo: ['ai-governor', 'steward', 'compliance-officer'] } : undefined,
      versionRefs: decision.matchedRules,
      reversibleUpdateAvailable: true,
    };
  }

  publishRule(rule: EnterpriseRuleDefinition, actor: string, changeSummary: string, createdAt = new Date().toISOString()): RuleVersion {
    return this.policy.publishRule(rule, actor, changeSummary, createdAt);
  }

  ruleHistory(ruleId: string): RuleVersion[] {
    return this.policy.history(ruleId);
  }

  recordKnowledgeUpdate<TPayload>(subjectId: string, payload: TPayload, createdBy: string, changeSummary: string, createdAt = new Date().toISOString()): VersionedKnowledgeUpdate<TPayload> {
    const history = this.knowledge.get(subjectId) ?? [];
    const update: VersionedKnowledgeUpdate<TPayload> = {
      id: `knowledge-${subjectId}-v${history.length + 1}`,
      subjectId,
      version: history.length + 1,
      createdAt,
      createdBy,
      changeSummary,
      payload: clone(payload),
      reversible: true,
      previousVersion: history.at(-1)?.version,
    };
    this.knowledge.set(subjectId, [...history, update]);
    return clone(update);
  }

  rollbackKnowledge(subjectId: string, version: number, revertedBy: string, revertedAt = new Date().toISOString()): VersionedKnowledgeUpdate | undefined {
    const history = this.knowledge.get(subjectId) ?? [];
    const target = history.find((entry) => entry.version === version);
    if (!target) return undefined;
    const rollback = { ...target, id: `knowledge-${subjectId}-rollback-${version}`, version: history.length + 1, createdAt: revertedAt, createdBy: revertedBy, changeSummary: `Rollback to v${version}`, revertedAt, revertedBy, previousVersion: history.at(-1)?.version };
    this.knowledge.set(subjectId, [...history, rollback]);
    return clone(rollback);
  }

  knowledgeHistory(subjectId?: string): VersionedKnowledgeUpdate[] {
    const values = subjectId ? (this.knowledge.get(subjectId) ?? []) : [...this.knowledge.values()].flat();
    return values.map(clone);
  }

  policyReport() {
    return {
      criteria: ['C1-human-governance', 'C2-policy-enforced', 'C6-epistemic-prudence', 'C7-incremental-knowledge-evolution'] satisfies TrustworthyCriterion[],
      sampleEvaluations: [
        this.evaluate({ subjectId: 'race-7', action: 'race-start', actorId: 'ai-agent-1', actorType: 'ai-agent', roles: ['steward'], confidence: 0.93, attributes: { protectedAction: true, autonomousMutation: true } }),
        this.evaluate({ subjectId: 'rec-uncertain', action: 'recommend', actorId: 'moe-router', actorType: 'ai-agent', confidence: 0.42, attributes: { protectedAction: false, uncertainty: 'high' } }),
      ],
      knowledgeUpdates: this.knowledgeHistory(),
    };
  }

  private criteriaFor(decision: PolicyDecision): TrustworthyCriterion[] {
    const refs = decision.matchedRules.join(' ');
    return [
      refs.includes('c1-') ? 'C1-human-governance' : undefined,
      refs.includes('c2-') ? 'C2-policy-enforced' : undefined,
      refs.includes('c6-') ? 'C6-epistemic-prudence' : undefined,
      refs.includes('c7-') ? 'C7-incremental-knowledge-evolution' : undefined,
    ].filter((item): item is TrustworthyCriterion => Boolean(item));
  }

  private seed(): void {
    const active = 'active' as const;
    this.publishRule({ id: 'c1-block-unauthorized-autonomy', name: 'C1 block unauthorized autonomous mutation', domain: 'ai-guardrail', priority: 1000, effect: 'deny', conditions: [{ field: 'autonomousMutation', operator: 'equals', value: true }, { field: 'actorType', operator: 'equals', value: 'ai-agent' }], actions: ['block-protected-action'], regulatoryRefs: ['AI_ACT_ART_14', 'TRUSTWORTHY_C1'], rollout: active }, 'compliance-system', 'Seed C1 autonomy guardrail');
    this.publishRule({ id: 'c1-require-human-approval', name: 'C1 require human approval for protected action', domain: 'approval', priority: 900, effect: 'require-approval', conditions: [{ field: 'protectedAction', operator: 'equals', value: true }], actions: ['create-approval-request'], regulatoryRefs: ['AI_ACT_ART_14'], approvalRequirements: [{ role: 'steward', count: 1 }, { role: 'compliance-officer', count: 1 }], rollout: active }, 'compliance-system', 'Seed C1 approval requirement');
    for (const rule of safetyCriticalGovernanceRules) {
      this.publishRule({
        id: `c1-${rule.protectedAction}-mandatory-approval`,
        name: `C1 mandatory approval for ${rule.protectedAction}`,
        domain: 'approval',
        priority: 950,
        effect: 'require-approval',
        conditions: [{ field: 'protectedActionName', operator: 'equals', value: rule.protectedAction }],
        actions: ['create-approval-request', 'attach-human-governance-metadata', 'block-without-approval'],
        regulatoryRefs: rule.regulations,
        approvalRequirements: rule.requiredApprovalRoles.map((role) => ({ role, count: 1, protectedAction: rule.protectedAction })),
        rollout: active,
      }, 'compliance-system', `Seed mandatory safety-critical approval rule for ${rule.protectedAction}`);
    }
    this.publishRule({ id: 'c2-machine-readable-policy', name: 'C2 policy engine must evaluate regulated actions', domain: 'compliance', priority: 800, effect: 'require-action', conditions: [{ field: 'protectedAction', operator: 'exists' }], actions: ['record-policy-decision', 'attach-policy-version'], regulatoryRefs: ['TRUSTWORTHY_C2'], rollout: active }, 'compliance-system', 'Seed C2 machine-readable policy enforcement');
    this.publishRule({ id: 'c6-escalate-uncertainty', name: 'C6 escalate low confidence recommendations', domain: 'ai-guardrail', priority: 850, effect: 'escalate', conditions: [{ field: 'confidence', operator: 'less-than', value: 0.65 }], actions: ['escalate-to-ai-governor', 'request-more-evidence'], regulatoryRefs: ['AI_ACT_ART_13', 'TRUSTWORTHY_C6'], rollout: active }, 'compliance-system', 'Seed C6 uncertainty escalation');
    this.publishRule({ id: 'c7-versioned-reversible-updates', name: 'C7 require versioned reversible knowledge updates', domain: 'ai-guardrail', priority: 700, effect: 'require-action', conditions: [{ field: 'knowledgeUpdate', operator: 'equals', value: true }], actions: ['create-version-record', 'enable-rollback'], regulatoryRefs: ['TRUSTWORTHY_C7'], rollout: active }, 'compliance-system', 'Seed C7 knowledge evolution controls');
    this.recordKnowledgeUpdate('rulebook-rag-index', { source: 'ARCI 2026 rulebook', checksum: 'sha256:rulebook-rag-v1' }, 'compliance-system', 'Initial rulebook RAG index baseline', '2026-06-14T00:00:00.000Z');
  }
}

export function createTrustworthyOrchestrationPolicyEngine() {
  return new TrustworthyOrchestrationPolicyEngine();
}
