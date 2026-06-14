import test from 'node:test';
import assert from 'node:assert/strict';
import { apiContractSchemas, validateContract } from '@trackmind/shared';
import { certifiedTrackRequirementIds, createApiFacadeState, handleApiRequest } from '../dist/index.js';

test('TrackMind Certified Track candidate exposes complete Tier 8 franchise criteria and scorecard', () => {
  const candidate = createApiFacadeState().trackCertification;
  assert.deepEqual(candidate.certificationCriteria.map((criterion) => criterion.id), certifiedTrackRequirementIds);
  assert.equal(candidate.tier, 8);
  assert.equal(candidate.model, 'franchise');
  assert.equal(candidate.certificationLabel, 'TrackMind Certified Track');
  assert.equal(candidate.externalCertificationClaimed, false);
  assert.match(candidate.claimBoundary, /no external certification/i);
  assert.deepEqual(validateContract('TrackCertificationCandidateDto', candidate, apiContractSchemas.TrackCertificationCandidateDto), { valid: true, errors: [] });

  for (const field of ['safetyScore', 'complianceScore', 'operationalScore', 'accreditationScore']) {
    assert.equal(typeof candidate.scorecard[field], 'number', `${field} must be numeric`);
    assert.ok(candidate.scorecard[field] >= 0 && candidate.scorecard[field] <= 100, `${field} must be 0-100`);
  }
});

test('TrackMind Certified Track candidate links evidence, controls, and required safety AI audit twin controls', async () => {
  const state = createApiFacadeState();
  const candidate = state.trackCertification;
  const criteriaById = new Map(candidate.certificationCriteria.map((criterion) => [criterion.id, criterion]));

  for (const requirementId of certifiedTrackRequirementIds) {
    const criterion = criteriaById.get(requirementId);
    assert.ok(criterion, `${requirementId} missing`);
    assert.ok(criterion.requiredControlRefs.length > 0, `${requirementId} missing control refs`);
    assert.ok(criterion.requiredEvidenceRefs.length > 0, `${requirementId} missing evidence refs`);
  }

  assert.ok(criteriaById.get('safety-controls-active').requiredControlRefs.some((id) => /safety|risk/.test(id)));
  assert.ok(criteriaById.get('ai-governance-active').requiredEvidenceRefs.some((ref) => ref.kind === 'ai-governance'));
  assert.ok(criteriaById.get('audit-ledger-active').requiredEvidenceRefs.some((ref) => ref.kind === 'audit'));
  assert.ok(criteriaById.get('digital-twin-active').requiredEvidenceRefs.some((ref) => ref.kind === 'digital-twin'));
  assert.ok(candidate.operatingStandards.some((standard) => standard.category === 'safety' && standard.required));
  assert.ok(candidate.operatingStandards.some((standard) => standard.category === 'ai-governance' && standard.required));
  assert.ok(candidate.accreditationReadiness.evidencePackageIds.length > 0);

  const response = await handleApiRequest('GET', '/api/v1/compliance/track-certification-candidate', undefined, state);
  assert.equal(response.status, 200);
  assert.equal(response.body.certificationLabel, 'TrackMind Certified Track');
  assert.equal(response.body.externalCertificationClaimed, false);
});
