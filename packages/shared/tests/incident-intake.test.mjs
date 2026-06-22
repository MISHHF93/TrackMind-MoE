import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildIncidentTitle,
  buildPlatformIncidentFromIntake,
  mapIncidentTypeToCategory,
  unifiedIncidentTypes,
  validateIncidentIntake,
} from '../dist/incidentIntake.js';

test('unified incident types cover required domains', () => {
  const types = unifiedIncidentTypes.map((definition) => definition.type);
  for (const required of ['safety', 'steward', 'equine-welfare', 'facilities', 'security', 'operational-disruption']) {
    assert.ok(types.includes(required), `missing ${required}`);
  }
});

test('validateIncidentIntake enforces triage vs full requirements', () => {
  const triageInvalid = validateIncidentIntake({ incidentType: 'safety', severity: 'high' }, 'triage');
  assert.equal(triageInvalid.valid, false);

  const triageValid = validateIncidentIntake({
    incidentType: 'safety',
    severity: 'high',
    location: 'Paddock B',
    summary: 'Loose horse near gate',
    reason: 'Reported from paddock judge radio.',
  }, 'triage');
  assert.equal(triageValid.valid, true);

  const fullInvalid = validateIncidentIntake({
    incidentType: 'security',
    severity: 'critical',
    location: 'Zone 4',
    summary: 'Credential exception',
    reason: 'Security desk intake.',
  }, 'full');
  assert.equal(fullInvalid.valid, false);

  const fullValid = validateIncidentIntake({
    incidentType: 'security',
    severity: 'critical',
    location: 'Zone 4',
    summary: 'Credential exception at backstretch gate',
    detailedNotes: 'Unauthorized badge presented at reader 4; subject detained pending ID verification.',
    reason: 'Security desk full intake with evidence references.',
  }, 'full');
  assert.equal(fullValid.valid, true);
});

test('buildPlatformIncidentFromIntake maps category and metadata', () => {
  const incident = buildPlatformIncidentFromIntake(
    { tenantId: 'trackmind', racetrackId: 'main-track', actorId: 'steward-1' },
    {
      incidentType: 'equine-welfare',
      severity: 'high',
      location: 'Barn 3',
      summary: 'Horse showing acute distress',
      reason: 'Welfare officer observation.',
    },
    'triage',
  );
  assert.equal(mapIncidentTypeToCategory('equine-welfare'), 'equine');
  assert.equal(incident.category, 'equine');
  assert.equal(incident.reportedBy, 'steward-1');
  assert.ok(buildIncidentTitle('equine-welfare', 'Horse showing acute distress').includes('Welfare'));
});
