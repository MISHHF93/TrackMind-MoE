import test from 'node:test';
import assert from 'node:assert/strict';
import { veterinaryPrivacyScopesByRole } from '../dist/index.js';

test('veterinary confidential scope restricted from horse ops and executive', () => {
  assert.ok(!veterinaryPrivacyScopesByRole['horse-operations-coordinator'].includes('veterinary-confidential'));
  assert.ok(!veterinaryPrivacyScopesByRole.executive.includes('veterinary-confidential'));
  assert.ok(veterinaryPrivacyScopesByRole.veterinarian.includes('veterinary-confidential'));
});

test('equine welfare officer has care-team but not full confidential', () => {
  assert.ok(veterinaryPrivacyScopesByRole['equine-welfare-officer'].includes('care-team'));
  assert.ok(!veterinaryPrivacyScopesByRole['equine-welfare-officer'].includes('veterinary-confidential'));
});

test('paddock official has minimal privacy scope', () => {
  assert.deepEqual(veterinaryPrivacyScopesByRole['paddock-official'], ['public', 'racing-officials']);
});
