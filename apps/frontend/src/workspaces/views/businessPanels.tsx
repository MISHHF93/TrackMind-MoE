import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
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

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'sold', label: 'Tickets sold', value: String(ticketInventory.sold ?? '—') },
          { id: 'available', label: 'Available', value: String(ticketInventory.available ?? '—') },
          { id: 'held', label: 'Held', value: String(ticketInventory.held ?? '—') },
          { id: 'attendance', label: 'Gate attendance', value: String(attendance.current ?? capacity?.current ?? '—') },
          { id: 'revenue', label: 'Ticketing revenue today', value: ticketingRevenue?.amountToday != null ? formatUsd(ticketingRevenue.amountToday) : '—' },
        ]}
      />
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
  const auditTrail = extractArray<Record<string, unknown>>(workspace, 'auditTrail');

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
          <RecordTable
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'reference', label: 'Reference' },
              { key: 'amount', label: 'Amount' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(
              [
                ...purses.map((purse) => ({ type: 'purse', reference: purse.raceId, amount: purse.allocatedAmount, status: purse.status })),
                ...payouts.map((payout) => ({ type: 'payout', reference: payout.id, amount: payout.amount, status: payout.status })),
              ],
              (entry) => ({
                type: String(entry.type ?? '—'),
                reference: String(entry.reference ?? '—'),
                amount: formatUsd(entry.amount),
                status: String(entry.status ?? '—'),
              }),
            )}
          />
        </SectionPanel>
      </div>
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
  const data = feedData<Record<string, unknown>>(results, '/racing-data');
  const entityResolution = feedData<Record<string, unknown>>(results, '/racing-data/entity-resolution');
  const providers = extractArray<Record<string, unknown>>(data, 'providers');
  const jobs = extractArray<Record<string, unknown>>(data, 'ingestionJobs');
  const quality = extractArray<Record<string, unknown>>(data, 'qualityReports');
  const resolution = extractArray<Record<string, unknown>>(data, 'entityResolutionQueue');
  const clusters = resolution.length > 0 ? resolution : extractArray<Record<string, unknown>>(entityResolution, 'clusters');

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
        <SectionPanel title="Data providers">
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
