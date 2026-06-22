import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { useState } from 'react';
import { TenantSessionProvider } from '@/auth/TenantSessionProvider';
import { PreferencesBootstrap } from '@/auth/PreferencesBootstrap';
import { WorkspaceProvider } from '@/hooks/useWorkspaceContext';
import { GovernedActionProvider } from '@/features/approvals/GovernedActionDialog';

export function AppProviders({ children }: { children: ReactNode }): ReactElement {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <TenantSessionProvider>
        <PreferencesBootstrap />
        <WorkspaceProvider>
          <GovernedActionProvider>
            {children}
          </GovernedActionProvider>
        </WorkspaceProvider>
      </TenantSessionProvider>
    </QueryClientProvider>
  );
}
