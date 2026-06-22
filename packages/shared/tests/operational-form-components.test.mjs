import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  approvalRequirementToBoolean,
  normalizeApprovalRequirementValue,
  operationalApprovalRequirementOptions,
  operationalSeverityOptions,
  parseOperationalEvidenceLinks,
  parseOperationalMultiSelectValue,
  resolveOperationalFormComponentKind,
  serializeOperationalEvidenceLinks,
  isCompositeOperationalField,
} from '@trackmind/shared';

test('operational severity and approval options are stable', () => {
  assert.equal(operationalSeverityOptions.length, 4);
  assert.equal(operationalApprovalRequirementOptions.length, 4);
  assert.deepEqual(
    operationalSeverityOptions.map((option) => option.value),
    ['low', 'medium', 'high', 'critical'],
  );
});

test('resolveOperationalFormComponentKind maps canonical field paths', () => {
  assert.equal(
    resolveOperationalFormComponentKind({ path: 'horseId', label: 'Horse', type: 'text' }),
    'entity-relationship',
  );
  assert.equal(
    resolveOperationalFormComponentKind({ path: 'entityId', label: 'Entity', type: 'text' }, { entityKind: 'horse' }),
    'entity-relationship',
  );
  assert.equal(
    resolveOperationalFormComponentKind({ path: 'entityId', label: 'Entity', type: 'text' }),
    'text-input',
  );
  assert.equal(
    resolveOperationalFormComponentKind({ path: 'severity', label: 'Severity', type: 'select' }),
    'severity-picker',
  );
  assert.equal(
    resolveOperationalFormComponentKind({ path: 'approvalRequired', label: 'Approval', type: 'checkbox' }),
    'approval-requirement',
  );
  assert.equal(
    resolveOperationalFormComponentKind({ path: 'notes', label: 'Notes', type: 'textarea' }),
    'notes-editor',
  );
  assert.equal(
    resolveOperationalFormComponentKind({ path: 'evidenceRefs', label: 'Evidence', type: 'textarea' }),
    'attachment-placeholder',
  );
  assert.equal(
    resolveOperationalFormComponentKind({ path: 'linkTargets', label: 'Links', type: 'textarea' }),
    'evidence-link-selector',
  );
  assert.equal(
    resolveOperationalFormComponentKind({ path: 'tenantId', label: 'Tenant', type: 'text' }),
    'tenant-racetrack',
  );
});

test('multi-select and evidence link parsing helpers round-trip', () => {
  assert.deepEqual(parseOperationalMultiSelectValue('a\nb, c'), ['a', 'b', 'c']);
  const links = parseOperationalEvidenceLinks('incident:inc-1:Gate breach\napproval:appr-2');
  assert.equal(links.length, 2);
  assert.equal(links[0]?.targetKind, 'incident');
  assert.equal(links[0]?.targetId, 'inc-1');
  assert.equal(serializeOperationalEvidenceLinks(links), 'incident:inc-1:Gate breach\napproval:appr-2');
});

test('composite operational fields are identified for accessible labeling', () => {
  assert.equal(isCompositeOperationalField({ path: 'severity', label: 'Severity', type: 'select' }), true);
  assert.equal(isCompositeOperationalField({ path: 'title', label: 'Title', type: 'text' }), false);
});

test('approval requirement normalization supports legacy boolean values', () => {
  assert.equal(normalizeApprovalRequirementValue(true), 'required');
  assert.equal(normalizeApprovalRequirementValue(false), 'none');
  assert.equal(approvalRequirementToBoolean('dual-control'), true);
  assert.equal(approvalRequirementToBoolean('none'), false);
});
