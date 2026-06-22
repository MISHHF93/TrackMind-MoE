import type { ReactElement } from 'react';

type MapFeature = {
  id: string;
  layer: string;
  label: string;
  status: string;
  linkedAssetId?: string;
  geometry?: { type: string; coordinates?: { latitude: number; longitude: number } | Array<{ latitude: number; longitude: number }> };
  properties?: Record<string, unknown>;
};

function point(feature: MapFeature): { x: number; y: number } | null {
  const geometry = feature.geometry;
  if (!geometry || geometry.type !== 'Point' || !geometry.coordinates || Array.isArray(geometry.coordinates)) return null;
  const latitude = geometry.coordinates.latitude;
  const longitude = geometry.coordinates.longitude;
  return {
    x: ((longitude + 76.98) / 0.06) * 100,
    y: ((38.08 - latitude) / 0.06) * 100,
  };
}

function statusClass(status: string): string {
  if (status === 'critical') return 'bg-red-500';
  if (status === 'warning' || status === 'in-progress') return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function assetIdFromMapFeature(feature: MapFeature): string | undefined {
  if (feature.linkedAssetId) return feature.linkedAssetId;
  if (feature.properties?.assetId) return String(feature.properties.assetId);
  if (feature.id.startsWith('asset:')) return feature.id.slice('asset:'.length);
  return undefined;
}

export function FacilitiesGeospatialMap({
  map,
  selectedAssetId,
  onAssetSelect,
}: {
  map?: Record<string, unknown> | null;
  selectedAssetId?: string;
  onAssetSelect?: (assetId: string) => void;
}): ReactElement {
  const features = Array.isArray(map?.features) ? map.features as MapFeature[] : [];
  const viewport = map && typeof map.viewport === 'object' ? map.viewport as Record<string, unknown> : undefined;
  const center = viewport && typeof viewport.center === 'object' ? viewport.center as Record<string, unknown> : undefined;

  const selectFeature = (feature: MapFeature) => {
    const assetId = assetIdFromMapFeature(feature);
    if (assetId) onAssetSelect?.(assetId);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Facilities geospatial map</h3>
          <p className="text-xs text-muted-foreground">
            {features.length} features
            {center ? ` · center ${String(center.latitude ?? '—')}, ${String(center.longitude ?? '—')}` : ''}
            {selectedAssetId ? ` · selected ${selectedAssetId}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> nominal</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> watch</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> critical</span>
        </div>
      </div>
      <div className="relative h-72 overflow-hidden rounded-md border border-border bg-slate-950">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <rect x="0" y="0" width="100" height="100" fill="#0f172a" />
          <path d="M8 50 C 25 20, 75 20, 92 50 C 75 80, 25 80, 8 50 Z" fill="none" stroke="#334155" strokeWidth="0.6" />
          {features.map((feature) => {
            const position = point(feature);
            if (!position) return null;
            const assetId = assetIdFromMapFeature(feature);
            const selected = Boolean(assetId && assetId === selectedAssetId);
            return (
              <g key={feature.id}>
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={selected ? '3.2' : '2.4'}
                  className={`${statusClass(feature.status)} ${assetId ? 'cursor-pointer' : ''}`}
                  opacity="0.95"
                  stroke={selected ? '#f8fafc' : 'none'}
                  strokeWidth={selected ? '0.5' : '0'}
                  onClick={() => selectFeature(feature)}
                />
                <title>{`${feature.label} (${feature.layer})${assetId ? ` · ${assetId}` : ''}`}</title>
              </g>
            );
          })}
        </svg>
        {features.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No geospatial features loaded.
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {features.slice(0, 6).map((feature) => {
          const assetId = assetIdFromMapFeature(feature);
          const selected = Boolean(assetId && assetId === selectedAssetId);
          return (
            <button
              key={`${feature.id}-legend`}
              type="button"
              className={`rounded border px-2 py-1 text-left text-xs transition-colors ${selected ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10' : 'border-border/70 hover:border-border'}`}
              disabled={!assetId}
              onClick={() => selectFeature(feature)}
            >
              <div className="font-medium text-foreground">{feature.label}</div>
              <div className="text-muted-foreground">{feature.layer} · {feature.status}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
