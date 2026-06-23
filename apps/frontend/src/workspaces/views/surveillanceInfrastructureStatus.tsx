import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { KpiItem } from '@/design/components/kpi-strip';
import { KpiStrip } from '@/design/components/kpi-strip';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

export interface SurveillanceInfrastructureMetrics {
  totalCameras: number;
  onlineCameras: number;
  degradedCameras: number;
  offlineCameras: number;
  totalIotDevices: number;
  healthyIotDevices: number;
  degradedIotDevices: number;
  disconnectedGateways: number;
  totalGateways: number;
  activeSurveillanceAlerts: number;
  unreviewedVideoLinkedIncidents: number;
  storageRecordingHealthPct: number;
  streamIngestionHealthPct: number;
}

function classifyDevice(record: Record<string, unknown>): 'online' | 'degraded' | 'offline' {
  const status = String(record.status ?? '');
  const health = String(record.health ?? '');
  if (status === 'offline' || status === 'retired' || health === 'critical' || health === 'unknown') return 'offline';
  if (status === 'degraded' || status === 'maintenance' || status === 'standby' || health === 'degraded') return 'degraded';
  return 'online';
}

function countDevices(records: Record<string, unknown>[], bucket: 'online' | 'degraded' | 'offline'): number {
  return records.filter((record) => classifyDevice(record) === bucket).length;
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 100;
  return Math.round((numerator / denominator) * 100);
}

export function deriveSurveillanceInfrastructureMetrics(
  results: WorkspaceDataResult[],
): SurveillanceInfrastructureMetrics {
  const workspace = feedData<Record<string, unknown>>(results, '/surveillance-iot/workspace');
  const monitoring = feedData<Record<string, unknown>>(results, '/surveillance-iot/monitoring/workspace');
  const alerting = feedData<Record<string, unknown>>(results, '/surveillance-iot/alerting/workspace');
  const evidence = feedData<Record<string, unknown>>(results, '/surveillance-iot/evidence/workspace');

  const cameras = extractArray<Record<string, unknown>>(workspace, 'cameras');
  const iotDevices = extractArray<Record<string, unknown>>(workspace, 'iotDevices');
  const gateways = extractArray<Record<string, unknown>>(workspace, 'gateways');
  const openAlerts = extractArray<Record<string, unknown>>(workspace, 'openAlerts');
  const alertingOpen = extractArray<Record<string, unknown>>(alerting, 'openAlerts');
  const incidentReferences = extractArray<Record<string, unknown>>(workspace, 'incidentReferences');
  const evidenceIncidents = extractArray<Record<string, unknown>>(evidence, 'incidentReferences');
  const videoEvidence = extractArray<Record<string, unknown>>(workspace, 'videoEvidence');
  const evidenceClips = extractArray<Record<string, unknown>>(evidence, 'videoEvidence');
  const videoStreams = extractArray<Record<string, unknown>>(monitoring, 'videoStreams').length
    ? extractArray<Record<string, unknown>>(monitoring, 'videoStreams')
    : extractArray<Record<string, unknown>>(workspace, 'videoStreams');
  const retentionPolicies = extractArray<Record<string, unknown>>(workspace, 'retentionPolicies');
  const adapterSnapshot = monitoring?.adapterSnapshot as Record<string, unknown> | undefined;
  const streamHealth = extractArray<Record<string, unknown>>(adapterSnapshot, 'streamHealth');

  const alertSummary = alerting?.alertSummary as Record<string, unknown> | undefined;
  const activeSurveillanceAlerts =
    typeof alertSummary?.open === 'number'
      ? alertSummary.open
      : openAlerts.filter((alert) => String(alert.alertStatus ?? 'open') === 'open').length
        || alertingOpen.filter((alert) => String(alert.alertStatus ?? 'open') === 'open').length;

  const linkedIncidentIds = new Set(
    [...videoEvidence, ...evidenceClips]
      .map((clip) => String(clip.incidentId ?? ''))
      .filter(Boolean),
  );
  const unreviewedVideoLinkedIncidents = linkedIncidentIds.size
    || (evidenceIncidents.length ? evidenceIncidents : incidentReferences).filter(
      (incident) => extractArray(incident, 'evidencePackageIds').length > 0,
    ).length;

  const recordingActiveStreams = videoStreams.filter((stream) => stream.recordingActive === true).length;
  const storageRecordingHealthPct = retentionPolicies.length
    ? pct(recordingActiveStreams, Math.max(videoStreams.length, 1))
    : pct(recordingActiveStreams, Math.max(videoStreams.length, 1));

  const liveStreams = videoStreams.filter((stream) => String(stream.streamStatus ?? '') === 'live').length;
  const adapterLive = streamHealth.filter((entry) => String(entry.streamStatus ?? '') === 'live').length;
  const streamDenominator = Math.max(videoStreams.length, streamHealth.length, 1);
  const streamNumerator = Math.max(liveStreams, adapterLive);
  const streamIngestionHealthPct = pct(streamNumerator, streamDenominator);

  const disconnectedGateways = gateways.filter((gateway) => {
    const status = String(gateway.status ?? '');
    const integration = String(gateway.integrationStatus ?? '');
    return status === 'offline' || integration === 'blocked' || status === 'retired';
  }).length;

  return {
    totalCameras: cameras.length,
    onlineCameras: countDevices(cameras, 'online'),
    degradedCameras: countDevices(cameras, 'degraded'),
    offlineCameras: countDevices(cameras, 'offline'),
    totalIotDevices: iotDevices.length,
    healthyIotDevices: countDevices(iotDevices, 'online'),
    degradedIotDevices: countDevices(iotDevices, 'degraded'),
    disconnectedGateways,
    totalGateways: gateways.length,
    activeSurveillanceAlerts,
    unreviewedVideoLinkedIncidents,
    storageRecordingHealthPct,
    streamIngestionHealthPct,
  };
}

function cardStatus(value: number, warningAt: number, criticalAt: number): KpiItem['status'] {
  if (value >= criticalAt) return 'critical';
  if (value >= warningAt) return 'warning';
  return 'nominal';
}

function pctStatus(value: number): KpiItem['status'] {
  if (value < 70) return 'critical';
  if (value < 90) return 'warning';
  return 'nominal';
}

export function surveillanceInfrastructureKpiItems(metrics: SurveillanceInfrastructureMetrics): KpiItem[] {
  return [
    {
      id: 'total-cameras',
      label: 'Total cameras',
      value: String(metrics.totalCameras),
      detail: 'CCTV fleet registered platform-wide',
      status: 'nominal',
    },
    {
      id: 'online-cameras',
      label: 'Online cameras',
      value: String(metrics.onlineCameras),
      detail: `${metrics.totalCameras ? pct(metrics.onlineCameras, metrics.totalCameras) : 100}% of fleet`,
      status: cardStatus(metrics.totalCameras - metrics.onlineCameras, 1, 2),
    },
    {
      id: 'degraded-cameras',
      label: 'Degraded cameras',
      value: String(metrics.degradedCameras),
      status: cardStatus(metrics.degradedCameras, 1, 2),
    },
    {
      id: 'offline-cameras',
      label: 'Offline cameras',
      value: String(metrics.offlineCameras),
      status: cardStatus(metrics.offlineCameras, 1, 1),
    },
    {
      id: 'total-iot-devices',
      label: 'Total IoT devices',
      value: String(metrics.totalIotDevices),
      detail: 'Sensors and actuators on platform gateways',
      status: 'nominal',
    },
    {
      id: 'healthy-iot-devices',
      label: 'Healthy IoT devices',
      value: String(metrics.healthyIotDevices),
      detail: `${metrics.totalIotDevices ? pct(metrics.healthyIotDevices, metrics.totalIotDevices) : 100}% of fleet`,
      status: cardStatus(metrics.totalIotDevices - metrics.healthyIotDevices, 1, 2),
    },
    {
      id: 'degraded-iot-devices',
      label: 'Degraded IoT devices',
      value: String(metrics.degradedIotDevices),
      status: cardStatus(metrics.degradedIotDevices, 1, 2),
    },
    {
      id: 'disconnected-gateways',
      label: 'Disconnected gateways',
      value: `${metrics.disconnectedGateways}/${metrics.totalGateways || 0}`,
      status: cardStatus(metrics.disconnectedGateways, 1, 1),
    },
    {
      id: 'active-surveillance-alerts',
      label: 'Active surveillance alerts',
      value: String(metrics.activeSurveillanceAlerts),
      status: cardStatus(metrics.activeSurveillanceAlerts, 1, 3),
    },
    {
      id: 'unreviewed-video-incidents',
      label: 'Unreviewed video-linked incidents',
      value: String(metrics.unreviewedVideoLinkedIncidents),
      status: cardStatus(metrics.unreviewedVideoLinkedIncidents, 1, 2),
    },
    {
      id: 'storage-recording-health',
      label: 'Storage / recording health',
      value: `${metrics.storageRecordingHealthPct}%`,
      detail: 'Streams with active recording and retention policy coverage',
      status: pctStatus(metrics.storageRecordingHealthPct),
    },
    {
      id: 'stream-ingestion-health',
      label: 'Stream ingestion health',
      value: `${metrics.streamIngestionHealthPct}%`,
      detail: 'Live stream and adapter ingestion posture',
      status: pctStatus(metrics.streamIngestionHealthPct),
    },
  ];
}

export function SurveillanceInfrastructureStatusPanel({
  results,
  showHierarchy = true,
  showActions = true,
}: {
  results: WorkspaceDataResult[];
  showHierarchy?: boolean;
  showActions?: boolean;
}): ReactElement {
  const metrics = deriveSurveillanceInfrastructureMetrics(results);
  const items = surveillanceInfrastructureKpiItems(metrics);

  return (
    <SectionPanel
      title="Platform infrastructure — CCTV & IoT"
      description="Top-tier System Status for cameras, IoT devices, gateways, recording, and stream ingestion. Platform-wide infrastructure visibility — not limited to the security console."
    >
      {showHierarchy ? (
        <ol className="mb-4 space-y-1 text-sm text-[var(--muted-foreground)]">
          <li><strong className="text-[var(--foreground)]">Tier 1 — Platform infrastructure</strong> — camera, IoT, gateway, recording, and ingestion health (this view)</li>
          <li><strong className="text-[var(--foreground)]">Tier 2 — Integration adapters</strong> — connector catalog and protocol bridges</li>
          <li><strong className="text-[var(--foreground)]">Tier 3 — Operational domains</strong> — security SOC, facilities IoT, and incident evidence workflows</li>
        </ol>
      ) : null}
      {showActions ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-monitoring">IoT &amp; CCTV monitoring</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin">Platform administration</Link>
          </Button>
        </div>
      ) : null}
      <KpiStrip items={items} className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" />
    </SectionPanel>
  );
}
