import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData, formatCents } from '../feedUtils';

function financeFeed(results: WorkspaceDataResult[]) {
  return feedData<Record<string, unknown>>(results, '/services/finance/ticketing');
}

export function TicketingPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  return <FinancePanels results={results} />;
}

export function FinancePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const data = financeFeed(results);
  const tickets = extractArray<Record<string, unknown>>(data, 'tickets');
  const payouts = extractArray<Record<string, unknown>>(data, 'payouts');
  const summary = data && typeof data.summary === 'object' ? data.summary as Record<string, unknown> : undefined;

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'revenue', label: 'Gross revenue', value: formatCents(summary?.grossTicketRevenueCents) },
          { id: 'active', label: 'Active tickets', value: String(summary?.activeTickets ?? tickets.length) },
          { id: 'payouts', label: 'Protected payouts', value: String(summary?.protectedPayouts ?? payouts.length) },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Ticket ledger">
          <RecordTable
            columns={[
              { key: 'ticket', label: 'Ticket' },
              { key: 'raceDay', label: 'Race day' },
              { key: 'status', label: 'Status' },
              { key: 'price', label: 'Price' },
            ]}
            rows={mapRecords(tickets, (t) => ({
              ticket: String(t.ticketId ?? t.id ?? '—'),
              raceDay: String(t.raceDayId ?? '—'),
              status: String(t.status ?? '—'),
              price: formatCents(t.priceCents),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Payout review" description="Dual-control payout queue.">
          <RecordTable
            columns={[
              { key: 'payout', label: 'Payout' },
              { key: 'recipient', label: 'Recipient' },
              { key: 'amount', label: 'Amount' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(payouts, (p) => ({
              payout: String(p.payoutId ?? p.id ?? '—'),
              recipient: String(p.recipientId ?? '—'),
              amount: formatCents(p.amountCents),
              status: String(p.status ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export function FederationPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const data = feedData<Record<string, unknown>>(results, '/federation/workspace');
  const tracks = extractArray<Record<string, unknown>>(data, 'tracks');
  const benchmarks = (() => {
    const benchmarking = data && typeof data.crossTrackBenchmarking === 'object'
      ? data.crossTrackBenchmarking as Record<string, unknown>
      : undefined;
    return extractArray<Record<string, unknown>>(benchmarking, 'metrics');
  })();
  const tenant = data && typeof data.tenant === 'object' ? data.tenant as Record<string, unknown> : undefined;

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'cert', label: 'Certification', value: String(tenant?.certificationStatus ?? '—') },
          { id: 'tracks', label: 'Federation tracks', value: String(tracks.length) },
          { id: 'benchmarks', label: 'Benchmarks', value: String(benchmarks.length) },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Track certification">
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
            rows={mapRecords(benchmarks, (m) => ({
              metric: String(m.metric ?? m.name ?? '—'),
              value: String(m.value ?? '—'),
              percentile: m.percentile != null ? String(m.percentile) : '—',
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export function DataHubPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const data = feedData<Record<string, unknown>>(results, '/racing-data');
  const providers = extractArray<Record<string, unknown>>(data, 'providers');
  const jobs = extractArray<Record<string, unknown>>(data, 'ingestionJobs');
  const quality = extractArray<Record<string, unknown>>(data, 'qualityReports');
  const resolution = extractArray<Record<string, unknown>>(data, 'entityResolutionQueue');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'providers', label: 'Providers', value: String(providers.length) },
          { id: 'jobs', label: 'Ingestion jobs', value: String(jobs.length) },
          { id: 'quality', label: 'Quality reports', value: String(quality.length) },
          { id: 'resolution', label: 'Resolution queue', value: String(resolution.length) },
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
      <SectionPanel title="Entity resolution & quality">
        <RecordTable
          columns={[
            { key: 'item', label: 'Item' },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status' },
          ]}
          rows={mapRecords([...resolution, ...quality], (r) => ({
            item: String(r.id ?? r.reportId ?? r.entityId ?? '—'),
            type: String(r.type ?? (r.checks ? 'quality' : 'resolution')),
            status: String(r.status ?? r.overallStatus ?? '—'),
          }))}
        />
      </SectionPanel>
    </div>
  );
}
