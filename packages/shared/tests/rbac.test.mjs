import test from 'node:test';import assert from 'node:assert/strict';import { hasPermission } from '../dist/index.js';
test('read-only auditor cannot mutate regulated actions',()=>{assert.equal(hasPermission('read-only-auditor','race:finalize-results'),false);assert.equal(hasPermission('read-only-auditor','read:any'),true);});
test('role permissions grant scoped operational access',()=>{assert.equal(hasPermission('veterinarian','vet:clear-flag'),true);assert.equal(hasPermission('finance','security:manage'),false);});
