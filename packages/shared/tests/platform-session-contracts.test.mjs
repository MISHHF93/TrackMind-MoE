import test from 'node:test';
import assert from 'node:assert/strict';
import { apiContractSchemas } from '@trackmind/shared';

test('operator session DTO schemas are registered', () => {
  for (const schema of [
    'OperatorProfileDto',
    'OperatorSessionDto',
    'NotificationPreferencesDto',
    'OperatorPreferencesDto',
    'OperatorSessionSummaryDto',
    'PlatformSessionCreateDto',
  ]) {
    assert.ok(apiContractSchemas[schema], `missing schema ${schema}`);
  }
});
