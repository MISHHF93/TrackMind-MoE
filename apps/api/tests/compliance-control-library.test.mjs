import test from 'node:test';
import assert from 'node:assert/strict';
import { ComplianceControlLibrary, InMemoryEventBus, seededComplianceLibrary, complianceFrameworkPlaceholders, universalEvidenceFrameworkIds, hisaOperationalOversightCategories } from '../dist/index.js';

test('compliance control lifecycle covers placeholder frameworks, assessments, findings, actions, cycles, and readiness', () => {
  const lib = seededComplianceLibrary('track-1');
  assert.deepEqual(complianceFrameworkPlaceholders.map((f) => f.id), ['ISO-42001','NIST-AI-RMF','ISO-27001','ISO-27701','ISO-25010','ISO-31000','ISO-22301','SOC-2','PCI-DSS','HISA','ARCI','LOCAL-RACING-COMMISSION']);
  const control = lib.control('ctrl-ai-evidence');
  assert.equal(control.status, 'effective');
  assert.ok(control.frameworkIds.includes('HISA'));
  assert.ok(lib.control('ctrl-software-quality').frameworkIds.includes('ISO-25010'));
  assert.ok(lib.readiness().byFramework.some((item) => item.frameworkId === 'ISO-25010' && item.score === 100));
  const finding = lib.openFinding('ctrl-ai-evidence', 'medium', 'Refresh cadence not automated');
  const action = lib.createCorrectiveAction(finding.id, 'owner-compliance', 'Automate evidence refresh', '2026-07-15');
  const cycle = lib.createReviewCycle({ id: 'cycle-test', frameworkId: 'SOC-2', periodStart: '2026-04-01', periodEnd: '2026-06-30', controlIds: ['ctrl-ai-evidence'], status: 'in-review' });
  assert.equal(action.status, 'open');
  assert.ok(cycle.readinessScore > 0);
  assert.equal(lib.readiness().totalControls, 11);
});

test('evidence collection links compliance evidence to immutable audit records and workflow review', () => {
  const lib = new ComplianceControlLibrary('track-1');
  lib.addOwner({ id: 'owner-compliance', displayName: 'Compliance Officer', role: 'compliance-officer', permissions: ['read','collect-evidence','assess'] });
  lib.createControl({ id: 'ctrl-1', frameworkIds: ['ISO-27001'], title: 'Audit logging', description: 'Preserve security audit evidence', status: 'implemented', ownerId: 'owner-compliance', obligationIds: [], digitalTwinRefs: ['workflow:audit'] }, 'owner-compliance', '2026-06-13T00:00:00.000Z');
  const linked = lib.collectEvidence('ctrl-1', 'owner-compliance', { id: 'ev-1', uri: 'audit://security/event-1', description: 'Security event export', content: { event: 1 } }, '2026-06-13T00:01:00.000Z');
  assert.equal(linked.evidence.recordId, linked.auditRecord.id);
  assert.deepEqual(linked.auditRecord.evidenceIds, ['ev-1']);
  assert.equal(lib.evidenceVault.forRecord(linked.auditRecord.id)[0].id, 'ev-1');
  const workflow = lib.startEvidenceWorkflow('ctrl-1', 'owner-compliance', '2026-06-13T00:02:00.000Z');
  assert.equal(workflow.definitionId, 'compliance-evidence-review');
  assert.ok(lib.control('ctrl-1').workflowInstanceIds.includes(workflow.id));
});

test('seeded accreditation dashboard covers mappings, packages, programs, integrations, and approval references', () => {
  const dashboard = seededComplianceLibrary('track-1').dashboard();
  assert.equal(dashboard.frameworks.length, 12);
  assert.ok(dashboard.controls.some((control) => control.frameworkIds.includes('ISO-25010')));
  assert.ok(dashboard.frameworkMappings.some((mapping) => mapping.frameworkId === 'HISA' && mapping.mappedTo.some((item) => item.frameworkId === 'ARCI')));
  assert.equal(dashboard.evidencePackages[0].readiness, 'audit-ready');
  assert.equal(dashboard.evidencePackages[0].sealed, true);
  assert.ok(dashboard.evidencePackages[0].approvalRequestIds.includes('approval-compliance-filing-1'));
  assert.equal(dashboard.accreditationPrograms[0].status, 'ready-for-accreditor');
  assert.equal(dashboard.integrations.audit, true);
  assert.equal(dashboard.integrations.workflow, true);
  assert.equal(dashboard.integrations.approvals, true);
  assert.equal(dashboard.auditReadinessEvents.some((event) => event.type === 'compliance.accreditation.readiness.updated'), true);
});

test('every seeded control maps to universal evidence frameworks', () => {
  const dashboard = seededComplianceLibrary('track-1').dashboard();
  for (const control of dashboard.controls) {
    for (const frameworkId of universalEvidenceFrameworkIds) {
      assert.ok(control.frameworkIds.includes(frameworkId), `${control.id} missing ${frameworkId}`);
    }
  }
});

test('universal evidence package reuses one package across frameworks without certification claims', () => {
  const dashboard = seededComplianceLibrary('track-1').dashboard();
  const pkg = dashboard.evidencePackages[0];
  assert.equal(pkg.evidenceId, 'evpkg-integrated-readiness-2026-q2');
  assert.equal(pkg.tenantId, 'track-1');
  assert.equal(pkg.racetrackId, 'track-1');
  assert.equal(pkg.source.objectType, 'racetrack-operation');
  assert.ok(pkg.auditRefs.length > 0);
  assert.ok(pkg.eventRefs.length >= 0);
  assert.ok(pkg.digitalTwinRefs.length > 0);
  assert.ok(pkg.aiRecommendationRefs.includes('rec-race-start-readiness'));
  for (const frameworkId of ['ISO-42001','ISO-27001','ISO-27701','ISO-31000','SOC-2','PCI-DSS','HISA','ARCI','LOCAL-RACING-COMMISSION']) {
    assert.ok(pkg.frameworkIds.includes(frameworkId), `package missing ${frameworkId}`);
    assert.ok(pkg.frameworkMappings.some((mapping) => mapping.frameworkId === frameworkId && mapping.evidenceUse === 'reusable'));
  }
  assert.equal(pkg.controlOwnerId, 'owner-compliance');
  assert.equal(pkg.reviewCadence, 'continuous');
  assert.equal(pkg.accreditationReadiness.readinessOnly, true);
  assert.equal(pkg.accreditationReadiness.externalCertificationClaimed, false);
  assert.equal(dashboard.accreditationPrograms[0].externalCertificationClaimed, false);
});

test('ISO 42001 and NIST AI RMF links exist where AI controls apply', () => {
  const dashboard = seededComplianceLibrary('track-1').dashboard();
  const aiControl = dashboard.controls.find((control) => control.id === 'ctrl-ai-evidence');
  assert.ok(aiControl.frameworkIds.includes('ISO-42001'));
  assert.ok(aiControl.frameworkIds.includes('NIST-AI-RMF'));
  assert.ok(dashboard.obligations.some((obligation) => obligation.frameworkId === 'NIST-AI-RMF' && obligation.controlIds.includes('ctrl-ai-evidence')));
  assert.ok(dashboard.frameworkMappings.some((mapping) => mapping.frameworkId === 'ISO-42001' && mapping.mappedTo.some((target) => target.frameworkId === 'NIST-AI-RMF')));
});

test('HISA, ARCI, and local mappings include operational oversight categories', () => {
  const dashboard = seededComplianceLibrary('track-1').dashboard();
  const racingMap = dashboard.frameworkMappings.find((mapping) => mapping.frameworkId === 'HISA');
  assert.ok(racingMap.mappedTo.some((target) => target.frameworkId === 'ARCI'));
  assert.ok(racingMap.mappedTo.some((target) => target.frameworkId === 'LOCAL-RACING-COMMISSION'));
  const pkg = dashboard.evidencePackages[0];
  for (const category of hisaOperationalOversightCategories) assert.ok(pkg.hisaOperationalOversightCategories.includes(category), `missing ${category}`);
  assert.ok(dashboard.controls.some((control) => control.hisaOperationalOversightCategories.includes('racing-office-operations')));
});

test('compliance event contracts publish regulated evidence events', async () => {
  const bus = new InMemoryEventBus();
  const lib = new ComplianceControlLibrary('track-1', { eventBus: bus });
  lib.addOwner({ id: 'owner-compliance', displayName: 'Compliance Officer', role: 'compliance-officer', permissions: ['read','collect-evidence','assess'] });
  lib.createControl({ id: 'ctrl-event', frameworkIds: ['ISO-42001'], title: 'Evented control', description: 'Publishes compliance events', status: 'implemented', ownerId: 'owner-compliance', obligationIds: [], digitalTwinRefs: ['workflow:evented'] }, 'owner-compliance', '2026-06-13T00:00:00.000Z');
  lib.collectEvidence('ctrl-event', 'owner-compliance', { id: 'ev-event', uri: 'audit://evented', description: 'Evented evidence', content: { ok: true } }, '2026-06-13T00:01:00.000Z');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(bus.governanceCatalog().some((schema) => schema.type === 'compliance.evidence.collected.v1'));
  assert.equal(bus.events({ type: 'compliance.evidence.collected' })[0].compliance, 'regulated');
});

test('owner permissions prevent read-only auditors from collecting evidence or assessing controls', () => {
  const lib = seededComplianceLibrary('track-1');
  assert.throws(() => lib.collectEvidence('ctrl-ai-evidence', 'owner-auditor', { id: 'ev-denied', uri: 'audit://x', description: 'denied', content: {} }), /cannot collect evidence/);
  assert.throws(() => lib.assess('ctrl-ai-evidence', 'owner-auditor', 'effective', 'denied'), /cannot assess controls/);
});
