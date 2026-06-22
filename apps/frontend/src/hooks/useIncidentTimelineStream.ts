import { useEffect, useRef, useState } from 'react';
import {
  createIncidentTimelineEventSource,
  type IncidentTimelineStreamSnapshot,
  type StreamHeartbeat,
  type StreamStatus,
} from '@/api/sse';
import { useTenantSession } from '@/auth/TenantSessionProvider';

export function useIncidentTimelineStream(incidentId: string | null): {
  timeline: IncidentTimelineStreamSnapshot | null;
  status: StreamStatus;
  revision: number | null;
  lastHeartbeat: StreamHeartbeat | null;
} {
  const [timeline, setTimeline] = useState<IncidentTimelineStreamSnapshot | null>(null);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [revision, setRevision] = useState<number | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<StreamHeartbeat | null>(null);
  const { session } = useTenantSession();
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!incidentId) {
      setTimeline(null);
      setRevision(null);
      setLastHeartbeat(null);
      setStatus('offline');
      return undefined;
    }

    sourceRef.current?.close();
    setStatus('connecting');

    const source = createIncidentTimelineEventSource(
      incidentId,
      (snapshot) => {
        setTimeline(snapshot);
        setRevision(snapshot.revision);
      },
      (heartbeat) => {
        setLastHeartbeat(heartbeat);
        if (typeof heartbeat.revision === 'number') setRevision(heartbeat.revision);
      },
      setStatus,
    );
    sourceRef.current = source;

    return () => source.close();
  }, [incidentId, session.sessionKey]);

  return { timeline, status, revision, lastHeartbeat };
}
