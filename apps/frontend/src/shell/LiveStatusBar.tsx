import type { ReactElement } from 'react';
import type { StreamHeartbeat, StreamStatus } from '@/api/sse';

const statusLabels: Record<StreamStatus, string> = {
  connecting: 'Connecting to event stream…',
  connected: 'Live event stream connected',
  degraded: 'Event stream degraded',
  offline: 'Backend unavailable — operating in degraded mode',
};

export function LiveStatusBar({ status, lastHeartbeat }: { status: StreamStatus; lastHeartbeat: StreamHeartbeat | null }): ReactElement {
  const pulseClass = status === 'connected' ? 'live-pulse' : status === 'connecting' ? 'live-pulse live-pulse--degraded' : 'live-pulse live-pulse--offline';

  return (
    <div className="shell-chrome-raised border-t border-[var(--border-chrome)] px-4 py-1.5 text-xs text-[var(--text-muted)] flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className={pulseClass} aria-hidden />
        <span>{statusLabels[status]}</span>
      </div>
      {lastHeartbeat?.time ? <span>Last heartbeat: {new Date(lastHeartbeat.time).toLocaleTimeString()}</span> : null}
    </div>
  );
}
