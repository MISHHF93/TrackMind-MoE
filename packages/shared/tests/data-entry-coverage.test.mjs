import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDataEntryCoverageMatrix,
  coverageGaps,
  dataEntryCoverageMatrixSchemaVersion,
  platformArtifactBindings,
} from '@trackmind/shared';
import { dataEntryEntityForms } from '@trackmind/shared';

test('coverage matrix schema version is declared', () => {
  assert.equal(dataEntryCoverageMatrixSchemaVersion, 'trackmind.data-entry-coverage-matrix.v1');
});

test('all platform artifacts bind to registered entity kinds', () => {
  for (const binding of platformArtifactBindings) {
    assert.ok(dataEntryEntityForms[binding.primaryEntityKind], `${binding.domain} missing ${binding.primaryEntityKind}`);
    for (const related of binding.relatedEntityKinds ?? []) {
      assert.ok(dataEntryEntityForms[related], `${binding.domain} missing related kind ${related}`);
    }
  }
});

test('coverage matrix includes every platform artifact domain', () => {
  const matrix = buildDataEntryCoverageMatrix();
  assert.equal(matrix.length, platformArtifactBindings.length);
  const domains = new Set(matrix.map((row) => row.domain));
  for (const binding of platformArtifactBindings) {
    assert.ok(domains.has(binding.domain), `missing row for ${binding.domain}`);
  }
});

test('coverage matrix has no blocking gaps', () => {
  const gaps = coverageGaps();
  assert.deepEqual(gaps, [], gaps.join('\n'));
});

test('every artifact has create flow and tenant scoping', () => {
  const matrix = buildDataEntryCoverageMatrix();
  for (const row of matrix) {
    assert.equal(row.dimensions.createFlow.level, 'full', row.domain);
    assert.equal(row.dimensions.tenantScoping.level, 'full', row.domain);
    assert.equal(row.dimensions.accessibility.level, 'full', row.domain);
  }
});
