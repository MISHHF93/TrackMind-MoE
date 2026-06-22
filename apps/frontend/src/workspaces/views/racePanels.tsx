import type { ReactElement } from 'react';
import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPaths } from '@/api/paths';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { raceDayCommandRoles } from '@trackmind/shared';
import { actionDisabledReason, extractApprovalControls, resolveDefaultRaceTarget, roleCanUseAction } from '@/domain/approvalControls';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { Button } from '@/design/components/button';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedFromIndex, indexWorkspaceFeeds, numericField } from '../feedUtils';
import { isRecord } from '@/lib/utils';
import { GovernedActionDialog } from '@/features/approvals/GovernedActionDialog';
import { RaceDayQuickEntryConsole, type RaceDayHorseOption } from '@/features/race-day/RaceDayQuickEntryConsole';
import { OperationalNotesConsole } from '@/features/operational-notes/OperationalNotesConsole';
import { RaceCardWorkflowWizard } from '@/features/race-card/RaceCardWorkflowWizard';
import { BulkDataEntryConsole } from '@/features/bulk-data-entry/BulkDataEntryConsole';
import { EntityFormAction } from '@/features/data-entry/TrackMindFormDialog';
import type { WorkspaceAction } from '@/design/components/workspace';
import { authorizeApprovalExecution, requestRaceStart, requestRaceStop, requestScratch, type ApprovalTokenPayload } from '@/api/mutations';

import type { WorkspacePanelProps } from './workspacePanelTypes';

export function RaceDayPanels({ results, role: roleProp }: WorkspacePanelProps): ReactElement {
  const { session } = useTenantSession();
  const role = roleProp ?? session.role;
  const canRunRaceCommand = role === 'race-day-operations-manager' || role === 'platform-super-admin';
  const isGateRole = role === 'starter-official' || role === 'paddock-official';
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; action?: WorkspaceAction }>({ open: false });
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState('race-7');
  const feeds = useMemo(() => indexWorkspaceFeeds(results), [results]);
  const raceOffice = feedFromIndex<Record<string, unknown>>(feeds, '/race-operations/race-office');
  const calendar = feedFromIndex<Record<string, unknown>>(feeds, '/racing-calendar/workspace');
  const raceCardsWorkspace = feedFromIndex<Record<string, unknown>>(feeds, '/race-cards/workspace');
  const readiness = feedFromIndex<Record<string, unknown>>(feeds, '/race-day-readiness/dashboard');
  const surface = feedFromIndex<Record<string, unknown>>(feeds, '/surface-intelligence/workspace');
  const surfaceMeasurements = extractArray<Record<string, unknown>>(
    feedFromIndex(feeds, '/track-surface/measurements'),
  );
  const paddock = feedFromIndex<Record<string, unknown>>(feeds, apiPaths.raceDay.paddock);
  const startingGate = feedFromIndex<Record<string, unknown>>(feeds, '/race-operations/starting-gate');
  const startingGateOps = feedFromIndex<Record<string, unknown>>(feeds, '/starting-gate-operations/workspace');
  const schedule = feedFromIndex<Record<string, unknown>>(feeds, '/race-operations/schedule');
  const notesJournal = feedFromIndex<Record<string, unknown>>(feeds, apiPaths.operationalNotes.journal);
  const operationalNotes = extractArray<Record<string, unknown>>(notesJournal, 'notes');

  const paddockAssignments = extractArray<Record<string, unknown>>(paddock, 'assignments');
  const gateReadiness = isRecord(paddock?.gateReadiness) ? paddock.gateReadiness as Record<string, unknown> : undefined;
  const paddockTimeline = extractArray<Record<string, unknown>>(paddock, 'timeline');
  const scheduleTimeline = extractArray<Record<string, unknown>>(schedule, 'timeline');
  const scheduleRaces = extractArray<Record<string, unknown>>(schedule, 'races');
  const raceTimeline = [...paddockTimeline, ...scheduleTimeline];
  const gateIndicators = extractArray<Record<string, unknown>>(startingGate, 'raceReadinessIndicators');
  const gateOpsIndicators = gateIndicators.length
    ? []
    : extractArray<Record<string, unknown>>(startingGateOps, 'raceReadinessIndicators');
  const startingGateAssignments = extractArray<Record<string, unknown>>(startingGate, 'assignments');
  const startingGateOpsAssignments = extractArray<Record<string, unknown>>(startingGateOps, 'assignments');
  const starterControls = extractArray<Record<string, unknown>>(startingGate, 'approvalControls');
  const gateGuardrails = isRecord(startingGate?.guardrails) ? startingGate.guardrails as Record<string, unknown> : undefined;
  const weatherObservation = isRecord(surface?.weatherObservation) ? surface.weatherObservation as Record<string, unknown> : undefined;
  const surfaceStatusCards = extractArray<Record<string, unknown>>(surface, 'statusCards');
  const primarySurfaceStatus = surfaceStatusCards[0];

  const officeMeets = extractArray<Record<string, unknown>>(raceOffice, 'meets');
  const officeRaceDays = extractArray<Record<string, unknown>>(raceOffice, 'raceDays');
  const cards = extractArray<Record<string, unknown>>(raceOffice, 'cards');
  const calendarMeets = extractArray<Record<string, unknown>>(calendar, 'meets');
  const raceCards = extractArray<Record<string, unknown>>(raceCardsWorkspace, 'raceCards');
  const raceCardAuditTrail = extractArray<Record<string, unknown>>(raceCardsWorkspace, 'auditTrail');
  const lifecycleSummary = isRecord(raceCardsWorkspace?.lifecycleSummary)
    ? raceCardsWorkspace.lifecycleSummary as Record<string, unknown>
    : undefined;
  const officeReadiness = extractArray<Record<string, unknown>>(raceOffice, 'readiness');
  const lifecycle = extractArray<Record<string, unknown>>(raceOffice, 'lifecycle');
  const approvalControls = extractApprovalControls(results);
  const warnings = extractArray<Record<string, unknown>>(readiness, 'warnings');
  const domainScores = extractArray<Record<string, unknown>>(readiness, 'domainScores');
  const defaultRaceTarget = resolveDefaultRaceTarget(results);

  useEffect(() => {
    setSelectedRaceId(defaultRaceTarget);
  }, [defaultRaceTarget]);

  const raceStartApprovalAction = (raceId: string): WorkspaceAction => ({
    id: `gate-race-start-approval-${raceId}`,
    label: 'Request gate race start approval',
    detail: 'Request starting-gate race-start approval; does not start the race.',
    protectedAction: 'race-start',
    target: raceId,
    approvalApi: 'starting-gate-operations/race-start-approval',
    requiredRoles: raceDayCommandRoles,
  });

  const raceStartCommandAction = (raceId: string): WorkspaceAction => ({
    id: `race-start-command-${raceId}`,
    label: 'Submit authorized race start command',
    detail: 'Issue verified approval token and POST race start command metadata.',
    protectedAction: 'race-start',
    target: raceId,
    requiredRoles: raceDayCommandRoles,
  });

  function resolveRaceId(record: Record<string, unknown>): string {
    return String(record.raceId ?? record.id ?? defaultRaceTarget);
  }

  function gateStartApprovalIds(raceId: string): string[] {
    const indicator = [...gateIndicators, ...gateOpsIndicators].find(
      (entry) => entry.indicator === 'race-start-approval' && resolveRaceId(entry) === raceId,
    );
    if (!indicator) return [];
    const ids = indicator.approvalRequestIds;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  }

  function gateStartApprovalRaceIds(): string[] {
    const fromIndicators = [...gateIndicators, ...gateOpsIndicators]
      .filter((entry) => entry.indicator === 'race-start-approval')
      .map((entry) => resolveRaceId(entry));
    const fromSchedule = scheduleRaces.map((race) => resolveRaceId(race));
    const fromLifecycle = lifecycle.map((entry) => String(entry.raceId ?? '')).filter(Boolean);
    return [...new Set([...fromIndicators, ...fromSchedule, ...fromLifecycle, defaultRaceTarget])];
  }

  const raceStartCommandMutation = useMutation({
    mutationFn: async (raceId: string) => {
      const approvalRequestId = gateStartApprovalIds(raceId)[0]
        ?? lifecycle.find((entry) => String(entry.raceId) === raceId && entry.approvalRequired)?.approvalRequestId;
      const approvalId = typeof approvalRequestId === 'string' ? approvalRequestId : undefined;
      if (!approvalId) throw new Error('Request gate race start approval before submitting the race start command.');
      const authorized = await authorizeApprovalExecution(approvalId);
      const token = authorized.approvalToken;
      if (!token) throw new Error('Approval token was not issued. Complete steward, race office, and veterinary approvals first.');
      return requestRaceStart(raceId, {
        approvalToken: token as ApprovalTokenPayload,
        starterId: `${session.role}-operator`,
      });
    },
    onSuccess: () => {
      setCommandMessage('Race start command submitted with verified approval token.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => setCommandMessage(error.message),
  });

  const raceStopCommandMutation = useMutation({
    mutationFn: async (raceId: string) => {
      const approvalId = gateStartApprovalIds(raceId)[0];
      if (!approvalId) throw new Error('Request race stop approval before submitting the stop command.');
      const authorized = await authorizeApprovalExecution(approvalId);
      if (!authorized.approvalToken) throw new Error('Approval token was not issued.');
      return requestRaceStop(raceId, { approvalId, justification: 'Race stop from race-day console' });
    },
    onSuccess: () => {
      setCommandMessage('Race stop command submitted.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => setCommandMessage(error.message),
  });

  const raceScratchCommandMutation = useMutation({
    mutationFn: async ({ raceId, horseId }: { raceId: string; horseId: string }) => {
      const approvalId = gateStartApprovalIds(raceId)[0];
      if (!approvalId) throw new Error('Request scratch approval before submitting scratch command.');
      const authorized = await authorizeApprovalExecution(approvalId);
      if (!authorized.approvalToken) throw new Error('Approval token was not issued.');
      return requestScratch(raceId, { approvalId, horseId, justification: 'Scratch from race-day console' });
    },
    onSuccess: () => {
      setCommandMessage('Scratch command submitted.');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: Error) => setCommandMessage(error.message),
  });

  const avgScore = numericField(readiness, 'averageScore') ?? numericField(readiness, 'readinessScore');
  const surfaceScore = numericField(surface, 'overallScore');
  const officeReadyCount = officeReadiness.filter((row) => row.ready === true).length;
  const stewardControls = approvalControls.filter((control) =>
    control.requiredRoles?.includes('steward')
    || ['race-start', 'race-cancellation', 'race-status-change', 'official-results', 'race-office-scratch'].includes(control.protectedAction ?? ''),
  );
  const raceCommandControls: WorkspaceAction[] = [
    ...approvalControls,
    ...starterControls.map((control) => ({
      id: String(control.action ?? control.workflowId ?? 'starter-control'),
      label: String(control.action ?? 'Starter workflow'),
      detail: gateGuardrails?.guardrailStatement
        ? String(gateGuardrails.guardrailStatement)
        : 'Approval-governed starter workflow; automated race starts remain blocked.',
      protectedAction: String(control.action ?? 'race-start'),
      target: defaultRaceTarget,
      approvalApi: 'controlled-actions' as const,
      requiredRoles: raceDayCommandRoles,
    })),
  ];

  function formatCardConditions(card: Record<string, unknown>): string {
    if (typeof card.classification === 'string') return card.classification;
    const conditions = isRecord(card.conditions) ? card.conditions : undefined;
    if (!conditions) return '—';
    const parts = [
      conditions.classLevel,
      conditions.surface,
      conditions.distanceFurlongs != null ? `${conditions.distanceFurlongs}f` : undefined,
    ].filter(Boolean);
    return parts.length ? parts.map(String).join(' · ') : '—';
  }

  function formatApprovalSummary(approvals: unknown): string {
    if (!isRecord(approvals)) return '—';
    const entries = Object.entries(approvals);
    if (!entries.length) return '—';
    return entries.map(([step, state]) => `${step}: ${String(state)}`).join(', ');
  }

  function formatStewardRoster(meet: Record<string, unknown>): string {
    const config = isRecord(meet.officialConfig) ? meet.officialConfig : undefined;
    const stewards = Array.isArray(config?.stewards) ? config.stewards : [];
    return stewards.length ? stewards.map(String).join(', ') : '—';
  }

  const raceHorseOptions = useMemo((): RaceDayHorseOption[] => {
    const fromPaddock = paddockAssignments.map((assignment) => ({
      horseId: String(assignment.horseId ?? ''),
      horseName: String(assignment.horseName ?? assignment.horseId ?? 'Horse'),
      raceId: String(assignment.raceId ?? defaultRaceTarget),
      raceCardId: assignment.raceCardId ? String(assignment.raceCardId) : undefined,
      entryId: assignment.entryId ? String(assignment.entryId) : undefined,
      saddleCloth: typeof assignment.saddleCloth === 'number' ? assignment.saddleCloth : Number(assignment.saddleCloth) || undefined,
      postPosition: typeof assignment.postPosition === 'number' ? assignment.postPosition : Number(assignment.postPosition) || undefined,
      status: assignment.status ? String(assignment.status) : undefined,
    })).filter((horse) => horse.horseId);

    if (fromPaddock.length > 0) return fromPaddock;

    return startingGateAssignments.slice(0, 12).map((assignment) => ({
      horseId: String(assignment.horseId ?? assignment.entryId ?? ''),
      horseName: String(assignment.horseName ?? assignment.horseId ?? 'Horse'),
      raceId: String(assignment.raceId ?? defaultRaceTarget),
      entryId: assignment.entryId ? String(assignment.entryId) : undefined,
      postPosition: typeof assignment.postPosition === 'number' ? assignment.postPosition : Number(assignment.postPosition ?? assignment.stallNumber) || undefined,
      saddleCloth: typeof assignment.stallNumber === 'number' ? assignment.stallNumber : undefined,
      status: assignment.status ? String(assignment.status) : undefined,
    })).filter((horse) => horse.horseId);
  }, [paddockAssignments, startingGateAssignments, defaultRaceTarget]);

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'avg', label: 'Readiness score', value: avgScore != null ? `${avgScore}%` : '—', status: avgScore != null && avgScore >= 80 ? 'nominal' : 'warning' },
          { id: 'surface', label: 'Surface score', value: surfaceScore != null ? String(surfaceScore) : '—' },
          { id: 'measurements', label: 'Live readings', value: String(surfaceMeasurements.length) },
          { id: 'gate', label: 'Gate readiness', value: gateReadiness ? String(gateReadiness.status ?? '—') : '—', status: gateReadiness?.status === 'ready' ? 'nominal' : 'warning' },
          { id: 'weather', label: 'Forecast rain', value: weatherObservation?.forecastRainMm != null ? `${weatherObservation.forecastRainMm}mm` : '—' },
          { id: 'meets', label: 'Active meets', value: String(officeMeets.length || calendarMeets.length) },
          { id: 'race-days', label: 'Race days', value: String(officeRaceDays.length) },
          { id: 'races', label: 'Race cards', value: String(cards.length || raceCards.length) },
          { id: 'draft-cards', label: 'Draft cards', value: lifecycleSummary?.draft != null ? String(lifecycleSummary.draft) : '—' },
          { id: 'published-cards', label: 'Published', value: lifecycleSummary?.published != null ? String(lifecycleSummary.published) : '—' },
          { id: 'office-ready', label: 'Office ready', value: officeReadiness.length ? `${officeReadyCount}/${officeReadiness.length}` : '—', status: officeReadiness.length && officeReadyCount === officeReadiness.length ? 'nominal' : 'warning' },
          { id: 'warnings', label: 'Warnings', value: String(warnings.length), status: warnings.length > 0 ? 'warning' : 'nominal' },
        ]}
      />
      {canRunRaceCommand ? (
      <>
      <SectionPanel title="Race command target" description="Select the active race for stop, scratch, and gate command actions.">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-[var(--muted-foreground)]" htmlFor="race-target-select">Race</label>
          <select
            id="race-target-select"
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm"
            value={selectedRaceId}
            onChange={(event) => setSelectedRaceId(event.target.value)}
          >
            {gateStartApprovalRaceIds().map((raceId) => (
              <option key={raceId} value={raceId}>{raceId}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="governance"
            disabled={raceStopCommandMutation.isPending}
            onClick={() => raceStopCommandMutation.mutate(selectedRaceId)}
          >
            Submit race stop
          </Button>
          <Button
            size="sm"
            variant="governance"
            disabled={raceScratchCommandMutation.isPending}
            onClick={() => raceScratchCommandMutation.mutate({ raceId: selectedRaceId, horseId: 'horse-1' })}
          >
            Submit scratch
          </Button>
          {commandMessage ? <p className="text-xs text-[var(--muted-foreground)] w-full">{commandMessage}</p> : null}
        </div>
      </SectionPanel>
      <OperationalNotesConsole
        notes={operationalNotes}
        defaultSubjectKind="race-day-log"
        defaultEntityId={defaultRaceTarget}
      />
      <SectionPanel title="Race schedule data entry" description="Governed race schedule draft requests via the shared form framework.">
        <div className="flex flex-wrap gap-2">
          <EntityFormAction entityKind="race" label="Add race to schedule" />
          <EntityFormAction entityKind="race" mode="edit" label="Revise race schedule" variant="outline" />
        </div>
      </SectionPanel>
      <RaceCardWorkflowWizard
        raceCards={raceCards}
        auditTrail={raceCardAuditTrail}
        defaultRaceDayId={officeRaceDays[0]?.id ? String(officeRaceDays[0].id) : undefined}
      />
      <BulkDataEntryConsole
        title="Race-day bulk entry"
        description="Bulk race entries, jockey assignments, and status updates with validation preview and partial commit."
        operationIds={['race-entries', 'jockey-assignments', 'status-updates']}
      />
      </>
      ) : null}
      {(canRunRaceCommand || isGateRole) ? (
      <RaceDayQuickEntryConsole horses={raceHorseOptions} defaultRaceId={defaultRaceTarget} />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Gate readiness" description="Paddock gate checks and starter race readiness indicators from live API feeds.">
          {commandMessage ? (
            <p className="mb-3 text-sm text-[var(--muted-foreground)]">{commandMessage}</p>
          ) : null}
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
            emptyLabel={`No gate readiness data returned from ${apiPaths.raceDay.paddock} or ${apiPaths.raceDay.startingGate}.`}
          />
          {gateStartApprovalRaceIds().length ? (
            <ul className="mt-4 space-y-2">
              {gateStartApprovalRaceIds().map((raceId) => {
                const gateAction = raceStartApprovalAction(raceId);
                const commandAction = raceStartCommandAction(raceId);
                const approvalIds = gateStartApprovalIds(raceId);
                const gateDisabled = !roleCanUseAction(gateAction, session.role);
                const commandDisabled = !roleCanUseAction(commandAction, session.role);
                const startIndicator = [...gateIndicators, ...gateOpsIndicators].find(
                  (entry) => entry.indicator === 'race-start-approval' && resolveRaceId(entry) === raceId,
                );
                return (
                  <li key={raceId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Race {raceId} — gate start approval</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {approvalIds.length
                          ? `Approval pending (${approvalIds.join(', ')})`
                          : String(startIndicator?.detail ?? startIndicator?.value ?? 'Not requested')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="governance"
                        disabled={gateDisabled || approvalIds.length > 0}
                        title={gateDisabled ? actionDisabledReason(gateAction, session.role) : approvalIds.length ? 'Approval already requested' : gateAction.detail}
                        onClick={() => setDialog({ open: true, action: gateAction })}
                      >
                        Request start approval
                      </Button>
                      <Button
                        size="sm"
                        variant="governance"
                        disabled={commandDisabled || raceStartCommandMutation.isPending || approvalIds.length === 0}
                        title={commandDisabled ? actionDisabledReason(commandAction, session.role) : approvalIds.length === 0 ? 'Request gate race start approval first' : commandAction.detail}
                        onClick={() => raceStartCommandMutation.mutate(raceId)}
                      >
                        Submit race start
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </SectionPanel>
        <SectionPanel title="Surface and weather" description="Track surface posture, live sector readings, and weather awareness from /surface-intelligence/workspace and /track-surface/measurements.">
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
          <RecordTable
            className="mt-4"
            columns={[
              { key: 'sector', label: 'Sector' },
              { key: 'moisture', label: 'Moisture' },
              { key: 'compaction', label: 'Compaction' },
              { key: 'measuredAt', label: 'Measured' },
            ]}
            rows={mapRecords(surfaceMeasurements, (m) => ({
              sector: String(m.sectorId ?? '—'),
              moisture: m.moisture != null ? String(m.moisture) : '—',
              compaction: m.compaction != null ? String(m.compaction) : '—',
              measuredAt: String(m.measuredAt ?? '—'),
            }))}
            emptyLabel="No live surface measurements returned from /track-surface/measurements."
          />
        </SectionPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Meet lifecycle" description="Race meets, official configuration, and steward roster from /race-operations/race-office.">
          <RecordTable
            columns={[
              { key: 'meet', label: 'Meet' },
              { key: 'dates', label: 'Dates' },
              { key: 'stewards', label: 'Stewards' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(officeMeets.length ? officeMeets : calendarMeets, (m) => ({
              meet: String(m.name ?? m.meetId ?? m.id ?? '—'),
              dates: m.startsOn && m.endsOn ? `${String(m.startsOn)} → ${String(m.endsOn)}` : String(m.startDate ?? m.date ?? m.raceDate ?? '—'),
              stewards: formatStewardRoster(m),
              status: String(m.status ?? '—'),
            }))}
            emptyLabel="No meets returned from race office or racing calendar."
          />
        </SectionPanel>
        <SectionPanel title="Race days" description="Meet-linked race days and carding status from race office.">
          <RecordTable
            columns={[
              { key: 'day', label: 'Race day' },
              { key: 'meet', label: 'Meet' },
              { key: 'races', label: 'Races' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(officeRaceDays, (d) => ({
              day: String(d.raceDate ?? d.id ?? '—'),
              meet: String(d.meetId ?? '—'),
              races: String(Array.isArray(d.raceIds) ? d.raceIds.length : '—'),
              status: String(d.status ?? '—'),
            }))}
            emptyLabel="No race days returned from /race-operations/race-office."
          />
        </SectionPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Race card status" description="Race office cards with conditions, entries, and workflow approval posture.">
          <RecordTable
            columns={[
              { key: 'race', label: 'Race' },
              { key: 'classification', label: 'Conditions' },
              { key: 'entries', label: 'Entries' },
              { key: 'approvals', label: 'Approvals' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(cards.length ? cards : raceCards, (c) => {
              const entries = Array.isArray(c.entries) ? c.entries : [];
              const activeEntries = entries.filter((entry) => isRecord(entry) && entry.declared && !entry.scratched);
              return {
                race: String(c.raceNumber ?? c.raceId ?? c.id ?? '—'),
                classification: formatCardConditions(c),
                entries: entries.length ? `${activeEntries.length}/${entries.length}` : String(c.entryCount ?? '—'),
                approvals: formatApprovalSummary(c.approvals),
                status: String(c.lifecycleStatus ?? c.status ?? '—'),
              };
            })}
            emptyLabel="No race cards returned from race office or card management."
          />
        </SectionPanel>
        <SectionPanel title="Race office readiness" description="Per-race readiness assessments and blockers from race office.">
          <RecordTable
            columns={[
              { key: 'raceId', label: 'Race' },
              { key: 'ready', label: 'Ready' },
              { key: 'entries', label: 'Active entries' },
              { key: 'blockers', label: 'Blockers' },
            ]}
            rows={mapRecords(officeReadiness, (r) => ({
              raceId: String(r.raceId ?? '—'),
              ready: r.ready === true ? 'yes' : 'no',
              entries: r.activeEntries != null ? String(r.activeEntries) : '—',
              blockers: Array.isArray(r.blockers) && r.blockers.length ? r.blockers.map(String).join('; ') : '—',
            }))}
            emptyLabel="No race office readiness rows returned."
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
      <SectionPanel title="Steward and race command approvals" description="Locked safety-critical controls from /race-operations/race-office and starter workflows.">
        {stewardControls.length > 0 ? (
          <RecordTable
            className="mb-4"
            columns={[
              { key: 'label', label: 'Control' },
              { key: 'action', label: 'Action' },
              { key: 'target', label: 'Target' },
              { key: 'roles', label: 'Required roles' },
            ]}
            rows={stewardControls.map((control) => ({
              label: control.label,
              action: control.protectedAction ?? '—',
              target: control.target ?? '—',
              roles: control.requiredRoles?.join(', ') ?? '—',
            }))}
          />
        ) : null}
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
          onSubmitted={() => setCommandMessage('Gate race start approval requested. Complete approvals before submitting the race start command.')}
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
              paddockAssignments,
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
              [...startingGateAssignments, ...startingGateOpsAssignments],
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
            rows={mapRecords(
              scheduleRaces.length
                ? scheduleRaces
                : gateStartApprovalRaceIds().map((raceId) => ({ raceId, raceNumber: raceId, status: 'scheduled' })),
              (r) => ({
                race: String(r.raceNumber ?? r.raceId ?? '—'),
                post: String(r.postTime ?? '—'),
                status: String(r.status ?? '—'),
              }),
            )}
          />
          <ul className="mt-4 space-y-2">
            {(scheduleRaces.length
              ? scheduleRaces
              : gateStartApprovalRaceIds().map((raceId) => ({ raceId, raceNumber: raceId }))
            ).map((race) => {
              const raceId = resolveRaceId(race);
              const gateAction = raceStartApprovalAction(raceId);
              const commandAction = raceStartCommandAction(raceId);
              const approvalIds = gateStartApprovalIds(raceId);
              const commandDisabled = !roleCanUseAction(commandAction, session.role);
              return (
                <li key={raceId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Race {String(race.raceNumber ?? raceId)} — start command</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {approvalIds.length ? `Approval on file (${approvalIds.join(', ')})` : 'Request gate race start approval before submitting command.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!approvalIds.length ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!roleCanUseAction(gateAction, session.role)}
                        onClick={() => setDialog({ open: true, action: gateAction })}
                      >
                        Request approval
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="governance"
                      disabled={commandDisabled || raceStartCommandMutation.isPending || approvalIds.length === 0}
                      title={commandDisabled ? actionDisabledReason(commandAction, session.role) : approvalIds.length === 0 ? 'Request gate race start approval first' : commandAction.detail}
                      onClick={() => raceStartCommandMutation.mutate(raceId)}
                    >
                      Submit race start
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
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
