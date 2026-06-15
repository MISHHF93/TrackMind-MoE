import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const templateRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function readTemplateFile(name) {
  return readFile(resolve(templateRoot, name), 'utf8');
}

test('service template publishes required operational API endpoints', async () => {
  const openapi = await readTemplateFile('openapi.yaml');

  for (const path of ['/health:', '/ready:', '/live:', '/metrics:']) {
    assert.match(openapi, new RegExp(`^  ${path}`, 'm'));
  }
  assert.match(openapi, /^openapi: 3\.1\.0$/m);
});

test('service template catalog preserves governance and approval boundaries', async () => {
  const catalog = await readTemplateFile('service.catalog.yaml');

  assert.match(catalog, /^  tenantIsolation: required$/m);
  for (const requiredBoundary of ['safety-critical-actions', 'regulated-decisions', 'external-side-effects']) {
    assert.match(catalog, new RegExp(`^    - ${requiredBoundary}$`, 'm'));
  }
});
