import type { PaddockOperationsDto } from '@trackmind/shared';

const now = () => new Date().toISOString();

export function createPaddockOperationsWorkspace(tenantId = 'trackmind', racetrackId = 'main-track'): PaddockOperationsDto {
  const ts = now();
  return {
    generatedAt: ts,
    tenantId,
    racetrackId,
    assignments: [
      { horseId: 'horse-1', horseName: 'Lifecycle Runner', saddleCloth: 4, paddockSlot: 'A-4', status: 'saddled' },
      { horseId: 'horse-2', horseName: 'Gate Test', saddleCloth: 7, paddockSlot: 'B-2', status: 'waiting' },
    ],
    paradeSchedule: [
      { at: ts, raceId: 'race-7', label: 'Race 7 parade' },
      { at: ts, raceId: 'race-8', label: 'Race 8 parade' },
    ],
    readinessScore: 88,
    gateReadiness: { status: 'ready', lastCheckAt: ts },
    timeline: [
      { at: ts, label: 'Paddock open', status: 'complete' },
      { at: ts, label: 'Saddling complete', status: 'in-progress' },
      { at: ts, label: 'Parade to post', status: 'scheduled' },
    ],
    mock: false,
  };
}
