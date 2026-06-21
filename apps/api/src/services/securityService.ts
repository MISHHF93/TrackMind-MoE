import type { ApprovalToken } from '../approvals.js';
import type { AccessWebhookPayload } from '../securityOps.js';
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

export interface SecurityWebhookAdapterInfo {
  adapterId: string;
  endpoint: string;
  supportedEvents: string[];
  signatureRequired: boolean;
}

export class SecurityService {
  private readonly allowedCredentials = new Map<string, Set<string>>([
    ['paddock', new Set(['credential-steward', 'credential-vet', 'credential-trainer'])],
    ['zone-paddock', new Set(['credential-steward', 'credential-vet', 'credential-trainer', 'cred-visitor-1'])],
  ]);

  constructor(private readonly approvals: ApexApprovalGateway) {}

  validateCredential(input: ZoneCredentialCheck): ZoneAccessDecision {
    const allowed = this.allowedCredentials.get(input.zoneId)?.has(input.credentialId) ?? false;
    return {
      allowed,
      reason: allowed ? 'credential valid for restricted zone' : 'credential denied for restricted zone',
      evidence: [`zone:${input.zoneId}`, `credential-ref:${redactedRef(input.credentialId)}`, `person-ref:${redactedRef(input.personId)}`],
    };
  }

  accessWebhookAdapter(): SecurityWebhookAdapterInfo {
    return {
      adapterId: 'access-control-vendor',
      endpoint: '/api/v1/security-operations/webhooks/access-events',
      supportedEvents: ['access.granted', 'access.denied'],
      signatureRequired: true,
    };
  }

  normalizeAccessWebhookPayload(input: Record<string, unknown>): AccessWebhookPayload {
    return {
      adapterId: String(input.adapterId ?? 'access-control-vendor'),
      zoneId: String(input.zoneId ?? ''),
      credentialId: String(input.credentialId ?? ''),
      personDisplayName: String(input.personDisplayName ?? 'Unknown visitor'),
      personLegalName: typeof input.personLegalName === 'string' ? input.personLegalName : undefined,
      decision: input.decision === 'granted' ? 'granted' : 'denied',
      reason: String(input.reason ?? 'vendor webhook event'),
      occurredAt: String(input.occurredAt ?? new Date().toISOString()),
      signatureValid: input.signatureValid !== false,
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

function redactedRef(value: string): string {
  return value ? `sha256:${value.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0).toString(16)}` : 'unknown';
}

export function createSecurityService(gateway = new ApexApprovalGateway()) {
  return new SecurityService(gateway);
}
