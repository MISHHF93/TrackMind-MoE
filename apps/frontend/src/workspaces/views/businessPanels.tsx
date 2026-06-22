import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { actionDisabledReason, extractApprovalControls, roleCanUseAction } from '@/domain/approvalControls';
import { Badge } from '@/design/components/badge';
import { Button } from '@/design/components/button';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import {
  authorizeApprovalExecution,
  draftEntityResolutionReview,
  invokeRacingDataProvider,
  releaseFinancePayout,
  requestPurseRelease,
  requestRacingFinancePayout,
  type ApprovalTokenPayload,
} from '@/api/mutations';
import { GovernedActionDialog } from '@/features/approvals/GovernedActionDialog';
import type { WorkspaceAction } from '@/design/components/workspace';
import { feedData, formatCents } from '../feedUtils';

function formatUsd(amount: unknown): string {
  if (typeof amount !== 'number') return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function TicketingPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const workspace = feedData<Record<string, unknown>>(results, '/fan-experience/workspace');
  const capacity = feedData<Record<string, unknown>>(results, '/fan-experience/capacity');
  const ticketInventory = (workspace?.ticketInventory ?? capacity?.ticketInventory ?? {}) as Record<string, unknown>;
  const attendance = (workspace?.attendance ?? {}) as Record<string, unknown>;
  const revenueLinkage = extractArray<Record<string, unknown>>(workspace, 'revenueLinkage');
  const ticketingRevenue = revenueLinkage.find((link) => link.source === 'ticketing');
  const ticketingConnector = (workspace?.ticketingConnector ?? capacity?.ticketingConnector ?? {}) as Record<string, unknown>;
  const connectorAdapters = extractArray<Record<string, unknown>>(ticketingConnector, 'adapters');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'sold', label: 'Tickets sold', value: String(ticketInventory.sold ?? '—') },
          { id: 'available', label: 'Available', value: String(ticketInventory.available ?? '—') },
          { id: 'held', label: 'Held', value: String(ticketInventory.held ?? '—') },
          { id: 'attendance', label: 'Gate attendance', value: String(attendance.current ?? capacity?.current ?? '—') },
          { id: 'connector', label: 'Connector', value: String(ticketingConnector.overallStatus ?? '—'), detail: ticketingConnector.degraded ? 'Degraded' : 'Synced' },
          { id: 'revenue', label: 'Ticketing revenue today', value: ticketingRevenue?.amountToday != null ? formatUsd(ticketingRevenue.amountToday) : '—' },
        ]}
      />
      <SectionPanel title="Ticketing connector status" description="External ticketing provider sync for inventory and attendance.">
        <RecordTable
          columns={[
            { key: 'adapter', label: 'Adapter' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(connectorAdapters, (adapter) => ({
            adapter: String(adapter.adapterId ?? '—'),
            vendor: String(adapter.vendor ?? '—'),
            status: String(adapter.status ?? '—'),
          }))}
          emptyLabel="No ticketing connectors registered."
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Ticket inventory" description="Inventory counts owned by fan experience operations, not finance workspace.">
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
        <SectionPanel title="Venue capacity" description="Capacity utilization from attendance snapshots.">
          <RecordTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'value', label: 'Value' },
            ]}
            rows={[
              { metric: 'Venue capacity', value: String(attendance.capacity ?? capacity?.capacity ?? '—') },
              { metric: 'Current attendance', value: String(attendance.current ?? capacity?.current ?? '—') },
              { metric: 'Utilization', value: attendance.utilizationPercent != null ? `${attendance.utilizationPercent}%` : capacity?.utilizationPercent != null ? `${capacity.utilizationPercent}%` : '—' },
            ]}
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export function FinancePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; action?: WorkspaceAction }>({ open: false });
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const workspace = feedData<Record<string, unknown>>(results, '/finance/workspace');
  const dashboard = workspace?.dashboard as Record<string, unknown> | undefined;
  const kpiPanels = extractArray<Record<string, unknown>>(dashboard, 'panels');
  const revenue = workspace?.revenue as Record<string, unknown> | undefined;
  const expenses = workspace?.expenses as Record<string, unknown> | undefined;
  const budget = workspace?.budget as Record<string, unknown> | undefined;
  const reconciliation = workspace?.reconciliation as Record<string, unknown> | undefined;
  const guardrails = workspace?.guardrails as Record<string, unknown> | undefined;
  const purses = extractArray<Record<string, unknown>>(workspace, 'purses');
  const raceDayExpenses = extractArray<Record<string, unknown>>(workspace, 'raceDayExpenses');
  const operationalCosts = extractArray<Record<string, unknown>>(workspace, 'operationalCosts');
  const facilityCosts = extractArray<Record<string, unknown>>(workspace, 'facilityCosts');
  const ticketRevenue = extractArray<Record<string, unknown>>(workspace, 'ticketRevenue');
  const hospitalityRevenue = extractArray<Record<string, unknown>>(workspace, 'hospitalityRevenue');
  const payouts = extractArray<Record<string, unknown>>(workspace, 'payouts');
  const payoutQueue = extractArray<Record<string, unknown>>(workspace, 'payoutQueue');
  const workspaceControls = extractArray<Record<string, unknown>>(workspace, 'approvalControls');
  const auditTrail = extractArray<Record<string, unknown>>(workspace, 'auditTrail');
  const settlement = workspace?.settlement as Record<string, unknown> | undefined;
  const settlementAdapters = extractArray<Record<string, unknown>>(settlement, 'adapters');
  const settlementEntries = extractArray<Record<string, unknown>>(settlement, 'entries');

  const financeControls: WorkspaceAction[] = [
    ...extractApprovalControls(results),
    ...workspaceControls.map((control) => ({
      id: String(control.id ?? control.action ?? 'finance-control'),
      label: String(control.label ?? 'Finance approval'),
      detail: String(control.reason ?? guardrails?.guardrailStatement ?? 'Approval-governed payout workflow.'),
      protectedAction: String(control.action ?? 'payout'),
      target: String(control.target ?? 'new-payout'),
      approvalApi: 'controlled-actions' as const,
      requiredRoles: Array.isArray(control.requiredRoles) ? control.requiredRoles.filter((role): role is string => typeof role === 'string') : ['admin', 'finance'],
    })),
  ];

  const releaseMutation = useMutation({
    mutationFn: async (item: Record<string, unknown>) => {
      const approvalRequestId = String(item.approvalRequestId ?? '');
      const kind = String(item.kind ?? 'payout');
      const itemId = String(item.id ?? item.reference ?? '');
      if (!approvalRequestId) throw new Error('Approval request id is required before authorized release.');
      const authorized = await authorizeApprovalExecution(approvalRequestId);
      const token = authorized.approvalToken;
      if (!token) throw new Error('Approval token was not issued. Complete steward and finance approvals first.');
      if (kind === 'purse') {
        return requestPurseRelease(itemId, { approvalToken: token as ApprovalTokenPayload, actor: session.role });
      }
      return releaseFinancePayout(itemId, token as ApprovalTokenPayload, session.role);
    },
    onSuccess: () => {
      setQueueMessage('Authorized release submitted with verified approval token.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  const requestPayoutMutation = useMutation({
    mutationFn: () => requestRacingFinancePayout({ amount: 8500, recipientLabel: 'Trainer settlement', actor: session.role }),
    onSuccess: () => {
      setQueueMessage('Payout request submitted for dual-control approval.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  const requestPurseReleaseMutation = useMutation({
    mutationFn: (purseId: string) => requestPurseRelease(purseId, { actor: session.role }),
    onSuccess: () => {
      setQueueMessage('Purse release submitted for dual-control approval.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  const handleFinanceControl = (control: WorkspaceAction) => {
    if (control.target === 'new-payout') {
      void requestPayoutMutation.mutate();
      return;
    }
    const purseMatch = purses.find((purse) => String(purse.purseId) === control.target && purse.status === 'allocated');
    if (purseMatch) {
      void requestPurseReleaseMutation.mutate(String(purseMatch.purseId));
      return;
    }
    setDialog({ open: true, action: control });
  };

  const queueRows = payoutQueue.length
    ? payoutQueue
    : [
        ...purses.map((purse) => ({
          id: purse.purseId,
          kind: 'purse',
          reference: purse.raceId,
          label: `Race ${purse.raceNumber ?? purse.raceId} purse`,
          amount: purse.allocatedAmount,
          status: purse.status,
          approvalRequestId: purse.approvalRequestId,
          approvalRequired: purse.status !== 'released',
        })),
        ...payouts.map((payout) => ({
          id: payout.id,
          kind: 'payout',
          reference: payout.id,
          label: `Payout ${payout.id}`,
          amount: payout.amount,
          status: payout.status,
          approvalRequestId: payout.approvalId,
          approvalRequired: payout.status !== 'released',
        })),
      ];

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'revenue-today', label: 'Revenue today', value: formatUsd(revenue?.today), detail: `MTD ${formatUsd(revenue?.mtd)}` },
          { id: 'expenses-today', label: 'Expenses today', value: formatUsd(expenses?.today), detail: `MTD ${formatUsd(expenses?.mtd)}` },
          { id: 'budget', label: 'Budget remaining', value: formatUsd(budget?.remaining), detail: `${formatUsd(budget?.spent)} spent of ${formatUsd(budget?.allocated)}` },
          { id: 'readiness', label: 'Finance readiness', value: dashboard?.readinessScore != null ? String(dashboard.readinessScore) : '—', status: Number(dashboard?.readinessScore ?? 100) >= 85 ? 'nominal' : 'warning' },
        ]}
      />
      <SectionPanel title="Financial KPI pack" description="Revenue, expense, budget, purse, and reconciliation metrics with audit linkage.">
        <RecordTable
          columns={[
            { key: 'kpi', label: 'KPI' },
            { key: 'value', label: 'Value' },
            { key: 'target', label: 'Target' },
            { key: 'status', label: 'Status' },
            { key: 'trend', label: 'Trend' },
          ]}
          rows={mapRecords(kpiPanels, (panel) => ({
            kpi: String(panel.name ?? panel.kpiId ?? '—'),
            value: `${panel.value ?? '—'} ${panel.unit ?? ''}`.trim(),
            target: String(panel.target ?? '—'),
            status: String(panel.status ?? '—'),
            trend: String(panel.trend ?? '—'),
          }))}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="GL & settlement sync" description="Ledger read model stub from GL, settlement, and payout-rail adapters.">
          <RecordTable
            columns={[
              { key: 'adapter', label: 'Adapter' },
              { key: 'kind', label: 'Kind' },
              { key: 'vendor', label: 'Vendor' },
              { key: 'status', label: 'Status' },
              { key: 'lastSync', label: 'Last sync' },
            ]}
            rows={settlementAdapters.length
              ? mapRecords(settlementAdapters, (adapter) => ({
                  adapter: String(adapter.adapterId ?? '—'),
                  kind: String(adapter.kind ?? '—'),
                  vendor: String(adapter.vendor ?? '—'),
                  status: String(adapter.status ?? '—'),
                  lastSync: String(adapter.lastSyncAt ?? '—'),
                }))
              : [{ adapter: '—', kind: '—', vendor: '—', status: '—', lastSync: '—' }]}
          />
          <RecordTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'value', label: 'Value' },
            ]}
            rows={[
              { metric: 'Sync status', value: String(settlement?.syncStatus ?? '—') },
              { metric: 'Coverage', value: settlement?.coveragePct != null ? `${settlement.coveragePct}%` : '—' },
              { metric: 'Pending postings', value: String(settlement?.pendingPostings ?? '—') },
              { metric: 'Exceptions', value: String(settlement?.exceptionCount ?? '—') },
              { metric: 'Ledger entries', value: String(settlementEntries.length || '—') },
              { metric: 'Last successful sync', value: String(settlement?.lastSuccessfulSyncAt ?? '—') },
            ]}
          />
        </SectionPanel>
        <SectionPanel title="Revenue & settlement" description="Ticket and hospitality revenue read models linked to fan experience.">
          <RecordTable
            columns={[
              { key: 'source', label: 'Source' },
              { key: 'label', label: 'Label' },
              { key: 'net', label: 'Net' },
              { key: 'status', label: 'Linked' },
            ]}
            rows={mapRecords([...ticketRevenue, ...hospitalityRevenue], (entry) => ({
              source: String(entry.source ?? entry.packageName ?? 'hospitality'),
              label: String(entry.label ?? entry.packageName ?? '—'),
              net: formatUsd(entry.netAmount),
              status: entry.fanExperienceReference ? 'fan-experience' : '—',
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Budget tracking" description="Allocated budget vs month-to-date spend.">
          <RecordTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'amount', label: 'Amount' },
            ]}
            rows={[
              { metric: 'Allocated', amount: formatUsd(budget?.allocated) },
              { metric: 'Spent (MTD)', amount: formatUsd(budget?.spent) },
              { metric: 'Remaining', amount: formatUsd(budget?.remaining) },
              { metric: 'Utilization', amount: dashboard?.budgetUtilizationPercent != null ? `${dashboard.budgetUtilizationPercent}%` : '—' },
              { metric: 'Reconciliation matched', amount: String(reconciliation?.matched ?? '—') },
              { metric: 'Reconciliation exceptions', amount: String(reconciliation?.exceptions ?? '—') },
            ]}
          />
        </SectionPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Race-day & operational expenses">
          <RecordTable
            columns={[
              { key: 'category', label: 'Category' },
              { key: 'label', label: 'Label' },
              { key: 'amount', label: 'Amount' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords([...raceDayExpenses, ...operationalCosts, ...facilityCosts], (entry) => ({
              category: String(entry.category ?? entry.costCenter ?? entry.facilityName ?? 'facility'),
              label: String(entry.label ?? '—'),
              amount: formatUsd(entry.amount),
              status: String(entry.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Payout governance" description={String(guardrails?.guardrailStatement ?? 'Approval-governed purse releases and payouts.')}>
          {queueMessage ? <p className="mb-3 text-sm text-[var(--status-nominal)]">{queueMessage}</p> : null}
          {releaseMutation.isError ? (
            <p className="mb-3 text-sm text-[var(--status-critical)]">{(releaseMutation.error as Error).message}</p>
          ) : null}
          {requestPurseReleaseMutation.isError ? (
            <p className="mb-3 text-sm text-[var(--status-critical)]">{(requestPurseReleaseMutation.error as Error).message}</p>
          ) : null}
          <RecordTable
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'reference', label: 'Reference' },
              { key: 'amount', label: 'Amount' },
              { key: 'status', label: 'Status' },
              { key: 'approval', label: 'Approval' },
              { key: 'action', label: 'Action' },
            ]}
            rows={mapRecords(queueRows, (entry) => {
              const status = String(entry.status ?? '—');
              const approvalRequestId = entry.approvalRequestId ? String(entry.approvalRequestId) : undefined;
              const canRelease = Boolean(approvalRequestId) && status === 'pending-approval';
              const canRequest = status === 'allocated' || (entry.kind === 'payout' && !approvalRequestId && status !== 'released');
              return {
                type: String(entry.kind ?? entry.type ?? '—'),
                reference: String(entry.reference ?? entry.label ?? entry.id ?? '—'),
                amount: formatUsd(entry.amount),
                status,
                approval: approvalRequestId ?? (entry.approvalRequired === false ? '—' : 'required'),
                action: canRelease ? 'submit-authorized-release' : canRequest ? 'request-approval' : '—',
              };
            })}
          />
          <div className="mt-4 space-y-3">
            <p className="text-xs text-[var(--muted-foreground)]">
              Request approval via the controls below, complete steward and finance decisions in Approvals, then submit authorized release with a verified approval token.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="governance"
                disabled={requestPayoutMutation.isPending || !roleCanUseAction({ id: 'finance-new-payout', label: 'Request new payout', requiredRoles: ['admin', 'finance'] }, session.role)}
                onClick={() => void requestPayoutMutation.mutate()}
              >
                Request new payout
              </Button>
              {queueRows
                .filter((item) => String(item.kind) === 'purse' && String(item.status) === 'allocated')
                .slice(0, 4)
                .map((item) => (
                  <Button
                    key={`request-${String(item.id ?? item.reference)}`}
                    size="sm"
                    variant="governance"
                    disabled={requestPurseReleaseMutation.isPending || !roleCanUseAction({ id: 'finance-purse-release', label: 'Request purse release', requiredRoles: ['admin', 'finance'] }, session.role)}
                    onClick={() => requestPurseReleaseMutation.mutate(String(item.id ?? item.reference))}
                  >
                    Request purse release ({String(item.reference ?? item.id)})
                  </Button>
                ))}
              {queueRows
                .filter((item) => item.approvalRequestId && String(item.status) === 'pending-approval')
                .slice(0, 4)
                .map((item) => (
                  <Button
                    key={String(item.id ?? item.reference)}
                    size="sm"
                    variant="governance"
                    disabled={releaseMutation.isPending || !roleCanUseAction({ id: 'finance-release', label: 'Submit authorized release', requiredRoles: ['admin', 'finance'] }, session.role)}
                    onClick={() => releaseMutation.mutate(item)}
                  >
                    Submit authorized release ({String(item.kind ?? 'payout')})
                  </Button>
                ))}
            </div>
          </div>
        </SectionPanel>
        <SectionPanel title="Finance approval controls" description="Create approval requests through the centralized approvals API. Execution remains locked until authorized.">
          {financeControls.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No finance approval controls returned from /finance/workspace.</p>
          ) : (
            <ul className="space-y-2">
              {financeControls.map((control) => {
                const disabled = !roleCanUseAction(control, session.role);
                return (
                  <li key={control.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{control.label}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{control.target}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="governance"
                      disabled={disabled}
                      title={disabled ? actionDisabledReason(control, session.role) : control.detail}
                      onClick={() => handleFinanceControl(control)}
                    >
                      Request approval
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionPanel>
      </div>
      {dialog.action?.protectedAction ? (
        <GovernedActionDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open, action: open ? dialog.action : undefined })}
          title={dialog.action.label}
          description={dialog.action.detail ?? 'Request human approval for this protected finance action.'}
          protectedAction={dialog.action.protectedAction}
          target={dialog.action.target ?? dialog.action.id}
          approvalApi={dialog.action.approvalApi}
          onSubmitted={() => setQueueMessage('Approval request submitted. Complete steward and finance approvals before release.')}
        />
      ) : null}
      <SectionPanel title="Finance audit trail" description="Hash-chained financial mutations with approval evidence.">
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'action', label: 'Action' },
            { key: 'actor', label: 'Actor' },
            { key: 'summary', label: 'Summary' },
            { key: 'hash', label: 'Hash' },
          ]}
          rows={mapRecords(auditTrail, (record) => ({
            time: String(record.timestamp ?? '—'),
            action: String(record.action ?? '—'),
            actor: String(record.actor ?? '—'),
            summary: String(record.changeSummary ?? '—'),
            hash: String(record.hash ?? '—').slice(0, 12),
          }), 12)}
        />
      </SectionPanel>
    </div>
  );
}

export function FederationPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const data = feedData<Record<string, unknown>>(results, '/federation/workspace');
  const industry = feedData<Record<string, unknown>>(results, '/industry-intelligence/workspace');
  const benchmarksFeed = feedData<Record<string, unknown>>(results, '/industry-intelligence/benchmarks');
  const trendsFeed = feedData<Record<string, unknown>>(results, '/industry-intelligence/trends');
  const federationIntel = feedData<Record<string, unknown>>(results, '/federation-intelligence/workspace');
  const tracks = extractArray<Record<string, unknown>>(data, 'tracks');
  const benchmarks = (() => {
    const benchmarking = data && typeof data.crossTrackBenchmarking === 'object'
      ? data.crossTrackBenchmarking as Record<string, unknown>
      : undefined;
    return extractArray<Record<string, unknown>>(benchmarking, 'metrics');
  })();
  const industryBenchmarks = extractArray<Record<string, unknown>>(benchmarksFeed, 'benchmarks');
  const industryTrends = extractArray<Record<string, unknown>>(trendsFeed, 'trends');
  const aggregateSignals = extractArray<Record<string, unknown>>(federationIntel, 'aggregateSignals');
  const tenant = data && typeof data.tenant === 'object' ? data.tenant as Record<string, unknown> : undefined;

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'cert', label: 'Certification', value: String(tenant?.certificationStatus ?? '—') },
          { id: 'tracks', label: 'Federation tracks', value: String(tracks.length) },
          { id: 'benchmarks', label: 'Benchmarks', value: String(benchmarks.length + industryBenchmarks.length) },
          { id: 'signals', label: 'Aggregate signals', value: String(aggregateSignals.length) },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Track certification" description="Aggregate certification posture — no tenant PII.">
          <RecordTable
            columns={[
              { key: 'track', label: 'Track' },
              { key: 'status', label: 'Status' },
              { key: 'residency', label: 'Data residency' },
            ]}
            rows={mapRecords(tracks, (t) => ({
              track: String(t.trackId ?? t.name ?? '—'),
              status: String(t.certificationStatus ?? t.status ?? '—'),
              residency: String(t.dataResidency ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Cross-track benchmarks">
          <RecordTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'value', label: 'Value' },
              { key: 'percentile', label: 'Percentile' },
            ]}
            rows={mapRecords([...benchmarks, ...industryBenchmarks], (m) => ({
              metric: String(m.metric ?? m.name ?? '—'),
              value: String(m.value ?? m.trackValue ?? '—'),
              percentile: m.percentile != null ? String(m.percentile) : String(m.industryMedian ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Industry intelligence" description="Anonymized federation-wide trends.">
          <RecordTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'direction', label: 'Direction' },
              { key: 'confidence', label: 'Confidence' },
            ]}
            rows={mapRecords(industryTrends.length ? industryTrends : extractArray(industry, 'trends'), (t) => ({
              metric: String(t.metric ?? t.label ?? '—'),
              direction: String(t.direction ?? t.trend ?? '—'),
              confidence: t.confidence != null ? String(t.confidence) : '—',
            }))}
            emptyLabel="No industry trends returned."
          />
        </SectionPanel>
        <SectionPanel title="Federation intelligence" description="Permission-governed aggregate signals only.">
          <RecordTable
            columns={[
              { key: 'signal', label: 'Signal' },
              { key: 'domain', label: 'Domain' },
              { key: 'score', label: 'Score' },
            ]}
            rows={mapRecords(aggregateSignals, (s) => ({
              signal: String(s.label ?? s.signalId ?? '—'),
              domain: String(s.domain ?? '—'),
              score: s.score != null ? String(s.score) : '—',
            }))}
            emptyLabel="No federation intelligence signals."
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export function DataHubPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const queryClient = useQueryClient();
  const { session } = useTenantSession();
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [invokeMessage, setInvokeMessage] = useState<string | null>(null);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [reviewRationale, setReviewRationale] = useState('');
  const data = feedData<Record<string, unknown>>(results, '/racing-data');
  const entityResolution = feedData<Record<string, unknown>>(results, '/racing-data/entity-resolution');
  const providers = extractArray<Record<string, unknown>>(data, 'providers');
  const jobs = extractArray<Record<string, unknown>>(data, 'ingestionJobs');
  const quality = extractArray<Record<string, unknown>>(data, 'qualityReports');
  const resolution = extractArray<Record<string, unknown>>(data, 'entityResolutionQueue');
  const clusters = resolution.length > 0 ? resolution : extractArray<Record<string, unknown>>(entityResolution, 'clusters');
  const defaultProviderId = String(providers[0]?.providerId ?? 'provider-official-feed');
  const directMutationAllowed = entityResolution?.directMutationAllowed === true;
  const canDraftReview = session.role === 'admin' || session.role === 'compliance-officer' || session.role === 'racing-secretary';
  const canInvokeProvider = session.role === 'admin' || session.role === 'compliance-officer';

  const draftReview = useMutation({
    mutationFn: (input: { providerId: string; entityId: string; resolutionId?: string; rationale?: string }) =>
      draftEntityResolutionReview(input),
    onSuccess: (response) => {
      setReviewMessage(
        `${response.message} Draft ${response.draftId} recorded; approval required before any canonical identity merge.`,
      );
      setReviewRationale('');
      setActiveClusterId(null);
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => {
      setReviewMessage(error.message);
      setActiveClusterId(null);
    },
  });

  const invokeProvider = useMutation({
    mutationFn: (providerId: string) => invokeRacingDataProvider(providerId),
    onSuccess: (response) => {
      setInvokeMessage(
        `Provider ${response.providerId} simulated ${response.recordsProcessed} record(s) at ${response.executedAt}. Audit ${response.auditId}; ${response.rateLimit.remaining} licensed pull(s) remaining in window.`,
      );
      setActiveProviderId(null);
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => {
      setInvokeMessage(error.message);
      setActiveProviderId(null);
    },
  });

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'providers', label: 'Providers', value: String(providers.length) },
          { id: 'jobs', label: 'Ingestion jobs', value: String(jobs.length) },
          { id: 'quality', label: 'Quality reports', value: String(quality.length) },
          { id: 'resolution', label: 'Resolution queue', value: String(clusters.length) },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Data providers" description="Licensed provider adapters; invoke runs a local simulation only with no external calls.">
          <RecordTable
            columns={[
              { key: 'provider', label: 'Provider' },
              { key: 'license', label: 'License' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(providers, (p) => ({
              provider: String(p.providerId ?? p.name ?? '—'),
              license: String(p.license && typeof p.license === 'object' ? (p.license as Record<string, unknown>).licenseStatus : '—'),
              status: String(p.status ?? '—'),
            }))}
          />
          {providers.length > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="maroon">Simulation only</Badge>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Provider invoke simulates adapter ingestion locally; no scraping, external provider calls, or canonical state mutation occurs.
                </p>
              </div>
              <ul className="space-y-2">
                {providers.slice(0, 8).map((provider, index) => {
                  const providerId = String(provider.providerId ?? provider.id ?? `provider-${index + 1}`);
                  const pending = invokeProvider.isPending && activeProviderId === providerId;
                  return (
                    <li
                      key={providerId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{providerId}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {String(provider.status ?? 'registered')} · {String(
                            provider.license && typeof provider.license === 'object'
                              ? (provider.license as Record<string, unknown>).licenseStatus
                              : 'license posture unknown',
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="governance"
                        disabled={pending || !canInvokeProvider}
                        title={canInvokeProvider ? 'Simulate licensed adapter invoke locally' : 'Requires admin or compliance-officer role'}
                        onClick={() => {
                          setInvokeMessage(null);
                          setActiveProviderId(providerId);
                          invokeProvider.mutate(providerId);
                        }}
                      >
                        Invoke provider adapter
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {invokeMessage ? <p className="text-xs text-[var(--muted-foreground)]">{invokeMessage}</p> : null}
            </div>
          ) : null}
        </SectionPanel>
        <SectionPanel title="Ingestion jobs">
          <RecordTable
            columns={[
              { key: 'job', label: 'Job' },
              { key: 'provider', label: 'Provider' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(jobs, (j) => ({
              job: String(j.jobId ?? j.id ?? '—'),
              provider: String(j.providerId ?? '—'),
              status: String(j.status ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Entity resolution queue" description="Canonical identity clusters with confidence and review posture. Direct merges remain approval-gated.">
        <RecordTable
          columns={[
            { key: 'entity', label: 'Entity' },
            { key: 'type', label: 'Type' },
            { key: 'confidence', label: 'Confidence' },
            { key: 'decision', label: 'Decision' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(clusters, (cluster) => ({
            entity: String(cluster.canonicalId ?? cluster.resolutionId ?? cluster.entityId ?? '—'),
            type: String(cluster.entityType ?? '—'),
            confidence: cluster.confidence != null || cluster.matchConfidence != null
              ? `${Math.round(Number(cluster.confidence ?? cluster.matchConfidence) * 100)}%`
              : '—',
            decision: String(cluster.decision ?? (cluster.reviewRequired ? 'review-required' : '—')),
            status: String(cluster.status ?? '—'),
          }))}
          emptyLabel="No entity resolution candidates in queue."
        />
        {clusters.length > 0 && !directMutationAllowed ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="maroon">Draft only</Badge>
              <p className="text-xs text-[var(--muted-foreground)]">
                Review drafts create approval records only; canonical identity and operational records are not mutated locally.
              </p>
            </div>
            <label className="block text-xs text-[var(--muted-foreground)]">
              Optional review rationale
              <textarea
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
                rows={2}
                value={reviewRationale}
                placeholder="Document why this cluster needs human review (not persisted until draft is approved)."
                onChange={(event) => setReviewRationale(event.target.value)}
              />
            </label>
            <ul className="space-y-2">
              {clusters.slice(0, 8).map((cluster, index) => {
                const entityId = String(cluster.canonicalId ?? cluster.entityId ?? cluster.resolutionId ?? `entity-${index + 1}`);
                const resolutionId = String(cluster.resolutionId ?? entityId);
                const providerId = String(cluster.providerId ?? defaultProviderId);
                const pending = draftReview.isPending && activeClusterId === resolutionId;
                const reviewRequired = cluster.reviewRequired === true || String(cluster.decision ?? '').includes('review');
                const confidencePct = cluster.confidence != null || cluster.matchConfidence != null
                  ? Math.round(Number(cluster.confidence ?? cluster.matchConfidence) * 100)
                  : null;
                return (
                  <li
                    key={resolutionId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{entityId}</p>
                        {reviewRequired ? <Badge variant="maroon">Review required</Badge> : null}
                        {confidencePct != null ? (
                          <Badge variant="secondary">{confidencePct}% confidence</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {String(cluster.entityType ?? 'entity')} · {String(cluster.decision ?? cluster.status ?? 'review queue')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="governance"
                      disabled={pending || !canDraftReview}
                      title={canDraftReview ? 'POST /racing-data/entity-resolution/review' : 'Requires admin, compliance-officer, or racing-secretary role'}
                      onClick={() => {
                        setReviewMessage(null);
                        setActiveClusterId(resolutionId);
                        draftReview.mutate({
                          providerId,
                          entityId,
                          resolutionId,
                          rationale: reviewRationale.trim() || undefined,
                        });
                      }}
                    >
                      Draft entity resolution review
                    </Button>
                  </li>
                );
              })}
            </ul>
            {reviewMessage ? <p className="text-xs text-[var(--muted-foreground)]">{reviewMessage}</p> : null}
          </div>
        ) : null}
      </SectionPanel>
      <SectionPanel title="Data quality reports">
        <RecordTable
          columns={[
            { key: 'report', label: 'Report' },
            { key: 'provider', label: 'Provider' },
            { key: 'score', label: 'Score' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords(quality, (report) => ({
            report: String(report.reportId ?? report.id ?? '—'),
            provider: String(report.providerId ?? '—'),
            score: report.score != null ? String(report.score) : '—',
            status: String(report.status ?? report.overallStatus ?? '—'),
          }))}
          emptyLabel="No quality reports returned."
        />
      </SectionPanel>
    </div>
  );
}
