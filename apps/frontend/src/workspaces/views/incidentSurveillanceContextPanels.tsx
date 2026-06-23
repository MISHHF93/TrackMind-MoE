import type { IncidentSurveillanceContextWorkspaceDto } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { KpiStrip } from '@/design/components/kpi-strip';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';

export function IncidentSurveillanceContextPanel({
  context,
}: {
  context: IncidentSurveillanceContextWorkspaceDto | undefined;
}): ReactElement {
  if (!context) {
    return (
      <SectionPanel
        title="Surveillance & IoT evidence context"
        description="Metadata-only linkage for cameras, devices, alerts, telemetry, and evidence references."
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          Surveillance context is unavailable for the focused incident — reload the incident detail feed.
        </p>
      </SectionPanel>
    );
  }

  const summary = context.summary;

  return (
    <div className="space-y-4">
      <SectionPanel
        title="Surveillance & IoT evidence context"
        description="Operational traceability for Incident Command — metadata, evidence linkage, and device-sourced timeline events. Playback is not exposed in this workspace."
      >
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">{context.correlationSummary}</p>
        <KpiStrip
          items={[
            {
              id: 'cameras',
              label: 'Related cameras',
              value: String(summary.relatedCameras),
            },
            {
              id: 'devices',
              label: 'Related IoT devices',
              value: String(summary.relatedIoTDevices),
            },
            {
              id: 'alerts',
              label: 'Linked alerts',
              value: String(summary.linkedSurveillanceAlerts),
              status: summary.linkedSurveillanceAlerts > 0 ? 'warning' : 'nominal',
            },
            {
              id: 'anomalies',
              label: 'Telemetry anomalies',
              value: String(summary.linkedTelemetryAnomalies),
              status: summary.linkedTelemetryAnomalies > 0 ? 'warning' : 'nominal',
            },
            {
              id: 'evidence',
              label: 'Evidence references',
              value: String(summary.evidenceReferences),
            },
            {
              id: 'timeline',
              label: 'Device timeline events',
              value: String(summary.deviceTimelineEvents),
            },
          ]}
        />
      </SectionPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Related cameras" description="Camera registry entries correlated to this incident.">
          <RecordTable
            columns={[
              { key: 'camera', label: 'Camera' },
              { key: 'health', label: 'Health' },
              { key: 'zone', label: 'Zone' },
              { key: 'linkage', label: 'Linkage' },
            ]}
            rows={context.relatedCameras.map((camera) => ({
              camera: `${camera.label} (${camera.cameraId})`,
              health: camera.health,
              zone: camera.zoneLabel ?? camera.securityZoneId ?? '—',
              linkage: camera.linkageReason,
            }))}
            emptyLabel="No cameras correlated to this incident."
          />
        </SectionPanel>

        <SectionPanel title="Related IoT devices" description="Sensors, gateways, and non-camera hardware linked to the incident.">
          <RecordTable
            columns={[
              { key: 'device', label: 'Device' },
              { key: 'kind', label: 'Kind' },
              { key: 'health', label: 'Health' },
              { key: 'linkage', label: 'Linkage' },
            ]}
            rows={context.relatedIoTDevices.map((device) => ({
              device: `${device.label} (${device.deviceId})`,
              kind: device.sensorType ?? device.deviceKind,
              health: device.health,
              linkage: device.linkageReason,
            }))}
            emptyLabel="No IoT devices correlated to this incident."
          />
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Linked surveillance alerts" description="Alert pipeline events tied to incident devices or references.">
          <RecordTable
            columns={[
              { key: 'alert', label: 'Alert' },
              { key: 'severity', label: 'Severity' },
              { key: 'status', label: 'Status' },
              { key: 'triggered', label: 'Triggered' },
            ]}
            rows={context.linkedSurveillanceAlerts.map((alert) => ({
              alert: alert.placeholderDerived ? `${alert.title} (placeholder)` : alert.title,
              severity: alert.severity,
              status: alert.resolutionStatus,
              triggered: alert.triggeredAt,
            }))}
            emptyLabel="No surveillance alerts linked to this incident."
          />
        </SectionPanel>

        <SectionPanel title="Linked telemetry anomalies" description="Sensor readings and snapshots flagged during the incident window.">
          <RecordTable
            columns={[
              { key: 'device', label: 'Device' },
              { key: 'metric', label: 'Metric' },
              { key: 'quality', label: 'Quality' },
              { key: 'observed', label: 'Observed' },
            ]}
            rows={context.linkedTelemetryAnomalies.map((anomaly) => ({
              device: anomaly.deviceLabel,
              metric: `${anomaly.metric}=${String(anomaly.value)}${anomaly.unit ? ` ${anomaly.unit}` : ''}`,
              quality: anomaly.quality,
              observed: anomaly.observedAt,
            }))}
            emptyLabel="No telemetry anomalies correlated to this incident."
          />
        </SectionPanel>
      </div>

      <SectionPanel title="Evidence references" description="Video clips, sensor telemetry, access audits, and device alerts with governed viewer links where playback is available.">
        <RecordTable
          columns={[
            { key: 'reference', label: 'Reference' },
            { key: 'kind', label: 'Kind' },
            { key: 'captured', label: 'Captured' },
            { key: 'linkage', label: 'Linkage' },
            { key: 'viewer', label: 'Viewer' },
          ]}
          rows={context.evidenceReferences.map((evidence) => ({
            reference: evidence.title,
            kind: evidence.kind,
            captured: evidence.capturedAt ?? '—',
            linkage: evidence.linkageReason,
            viewer: evidence.kind === 'video-evidence' ? (
              <Link className="text-sm underline" to={`/cctv-viewer?tab=recorded&clip=${encodeURIComponent(`recorded-clip:${evidence.evidenceReferenceId}`)}`}>
                Open in viewer
              </Link>
            ) : evidence.cameraId ? (
              <Link className="text-sm underline" to={`/cctv-viewer?tab=live&camera=${encodeURIComponent(evidence.cameraId)}`}>
                Live camera
              </Link>
            ) : '—',
          }))}
          emptyLabel="No evidence references linked to this incident."
        />
      </SectionPanel>

      <SectionPanel title="Device-sourced timeline" description="Chronological device and alert events supporting operational traceability (distinct from human incident timeline).">
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'source', label: 'Source' },
            { key: 'event', label: 'Event' },
            { key: 'summary', label: 'Summary' },
          ]}
          rows={context.deviceTimelineEvents.map((event) => ({
            time: event.occurredAt,
            source: `${event.sourceDeviceLabel} (${event.sourceKind})`,
            event: event.eventKind,
            summary: event.summary,
          }))}
          emptyLabel="No device-sourced timeline events for this incident."
        />
      </SectionPanel>
    </div>
  );
}
