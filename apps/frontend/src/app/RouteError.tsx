import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import type { ReactElement } from 'react';
import { ErrorState } from '@/design/components/states';

export function RouteError(): ReactElement {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred while loading this console.';

  return (
    <ErrorState
      title="Console failed to load"
      message={message}
      onRetry={() => window.location.reload()}
    />
  );
}
