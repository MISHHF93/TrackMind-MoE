import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

export function SettingsPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const policy = feedData<Record<string, unknown>>(results, '/ai-control-plane/policy');
  const models = feedData<Record<string, unknown>>(results, '/ai-control-plane/models');
  const blocked = feedData<Record<string, unknown>>(results, '/ai-control-plane/blocked-actions');
  const workspace = feedData<Record<string, unknown>>(results, '/ai-control-plane/workspace');
  const governance = feedData<Record<string, unknown>>(results, '/ai-governance/workspace');

  const protectedActions = Array.isArray(policy?.protectedActions) ? policy.protectedActions as string[] : [];
  const modelRegistry = extractArray<Record<string, unknown>>(models, 'models');
  const blockedActions = extractArray<Record<string, unknown>>(blocked, 'items');
  const blockedFromWorkspace = extractArray<Record<string, unknown>>(workspace, 'blockedActions');
  const recommendationQueue = extractArray<Record<string, unknown>>(governance, 'recommendationQueue');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'protected', label: 'Protected actions', value: String(protectedActions.length) },
          { id: 'models', label: 'Models', value: String(modelRegistry.length) },
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
        <SectionPanel title="Model registry">
          <RecordTable
            columns={[
              { key: 'model', label: 'Model' },
              { key: 'version', label: 'Version' },
              { key: 'risk', label: 'Risk' },
            ]}
            rows={mapRecords(modelRegistry, (m) => ({
              model: String(m.name ?? m.modelId ?? '—'),
              version: String(m.version ?? '—'),
              risk: String(m.riskLevel ?? '—'),
            }))}
          />
        </SectionPanel>
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
      </div>
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
