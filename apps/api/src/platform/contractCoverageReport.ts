import { apiContractSchemas, apiEndpointContracts, type EndpointContract } from '@trackmind/shared';
import { resolvePersistenceMode } from '../repository/index.js';

const now = () => new Date().toISOString();

const deferredResponseSchemas = new Set([
  'ProviderConfig',
  'ProviderStatus',
  'RacingDataDraftResultDto',
  'IngestionJob',
  'RawProviderPayload',
  'CanonicalRacingDataEnvelope',
  'DataQualityReport',
  'RacingDataLineageRecord',
  'WorkforceOperationsDto',
  'TrackMindNexusUpgradePackage',
  'ServerSentEventStream',
]);

const PROBE_PARAM_DEFAULTS: Record<string, string> = {
  horseId: 'horse-1',
  jockeyId: 'jockey-1',
  trainerId: 'trainer-1',
  kpiId: 'kpi-race-day-operations',
  inquiryId: 'inq-race-7-1',
  raceCardId: 'race-7',
  incidentId: 'inc-1',
  planId: 'plan-starter-monthly',
  subscriptionId: 'sub-trackmind-demo',
  customerId: 'cust-trackmind-demo',
  correctiveActionId: 'ca-1',
  evidenceId: 'ev-headon',
  artifactId: 'canonical-race-card-race-7',
  providerId: 'provider-official-feed',
  jobId: 'job-racing-hub-seed-1',
  raceId: 'race-7',
  nodeId: 'horse-1',
  workflowId: 'wf-emergency-1',
  drillId: 'drill-q2-1',
};

type PostProbeSpec = { path: string; body: Record<string, unknown> };

/** Explicit GET probe paths keyed by operationId; overrides heuristic param substitution. */
const GET_HANDLER_PROBE_REGISTRY: Record<string, string> = {
  getRacingDataProviderStatus: '/racing-data/providers/provider-official-feed/status',
  getRacingDataRawPayload: '/racing-data/raw-payloads/raw-official-feed-race-7',
  getCanonicalRacingDataRace: '/racing-data/canonical/races/race-7',
  getCanonicalRacingDataHorse: '/racing-data/canonical/horses/horse-1',
  getRacingDataIngestionJob: '/racing-data/ingestion-jobs/job-racing-hub-seed-1',
  getRacingDataLineage: '/racing-data/lineage/canonical-race-card-race-7',
  getEquineIntelligenceHorse: '/equine-intelligence/horses/horse-1',
  getHorseProfile: '/horses/horse-1/profile',
  getHorseEligibility: '/horses/horse-1/eligibility',
  getKPIArtifact: '/kpis/kpi-race-day-operations',
  listKPIHistoricalSnapshots: '/kpis/kpi-race-day-operations/snapshots',
  getIncident: '/incidents/inc-1',
  getIncidentTimeline: '/incidents/inc-1/timeline',
  getComplianceCorrectiveAction: '/compliance/corrective-actions/ca-1',
  getTrackCertificationCandidate: '/compliance/track-certification-candidate',
  globalSearch: '/search/global?q=horse',
};

/** Explicit POST probe specs for draft/mutation handlers that cannot be inferred from GET heuristics. */
const POST_HANDLER_PROBE_REGISTRY: Record<string, PostProbeSpec> = {
  createRacingDataProviderDraft: { path: '/racing-data/providers', body: { providerId: 'provider-probe-draft' } },
  createRacingDataIngestDraft: {
    path: '/racing-data/ingestion-jobs/draft-requests',
    body: { providerId: 'provider-official-feed', requestedBy: 'horse-operations-coordinator' },
  },
  createRacingDataEntityResolutionReviewDraft: {
    path: '/racing-data/entity-resolution/review',
    body: { providerId: 'provider-official-feed', entityId: 'horse-1' },
  },
  createRacingDataFeatureStoreExportDraft: {
    path: '/racing-data/exports/feature-store',
    body: { providerId: 'provider-official-feed', featureSetId: 'race-card-features' },
  },
  createRacingDataDataLakeExportDraft: {
    path: '/racing-data/exports/data-lake',
    body: { providerId: 'provider-official-feed', zone: 'silver-conformed' },
  },
  createRacingDataDigitalTwinSyncDraft: {
    path: '/racing-data/sync/digital-twins',
    body: { providerId: 'provider-official-feed', twinIds: ['twin:race:race-7'] },
  },
  createKpiThresholdDraft: {
    path: '/kpis/thresholds/draft-requests',
    body: { kpiId: 'kpi-race-day-operations', threshold: { target: 0.95 }, requestedBy: 'organization-admin' },
  },
};

export type CoverageProbeFn = (
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
) => Promise<{ status: number }>;

export type ContractCoverageEntryDto = {
  operationId: string;
  path: string;
  method: string;
  schemaReady: boolean;
  handlerReady: boolean;
  status: 'live' | 'deferred' | 'gap';
};

export type ContractCoverageReportDto = {
  generatedAt: string;
  schemaVersion: 'trackmind.contract-coverage.v1';
  totalContracts: number;
  schemaReadyCount: number;
  handlerReadyCount: number;
  schemaCoveragePercent: number;
  handlerCoveragePercent: number;
  persistenceMode: ReturnType<typeof resolvePersistenceMode>;
  notificationAdapters: string[];
  routeSupportStatus: 'live-api-only';
  gaps: ContractCoverageEntryDto[];
  mock: false;
};

function schemaReady(response: string): boolean {
  const name = response.replace(/\[\]$/, '');
  const schemas = apiContractSchemas as Record<string, unknown>;
  return Boolean(schemas[name]) || deferredResponseSchemas.has(name);
}

function resolveProbeParam(name: string, relativePath: string): string {
  if (name === 'id') {
    if (relativePath.startsWith('/racing-data/providers/')) return 'provider-official-feed';
    if (relativePath.startsWith('/racing-data/raw-payloads/')) return 'raw-official-feed-race-7';
    if (relativePath.startsWith('/racing-data/canonical/races/')) return 'race-7';
    if (relativePath.startsWith('/racing-data/canonical/horses/')) return 'horse-1';
    if (relativePath.startsWith('/racing-data/ingestion-jobs/')) return 'job-racing-hub-seed-1';
  }
  return PROBE_PARAM_DEFAULTS[name] ?? 'sample-id';
}

function normalizeProbePath(fullPath: string): string {
  const relativePath = fullPath.replace('/api/v1', '');
  return relativePath.replace(/\{([^}]+)\}/g, (_, param) => resolveProbeParam(param, relativePath));
}

function resolveGetProbePath(contract: EndpointContract): string {
  return GET_HANDLER_PROBE_REGISTRY[contract.operationId] ?? normalizeProbePath(contract.path);
}

function handlerExists(status: number): boolean {
  return status >= 200 && status < 500 && status !== 404;
}

let cachedReport: ContractCoverageReportDto | undefined;
let coverageProbeInFlight = false;

const SELF_PROBE_EXCLUDED = new Set(['/platform/contract-coverage']);

export async function buildContractCoverageReport(
  probe: CoverageProbeFn,
  options?: { force?: boolean },
): Promise<ContractCoverageReportDto> {
  if (cachedReport && !options?.force) return cachedReport;
  if (coverageProbeInFlight) {
    return {
      generatedAt: now(),
      schemaVersion: 'trackmind.contract-coverage.v1',
      totalContracts: apiEndpointContracts.length,
      schemaReadyCount: 0,
      handlerReadyCount: 0,
      schemaCoveragePercent: 0,
      handlerCoveragePercent: 0,
      persistenceMode: resolvePersistenceMode(),
      notificationAdapters: ['in-app', 'email-stub', 'webhook-stub'],
      routeSupportStatus: 'live-api-only',
      gaps: [],
      mock: false,
    };
  }

  coverageProbeInFlight = true;
  try {
  const probedGetHandlers = new Map<string, boolean>();
  const probedPostHandlers = new Map<string, boolean>();

  const getContracts = apiEndpointContracts.filter((contract) => contract.method === 'GET');
  const uniqueProbePaths = [...new Set(getContracts.map((contract) => resolveGetProbePath(contract)))];

  for (const probePath of uniqueProbePaths) {
    const probeKey = probePath.split('?')[0];
    if (SELF_PROBE_EXCLUDED.has(probeKey)) {
      probedGetHandlers.set(probeKey, true);
      continue;
    }
    const response = await probe('GET', probePath.startsWith('/') ? probePath : `/${probePath}`);
    probedGetHandlers.set(probeKey, handlerExists(response.status));
  }

  for (const [operationId, spec] of Object.entries(POST_HANDLER_PROBE_REGISTRY)) {
    const response = await probe('POST', spec.path.startsWith('/') ? spec.path : `/${spec.path}`, spec.body);
    probedPostHandlers.set(operationId, handlerExists(response.status));
  }

  const entries: ContractCoverageEntryDto[] = apiEndpointContracts.map((contract) => {
    const schemaName = contract.response.replace(/\[\]$/, '');
    const schemaOk = schemaReady(contract.response);
    const normalized = resolveGetProbePath(contract);
    const probeKey = normalized.split('?')[0];
    const handlerOk = contract.method === 'GET'
      ? probedGetHandlers.get(probeKey) === true
      : probedPostHandlers.has(contract.operationId)
        ? probedPostHandlers.get(contract.operationId) === true
        : schemaOk && !deferredResponseSchemas.has(schemaName);
    const status: ContractCoverageEntryDto['status'] = !schemaOk
      ? 'gap'
      : deferredResponseSchemas.has(schemaName)
        ? 'deferred'
        : handlerOk
          ? 'live'
          : 'gap';
    return {
      operationId: contract.operationId,
      path: contract.path,
      method: contract.method,
      schemaReady: schemaOk,
      handlerReady: handlerOk,
      status,
    };
  });

  const schemaReadyCount = entries.filter((entry) => entry.schemaReady).length;
  const handlerReadyCount = entries.filter((entry) => entry.handlerReady).length;
  const gaps = entries.filter((entry) => entry.status === 'gap');

  cachedReport = {
    generatedAt: now(),
    schemaVersion: 'trackmind.contract-coverage.v1',
    totalContracts: entries.length,
    schemaReadyCount,
    handlerReadyCount,
    schemaCoveragePercent: Math.round((schemaReadyCount / entries.length) * 1000) / 10,
    handlerCoveragePercent: Math.round((handlerReadyCount / entries.length) * 1000) / 10,
    persistenceMode: resolvePersistenceMode(),
    notificationAdapters: ['in-app', 'email-stub', 'webhook-stub'],
    routeSupportStatus: 'live-api-only',
    gaps: gaps.slice(0, 25),
    mock: false,
  };
  return cachedReport;
  } finally {
    coverageProbeInFlight = false;
  }
}

export function resetContractCoverageCache(): void {
  cachedReport = undefined;
}
