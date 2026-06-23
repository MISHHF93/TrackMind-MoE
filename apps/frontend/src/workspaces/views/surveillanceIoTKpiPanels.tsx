import type { ReactElement } from 'react';
import type { KPIStatus, SurveillanceIoTKpiMetricDto, SurveillanceIoTKpiPackDto, SurveillanceIoTKpiSlug } from '@trackmind/shared';
import type { KpiItem } from '@/design/components/kpi-strip';
import { KpiStrip } from '@/design/components/kpi-strip';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

export type SurveillanceKpiDashboardProfile = 'admin' | 'security' | 'facilities' | 'executive' | 'full';

const profileSlugs: Record<SurveillanceKpiDashboardProfile, SurveillanceIoTKpiSlug[]> = {
  admin: [
    'camera-uptime',
    'stream-availability',
    'device-connectivity-rate',
    'gateway-uptime',
    'zone-coverage-completeness',
    'maintenance-backlog',
  ],
  security: [
    'camera-uptime',
    'stream-availability',
    'alert-volume',
    'unresolved-surveillance-alerts',
    'incident-linked-evidence-count',
    'device-connectivity-rate',
  ],
  facilities: [
    'facility-sensor-health',
    'gateway-uptime',
    'zone-coverage-completeness',
    'maintenance-backlog',
    'device-connectivity-rate',
  ],
  executive: [
    'camera-uptime',
    'device-connectivity-rate',
    'alert-volume',
    'facility-sensor-health',
    'maintenance-backlog',
    'incident-linked-evidence-count',
  ],
  full: [
    'camera-uptime',
    'stream-availability',
    'device-connectivity-rate',
    'alert-volume',
    'unresolved-surveillance-alerts',
    'gateway-uptime',
    'facility-sensor-health',
    'zone-coverage-completeness',
    'maintenance-backlog',
    'incident-linked-evidence-count',
  ],
};

function mapKpiStatus(status: KPIStatus | undefined): KpiItem['status'] {
  if (status === 'critical') return 'critical';
  if (status === 'watch' || status === 'warning') return 'warning';
  if (status === 'readiness-only') return 'advisory';
  return 'nominal';
}

function formatKpiValue(metric: SurveillanceIoTKpiMetricDto): string {
  if (metric.unit === '%') return `${metric.value}%`;
  if (metric.unit === 'alerts' || metric.unit === 'records' || metric.unit === 'links') {
    return String(metric.value);
  }
  return `${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`;
}

export function readSurveillanceIoTKpiPack(results: WorkspaceDataResult[]): SurveillanceIoTKpiPackDto | undefined {
  return feedData<SurveillanceIoTKpiPackDto>(results, '/surveillance-iot/kpi-pack');
}

export function surveillanceKpiItems(
  pack: SurveillanceIoTKpiPackDto | undefined,
  profile: SurveillanceKpiDashboardProfile,
): KpiItem[] {
  if (!pack) return [];
  const slugs = new Set(profileSlugs[profile]);
  return pack.kpis
    .filter((metric) => slugs.has(metric.slug))
    .map((metric) => ({
      id: metric.kpiId,
      label: metric.label,
      value: formatKpiValue(metric),
      detail: `Target ${metric.target}${metric.unit === '%' ? '%' : ` ${metric.unit}`}`,
      status: mapKpiStatus(metric.status),
    }));
}

export function SurveillanceIoTKpiStrip({
  results,
  profile,
  className,
}: {
  results: WorkspaceDataResult[];
  profile: SurveillanceKpiDashboardProfile;
  className?: string;
}): ReactElement | null {
  const pack = readSurveillanceIoTKpiPack(results);
  const items = surveillanceKpiItems(pack, profile);
  if (!items.length) return null;
  return <KpiStrip items={items} className={className} />;
}

export function SurveillanceIoTKpiPanel({
  results,
  profile = 'full',
  title = 'Surveillance & IoT KPIs',
  description = 'Live camera, stream, connectivity, alert, gateway, facility sensor, zone coverage, maintenance, and incident evidence metrics from the canonical surveillance IoT projection.',
}: {
  results: WorkspaceDataResult[];
  profile?: SurveillanceKpiDashboardProfile;
  title?: string;
  description?: string;
}): ReactElement | null {
  const pack = readSurveillanceIoTKpiPack(results);
  if (!pack) return null;

  const slugs = new Set(profileSlugs[profile]);
  const metrics = pack.kpis.filter((metric) => slugs.has(metric.slug));
  const summary = pack.summary;

  return (
    <div className="space-y-4">
      <SurveillanceIoTKpiStrip results={results} profile={profile} />
      <SectionPanel title={title} description={description}>
        <RecordTable
          columns={[
            { key: 'metric', label: 'Metric' },
            { key: 'value', label: 'Value' },
            { key: 'target', label: 'Target' },
            { key: 'status', label: 'Status' },
            { key: 'trend', label: 'Trend' },
          ]}
          rows={metrics.map((metric) => ({
            metric: metric.label,
            value: formatKpiValue(metric),
            target: `${metric.target}${metric.unit === '%' ? '%' : ` ${metric.unit}`}`,
            status: metric.status,
            trend: metric.trend,
          }))}
          emptyLabel="No surveillance KPI metrics returned for this profile."
        />
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Pack generated {pack.generatedAt}
          {' · '}
          camera uptime {summary.cameraUptimePct}%
          {' · '}
          stream availability {summary.streamAvailabilityPct}%
          {' · '}
          open alerts {summary.alertVolume}
        </p>
      </SectionPanel>
    </div>
  );
}

export function surveillanceKpiPackMetrics(results: WorkspaceDataResult[]): SurveillanceIoTKpiMetricDto[] {
  const pack = readSurveillanceIoTKpiPack(results);
  return pack ? extractArray<SurveillanceIoTKpiMetricDto>(pack as unknown as Record<string, unknown>, 'kpis') : [];
}
