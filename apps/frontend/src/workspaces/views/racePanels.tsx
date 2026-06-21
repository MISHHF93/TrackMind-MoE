import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { actionDisabledReason, extractApprovalControls, roleCanUseAction } from '@/domain/approvalControls';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData, numericField } from '../feedUtils';
import { isRecord } from '@/lib/utils';
import { GovernedActionDialog } from '@/features/approvals/GovernedActionDialog';
import type { WorkspaceAction } from '@/design/components/workspace';

export function RaceDayPanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const { session } = useTenantSession();
  const [dialog, setDialog] = useState<{ open: boolean; action?: WorkspaceAction }>({ open: false });
  const raceOffice = feedData<Record<string, unknown>>(results, '/race-operations/race-office');
  const calendar = feedData<Record<string, unknown>>(results, '/racing-calendar/workspace');
  const raceCardsWorkspace = feedData<Record<string, unknown>>(results, '/race-cards/workspace');
  const readiness = feedData<Record<string, unknown>>(results, '/race-day-readiness/dashboard');
  const surface = feedData<Record<string, unknown>>(results, '/surface-intelligence/workspace');
  const paddock = feedData<Record<string, unknown>>(results, '/race-operations/paddock');
  const paddockOps = feedData<Record<string, unknown>>(results, '/paddock-operations/workspace');
  const startingGate = feedData<Record<string, unknown>>(results, '/race-operations/starting-gate');
  const startingGateOps = feedData<Record<string, unknown>>(results, '/starting-gate-operations/workspace');
  const schedule = feedData<Record<string, unknown>>(results, '/race-operations/schedule');

  const paddockAssignments = extractArray<Record<string, unknown>>(paddock, 'assignments');
  const paddockOpsAssignments = paddockAssignments.length
    ? []
    : extractArray<Record<string, unknown>>(paddockOps, 'assignments');
  const gateReadiness = isRecord(paddock?.gateReadiness) ? paddock.gateReadiness as Record<string, unknown> : undefined;
  const paddockTimeline = extractArray<Record<string, unknown>>(paddock, 'timeline');
  const scheduleTimeline = extractArray<Record<string, unknown>>(schedule, 'timeline');
  const raceTimeline = [...paddockTimeline, ...scheduleTimeline];
  const gateIndicators = extractArray<Record<string, unknown>>(startingGate, 'raceReadinessIndicators');
  const gateOpsIndicators = gateIndicators.length
    ? []
    : extractArray<Record<string, unknown>>(startingGateOps, 'raceReadinessIndicators');
  const starterControls = extractArray<Record<string, unknown>>(startingGate, 'approvalControls');
  const gateGuardrails = isRecord(startingGate?.guardrails) ? startingGate.guardrails as Record<string, unknown> : undefined;
  const weatherObservation = isRecord(surface?.weatherObservation) ? surface.weatherObservation as Record<string, unknown> : undefined;
  const surfaceStatusCards = extractArray<Record<string, unknown>>(surface, 'statusCards');
  const primarySurfaceStatus = surfaceStatusCards[0];

  const cards = extractArray<Record<string, unknown>>(raceOffice, 'cards');
  const calendarMeets = extractArray<Record<string, unknown>>(calendar, 'meets');
  const raceCards = extractArray<Record<string, unknown>>(raceCardsWorkspace, 'raceCards');
  const lifecycle = extractArray<Record<string, unknown>>(raceOffice, 'lifecycle');
  const approvalControls = extractApprovalControls(results);
  const warnings = extractArray<Record<string, unknown>>(readiness, 'warnings');
  const domainScores = extractArray<Record<string, unknown>>(readiness, 'domainScores');

  const avgScore = numericField(readiness, 'averageScore') ?? numericField(readiness, 'readinessScore');
  const surfaceScore = numericField(surface, 'overallScore');
  const raceCommandControls: WorkspaceAction[] = [
    ...approvalControls,
    ...starterControls.map((control) => ({
      id: String(control.action ?? control.workflowId ?? 'starter-control'),
      label: String(control.action ?? 'Starter workflow'),
      detail: gateGuardrails?.guardrailStatement
        ? String(gateGuardrails.guardrailStatement)
        : 'Approval-governed starter workflow; automated race starts remain blocked.',
      protectedAction: String(control.action ?? 'race-start'),
      target: lifecycle[0]?.raceId ? String(lifecycle[0].raceId) : 'race-7',
      approvalApi: 'controlled-actions' as const,
      requiredRoles: ['admin', 'steward', 'starter'],
    })),
  ];

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'avg', label: 'Readiness score', value: avgScore != null ? `${avgScore}%` : '—', status: avgScore != null && avgScore >= 80 ? 'nominal' : 'warning' },
          { id: 'surface', label: 'Surface score', value: surfaceScore != null ? String(surfaceScore) : '—' },
          { id: 'gate', label: 'Gate readiness', value: gateReadiness ? String(gateReadiness.status ?? '—') : '—', status: gateReadiness?.status === 'ready' ? 'nominal' : 'warning' },
          { id: 'weather', label: 'Forecast rain', value: weatherObservation?.forecastRainMm != null ? `${weatherObservation.forecastRainMm}mm` : '—' },
          { id: 'races', label: 'Race cards', value: String(cards.length || raceCards.length) },
          { id: 'warnings', label: 'Warnings', value: String(warnings.length), status: warnings.length > 0 ? 'warning' : 'nominal' },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Gate readiness" description="Paddock gate checks and starter race readiness indicators from live API feeds.">
          <RecordTable
            columns={[
              { key: 'source', label: 'Source' },
              { key: 'status', label: 'Status' },
              { key: 'detail', label: 'Detail' },
            ]}
            rows={[
              ...(gateReadiness
                ? [{
                    source: 'Paddock gate',
                    status: String(gateReadiness.status ?? '—'),
                    detail: gateReadiness.lastCheckAt ? `Last check ${String(gateReadiness.lastCheckAt)}` : '—',
                  }]
                : []),
              ...mapRecords([...gateIndicators, ...gateOpsIndicators], (indicator) => ({
                source: String(indicator.indicator ?? indicator.raceId ?? 'Gate'),
                status: String(indicator.status ?? '—'),
                detail: String(indicator.detail ?? indicator.value ?? '—'),
              })),
            ]}
            emptyLabel="No gate readiness data returned from /race-operations/paddock or /race-operations/starting-gate."
          />
        </SectionPanel>
        <SectionPanel title="Surface and weather" description="Track surface posture and weather awareness from /surface-intelligence/workspace.">
          <RecordTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'value', label: 'Value' },
              { key: 'status', label: 'Status' },
            ]}
            rows={[
              { metric: 'Surface score', value: surfaceScore != null ? String(surfaceScore) : '—', status: surfaceScore != null && surfaceScore >= 80 ? 'nominal' : 'watch' },
              { metric: 'Track status', value: String(primarySurfaceStatus?.label ?? primarySurfaceStatus?.status ?? '—'), status: String(primarySurfaceStatus?.status ?? '—') },
              { metric: 'Forecast rain', value: weatherObservation?.forecastRainMm != null ? `${weatherObservation.forecastRainMm}mm` : '—', status: Number(weatherObservation?.forecastRainMm ?? 0) > 10 ? 'watch' : 'nominal' },
              { metric: 'Wind', value: weatherObservation?.windMph != null ? `${weatherObservation.windMph} mph` : '—', status: 'nominal' },
            ]}
          />
        </SectionPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Racing calendar" description="Season meets and scheduling conflicts.">
          <RecordTable
            columns={[
              { key: 'meet', label: 'Meet' },
              { key: 'date', label: 'Date' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(calendarMeets, (m) => ({
              meet: String(m.name ?? m.meetId ?? '—'),
              date: String(m.startDate ?? m.date ?? '—'),
              status: String(m.status ?? '—'),
            }))}
            emptyLabel="No calendar meets returned."
          />
        </SectionPanel>
        <SectionPanel title="Race card management" description="Published race cards from card management service.">
          <RecordTable
            columns={[
              { key: 'race', label: 'Race' },
              { key: 'classification', label: 'Class' },
              { key: 'entries', label: 'Entries' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(raceCards.length ? raceCards : cards, (c) => ({
              race: String(c.raceNumber ?? c.raceId ?? c.id ?? '—'),
              classification: String(c.classification ?? c.conditions ?? '—'),
              entries: String(Array.isArray(c.entries) ? c.entries.length : c.entryCount ?? '—'),
              status: String(c.status ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Domain readiness" description="Per-domain readiness scores and blockers.">
          <RecordTable
            columns={[
              { key: 'domain', label: 'Domain' },
              { key: 'score', label: 'Score' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(domainScores, (d) => ({
              domain: String(d.domain ?? d.label ?? '—'),
              score: d.score != null ? String(d.score) : '—',
              status: String(d.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Race lifecycle" description="Next governed actions per race.">
          <RecordTable
            columns={[
              { key: 'raceId', label: 'Race' },
              { key: 'status', label: 'Status' },
              { key: 'next', label: 'Next action' },
              { key: 'approval', label: 'Approval' },
            ]}
            rows={mapRecords(lifecycle, (l) => ({
              raceId: String(l.raceId ?? '—'),
              status: String(l.status ?? '—'),
              next: String(l.nextAction ?? '—'),
              approval: l.approvalRequired ? 'required' : '—',
            }))}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Race command approvals" description="Backend-governed approval controls from race office and starter workflows.">
        {raceCommandControls.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No approval controls returned from race office or starting gate.</p>
        ) : (
          <ul className="space-y-2">
            {raceCommandControls.map((control) => {
              const disabled = !roleCanUseAction(control, session.role);
              return (
                <li key={control.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{control.label}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{control.target}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="governance"
                    disabled={disabled}
                    title={disabled ? actionDisabledReason(control, session.role) : control.detail}
                    onClick={() => setDialog({ open: true, action: control })}
                  >
                    Request approval
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionPanel>
      {dialog.action?.protectedAction ? (
        <GovernedActionDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog({ open, action: open ? dialog.action : undefined })}
          title={dialog.action.label}
          description={dialog.action.detail ?? 'Request human approval for this protected race command.'}
          protectedAction={dialog.action.protectedAction}
          target={dialog.action.target ?? dialog.action.id}
          approvalApi={dialog.action.approvalApi}
        />
      ) : null}
      <SectionPanel title="Readiness warnings" description="Items requiring steward or operational review.">
        <RecordTable
          columns={[
            { key: 'title', label: 'Warning' },
            { key: 'domain', label: 'Domain' },
            { key: 'action', label: 'Recommended action' },
          ]}
          rows={mapRecords(warnings, (w) => ({
            title: String(w.title ?? w.summary ?? '—'),
            domain: String(w.domain ?? '—'),
            action: String(w.recommendedAction ?? w.detail ?? '—'),
          }))}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Paddock operations" description="Saddling, parade slots, and gate readiness.">
          <RecordTable
            columns={[
              { key: 'horse', label: 'Horse' },
              { key: 'slot', label: 'Slot' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(
              [...paddockAssignments, ...paddockOpsAssignments],
              (a) => ({
                horse: String(a.horseName ?? a.horseId ?? '—'),
                slot: String(a.paddockSlot ?? a.slot ?? '—'),
                status: String(a.status ?? '—'),
              }),
            )}
          />
        </SectionPanel>
        <SectionPanel title="Starting gate operations" description="Gate assignments and readiness checks.">
          <RecordTable
            columns={[
              { key: 'horse', label: 'Horse' },
              { key: 'post', label: 'Post' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(
              [
                ...extractArray<Record<string, unknown>>(startingGate, 'assignments'),
                ...extractArray<Record<string, unknown>>(startingGateOps, 'assignments'),
              ],
              (a) => ({
                horse: String(a.horseName ?? a.horseId ?? '—'),
                post: String(a.postPosition ?? a.post ?? '—'),
                status: String(a.readinessStatus ?? a.status ?? '—'),
              }),
            )}
            emptyLabel="No gate assignments returned."
          />
        </SectionPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Race schedule" description="Post times from /race-operations/schedule.">
          <RecordTable
            columns={[
              { key: 'race', label: 'Race' },
              { key: 'post', label: 'Post time' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(extractArray(schedule, 'races'), (r) => ({
              race: String(r.raceNumber ?? r.raceId ?? '—'),
              post: String(r.postTime ?? '—'),
              status: String(r.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Race-day timeline" description="Merged paddock and schedule timeline from live race-day APIs.">
          <RecordTable
            columns={[
              { key: 'time', label: 'Time' },
              { key: 'event', label: 'Event' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(raceTimeline, (entry) => ({
              time: String(entry.at ?? '—'),
              event: String(entry.label ?? '—'),
              status: String(entry.status ?? '—'),
            }))}
            emptyLabel="No timeline events returned from schedule or paddock feeds."
          />
        </SectionPanel>
      </div>
    </div>
  );
}
