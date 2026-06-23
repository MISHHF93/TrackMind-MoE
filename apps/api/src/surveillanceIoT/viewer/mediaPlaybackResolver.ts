import type { MediaAssetRef, MediaPlaybackDescriptorDto, MediaPlaybackKind } from '@trackmind/shared';

const demoClipUrls: Record<string, string> = {
  's3://stewards/race-7/headon.mp4': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  's3://stewards/race-7/pan-angle.mp4': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'default': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
};

export function resolveStorageUri(storageUri: string | undefined, clipId: string): { url?: string; mock: boolean } {
  if (!storageUri) return { mock: false };
  if (demoClipUrls[storageUri]) return { url: demoClipUrls[storageUri], mock: true };
  if (storageUri.startsWith('s3://evidence-archive/')) {
    const index = clipId.split(':').pop() ?? '0';
    const urls = Object.values(demoClipUrls);
    return { url: urls[Number(index) % urls.length] ?? demoClipUrls.default, mock: true };
  }
  if (storageUri.startsWith('http://') || storageUri.startsWith('https://')) {
    return { url: storageUri, mock: false };
  }
  return { mock: false };
}

export interface MediaPlaybackResolverInput {
  ref: MediaAssetRef;
  title: string;
  storageUri?: string;
  clipStartAt?: string;
  clipEndAt?: string;
  privacyMasked?: boolean;
  legalHold?: boolean;
  redactionTier?: 'none' | 'welfare' | 'restricted';
  custodySummary?: string;
  livePlayback?: {
    playbackKind: MediaPlaybackKind;
    mediaUrl?: string;
  };
}

export class MediaPlaybackResolver {
  resolve(input: MediaPlaybackResolverInput): MediaPlaybackDescriptorDto {
    if (input.ref.kind === 'live-camera' && input.livePlayback) {
      const { playbackKind, mediaUrl } = input.livePlayback;
      return {
        ref: input.ref,
        title: input.title,
        playbackKind: mediaUrl ? playbackKind : 'unavailable',
        mediaUrl,
        privacyMasked: input.privacyMasked ?? false,
        legalHold: input.legalHold ?? false,
        redactionTier: input.redactionTier ?? 'none',
        custodySummary: input.custodySummary,
        mock: false,
      };
    }

    const resolved = resolveStorageUri(input.storageUri, input.ref.id);
    return {
      ref: input.ref,
      title: input.title,
      playbackKind: resolved.url ? 'file' : 'gateway-required',
      mediaUrl: resolved.url,
      startAt: input.clipStartAt,
      endAt: input.clipEndAt,
      privacyMasked: input.privacyMasked ?? false,
      legalHold: input.legalHold ?? false,
      redactionTier: input.redactionTier ?? 'none',
      custodySummary: input.custodySummary,
      mock: resolved.mock,
    };
  }
}

export function mediaViewerJobId(prefix: string, now: string): string {
  return `${prefix}_${now.replace(/[:.]/g, '')}`;
}
