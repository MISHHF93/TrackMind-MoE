import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export function UnsavedChangesGuard({
  when,
  message = 'You have unsaved changes. Leave this page anyway?',
}: {
  when: boolean;
  message?: string;
}): ReactElement | null {
  const blocker = useBlocker(when);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const confirmed = window.confirm(message);
    if (confirmed) blocker.proceed();
    else blocker.reset();
  }, [blocker, message]);

  return null;
}
