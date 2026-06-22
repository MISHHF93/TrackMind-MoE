import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

export interface TrackSector {
  id: string;
  name: string;
  condition?: string;
}

export interface TrackAssetMarker {
  id: string;
  label: string;
  type?: string;
  sectorId?: string;
  status?: string;
}

const sectorAngles: Record<string, { start: number; end: number }> = {
  chute: { start: 200, end: 250 },
  backstretch: { start: 250, end: 340 },
  'far-turn': { start: 340, end: 50 },
  stretch: { start: 50, end: 140 },
};

function sectorPath(startDeg: number, endDeg: number, rx = 38, ry = 22): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const cx = 50;
  const cy = 50;
  const x1 = cx + rx * Math.cos(toRad(startDeg));
  const y1 = cy + ry * Math.sin(toRad(startDeg));
  const x2 = cx + rx * Math.cos(toRad(endDeg));
  const y2 = cy + ry * Math.sin(toRad(endDeg));
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${x1} ${y1} A ${rx} ${ry} 0 ${large} ${sweep} ${x2} ${y2}`;
}

function conditionColor(condition?: string): string {
  if (condition === 'fast') return '#1F6B4A';
  if (condition === 'good') return '#2D5F9E';
  if (condition === 'muddy') return '#9A6700';
  if (condition === 'maintenance') return '#B45309';
  return '#5A6B7D';
}

function statusDot(status?: string): string {
  if (status === 'warning' || status === 'offline') return '#B45309';
  if (status === 'critical') return '#8B1A2A';
  if (status === 'standby') return '#9A7B1A';
  return '#1F6B4A';
}

function markerPosition(sectorId?: string, index = 0): { x: number; y: number } {
  const angles = sectorAngles[sectorId ?? 'backstretch'] ?? sectorAngles.backstretch;
  const mid = (angles.start + angles.end) / 2 + index * 8;
  const rad = (mid * Math.PI) / 180;
  return { x: 50 + 34 * Math.cos(rad), y: 50 + 20 * Math.sin(rad) };
}

export function TrackOvalDiagram({
  sectors = [],
  assets = [],
  gateSectorId = 'backstretch',
  selectedAssetId,
  onAssetSelect,
  className,
  compact = false,
}: {
  sectors?: TrackSector[];
  assets?: TrackAssetMarker[];
  gateSectorId?: string;
  selectedAssetId?: string;
  onAssetSelect?: (assetId: string) => void;
  className?: string;
  compact?: boolean;
}): ReactElement {
  const defaultSectors: TrackSector[] = [
    { id: 'chute', name: 'Chute', condition: 'good' },
    { id: 'backstretch', name: 'Backstretch', condition: 'fast' },
    { id: 'far-turn', name: 'Far Turn', condition: 'maintenance' },
    { id: 'stretch', name: 'Home Stretch', condition: 'good' },
  ];
  const trackSectors = sectors.length ? sectors : defaultSectors;
  const gatePos = markerPosition(gateSectorId, 0);

  return (
    <div className={cn('track-oval-panel rounded-lg border border-[var(--border)] bg-[var(--surface-panel)] p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-strong)]">Track oval</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            {trackSectors.length} sectors · {assets.length} live assets
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--brand-turf)]" /> fast</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--brand-blue)]" /> good</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> maintenance</span>
        </div>
      </div>
      <div className={cn('relative overflow-hidden rounded-md border border-[var(--border)] bg-[#0f1a2e]', compact ? 'h-48' : 'h-72')}>
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Racetrack oval diagram">
          <defs>
            <linearGradient id="track-turf" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a3d2e" />
              <stop offset="100%" stopColor="#0f2a1f" />
            </linearGradient>
          </defs>
          <ellipse cx="50" cy="50" rx="42" ry="26" fill="url(#track-turf)" stroke="#2a4a38" strokeWidth="0.4" />
          <ellipse cx="50" cy="50" rx="36" ry="21" fill="none" stroke="#3d6b52" strokeWidth="0.35" strokeDasharray="1.5 1" opacity="0.6" />
          {trackSectors.map((sector) => {
            const angles = sectorAngles[sector.id];
            if (!angles) return null;
            return (
              <path
                key={sector.id}
                d={sectorPath(angles.start, angles.end)}
                fill="none"
                stroke={conditionColor(sector.condition)}
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.85"
              />
            );
          })}
          <rect x="72" y="62" width="14" height="8" rx="1" fill="#2a3548" stroke="#4a5568" strokeWidth="0.3" />
          <text x="79" y="67.5" textAnchor="middle" fill="#94a3b8" fontSize="2.2">Barns</text>
          <rect x="8" y="38" width="10" height="6" rx="1" fill="#2a3548" stroke="#4a5568" strokeWidth="0.3" />
          <text x="13" y="42.5" textAnchor="middle" fill="#94a3b8" fontSize="2">Paddock</text>
          <g transform={`translate(${gatePos.x}, ${gatePos.y})`}>
            <rect x="-2.5" y="-1.5" width="5" height="3" rx="0.4" fill="#7A1828" stroke="#fff" strokeWidth="0.25" />
            <text y="4.5" textAnchor="middle" fill="#e2e8f0" fontSize="2">Gate</text>
          </g>
          {assets.map((asset, index) => {
            const pos = markerPosition(asset.sectorId, index);
            const selected = asset.id === selectedAssetId;
            return (
              <g
                key={asset.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className={onAssetSelect ? 'cursor-pointer' : undefined}
                onClick={() => onAssetSelect?.(asset.id)}
                role={onAssetSelect ? 'button' : undefined}
                tabIndex={onAssetSelect ? 0 : undefined}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAssetSelect?.(asset.id); }}
              >
                <circle
                  r={selected ? 2.2 : 1.6}
                  fill={statusDot(asset.status)}
                  stroke={selected ? '#fff' : 'transparent'}
                  strokeWidth="0.4"
                />
                {!compact ? (
                  <text y="-2.5" textAnchor="middle" fill="#cbd5e1" fontSize="1.8">{asset.label.slice(0, 12)}</text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      {!compact ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {trackSectors.map((sector) => (
            <span
              key={sector.id}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted-foreground)]"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: conditionColor(sector.condition) }} />
              {sector.name}
              {sector.condition ? ` · ${sector.condition}` : ''}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
