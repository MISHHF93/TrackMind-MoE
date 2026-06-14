import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_ARTIFACT_SCHEMA_VERSION,
  EVENT_ARTIFACT_SCHEMA_VERSION,
  toAuditArtifact,
  toEventArtifact,
  toEventAuditArtifactLink,
} from '../dist/artifactAdapters.js';
import { ImmutableAuditLog } from '../dist/auditLog.js';
import { bindAuditLogToEvents, UniversalEventBus } from '../dist/eventBus.js';

const owner = { service: 'asset-registry', team: 'Racetrack Assets', accountableRole: 'Asset Registry Owner' };
const jsonRoundTrip = (value) => JSON.parse(JSON.stringify(value));

async function publishAssetEvent() {
  const bus = new UniversalEventBus();
  bus.registerEvent({
    type: 'asset.inspection.recorded',
    version: 1,
    description: 'Asset inspection recorded',
    owner,
    payloadFields: ['assetId', 'inspectionId'],
    compliance: 'regulated',
  });
  return bus.publish({
    id: 'evt-asset-inspection-1',
    type: 'asset.inspection.recorded',
    occurredAt: '2026-06-14T12:00:00.000Z',
    payload: {
      assetId: 'gate-1',
      inspectionId: 'inspection-1',
      evidenceIds: ['inspection-photo-1'],
      digitalTwinRefs: ['twin:gate:1:payload'],
    },
    tenantId: 'tenant-1',
    racetrackId: 'track-1',
    aggregateId: 'gate-1',
    correlationId: 'corr-asset-1',
    causationId: 'cmd-asset-1',
    parentEventIds: ['evt-prior-1'],
    auditRef: 'audit-asset-1',
    digitalTwinRef: 'twin:gate:1',
    approvalRef: 'approval-inspection-1',
    workflowRef: 'wf-inspection-1',
    actor: { id: 'asset-service', type: 'service' },
    subject: { id: 'gate-1', type: 'asset', tenantId: 'tenant-1' },
    evidence: ['work-order-1'],
    producer: 'asset-registry',
    metadata: { compliance: 'regulated', evidence: ['metadata-evidence-1'] },
  });
}

test('event adapter converts current event DTOs into canonical EventArtifact', async () => {
  const event = await publishAssetEvent();
  const artifact = toEventArtifact(event);

  assert.equal(artifact.schemaVersion, EVENT_ARTIFACT_SCHEMA_VERSION);
  assert.equal(artifact.artifactType, 'event');
  assert.equal(artifact.eventId, event.id);
  assert.equal(artifact.eventType, 'asset.inspection.recorded');
  assert.equal(artifact.tenantId, 'tenant-1');
  assert.equal(artifact.racetrackId, 'track-1');
  assert.equal(artifact.correlationId, 'corr-asset-1');
  assert.equal(artifact.causationId, 'cmd-asset-1');
  assert.equal(artifact.assetId, 'gate-1');
  assert.deepEqual(artifact.actor, { id: 'asset-service', type: 'service' });
  assert.ok(artifact.auditRefs.includes('audit-asset-1'));
  assert.ok(artifact.digitalTwinRefs.includes('twin:gate:1'));
  assert.ok(artifact.digitalTwinRefs.includes('twin:gate:1:payload'));
  assert.ok(artifact.evidence.includes('work-order-1'));
  assert.ok(artifact.evidence.includes('inspection-photo-1'));
  assert.ok(artifact.evidence.includes('audit-asset-1'));
  assert.deepEqual(jsonRoundTrip(artifact), artifact);
});

test('audit adapter converts current audit DTOs and preserves hash/evidence metadata', () => {
  const ledger = new ImmutableAuditLog();
  const entry = ledger.append({
    id: 'audit-gate-inspection',
    type: 'data-change',
    actor: 'asset-registry',
    actorType: 'service',
    timestamp: '2026-06-14T12:01:00.000Z',
    action: 'asset.inspection.recorded',
    actionClass: 'asset',
    subjectId: 'gate-1',
    tenantId: 'tenant-1',
    workflowId: 'wf-inspection-1',
    correlationId: 'corr-asset-1',
    severity: 'warning',
    regulations: ['HISA'],
    evidenceIds: ['inspection-photo-1'],
    evidence: [{ id: 'inspection-report-1', uri: 'evidence://inspection/report', hash: 'sha256:report', description: 'Inspector report' }],
    payload: {
      assetId: 'gate-1',
      digitalTwinRefs: ['twin:gate:1'],
      sourceEventId: 'evt-asset-inspection-1',
      causationId: 'cmd-asset-1',
      approvalRequestId: 'approval-inspection-1',
    },
  });

  const artifact = toAuditArtifact(entry);

  assert.equal(artifact.schemaVersion, AUDIT_ARTIFACT_SCHEMA_VERSION);
  assert.equal(artifact.artifactType, 'audit');
  assert.equal(artifact.auditId, 'audit-gate-inspection');
  assert.equal(artifact.tenantId, 'tenant-1');
  assert.equal(artifact.correlationId, 'corr-asset-1');
  assert.equal(artifact.causationId, 'cmd-asset-1');
  assert.equal(artifact.assetId, 'gate-1');
  assert.ok(artifact.eventRefs.includes('evt-asset-inspection-1'));
  assert.ok(artifact.digitalTwinRefs.includes('twin:gate:1'));
  assert.ok(artifact.evidenceIds.includes('inspection-photo-1'));
  assert.ok(artifact.evidenceIds.includes('inspection-report-1'));
  assert.equal(artifact.hashChain.previousHash, 'genesis');
  assert.equal(artifact.hashChain.hash, entry.hash);
  assert.ok(artifact.hashChain.hash.startsWith('sha256:'));
  assert.deepEqual(jsonRoundTrip(artifact), artifact);
});

test('event and audit artifacts link audit-sink records without losing refs', async () => {
  const bus = new UniversalEventBus();
  const ledger = new ImmutableAuditLog();
  bindAuditLogToEvents(bus, ledger);
  bus.registerEvent({
    type: 'asset.registry.changed',
    version: 1,
    description: 'Asset registry changed',
    owner,
    payloadFields: ['assetId'],
    compliance: 'regulated',
  });

  const event = await bus.publish({
    id: 'evt-registry-change-1',
    type: 'asset.registry.changed',
    occurredAt: '2026-06-14T13:00:00.000Z',
    payload: { assetId: 'gate-2', evidenceIds: ['registry-diff-1'] },
    tenantId: 'tenant-1',
    racetrackId: 'track-1',
    aggregateId: 'gate-2',
    correlationId: 'corr-registry-1',
    causationId: 'cmd-registry-1',
    auditRef: 'audit-registry-command',
    digitalTwinRef: 'twin:gate:2',
    actor: { id: 'asset-service', type: 'service' },
    subject: { id: 'gate-2', type: 'asset', tenantId: 'tenant-1' },
    evidence: ['registry-form-1'],
    producer: 'asset-registry',
  });
  const audit = ledger.all().find((entry) => entry.id === `audit:${event.id}`);

  const eventArtifact = toEventArtifact(event);
  const auditArtifact = toAuditArtifact(audit);
  const link = toEventAuditArtifactLink(eventArtifact, auditArtifact);

  assert.equal(auditArtifact.eventRefs[0], event.id);
  assert.equal(link.eventId, event.id);
  assert.equal(link.auditId, audit.id);
  assert.equal(link.correlationId, 'corr-registry-1');
  assert.equal(link.causationId, 'cmd-registry-1');
  assert.equal(link.tenantId, 'tenant-1');
  assert.equal(link.assetId, 'gate-2');
  assert.ok(link.evidenceIds.includes('registry-form-1'));
  assert.ok(link.evidenceIds.includes('registry-diff-1'));
  assert.ok(link.digitalTwinRefs.includes('twin:gate:2'));
  assert.equal(link.auditHashChain.hash, audit.hash);
  assert.deepEqual(jsonRoundTrip(link), link);
});
