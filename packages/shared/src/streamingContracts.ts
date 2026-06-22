import { nexusApiBasePath, type StreamingDataSourceDto } from './apiContracts.js';

export const incidentTimelineStreamEventTypes = ['snapshot', 'heartbeat', 'update'] as const;
export type IncidentTimelineStreamEventType = (typeof incidentTimelineStreamEventTypes)[number];

const defaultReconnectStrategy: StreamingDataSourceDto['reconnectStrategy'] = {
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  backoff: 'exponential',
};

export function incidentTimelineStreamPath(incidentId: string): string {
  return `${nexusApiBasePath}/incidents/${encodeURIComponent(incidentId)}/timeline/stream`;
}

export function buildIncidentTimelineStreamSource(
  incidentId: string,
  options: { apiBase?: string; mock?: boolean } = {},
): StreamingDataSourceDto {
  const path = incidentTimelineStreamPath(incidentId);
  const url = options.apiBase ? `${options.apiBase.replace(/\/$/, '')}${path}` : path;
  return {
    url,
    mode: options.mock ? 'mock' : 'live',
    transport: 'server-sent-events',
    label: `Incident ${incidentId} timeline stream`,
    mock: options.mock ?? false,
    safeForStateMutation: false,
    reconnectStrategy: defaultReconnectStrategy,
  };
}

export const analyticsWorkspaceStreamEventTypes = ['snapshot', 'heartbeat'] as const;
export type AnalyticsWorkspaceStreamEventType = (typeof analyticsWorkspaceStreamEventTypes)[number];

export function analyticsWorkspaceStreamPath(): string {
  return `${nexusApiBasePath}/analytics/workspace/stream`;
}

export function buildAnalyticsWorkspaceStreamSource(
  options: { apiBase?: string; mock?: boolean } = {},
): StreamingDataSourceDto {
  const path = analyticsWorkspaceStreamPath();
  const url = options.apiBase ? `${options.apiBase.replace(/\/$/, '')}${path}` : path;
  return {
    url,
    mode: options.mock ? 'mock' : 'live',
    transport: 'server-sent-events',
    label: 'Analytics workspace stream',
    mock: options.mock ?? false,
    safeForStateMutation: false,
    reconnectStrategy: defaultReconnectStrategy,
  };
}
