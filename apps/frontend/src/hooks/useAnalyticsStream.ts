import { useEffect, useRef, useState } from 'react';
import {
  createAnalyticsWorkspaceEventSource,
  type AnalyticsWorkspaceStreamSnapshot,
  type StreamHeartbeat,
  type StreamStatus,
} from '@/api/sse';
import { useTenantSession } from '@/auth/TenantSessionProvider';

export function useAnalyticsStream(): {
  workspace: AnalyticsWorkspaceStreamSnapshot | null;
  status: StreamStatus;
  revision: number | null;
  lastHeartbeat: StreamHeartbeat | null;
} {
  const [workspace, setWorkspace] = useState<AnalyticsWorkspaceStreamSnapshot | null>(null);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [revision, setRevision] = useState<number | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<StreamHeartbeat | null>(null);
  const { session } = useTenantSession();
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    sourceRef.current?.close();
    setStatus('connecting');

    const source = createAnalyticsWorkspaceEventSource(
      (snapshot) => {
        setWorkspace(snapshot);
        setRevision(snapshot.kpiTrends.length);
      },
      (heartbeat) => {
        setLastHeartbeat(heartbeat);
        if (typeof heartbeat.revision === 'number') setRevision(heartbeat.revision);
      },
      setStatus,
    );
    sourceRef.current = source;

    return () => source.close();
  }, [session.sessionKey]);

  return { workspace, status, revision, lastHeartbeat };
}
