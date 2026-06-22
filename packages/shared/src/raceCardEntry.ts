import type { DataEntryEntityKind } from './dataEntryFramework.js';
import type {
  RaceCardClassificationDto,
  RaceCardConditionsDto,
  RaceCardEntryDto,
  RaceCardLifecycleStatus,
  RaceCardPurseDto,
} from './raceCardManagement.js';
import { raceCardLifecycleTransitions } from './raceCardManagement.js';

export const raceCardEntrySchemaVersion = 'trackmind.race-card-entry.v1' as const;

export type RaceCardWorkflowStep =
  | 'create'
  | 'conditions'
  | 'classification'
  | 'purse'
  | 'entries'
  | 'assignments'
  | 'publication';

export interface RaceCardWorkflowStepDefinition {
  step: RaceCardWorkflowStep;
  label: string;
  shortLabel: string;
  description: string;
  entityKind?: DataEntryEntityKind;
}

export const raceCardWorkflowSteps: readonly RaceCardWorkflowStepDefinition[] = [
  { step: 'create', label: 'Create race', shortLabel: 'Race', description: 'Race number, post time, and initial card shell.', entityKind: 'race-card' },
  { step: 'conditions', label: 'Race conditions', shortLabel: 'Conditions', description: 'Surface, distance, eligibility, and medication rules.', entityKind: 'race-card-conditions' },
  { step: 'classification', label: 'Classification', shortLabel: 'Class', description: 'Class level, stakes grade, and restrictions.', entityKind: 'race-card-classification' },
  { step: 'purse', label: 'Purse data', shortLabel: 'Purse', description: 'Base purse and payout structure.', entityKind: 'race-card-purse' },
  { step: 'entries', label: 'Horse entries', shortLabel: 'Entries', description: 'Add horses with trainer and owner linkage.', entityKind: 'race-card-entry' },
  { step: 'assignments', label: 'Jockey & post positions', shortLabel: 'Draw', description: 'Assign jockeys, trainers, and post positions.', entityKind: 'jockey-assignment' },
  { step: 'publication', label: 'Status & publication', shortLabel: 'Publish', description: 'Submit for review, approve, and publish.', entityKind: 'race-card-lifecycle' },
];

export type RaceCardLifecycleTone = 'draft' | 'review' | 'approved' | 'published' | 'completed' | 'archived';

export const raceCardLifecycleMeta: Record<RaceCardLifecycleStatus, { label: string; tone: RaceCardLifecycleTone; description: string }> = {
  draft: { label: 'Draft', tone: 'draft', description: 'Editable — not yet submitted for review.' },
  review: { label: 'In review', tone: 'review', description: 'Submitted to stewards — limited edits.' },
  approved: { label: 'Approved', tone: 'approved', description: 'Steward approved — ready for publication.' },
  published: { label: 'Published', tone: 'published', description: 'Published to condition book — read-only.' },
  completed: { label: 'Completed', tone: 'completed', description: 'Race declared official.' },
  archived: { label: 'Archived', tone: 'archived', description: 'Retained for audit only.' },
};

export function canEditRaceCard(lifecycleStatus: RaceCardLifecycleStatus): boolean {
  return !['published', 'completed', 'archived'].includes(lifecycleStatus);
}

export function getAllowedLifecycleTransitions(from: RaceCardLifecycleStatus): RaceCardLifecycleStatus[] {
  return raceCardLifecycleTransitions
    .filter((transition) => transition.from === from)
    .map((transition) => transition.to);
}

export interface RaceCardValidationIssue {
  code: string;
  message: string;
  field?: string;
  entryId?: string;
}

export interface RaceCardCombinationInput {
  conditions: Pick<RaceCardConditionsDto, 'surface' | 'distanceFurlongs'>;
  classification: Pick<RaceCardClassificationDto, 'stakesGrade' | 'classLevel' | 'claimingPrice'>;
  purse: Pick<RaceCardPurseDto, 'basePurse'>;
}

export function validateRaceCardCombination(input: RaceCardCombinationInput): RaceCardValidationIssue[] {
  const issues: RaceCardValidationIssue[] = [];
  if (input.conditions.distanceFurlongs <= 0) {
    issues.push({ code: 'invalid-distance', message: 'Distance must be greater than zero.', field: 'distanceFurlongs' });
  }
  if (input.purse.basePurse < 0) {
    issues.push({ code: 'invalid-purse', message: 'Base purse cannot be negative.', field: 'basePurse' });
  }
  if (input.classification.stakesGrade === 'claiming' && !(input.classification.claimingPrice != null && input.classification.claimingPrice > 0)) {
    issues.push({ code: 'claiming-price-required', message: 'Claiming races require a claiming price.', field: 'claimingPrice' });
  }
  if (input.classification.stakesGrade === 'maiden' && input.classification.classLevel.toLowerCase().includes('open')) {
    issues.push({ code: 'maiden-open-conflict', message: 'Maiden classification should not use Open class level.', field: 'classLevel' });
  }
  return issues;
}

export function validateRaceCardEntryConflicts(entries: readonly Pick<RaceCardEntryDto, 'id' | 'horseId' | 'jockeyId' | 'postPosition' | 'scratched'>[]): RaceCardValidationIssue[] {
  const issues: RaceCardValidationIssue[] = [];
  const active = entries.filter((entry) => !entry.scratched);

  const horseIds = new Map<string, string>();
  for (const entry of active) {
    if (horseIds.has(entry.horseId)) {
      issues.push({
        code: 'duplicate-horse',
        message: `Horse ${entry.horseId} appears on multiple active entries.`,
        field: 'horseId',
        entryId: entry.id,
      });
    } else {
      horseIds.set(entry.horseId, entry.id);
    }
  }

  const jockeyIds = new Map<string, string>();
  for (const entry of active) {
    if (!entry.jockeyId) continue;
    if (jockeyIds.has(entry.jockeyId)) {
      issues.push({
        code: 'duplicate-jockey',
        message: `Jockey ${entry.jockeyId} is assigned to multiple active entries.`,
        field: 'jockeyId',
        entryId: entry.id,
      });
    } else {
      jockeyIds.set(entry.jockeyId, entry.id);
    }
  }

  const postPositions = new Map<number, string>();
  for (const entry of active) {
    if (entry.postPosition == null) continue;
    if (postPositions.has(entry.postPosition)) {
      issues.push({
        code: 'duplicate-post-position',
        message: `Post position ${entry.postPosition} is assigned to multiple entries.`,
        field: 'postPosition',
        entryId: entry.id,
      });
    } else {
      postPositions.set(entry.postPosition, entry.id);
    }
  }

  return issues;
}

export function validateRaceCardReadyForReview(input: {
  conditions: RaceCardCombinationInput['conditions'];
  classification: RaceCardCombinationInput['classification'];
  purse: RaceCardCombinationInput['purse'];
  entries: readonly Pick<RaceCardEntryDto, 'id' | 'horseId' | 'jockeyId' | 'postPosition' | 'scratched' | 'trainerId'>[];
}): RaceCardValidationIssue[] {
  const issues = [
    ...validateRaceCardCombination(input),
    ...validateRaceCardEntryConflicts(input.entries),
  ];
  if (input.entries.filter((entry) => !entry.scratched).length < 2) {
    issues.push({ code: 'insufficient-entries', message: 'At least two active entries are required before review.' });
  }
  for (const entry of input.entries.filter((e) => !e.scratched)) {
    if (!entry.trainerId) {
      issues.push({ code: 'missing-trainer', message: `Entry ${entry.id} is missing a trainer.`, entryId: entry.id, field: 'trainerId' });
    }
  }
  return issues;
}

export function workflowStepIndex(step: RaceCardWorkflowStep): number {
  return raceCardWorkflowSteps.findIndex((definition) => definition.step === step);
}

export function getRaceCardWorkflowStep(step: RaceCardWorkflowStep): RaceCardWorkflowStepDefinition {
  const definition = raceCardWorkflowSteps.find((item) => item.step === step);
  if (!definition) throw new Error(`Unknown race card workflow step ${step}`);
  return definition;
}
