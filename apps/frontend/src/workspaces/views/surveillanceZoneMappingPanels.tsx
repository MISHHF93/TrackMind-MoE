import type {
  SurveillanceIoTZoneMappingWorkspaceDto,
  SurveillanceOperationalZoneDto,
  SurveillanceOperationalZoneKind,
} from '@trackmind/shared';
import { canRoleEditRoute } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

type ZoneFilters = {
  search: string;
  zoneKind: string;
  health: string;
  sensitivity: string;
};

const defaultFilters: ZoneFilters = {
  search: '',
  zoneKind: 'all',
  health: 'all',
  sensitivity: 'all',
};

const zoneKindLabels: Record<SurveillanceOperationalZoneKind, string> = {
  racetrack: 'Racetrack',
  paddock: 'Paddock',
  'starting-gate': 'Starting gate',
  barn: 'Barns / stables',
  veterinary: 'Veterinary',
  restricted: 'Restricted zones',
  public: 'Public areas',
  hospitality: 'Hospitality',
  'operations-room': 'Operations rooms',
  'track-surface': 'Track surface',
  'parking-logistics': 'Parking / logistics',
  'utilities-infrastructure': 'Utilities / infrastructure',
};

function healthBadgeVariant(health: string): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (health === 'healthy') return 'nominal';
  if (health === 'degraded') return 'warning';
  if (health === 'critical') return 'critical';
  return 'secondary';
}

function filterZones(zones: SurveillanceOperationalZoneDto[], filters: ZoneFilters): SurveillanceOperationalZoneDto[] {
  const query = filters.search.trim().toLowerCase();
  return zones.filter((zone) => {
    if (filters.zoneKind !== 'all' && zone.zoneKind !== filters.zoneKind) return false;
    if (filters.health !== 'all' && zone.healthSummary.healthBand !== filters.health) return false;
    if (filters.sensitivity !== 'all' && zone.sensitivity !== filters.sensitivity) return false;
    if (!query) return true;
    const haystack = [zone.zoneLabel, zone.zoneCode, zone.description, zone.facilityLabel, zoneKindLabels[zone.zoneKind]]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function ZoneSummaryCard({
  zone,
  onSelect,
}: {
  zone: SurveillanceOperationalZoneDto;
  onSelect: (zone: SurveillanceOperationalZoneDto) => void;
}): ReactElement {
  const summary = zone.healthSummary;
  return (
    <button
      type="button"
      onClick={() => onSelect(zone)}
      className="flex w-full flex-col rounded-md border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--muted)]/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--foreground)]">{zone.zoneLabel}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{zoneKindLabels[zone.zoneKind]}</p>
        </div>
        <Badge variant={healthBadgeVariant(summary.healthBand)}>{summary.healthBand}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-[var(--muted-foreground)]">Devices</dt>
          <dd className="font-medium">{summary.totalDeviceCount}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">Coverage</dt>
          <dd className="font-medium">{summary.coveragePct}%</dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">Cameras</dt>
          <dd className="font-medium">{summary.cameraCount}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">IoT</dt>
          <dd className="font-medium">{summary.iotDeviceCount}</dd>
        </div>
      </dl>
      {summary.openAlertCount > 0 ? (
        <p className="mt-2 text-xs text-[var(--status-warning)]">{summary.openAlertCount} open alert{summary.openAlertCount === 1 ? '' : 's'}</p>
      ) : null}
    </button>
  );
}

function ZoneDetailDrawer({
  zone,
  allZones,
  open,
  onOpenChange,
  canEdit,
  actorId,
  onUpdated,
}: {
  zone: SurveillanceOperationalZoneDto | null;
  allZones: SurveillanceOperationalZoneDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  actorId: string;
  onUpdated: () => void;
}): ReactElement | null {
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [primaryZoneId, setPrimaryZoneId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!zone) return null;

  const startEdit = (deviceId: string, currentZoneIds: string[], currentPrimary?: string) => {
    setEditingDeviceId(deviceId);
    setSelectedZoneIds(currentZoneIds);
    setPrimaryZoneId(currentPrimary ?? currentZoneIds[0] ?? zone.zoneId);
    setReason('');
    setError(null);
  };

  const saveAssignment = async (deviceKind: 'camera-device' | 'iot-device', deviceId: string) => {
    setSaving(true);
    setError(null);
    try {
      const response = await patchJson<{ auditId?: string }>(`/surveillance-iot/mapping/devices/${encodeURIComponent(deviceId)}/zones`, {
        deviceId,
        deviceKind,
        operationalZoneIds: selectedZoneIds,
        primaryZoneId,
        reason: reason.trim() || `Zone assignment by ${actorId}`,
      });
      if (response.status !== 'ready') throw new Error(response.message ?? 'Update failed');
      setEditingDeviceId(null);
      onUpdated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  };

  const toggleZone = (zoneId: string) => {
    setSelectedZoneIds((current) => {
      if (current.includes(zoneId)) {
        const next = current.filter((id) => id !== zoneId);
        if (primaryZoneId === zoneId) setPrimaryZoneId(next[0] ?? '');
        return next;
      }
      return [...current, zoneId];
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-4xl" governance={canEdit}>
        <DialogHeader>
          <DialogTitle>{zone.zoneLabel}</DialogTitle>
          <DialogDescription>
            {zoneKindLabels[zone.zoneKind]}
            {zone.facilityLabel ? ` · ${zone.facilityLabel}` : ''}
            {' · '}
            <span className="font-mono text-xs">{zone.zoneId}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-4">
          <Metric label="Health" value={zone.healthSummary.healthBand} />
          <Metric label="Coverage" value={`${zone.healthSummary.coveragePct}%`} />
          <Metric label="Online" value={String(zone.healthSummary.onlineCount)} />
          <Metric label="Alerts" value={String(zone.healthSummary.openAlertCount)} />
        </div>

        {zone.description ? (
          <p className="text-sm text-[var(--muted-foreground)]">{zone.description}</p>
        ) : null}

        <SectionPanel title="Linked devices" description="Cameras and IoT devices assigned to this operational zone. Devices may appear in multiple zones." className="border-0 shadow-none">
          {zone.linkedDevices.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No devices mapped to this zone yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
                  <tr>
                    {['Name', 'Kind', 'Health', 'Status', 'Primary', ''].map((label) => (
                      <th key={label || 'actions'} className="px-3 py-2 text-left font-medium">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zone.linkedDevices.map((device) => (
                    <tr key={device.deviceId} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 font-medium">{device.displayName}</td>
                      <td className="px-3 py-2 capitalize">{device.deviceKind === 'camera-device' ? 'Camera' : 'IoT'}</td>
                      <td className="px-3 py-2"><Badge variant={healthBadgeVariant(device.health)}>{device.health}</Badge></td>
                      <td className="px-3 py-2">{device.deviceStatus}</td>
                      <td className="px-3 py-2">{device.isPrimary ? 'yes' : '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={device.deviceKind === 'camera-device' ? '/cctv-registry' : '/iot-registry'}>
                              Registry
                            </Link>
                          </Button>
                          {canEdit && zone.canEdit ? (
                            <Button size="sm" variant="ghost" onClick={() => startEdit(device.deviceId, [zone.zoneId], zone.zoneId)}>
                              Assign zones
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionPanel>

        {editingDeviceId ? (
          <div className="space-y-3 rounded-md border border-[var(--border)] p-4">
            <p className="text-sm font-medium">Multi-zone assignment (audit-aware)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {allZones.map((entry) => (
                <label key={entry.zoneId} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedZoneIds.includes(entry.zoneId)}
                    onChange={() => toggleZone(entry.zoneId)}
                  />
                  {entry.zoneLabel}
                </label>
              ))}
            </div>
            <label className="block text-xs">
              Primary zone
              <select
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={primaryZoneId}
                onChange={(event) => setPrimaryZoneId(event.target.value)}
              >
                {selectedZoneIds.map((zoneId) => {
                  const entry = allZones.find((item) => item.zoneId === zoneId);
                  return <option key={zoneId} value={zoneId}>{entry?.zoneLabel ?? zoneId}</option>;
                })}
              </select>
            </label>
            <label className="block text-xs">
              Change reason
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why are zone assignments changing?"
              />
            </label>
            {error ? <p className="text-xs text-[var(--status-critical)]">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="governance"
                disabled={saving || selectedZoneIds.length === 0}
                onClick={() => {
                  const device = zone.linkedDevices.find((item) => item.deviceId === editingDeviceId);
                  if (device) void saveAssignment(device.deviceKind, device.deviceId);
                }}
              >
                {saving ? 'Saving…' : 'Save assignment'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingDeviceId(null)}>Cancel</Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/20 p-3">
      <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}

export function SurveillanceZoneMappingPanels({ results, role }: WorkspacePanelProps): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const mapping = feedData<SurveillanceIoTZoneMappingWorkspaceDto>(results, '/surveillance-iot/mapping/zones');
  const [filters, setFilters] = useState<ZoneFilters>(defaultFilters);
  const [selected, setSelected] = useState<SurveillanceOperationalZoneDto | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const canEditRoute = role ? canRoleEditRoute(role, 'surveillanceZoneMapping') : false;

  const zones = mapping?.operationalZones ?? [];
  const filtered = useMemo(() => filterZones(zones, filters), [zones, filters]);

  const totalDevices = zones.reduce((sum, zone) => sum + zone.healthSummary.totalDeviceCount, 0);
  const alertZones = zones.filter((zone) => zone.healthSummary.openAlertCount > 0).length;
  const degradedZones = zones.filter((zone) => zone.healthSummary.healthBand !== 'healthy').length;

  const openZone = (zone: SurveillanceOperationalZoneDto) => {
    setSelected(zone);
    setDrawerOpen(true);
    setSearchParams({ zone: zone.zoneId });
  };

  useEffect(() => {
    const zoneParam = searchParams.get('zone');
    if (!zoneParam) return;
    const match = zones.find((zone) => zone.zoneId === zoneParam);
    if (match) {
      setSelected(match);
      setDrawerOpen(true);
    }
  }, [searchParams, zones]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['workspace'] });
  };

  return (
    <div className="space-y-4">
      <SectionPanel
        title="Surveillance zone & facility mapping"
        description="Map cameras and IoT devices to racetrack operational zones — paddock, barns, veterinary, public, hospitality, surface, utilities, and more. Supports multi-zone device assignment with health summaries."
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/cctv-registry">CCTV registry</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-registry">IoT registry</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-monitoring">IoT monitoring</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/surveillance-health">Surveillance health</Link>
          </Button>
        </div>
      </SectionPanel>

      <KpiStrip
        items={[
          { id: 'zones', label: 'Operational zones', value: String(zones.length) },
          { id: 'devices', label: 'Mapped device links', value: String(totalDevices) },
          { id: 'degraded', label: 'Zones degraded', value: String(degradedZones), status: degradedZones > 0 ? 'warning' : 'nominal' },
          { id: 'alerts', label: 'Zones with alerts', value: String(alertZones), status: alertZones > 0 ? 'warning' : 'nominal' },
        ]}
      />

      <SectionPanel title="Filters" description="Search zones or filter by kind, health band, and sensitivity.">
        <div className="grid gap-3 md:grid-cols-4">
          <FilterInput label="Search" value={filters.search} onChange={(search) => setFilters((prev) => ({ ...prev, search }))} placeholder="Zone name, kind…" />
          <FilterSelect
            label="Zone kind"
            value={filters.zoneKind}
            onChange={(zoneKind) => setFilters((prev) => ({ ...prev, zoneKind }))}
            options={[{ value: 'all', label: 'All kinds' }, ...(mapping?.filterOptions.zoneKinds.map((kind) => ({ value: kind, label: zoneKindLabels[kind] })) ?? [])]}
          />
          <FilterSelect
            label="Health"
            value={filters.health}
            onChange={(health) => setFilters((prev) => ({ ...prev, health }))}
            options={[{ value: 'all', label: 'All health' }, ...(mapping?.filterOptions.healthBands.map((health) => ({ value: health, label: health })) ?? [])]}
          />
          <FilterSelect
            label="Sensitivity"
            value={filters.sensitivity}
            onChange={(sensitivity) => setFilters((prev) => ({ ...prev, sensitivity }))}
            options={[{ value: 'all', label: 'All sensitivity' }, ...(mapping?.filterOptions.sensitivities.map((sensitivity) => ({ value: sensitivity, label: sensitivity.replace(/-/g, ' ') })) ?? [])]}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>Reset</Button>
          <span className="self-center text-xs text-[var(--muted-foreground)]">{filtered.length} of {zones.length} zones</span>
        </div>
      </SectionPanel>

      <SectionPanel title="Operational zone health" description="Select a zone to view linked cameras and IoT devices.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((zone) => (
            <ZoneSummaryCard key={zone.zoneId} zone={zone} onSelect={openZone} />
          ))}
        </div>
      </SectionPanel>

      <ZoneDetailDrawer
        zone={selected}
        allZones={zones}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSearchParams({});
        }}
        canEdit={canEditRoute}
        actorId={session.userId ?? session.sessionKey}
        onUpdated={refresh}
      />

      <SurveillanceAdministrationGovernancePanels results={results} />
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
