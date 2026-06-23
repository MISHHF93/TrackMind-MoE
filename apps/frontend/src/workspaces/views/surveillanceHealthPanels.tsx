import type {
  SurveillanceHealthComponentGroupDto,
  SurveillanceHealthComponentKind,
  SurveillanceHealthOperationalStatus,
  SurveillanceHealthSubjectDto,
  SurveillanceHealthWorkspaceDto,
} from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { cn } from '@/lib/utils';

type HealthFilters = {
  search: string;
  operationalStatus: 'all' | SurveillanceHealthOperationalStatus;
  componentKind: 'all' | SurveillanceHealthComponentKind;
};

const defaultFilters: HealthFilters = {
  search: '',
  operationalStatus: 'all',
  componentKind: 'all',
};

function operationalBadgeVariant(status: SurveillanceHealthOperationalStatus): 'nominal' | 'warning' | 'critical' {
  if (status === 'online') return 'nominal';
  if (status === 'degraded') return 'warning';
  return 'critical';
}

function healthBandBadgeVariant(band: string): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (band === 'healthy') return 'nominal';
  if (band === 'degraded') return 'warning';
  if (band === 'critical') return 'critical';
  return 'secondary';
}

function filterSubjects(
  subjects: SurveillanceHealthSubjectDto[],
  filters: HealthFilters,
): SurveillanceHealthSubjectDto[] {
  const query = filters.search.trim().toLowerCase();
  return subjects.filter((subject) => {
    if (filters.operationalStatus !== 'all' && subject.operationalStatus !== filters.operationalStatus) return false;
    if (filters.componentKind !== 'all' && subject.componentKind !== filters.componentKind) return false;
    if (!query) return true;
    const haystack = [
      subject.displayName,
      subject.subjectId,
      subject.issueReason,
      subject.assignedOwner,
      subject.componentKind,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function ComponentGroupCard({
  group,
  active,
  onSelect,
}: {
  group: SurveillanceHealthComponentGroupDto;
  active: boolean;
  onSelect: (kind: SurveillanceHealthComponentKind) => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={() => onSelect(group.componentKind)}
      className={cn(
        'flex w-full flex-col rounded-md border p-4 text-left transition',
        active
          ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))]'
          : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:bg-[var(--muted)]/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--foreground)]">{group.displayName}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{group.assignedOwner}</p>
        </div>
        <Badge variant={operationalBadgeVariant(group.operationalStatus)}>{group.operationalStatus}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-[var(--muted-foreground)]">Online</dt>
          <dd className="font-medium text-[var(--status-nominal)]">{group.onlineCount}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">Degraded</dt>
          <dd className="font-medium text-[var(--status-warning)]">{group.degradedCount}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">Offline</dt>
          <dd className="font-medium text-[var(--status-critical)]">{group.offlineCount}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        Last heartbeat {new Date(group.lastHeartbeatAt).toLocaleString()}
      </p>
    </button>
  );
}

function SubjectDetailDrawer({
  subject,
  open,
  onOpenChange,
}: {
  subject: SurveillanceHealthSubjectDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement | null {
  if (!subject) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subject.displayName}</DialogTitle>
          <DialogDescription>
            Control-plane health subject — {subject.componentKind.replace(/-/g, ' ')}
            {subject.metadataPlaceholder ? ' (placeholder projection)' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={operationalBadgeVariant(subject.operationalStatus)}>{subject.operationalStatus}</Badge>
            <Badge variant={healthBandBadgeVariant(subject.healthBand)}>{subject.healthBand}</Badge>
            {subject.metadataPlaceholder ? <Badge variant="secondary">Placeholder</Badge> : null}
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Subject ID" value={subject.subjectId} mono />
            <DetailField label="Last heartbeat" value={new Date(subject.lastHeartbeatAt).toLocaleString()} />
            <DetailField label="Assigned owner" value={subject.assignedOwner} />
            <DetailField label="Owner role" value={subject.assignedOwnerRole.replace(/-/g, ' ')} />
            <DetailField
              label="Issue reason"
              value={subject.issueReason ?? 'No active issue — operating within nominal thresholds.'}
              className="sm:col-span-2"
            />
          </dl>

          <section>
            <h4 className="text-sm font-medium">Linked maintenance records</h4>
            {subject.linkedMaintenance.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">No maintenance records linked to this subject.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {subject.linkedMaintenance.map((record) => (
                  <li key={record.maintenanceId} className="rounded-md border border-[var(--border)] p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{record.maintenanceType ?? 'Maintenance'}</span>
                      <Badge variant="secondary">{record.maintenanceStatus}</Badge>
                    </div>
                    {record.scheduledAt ? (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        Scheduled {new Date(record.scheduledAt).toLocaleString()}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs">{record.notes}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="text-sm font-medium">Linked incident references</h4>
            {subject.linkedIncidents.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">No incidents linked to this subject.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {subject.linkedIncidents.map((incident) => (
                  <li key={incident.incidentReferenceId} className="rounded-md border border-[var(--border)] p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{incident.title}</span>
                      {incident.operationalImpact ? (
                        <Badge variant="critical">Operational impact</Badge>
                      ) : (
                        <Badge variant="secondary">Informational</Badge>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{incident.incidentId}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Linked {new Date(incident.linkedAt).toLocaleString()}
                    </p>
                    {incident.operationalImpact ? (
                      <Button size="sm" variant="outline" className="mt-2" asChild>
                        <Link to={`/incidents?incident=${incident.incidentId}`}>Open incident workspace</Link>
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}): ReactElement {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</dt>
      <dd className={cn('text-sm font-medium', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}

function HealthSubjectTable({
  subjects,
  onSelect,
}: {
  subjects: SurveillanceHealthSubjectDto[];
  onSelect: (subject: SurveillanceHealthSubjectDto) => void;
}): ReactElement {
  if (subjects.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">No health subjects match the current filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
          <tr>
            {['Component', 'Subject', 'Status', 'Last heartbeat', 'Issue', 'Owner', 'Maintenance', 'Incidents', ''].map((label) => (
              <th key={label || 'actions'} className="px-3 py-2 text-left font-medium text-[var(--text-strong)]">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <tr
              key={subject.subjectId}
              className="border-t border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40"
            >
              <td className="px-3 py-2 capitalize text-xs text-[var(--muted-foreground)]">
                {subject.componentKind.replace(/-/g, ' ')}
              </td>
              <td className="px-3 py-2">
                <div className="font-medium">{subject.displayName}</div>
                {subject.metadataPlaceholder ? (
                  <span className="text-xs text-[var(--muted-foreground)]">Placeholder</span>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <Badge variant={operationalBadgeVariant(subject.operationalStatus)}>{subject.operationalStatus}</Badge>
              </td>
              <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                {new Date(subject.lastHeartbeatAt).toLocaleString()}
              </td>
              <td className="max-w-xs px-3 py-2 text-xs text-[var(--muted-foreground)]">
                {subject.issueReason ?? '—'}
              </td>
              <td className="px-3 py-2 text-xs">{subject.assignedOwner}</td>
              <td className="px-3 py-2 text-center text-xs">{subject.linkedMaintenance.length}</td>
              <td className="px-3 py-2 text-center text-xs">
                {subject.linkedIncidents.filter((item) => item.operationalImpact).length > 0 ? (
                  <span className="font-medium text-[var(--status-critical)]">
                    {subject.linkedIncidents.filter((item) => item.operationalImpact).length}
                  </span>
                ) : (
                  subject.linkedIncidents.length
                )}
              </td>
              <td className="px-3 py-2">
                <Button size="sm" variant="outline" onClick={() => onSelect(subject)}>Inspect</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusFilterPills({
  summary,
  active,
  onChange,
}: {
  summary: SurveillanceHealthWorkspaceDto['summary'];
  active: HealthFilters['operationalStatus'];
  onChange: (status: HealthFilters['operationalStatus']) => void;
}): ReactElement {
  const pills: Array<{ id: HealthFilters['operationalStatus']; label: string; count: number; tone?: string }> = [
    { id: 'all', label: 'All subjects', count: summary.totalSubjects },
    { id: 'online', label: 'Online', count: summary.onlineCount, tone: 'text-[var(--status-nominal)]' },
    { id: 'degraded', label: 'Degraded', count: summary.degradedCount, tone: 'text-[var(--status-warning)]' },
    { id: 'offline', label: 'Offline', count: summary.offlineCount, tone: 'text-[var(--status-critical)]' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill) => (
        <button
          key={pill.id}
          type="button"
          onClick={() => onChange(pill.id)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium transition',
            active === pill.id
              ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] text-[var(--foreground)]'
              : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:border-[var(--primary)]',
          )}
        >
          {pill.label}{' '}
          <span className={cn('font-semibold', pill.tone)}>{pill.count}</span>
        </button>
      ))}
    </div>
  );
}

export function SurveillanceHealthPanels({ results }: WorkspacePanelProps): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const workspace = feedData<SurveillanceHealthWorkspaceDto>(results, '/surveillance-iot/health/workspace');
  const [filters, setFilters] = useState<HealthFilters>(defaultFilters);
  const [selected, setSelected] = useState<SurveillanceHealthSubjectDto | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const groups = workspace?.componentGroups ?? [];
  const allSubjects = useMemo(() => groups.flatMap((group) => group.subjects), [groups]);
  const filteredSubjects = useMemo(() => filterSubjects(allSubjects, filters), [allSubjects, filters]);
  const summary = workspace?.summary;

  const openSubject = (subject: SurveillanceHealthSubjectDto) => {
    setSelected(subject);
    setDrawerOpen(true);
    setSearchParams({ subject: subject.subjectId });
  };

  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    if (!subjectParam) return;
    const match = allSubjects.find((subject) => subject.subjectId === subjectParam);
    if (match) {
      setSelected(match);
      setDrawerOpen(true);
    }
  }, [searchParams, allSubjects]);

  const componentKindOptions = [
    { value: 'all', label: 'All components' },
    ...(workspace?.filterOptions.componentKinds ?? []).map((kind) => {
      const group = groups.find((entry) => entry.componentKind === kind);
      return { value: kind, label: group?.displayName ?? kind.replace(/-/g, ' ') };
    }),
  ];

  return (
    <div className="space-y-4">
      <SectionPanel
        title="Surveillance control-plane health"
        description="Live operational posture across video streams, device connectivity, telemetry ingestion, gateways, alert pipelines, storage/recording, rule engine, and AI video analytics services."
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-monitoring">IoT monitoring</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/cctv-registry">CCTV registry</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-registry">IoT registry</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/surveillance-zone-mapping">Zone mapping</Link>
          </Button>
        </div>
        {workspace ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--brand-navy)_4%,var(--card))] px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Overall posture</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={healthBandBadgeVariant(summary?.overallHealthBand ?? 'unknown')}>
                  {summary?.overallHealthBand ?? 'unknown'}
                </Badge>
                <span className="text-sm text-[var(--muted-foreground)]">
                  Snapshot {new Date(workspace.generatedAt).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--border)]" aria-hidden />
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Open alerts</p>
              <p className="text-lg font-semibold">{summary?.openAlertCount ?? 0}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Operational incidents</p>
              <p className={cn('text-lg font-semibold', (summary?.operationalIncidents ?? 0) > 0 && 'text-[var(--status-critical)]')}>
                {summary?.operationalIncidents ?? 0}
              </p>
            </div>
          </div>
        ) : null}
      </SectionPanel>

      {summary ? (
        <KpiStrip
          items={[
            { id: 'total', label: 'Monitored subjects', value: String(summary.totalSubjects) },
            { id: 'online', label: 'Online', value: String(summary.onlineCount), status: 'nominal' },
            {
              id: 'degraded',
              label: 'Degraded',
              value: String(summary.degradedCount),
              status: summary.degradedCount > 0 ? 'warning' : 'nominal',
            },
            {
              id: 'offline',
              label: 'Offline',
              value: String(summary.offlineCount),
              status: summary.offlineCount > 0 ? 'critical' : 'nominal',
            },
            {
              id: 'components',
              label: 'Component domains',
              value: String(groups.length),
            },
          ]}
        />
      ) : null}

      <SectionPanel title="Component domains" description="Aggregate health by surveillance control-plane domain. Select a card to filter the subject table.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {groups.map((group) => (
            <ComponentGroupCard
              key={group.componentKind}
              group={group}
              active={filters.componentKind === group.componentKind}
              onSelect={(kind) => setFilters((prev) => ({
                ...prev,
                componentKind: prev.componentKind === kind ? 'all' : kind,
              }))}
            />
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Filters" description="Filter by operational status, component domain, or search subjects by name, owner, or issue.">
        {summary ? (
          <StatusFilterPills
            summary={summary}
            active={filters.operationalStatus}
            onChange={(operationalStatus) => setFilters((prev) => ({ ...prev, operationalStatus }))}
          />
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <FilterInput
            label="Search"
            value={filters.search}
            onChange={(search) => setFilters((prev) => ({ ...prev, search }))}
            placeholder="Subject, owner, issue…"
          />
          <FilterSelect
            label="Component domain"
            value={filters.componentKind}
            onChange={(componentKind) => setFilters((prev) => ({
              ...prev,
              componentKind: componentKind as HealthFilters['componentKind'],
            }))}
            options={componentKindOptions}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Health subject registry"
        description={`${filteredSubjects.length} subject${filteredSubjects.length === 1 ? '' : 's'} matching filters — inspect for heartbeat, issue reason, owner assignment, maintenance, and incident linkage.`}
      >
        <HealthSubjectTable subjects={filteredSubjects} onSelect={openSubject} />
      </SectionPanel>

      <SubjectDetailDrawer
        subject={selected}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSearchParams({});
        }}
      />
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
