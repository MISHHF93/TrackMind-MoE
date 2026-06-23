import type { SecuritySurveillanceIntegrationWorkspaceDto } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { KpiStrip } from '@/design/components/kpi-strip';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';

export function SecuritySurveillanceIntegrationPanel({
  integration,
}: {
  integration: SecuritySurveillanceIntegrationWorkspaceDto | undefined;
}): ReactElement | null {
  if (!integration) {
    return (
      <SectionPanel
        title="CCTV & IoT surveillance integration"
        description="Surveillance alert integration is unavailable — reload the security workspace."
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          Security managers can view alerts and linked devices here without platform administration access.
        </p>
      </SectionPanel>
    );
  }

  const summary = integration.summary;

  return (
    <div className="space-y-4">
      <SectionPanel
        title="CCTV & IoT surveillance integration"
        description="Security-scoped view of surveillance alerts, restricted-zone camera coverage, access sensor events, incident device linkage, and evidence references."
      >
        <KpiStrip
          items={[
            {
              id: 'open-alerts',
              label: 'Open surveillance alerts',
              value: String(summary.openSurveillanceAlerts),
              status: summary.openSurveillanceAlerts > 0 ? 'warning' : 'nominal',
            },
            {
              id: 'critical-alerts',
              label: 'Critical alerts',
              value: String(summary.criticalSurveillanceAlerts),
              status: summary.criticalSurveillanceAlerts > 0 ? 'critical' : 'nominal',
            },
            {
              id: 'zone-coverage',
              label: 'Zones with camera coverage',
              value: String(summary.restrictedZonesWithCoverage),
            },
            {
              id: 'access-events',
              label: 'Access sensor events',
              value: String(summary.accessSensorEvents),
            },
            {
              id: 'incident-links',
              label: 'Incidents with device linkage',
              value: String(summary.incidentsWithDeviceLinkage),
            },
            {
              id: 'evidence',
              label: 'Evidence references',
              value: String(summary.evidenceReferences),
            },
          ]}
        />
      </SectionPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Restricted-zone camera coverage" description="Assigned cameras per restricted zone with health and coverage tags.">
          <RecordTable
            columns={[
              { key: 'zone', label: 'Zone' },
              { key: 'cameras', label: 'Cameras' },
              { key: 'notice', label: 'Coverage notice' },
            ]}
            rows={integration.restrictedZoneCameraCoverage.slice(0, 12).map((zone) => ({
              zone: `${zone.zoneName} (${zone.classification})`,
              cameras: zone.cameras.map((camera) => `${camera.label} [${camera.health}]`).join('; ') || '—',
              notice: zone.coverageGapNotice ?? 'Nominal coverage assignment',
            }))}
            emptyLabel="No restricted zones with camera assignments."
          />
        </SectionPanel>

        <SectionPanel title="Access-related sensor events" description="Credential denials, door contacts, and threshold breaches correlated to zones.">
          <RecordTable
            columns={[
              { key: 'event', label: 'Event' },
              { key: 'zone', label: 'Zone' },
              { key: 'severity', label: 'Severity' },
              { key: 'time', label: 'Time' },
            ]}
            rows={integration.accessRelatedSensorEvents.slice(0, 12).map((event) => ({
              event: event.sensorLabel ? `${event.eventKind} — ${event.sensorLabel}: ${event.detail}` : `${event.eventKind}: ${event.detail}`,
              zone: event.zoneName,
              severity: event.severity,
              time: new Date(event.occurredAt).toLocaleString(),
            }))}
            emptyLabel="No access-related sensor events."
          />
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Surveillance alert feed" description="Security-relevant alerts from CCTV and IoT pipelines.">
          <RecordTable
            columns={[
              { key: 'alert', label: 'Alert' },
              { key: 'kind', label: 'Kind' },
              { key: 'source', label: 'Source' },
              { key: 'status', label: 'Status' },
            ]}
            rows={integration.surveillanceAlerts.slice(0, 15).map((alert) => ({
              alert: alert.title,
              kind: alert.ruleKind,
              source: alert.sourceDeviceLabel ?? alert.sourceZoneLabel ?? '—',
              status: `${alert.severity} / ${alert.resolutionStatus}`,
            }))}
            emptyLabel="No surveillance alerts in the security feed."
          />
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Incident device linkage" description="Cameras and sensors linked to security incidents by zone correlation.">
          <RecordTable
            columns={[
              { key: 'incident', label: 'Incident' },
              { key: 'zone', label: 'Zone' },
              { key: 'cameras', label: 'Cameras' },
              { key: 'sensors', label: 'Sensors' },
            ]}
            rows={integration.incidentDeviceLinkages.slice(0, 12).map((link) => ({
              incident: `${link.incidentTitle} (${link.severity})`,
              zone: link.zoneName,
              cameras: link.linkedCameraIds.join(', ') || '—',
              sensors: link.linkedSensorIds.join(', ') || '—',
            }))}
            emptyLabel="No incidents with device linkage."
          />
        </SectionPanel>

        <SectionPanel title="Incident evidence references" description="Video, access audit, and device alert evidence tied to incidents.">
          <RecordTable
            columns={[
              { key: 'evidence', label: 'Evidence' },
              { key: 'kind', label: 'Kind' },
              { key: 'incident', label: 'Incident' },
              { key: 'captured', label: 'Captured' },
              { key: 'viewer', label: 'Viewer' },
            ]}
            rows={integration.incidentEvidenceReferences.slice(0, 12).map((ref) => ({
              evidence: ref.title,
              kind: ref.kind,
              incident: ref.incidentId,
              captured: ref.capturedAt ? new Date(ref.capturedAt).toLocaleString() : '—',
              viewer: ref.kind === 'video-evidence' ? (
                <Link className="text-sm underline" to={`/cctv-viewer?tab=recorded&clip=${encodeURIComponent(`recorded-clip:${ref.evidenceReferenceId}`)}`}>
                  Open in viewer
                </Link>
              ) : ref.cameraId ? (
                <Link className="text-sm underline" to={`/cctv-viewer?tab=live&camera=${encodeURIComponent(ref.cameraId)}`}>
                  Live camera
                </Link>
              ) : '—',
            }))}
            emptyLabel="No evidence references linked to incidents."
          />
        </SectionPanel>
      </div>
    </div>
  );
}
