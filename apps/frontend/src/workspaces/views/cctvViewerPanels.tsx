import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  MediaViewerClipDto,
  MediaViewerWorkspaceDto,
  SurveillanceCctvViewerGridLayout,
} from '@trackmind/shared';
import { parseMediaAssetRef } from '@trackmind/shared';
import { fetchMediaPlayback } from '@/api/mediaViewerApi';
import { Button } from '@/design/components/button';
import { CctvStreamPlayer } from '@/design/components/cctv/CctvStreamPlayer';
import { MediaClipList } from '@/design/components/media/MediaClipList';
import { MediaOutputPanel } from '@/design/components/media/MediaOutputPanel';
import { MediaPlayer } from '@/design/components/media/MediaPlayer';
import { RecordTable } from '@/design/components/record-table';
import { SectionPanel } from '@/design/components/section-panel';
import { feedData } from '../feedUtils';
import type { WorkspacePanelProps } from './workspacePanelTypes';
import { cn } from '@/lib/utils';

const layoutGridClass: Record<Exclude<SurveillanceCctvViewerGridLayout, 'focus'>, string> = {
  '1x1': 'grid-cols-1',
  '2x2': 'grid-cols-1 sm:grid-cols-2',
  '3x3': 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  '4x4': 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
};

type ViewerTab = 'live' | 'recorded' | 'inputs' | 'outputs';

function tabButtonClass(active: boolean): string {
  return cn(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    active ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50',
  );
}

export function CctvViewerPanels({ results }: WorkspacePanelProps): ReactElement {
  const viewer = feedData<MediaViewerWorkspaceDto>(results, '/surveillance-iot/viewer/workspace');
  const [searchParams, setSearchParams] = useSearchParams();
  const [layout, setLayout] = useState<SurveillanceCctvViewerGridLayout>(viewer?.defaultLayout ?? '2x2');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [clipDomainFilter, setClipDomainFilter] = useState<'all' | MediaViewerClipDto['sourceDomain']>('all');

  const tab = (searchParams.get('tab') as ViewerTab | null) ?? 'live';
  const focusedCameraId = searchParams.get('camera') ?? viewer?.focusedCameraId;
  const clipRef = searchParams.get('clip') ?? undefined;

  const playbackQuery = useQuery({
    queryKey: ['media-playback', clipRef],
    queryFn: async () => {
      if (!clipRef) throw new Error('Missing clip ref');
      const result = await fetchMediaPlayback(clipRef);
      if (result.status !== 'ready' || !result.data) throw new Error(result.message ?? 'Playback unavailable');
      return result.data;
    },
    enabled: tab === 'recorded' && Boolean(clipRef),
    retry: 1,
  });

  const filteredTiles = useMemo(() => {
    if (!viewer) return [];
    const tiles = zoneFilter === 'all'
      ? viewer.tiles
      : viewer.tiles.filter((tile) => (tile.zoneId ?? 'unassigned') === zoneFilter);
    if (focusedCameraId) {
      return tiles.filter((tile) => tile.cameraId === focusedCameraId);
    }
    return tiles;
  }, [viewer, zoneFilter, focusedCameraId]);

  const activeRef = useMemo(() => {
    if (tab === 'recorded' && clipRef) return parseMediaAssetRef(clipRef);
    if (focusedCameraId) return { kind: 'live-camera' as const, id: focusedCameraId, cameraId: focusedCameraId };
    return viewer?.activeRef;
  }, [clipRef, focusedCameraId, tab, viewer?.activeRef]);

  function setTab(next: ViewerTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
  }

  function selectClip(ref: string) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'recorded');
    params.set('clip', ref);
    params.delete('camera');
    setSearchParams(params);
  }

  if (!viewer) {
    return (
      <SectionPanel title="Media viewer unavailable" description="The media viewer workspace could not be loaded.">
        <Button size="sm" variant="outline" asChild>
          <Link to="/cctv-registry">Open CCTV registry</Link>
        </Button>
      </SectionPanel>
    );
  }

  const effectiveLayout: SurveillanceCctvViewerGridLayout = focusedCameraId ? 'focus' : layout;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        <button type="button" className={tabButtonClass(tab === 'live')} onClick={() => setTab('live')}>Live</button>
        <button type="button" className={tabButtonClass(tab === 'recorded')} onClick={() => setTab('recorded')}>Recorded</button>
        <button type="button" className={tabButtonClass(tab === 'inputs')} onClick={() => setTab('inputs')}>Inputs</button>
        <button type="button" className={tabButtonClass(tab === 'outputs')} onClick={() => setTab('outputs')}>Outputs</button>
      </div>

      {tab === 'live' ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium">
                Layout
                <select
                  className="mt-1 block rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                  value={effectiveLayout === 'focus' ? layout : effectiveLayout}
                  disabled={Boolean(focusedCameraId)}
                  onChange={(event) => setLayout(event.target.value as SurveillanceCctvViewerGridLayout)}
                >
                  <option value="1x1">1×1</option>
                  <option value="2x2">2×2</option>
                  <option value="3x3">3×3</option>
                  <option value="4x4">4×4</option>
                </select>
              </label>
              <label className="text-xs font-medium">
                Zone
                <select
                  className="mt-1 block rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                  value={zoneFilter}
                  onChange={(event) => setZoneFilter(event.target.value)}
                >
                  <option value="all">All zones</option>
                  {viewer.zoneFilterOptions.map((zone) => (
                    <option key={zone.zoneId} value={zone.zoneId}>
                      {zone.label} ({zone.cameraCount})
                    </option>
                  ))}
                </select>
              </label>
              {focusedCameraId ? (
                <Button size="sm" variant="ghost" onClick={() => setSearchParams({ tab: 'live' })}>
                  Exit focus
                </Button>
              ) : null}
            </div>
            {!viewer.streamGatewayConfigured ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                Configure a stream gateway adapter to enable live media URLs.
              </p>
            ) : null}
          </div>

          <div
            className={cn(
              'grid gap-3',
              effectiveLayout === 'focus' ? 'grid-cols-1' : layoutGridClass[effectiveLayout as keyof typeof layoutGridClass],
            )}
          >
            {filteredTiles.map((tile) => (
              <CctvStreamPlayer
                key={tile.cameraId}
                cameraId={tile.cameraId}
                displayName={tile.displayName}
                zoneLabel={tile.zoneLabel}
                streamStatus={tile.streamStatus}
                playbackMode={tile.playbackMode}
                mediaUrl={tile.mediaUrl}
                privacyMaskingEnabled={tile.privacyMaskingEnabled}
                recordingActive={tile.recordingActive}
                ptzCapable={tile.ptzCapable}
                focused={focusedCameraId === tile.cameraId}
                onSelect={() => setSearchParams({ tab: 'live', camera: tile.cameraId })}
              />
            ))}
          </div>

          {filteredTiles.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No cameras match the current filter.</p>
          ) : null}
        </>
      ) : null}

      {tab === 'recorded' ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
          <MediaClipList
            clips={viewer.clips ?? []}
            activeRef={clipRef}
            domainFilter={clipDomainFilter}
            onDomainFilterChange={setClipDomainFilter}
            onSelect={selectClip}
          />
          <div>
            {clipRef && playbackQuery.isLoading ? (
              <p className="text-sm text-[var(--muted-foreground)]">Loading playback…</p>
            ) : null}
            {playbackQuery.data ? (
              <MediaPlayer
                staticTile
                title={playbackQuery.data.title}
                subtitle={playbackQuery.data.ref.kind}
                playbackKind={playbackQuery.data.playbackKind}
                mediaUrl={playbackQuery.data.mediaUrl}
                privacyMaskingEnabled={playbackQuery.data.privacyMasked}
                custodyBanner={playbackQuery.data.custodySummary}
                mockPlayback={playbackQuery.data.mock}
              />
            ) : (
              <SectionPanel title="Recorded playback" description="Select a clip from the list to start governed playback.">
                <p className="text-sm text-[var(--muted-foreground)]">
                  {viewer.clips.length} clips available across CCTV, steward, and incident sources.
                </p>
              </SectionPanel>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'inputs' ? (
        <RecordTable
          columns={[
            { key: 'label', label: 'Source' },
            { key: 'sourceKind', label: 'Kind' },
            { key: 'protocol', label: 'Protocol' },
            { key: 'status', label: 'Status' },
            { key: 'ingest', label: 'Ingest' },
            { key: 'playback', label: 'Playback' },
          ]}
          rows={(viewer.inputs ?? []).map((input) => ({
            label: input.label,
            sourceKind: input.sourceKind,
            protocol: input.protocol ?? '—',
            status: input.status,
            ingest: input.ingestEndpointRef ?? '—',
            playback: input.playbackEndpointRef ?? '—',
          }))}
        />
      ) : null}

      {tab === 'outputs' ? (
        <MediaOutputPanel activeRef={activeRef} capabilities={viewer.outputCapabilities ?? []} />
      ) : null}
    </div>
  );
}
