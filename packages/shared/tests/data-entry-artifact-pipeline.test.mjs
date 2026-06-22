import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertDataEntryPipelineIntegrity,
  buildDataEntryPipelinePlan,
  getDataEntryPipelineProfile,
  mergePipelineIntoMutationResult,
} from '@trackmind/shared';

const scope = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  actorId: 'admin-operator',
  role: 'admin',
  requestId: 'req-pipeline-1',
};

test('every data entry entity has an artifact pipeline profile', () => {
  const kinds = [
    'horse', 'compliance-evidence', 'approval-request-composer', 'kpi-definition', 'unified-incident',
  ] ;
  for (const kind of kinds) {
    const profile = getDataEntryPipelineProfile(kind);
    assert.ok(profile.requiredEmissions.includes('audit'));
    assert.ok(profile.requiredEmissions.includes('lineage'));
    assert.ok(profile.requiredEmissions.includes('operational-artifact'));
  }
});

test('buildDataEntryPipelinePlan requires approval when flagged', () => {
  const plan = buildDataEntryPipelinePlan(
    'facilities-maintenance',
    'create',
    { approvalRequired: true, title: 'HVAC repair', reason: 'Scheduled maintenance batch' },
    scope,
  );
  assert.equal(plan.approvalRequired, true);
  assert.ok(plan.emissions.includes('approval-request'));
});

test('compliance evidence plan links controls and evidence refs', () => {
  const plan = buildDataEntryPipelinePlan(
    'compliance-evidence',
    'create',
    {
      title: 'Walkthrough photo',
      controlId: 'ctrl-1',
      linkTargets: 'incident:inc-1',
      evidenceRefs: 'https://evidence/trackmind/1',
      reason: 'Captured during audit walkthrough',
    },
    scope,
  );
  assert.ok(plan.emissions.includes('compliance-evidence-link'));
  assert.ok(plan.emissions.includes('kpi-source-event'));
  assert.equal(plan.complianceLinks.length, 1);
  assert.equal(plan.evidenceRefs.length, 1);
});

test('mergePipelineIntoMutationResult attaches lineage and artifact refs', () => {
  const pipeline = {
    schemaVersion: 'trackmind.data-entry-artifact-pipeline.v1',
    complete: true,
    bypassBlocked: true,
    emissions: [{ kind: 'domain-event', id: 'event-1', eventId: 'event-1' }],
    lineageRefs: ['audit-1', 'event-1', 'artifact-1'],
    artifactId: 'artifact-1',
    kpiSourceEventIds: ['kpi-1'],
    digitalTwinUpdateIds: [],
    complianceEvidenceLinkIds: [],
  };
  const merged = mergePipelineIntoMutationResult({
    accepted: true,
    auditId: 'audit-1',
    message: 'ok',
  }, pipeline);
  assert.equal(merged.artifactId, 'artifact-1');
  assert.deepEqual(merged.lineageRefs, pipeline.lineageRefs);
  assert.equal(merged.eventId, 'event-1');
  assert.equal(assertDataEntryPipelineIntegrity(
    buildDataEntryPipelinePlan('horse', 'create', { name: 'Star', reason: 'Registry import' }, scope),
    pipeline,
  ).valid, false);
});
