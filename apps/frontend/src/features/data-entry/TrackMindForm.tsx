import type { ReactElement } from 'react';
import { isCompositeOperationalField, isFieldEditable } from '@trackmind/shared';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { FormErrorSummary } from '@/design/components/form-field';
import { OperationalFormField, OperationalFormFieldRenderer } from '@/design/components/operational-form';
import { fieldInputId, readFieldValue, type TrackMindFormController } from './useTrackMindForm';

export function TrackMindForm({
  form,
  className,
  formId,
}: {
  form: TrackMindFormController;
  className?: string;
  formId?: string;
}): ReactElement {
  const { session } = useTenantSession();
  return (
    <div
      id={formId}
      className={className ?? 'grid gap-4 text-sm md:grid-cols-2'}
      role="group"
      aria-label={`${form.definition.displayName} fields`}
    >
      {form.errors.length > 0 ? (
        <FormErrorSummary errors={form.errors} className="md:col-span-2" />
      ) : null}
      {form.visibleFields.map((field) => {
        const editable = isFieldEditable(field, session.role);
        const inputId = fieldInputId(form.definition.entityKind, field.path);
        const composite = isCompositeOperationalField(field);
        return (
          <OperationalFormField
            key={field.path}
            label={field.label}
            htmlFor={inputId}
            required={field.required}
            helpText={field.helpText}
            error={form.fieldErrors[field.path]}
            composite={composite}
          >
            <OperationalFormFieldRenderer
              field={field}
              id={inputId}
              fieldLabel={field.label}
              value={readFieldValue(field, form.values)}
              formValues={form.values}
              editable={editable}
              onChange={form.setFieldValue}
            />
          </OperationalFormField>
        );
      })}
    </div>
  );
}
