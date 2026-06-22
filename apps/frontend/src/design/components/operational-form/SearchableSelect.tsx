import type { OperationalFormOption } from '@trackmind/shared';
import type { KeyboardEvent, ReactElement } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { operationalControlClassName, type OperationalControlProps } from './_shared';

function filterOptions(options: readonly OperationalFormOption[], query: string): OperationalFormOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter(
    (option) => option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q),
  );
}

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Search or select…',
  disabled,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  error,
}: OperationalControlProps & {
  value: string;
  options: readonly OperationalFormOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}): ReactElement {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const activeOptionId = filtered[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const commit = (next: string) => {
    onChange(next);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && filtered[activeIndex]) {
      event.preventDefault();
      commit(filtered[activeIndex].value);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid ?? error ?? undefined}
        aria-required={ariaRequired}
        disabled={disabled}
        className={cn(operationalControlClassName, error && 'border-[var(--status-critical)]')}
        placeholder={selected?.label ?? placeholder}
        value={open ? query : selected?.label ?? ''}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && filtered.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg"
        >
          {filtered.map((option, index) => (
            <li
              key={option.value}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={cn(
                'cursor-pointer px-3 py-2 text-sm',
                index === activeIndex ? 'bg-[var(--muted)]' : 'hover:bg-[var(--muted)]/70',
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                commit(option.value);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
