import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/design/components/button';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';
import type { WorkspacePanelProps } from './workspacePanelTypes';
import { SurveillanceInfrastructureStatusPanel } from './surveillanceInfrastructureStatus';
import { SurveillanceIoTKpiPanel } from './surveillanceIoTKpiPanels';
import { SurveillanceVendorIntegrationPanels } from './surveillanceVendorIntegrationPanels';

function iotCategoryLabel(category: unknown): string {
  const value = String(category ?? '');
  if (value === 'telemetry') return 'IoT / Sensors';
  if (value === 'security') return 'CCTV / VMS';
  return value || '—';
}

export function IotMonitoringPanels({ results }: WorkspacePanelProps): ReactElement {
  const integrationHub = feedData<Record<string, unknown>>(results, '/integration-hub/workspace');
  const securitySoc = feedData<Record<string, unknown>>(results, '/security-soc/workspace');
  const cameraReadiness = feedData<Record<string, unknown>>(results, '/security-operations/cameras/readiness');
  const sensorReadiness = feedData<Record<string, unknown>>(results, '/security-operations/sensors/readiness');
  const securityWorkspace = feedData<Record<string, unknown>>(results, '/security-operations/workspace');
  const zonesLive = feedData<Record<string, unknown>>(results, '/security-operations/zones/live');
  const securityKpis = feedData<Record<string, unknown>>(results, '/security-operations/kpis');
  const platformHealth = feedData<Record<string, unknown>>(results, '/platform/health');

  const connectors = extractArray<Record<string, unknown>>(integrationHub, 'connectors');
  const iotConnectors = connectors.filter((c) => {
    const category = String(c.category ?? '');
    const id = String(c.id ?? '');
    return category === 'telemetry' || category === 'security' || id.includes('sensor') || id.includes('camera');
  });
  const cameras = extractArray<Record<string, unknown>>(securityWorkspace, 'cameras');
  const cameraItems = extractArray<Record<string, unknown>>(cameraReadiness, 'items');
  const sensorItems = extractArray<Record<string, unknown>>(sensorReadiness, 'items');
  const liveZones = extractArray<Record<string, unknown>>(zonesLive, 'zones');
  const socZones = extractArray<Record<string, unknown>>(securitySoc, 'zoneStatus');
  const connectedCount = iotConnectors.filter((c) => c.connected === true || String(c.status) === 'connected').length;

  return (
    <div className="space-y-4">
      <SurveillanceInfrastructureStatusPanel results={results} showHierarchy={false} showActions={false} />
      <SurveillanceIoTKpiPanel results={results} profile="full" title="Surveillance & IoT KPI pack" description="Full KPI pack across camera uptime, streams, connectivity, alerts, gateways, facility sensors, zone coverage, maintenance, and incident evidence." />
      <SurveillanceVendorIntegrationPanels results={results} />

      <SectionPanel
        title="Integration & domain drill-down"
        description="Connector catalog, fleet tables, and SOC projections below the platform infrastructure status tier."
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/cctv-viewer">CCTV viewer</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/cctv-registry">CCTV device registry</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-registry">IoT device registry</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/surveillance-zone-mapping">Zone mapping</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/surveillance-health">Surveillance health</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin">Platform administration</Link>
          </Button>
        </div>
        <ol className="mt-4 space-y-1 text-sm text-[var(--muted-foreground)]">
          <li><strong className="text-[var(--foreground)]">1. Integration layer</strong> — connector catalog (IoT gateway, camera/VMS)</li>
          <li><strong className="text-[var(--foreground)]">2. Device fleet</strong> — registered cameras and zone sensors</li>
          <li><strong className="text-[var(--foreground)]">3. Readiness & health</strong> — webhook, twin-link, and heartbeat posture</li>
          <li><strong className="text-[var(--foreground)]">4. Live monitoring</strong> — SOC zones and occupancy projections</li>
        </ol>
      </SectionPanel>

      <KpiStrip
        items={[
          {
            id: 'platform-health',
            label: 'Platform health',
            value: String(platformHealth?.status ?? platformHealth?.overallStatus ?? '—'),
            status: String(platformHealth?.status ?? '').includes('degraded') ? 'warning' : 'nominal',
          },
          {
            id: 'camera-readiness',
            label: 'Camera readiness score',
            value: `${String(cameraReadiness?.score ?? securityKpis?.cameraHealthScore ?? '—')}%`,
            status: Number(cameraReadiness?.score ?? 100) < 90 ? 'warning' : 'nominal',
          },
          {
            id: 'sensor-readiness',
            label: 'IoT sensor readiness score',
            value: `${String(sensorReadiness?.score ?? securityKpis?.sensorHealthScore ?? '—')}%`,
            status: Number(sensorReadiness?.score ?? 100) < 90 ? 'warning' : 'nominal',
          },
          {
            id: 'connectors',
            label: 'IoT/CCTV connectors',
            value: `${connectedCount}/${iotConnectors.length || connectors.length}`,
          },
          {
            id: 'soc-alerts',
            label: 'SOC alert queue',
            value: String(securitySoc?.alertCount ?? '—'),
            status: Number(securitySoc?.alertCount ?? 0) > 0 ? 'warning' : 'nominal',
          },
        ]}
      />

      <SectionPanel
        title="Integration connectors"
        description="Platform-admin view of IoT gateway and camera/VMS adapters from the integration hub."
      >
        <RecordTable
          columns={[
            { key: 'connector', label: 'Connector' },
            { key: 'layer', label: 'Layer' },
            { key: 'protocols', label: 'Protocols' },
            { key: 'status', label: 'Status' },
            { key: 'connected', label: 'Connected' },
          ]}
          rows={mapRecords(iotConnectors.length ? iotConnectors : connectors, (c) => ({
            connector: String(c.name ?? c.id ?? '—'),
            layer: iotCategoryLabel(c.category),
            protocols: Array.isArray(c.protocols) ? c.protocols.join(', ') : String(c.protocols ?? '—'),
            status: String(c.status ?? '—'),
            connected: c.connected === true || String(c.status) === 'connected' ? 'yes' : 'no',
          }))}
          emptyLabel="No integration connectors returned from the hub."
        />
      </SectionPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="CCTV camera fleet" description="Registered cameras and VMS integration readiness.">
          <RecordTable
            columns={[
              { key: 'camera', label: 'Camera' },
              { key: 'zone', label: 'Zone' },
              { key: 'health', label: 'Health' },
              { key: 'integration', label: 'Integration' },
            ]}
            rows={mapRecords(cameraItems.length ? cameraItems : cameras, (c) => ({
              camera: String(c.label ?? c.name ?? c.id ?? c.cameraId ?? '—'),
              zone: String(c.zoneId ?? '—'),
              health: String(c.health ?? c.status ?? '—'),
              integration: String(c.integrationStatus ?? (c.webhookConfigured ? 'ready' : 'watch')),
            }))}
          />
        </SectionPanel>

        <SectionPanel title="IoT sensor fleet" description="Restricted-zone sensors and IoT gateway bindings.">
          <RecordTable
            columns={[
              { key: 'sensor', label: 'Sensor' },
              { key: 'zone', label: 'Zone' },
              { key: 'health', label: 'Health' },
              { key: 'twin', label: 'Twin linked' },
            ]}
            rows={mapRecords(sensorItems, (s) => ({
              sensor: String(s.label ?? s.id ?? '—'),
              zone: String(s.zoneId ?? '—'),
              health: String(s.health ?? s.integrationStatus ?? '—'),
              twin: s.twinLinked === true ? 'yes' : 'no',
            }))}
            emptyLabel="No IoT sensor readiness records returned."
          />
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="SOC zone status" description="Security operations center summary for monitored zones.">
          <RecordTable
            columns={[
              { key: 'zone', label: 'Zone' },
              { key: 'status', label: 'Status' },
              { key: 'occupancy', label: 'Occupancy' },
            ]}
            rows={mapRecords(socZones, (z) => ({
              zone: String(z.zoneId ?? z.name ?? '—'),
              status: String(z.status ?? '—'),
              occupancy: String(z.occupancy ?? '—'),
            }))}
            emptyLabel="No SOC zone projections returned."
          />
        </SectionPanel>

        <SectionPanel title="Live zone monitoring" description="CQRS occupancy projections from IoT and access telemetry.">
          <RecordTable
            columns={[
              { key: 'zone', label: 'Zone' },
              { key: 'occupancy', label: 'Occupancy' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(liveZones, (z) => ({
              zone: String(z.name ?? z.zoneId ?? '—'),
              occupancy: String(z.occupancy ?? '—'),
              status: String(z.status ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>

      <SectionPanel title="Device readiness summary" description="Aggregate blocked, watch, and ready counts for cameras and sensors.">
        <RecordTable
          columns={[
            { key: 'fleet', label: 'Fleet' },
            { key: 'score', label: 'Score' },
            { key: 'ready', label: 'Ready' },
            { key: 'watch', label: 'Watch' },
            { key: 'blocked', label: 'Blocked' },
          ]}
          rows={[
            {
              fleet: 'CCTV cameras',
              score: String(cameraReadiness?.score ?? '—'),
              ready: String(cameraReadiness?.ready ?? '—'),
              watch: String(cameraReadiness?.watch ?? '—'),
              blocked: String(cameraReadiness?.blocked ?? '—'),
            },
            {
              fleet: 'IoT sensors',
              score: String(sensorReadiness?.score ?? '—'),
              ready: String(sensorReadiness?.ready ?? '—'),
              watch: String(sensorReadiness?.watch ?? '—'),
              blocked: String(sensorReadiness?.blocked ?? '—'),
            },
          ]}
        />
      </SectionPanel>
    </div>
  );
}
