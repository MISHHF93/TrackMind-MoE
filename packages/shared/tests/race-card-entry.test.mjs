import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canEditRaceCard,
  getAllowedLifecycleTransitions,
  raceCardWorkflowSteps,
  validateRaceCardCombination,
  validateRaceCardEntryConflicts,
} from '../dist/raceCardEntry.js';

test('race card workflow covers full entry lifecycle', () => {
  const steps = raceCardWorkflowSteps.map((step) => step.step);
  assert.ok(steps.includes('create'));
  assert.ok(steps.includes('conditions'));
  assert.ok(steps.includes('purse'));
  assert.ok(steps.includes('entries'));
  assert.ok(steps.includes('assignments'));
  assert.ok(steps.includes('publication'));
});

test('validateRaceCardCombination rejects invalid claiming setup', () => {
  const issues = validateRaceCardCombination({
    conditions: { surface: 'dirt', distanceFurlongs: 6 },
    classification: { classLevel: 'Claiming', stakesGrade: 'claiming', claimingPrice: 0 },
    purse: { basePurse: 10000 },
  });
  assert.ok(issues.some((issue) => issue.code === 'claiming-price-required'));
});

test('validateRaceCardEntryConflicts detects duplicate horse and jockey', () => {
  const issues = validateRaceCardEntryConflicts([
    { id: 'e1', horseId: 'horse-1', jockeyId: 'jockey-1', postPosition: 1, scratched: false },
    { id: 'e2', horseId: 'horse-1', jockeyId: 'jockey-1', postPosition: 2, scratched: false },
  ]);
  assert.ok(issues.some((issue) => issue.code === 'duplicate-horse'));
  assert.ok(issues.some((issue) => issue.code === 'duplicate-jockey'));
});

test('lifecycle transitions and editability', () => {
  assert.equal(canEditRaceCard('draft'), true);
  assert.equal(canEditRaceCard('published'), false);
  assert.ok(getAllowedLifecycleTransitions('draft').includes('review'));
});
