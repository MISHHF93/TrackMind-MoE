import type { ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { AppProviders } from './providers';

export function RootLayout(): ReactElement {
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  );
}
