import { apiUrl } from './paths';
import { getTenantContext } from '@/auth/session';

export type StreamStatus = 'connecting' | 'connected' | 'degraded' | 'offline';

export interface StreamHeartbeat {
  time?: string;
  service?: string;
  requestId?: string;
}

export function streamUrl(): string {
  return apiUrl('/events/stream');
}

export function createEventSource(onHeartbeat: (data: StreamHeartbeat) => void, onStatus: (status: StreamStatus) => void): EventSource {
  const tenantContext = getTenantContext();
  const url = new URL(streamUrl(), window.location.origin);
  url.searchParams.set('tenantId', tenantContext.tenantId);
  url.searchParams.set('racetrackId', tenantContext.racetrackId);
  url.searchParams.set('organizationId', tenantContext.organizationId);
  url.searchParams.set('role', tenantContext.role);

  onStatus('connecting');
  let receivedHeartbeat = false;

  const source = new EventSource(url.toString());

  source.addEventListener('heartbeat', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as StreamHeartbeat;
      receivedHeartbeat = true;
      onHeartbeat(data);
      onStatus('connected');
    } catch {
      onStatus('degraded');
    }
  });

  source.onopen = () => {
    if (!receivedHeartbeat) onStatus('connecting');
  };

  source.onerror = () => {
    // API returns a single heartbeat then closes — treat as connected if we received data.
    onStatus(receivedHeartbeat ? 'connected' : 'offline');
  };

  return source;
}
