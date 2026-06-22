export function fieldAccessibilityIds(inputId: string) {
  const labelId = `${inputId}-label`;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  return { labelId, helpId, errorId };
}

export function fieldDescribedBy(inputId: string, helpText?: string, error?: string): string | undefined {
  const ids = [
    helpText ? `${inputId}-help` : undefined,
    error ? `${inputId}-error` : undefined,
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
