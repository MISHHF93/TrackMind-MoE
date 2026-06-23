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
import { feedFromIndex, indexWorkspaceFeeds, numericField } from '../feedUtils';
import { flattenKpiItems } from '../feedPresenters';
import { AdminFoundationPanels } from './platformPanels';
import { SurveillanceInfrastructureStatusPanel } from './surveillanceInfrastructureStatus';
import { SurveillanceIoTKpiPanel } from './surveillanceIoTKpiPanels';
import { SurveillanceVendorIntegrationPanels } from './surveillanceVendorIntegrationPanels';
import { EntityFormAction } from '@/features/data-entry/TrackMindFormDialog';
import { TrackDayOverview } from '@/features/track/TrackDayOverview';
import { TrackOvalDiagram } from '@/features/track/TrackOvalDiagram';
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
  const readiness = feedFromIndex<Record<string, unknown>>(feeds, '/race-day-readiness/dashboard');
  const surface = feedFromIndex<Record<string, unknown>>(feeds, '/surface-intelligence/workspace');
  const raceOffice = feedFromIndex<Record<string, unknown>>(feeds, '/race-operations/race-office');
  const workforce = feedFromIndex<Record<string, unknown>>(feeds, '/workforce-operations/workspace');
  const registry = feedFromIndex<Record<string, unknown>>(feeds, '/horse-registry/workspace');
  const twinState = feedFromIndex<Record<string, unknown>>(feeds, '/digital-twin/state');

  const widgets = extractArray<Record<string, unknown>>(command, 'widgets');
  const liveEvents = extractArray<Record<string, unknown>>(command, 'liveEvents');
  const services = extractArray<Record<string, unknown>>(health, 'services');
  const kpiItems = extractArray<Record<string, unknown>>(kpis, 'kpis');
  const scheduleRaces = extractArray<Record<string, unknown>>(raceOffice, 'cards');
  const commandRaces = extractArray<Record<string, unknown>>(command, 'races');
  const allRaces = scheduleRaces.length ? scheduleRaces : commandRaces;
  const twinAssets = extractArray<Record<string, unknown>>(command, 'assets');
  const horses = extractArray<Record<string, unknown>>(registry, 'horses');
  const workforceReadiness = workforce && typeof workforce.readiness === 'object'
    ? workforce.readiness as Record<string, unknown>
    : undefined;
  const weatherObservation = surface && typeof surface.weatherObservation === 'object'
    ? surface.weatherObservation as Record<string, unknown>
    : undefined;
  const flatKpis = filterKpisForRole(
    flattenKpiItems(kpiItems).map((kpi) => ({ ...kpi, domain: kpi.id.split('-')[1] })),
    role as Role,
  );

  const raceSummaries = allRaces.map((race, index) => ({
    raceId: String(race.raceId ?? race.id ?? `race-${index + 1}`),
    raceNumber: typeof race.raceNumber === 'number' ? race.raceNumber : Number(String(race.raceId ?? '').replace(/\D/g, '')) || index + 1,
    postTime: typeof race.postTime === 'string' ? race.postTime : typeof race.scheduledPostTime === 'string' ? race.scheduledPostTime : undefined,
    status: typeof race.status === 'string' ? race.status : undefined,
    raceName: typeof race.name === 'string' ? race.name : typeof race.title === 'string' ? race.title : undefined,
    distance: typeof race.distance === 'string' ? race.distance : race.distanceMeters != null ? `${race.distanceMeters}m` : undefined,
    entries: Array.isArray(race.entries) ? race.entries.length : undefined,
  }));

  const nextRace = raceSummaries.find((race) => race.status === 'watch' || race.status === 'pending' || race.status === 'scheduled')
    ?? raceSummaries[raceSummaries.length - 1];

  const trackSectors = [
    { id: 'chute', name: 'Chute', condition: 'good' },
    { id: 'backstretch', name: 'Backstretch', condition: 'fast' },
    { id: 'far-turn', name: 'Far Turn', condition: 'maintenance' },
    { id: 'stretch', name: 'Home Stretch', condition: 'good' },
  ];

  const mapAssets = (twinAssets.length ? twinAssets : extractArray<Record<string, unknown>>(twinState, 'assets')).map((asset) => ({
    id: String(asset.id ?? asset.assetId ?? ''),
    label: String(asset.label ?? asset.name ?? asset.id ?? 'Asset'),
    type: typeof asset.type === 'string' ? asset.type : undefined,
    sectorId: typeof asset.sectorId === 'string' ? asset.sectorId : undefined,
    status: typeof asset.status === 'string' ? asset.status : undefined,
  })).filter((asset) => asset.id);

  return (
    <div className="space-y-4">
      <TrackDayOverview
        meetName={String(readiness?.meetName ?? raceOffice?.meetName ?? 'Spring Championship Meet')}
        raceDate={typeof readiness?.raceDate === 'string' ? readiness.raceDate : undefined}
        surfaceGoing={typeof surface?.going === 'string' ? surface.going : 'fast'}
        surfaceScore={numericField(surface, 'overallScore') ?? undefined}
        forecastRainMm={typeof weatherObservation?.forecastRainMm === 'number' ? weatherObservation.forecastRainMm : undefined}
        horsesOnGrounds={horses.length || undefined}
        nextRace={nextRace}
        races={raceSummaries}
        workforceCheckedIn={typeof workforceReadiness?.checkedIn === 'number' ? workforceReadiness.checkedIn : undefined}
        workforceDemand={typeof workforceReadiness?.demand === 'number' ? workforceReadiness.demand : undefined}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <TrackOvalDiagram sectors={trackSectors} assets={mapAssets} gateSectorId="backstretch" />
        <SectionPanel title="Command actions" description="Jump to race-day consoles, horse registry, and governed intake.">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild><Link to="/race-day">Race day console</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/equine">Horse registry</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/workforce">Workforce</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/incidents">Incidents</Link></Button>
            <Button size="sm" variant="governance" asChild><Link to="/approvals">Approval queue</Link></Button>
            <EntityFormAction entityKind="audit-note" label="Record command note" variant="outline" />
          </div>
        </SectionPanel>
      </div>
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
      <SurveillanceInfrastructureStatusPanel results={results} />
      <SurveillanceIoTKpiPanel results={results} profile="admin" title="Platform surveillance KPIs" description="Administration view of camera uptime, stream availability, connectivity, gateway posture, zone coverage, and maintenance backlog." />
      <SurveillanceVendorIntegrationPanels results={results} />
      <SectionPanel title="Administration actions" description="Platform identity, modules, and environment controls.">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild><Link to="/admin?focus=identity">Identity workspace</Link></Button>
          <Button size="sm" variant="outline" asChild><Link to="/iot-monitoring">IoT &amp; CCTV monitoring</Link></Button>
          <Button size="sm" variant="outline" asChild><Link to="/settings">AI guardrails</Link></Button>
          <EntityFormAction
            entityKind="approval-request-composer"
            label="Request access elevation"
            variant="governance"
            title="Request access elevation"
            description="Compose a governed approval request for privileged access changes."
            seed={{ sourceDomain: 'administrative-change', requestTitle: 'Access elevation request' }}
            submitLabel="Submit request"
          />
        </div>
      </SectionPanel>
      <AdminFoundationPanels results={results} />
    </div>
  );
}
