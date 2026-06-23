import type {
  CctvCameraRegistryEntryDto,
  CctvCameraRegistryWorkspaceDto,
} from '@trackmind/shared';
import { canRoleEditRoute } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { patchJson } from '@/api/client';
import { Badge } from '@/design/components/badge';
import { Button } from '@/design/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design/components/dialog';
import { KpiStrip } from '@/design/components/kpi-strip';
import { SectionPanel } from '@/design/components/section-panel';
import { feedData } from '../feedUtils';
import type { WorkspacePanelProps } from './workspacePanelTypes';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { cn } from '@/lib/utils';
import {
  SurveillanceAdministrationGovernancePanels,
  SurveillanceAdministrationGovernanceSummaryStrip,
} from './surveillanceAdministrationGovernancePanels';
import {
  SURVEILLANCE_GOVERNANCE_SECTION_ID,
  useSurveillanceGovernanceFocus,
} from '../hooks/useSurveillanceGovernanceFocus';
import type { SurveillanceAdministrationGovernanceWorkspaceDto } from '@trackmind/shared';

type RegistryFilters = {
  search: string;
  zoneId: string;
  domain: string;
  health: string;
  streamStatus: string;
  recordingStatus: string;
};

const defaultFilters: RegistryFilters = {
  search: '',
  zoneId: 'all',
  domain: 'all',
  health: 'all',
  streamStatus: 'all',
  recordingStatus: 'all',
};

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

function domainLabel(domain: string): string {
  return domain.replace(/-/g, ' ');
}

function filterEntries(entries: CctvCameraRegistryEntryDto[], filters: RegistryFilters): CctvCameraRegistryEntryDto[] {
  const query = filters.search.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.zoneId !== 'all' && (entry.zoneId ?? 'unassigned') !== filters.zoneId) return false;
    if (filters.domain !== 'all' && entry.assignedDomain !== filters.domain) return false;
    if (filters.health !== 'all' && entry.health !== filters.health) return false;
    if (filters.streamStatus !== 'all' && entry.streamStatus !== filters.streamStatus) return false;
    if (filters.recordingStatus !== 'all' && entry.recordingStatus !== filters.recordingStatus) return false;
    if (!query) return true;
    const haystack = [
      entry.displayName,
      entry.cameraId,
      entry.zoneLabel,
      entry.facilityLabel,
      entry.cameraType,
      entry.integration.manufacturer,
      entry.integration.model,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function groupByZone(entries: CctvCameraRegistryEntryDto[]): Array<{ zoneId: string; zoneLabel: string; entries: CctvCameraRegistryEntryDto[] }> {
  const groups = new Map<string, { zoneId: string; zoneLabel: string; entries: CctvCameraRegistryEntryDto[] }>();
  for (const entry of entries) {
    const zoneId = entry.zoneId ?? 'unassigned';
    const zoneLabel = entry.zoneLabel ?? 'Unassigned';
    const group = groups.get(zoneId) ?? { zoneId, zoneLabel, entries: [] };
    group.entries.push(entry);
    groups.set(zoneId, group);
  }
  return [...groups.values()].sort((a, b) => a.zoneLabel.localeCompare(b.zoneLabel));
}

function CameraDetailDrawer({
  entry,
  open,
  onOpenChange,
  canEdit,
  actorId,
  onUpdated,
}: {
  entry: CctvCameraRegistryEntryDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  actorId: string;
  onUpdated: () => void;
}): ReactElement | null {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [assignedDomain, setAssignedDomain] = useState('');
  const [recordingMode, setRecordingMode] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAuditId, setLastAuditId] = useState<string | null>(null);

  if (!entry) return null;

  const startEdit = () => {
    setDisplayName(entry.displayName);
    setAssignedDomain(entry.assignedDomain);
    setRecordingMode(entry.recordingMode);
    setReason('');
    setError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await patchJson<{ auditId?: string }>(`/surveillance-iot/cameras/${encodeURIComponent(entry.cameraId)}`, {
        displayName,
        assignedDomain,
        recordingMode,
        reason: reason.trim() || `Registry edit by ${actorId}`,
      });
      if (response.status !== 'ready') {
        throw new Error(response.message ?? 'Update failed');
      }
      setLastAuditId(String(response.data?.auditId ?? 'logged'));
      setEditing(false);
      onUpdated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-3xl" governance={canEdit}>
        <DialogHeader>
          <DialogTitle>{entry.displayName}</DialogTitle>
          <DialogDescription>
            Camera ID <span className="font-mono text-xs">{entry.cameraId}</span>
            {entry.facilityLabel ? ` · ${entry.facilityLabel}` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Camera type" value={entry.cameraType} />
          <DetailField label="Zone" value={entry.zoneLabel ?? '—'} />
          <DetailField label="Assigned domain" value={domainLabel(entry.assignedDomain)} />
          <DetailField label="Device status" value={entry.deviceStatus} />
          <DetailField label="Stream status" value={entry.streamStatus} />
          <DetailField label="Health" value={entry.health} />
          <DetailField label="Recording" value={`${entry.recordingStatus} (${entry.recordingMode})`} />
          <DetailField label="Retention policy" value={entry.retentionPolicyLabel ?? entry.retentionPolicyId ?? '—'} />
          <DetailField label="Last seen" value={new Date(entry.lastSeenAt).toLocaleString()} />
          <DetailField label="Integration status" value={entry.integration.integrationStatus} />
        </div>

        <SectionPanel
          title="Firmware / integration metadata"
          description="Vendor-neutral placeholder for adapter firmware, connector, and serial metadata."
          className="border-0 shadow-none"
        >
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <DetailField label="Manufacturer" value={entry.integration.manufacturer ?? '—'} />
            <DetailField label="Model" value={entry.integration.model ?? '—'} />
            <DetailField label="Serial" value={entry.integration.serialNumber ?? '—'} />
            <DetailField label="Adapter" value={entry.integration.adapterId ?? '—'} />
            <DetailField label="Connector" value={entry.integration.connectorId ?? '—'} />
            <DetailField label="Firmware" value={entry.integration.firmwareVersion ?? 'Pending adapter sync'} />
          </dl>
        </SectionPanel>

        <div className="rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--brand-navy)_4%,var(--muted))] p-3 text-xs text-[var(--muted-foreground)]">
          Audit trail ID: <span className="font-mono">{lastAuditId ?? entry.audit.auditId}</span>
          {canEdit ? ' · Edits are governance-logged with actor and reason.' : ' · Read-only for your role on this domain.'}
        </div>

        {editing ? (
          <div className="space-y-3 rounded-md border border-[var(--border)] p-4">
            <p className="text-sm font-medium">Audit-aware edit</p>
            <label className="block text-xs">
              Display name
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label className="block text-xs">
              Assigned domain
              <select
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={assignedDomain}
                onChange={(event) => setAssignedDomain(event.target.value)}
              >
                {['security-soc', 'facilities-iot', 'operations', 'shared'].map((domain) => (
                  <option key={domain} value={domain}>{domainLabel(domain)}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              Recording mode
              <select
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={recordingMode}
                onChange={(event) => setRecordingMode(event.target.value)}
              >
                {['continuous', 'motion', 'scheduled', 'manual', 'disabled'].map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              Change reason (audit)
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why is this registry field changing?"
              />
            </label>
            {error ? <p className="text-xs text-[var(--status-critical)]">{error}</p> : null}
          </div>
        ) : null}

        <DialogFooter>
          {canEdit && entry.canEdit ? (
            editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                <Button variant="governance" onClick={() => { void saveEdit(); }} disabled={saving}>
                  {saving ? 'Saving…' : 'Save with audit'}
                </Button>
              </>
            ) : (
              <Button variant="governance" onClick={startEdit}>Edit registry fields</Button>
            )
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function CameraRegistryTable({
  entries,
  onSelect,
}: {
  entries: CctvCameraRegistryEntryDto[];
  onSelect: (entry: CctvCameraRegistryEntryDto) => void;
}): ReactElement {
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No cameras match the current filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
          <tr>
            {['Name', 'Camera ID', 'Type', 'Stream', 'Health', 'Domain', 'Recording', 'Retention', 'Last seen', ''].map((label) => (
              <th key={label || 'actions'} className="px-3 py-2 text-left font-medium text-[var(--text-strong)]">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.cameraId} className="border-t border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40">
              <td className="px-3 py-2 font-medium">{entry.displayName}</td>
              <td className="px-3 py-2 font-mono text-xs text-[var(--muted-foreground)]">{entry.cameraId}</td>
              <td className="px-3 py-2 capitalize">{entry.cameraType}</td>
              <td className="px-3 py-2">
                <Badge variant={streamBadgeVariant(entry.streamStatus)}>{entry.streamStatus}</Badge>
              </td>
              <td className="px-3 py-2">
                <Badge variant={healthBadgeVariant(entry.health)}>{entry.health}</Badge>
              </td>
              <td className="px-3 py-2 capitalize">{domainLabel(entry.assignedDomain)}</td>
              <td className="px-3 py-2">
                <Badge variant={recordingBadgeVariant(entry.recordingStatus)}>{entry.recordingStatus}</Badge>
              </td>
              <td className="px-3 py-2 text-xs">{entry.retentionPolicyLabel ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                {new Date(entry.lastSeenAt).toLocaleString()}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => onSelect(entry)}>Quick view</Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/cctv-viewer?camera=${encodeURIComponent(entry.cameraId)}`}>Open in viewer</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/cctv-registry/cameras/${encodeURIComponent(entry.cameraId)}`}>Detail page</Link>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CctvDeviceRegistryPanels({ results, role }: WorkspacePanelProps): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const registry = feedData<CctvCameraRegistryWorkspaceDto>(results, '/surveillance-iot/cameras/registry');
  const adminGovernance = feedData<SurveillanceAdministrationGovernanceWorkspaceDto>(
    results,
    '/surveillance-iot/administration/governance/workspace',
  );
  const [filters, setFilters] = useState<RegistryFilters>(defaultFilters);
  const [selected, setSelected] = useState<CctvCameraRegistryEntryDto | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const canEditRoute = role ? canRoleEditRoute(role, 'cctvRegistry') : false;
  const { governanceFocus, governanceSectionRef } = useSurveillanceGovernanceFocus();

  const entries = registry?.entries ?? [];
  const filtered = useMemo(() => filterEntries(entries, filters), [entries, filters]);
  const grouped = useMemo(() => groupByZone(filtered), [filtered]);

  const onlineCount = entries.filter((entry) => entry.deviceStatus === 'online').length;
  const degradedCount = entries.filter((entry) => entry.health === 'degraded').length;
  const recordingActive = entries.filter((entry) => entry.recordingStatus === 'active').length;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['workspace'] });
  };

  const governanceSection = (
    <div ref={governanceSectionRef}>
      <SurveillanceAdministrationGovernancePanels
        results={results}
        sectionId={SURVEILLANCE_GOVERNANCE_SECTION_ID}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {governanceFocus ? governanceSection : null}
      <SectionPanel
        title="CCTV device registry"
        description="Canonical camera fleet listing for platform admins, racetrack admins, and security/facilities managers. Search, filter, and open audit-aware detail edits."
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/cctv-viewer">CCTV viewer</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-monitoring">IoT & CCTV monitoring</Link>
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
      </SectionPanel>

      <SurveillanceAdministrationGovernanceSummaryStrip governance={adminGovernance} />

      <KpiStrip
        items={[
          { id: 'cameras', label: 'Registered cameras', value: String(entries.length) },
          { id: 'online', label: 'Online', value: String(onlineCount), status: onlineCount === entries.length ? 'nominal' : 'warning' },
          { id: 'degraded', label: 'Degraded health', value: String(degradedCount), status: degradedCount > 0 ? 'warning' : 'nominal' },
          { id: 'recording', label: 'Active recording', value: String(recordingActive) },
          { id: 'zones', label: 'Zone groups', value: String(registry?.zoneGroups.length ?? 0) },
        ]}
      />

      <SectionPanel title="Search & filters" description="Narrow the registry by zone, domain, health, stream, or recording posture.">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <FilterInput label="Search" value={filters.search} onChange={(search) => setFilters((prev) => ({ ...prev, search }))} placeholder="Name, ID, zone…" />
          <FilterSelect
            label="Zone"
            value={filters.zoneId}
            onChange={(zoneId) => setFilters((prev) => ({ ...prev, zoneId }))}
            options={[{ value: 'all', label: 'All zones' }, ...(registry?.filterOptions.zones.map((zone) => ({ value: zone.id, label: zone.label })) ?? [])]}
          />
          <FilterSelect
            label="Domain"
            value={filters.domain}
            onChange={(domain) => setFilters((prev) => ({ ...prev, domain }))}
            options={[{ value: 'all', label: 'All domains' }, ...(registry?.filterOptions.domains.map((domain) => ({ value: domain, label: domainLabel(domain) })) ?? [])]}
          />
          <FilterSelect
            label="Health"
            value={filters.health}
            onChange={(health) => setFilters((prev) => ({ ...prev, health }))}
            options={[{ value: 'all', label: 'All health' }, ...(registry?.filterOptions.healthBands.map((health) => ({ value: health, label: health })) ?? [])]}
          />
          <FilterSelect
            label="Stream"
            value={filters.streamStatus}
            onChange={(streamStatus) => setFilters((prev) => ({ ...prev, streamStatus }))}
            options={[{ value: 'all', label: 'All streams' }, ...(registry?.filterOptions.streamStatuses.map((status) => ({ value: status, label: status })) ?? [])]}
          />
          <FilterSelect
            label="Recording"
            value={filters.recordingStatus}
            onChange={(recordingStatus) => setFilters((prev) => ({ ...prev, recordingStatus }))}
            options={[{ value: 'all', label: 'All recording' }, ...(registry?.filterOptions.recordingStatuses.map((status) => ({ value: status, label: status })) ?? [])]}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>Reset filters</Button>
          <span className="self-center text-xs text-[var(--muted-foreground)]">{filtered.length} of {entries.length} cameras</span>
        </div>
      </SectionPanel>

      {grouped.map((group) => (
        <SectionPanel
          key={group.zoneId}
          title={group.zoneLabel}
          description={`${group.entries.length} camera${group.entries.length === 1 ? '' : 's'} in this zone group.`}
        >
          <CameraRegistryTable
            entries={group.entries}
            onSelect={(entry) => {
              setSelected(entry);
              setDrawerOpen(true);
            }}
          />
        </SectionPanel>
      ))}

      <CameraDetailDrawer
        entry={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        canEdit={canEditRoute}
        actorId={session.userId ?? session.sessionKey}
        onUpdated={refresh}
      />

      {!governanceFocus ? governanceSection : null}
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}): ReactElement {
  return (
    <label className={cn('block text-xs font-medium')}>
      {label}
      <input
        className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}): ReactElement {
  return (
    <label className="block text-xs font-medium">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
