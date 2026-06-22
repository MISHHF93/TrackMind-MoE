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

test('structured evidence intake links targets, retention, audit, and evidence package', () => {
  const lib = new ComplianceControlLibrary('track-1');
  lib.addOwner({ id: 'owner-compliance', displayName: 'Compliance Officer', role: 'compliance-officer', permissions: ['read', 'collect-evidence', 'assess'] });
  lib.createControl({ id: 'ctrl-1', frameworkIds: ['ISO-27001'], title: 'Audit logging', description: 'Preserve security audit evidence', status: 'implemented', ownerId: 'owner-compliance', obligationIds: [], digitalTwinRefs: ['workflow:audit'] }, 'owner-compliance', '2026-06-13T00:00:00.000Z');
  const result = lib.recordComplianceEvidenceIntake('compliance-officer-operator', {
    title: 'Immutable audit export',
    controlId: 'ctrl-1',
    frameworkIds: ['ISO-27001', 'SOC-2'],
    policyCitation: 'Information security monitoring and logging',
    domain: 'security',
    evidenceType: 'audit-trail',
    source: 'immutable-audit-log',
    notes: 'Hash-chain verification export for quarterly review.',
    reviewStatus: 'pending-review',
    approvalRequestId: 'approval-race-start',
    auditRecordId: 'audit-incident-1',
    linkTargets: [
      { targetKind: 'incident', targetId: 'inc-1' },
      { targetKind: 'approval', targetId: 'approval-race-start' },
      { targetKind: 'audit', targetId: 'audit-incident-1' },
      { targetKind: 'kpi-definition', targetId: 'kpi-compliance' },
      { targetKind: 'regulatory-workflow', targetId: 'compliance-evidence-review' },
    ],
    retentionPolicy: 'regulated-records-7y',
    retainedUntil: '2033-06-22',
    legalHold: false,
    reason: 'Quarterly evidence refresh',
    entryMode: 'full',
    startReviewWorkflow: true,
  }, '2026-06-13T00:05:00.000Z');
  assert.equal(result.accepted, true);
  assert.ok(result.evidenceId);
  assert.ok(result.auditRecordId);
  assert.ok(result.evidencePackageId);
  assert.ok(result.workflowInstanceId);
  assert.equal(result.linkTargets.length, 6);
  const records = lib.listEvidenceRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0].title, 'Immutable audit export');
  assert.equal(records[0].retention.retentionPolicy, 'regulated-records-7y');
  assert.ok(lib.dashboard().evidenceRecords.length === 1);
});

test('seeded accreditation dashboard covers mappings, packages, programs, integrations, and approval references', () => {
  const dashboard = seededComplianceLibrary('track-1').dashboard();
  assert.equal(dashboard.frameworks.length, 12);
  assert.ok(dashboard.controls.some((control) => control.frameworkIds.includes('ISO-25010')));
  assert.ok(dashboard.frameworkMappings.some((mapping) => mapping.frameworkId === 'HISA' && mapping.mappedTo.some((item) => item.frameworkId === 'ARCI')));
  assert.equal(dashboard.evidencePackages[0].readiness, 'evidence-package-ready');
  assert.equal(dashboard.evidencePackages[0].sealed, true);
  assert.ok(dashboard.evidencePackages[0].approvalRequestIds.includes('approval-compliance-filing-1'));
  assert.equal(dashboard.accreditationPrograms[0].status, 'ready-for-internal-review');
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
  assert.equal(pkg.readiness, 'evidence-package-ready');
  assert.equal(pkg.accreditationReadiness.externalCertificationClaimed, false);
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

test('corrective actions support full CRUD lifecycle with audit linkage', () => {
  const lib = seededComplianceLibrary('track-1');
  const finding = lib.openFinding('ctrl-security-audit', 'low', 'Rotate restricted-zone credential evidence quarterly');
  const created = lib.createCorrectiveAction(finding.id, 'owner-security', 'Schedule quarterly credential evidence refresh', '2026-08-01');
  assert.equal(created.status, 'open');
  assert.ok(lib.listCorrectiveActions().some((action) => action.id === created.id));
  assert.deepEqual(lib.getCorrectiveAction(created.id).action, created.action);

  const updated = lib.updateCorrectiveAction(created.id, { status: 'in-progress', action: 'Credential refresh scheduled with security team' }, 'owner-security', '2026-06-20T00:00:00.000Z');
  assert.equal(updated.status, 'in-progress');
  assert.ok(updated.auditRecordIds.length >= 2);

  const completed = lib.updateCorrectiveAction(created.id, { status: 'done' }, 'owner-compliance', '2026-06-21T00:00:00.000Z');
  assert.equal(completed.status, 'done');
  assert.equal(lib.dashboard().findings.find((item) => item.id === finding.id)?.status, 'remediated');

  const reopened = lib.openFinding('ctrl-security-audit', 'low', 'Reopen credential rotation finding');
  const toClose = lib.createCorrectiveAction(reopened.id, 'owner-security', 'Close after verification', '2026-09-01');
  const closed = lib.closeCorrectiveAction(toClose.id, 'owner-compliance', '2026-06-21T12:00:00.000Z');
  assert.equal(closed.status, 'done');

  const removed = lib.deleteCorrectiveAction(created.id, 'owner-compliance', '2026-06-22T00:00:00.000Z');
  assert.equal(removed.deleted, true);
  assert.throws(() => lib.getCorrectiveAction(created.id), /Unknown corrective action/);
});

test('policy registry and evidence packet generation expose HISA and ISO mappings', () => {
  const lib = seededComplianceLibrary('track-1');
  const policies = lib.policyRegistry();
  assert.ok(policies.some((policy) => policy.frameworkId === 'ISO-42001'));
  assert.ok(policies.some((policy) => policy.frameworkId === 'HISA' && policy.mappedFrameworks.some((target) => target.frameworkId === 'ARCI')));

  const generated = lib.generateEvidencePacket({
    id: 'pkg-generated-test',
    title: 'Generated HISA and ISO readiness packet',
    controlIds: ['ctrl-ai-evidence', 'ctrl-racing-safety-integrity'],
    sealed: true,
    frameworkIds: ['ISO-42001', 'HISA'],
  });
  assert.equal(generated.id, 'pkg-generated-test');
  assert.equal(generated.sealed, true);
  assert.ok(generated.frameworkIds.includes('ISO-42001'));
  assert.ok(generated.frameworkIds.includes('HISA'));
  assert.equal(generated.accreditationReadiness.externalCertificationClaimed, false);
});
