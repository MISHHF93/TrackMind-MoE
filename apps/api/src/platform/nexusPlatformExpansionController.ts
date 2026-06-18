import type { TenantScope } from '@trackmind/shared';
import type { CommercializationServices } from './commercializationController.js';
import type { CustomerManagementServices } from './customerManagementController.js';
import type { IncidentService } from './incidentService.js';
import { createNexusPlatformCanonicalDeps } from './nexusPlatformCanonicalDeps.js';
import { NexusPlatformExpansionService } from './nexusPlatformExpansionService.js';
import type { PlatformState } from './platformController.js';
import type { FeatureFlagService, TenantService } from './tenantService.js';

type HttpMethod = 'GET' | 'POST';
type HandlerResult = { status: number; body: unknown } | undefined;

export interface NexusPlatformExpansionServices {
  expansion: NexusPlatformExpansionService;
}

export function createNexusPlatformExpansionServices(
  tenant: TenantService,
  featureFlags: FeatureFlagService,
  incidents: IncidentService,
  commercialization?: CommercializationServices,
  customerManagement?: CustomerManagementServices,
  platformState?: PlatformState,
): NexusPlatformExpansionServices {
  const canonical = createNexusPlatformCanonicalDeps({
    platformState: platformState
      ? {
          auditLedger: platformState.auditLedger,
          approvalService: platformState.approvalService,
          racingData: platformState.racingData,
        }
      : undefined,
    approvalService: platformState?.approvalService,
    auditLog: platformState?.auditLedger,
  });
  return {
    expansion: new NexusPlatformExpansionService(
      tenant,
      featureFlags,
      incidents,
      commercialization,
      customerManagement,
      undefined,
      canonical,
      platformState
        ? {
            auditLedger: platformState.auditLedger,
            approvalService: platformState.approvalService,
            racingData: platformState.racingData,
          }
        : undefined,
    ),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function scopeFrom(searchParams: URLSearchParams, body?: unknown): TenantScope {
  const input = isRecord(body) ? body : {};
  return {
    organizationId: String(searchParams.get('organizationId') ?? input.organizationId ?? 'org-trackmind-network'),
    tenantId: searchParams.get('tenantId') ?? (input.tenantId ? String(input.tenantId) : undefined),
    racetrackId: searchParams.get('racetrackId') ?? (input.racetrackId ? String(input.racetrackId) : undefined),
  };
}

function handleExpansionError(error: unknown): HandlerResult {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('tenant_scope_violation') || message.startsWith('module_not_entitled')) {
    return { status: 403, body: { ok: false, error: { code: message.split(':')[0], message } } };
  }
  if (message === 'tenant_not_found') {
    return { status: 404, body: { ok: false, error: { code: 'not_found', message } } };
  }
  throw error;
}

export function handleNexusPlatformExpansionRequest(
  method: HttpMethod,
  path: string,
  body: unknown,
  services: NexusPlatformExpansionServices,
  searchParams: URLSearchParams,
): HandlerResult {
  const scope = scopeFrom(searchParams, body);
  const exp = services.expansion;

  try {
    if (method === 'GET' && path === '/platform/nexus-expansion/manifest') {
      return { status: 200, body: exp.manifest() };
    }

    if (method === 'GET' && path === '/marketplace/workspace') {
      return { status: 200, body: exp.marketplace(scope) };
    }
    const enableMatch = path.match(/^\/marketplace\/modules\/([^/]+)\/enable$/);
    if (method === 'POST' && enableMatch) {
      return { status: 200, body: exp.toggleModule(scope, decodeURIComponent(enableMatch[1]), true) };
    }
    const disableMatch = path.match(/^\/marketplace\/modules\/([^/]+)\/disable$/);
    if (method === 'POST' && disableMatch) {
      return { status: 200, body: exp.toggleModule(scope, decodeURIComponent(disableMatch[1]), false) };
    }

    if (method === 'GET' && path === '/white-label/workspace') {
      return { status: 200, body: exp.whiteLabelWorkspace(scope) };
    }
    if (method === 'POST' && path === '/white-label/branding') {
      const input = isRecord(body) ? body : {};
      return { status: 200, body: exp.updateBranding(scope, input as Parameters<typeof exp.updateBranding>[1]) };
    }

    if (method === 'GET' && path === '/digital-twin/platform/workspace') {
      return { status: 200, body: exp.digitalTwinPlatform(scope) };
    }

    if (method === 'GET' && path === '/operational-intelligence/center') {
      return { status: 200, body: exp.operationalIntelligence(scope) };
    }

    if (method === 'GET' && path === '/predictive-analytics/workspace') {
      return { status: 200, body: exp.predictiveAnalytics(scope) };
    }

    if (method === 'GET' && path === '/reporting/workspace') {
      return { status: 200, body: exp.reporting(scope) };
    }
    if (method === 'POST' && path === '/reporting/jobs') {
      const input = isRecord(body) ? body : {};
      return {
        status: 201,
        body: exp.createReportJob(scope, String(input.templateId ?? 'report-race-day-summary'), String(input.format ?? 'pdf')),
      };
    }

    if (method === 'GET' && path === '/workflow-automation/workspace') {
      return { status: 200, body: exp.workflowAutomation(scope) };
    }

    if (method === 'GET' && path === '/integration-hub/workspace') {
      return { status: 200, body: exp.integrationHub(scope) };
    }

    if (method === 'GET' && path === '/mobile-operations/workspace') {
      return { status: 200, body: exp.mobileOperations(scope) };
    }

    if (method === 'GET' && path === '/compliance-command-center/workspace') {
      return { status: 200, body: exp.complianceCommandCenter(scope) };
    }

    if (method === 'GET' && path === '/security-soc/workspace') {
      return { status: 200, body: exp.securitySoc(scope) };
    }

    if (method === 'GET' && path === '/facilities-command/workspace') {
      return { status: 200, body: exp.facilitiesCommand(scope) };
    }

    if (method === 'GET' && path === '/ai-governance-registry/workspace') {
      return { status: 200, body: exp.aiGovernanceRegistry() };
    }

    if (method === 'GET' && path === '/executive-intelligence/suite') {
      return { status: 200, body: exp.executiveIntelligence(scope) };
    }

    if (method === 'GET' && path === '/platform/enterprise-readiness') {
      return { status: 200, body: exp.enterpriseReadiness() };
    }
  } catch (error) {
    const handled = handleExpansionError(error);
    if (handled) return handled;
  }

  return undefined;
}
