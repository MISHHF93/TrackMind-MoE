import type { OperationalFormOption } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { OperationalChip, type OperationalControlProps } from './_shared';

export function StatusPicker({
  id,
  value,
  options,
  onChange,
  disabled,
  className,
  groupLabel = 'Status',
}: OperationalControlProps & {
  value: string;
  options: readonly OperationalFormOption[];
  onChange: (value: string) => void;
  groupLabel?: string;
}): ReactElement {
  return (
    <div
      id={id}
      className={cn('flex flex-wrap gap-1.5', className)}
      role="group"
      aria-label={groupLabel}
    >
      {options.map((option) => {
        const blocked = option.approvalGoverned === true;
        return (
          <OperationalChip
            key={option.value}
            label={option.label}
            tone={option.tone}
            selected={option.value === value}
            disabled={disabled}
            blockedReason={blocked ? `${option.label} requires approval workflow` : undefined}
            title={option.destructive ? `${option.label} — confirm to apply` : undefined}
            onClick={() => {
              if (!disabled && !blocked) onChange(option.value);
            }}
          />
        );
      })}
    </div>
  );
}
