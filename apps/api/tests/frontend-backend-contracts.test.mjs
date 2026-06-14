import test from 'node:test';
import assert from 'node:assert/strict';
import { apiContractSchemas, apiEndpointContracts, validateContract } from '@trackmind/shared';
import { TrackMindCommandCenterV1Service, createCommandCenterContractSnapshot } from '../dist/index.js';

const assertValid = (name, value) => {
  const result = validateContract(name, value, apiContractSchemas[name]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
};

test('frontend and backend share schemas for assets, races, approvals, audit events, twins, surface measurements, gate controls, and AI recommendations', () => {
  const service = new TrackMindCommandCenterV1Service();
  const request = service.createGateMoveDraft({ tenantId: 'track-1', targetSectorId: 'chute', targetMetersFromStart: 120, requestedBy: 'secretary-1', reason: 'Contract test draft', evidence: ['human-approval-record'] });
  assert.equal(request.status, 'pending');

  const contract = createCommandCenterContractSnapshot(service);
  assert.ok(contract.assets.length > 0);
  assert.ok(contract.races.length > 0);
  assert.ok(contract.approvals.length > 0);
  assert.ok(contract.auditEvents.length > 0);
  assert.ok(contract.digitalTwinState.length > 0);
  assert.ok(contract.surfaceMeasurements.length > 0);
  assert.ok(contract.aiRecommendations.length > 0);

  for (const asset of contract.assets) assertValid('AssetMarkerDto', asset);
  for (const race of contract.races) assertValid('RaceDto', race);
  for (const approval of contract.approvals) assertValid('ApprovalDto', approval);
  for (const event of contract.auditEvents) assertValid('AuditEventDto', event);
  for (const twin of contract.digitalTwinState) assertValid('DigitalTwinStateDto', twin);
  for (const measurement of contract.surfaceMeasurements) assertValid('SurfaceMeasurementDto', measurement);
  for (const recommendation of contract.aiRecommendations) assertValid('AIRecommendationDto', recommendation);
  assertValid('GatePositionDto', contract.gatePosition);
  assertValid('RaceDistanceConfigurationDto', contract.raceDistanceConfiguration);
});

test('contract metadata covers authorization, audit records, event emissions, and consistent errors', () => {
  const byOperation = new Map(apiEndpointContracts.map((endpoint) => [endpoint.operationId, endpoint]));
  for (const op of ['listAssets','listRaces','listApprovals','listAuditEvents','listDigitalTwinState','listSurfaceMeasurements','getGatePosition','createDraftRequest','listAIRecommendations']) {
    assert.ok(byOperation.has(op), `${op} must have OpenAPI metadata`);
    assert.ok(byOperation.get(op).audits.length > 0, `${op} must declare audit metadata`);
  }
  assert.deepEqual(byOperation.get('listAuditEvents').roles, ['compliance-officer','read-only-auditor','admin']);
  assert.deepEqual(byOperation.get('createDraftRequest').emits, ['approval.requested']);
  assert.deepEqual(createCommandCenterContractSnapshot().errors.notAuthorized, { ok: false, error: { code: 'forbidden', message: 'Actor is not authorized for this TrackMind API operation' } });
});

test('contract validation catches frontend/backend DTO drift before release', () => {
  const missingAuditLink = { sectorId: 'far-turn', moisture: 27, compaction: 276, measuredAt: '2026-06-13T00:00:00.000Z', eventId: 'evt-surface' };
  const result = validateContract('SurfaceMeasurementDto', missingAuditLink, apiContractSchemas.SurfaceMeasurementDto);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('auditId is required')));
});
