import type { Role } from './accessControl.js';
import { approvalSourceDomains, parseSupportingEvidence } from './approvalRequestComposer.js';
import type { DataEntryEntityKind, DataEntryFormDefinition, DataEntryFormMode } from './dataEntryFramework.js';
import {
  dataEntryEntityForms,
  getDataEntryFormDefinition,
  assertDataEntryTenantScope,
} from './dataEntryFramework.js';
import { buildDataEntryDomainPayload } from './dataEntryDomainPayloads.js';
import { horseDataSourceOptions } from './horseDataEntry.js';
import { raceCardLifecycleTransitions } from './raceCardManagement.js';

export const dataEntrySubmitContractsSchemaVersion = 'trackmind.data-entry-submit-contracts.v1' as const;

export const DATA_ENTRY_SCOPE_KEYS = ['tenantId', 'racetrackId', 'actorId'] as const;
export const DATA_ENTRY_AUDIT_REASON_KEY = 'reason' as const;

export const majorDataEntryEntityKinds = [
  'horse',
  'horse-ownership',
  'trainer-assignment',
  'stable-assignment',
  'race-eligibility',
  'transport-record',
  'workout-record',
  'retirement-record',
  'veterinary-observation',
  'welfare-observation',
  'race-card',
  'race-card-conditions',
  'race-card-classification',
  'race-card-purse',
  'race-card-entry',
  'race-card-entry-trainer',
  'race-card-post-position',
  'race-card-lifecycle',
  'jockey-assignment',
  'unified-incident',
  'approval',
  'approval-request-composer',
  'operational-note',
  'security-event-entry',
  'facilities-inspection',
  'facilities-maintenance',
  'facilities-incident',
  'compliance-evidence',
  'kpi-definition',
  'audit-note',
  'administrative-record',
  'federation-metadata',
] as const satisfies readonly DataEntryEntityKind[];

export type MajorDataEntryEntityKind = (typeof majorDataEntryEntityKinds)[number];

export interface DataEntrySubmitContract {
  entityKind: DataEntryEntityKind;
  requiredDomainKeys: readonly string[];
  responseKeys: readonly string[];
  requiresAuditReason: boolean;
  frameworkSubmit: boolean;
}

const MUTATION_RESPONSE_KEYS = ['accepted', 'auditId', 'message'] as const;
const RACE_CARD_RESPONSE_KEYS = ['accepted', 'raceCardId', 'auditId', 'lifecycleStatus', 'message'] as const;
const APPROVAL_COMPOSER_RESPONSE_KEYS = ['accepted', 'approvalId', 'approvalRequestId', 'message'] as const;

const submitContracts: Record<DataEntryEntityKind, DataEntrySubmitContract> = {
  horse: { entityKind: 'horse', requiredDomainKeys: ['name', 'dataSource', 'reason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'horse-ownership': { entityKind: 'horse-ownership', requiredDomainKeys: ['horseId', 'ownerId', 'reason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'trainer-assignment': { entityKind: 'trainer-assignment', requiredDomainKeys: ['horseId', 'trainer', 'reason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'stable-assignment': { entityKind: 'stable-assignment', requiredDomainKeys: ['horseId', 'barnId', 'reason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'race-eligibility': { entityKind: 'race-eligibility', requiredDomainKeys: ['horseId', 'reason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'transport-record': { entityKind: 'transport-record', requiredDomainKeys: ['horseId', 'from', 'to', 'reason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'workout-record': { entityKind: 'workout-record', requiredDomainKeys: ['horseId', 'date', 'reason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'retirement-record': { entityKind: 'retirement-record', requiredDomainKeys: ['horseId', 'retiredAt', 'auditReason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'veterinary-observation': { entityKind: 'veterinary-observation', requiredDomainKeys: ['horseId', 'observationType', 'reason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'welfare-observation': { entityKind: 'welfare-observation', requiredDomainKeys: ['horseId', 'observationType', 'reason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  race: { entityKind: 'race', requiredDomainKeys: ['reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'race-card': { entityKind: 'race-card', requiredDomainKeys: ['raceDayId', 'conditions', 'classification', 'purse', 'reason'], responseKeys: RACE_CARD_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'race-card-conditions': { entityKind: 'race-card-conditions', requiredDomainKeys: ['conditions', 'reason'], responseKeys: RACE_CARD_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'race-card-classification': { entityKind: 'race-card-classification', requiredDomainKeys: ['classification', 'reason'], responseKeys: RACE_CARD_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'race-card-purse': { entityKind: 'race-card-purse', requiredDomainKeys: ['purse', 'reason'], responseKeys: RACE_CARD_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'race-card-entry': { entityKind: 'race-card-entry', requiredDomainKeys: ['horseId', 'trainerId', 'reason'], responseKeys: RACE_CARD_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'race-card-entry-trainer': { entityKind: 'race-card-entry-trainer', requiredDomainKeys: ['trainerId', 'reason'], responseKeys: RACE_CARD_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'race-card-post-position': { entityKind: 'race-card-post-position', requiredDomainKeys: ['postPosition', 'reason'], responseKeys: RACE_CARD_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'race-card-lifecycle': { entityKind: 'race-card-lifecycle', requiredDomainKeys: ['toStatus', 'reason'], responseKeys: RACE_CARD_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'jockey-assignment': { entityKind: 'jockey-assignment', requiredDomainKeys: ['jockeyId', 'reason'], responseKeys: RACE_CARD_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'unified-incident': { entityKind: 'unified-incident', requiredDomainKeys: ['incidentType', 'severity', 'location', 'summary', 'reason'], responseKeys: ['accepted', 'incidentId', 'auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  incident: { entityKind: 'incident', requiredDomainKeys: ['title', 'severity', 'description', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'security-incident': { entityKind: 'security-incident', requiredDomainKeys: ['title', 'severity', 'description', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  approval: { entityKind: 'approval', requiredDomainKeys: ['action', 'target', 'reason'], responseKeys: ['approvalId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'approval-request-composer': { entityKind: 'approval-request-composer', requiredDomainKeys: ['requestTitle', 'sourceDomain', 'requestedAction', 'reason', 'actorType', 'roles'], responseKeys: APPROVAL_COMPOSER_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'audit-note': { entityKind: 'audit-note', requiredDomainKeys: ['entityId', 'entityKind', 'note', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'operational-note': { entityKind: 'operational-note', requiredDomainKeys: ['subjectKind', 'entityId', 'body', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'paddock-record': { entityKind: 'paddock-record', requiredDomainKeys: ['horseId', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'security-event-entry': { entityKind: 'security-event-entry', requiredDomainKeys: ['eventType', 'summary', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'facilities-inspection': { entityKind: 'facilities-inspection', requiredDomainKeys: ['assetId', 'inspectionType', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'facilities-maintenance': { entityKind: 'facilities-maintenance', requiredDomainKeys: ['assetId', 'title', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'facilities-incident': { entityKind: 'facilities-incident', requiredDomainKeys: ['title', 'severity', 'description', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'compliance-evidence': { entityKind: 'compliance-evidence', requiredDomainKeys: ['title', 'controlId', 'notes', 'reason'], responseKeys: ['auditId', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'kpi-definition': { entityKind: 'kpi-definition', requiredDomainKeys: ['kpiId', 'description', 'reason'], responseKeys: ['approvalRequired', 'message'], requiresAuditReason: true, frameworkSubmit: true },
  'administrative-record': { entityKind: 'administrative-record', requiredDomainKeys: ['recordType', 'displayName', 'summary', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
  'federation-metadata': { entityKind: 'federation-metadata', requiredDomainKeys: ['changeType', 'sharingScope', 'policyId', 'reason'], responseKeys: MUTATION_RESPONSE_KEYS, requiresAuditReason: true, frameworkSubmit: true },
};

export function getDataEntrySubmitContract(entityKind: DataEntryEntityKind): DataEntrySubmitContract {
  return submitContracts[entityKind];
}

function fieldOptionValues(definition: DataEntryFormDefinition, path: string): string[] {
  const field = definition.fields.find((entry) => entry.path === path);
  return field?.options?.map((option) => option.value) ?? [];
}

export function verifyRegistryEnumAlignment(entityKind: DataEntryEntityKind, mode: DataEntryFormMode = 'create'): string[] {
  const errors: string[] = [];
  const definition = getDataEntryFormDefinition(entityKind, mode);

  if (entityKind === 'horse' || entityKind === 'horse-ownership' || entityKind === 'race-eligibility' || entityKind === 'transport-record' || entityKind === 'workout-record') {
    const registryValues = fieldOptionValues(definition, 'dataSource');
    const sharedValues = horseDataSourceOptions.map((option) => option.value);
    for (const value of registryValues) {
      if (!sharedValues.includes(value as typeof sharedValues[number])) {
        errors.push(`${entityKind}.dataSource option ${value} missing from horseDataSourceOptions`);
      }
    }
  }

  if (entityKind === 'approval-request-composer') {
    const registryValues = fieldOptionValues(definition, 'sourceDomain');
    const sharedValues = approvalSourceDomains.map((entry) => entry.domain);
    if (registryValues.join(',') !== sharedValues.join(',')) {
      errors.push('approval-request-composer.sourceDomain options drift from approvalSourceDomains');
    }
  }

  if (entityKind === 'race-card-lifecycle') {
    const registryValues = fieldOptionValues(definition, 'toStatus');
    const transitionTargets = [...new Set(raceCardLifecycleTransitions.map((transition) => transition.to))];
    for (const value of registryValues) {
      if (!transitionTargets.includes(value as typeof transitionTargets[number])) {
        errors.push(`race-card-lifecycle.toStatus option ${value} is not a lifecycle transition target`);
      }
    }
  }

  return errors;
}

export function verifyFormGovernanceContract(entityKind: DataEntryEntityKind, mode: DataEntryFormMode = 'create'): string[] {
  const errors: string[] = [];
  const definition = getDataEntryFormDefinition(entityKind, mode);
  if (!definition.auditAction) errors.push(`${entityKind} missing auditAction`);
  if (!definition.requiredPermission) errors.push(`${entityKind} missing requiredPermission`);
  if (!definition.allowedRoles?.length) errors.push(`${entityKind} missing allowedRoles`);
  if (!definition.submit?.createPath && mode === 'create') errors.push(`${entityKind} missing submit.createPath`);
  return errors;
}

export function verifyDomainPayloadContract(
  entityKind: DataEntryEntityKind,
  payload: Record<string, unknown>,
): string[] {
  const contract = getDataEntrySubmitContract(entityKind);
  const errors: string[] = [];

  for (const key of contract.requiredDomainKeys) {
    if (key === 'action' && payload.action === undefined && payload.protectedAction !== undefined) continue;
    if (payload[key] === undefined || payload[key] === '') {
      errors.push(`domain payload missing required key ${key}`);
    }
  }

  if (contract.requiresAuditReason) {
    const reason = payload.reason ?? payload.auditReason;
    if (reason === undefined || String(reason).trim() === '') {
      errors.push('domain payload missing audit reason');
    }
  }

  return errors;
}

export function verifyScopedPayload(
  scope: { tenantId: string; racetrackId: string; actorId: string; role: Role },
  payload: Record<string, unknown>,
): string[] {
  const result = assertDataEntryTenantScope(scope, payload);
  return result.errors;
}

export function buildAndVerifyDomainPayload(input: {
  entityKind: DataEntryEntityKind;
  mode: DataEntryFormMode;
  values: Record<string, unknown>;
  actorId: string;
  role: Role;
  recordId?: string;
}): { payload: Record<string, unknown>; errors: string[] } {
  const payload = buildDataEntryDomainPayload(input.entityKind, input.mode, input.values, {
    actorId: input.actorId,
    role: input.role,
    recordId: input.recordId,
  });

  if (input.entityKind === 'approval') {
    const action = String(input.values.protectedAction ?? input.values.action ?? '');
    const target = String(input.values.target ?? '');
    const reason = String(input.values.reason ?? '');
    const evidence = parseSupportingEvidence(input.values.evidence);
    return {
      payload: {
        tenantId: input.values.tenantId,
        racetrackId: input.values.racetrackId,
        action,
        target,
        reason,
        evidence: evidence.length ? evidence : ['human-approval-record'],
        actor: input.actorId,
        actorType: 'human',
        roles: [input.role],
      },
      errors: verifyDomainPayloadContract(input.entityKind, {
        action,
        target,
        reason,
      }),
    };
  }

  return {
    payload,
    errors: verifyDomainPayloadContract(input.entityKind, payload),
  };
}

export function verifyMajorFormContracts(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const entityKind of majorDataEntryEntityKinds) {
    if (!dataEntryEntityForms[entityKind]) {
      errors.push(`registry missing major entity kind ${entityKind}`);
      continue;
    }
    errors.push(...verifyFormGovernanceContract(entityKind, 'create'));
    errors.push(...verifyRegistryEnumAlignment(entityKind, 'create'));
  }

  return { valid: errors.length === 0, errors };
}
