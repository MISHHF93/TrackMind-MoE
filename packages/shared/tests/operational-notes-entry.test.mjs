import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperationalNoteIntakePayload,
  defaultOperationalNoteSeed,
  operationalNoteSubjects,
  parseOperationalNoteTags,
  validateOperationalNoteEntry,
} from '../dist/operationalNotesEntry.js';

test('operational note subjects cover journal entry domains', () => {
  const kinds = operationalNoteSubjects.map((subject) => subject.kind);
  assert.deepEqual(kinds, [
    'horse',
    'race',
    'incident',
    'approval',
    'facilities',
    'security-event',
    'compliance',
    'meeting',
    'race-day-log',
  ]);
});

test('validateOperationalNoteEntry supports flash capture with short body', () => {
  const valid = validateOperationalNoteEntry({
    subjectKind: 'race-day-log',
    entityId: 'race-day-log-today',
    body: 'Gate check complete.',
    reason: 'Race-day log',
  }, 'create', 'flash');
  assert.equal(valid.valid, true);
});

test('validateOperationalNoteEntry edit mode requires noteId and body only', () => {
  const invalid = validateOperationalNoteEntry({ body: 'Updated note text.' }, 'edit', 'flash');
  assert.equal(invalid.valid, false);
  const valid = validateOperationalNoteEntry({
    noteId: 'note-1',
    body: 'Updated note text with more detail.',
  }, 'edit', 'flash');
  assert.equal(valid.valid, true);
});

test('parseOperationalNoteTags splits comma and newline tags', () => {
  assert.deepEqual(parseOperationalNoteTags('gate, surface\nfollow-up'), ['gate', 'surface', 'follow-up']);
});

test('buildOperationalNoteIntakePayload maps visibility and audit flags', () => {
  const payload = buildOperationalNoteIntakePayload(
    { actorId: 'steward-operator' },
    {
      subjectKind: 'incident',
      entityId: 'inc-1',
      body: 'Steward follow-up: witness statements collected.',
      tags: 'steward, follow-up',
      visibilityScope: 'internal',
      followUpRequired: true,
      auditAware: true,
      reason: 'Incident journal update',
    },
    'full',
  );
  assert.equal(payload.subjectKind, 'incident');
  assert.equal(payload.followUpRequired, true);
  assert.equal(payload.auditAware, true);
  assert.deepEqual(payload.tags, ['steward', 'follow-up']);
});

test('defaultOperationalNoteSeed includes author and subject defaults', () => {
  const seed = defaultOperationalNoteSeed('horse', 'trainer-operator', 'horse-1');
  assert.equal(seed.subjectKind, 'horse');
  assert.equal(seed.author, 'trainer-operator');
});
