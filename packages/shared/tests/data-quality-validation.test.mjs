import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildReferenceCatalogFromWorkspace,
  validateAssignmentConflicts,
  validateDataEntryWithQuality,
  validateDateTimeSanity,
  validateDuplicateDetection,
  validateScopeAndTenant,
  validateStatusTransitions,
} from '../dist/dataQualityValidation.js';

const scope = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  actorId: 'admin-operator',
  role: 'platform-super-admin',
  requestId: 'req-dq-1',
};

const references = buildReferenceCatalogFromWorkspace({
  horses: [{ horseId: 'horse-1', lifecycleStatus: 'active', updatedAt: new Date().toISOString() }],
  trainers: [{ trainerId: 'trainer-1', licenseStatus: 'active', updatedAt: new Date().toISOString() }],
  jockeys: [{ jockeyId: 'jockey-1', eligibilityStatus: 'active', updatedAt: new Date().toISOString() }],
  raceCards: [{ raceCardId: 'rc-race-7', lifecycleStatus: 'draft', updatedAt: new Date().toISOString() }],
  entries: [{ entryId: 'entry-1', raceCardId: 'rc-race-7', horseId: 'horse-1', jockeyId: 'jockey-2' }],
  trainerAssignments: [{ horseId: 'horse-1', trainerId: 'trainer-2', effectiveFrom: '2026-06-22' }],
});

test('scope and tenant validation rejects mismatched payload scope', () => {
  const issues = validateScopeAndTenant(scope, {
    tenantId: 'other-tenant',
    racetrackId: 'main-track',
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].category, 'scope-tenant');
});

test('date time sanity rejects future foaling dates', () => {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
  const issues = validateDateTimeSanity('horse', { foaled: future });
  assert.ok(issues.some((issue) => issue.code === 'datetime-future'));
});

test('status transition validation blocks invalid race card lifecycle moves', () => {
  const issues = validateStatusTransitions('race-card-lifecycle', { toStatus: 'published' }, { lifecycleStatus: 'draft' });
  assert.ok(issues.some((issue) => issue.category === 'status-transition'));
});

test('duplicate detection rejects repeated horse on race card', () => {
  const issues = validateDuplicateDetection(
    'race-card-entry',
    { raceCardId: 'rc-race-7', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1', reason: 'Bulk race entry import batch' },
    references,
  );
  assert.ok(issues.some((issue) => issue.code === 'duplicate-race-entry'));
});

test('assignment conflict detection rejects jockey already assigned on card', () => {
  const issues = validateAssignmentConflicts(
    'jockey-assignment',
    { raceCardId: 'rc-race-7', entryId: 'entry-2', jockeyId: 'jockey-2', reason: 'Bulk jockey assignment for race 7' },
    references,
  );
  assert.ok(issues.some((issue) => issue.code === 'assignment-jockey-conflict'));
});

test('validateDataEntryWithQuality merges form and quality checks', () => {
  const result = validateDataEntryWithQuality('race-card-entry', {
    raceCardId: 'rc-race-7',
    horseId: 'horse-1',
    trainerId: 'trainer-1',
    ownerId: 'owner-1',
    reason: 'Bulk race entry import batch',
  }, {
    scope,
    mode: 'create',
    role: 'platform-super-admin',
    references,
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === 'duplicate-race-entry'));
  assert.ok(result.errors.length > 0);
});

test('stale reference detection flags missing horse catalog entry', () => {
  const result = validateDataEntryWithQuality('trainer-assignment', {
    horseId: 'horse-missing',
    trainerId: 'trainer-1',
    trainerName: 'Jane Smith',
    effectiveFrom: '2026-06-22',
    licenseStatus: 'active',
    dataSource: 'registry-import',
    reason: 'Bulk trainer assignment for import batch',
  }, {
    scope,
    mode: 'create',
    role: 'platform-super-admin',
    references,
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === 'stale-reference-missing'));
});
