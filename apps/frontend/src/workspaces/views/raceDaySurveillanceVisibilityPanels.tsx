import type { RaceDaySurveillanceVisibilityWorkspaceDto } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';

export function RaceDaySurveillanceVisibilityPanel({
  visibility,
}: {
  visibility: RaceDaySurveillanceVisibilityWorkspaceDto | undefined;
}): ReactElement {
  if (!visibility) {
    return (
      <SectionPanel
        title="CCTV & IoT race-day visibility"
        description="Surveillance health and operational alerts for race-day zones."
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          Race-day surveillance visibility is unavailable — reload the readiness dashboard feed.
        </p>
      </SectionPanel>
    );
  }

  const summary = visibility.summary;

  return (
    <div className="space-y-4">
      <SectionPanel
        title="CCTV & IoT race-day visibility"
        description="Operational awareness for paddock, starting gate, and trackside cameras; zone readiness devices; environmental and crowd placeholders; and disruption alerts linked to monitored zones. Metadata only — no unrestricted playback."
      >
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">{visibility.visibilityNotice}</p>
        <KpiStrip
          items={[
            { id: 'paddock-cams', label: 'Paddock cameras', value: String(summary.paddockCameras) },
            { id: 'gate-cams', label: 'Starting gate cameras', value: String(summary.startingGateCameras) },
            { id: 'track-cams', label: 'Trackside cameras', value: String(summary.tracksideCameras) },
            { id: 'devices', label: 'Zone readiness devices', value: String(summary.zoneReadinessDevices) },
            {
              id: 'alerts',
              label: 'Open disruption alerts',
              value: String(summary.openDisruptionAlerts),
              status: summary.openDisruptionAlerts > 0 ? 'warning' : 'nominal',
            },
            {
              id: 'critical',
              label: 'Critical alerts',
              value: String(summary.criticalDisruptionAlerts),
              status: summary.criticalDisruptionAlerts > 0 ? 'critical' : 'nominal',
            },
            {
              id: 'offline',
              label: 'Blocked devices',
              value: String(summary.offlineDevices),
              status: summary.offlineDevices > 0 ? 'warning' : 'nominal',
            },
          ]}
        />
      </SectionPanel>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionPanel title="Paddock cameras" description="Cameras covering paddock movement and gate readiness correlation.">
          <RecordTable
            columns={[
              { key: 'camera', label: 'Camera' },
              { key: 'health', label: 'Health' },
              { key: 'zone', label: 'Zone' },
            ]}
            rows={visibility.paddockCameras.map((camera) => ({
              camera: `${camera.label} (no playback)`,
              health: `${camera.health} / ${camera.status}`,
              zone: camera.operationalZoneLabel ?? '—',
            }))}
            emptyLabel="No paddock cameras correlated in the race-day projection."
          />
        </SectionPanel>

        <SectionPanel title="Starting gate cameras" description="Starting gate and chute camera health metadata.">
          <RecordTable
            columns={[
              { key: 'camera', label: 'Camera' },
              { key: 'health', label: 'Health' },
              { key: 'zone', label: 'Zone' },
            ]}
            rows={visibility.startingGateCameras.map((camera) => ({
              camera: `${camera.label} (no playback)`,
              health: `${camera.health} / ${camera.status}`,
              zone: camera.operationalZoneLabel ?? '—',
            }))}
            emptyLabel="No starting gate cameras assigned in operational zone mapping."
          />
        </SectionPanel>

        <SectionPanel title="Trackside cameras" description="Main oval and track-surface perimeter camera health.">
          <RecordTable
            columns={[
              { key: 'camera', label: 'Camera' },
              { key: 'health', label: 'Health' },
              { key: 'zone', label: 'Zone' },
            ]}
            rows={visibility.tracksideCameras.map((camera) => ({
              camera: `${camera.label} (no playback)`,
              health: `${camera.health} / ${camera.status}`,
              zone: camera.operationalZoneLabel ?? '—',
            }))}
            emptyLabel="No trackside cameras correlated in the race-day projection."
          />
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Zone readiness devices" description="IoT sensors, gateways, and hardware posture across race-day operational zones.">
          <RecordTable
            columns={[
              { key: 'device', label: 'Device' },
              { key: 'zone', label: 'Zone' },
              { key: 'posture', label: 'Readiness' },
              { key: 'health', label: 'Health' },
            ]}
            rows={visibility.zoneReadinessDevices.slice(0, 16).map((device) => ({
              device: device.label,
              zone: device.operationalZoneLabel,
              posture: device.readinessPosture,
              health: `${device.health} / ${device.status}`,
            }))}
            emptyLabel="No zone readiness devices mapped for race-day operations."
          />
        </SectionPanel>

        <SectionPanel title="Monitored zones" description="Operational zone health summary with device coverage and open alerts.">
          <RecordTable
            columns={[
              { key: 'zone', label: 'Zone' },
              { key: 'kind', label: 'Kind' },
              { key: 'coverage', label: 'Coverage' },
              { key: 'alerts', label: 'Alerts' },
            ]}
            rows={visibility.monitoredZones.map((zone) => ({
              zone: zone.zoneLabel,
              kind: zone.zoneKind,
              coverage: `${zone.coveragePct}% (${zone.cameraCount} cam / ${zone.iotDeviceCount} IoT)`,
              alerts: String(zone.openAlertCount),
            }))}
            emptyLabel="No race-day operational zones in surveillance mapping."
          />
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Weather / environmental placeholders" description="Readiness-safe contracts for weather and environmental sensor correlation.">
          <RecordTable
            columns={[
              { key: 'title', label: 'Placeholder' },
              { key: 'zones', label: 'Related zones' },
              { key: 'notice', label: 'Notice' },
            ]}
            rows={visibility.weatherEnvironmentalPlaceholders.map((placeholder) => ({
              title: placeholder.title,
              zones: placeholder.relatedZoneIds.join(', '),
              notice: placeholder.placeholderNotice,
            }))}
            emptyLabel="No weather/environmental placeholder contracts defined."
          />
        </SectionPanel>

        <SectionPanel title="Crowd / queue / congestion placeholders" description="Reserved contracts for guest-flow and queue monitoring.">
          <RecordTable
            columns={[
              { key: 'title', label: 'Placeholder' },
              { key: 'devices', label: 'Related devices' },
              { key: 'notice', label: 'Notice' },
            ]}
            rows={visibility.crowdQueuePlaceholders.map((placeholder) => ({
              title: placeholder.title,
              devices: placeholder.relatedDeviceIds.join(', ') || '—',
              notice: placeholder.placeholderNotice,
            }))}
            emptyLabel="No crowd/queue placeholder contracts defined."
          />
        </SectionPanel>
      </div>

      <SectionPanel title="Race-day disruption alerts" description="Surveillance and IoT alerts linked to monitored race-day zones.">
        <RecordTable
          columns={[
            { key: 'alert', label: 'Alert' },
            { key: 'category', label: 'Category' },
            { key: 'severity', label: 'Severity' },
            { key: 'zone', label: 'Zone' },
            { key: 'triggered', label: 'Triggered' },
          ]}
          rows={visibility.disruptionAlerts.slice(0, 20).map((alert) => ({
            alert: alert.placeholderDerived ? `${alert.title} (placeholder)` : alert.title,
            category: alert.disruptionCategory,
            severity: alert.severity,
            zone: alert.monitoredZoneLabel ?? '—',
            triggered: alert.triggeredAt,
          }))}
          emptyLabel="No race-day disruption alerts in the current projection."
        />
      </SectionPanel>
    </div>
  );
}
