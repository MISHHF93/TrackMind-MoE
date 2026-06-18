import test from 'node:test';
import assert from 'node:assert/strict';
import { createFederationWorkspace, createSeededIndustryIntelligence } from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

test('industry intelligence workspace exposes anonymized benchmarks federation analytics aggregate KPIs trends and scorecards', () => {
  const federation = createFederationWorkspace('2026-06-14T12:00:00.000Z', false);
  const platform = createSeededIndustryIntelligence({
    organizationId: 'org-trackmind-network',
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    federation,
    kpis: [],
  });
  const workspace = platform.workspace('2026-06-14T12:00:00.000Z');

  assert.equal(workspace.schemaVersion, 'trackmind.industry-intelligence.v1');
  assert.ok(workspace.anonymizedBenchmarks.length >= 3);
  assert.ok(workspace.anonymizedBenchmarks.every((benchmark) => benchmark.anonymized && benchmark.rawTrackDataExposed === false));
  assert.ok(workspace.federationAnalytics.length >= 2);
  assert.ok(workspace.federationAnalytics.every((analytic) => analytic.rawRecordRefs.length === 0));
  assert.ok(workspace.aggregateKpis.length >= 3);
  assert.ok(workspace.trendComparisons.length >= 3);
  assert.ok(workspace.industryScorecards.length >= 3);
  assert.equal(workspace.guardrails.rawCrossTrackRecordSharing, false);
  assert.equal(workspace.guardrails.crossTenantJoinsAllowed, false);
  assert.equal(workspace.guardrails.federationGovernanceRespected, true);
  assert.deepEqual(validateContract('IndustryIntelligenceWorkspaceDto', workspace, apiContractSchemas.IndustryIntelligenceWorkspaceDto), { valid: true, errors: [] });
});

test('industry intelligence legacy federation projection remains anonymized', () => {
  const platform = createSeededIndustryIntelligence({
    federation: createFederationWorkspace(),
  });
  const legacy = platform.federationIntelligenceLegacy();
  assert.equal(legacy.anonymized, true);
  assert.equal(legacy.governancePosture.aggregateOnly, true);
  assert.equal(legacy.governancePosture.crossTenantJoinsAllowed, false);
  assert.ok(legacy.benchmarkMetrics.length >= 1);
});
