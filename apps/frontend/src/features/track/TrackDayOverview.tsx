import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CloudRain, Flag, Users } from 'lucide-react';
import { Button } from '@/design/components/button';
import { cn } from '@/lib/utils';

export interface RaceCardSummary {
  raceId: string;
  raceNumber?: number;
  postTime?: string;
  status?: string;
  distance?: string;
  raceName?: string;
  entries?: number;
}

export interface TrackDayOverviewProps {
  meetName?: string;
  raceDate?: string;
  trackName?: string;
  surfaceGoing?: string;
  surfaceScore?: number;
  forecastRainMm?: number;
  horsesOnGrounds?: number;
  nextRace?: RaceCardSummary;
  races?: RaceCardSummary[];
  workforceCheckedIn?: number;
  workforceDemand?: number;
  className?: string;
}

function formatPostTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function statusClass(status?: string): string {
  if (status === 'critical' || status === 'blocked') return 'track-day-stat--critical';
  if (status === 'watch' || status === 'warning') return 'track-day-stat--watch';
  return 'track-day-stat--ready';
}

export function TrackDayOverview({
  meetName = 'Spring Meet',
  raceDate,
  trackName = 'Main Oval',
  surfaceGoing = 'fast',
  surfaceScore,
  forecastRainMm,
  horsesOnGrounds,
  nextRace,
  races = [],
  workforceCheckedIn,
  workforceDemand,
  className,
}: TrackDayOverviewProps): ReactElement {
  const displayDate = raceDate
    ? new Date(raceDate).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <section className={cn('track-day-overview rounded-xl border border-[var(--border)] bg-[var(--surface-panel)] shadow-[var(--shadow-soft)]', className)}>
      <div className="track-day-overview-header flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-maroon)]">Race day operations</p>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--text-strong)]">{meetName}</h2>
          <p className="text-sm text-[var(--muted-foreground)]">{trackName} · {displayDate}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild><Link to="/race-day">Race office</Link></Button>
          <Button size="sm" variant="outline" asChild><Link to="/equine">Horse registry</Link></Button>
          <Button size="sm" variant="governance" asChild><Link to="/approvals">Approvals</Link></Button>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className={cn('track-day-stat', statusClass(nextRace?.status))}>
          <Flag className="h-4 w-4 text-[var(--brand-maroon)]" />
          <div>
            <p className="track-day-stat-label">Next post</p>
            <p className="track-day-stat-value">
              {nextRace ? `Race ${nextRace.raceNumber ?? '—'}` : 'No race scheduled'}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {nextRace?.raceName ?? nextRace?.distance ?? ''} · {formatPostTime(nextRace?.postTime)}
            </p>
          </div>
        </div>

        <div className="track-day-stat">
          <Clock className="h-4 w-4 text-[var(--brand-blue)]" />
          <div>
            <p className="track-day-stat-label">Surface</p>
            <p className="track-day-stat-value capitalize">{surfaceGoing}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {surfaceScore != null ? `Score ${surfaceScore}` : 'Readiness from surface intelligence'}
            </p>
          </div>
        </div>

        <div className="track-day-stat">
          <CloudRain className="h-4 w-4 text-[var(--brand-blue-light)]" />
          <div>
            <p className="track-day-stat-label">Weather watch</p>
            <p className="track-day-stat-value">
              {forecastRainMm != null ? `${forecastRainMm}mm forecast` : 'Clear'}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">Paddock &amp; far-turn monitoring</p>
          </div>
        </div>

        <div className="track-day-stat">
          <Users className="h-4 w-4 text-[var(--brand-turf)]" />
          <div>
            <p className="track-day-stat-label">On grounds</p>
            <p className="track-day-stat-value">
              {horsesOnGrounds != null ? `${horsesOnGrounds} horses` : '—'}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {workforceCheckedIn != null && workforceDemand != null
                ? `Staff ${workforceCheckedIn}/${workforceDemand} checked in`
                : 'Barn & paddock assignments'}
            </p>
          </div>
        </div>
      </div>

      {races.length > 0 ? (
        <div className="border-t border-[var(--border)] px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Today&apos;s card</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {races.map((race) => (
              <Link
                key={race.raceId}
                to="/race-day"
                className={cn(
                  'track-race-chip shrink-0 rounded-lg border px-3 py-2 text-left transition-colors hover:border-[var(--brand-blue)]',
                  nextRace?.raceId === race.raceId ? 'border-[var(--brand-maroon)] bg-[color-mix(in_srgb,var(--brand-maroon)_6%,var(--surface-panel))]' : 'border-[var(--border)]',
                )}
              >
                <p className="text-xs font-semibold text-[var(--brand-maroon)]">R{race.raceNumber ?? '—'}</p>
                <p className="text-sm font-medium text-[var(--text-strong)]">{formatPostTime(race.postTime)}</p>
                <p className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[8rem]">
                  {race.raceName ?? race.distance ?? race.status ?? ''}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
