import test from 'node:test';
import assert from 'node:assert/strict';
import { createRacingDataApiFacadeState } from '../dist/racingDataApiHub.js';
import {
  configureLicensedConnectorQuota,
  invokeLicensedProviderConnector,
  resetLicensedProviderConnectorState,
} from '../dist/platform/licensedProviderConnector.js';

test('licensed provider connector simulates invoke with lineage and rate limits', () => {
  resetLicensedProviderConnectorState();
  const state = createRacingDataApiFacadeState();
  const result = invokeLicensedProviderConnector('provider-official-feed', state);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.status, 'simulated');
  assert.equal(result.externalCallsPerformed, false);
  assert.equal(result.scrapingPerformed, false);
  assert.ok(result.lineage.sourceRefs.length >= 1);
  assert.ok(result.rateLimit.remaining < result.rateLimit.limit);
});

test('licensed provider connector blocks suspended providers', () => {
  resetLicensedProviderConnectorState();
  const state = createRacingDataApiFacadeState();
  const result = invokeLicensedProviderConnector('provider-restricted-odds', state);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'provider_suspended');
});

test('licensed provider connector enforces quota exhaustion', () => {
  resetLicensedProviderConnectorState();
  const state = createRacingDataApiFacadeState();
  configureLicensedConnectorQuota('provider-official-feed', 0);
  const result = invokeLicensedProviderConnector('provider-official-feed', state);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'rate_limit_exceeded');
  assert.equal(result.rateLimit?.remaining, 0);
});
