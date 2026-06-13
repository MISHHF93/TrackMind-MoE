import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EnterpriseServiceRegistry,
  EnterpriseApiGateway,
  buildApiContractTests,
  enterpriseApiGatewayBlueprint,
  generateApiDocumentation,
  generateOpenApi,
  generateSdkManifest,
  validateApiGovernance,
} from '../dist/index.js';

const service = {
  id: 'race-ops',
  name: 'Race Operations',
  domain: 'RaceOps',
  version: 'v1',
  basePath: '/api/v1/race-ops',
  description: 'Standardized race operations API',
  owner: { team: 'race-platform', productOwner: 'po@trackmind', technicalOwner: 'tech@trackmind', supportChannel: '#race-platform' },
  lifecycle: 'active',
  auth: ['jwt', 'mtls'],
  tags: ['race-day', 'enterprise-api'],
  slo: { availability: 99.95, latencyMs: 250 },
  rateLimit: { requests: 2, perSeconds: 60 },
  dependencies: [{ serviceId: 'horse-safety', apiId: 'horse-safety', version: 'v1', criticality: 'critical' }],
  endpoints: [
    { path: '/races', method: 'GET', summary: 'List race cards', scopes: ['race:read'], responseSchema: { type: 'array' } },
    { path: '/races/start', method: 'POST', summary: 'Request race start', scopes: ['race:request-start'], requestSchema: { type: 'object' }, responseSchema: { type: 'object' } },
  ],
};

test('enterprise API registry discovers services and tracks lifecycle, ownership, and dependencies', () => {
  const registry = new EnterpriseServiceRegistry();
  registry.register(service);
  assert.equal(registry.discover({ domain: 'RaceOps' }).length, 1);
  assert.equal(registry.discover({ tag: 'enterprise-api' })[0].owner.team, 'race-platform');
  assert.equal(registry.dependencyGraph()[0].to, 'horse-safety');
  assert.equal(registry.ownershipReport()[0].lifecycle, 'active');
  assert.equal(registry.lifecycle('race-ops', 'deprecated').lifecycle, 'deprecated');
});

test('gateway enforces authentication, authorization, versioning, rate limiting, and observability traces', () => {
  const registry = new EnterpriseServiceRegistry();
  registry.register(service);
  const gateway = new EnterpriseApiGateway(registry);
  const base = { serviceId: 'race-ops', path: '/races', method: 'GET', nowEpochMs: 1_000, principal: { id: 'steward-1', scopes: ['race:read'], tenantId: 'trk-1' } };
  const allowed = gateway.route(base);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.headers['x-api-version'], 'v1');
  assert.equal(allowed.trace.observable, true);
  assert.equal(gateway.route({ ...base, path: '/races/start', method: 'POST' }).status, 403);
  assert.equal(gateway.route({ ...base, nowEpochMs: 2_000 }).status, 200);
  assert.equal(gateway.route({ ...base, nowEpochMs: 3_000 }).status, 429);
});

test('OpenAPI, docs, SDK manifests, contract tests, and governance controls are generated consistently', () => {
  assert.equal(validateApiGovernance(service).passed, true);
  const openapi = generateOpenApi(service);
  assert.equal(openapi.openapi, '3.1.0');
  assert.equal(openapi.info['x-owner'].team, 'race-platform');
  assert.ok(generateApiDocumentation(service).includes('GET /api/v1/race-ops/races'));
  assert.equal(generateSdkManifest(service).languages.includes('typescript'), true);
  assert.equal(buildApiContractTests(service)[0].assertions.includes('matches-openapi-schema'), true);
  assert.ok(enterpriseApiGatewayBlueprint().capabilities.includes('sdk-generation'));
});

test('governance rejects unowned, unversioned, or unsecured APIs', () => {
  assert.throws(() => validateApiGovernance({ ...service, auth: [], basePath: '/race-ops' }), /missing-authentication/);
});
