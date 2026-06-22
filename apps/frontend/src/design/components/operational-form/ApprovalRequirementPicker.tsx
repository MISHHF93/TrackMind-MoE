import { operationalApprovalRequirementOptions, normalizeApprovalRequirementValue } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { StatusPicker } from './StatusPicker';
import type { OperationalControlProps } from './_shared';

export function ApprovalRequirementPicker({
  id,
  value,
  onChange,
  disabled,
  className,
  groupLabel = 'Approval requirement',
}: OperationalControlProps & {
  value: string | boolean;
  onChange: (value: string) => void;
  groupLabel?: string;
}): ReactElement {
  return (
    <StatusPicker
      id={id}
      value={normalizeApprovalRequirementValue(value)}
      options={operationalApprovalRequirementOptions}
      onChange={onChange}
      disabled={disabled}
      className={className}
      groupLabel={groupLabel}
    />
  );
}
