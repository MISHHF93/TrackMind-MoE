import type { IncidentIntakeMode, UnifiedIncidentType } from '@trackmind/shared';
import { fieldsForIntakeMode, unifiedIncidentTypes } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { RecordTable, mapRecords } from '@/design/components/record-table';
import { FormMessage } from '@/design/components/form-field';
import { cn } from '@/lib/utils';
import { isRecord } from '@/lib/utils';
import { TrackMindFormDialog } from '@/features/data-entry/TrackMindFormDialog';
import { useTenantSession } from '@/auth/TenantSessionProvider';

const intakeModeLabels: Record<IncidentIntakeMode, { label: string; description: string }> = {
  triage: {
    label: 'Fast triage',
    description: 'Type, severity, location, and summary — optimized for race-day speed.',
  },
  full: {
    label: 'Full detail',
    description: 'Complete intake with notes, evidence, involved entities, and routing flags.',
  },
};

export function IncidentIntakeConsole({
  incidents,
  timelineEntries,
  focusedIncidentId,
  onFocusIncident,
  className,
}: {
  incidents: Record<string, unknown>[];
  timelineEntries: Record<string, unknown>[];
  focusedIncidentId?: string;
  onFocusIncident?: (incidentId: string) => void;
  className?: string;
}): ReactElement {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const [intakeMode, setIntakeMode] = useState<IncidentIntakeMode>('triage');
  const [incidentType, setIncidentType] = useState<UnifiedIncidentType>('operational-disruption');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIncidentId, setEditIncidentId] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);

  const focusedIncident = incidents.find((incident) => String(incident.id) === focusedIncidentId);

  const seed = useMemo(() => ({
    incidentType,
    intakeMode,
    severity: focusedIncident?.severity ?? unifiedIncidentTypes.find((type) => type.type === incidentType)?.defaultSeverity ?? 'medium',
    location: focusedIncident?.location ?? '',
    summary: focusedIncident?.summary ?? focusedIncident?.title ?? '',
    detailedNotes: focusedIncident?.detailedNotes ?? focusedIncident?.description ?? '',
    involvedEntities: Array.isArray(focusedIncident?.involvedEntities)
      ? (focusedIncident!.involvedEntities as Array<{ kind: string; id: string; label?: string }>)
          .map((entity) => `${entity.kind}:${entity.id}${entity.label ? `:${entity.label}` : ''}`)
          .join('\n')
      : '',
    evidenceRefs: Array.isArray(focusedIncident?.evidenceRefs) ? focusedIncident!.evidenceRefs!.map(String).join('\n') : '',
    recommendedNextAction: focusedIncident?.recommendedNextAction ?? '',
    approvalRequired: focusedIncident?.approvalRequired === true,
    subjectKind: focusedIncident?.subjectKind ?? '',
    subjectId: focusedIncident?.subjectId ?? '',
  }), [incidentType, intakeMode, focusedIncident]);

  const visibleFieldHint = fieldsForIntakeMode(intakeMode).join(', ');

  const openCreate = () => {
    setEditIncidentId(undefined);
    setMessage(null);
    setDialogOpen(true);
  };

  const openEdit = (incidentId: string) => {
    setEditIncidentId(incidentId);
    setIntakeMode('full');
    onFocusIncident?.(incidentId);
    setMessage(null);
    setDialogOpen(true);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <SectionPanel
        title="Unified incident intake"
        description="Single workflow for safety, steward, welfare, facilities, security, and operational incidents."
      >
        <div className="rounded-md border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          Records and routes incidents only — this form does not execute emergency response, disciplinary action, or automated enforcement.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(intakeModeLabels) as IncidentIntakeMode[]).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={intakeMode === mode ? 'governance' : 'outline'}
              onClick={() => setIntakeMode(mode)}
            >
              {intakeModeLabels[mode].label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">{intakeModeLabels[intakeMode].description}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">Fields: {visibleFieldHint}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {unifiedIncidentTypes.map((type) => (
            <Button
              key={type.type}
              size="sm"
              variant={incidentType === type.type ? 'default' : 'outline'}
              title={type.description}
              onClick={() => setIncidentType(type.type)}
            >
              {type.shortLabel}
            </Button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="governance" onClick={openCreate}>
            {intakeMode === 'triage' ? 'Quick report' : 'Full intake'}
          </Button>
          {focusedIncidentId ? (
            <Button size="sm" variant="outline" onClick={() => openEdit(focusedIncidentId)}>
              Edit focused incident
            </Button>
          ) : null}
        </div>

        {message ? <div className="mt-3"><FormMessage message={message} tone="muted" /></div> : null}

        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Actor: {session.role} · Timestamps and audit linkage captured on save.
        </p>
      </SectionPanel>

      <SectionPanel title="Incident registry" description="Platform incidents with type, severity, and lifecycle status.">
        <RecordTable
          columns={[
            { key: 'incident', label: 'Incident' },
            { key: 'type', label: 'Type' },
            { key: 'severity', label: 'Severity' },
            { key: 'location', label: 'Location' },
            { key: 'status', label: 'Status' },
            { key: 'audit', label: 'Audit' },
          ]}
          rows={mapRecords(incidents, (incident) => ({
            incident: String(incident.summary ?? incident.title ?? incident.id ?? '—'),
            type: String(incident.incidentType ?? incident.category ?? '—'),
            severity: String(incident.severity ?? '—'),
            location: String(incident.location ?? '—'),
            status: String(incident.status ?? '—'),
            audit: Array.isArray(incident.auditIds) && incident.auditIds.length ? String(incident.auditIds[0]) : '—',
          }))}
          emptyLabel="No incidents reported yet."
        />
        {incidents.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {incidents.slice(0, 6).map((incident) => (
              <Button
                key={String(incident.id)}
                size="sm"
                variant="outline"
                onClick={() => {
                  onFocusIncident?.(String(incident.id));
                  openEdit(String(incident.id));
                }}
              >
                Edit {String(incident.id)}
              </Button>
            ))}
          </div>
        ) : null}
      </SectionPanel>

      {timelineEntries.length > 0 ? (
        <SectionPanel title="Timeline linkage" description="Live platform timeline entries for focused incident — audit IDs cross-reference immutable log.">
          <RecordTable
            columns={[
              { key: 'time', label: 'Time' },
              { key: 'action', label: 'Action' },
              { key: 'actor', label: 'Actor' },
              { key: 'note', label: 'Note' },
            ]}
            rows={mapRecords(timelineEntries, (entry) => ({
              time: String(entry.at ?? '—'),
              action: String(entry.action ?? '—'),
              actor: String(entry.actor ?? '—'),
              note: String(entry.note ?? '—'),
            }))}
          />
        </SectionPanel>
      ) : null}

      <TrackMindFormDialog
        entityKind="unified-incident"
        mode={editIncidentId ? 'edit' : 'create'}
        recordId={editIncidentId}
        seed={seed}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editIncidentId ? 'Edit incident' : intakeMode === 'triage' ? 'Fast triage report' : 'Full incident intake'}
        description="Intake records are audit-linked. Recommended next actions are advisory only."
        submitLabel={editIncidentId ? 'Save changes' : 'Submit report'}
        onSubmitted={(result) => {
          setMessage(result.message ?? 'Incident saved.');
          void queryClient.invalidateQueries({ queryKey: ['workspace'] });
          void queryClient.invalidateQueries({ queryKey: ['incident-detail'] });
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
