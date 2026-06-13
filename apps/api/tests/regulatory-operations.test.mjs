import test from 'node:test';
import assert from 'node:assert/strict';
import { RegulatoryOperationsPlatform, regulatoryOperationsBlueprint } from '../dist/index.js';

test('regulatory operations platform manages objections, evidence, rules, AI support, decisions, appeals, and compliance', () => {
  const platform = new RegulatoryOperationsPlatform();
  const opened = platform.openCase({
    id: 'case-1',
    type: 'objection',
    raceId: 'race-7',
    title: 'Stretch interference objection',
    openedBy: 'steward-a',
    openedAt: '2026-06-13T19:00:00Z',
    status: 'opened',
    parties: ['horse-4', 'horse-8', 'jockey-4', 'jockey-8'],
    allegations: ['possible interference in final furlong'],
    tags: ['race-review'],
  });
  assert.equal(opened.status, 'opened');

  platform.transitionCase('case-1', 'investigating', 'steward-a', '2026-06-13T19:01:00Z');
  platform.addEvidence({
    id: 'ev-video-1',
    caseId: 'case-1',
    type: 'video',
    uri: 's3://evidence/race-7/patrol-pan.mp4',
    collectedAt: '2026-06-13T19:02:00Z',
    collectedBy: 'video-operator',
    hash: 'sha256:video',
    relatedTwinIds: ['horse-4', 'horse-8', 'camera-patrol-pan'],
    timecode: { start: '00:01:12.000', end: '00:01:19.000' },
  });
  platform.addEvidence({
    id: 'ev-twin-1',
    caseId: 'case-1',
    type: 'digital-twin',
    uri: 'twin://race-7/replay/final-furlong',
    collectedAt: '2026-06-13T19:03:00Z',
    collectedBy: 'twin-runtime',
    hash: 'sha256:twin',
    relatedTwinIds: ['horse-4', 'horse-8'],
    metadata: { laneDeltaMeters: 0.7 },
  });
  platform.addRule({ id: 'rule-10.2', jurisdiction: 'NY', section: '10.2', title: 'Interference', text: 'A horse may not impede another runner during a race.', effectiveDate: '2026-01-01', relatedConcepts: ['interference', 'objection', 'disqualification'] });
  platform.connectKnowledge({ from: 'horse-4', to: 'horse-8', relationship: 'CONVERGED_PATH_WITH', evidenceIds: ['ev-video-1', 'ev-twin-1'] });

  assert.equal(platform.retrieveRules('interference objection', 'NY')[0].id, 'rule-10.2');
  const support = platform.explainableDecisionSupport({ caseId: 'case-1', question: 'Was there interference?', evidenceIds: ['ev-video-1', 'ev-twin-1'], ruleIds: ['rule-10.2'], twinContextIds: ['horse-4'] });
  assert.equal(support.officialRulingRequiresHumanAuthority, true);
  assert.equal(support.approvedForAutomaticRuling, false);
  assert.equal(support.recommendation, 'human-review-ready');
  assert.ok(support.explanation.some((line) => line.includes('Knowledge graph links: 1')));

  const decision = platform.recordOfficialDecision({ id: 'decision-1', caseId: 'case-1', authority: 'steward', decidedBy: 'chief-steward', decidedAt: '2026-06-13T19:08:00Z', ruling: 'Objection dismissed after video, twin replay, and rule review.', ruleIds: ['rule-10.2'], evidenceIds: ['ev-video-1', 'ev-twin-1'], aiAssistanceId: 'support-1' });
  assert.equal(decision.decidedBy, 'chief-steward');
  assert.equal(platform.caseById('case-1').status, 'decided');

  const appeal = platform.appealPackage('case-1');
  assert.equal(appeal.evidence.length, 2);
  assert.equal(appeal.custody.length, 2);
  assert.equal(appeal.decisions.length, 1);
  assert.ok(appeal.auditTrail.length >= 4);

  const report = platform.complianceReport();
  assert.equal(report.totalCases, 1);
  assert.equal(report.custodyComplete, true);
  assert.equal(report.humanAuthorityPreserved, true);
});

test('regulatory operations blueprint documents steward and commission capabilities', () => {
  const blueprint = regulatoryOperationsBlueprint();
  assert.ok(blueprint.capabilities.includes('appeals'));
  assert.ok(blueprint.integrations.includes('digital-twins'));
  assert.match(blueprint.humanAuthority, /never issues official rulings/);
});
