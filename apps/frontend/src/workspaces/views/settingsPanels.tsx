import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';
import { registerPromptCard } from '@/api/mutations';

export function SettingsPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const queryClient = useQueryClient();
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const policy = feedData<Record<string, unknown>>(results, '/ai-control-plane/policy');
  const models = feedData<Record<string, unknown>>(results, '/ai-control-plane/models');
  const blocked = feedData<Record<string, unknown>>(results, '/ai-control-plane/blocked-actions');
  const workspace = feedData<Record<string, unknown>>(results, '/ai-control-plane/workspace');
  const governance = feedData<Record<string, unknown>>(results, '/ai-governance/workspace');
  const modelRegistry = feedData<Record<string, unknown>>(results, '/ai-governance/model-registry');

  const protectedActions = Array.isArray(policy?.protectedActions) ? policy.protectedActions as string[] : [];
  const modelRegistryItems = extractArray<Record<string, unknown>>(models, 'models');
  const promptCards = extractArray<Record<string, unknown>>(modelRegistry, 'promptCards');
  const registryModelCards = extractArray<Record<string, unknown>>(modelRegistry, 'modelCards');
  const blockedActions = extractArray<Record<string, unknown>>(blocked, 'items');
  const blockedFromWorkspace = extractArray<Record<string, unknown>>(workspace, 'blockedActions');
  const recommendationQueue = extractArray<Record<string, unknown>>(governance, 'recommendationQueue');

  const registerPrompt = useMutation({
    mutationFn: () =>
      registerPromptCard({
        id: 'surface-intervention-v5',
        name: 'Surface Intervention',
        version: '5.0.0',
        path: 'ai/prompt-cards/surface-intervention-v5.md',
        lineage: ['surface-intervention-v4', 'surface-advisor-v2'],
      }),
    onSuccess: (response) => {
      setRegisterMessage(
        typeof response === 'object' && response && 'message' in response
          ? String((response as { message?: string }).message)
          : 'Prompt card registered.',
      );
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => setRegisterMessage(error.message),
  });

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'protected', label: 'Protected actions', value: String(protectedActions.length) },
          { id: 'models', label: 'Models', value: String(registryModelCards.length || modelRegistryItems.length) },
          { id: 'prompts', label: 'Prompt cards', value: String(promptCards.length) },
          { id: 'blocked', label: 'Blocked actions', value: String(blockedActions.length + blockedFromWorkspace.length) },
          { id: 'queue', label: 'Review queue', value: String(recommendationQueue.length) },
        ]}
      />
      <SectionPanel title="Human-approval-required actions" description="Policy guardrails from the AI control plane.">
        <RecordTable
          columns={[{ key: 'action', label: 'Protected action' }]}
          rows={protectedActions.slice(0, 12).map((action) => ({ action: String(action) }))}
          emptyLabel="No protected actions listed in policy."
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Model card registry" description="Governed model cards with evaluation metadata.">
          <RecordTable
            columns={[
              { key: 'model', label: 'Model' },
              { key: 'version', label: 'Version' },
              { key: 'risk', label: 'Risk' },
              { key: 'evaluated', label: 'Last evaluated' },
            ]}
            rows={mapRecords(registryModelCards.length ? registryModelCards : modelRegistryItems, (m) => ({
              model: String(m.name ?? m.modelId ?? '—'),
              version: String(m.version ?? '—'),
              risk: String(m.riskLevel ?? '—'),
              evaluated: m.lastEvaluatedAt ? new Date(String(m.lastEvaluatedAt)).toLocaleDateString() : '—',
            }))}
          />
        </SectionPanel>
        <SectionPanel
          title="Prompt card lineage"
          description="Prompt templates with explicit lineage to prior versions and model cards."
        >
          <RecordTable
            columns={[
              { key: 'prompt', label: 'Prompt' },
              { key: 'version', label: 'Version' },
              { key: 'lineage', label: 'Lineage' },
            ]}
            rows={mapRecords(promptCards, (p) => ({
              prompt: String(p.name ?? p.id ?? '—'),
              version: String(p.version ?? '—'),
              lineage: Array.isArray(p.lineage) ? p.lineage.join(' → ') : '—',
            }))}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="governance"
              disabled={registerPrompt.isPending}
              onClick={() => {
                setRegisterMessage(null);
                registerPrompt.mutate();
              }}
            >
              Register prompt lineage draft
            </Button>
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
      <SectionPanel title="Recommendation review queue">
        <RecordTable
          columns={[
            { key: 'title', label: 'Recommendation' },
            { key: 'confidence', label: 'Confidence' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(recommendationQueue, (r) => ({
            title: String(r.title ?? r.summary ?? r.id ?? '—'),
            confidence: r.confidence != null ? String(r.confidence) : '—',
            status: String(r.status ?? '—'),
          }))}
        />
      </SectionPanel>
    </div>
  );
}
