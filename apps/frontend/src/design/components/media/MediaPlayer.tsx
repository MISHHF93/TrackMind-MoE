import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import Hls from 'hls.js';
import type { MediaPlaybackKind, SurveillanceIoTStreamStatus } from '@trackmind/shared';
import { Badge } from '@/design/components/badge';
import { cn } from '@/lib/utils';

export interface MediaPlayerProps {
  title: string;
  subtitle?: string;
  playbackKind: MediaPlaybackKind;
  mediaUrl?: string;
  streamStatus?: SurveillanceIoTStreamStatus;
  privacyMaskingEnabled?: boolean;
  recordingActive?: boolean;
  ptzCapable?: boolean;
  custodyBanner?: string;
  mockPlayback?: boolean;
  focused?: boolean;
  className?: string;
  onSelect?: () => void;
  staticTile?: boolean;
  footer?: ReactNode;
}

function statusVariant(status: SurveillanceIoTStreamStatus | undefined): 'nominal' | 'warning' | 'critical' | 'secondary' {
  if (status === 'live') return 'nominal';
  if (status === 'buffering') return 'warning';
  if (!status) return 'secondary';
  return 'critical';
}

function unavailableMessage(playbackKind: MediaPlaybackKind, streamStatus?: SurveillanceIoTStreamStatus): string {
  if (playbackKind === 'webrtc') return 'WebRTC playback requires a gateway player integration.';
  if (playbackKind === 'gateway-required') return 'Stream gateway not configured for this source.';
  if (streamStatus === 'offline' || streamStatus === 'archived') return 'Source offline or archived.';
  return 'Media URL not available for this asset.';
}

function MediaSurface({
  title,
  subtitle,
  playbackKind,
  mediaUrl,
  streamStatus,
  privacyMaskingEnabled,
  recordingActive,
  ptzCapable,
  custodyBanner,
  mockPlayback,
  footer,
}: MediaPlayerProps): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || playbackKind !== 'hls' || !mediaUrl) return undefined;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(mediaUrl);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = mediaUrl;
    }
    return undefined;
  }, [playbackKind, mediaUrl]);

  const canPlay = Boolean(mediaUrl) && playbackKind !== 'unavailable' && playbackKind !== 'gateway-required' && playbackKind !== 'webrtc';

  return (
    <div className="relative aspect-video w-full bg-[#0a0f14]">
      {playbackKind === 'mjpeg' && mediaUrl ? (
        <img src={mediaUrl} alt={`${title} stream`} className="h-full w-full object-cover" />
      ) : (playbackKind === 'hls' || playbackKind === 'file') && canPlay ? (
        <video
          ref={videoRef}
          src={playbackKind === 'file' ? mediaUrl : undefined}
          className="h-full w-full object-cover"
          autoPlay={playbackKind === 'hls'}
          muted={playbackKind === 'hls'}
          playsInline
          controls
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-950 px-4 text-center">
          <p className="text-sm font-medium text-slate-300">Stream unavailable</p>
          <p className="text-xs text-slate-500">{unavailableMessage(playbackKind, streamStatus)}</p>
        </div>
      )}

      {custodyBanner ? (
        <div className="absolute inset-x-0 top-0 bg-amber-950/80 px-2 py-1 text-[10px] text-amber-100">{custodyBanner}</div>
      ) : null}

      {privacyMaskingEnabled ? (
        <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-amber-500/40" aria-hidden />
      ) : null}

      <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
        {streamStatus ? <Badge variant={statusVariant(streamStatus)}>{streamStatus}</Badge> : null}
        {recordingActive ? <Badge variant="critical">REC</Badge> : null}
        {ptzCapable ? <Badge variant="secondary">PTZ</Badge> : null}
        {mockPlayback ? <Badge variant="secondary">DEMO</Badge> : null}
      </div>

      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-2 text-[10px] font-mono text-white/80">
        <span className="truncate">{title}</span>
        <span className="truncate text-right">{subtitle}</span>
      </div>

      {footer ? <div className="absolute right-2 top-2">{footer}</div> : null}
    </div>
  );
}

export function MediaPlayer({
  className,
  focused,
  onSelect,
  staticTile = false,
  ...surfaceProps
}: MediaPlayerProps): ReactElement {
  const shellClass = cn(
    'group relative flex w-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-black text-left shadow-sm',
    !staticTile && 'transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
    focused && 'ring-2 ring-[var(--ring)]',
    className,
  );

  if (staticTile || !onSelect) {
    return (
      <div className={shellClass}>
        <MediaSurface {...surfaceProps} />
      </div>
    );
  }

  return (
    <button type="button" onClick={onSelect} className={shellClass}>
      <MediaSurface {...surfaceProps} />
    </button>
  );
}
