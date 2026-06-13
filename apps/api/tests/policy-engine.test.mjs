import test from 'node:test';
import assert from 'node:assert/strict';
import { EnterpriseRulesPolicyEngine } from '../dist/index.js';

const engineWithRules = () => {
  const engine = new EnterpriseRulesPolicyEngine();
  engine.publishRule({
    id: 'base-emergency-protocol',
    name: 'Base emergency protocol',
    domain: 'emergency',
    priority: 100,
    effect: 'require-action',
    conditions: [{ field: 'incidentType', operator: 'exists' }],
    actions: ['notify-incident-command'],
    regulatoryRefs: ['NIMS', 'state-emergency-plan'],
    integrations: [{ target: 'workflow', endpoint: 'workflows/emergency-command', event: 'EmergencyProtocolMatched' }],
    rollout: 'active',
  }, 'compliance-admin', 'baseline emergency protocol');
  engine.publishRule({
    id: 'lightning-race-stop',
    name: 'Lightning race stop protocol',
    domain: 'racing',
    priority: 100,
    effect: 'deny',
    conditions: [{ field: 'lightningDistanceMiles', operator: 'less-than', value: 8 }],
    actions: ['race-start', 'race-continue'],
    regulatoryRefs: ['state-racing-commission-weather'],
    approvalRequirements: [{ role: 'steward', count: 1, protectedAction: 'race-stop' }],
    inheritsFrom: 'base-emergency-protocol',
    integrations: [
      { target: 'digital-twin', endpoint: 'twins/race-day', event: 'RaceStopRequired' },
      { target: 'operational-service', endpoint: 'ops/alerts', event: 'LightningHold' },
    ],
    rollout: 'active',
  }, 'steward-admin', 'add lightning safety rule');
  return engine;
};

test('enterprise policy engine versions and inherits emergency racing rules', () => {
  const engine = engineWithRules();
  const version2 = engine.publishRule({
    id: 'lightning-race-stop',
    name: 'Lightning race stop protocol',
    domain: 'racing',
    priority: 100,
    effect: 'deny',
    conditions: [{ field: 'lightningDistanceMiles', operator: 'less-than', value: 10 }],
    actions: ['race-start', 'race-continue'],
    regulatoryRefs: ['state-racing-commission-weather'],
    inheritsFrom: 'base-emergency-protocol',
    rollout: 'active',
  }, 'steward-admin', 'expand safety radius');
  assert.equal(version2.version, 2);
  assert.ok(version2.actions.includes('notify-incident-command'));
  assert.equal(engine.history('lightning-race-stop').length, 2);
});

test('policy evaluations centralize guardrails, approvals, integrations, simulations, and tests', () => {
  const engine = engineWithRules();
  const decision = engine.evaluate({ subjectId: 'race-5', action: 'race-start', attributes: { incidentType: 'weather', lightningDistanceMiles: 5 } });
  assert.equal(decision.allowed, false);
  assert.ok(decision.effects.includes('deny'));
  assert.ok(decision.requiredApprovals.some((approval) => approval.role === 'steward'));
  assert.ok(decision.integrations.some((integration) => integration.target === 'digital-twin'));
  const simulated = engine.simulate([{ subjectId: 'race-6', action: 'race-start', attributes: { incidentType: 'drill', lightningDistanceMiles: 4 } }]);
  assert.equal(simulated[0].matchedRules.length, 2);
  assert.equal(engine.testRule({ name: 'blocks close lightning', context: { subjectId: 'race-7', action: 'race-start', attributes: { incidentType: 'weather', lightningDistanceMiles: 2 } }, expectedEffects: ['deny'], expectedAllowed: false }).passed, true);
});

test('policy engine detects conflicts and supports approval workflow records', () => {
  const engine = engineWithRules();
  engine.publishRule({ id: 'conflicting-race-start', name: 'Conflicting race start', domain: 'business', priority: 100, effect: 'allow', conditions: [{ field: 'lightningDistanceMiles', operator: 'less-than', value: 8 }], actions: ['race-start'], regulatoryRefs: [], rollout: 'active' }, 'ops-admin', 'intentional conflict');
  const conflicts = engine.evaluate({ subjectId: 'race-8', action: 'race-start', attributes: { incidentType: 'weather', lightningDistanceMiles: 3 } }).conflicts;
  assert.equal(conflicts[0].severity, 'critical');
  const request = engine.createApprovalRequest('lightning-race-stop', 'policy-owner', ['simulation://lightning']);
  assert.equal(request.status, 'pending');
  assert.equal(engine.approve(request.id, 'chief-steward').status, 'approved');
});
