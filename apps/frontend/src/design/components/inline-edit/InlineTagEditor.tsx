import type { KeyboardEvent, ReactElement } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/design/components/badge';

export function InlineTagEditor({
  tags,
  onChange,
  disabled,
  className,
}: {
  tags: string[];
  onChange: (tags: string[]) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}): ReactElement {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const addTag = async (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || tags.includes(tag) || disabled) return;
    setSaving(true);
    try {
      await onChange([...tags, tag]);
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  const removeTag = async (tag: string) => {
    if (disabled) return;
    setSaving(true);
    try {
      await onChange(tags.filter((entry) => entry !== tag));
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      void addTag(draft);
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          {!disabled ? (
            <button
              type="button"
              className="rounded px-0.5 text-[10px] hover:bg-[var(--muted)]"
              disabled={saving}
              onClick={() => void removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          ) : null}
        </Badge>
      ))}
      {!disabled ? (
        <input
          type="text"
          value={draft}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) void addTag(draft);
          }}
          placeholder="Add tag"
          className="min-w-[5rem] flex-1 rounded border border-dashed border-[var(--border)] bg-transparent px-2 py-0.5 text-xs"
        />
      ) : tags.length === 0 ? (
        <span className="text-xs text-[var(--muted-foreground)]">—</span>
      ) : null}
    </div>
  );
}
