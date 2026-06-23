import type {
  IoTDeviceRegistryEntryDto,
  IoTDeviceRegistryWorkspaceDto,
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
import { SurveillanceAdministrationGovernancePanels } from './surveillanceAdministrationGovernancePanels';
import {
  SURVEILLANCE_GOVERNANCE_SECTION_ID,
  useSurveillanceGovernanceFocus,
} from '../hooks/useSurveillanceGovernanceFocus';

type RegistryFilters = {
  search: string;
  zoneId: string;
  deviceType: string;
  domain: string;
  health: string;
  connectivity: string;
  alertState: string;
  maintenanceStatus: string;
};

const defaultFilters: RegistryFilters = {
  search: '',
  zoneId: 'all',
  deviceType: 'all',
  domain: 'all',
  health: 'all',
  connectivity: 'all',
  alertState: 'all',
  maintenanceStatus: 'all',
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

function alertBadgeVariant(state: string): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (state === 'clear') return 'nominal';
  if (state === 'acknowledged') return 'warning';
  if (state === 'open') return 'warning';
  if (state === 'critical') return 'critical';
  return 'secondary';
}

function maintenanceBadgeVariant(status: string): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (status === 'none' || status === 'completed') return 'nominal';
  if (status === 'scheduled' || status === 'deferred') return 'warning';
  if (status === 'in-progress') return 'warning';
  if (status === 'cancelled') return 'critical';
  return 'secondary';
}

function domainLabel(domain: string): string {
  return domain.replace(/-/g, ' ');
}

function deviceTypeLabel(type: string): string {
  return type.replace(/-/g, ' ');
}

function filterEntries(entries: IoTDeviceRegistryEntryDto[], filters: RegistryFilters): IoTDeviceRegistryEntryDto[] {
  const query = filters.search.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.zoneId !== 'all' && (entry.zoneId ?? 'unassigned') !== filters.zoneId) return false;
    if (filters.deviceType !== 'all' && entry.deviceType !== filters.deviceType) return false;
    if (filters.domain !== 'all' && entry.assignedWorkflowDomain !== filters.domain) return false;
    if (filters.health !== 'all' && entry.health !== filters.health) return false;
    if (filters.connectivity !== 'all' && entry.connectivity !== filters.connectivity) return false;
    if (filters.alertState !== 'all' && entry.alertState !== filters.alertState) return false;
    if (filters.maintenanceStatus !== 'all' && entry.maintenanceStatus !== filters.maintenanceStatus) return false;
    if (!query) return true;
    const haystack = [
      entry.displayName,
      entry.deviceId,
      entry.zoneLabel,
      entry.facilityLabel,
      entry.deviceType,
      entry.telemetryType,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function groupByZone(entries: IoTDeviceRegistryEntryDto[]): Array<{ zoneId: string; zoneLabel: string; entries: IoTDeviceRegistryEntryDto[] }> {
  const groups = new Map<string, { zoneId: string; zoneLabel: string; entries: IoTDeviceRegistryEntryDto[] }>();
  for (const entry of entries) {
    const zoneId = entry.zoneId ?? 'unassigned';
    const zoneLabel = entry.zoneLabel ?? 'Unassigned';
    const group = groups.get(zoneId) ?? { zoneId, zoneLabel, entries: [] };
    group.entries.push(entry);
    groups.set(zoneId, group);
  }
  return [...groups.values()].sort((a, b) => a.zoneLabel.localeCompare(b.zoneLabel));
}

function DeviceDetailDrawer({
  entry,
  open,
  onOpenChange,
  canEdit,
  actorId,
  onUpdated,
}: {
  entry: IoTDeviceRegistryEntryDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  actorId: string;
  onUpdated: () => void;
}): ReactElement | null {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [assignedWorkflowDomain, setAssignedWorkflowDomain] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAuditId, setLastAuditId] = useState<string | null>(null);

  if (!entry) return null;

  const startEdit = () => {
    setDisplayName(entry.displayName);
    setAssignedWorkflowDomain(entry.assignedWorkflowDomain);
    setReason('');
    setError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await patchJson<{ auditId?: string }>(`/surveillance-iot/devices/${encodeURIComponent(entry.deviceId)}`, {
        displayName,
        assignedWorkflowDomain,
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
            Device ID <span className="font-mono text-xs">{entry.deviceId}</span>
            {entry.facilityLabel ? ` · ${entry.facilityLabel}` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Device type" value={deviceTypeLabel(entry.deviceType)} />
          <DetailField label="Zone" value={entry.zoneLabel ?? '—'} />
          <DetailField label="Workflow domain" value={domainLabel(entry.assignedWorkflowDomain)} />
          <DetailField label="Health" value={entry.health} />
          <DetailField label="Connectivity" value={entry.connectivity} />
          <DetailField label="Integration" value={entry.integrationStatus} />
          <DetailField label="Telemetry type" value={entry.telemetryType} />
          <DetailField label="Value type" value={entry.telemetryValueType} />
          <DetailField label="Latest telemetry" value={new Date(entry.latestTelemetryAt).toLocaleString()} />
          <DetailField label="Alert state" value={`${entry.alertState}${entry.openAlertCount ? ` (${entry.openAlertCount})` : ''}`} />
          <DetailField label="Maintenance" value={entry.maintenanceStatus} />
          <DetailField label="Gateway" value={entry.gatewayId ?? '—'} />
        </div>

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
              Assigned workflow domain
              <select
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={assignedWorkflowDomain}
                onChange={(event) => setAssignedWorkflowDomain(event.target.value)}
              >
                {['security-soc', 'facilities-iot', 'operations', 'shared'].map((domain) => (
                  <option key={domain} value={domain}>{domainLabel(domain)}</option>
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

function DeviceRegistryTable({
  entries,
  onSelect,
}: {
  entries: IoTDeviceRegistryEntryDto[];
  onSelect: (entry: IoTDeviceRegistryEntryDto) => void;
}): ReactElement {
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No devices match the current filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
          <tr>
            {['Name', 'Device ID', 'Type', 'Health', 'Connectivity', 'Telemetry', 'Last reading', 'Alerts', 'Domain', 'Maintenance', ''].map((label) => (
              <th key={label || 'actions'} className="px-3 py-2 text-left font-medium text-[var(--text-strong)]">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.deviceId} className="border-t border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40">
              <td className="px-3 py-2 font-medium">{entry.displayName}</td>
              <td className="px-3 py-2 font-mono text-xs text-[var(--muted-foreground)]">{entry.deviceId}</td>
              <td className="px-3 py-2 capitalize">{deviceTypeLabel(entry.deviceType)}</td>
              <td className="px-3 py-2">
                <Badge variant={healthBadgeVariant(entry.health)}>{entry.health}</Badge>
              </td>
              <td className="px-3 py-2">
                <Badge variant={connectivityBadgeVariant(entry.connectivity)}>{entry.connectivity}</Badge>
              </td>
              <td className="px-3 py-2 text-xs">{entry.telemetryType}</td>
              <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                {new Date(entry.latestTelemetryAt).toLocaleString()}
              </td>
              <td className="px-3 py-2">
                <Badge variant={alertBadgeVariant(entry.alertState)}>{entry.alertState}</Badge>
              </td>
              <td className="px-3 py-2 capitalize">{domainLabel(entry.assignedWorkflowDomain)}</td>
              <td className="px-3 py-2">
                <Badge variant={maintenanceBadgeVariant(entry.maintenanceStatus)}>{entry.maintenanceStatus}</Badge>
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => onSelect(entry)}>Quick view</Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/iot-registry/devices/${encodeURIComponent(entry.deviceId)}`}>Detail page</Link>
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

export function IoTDeviceRegistryPanels({ results, role }: WorkspacePanelProps): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const registry = feedData<IoTDeviceRegistryWorkspaceDto>(results, '/surveillance-iot/devices/registry');
  const [filters, setFilters] = useState<RegistryFilters>(defaultFilters);
  const [selected, setSelected] = useState<IoTDeviceRegistryEntryDto | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const canEditRoute = role ? canRoleEditRoute(role, 'iotRegistry') : false;
  const { governanceFocus, governanceSectionRef } = useSurveillanceGovernanceFocus();

  const entries = registry?.entries ?? [];
  const filtered = useMemo(() => filterEntries(entries, filters), [entries, filters]);
  const grouped = useMemo(() => groupByZone(filtered), [filtered]);

  const connectedCount = entries.filter((entry) => entry.connectivity === 'connected').length;
  const alertCount = entries.filter((entry) => entry.alertState !== 'clear').length;
  const maintenanceActive = entries.filter((entry) => entry.maintenanceStatus === 'scheduled' || entry.maintenanceStatus === 'in-progress').length;

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
        title="IoT device registry"
        description="Non-camera monitored devices — environmental, gate, access, barn, utilities, surface, equipment telemetry, and wearable/beacon placeholders. Same canonical surveillance IoT design system as the CCTV registry."
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/cctv-registry">CCTV device registry</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/surveillance-zone-mapping">Zone mapping</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/surveillance-health">Surveillance health</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-monitoring">IoT & CCTV monitoring</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin">Platform administration</Link>
          </Button>
        </div>
      </SectionPanel>

      <KpiStrip
        items={[
          { id: 'devices', label: 'Registered devices', value: String(entries.length) },
          { id: 'connected', label: 'Connected', value: String(connectedCount), status: connectedCount === entries.length ? 'nominal' : 'warning' },
          { id: 'alerts', label: 'Active alerts', value: String(alertCount), status: alertCount > 0 ? 'warning' : 'nominal' },
          { id: 'maintenance', label: 'Maintenance active', value: String(maintenanceActive), status: maintenanceActive > 0 ? 'warning' : 'nominal' },
          { id: 'zones', label: 'Zone groups', value: String(registry?.zoneGroups.length ?? 0) },
        ]}
      />

      <SectionPanel title="Search & filters" description="Narrow the registry by zone, device type, domain, health, connectivity, alerts, or maintenance.">
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
          <FilterInput label="Search" value={filters.search} onChange={(search) => setFilters((prev) => ({ ...prev, search }))} placeholder="Name, ID, telemetry…" />
          <FilterSelect
            label="Zone"
            value={filters.zoneId}
            onChange={(zoneId) => setFilters((prev) => ({ ...prev, zoneId }))}
            options={[{ value: 'all', label: 'All zones' }, ...(registry?.filterOptions.zones.map((zone) => ({ value: zone.id, label: zone.label })) ?? [])]}
          />
          <FilterSelect
            label="Device type"
            value={filters.deviceType}
            onChange={(deviceType) => setFilters((prev) => ({ ...prev, deviceType }))}
            options={[{ value: 'all', label: 'All types' }, ...(registry?.filterOptions.deviceTypes.map((type) => ({ value: type, label: deviceTypeLabel(type) })) ?? [])]}
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
            label="Connectivity"
            value={filters.connectivity}
            onChange={(connectivity) => setFilters((prev) => ({ ...prev, connectivity }))}
            options={[{ value: 'all', label: 'All' }, ...(registry?.filterOptions.connectivityStatuses.map((status) => ({ value: status, label: status })) ?? [])]}
          />
          <FilterSelect
            label="Alerts"
            value={filters.alertState}
            onChange={(alertState) => setFilters((prev) => ({ ...prev, alertState }))}
            options={[{ value: 'all', label: 'All alerts' }, ...(registry?.filterOptions.alertStates.map((state) => ({ value: state, label: state })) ?? [])]}
          />
          <FilterSelect
            label="Maintenance"
            value={filters.maintenanceStatus}
            onChange={(maintenanceStatus) => setFilters((prev) => ({ ...prev, maintenanceStatus }))}
            options={[{ value: 'all', label: 'All' }, ...(registry?.filterOptions.maintenanceStatuses.map((status) => ({ value: status, label: status })) ?? [])]}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>Reset filters</Button>
          <span className="self-center text-xs text-[var(--muted-foreground)]">{filtered.length} of {entries.length} devices</span>
        </div>
      </SectionPanel>

      {grouped.map((group) => (
        <SectionPanel
          key={group.zoneId}
          title={group.zoneLabel}
          description={`${group.entries.length} device${group.entries.length === 1 ? '' : 's'} in this zone group.`}
        >
          <DeviceRegistryTable
            entries={group.entries}
            onSelect={(entry) => {
              setSelected(entry);
              setDrawerOpen(true);
            }}
          />
        </SectionPanel>
      ))}

      <DeviceDetailDrawer
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
