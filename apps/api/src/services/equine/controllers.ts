import { createEquineIntelligencePrivacyService, type EquineIntelligencePrivacyService } from './service.js';
import { EquineFourLayerPlatformService } from './platform.js';
import type { EquineRequestActor, EquineRole } from './types.js';

export interface EquineControllerResponse {
  status: number;
  body: unknown;
}

const isRecord = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const stringValue = (value: unknown, fallback = '') => typeof value === 'string' && value.length > 0 ? value : fallback;
const optionalString = (value: unknown): string | undefined => typeof value === 'string' && value.length > 0 ? value : undefined;
const roles = new Set<EquineRole>(['veterinarian', 'steward', 'trainer', 'owner', 'regulator', 'public']);

function actorFrom(input: Record<string, any>, searchParams?: URLSearchParams): EquineRequestActor {
  const roleInput = stringValue(input.role, stringValue(searchParams?.get('role'), 'public')) as EquineRole;
  const role = roles.has(roleInput) ? roleInput : 'public';
  return {
    actorId: stringValue(input.actorId, stringValue(searchParams?.get('actorId'), role)),
    role,
    ownerId: optionalString(input.ownerId) ?? optionalString(searchParams?.get('ownerId')),
    trainerId: optionalString(input.trainerId) ?? optionalString(searchParams?.get('trainerId')),
    approvalId: optionalString(input.approvalId) ?? optionalString(searchParams?.get('approvalId')),
    approverId: optionalString(input.approverId) ?? optionalString(searchParams?.get('approverId')),
    approvalTimestamp: optionalString(input.approvalTimestamp) ?? optionalString(searchParams?.get('approvalTimestamp')),
  };
}

export class EquineIntelligenceController {
  readonly platform: EquineFourLayerPlatformService;

  constructor(readonly service: EquineIntelligencePrivacyService = createEquineIntelligencePrivacyService()) {
    this.platform = new EquineFourLayerPlatformService(service, service.audit);
  }

  handle(method: string, path: string, body?: unknown, searchParams?: URLSearchParams): EquineControllerResponse | undefined {
    const profileMatch = path.match(/^\/horses\/([^/]+)\/profile$/);
    const veterinaryMatch = path.match(/^\/horses\/([^/]+)\/veterinary$/);
    const eligibilityMatch = path.match(/^\/horses\/([^/]+)\/eligibility$/);
    const hisaMatch = path.match(/^\/horses\/([^/]+)\/hisa$/);
    const auditMatch = path.match(/^\/horses\/([^/]+)\/audit$/);
    const platformMatch = path.match(/^\/horses\/([^/]+)\/platform$/);
    const managementMatch = path.match(/^\/horses\/([^/]+)\/management$/);
    const lamenessMatch = path.match(/^\/horses\/([^/]+)\/lameness\/detect$/);
    const calibrationMatch = path.match(/^\/horses\/([^/]+)\/sensors\/calibrate$/);
    const input = isRecord(body) ? body : {};
    try {
      if (method === 'GET' && profileMatch) return { status: 200, body: this.service.profile(decodeURIComponent(profileMatch[1]), actorFrom(input, searchParams)) };
      if (method === 'POST' && veterinaryMatch) return { status: 201, body: this.service.addVeterinaryRecord(decodeURIComponent(veterinaryMatch[1]), { recordType: input.recordType ?? 'examination', summary: stringValue(input.summary, 'Veterinary record'), diagnosis: input.diagnosis, medication: input.medication, medicationClass: input.medicationClass, withdrawalUntil: input.withdrawalUntil, approvalId: input.approvalId, approverId: input.approverId, approvalTimestamp: input.approvalTimestamp }, actorFrom(input, searchParams)) };
      if (method === 'POST' && eligibilityMatch) return { status: 200, body: this.service.updateEligibility(decodeURIComponent(eligibilityMatch[1]), { hisaCompliance: input.hisaCompliance, scratchStatus: input.scratchStatus, eligibilityFlags: input.eligibilityFlags, raceRestrictions: input.raceRestrictions }, actorFrom(input, searchParams)) };
      if (method === 'GET' && hisaMatch) return { status: 200, body: this.service.hisaCompliance(decodeURIComponent(hisaMatch[1]), actorFrom(input, searchParams)) };
      if (method === 'GET' && auditMatch) return { status: 200, body: this.service.auditChain(decodeURIComponent(auditMatch[1])) };
      if (method === 'GET' && platformMatch) return { status: 200, body: this.platform.snapshot(decodeURIComponent(platformMatch[1]), actorFrom(input, searchParams)) };
      if (method === 'GET' && managementMatch) return { status: 200, body: this.platform.managementModules(decodeURIComponent(managementMatch[1]), actorFrom(input, searchParams)) };
      if (method === 'POST' && lamenessMatch) return { status: 202, body: this.platform.detectLameness(decodeURIComponent(lamenessMatch[1]), input as any, actorFrom(input, searchParams)) };
      if (method === 'POST' && calibrationMatch) {
        const result = this.platform.calibrateSensor(decodeURIComponent(calibrationMatch[1]), input as any, actorFrom(input, searchParams));
        return { status: result.applied ? 200 : 202, body: result };
      }
    } catch (error) {
      return { status: /require|access|only|approval|Unknown/i.test(error instanceof Error ? error.message : String(error)) ? 403 : 400, body: { ok: false, error: { code: 'equine_request_denied', message: error instanceof Error ? error.message : String(error) } } };
    }
    return undefined;
  }
}

export function createEquineIntelligenceController() {
  return new EquineIntelligenceController();
}
