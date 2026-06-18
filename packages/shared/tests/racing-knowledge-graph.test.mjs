import test from 'node:test';
import assert from 'node:assert/strict';
import { knowledgeGraphEntityKinds, racingKnowledgeGraphExplorationStatement, racingKnowledgeGraphSchemaVersion } from '../dist/index.js';

test('racing knowledge graph schema version is stable', () => {
  assert.equal(racingKnowledgeGraphSchemaVersion, 'trackmind.racing-knowledge-graph.v1');
});

test('racing knowledge graph connects required entity kinds', () => {
  assert.deepEqual(knowledgeGraphEntityKinds, [
    'horse',
    'race',
    'trainer',
    'jockey',
    'incident',
    'approval',
    'audit',
    'facility',
    'recommendation',
    'kpi',
  ]);
});

test('racing knowledge graph exploration remains read-only', () => {
  assert.match(racingKnowledgeGraphExplorationStatement, /read-only/i);
});
