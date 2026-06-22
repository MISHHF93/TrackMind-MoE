import type { ProviderStatus } from '@trackmind/shared';
import type { RacingDataApiFacadeState } from '../racingDataApiHub.js';
import {
  findRacingDataProvider,
  findRacingDataStatus,
  isRacingDataLicenseAllowed,
} from '../racingDataApiHub.js';

const now = () => new Date().toISOString();

const providerQuotaRemaining = new Map<string, number>();

export function resetLicensedProviderConnectorState(): void {
  providerQuotaRemaining.clear();
}

export function configureLicensedConnectorQuota(providerId: string, remaining: number): void {
  providerQuotaRemaining.set(providerId, remaining);
}

export interface LicensedConnectorLineage {
  correlationId: string;
  sourceRefs: string[];
  upstreamRefs: string[];
  downstreamRefs: string[];
}

export interface LicensedConnectorRateLimit {
  limit: number;
  remaining: number;
  windowSeconds: number;
}

export interface ProviderAdapterInvokeSuccess {
  ok: true;
  providerId: string;
  status: 'simulated';
  recordsProcessed: number;
  executedAt: string;
  mock: false;
  correlationId: string;
  lineage: LicensedConnectorLineage;
  rateLimit: LicensedConnectorRateLimit;
  externalCallsPerformed: false;
  scrapingPerformed: false;
  licenseStatus: string;
}

export type ProviderAdapterInvokeFailureCode =
  | 'not_found'
  | 'provider_suspended'
  | 'license_not_permitted'
  | 'rate_limit_exceeded';

export interface ProviderAdapterInvokeFailure {
  ok: false;
  code: ProviderAdapterInvokeFailureCode;
  message: string;
  providerId?: string;
  details?: string[];
  rateLimit?: LicensedConnectorRateLimit;
}

export type LicensedProviderConnectorResult = ProviderAdapterInvokeSuccess | ProviderAdapterInvokeFailure;

const RATE_LIMIT_WINDOW_SECONDS = 60;

function initialQuota(status: ProviderStatus | undefined): number {
  return status?.health.rateLimitRemaining ?? 10;
}

function consumeProviderQuota(providerId: string, status: ProviderStatus | undefined): LicensedConnectorRateLimit {
  const limit = initialQuota(status);
  if (!providerQuotaRemaining.has(providerId)) {
    providerQuotaRemaining.set(providerId, limit);
  }
  const remainingBefore = providerQuotaRemaining.get(providerId) ?? limit;
  const remaining = Math.max(0, remainingBefore - 1);
  providerQuotaRemaining.set(providerId, remaining);
  return { limit, remaining, windowSeconds: RATE_LIMIT_WINDOW_SECONDS };
}

function buildLineage(
  providerId: string,
  correlationId: string,
  state: RacingDataApiFacadeState,
): LicensedConnectorLineage {
  const provider = findRacingDataProvider(state, providerId);
  const upstreamRefs = provider?.endpointRefs ?? [`provider:${providerId}`];
  const canonicalRefs = [
    ...state.canonical.raceCards,
    ...state.canonical.races,
    ...state.canonical.horses,
    ...state.canonical.entries,
    ...state.canonical.results,
  ]
    .filter((envelope) => envelope.providerId === providerId)
    .map((envelope) => envelope.envelopeId);
  const jobRefs = state.ingestionJobs
    .filter((job) => job.providerId === providerId)
    .map((job) => job.jobId);
  return {
    correlationId,
    sourceRefs: provider?.lineage.sourceRefs ?? [`provider:${providerId}`],
    upstreamRefs,
    downstreamRefs: [...jobRefs, ...canonicalRefs],
  };
}

function recordsProcessedForProvider(providerId: string, state: RacingDataApiFacadeState): number {
  const jobRecords = state.ingestionJobs.filter((job) => job.providerId === providerId).length;
  const canonicalRecords = [
    ...state.canonical.raceCards,
    ...state.canonical.races,
    ...state.canonical.horses,
    ...state.canonical.entries,
    ...state.canonical.results,
  ].filter((envelope) => envelope.providerId === providerId).length;
  return Math.max(1, jobRecords * 10 + canonicalRecords);
}

export function invokeLicensedProviderConnector(
  providerId: string,
  state: RacingDataApiFacadeState,
): LicensedProviderConnectorResult {
  const provider = findRacingDataProvider(state, providerId);
  if (!provider) {
    return { ok: false, code: 'not_found', message: 'Provider not found' };
  }

  const status = findRacingDataStatus(state, providerId);
  if (status?.status === 'suspended') {
    return {
      ok: false,
      code: 'provider_suspended',
      message: `Provider ${providerId} is suspended; adapter invoke is blocked.`,
      providerId,
      details: status.health.messages,
    };
  }

  const licenseDecision = isRacingDataLicenseAllowed(provider.license, 'provider invoke', ['race-day-operations']);
  if (!licenseDecision.allowed) {
    return {
      ok: false,
      code: 'license_not_permitted',
      message: `Provider ${providerId} license does not permit adapter invoke.`,
      providerId,
      details: licenseDecision.details,
    };
  }

  const quotaBefore = providerQuotaRemaining.get(providerId) ?? initialQuota(status);
  if (quotaBefore <= 0) {
    const limit = initialQuota(status);
    return {
      ok: false,
      code: 'rate_limit_exceeded',
      message: `Licensed provider ${providerId} rate limit exhausted for the current window.`,
      providerId,
      rateLimit: { limit, remaining: 0, windowSeconds: RATE_LIMIT_WINDOW_SECONDS },
    };
  }

  const executedAt = now();
  const correlationId = `corr:invoke:${providerId}:${Date.now().toString(36)}`;
  const rateLimit = consumeProviderQuota(providerId, status);

  return {
    ok: true,
    providerId,
    status: 'simulated',
    recordsProcessed: recordsProcessedForProvider(providerId, state),
    executedAt,
    mock: false,
    correlationId,
    lineage: buildLineage(providerId, correlationId, state),
    rateLimit,
    externalCallsPerformed: false,
    scrapingPerformed: false,
    licenseStatus: provider.license.licenseStatus,
  };
}
