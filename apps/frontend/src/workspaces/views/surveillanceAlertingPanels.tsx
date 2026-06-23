import type {
  SurveillanceAlertEventDto,
  SurveillanceAlertRuleDto,
  SurveillanceAlertRuleKind,
  SurveillanceAlertRuleReadiness,
  SurveillanceAlertSeverity,
  SurveillanceAlertResolutionStatus,
  SurveillanceIoTAlertingFrameworkWorkspaceDto,
  SurveillanceIoTAlertingWorkspaceDto,
} from '@trackmind/shared';
import { surveillanceAlertRuleKindLabels } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/design/components/button';
import { KpiStrip } from '@/design/components/kpi-strip';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { feedData } from '../feedUtils';
import type { WorkspacePanelProps } from './workspacePanelTypes';

type AlertFilters = {
  search: string;
  ruleKind: 'all' | SurveillanceAlertRuleKind;
  severity: 'all' | SurveillanceAlertSeverity;
  resolutionStatus: 'all' | SurveillanceAlertResolutionStatus;
  readiness: 'all' | SurveillanceAlertRuleReadiness;
};

const defaultFilters: AlertFilters = {
  search: '',
  ruleKind: 'all',
  severity: 'all',
  resolutionStatus: 'all',
  readiness: 'all',
};

function filterRules(rules: SurveillanceAlertRuleDto[], filters: AlertFilters): SurveillanceAlertRuleDto[] {
  const query = filters.search.trim().toLowerCase();
  return rules.filter((rule) => {
    if (filters.ruleKind !== 'all' && rule.ruleKind !== filters.ruleKind) return false;
    if (filters.readiness !== 'all' && rule.readiness !== filters.readiness) return false;
    if (!query) return true;
    const haystack = [rule.ruleName, rule.description, rule.ruleKind, rule.conditionExpression].join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

function filterEvents(events: SurveillanceAlertEventDto[], filters: AlertFilters): SurveillanceAlertEventDto[] {
  const query = filters.search.trim().toLowerCase();
  return events.filter((event) => {
    if (filters.ruleKind !== 'all' && event.ruleKind !== filters.ruleKind) return false;
    if (filters.severity !== 'all' && event.severity !== filters.severity) return false;
    if (filters.resolutionStatus !== 'all' && event.resolutionStatus !== filters.resolutionStatus) return false;
    if (!query) return true;
    const haystack = [
      event.title,
      event.detail,
      event.ruleKind,
      event.sourceDevice?.displayName,
      event.sourceZone?.zoneLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function FilterBar({
  filters,
  onChange,
  framework,
}: {
  filters: AlertFilters;
  onChange: (next: AlertFilters) => void;
  framework: SurveillanceIoTAlertingFrameworkWorkspaceDto;
}): ReactElement {
  return (
    <div className="flex flex-wrap gap-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--muted-foreground)]">Search</span>
        <input
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Rule, event, device, zone…"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--muted-foreground)]">Rule kind</span>
        <select
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
          value={filters.ruleKind}
          onChange={(event) => onChange({ ...filters, ruleKind: event.target.value as AlertFilters['ruleKind'] })}
        >
          <option value="all">All kinds</option>
          {framework.filterOptions.ruleKinds.map((kind) => (
            <option key={kind} value={kind}>
              {surveillanceAlertRuleKindLabels[kind]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--muted-foreground)]">Severity</span>
        <select
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
          value={filters.severity}
          onChange={(event) => onChange({ ...filters, severity: event.target.value as AlertFilters['severity'] })}
        >
          <option value="all">All severities</option>
          {framework.filterOptions.severities.map((severity) => (
            <option key={severity} value={severity}>
              {severity}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--muted-foreground)]">Resolution</span>
        <select
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
          value={filters.resolutionStatus}
          onChange={(event) =>
            onChange({ ...filters, resolutionStatus: event.target.value as AlertFilters['resolutionStatus'] })
          }
        >
          <option value="all">All statuses</option>
          {framework.filterOptions.resolutionStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--muted-foreground)]">Rule readiness</span>
        <select
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
          value={filters.readiness}
          onChange={(event) => onChange({ ...filters, readiness: event.target.value as AlertFilters['readiness'] })}
        >
          <option value="all">All readiness bands</option>
          {framework.filterOptions.readinessBands.map((band) => (
            <option key={band} value={band}>
              {band}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function SurveillanceAlertingPanels({ results }: WorkspacePanelProps): ReactElement {
  const alerting = feedData<SurveillanceIoTAlertingWorkspaceDto>(results, '/surveillance-iot/alerting/workspace');
  const framework = alerting?.framework;
  const [filters, setFilters] = useState<AlertFilters>(defaultFilters);

  const filteredRules = useMemo(
    () => (framework ? filterRules(framework.ruleCatalog, filters) : []),
    [framework, filters],
  );
  const filteredEvents = useMemo(
    () => (framework ? filterEvents(framework.alertEvents, filters) : []),
    [framework, filters],
  );

  if (!framework) {
    return (
      <SectionPanel
        title="Surveillance & IoT alerting"
        description="Canonical alert rules and events could not be loaded from the alerting workspace."
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          Verify access to the surveillance IoT alerting workspace endpoint and retry.
        </p>
      </SectionPanel>
    );
  }

  return (
    <div className="space-y-4">
      <SectionPanel
        title="Surveillance & IoT alerting framework"
        description="Canonical alert rules, severity model, escalation targets, and event feed. Placeholder rules use readiness-safe language only — no automated AI detection is implied."
      >
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/surveillance-health">Surveillance health</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-monitoring">IoT monitoring</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/cctv-registry">CCTV registry</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/iot-registry">IoT registry</Link>
          </Button>
        </div>
      </SectionPanel>

      <KpiStrip
        items={[
          { id: 'rules', label: 'Total rules', value: String(framework.summary.totalRules) },
          { id: 'live', label: 'Live rules', value: String(framework.summary.liveRules), status: 'nominal' },
          {
            id: 'placeholder',
            label: 'Placeholder rules',
            value: String(framework.summary.placeholderRules),
            status: framework.summary.placeholderRules > 0 ? 'warning' : 'nominal',
          },
          {
            id: 'open-events',
            label: 'Open events',
            value: String(framework.summary.openEvents),
            status: framework.summary.openEvents > 0 ? 'warning' : 'nominal',
          },
          {
            id: 'critical',
            label: 'Critical events',
            value: String(framework.summary.criticalEvents),
            status: framework.summary.criticalEvents > 0 ? 'critical' : 'nominal',
          },
          { id: 'legacy-open', label: 'Legacy open alerts', value: String(alerting?.alertSummary.open ?? '—') },
        ]}
      />

      <SectionPanel title="Filters" description="Narrow the rule catalog and alert event feed.">
        <FilterBar filters={filters} onChange={setFilters} framework={framework} />
      </SectionPanel>

      <SectionPanel
        title="Alert rule catalog"
        description="Canonical rule definitions with readiness band, default severity, source bindings, and escalation targets."
      >
        <RecordTable
          columns={[
            { key: 'rule', label: 'Rule' },
            { key: 'kind', label: 'Kind' },
            { key: 'readiness', label: 'Readiness' },
            { key: 'severity', label: 'Default severity' },
            { key: 'sources', label: 'Sources' },
            { key: 'enabled', label: 'Enabled' },
          ]}
          rows={filteredRules.slice(0, 50).map((rule) => ({
            rule: rule.placeholderNotice
              ? `${rule.ruleName} — ${rule.description} (${rule.placeholderNotice})`
              : `${rule.ruleName} — ${rule.description}`,
            kind: rule.ruleKind,
            readiness: rule.readiness,
            severity: rule.defaultSeverity,
            sources: `${rule.sourceDeviceIds.length} devices · ${rule.sourceZoneIds.length} zones`,
            enabled: rule.enabled ? 'yes' : 'no',
          }))}
          emptyLabel="No rules match the current filters."
        />
      </SectionPanel>

      <SectionPanel
        title="Alert events"
        description="Raised events with resolution status, linked incidents, audit trail references, and source device / zone context."
      >
        <RecordTable
          columns={[
            { key: 'event', label: 'Event' },
            { key: 'kind', label: 'Rule kind' },
            { key: 'severity', label: 'Severity' },
            { key: 'status', label: 'Resolution' },
            { key: 'source', label: 'Source' },
            { key: 'triggered', label: 'Triggered' },
          ]}
          rows={filteredEvents.slice(0, 50).map((event) => ({
            event: event.placeholderDerived
              ? `${event.title} [placeholder sample] — ${event.detail}`
              : event.linkedIncident
                ? `${event.title} — ${event.detail} (incident: ${event.linkedIncident.title})`
                : `${event.title} — ${event.detail}`,
            kind: surveillanceAlertRuleKindLabels[event.ruleKind],
            severity: event.severity,
            status: event.resolutionStatus,
            source: event.sourceDevice?.displayName ?? event.sourceZone?.zoneLabel ?? '—',
            triggered: new Date(event.triggeredAt).toLocaleString(),
          }))}
          emptyLabel="No alert events match the current filters."
        />
      </SectionPanel>
    </div>
  );
}
