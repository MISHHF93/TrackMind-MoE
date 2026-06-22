import type { ReactElement } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/design/components/button';

export function InlineSchedulingField({
  value,
  onSave,
  disabled,
  className,
}: {
  value?: string;
  onSave: (isoValue: string) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.slice(0, 16) ?? '');
  const [saving, setSaving] = useState(false);

  const display = value ? value.slice(0, 16).replace('T', ' ') : '—';

  const commit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await onSave(new Date(draft).toISOString());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (disabled) {
    return <span className={cn('text-sm', className)}>{display}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={cn(
          'rounded px-1 py-0.5 text-sm hover:bg-[var(--muted)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
          className,
        )}
        onClick={() => {
          setDraft(value?.slice(0, 16) ?? '');
          setEditing(true);
        }}
      >
        {display}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <input
        type="datetime-local"
        value={draft}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
      />
      <Button size="sm" variant="governance" disabled={saving || !draft} onClick={() => void commit()}>
        Save
      </Button>
      <Button size="sm" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}
