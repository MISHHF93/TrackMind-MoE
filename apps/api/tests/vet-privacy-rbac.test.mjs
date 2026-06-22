import test from 'node:test';
import assert from 'node:assert/strict';
import { EquineIntelligenceService } from '../dist/services/equineIntelligenceService.js';
import { ApexApprovalGateway } from '../dist/services/approvalGateway.js';

test('equine intelligence redacts veterinary notes for unauthorized roles', () => {
  const service = new EquineIntelligenceService(new ApexApprovalGateway());
  const publicView = service.horseProfile('horse-1', ['finance-manager']);
  assert.equal(publicView.privacyFiltered, true);
  assert.match(publicView.veterinaryNotes, /redacted/i);

  const vetView = service.horseProfile('horse-1', ['veterinarian']);
  assert.equal(vetView.privacyFiltered, false);
  assert.doesNotMatch(vetView.veterinaryNotes, /redacted/i);
});

test('equine intelligence honors legacy role aliases via normalization', () => {
  const service = new EquineIntelligenceService(new ApexApprovalGateway());
  const legacyAdmin = service.horseProfile('horse-1', ['admin']);
  assert.equal(legacyAdmin.privacyFiltered, false);
});

test('welfare officer cannot view veterinary-confidential notes', () => {
  const service = new EquineIntelligenceService(new ApexApprovalGateway());
  const welfareView = service.horseProfile('horse-1', ['equine-welfare-officer']);
  assert.equal(welfareView.privacyFiltered, true);
});
