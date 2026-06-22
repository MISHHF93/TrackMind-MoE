import type { DataEntryFieldDefinition } from '@trackmind/shared';
import {
  approvalRequirementToBoolean,
  entityPickerKindForField,
  fieldOptionsToOperationalOptions,
  isCompositeOperationalField,
  normalizeApprovalRequirementValue,
  operationalStatusOptionsForField,
  parseOperationalMultiSelectValue,
  resolveOperationalFormComponentKind,
  serializeOperationalMultiSelectValue,
} from '@trackmind/shared';
import type { ReactElement } from 'react';
import type { FormFieldControlProps } from '@/design/components/form-field';
import { ApprovalRequirementPicker } from './ApprovalRequirementPicker';
import { AttachmentPlaceholder } from './AttachmentPlaceholder';
import { AuditReferenceViewer } from './AuditReferenceViewer';
import { DateTimeInput } from './DateTimeInput';
import { EntityRelationshipPicker } from './EntityRelationshipPicker';
import { EvidenceLinkSelector } from './EvidenceLinkSelector';
import { MultiSelect } from './MultiSelect';
import { NotesEditor } from './NotesEditor';
import { SearchableSelect } from './SearchableSelect';
import { SeverityPicker } from './SeverityPicker';
import { StatusPicker } from './StatusPicker';
import { TenantRacetrackPicker } from './TenantRacetrackPicker';
import { TextAreaInput } from './TextAreaInput';
import { TextInput } from './TextInput';

type RendererProps = FormFieldControlProps & {
  field: DataEntryFieldDefinition;
  value: string | number | boolean;
  formValues?: Record<string, unknown>;
  editable: boolean;
  onChange: (path: string, next: unknown) => void;
  fieldLabel: string;
};

export function OperationalFormFieldRenderer({
  field,
  value,
  formValues,
  editable,
  onChange,
  fieldLabel,
  id,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  error,
}: RendererProps): ReactElement {
  const kind = resolveOperationalFormComponentKind(field, formValues);
  const disabled = !editable;
  const stringValue = String(value ?? '');
  const setValue = (next: unknown) => onChange(field.path, next);
  const inputId = isCompositeOperationalField(field) ? undefined : id;
  const controlA11y = {
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
    error,
  };

  switch (kind) {
    case 'entity-relationship': {
      const pickerKind = entityPickerKindForField(field.path, formValues);
      if (!pickerKind) break;
      return (
        <EntityRelationshipPicker
          kind={pickerKind}
          value={stringValue}
          disabled={disabled}
          onChange={(nextValue) => setValue(nextValue)}
          {...controlA11y}
        />
      );
    }
    case 'tenant-racetrack':
      return (
        <TenantRacetrackPicker
          id={id}
          scope={field.path === 'tenantId' ? 'tenant' : 'racetrack'}
          value={stringValue}
          disabled={disabled}
          onChange={(nextValue) => setValue(nextValue)}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
        />
      );
    case 'severity-picker':
      return (
        <SeverityPicker
          id={id}
          value={stringValue}
          disabled={disabled}
          groupLabel={fieldLabel}
          onChange={(nextValue) => setValue(nextValue)}
        />
      );
    case 'approval-requirement':
      return (
        <ApprovalRequirementPicker
          id={id}
          value={typeof value === 'boolean' ? value : normalizeApprovalRequirementValue(value)}
          disabled={disabled}
          groupLabel={fieldLabel}
          onChange={(nextValue) => setValue(approvalRequirementToBoolean(nextValue))}
        />
      );
    case 'status-picker':
      return (
        <StatusPicker
          id={id}
          value={stringValue}
          options={operationalStatusOptionsForField(field)}
          disabled={disabled}
          groupLabel={fieldLabel}
          onChange={(nextValue) => setValue(nextValue)}
        />
      );
    case 'audit-reference-viewer':
      return <AuditReferenceViewer id={id} value={value} aria-labelledby={ariaLabelledBy} />;
    case 'evidence-link-selector':
      return (
        <EvidenceLinkSelector
          id={inputId}
          value={stringValue}
          disabled={disabled}
          fieldLabel={fieldLabel}
          onChange={(nextValue) => setValue(nextValue)}
          {...controlA11y}
        />
      );
    case 'attachment-placeholder':
      return (
        <AttachmentPlaceholder
          id={inputId}
          value={stringValue}
          disabled={disabled}
          onChange={(nextValue) => setValue(nextValue)}
          {...controlA11y}
        />
      );
    case 'notes-editor':
      return (
        <NotesEditor
          id={inputId}
          value={stringValue}
          disabled={disabled}
          placeholder={field.placeholder}
          rows={field.rows ?? 4}
          maxLength={field.maxLength}
          hintId={ariaDescribedBy?.split(' ').find((entry) => entry.endsWith('-help'))}
          onChange={(nextValue) => setValue(nextValue)}
          {...controlA11y}
        />
      );
    case 'multi-select': {
      const options = fieldOptionsToOperationalOptions(field.options);
      if (options.length === 0) {
        return (
          <TextAreaInput
            id={inputId}
            rows={field.rows ?? 3}
            placeholder={field.placeholder ?? 'One value per line or comma-separated'}
            value={stringValue}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
            {...controlA11y}
          />
        );
      }
      return (
        <MultiSelect
          id={id}
          value={parseOperationalMultiSelectValue(value)}
          options={options}
          disabled={disabled}
          groupLabel={fieldLabel}
          onChange={(nextValues) => setValue(serializeOperationalMultiSelectValue(nextValues))}
        />
      );
    }
    case 'text-area':
      return (
        <TextAreaInput
          id={inputId}
          rows={field.rows ?? 3}
          placeholder={field.placeholder}
          value={stringValue}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          {...controlA11y}
        />
      );
    case 'searchable-select':
      return (
        <SearchableSelect
          id={inputId}
          value={stringValue}
          options={fieldOptionsToOperationalOptions(field.options)}
          disabled={disabled}
          onChange={(nextValue) => setValue(nextValue)}
          {...controlA11y}
        />
      );
    case 'date-time':
      return (
        <DateTimeInput
          id={inputId}
          mode={field.type === 'date' ? 'date' : 'datetime-local'}
          value={typeof value === 'boolean' ? '' : value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          {...controlA11y}
        />
      );
    case 'text-input':
    default:
      if (field.type === 'checkbox') {
        return (
          <TextInput
            id={inputId}
            type="checkbox"
            className="h-4 w-4"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) => setValue(event.target.checked)}
            {...controlA11y}
          />
        );
      }
      return (
        <TextInput
          id={inputId}
          type={field.type === 'number' ? 'number' : 'text'}
          placeholder={field.placeholder}
          value={typeof value === 'boolean' ? '' : value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          {...controlA11y}
        />
      );
  }

  return (
    <TextInput
      id={inputId}
      value={stringValue}
      disabled={disabled}
      onChange={(event) => setValue(event.target.value)}
      {...controlA11y}
    />
  );
}

export { resolveOperationalFormComponentKind };
