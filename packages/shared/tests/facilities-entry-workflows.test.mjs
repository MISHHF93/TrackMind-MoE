import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFacilitiesInspectionPayload,
  buildFacilitiesMaintenancePayload,
  conditionRatingToScore,
  facilityAssetPresets,
  validateFacilitiesInspectionEntry,
  validateFacilitiesMaintenanceEntry,
} from '../dist/facilitiesEntryWorkflows.js';

test('facility asset presets cover operational areas', () => {
  const categories = facilityAssetPresets.map((preset) => preset.category);
  assert.deepEqual(categories, ['barn', 'paddock', 'track-surface', 'gate', 'utilities', 'venue-infrastructure']);
});

test('validateFacilitiesInspectionEntry rejects edit mode', () => {
  const result = validateFacilitiesInspectionEntry({
    assetId: 'GRANDSTAND_HVAC_01',
    inspectionType: 'routine',
    conditionRating: 80,
    notes: 'Filters checked — pressure nominal.',
    reason: 'Weekly walkthrough',
  }, 'edit', 'quick');
  assert.equal(result.valid, false);
});

test('buildFacilitiesInspectionPayload maps condition rating and work-order trigger', () => {
  const payload = buildFacilitiesInspectionPayload(
    { actorId: 'facilities-supervisor' },
    {
      assetId: 'START_GATE_01',
      facilityCategory: 'gate',
      inspectionType: 'pre-race',
      conditionRating: 72,
      notes: 'Gate lock telemetry nominal; approach surface firm.',
      issuesFound: 'Minor debris near rail',
      urgency: 'normal',
      triggerWorkOrder: true,
      attachmentRefs: 'photo:gate-approach-1',
      nextInspectionAt: '2026-07-01T08:00',
      maintenanceOwner: 'facilities-supervisor',
      reason: 'Pre-race gate inspection',
    },
    'full',
  );
  assert.equal(payload.score, 72);
  assert.equal(payload.triggerWorkOrder, true);
  assert.ok(Array.isArray(payload.issuesFound) && payload.issuesFound.length === 1);
  assert.ok(Array.isArray(payload.attachmentRefs));
});

test('buildFacilitiesMaintenancePayload maps urgency to priority', () => {
  const payload = buildFacilitiesMaintenancePayload(
    { actorId: 'facilities-supervisor' },
    {
      assetId: 'GRANDSTAND_HVAC_01',
      title: 'Replace HVAC filters',
      urgency: 'high',
      notes: 'Filter delta pressure elevated after inspection.',
      issuesFound: 'Elevated filter pressure',
      maintenanceOwner: 'facilities-supervisor',
      reason: 'Follow-up from inspection',
    },
    'quick',
  );
  assert.equal(payload.priority, 'high');
  assert.ok(Array.isArray(payload.tasks) && payload.tasks.length > 0);
});

test('conditionRatingToScore clamps values', () => {
  assert.equal(conditionRatingToScore(150), 100);
  assert.equal(conditionRatingToScore(-5), 0);
  assert.equal(conditionRatingToScore(84), 84);
});

test('validateFacilitiesMaintenanceEntry requires title in quick mode', () => {
  const invalid = validateFacilitiesMaintenanceEntry({}, 'quick');
  assert.equal(invalid.valid, false);
  const valid = validateFacilitiesMaintenanceEntry({
    assetId: 'GRANDSTAND_HVAC_01',
    title: 'Filter replacement',
    urgency: 'normal',
    notes: 'Scheduled filter swap after inspection.',
    reason: 'Preventive maintenance',
  }, 'quick');
  assert.equal(valid.valid, true);
});
