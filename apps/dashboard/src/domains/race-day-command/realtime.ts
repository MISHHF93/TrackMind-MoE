import { useEffect, useMemo, useState } from 'react';
import { createRealtimeService, type EventSourceLike, type RealtimeSnapshot } from '../../api/realtime.js';
import type { LiveEventDto, StreamingDataSourceDto } from '../../types.js';

export interface RaceDayWebSocketLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  close(): void;
}

export interface SignalRConnectionLike {
  start(): Promise<void>;
  stop(): Promise<void>;
  on(eventName: string, callback: (payload: unknown) => void): void;
}

export interface RaceDayLiveSnapshot<T = unknown> {
  connection: 'connecting' | 'connected' | 'degraded' | 'offline' | 'mock';
  url: string;
  latest?: T;
  lastUpdatedAt?: string;
  warnings: string[];
}

export interface SignalRSyncSnapshot {
  connection: RaceDayLiveSnapshot['connection'];
  hubUrl: string;
  deviceCount: number;
  lastSyncAt?: string;
  warnings: string[];
}

export const raceDayRealtimeSources = {
  raceStateWebSocket: '/api/v1/live',
  approvalNotificationsSse: '/api/v1/approvals/notifications',
  azureSignalRHub: '/api/v1/live/signalr',
} as const;

const approvalSource: StreamingDataSourceDto = {
  url: raceDayRealtimeSources.approvalNotificationsSse,
  mode: 'live',
  transport: 'server-sent-events',
  label: 'Race-day approval request notifications',
  mock: false,
  safeForStateMutation: false,
  reconnectStrategy: { initialDelayMs: 1000, maxDelayMs: 30000, backoff: 'exponential' },
};

function defaultWebSocketFactory(url: string): RaceDayWebSocketLike {
  if (typeof WebSocket === 'undefined') throw new Error('WebSocket is unavailable in this runtime.');
  return new WebSocket(url);
}

export function useRaceStateWebSocket<T = unknown>(options: { url?: string; webSocketFactory?: (url: string) => RaceDayWebSocketLike; enabled?: boolean } = {}) {
  const url = options.url ?? raceDayRealtimeSources.raceStateWebSocket;
  const createSocket = options.webSocketFactory ?? defaultWebSocketFactory;
  const enabled = options.enabled ?? true;
  const [snapshot, setSnapshot] = useState<RaceDayLiveSnapshot<T>>({ connection: enabled ? 'connecting' : 'offline', url, warnings: ['WebSocket source is read-only race state; commands still require approval APIs.'] });

  useEffect(() => {
    if (!enabled) return undefined;
    let socket: RaceDayWebSocketLike | undefined;
    try {
      socket = createSocket(url);
      socket.onopen = () => setSnapshot((current) => ({ ...current, connection: 'connected', warnings: current.warnings }));
      socket.onmessage = (message) => {
        let latest: T | undefined;
        try { latest = JSON.parse(message.data) as T; } catch { latest = message.data as T; }
        setSnapshot({ connection: 'connected', url, latest, lastUpdatedAt: new Date().toISOString(), warnings: ['Live race state received from /api/v1/live.'] });
      };
      socket.onerror = () => setSnapshot((current) => ({ ...current, connection: current.latest ? 'degraded' : 'offline', warnings: ['WebSocket race state degraded; verify steward backup channel.'] }));
      socket.onclose = () => setSnapshot((current) => ({ ...current, connection: 'offline', warnings: ['WebSocket race state closed.'] }));
    } catch {
      setSnapshot((current) => ({ ...current, connection: 'offline', warnings: ['WebSocket race state unavailable in this runtime.'] }));
    }
    return () => socket?.close();
  }, [createSocket, enabled, url]);

  return snapshot;
}

export function useApprovalNotifications(options: { eventSourceFactory?: (url: string) => EventSourceLike; source?: StreamingDataSourceDto } = {}) {
  const source = options.source ?? approvalSource;
  const service = useMemo(() => createRealtimeService(source, { eventSourceFactory: options.eventSourceFactory }), [options.eventSourceFactory, source]);
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(() => service.snapshot());
  const [events, setEvents] = useState<LiveEventDto[]>([]);

  useEffect(() => {
    const unsubscribeSnapshot = service.subscribe(setSnapshot);
    const unsubscribeEvents = service.subscribeToEvents((event) => setEvents((current) => [event, ...current].slice(0, 50)));
    service.connect();
    return () => {
      unsubscribeSnapshot();
      unsubscribeEvents();
      service.close();
    };
  }, [service]);

  return { snapshot, events, reconnect: service.reconnect };
}

export function useAzureSignalRSync(options: { hubUrl?: string; connectionFactory?: (hubUrl: string) => SignalRConnectionLike; enabled?: boolean } = {}) {
  const hubUrl = options.hubUrl ?? raceDayRealtimeSources.azureSignalRHub;
  const enabled = options.enabled ?? true;
  const [snapshot, setSnapshot] = useState<SignalRSyncSnapshot>({ connection: enabled ? 'connecting' : 'offline', hubUrl, deviceCount: 1, warnings: ['Azure SignalR sync keeps steward mobile and command-center panels aligned.'] });

  useEffect(() => {
    if (!enabled || !options.connectionFactory) return undefined;
    const connection = options.connectionFactory(hubUrl);
    connection.on('device-sync', (payload) => {
      const count = typeof payload === 'object' && payload && typeof (payload as Record<string, unknown>).deviceCount === 'number' ? (payload as { deviceCount: number }).deviceCount : 1;
      setSnapshot({ connection: 'connected', hubUrl, deviceCount: count, lastSyncAt: new Date().toISOString(), warnings: ['Azure SignalR multi-device sync active.'] });
    });
    connection.start().then(() => setSnapshot((current) => ({ ...current, connection: 'connected' }))).catch(() => setSnapshot((current) => ({ ...current, connection: 'degraded', warnings: ['Azure SignalR sync degraded; mobile stewards may lag.'] })));
    return () => { void connection.stop(); };
  }, [enabled, hubUrl, options]);

  return snapshot;
}
