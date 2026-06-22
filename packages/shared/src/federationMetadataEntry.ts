import type { FederationDataSharingScopeDto } from './apiContracts.js';
import type { DataEntryFormMode } from './dataEntryFramework.js';

export const federationMetadataEntrySchemaVersion = 'trackmind.federation-metadata-entry.v1' as const;

export type FederationMetadataChangeType =
  | 'sharing-scope'
  | 'cohort-enrollment'
  | 'benchmark-publication'
  | 'policy-attestation';

export const federationSharingScopeOptions: readonly { value: FederationDataSharingScopeDto; label: string }[] = [
  { value: 'tenant-only', label: 'Tenant only' },
  { value: 'federation-aggregate', label: 'Federation aggregate' },
  { value: 'industry-anonymized', label: 'Industry anonymized' },
];

export function validateFederationMetadataEntry(
  values: Record<string, unknown>,
  mode: DataEntryFormMode = 'create',
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (mode === 'edit' && !values.recordId) {
    errors.push('federation-metadata.recordId is required for edits');
  }
  const changeType = String(values.changeType ?? '');
  if (!changeType) errors.push('changeType is required');
  const sharingScope = String(values.sharingScope ?? '');
  if (!sharingScope) errors.push('sharingScope is required');
  if (sharingScope && !federationSharingScopeOptions.some((option) => option.value === sharingScope)) {
    errors.push('sharingScope must be tenant-only, federation-aggregate, or industry-anonymized');
  }
  if (!String(values.policyId ?? '').trim()) errors.push('policyId is required');
  if (!String(values.reason ?? '').trim()) errors.push('reason is required');
  if (String(values.reason ?? '').trim().length < 12) errors.push('reason must be at least 12 characters');
  if (values.approvalRequired !== true && values.approvalRequired !== 'true') {
    errors.push('approvalRequired must be acknowledged for federation metadata changes');
  }
  return { valid: errors.length === 0, errors };
}

export function buildFederationMetadataIntakePayload(
  scope: { actorId: string; tenantId: string; racetrackId: string },
  values: Record<string, unknown>,
): Record<string, unknown> {
  const validation = validateFederationMetadataEntry(values, 'create');
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  return {
    changeType: String(values.changeType ?? 'sharing-scope'),
    sharingScope: String(values.sharingScope ?? 'tenant-only'),
    policyId: String(values.policyId ?? 'federation-data-sharing-v1'),
    cohortId: values.cohortId ? String(values.cohortId) : undefined,
    benchmarkOptIn: values.benchmarkOptIn === true,
    consentAttested: values.consentAttested === true,
    approvalRequired: true,
    tenantId: scope.tenantId,
    racetrackId: scope.racetrackId,
    requestedBy: scope.actorId,
    reason: String(values.reason ?? 'Federation metadata change requested'),
    evidence: [
      'federation-metadata-form',
      `sharing-scope:${String(values.sharingScope ?? 'tenant-only')}`,
      `policy:${String(values.policyId ?? 'federation-data-sharing-v1')}`,
    ],
  };
}
