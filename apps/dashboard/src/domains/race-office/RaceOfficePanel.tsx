import { cloneElement } from 'react';
import { ActionRail, ApprovalChip, DataFreshness, DataTable, MetricStrip, MockDataBanner, RecordSourceLabel, RiskBadge, SafetyCriticalButton, StatusCard, WorkspacePanel } from '../../components/nexus-ui.js';
import type { AdapterMode, RaceOfficeApprovalControlDto, RaceOfficeCardDto, RaceOfficeConditionDto, RaceOfficeEntryDto, RaceOfficeWorkspaceDto } from '../../types.js';

type RaceOfficePanelProps = {
  workspace: RaceOfficeWorkspaceDto;
  mode: AdapterMode;
  authenticated: boolean;
};

type EntryRow = {
  card: RaceOfficeCardDto;
  entry: RaceOfficeEntryDto;
};

const listText = (items: string[] | undefined) => items?.length ? items.join(', ') : 'none';
const approvalStatus = (state: string) => state === 'approved' ? 'approved' : state === 'rejected' ? 'rejected' : state === 'pending' ? 'pending-approval' : 'pending';
const lifecycleTone = (status: string) => /cancel|blocked|official/i.test(status) ? 'critical' : /ready|approved|open/i.test(status) ? 'low' : /pending|watch|placeholder|incomplete/i.test(status) ? 'high' : 'medium';
const conditionText = (conditions: RaceOfficeConditionDto) => conditions.placeholder
  ? `PLACEHOLDER race conditions - missing ${listText(conditions.missingFields)}`
  : `${conditions.surface} ${conditions.distanceFurlongs ?? 'TBD'}f ${conditions.classLevel ?? 'class TBD'} purse ${conditions.purse ?? 'TBD'}`;

function raceUpdatedAt(workspace: RaceOfficeWorkspaceDto) {
  return workspace.cards.map((card) => card.updatedAt).find(Boolean)
    ?? workspace.raceDays.map((day) => day.updatedAt).find(Boolean)
    ?? workspace.meets.map((meet) => meet.updatedAt).find(Boolean);
}

function activeEntries(card: RaceOfficeCardDto) {
  return card.entries.filter((entry) => entry.declared && !entry.scratched);
}

function scratchEntries(card: RaceOfficeCardDto) {
  return card.entries.filter((entry) => entry.scratched);
}

function postPositionsDrawn(card: RaceOfficeCardDto) {
  const entries = activeEntries(card);
  return entries.length > 0 && entries.every((entry) => entry.postPosition);
}

function placeholderCount(workspace: RaceOfficeWorkspaceDto) {
  return workspace.cards.reduce((count, card) => count
    + (card.conditions.placeholder ? 1 : 0)
    + (card.declarationsPlaceholder ? 1 : 0)
    + card.entries.filter((entry) => entry.placeholder).length, 0);
}

function entryState(entry: RaceOfficeEntryDto) {
  if (entry.placeholder) return 'PLACEHOLDER entry - source feed incomplete';
  if (entry.scratched) return `Scratched - ${entry.scratchReason ?? 'reason pending'}; approval ${entry.scratchApprovedBy ?? 'required'}`;
  if (entry.declared) return 'Declared';
  return 'Declaration pending';
}

function approvalControlDetail(control: RaceOfficeApprovalControlDto) {
  return `${control.reason} Requires ${control.requiredRoles.join(', ')} with evidence ${control.evidence.join(', ')}. This control requests approval only; it does not mutate race state.`;
}

function RaceOfficeControlCard({ control, mode, authenticated }: { control: RaceOfficeApprovalControlDto; mode: AdapterMode; authenticated: boolean }) {
  const reasonId = `${control.id}-lock-reason`;
  return (
    <WorkspacePanel title={control.label} eyebrow="Safety-critical approval gate">
      <ApprovalChip status="pending-approval" />
      {SafetyCriticalButton({
        approvalsSatisfied: false,
        backendLive: mode === 'live',
        authenticated,
        reason: 'Safety-critical Race Office actions are locked in the shell. Request approval through the backend approval service; execution needs a human-issued approval token.',
        describedById: reasonId,
        ariaLabel: control.label,
        children: control.label,
      })}
      <p>{approvalControlDetail(control)}</p>
      <p>Action <code>{control.action}</code>; target <code>{control.target}</code>; locked {String(control.locked)}; safety critical {String(control.safetyCritical)}.</p>
      <code>{control.approvalApi}</code>
    </WorkspacePanel>
  );
}

function RaceCardSummary({ card }: { card: RaceOfficeCardDto }) {
  const active = activeEntries(card);
  const scratches = scratchEntries(card);
  const postsDrawn = postPositionsDrawn(card);
  return (
    <WorkspacePanel title={`Race ${card.raceNumber}`} eyebrow="Race card control">
      <RiskBadge level={lifecycleTone(card.status)} />
      <MetricStrip items={[
        { label: 'Status', value: card.status, detail: `Post ${card.scheduledPostTime ?? 'TBD'}` },
        { label: 'Active entries', value: String(active.length), detail: `${card.entries.length} total entries` },
        { label: 'Scratches', value: String(scratches.length), detail: scratches.map((entry) => entry.horseId).join(', ') || 'none' },
        { label: 'Posts drawn', value: String(postsDrawn), detail: active.map((entry) => `${entry.horseId}:${entry.postPosition ?? 'pending'}`).join(', ') || 'no active entries' },
      ]} />
      <p>Approvals: {Object.entries(card.approvals).map(([step, state]) => `${step}:${state}`).join(', ') || 'none'}.</p>
      <p>Controls: {listText(card.regulatoryControls)}; twins {listText(card.twinLinks)}; telemetry {listText(card.telemetryStreams)}.</p>
      {card.declarationsPlaceholder && <p role="status">PLACEHOLDER declarations - entry declaration feed is incomplete.</p>}
    </WorkspacePanel>
  );
}

function ConditionsPanel({ card }: { card: RaceOfficeCardDto }) {
  return (
    <WorkspacePanel title={`Race ${card.raceNumber} conditions`} eyebrow="Conditions book">
      <p>{conditionText(card.conditions)}</p>
      <p>Eligibility {listText(card.conditions.eligibility)}; medications {listText(card.conditions.medicationRules)}; weather {listText(card.conditions.weatherRestrictions)}; surface {listText(card.conditions.surfaceRequirements)}.</p>
      {card.conditions.placeholder && <p role="status">PLACEHOLDER race conditions are clearly labeled and must not be treated as official configuration.</p>}
    </WorkspacePanel>
  );
}

export function RaceOfficePanel({ workspace, mode, authenticated }: RaceOfficePanelProps) {
  const entries = workspace.cards.flatMap((card) => card.entries.map((entry) => ({ card, entry })));
  const readinessBlocked = workspace.readiness.filter((item) => !item.ready).length;
  const pendingApprovalControls = workspace.approvalControls.filter((control) => control.locked).length;
  const placeholders = placeholderCount(workspace);

  return (
    <section aria-label="Race Office workspace">
      <h2>Race Office</h2>
      <DataFreshness label="Race Office" timestamp={raceUpdatedAt(workspace)} mode={mode} />
      <RecordSourceLabel mock={workspace.mock === true || mode === 'mock'} label="Race Office" />
      <MockDataBanner active={workspace.mock === true || mode === 'mock'} source="Race Office mock/live adapter boundary" />
      <p>Harmonized console for race meets, race days, cards, conditions, entries, declarations, scratches, post positions, readiness checks, lifecycle status, and approval controls.</p>
      <p>Safety-critical changes such as scratches, cancellations, official configuration changes, distance changes, official results, and lifecycle transitions remain approval-gated, audited, event-emitting, and backend-authorized. This panel does not directly mutate race state.</p>
      <p role="alert">Scratch, cancellation, official configuration, and lifecycle changes require approved backend requests and never update local React state.</p>
      {(workspace.mock === true || mode === 'mock') && <p role="note" aria-label="Race Office mock-only data boundary">MOCK-ONLY Race Office data is labeled; safety-critical buttons still only describe approval request paths.</p>}
      <MetricStrip items={[
        { label: 'Meets', value: String(workspace.meets.length), detail: `${workspace.raceDays.length} race days loaded` },
        { label: 'Cards', value: String(workspace.cards.length), detail: `${entries.length} entries across cards` },
        { label: 'Readiness blockers', value: String(readinessBlocked), detail: `${workspace.readiness.length} readiness checks` },
        { label: 'Approval gates', value: String(pendingApprovalControls), detail: 'Locked pending human authorization' },
        { label: 'Placeholders', value: String(placeholders), detail: 'Clearly labeled incomplete or mock-only data' },
      ]} />

      <section aria-label="Race meets">
        <h3>Race meets</h3>
        {workspace.meets.map((meet) => (
          <WorkspacePanel key={meet.id} title={meet.name ?? meet.id} eyebrow="Meet control">
            <StatusCard title={meet.trackId} status={meet.status} detail={`Dates ${meet.startsOn ?? 'TBD'} to ${meet.endsOn ?? 'TBD'}`} />
            <p>Officials: stewards {listText(meet.officialConfig?.stewards)}, secretary {meet.officialConfig?.racingSecretary ?? 'TBD'}, commission {meet.officialConfig?.commission ?? 'TBD'}, rules {meet.officialConfig?.rulesVersion ?? 'TBD'}.</p>
            <p>Scratch deadline {meet.officialConfig?.scratchDeadlineMinutes ?? 'TBD'} minutes; max field size {meet.officialConfig?.maxFieldSize ?? 'TBD'}.</p>
          </WorkspacePanel>
        ))}
      </section>

      <section aria-label="Race days">
        <h3>Race days</h3>
        {workspace.raceDays.map((day) => (
          <WorkspacePanel key={day.id} title={day.raceDate} eyebrow="Race day carding">
            <StatusCard title={day.id} status={day.status} detail={`Meet ${day.meetId ?? 'TBD'}; track ${day.trackId ?? 'TBD'}`} />
            <p>Races: {listText(day.raceIds)}. Updated {day.updatedAt ?? 'TBD'}.</p>
          </WorkspacePanel>
        ))}
      </section>

      <section aria-label="Race cards">
        <h3>Race cards</h3>
        {workspace.cards.map((card) => cloneElement(RaceCardSummary({ card }), { key: card.id }))}
      </section>

      <section aria-label="Race conditions and declarations">
        <h3>Race conditions and declarations</h3>
        {workspace.cards.map((card) => cloneElement(ConditionsPanel({ card }), { key: `${card.id}-conditions` }))}
      </section>

      <section aria-label="Entries scratches and post positions">
        <h3>Entries, declarations, scratches, and post positions</h3>
        {DataTable<EntryRow>({
          label: 'Race Office entries scratches and post positions',
          rows: entries,
          getRowKey: (row) => `${row.card.id}-${row.entry.id}`,
          columns: [
            { key: 'race', header: 'Race', render: (row: EntryRow) => `Race ${row.card.raceNumber}` },
            { key: 'horse', header: 'Horse', render: (row: EntryRow) => row.entry.horseId },
            { key: 'trainer', header: 'Trainer / owner', render: (row: EntryRow) => `${row.entry.trainerId} / ${row.entry.ownerId}` },
            { key: 'declaration', header: 'Declaration', render: (row: EntryRow) => entryState(row.entry) },
            { key: 'post', header: 'Post / gate', render: (row: EntryRow) => `${row.entry.postPosition ?? 'POST PENDING'} / ${row.entry.gate ?? 'GATE PENDING'}` },
            { key: 'approval', header: 'Safety approval', render: (row: EntryRow) => row.entry.scratched ? `Scratch approval ${row.entry.scratchApprovedBy ?? 'required'}` : row.entry.placeholder ? 'Placeholder - not official' : 'No safety action requested' },
          ],
        })}
        <p>Scratches are displayed from backend-connected race data only. The shell does not mark horses scratched locally.</p>
      </section>

      <section aria-label="Race readiness checks">
        <h3>Race readiness checks</h3>
        {workspace.readiness.map((item) => (
          <WorkspacePanel key={item.raceId} title={item.raceId} eyebrow="Readiness">
            <RiskBadge level={item.ready ? 'low' : 'high'} />
            <MetricStrip items={[
              { label: 'Ready', value: String(item.ready), detail: `Assessed ${item.assessedAt ?? 'TBD'}` },
              { label: 'Active entries', value: String(item.activeEntries ?? 'TBD'), detail: 'Declared and not scratched' },
              { label: 'Telemetry', value: String(item.telemetryStreams?.length ?? 0), detail: listText(item.telemetryStreams) },
            ]} />
            <p role={item.ready ? 'status' : 'alert'}>Blockers: {listText(item.blockers)}.</p>
          </WorkspacePanel>
        ))}
      </section>

      <section aria-label="Race lifecycle status">
        <h3>Race lifecycle status</h3>
        {workspace.lifecycle.map((item) => (
          <WorkspacePanel key={`${item.raceId}-${item.status}`} title={`${item.raceId}: ${item.status}`} eyebrow="Lifecycle">
            <RiskBadge level={lifecycleTone(item.status)} />
            <p>Next action {item.nextAction}; approval required {String(item.approvalRequired)}.</p>
            <p>Event {item.eventType ?? 'pending'}; audit {item.auditId ?? 'pending'}; updated {item.updatedAt ?? 'TBD'}.</p>
            {item.approvalRequired && <ApprovalChip status="pending-approval" />}
          </WorkspacePanel>
        ))}
      </section>

      <section aria-label="Race office approval gates">
        <h3>Safety-critical approval controls</h3>
        <p>Approval controls route to the unified approval client path and remain disabled in the shell until a live backend and explicit human approval token authorize execution.</p>
        <div aria-label="Safety-critical approval controls">
          {workspace.approvalControls.map((control) => cloneElement(RaceOfficeControlCard({ control, mode, authenticated }), { key: control.id }))}
        </div>
        <ActionRail actions={workspace.approvalControls.map((control) => ({
          id: `${control.id}-rail`,
          label: control.label,
          detail: approvalControlDetail(control),
          approvalApi: control.approvalApi,
          locked: control.locked,
        }))} />
      </section>
    </section>
  );
}
