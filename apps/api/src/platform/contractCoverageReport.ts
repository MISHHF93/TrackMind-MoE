import { apiContractSchemas, apiEndpointContracts } from '@trackmind/shared';
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

function normalizeProbePath(path: string): string {
  return path.replace(/\{[^}]+\}/g, 'sample-id');
}

let cachedReport: ContractCoverageReportDto | undefined;

export async function buildContractCoverageReport(
  probe: (method: 'GET' | 'POST', path: string) => Promise<{ status: number }>,
  options?: { force?: boolean },
): Promise<ContractCoverageReportDto> {
  if (cachedReport && !options?.force) return cachedReport;

  const wave20ProbePaths = new Set([
    '/search/global?q=horse',
    '/notifications/inbox',
    '/platform/environment',
    '/platform/foundation',
    '/audit/search?domain=api',
    '/analytics/workspace',
    '/race-operations/paddock',
    '/incidents',
    '/fan-experience/workspace',
    '/finance/workspace',
    '/ai-governance/model-registry',
    '/federation/kpi-aggregation',
    '/digital-twin/state',
    '/platform/modules',
    '/horse-registry/workspace',
    '/security-operations/zones/live',
  ]);

  const probedHandlers = new Map<string, boolean>();
  for (const probePath of wave20ProbePaths) {
    const response = await probe('GET', probePath);
    probedHandlers.set(probePath.split('?')[0], response.status !== 404);
  }

  const entries: ContractCoverageEntryDto[] = apiEndpointContracts.map((contract) => {
    const schemaOk = schemaReady(contract.response);
    const normalized = normalizeProbePath(contract.path.replace('/api/v1', ''));
    const probeKey = normalized.split('?')[0];
    const handlerOk = probedHandlers.has(probeKey)
      ? probedHandlers.get(probeKey) === true
      : schemaOk && !deferredResponseSchemas.has(contract.response.replace(/\[\]$/, ''));
    const status: ContractCoverageEntryDto['status'] = !schemaOk
      ? 'gap'
      : deferredResponseSchemas.has(contract.response.replace(/\[\]$/, ''))
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
    notificationAdapters: ['in-app', 'sse', 'email-stub'],
    routeSupportStatus: 'live-api-only',
    gaps: gaps.slice(0, 25),
    mock: false,
  };
  return cachedReport;
}

export function resetContractCoverageCache(): void {
  cachedReport = undefined;
}
