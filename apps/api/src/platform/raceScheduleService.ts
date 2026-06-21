import type { RaceScheduleDto } from '@trackmind/shared';
import type { PaddockOperationsPlatform } from '../paddockOperationsPlatform.js';
import type { RaceCardManagementPlatform } from '../raceCardManagement.js';
import type { SurfaceIntelligencePlatform } from '../surfaceIntelligencePlatform.js';

export interface RaceScheduleServiceDeps {
  tenantId?: string;
  racetrackId?: string;
  raceCardManagement?: RaceCardManagementPlatform;
  raceOffice?: { lifecycle?: Array<{ raceId: string; status: string }> };
  paddockOperations?: PaddockOperationsPlatform;
  surfaceIntelligence?: SurfaceIntelligencePlatform;
}

function lifecycleStatus(
  raceId: string,
  lifecycle: Array<{ raceId: string; status: string }> | undefined,
  fallback: string,
): string {
  return lifecycle?.find((entry) => entry.raceId === raceId)?.status ?? fallback;
}

export function createRaceScheduleWorkspace(
  deps: RaceScheduleServiceDeps,
  now = new Date().toISOString(),
): RaceScheduleDto {
  const tenantId = deps.tenantId ?? 'trackmind';
  const racetrackId = deps.racetrackId ?? 'main-track';
  const cards = deps.raceCardManagement?.workspace(now).raceCards ?? [];
  const lifecycle = deps.raceOffice?.lifecycle ?? [];
  const paddockTimeline = deps.paddockOperations?.workspace(now).timeline ?? [];
  const surface = deps.surfaceIntelligence?.workspace(now);
  const weatherMm = surface?.weatherObservation.forecastRainMm;

  const sortedCards = [...cards].sort((left, right) => left.raceNumber - right.raceNumber);
  const raceDate = sortedCards[0]?.raceDate ?? now.slice(0, 10);

  const races = sortedCards.length
    ? sortedCards.map((card) => ({
        raceId: card.id,
        raceNumber: card.raceNumber,
        postTime: card.scheduledPostTime,
        status: lifecycleStatus(card.id, lifecycle, card.lifecycleStatus),
        surface: card.conditions?.surface ?? 'dirt',
      }))
    : [
        { raceId: 'race-7', raceNumber: 7, postTime: '2026-06-17T18:30:00.000Z', status: 'ready', surface: 'dirt' },
        { raceId: 'race-8', raceNumber: 8, postTime: '2026-06-17T19:05:00.000Z', status: 'scheduled', surface: 'dirt' },
      ];

  const timeline: RaceScheduleDto['timeline'] = [
    { at: now, label: 'Race-day card published', status: sortedCards.some((card) => card.lifecycleStatus === 'published') ? 'complete' : 'scheduled' },
    ...paddockTimeline.map((entry) => ({ at: entry.at, label: entry.label, status: entry.status })),
    ...races.map((race) => ({
      at: race.postTime,
      label: `Race ${race.raceNumber} post`,
      status: race.status,
    })),
  ];

  if (weatherMm != null) {
    timeline.push({
      at: now,
      label: `Weather watch (${weatherMm}mm forecast rain)`,
      status: weatherMm > 10 ? 'watch' : 'nominal',
    });
  }

  return {
    generatedAt: now,
    tenantId,
    racetrackId,
    raceDate,
    races,
    timeline,
    mock: false,
  };
}
