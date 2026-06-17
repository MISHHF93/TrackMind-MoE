import { useEffect, useRef, useState } from 'react';
import { createEventSource, type StreamHeartbeat, type StreamStatus } from '@/api/sse';
import { useTenantSession } from '@/auth/TenantSessionProvider';

export function useEventStream(): { status: StreamStatus; lastHeartbeat: StreamHeartbeat | null } {
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [lastHeartbeat, setLastHeartbeat] = useState<StreamHeartbeat | null>(null);
  const { session } = useTenantSession();
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    sourceRef.current?.close();
    const source = createEventSource(
      (data) => setLastHeartbeat(data),
      setStatus,
    );
    sourceRef.current = source;
    return () => source.close();
  }, [session.sessionKey]);

  return { status, lastHeartbeat };
}
