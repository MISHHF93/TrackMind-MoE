import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { CommandCenter, loadCommandCenter } from '../dist/App.js';
import { createLiveClient, createMockClient } from '../dist/api/client.js';

function render(node) {
  if (!React.isValidElement(node) || typeof node.type !== 'function') return node;
  return render(node.type(node.props));
}

function textFrom(node) {
  const rendered = render(node);
  if (rendered == null || typeof rendered === 'boolean') return '';
  if (typeof rendered === 'string' || typeof rendered === 'number') return String(rendered);
  if (Array.isArray(rendered)) return rendered.map(textFrom).join(' ');
  if (React.isValidElement(rendered)) return textFrom(rendered.props.children);
  return '';
}

function collect(node, predicate, out = []) {
  const rendered = render(node);
  if (rendered == null || typeof rendered === 'boolean') return out;
  if (Array.isArray(rendered)) {
    rendered.forEach((child) => collect(child, predicate, out));
    return out;
  }
  if (React.isValidElement(rendered)) {
    if (predicate(rendered)) out.push(rendered);
    collect(rendered.props.children, predicate, out);
  }
  return out;
}

test('Digital Twin workspace renders harmonized panels from shared DTOs', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = React.createElement(CommandCenter, { data, roles: ['admin'], authenticated: true, path: '/digital-twin' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);

  for (const required of [
    'Digital Twin workspace shell',
    'Digital Twin track map panel',
    'Digital Twin asset graph and relationship view',
    'Digital Twin dependency view',
    'Digital Twin asset detail drawer',
    'Digital Twin telemetry summary',
    'Digital Twin event history',
    'Digital Twin audit history',
    'Digital Twin simulation placeholders',
    'Digital Twin approval-gated controls',
  ]) {
    assert.ok(labels.includes(required), `missing ${required}`);
  }

  assert.ok(labels.some((label) => String(label).startsWith('Asset detail drawer ')));
  const text = textFrom(tree);
  assert.match(text, /Tenant scope/);
  assert.match(text, /TrackMap below is the single shared map implementation/);
  assert.match(text, /state patch remains backend-owned/i);
  assert.match(text, /SIMULATION PLACEHOLDER - MOCK\/WHAT-IF ONLY/);
  assert.doesNotMatch(text, /PLACEHOLDER drawer/);
});

test('Digital Twin state-changing controls remain disabled and approval-aware', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = React.createElement(CommandCenter, { data, roles: ['admin'], authenticated: true, path: '/digital-twin' });
  const labels = ['Draft Digital Twin patch approval request', 'Run Digital Twin simulation placeholder', 'Execute approved Digital Twin command'];
  const controls = collect(tree, (node) => node.type === 'button' && labels.includes(String(node.props?.['aria-label'] ?? textFrom(node))));

  assert.equal(controls.length, labels.length);
  assert.ok(controls.every((button) => button.props.disabled === true || button.props['aria-disabled'] === true));
  assert.match(textFrom(tree), /frontend can only draft approval-aware backend requests/i);
  assert.match(textFrom(tree), /POST \/api\/v1\/approvals\/draft-requests/);
});

test('Digital Twin route owns its panels without global render bleed', async () => {
  const data = await loadCommandCenter(createMockClient());
  const twinTree = React.createElement(CommandCenter, { data, roles: ['admin'], authenticated: true, path: '/digital-twin' });
  const assetTree = React.createElement(CommandCenter, { data, roles: ['admin'], authenticated: true, path: '/assets' });
  const twinLabels = collect(twinTree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  const assetText = textFrom(assetTree);
  const twinText = textFrom(twinTree);

  assert.equal(twinLabels.filter((label) => label === 'Track map').length, 1);
  assert.equal(twinLabels.filter((label) => label === 'Track map panel').length, 1);
  assert.ok(twinLabels.includes('Digital Twin track map panel'));
  assert.ok(!twinLabels.includes('Track map work area'));
  assert.ok(!twinLabels.includes('Asset and twin foundations'));
  assert.match(twinText, /Active route\s+\/digital-twin/);
  assert.match(twinText, /The TrackMap below is the single shared map implementation/);
  assert.doesNotMatch(assetText, /Digital Twin Workspace/);
  assert.doesNotMatch(assetText, /SIMULATION PLACEHOLDER - MOCK\/WHAT-IF ONLY/);
});

test('Digital Twin history and simulation views stay read-only and traceable', async () => {
  const data = await loadCommandCenter(createMockClient());
  const tree = React.createElement(CommandCenter, { data, roles: ['admin'], authenticated: true, path: '/digital-twin' });
  const labels = collect(tree, (node) => Boolean(node.props?.['aria-label'])).map((node) => node.props['aria-label']);
  const text = textFrom(tree);

  assert.ok(labels.includes('Digital Twin event history'));
  assert.ok(labels.includes('Digital Twin audit history'));
  assert.match(text, /Twin audit link/);
  assert.match(text, /surface sync/);
  assert.match(text, /SIMULATION PLACEHOLDER - MOCK\/WHAT-IF ONLY/);
  assert.match(text, /cannot patch runtime state unless a live backend approval path executes them/i);
});

test('Digital Twin mock/live boundary preserves backend integration contracts', async () => {
  const mockMap = await createMockClient().getTrackMap();
  assert.ok(mockMap.geospatial?.overlays.some((overlay) => overlay.layer === 'simulation'));
  assert.ok(mockMap.geospatial?.simulationOverlays.every((overlay) => overlay.approvalRequired));
  assert.ok(mockMap.geospatial?.digitalTwinState.length >= 1);

  const original = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url) => {
    requested = url;
    return { ok: true, json: async () => [] };
  };
  try {
    await createLiveClient('https://api.example.test/api/v1').listDigitalTwinState();
    assert.equal(requested, 'https://api.example.test/api/v1/digital-twin/state');
  } finally {
    globalThis.fetch = original;
  }
});
