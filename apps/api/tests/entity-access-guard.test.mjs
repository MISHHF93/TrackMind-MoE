import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EntityAccessDeniedError,
  assertEntityAccess,
} from '../dist/platform/entityAccessGuard.js';

test('finance manager can create financial records', () => {
  assert.doesNotThrow(() => assertEntityAccess('finance-manager', 'financial', 'create'));
});

test('paddock official cannot view financial records', () => {
  assert.throws(
    () => assertEntityAccess('paddock-official', 'financial', 'view'),
    EntityAccessDeniedError,
  );
});

test('veterinarian can view veterinary domain', () => {
  assert.doesNotThrow(() => assertEntityAccess('veterinarian', 'veterinary', 'view'));
});

test('ticketing manager cannot view veterinary domain', () => {
  assert.throws(
    () => assertEntityAccess('ticketing-fan-manager', 'veterinary', 'view'),
    EntityAccessDeniedError,
  );
});
