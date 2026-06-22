import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { HorseDataEntryHub } from '@/features/horse-data-entry/HorseDataEntryHub';
import { BulkDataEntryConsole } from '@/features/bulk-data-entry/BulkDataEntryConsole';
import { EquineObservationConsole } from '@/features/equine-observations/EquineObservationConsole';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { isRecord } from '@/lib/utils';
import { feedData } from '../feedUtils';

function buildEligibilityRules(eligibilityFeed: Record<string, unknown> | undefined): Record<string, unknown>[] {
  if (!eligibilityFeed) return [];
  const failedRules = extractArray<unknown>(eligibilityFeed, 'failedRules').map((rule) => String(rule));
  const warnings = extractArray<unknown>(eligibilityFeed, 'warnings').map((rule) => String(rule));
  return [
    ...failedRules.map((rule) => ({ rule, status: 'fail', detail: 'Failed eligibility check' })),
    ...warnings.map((rule) => ({ rule, status: 'watch', detail: 'Advisory warning' })),
  ];
}

function profileVetStatus(profile: Record<string, unknown> | undefined): string {
  if (!profile) return '—';
  const veterinary = profile.veterinary;
  if (veterinary === 'redacted') return 'restricted';
  if (isRecord(veterinary)) {
    const exams = extractArray(veterinary, 'examination_records');
    if (exams.length > 0) return 'exam-on-file';
  }
  return '—';
}

function profilePrivacy(profile: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const privacy = profile?.privacy;
  return isRecord(privacy) ? privacy : undefined;
}

export function EquinePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const profile = feedData<Record<string, unknown>>(results, '/horses/horse-1/profile');
  const eligibilityFeed = feedData<Record<string, unknown>>(results, '/horses/horse-1/eligibility');
  const auditFeed = feedData<Record<string, unknown>>(results, '/horses/horse-1/audit');
  const barn = feedData<Record<string, unknown>>(results, '/barn-operations/workspace');
  const registry = feedData<Record<string, unknown>>(results, '/horse-registry/workspace');
  const trainers = feedData<Record<string, unknown>>(results, '/trainer-management/workspace');
  const jockeys = feedData<Record<string, unknown>>(results, '/jockey-management/workspace');
  const veterinary = feedData<Record<string, unknown>>(results, '/veterinary-operations/workspace');
  const welfare = feedData<Record<string, unknown>>(results, '/equine-welfare/workspace');

  const eligibilityRules = buildEligibilityRules(eligibilityFeed);
  const stalls = extractArray<Record<string, unknown>>(barn, 'stalls');
  const movements = extractArray<Record<string, unknown>>(barn, 'movements');
  const vetVisits = extractArray<Record<string, unknown>>(barn, 'vetVisits');
  const horses = extractArray<Record<string, unknown>>(registry, 'horses');
  const trainerProfiles = extractArray<Record<string, unknown>>(trainers, 'trainers');
  const jockeyProfiles = extractArray<Record<string, unknown>>(jockeys, 'jockeys');
  const vetCases = extractArray<Record<string, unknown>>(veterinary, 'cases');
  const welfareIndicators = extractArray<Record<string, unknown>>(welfare, 'indicators');
  const welfareObservations = extractArray<Record<string, unknown>>(welfare, 'observations');
  const veterinaryObservations = vetCases.flatMap((vetCase) => extractArray<Record<string, unknown>>(vetCase, 'observations'));
  const equineAuditRecords = extractArray<Record<string, unknown>>(auditFeed, 'events');

  const identity = profile?.identity && typeof profile.identity === 'object' ? profile.identity as Record<string, unknown> : undefined;
  const ownership = profile?.ownershipHistory ?? profile?.ownership;
  const ownershipCount = Array.isArray(ownership) ? ownership.length : 0;
  const eligibilityStatus = eligibilityFeed?.status && typeof eligibilityFeed.status === 'object'
    ? eligibilityFeed.status as Record<string, unknown>
    : undefined;
  const privacy = profilePrivacy(profile);
  const redactedFields = extractArray<unknown>(privacy, 'redactedFields').map((field) => String(field));
  const auditVerification = auditFeed?.verification && typeof auditFeed.verification === 'object'
    ? auditFeed.verification as Record<string, unknown>
    : undefined;

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'horse', label: 'Horse', value: String(identity?.name ?? profile?.horseId ?? 'horse-1') },
          { id: 'scope', label: 'Privacy scope', value: String(privacy?.scope ?? profile?.role ?? '—') },
          { id: 'vet', label: 'Vet status', value: profileVetStatus(profile) },
          { id: 'eligible', label: 'Eligibility', value: String(eligibilityFeed?.eligible ?? '—') },
          { id: 'registry', label: 'Registry horses', value: String(horses.length) },
          { id: 'welfare', label: 'Welfare score', value: welfare?.overallScore != null ? String(welfare.overallScore) : '—' },
        ]}
      />
      <HorseDataEntryHub
        profile={profile}
        registry={registry}
        eligibilityFeed={eligibilityFeed}
        auditFeed={auditFeed}
        welfareFeed={welfare}
      />
      <BulkDataEntryConsole
        title="Equine bulk entry"
        description="Bulk horse imports, trainer assignments, and paddock/eligibility status updates with preview and partial commit."
        operationIds={['horse-import', 'trainer-assignments', 'status-updates']}
      />
      <EquineObservationConsole
        horseId={String(identity?.horseId ?? profile?.horseId ?? 'horse-1')}
        veterinaryObservations={veterinaryObservations}
        welfareObservations={welfareObservations}
      />
      <SectionPanel title="Privacy scope" description="Role-based veterinary and eligibility visibility enforced server-side.">
        <RecordTable
          columns={[
            { key: 'field', label: 'Field' },
            { key: 'value', label: 'Value' },
          ]}
          rows={[
            { field: 'Viewer role', value: String(profile?.role ?? '—') },
            { field: 'Privacy scope', value: String(privacy?.scope ?? '—') },
            { field: 'Redacted fields', value: redactedFields.length > 0 ? redactedFields.join(', ') : 'none' },
            { field: 'Policy reason', value: String(privacy?.reason ?? '—') },
            { field: 'Veterinary visibility', value: profileVetStatus(profile) },
            { field: 'Audit chain valid', value: auditVerification?.valid === true ? 'verified' : auditVerification?.valid === false ? 'invalid' : '—' },
          ]}
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Horse registry" description="Lifecycle registration and identity records.">
          <RecordTable
            columns={[
              { key: 'horse', label: 'Horse' },
              { key: 'status', label: 'Status' },
              { key: 'trainer', label: 'Trainer' },
            ]}
            rows={mapRecords(horses, (h) => {
              const horseIdentity = h.identity && typeof h.identity === 'object' ? h.identity as Record<string, unknown> : h;
              return {
                horse: String(horseIdentity.name ?? horseIdentity.horseId ?? h.name ?? h.horseId ?? '—'),
                status: String(horseIdentity.lifecycleStatus ?? h.status ?? h.registrationStatus ?? '—'),
                trainer: String(h.trainerId ?? h.trainerName ?? horseIdentity.trainerId ?? '—'),
              };
            })}
            emptyLabel="No registry horses returned."
          />
        </SectionPanel>
        <SectionPanel title="Ownership & profile" description="Profile, ownership history, and eligibility posture.">
          <RecordTable
            columns={[
              { key: 'field', label: 'Field' },
              { key: 'value', label: 'Value' },
            ]}
            rows={[
              { field: 'Ownership records', value: String(ownershipCount) },
              { field: 'Eligible', value: String(eligibilityFeed?.eligible ?? '—') },
              { field: 'Failed rules', value: String(extractArray(eligibilityFeed, 'failedRules').length) },
              { field: 'Warnings', value: String(extractArray(eligibilityFeed, 'warnings').length) },
              { field: 'Scratch status', value: String(eligibilityStatus?.scratchStatus ?? '—') },
            ]}
          />
        </SectionPanel>
      </div>
      <SectionPanel title="Eligibility rules" description="Pass/fail checklist for race-day eligibility.">
        <RecordTable
          columns={[
            { key: 'rule', label: 'Rule' },
            { key: 'status', label: 'Status' },
            { key: 'detail', label: 'Detail' },
          ]}
          rows={mapRecords(eligibilityRules, (r) => ({
            rule: String(r.rule ?? r.id ?? r.name ?? '—'),
            status: String(r.status ?? (r.passed === true ? 'pass' : r.passed === false ? 'fail' : '—')),
            detail: String(r.detail ?? r.reason ?? '—'),
          }))}
          emptyLabel="No eligibility rules returned."
        />
      </SectionPanel>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Trainer & jockey management">
          <RecordTable
            columns={[
              { key: 'person', label: 'Name' },
              { key: 'role', label: 'Role' },
              { key: 'status', label: 'Status' },
            ]}
            rows={[
              ...mapRecords(trainerProfiles, (t) => ({
                person: String(t.name ?? t.trainerId ?? '—'),
                role: 'Trainer',
                status: String(t.complianceStatus ?? t.status ?? '—'),
              })),
              ...mapRecords(jockeyProfiles, (j) => ({
                person: String(j.name ?? j.jockeyId ?? '—'),
                role: 'Jockey',
                status: String(j.eligibilityStatus ?? j.status ?? '—'),
              })),
            ]}
            emptyLabel="No trainer or jockey records."
          />
        </SectionPanel>
        <SectionPanel title="Veterinary operations" description="Clearance cases and welfare-restricted clinical posture.">
          <RecordTable
            columns={[
              { key: 'case', label: 'Case' },
              { key: 'horse', label: 'Horse' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(vetCases, (c) => ({
              case: String(c.id ?? c.caseId ?? '—'),
              horse: String(c.horseId ?? '—'),
              status: String(c.status ?? c.clearanceStatus ?? '—'),
            }))}
            emptyLabel="No veterinary cases listed."
          />
        </SectionPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Equine welfare intelligence">
          <RecordTable
            columns={[
              { key: 'indicator', label: 'Indicator' },
              { key: 'status', label: 'Status' },
              { key: 'score', label: 'Score' },
            ]}
            rows={mapRecords(welfareIndicators, (i) => ({
              indicator: String(i.name ?? i.id ?? '—'),
              status: String(i.status ?? '—'),
              score: i.score != null ? String(i.score) : '—',
            }))}
            emptyLabel="No welfare indicators."
          />
        </SectionPanel>
        <SectionPanel title="Equine privacy audit" description="Hash-chained equine profile and eligibility audit events.">
          <RecordTable
            columns={[
              { key: 'action', label: 'Action' },
              { key: 'actor', label: 'Actor' },
              { key: 'time', label: 'Time' },
            ]}
            rows={mapRecords(equineAuditRecords, (r) => ({
              action: String(r.type ?? r.action ?? '—'),
              actor: String(r.actorId ?? r.actor ?? '—'),
              time: String(r.occurredAt ?? r.timestamp ?? '—'),
            }))}
            emptyLabel="No equine audit records."
          />
        </SectionPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Barn stalls">
          <RecordTable
            columns={[
              { key: 'stall', label: 'Stall' },
              { key: 'horse', label: 'Horse' },
              { key: 'status', label: 'Status' },
            ]}
            rows={mapRecords(stalls, (s) => ({
              stall: String(s.stallId ?? s.id ?? '—'),
              horse: String(s.horseId ?? s.horseName ?? '—'),
              status: String(s.status ?? '—'),
            }))}
          />
        </SectionPanel>
        <SectionPanel title="Movements & access">
          <RecordTable
            columns={[
              { key: 'time', label: 'Time' },
              { key: 'type', label: 'Type' },
              { key: 'detail', label: 'Detail' },
            ]}
            rows={mapRecords([...movements, ...vetVisits], (m) => ({
              time: String(m.timestamp ?? m.observedAt ?? m.visitedAt ?? '—'),
              type: String(m.type ?? m.visitType ?? 'movement'),
              detail: String(m.detail ?? m.reason ?? m.zone ?? '—'),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}
