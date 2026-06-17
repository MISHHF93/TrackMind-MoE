import type { ReactElement } from 'react';

export function DegradedStateBanner({ message }: { message: string }): ReactElement {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900" role="status">
      {message}
    </div>
  );
}
