import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationalNotesService } from '../dist/operationalNotesService.js';

test('operational notes intake records audit-linked journal entries', () => {
  const service = createOperationalNotesService(() => '2026-06-22T10:00:00.000Z');
  const result = service.recordIntake({
    subjectKind: 'race',
    entityId: 'race-7',
    body: 'Post time holding — surface inspection complete.',
    author: 'operations-admin-operator',
    tags: ['post-time', 'surface'],
    visibilityScope: 'team',
    followUpRequired: true,
    auditAware: true,
    reason: 'Race-day coordination note',
    entryMode: 'flash',
  });
  assert.equal(result.accepted, true);
  assert.ok(result.auditId);
  const journal = service.queryJournal({ subjectKind: 'race' });
  assert.ok(journal.notes.some((note) => note.id === result.noteId));
});

test('editable notes retain revision history', () => {
  const service = createOperationalNotesService(() => '2026-06-22T10:00:00.000Z');
  const created = service.recordIntake({
    subjectKind: 'horse',
    entityId: 'horse-1',
    body: 'Initial handler observation.',
    author: 'trainer-operator',
    visibilityScope: 'internal',
    allowsEdit: true,
    reason: 'Horse note',
    entryMode: 'flash',
  });
  const revised = service.editNote(created.noteId, {
    body: 'Updated handler observation — appetite normal.',
    editedBy: 'trainer-operator',
    editReason: 'Added appetite detail',
  });
  assert.equal(revised.revisionCount, 1);
  const note = service.getNote(created.noteId);
  assert.equal(note.editHistory.length, 1);
  assert.equal(note.body, 'Updated handler observation — appetite normal.');
});

test('operational notes metadata patch updates tags with audit trail', () => {
  const service = createOperationalNotesService(() => '2026-06-22T10:00:00.000Z');
  const created = service.recordIntake({
    subjectKind: 'race-day-log',
    entityId: 'race-day-log-today',
    body: 'Gate check note.',
    author: 'operations-admin-operator',
    tags: ['gate'],
    visibilityScope: 'team',
    allowsEdit: true,
    reason: 'Gate note',
    entryMode: 'flash',
  });
  const patched = service.patchNoteMetadata(created.noteId, {
    tags: ['gate', 'surface'],
    followUpRequired: true,
    editedBy: 'operations-admin-operator',
    reason: 'Inline tag update',
  });
  assert.deepEqual(patched.patchedFields, ['tags', 'followUpRequired']);
  const note = service.getNote(created.noteId);
  assert.deepEqual(note.tags, ['gate', 'surface']);
  assert.equal(note.followUpRequired, true);
});

test('non-editable approval notes reject revisions', () => {
  const service = createOperationalNotesService(() => '2026-06-22T10:00:00.000Z');
  const created = service.recordIntake({
    subjectKind: 'approval',
    entityId: 'approval-race-start',
    body: 'Context for race start approval.',
    author: 'steward-operator',
    visibilityScope: 'internal',
    allowsEdit: false,
    reason: 'Approval context',
    entryMode: 'full',
  });
  assert.throws(
    () => service.editNote(created.noteId, { body: 'Changed', editedBy: 'steward-operator' }),
    /does not allow edits/,
  );
});
