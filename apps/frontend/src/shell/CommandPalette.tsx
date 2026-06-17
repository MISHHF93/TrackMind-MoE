import { useEffect, useState, type ReactElement } from 'react';
import type { AppRoute } from '@/routes/routes';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

export function CommandPalette({
  open,
  onOpenChange,
  routes,
  onNavigate,
  initialQuery = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routes: AppRoute[];
  onNavigate: (path: string) => void;
  initialQuery?: string;
}): ReactElement | null {
  const [query, setQuery] = useState(initialQuery);
  const { results: globalResults, loading } = useGlobalSearch(query, open);

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) return null;

  const normalized = query.trim().toLowerCase();
  const matches = normalized
    ? routes.filter((route) => `${route.label} ${route.path}`.toLowerCase().includes(normalized))
    : routes;

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={() => onOpenChange(false)}>
      <div
        className="mx-auto mt-24 w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-[color-mix(in_srgb,var(--brand-navy)_15%,var(--border))] bg-[var(--card)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          className="w-full border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--brand-navy)_4%,var(--card))] px-4 py-3 text-sm outline-none"
          placeholder="Search workspaces, horses, incidents, KPIs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {globalResults.length > 0 ? (
          <div className="border-b border-[var(--border)] p-2">
            <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Global results</p>
            <ul className="max-h-40 overflow-y-auto">
              {globalResults.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--muted)]"
                    onClick={() => {
                      onNavigate(result.path.startsWith('/') ? result.path : `/${result.path}`);
                      onOpenChange(false);
                    }}
                  >
                    <span className="font-medium">{result.title}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {result.kind}
                      {result.subtitle ? ` · ${result.subtitle}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {loading && query.trim().length >= 2 ? (
          <p className="border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-foreground)]">Searching…</p>
        ) : null}
        <ul className="max-h-72 overflow-y-auto p-2">
          <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Workspaces</p>
          {matches.map((route) => (
            <li key={route.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--muted)]"
                onClick={() => {
                  onNavigate(route.path);
                  onOpenChange(false);
                }}
              >
                <span>{route.label}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{route.path}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && globalResults.length === 0 && !loading ? (
            <li className="px-3 py-2 text-sm text-[var(--muted-foreground)]">No matching consoles or records.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
