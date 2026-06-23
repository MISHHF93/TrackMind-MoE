import type { CctvCameraDetailWorkspaceDto, SurveillanceCctvViewerWorkspaceDto } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/design/components/badge';
import { Button } from '@/design/components/button';
import { CctvStreamPlayer } from '@/design/components/cctv/CctvStreamPlayer';
import { KpiStrip } from '@/design/components/kpi-strip';
import { SectionPanel } from '@/design/components/section-panel';
import { feedData } from '../feedUtils';
import type { WorkspacePanelProps } from './workspacePanelTypes';
import { cn } from '@/lib/utils';

function healthBadgeVariant(health: string): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (health === 'healthy') return 'nominal';
  if (health === 'degraded') return 'warning';
  if (health === 'critical') return 'critical';
  return 'secondary';
}

function streamBadgeVariant(status: string): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (status === 'live') return 'nominal';
  if (status === 'buffering') return 'warning';
  if (status === 'offline' || status === 'archived') return 'critical';
  return 'secondary';
}

function recordingBadgeVariant(status: string): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (status === 'active') return 'nominal';
  if (status === 'paused') return 'warning';
  if (status === 'disabled') return 'critical';
  return 'secondary';
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

export function CctvCameraDetailPanels({ results }: WorkspacePanelProps): ReactElement {
  const detail = feedData<CctvCameraDetailWorkspaceDto>(results, '/detail');
  const viewer = feedData<SurveillanceCctvViewerWorkspaceDto>(results, '/surveillance-iot/viewer/workspace');

  if (!detail) {
    return (
      <SectionPanel title="Camera detail unavailable" description="The camera detail workspace could not be loaded.">
        <Button size="sm" variant="outline" asChild>
          <Link to="/cctv-registry">Back to CCTV registry</Link>
        </Button>
      </SectionPanel>
    );
  }

  const identity = detail.identity;
  const openAlerts = detail.recentAlerts.filter((alert) => alert.alertStatus === 'open').length;
  const viewerTile = viewer?.tiles.find((tile) => tile.cameraId === identity.cameraId);

  return (
    <div className="space-y-4">
      {viewerTile ? (
        <CctvStreamPlayer
          cameraId={viewerTile.cameraId}
          displayName={viewerTile.displayName}
          zoneLabel={viewerTile.zoneLabel}
          streamStatus={viewerTile.streamStatus}
          playbackMode={viewerTile.playbackMode}
          mediaUrl={viewerTile.mediaUrl}
          privacyMaskingEnabled={viewerTile.privacyMaskingEnabled}
          recordingActive={viewerTile.recordingActive}
          ptzCapable={viewerTile.ptzCapable}
          focused
          staticTile
        />
      ) : null}

      <SectionPanel
        title={identity.displayName}
        description={`Camera detail — ${identity.cameraId}`}
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/cctv-registry">Back to registry</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/cctv-viewer?camera=${encodeURIComponent(identity.cameraId)}`}>Open in viewer</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/surveillance-zone-mapping">Zone mapping</Link>
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant={healthBadgeVariant(identity.health)}>{identity.health}</Badge>
          <Badge variant={streamBadgeVariant(identity.streamStatus)}>{identity.streamStatus}</Badge>
          <Badge variant={recordingBadgeVariant(identity.recordingStatus)}>{identity.recordingStatus}</Badge>
          <Badge variant="secondary">{identity.cameraType}</Badge>
          {identity.privacyMaskingEnabled ? <Badge variant="secondary">Privacy masking</Badge> : null}
          {identity.ptzCapable ? <Badge variant="secondary">PTZ</Badge> : null}
        </div>
      </SectionPanel>

      <KpiStrip
        items={[
          { id: 'heartbeat', label: 'Last heartbeat', value: new Date(identity.lastSeenAt).toLocaleString() },
          { id: 'alerts', label: 'Open alerts', value: String(openAlerts), status: openAlerts > 0 ? 'warning' : 'nominal' },
          { id: 'incidents', label: 'Linked incidents', value: String(detail.linkedIncidents.length) },
          { id: 'maintenance', label: 'Maintenance records', value: String(detail.maintenanceHistory.length) },
          { id: 'evidence', label: 'Evidence refs', value: String(detail.linkedEvidence.length) },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Camera identity" description="Canonical registry identity and integration metadata.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Camera ID" value={identity.cameraId} mono />
            <DetailField label="Display name" value={identity.displayName} />
            <DetailField label="Device status" value={identity.deviceStatus} />
            <DetailField label="Assigned domain" value={identity.assignedDomain.replace(/-/g, ' ')} />
            <DetailField label="Asset ID" value={identity.assetId ?? '—'} mono />
            <DetailField label="Digital twin" value={identity.twinId ?? '—'} mono />
            <DetailField label="Manufacturer" value={identity.integration.manufacturer ?? '—'} />
            <DetailField label="Model" value={identity.integration.model ?? '—'} />
            <DetailField label="Serial" value={identity.integration.serialNumber ?? '—'} mono />
            <DetailField label="Integration" value={identity.integration.integrationStatus} />
            <DetailField label="Connector" value={identity.integration.connectorId ?? '—'} />
            <DetailField label="Created" value={new Date(identity.createdAt).toLocaleString()} />
            <DetailField label="Updated" value={new Date(identity.updatedAt).toLocaleString()} />
          </dl>
        </SectionPanel>

        <SectionPanel title="Zone & facility mapping" description="Device zone, facility context, and operational zone assignments.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Device zone" value={detail.zoneMapping.deviceZoneLabel ?? 'Unassigned'} />
            <DetailField label="Facility" value={detail.zoneMapping.facilityLabel ?? '—'} />
            <DetailField label="Security zone ID" value={detail.zoneMapping.securityZoneId ?? '—'} mono className="sm:col-span-2" />
          </dl>
          {detail.zoneMapping.operationalZones.length === 0 ? (
            <EmptySection message="No operational zone assignments for this camera." />
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

      <SectionPanel title="Recording & retention" description="Recording posture and retention policy assignment.">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Recording status" value={detail.recording.recordingStatus} />
            <DetailField label="Recording mode" value={detail.recording.recordingMode} />
            <DetailField label="Recording active" value={detail.recording.recordingActive ? 'Yes' : 'No'} />
            <DetailField
              label="Last recording heartbeat"
              value={detail.recording.lastRecordingHeartbeatAt ? new Date(detail.recording.lastRecordingHeartbeatAt).toLocaleString() : '—'}
            />
          </dl>
          {detail.retentionPolicy ? (
            <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--muted)]/20 p-3">
              <p className="font-medium">{detail.retentionPolicy.policyName}</p>
              <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-[var(--muted-foreground)]">Retention</dt><dd>{detail.retentionPolicy.retentionDays} days</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Disposition</dt><dd>{detail.retentionPolicy.disposition}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Legal hold eligible</dt><dd>{detail.retentionPolicy.legalHoldEligible ? 'Yes' : 'No'}</dd></div>
                <div><dt className="text-[var(--muted-foreground)]">Privacy masking required</dt><dd>{detail.retentionPolicy.privacyMaskingRequired ? 'Yes' : 'No'}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                Frameworks: {detail.retentionPolicy.regulatoryFrameworks.join(', ')}
              </p>
            </div>
          ) : (
            <EmptySection message="No retention policy assigned." />
          )}
      </SectionPanel>

      <SectionPanel title="Assigned operational domains" description="Workflow domains this camera participates in.">
        <ul className="flex flex-wrap gap-2">
          {detail.operationalDomains.map((domain) => (
            <li key={domain.domain} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
              <span className="font-medium">{domain.label}</span>
              {domain.isPrimary ? <Badge className="ml-2" variant="nominal">Primary</Badge> : null}
            </li>
          ))}
        </ul>
      </SectionPanel>

      <SectionPanel title="Health timeline" description="Recent heartbeat, integration, stream, recording, and alert events.">
        {detail.healthTimeline.length === 0 ? (
          <EmptySection message="No health timeline entries available." />
        ) : (
          <ol className="space-y-2">
            {detail.healthTimeline.map((entry) => (
              <li key={`${entry.observedAt}-${entry.eventKind}`} className="flex gap-3 rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="min-w-[120px] text-xs text-[var(--muted-foreground)]">
                  {new Date(entry.observedAt).toLocaleString()}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{entry.eventKind}</Badge>
                    <Badge variant={healthBadgeVariant(entry.healthBand)}>{entry.healthBand}</Badge>
                    {entry.healthScore != null ? <span className="text-xs text-[var(--muted-foreground)]">Score {entry.healthScore}</span> : null}
                  </div>
                  <p className="mt-1">{entry.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Recent alerts" description="Open and recent device alerts for this camera.">
          {detail.recentAlerts.length === 0 ? (
            <EmptySection message="No alerts linked to this camera." />
          ) : (
            <ul className="space-y-2">
              {detail.recentAlerts.map((alert) => (
                <li key={alert.alertId} className="rounded-md border border-[var(--border)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{alert.title}</span>
                    <Badge variant={alert.severity === 'critical' ? 'critical' : 'warning'}>{alert.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{alert.alertCode} · {alert.alertStatus}</p>
                  <p className="mt-1">{alert.detail}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{new Date(alert.triggeredAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel title="Linked incidents" description="Security incidents cross-referenced to this camera or zone.">
          {detail.linkedIncidents.length === 0 ? (
            <EmptySection message="No incidents linked to this camera." />
          ) : (
            <ul className="space-y-2">
              {detail.linkedIncidents.map((incident) => (
                <li key={incident.incidentReferenceId} className="rounded-md border border-[var(--border)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{incident.title}</span>
                    {incident.operationalImpact ? <Badge variant="critical">Operational impact</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs">{incident.linkageReason}</p>
                  <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{incident.incidentId}</p>
                  <Button size="sm" variant="outline" className="mt-2" asChild>
                    <Link to={`/incidents?incident=${incident.incidentId}`}>Open incident</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Linked evidence references" description="Video evidence linked to this camera.">
          {detail.linkedEvidence.length === 0 ? (
            <EmptySection message="No evidence references linked to this camera." />
          ) : (
            <ul className="space-y-2">
              {detail.linkedEvidence.map((evidence) => (
                <li key={evidence.evidenceReferenceId} className="rounded-md border border-[var(--border)] p-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {evidence.legalHold ? <Badge variant="warning">Legal hold</Badge> : null}
                    {evidence.privacyMasked ? <Badge variant="secondary">Privacy masked</Badge> : null}
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    {new Date(evidence.clipStartAt).toLocaleString()} — {new Date(evidence.clipEndAt).toLocaleString()}
                  </p>
                  {evidence.incidentId ? (
                    <p className="mt-1 text-xs">Incident: <span className="font-mono">{evidence.incidentId}</span></p>
                  ) : null}
                  <p className="mt-2">
                    <Link className="text-sm underline" to={`/cctv-viewer?tab=recorded&clip=${encodeURIComponent(`recorded-clip:${evidence.evidenceReferenceId}`)}`}>
                      Open in viewer
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel title="Maintenance history" description="Linked maintenance and work-order records.">
          {detail.maintenanceHistory.length === 0 ? (
            <EmptySection message="No maintenance records for this camera." />
          ) : (
            <ul className="space-y-2">
              {detail.maintenanceHistory.map((record) => (
                <li key={record.maintenanceId} className="rounded-md border border-[var(--border)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">{record.maintenanceType.replace(/-/g, ' ')}</span>
                    <Badge variant="secondary">{record.maintenanceStatus}</Badge>
                  </div>
                  <p className="mt-1">{record.notes}</p>
                  {record.scheduledAt ? (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">Scheduled {new Date(record.scheduledAt).toLocaleString()}</p>
                  ) : null}
                  {record.completedAt ? (
                    <p className="text-xs text-[var(--muted-foreground)]">Completed {new Date(record.completedAt).toLocaleString()}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>

      <SectionPanel title="Audit history" description="Governance and registry audit trail for this camera.">
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
