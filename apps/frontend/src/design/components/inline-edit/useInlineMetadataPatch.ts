import type { InlineEditEntityScope } from '@trackmind/shared';
import {
  buildInlineMetadataPatchPayload,
  isApprovalGovernedInlineEdit,
  requiresDestructiveConfirm,
  validateInlineMetadataPatch,
} from '@trackmind/shared';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { postJson } from '@/api/client';
import { assertMutationOk } from '@/api/approvalPayload';

const patchPaths: Record<InlineEditEntityScope, string> = {
  'operational-note': '/operational-notes/metadata-patch',
  'compliance-evidence': '/compliance/evidence/metadata-patch',
  'facilities-work-order': '/facilities-maintenance/work-orders/metadata-patch',
  'facilities-inspection': '/facilities-maintenance/inspections',
  'security-incident': '/security-operations/incidents/metadata-patch',
  'corrective-action': '/compliance/corrective-actions',
  'race-day-readiness': '/race-day-readiness/dashboard',
  'paddock-assignment': '/race-operations/paddock',
};

function entityIdKey(entityScope: InlineEditEntityScope): string {
  switch (entityScope) {
    case 'operational-note':
      return 'noteId';
    case 'compliance-evidence':
      return 'evidenceId';
    case 'facilities-work-order':
      return 'workOrderId';
    case 'security-incident':
      return 'incidentId';
    default:
      return 'entityId';
  }
}

function fieldPayloadKey(fieldKey: string): string {
  return fieldKey;
}

export function useInlineMetadataPatch({
  entityScope,
  entityId,
  actorId,
  onSuccess,
}: {
  entityScope: InlineEditEntityScope;
  entityId: string;
  actorId: string;
  onSuccess?: (message: string) => void;
}): {
  saving: boolean;
  error: string | null;
  pendingDestructive: { fieldKey: string; value: unknown; label: string } | null;
  clearPendingDestructive: () => void;
  saveField: (fieldKey: string, value: unknown, options?: { reason?: string; skipConfirm?: boolean }) => Promise<boolean>;
  confirmDestructive: (reason?: string) => Promise<boolean>;
} {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDestructive, setPendingDestructive] = useState<{ fieldKey: string; value: unknown; label: string } | null>(null);

  const executePatch = useCallback(async (
    fieldKey: string,
    value: unknown,
    options: { reason?: string; confirmedDestructive?: boolean } = {},
  ): Promise<boolean> => {
    const payload = buildInlineMetadataPatchPayload({
      entityScope,
      entityId,
      fieldKey,
      value,
      actorId,
      reason: options.reason,
      confirmedDestructive: options.confirmedDestructive,
    });
    const validation = validateInlineMetadataPatch(payload);
    if (!validation.valid) {
      setError(validation.errors.join(' '));
      return false;
    }

    setSaving(true);
    setError(null);
    try {
      const idKey = entityIdKey(entityScope);
      const body: Record<string, unknown> = {
        [idKey]: entityId,
        actorId,
        reason: options.reason ?? `Inline ${validation.policy.label} update`,
        confirmedDestructive: options.confirmedDestructive,
        [fieldPayloadKey(fieldKey)]: value,
      };
      const response = await postJson<{ message?: string }>(patchPaths[entityScope], body);
      assertMutationOk(response);
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      onSuccess?.(response.data?.message ?? `${validation.policy.label} updated`);
      return true;
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : String(patchError));
      return false;
    } finally {
      setSaving(false);
    }
  }, [actorId, entityId, entityScope, onSuccess, queryClient]);

  const saveField = useCallback(async (
    fieldKey: string,
    value: unknown,
    options: { reason?: string; skipConfirm?: boolean } = {},
  ): Promise<boolean> => {
    const nextValue = value === undefined || value === null ? undefined : String(value);
    if (nextValue !== undefined && isApprovalGovernedInlineEdit(entityScope, fieldKey, nextValue)) {
      setError(`Changing ${fieldKey} to "${nextValue}" requires approval — use the governed workflow.`);
      return false;
    }
    if (!options.skipConfirm && nextValue !== undefined && requiresDestructiveConfirm(entityScope, fieldKey, nextValue)) {
      setPendingDestructive({ fieldKey, value, label: fieldKey });
      return false;
    }
    return executePatch(fieldKey, value, { reason: options.reason });
  }, [entityScope, executePatch]);

  const confirmDestructive = useCallback(async (reason?: string): Promise<boolean> => {
    if (!pendingDestructive) return false;
    const ok = await executePatch(pendingDestructive.fieldKey, pendingDestructive.value, {
      reason,
      confirmedDestructive: true,
    });
    if (ok) setPendingDestructive(null);
    return ok;
  }, [executePatch, pendingDestructive]);

  return {
    saving,
    error,
    pendingDestructive,
    clearPendingDestructive: () => setPendingDestructive(null),
    saveField,
    confirmDestructive,
  };
}
