import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertDataEntryTenantScope,
  buildAndVerifyDomainPayload,
  buildDataEntryDomainPayload,
  enrichPayloadWithScope,
  getDataEntrySubmitContract,
  majorDataEntryEntityKinds,
  verifyMajorFormContracts,
  verifyRegistryEnumAlignment,
  validateDataEntryForm,
} from '@trackmind/shared';

const scope = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  actorId: 'admin-operator',
  role: 'admin',
};

const sampleValues = {
  horse: {
    name: 'Contract Runner',
    sex: 'colt',
    breed: 'TB',
    dataSource: 'registry-import',
    reason: 'Registered through governed contract verification',
  },
  'horse-ownership': {
    horseId: 'horse-1',
    ownerId: 'owner-1',
    ownerName: 'Stable LLC',
    effectiveFrom: '2026-06-22',
    percentage: 100,
    dataSource: 'manual-entry',
    reason: 'Ownership update recorded through data entry contract test',
  },
  'trainer-assignment': {
    horseId: 'horse-1',
    trainerId: 'trainer-1',
    trainerName: 'Trainer One',
    effectiveFrom: '2026-06-22',
    licenseStatus: 'active',
    dataSource: 'manual-entry',
    reason: 'Trainer assignment recorded through contract verification',
  },
  'stable-assignment': {
    horseId: 'horse-1',
    barnId: 'barn-3',
    stallId: 'stall-12',
    assignedAt: '2026-06-22T10:00',
    dataSource: 'manual-entry',
    reason: 'Stable assignment recorded through contract verification',
  },
  'race-eligibility': {
    horseId: 'horse-1',
    scratchStatus: 'active',
    hisaCompliance: 'compliant',
    dataSource: 'manual-entry',
    reason: 'Eligibility posture updated through contract verification',
  },
  'transport-record': {
    horseId: 'horse-1',
    from: 'Barn 3',
    to: 'Paddock A',
    departedAt: '2026-06-22T08:00',
    transporter: 'Track Transport Co',
    dataSource: 'manual-entry',
    reason: 'Transport logged through contract verification',
  },
  'workout-record': {
    horseId: 'horse-1',
    date: '2026-06-22',
    trackId: 'main-track',
    distanceFurlongs: 4,
    timeSeconds: 48.2,
    surface: 'dirt',
    dataSource: 'clocker-report',
    reason: 'Workout recorded through contract verification',
  },
  'retirement-record': {
    horseId: 'horse-1',
    retiredAt: '2026-06-22T12:00',
    retirementReason: 'Owner requested retirement after final start',
    destination: 'aftercare-farm',
    dataSource: 'manual-entry',
    confirmRetirement: true,
    reason: 'Retirement recorded through contract verification',
  },
  'veterinary-observation': {
    entryMode: 'quick',
    horseId: 'horse-1',
    observationType: 'lameness',
    observedAt: '2026-06-22T09:00',
    observedBy: 'vet-1',
    observerId: 'vet-1',
    observerRole: 'veterinarian',
    privacyScope: 'veterinary-confidential',
    dataSource: 'vet-system',
    severity: 'medium',
    notes: 'Mild left-front stiffness observed during morning jog.',
    reason: 'Veterinary observation recorded through contract verification',
  },
  'welfare-observation': {
    entryMode: 'quick',
    horseId: 'horse-1',
    observationType: 'behavior',
    observedAt: '2026-06-22T09:00',
    observedBy: 'welfare-1',
    observerId: 'welfare-1',
    role: 'welfare-officer',
    dataSource: 'manual-entry',
    severity: 'low',
    notes: 'Horse calm and alert in stall during walkthrough.',
    reason: 'Welfare observation recorded through contract verification',
  },
  'race-card': {
    raceDayId: 'race-day-1',
    raceDate: '2026-06-22',
    raceNumber: 7,
    scheduledPostTime: '2026-06-22T18:30',
    surface: 'dirt',
    distanceFurlongs: 6,
    classLevel: 'Open',
    basePurse: 50000,
    reason: 'Race card created through contract verification',
  },
  'race-card-conditions': {
    raceCardId: 'race-card-1',
    surface: 'dirt',
    distanceFurlongs: 6,
    reason: 'Race conditions updated through contract verification',
  },
  'race-card-classification': {
    raceCardId: 'race-card-1',
    classLevel: 'Open',
    stakesGrade: 'allowance',
    reason: 'Classification updated through contract verification',
  },
  'race-card-purse': {
    raceCardId: 'race-card-1',
    basePurse: 50000,
    currency: 'USD',
    reason: 'Purse updated through contract verification',
  },
  'race-card-entry': {
    raceCardId: 'race-card-1',
    horseId: 'horse-1',
    trainerId: 'trainer-1',
    ownerId: 'owner-1',
    programNumber: 4,
    reason: 'Entry added through contract verification',
  },
  'race-card-entry-trainer': {
    raceCardId: 'race-card-1',
    entryId: 'entry-1',
    trainerId: 'trainer-2',
    reason: 'Trainer change recorded through contract verification',
  },
  'race-card-post-position': {
    raceCardId: 'race-card-1',
    entryId: 'entry-1',
    postPosition: 3,
    reason: 'Post position assigned through contract verification',
  },
  'race-card-lifecycle': {
    raceCardId: 'race-card-1',
    toStatus: 'review',
    transitionReason: 'Submitting card for steward review before publication.',
    reason: 'Lifecycle transition recorded through contract verification',
  },
  'jockey-assignment': {
    raceCardId: 'race-card-1',
    entryId: 'entry-1',
    jockeyId: 'jockey-1',
    reason: 'Jockey assigned through contract verification',
  },
  'unified-incident': {
    incidentType: 'safety',
    intakeMode: 'triage',
    severity: 'high',
    location: 'Paddock B',
    summary: 'Loose horse near gate during morning training',
    reason: 'Incident intake recorded through contract verification',
  },
  approval: {
    protectedAction: 'starting-gate-move',
    target: 'gate-1',
    reason: 'Gate repositioning requires steward approval before race 7.',
  },
  'approval-request-composer': {
    composeMode: 'quick',
    requestTitle: 'Gate adjustment review',
    sourceDomain: 'race-day-action',
    requestedAction: 'starting-gate-move',
    riskLevel: 'high',
    requestedApproverRole: 'steward',
    reason: 'Pre-race gate alignment verification required before post time',
  },
  'operational-note': {
    entryMode: 'flash',
    subjectKind: 'race-day-log',
    entityId: 'race-7',
    body: 'Gate crew confirmed alignment check complete.',
    reason: 'Operational note recorded through contract verification',
  },
  'security-event-entry': {
    entryMode: 'quick',
    eventType: 'restricted-zone',
    severity: 'high',
    zoneId: 'zone-paddock',
    summary: 'Unauthorized badge presented at backstretch gate',
    reason: 'Security event recorded through contract verification',
  },
  'facilities-inspection': {
    entryMode: 'quick',
    assetId: 'GRANDSTAND_HVAC_01',
    inspectionType: 'routine',
    conditionRating: 85,
    notes: 'Routine walkthrough completed without critical findings.',
    reason: 'Facilities inspection recorded through contract verification',
  },
  'facilities-maintenance': {
    entryMode: 'quick',
    assetId: 'GRANDSTAND_HVAC_01',
    title: 'Filter replacement',
    urgency: 'normal',
    maintenanceOwner: 'admin-operator',
    notes: 'Quarterly HVAC filter replacement scheduled.',
    reason: 'Maintenance entry recorded through contract verification',
  },
  'facilities-incident': {
    title: 'Elevator door fault',
    severity: 'high',
    description: 'Door failed to close on level 2; area cordoned off for triage.',
    reason: 'Facility incident recorded through contract verification',
  },
  'compliance-evidence': {
    entryMode: 'quick',
    title: 'Inspection capture',
    controlId: 'ctrl-security-audit',
    domain: 'security',
    evidenceType: 'screenshot',
    source: 'walkthrough',
    notes: 'Security walkthrough evidence capture for quarterly review',
    reason: 'Compliance evidence recorded through contract verification',
  },
  'kpi-definition': {
    kpiId: 'kpi-gate-readiness',
    warning: 80,
    critical: 60,
    targetDirection: 'above',
    description: 'Gate readiness composite score threshold adjustment',
    reason: 'KPI threshold draft requested through contract verification',
  },
  'audit-note': {
    entityId: 'horse-1',
    entityKind: 'horse',
    note: 'Steward review note captured for contract verification.',
    classification: 'internal',
    reason: 'Audit note recorded through contract verification',
  },
  'administrative-record': {
    recordType: 'tenant',
    displayName: 'Season configuration baseline',
    notes: 'Baseline administrative record for contract verification.',
    reason: 'Administrative record captured through contract verification',
  },
  'federation-metadata': {
    changeType: 'sharing-scope',
    sharingScope: 'federation-aggregate',
    policyId: 'federation-data-sharing-v1',
    approvalRequired: true,
    reason: 'Federation metadata change requested through contract verification',
  },
};

test('major forms align registry governance and enum contracts', () => {
  const result = verifyMajorFormContracts();
  assert.equal(result.valid, true, result.errors.join('; '));
});

test('registry enum options align with shared domain enums', () => {
  for (const entityKind of ['horse', 'approval-request-composer', 'race-card-lifecycle']) {
    const errors = verifyRegistryEnumAlignment(entityKind, 'create');
    assert.deepEqual(errors, [], errors.join('; '));
  }
});

test('shared validation accepts contract sample payloads for major forms', () => {
  for (const entityKind of majorDataEntryEntityKinds) {
    const values = sampleValues[entityKind];
    if (!values) continue;
    const validation = validateDataEntryForm(entityKind, values, { mode: 'create', role: scope.role });
    assert.equal(validation.valid, true, `${entityKind}: ${validation.errors.join('; ')}`);
  }
});

test('domain payload builders satisfy submit contracts', () => {
  for (const entityKind of majorDataEntryEntityKinds) {
    const values = sampleValues[entityKind];
    if (!values) continue;
    const scoped = enrichPayloadWithScope(scope, values);
    const { payload, errors } = buildAndVerifyDomainPayload({
      entityKind,
      mode: 'create',
      values: scoped,
      actorId: scope.actorId,
      role: scope.role,
    });
    assert.deepEqual(errors, [], `${entityKind} payload contract: ${errors.join('; ')}`);
    const tenantCheck = assertDataEntryTenantScope(scope, enrichPayloadWithScope(scope, payload));
    assert.equal(tenantCheck.valid, true, `${entityKind} scope: ${tenantCheck.errors.join('; ')}`);
  }
});

test('race-card-lifecycle payload maps transitionReason to backend reason field', () => {
  const payload = buildDataEntryDomainPayload('race-card-lifecycle', 'create', {
    toStatus: 'review',
    transitionReason: 'Submitting card for steward review before publication.',
    reason: 'Lifecycle transition recorded through contract verification',
  }, { actorId: scope.actorId, role: scope.role });
  assert.equal(payload.toStatus, 'review');
  assert.match(String(payload.reason), /steward review/);
});

test('submit contracts declare response keys for framework mutations', () => {
  for (const entityKind of majorDataEntryEntityKinds) {
    const contract = getDataEntrySubmitContract(entityKind);
    assert.ok(contract.responseKeys.length > 0, `${entityKind} missing response keys`);
    assert.equal(contract.frameworkSubmit, true, `${entityKind} must use framework submit path`);
    if (contract.requiresAuditReason) {
      assert.ok(sampleValues[entityKind]?.reason || entityKind === 'retirement-record');
    }
  }
});
