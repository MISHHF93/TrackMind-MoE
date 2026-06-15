import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { RaceDayCommandDashboard, createRaceDayCommandFixture } from '../dist/domains/race-day-command/RaceDayCommandDashboard.js';
import { raceDayRealtimeSources, useApprovalNotifications, useAzureSignalRSync, useRaceStateWebSocket } from '../dist/domains/race-day-command/realtime.js';

const h = React.createElement;

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
  if (Array.isArray(rendered)) { rendered.forEach((child) => collect(child, predicate, out)); return out; }
  if (React.isValidElement(rendered)) {
    if (predicate(rendered)) out.push(rendered);
    collect(rendered.props.children, predicate, out);
  }
  return out;
}

test('race-day command dashboard renders all required views with accessible landmarks', () => {
  const tree = h(RaceDayCommandDashboard, {
    data: createRaceDayCommandFixture(),
    raceState: { connection: 'connected', url: '/api/v1/live', warnings: [] },
    signalR: { connection: 'connected', hubUrl: '/api/v1/live/signalr', deviceCount: 3, warnings: [] },
    approvalEvents: [{ id: 'evt-approval-1', timestamp: '2026-06-14T18:00:15.000Z', type: 'approval.requested', summary: 'Race start approval requested.', severity: 'warning', source: 'sse' }],
  });

  assert.match(textFrom(tree), /Race-Day Command/);
  assert.match(textFrom(tree), /Race Control View/);
  assert.match(textFrom(tree), /Approval Panel/);
  assert.match(textFrom(tree), /Stewarding View/);
  assert.match(textFrom(tree), /Security View/);
  assert.match(textFrom(tree), /Equine View/);
  assert.match(textFrom(tree), /WebSocket race state:\s*connected\s*at\s*\/api\/v1\/live/);
  assert.match(textFrom(tree), /Azure SignalR multi-device sync:\s*connected.*devices\s*3/);

  const views = collect(tree, (node) => node.props?.['data-view']).map((node) => node.props['data-view']);
  assert.deepEqual(views, ['race-control', 'approval-panel', 'stewarding', 'security', 'equine']);
  assert.equal(collect(tree, (node) => node.props?.['aria-label'] === 'Race-day command dashboard').length, 1);
  assert.equal(collect(tree, (node) => node.props?.['aria-label'] === 'Zone occupancy heatmap').length, 1);
  assert.equal(collect(tree, (node) => node.props?.['aria-label'] === 'Credential validation').length, 1);
});

test('approval panel shows AI recommendation, evidence, decision buttons, and timer', () => {
  const decisions = [];
  const tree = h(RaceDayCommandDashboard, {
    data: createRaceDayCommandFixture(),
    onApprovalDecision: (approvalId, decision) => decisions.push([approvalId, decision]),
  });

  assert.match(textFrom(tree), /Start Race 7 only after steward and veterinarian/);
  assert.match(textFrom(tree), /HIGH\s*91\s*%/);
  assert.match(textFrom(tree), /surface moisture 27%/);
  assert.match(textFrom(tree), /ARCI 004-105 race start authority/);
  assert.match(textFrom(tree), /Race 4 delayed after similar far-turn moisture pattern/);
  assert.match(textFrom(tree), /2\s*minutes remaining/);

  const timer = collect(tree, (node) => node.props?.role === 'timer')[0];
  assert.equal(timer.props['aria-live'], 'assertive');

  const buttons = collect(tree, (node) => node.type === 'button' && ['Approve', 'Reject', 'Request More Info'].includes(textFrom(node)));
  assert.ok(buttons.length >= 6);
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  buttons[2].props.onClick();
  assert.deepEqual(decisions, [
    ['approval-race-start-7', 'approve'],
    ['approval-race-start-7', 'reject'],
    ['approval-race-start-7', 'more-info'],
  ]);
});

test('equine veterinary records are role-filtered while eligibility remains visible', () => {
  const auditor = h(RaceDayCommandDashboard, { roles: ['read-only-auditor'] });
  assert.match(textFrom(auditor), /redacted for veterinary privacy/);
  assert.doesNotMatch(textFrom(auditor), /mild left fore soreness/);
  assert.match(textFrom(auditor), /Eligibility status under-review/);

  const vet = h(RaceDayCommandDashboard, { roles: ['veterinarian'] });
  assert.match(textFrom(vet), /Private vet note: mild left fore soreness/);
});

test('stewarding and security views expose query, incident review, heatmap, camera, and credential controls', () => {
  const tree = h(RaceDayCommandDashboard);
  assert.equal(collect(tree, (node) => node.props?.role === 'search' && node.props?.['aria-label'] === 'Rulebook RAG query interface').length, 1);
  assert.match(textFrom(tree), /Credential mismatch at paddock gate under review/);
  assert.match(textFrom(tree), /Paddock.*18\s*\/\s*20/);
  assert.match(textFrom(tree), /Paddock Gate 2\s*camera feed.*Privacy masking\s*enabled/);
  assert.equal(collect(tree, (node) => node.props?.['data-camera-health'] === 'degraded').length, 1);
});

test('race-day realtime hooks publish required transport endpoints', () => {
  assert.equal(raceDayRealtimeSources.raceStateWebSocket, '/api/v1/live');
  assert.equal(raceDayRealtimeSources.approvalNotificationsSse, '/api/v1/approvals/notifications');
  assert.equal(raceDayRealtimeSources.azureSignalRHub, '/api/v1/live/signalr');
  assert.equal(typeof useRaceStateWebSocket, 'function');
  assert.equal(typeof useApprovalNotifications, 'function');
  assert.equal(typeof useAzureSignalRSync, 'function');
});
