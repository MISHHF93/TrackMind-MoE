import test from 'node:test';
import assert from 'node:assert/strict';
import {
  racingOperatingCapabilities,
  racingOperatingConvergenceInconsistencies,
  racingOsConvergenceDimensions,
  buildRacingOperatingConvergenceReport,
  validateRacingOsConvergence,
  convergenceDimensionLabels,
} from '../dist/index.js';

test('Racing OS convergence defines eleven dimensions with human labels', () => {
  assert.equal(racingOsConvergenceDimensions.length, 11);
  for (const dimension of racingOsConvergenceDimensions) {
    assert.ok(convergenceDimensionLabels[dimension], dimension);
  }
});

test('normalizeRacingOperatingCapabilities fills every domain to eleven dimensions', () => {
  const result = validateRacingOsConvergence(racingOperatingCapabilities);
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('buildRacingOperatingConvergenceReport summarizes all domains', () => {
  const report = buildRacingOperatingConvergenceReport('2026-06-17T00:00:00.000Z');
  assert.equal(report.schemaVersion, 'trackmind.racing-os-convergence.v1');
  assert.equal(report.mock, false);
  assert.equal(report.domainProfiles.length, 18);
  assert.equal(report.dimensions.length, 11);
  assert.equal(report.summary.totalDomains, 18);
  assert.ok(report.summary.averageConvergencePct >= 0);
  assert.equal(report.guardrails.singleCoherentOperatingSystem, true);
  assert.equal(report.guardrails.rawCrossTrackRecordSharing, false);
  assert.ok(racingOperatingConvergenceInconsistencies.length > 0);
  assert.ok(report.summary.inconsistenciesResolved > 0);
});

test('every domain profile exposes converged dimension entries', () => {
  const report = buildRacingOperatingConvergenceReport();
  for (const profile of report.domainProfiles) {
    assert.equal(profile.totalDimensions, 11);
    assert.equal(profile.dimensions.length, 11);
    assert.ok(profile.convergencePct >= 0 && profile.convergencePct <= 100);
  }
});
