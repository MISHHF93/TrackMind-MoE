import test from 'node:test';
import assert from 'node:assert/strict';
import { ImmutableAuditLog, RacingDataLicensePolicyService, seededRacingDataLicensePolicyService } from '../dist/index.js';

const now = '2026-06-14T22:00:00.000Z';

function seededWithAudit() {
  const auditLog = new ImmutableAuditLog();
  const service = seededRacingDataLicensePolicyService(now, { auditLog });
  return { service, auditLog };
}

test('license policy allows internal racing operations', () => {
  const { service, auditLog } = seededWithAudit();

  const decision = service.checkUsage({
    providerId: 'provider-trackfeed-basic',
    operation: 'operations',
    actor: 'race-ops-api',
    datasetId: 'dataset:entries-live',
    requestedAt: now,
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.retentionDays, 30);
  assert.equal(decision.eventType, undefined);
  assert.equal(auditLog.all().length, 0);
});

test('license policy blocks public redistribution and records LicenseRestrictionDetected metadata', () => {
  const { service, auditLog } = seededWithAudit();

  const decision = service.checkUsage({
    providerId: 'provider-trackfeed-basic',
    operation: 'public_redistribution',
    actor: 'api-consumer',
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    datasetId: 'dataset:odds-feed',
    correlationId: 'corr-license-redist',
    requestedAt: now,
    evidence: ['request:public-feed'],
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.eventType, 'LicenseRestrictionDetected');
  assert.match(decision.reasons.join(' '), /restricted|redistribution/i);

  const audit = auditLog.all()[0];
  assert.equal(audit.action, 'LicenseRestrictionDetected');
  assert.equal(audit.decision, 'blocked');
  assert.equal(audit.sourceService, 'racing-data-license-policy');
  assert.equal(audit.payload.eventName, 'LicenseRestrictionDetected');
  assert.equal(audit.payload.providerId, 'provider-trackfeed-basic');
  assert.equal(audit.payload.operation, 'public_redistribution');
  assert.ok(audit.evidenceIds.includes('policy:policy-provider-trackfeed-basic-v1'));
});

test('license policy blocks unlicensed model training', () => {
  const { service, auditLog } = seededWithAudit();

  const decision = service.checkUsage({
    providerId: 'provider-unlicensed-feed',
    operation: 'internal_model_training_only',
    actor: 'feature-builder',
    datasetId: 'dataset:unlicensed-speed-figures',
    requestedAt: now,
  });

  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /No DataUsagePolicy/);
  assert.equal(decision.eventType, 'LicenseRestrictionDetected');
  assert.equal(auditLog.all()[0].payload.eventName, 'LicenseRestrictionDetected');
});

test('license policy enforces attribution-required public display', () => {
  const { service } = seededWithAudit();

  const missingAttribution = service.checkUsage({
    providerId: 'provider-trackfeed-basic',
    operation: 'public_display',
    actor: 'display-api',
    datasetId: 'dataset:public-results',
    requestedAt: now,
  });

  assert.equal(missingAttribution.allowed, false);
  assert.match(missingAttribution.reason, /attribution/i);
  assert.equal(missingAttribution.requiresAttribution, true);
  assert.equal(missingAttribution.attributionSatisfied, false);

  const withAttribution = service.checkUsage({
    providerId: 'provider-trackfeed-basic',
    operation: 'public_display',
    actor: 'display-api',
    datasetId: 'dataset:public-results',
    attribution: 'TrackFeed Basic',
    requestedAt: now,
  });

  assert.equal(withAttribution.allowed, true);
  assert.equal(withAttribution.attributionSatisfied, true);
  assert.ok(withAttribution.obligations.some((item) => item.includes('TrackFeed Basic')));
});

test('license policy returns provider retention hints for analytics', () => {
  const { service } = seededWithAudit();

  const decision = service.checkUsage({
    providerId: 'provider-racing-analytics-pro',
    operation: 'analytics',
    actor: 'analytics-api',
    datasetId: 'dataset:sectional-times',
    requestedAt: now,
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.retentionDays, 365);
  assert.match(decision.retentionHint, /365 days/);
});

test('data usage policy serialization preserves required provider license fields', () => {
  const service = new RacingDataLicensePolicyService();
  const policy = service.serializePolicy({
    id: 'policy-provider-custom-v1',
    providerId: 'provider-custom-feed',
    allowedUses: ['operations', 'analytics', 'export'],
    restrictedUses: ['public_redistribution', 'commercial_resale'],
    requiresAttribution: false,
    retentionDays: 90,
    exportAllowed: true,
    redistributionAllowed: false,
    commercialUseAllowed: false,
    modelTrainingAllowed: false,
    modelTrainingRestriction: 'model_training_prohibited',
  });

  for (const field of ['allowedUses', 'restrictedUses', 'requiresAttribution', 'retentionDays', 'exportAllowed', 'redistributionAllowed', 'commercialUseAllowed', 'modelTrainingAllowed', 'providerId']) {
    assert.ok(Object.hasOwn(policy, field), `${field} should be serialized`);
  }
  assert.equal(policy.artifactType, 'DataUsagePolicy');
  assert.equal(policy.schemaVersion, 'trackmind.racing-data-usage-policy.v1');
  assert.equal(policy.providerId, 'provider-custom-feed');
  assert.equal(policy.modelTrainingAllowed, false);
  assert.equal(policy.modelTrainingRestriction, 'model_training_prohibited');
});
