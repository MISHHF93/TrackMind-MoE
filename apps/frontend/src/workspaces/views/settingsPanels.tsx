import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@trackmind/shared';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/design/components/dialog';
import { ApprovalDecisionButtons } from '@/features/approvals/GovernedActionDialog';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';
import { draftPromptLineage, publishPromptLineage, registerModelCard, registerPromptCard } from '@/api/mutations';
import { isRecord } from '@/lib/utils';

const governanceRegistrationRoles: Role[] = ['admin', 'compliance-officer'];

function canRegisterGovernanceArtifacts(role: Role): boolean {
  return governanceRegistrationRoles.includes(role);
}

function resolveApprovalRequestId(
  rec: Record<string, unknown>,
  approvalRequirements: Record<string, unknown>[],
  humanInLoopWorkflows: Record<string, unknown>[] = [],
): string {
  const auditRef = rec.auditReference;
  if (isRecord(auditRef) && typeof auditRef.approvalReference === 'string') {
    return auditRef.approvalReference;
  }
  const embeddedRequirement = rec.approvalRequirement;
  if (isRecord(embeddedRequirement)) {
    if (typeof embeddedRequirement.workflowId === 'string' && embeddedRequirement.workflowId.startsWith('approval-')) {
      return embeddedRequirement.workflowId;
    }
  }
  const recId = String(rec.id ?? rec.recommendationId ?? '');
  const requirement = approvalRequirements.find((item) => String(item.recommendationId ?? '') === recId);
  if (requirement) {
    if (typeof requirement.approvalRequestId === 'string') return requirement.approvalRequestId;
  }
  const workflow = humanInLoopWorkflows.find((item) => String(item.recommendationId ?? '') === recId);
  if (workflow && typeof workflow.approvalRequestId === 'string') return workflow.approvalRequestId;
  return '';
}

function formatRecommendationConfidence(rec: Record<string, unknown>): string {
  if (isRecord(rec.confidence)) {
    if (rec.confidence.band != null) return String(rec.confidence.band);
    if (rec.confidence.raw != null) return String(rec.confidence.raw);
  }
  if (rec.confidenceValue != null) return String(rec.confidenceValue);
  if (rec.confidence != null && typeof rec.confidence !== 'object') return String(rec.confidence);
  return '—';
}

function RegistryRegistrationDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  disabled,
  disabledReason,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  disabled?: boolean;
  disabledReason?: string;
  onSubmit: (justification: string) => Promise<{ message?: string }>;
}): ReactElement {
  const [justification, setJustification] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSuccessMessage(null);
          setErrorMessage(null);
          setJustification('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent governance>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="grid gap-2 text-sm">
          <span>Justification</span>
          <textarea
            className="min-h-[96px] rounded-md border border-[var(--border)] bg-[var(--card)] p-2"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Document lineage, evaluation evidence, and why this registration is required…"
          />
        </label>
        {disabledReason ? <p className="text-xs text-[var(--muted-foreground)]">{disabledReason}</p> : null}
        {errorMessage ? <p className="text-sm text-[var(--status-critical)]">{errorMessage}</p> : null}
        {successMessage ? <p className="text-sm text-[var(--status-nominal)]">{successMessage}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="governance"
            disabled={disabled || !justification.trim() || pending}
            onClick={async () => {
              setErrorMessage(null);
              setPending(true);
              try {
                const response = await onSubmit(justification.trim());
                setSuccessMessage(response.message ?? 'Registration submitted with governed audit linkage.');
                setJustification('');
                setTimeout(() => onOpenChange(false), 1200);
              } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : 'Registration failed.');
              } finally {
                setPending(false);
              }
            }}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [lineageDraftId, setLineageDraftId] = useState<string | null>(null);
  const [lineageDraftDialogOpen, setLineageDraftDialogOpen] = useState(false);

  const policy = feedData<Record<string, unknown>>(results, '/ai-control-plane/policy');
  const models = feedData<Record<string, unknown>>(results, '/ai-control-plane/models');
  const blocked = feedData<Record<string, unknown>>(results, '/ai-control-plane/blocked-actions');
  const workspace = feedData<Record<string, unknown>>(results, '/ai-control-plane/workspace');
  const governance = feedData<Record<string, unknown>>(results, '/ai-governance/workspace');
  const modelRegistry = feedData<Record<string, unknown>>(results, '/ai-governance/model-registry');
  const modelCardsFeed = feedData<Record<string, unknown>>(results, '/ai-governance/model-cards');
  const promptCardsFeed = feedData<Record<string, unknown>>(results, '/ai-governance/prompt-cards');
  const aiGovernanceKpiPack = feedData<Record<string, unknown>>(results, '/ai-governance/kpi-pack');

  const protectedActions = Array.isArray(policy?.protectedActions) ? policy.protectedActions as string[] : [];
  const modelRegistryItems = extractArray<Record<string, unknown>>(models, 'models');
  const modelCards = extractArray<Record<string, unknown>>(modelCardsFeed, 'modelCards');
  const promptCards = extractArray<Record<string, unknown>>(promptCardsFeed, 'promptCards');
  const registryPromptCards = extractArray<Record<string, unknown>>(modelRegistry, 'promptCards');
  const registryModelCards = extractArray<Record<string, unknown>>(modelRegistry, 'modelCards');
  const governedModelCards = modelCards.length ? modelCards : registryModelCards;
  const governedPromptCards = promptCards.length ? promptCards : registryPromptCards;
  const kpiPackMetrics = extractArray<Record<string, unknown>>(aiGovernanceKpiPack, 'kpis');
  const blockedActions = extractArray<Record<string, unknown>>(blocked, 'items');
  const blockedFromWorkspace = extractArray<Record<string, unknown>>(workspace, 'blockedActions');
  const recommendationQueue = extractArray<Record<string, unknown>>(governance, 'recommendationQueue');
  const safetyBlockedActions = extractArray<Record<string, unknown>>(governance, 'safetyBlockedActions');
  const approvalRequirements = extractArray<Record<string, unknown>>(governance, 'approvalRequirements');
  const humanInLoopWorkflows = extractArray<Record<string, unknown>>(governance, 'humanInLoopWorkflows');
  const reviewCandidates = [...recommendationQueue, ...safetyBlockedActions];

  const canRegister = canRegisterGovernanceArtifacts(session.role);
  const registrationDisabledReason = canRegister
    ? undefined
    : `Requires one of: ${governanceRegistrationRoles.join(', ')}`;

  const registerModel = useMutation({
    mutationFn: (justification: string) =>
      registerModelCard({
        id: 'weather-advisor-v1',
        name: 'Weather Advisor',
        version: '1.0.0',
        riskLevel: 'medium',
        path: 'ai/model-cards/weather-advisor-v1.md',
        reason: justification,
      }),
    onSuccess: (response) => {
      setRegisterMessage(response.message ?? 'Model card registered.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  const registerPrompt = useMutation({
    mutationFn: (justification: string) =>
      registerPromptCard({
        id: 'surface-intervention-v5',
        name: 'Surface Intervention',
        version: '5.0.0',
        path: 'ai/prompt-cards/surface-intervention-v5.md',
        lineage: ['surface-intervention-v4', 'surface-advisor-v2'],
        reason: justification,
      }),
    onSuccess: (response) => {
      setRegisterMessage(response.message ?? 'Prompt card registered.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  const draftLineage = useMutation({
    mutationFn: (justification: string) =>
      draftPromptLineage({
        id: 'surface-intervention-v6',
        name: 'Surface Intervention',
        version: '6.0.0',
        path: 'ai/prompt-cards/surface-intervention-v6.md',
        lineage: ['surface-intervention-v5', 'surface-advisor-v2'],
        reason: justification,
      }),
    onSuccess: (response) => {
      setLineageDraftId(response.draftId ?? null);
      setRegisterMessage(response.message ?? 'Prompt lineage draft created.');
    },
  });

  const publishLineage = useMutation({
    mutationFn: (draftId: string) => publishPromptLineage(draftId),
    onSuccess: (response) => {
      setLineageDraftId(null);
      setRegisterMessage(response.message ?? 'Prompt lineage published.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          {
            id: 'model-cards',
            label: 'Model cards',
            value: String(aiGovernanceKpiPack?.modelCardCount ?? governedModelCards.length),
            detail: aiGovernanceKpiPack?.kpiPackId ? String(aiGovernanceKpiPack.kpiPackId) : undefined,
          },
          {
            id: 'prompt-cards',
            label: 'Prompt cards',
            value: String(aiGovernanceKpiPack?.promptCardCount ?? governedPromptCards.length),
            detail: aiGovernanceKpiPack?.lineageCoveragePercent != null
              ? `${aiGovernanceKpiPack.lineageCoveragePercent}% lineage`
              : undefined,
          },
          {
            id: 'moe-domains',
            label: 'MoE domains',
            value: String(aiGovernanceKpiPack?.moeRoutingDomains ?? '—'),
          },
          {
            id: 'registry-completeness',
            label: 'Registry completeness',
            value: aiGovernanceKpiPack?.recommendationRegistryCompleteness != null
              ? `${aiGovernanceKpiPack.recommendationRegistryCompleteness}%`
              : '—',
            status: Number(aiGovernanceKpiPack?.recommendationRegistryCompleteness ?? 0) >= 95 ? 'nominal' : 'warning',
          },
          { id: 'protected', label: 'Protected actions', value: String(protectedActions.length) },
          { id: 'queue', label: 'Review queue', value: String(reviewCandidates.length) },
        ]}
      />
      {kpiPackMetrics.length > 0 ? (
        <SectionPanel
          title="AI governance KPI pack"
          description="Coverage metrics from model cards, prompt lineage, and MoE routing derived from the responsible AI governor registry."
        >
          <RecordTable
            columns={[
              { key: 'label', label: 'KPI' },
              { key: 'value', label: 'Value' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(kpiPackMetrics, (kpi) => ({
              label: String(kpi.label ?? kpi.kpiId ?? '—'),
              value: kpi.value != null ? `${kpi.value}${kpi.unit ? ` ${kpi.unit}` : ''}` : '—',
              status: String(kpi.status ?? '—'),
            }))}
          />
        </SectionPanel>
      ) : null}
      <SectionPanel title="Human-approval-required actions" description="Policy guardrails from the AI control plane.">
        <RecordTable
          columns={[{ key: 'action', label: 'Protected action' }]}
          rows={protectedActions.slice(0, 12).map((action) => ({ action: String(action) }))}
          emptyLabel="No protected actions listed in policy."
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Model card registry" description="Governed model cards from GET /ai-governance/model-cards with responsibleAiGovernor workspace paths.">
          <RecordTable
            columns={[
              { key: 'model', label: 'Model' },
              { key: 'version', label: 'Version' },
              { key: 'risk', label: 'Risk' },
              { key: 'path', label: 'Workspace path' },
              { key: 'evaluated', label: 'Last evaluated' },
            ]}
            rows={mapRecords(governedModelCards.length ? governedModelCards : modelRegistryItems, (m) => ({
              model: String(m.name ?? m.modelId ?? '—'),
              version: String(m.version ?? '—'),
              risk: String(m.riskLevel ?? '—'),
              path: String(m.path ?? '—'),
              evaluated: m.lastEvaluatedAt ? new Date(String(m.lastEvaluatedAt)).toLocaleDateString() : '—',
            }))}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="governance"
              disabled={!canRegister || registerModel.isPending}
              title={registrationDisabledReason}
              onClick={() => {
                setRegisterMessage(null);
                setModelDialogOpen(true);
              }}
            >
              Register model card
            </Button>
          </div>
        </SectionPanel>
        <SectionPanel
          title="Prompt card lineage"
          description="Prompt templates from GET /ai-governance/prompt-cards with explicit lineage to prior versions and model cards."
        >
          <RecordTable
            columns={[
              { key: 'prompt', label: 'Prompt' },
              { key: 'version', label: 'Version' },
              { key: 'path', label: 'Workspace path' },
              { key: 'lineage', label: 'Lineage' },
            ]}
            rows={mapRecords(governedPromptCards, (p) => ({
              prompt: String(p.name ?? p.id ?? '—'),
              version: String(p.version ?? '—'),
              path: String(p.path ?? '—'),
              lineage: Array.isArray(p.lineage) ? p.lineage.join(' → ') : '—',
            }))}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="governance"
              disabled={!canRegister || registerPrompt.isPending}
              title={registrationDisabledReason}
              onClick={() => {
                setRegisterMessage(null);
                setPromptDialogOpen(true);
              }}
            >
              Register prompt card
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canRegister || draftLineage.isPending}
              title={registrationDisabledReason}
              onClick={() => {
                setRegisterMessage(null);
                setLineageDraftDialogOpen(true);
              }}
            >
              Draft prompt lineage
            </Button>
            <Button
              size="sm"
              variant="governance"
              disabled={!canRegister || !lineageDraftId || publishLineage.isPending}
              title={lineageDraftId ? undefined : 'Create a prompt lineage draft first'}
              onClick={() => {
                if (!lineageDraftId) return;
                publishLineage.mutate(lineageDraftId);
              }}
            >
              Publish lineage draft
            </Button>
            {lineageDraftId ? (
              <p className="text-xs text-[var(--muted-foreground)]">Pending draft: {lineageDraftId}</p>
            ) : null}
            {registerMessage ? <p className="text-xs text-[var(--muted-foreground)]">{registerMessage}</p> : null}
          </div>
        </SectionPanel>
      </div>
      <SectionPanel title="Blocked autonomous actions">
        <RecordTable
          columns={[
            { key: 'action', label: 'Action' },
            { key: 'reason', label: 'Reason' },
          ]}
          rows={mapRecords([...blockedActions, ...blockedFromWorkspace], (b) => ({
            action: String(b.action ?? b.id ?? '—'),
            reason: String(b.reason ?? b.blockedReason ?? '—'),
          }))}
        />
      </SectionPanel>
      <SectionPanel
        title="Recommendation review queue"
        description="Advisory-only AI recommendations from the responsible AI governor workspace. Approve and reject are approval-gated and never execute protected actions autonomously."
      >
        {reviewCandidates.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No recommendations awaiting review.</p>
        ) : (
          <div className="space-y-3">
            {reviewCandidates.slice(0, 12).map((rec) => {
              const id = String(rec.id ?? rec.recommendationId ?? '');
              const status = String(rec.status ?? 'pending');
              const approvalRequestId = resolveApprovalRequestId(rec, approvalRequirements, humanInLoopWorkflows);
              const pendingReview = status.toLowerCase().includes('pending')
                || status.toLowerCase().includes('approval')
                || status.toLowerCase().includes('blocked');
              const advisoryOnly = rec.advisoryOnly !== false && rec.executionAllowed !== true;
              return (
                <div key={id} className="rounded-md border border-[var(--border)] p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{String(rec.recommendation ?? rec.title ?? rec.summary ?? id)}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {status} · confidence {formatRecommendationConfidence(rec)}
                        {rec.target ? ` · ${String(rec.target)}` : ''}
                        {advisoryOnly ? ' · advisory-only' : ''}
                      </p>
                      {isRecord(rec.approvalRequirement) && rec.approvalRequirement.required ? (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Approval required
                          {Array.isArray(rec.approvalRequirement.requiredApproverRoles) && rec.approvalRequirement.requiredApproverRoles.length
                            ? ` · roles: ${rec.approvalRequirement.requiredApproverRoles.join(', ')}`
                            : ''}
                        </p>
                      ) : null}
                      {!approvalRequestId ? (
                        <p className="text-xs text-[var(--muted-foreground)]">Approval token pending — review actions disabled.</p>
                      ) : null}
                    </div>
                    {pendingReview && approvalRequestId ? (
                      <ApprovalDecisionButtons approvalId={approvalRequestId} />
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" disabled title="Approval request token required">Approve</Button>
                        <Button size="sm" variant="governance" disabled title="Approval request token required">Reject</Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionPanel>
      <RegistryRegistrationDialog
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
        title="Register governed model card"
        description="POST /ai-governance/model-registry/models with evaluation metadata. Registration emits an immutable audit event."
        submitLabel="Register model"
        disabled={!canRegister}
        disabledReason={registrationDisabledReason}
        onSubmit={async (justification) => registerModel.mutateAsync(justification)}
      />
      <RegistryRegistrationDialog
        open={promptDialogOpen}
        onOpenChange={setPromptDialogOpen}
        title="Register governed prompt card"
        description="POST /ai-governance/model-registry/prompts with explicit lineage references. Registration emits an immutable audit event."
        submitLabel="Register prompt"
        disabled={!canRegister}
        disabledReason={registrationDisabledReason}
        onSubmit={async (justification) => registerPrompt.mutateAsync(justification)}
      />
      <RegistryRegistrationDialog
        open={lineageDraftDialogOpen}
        onOpenChange={setLineageDraftDialogOpen}
        title="Draft prompt lineage"
        description="POST /ai-governance/prompt-lineage/drafts records lineage metadata only. Publish the draft after review to activate the registry card."
        submitLabel="Create draft"
        disabled={!canRegister}
        disabledReason={registrationDisabledReason}
        onSubmit={async (justification) => draftLineage.mutateAsync(justification)}
      />
    </div>
  );
}
