import type {
  MediaExportRequestDto,
  MediaExportResultDto,
  MediaPlaybackDescriptorDto,
  MediaShareLinkRequestDto,
  MediaShareLinkResultDto,
  MediaSnapshotRequestDto,
  MediaSnapshotResultDto,
} from '@trackmind/shared';
import { getJson, postJson } from '@/api/client';

export async function fetchMediaPlayback(ref: string) {
  const query = new URLSearchParams({ ref });
  return getJson<MediaPlaybackDescriptorDto>(`/surveillance-iot/viewer/playback?${query.toString()}`);
}

export async function createMediaSnapshot(body: MediaSnapshotRequestDto) {
  return postJson<MediaSnapshotResultDto>('/surveillance-iot/viewer/snapshot', body);
}

export async function createMediaExport(body: MediaExportRequestDto) {
  return postJson<MediaExportResultDto>('/surveillance-iot/viewer/export', body);
}

export async function createMediaShareLink(body: MediaShareLinkRequestDto) {
  return postJson<MediaShareLinkResultDto>('/surveillance-iot/viewer/share-link', body);
}
