import { parseOperationalEvidenceRefs } from '@trackmind/shared';
import { Paperclip, Upload } from 'lucide-react';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { TextAreaInput } from './TextAreaInput';
import { OperationalFieldHint, type OperationalControlProps } from './_shared';

export function AttachmentPlaceholder({
  id,
  value,
  onChange,
  disabled,
  className,
  placeholder = 'Paste evidence URIs or references (one per line)',
}: OperationalControlProps & {
  value: string | string[];
  onChange: (value: string) => void;
  placeholder?: string;
}): ReactElement {
  const refs = parseOperationalEvidenceRefs(value);
  const textValue = typeof value === 'string' ? value : refs.join('\n');

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex items-center gap-2 rounded-md border border-dashed border-[var(--border)] bg-[var(--muted)]/20 px-3 py-4 text-sm text-[var(--muted-foreground)]">
        <Upload className="h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium text-[var(--foreground)]">Attachment upload coming soon</p>
          <p>Paste governed evidence URIs or registry references below until direct upload is enabled.</p>
        </div>
      </div>
      <TextAreaInput
        id={id}
        rows={3}
        disabled={disabled}
        placeholder={placeholder}
        value={textValue}
        onChange={(event) => onChange(event.target.value)}
      />
      {refs.length > 0 ? (
        <ul className="grid gap-1 text-xs text-[var(--muted-foreground)]">
          {refs.map((ref) => (
            <li key={ref} className="flex items-center gap-1.5">
              <Paperclip className="h-3 w-3" aria-hidden />
              <span className="truncate">{ref}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <OperationalFieldHint>Evidence refs are validated on submit and linked to the audit chain.</OperationalFieldHint>
    </div>
  );
}
