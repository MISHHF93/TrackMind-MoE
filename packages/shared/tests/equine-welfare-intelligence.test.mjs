import test from 'node:test';
import assert from 'node:assert/strict';
import { equineWelfareIntelligenceSchemaVersion, equineWelfareAdvisoryGuardrailStatement, welfareScoreBand } from '../dist/index.js';

test('equine welfare intelligence schema version is stable', () => {
  assert.equal(equineWelfareIntelligenceSchemaVersion, 'trackmind.equine-welfare-intelligence.v1');
});

test('equine welfare guardrail keeps AI recommendations advisory', () => {
  assert.match(equineWelfareAdvisoryGuardrailStatement, /advisory only/i);
  assert.match(equineWelfareAdvisoryGuardrailStatement, /veterinarian/i);
});

test('welfare score band mapping is consistent', () => {
  assert.equal(welfareScoreBand(92), 'excellent');
  assert.equal(welfareScoreBand(40), 'critical');
});
