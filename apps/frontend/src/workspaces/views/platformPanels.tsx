import type { ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { KpiMutationDraftResultDto, Role } from '@trackmind/shared';
import {
  authorizeApprovalExecution,
  requestKpiThresholdDraft,
  type ApprovalTokenPayload,
} from '@/api/mutations';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { actionDisabledReason, roleCanUseAction } from '@/domain/approvalControls';
import { Button } from '@/design/components/button';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { ApprovalDecisionButtons } from '@/features/approvals/GovernedActionDialog';
import { useAnalyticsStream } from '@/hooks/useAnalyticsStream';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

const kpiAdminRoles: Role[] = ['admin', 'operations-admin'];

function thresholdChangeRequiresApproval(sensitivity: unknown): boolean {
  const value = String(sensitivity ?? '');
  return value === 'approval-required-for-threshold-change'
    || value === 'regulated-advisory-only'
    || value === 'approval-visible';
}

function KpiAdminPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const registryFeed = feedData<Record<string, unknown>>(results, '/kpis/registry');
  const definitionsFeed = feedData<Record<string, unknown>>(results, '/kpis/definitions');
  const thresholdsFeed = feedData<Record<string, unknown>>(results, '/kpis/thresholds');
  const registryEntries = extractArray<Record<string, unknown>>(registryFeed, 'entries');
  const definitions = extractArray<Record<string, unknown>>(definitionsFeed, 'definitions');
  const thresholds = extractArray<Record<string, unknown>>(thresholdsFeed, 'thresholds');
  const activeThresholds = thresholds.filter((record) => record.status === 'active');
  const pendingThresholds = thresholds.filter((record) => record.status === 'pending-approval');

  const [selectedKpiId, setSelectedKpiId] = useState(
    registryEntries.length ? String(registryEntries[0].kpiId ?? '') : '',
  );
  const [warning, setWarning] = useState('');
  const [critical, setCritical] = useState('');
  const [targetDirection, setTargetDirection] = useState<'above' | 'below' | 'within-band'>('above');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [draftOutcome, setDraftOutcome] = useState<KpiMutationDraftResultDto | null>(null);
  const [authorizationMessage, setAuthorizationMessage] = useState<string | null>(null);
  const [focusedApprovalId, setFocusedApprovalId] = useState('');

  const thresholdDraftAction = {
    id: 'kpi-threshold-draft',
    label: 'Submit threshold draft',
    protectedAction: 'kpi-threshold-change',
    target: selectedKpiId,
    requiredRoles: kpiAdminRoles,
  };
  const thresholdReviewAction = {
    id: 'kpi-threshold-approval',
    label: 'Review threshold change',
    protectedAction: 'kpi-threshold-change',
    target: selectedKpiId,
    requiredRoles: kpiAdminRoles,
  };
  const canSubmitThreshold = roleCanUseAction(thresholdDraftAction, session.role);
  const submitDisabledReason = actionDisabledReason(thresholdDraftAction, session.role);
  const canReviewThreshold = roleCanUseAction(thresholdReviewAction, session.role);
  const reviewDisabledReason = actionDisabledReason(thresholdReviewAction, session.role);

  const selectedRegistryEntry = useMemo(
    () => registryEntries.find((entry) => String(entry.kpiId ?? '') === selectedKpiId),
    [registryEntries, selectedKpiId],
  );
  const selectedDefinition = useMemo(
    () => definitions.find((definition) => String(definition.kpiId ?? '') === selectedKpiId),
    [definitions, selectedKpiId],
  );
  const selectedApprovalSensitivity = selectedDefinition?.approvalSensitivity
    ?? selectedRegistryEntry?.approvalSensitivity;
  const selectedRequiresApproval = thresholdChangeRequiresApproval(selectedApprovalSensitivity);

  const submitThresholdDraft = useMutation({
    mutationFn: () =>
      requestKpiThresholdDraft({
        kpiId: selectedKpiId,
        warning: warning.trim() ? Number(warning) : undefined,
        critical: critical.trim() ? Number(critical) : undefined,
        targetDirection,
        description: description.trim() || 'Threshold change from KPI admin console',
        reason: reason.trim() || 'KPI threshold change requested from analytics workspace',
      }),
    onSuccess: (response) => {
      setDraftOutcome(response);
      setReason('');
      setAuthorizationMessage(null);
      if (response.approvalId) setFocusedApprovalId(response.approvalId);
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: () => setDraftOutcome(null),
  });

  const authorizeThresholdMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      const authorized = await authorizeApprovalExecution(approvalId);
      const token = authorized.approvalToken;
      if (!token) throw new Error('Approval token was not issued. Complete KPI admin approval first.');
      return token as ApprovalTokenPayload;
    },
    onSuccess: (token) => {
      setAuthorizationMessage(
        `Authorization verified for ${token.action} on ${token.target}. Token issued to ${session.role}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => setAuthorizationMessage(error.message),
  });

  const pendingApprovalIds = useMemo(
    () => pendingThresholds
      .map((record) => String(record.approvalId ?? ''))
      .filter(Boolean),
    [pendingThresholds],
  );
  const activeApprovalId = focusedApprovalId || pendingApprovalIds[0] || draftOutcome?.approvalId || '';

  const pendingCount = pendingThresholds.length;
  const approvalRequiredCount = registryEntries.filter(
    (entry) => entry.thresholdStatus === 'pending-approval',
  ).length;

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'registry', label: 'Registry KPIs', value: String(registryEntries.length) },
          { id: 'definitions', label: 'Definitions', value: String(definitions.length) },
          {
            id: 'pending',
            label: 'Pending thresholds',
            value: String(pendingCount),
            status: pendingCount > 0 ? 'warning' : 'nominal',
            detail: approvalRequiredCount > 0 ? `${approvalRequiredCount} awaiting approval` : undefined,
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel
          title="KPI registry"
          description="Ownership, visibility, and threshold status for governed KPI artifacts."
        >
          <RecordTable
            columns={[
              { key: 'name', label: 'KPI' },
              { key: 'owner', label: 'Owner' },
              { key: 'thresholdStatus', label: 'Threshold' },
            ]}
            rows={mapRecords(registryEntries, (entry) => ({
              name: String(entry.name ?? entry.kpiId ?? '—'),
              owner: String(entry.ownerRole ?? '—'),
              thresholdStatus: String(entry.thresholdStatus ?? '—'),
            }))}
            emptyLabel="No KPI registry entries."
          />
        </SectionPanel>
        <SectionPanel
          title="KPI definitions"
          description="Governed definition metadata for admin review. Definitions are read-only until published."
        >
          <RecordTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'domain', label: 'Domain' },
              { key: 'sensitivity', label: 'Approval sensitivity' },
            ]}
            rows={mapRecords(definitions, (definition) => ({
              name: String(definition.name ?? definition.kpiId ?? '—'),
              domain: String(definition.domain ?? '—'),
              sensitivity: String(definition.approvalSensitivity ?? '—'),
            }))}
            emptyLabel="No KPI definitions."
          />
        </SectionPanel>
      </div>
      <SectionPanel
        title="Active thresholds"
        description="Currently effective warning and critical bands per KPI."
      >
        <RecordTable
          columns={[
            { key: 'kpi', label: 'KPI' },
            { key: 'warning', label: 'Warning' },
            { key: 'critical', label: 'Critical' },
            { key: 'direction', label: 'Direction' },
          ]}
          rows={mapRecords(activeThresholds, (record) => ({
            kpi: String(record.kpiId ?? '—'),
            warning: record.warning != null ? String(record.warning) : '—',
            critical: record.critical != null ? String(record.critical) : '—',
            direction: String(record.targetDirection ?? '—'),
          }))}
          emptyLabel="No active thresholds."
        />
      </SectionPanel>
      <SectionPanel
        title="Pending threshold changes"
        description="Read-only view of threshold drafts awaiting human approval. Active thresholds remain unchanged until approval is recorded."
      >
        <RecordTable
          columns={[
            { key: 'kpi', label: 'KPI' },
            { key: 'warning', label: 'Warning' },
            { key: 'critical', label: 'Critical' },
            { key: 'approval', label: 'Approval ID' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(pendingThresholds, (record) => ({
            kpi: String(record.kpiId ?? '—'),
            warning: record.warning != null ? String(record.warning) : '—',
            critical: record.critical != null ? String(record.critical) : '—',
            approval: String(record.approvalId ?? '—'),
            status: 'pending-approval',
          }))}
          emptyLabel="No pending threshold changes."
        />
        {pendingApprovalIds.length > 0 ? (
          <div className="mt-4 space-y-3 rounded-md border border-[var(--border)] p-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              KPI threshold changes require approval from admin or operations-admin before activation.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted-foreground)]">Approval request</span>
              <select
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={activeApprovalId}
                onChange={(event) => {
                  setFocusedApprovalId(event.target.value);
                  setAuthorizationMessage(null);
                }}
              >
                {pendingApprovalIds.map((approvalId) => (
                  <option key={approvalId} value={approvalId}>
                    {approvalId}
                  </option>
                ))}
              </select>
            </label>
            {canReviewThreshold && activeApprovalId ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <ApprovalDecisionButtons approvalId={activeApprovalId} />
                <Button
                  size="sm"
                  variant="governance"
                  disabled={authorizeThresholdMutation.isPending}
                  onClick={() => authorizeThresholdMutation.mutate(activeApprovalId)}
                >
                  Verify authorization token
                </Button>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                {reviewDisabledReason ?? 'Select a pending approval request to review.'}
              </p>
            )}
            {authorizationMessage ? (
              <p className="text-xs text-[var(--muted-foreground)]">{authorizationMessage}</p>
            ) : null}
          </div>
        ) : null}
      </SectionPanel>
      <SectionPanel
        title="Request threshold change"
        description="Submit a governed threshold draft. Sensitive KPIs require approval before the new band becomes active."
      >
        {selectedRequiresApproval ? (
          <p
            className="mb-3 rounded-md border border-[var(--warning-border,var(--border))] bg-[var(--warning-muted,var(--muted))] px-3 py-2 text-sm text-[var(--foreground)]"
            role="status"
          >
            Human approval required — this KPI has approval sensitivity{' '}
            <span className="font-medium">{String(selectedApprovalSensitivity)}</span>. The draft will remain
            pending until an approver records a decision; active thresholds stay unchanged until then.
          </p>
        ) : (
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            This KPI has no threshold-change approval gate. Drafts may activate immediately when policy allows.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted-foreground)]">KPI</span>
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              value={selectedKpiId}
              onChange={(event) => setSelectedKpiId(event.target.value)}
            >
              {registryEntries.map((entry) => {
                const kpiId = String(entry.kpiId ?? '');
                return (
                  <option key={kpiId} value={kpiId}>
                    {String(entry.name ?? kpiId)}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted-foreground)]">Target direction</span>
            <select
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              value={targetDirection}
              onChange={(event) => setTargetDirection(event.target.value as 'above' | 'below' | 'within-band')}
            >
              <option value="above">above</option>
              <option value="below">below</option>
              <option value="within-band">within-band</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted-foreground)]">Warning</span>
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              type="number"
              value={warning}
              onChange={(event) => setWarning(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted-foreground)]">Critical</span>
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              type="number"
              value={critical}
              onChange={(event) => setCritical(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-[var(--muted-foreground)]">Description</span>
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description of the proposed threshold band"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-[var(--muted-foreground)]">Reason</span>
            <input
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Operational justification for the change"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="governance"
            disabled={!selectedKpiId || !canSubmitThreshold || submitThresholdDraft.isPending}
            onClick={() => {
              setDraftOutcome(null);
              setAuthorizationMessage(null);
              submitThresholdDraft.mutate();
            }}
          >
            Submit threshold draft
          </Button>
          {submitDisabledReason ? (
            <p className="text-xs text-[var(--muted-foreground)]">{submitDisabledReason}</p>
          ) : null}
          {submitThresholdDraft.isError ? (
            <p className="text-xs text-[var(--destructive,var(--muted-foreground))]">
              {submitThresholdDraft.error.message}
            </p>
          ) : null}
          {draftOutcome ? (
            <div className="w-full space-y-2 text-xs text-[var(--muted-foreground)]">
              <p>{draftOutcome.message}</p>
              {draftOutcome.approvalRequired ? (
                <>
                  <p className="font-medium text-[var(--foreground)]">
                    Approval required
                    {draftOutcome.approvalId ? ` — request ${draftOutcome.approvalId}` : ''}. Review pending
                    changes in the table above or the Approvals console.
                  </p>
                  {draftOutcome.approvalId && canReviewThreshold ? (
                    <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-[var(--border)] p-3">
                      <ApprovalDecisionButtons approvalId={draftOutcome.approvalId} />
                      <Button
                        size="sm"
                        variant="governance"
                        disabled={authorizeThresholdMutation.isPending}
                        onClick={() => authorizeThresholdMutation.mutate(draftOutcome.approvalId!)}
                      >
                        Verify authorization token
                      </Button>
                    </div>
                  ) : draftOutcome.approvalId ? (
                    <p>{reviewDisabledReason}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1">No approval gate applied — threshold draft recorded per policy.</p>
              )}
            </div>
          ) : null}
        </div>
      </SectionPanel>
    </div>
  );
}

export function AnalyticsPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const workspaceFeed = feedData<Record<string, unknown>>(results, '/analytics/workspace');
  const {
    workspace: streamedWorkspace,
    status: analyticsStreamStatus,
    revision: analyticsRevision,
  } = useAnalyticsStream();
  const workspace = streamedWorkspace ?? workspaceFeed;
  const knowledgeGraph = feedData<Record<string, unknown>>(results, '/knowledge-graph/workspace');
  const reporting = feedData<Record<string, unknown>>(results, '/reporting/workspace');
  const searchFeed = feedData<Record<string, unknown>>(results, '/search/global');
  const federationAggregation = feedData<unknown>(results, '/federation/kpi-aggregation');
  const summary = extractArray<Record<string, unknown>>(workspace, 'executiveSummary');
  const trends = extractArray<Record<string, unknown>>(workspace, 'kpiTrends');
  const benchmarks = extractArray<Record<string, unknown>>(workspace, 'federationBenchmarks');
  const forecasting = workspace?.forecastingReadiness as Record<string, unknown> | undefined;
  const graphNodes = extractArray<Record<string, unknown>>(knowledgeGraph, 'nodes');
  const reportTemplates = extractArray<Record<string, unknown>>(reporting, 'templates');
  const reportJobs = extractArray<Record<string, unknown>>(reporting, 'recentJobs');
  const searchResults = extractArray<Record<string, unknown>>(searchFeed, 'results');
  const federationMetrics = Array.isArray(federationAggregation)
    ? federationAggregation as Record<string, unknown>[]
    : extractArray<Record<string, unknown>>(federationAggregation, 'metrics');

  const trendDirection = (points: Record<string, unknown>[]) => {
    if (points.length < 2) return 'flat';
    const first = Number(points[0]?.value);
    const last = Number(points[points.length - 1]?.value);
    if (!Number.isFinite(first) || !Number.isFinite(last)) return 'flat';
    if (last > first) return 'up';
    if (last < first) return 'down';
    return 'flat';
  };

  return (
    <div className="space-y-4">
      <KpiStrip
        items={summary.slice(0, 4).map((item, index) => ({
          id: String(item.label ?? index),
          label: String(item.label ?? 'Metric'),
          value: String(item.value ?? '—'),
          detail: item.unit ? String(item.unit) : String(item.trend ?? ''),
          status: 'nominal',
        }))}
      />
      <SectionPanel title="Forecasting readiness" description={`SSE /analytics/workspace/stream (${analyticsStreamStatus}${analyticsRevision != null ? `, rev ${analyticsRevision}` : ''}). Model availability and data quality for predictive analytics.`}>
        <RecordTable
          columns={[
            { key: 'metric', label: 'Metric' },
            { key: 'value', label: 'Value' },
          ]}
          rows={[
            { metric: 'Readiness score', value: forecasting?.score != null ? String(forecasting.score) : '—' },
            { metric: 'Data quality score', value: forecasting?.dataQualityScore != null ? String(forecasting.dataQualityScore) : '—' },
            {
              metric: 'Models available',
              value: extractArray<string>(forecasting, 'modelsAvailable').length
                ? extractArray<string>(forecasting, 'modelsAvailable').join(', ')
                : '—',
            },
          ]}
        />
      </SectionPanel>
      <SectionPanel title="Global search index" description="Cross-domain search results for operational artifacts.">
        <RecordTable
          columns={[
            { key: 'kind', label: 'Kind' },
            { key: 'title', label: 'Title' },
            { key: 'path', label: 'Path' },
            { key: 'score', label: 'Score' },
          ]}
          rows={mapRecords(searchResults, (r) => ({
            kind: String(r.kind ?? '—'),
            title: String(r.title ?? '—'),
            path: String(r.path ?? '—'),
            score: r.score != null ? String(r.score) : '—',
          }))}
          emptyLabel="Run a search from the command palette to populate results."
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Knowledge graph" description="Linked entities across racing domains.">
          <RecordTable
            columns={[
              { key: 'node', label: 'Node' },
              { key: 'type', label: 'Type' },
              { key: 'links', label: 'Links' },
            ]}
            rows={mapRecords(graphNodes, (n) => ({
              node: String(n.label ?? n.id ?? '—'),
              type: String(n.type ?? n.kind ?? '—'),
              links: String(extractArray(n, 'edges').length || (n.linkCount ?? '—')),
            }))}
            emptyLabel="No knowledge graph nodes."
          />
        </SectionPanel>
        <SectionPanel title="Reporting workspace" description="Templates and recent report generation jobs.">
          <RecordTable
            columns={[
              { key: 'name', label: 'Template / job' },
              { key: 'status', label: 'Status' },
              { key: 'format', label: 'Format' },
            ]}
            rows={[
              ...mapRecords(reportTemplates, (t) => ({
                name: String(t.name ?? t.templateId ?? '—'),
                status: 'template',
                format: String(t.format ?? '—'),
              })),
              ...mapRecords(reportJobs, (j) => ({
                name: String(j.name ?? j.jobId ?? '—'),
                status: String(j.status ?? '—'),
                format: String(j.format ?? '—'),
              })),
            ]}
            emptyLabel="No reporting templates or jobs."
          />
        </SectionPanel>
      </div>
      <SectionPanel title="KPI trends" description={`Live dashboard from analytics workspace stream${analyticsStreamStatus === 'connecting' ? ' — connecting…' : ''}.`}>
        <RecordTable
          columns={[
            { key: 'kpi', label: 'KPI' },
            { key: 'latest', label: 'Latest' },
            { key: 'trend', label: 'Trend' },
            { key: 'points', label: 'Snapshots' },
          ]}
          rows={mapRecords(trends, (t) => {
            const points = extractArray<Record<string, unknown>>(t, 'points');
            const latest = points.length ? points[points.length - 1] : undefined;
            return {
              kpi: String(t.label ?? t.kpiId ?? '—'),
              latest: latest?.value != null ? String(latest.value) : '—',
              trend: trendDirection(points),
              points: String(points.length),
            };
          })}
        />
      </SectionPanel>
      <KpiAdminPanels results={results} />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Federation benchmarks" description="Anonymous cross-track benchmarking from analytics workspace.">
          <RecordTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'track', label: 'Track' },
              { key: 'median', label: 'Industry median' },
            ]}
            rows={mapRecords(benchmarks, (b) => ({
              metric: String(b.metric ?? '—'),
              track: String(b.trackValue ?? '—'),
              median: String(b.industryMedian ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Federation KPI aggregation" description="Aggregate benchmarks across federation tracks.">
          <RecordTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'aggregated', label: 'Aggregated value' },
              { key: 'tracks', label: 'Track count' },
            ]}
            rows={mapRecords(federationMetrics, (m) => ({
              metric: String(m.metric ?? '—'),
              aggregated: String(m.aggregatedValue ?? '—'),
              tracks: String(m.trackCount ?? '—'),
            }))}
            emptyLabel="No federation aggregation data."
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export function FanExperiencePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const workspace = feedData<Record<string, unknown>>(results, '/fan-experience/workspace');
  const guestServices = extractArray<Record<string, unknown>>(workspace, 'guestServices');
  const crowdDensity = extractArray<Record<string, unknown>>(workspace, 'crowdDensity');
  const attendance = (workspace?.attendance ?? {}) as Record<string, unknown>;
  const ticketInventory = (workspace?.ticketInventory ?? {}) as Record<string, unknown>;
  const fanAnalytics = (workspace?.fanAnalytics ?? {}) as Record<string, unknown>;
  const analyticsTrends = extractArray<Record<string, unknown>>(fanAnalytics, 'trends');
  const premiumSeating = extractArray<Record<string, unknown>>(workspace, 'premiumSeating');
  const dashboard = (workspace?.dashboard ?? {}) as Record<string, unknown>;
  const kpiPanels = extractArray<Record<string, unknown>>(dashboard, 'panels');
  const ticketingConnector = (workspace?.ticketingConnector ?? {}) as Record<string, unknown>;
  const connectorAdapters = extractArray<Record<string, unknown>>(ticketingConnector, 'adapters');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'attendance', label: 'Attendance', value: String(attendance.current ?? '—'), detail: `Capacity ${attendance.capacity ?? '—'}` },
          { id: 'utilization', label: 'Utilization', value: attendance.utilizationPercent != null ? `${attendance.utilizationPercent}%` : '—' },
          { id: 'inventory', label: 'Tickets sold', value: String(ticketInventory.sold ?? '—'), detail: `${ticketInventory.available ?? '—'} available` },
          { id: 'engagement', label: 'Engagement score', value: String(fanAnalytics.engagementScore ?? '—') },
          { id: 'connector', label: 'Ticketing connector', value: String(ticketingConnector.overallStatus ?? '—'), detail: ticketingConnector.degraded ? 'Degraded sync' : 'Live sync' },
        ]}
      />
      <SectionPanel
        title="Ticketing connector status"
        description="External ticketing integrations for inventory and gate attendance sync."
      >
        <RecordTable
          columns={[
            { key: 'adapter', label: 'Adapter' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'status', label: 'Status' },
            { key: 'source', label: 'Data source' },
          ]}
          rows={connectorAdapters.length > 0
            ? mapRecords(connectorAdapters, (adapter) => ({
                adapter: String(adapter.adapterId ?? '—'),
                vendor: String(adapter.vendor ?? '—'),
                status: String(adapter.status ?? '—'),
                source: ticketingConnector.degraded ? 'degraded-connector' : String(ticketingConnector.inventorySource ?? '—'),
              }))
            : [{
                adapter: '—',
                vendor: '—',
                status: String(ticketingConnector.overallStatus ?? 'disconnected'),
                source: String(ticketingConnector.inventorySource ?? 'platform'),
              }]}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Ticket inventory" description="General admission and held inventory from fan experience operations.">
          <RecordTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'count', label: 'Count' },
            ]}
            rows={[
              { metric: 'Available', count: String(ticketInventory.available ?? '—') },
              { metric: 'Sold', count: String(ticketInventory.sold ?? '—') },
              { metric: 'Held', count: String(ticketInventory.held ?? '—') },
            ]}
          />
        </SectionPanel>
        <SectionPanel title="Fan analytics" description="Engagement, wait time, and premium conversion trends.">
          <RecordTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'value', label: 'Value' },
              { key: 'trend', label: 'Trend' },
            ]}
            rows={[
              { metric: 'Engagement score', value: String(fanAnalytics.engagementScore ?? '—'), trend: '—' },
              { metric: 'Repeat visitor rate', value: fanAnalytics.repeatVisitorRate != null ? `${fanAnalytics.repeatVisitorRate}%` : '—', trend: '—' },
              { metric: 'Avg guest service wait', value: fanAnalytics.averageWaitMinutes != null ? `${fanAnalytics.averageWaitMinutes} min` : '—', trend: '—' },
              { metric: 'Premium conversion', value: fanAnalytics.premiumConversionRate != null ? `${fanAnalytics.premiumConversionRate}%` : '—', trend: '—' },
              ...mapRecords(analyticsTrends.slice(0, 3), (t) => ({
                metric: String(t.metric ?? '—'),
                value: '—',
                trend: String(t.trend ?? '—'),
              })),
            ]}
          />
        </SectionPanel>
      </div>
      {kpiPanels.length > 0 ? (
        <SectionPanel title="Fan experience KPIs" description="Live KPI panels from the fan experience dashboard read model.">
          <RecordTable
            columns={[
              { key: 'name', label: 'KPI' },
              { key: 'value', label: 'Value' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(kpiPanels, (panel) => ({
              name: String(panel.name ?? '—'),
              value: panel.value != null ? `${panel.value}${panel.unit ? ` ${panel.unit}` : ''}` : '—',
              status: String(panel.status ?? '—'),
            }))}
          />
        </SectionPanel>
      ) : null}
      <SectionPanel title="Guest services" description="Fan services queue and status.">
        <RecordTable
          columns={[
            { key: 'category', label: 'Category' },
            { key: 'status', label: 'Status' },
            { key: 'wait', label: 'Wait (min)' },
          ]}
          rows={mapRecords(guestServices, (g) => ({
            category: String(g.category ?? '—'),
            status: String(g.status ?? '—'),
            wait: String(g.waitMinutes ?? '—'),
          }))}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Crowd density" description="Zone-level crowd monitoring.">
          <RecordTable
            columns={[
              { key: 'zone', label: 'Zone' },
              { key: 'level', label: 'Level' },
            ]}
            rows={mapRecords(crowdDensity, (z) => ({
              zone: String(z.zone ?? '—'),
              level: String(z.level ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Premium seating" description="Premium inventory occupancy by section.">
          <RecordTable
            columns={[
              { key: 'section', label: 'Section' },
              { key: 'sold', label: 'Sold' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(premiumSeating, (section) => ({
              section: String(section.name ?? section.sectionId ?? '—'),
              sold: `${section.seatsSold ?? '—'}/${section.seatsTotal ?? '—'}`,
              status: String(section.status ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export function NotificationsPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const inbox = feedData<Record<string, unknown>>(results, '/notifications/inbox');
  const adapters = feedData<Record<string, unknown>>(results, '/notifications/delivery-adapters');
  const notifications = extractArray<Record<string, unknown>>(inbox, 'notifications');
  const adapterStats = extractArray<Record<string, unknown>>(adapters, 'stats');

  return (
    <div className="space-y-4">
      <SectionPanel title="Delivery adapters" description="In-app, email stub, and webhook stub delivery statistics.">
        <RecordTable
          columns={[
            { key: 'channel', label: 'Channel' },
            { key: 'delivered', label: 'Delivered' },
          ]}
          rows={mapRecords(adapterStats, (stat) => ({
            channel: String(stat.channel ?? '—'),
            delivered: String(stat.delivered ?? '0'),
          }))}
          emptyLabel="No delivery stats yet."
        />
      </SectionPanel>
      <SectionPanel title="Notification inbox" description="Alerts, approvals, incidents, and compliance notifications.">
        <RecordTable
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'category', label: 'Category' },
            { key: 'severity', label: 'Severity' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(notifications, (n) => ({
            title: String(n.title ?? '—'),
            category: String(n.category ?? '—'),
            severity: String(n.severity ?? '—'),
            status: String(n.status ?? '—'),
          }))}
          emptyLabel="No notifications."
        />
      </SectionPanel>
    </div>
  );
}

export function AdminFoundationPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const foundation = feedData<Record<string, unknown>>(results, '/platform/foundation');
  const environment = feedData<Record<string, unknown>>(results, '/platform/environment');
  const identity = feedData<Record<string, unknown>>(results, '/identity/workspace');
  const orgs = extractArray<Record<string, unknown>>(foundation, 'organizations');
  const tenants = extractArray<Record<string, unknown>>(foundation, 'tenants');
  const flags = extractArray<Record<string, unknown>>(foundation, 'featureFlags');
  const users = extractArray<Record<string, unknown>>(identity, 'users');
  const roleAssignments = extractArray<Record<string, unknown>>(identity, 'roleAssignments');
  const accessRequests = extractArray<Record<string, unknown>>(identity, 'accessRequests');

  return (
    <div className="space-y-4">
      <SectionPanel title="Environment" description="Runtime configuration and persistence mode.">
        <RecordTable
          columns={[
            { key: 'key', label: 'Setting' },
            { key: 'value', label: 'Value' },
          ]}
          rows={[
            { key: 'environment', value: String(environment?.environment ?? '—') },
            { key: 'persistence', value: String(environment?.persistenceMode ?? '—') },
            { key: 'observability', value: String(environment?.observabilityEnabled ?? '—') },
          ]}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Organizations" description="Multi-tenant organization registry.">
          <RecordTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(orgs, (o) => ({ name: String(o.name ?? '—'), status: String(o.status ?? '—') }))}
          />
        </SectionPanel>
        <SectionPanel title="Tenants" description="Tenant provisioning records.">
          <RecordTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(tenants, (t) => ({ name: String(t.name ?? '—'), status: String(t.status ?? '—') }))}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Feature flags" description="Module enablement from tenant and environment flags.">
        <RecordTable
          columns={[
            { key: 'key', label: 'Flag' },
            { key: 'description', label: 'Description' },
          ]}
          rows={mapRecords(flags, (f) => ({ key: String(f.key ?? '—'), description: String(f.description ?? '—') }))}
        />
      </SectionPanel>
      <SectionPanel title="Identity & access" description="Users, role assignments, and pending access requests.">
        <RecordTable
          columns={[
            { key: 'principal', label: 'Principal' },
            { key: 'role', label: 'Role' },
            { key: 'status', label: 'Status' },
          ]}
          rows={[
            ...mapRecords(users, (u) => ({
              principal: String(u.displayName ?? u.userId ?? '—'),
              role: String(u.primaryRole ?? '—'),
              status: String(u.status ?? 'active'),
            })),
            ...mapRecords(roleAssignments, (r) => ({
              principal: String(r.userId ?? '—'),
              role: String(r.role ?? '—'),
              status: 'assigned',
            })),
            ...mapRecords(accessRequests, (r) => ({
              principal: String(r.userId ?? '—'),
              role: String(r.requestedRole ?? '—'),
              status: String(r.status ?? 'pending'),
            })),
          ]}
          emptyLabel="No identity records returned."
        />
      </SectionPanel>
    </div>
  );
}
