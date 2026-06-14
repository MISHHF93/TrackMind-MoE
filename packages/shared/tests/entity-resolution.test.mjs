import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EntityResolutionEngine,
  entityResolutionSchemaVersion,
  resolveEntityIdentity,
  scoreHorseIdentityMatch,
} from '../dist/index.js';

const tenantId = 'tenant-east';
const racetrackId = 'track-001';
const now = '2026-06-14T22:30:00.000Z';

function horse(overrides = {}) {
  return {
    kind: 'horse',
    tenantId,
    racetrackId,
    sourceSystem: 'provider-feed',
    name: 'Northern Comet',
    country: 'USA',
    foalingDate: '2021-03-12',
    sireName: 'Starlight Ridge',
    damName: 'Comet Trail',
    trainerHistory: [{ id: 'trainer-1', name: 'Mia Rivera' }],
    ownerHistory: [{ id: 'owner-1', name: 'Blue Stable' }],
    raceHistory: [{ raceId: 'race-7', raceDate: '2026-06-13', racetrackId, raceNumber: 7 }],
    evidenceRefs: ['provider-row:horse'],
    lineage: ['feed:provider-horses:v1'],
    ...overrides,
  };
}

function person(overrides = {}) {
  return {
    kind: 'person',
    tenantId,
    racetrackId,
    sourceSystem: 'provider-people-feed',
    name: 'Mia Rivera',
    country: 'US',
    roles: ['trainer'],
    affiliations: [{ id: 'barn-7', name: 'Barn 7' }],
    raceHistory: [{ raceId: 'race-7', raceDate: '2026-06-13', racetrackId, raceNumber: 7 }],
    ...overrides,
  };
}

test('entity resolution auto-merges a high-confidence horse identity match', () => {
  const source = horse({ externalIds: { providerA: 'horse-new-1' } });
  const candidate = horse({
    canonicalId: 'canonical:tenant-east:track-001:horse:northern-comet',
    sourceSystem: 'trackmind-nexus',
    externalIds: { trackmind: 'horse-1' },
  });

  const score = scoreHorseIdentityMatch(source, candidate);
  assert.equal(score.matchConfidence, 1);
  assert.ok(score.evidence.some((item) => item.field === 'foalingDate' && item.matched));

  const decision = resolveEntityIdentity(source, [candidate], { now, correlationId: 'corr-high-confidence' });
  assert.equal(decision.schemaVersion, entityResolutionSchemaVersion);
  assert.equal(decision.decision, 'auto_merged');
  assert.equal(decision.reviewRequired, false);
  assert.equal(decision.canonicalId, candidate.canonicalId);
  assert.equal(decision.matchConfidence, 1);
  assert.deepEqual(decision.tenant, { tenantId, racetrackId });
  assert.ok(decision.candidateExternalIds.includes('trackmind:horse-1'));
  assert.equal(decision.lineage.scorerVersion, 'trackmind.entity-resolution.scorer.v1');
});

test('entity resolution requires review when horse candidates are ambiguous', () => {
  const source = horse({
    name: 'Sky Runner',
    foalingDate: '2020-04-01',
    sireName: undefined,
    damName: undefined,
    trainerHistory: [],
    ownerHistory: [],
    raceHistory: [],
  });
  const candidateA = horse({
    canonicalId: 'canonical:tenant-east:track-001:horse:sky-runner-a',
    name: 'Sky Runner',
    foalingDate: '2020-04-01',
    sireName: undefined,
    damName: undefined,
    trainerHistory: [],
    ownerHistory: [],
    raceHistory: [],
    externalIds: { trackmind: 'horse-a' },
  });
  const candidateB = horse({
    canonicalId: 'canonical:tenant-east:track-001:horse:sky-runner-b',
    name: 'Sky Runner',
    foalingDate: '2020-04-01',
    sireName: undefined,
    damName: undefined,
    trainerHistory: [],
    ownerHistory: [],
    raceHistory: [],
    externalIds: { trackmind: 'horse-b' },
  });

  const decision = new EntityResolutionEngine([candidateA, candidateB]).resolveHorse(source, undefined, { now, correlationId: 'corr-ambiguous' });
  assert.equal(decision.decision, 'review_required');
  assert.equal(decision.reviewRequired, true);
  assert.equal(decision.matchConfidence, 1);
  assert.deepEqual(decision.candidateCanonicalIds, [candidateA.canonicalId, candidateB.canonicalId]);
  assert.ok(decision.evidence.some((item) => item.field === 'candidateAmbiguity'));
});

test('entity resolution auto-merges an exact provider ID person match', () => {
  const source = person({
    name: 'M. Rivera',
    externalIds: { licensing: 'TR-777' },
    roles: ['trainer'],
  });
  const candidate = person({
    canonicalId: 'canonical:tenant-east:track-001:person:mia-rivera',
    name: 'Mia Rivera',
    externalIds: { licensing: 'TR-777' },
    roles: ['trainer', 'owner'],
  });

  const decision = resolveEntityIdentity(source, [candidate], { now, correlationId: 'corr-provider-id' });
  assert.equal(decision.entityKind, 'person');
  assert.equal(decision.decision, 'auto_merged');
  assert.equal(decision.reviewRequired, false);
  assert.equal(decision.matchConfidence, 1);
  assert.equal(decision.canonicalId, candidate.canonicalId);
  assert.ok(decision.evidence.some((item) => item.field === 'providerIds' && item.matched));
  assert.ok(decision.candidateExternalIds.includes('licensing:tr-777'));
});

test('entity resolution creates a new entity when no candidate matches', () => {
  const source = horse({
    name: 'Distant Thunder',
    externalIds: { providerA: 'horse-new-99' },
    foalingDate: '2022-02-02',
    sireName: 'Cloud Signal',
    damName: 'Summer Rain',
    trainerHistory: [{ id: 'trainer-99' }],
    ownerHistory: [{ id: 'owner-99' }],
    raceHistory: [{ raceId: 'race-99', racetrackId, raceDate: '2026-06-01', raceNumber: 2 }],
  });
  const candidate = horse({
    canonicalId: 'canonical:tenant-east:track-001:horse:northern-comet',
    externalIds: { trackmind: 'horse-1' },
  });

  const decision = resolveEntityIdentity(source, [candidate], { now, correlationId: 'corr-new-entity' });
  assert.equal(decision.decision, 'new_entity');
  assert.equal(decision.reviewRequired, false);
  assert.ok(decision.matchConfidence < 0.35);
  assert.equal(decision.canonicalId, 'canonical:tenant-east:track-001:horse:distant-thunder');
  assert.ok(decision.candidateExternalIds.includes('providera:horse-new-99'));
});
