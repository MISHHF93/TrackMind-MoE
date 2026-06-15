import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiFacadeState, EquineIntelligencePrivacyService, handleApiRequest } from '../dist/index.js';

test('horse profile endpoint filters veterinary data by role', async () => {
  const state = createApiFacadeState();
  const vet = await handleApiRequest('GET', '/api/v1/horses/horse-1/profile?role=veterinarian&actorId=vet-1', undefined, state);
  assert.equal(vet.status, 200);
  assert.ok(vet.body.veterinary.examination_records[0].diagnosis.includes('soreness'));
  assert.equal(vet.body.privacy.redactedFields.length, 0);

  const steward = await handleApiRequest('GET', '/api/v1/horses/horse-1/profile?role=steward&actorId=steward-1', undefined, state);
  assert.equal(steward.status, 200);
  assert.equal(steward.body.veterinary, 'redacted');
  assert.ok(steward.body.eligibility.raceRestrictions.includes('steward-review-before-start'));
  assert.equal(steward.body.eligibility.medicationWithdrawalPeriods, undefined);

  const owner = await handleApiRequest('GET', '/api/v1/horses/horse-1/profile?role=owner&actorId=owner-1&ownerId=owner-1', undefined, state);
  assert.equal(owner.status, 200);
  assert.equal(owner.body.veterinary, 'redacted');
  assert.equal(owner.body.welfare.wellnessScores.length, 1);
  assert.equal(owner.body.eligibility, undefined);

  const publicView = await handleApiRequest('GET', '/api/v1/horses/horse-1/profile?role=public', undefined, state);
  assert.equal(publicView.status, 200);
  assert.equal(publicView.body.identity.name, 'Safety First');
  assert.equal(publicView.body.identity.microchip, undefined);
  assert.equal(publicView.body.veterinary, 'redacted');
});

test('trainer and regulator profiles enforce ownership and anonymization boundaries', async () => {
  const state = createApiFacadeState();
  const trainer = await handleApiRequest('GET', '/api/v1/horses/horse-1/profile?role=trainer&actorId=trainer-1&trainerId=trainer-1', undefined, state);
  assert.equal(trainer.status, 200);
  assert.equal(trainer.body.veterinary, 'redacted');
  assert.ok(trainer.body.eligibility.eligibilityFlags.includes('required-exam-notice'));

  const deniedTrainer = await handleApiRequest('GET', '/api/v1/horses/horse-1/profile?role=trainer&actorId=trainer-2&trainerId=trainer-2', undefined, state);
  assert.equal(deniedTrainer.status, 403);
  assert.match(deniedTrainer.body.error.message, /assigned horses/);

  const regulator = await handleApiRequest('GET', '/api/v1/horses/horse-1/profile?role=regulator&actorId=regulator-1', undefined, state);
  assert.equal(regulator.status, 200);
  assert.equal(regulator.body.audit.anonymized, true);
  assert.equal(regulator.body.identity.name, undefined);
});

test('veterinary endpoint requires veterinarian role and approval metadata for controlled medication', async () => {
  const state = createApiFacadeState();
  const denied = await handleApiRequest('POST', '/api/v1/horses/horse-1/veterinary', { role: 'trainer', actorId: 'trainer-1', trainerId: 'trainer-1', recordType: 'examination', summary: 'not allowed' }, state);
  assert.equal(denied.status, 403);
  assert.match(denied.body.error.message, /veterinarian role/);

  const missingApproval = await handleApiRequest('POST', '/api/v1/horses/horse-1/veterinary', { role: 'veterinarian', actorId: 'vet-1', recordType: 'medication', summary: 'controlled medication', medication: 'therapeutic-x', medicationClass: 'controlled', withdrawalUntil: '2026-06-20T00:00:00.000Z' }, state);
  assert.equal(missingApproval.status, 403);
  assert.match(missingApproval.body.error.message, /Controlled medication requires approval/);

  const created = await handleApiRequest('POST', '/api/v1/horses/horse-1/veterinary', { role: 'veterinarian', actorId: 'vet-1', recordType: 'medication', summary: 'controlled medication with approval', medication: 'therapeutic-x', medicationClass: 'controlled', withdrawalUntil: '2026-06-20T00:00:00.000Z', approvalId: 'approval-med-controlled-1' }, state);
  assert.equal(created.status, 201);
  assert.equal(created.body.record.approvalId, 'approval-med-controlled-1');
  assert.ok(created.body.eligibility.failedRules.some((rule) => rule.includes('withdrawal:therapeutic-x')));
});

test('eligibility endpoint requires steward approval metadata and writes immutable audit chain', async () => {
  const state = createApiFacadeState();
  const denied = await handleApiRequest('POST', '/api/v1/horses/horse-1/eligibility', { role: 'veterinarian', actorId: 'vet-1', hisaCompliance: 'compliant' }, state);
  assert.equal(denied.status, 403);
  assert.match(denied.body.error.message, /steward role/);

  const missingApproval = await handleApiRequest('POST', '/api/v1/horses/horse-1/eligibility', { role: 'steward', actorId: 'steward-1', hisaCompliance: 'compliant' }, state);
  assert.equal(missingApproval.status, 403);
  assert.match(missingApproval.body.error.message, /steward approval metadata/);

  const updated = await handleApiRequest('POST', '/api/v1/horses/horse-1/eligibility', { role: 'steward', actorId: 'steward-1', hisaCompliance: 'compliant', scratchStatus: 'scratched', approvalId: 'approval-eligibility-1', approverId: 'chief-steward', approvalTimestamp: '2026-06-14T18:00:00.000Z' }, state);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.eligibility.approvalId, 'approval-eligibility-1');
  assert.ok(updated.body.eligibility.eligibilityFlags.includes('scratch-status'));

  const audit = await handleApiRequest('GET', '/api/v1/horses/horse-1/audit', undefined, state);
  assert.equal(audit.status, 200);
  assert.equal(audit.body.verification.valid, true);
  assert.ok(audit.body.events.some((event) => event.type === 'equine.eligibility.updated'));
});

test('equine service direct audit chain verifies profile reads and writes', () => {
  const service = new EquineIntelligencePrivacyService();
  service.profile('horse-1', { role: 'public', actorId: 'public' });
  service.addVeterinaryRecord('horse-1', { recordType: 'examination', summary: 'Follow-up exam', diagnosis: 'No acute finding' }, { role: 'veterinarian', actorId: 'vet-1' });
  const audit = service.auditChain('horse-1');
  assert.equal(audit.verification.valid, true);
  assert.equal(audit.events[0].previousHash, 'genesis');
  assert.ok(audit.events.at(-1).hash.startsWith('sha256:'));
});
