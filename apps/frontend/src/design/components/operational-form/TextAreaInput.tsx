import type { ReactElement, TextareaHTMLAttributes } from 'react';
import { Textarea } from '@/design/components/form-field';
import { cn } from '@/lib/utils';
import { operationalControlClassName } from './_shared';

export interface TextAreaInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  error?: boolean;
  className?: string;
}

export function TextAreaInput({ className, error, disabled, rows = 3, ...rest }: TextAreaInputProps): ReactElement {
  return (
    <Textarea
      rows={rows}
      disabled={disabled}
      aria-invalid={error ? true : rest['aria-invalid']}
      className={cn(operationalControlClassName, 'min-h-[96px]', error && 'border-[var(--status-critical)]', className)}
      {...rest}
    />
  );
}
