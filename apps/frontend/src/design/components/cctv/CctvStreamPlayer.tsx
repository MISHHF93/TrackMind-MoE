import type { ReactElement } from 'react';
import type { SurveillanceCctvViewerPlaybackMode, SurveillanceIoTStreamStatus } from '@trackmind/shared';
import { MediaPlayer } from '@/design/components/media/MediaPlayer';

export interface CctvStreamPlayerProps {
  cameraId: string;
  displayName: string;
  zoneLabel?: string;
  streamStatus: SurveillanceIoTStreamStatus;
  playbackMode: SurveillanceCctvViewerPlaybackMode;
  mediaUrl?: string;
  privacyMaskingEnabled?: boolean;
  recordingActive?: boolean;
  ptzCapable?: boolean;
  focused?: boolean;
  className?: string;
  onSelect?: () => void;
  staticTile?: boolean;
}

function mapPlaybackMode(mode: SurveillanceCctvViewerPlaybackMode, mediaUrl?: string) {
  if (!mediaUrl) {
    if (mode === 'webrtc') return 'webrtc' as const;
    if (mode === 'gateway-required' || mode === 'simulated-preview') return 'gateway-required' as const;
    return 'unavailable' as const;
  }
  if (mode === 'hls') return 'hls' as const;
  if (mode === 'mjpeg') return 'mjpeg' as const;
  if (mode === 'webrtc') return 'webrtc' as const;
  return 'unavailable' as const;
}

export function CctvStreamPlayer({
  cameraId,
  displayName,
  zoneLabel,
  streamStatus,
  playbackMode,
  mediaUrl,
  privacyMaskingEnabled,
  recordingActive,
  ptzCapable,
  focused,
  className,
  onSelect,
  staticTile,
}: CctvStreamPlayerProps): ReactElement {
  return (
    <MediaPlayer
      title={displayName}
      subtitle={zoneLabel ?? cameraId}
      playbackKind={mapPlaybackMode(playbackMode, mediaUrl)}
      mediaUrl={mediaUrl}
      streamStatus={streamStatus}
      privacyMaskingEnabled={privacyMaskingEnabled}
      recordingActive={recordingActive}
      ptzCapable={ptzCapable}
      focused={focused}
      className={className}
      onSelect={onSelect}
      staticTile={staticTile}
    />
  );
}
