import type { DataEntryEntityKind, DataEntryFormMode } from '@trackmind/shared';
import {
  canAccessHorseWorkflow,
  getDataEntryFormDefinition,
  getHorseDataEntryWorkflow,
  isHorseVeterinaryRestrictedKind,
  roleCanSubmitForm,
} from '@trackmind/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Button } from '@/design/components/button';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { actionDisabledReason } from '@/domain/approvalControls';
import { TrackMindFormDialog } from '@/features/data-entry/TrackMindFormDialog';

export function HorseFormAction({
  entityKind,
  label,
  mode = 'create',
  recordId,
  seed,
  submitLabel,
  variant = 'governance',
}: {
  entityKind: DataEntryEntityKind;
  label: string;
  mode?: DataEntryFormMode;
  recordId?: string;
  seed?: Record<string, unknown>;
  submitLabel?: string;
  variant?: 'governance' | 'outline' | 'default';
}): ReactElement | null {
  const { session } = useTenantSession();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const workflow = getHorseDataEntryWorkflow(entityKind);
  const definition = getDataEntryFormDefinition(entityKind, mode);

  if (workflow && !canAccessHorseWorkflow(workflow, session.role)) {
    return null;
  }

  if (isHorseVeterinaryRestrictedKind(entityKind) && session.role !== 'veterinarian' && session.role !== 'admin' && session.role !== 'compliance-officer') {
    return null;
  }

  const canSubmit = roleCanSubmitForm(definition, session.role);
  const disabledReason = canSubmit
    ? undefined
    : actionDisabledReason(
      {
        id: `${entityKind}-submit`,
        label,
        protectedAction: definition.auditAction,
        target: recordId ?? entityKind,
        requiredRoles: [...definition.allowedRoles],
      },
      session.role,
    );

  const sectionLabel = workflow?.section === 'identity'
    ? 'Identity'
    : workflow?.section === 'operational'
      ? 'Operational'
      : workflow?.section === 'welfare-restricted'
        ? 'Welfare / vet'
        : undefined;

  return (
    <>
      <Button
        size="sm"
        variant={variant}
        disabled={!canSubmit}
        title={disabledReason}
        onClick={() => { setMessage(null); setOpen(true); }}
      >
        {label}
      </Button>
      {message ? <p className="text-xs text-[var(--muted-foreground)]">{message}</p> : null}
      <TrackMindFormDialog
        entityKind={entityKind}
        mode={mode}
        recordId={recordId}
        seed={seed}
        open={open}
        onOpenChange={setOpen}
        title={sectionLabel ? `${sectionLabel}: ${definition.displayName}` : definition.displayName}
        description={workflow?.description ?? definition.description}
        submitLabel={submitLabel ?? (mode === 'edit' ? 'Update' : 'Save')}
        onSubmitted={(result) => setMessage(result.message ?? 'Saved.')}
        footerExtra={
          workflow?.sensitive ? (
            <p className="mr-auto max-w-sm text-xs text-[var(--status-warning)]">
              Sensitive record — confirm overwrite before saving edits.
            </p>
          ) : isHorseVeterinaryRestrictedKind(entityKind) ? (
            <p className="mr-auto max-w-sm text-xs text-[var(--muted-foreground)]">
              Veterinary privacy: clinical fields are restricted to authorized roles.
            </p>
          ) : null
        }
      />
    </>
  );
}
