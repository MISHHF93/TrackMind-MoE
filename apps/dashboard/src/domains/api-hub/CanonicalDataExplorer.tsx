import { DataTable, MetricStrip, MockDataBanner, RecordSourceLabel, RiskBadge, StatusCard, WorkspacePanel } from '../../components/nexus-ui.js';
import type { AdapterMode, ComplianceControlLibraryDto, EquineIntelligenceDto, RaceOfficeCardDto, RaceOfficeWorkspaceDto, StewardCenterDto, SurfaceIntelligenceDto, TUSStandardizationWorkspaceDto } from '../../types.js';

type CanonicalKind =
  | 'race-card'
  | 'race'
  | 'entry'
  | 'official-result'
  | 'horse-identity'
  | 'person-identity'
  | 'workout'
  | 'past-performance'
  | 'surface-record'
  | 'regulatory-record'
  | 'steward-note';

type RestrictionProfile = {
  display: string;
  public: 'allowed' | 'restricted' | 'embargoed';
  training: 'allowed' | 'restricted' | 'prohibited';
  note: string;
};

type CanonicalRecord = {
  id: string;
  kind: CanonicalKind;
  label: string;
  providerRefs: string[];
  normalizedFields: Record<string, string | number | boolean>;
  sourceLineage: string[];
  restrictions: RestrictionProfile;
  qualityScore: number;
  artifactRegistryId: string;
  readOnly: boolean;
};

export type CanonicalDataExplorerData = {
  mode: AdapterMode;
  raceOffice: RaceOfficeWorkspaceDto;
  equineIntelligence: EquineIntelligenceDto;
  stewardCenter: StewardCenterDto;
  surfaceIntelligence: SurfaceIntelligenceDto;
  complianceLibrary: ComplianceControlLibraryDto;
  tusStandardization: TUSStandardizationWorkspaceDto;
};

type CanonicalDataExplorerProps = {
  data: CanonicalDataExplorerData;
};

const displayLicensed: RestrictionProfile = {
  display: 'licensed operational display',
  public: 'restricted',
  training: 'restricted',
  note: 'Provider terms and tenant policy apply before reuse.',
};

const publicProgram: RestrictionProfile = {
  display: 'public race-card display',
  public: 'allowed',
  training: 'restricted',
  note: 'Public program facts only; raw payloads and private notes excluded.',
};

const officialReadOnly: RestrictionProfile = {
  display: 'official read-only display',
  public: 'embargoed',
  training: 'prohibited',
  note: 'Official results and steward notes are immutable in this frontend.',
};

const confidentialCare: RestrictionProfile = {
  display: 'licensed care-team display',
  public: 'restricted',
  training: 'prohibited',
  note: 'Veterinary, steward, and identity-sensitive fields are excluded from training.',
};

function compactId(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function artifactId(kind: CanonicalKind, id: string) {
  return `artifact:canonical:${kind}:${compactId(id)}`;
}

function list(items: Array<string | undefined>, empty = 'none') {
  const present = items.filter((item): item is string => Boolean(item));
  return present.length ? present.join(', ') : empty;
}

function fieldSummary(fields: CanonicalRecord['normalizedFields']) {
  return Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('; ');
}

function qualityRisk(score: number) {
  if (score >= 90) return 'low' as const;
  if (score >= 80) return 'medium' as const;
  return 'high' as const;
}

function record(kind: CanonicalKind, id: string, input: Omit<CanonicalRecord, 'id' | 'kind' | 'artifactRegistryId'>): CanonicalRecord {
  return { id, kind, artifactRegistryId: artifactId(kind, id), ...input };
}

function cardLineage(card: RaceOfficeCardDto) {
  return [
    '/api/v1/race-operations/race-office',
    `raceOfficeCard:${card.id}`,
    card.updatedAt ? `updated:${card.updatedAt}` : 'updated:pending',
    ...card.telemetryStreams?.map((stream) => `telemetry:${stream}`) ?? [],
  ];
}

function raceCardRows(workspace: RaceOfficeWorkspaceDto): CanonicalRecord[] {
  return workspace.cards.map((card) => record('race-card', card.id, {
    label: `Race ${card.raceNumber} card`,
    providerRefs: [`race-office:${card.id}`, ...(card.twinLinks ?? []), ...(card.regulatoryControls ?? [])],
    normalizedFields: {
      raceNumber: card.raceNumber,
      raceDate: card.raceDate ?? 'TBD',
      status: card.status,
      surface: card.conditions.surface,
      entries: card.entries.length,
      declarationsPlaceholder: card.declarationsPlaceholder === true,
    },
    sourceLineage: cardLineage(card),
    restrictions: publicProgram,
    qualityScore: card.declarationsPlaceholder ? 83 : 94,
    readOnly: true,
  }));
}

function raceRows(workspace: RaceOfficeWorkspaceDto): CanonicalRecord[] {
  return workspace.cards.map((card) => {
    const readiness = workspace.readiness.find((item) => item.raceId === card.id);
    const lifecycle = workspace.lifecycle.find((item) => item.raceId === card.id);
    return record('race', `race:${card.id}`, {
      label: `Race ${card.raceNumber}`,
      providerRefs: [`race-office:${card.id}`, `race-day:${workspace.raceDays.find((day) => day.raceIds.includes(card.id))?.id ?? 'pending'}`],
      normalizedFields: {
        status: card.status,
        readinessReady: readiness?.ready ?? false,
        activeEntries: readiness?.activeEntries ?? card.entries.filter((entry) => entry.declared && !entry.scratched).length,
        lifecycle: lifecycle?.status ?? 'pending',
      },
      sourceLineage: [...cardLineage(card), `readiness:${readiness?.assessedAt ?? 'pending'}`, `audit:${lifecycle?.auditId ?? 'pending'}`],
      restrictions: displayLicensed,
      qualityScore: readiness?.ready ? 92 : 86,
      readOnly: true,
    });
  });
}

function entryRows(workspace: RaceOfficeWorkspaceDto): CanonicalRecord[] {
  return workspace.cards.flatMap((card) => card.entries.map((entry) => record('entry', entry.id, {
    label: `${entry.horseId} in Race ${card.raceNumber}`,
    providerRefs: [`race-office:${card.id}`, `entry:${entry.id}`, `horse:${entry.horseId}`, `trainer:${entry.trainerId}`, `owner:${entry.ownerId}`],
    normalizedFields: {
      raceId: card.id,
      declared: entry.declared === true,
      scratched: entry.scratched === true,
      postPosition: entry.postPosition ?? 'pending',
      gate: entry.gate ?? 'pending',
      placeholder: entry.placeholder === true,
    },
    sourceLineage: [...cardLineage(card), entry.scratched ? `scratchApproval:${entry.scratchApprovedBy ?? 'required'}` : 'scratch:none'],
    restrictions: entry.placeholder ? displayLicensed : publicProgram,
    qualityScore: entry.placeholder ? 72 : entry.scratched ? 84 : 93,
    readOnly: true,
  })));
}

function officialResultRows(workspace: RaceOfficeWorkspaceDto, stewardCenter: StewardCenterDto): CanonicalRecord[] {
  const lifecycleRows = workspace.lifecycle
    .filter((item) => /official|result/i.test(item.status) || /official/i.test(item.nextAction))
    .map((item) => record('official-result', `official-result:${item.raceId}`, {
      label: `${item.raceId} official result lock`,
      providerRefs: [`race-office:${item.raceId}`, ...stewardCenter.inquiries.filter((inquiry) => inquiry.raceId === item.raceId).map((inquiry) => `stewarding:${inquiry.id}`)],
      normalizedFields: {
        status: item.status,
        nextAction: item.nextAction,
        approvalRequired: item.approvalRequired,
        modifiableFromFrontend: false,
      },
      sourceLineage: ['/api/v1/race-operations/race-office', '/api/v1/stewarding/inquiries', `event:${item.eventType ?? 'pending'}`, `audit:${item.auditId ?? 'pending'}`],
      restrictions: officialReadOnly,
      qualityScore: 91,
      readOnly: true,
    }));

  if (lifecycleRows.length) return lifecycleRows;

  return stewardCenter.inquiries.map((inquiry) => record('official-result', `official-result:${inquiry.raceId}`, {
    label: `${inquiry.raceId} official result review`,
    providerRefs: [`stewarding:${inquiry.id}`],
    normalizedFields: {
      status: inquiry.status,
      involvedHorses: inquiry.involvedHorses.map((horse) => horse.horseId).join(', '),
      finalRuling: inquiry.finalRuling?.id ?? 'pending',
      modifiableFromFrontend: false,
    },
    sourceLineage: ['/api/v1/stewarding/inquiries', ...inquiry.auditRecords.map((audit) => `audit:${audit.id}`)],
    restrictions: officialReadOnly,
    qualityScore: 88,
    readOnly: true,
  }));
}

function horseIdentityRows(data: CanonicalDataExplorerData): CanonicalRecord[] {
  const horses = new Map<string, { name: string; refs: string[]; fields: Record<string, string | number | boolean>; quality: number }>();
  const horse = data.equineIntelligence.horse;
  horses.set(horse.horseId, {
    name: horse.name,
    refs: [`equine-intelligence:${horse.horseId}`, ...data.equineIntelligence.digitalTwinReferences.map((ref) => ref.twinId)],
    fields: { lifecycleStatus: horse.lifecycleStatus, microchipRecorded: Boolean(horse.microchipId), tenantId: horse.tenantId ?? 'tenant-pending' },
    quality: horse.microchipId ? 93 : 82,
  });
  for (const card of data.raceOffice.cards) {
    for (const entry of card.entries) {
      if (!horses.has(entry.horseId)) horses.set(entry.horseId, { name: entry.horseId, refs: [`race-office:${card.id}`, `entry:${entry.id}`], fields: { lifecycleStatus: 'unknown', microchipRecorded: false, tenantId: 'unknown' }, quality: entry.placeholder ? 70 : 78 });
    }
  }
  for (const inquiry of data.stewardCenter.inquiries) {
    for (const item of inquiry.involvedHorses) {
      const existing = horses.get(item.horseId);
      horses.set(item.horseId, {
        name: existing?.name === item.horseId || !existing ? item.name : existing.name,
        refs: [...existing?.refs ?? [], `stewarding:${inquiry.id}`, `program:${item.programNumber}`],
        fields: { ...existing?.fields, officialResultLocked: item.officialResultLocked },
        quality: Math.max(existing?.quality ?? 0, 88),
      });
    }
  }
  return [...horses.entries()].map(([id, item]) => record('horse-identity', `horse:${id}`, {
    label: item.name,
    providerRefs: [...new Set(item.refs)],
    normalizedFields: item.fields,
    sourceLineage: ['/api/v1/equine-intelligence/horses/{horseId}', '/api/v1/race-operations/race-office', '/api/v1/stewarding/inquiries'],
    restrictions: confidentialCare,
    qualityScore: item.quality,
    readOnly: true,
  }));
}

function personIdentityRows(data: CanonicalDataExplorerData): CanonicalRecord[] {
  const people = new Map<string, { label: string; refs: string[]; fields: Record<string, string | number | boolean>; quality: number }>();
  const upsert = (id: string, label: string, role: string, refs: string[], fields: Record<string, string | number | boolean> = {}, quality = 86) => {
    const existing = people.get(id);
    people.set(id, {
      label: existing?.label ?? label,
      refs: [...existing?.refs ?? [], ...refs],
      fields: { ...existing?.fields, role, ...fields },
      quality: Math.max(existing?.quality ?? 0, quality),
    });
  };

  for (const owner of data.equineIntelligence.ownership) upsert(owner.ownerId, owner.ownerName, 'owner', [`owner:${owner.ownerId}`, `horse:${data.equineIntelligence.horse.horseId}`], { ownershipPercent: owner.percentage }, 90);
  for (const trainer of data.equineIntelligence.trainerAssignments) upsert(trainer.trainerId, trainer.trainerName, 'trainer', [`trainer:${trainer.trainerId}`], { licenseStatus: trainer.licenseStatus }, trainer.licenseStatus === 'active' ? 92 : 76);
  for (const card of data.raceOffice.cards) {
    for (const entry of card.entries) {
      upsert(entry.trainerId, entry.trainerId, 'trainer', [`race-office:${card.id}`, `entry:${entry.id}`], {}, entry.placeholder ? 72 : 82);
      upsert(entry.ownerId, entry.ownerId, 'owner', [`race-office:${card.id}`, `entry:${entry.id}`], {}, entry.placeholder ? 72 : 82);
      if (entry.jockeyId) upsert(entry.jockeyId, entry.jockeyId, 'jockey', [`race-office:${card.id}`, `entry:${entry.id}`], { assignedHorse: entry.horseId }, 84);
    }
  }
  for (const meet of data.raceOffice.meets) {
    if (meet.officialConfig?.racingSecretary) upsert(meet.officialConfig.racingSecretary, meet.officialConfig.racingSecretary, 'racing-secretary', [`meet:${meet.id}`], { rulesVersion: meet.officialConfig.rulesVersion }, 88);
    for (const steward of meet.officialConfig?.stewards ?? []) upsert(steward, steward, 'steward', [`meet:${meet.id}`], { commission: meet.officialConfig?.commission ?? 'pending' }, 88);
  }
  for (const inquiry of data.stewardCenter.inquiries) {
    for (const jockey of inquiry.involvedJockeys) upsert(jockey.jockeyId, jockey.name, 'jockey', [`stewarding:${inquiry.id}`, `license:${jockey.licenseId}`], { licenseId: jockey.licenseId, horseId: jockey.horseId }, 91);
  }

  return [...people.entries()].map(([id, person]) => record('person-identity', `person:${id}`, {
    label: person.label,
    providerRefs: [...new Set(person.refs)],
    normalizedFields: person.fields,
    sourceLineage: ['/api/v1/race-operations/race-office', '/api/v1/equine-intelligence/horses/{horseId}', '/api/v1/stewarding/inquiries'],
    restrictions: confidentialCare,
    qualityScore: person.quality,
    readOnly: true,
  }));
}

function workoutRows(data: CanonicalDataExplorerData): CanonicalRecord[] {
  return data.equineIntelligence.workoutHistory.map((workout) => record('workout', workout.workoutId, {
    label: `${data.equineIntelligence.horse.name} workout ${workout.date}`,
    providerRefs: [`equine-intelligence:${data.equineIntelligence.horse.horseId}`, `workout:${workout.workoutId}`],
    normalizedFields: { date: workout.date, distanceFurlongs: workout.distanceFurlongs, timeSeconds: workout.timeSeconds, surface: workout.surface, trackId: workout.trackId ?? 'not reported' },
    sourceLineage: ['/api/v1/equine-intelligence/horses/{horseId}', ...data.equineIntelligence.audit.map((audit) => `audit:${audit.id}`)],
    restrictions: displayLicensed,
    qualityScore: 87,
    readOnly: true,
  }));
}

function pastPerformanceRows(data: CanonicalDataExplorerData): CanonicalRecord[] {
  return data.equineIntelligence.raceHistory.map((race) => record('past-performance', `past-performance:${race.raceId}`, {
    label: `${data.equineIntelligence.horse.name} ${race.raceId}`,
    providerRefs: [`equine-intelligence:${data.equineIntelligence.horse.horseId}`, `race:${race.raceId}`],
    normalizedFields: { date: race.date, trackId: race.trackId, status: race.status, finishPosition: race.finishPosition ?? 'pending' },
    sourceLineage: ['/api/v1/equine-intelligence/horses/{horseId}', '/api/v1/race-operations/race-office'],
    restrictions: publicProgram,
    qualityScore: race.finishPosition ? 92 : 80,
    readOnly: true,
  }));
}

function surfaceRegulatoryRows(data: CanonicalDataExplorerData): CanonicalRecord[] {
  const surfaceRows = [
    ...data.surfaceIntelligence.sectors.map((sector) => record('surface-record', `surface:${sector.id}`, {
      label: sector.name,
      providerRefs: [`surface-intelligence:${sector.id}`, `track:${data.surfaceIntelligence.trackId}`],
      normalizedFields: { surfaceType: sector.surfaceType, status: sector.status, conditionScore: sector.conditionScore, moisture: sector.moisture, compaction: sector.compaction },
      sourceLineage: ['/api/v1/surface-intelligence/workspace', `inspection:${sector.latestInspectionAt}`],
      restrictions: displayLicensed,
      qualityScore: sector.conditionScore,
      readOnly: true,
    })),
    ...data.surfaceIntelligence.recommendations.map((recommendation) => record('surface-record', `surface-recommendation:${recommendation.id}`, {
      label: recommendation.recommendation,
      providerRefs: [`surface-intelligence:${recommendation.id}`, `sector:${recommendation.sectorId}`],
      normalizedFields: { type: recommendation.type, priority: recommendation.priority, executionState: recommendation.executionState, requiresHumanApproval: recommendation.requiresHumanApproval },
      sourceLineage: ['/api/v1/surface-intelligence/workspace', `event:${recommendation.eventId}`, `audit:${recommendation.auditId}`],
      restrictions: confidentialCare,
      qualityScore: recommendation.executionState === 'approval-required' ? 86 : 91,
      readOnly: true,
    })),
  ];

  const raceRegulatoryRows = data.raceOffice.cards.flatMap((card) => (card.regulatoryControls ?? []).map((control) => record('regulatory-record', `regulatory:${card.id}:${control}`, {
    label: `${control} control for Race ${card.raceNumber}`,
    providerRefs: [`race-office:${card.id}`, `regulatory:${control}`],
    normalizedFields: { raceId: card.id, control, approvalState: list(Object.entries(card.approvals).map(([step, state]) => `${step}:${state}`)) },
    sourceLineage: cardLineage(card),
    restrictions: displayLicensed,
    qualityScore: 88,
    readOnly: true,
  })));

  const complianceRows = data.complianceLibrary.frameworks.map((framework) => record('regulatory-record', `framework:${framework.id}`, {
    label: framework.name,
    providerRefs: [`compliance-framework:${framework.id}`, `authority:${framework.authority}`],
    normalizedFields: { frameworkId: framework.id, placeholder: framework.placeholder, domains: framework.domains.join(', ') },
    sourceLineage: ['/api/v1/compliance/control-library', `authority:${framework.authority}`],
    restrictions: displayLicensed,
    qualityScore: framework.placeholder ? 76 : 89,
    readOnly: true,
  }));

  return [...surfaceRows, ...raceRegulatoryRows, ...complianceRows];
}

function stewardNoteRows(data: CanonicalDataExplorerData): CanonicalRecord[] {
  return data.stewardCenter.inquiries.flatMap((inquiry) => [
    ...inquiry.decisionDrafts.map((draft) => record('steward-note', `steward-note:${draft.id}`, {
      label: draft.recommendation,
      providerRefs: [`stewarding:${inquiry.id}`, `draft:${draft.id}`, ...draft.evidenceIds, ...draft.ruleIds],
      normalizedFields: {
        raceId: inquiry.raceId,
        authorRole: draft.authorRole,
        aiGenerated: draft.aiGenerated,
        officialRuling: draft.officialRuling,
        modifiableFromFrontend: false,
      },
      sourceLineage: ['/api/v1/stewarding/inquiries', ...inquiry.auditRecords.map((audit) => `audit:${audit.id}`)],
      restrictions: officialReadOnly,
      qualityScore: draft.evidenceIds.length && draft.ruleIds.length ? 90 : 80,
      readOnly: true,
    })),
    ...inquiry.evidenceReferences.filter((evidence) => evidence.aiGenerated).map((evidence) => record('steward-note', `steward-note:${evidence.id}`, {
      label: evidence.description,
      providerRefs: [`stewarding:${inquiry.id}`, `evidence:${evidence.id}`, evidence.uri],
      normalizedFields: { raceId: inquiry.raceId, kind: evidence.kind, aiGenerated: evidence.aiGenerated === true, officialRuling: false, modifiableFromFrontend: false },
      sourceLineage: ['/api/v1/stewarding/inquiries', `hash:${evidence.hash}`, `audit:${evidence.auditRecordId ?? 'pending'}`],
      restrictions: officialReadOnly,
      qualityScore: 86,
      readOnly: true,
    })),
  ]);
}

function CanonicalRecordTable({ label, rows, emptyMessage }: { label: string; rows: CanonicalRecord[]; emptyMessage?: string }) {
  return <DataTable label={label} rows={rows} getRowKey={(row) => row.id} emptyMessage={emptyMessage} columns={[
    { key: 'record', header: 'Record', render: (row) => <><strong>{row.label}</strong><br /><code>{row.kind}</code></> },
    { key: 'providerRefs', header: 'Provider refs', render: (row) => <code>{list(row.providerRefs)}</code> },
    { key: 'normalized', header: 'Normalized fields', render: (row) => fieldSummary(row.normalizedFields) },
    { key: 'lineage', header: 'Source lineage', render: (row) => <code>{list(row.sourceLineage)}</code> },
    { key: 'license', header: 'License and restrictions', render: (row) => `${row.restrictions.display}; public ${row.restrictions.public}; training ${row.restrictions.training}. ${row.restrictions.note}` },
    { key: 'quality', header: 'Quality / artifact', render: (row) => <><RiskBadge level={qualityRisk(row.qualityScore)} /> {row.qualityScore}<br /><code>{row.artifactRegistryId}</code></> },
  ]} />;
}

export function CanonicalDataExplorer({ data }: CanonicalDataExplorerProps) {
  const rows = {
    raceCards: raceCardRows(data.raceOffice),
    races: raceRows(data.raceOffice),
    entries: entryRows(data.raceOffice),
    results: officialResultRows(data.raceOffice, data.stewardCenter),
    horses: horseIdentityRows(data),
    people: personIdentityRows(data),
    workouts: workoutRows(data),
    pastPerformance: pastPerformanceRows(data),
    surfaceRegulatory: surfaceRegulatoryRows(data),
    stewardNotes: stewardNoteRows(data),
  };
  const allRecords = Object.values(rows).flat();
  const readOnlyOfficialRecords = [...rows.results, ...rows.stewardNotes];
  const mock = data.mode === 'mock' || data.raceOffice.mock || data.equineIntelligence.mock || data.stewardCenter.mock || data.surfaceIntelligence.mock;

  return (
    <section aria-label="Canonical Data Explorer workspace" data-route-scope="api-hub" data-readonly-official-records="true">
      <h2>Canonical Data Explorer</h2>
      <RecordSourceLabel mock={mock} label="Canonical Data Explorer" />
      <MockDataBanner active={mock} source="Canonical racing data mock/live adapter boundary" />
      <p>API Hub read model for canonical racing data: race cards, races, entries, results, horse identities, person identities, workouts, past performance, and surface/regulatory records.</p>
      <p role="alert">Official race results and steward notes are read-only, immutable display records in this frontend. No edit, submit, approve, finalize, or mutation control is rendered for them.</p>
      <MetricStrip items={[
        { label: 'Canonical records', value: String(allRecords.length), detail: `${data.raceOffice.cards.length} race cards; ${data.raceOffice.cards.flatMap((card) => card.entries).length} entries` },
        { label: 'Provider refs', value: String(allRecords.reduce((sum, row) => sum + row.providerRefs.length, 0)), detail: 'Race Office, Equine, Stewarding, Surface, Compliance, and TUS references' },
        { label: 'Read-only official', value: String(readOnlyOfficialRecords.length), detail: 'Official results and steward notes expose no mutation controls' },
        { label: 'Training prohibited', value: String(allRecords.filter((row) => row.restrictions.training === 'prohibited').length), detail: 'Steward, identity-sensitive, and veterinary-care records' },
        { label: 'Artifact IDs', value: String(new Set(allRecords.map((row) => row.artifactRegistryId)).size), detail: 'Deterministic registry IDs for API Hub lineage' },
      ]} />

      <section aria-label="API Hub governance cards">
        <WorkspacePanel title="Provider References" eyebrow="API Hub">
          <p>Every row displays providerRefs from source DTOs and normalized fields from the canonical read model.</p>
          <p>TUS coverage: assets {data.tusStandardization.assets.length}; twins {data.tusStandardization.twins.length}; audit events {data.tusStandardization.coverage.auditEvents}.</p>
        </WorkspacePanel>
        <WorkspacePanel title="License Display Restrictions" eyebrow="Governance">
          <StatusCard title="Public" status="restricted by row" detail="Public display is shown only for program facts; official results can remain embargoed until publication." />
          <StatusCard title="Training" status="prohibited for sensitive rows" detail="Steward notes, veterinary-adjacent records, and identity-sensitive records are excluded from training." tone="critical" />
        </WorkspacePanel>
      </section>

      <section aria-label="Canonical race cards">
        <h3>Race Cards</h3>
        <CanonicalRecordTable label="Canonical race cards table" rows={rows.raceCards} />
      </section>
      <section aria-label="Canonical races">
        <h3>Races</h3>
        <CanonicalRecordTable label="Canonical races table" rows={rows.races} />
      </section>
      <section aria-label="Canonical entries">
        <h3>Entries</h3>
        <CanonicalRecordTable label="Canonical entries table" rows={rows.entries} />
      </section>
      <section aria-label="Official race results read-only" data-readonly="true" data-mutation-allowed="false">
        <h3>Official Race Results</h3>
        <p>Read-only safety boundary: result records are rendered from Race Office and Stewarding lineage only; this section has no form, button, or local state mutation path.</p>
        <CanonicalRecordTable label="Official race results read-only table" rows={rows.results} />
      </section>
      <section aria-label="Canonical horse identities">
        <h3>Horse Identities</h3>
        <CanonicalRecordTable label="Canonical horse identities table" rows={rows.horses} />
      </section>
      <section aria-label="Canonical person identities">
        <h3>Person Identities</h3>
        <CanonicalRecordTable label="Canonical person identities table" rows={rows.people} />
      </section>
      <section aria-label="Canonical workouts and past performance">
        <h3>Workouts and Past Performance</h3>
        <CanonicalRecordTable label="Canonical workouts table" rows={rows.workouts} emptyMessage="No workout records seeded." />
        <CanonicalRecordTable label="Canonical past performance table" rows={rows.pastPerformance} emptyMessage="No past-performance records seeded." />
      </section>
      <section aria-label="Surface and regulatory records">
        <h3>Surface and Regulatory Records</h3>
        <CanonicalRecordTable label="Surface and regulatory records table" rows={rows.surfaceRegulatory} />
      </section>
      <section aria-label="Steward notes read-only" data-readonly="true" data-mutation-allowed="false">
        <h3>Steward Notes</h3>
        <p>Read-only safety boundary: steward notes, evidence summaries, and AI-generated review aids are visible for lineage and appeal context only. They cannot issue rulings or modify official results.</p>
        <CanonicalRecordTable label="Steward notes read-only table" rows={rows.stewardNotes} />
      </section>
    </section>
  );
}
