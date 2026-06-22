import type { DataEntryEntityKind, DataEntryFormMode } from '@trackmind/shared';
import { buildDataEntryDomainPayload, enrichPayloadWithScope, getDataEntryFormDefinition, resolveSubmitPath } from '@trackmind/shared';
import { getTenantContext } from '@/auth/session';
import { postJson } from '@/api/client';
import { assertMutationOk } from '@/api/approvalPayload';
import { createFacilitiesMaintenanceSchedule } from '@/api/mutations';
import { submitDataEntryForm, validateDataEntryPayload } from '@/api/dataEntry';
import { raceCardSubmitParams } from '@/features/race-card/buildRaceCardSubmitPayload';

export interface EntityFormSubmitResult {
  auditId?: string;
  approvalRequired?: boolean;
  approvalRequestId?: string;
  message?: string;
}

function scopeFromSession() {
  const session = getTenantContext();
  return {
    tenantId: session.tenantId,
    racetrackId: session.racetrackId,
    organizationId: session.organizationId,
    actorId: `${session.role}-operator`,
    role: session.role,
  };
}

async function submitDomainMutation(
  entityKind: DataEntryEntityKind,
  mode: DataEntryFormMode,
  values: Record<string, unknown>,
  recordId?: string,
): Promise<EntityFormSubmitResult> {
  const session = getTenantContext();
  const scoped = enrichPayloadWithScope({ ...scopeFromSession(), requestId: undefined }, values);
  const domainPayload = buildDataEntryDomainPayload(entityKind, mode, scoped, {
    actorId: `${session.role}-operator`,
    role: session.role,
    recordId,
  });
  const scopedWithDomainPayload = enrichPayloadWithScope({ ...scopeFromSession(), requestId: undefined }, domainPayload);

  if (entityKind === 'facilities-maintenance') {
    const validation = await validateDataEntryPayload({ entityKind, mode, values: scopedWithDomainPayload });
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const frameworkResult = await submitDataEntryForm({ entityKind, mode, values: scopedWithDomainPayload, recordId });
    const domainResponse = await createFacilitiesMaintenanceSchedule(scopedWithDomainPayload).then(assertMutationOk) as Record<string, unknown>;
    return {
      auditId: domainResponse.auditId ? String(domainResponse.auditId) : frameworkResult.auditId,
      approvalRequired: Boolean(domainResponse.approvalRequired),
      approvalRequestId: domainResponse.approvalRequestId ? String(domainResponse.approvalRequestId) : undefined,
      message: domainResponse.approvalRequired
        ? 'Maintenance schedule submitted for approval.'
        : 'Maintenance schedule confirmed.',
    };
  }

  if (entityKind === 'facilities-inspection') {
    const validation = await validateDataEntryPayload({ entityKind, mode, values: scopedWithDomainPayload });
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const frameworkResult = await submitDataEntryForm({ entityKind, mode, values: scopedWithDomainPayload, recordId });
    const definition = getDataEntryFormDefinition(entityKind, mode);
    const submitPath = resolveSubmitPath(definition, mode, { recordId: recordId ?? '', horseId: '', raceCardId: '', entryId: '' });
    const domainResponse = await postJson<Record<string, unknown>>(submitPath, scopedWithDomainPayload).then(assertMutationOk);
    return {
      auditId: domainResponse.auditId ? String(domainResponse.auditId) : frameworkResult.auditId,
      approvalRequired: Boolean(domainResponse.approvalRequired),
      approvalRequestId: domainResponse.approvalRequestId ? String(domainResponse.approvalRequestId) : undefined,
      message: domainResponse.message ? String(domainResponse.message) : 'Facilities inspection recorded.',
    };
  }

  if (entityKind === 'security-event-entry') {
    const validation = await validateDataEntryPayload({ entityKind, mode, values: scopedWithDomainPayload });
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const frameworkResult = await submitDataEntryForm({ entityKind, mode, values: scopedWithDomainPayload, recordId });
    const definition = getDataEntryFormDefinition(entityKind, mode);
    const submitPath = resolveSubmitPath(definition, mode, { recordId: recordId ?? '', horseId: '', raceCardId: '', entryId: '' });
    const domainResponse = await postJson<Record<string, unknown>>(submitPath, scopedWithDomainPayload).then(assertMutationOk);
    return {
      auditId: domainResponse.auditId ? String(domainResponse.auditId) : frameworkResult.auditId,
      approvalRequired: Boolean(domainResponse.approvalRequired),
      approvalRequestId: domainResponse.approvalRequestId ? String(domainResponse.approvalRequestId) : undefined,
      message: domainResponse.message ? String(domainResponse.message) : 'Security event recorded.',
    };
  }

  if (entityKind === 'compliance-evidence') {
    const validation = await validateDataEntryPayload({ entityKind, mode, values: scopedWithDomainPayload });
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const frameworkResult = await submitDataEntryForm({ entityKind, mode, values: scopedWithDomainPayload, recordId });
    const definition = getDataEntryFormDefinition(entityKind, mode);
    const submitPath = resolveSubmitPath(definition, mode, { recordId: recordId ?? '', horseId: '', raceCardId: '', entryId: '' });
    const domainResponse = await postJson<Record<string, unknown>>(submitPath, scopedWithDomainPayload).then(assertMutationOk);
    return {
      auditId: domainResponse.auditId ? String(domainResponse.auditRecordId ?? domainResponse.auditId) : frameworkResult.auditId,
      approvalRequired: Boolean(domainResponse.approvalRequired),
      approvalRequestId: domainResponse.approvalRequestId ? String(domainResponse.approvalRequestId) : undefined,
      message: domainResponse.message ? String(domainResponse.message) : 'Compliance evidence recorded.',
    };
  }

  if (entityKind === 'operational-note') {
    const validation = await validateDataEntryPayload({ entityKind, mode, values: scopedWithDomainPayload });
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const frameworkResult = await submitDataEntryForm({ entityKind, mode, values: scopedWithDomainPayload, recordId });
    const definition = getDataEntryFormDefinition(entityKind, mode);
    const submitPath = resolveSubmitPath(definition, mode, { recordId: recordId ?? '', horseId: '', raceCardId: '', entryId: '' });
    const domainResponse = await postJson<Record<string, unknown>>(submitPath, scopedWithDomainPayload).then(assertMutationOk);
    return {
      auditId: domainResponse.auditId ? String(domainResponse.auditId) : frameworkResult.auditId,
      approvalRequired: Boolean(domainResponse.approvalRequired),
      approvalRequestId: domainResponse.approvalRequestId ? String(domainResponse.approvalRequestId) : undefined,
      message: domainResponse.message ? String(domainResponse.message) : mode === 'edit' ? 'Note revised.' : 'Operational note recorded.',
    };
  }

  const validation = await validateDataEntryPayload({ entityKind, mode, values: scopedWithDomainPayload });
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const frameworkResult = await submitDataEntryForm({ entityKind, mode, values: scopedWithDomainPayload, recordId });
  const definition = getDataEntryFormDefinition(entityKind, mode);
  const submitPath = resolveSubmitPath(definition, mode, {
    recordId: recordId ?? '',
    horseId: String(scopedWithDomainPayload.horseId ?? recordId ?? ''),
    raceCardId: String(scopedWithDomainPayload.raceCardId ?? recordId ?? ''),
    entryId: String(scopedWithDomainPayload.entryId ?? ''),
    ...raceCardSubmitParams(entityKind, scopedWithDomainPayload, recordId),
  });

  if (submitPath.startsWith('/data-entry/submit/')) {
    return {
      auditId: frameworkResult.auditId,
      message: frameworkResult.message,
    };
  }

  const domainResponse = await postJson<Record<string, unknown>>(submitPath, scopedWithDomainPayload).then(assertMutationOk);
  return {
    auditId: domainResponse.auditId ? String(domainResponse.auditId) : frameworkResult.auditId,
    approvalRequired: Boolean(domainResponse.approvalRequired ?? domainResponse.accepted),
    approvalRequestId: domainResponse.approvalRequestId
      ? String(domainResponse.approvalRequestId)
      : domainResponse.approvalId
        ? String(domainResponse.approvalId)
        : undefined,
    message: domainResponse.message ? String(domainResponse.message) : frameworkResult.message,
  };
}

export async function submitEntityForm(input: {
  entityKind: DataEntryEntityKind;
  mode?: DataEntryFormMode;
  values: Record<string, unknown>;
  recordId?: string;
}): Promise<EntityFormSubmitResult> {
  return submitDomainMutation(input.entityKind, input.mode ?? 'create', input.values, input.recordId);
}
