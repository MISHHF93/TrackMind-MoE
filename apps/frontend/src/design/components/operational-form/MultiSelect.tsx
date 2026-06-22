import type { OperationalFormOption } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { OperationalChip, type OperationalControlProps } from './_shared';

export function MultiSelect({
  id,
  value,
  options,
  onChange,
  disabled,
  className,
  delimiter = '\n',
  groupLabel = 'Select all that apply',
}: OperationalControlProps & {
  value: string[] | string;
  options: readonly OperationalFormOption[];
  onChange: (values: string[]) => void;
  delimiter?: string;
  groupLabel?: string;
}): ReactElement {
  const selected = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? value.split(delimiter).map((entry) => entry.trim()).filter(Boolean)
      : [];

  const toggle = (optionValue: string) => {
    if (disabled) return;
    const next = selected.includes(optionValue)
      ? selected.filter((entry) => entry !== optionValue)
      : [...selected, optionValue];
    onChange(next);
  };

  return (
    <div id={id} className={cn('flex flex-wrap gap-1.5', className)} role="group" aria-label={groupLabel}>
      {options.map((option) => (
        <OperationalChip
          key={option.value}
          label={option.label}
          tone={option.tone}
          selected={selected.includes(option.value)}
          disabled={disabled}
          onClick={() => toggle(option.value)}
        />
      ))}
      {options.length === 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">No options configured.</p>
      ) : null}
    </div>
  );
}
