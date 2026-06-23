import { useState, type ReactElement } from 'react';
import type { MediaAssetRef, MediaViewerOutputCapabilityDto } from '@trackmind/shared';
import { Button } from '@/design/components/button';
import { SectionPanel } from '@/design/components/section-panel';
import { createMediaExport, createMediaShareLink, createMediaSnapshot } from '@/api/mediaViewerApi';

export interface MediaOutputPanelProps {
  activeRef?: MediaAssetRef;
  capabilities: MediaViewerOutputCapabilityDto[];
}

function capabilityEnabled(capabilities: MediaViewerOutputCapabilityDto[], action: MediaViewerOutputCapabilityDto['action']): boolean {
  return capabilities.find((entry) => entry.action === action)?.enabled ?? false;
}

export function MediaOutputPanel({ activeRef, capabilities }: MediaOutputPanelProps): ReactElement {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: 'snapshot' | 'export' | 'share-link') {
    if (!activeRef) {
      setMessage('Select a live camera or recorded clip first.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (action === 'snapshot') {
        const result = await createMediaSnapshot({ ref: activeRef });
        setMessage(result.status === 'ready' && result.data ? `Snapshot job ${result.data.jobId}` : result.message ?? 'Snapshot failed');
      } else if (action === 'export') {
        const result = await createMediaExport({ ref: activeRef, format: 'mp4' });
        setMessage(result.status === 'ready' && result.data ? `Export job ${result.data.jobId}` : result.message ?? 'Export failed');
      } else {
        const result = await createMediaShareLink({ ref: activeRef, expiresInMinutes: 60 });
        if (result.status === 'ready' && result.data?.shareUrl) {
          await navigator.clipboard.writeText(result.data.shareUrl).catch(() => undefined);
          setMessage(`Share link copied (expires ${result.data.expiresAt})`);
        } else {
          setMessage(result.message ?? 'Share link failed');
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionPanel title="Media outputs" description="Governed snapshot, export, and share actions for the active asset.">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !activeRef || !capabilityEnabled(capabilities, 'snapshot') || activeRef.kind !== 'live-camera'}
          onClick={() => void run('snapshot')}
        >
          Snapshot
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !activeRef || !capabilityEnabled(capabilities, 'export') || activeRef.kind === 'live-camera'}
          onClick={() => void run('export')}
        >
          Export
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !activeRef || !capabilityEnabled(capabilities, 'share-link') || activeRef.kind === 'live-camera'}
          onClick={() => void run('share-link')}
        >
          Copy share link
        </Button>
      </div>
      {message ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">{message}</p> : null}
    </SectionPanel>
  );
}
