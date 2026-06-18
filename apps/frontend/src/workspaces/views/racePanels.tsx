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

  const cards = extractArray<Record<string, unknown>>(raceOffice, 'cards');
  const calendarMeets = extractArray<Record<string, unknown>>(calendar, 'meets');
  const raceCards = extractArray<Record<string, unknown>>(raceCardsWorkspace, 'raceCards');
  const lifecycle = extractArray<Record<string, unknown>>(raceOffice, 'lifecycle');
  const approvalControls = extractApprovalControls(results);
  const warnings = extractArray<Record<string, unknown>>(readiness, 'warnings');
  const domainScores = extractArray<Record<string, unknown>>(readiness, 'domainScores');

  const avgScore = numericField(readiness, 'averageScore') ?? numericField(readiness, 'readinessScore');
  const surfaceScore = numericField(surface, 'overallScore');

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'avg', label: 'Readiness score', value: avgScore != null ? `${avgScore}%` : '—', status: avgScore != null && avgScore >= 80 ? 'nominal' : 'warning' },
          { id: 'surface', label: 'Surface score', value: surfaceScore != null ? String(surfaceScore) : '—' },
          { id: 'races', label: 'Race cards', value: String(cards.length || raceCards.length) },
          { id: 'warnings', label: 'Warnings', value: String(warnings.length), status: warnings.length > 0 ? 'warning' : 'nominal' },
        ]}
      />
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
      <SectionPanel title="Race command approvals" description="Backend-governed approval controls from the race office workspace.">
        {approvalControls.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No approval controls returned from race office.</p>
        ) : (
          <ul className="space-y-2">
            {approvalControls.map((control) => {
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
              [
                ...extractArray<Record<string, unknown>>(paddock, 'assignments'),
                ...extractArray<Record<string, unknown>>(paddockOps, 'assignments'),
              ],
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
      <SectionPanel title="Race schedule" description="Post times and race-day timeline.">
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
    </div>
  );
}
