import type { FanExperienceWorkspaceDto } from '@trackmind/shared';

const now = () => new Date().toISOString();

export function createFanExperienceWorkspace(): FanExperienceWorkspaceDto {
  return {
    generatedAt: now(),
    attendance: { current: 8420, capacity: 12000, utilizationPercent: 70 },
    guestServices: [
      { id: 'gs-1', category: 'accessibility', status: 'open', waitMinutes: 5 },
      { id: 'gs-2', category: 'guest-relations', status: 'open', waitMinutes: 12 },
      { id: 'gs-3', category: 'parking', status: 'watch', waitMinutes: 20 },
    ],
    crowdDensity: [
      { zone: 'grandstand', level: 'medium' },
      { zone: 'paddock', level: 'high' },
      { zone: 'club-level', level: 'low' },
    ],
    hospitalityReadiness: { score: 91, openIssues: 2 },
    ticketInventory: { available: 3580, sold: 8420, held: 120 },
    mock: false,
  };
}

export type FanExperienceRequestType = 'refund' | 'parking' | 'crowd-density' | 'accessibility';

export function handleFanExperienceRequest(type: FanExperienceRequestType, payload: Record<string, unknown>): { ok: true; requestId: string; type: FanExperienceRequestType; status: 'draft-created'; mock: false } {
  return {
    ok: true,
    requestId: `fan-${type}-${Date.now().toString(36)}`,
    type,
    status: 'draft-created',
    mock: false,
  };
}
