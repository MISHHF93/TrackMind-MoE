import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { filterKpisForRole, type Role } from '@trackmind/shared';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedFromIndex, indexWorkspaceFeeds } from '../feedUtils';
import { flattenKpiItems } from '../feedPresenters';
import { AdminFoundationPanels } from './platformPanels';
import { EntityFormAction } from '@/features/data-entry/TrackMindFormDialog';
import type { WorkspacePanelProps } from './workspacePanelTypes';

const widgetRouteMap: Record<string, string> = {
  stewards: '/stewarding',
  security: '/security',
  audit: '/audit',
  compliance: '/compliance',
  'ai-governance': '/settings',
  incidents: '/incidents',
  facilities: '/facilities',
};

export function CommandCenterPanels({ results, role = 'platform-super-admin' }: WorkspacePanelProps): ReactElement {
  const feeds = useMemo(() => indexWorkspaceFeeds(results), [results]);
  const command = feedFromIndex<Record<string, unknown>>(feeds, '/operations/command-center');
  const health = feedFromIndex<Record<string, unknown>>(feeds, '/platform/health');
  const kpis = feedFromIndex<Record<string, unknown>>(feeds, '/kpis');

  const widgets = extractArray<Record<string, unknown>>(command, 'widgets');
  const liveEvents = extractArray<Record<string, unknown>>(command, 'liveEvents');
  const services = extractArray<Record<string, unknown>>(health, 'services');
  const kpiItems = extractArray<Record<string, unknown>>(kpis, 'kpis');
  const flatKpis = filterKpisForRole(
    flattenKpiItems(kpiItems).map((kpi) => ({ ...kpi, domain: kpi.id.split('-')[1] })),
    role as Role,
  );

  return (
    <div className="space-y-4">
      <SectionPanel title="Command actions" description="Jump to operational consoles and file governed intake.">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild><Link to="/incidents">Open incidents</Link></Button>
          <Button size="sm" variant="outline" asChild><Link to="/race-day">Race day console</Link></Button>
          <Button size="sm" variant="governance" asChild><Link to="/approvals">Approval queue</Link></Button>
          <EntityFormAction entityKind="audit-note" label="Record command note" variant="secondary" />
        </div>
      </SectionPanel>
      <KpiStrip
        items={flatKpis.slice(0, 6).map((kpi) => ({
          id: kpi.id,
          label: kpi.label,
          value: kpi.value,
          detail: kpi.target ? `Target ${kpi.target}` : undefined,
          status: kpi.status === 'critical' ? 'critical' : kpi.status === 'warning' ? 'warning' : 'nominal',
        }))}
      />
      <SectionPanel title="Command widgets" description="Role-aware operational cards from the command center feed.">
        <RecordTable
          columns={[
            { key: 'title', label: 'Widget' },
            { key: 'status', label: 'Status' },
            { key: 'value', label: 'Value' },
            { key: 'domain', label: 'Domain' },
          ]}
          rows={mapRecords(widgets, (w) => ({
            title: String(w.title ?? '—'),
            status: String(w.status ?? '—'),
            value: String(w.value ?? w.detail ?? '—'),
            domain: String(w.domain ?? '—'),
          }))}
          emptyLabel="No command widgets returned."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {widgets.slice(0, 6).map((w) => {
            const domain = String(w.domain ?? '');
            const path = typeof w.drillDownPath === 'string' ? w.drillDownPath : widgetRouteMap[domain] ?? '/dashboard';
            return (
              <Button key={String(w.id ?? w.title)} size="sm" variant="outline" asChild>
                <Link to={path}>{String(w.title ?? domain)}</Link>
              </Button>
            );
          })}
        </div>
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Live events" description="Recent operational events across domains.">
          <RecordTable
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'severity', label: 'Severity' },
              { key: 'summary', label: 'Summary' },
            ]}
            rows={mapRecords(liveEvents, (e) => ({
              type: String(e.type ?? e.eventType ?? '—'),
              severity: String(e.severity ?? '—'),
              summary: String(e.summary ?? e.detail ?? '—'),
            }))}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild><Link to="/incidents">Review incidents</Link></Button>
            <Button size="sm" variant="governance" asChild><Link to="/approvals">Open approvals</Link></Button>
          </div>
        </SectionPanel>
        <SectionPanel title="Platform services" description="Dependency health from platform observability.">
          <RecordTable
            columns={[
              { key: 'name', label: 'Service' },
              { key: 'status', label: 'Status' },
              { key: 'detail', label: 'Detail' },
            ]}
            rows={mapRecords(services, (s) => ({
              name: String(s.name ?? s.service ?? '—'),
              status: String(s.status ?? '—'),
              detail: String(s.detail ?? s.message ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}

export function AdminPanels({ results }: WorkspacePanelProps): ReactElement {
  return (
    <div className="space-y-4">
      <SectionPanel title="Administration actions" description="Platform identity, modules, and environment controls.">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild><Link to="/admin?focus=identity">Identity workspace</Link></Button>
          <Button size="sm" variant="outline" asChild><Link to="/settings">AI guardrails</Link></Button>
          <EntityFormAction entityKind="access-request" label="Request access elevation" variant="governance" />
        </div>
      </SectionPanel>
      <AdminFoundationPanels results={results} />
    </div>
  );
}
