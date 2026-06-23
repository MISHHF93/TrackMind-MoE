import type { IoTDeviceDetailOperationalCategory, IoTDeviceDetailWorkspaceDto } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/design/components/badge';
import { Button } from '@/design/components/button';
import { KpiStrip } from '@/design/components/kpi-strip';
import { SectionPanel } from '@/design/components/section-panel';
import { feedData } from '../feedUtils';
import type { WorkspacePanelProps } from './workspacePanelTypes';
import { cn } from '@/lib/utils';

const categoryLabels: Record<IoTDeviceDetailOperationalCategory, string> = {
  environmental: 'Environmental',
  facilities: 'Facilities',
  security: 'Security',
  operational: 'Operational',
};

function healthBadgeVariant(health: string): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (health === 'healthy') return 'nominal';
  if (health === 'degraded') return 'warning';
  if (health === 'critical') return 'critical';
  return 'secondary';
}

function connectivityBadgeVariant(status: string): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (status === 'connected') return 'nominal';
  if (status === 'degraded') return 'warning';
  if (status === 'disconnected') return 'critical';
  return 'secondary';
}

function alertBadgeVariant(severity: string): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (severity === 'critical' || severity === 'high') return 'critical';
  if (severity === 'medium') return 'warning';
  return 'secondary';
}

function deviceTypeLabel(deviceType: string): string {
  return deviceType.replace(/-/g, ' ');
}

function DetailField({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }): ReactElement {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</dt>
      <dd className={cn('text-sm font-medium', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}

function EmptySection({ message }: { message: string }): ReactElement {
  return <p className="text-sm text-[var(--muted-foreground)]">{message}</p>;
}

export function IoTDeviceDetailPanels({ results }: WorkspacePanelProps): ReactElement {
  const detail = feedData<IoTDeviceDetailWorkspaceDto>(results, '/detail');

  if (!detail) {
    return (
      <SectionPanel title="Device detail unavailable" description="The IoT device detail workspace could not be loaded.">
        <Button size="sm" variant="outline" asChild>
          <Link to="/iot-registry">Back to IoT registry</Link>
        </Button>
      </SectionPanel>
    );
  }

  const identity = detail.identity;
  const openAlerts = detail.activeAlerts.filter((alert) => alert.alertStatus === 'open').length;

  return (
    <div className="space-y-4">
      <SectionPanel
        title={identity.displayName}
        description={`${categoryLabels[detail.operationalCategory]} IoT device — ${identity.deviceId}. Telemetry history uses metadata placeholders; time-series query is not enabled in this workspace.`}
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-registry">Back to registry</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/surveillance-zone-mapping">Zone mapping</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/surveillance-health">Surveillance health</Link>
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary">{categoryLabels[detail.operationalCategory]}</Badge>
          <Badge variant="secondary">{deviceTypeLabel(identity.deviceType)}</Badge>
          <Badge variant={healthBadgeVariant(identity.health)}>{identity.health}</Badge>
          <Badge variant={connectivityBadgeVariant(identity.connectivity)}>{identity.connectivity}</Badge>
          {identity.alertState !== 'clear' ? (
            <Badge variant={identity.alertState === 'critical' ? 'critical' : 'warning'}>{identity.alertState}</Badge>
          ) : null}
        </div>
      </SectionPanel>

      <KpiStrip
        items={[
          { id: 'last-seen', label: 'Last seen', value: new Date(detail.lastSeenAt).toLocaleString() },
          { id: 'telemetry', label: 'Latest telemetry', value: new Date(identity.latestTelemetryAt).toLocaleString() },
          { id: 'alerts', label: 'Active alerts', value: String(openAlerts), status: openAlerts > 0 ? 'warning' : 'nominal' },
          { id: 'rules', label: 'Threshold rules', value: String(detail.thresholdsRules.length) },
          { id: 'maintenance', label: 'Maintenance records', value: String(detail.maintenanceHistory.length) },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Device identity" description="Canonical registry identity and integration metadata.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Device ID" value={identity.deviceId} mono />
            <DetailField label="Display name" value={identity.displayName} />
            <DetailField label="Device type" value={deviceTypeLabel(identity.deviceType)} />
            <DetailField label="Sensor / telemetry type" value={identity.sensorType} />
            <DetailField label="Operational category" value={categoryLabels[detail.operationalCategory]} />
            <DetailField label="Workflow domain" value={identity.assignedWorkflowDomain.replace(/-/g, ' ')} />
            <DetailField label="Asset ID" value={identity.assetId ?? '—'} mono />
            <DetailField label="Digital twin" value={identity.twinId ?? '—'} mono />
            <DetailField label="Gateway" value={identity.gatewayId ?? '—'} mono />
            <DetailField label="Manufacturer" value={identity.manufacturer ?? '—'} />
            <DetailField label="Model" value={identity.model ?? '—'} />
            <DetailField label="Integration" value={identity.integrationStatus} />
          </dl>
        </SectionPanel>

        <SectionPanel title="Zone & facility mapping" description="Device zone, facility context, and operational zone assignments.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Device zone" value={detail.zoneMapping.deviceZoneLabel ?? 'Unassigned'} />
            <DetailField label="Facility" value={detail.zoneMapping.facilityLabel ?? '—'} />
            <DetailField label="Security zone ID" value={detail.zoneMapping.securityZoneId ?? '—'} mono className="sm:col-span-2" />
          </dl>
          {detail.zoneMapping.operationalZones.length === 0 ? (
            <EmptySection message="No operational zone assignments for this device." />
          ) : (
            <ul className="mt-3 space-y-2">
              {detail.zoneMapping.operationalZones.map((zone) => (
                <li key={zone.zoneId} className="flex items-center justify-between rounded-md border border-[var(--border)] p-3 text-sm">
                  <div>
                    <p className="font-medium">{zone.zoneLabel}</p>
                    <p className="text-xs capitalize text-[var(--muted-foreground)]">{zone.zoneKind.replace(/-/g, ' ')}</p>
                  </div>
                  {zone.isPrimary ? <Badge variant="nominal">Primary</Badge> : <Badge variant="secondary">Secondary</Badge>}
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Health state" description="Current health band, connectivity, and diagnostic messages.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Health band" value={detail.health.healthBand} />
            <DetailField label="Device status" value={detail.health.deviceStatus} />
            <DetailField label="Connectivity" value={detail.health.connectivity} />
            <DetailField label="Integration" value={detail.health.integrationStatus} />
            <DetailField label="Health score" value={detail.health.healthScore != null ? String(detail.health.healthScore) : '—'} />
            <DetailField label="Last heartbeat" value={new Date(detail.health.lastHeartbeatAt).toLocaleString()} />
          </dl>
          {detail.health.diagnostics.length === 0 ? (
            <EmptySection message="No active diagnostics." />
          ) : (
            <ul className="mt-3 space-y-2">
              {detail.health.diagnostics.map((diag) => (
                <li key={diag.code} className="rounded-md border border-[var(--border)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{diag.code}</span>
                    <Badge variant={alertBadgeVariant(diag.severity)}>{diag.severity}</Badge>
                  </div>
                  <p className="mt-1">{diag.message}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel title="Latest telemetry snapshot" description="Most recent telemetry capture from snapshot or ingest pipeline.">
          {!detail.latestTelemetrySnapshot ? (
            <EmptySection message="No telemetry snapshot available for this device." />
          ) : (
            <div className="space-y-3">
              <dl className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Captured at" value={new Date(detail.latestTelemetrySnapshot.capturedAt).toLocaleString()} />
                <DetailField label="Source" value={detail.latestTelemetrySnapshot.source.replace(/-/g, ' ')} />
                {detail.latestTelemetrySnapshot.signalStrength != null ? (
                  <DetailField label="Signal strength" value={`${detail.latestTelemetrySnapshot.signalStrength} dBm`} />
                ) : null}
                {detail.latestTelemetrySnapshot.batteryPct != null ? (
                  <DetailField label="Battery" value={`${detail.latestTelemetrySnapshot.batteryPct}%`} />
                ) : null}
                {detail.latestTelemetrySnapshot.firmwareVersion ? (
                  <DetailField label="Firmware" value={detail.latestTelemetrySnapshot.firmwareVersion} />
                ) : null}
                {detail.latestTelemetrySnapshot.quality ? (
                  <DetailField label="Quality" value={detail.latestTelemetrySnapshot.quality} />
                ) : null}
              </dl>
              <div className="rounded-md border border-[var(--border)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Metrics</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {detail.latestTelemetrySnapshot.metrics.map((metric) => (
                    <li key={metric.name} className="flex justify-between gap-2">
                      <span>{metric.name}</span>
                      <span className="font-medium">{String(metric.value)}{metric.unit ? ` ${metric.unit}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Telemetry history (placeholder)" description="Metadata contract for time-series history — query not enabled in this workspace.">
          <dl className="grid gap-3">
            <DetailField label="History window" value={detail.telemetryHistoryPlaceholder.windowLabel} />
            <DetailField label="Endpoint placeholder" value={detail.telemetryHistoryPlaceholder.historyEndpointPlaceholder} mono />
            <DetailField label="Supported metrics" value={detail.telemetryHistoryPlaceholder.supportedMetrics.join(', ')} />
            <DetailField label="Query capable" value={detail.telemetryHistoryPlaceholder.queryCapable ? 'Yes' : 'No (placeholder)'} />
          </dl>
        </SectionPanel>

        <SectionPanel title="Thresholds / rules" description="Evaluation rules and threshold conditions targeting this device or zone.">
          {detail.thresholdsRules.length === 0 ? (
            <EmptySection message="No threshold rules configured for this device." />
          ) : (
            <ul className="space-y-2">
              {detail.thresholdsRules.map((rule) => (
                <li key={rule.ruleId} className="rounded-md border border-[var(--border)] p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{rule.ruleName}</span>
                    <div className="flex gap-2">
                      <Badge variant={rule.enabled ? 'nominal' : 'secondary'}>{rule.enabled ? 'Enabled' : 'Disabled'}</Badge>
                      {rule.approvalRequired ? <Badge variant="warning">Approval required</Badge> : null}
                    </div>
                  </div>
                  <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{rule.conditionExpression}</p>
                  <p className="mt-1 text-xs capitalize">{rule.trigger} → {rule.action}</p>
                  {rule.lastEvaluatedAt ? (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">Last evaluated {new Date(rule.lastEvaluatedAt).toLocaleString()}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Active alerts" description="Open and acknowledged alerts for this device.">
          {detail.activeAlerts.length === 0 ? (
            <EmptySection message="No active alerts for this device." />
          ) : (
            <ul className="space-y-2">
              {detail.activeAlerts.map((alert) => (
                <li key={alert.alertId} className="rounded-md border border-[var(--border)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{alert.title}</span>
                    <Badge variant={alertBadgeVariant(alert.severity)}>{alert.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{alert.alertCode} · {alert.alertStatus}</p>
                  <p className="mt-1">{alert.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel title="Linked incidents" description="Security incidents cross-referenced to this device or zone.">
          {detail.linkedIncidents.length === 0 ? (
            <EmptySection message="No incidents linked to this device." />
          ) : (
            <ul className="space-y-2">
              {detail.linkedIncidents.map((incident) => (
                <li key={incident.incidentReferenceId} className="rounded-md border border-[var(--border)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{incident.title}</span>
                    {incident.operationalImpact ? <Badge variant="critical">Operational impact</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs">{incident.linkageReason}</p>
                  <Button size="sm" variant="outline" className="mt-2" asChild>
                    <Link to={`/incidents?incident=${incident.incidentId}`}>Open incident</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>

      <SectionPanel title="Maintenance history" description="Linked maintenance and work-order records.">
        {detail.maintenanceHistory.length === 0 ? (
          <EmptySection message="No maintenance records for this device." />
        ) : (
          <ul className="space-y-2">
            {detail.maintenanceHistory.map((record) => (
              <li key={record.maintenanceId} className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{record.maintenanceType.replace(/-/g, ' ')}</span>
                  <Badge variant="secondary">{record.maintenanceStatus}</Badge>
                </div>
                <p className="mt-1">{record.notes}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      <SectionPanel title="Audit history" description="Governance and registry audit trail for this device.">
        {detail.auditHistory.length === 0 ? (
          <EmptySection message="No audit records available." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
                <tr>
                  {['When', 'Action', 'Layer', 'Actor', 'Details'].map((label) => (
                    <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.auditHistory.map((entry) => (
                  <tr key={entry.auditId} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{new Date(entry.occurredAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{entry.action}</td>
                    <td className="px-3 py-2 text-xs">{entry.layer ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.actorId ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{entry.details.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
