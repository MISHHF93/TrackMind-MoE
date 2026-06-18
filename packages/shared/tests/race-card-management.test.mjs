import test from 'node:test';
import assert from 'node:assert/strict';
import { raceCardLifecycleTransitions, raceCardLifecycleStatuses } from '../dist/index.js';

test('race card lifecycle transitions cover draft through archived', () => {
  assert.deepEqual([...raceCardLifecycleStatuses], ['draft', 'review', 'approved', 'published', 'completed', 'archived']);
  assert.ok(raceCardLifecycleTransitions.some((transition) => transition.from === 'draft' && transition.to === 'review'));
  assert.ok(raceCardLifecycleTransitions.some((transition) => transition.from === 'review' && transition.to === 'approved' && transition.approvalRequired));
  assert.ok(raceCardLifecycleTransitions.some((transition) => transition.from === 'approved' && transition.to === 'published' && transition.approvalRequired));
  assert.ok(raceCardLifecycleTransitions.some((transition) => transition.from === 'published' && transition.to === 'completed'));
  assert.ok(raceCardLifecycleTransitions.some((transition) => transition.from === 'completed' && transition.to === 'archived'));
});
