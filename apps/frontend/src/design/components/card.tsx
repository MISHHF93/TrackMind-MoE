import type { HTMLAttributes, ReactElement } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--brand-navy)_12%,var(--border))] bg-[var(--card)] text-[var(--card-foreground)] shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function CardChrome({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-chrome-raised)] text-[var(--text-strong)] shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('flex flex-col gap-1.5 p-4 pb-2', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>): ReactElement {
  return <h3 className={cn('text-base font-semibold leading-none tracking-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>): ReactElement {
  return <p className={cn('text-sm text-[var(--muted-foreground)]', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('p-4 pt-0', className)} {...props} />;
}
