import { apiUrl, apiPaths } from './paths';
import { getTenantContext } from '@/auth/session';
import type { IncidentTimelineDto, AnalyticsWorkspaceDto } from '@trackmind/shared';

export type StreamStatus = 'connecting' | 'connected' | 'degraded' | 'offline';

export interface StreamHeartbeat {
  time?: string;
  service?: string;
  requestId?: string;
  incidentId?: string;
  revision?: number;
  forecastingReadinessScore?: number;
}

export interface IncidentTimelineStreamSnapshot extends IncidentTimelineDto {}

export interface AnalyticsWorkspaceStreamSnapshot extends AnalyticsWorkspaceDto {}

export function streamUrl(): string {
  return apiUrl('/events/stream');
}

export function incidentTimelineStreamUrl(incidentId: string): string {
  return apiUrl(apiPaths.incidents.timelineStream(incidentId));
}

export function analyticsWorkspaceStreamUrl(): string {
  return apiUrl(apiPaths.analytics.workspaceStream);
}

function withTenantContext(url: URL): URL {
  const tenantContext = getTenantContext();
  url.searchParams.set('tenantId', tenantContext.tenantId);
  url.searchParams.set('racetrackId', tenantContext.racetrackId);
  url.searchParams.set('organizationId', tenantContext.organizationId);
  url.searchParams.set('role', tenantContext.role);
  return url;
}

export function createEventSource(onHeartbeat: (data: StreamHeartbeat) => void, onStatus: (status: StreamStatus) => void): EventSource {
  const url = withTenantContext(new URL(streamUrl(), window.location.origin));

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

export function createIncidentTimelineEventSource(
  incidentId: string,
  onSnapshot: (data: IncidentTimelineStreamSnapshot) => void,
  onHeartbeat: (data: StreamHeartbeat) => void,
  onStatus: (status: StreamStatus) => void,
): EventSource {
  const url = withTenantContext(new URL(incidentTimelineStreamUrl(incidentId), window.location.origin));

  onStatus('connecting');
  let receivedEvent = false;

  const source = new EventSource(url.toString());

  source.addEventListener('snapshot', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as IncidentTimelineStreamSnapshot;
      receivedEvent = true;
      onSnapshot(data);
      onStatus('connected');
    } catch {
      onStatus('degraded');
    }
  });

  source.addEventListener('heartbeat', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as StreamHeartbeat;
      receivedEvent = true;
      onHeartbeat(data);
      onStatus('connected');
    } catch {
      onStatus('degraded');
    }
  });

  source.onopen = () => {
    if (!receivedEvent) onStatus('connecting');
  };

  source.onerror = () => {
    onStatus(receivedEvent ? 'connected' : 'offline');
  };

  return source;
}

export function createAnalyticsWorkspaceEventSource(
  onSnapshot: (data: AnalyticsWorkspaceStreamSnapshot) => void,
  onHeartbeat: (data: StreamHeartbeat) => void,
  onStatus: (status: StreamStatus) => void,
): EventSource {
  const url = withTenantContext(new URL(analyticsWorkspaceStreamUrl(), window.location.origin));

  onStatus('connecting');
  let receivedEvent = false;

  const source = new EventSource(url.toString());

  source.addEventListener('snapshot', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as AnalyticsWorkspaceStreamSnapshot;
      receivedEvent = true;
      onSnapshot(data);
      onStatus('connected');
    } catch {
      onStatus('degraded');
    }
  });

  source.addEventListener('heartbeat', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as StreamHeartbeat;
      receivedEvent = true;
      onHeartbeat(data);
      onStatus('connected');
    } catch {
      onStatus('degraded');
    }
  });

  source.onopen = () => {
    if (!receivedEvent) onStatus('connecting');
  };

  source.onerror = () => {
    onStatus(receivedEvent ? 'connected' : 'offline');
  };

  return source;
}
