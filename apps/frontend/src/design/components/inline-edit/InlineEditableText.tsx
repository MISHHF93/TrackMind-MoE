import type { KeyboardEvent, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/design/components/button';

export function InlineEditableText({
  value,
  onSave,
  disabled,
  multiline,
  placeholder = 'Click to edit',
  className,
  maxPreviewLength = 80,
}: {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  disabled?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  maxPreviewLength?: number;
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    if (draft.trim() === value.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
    if (!multiline && event.key === 'Enter') {
      event.preventDefault();
      void commit();
    }
    if (multiline && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void commit();
    }
  };

  if (disabled) {
    return (
      <span className={cn('text-sm text-[var(--muted-foreground)]', className)} title="Editing disabled for this record">
        {value || '—'}
      </span>
    );
  }

  if (!editing) {
    const preview = value.length > maxPreviewLength ? `${value.slice(0, maxPreviewLength)}…` : value;
    return (
      <button
        type="button"
        className={cn(
          'group inline-flex max-w-full items-start gap-1 rounded px-1 py-0.5 text-left text-sm hover:bg-[var(--muted)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
          className,
        )}
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        <span>{preview || placeholder}</span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100">Edit</span>
      </button>
    );
  }

  const sharedProps = {
    ref: inputRef as never,
    value: draft,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onKeyDown,
    disabled: saving,
    className: 'w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm',
  };

  return (
    <div className="space-y-1">
      {multiline ? (
        <textarea {...sharedProps} rows={3} />
      ) : (
        <input type="text" {...sharedProps} />
      )}
      <div className="flex gap-1">
        <Button size="sm" variant="governance" disabled={saving || !draft.trim()} onClick={() => void commit()}>
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
