import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface RecordColumn {
  key: string;
  label: string;
  className?: string;
}

export function RecordTable({
  columns,
  rows,
  emptyLabel = 'No records.',
  className,
}: {
  columns: RecordColumn[];
  rows: Record<string, ReactNode>[];
  emptyLabel?: string;
  className?: string;
}): ReactElement {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">{emptyLabel}</p>;
  }
  return (
    <div className={cn('overflow-x-auto rounded-md border border-[var(--border)]', className)}>
      <table className="w-full text-sm">
        <thead className="bg-[color-mix(in_srgb,var(--brand-navy)_6%,var(--muted))]">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cn('px-3 py-2 text-left font-medium text-[var(--text-strong)]', col.className)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-[var(--border)] bg-[var(--card)]">
              {columns.map((col) => (
                <td key={col.key} className={cn('px-3 py-2 align-top', col.className)}>
                  {row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function mapRecords(
  records: Record<string, unknown>[],
  mapper: (record: Record<string, unknown>, index: number) => Record<string, ReactNode>,
  limit = 12,
): Record<string, ReactNode>[] {
  return records.slice(0, limit).map(mapper);
}
