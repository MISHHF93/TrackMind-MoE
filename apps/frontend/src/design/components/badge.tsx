import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactElement } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors', {
  variants: {
    variant: {
      default: 'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]',
      secondary: 'border-transparent bg-[var(--muted)] text-[var(--foreground)]',
      outline: 'text-[var(--foreground)] border-[var(--border)]',
      nominal: 'border-transparent bg-[color-mix(in_srgb,var(--status-nominal)_15%,transparent)] text-[var(--status-nominal)]',
      warning: 'border-transparent bg-[color-mix(in_srgb,var(--status-warning)_15%,transparent)] text-[var(--status-warning)]',
      critical: 'border-transparent bg-[color-mix(in_srgb,var(--status-critical)_15%,transparent)] text-[var(--status-critical)]',
      advisory: 'border-transparent bg-[color-mix(in_srgb,var(--status-advisory)_15%,transparent)] text-[var(--status-advisory)]',
      maroon: 'border-transparent bg-[color-mix(in_srgb,var(--brand-maroon)_12%,transparent)] text-[var(--brand-maroon)]',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): ReactElement {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function PostureBadge({ posture, label, onChrome = false }: { posture: string; label: string; onChrome?: boolean }): ReactElement {
  return (
    <span className={cn(`posture-badge posture-badge--${posture}`, onChrome && 'posture-badge--chrome')}>
      {label}
    </span>
  );
}
