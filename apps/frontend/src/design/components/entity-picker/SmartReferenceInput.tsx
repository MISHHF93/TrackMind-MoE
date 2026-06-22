import type { EntityPickerItem, EntityPickerKind } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { FormField } from '@/design/components/form-field';
import { EntityPicker } from './EntityPicker';

export function SmartReferenceInput({
  kind,
  label,
  htmlFor,
  value,
  onChange,
  onSelect,
  required,
  error,
  helpText,
  placeholder,
  disabled,
  className,
}: {
  kind: EntityPickerKind;
  label: string;
  htmlFor: string;
  value?: string;
  onChange?: (value: string, item?: EntityPickerItem) => void;
  onSelect?: (item: EntityPickerItem) => void;
  required?: boolean;
  error?: string;
  helpText?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}): ReactElement {
  return (
    <FormField label={label} htmlFor={htmlFor} required={required} error={error} helpText={helpText}>
      <EntityPicker
        kind={kind}
        value={value}
        onChange={onChange}
        onSelect={onSelect}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
    </FormField>
  );
}
