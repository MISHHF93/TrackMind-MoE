import test from 'node:test';
import assert from 'node:assert/strict';
import {
  racingOperatingDomains,
  technologyArtifactDimensions,
  racingOperatingCapabilities,
  racingExpansionSequence,
  buildRacingOperatingModel,
  validateRacingOperatingModel,
} from '../dist/index.js';

test('racing operating model defines all lifecycle domains', () => {
  assert.equal(racingOperatingDomains.length, 18);
  assert.equal(racingOperatingCapabilities.length, 18);
});

test('every capability binds all eleven Racing OS convergence dimensions', () => {
  assert.equal(technologyArtifactDimensions.length, 11);
  for (const cap of racingOperatingCapabilities) {
    assert.equal(cap.artifacts.length, technologyArtifactDimensions.length, cap.id);
    for (const dim of technologyArtifactDimensions) {
      assert.ok(cap.artifacts.some((a) => a.dimension === dim), `${cap.id} missing ${dim}`);
    }
  }
});

test('validateRacingOperatingModel passes', () => {
  const result = validateRacingOperatingModel();
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('expansion sequence has thirteen waves in dependency order', () => {
  assert.equal(racingExpansionSequence.length, 13);
  assert.equal(racingExpansionSequence[0].domains[0], 'racetrack');
  assert.equal(racingExpansionSequence.at(-1).domains[0], 'federation-participant');
});

test('buildRacingOperatingModel returns contract-shaped DTO', () => {
  const model = buildRacingOperatingModel('2026-06-17T00:00:00.000Z');
  assert.equal(model.schemaVersion, 'trackmind.racing-operating-model.v1');
  assert.equal(model.mock, false);
  assert.equal(model.capabilities.length, 18);
  assert.ok(model.coverageSummary.coveragePct >= 0);
});
