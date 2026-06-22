import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DigitalTwinFoundationPlatform,
  DigitalTwinRuntime,
  PlatformObservabilityService,
  RacetrackAssetRegistryService,
  createStewardInquiry,
  generateStewardTimeline,
  issueFinalRuling,
  SecurityOperationsService,
  seededComplianceLibrary,
  UniversalEventBus,
} from '../dist/index.js';
import {
  foundationTwinToDigitalTwinArtifact,
  gatePositionToTelemetryArtifact,
  platformHealthSignalToTelemetryArtifact,
  runtimeTwinToDigitalTwinArtifact,
  surfaceMeasurementToTelemetryArtifacts,
} from '../dist/artifactAdapters.js';
import {
  toComplianceArtifacts,
  toSecurityInvestigationArtifacts,
  toStewardInvestigationArtifacts,
} from '../dist/complianceInvestigationArtifactAdapters.js';

const securityActor = {
  id: 'sec-commander',
  roles: ['security-manager'],
  tenantId: 'track-1',
  human: true,
  permissions: ['security:read', 'security:sensitive-read', 'security:manage', 'security:investigate'],
};

const artifactContext = { tenantId: 'tenant-track-1', racetrackId: 'main-track', trackId: 'main-track', timestamp: '2026-06-14T12:00:00.000Z', mock: false };

function assertTelemetryArtifact(artifact) {
  assert.equal(artifact.schemaVersion, 'trackmind.artifact.telemetry.v1');
  assert.equal(artifact.artifactType, 'telemetry');
  assert.ok(artifact.artifactId);
  assert.ok(artifact.timestamp);
  assert.ok(artifact.metric);
  assert.ok(artifact.unit);
  assert.ok(artifact.sourceSensor);
  assert.ok(Array.isArray(artifact.lineage));
  assert.ok(Array.isArray(artifact.evidenceRefs));
  assert.equal(artifact.safeForStateMutation, false);
}

function assertDigitalTwinArtifact(artifact) {
  assert.equal(artifact.schemaVersion, 'trackmind.artifact.digital-twin.v1');
  assert.equal(artifact.artifactType, 'digital-twin');
  assert.ok(artifact.artifactId);
  assert.ok(artifact.assetId);
  assert.ok(artifact.twinId);
  assert.ok(artifact.timestamp);
  assert.ok(Array.isArray(artifact.telemetry));
  assert.ok(Array.isArray(artifact.history));
  assert.ok(Array.isArray(artifact.lineage));
  assert.ok(Array.isArray(artifact.evidenceRefs));
  assert.equal(artifact.safeForStateMutation, false);
}

test('surface measurement artifacts preserve moisture compaction context lineage and evidence', () => {
  const measurement = { sectorId: 'far-turn', moisture: 27, compaction: 276, measuredAt: '2026-06-14T11:58:00.000Z', eventId: 'evt-surface-far-turn', auditId: 'audit-surface-far-turn' };
  const artifacts = surfaceMeasurementToTelemetryArtifacts(measurement, { ...artifactContext, twinId: 'twin:track:far-turn', sourceSensor: 'surface-probe-44' });

  assert.equal(artifacts.length, 2);
  for (const artifact of artifacts) {
    assertTelemetryArtifact(artifact);
    assert.equal(artifact.tenantId, artifactContext.tenantId);
    assert.equal(artifact.racetrackId, artifactContext.racetrackId);
    assert.equal(artifact.context.sectorId, 'far-turn');
    assert.equal(artifact.sourceSensor, 'surface-probe-44');
    assert.equal(artifact.quality, 'good');
    assert.equal(artifact.safeForStateMutation, false);
    assert.ok(artifact.lineage[0].inputs.includes('evt-surface-far-turn'));
    assert.ok(artifact.evidenceRefs.some((ref) => ref.id === 'audit-surface-far-turn' && ref.type === 'audit'));
  }

  const moisture = artifacts.find((artifact) => artifact.metric === 'surface.moisture');
  const compaction = artifacts.find((artifact) => artifact.metric === 'surface.compaction');
  assert.equal(moisture.value, 27);
  assert.equal(moisture.unit, '%');
  assert.equal(compaction.value, 276);
  assert.equal(compaction.unit, 'psi');
  assert.ok(compaction.risk.drivers.includes('surface-compaction'));
});

test('gate GPS and platform health telemetry artifacts expose quality source and safe boundaries', () => {
  const gate = gatePositionToTelemetryArtifact({ gateId: 'gate-1', sectorId: 'backstretch', metersFromStart: 0, gpsVerified: true, lastApprovedRequestId: 'approval-gate-gps', mock: false }, { ...artifactContext, twinId: 'twin:main-track:gate-1' });
  assertTelemetryArtifact(gate);
  assert.equal(gate.metric, 'gate.gpsVerified');
  assert.equal(gate.unit, 'boolean');
  assert.equal(gate.value, true);
  assert.equal(gate.quality, 'good');
  assert.equal(gate.assetId, 'gate-1');
  assert.equal(gate.twinId, 'twin:main-track:gate-1');
  assert.ok(gate.evidenceRefs.some((ref) => ref.id === 'approval-gate-gps' && ref.type === 'approval'));
  assert.equal(gate.safeForStateMutation, false);

  const observability = new PlatformObservabilityService();
  const signal = observability.reportFrontendError({ message: 'camera health tile degraded', route: '/platform-health', component: 'CameraHealthCard', severity: 'warning', traceId: 'trace-camera-health' });
  const platform = platformHealthSignalToTelemetryArtifact(signal, artifactContext);
  assertTelemetryArtifact(platform);
  assert.equal(platform.metric, 'frontend.error.reported');
  assert.equal(platform.sourceSensor, 'dashboard');
  assert.equal(platform.quality, 'watch');
  assert.equal(platform.health.status, 'degraded');
  assert.equal(platform.state.attributes.component, 'CameraHealthCard');
  assert.ok(platform.evidenceRefs.some((ref) => ref.id === 'trace-camera-health'));
  assert.equal(platform.safeForStateMutation, false);
});

test('digital twin artifacts include runtime history foundation audit refs and cloned state', async () => {
  const eventBus = new UniversalEventBus();
  const runtime = new DigitalTwinRuntime({ eventBus });
  const registry = new RacetrackAssetRegistryService({ eventBus });
  await registry.create({
    assetId: 'SURFACE_TWIN_ARTIFACT_01',
    externalIds: ['surface-artifact-01'],
    name: 'Far Turn Surface Twin',
    assetType: 'TrackSector',
    domain: 'surface',
    riskLevel: 'high',
    maintenance: { status: 'due', lastInspectionAt: '2026-06-14T10:00:00.000Z' },
    ownership: { ownerAgent: 'TrackSurface', stewardTeam: 'surface-crew' },
    location: { sectorId: 'far-turn' },
    state: { moisture: 27, compaction: 276 },
    controls: [],
    sensors: [{ id: 'surface-probe-44', type: 'surface-probe', verifies: ['moisture', 'compaction'], required: true }],
    regulations: [{ authority: 'StateRacingCommission', reference: 'surface-safety', appliesTo: ['inspection'] }],
    tags: ['surface'],
    approvalPolicyId: 'critical-asset-dual-control',
    metadata: {},
  }, { id: 'surface-user', tenantId: artifactContext.tenantId, scopes: ['assets:write', 'assets:read', 'assets:approve'] });

  const created = runtime.queryTwins({ assetId: 'SURFACE_TWIN_ARTIFACT_01' })[0];
  await eventBus.publish({ id: 'evt-surface-moisture-artifact', type: 'telemetry.observed', producer: 'telemetry-stream', aggregateId: created.twinId, payload: { twinId: created.twinId, tenantId: artifactContext.tenantId, sensorId: 'surface-probe-44', metric: 'moisture', value: 28, observedAt: '2026-06-14T12:01:00.000Z' } });
  const twin = runtime.getTwin(created.twinId);
  const twinStateBefore = JSON.parse(JSON.stringify(twin.state));
  const runtimeArtifact = runtimeTwinToDigitalTwinArtifact(twin, artifactContext);

  assertDigitalTwinArtifact(runtimeArtifact);
  assert.equal(runtimeArtifact.assetId, 'SURFACE_TWIN_ARTIFACT_01');
  assert.equal(runtimeArtifact.twinId, created.twinId);
  assert.ok(runtimeArtifact.telemetry.some((item) => item.sourceSensor === 'surface-probe-44' && item.metric === 'moisture' && item.value === 28));
  assert.ok(runtimeArtifact.history.some((event) => event.evidenceRefs.includes('evt-surface-moisture-artifact')));
  assert.ok(runtimeArtifact.evidenceRefs.some((ref) => ref.id === 'evt-surface-moisture-artifact' && ref.type === 'event'));
  assert.equal(runtimeArtifact.safeForStateMutation, false);

  runtimeArtifact.state.moisture = 99;
  assert.deepEqual(twin.state, twinStateBefore);

  const foundation = new DigitalTwinFoundationPlatform();
  foundation.registerTwin({ id: 'sensor-surface-probe-44', kind: 'sensor', name: 'Surface Probe 44', tenantId: artifactContext.tenantId, updatedAt: '2026-06-14T11:00:00.000Z', state: { online: true } });
  const foundationTwin = foundation.registerTwin({ id: 'twin:track:far-turn', kind: 'racetrack-asset', name: 'Far Turn Foundation Twin', tenantId: artifactContext.tenantId, updatedAt: '2026-06-14T11:00:00.000Z', state: { assetId: 'TRACK_SECTOR_FAR_TURN', moisture: 27 }, dependencies: ['sensor-surface-probe-44'], regulatoryRefs: ['HISA-surface'], telemetryBindings: [{ sensorId: 'surface-probe-44', metric: 'moisture', unit: '%', freshnessSeconds: 60 }] });
  const synced = foundation.synchronize({ twinId: foundationTwin.id, expectedVersion: 1, observedAt: '2026-06-14T12:02:00.000Z', sourceSystem: 'surface-telemetry', patch: { moisture: 29 }, telemetry: { sensorId: 'surface-probe-44', metric: 'moisture', value: 29, unit: '%' } });
  const foundationArtifact = foundationTwinToDigitalTwinArtifact(synced, artifactContext, foundation.audit(synced.id));

  assertDigitalTwinArtifact(foundationArtifact);
  assert.equal(foundationArtifact.twinId, 'twin:track:far-turn');
  assert.ok(foundationArtifact.history.some((event) => event.id.startsWith('audit-')));
  assert.ok(foundationArtifact.evidenceRefs.some((ref) => ref.id === 'telemetry:surface-probe-44:moisture'));
  assert.ok(foundationArtifact.evidenceRefs.some((ref) => ref.id === 'HISA-surface' && ref.type === 'regulatory'));
  assert.equal(foundationArtifact.safeForStateMutation, false);
});

test('compliance artifacts canonicalize ISO, SOC, PCI, HISA, and ARCI controls evidence and readiness', () => {
  const dashboard = seededComplianceLibrary('track-1').dashboard();
  const artifacts = toComplianceArtifacts(dashboard, { frameworkIds: ['ISO42001', 'ISO27001', 'SOC2', 'PCI', 'HISA', 'ARCI'], tenantId: 'track-1' });

  const evidencePackage = artifacts.find((artifact) => artifact.kind === 'evidence-package' && artifact.id === 'compliance-evidence:pkg-accreditation-2026-q2');
  assert.ok(evidencePackage);
  for (const frameworkId of ['ISO-42001', 'ISO-27001', 'SOC-2', 'PCI-DSS', 'HISA', 'ARCI']) {
    assert.ok(evidencePackage.frameworkIds.includes(frameworkId), `missing ${frameworkId}`);
  }
  assert.equal(evidencePackage.readiness.readinessOnly, true);
  assert.equal(evidencePackage.readiness.externalCertificationClaimed, false);
  assert.ok(evidencePackage.traceability.auditRefs.length > 0);
  assert.ok(evidencePackage.traceability.eventRefs.length >= 0);
  assert.ok(evidencePackage.traceability.evidenceTraceIds.length > 0);

  const pciControl = artifacts.find((artifact) => artifact.kind === 'control' && artifact.controlIds.includes('ctrl-payment-security'));
  assert.ok(pciControl);
  assert.ok(pciControl.frameworkIds.includes('PCI-DSS'));
  assert.ok(pciControl.ruleRefs.some((rule) => rule.frameworkId === 'PCI-DSS'));

  const hisaReadiness = artifacts.find((artifact) => artifact.kind === 'readiness' && artifact.id === 'compliance-readiness:HISA');
  assert.ok(hisaReadiness);
  assert.equal(hisaReadiness.readiness.readinessOnly, true);
  assert.equal(hisaReadiness.sensitiveDataHandling.unsafeActionsExcluded, true);
});

test('security investigation artifacts mask sensitive evidence for UI adapters while retaining traceability', () => {
  const service = new SecurityOperationsService(() => '2026-06-14T00:00:00.000Z');
  const incident = service.createIncident(securityActor, { title: 'Credential replay on medication door', severity: 'critical', zoneId: 'zone-backstretch-medication', eventIds: ['evt-door-1'] });
  service.openInvestigation(securityActor, incident.id, 'investigator-1', ['video://camera/medication-door?credential=cred-secret', 'credential://cred-secret']);

  const workspace = service.getWorkspace({ id: 'auditor', roles: ['read-only-auditor'], permissions: ['security:read'] });
  const artifacts = toSecurityInvestigationArtifacts(workspace, { tenantId: 'track-1' });
  const investigation = artifacts.find((artifact) => artifact.kind === 'investigation');
  assert.ok(investigation);
  assert.equal(investigation.caseId, incident.id);
  assert.equal(investigation.tenantId, 'track-1');
  assert.ok(investigation.evidence.every((item) => item.masked));
  assert.ok(investigation.evidence.every((item) => item.display === '[masked evidence]'));
  assert.ok(investigation.evidence.every((item) => item.uri === undefined));
  assert.ok(investigation.traceability.auditRefs.includes(investigation.timeline[0].auditRef));
  assert.equal(investigation.traceability.evidenceTraceIds.length, 2);

  const serialized = JSON.stringify(investigation);
  assert.doesNotMatch(serialized, /cred-secret/);
  assert.doesNotMatch(serialized, /video:\/\/camera/);
});

test('steward investigation artifacts preserve case lineage without exposing final rulings', () => {
  const inquiry = createStewardInquiry({
    id: 'inq-artifact-1',
    raceId: 'race-7',
    openedAt: '2026-06-13T21:00:00Z',
    openedBy: 'steward-1',
    involvedHorses: [{ horseId: 'h1', name: 'One', programNumber: '1', officialResultLocked: true }],
    involvedJockeys: [{ jockeyId: 'j1', name: 'J One', licenseId: 'L1', horseId: 'h1' }],
    evidenceReferences: [{ id: 'ev1', kind: 'video', uri: 's3://steward/private/replay.mp4', capturedAt: '2026-06-13T21:00:00Z', addedBy: 'steward-1', description: 'private replay', hash: 'sha256:clip' }],
    ruleReferences: [{ id: 'r1', jurisdiction: 'NY', rulebook: 'rules', section: '1', citation: 'interference', summary: 'review interference' }],
    objections: [{ id: 'obj-1', filedBy: 'trainer-1', filedAt: '2026-06-13T21:01:00Z', horseId: 'h1', jockeyId: 'j1', allegation: 'Interference claim', status: 'accepted-for-review' }],
  });
  issueFinalRuling(inquiry, { id: 'final-secret', issuedBy: 'steward-1', issuedByRole: 'steward', issuedAt: '2026-06-13T21:20:00Z', decision: 'objection upheld with confidential penalty', rationale: 'confidential deliberation', penalties: ['private fine'], officialResultsModified: false, evidenceIds: ['ev1'], ruleIds: ['r1'] });
  inquiry.timeline = generateStewardTimeline(inquiry);

  const artifacts = toStewardInvestigationArtifacts([inquiry], { tenantId: 'track-1' });
  const inquiryArtifact = artifacts.find((artifact) => artifact.kind === 'inquiry');
  const objectionArtifact = artifacts.find((artifact) => artifact.kind === 'objection');
  assert.ok(inquiryArtifact);
  assert.ok(objectionArtifact);
  assert.equal(inquiryArtifact.caseId, inquiry.id);
  assert.equal(inquiryArtifact.finalRulingRef.id, 'final-secret');
  assert.equal(inquiryArtifact.finalRulingRef.withheld, true);
  assert.ok(inquiryArtifact.subjects.some((subject) => subject.id === 'race-7'));
  assert.ok(inquiryArtifact.ruleRefs.some((rule) => rule.id === 'r1'));
  assert.ok(inquiryArtifact.traceability.auditRefs.length >= 2);
  assert.ok(inquiryArtifact.timeline.some((entry) => entry.source === 'final-ruling' && entry.masked && entry.label === '[final ruling withheld]'));
  assert.equal(inquiryArtifact.sensitiveDataHandling.finalRulingExcluded, true);
  assert.equal(inquiryArtifact.sensitiveDataHandling.unsafeActionsExcluded, true);

  const serialized = JSON.stringify(artifacts);
  assert.doesNotMatch(serialized, /objection upheld/);
  assert.doesNotMatch(serialized, /confidential penalty/);
  assert.doesNotMatch(serialized, /private fine/);
  assert.doesNotMatch(serialized, /s3:\/\/steward\/private/);
});
