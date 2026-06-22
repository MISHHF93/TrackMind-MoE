import { operationalSeverityOptions } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { StatusPicker } from './StatusPicker';
import type { OperationalControlProps } from './_shared';

export function SeverityPicker({
  id,
  value,
  onChange,
  disabled,
  className,
  groupLabel = 'Severity',
}: OperationalControlProps & {
  value: string;
  onChange: (value: string) => void;
  groupLabel?: string;
}): ReactElement {
  return (
    <StatusPicker
      id={id}
      value={value}
      options={operationalSeverityOptions}
      onChange={onChange}
      disabled={disabled}
      className={className}
      groupLabel={groupLabel}
    />
  );
}
