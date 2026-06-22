import type { EntityPickerItem, EntityPickerKind } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { EntityPicker } from '@/design/components/entity-picker';
import type { OperationalControlProps } from './_shared';

export function EntityRelationshipPicker({
  kind,
  value,
  onChange,
  onSelect,
  disabled,
  placeholder,
  className,
  limit,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  error,
}: OperationalControlProps & {
  kind: EntityPickerKind;
  value?: string;
  onChange?: (value: string, item?: EntityPickerItem) => void;
  onSelect?: (item: EntityPickerItem) => void;
  placeholder?: string;
  limit?: number;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}): ReactElement {
  return (
    <EntityPicker
      id={id}
      kind={kind}
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      limit={limit}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-required={ariaRequired}
      error={error}
    />
  );
}
