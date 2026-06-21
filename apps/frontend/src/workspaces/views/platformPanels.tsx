import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

export function AnalyticsPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const workspace = feedData<Record<string, unknown>>(results, '/analytics/workspace');
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
      <SectionPanel title="Forecasting readiness" description="Model availability and data quality for predictive analytics.">
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
      <SectionPanel title="KPI trends" description="Historical snapshots from the KPI calculation engine.">
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

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'attendance', label: 'Attendance', value: String(attendance.current ?? '—'), detail: `Capacity ${attendance.capacity ?? '—'}` },
          { id: 'utilization', label: 'Utilization', value: attendance.utilizationPercent != null ? `${attendance.utilizationPercent}%` : '—' },
          { id: 'inventory', label: 'Tickets sold', value: String(ticketInventory.sold ?? '—'), detail: `${ticketInventory.available ?? '—'} available` },
          { id: 'engagement', label: 'Engagement score', value: String(fanAnalytics.engagementScore ?? '—') },
          { id: 'hospitality', label: 'Hospitality score', value: String((workspace?.hospitalityReadiness as Record<string, unknown> | undefined)?.score ?? '—') },
        ]}
      />
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
  const notifications = extractArray<Record<string, unknown>>(inbox, 'notifications');

  return (
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
