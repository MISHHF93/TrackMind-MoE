import type { ApprovalToken } from '../approvals.js';
import { ApexApprovalGateway, type ApexMutationContext, type ApprovalEvidencePackage, type ApprovalRequiredActionRecord } from './approvalGateway.js';

export interface ZoneCredentialCheck {
  zoneId: string;
  credentialId: string;
  personId: string;
}

export interface ZoneAccessDecision {
  allowed: boolean;
  reason: string;
  evidence: string[];
}

export interface EmergencyZoneActionInput {
  zoneId: string;
  action: string;
  evidence: ApprovalEvidencePackage;
  context: ApexMutationContext;
}

export class SecurityService {
  private readonly allowedCredentials = new Map<string, Set<string>>([
    ['paddock', new Set(['credential-steward', 'credential-vet', 'credential-trainer'])],
  ]);

  constructor(private readonly approvals: ApexApprovalGateway) {}

  validateCredential(input: ZoneCredentialCheck): ZoneAccessDecision {
    const allowed = this.allowedCredentials.get(input.zoneId)?.has(input.credentialId) ?? false;
    return {
      allowed,
      reason: allowed ? 'credential valid for restricted zone' : 'credential denied for restricted zone',
      evidence: [`zone:${input.zoneId}`, `credential:${input.credentialId}`, `person:${input.personId}`],
    };
  }

  async requestEmergencyZoneAction(input: EmergencyZoneActionInput): Promise<ApprovalRequiredActionRecord> {
    return this.approvals.requestProtectedMutation({
      service: 'security',
      operation: 'emergency_zone_action',
      action: 'emergency-action',
      target: input.zoneId,
      payload: { action: input.action },
      context: input.context,
      evidence: input.evidence,
      execute: (_token: ApprovalToken) => ({ zoneId: input.zoneId, action: input.action, executed: true, approvalRequired: true }),
    });
  }
}

export function createSecurityService(gateway = new ApexApprovalGateway()) {
  return new SecurityService(gateway);
}
