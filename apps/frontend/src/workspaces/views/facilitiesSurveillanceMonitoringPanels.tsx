import type { FacilitiesSurveillanceMonitoringWorkspaceDto } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';

export function FacilitiesSurveillanceMonitoringPanel({
  monitoring,
}: {
  monitoring: FacilitiesSurveillanceMonitoringWorkspaceDto | undefined;
}): ReactElement {
  if (!monitoring) {
    return (
      <SectionPanel
        title="CCTV & IoT facility monitoring"
        description="Facility-scoped device monitoring could not be loaded."
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          Facilities managers can view cameras and sensors here without platform administration access.
        </p>
      </SectionPanel>
    );
  }

  const summary = monitoring.summary;

  return (
    <div className="space-y-4">
      <SectionPanel
        title="CCTV & IoT facility monitoring"
        description="Facility-scoped cameras, sensors, and alerts for utilities, barn/stable, gate hardware, track infrastructure, environmental conditions, maintenance outages, and inspection evidence."
      >
        <KpiStrip
          items={[
            { id: 'devices', label: 'Scoped devices', value: String(summary.scopedDevices) },
            {
              id: 'offline',
              label: 'Offline / critical',
              value: String(summary.offlineDevices),
              status: summary.offlineDevices > 0 ? 'warning' : 'nominal',
            },
            {
              id: 'alerts',
              label: 'Open facility alerts',
              value: String(summary.openFacilityAlerts),
              status: summary.openFacilityAlerts > 0 ? 'warning' : 'nominal',
            },
            { id: 'utilities', label: 'Utilities adapters', value: String(summary.utilitiesAdapters) },
            { id: 'outages', label: 'Maintenance outages', value: String(summary.maintenanceOutages) },
            { id: 'inspection', label: 'Inspection evidence', value: String(summary.inspectionEvidenceRefs) },
          ]}
        />
      </SectionPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Facility-scoped devices" description="Cameras, sensors, and gateways relevant to facilities operations.">
          <RecordTable
            columns={[
              { key: 'device', label: 'Device' },
              { key: 'kind', label: 'Kind' },
              { key: 'health', label: 'Health' },
              { key: 'useCases', label: 'Use cases' },
            ]}
            rows={monitoring.scopedDevices.slice(0, 20).map((device) => ({
              device: device.zoneLabel ? `${device.displayName} (${device.zoneLabel})` : device.displayName,
              kind: device.deviceKind,
              health: `${device.status} / ${device.health}`,
              useCases: device.useCases.join(', '),
            }))}
            emptyLabel="No facility-scoped devices in projection."
          />
        </SectionPanel>

        <SectionPanel title="Utilities monitoring" description="Utilities adapters correlated with IoT device bindings.">
          <RecordTable
            columns={[
              { key: 'adapter', label: 'Adapter' },
              { key: 'kind', label: 'Kind' },
              { key: 'status', label: 'Status' },
              { key: 'notice', label: 'Notice' },
            ]}
            rows={monitoring.utilitiesMonitoring.map((adapter) => ({
              adapter: `${adapter.vendor} — ${adapter.adapterId}`,
              kind: adapter.kind,
              status: adapter.status,
              notice: adapter.coverageNotice ?? 'Nominal',
            }))}
            emptyLabel="No utilities adapters registered."
          />
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Environmental conditions" description="Recent telemetry from facility-scoped sensors.">
          <RecordTable
            columns={[
              { key: 'device', label: 'Device' },
              { key: 'metric', label: 'Metric' },
              { key: 'value', label: 'Value' },
              { key: 'quality', label: 'Quality' },
            ]}
            rows={monitoring.environmentalConditions.slice(0, 15).map((reading) => ({
              device: reading.deviceLabel,
              metric: reading.metric,
              value: `${reading.value} ${reading.unit}`,
              quality: reading.quality,
            }))}
            emptyLabel="No environmental readings available."
          />
        </SectionPanel>

        <SectionPanel title="Facility alert feed" description="Alerts filtered for facilities maintenance, readiness, and outage triage.">
          <RecordTable
            columns={[
              { key: 'alert', label: 'Alert' },
              { key: 'useCase', label: 'Use case' },
              { key: 'severity', label: 'Severity' },
              { key: 'source', label: 'Source' },
            ]}
            rows={monitoring.facilityAlerts.slice(0, 15).map((alert) => ({
              alert: alert.placeholderDerived ? `${alert.title} [placeholder]` : alert.title,
              useCase: alert.useCase,
              severity: alert.severity,
              source: alert.sourceDeviceLabel ?? alert.sourceZoneLabel ?? '—',
            }))}
            emptyLabel="No facility alerts in feed."
          />
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Maintenance-linked device outages" description="Device alerts and offline states linked to open work orders.">
          <RecordTable
            columns={[
              { key: 'outage', label: 'Outage' },
              { key: 'device', label: 'Device' },
              { key: 'workOrder', label: 'Work order' },
              { key: 'severity', label: 'Severity' },
            ]}
            rows={monitoring.maintenanceOutageLinks.slice(0, 12).map((link) => ({
              outage: link.title,
              device: link.deviceLabel,
              workOrder: link.workOrderId ?? '—',
              severity: link.severity,
            }))}
            emptyLabel="No maintenance-linked outages."
          />
        </SectionPanel>

        <SectionPanel title="Inspection-linked device evidence" description="Inspection attachments and telemetry references — playback not exposed here.">
          <RecordTable
            columns={[
              { key: 'evidence', label: 'Evidence' },
              { key: 'inspection', label: 'Inspection' },
              { key: 'asset', label: 'Asset' },
              { key: 'device', label: 'Device' },
            ]}
            rows={monitoring.inspectionDeviceEvidence.slice(0, 12).map((ref) => ({
              evidence: ref.title,
              inspection: ref.inspectionId,
              asset: ref.assetId,
              device: ref.deviceId ?? '—',
            }))}
            emptyLabel="No inspection-linked device evidence."
          />
        </SectionPanel>
      </div>
    </div>
  );
}
