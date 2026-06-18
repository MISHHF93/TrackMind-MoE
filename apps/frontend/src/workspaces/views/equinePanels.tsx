import type { ReactElement } from 'react';
import { KpiStrip } from '@/design/components/kpi-strip';
import { mapRecords, RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { extractArray } from '@/hooks/useWorkspaceData';
import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { feedData } from '../feedUtils';

export function EquinePanels({ results }: { results: WorkspaceDataResult[] }): ReactElement {
  const horse = feedData<Record<string, unknown>>(results, '/equine-intelligence/horses');
  const profile = feedData<Record<string, unknown>>(results, '/horses/horse-1/profile');
  const eligibilityFeed = feedData<Record<string, unknown>>(results, '/horses/horse-1/eligibility');
  const barn = feedData<Record<string, unknown>>(results, '/barn-operations/workspace');
  const registry = feedData<Record<string, unknown>>(results, '/horse-registry/workspace');
  const trainers = feedData<Record<string, unknown>>(results, '/trainer-management/workspace');
  const jockeys = feedData<Record<string, unknown>>(results, '/jockey-management/workspace');
  const veterinary = feedData<Record<string, unknown>>(results, '/veterinary-operations/workspace');
  const welfare = feedData<Record<string, unknown>>(results, '/equine-welfare/workspace');
  const welfareAudit = feedData<Record<string, unknown>>(results, '/equine-welfare/audit-trail');

  const eligibilityRules = extractArray<Record<string, unknown>>(horse, 'eligibilityRules');
  const stalls = extractArray<Record<string, unknown>>(barn, 'stalls');
  const movements = extractArray<Record<string, unknown>>(barn, 'movements');
  const vetVisits = extractArray<Record<string, unknown>>(barn, 'vetVisits');
  const horses = extractArray<Record<string, unknown>>(registry, 'horses');
  const trainerProfiles = extractArray<Record<string, unknown>>(trainers, 'trainers');
  const jockeyProfiles = extractArray<Record<string, unknown>>(jockeys, 'jockeys');
  const vetCases = extractArray<Record<string, unknown>>(veterinary, 'cases');
  const welfareIndicators = extractArray<Record<string, unknown>>(welfare, 'indicators');
  const auditRecords = extractArray<Record<string, unknown>>(welfareAudit, 'records');

  const vetStatus = horse && typeof horse.veterinaryStatus === 'object' ? horse.veterinaryStatus as Record<string, unknown> : undefined;
  const eligibility = horse && typeof horse.eligibilityStatus === 'object' ? horse.eligibilityStatus as Record<string, unknown> : undefined;
  const ownership = profile?.ownershipHistory ?? profile?.ownership;
  const ownershipCount = Array.isArray(ownership) ? ownership.length : 0;

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { id: 'horse', label: 'Horse', value: String(horse?.name ?? horse?.horseId ?? profile?.horseId ?? 'horse-1') },
          { id: 'vet', label: 'Vet status', value: String(vetStatus?.status ?? eligibilityFeed?.status ?? '—') },
          { id: 'eligible', label: 'Eligibility', value: String(eligibility?.status ?? eligibilityFeed?.eligible ?? '—') },
          { id: 'registry', label: 'Registry horses', value: String(horses.length) },
          { id: 'welfare', label: 'Welfare score', value: welfare?.overallScore != null ? String(welfare.overallScore) : '—' },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel title="Horse registry" description="Lifecycle registration and identity records.">
          <RecordTable
            columns={[
              { key: 'horse', label: 'Horse' },
              { key: 'status', label: 'Status' },
              { key: 'trainer', label: 'Trainer' },
            ]}
            rows={mapRecords(horses, (h) => {
              const identity = h.identity && typeof h.identity === 'object' ? h.identity as Record<string, unknown> : h;
              return {
                horse: String(identity.name ?? identity.horseId ?? h.name ?? h.horseId ?? '—'),
                status: String(identity.lifecycleStatus ?? h.status ?? h.registrationStatus ?? '—'),
                trainer: String(h.trainerId ?? h.trainerName ?? identity.trainerId ?? '—'),
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
        <SectionPanel title="Welfare audit trail" description="Hash-chained welfare audit references.">
          <RecordTable
            columns={[
              { key: 'action', label: 'Action' },
              { key: 'actor', label: 'Actor' },
              { key: 'time', label: 'Time' },
            ]}
            rows={mapRecords(auditRecords, (r) => ({
              action: String(r.action ?? '—'),
              actor: String(r.actor ?? r.actorId ?? '—'),
              time: String(r.timestamp ?? '—'),
            }))}
            emptyLabel="No welfare audit records."
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
