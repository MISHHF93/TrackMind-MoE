import test from 'node:test';
import assert from 'node:assert/strict';
import { industryIntelligenceGovernanceStatement, industryIntelligenceSchemaVersion, industryScorecardStatus } from '../dist/index.js';

test('industry intelligence schema version is stable', () => {
  assert.equal(industryIntelligenceSchemaVersion, 'trackmind.industry-intelligence.v1');
});

test('industry intelligence governance prohibits raw cross-track sharing', () => {
  assert.match(industryIntelligenceGovernanceStatement, /anonymized aggregate/i);
  assert.match(industryIntelligenceGovernanceStatement, /raw cross-track/i);
});

test('industry scorecard status mapping is consistent', () => {
  assert.equal(industryScorecardStatus(95, 80), 'leading');
  assert.equal(industryScorecardStatus(78, 80), 'on-par');
  assert.equal(industryScorecardStatus(70, 80), 'lagging');
});
