import test from 'node:test';
import assert from 'node:assert/strict';
import { ComplianceControlLibrary, seededComplianceLibrary, complianceFrameworkPlaceholders } from '../dist/index.js';

test('compliance control lifecycle covers placeholder frameworks, assessments, findings, actions, cycles, and readiness', () => {
  const lib = seededComplianceLibrary('track-1');
  assert.deepEqual(complianceFrameworkPlaceholders.map((f) => f.id), ['ISO-42001','ISO-27001','ISO-27701','ISO-31000','ISO-22301','SOC-2','PCI-DSS','HISA','ARCI','LOCAL-RACING-COMMISSION']);
  const control = lib.control('ctrl-ai-evidence');
  assert.equal(control.status, 'effective');
  assert.ok(control.frameworkIds.includes('HISA'));
  const finding = lib.openFinding('ctrl-ai-evidence', 'medium', 'Refresh cadence not automated');
  const action = lib.createCorrectiveAction(finding.id, 'owner-compliance', 'Automate evidence refresh', '2026-07-15');
  const cycle = lib.createReviewCycle({ id: 'cycle-test', frameworkId: 'SOC-2', periodStart: '2026-04-01', periodEnd: '2026-06-30', controlIds: ['ctrl-ai-evidence'], status: 'in-review' });
  assert.equal(action.status, 'open');
  assert.ok(cycle.readinessScore > 0);
  assert.equal(lib.readiness().totalControls, 1);
});

test('evidence collection links compliance evidence to immutable audit records and workflow review', () => {
  const lib = new ComplianceControlLibrary('track-1');
  lib.addOwner({ id: 'owner-compliance', displayName: 'Compliance Officer', role: 'compliance-officer', permissions: ['read','collect-evidence','assess'] });
  lib.createControl({ id: 'ctrl-1', frameworkIds: ['ISO-27001'], title: 'Audit logging', description: 'Preserve security audit evidence', status: 'implemented', ownerId: 'owner-compliance', obligationIds: [] }, 'owner-compliance', '2026-06-13T00:00:00.000Z');
  const linked = lib.collectEvidence('ctrl-1', 'owner-compliance', { id: 'ev-1', uri: 'audit://security/event-1', description: 'Security event export', content: { event: 1 } }, '2026-06-13T00:01:00.000Z');
  assert.equal(linked.evidence.recordId, linked.auditRecord.id);
  assert.deepEqual(linked.auditRecord.evidenceIds, ['ev-1']);
  assert.equal(lib.evidenceVault.forRecord(linked.auditRecord.id)[0].id, 'ev-1');
  const workflow = lib.startEvidenceWorkflow('ctrl-1', 'owner-compliance', '2026-06-13T00:02:00.000Z');
  assert.equal(workflow.definitionId, 'compliance-evidence-review');
  assert.ok(lib.control('ctrl-1').workflowInstanceIds.includes(workflow.id));
});

test('owner permissions prevent read-only auditors from collecting evidence or assessing controls', () => {
  const lib = seededComplianceLibrary('track-1');
  assert.throws(() => lib.collectEvidence('ctrl-ai-evidence', 'owner-auditor', { id: 'ev-denied', uri: 'audit://x', description: 'denied', content: {} }), /cannot collect evidence/);
  assert.throws(() => lib.assess('ctrl-ai-evidence', 'owner-auditor', 'effective', 'denied'), /cannot assess controls/);
});
