import type {
  MediaAssetRef,
  MediaExportRequestDto,
  MediaExportResultDto,
  MediaShareLinkRequestDto,
  MediaShareLinkResultDto,
  MediaSnapshotRequestDto,
  MediaSnapshotResultDto,
} from '@trackmind/shared';
import { mediaViewerJobId } from './mediaPlaybackResolver.js';

export class MediaOutputService {
  createSnapshot(now: string, input: MediaSnapshotRequestDto): MediaSnapshotResultDto {
    const jobId = mediaViewerJobId('snapshot', now);
    return {
      accepted: true,
      jobId,
      snapshotUrl: `/api/v1/surveillance-iot/viewer/snapshots/${encodeURIComponent(jobId)}.jpg`,
      capturedAt: now,
      mock: true,
    };
  }

  createExport(now: string, input: MediaExportRequestDto): MediaExportResultDto {
    const jobId = mediaViewerJobId('export', now);
    const expiresAt = new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString();
    return {
      accepted: true,
      jobId,
      exportUrl: `/api/v1/surveillance-iot/viewer/exports/${encodeURIComponent(jobId)}.${input.format ?? 'mp4'}`,
      expiresAt,
      mock: true,
    };
  }

  createShareLink(now: string, input: MediaShareLinkRequestDto): MediaShareLinkResultDto {
    const minutes = input.expiresInMinutes ?? 60;
    const expiresAt = new Date(Date.parse(now) + minutes * 60 * 1000).toISOString();
    const refToken = `${input.ref.kind}-${input.ref.id}`;
    return {
      accepted: true,
      shareUrl: `/cctv-viewer?tab=recorded&clip=${encodeURIComponent(`${input.ref.kind}:${input.ref.id}`)}&share=${encodeURIComponent(refToken)}`,
      expiresAt,
      mock: true,
    };
  }
}

export function assertLiveCameraRef(ref: MediaAssetRef): void {
  if (ref.kind !== 'live-camera') {
    throw new Error('Snapshots are only supported for live camera streams.');
  }
}

export function assertRecordedRef(ref: MediaAssetRef): void {
  if (ref.kind === 'live-camera') {
    throw new Error('Export and share links require a recorded clip reference.');
  }
}
