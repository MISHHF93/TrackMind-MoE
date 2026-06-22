import type { QuickStatusTone } from '@trackmind/shared';
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { QuickStatusButton } from '@/features/race-day/QuickStatusButton';

export interface InlineStatusOption {
  value: string;
  label: string;
  shortLabel?: string;
  tone?: QuickStatusTone;
  approvalGoverned?: boolean;
  destructive?: boolean;
}

export function InlineStatusSelect({
  value,
  options,
  onChange,
  disabled,
  compact,
  className,
}: {
  value: string;
  options: readonly InlineStatusOption[];
  onChange: (next: string) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}): ReactElement {
  const [saving, setSaving] = useState(false);

  const handleSelect = async (option: InlineStatusOption) => {
    if (disabled || saving || option.value === value) return;
    if (option.approvalGoverned) return;
    setSaving(true);
    try {
      await onChange(option.value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-1', className)} role="group" aria-label="Status">
      {options.map((option) => {
        const selected = option.value === value;
        const blocked = option.approvalGoverned === true;
        return (
          <QuickStatusButton
            key={option.value}
            label={option.label}
            shortLabel={option.shortLabel ?? option.label}
            tone={option.tone ?? 'neutral'}
            selected={selected}
            compact={compact}
            disabled={disabled || saving || blocked}
            title={blocked ? `${option.label} requires approval workflow` : option.destructive ? `${option.label} — confirm to apply` : undefined}
            onClick={() => void handleSelect(option)}
          />
        );
      })}
    </div>
  );
}
