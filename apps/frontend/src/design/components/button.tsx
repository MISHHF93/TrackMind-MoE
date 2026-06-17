import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--brand-blue-light)]',
        secondary: 'bg-[var(--muted)] text-[var(--foreground)] hover:opacity-90',
        outline: 'border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]',
        ghost: 'hover:bg-[var(--muted)]',
        destructive: 'bg-[var(--status-critical)] text-white hover:opacity-90',
        governance: 'border border-[var(--brand-maroon)] bg-transparent text-[var(--brand-maroon)] hover:bg-[color-mix(in_srgb,var(--brand-maroon)_10%,transparent)]',
        chrome: 'border border-[var(--border)] bg-[var(--surface-panel)] text-[var(--text-strong)] hover:bg-[var(--surface-chrome-raised)]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps): ReactElement {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
