import { useEffect, useMemo, useState } from 'react';
import { createRealtimeService, type RealtimeSnapshot } from '../api/realtime.js';
import type { LiveEventDto, StreamingDataSourceDto } from '../types.js';

export function useRealtimeStream(source: StreamingDataSourceDto) {
  const service = useMemo(() => createRealtimeService(source), [source]);
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(() => service.snapshot());
  const [events, setEvents] = useState<LiveEventDto[]>([]);

  useEffect(() => {
    const unsubscribeSnapshot = service.subscribe(setSnapshot);
    const unsubscribeEvents = service.subscribeToEvents((event) => setEvents((current) => [event, ...current].slice(0, 100)));
    service.connect();
    return () => {
      unsubscribeSnapshot();
      unsubscribeEvents();
      service.close();
    };
  }, [service]);

  return {
    snapshot,
    events,
    reconnect: service.reconnect,
    close: service.close,
  };
}
