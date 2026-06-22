import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { TextAreaInput } from './TextAreaInput';
import { OperationalFieldHint, type OperationalControlProps } from './_shared';

export function NotesEditor({
  id,
  value,
  onChange,
  disabled,
  placeholder = 'Add operational notes…',
  rows = 4,
  maxLength,
  className,
  hintId,
  'aria-describedby': ariaDescribedBy,
  'aria-labelledby': ariaLabelledBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  error,
}: OperationalControlProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  hintId?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}): ReactElement {
  const notesHintId = hintId ?? (id ? `${id}-notes-hint` : undefined);
  const describedBy = [ariaDescribedBy, notesHintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid gap-1', className)}>
      <TextAreaInput
        id={id}
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid ?? error}
        aria-required={ariaRequired}
        error={error}
        onChange={(event) => onChange(event.target.value)}
      />
      {maxLength ? (
        <OperationalFieldHint id={notesHintId}>
          {value.length}/{maxLength} characters
        </OperationalFieldHint>
      ) : (
        <OperationalFieldHint id={notesHintId}>
          Notes are audit-logged and scoped to your workspace.
        </OperationalFieldHint>
      )}
    </div>
  );
}
