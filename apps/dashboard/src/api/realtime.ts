import type { LiveEventDto, StreamingConnectionStatusDto, StreamingDataSourceDto } from '../types.js';

export type RealtimeListener = (snapshot: RealtimeSnapshot) => void;
export type RealtimeEventListener = (event: LiveEventDto) => void;

export interface RealtimeSnapshot {
  connection: StreamingConnectionStatusDto;
  lastUpdatedAt?: string;
  stale: boolean;
  degraded: boolean;
  reconnectAttempts: number;
  warnings: string[];
}

export interface EventSourceLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface RealtimeServiceOptions {
  staleAfterMs?: number;
  eventSourceFactory?: (url: string) => EventSourceLike;
}

export interface RealtimeService {
  readonly source: StreamingDataSourceDto;
  connect(): void;
  reconnect(): void;
  close(): void;
  snapshot(): RealtimeSnapshot;
  subscribe(listener: RealtimeListener): () => void;
  subscribeToEvents(listener: RealtimeEventListener): () => void;
}

const defaultStaleAfterMs = 5 * 60 * 1000;

function eventSourceFactory(url: string): EventSourceLike {
  if (typeof EventSource === 'undefined') throw new Error('EventSource is unavailable in this runtime.');
  return new EventSource(url);
}

function isStale(timestamp: string | undefined, staleAfterMs: number) {
  if (!timestamp) return true;
  const parsed = Date.parse(timestamp);
  return !Number.isFinite(parsed) || Date.now() - parsed > staleAfterMs;
}

function parseLiveEvent(data: string): LiveEventDto | undefined {
  try {
    const parsed = JSON.parse(data) as Partial<LiveEventDto>;
    if (typeof parsed.id === 'string' && typeof parsed.timestamp === 'string' && typeof parsed.type === 'string') return parsed as LiveEventDto;
  } catch {
    return undefined;
  }
  return undefined;
}

export function createRealtimeService(source: StreamingDataSourceDto, options: RealtimeServiceOptions = {}): RealtimeService {
  const staleAfterMs = options.staleAfterMs ?? defaultStaleAfterMs;
  const createSource = options.eventSourceFactory ?? eventSourceFactory;
  const listeners = new Set<RealtimeListener>();
  const eventListeners = new Set<RealtimeEventListener>();
  let connection: StreamingConnectionStatusDto = source.mock ? 'mock' : 'connecting';
  let lastUpdatedAt: string | undefined;
  let reconnectAttempts = 0;
  let current: EventSourceLike | undefined;

  const snapshot = (): RealtimeSnapshot => ({
    connection,
    lastUpdatedAt,
    stale: isStale(lastUpdatedAt, staleAfterMs),
    degraded: connection === 'degraded' || connection === 'offline' || connection === 'stale',
    reconnectAttempts,
    warnings: [
      ...(source.mock ? ['MOCK STREAM ACTIVE: visible read-only event stream.'] : []),
      ...(isStale(lastUpdatedAt, staleAfterMs) ? ['Stale data warning: no recent event update.'] : []),
      'Realtime updates are telemetry, event, and status only; protected operational state remains backend-owned.',
    ],
  });

  const emit = () => {
    const value = snapshot();
    listeners.forEach((listener) => listener(value));
  };

  const close = () => {
    current?.close();
    current = undefined;
  };

  const connect = () => {
    close();
    if (source.mock) {
      connection = 'mock';
      lastUpdatedAt = new Date().toISOString();
      emit();
      return;
    }
    try {
      connection = 'connecting';
      current = createSource(source.url);
      current.onopen = () => {
        connection = 'connected';
        reconnectAttempts = 0;
        emit();
      };
      current.onmessage = (message) => {
        const event = parseLiveEvent(message.data);
        lastUpdatedAt = event?.timestamp ?? new Date().toISOString();
        connection = isStale(lastUpdatedAt, staleAfterMs) ? 'stale' : 'connected';
        if (event) eventListeners.forEach((listener) => listener(event));
        emit();
      };
      current.onerror = () => {
        connection = lastUpdatedAt ? 'degraded' : 'offline';
        emit();
      };
    } catch {
      connection = 'offline';
      emit();
    }
  };

  const reconnect = () => {
    reconnectAttempts += 1;
    connect();
  };

  return {
    source,
    connect,
    reconnect,
    close,
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    subscribeToEvents(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
  };
}
