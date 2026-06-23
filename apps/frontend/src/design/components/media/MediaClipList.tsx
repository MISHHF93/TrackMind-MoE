import type { ReactElement } from 'react';
import type { MediaViewerClipDto } from '@trackmind/shared';
import { encodeMediaAssetRef } from '@trackmind/shared';
import { Badge } from '@/design/components/badge';
import { cn } from '@/lib/utils';

export interface MediaClipListProps {
  clips: MediaViewerClipDto[];
  activeRef?: string;
  onSelect: (ref: string) => void;
  domainFilter?: MediaViewerClipDto['sourceDomain'] | 'all';
  onDomainFilterChange?: (domain: MediaViewerClipDto['sourceDomain'] | 'all') => void;
}

export function MediaClipList({
  clips,
  activeRef,
  onSelect,
  domainFilter = 'all',
  onDomainFilterChange,
}: MediaClipListProps): ReactElement {
  const filtered = domainFilter === 'all' ? clips : clips.filter((clip) => clip.sourceDomain === domainFilter);

  return (
    <div className="space-y-3">
      {onDomainFilterChange ? (
        <label className="text-xs font-medium">
          Source
          <select
            className="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            value={domainFilter}
            onChange={(event) => onDomainFilterChange(event.target.value as MediaViewerClipDto['sourceDomain'] | 'all')}
          >
            <option value="all">All domains</option>
            <option value="cctv">CCTV</option>
            <option value="steward">Steward</option>
            <option value="incident">Incident</option>
            <option value="security">Security</option>
          </select>
        </label>
      ) : null}

      <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
        {filtered.map((clip) => {
          const ref = encodeMediaAssetRef(clip.ref);
          const active = activeRef === ref;
          return (
            <li key={ref}>
              <button
                type="button"
                onClick={() => onSelect(ref)}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  active ? 'border-[var(--ring)] bg-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--accent)]/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{clip.title}</span>
                  <Badge variant="secondary">{clip.sourceDomain}</Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {clip.playbackCapable ? 'Playback available' : 'Metadata only'}
                  {clip.durationSeconds ? ` · ${clip.durationSeconds}s` : ''}
                </p>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="text-sm text-[var(--muted-foreground)]">No recorded clips in this filter.</li>
        ) : null}
      </ul>
    </div>
  );
}
