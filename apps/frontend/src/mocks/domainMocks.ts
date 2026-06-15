import type { AIRecommendationDto, AuditEventDto } from '@trackmind/shared';

export interface StubPanel {
  id: string;
  label: string;
  status: 'implemented' | 'facade-only' | 'documented-stub' | 'mock-adapter';
  detail: string;
  evidence: string[];
}

export interface UnsupportedDomainMock {
  generatedAt: string;
  domain: string;
  posture: 'documented-stub' | 'mock-adapter';
  panels: StubPanel[];
  aiRecommendations: AIRecommendationDto[];
  auditEvents: AuditEventDto[];
}

const generatedAt = '2026-06-15T00:00:00.000Z';

function recommendation(id: string, domain: string): AIRecommendationDto {
  return {
    id,
    recommendationId: id,
    recommendation: `${domain} is represented as backend readiness metadata only. No operational execution is available from the frontend.`,
    confidence: 0.72,
    evidence: [`docs:${domain}:readiness`, 'backend-contract:stub-supported'],
    modelVersion: 'trackmind-readiness-adapter-v1',
    generatedAt,
    approvalRequirement: { required: true, policy: 'human-review' },
    auditReference: { auditIds: [`audit:${id}`], eventIds: [`event:${id}`], digitalTwinRefs: [] },
    requiresApproval: true,
    eventId: `event:${id}`,
    auditId: `audit:${id}`,
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    riskLevel: 'medium',
    mock: true,
  };
}

function audit(id: string, domain: string): AuditEventDto {
  return {
    id,
    type: `${domain}.readiness.viewed`,
    actor: 'frontend-readonly-shell',
    timestamp: generatedAt,
    severity: 'info',
    hash: `sha256:${id}`,
    previousHash: 'sha256:previous-readiness',
    mock: true,
    evidenceIds: [`docs:${domain}:readiness`],
  };
}

export function mockUnsupportedDomain(domain: string, detail: string): UnsupportedDomainMock {
  return {
    generatedAt,
    domain,
    posture: 'mock-adapter',
    panels: [
      {
        id: `${domain}-support`,
        label: `${domain} support boundary`,
        status: 'mock-adapter',
        detail,
        evidence: [`docs/architecture`, `packages/shared`, `apps/api facade inventory`],
      },
    ],
    aiRecommendations: [recommendation(`rec-${domain}-readiness`, domain)],
    auditEvents: [audit(`audit-${domain}-readiness`, domain)],
  };
}
