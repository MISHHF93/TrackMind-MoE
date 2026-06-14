import type { ReactNode } from 'react';
import type { LoadState } from '@trackmind/shared';
import { EmptyState as NexusEmptyState, ErrorState as NexusErrorState, LoadingSkeleton, MockDataBanner, SafetyCriticalButton } from './nexus-ui.js';

export function LoadingState({ label = 'Loading live operational data...' }: { label?: string }) {
  return <LoadingSkeleton label={label} adapter="live" />;
}

export function ErrorState({ message, mock = false }: { message: string; mock?: boolean }) {
  return NexusErrorState({ message, mock });
}

export function EmptyState({ message = 'No records available', mock = false }: { message?: string; mock?: boolean }) {
  return NexusEmptyState({ message, mock });
}

export function DataState<T>({ state, children }: { state: LoadState<T>; children: (data: T) => ReactNode }) {
  if (state.status === 'loading') return LoadingState({});
  if (state.status === 'error') return ErrorState({ message: state.message, mock: state.mock });
  if (state.status === 'empty') return EmptyState({ mock: state.mock });
  return <section aria-label="Ready data state" data-state={state.stale ? 'stale' : 'ready'} data-adapter={state.mock ? 'mock' : 'live'} data-stale={state.stale || undefined}>{MockDataBanner({ active: state.mock })}{state.stale && <p className="state-message" role="alert" data-state="stale" data-tone="warning">Stale data warning: cached read-only data is visible until the live adapter refreshes.</p>}{children(state.data)}</section>;
}

export function SafetyButton({ disabled, children, reason }: { disabled: boolean; children: ReactNode; reason?: string }) {
  const reasonId = reason ? 'safety-button-reason' : undefined;
  return <SafetyCriticalButton approvalsSatisfied={!disabled} backendLive={!disabled} authenticated={!disabled} describedById={reasonId ?? 'safety-button-ready'} reason={reason ?? 'Approval-gated action is disabled.'}>{children}</SafetyCriticalButton>;
}
