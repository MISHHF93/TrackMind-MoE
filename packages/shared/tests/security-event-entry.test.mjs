import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSecurityEventIntakePayload,
  buildSecurityEventTitle,
  defaultSecurityEventSeed,
  securityEventTypes,
  validateSecurityEventEntry,
} from '../dist/securityEventEntry.js';

test('security event types cover operational intake categories', () => {
  const types = securityEventTypes.map((definition) => definition.type);
  assert.deepEqual(types, [
    'restricted-zone',
    'access-issue',
    'suspicious-activity',
    'security-incident',
    'personnel-event',
    'escalation-request',
  ]);
});

test('validateSecurityEventEntry rejects edit mode', () => {
  const result = validateSecurityEventEntry({
    eventType: 'access-issue',
    severity: 'medium',
    zoneId: 'zone-paddock',
    summary: 'Credential reader timeout at paddock gate.',
    reason: 'Gate officer manual log',
  }, 'edit', 'quick');
  assert.equal(result.valid, false);
});

test('validateSecurityEventEntry requires zone for access events', () => {
  const invalid = validateSecurityEventEntry({
    eventType: 'restricted-zone',
    severity: 'high',
    summary: 'Tailgating observed at medication storage door.',
    reason: 'Officer patrol observation',
  }, 'create', 'quick');
  assert.equal(invalid.valid, false);
  const valid = validateSecurityEventEntry({
    eventType: 'restricted-zone',
    severity: 'high',
    zoneId: 'zone-backstretch-medication',
    summary: 'Tailgating observed at medication storage door.',
    reason: 'Officer patrol observation',
  }, 'create', 'quick');
  assert.equal(valid.valid, true);
});

test('buildSecurityEventIntakePayload maps access issue with review decision', () => {
  const payload = buildSecurityEventIntakePayload(
    { actorId: 'security-operator' },
    {
      eventType: 'access-issue',
      entryMode: 'quick',
      severity: 'medium',
      zoneId: 'zone-paddock',
      summary: 'Badge reader failed to respond — manual override used.',
      accessDecision: 'review',
      accessReason: 'Reader offline',
      reason: 'Manual gate log',
    },
    'quick',
  );
  assert.equal(payload.accessDecision, 'review');
  assert.equal(payload.zoneId, 'zone-paddock');
  assert.equal(payload.reportedBy, 'security-operator');
});

test('buildSecurityEventTitle truncates long summaries', () => {
  const title = buildSecurityEventTitle('suspicious-activity', 'A'.repeat(100));
  assert.ok(title.endsWith('…'));
  assert.ok(title.startsWith('Suspicious:'));
});

test('defaultSecurityEventSeed includes escalation route for escalation requests', () => {
  const seed = defaultSecurityEventSeed('escalation-request', 'security-operator', 'zone-paddock');
  assert.equal(seed.eventType, 'escalation-request');
  assert.ok(String(seed.escalationRoute).includes('security-supervisor'));
});
