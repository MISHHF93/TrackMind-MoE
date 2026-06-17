import type { ReactElement } from 'react';
import { Badge } from './badge';
import { cn } from '@/lib/utils';

export interface KpiItem {
  id: string;
  label: string;
  value: string;
  detail?: string;
  status?: 'nominal' | 'warning' | 'critical' | 'advisory';
}

export function KpiStrip({ items, className }: { items: KpiItem[]; className?: string }): ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6', className)}>
      {items.map((item) => (
        <div key={item.id} className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
          <p className="text-xs text-[var(--muted-foreground)]">{item.label}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{item.value}</p>
          {item.detail ? <p className="mt-1 text-xs text-[var(--muted-foreground)]">{item.detail}</p> : null}
          {item.status ? (
            <Badge variant={item.status === 'critical' ? 'critical' : item.status === 'warning' ? 'warning' : item.status === 'advisory' ? 'advisory' : 'nominal'} className="mt-2">
              {item.status}
            </Badge>
          ) : null}
        </div>
      ))}
    </div>
  );
}
