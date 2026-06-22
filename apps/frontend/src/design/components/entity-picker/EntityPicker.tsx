import type { EntityPickerItem, EntityPickerKind } from '@trackmind/shared';
import { getEntityPickerKindDefinition } from '@trackmind/shared';
import type { KeyboardEvent, ReactElement } from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { Input } from '@/design/components/form-field';
import { cn } from '@/lib/utils';
import { useEntityPickerSearch } from '@/hooks/useEntityPickerSearch';
import { useRecentEntitySelections } from '@/hooks/useRecentEntitySelections';

export function EntityPicker({
  kind,
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
  className,
  limit,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  error: inputError,
}: {
  kind: EntityPickerKind;
  value?: string;
  onChange?: (value: string, item?: EntityPickerItem) => void;
  onSelect?: (item: EntityPickerItem) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  limit?: number;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  error?: boolean;
}): ReactElement {
  const { session } = useTenantSession();
  const definition = getEntityPickerKindDefinition(kind);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { readRecent, rememberSelection } = useRecentEntitySelections(
    kind,
    session.tenantId,
    session.racetrackId,
  );
  const { results, loading, error, permissionDenied } = useEntityPickerSearch(kind, query, open, limit);

  const recent = useMemo(() => readRecent(), [readRecent, open, kind]);
  const options = useMemo(() => {
    const merged = [...recent];
    for (const result of results) {
      if (!merged.some((item) => item.id === result.id)) merged.push(result);
    }
    return merged;
  }, [recent, results]);

  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
      return;
    }
    const match = options.find((item) => item.id === value) ?? recent.find((item) => item.id === value);
    if (match) setSelectedLabel(match.label);
  }, [value, options, recent]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, options.length]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  const commitSelection = useCallback((item: EntityPickerItem) => {
    rememberSelection(item);
    setSelectedLabel(item.label);
    setQuery('');
    setOpen(false);
    onChange?.(item.id, item);
    onSelect?.(item);
  }, [onChange, onSelect, rememberSelection]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || options.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = options[activeIndex];
      if (item) commitSelection(item);
    }
  };

  const displayValue = open ? query : (selectedLabel || value || '');
  const activeOptionId = options[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid ?? inputError ?? undefined}
        aria-required={ariaRequired}
        disabled={disabled || permissionDenied}
        className={inputError ? 'border-[var(--status-critical)]' : undefined}
        placeholder={placeholder ?? `Search ${definition.pluralLabel.toLowerCase()}…`}
        value={displayValue}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)] shadow-lg"
        >
          {loading ? (
            <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">Searching {definition.pluralLabel.toLowerCase()}…</p>
          ) : null}
          {permissionDenied ? (
            <p className="px-3 py-2 text-xs text-[var(--status-critical)]">Your role cannot search {definition.pluralLabel.toLowerCase()}.</p>
          ) : null}
          {error ? (
            <p className="px-3 py-2 text-xs text-[var(--status-critical)]">{error}</p>
          ) : null}
          {!loading && !permissionDenied && !error && options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--muted-foreground)]">
              {query.trim() ? `No ${definition.pluralLabel.toLowerCase()} match "${query.trim()}".` : `No ${definition.pluralLabel.toLowerCase()} available in this tenant scope.`}
            </p>
          ) : null}
          {recent.length > 0 && !query.trim() ? (
            <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Recent</p>
          ) : null}
          {options.map((item, index) => (
            <button
              key={`${item.kind}:${item.id}`}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                'flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-[var(--muted)]',
                index === activeIndex && 'bg-[var(--muted)]',
                value === item.id && 'font-medium',
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commitSelection(item)}
            >
              <span>{item.label}</span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {item.id}
                {item.subtitle ? ` · ${item.subtitle}` : ''}
                {item.status ? ` · ${item.status}` : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
