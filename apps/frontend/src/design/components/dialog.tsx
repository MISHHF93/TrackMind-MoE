import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>): ReactElement {
  return <DialogPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-black/50', className)} {...props} />;
}

export function DialogContent({
  className,
  children,
  governance = false,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { governance?: boolean }): ReactElement {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg duration-200 rounded-[var(--radius-md)]',
          governance && 'governance-dialog',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: { className?: string; children?: ReactNode }): ReactElement {
  return <div className={cn('flex flex-col gap-1.5 text-center sm:text-left', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>): ReactElement {
  return <DialogPrimitive.Title className={cn('text-lg font-semibold tracking-tight', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>): ReactElement {
  return <DialogPrimitive.Description className={cn('text-sm text-[var(--muted-foreground)]', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: { className?: string; children?: ReactNode }): ReactElement {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2', className)} {...props} />;
}
