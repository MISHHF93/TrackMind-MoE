import type { DataQualityIssue } from '@trackmind/shared';
import type { ReactElement } from 'react';
import { FormMessage } from '@/design/components/form-field';
import { RecordTable } from '@/design/components/record-table';
import { cn } from '@/lib/utils';

export function DataQualityFeedback({
  issues,
  className,
}: {
  issues: DataQualityIssue[];
  className?: string;
}): ReactElement | null {
  if (issues.length === 0) return null;

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  return (
    <div className={cn('space-y-2', className)}>
      {errors.length > 0 ? (
        <FormMessage tone="error" message={`${errors.length} data-quality issue${errors.length === 1 ? '' : 's'} must be resolved before submit.`} />
      ) : null}
      {warnings.length > 0 ? (
        <FormMessage tone="muted" message={`${warnings.length} advisory warning${warnings.length === 1 ? '' : 's'} — review before commit.`} />
      ) : null}
      <RecordTable
        columns={[
          { key: 'severity', label: 'Severity' },
          { key: 'category', label: 'Category' },
          { key: 'field', label: 'Field' },
          { key: 'message', label: 'Message' },
        ]}
        rows={[...errors, ...warnings].map((issue) => ({
          severity: issue.severity,
          category: issue.category,
          field: issue.field ?? '—',
          message: issue.message,
        }))}
        emptyLabel="No quality issues."
      />
    </div>
  );
}
