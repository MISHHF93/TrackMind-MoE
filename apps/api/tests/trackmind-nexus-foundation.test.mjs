import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackMindNexusFoundation } from '../dist/index.js';

test('TrackMind Nexus foundation wires assets, events, twins, APIs, approvals, and audit ledger', async () => {
  const nexus = new TrackMindNexusFoundation();
  const principal = { id: 'ops-admin', scopes: ['assets:write','assets:read','assets:approve'], tenantId: 'track-1' };
  assert.equal(await nexus.seedControlRegistry(principal), 3);

  const health = nexus.health();
  assert.equal(health.twins, 3);
  assert.equal(health.dashboards, 7);
  assert.equal(health.auditValid, true);
  assert.ok(health.events >= 3);
  assert.ok(nexus.apiRegistry.discover({ tag: 'nexus' }).length >= 3);
  assert.ok(nexus.eventBus.governanceCatalog().some((event) => event.schemaRef === 'nexus.ai.recommendation.created.v1'));

  const twin = nexus.twins.getTwin('twin:START_GATE_01');
  assert.equal(twin.assetId, 'START_GATE_01');
  assert.ok(twin.approvalRequirements.some((approval) => approval.requiredFor.includes('lock-status')));
  assert.equal(nexus.twins.simulate(twin.twinId, 'gate-battery-drop', { batteryStatus: 95 }).approvalRequired, true);

  const aiDecision = nexus.evaluateAiAction({ activity: 'forecast', requestedAction: 'race-start', actorType: 'ai-agent' });
  assert.equal(aiDecision.allowed, true);
  assert.equal(aiDecision.requiresHumanApproval, true);
  const intentDecision = nexus.evaluateAiAction({ activity: 'create-draft-action', requestedAction: 'start-race', actorType: 'ai-agent' });
  assert.equal(intentDecision.requiresHumanApproval, true);
  assert.equal(intentDecision.protectedAction, 'race-start');

  const request = nexus.requestProtectedExecution({ tenantId: 'track-1', racetrackId: 'track-1', requestedAction: 'race-start', target: 'race-7', requestedBy: 'ai-copilot', actorType: 'ai-agent', reason: 'AI readiness recommendation', evidence: ['readiness-report'] });
  assert.equal(request.status, 'pending');
  assert.throws(() => nexus.approvals.authorizeExecution({ requestId: request.id, action: 'race-start', target: 'race-7', tenantId: 'track-1', racetrackId: 'track-1', actor: { id: 'ai-copilot', roles: ['steward'], human: false } }), /AI agents cannot execute/);

  nexus.approvals.decide(request.id, { id: 'secretary-1', roles: ['racing-secretary'], human: true }, 'approved', 'Race office ready', ['human-approval-record']);
  nexus.approvals.decide(request.id, { id: 'steward-1', roles: ['steward'], human: true }, 'approved', 'Stewards ready', ['human-approval-record']);
  nexus.approvals.decide(request.id, { id: 'vet-1', roles: ['veterinarian'], human: true }, 'approved', 'Veterinary clear', ['human-approval-record']);
  const token = nexus.approvals.authorizeExecution({ requestId: request.id, action: 'race-start', target: 'race-7', tenantId: 'track-1', racetrackId: 'track-1', actor: { id: 'steward-1', roles: ['steward'], human: true } });
  assert.equal(token.action, 'race-start');
  assert.equal(nexus.auditLog.verify().valid, true);
});

test('TrackMind Nexus normalizes protected AI intent verbs before approval policy lookup', () => {
  const nexus = new TrackMindNexusFoundation();
  const scratch = nexus.requestProtectedExecution({ tenantId: 'track-1', racetrackId: 'track-1', requestedAction: 'scratch-horse', target: 'horse-9', requestedBy: 'ai-copilot', actorType: 'ai-agent', reason: 'Draft scratch recommendation', evidence: ['vet-observation'] });
  assert.equal(scratch.action, 'scratch-horse');
  assert.throws(() => nexus.approvals.authorizeExecution({ requestId: scratch.id, action: 'scratch-horse', target: 'horse-9', tenantId: 'track-1', racetrackId: 'track-1', actor: { id: 'ai-copilot', roles: ['steward'], human: false } }), /AI agents cannot execute/);

  const clearFlag = nexus.requestProtectedExecution({ tenantId: 'track-1', racetrackId: 'track-1', requestedAction: 'clear-veterinary-flag', target: 'horse-9', requestedBy: 'vet-workflow', actorType: 'human', reason: 'Clearance request', evidence: ['exam-notes'] });
  assert.equal(clearFlag.action, 'clear-vet-flag');
  nexus.close();
});
