import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveClient } from '../dist/api/client.js';
import { domainScreens } from '../dist/shell/domains.js';
import { navItems, visibleNavItems } from '../dist/shell/navigation.js';

const standardRoutePattern = /(universal schema|racing operating system|\btus\b|\bros\b|standardization)/i;

test('dashboard route registry covers implemented ROS/TUS standardization surfaces without page-layout assumptions', () => {
  const navById = new Map(navItems.map((item) => [item.id, item]));
  const implementedStandardRoutes = domainScreens.filter((screen) => standardRoutePattern.test(`${screen.id} ${screen.title} ${screen.route}`));

  if (implementedStandardRoutes.length > 0) {
    for (const screen of implementedStandardRoutes) {
      const nav = navById.get(screen.id);
      assert.ok(nav, `${screen.id} standardization route must be in primary navigation`);
      assert.equal(nav.path, screen.route);
      assert.equal(nav.eventReady, true);
      assert.ok(screen.liveApi || screen.mockReason, `${screen.id} must declare live API or mock boundary`);
      assert.ok(screen.eventStreams.length > 0, `${screen.id} must declare event streams`);
    }
    return;
  }

  for (const id of ['assets', 'digital-twin', 'compliance', 'ai-governance', 'platform-health']) {
    const screen = domainScreens.find((candidate) => candidate.id === id);
    const nav = navById.get(id);
    assert.ok(screen, `${id} screen should carry current ROS/TUS surface`);
    assert.ok(nav, `${id} navigation item should carry current ROS/TUS surface`);
    assert.equal(screen.route, nav.path);
    assert.equal(nav.eventReady, true);
    assert.ok(screen.liveApi, `${id} should expose a live API route`);
  }
});

test('standardization dashboard surfaces remain role-aware and avoid restricted one-page assumptions', () => {
  const adminRoutes = visibleNavItems(['admin']).map((item) => item.path);
  const auditorRoutes = visibleNavItems(['read-only-auditor']).map((item) => item.path);

  for (const route of ['/assets', '/digital-twin', '/platform-health']) {
    assert.ok(adminRoutes.includes(route), `admin missing ${route}`);
    assert.ok(auditorRoutes.includes(route), `auditor missing ${route}`);
  }
  assert.ok(adminRoutes.includes('/compliance'));
  assert.equal(auditorRoutes.includes('/ai-governance'), false);
  assert.equal(auditorRoutes.includes('/approvals'), false);
  assert.ok(domainScreens.every((screen) => screen.route.startsWith('/')));
});

test('live client exposes implemented ROS/TUS metadata endpoints through stable API paths', async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return {
      ok: true,
      json: async () => ({
        schemaVersion: 'test',
        evidencePackages: [],
        policy: { executionEndpointsAvailable: false },
      }),
    };
  };

  try {
    const live = createLiveClient('https://api.example.test/api/v1');
    await live.getNexusUpgradePackage?.();
    await live.getComplianceLibrary();
    await live.getAIControlPlaneWorkspace?.();
    await live.getPlatformHealth();
    await live.getFederationWorkspace?.();
    assert.equal(live.executeUniversalArtifact, undefined);
    await live.getUniversalArtifactRegistry?.();
    await live.getUniversalArtifactSchemas?.();
    await live.getUniversalArtifactTrainingInputs?.();
    await live.getUniversalArtifactStorageMap?.();
    await live.requestUniversalArtifactRegistrationDraft?.({ artifact: { artifactId: 'artifact-draft-ui', schemaVersion: 'trackmind.universal-artifact.v1', kind: 'registry-record', name: 'Draft UI artifact', description: 'Draft only', tenantId: 'track-1', racetrackId: 'main-track', uri: 'draft://artifact', contentType: 'application/json', checksum: 'sha256:draft', tags: [], metadata: {}, lineage: { producedBy: 'dashboard-test', upstreamArtifactIds: [], downstreamArtifactIds: [], eventIds: [], digitalTwinRefs: [], correlationId: 'corr-artifact-draft' } }, reason: 'Dashboard route test', requestedBy: 'compliance-officer', evidence: ['test'], approvalPolicy: 'artifact-registration', safetyCritical: true });

    assert.deepEqual(requests, [
      'https://api.example.test/api/v1/platform/nexus-upgrade',
      'https://api.example.test/api/v1/compliance/control-library',
      'https://api.example.test/api/v1/ai-control-plane/workspace',
      'https://api.example.test/api/v1/platform/health',
      'https://api.example.test/api/v1/federation/workspace',
      'https://api.example.test/api/v1/artifacts/registry',
      'https://api.example.test/api/v1/artifacts/schemas',
      'https://api.example.test/api/v1/artifacts/training-inputs',
      'https://api.example.test/api/v1/artifacts/storage-map',
      'https://api.example.test/api/v1/artifacts/registry/draft-registrations',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});
