import type { EquineSurveillanceContextWorkspaceDto } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';

export function EquineSurveillanceContextPanel({
  context,
  showCareTeamSections = false,
  showVeterinaryConfidentialSections = false,
}: {
  context: EquineSurveillanceContextWorkspaceDto | undefined;
  showCareTeamSections?: boolean;
  showVeterinaryConfidentialSections?: boolean;
}): ReactElement {
  if (!context) {
    return (
      <SectionPanel
        title="Surveillance & IoT equine context"
        description="Privacy-scoped metadata linkage for equine intelligence and welfare workflows."
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          Equine surveillance context is unavailable — reload the welfare or veterinary workspace feed.
        </p>
      </SectionPanel>
    );
  }

  const summary = context.summary;
  const policy = context.accessPolicy;

  return (
    <div className="space-y-4">
      <SectionPanel
        title="Surveillance & IoT equine context"
        description="Metadata-only linkage with role-based privacy boundaries. Playback and veterinary-confidential detail are never exposed without authorization."
      >
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">{context.privacyNotice}</p>
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">{policy.accessNotice}</p>
        <KpiStrip
          items={[
            { id: 'transport', label: 'Transport bay placeholders', value: String(summary.transportBayPlaceholders) },
            { id: 'barn', label: 'Barn sensors', value: String(summary.barnEnvironmentalSensors) },
            {
              id: 'welfare-evidence',
              label: 'Welfare evidence refs',
              value: showCareTeamSections ? String(summary.welfareEvidenceReferences) : 'restricted',
            },
            {
              id: 'vet-zones',
              label: 'Veterinary zones',
              value: showVeterinaryConfidentialSections || showCareTeamSections
                ? String(summary.veterinaryAreaZones)
                : 'restricted',
            },
            {
              id: 'movement',
              label: 'Transport observations',
              value: String(summary.transportMovementObservations),
            },
            {
              id: 'redacted',
              label: 'Redacted sections',
              value: String(summary.redactedSectionCount),
              status: summary.redactedSectionCount > 0 ? 'warning' : 'nominal',
            },
          ]}
        />
      </SectionPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Transport bay monitoring placeholders" description="Readiness-safe contracts for bay occupancy correlation.">
          <RecordTable
            columns={[
              { key: 'title', label: 'Placeholder' },
              { key: 'zones', label: 'Zones' },
              { key: 'notice', label: 'Notice' },
            ]}
            rows={context.transportBayMonitoringPlaceholders.map((placeholder) => ({
              title: placeholder.title,
              zones: placeholder.relatedZoneIds.join(', '),
              notice: placeholder.placeholderNotice,
            }))}
            emptyLabel="No transport bay monitoring placeholders."
          />
        </SectionPanel>

        <SectionPanel title="Stable / barn environmental sensors" description="Environmental sensor metadata for barn and stable zones.">
          <RecordTable
            columns={[
              { key: 'device', label: 'Device' },
              { key: 'metric', label: 'Metric' },
              { key: 'zone', label: 'Zone' },
              { key: 'quality', label: 'Quality' },
            ]}
            rows={context.stableBarnEnvironmentalSensors.map((sensor) => ({
              device: sensor.label,
              metric: `${sensor.metric}=${String(sensor.value)}${sensor.unit ? ` ${sensor.unit}` : ''}`,
              zone: sensor.zoneLabel,
              quality: sensor.quality,
            }))}
            emptyLabel={
              policy.redactedSections.includes('stableBarnEnvironmentalSensors')
                ? 'Barn environmental sensors redacted for your role.'
                : 'No barn environmental sensors correlated.'
            }
          />
        </SectionPanel>
      </div>

      {showCareTeamSections ? (
        <SectionPanel title="Welfare incident evidence references" description="Metadata linkage for welfare alerts and observations — no playback.">
          <RecordTable
            columns={[
              { key: 'reference', label: 'Reference' },
              { key: 'kind', label: 'Kind' },
              { key: 'horse', label: 'Horse' },
              { key: 'linkage', label: 'Linkage' },
            ]}
            rows={context.welfareIncidentEvidenceReferences.map((evidence) => ({
              reference: evidence.title,
              kind: evidence.kind,
              horse: evidence.horseIdRedacted ? 'redacted' : evidence.horseId ?? '—',
              linkage: evidence.linkageReason,
            }))}
            emptyLabel="No welfare evidence references linked."
          />
        </SectionPanel>
      ) : (
        <SectionPanel title="Welfare incident evidence references" description="Restricted to care-team authorized roles.">
          <p className="text-sm text-[var(--muted-foreground)]">
            Sensitive welfare evidence linkage is hidden. Veterinarians and equine welfare officers may view metadata references when authorized.
          </p>
        </SectionPanel>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {(showCareTeamSections || showVeterinaryConfidentialSections) ? (
          <SectionPanel title="Veterinary-area zone references" description="Zone health and coverage metadata for treatment areas.">
            <RecordTable
              columns={[
                { key: 'zone', label: 'Zone' },
                { key: 'health', label: 'Health' },
                { key: 'devices', label: 'Devices' },
                { key: 'notice', label: 'Notice' },
              ]}
              rows={context.veterinaryAreaZoneReferences.map((zone) => ({
                zone: zone.zoneLabel,
                health: zone.healthBand,
                devices: `${zone.cameraCount} cam / ${zone.deviceCount} IoT`,
                notice: zone.coverageNotice ?? '—',
              }))}
              emptyLabel="No veterinary-area zones mapped."
            />
          </SectionPanel>
        ) : (
          <SectionPanel title="Veterinary-area zone references" description="Restricted to authorized veterinary and care-team roles.">
            <p className="text-sm text-[var(--muted-foreground)]">
              Veterinary-area device linkage requires care-team or veterinary-confidential scope.
            </p>
          </SectionPanel>
        )}

        <SectionPanel title="Transport / movement observation context" description="Movement correlation allowed within privacy policy.">
          <RecordTable
            columns={[
              { key: 'time', label: 'Time' },
              { key: 'movement', label: 'Movement' },
              { key: 'summary', label: 'Summary' },
            ]}
            rows={context.transportMovementObservations.map((observation) => ({
              time: observation.occurredAt,
              movement: `${observation.fromZoneLabel ?? '—'} → ${observation.toZoneLabel ?? '—'}`,
              summary: observation.horseIdRedacted
                ? `${observation.summary} [horse redacted]`
                : observation.summary,
            }))}
            emptyLabel={
              policy.redactedSections.includes('transportMovementObservations')
                ? 'Transport movement context redacted for your role.'
                : 'No transport movement observations.'
            }
          />
        </SectionPanel>
      </div>
    </div>
  );
}
