import { forwardRef, type InputHTMLAttributes, type ReactElement } from 'react';
import { Input } from '@/design/components/form-field';
import { cn } from '@/lib/utils';
import { operationalControlClassName } from './_shared';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  error?: boolean;
  className?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, error, disabled, ...rest },
  ref,
): ReactElement {
  return (
    <Input
      ref={ref}
      disabled={disabled}
      aria-invalid={error ? true : rest['aria-invalid']}
      className={cn(operationalControlClassName, error && 'border-[var(--status-critical)]', className)}
      {...rest}
    />
  );
});
