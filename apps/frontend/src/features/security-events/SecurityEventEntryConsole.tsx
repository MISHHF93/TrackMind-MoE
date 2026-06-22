import type { SecurityEventEntryMode, SecurityEventEntryType } from '@trackmind/shared';
import {
  defaultSecurityEventSeed,
  fieldsForSecurityEventEntryMode,
  securityEventTypes,
  securityZonePresets,
} from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { RecordTable, mapRecords } from '@/design/components/record-table';
import { FormMessage } from '@/design/components/form-field';
import { cn } from '@/lib/utils';
import { TrackMindFormDialog } from '@/features/data-entry/TrackMindFormDialog';
import { SecurityIncidentTable } from './SecurityIncidentTable';
import { useTenantSession } from '@/auth/TenantSessionProvider';

const entryModeLabels: Record<SecurityEventEntryMode, { label: string; description: string }> = {
  quick: {
    label: 'Quick report',
    description: 'Type, severity, zone, and summary — optimized for floor staff and gate officers.',
  },
  full: {
    label: 'Full detail',
    description: 'Evidence, personnel metadata, escalation routing, and follow-up ownership.',
  },
};

export function SecurityEventEntryConsole({
  accessEvents,
  incidents,
  escalations,
  selectedZoneId,
  onSelectZone,
  className,
}: {
  accessEvents: Record<string, unknown>[];
  incidents: Record<string, unknown>[];
  escalations: Record<string, unknown>[];
  selectedZoneId?: string;
  onSelectZone?: (zoneId: string) => void;
  className?: string;
}): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const [entryMode, setEntryMode] = useState<SecurityEventEntryMode>('quick');
  const [eventType, setEventType] = useState<SecurityEventEntryType>('access-issue');
  const [zoneId, setZoneId] = useState(selectedZoneId ?? 'zone-paddock');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const actorId = `${session.role}-operator`;
  const focusedIncidentId = String(incidents[0]?.id ?? '');

  const seed = useMemo(
    () => ({
      ...defaultSecurityEventSeed(eventType, actorId, zoneId),
      entryMode,
      relatedIncidentId: eventType === 'escalation-request' ? focusedIncidentId : '',
    }),
    [eventType, entryMode, zoneId, actorId, focusedIncidentId],
  );

  const visibleFieldHint = fieldsForSecurityEventEntryMode(entryMode, eventType).join(', ');

  return (
    <div className={cn('space-y-4', className)}>
      <SectionPanel
        title="Security event entry"
        description="Structured intake for zone breaches, access issues, suspicious activity, incidents, personnel events, and escalations."
      >
        <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          Entries are append-only and audit-linked. Escalations route to supervisors — they do not execute emergency response.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(entryModeLabels) as SecurityEventEntryMode[]).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={entryMode === mode ? 'governance' : 'outline'}
              onClick={() => setEntryMode(mode)}
            >
              {entryModeLabels[mode].label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">{entryModeLabels[entryMode].description}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Fields: {visibleFieldHint}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {securityEventTypes.map((type) => (
            <Button
              key={type.type}
              size="sm"
              variant={eventType === type.type ? 'default' : 'outline'}
              title={type.description}
              onClick={() => setEventType(type.type)}
            >
              {type.shortLabel}
            </Button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {securityZonePresets.map((zone) => (
            <Button
              key={zone.zoneId}
              size="sm"
              variant={zoneId === zone.zoneId ? 'secondary' : 'outline'}
              title={zone.label}
              onClick={() => {
                setZoneId(zone.zoneId);
                onSelectZone?.(zone.zoneId);
              }}
            >
              {zone.shortLabel}
            </Button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="governance"
            onClick={() => {
              setMessage(null);
              setDialogOpen(true);
            }}
          >
            {entryMode === 'quick' ? 'Quick log' : 'Full entry'}
          </Button>
        </div>

        {message ? (
          <div className="mt-3">
            <FormMessage message={message} tone="muted" />
          </div>
        ) : null}

        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Actor: {session.role} · Zone: {zoneId} · Timestamps captured on save.
        </p>
      </SectionPanel>

      <SectionPanel title="Recent access events" description="Latest access control events from security operations workspace.">
        <RecordTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'person', label: 'Person' },
            { key: 'zone', label: 'Zone' },
            { key: 'decision', label: 'Decision' },
            { key: 'audit', label: 'Audit' },
          ]}
          rows={mapRecords(accessEvents.slice(0, 8), (event) => ({
            time: String(event.occurredAt ?? '—'),
            person: String(event.personDisplayName ?? '—'),
            zone: String(event.zoneId ?? '—'),
            decision: String(event.decision ?? '—'),
            audit: String(event.auditId ?? '—'),
          }))}
          emptyLabel="No access events logged yet."
        />
      </SectionPanel>

      <SectionPanel title="Open incidents & escalations" description="Cross-reference when filing escalation requests — inline assignee and triage status.">
        <SecurityIncidentTable incidents={incidents} actorId={actorId} />
        {escalations.length > 0 ? (
          <RecordTable
            className="mt-3"
            columns={[
              { key: 'escalation', label: 'Escalation' },
              { key: 'incident', label: 'Incident' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(escalations.slice(0, 4), (flow) => ({
              escalation: String(flow.id ?? '—'),
              incident: String(flow.incidentId ?? '—'),
              status: String(flow.status ?? '—'),
            }))}
          />
        ) : null}
      </SectionPanel>

      <TrackMindFormDialog
        entityKind="security-event-entry"
        mode="create"
        seed={seed}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={entryMode === 'quick' ? 'Quick security report' : 'Full security event entry'}
        description="Records are audit-linked with enough metadata for follow-up and investigation routing."
        submitLabel="Submit event"
        onSubmitted={(result) => {
          setMessage(result.message ?? 'Security event recorded.');
          void queryClient.invalidateQueries({ queryKey: ['workspace'] });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
