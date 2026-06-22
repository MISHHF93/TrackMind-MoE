import { cloneElement, forwardRef, type InputHTMLAttributes, type ReactElement, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { fieldAccessibilityIds, fieldDescribedBy } from './fieldAccessibility';

const controlClassName =
  'w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(controlClassName, className)} {...rest} />;
});

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  const { className, ...rest } = props;
  return <textarea className={cn(controlClassName, 'min-h-[96px]', className)} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>): ReactElement {
  const { className, children, ...rest } = props;
  return (
    <select className={cn(controlClassName, className)} {...rest}>
      {children}
    </select>
  );
}

export type FormFieldControlProps = {
  id?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  error?: boolean;
};

export function FormField({
  label,
  htmlFor,
  required,
  error,
  helpText,
  children,
  composite = false,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  children: ReactElement<FormFieldControlProps>;
  composite?: boolean;
}): ReactElement {
  const { labelId, helpId, errorId } = fieldAccessibilityIds(htmlFor);
  const describedBy = fieldDescribedBy(htmlFor, helpText, error);

  const control = cloneElement(children, {
    id: composite ? undefined : htmlFor,
    'aria-labelledby': composite ? labelId : undefined,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
    error: Boolean(error),
  });

  const labelContent = (
    <>
      {label}
      {required ? (
        <>
          <span className="text-[var(--status-critical)]" aria-hidden="true"> *</span>
          <span className="sr-only"> (required)</span>
        </>
      ) : (
        <span className="ml-1 text-xs font-normal text-[var(--muted-foreground)]">(optional)</span>
      )}
    </>
  );

  return (
    <div className="grid gap-1.5 text-sm">
      {composite ? (
        <span id={labelId} className="font-medium leading-snug">{labelContent}</span>
      ) : (
        <label id={labelId} htmlFor={htmlFor} className="font-medium leading-snug">{labelContent}</label>
      )}
      {composite ? <div id={htmlFor}>{control}</div> : control}
      {helpText ? (
        <span id={helpId} className="text-xs leading-relaxed text-[var(--muted-foreground)]">{helpText}</span>
      ) : null}
      {error ? (
        <span id={errorId} role="alert" className="text-xs font-medium text-[var(--status-critical)]">{error}</span>
      ) : null}
    </div>
  );
}

export function FormMessage({
  message,
  tone = 'error',
  live = true,
}: {
  message?: string;
  tone?: 'error' | 'muted' | 'success';
  live?: boolean;
}): ReactElement | null {
  if (!message) return null;
  return (
    <p
      role={tone === 'error' ? 'alert' : live ? 'status' : undefined}
      aria-live={live ? (tone === 'error' ? 'assertive' : 'polite') : undefined}
      className={cn(
        'text-sm leading-relaxed',
        tone === 'error' ? 'text-[var(--status-critical)]' : tone === 'success' ? 'text-[var(--status-nominal,#16a34a)]' : 'text-[var(--muted-foreground)]',
      )}
    >
      {message}
    </p>
  );
}

export function FormErrorSummary({
  errors,
  className,
}: {
  errors: string[];
  className?: string;
}): ReactElement | null {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'rounded-md border border-[var(--status-critical)] bg-[color-mix(in_srgb,var(--status-critical)_8%,var(--card))] px-3 py-2 text-sm',
        className,
      )}
    >
      <p className="font-medium text-[var(--status-critical)]">
        {errors.length === 1 ? 'Fix 1 issue before saving' : `Fix ${errors.length} issues before saving`}
      </p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-[var(--foreground)]">
        {errors.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}

export function FormActions({ children, className }: { children: ReactElement | ReactElement[]; className?: string }): ReactElement {
  return <div className={cn('flex flex-wrap items-center gap-2 pt-2', className)}>{children}</div>;
}
