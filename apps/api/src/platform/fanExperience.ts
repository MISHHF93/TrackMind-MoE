import { createSeededFanExperience } from '../fanExperiencePlatform.js';
import type { FanExperienceOperationsDto, FanExperienceRequestResultDto } from '@trackmind/shared';

const now = () => new Date().toISOString();

export function createFanExperienceWorkspace(): FanExperienceOperationsDto {
  return createSeededFanExperience().workspace(now());
}

export type FanExperienceRequestType = 'refund' | 'parking' | 'parking-pass' | 'crowd-density' | 'crowd-density-alert' | 'accessibility';

export function handleFanExperienceRequest(type: FanExperienceRequestType, payload: Record<string, unknown>): FanExperienceRequestResultDto {
  const platform = createSeededFanExperience();
  const category = type === 'accessibility' ? 'accessibility' : type === 'parking' || type === 'parking-pass' ? 'parking' : type === 'crowd-density' || type === 'crowd-density-alert' ? 'crowd-density' : 'refund';
  const result = platform.createGuestServiceRequest({
    category,
    status: 'open',
    priority: category === 'refund' ? 'high' : 'medium',
    submittedAt: now(),
    guestLabel: String(payload.guestLabel ?? 'Guest'),
    zone: payload.zone ? String(payload.zone) : undefined,
    waitMinutes: Number(payload.waitMinutes ?? 0),
    details: String(payload.details ?? `${type} request draft`),
  });
  return {
    ok: true,
    requestId: result.requestId ?? result.auditId,
    type,
    status: 'draft-created',
    mock: false,
  };
}
