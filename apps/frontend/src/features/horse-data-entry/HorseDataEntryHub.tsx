import type { DataEntryEntityKind } from '@trackmind/shared';
import {
  buildHorseTimelineEntries,
  extractHorseContextFromProfile,
  horseWorkflowsForSection,
  type HorseDataEntrySection,
} from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { SectionPanel } from '@/design/components/section-panel';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { cn } from '@/lib/utils';
import { extractArray } from '@/hooks/useWorkspaceData';
import { isRecord } from '@/lib/utils';
import { HorseFormAction } from './HorseFormAction';
import { HorseHistoryTimeline } from './HorseHistoryTimeline';

const sectionMeta: Record<HorseDataEntrySection, { title: string; description: string }> = {
  identity: {
    title: 'Identity records',
    description: 'Registered name, ownership, and lifecycle — separate from day-to-day operations.',
  },
  operational: {
    title: 'Operational records',
    description: 'Trainer, stable, eligibility, transport, and workouts tied to racetrack activity.',
  },
  'welfare-restricted': {
    title: 'Welfare & veterinary',
    description: 'Welfare observations for field staff; clinical vet records enforce privacy boundaries.',
  },
};

function registryHorse(
  registry: Record<string, unknown> | undefined,
  horseId: string,
): Record<string, unknown> | undefined {
  const horses = extractArray<Record<string, unknown>>(registry, 'horses');
  return horses.find((horse) => {
    const identity = isRecord(horse.identity) ? horse.identity : horse;
    return String(identity.horseId ?? horse.horseId) === horseId;
  });
}

export function HorseDataEntryHub({
  profile,
  registry,
  eligibilityFeed,
  auditFeed,
  welfareFeed,
  equineIntelligence,
  className,
}: {
  profile?: Record<string, unknown>;
  registry?: Record<string, unknown>;
  eligibilityFeed?: Record<string, unknown>;
  auditFeed?: Record<string, unknown>;
  welfareFeed?: Record<string, unknown>;
  equineIntelligence?: Record<string, unknown>;
  className?: string;
}): ReactElement {
  const { session } = useTenantSession();
  const context = extractHorseContextFromProfile(profile);
  const horseRecord = useMemo(
    () => registryHorse(registry, context.horseId),
    [registry, context.horseId],
  );

  const seed = useMemo(() => ({
    horseId: context.horseId,
    trackId: context.racetrackId ?? 'main-track',
    assignedAt: new Date().toISOString().slice(0, 16),
    retiredAt: new Date().toISOString().slice(0, 16),
    effectiveFrom: new Date().toISOString().slice(0, 10),
    date: new Date().toISOString().slice(0, 10),
  }), [context.horseId, context.racetrackId, profile]);

  const identityValues = isRecord(horseRecord?.identity)
    ? horseRecord.identity as Record<string, unknown>
    : isRecord(profile?.identity)
      ? profile.identity as Record<string, unknown>
      : undefined;

  const editSeed = useMemo(() => ({
    ...seed,
    ...(identityValues ? {
      name: identityValues.name,
      microchipId: identityValues.microchipId,
      foaled: identityValues.foaled,
      sex: identityValues.sex,
      breed: identityValues.breed,
      color: identityValues.color,
    } : {}),
  }), [seed, identityValues]);

  const timeline = useMemo(() => buildHorseTimelineEntries({
    lifecycleHistory: extractArray(horseRecord, 'lifecycleHistory'),
    ownershipHistory: extractArray(horseRecord, 'ownershipHistory'),
    trainerHistory: extractArray(horseRecord, 'trainerHistory'),
    stableHistory: extractArray(horseRecord, 'stableHistory'),
    auditEvents: extractArray(auditFeed, 'events'),
    workouts: extractArray(equineIntelligence, 'workoutHistory'),
    transportRecords: extractArray(equineIntelligence, 'transportationRecords'),
    welfareObservations: extractArray(welfareFeed, 'observations'),
    retirementRecord: isRecord(horseRecord?.retirementRecord) ? horseRecord.retirementRecord : undefined,
    eligibilityUpdatedAt: isRecord(eligibilityFeed?.status)
      ? String((eligibilityFeed.status as Record<string, unknown>).updatedAt ?? '')
      : undefined,
  }), [horseRecord, auditFeed, equineIntelligence, welfareFeed, eligibilityFeed]);

  return (
    <div className={cn('space-y-4', className)}>
      <SectionPanel
        title="Horse data entry"
        description={`Governed workflows for ${context.horseName} (${context.horseId}). Actor: ${session.role}. Racetrack context captured on save.`}
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {(['identity', 'operational', 'welfare-restricted'] as HorseDataEntrySection[]).map((section) => {
            const meta = sectionMeta[section];
            const workflows = horseWorkflowsForSection(section);
            return (
              <div key={section} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">{meta.title}</h3>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{meta.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {workflows.map((workflow) => (
                    <HorseFormAction
                      key={workflow.entityKind}
                      entityKind={workflow.entityKind as DataEntryEntityKind}
                      label={workflow.shortLabel}
                      seed={workflow.entityKind === 'horse' ? editSeed : seed}
                      recordId={workflow.entityKind === 'horse' ? context.horseId : undefined}
                      mode={workflow.entityKind === 'horse' && identityValues ? 'edit' : 'create'}
                      submitLabel={
                        workflow.entityKind === 'horse' && identityValues ? 'Update profile' : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
          <HorseFormAction entityKind="horse" label="Register new horse" seed={seed} submitLabel="Register" variant="outline" />
        </div>
      </SectionPanel>

      <SectionPanel title="Record timeline" description="Unified history — identity, operations, welfare, and audit events newest first.">
        <HorseHistoryTimeline entries={timeline.slice(0, 20)} />
      </SectionPanel>
    </div>
  );
}
