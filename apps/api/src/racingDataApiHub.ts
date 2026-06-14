import {
  createRacingDataApiHubServiceMetadata,
  racingDataApiHubSchemaVersion,
  validateRacingDataLicenseMetadata,
  type CanonicalRacingDataEnvelope,
  type IngestionJob,
  type ProviderConfig,
  type ProviderStatus,
  type RacingDataApiHubServiceMetadata,
  type RacingDataClass,
  type RacingDataLicenseMetadata,
  type RacingDataLineageMetadata,
  type RacingDataTenantMetadata,
  type RacingDataUsageScope,
  type RawProviderPayload,
} from '@trackmind/shared';

type CanonicalEnvelope = CanonicalRacingDataEnvelope<Record<string, unknown>>;

export interface RacingDataDataQualityReport {
  reportId: string;
  generatedAt: string;
  providerId: string;
  tenant: RacingDataTenantMetadata;
  score: number;
  status: 'pass' | 'watch' | 'blocked';
  checks: Array<{ checkId: string; label: string; severity: 'info' | 'warning' | 'error'; passed: boolean; evidenceRefs: string[] }>;
  licenseStatus: RacingDataLicenseMetadata['licenseStatus'];
  lineageRefs: string[];
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
  externalCallsPerformed: false;
  scrapingPerformed: false;
}

export interface RacingDataLineageRecord {
  artifactId: string;
  artifactType: 'provider' | 'ingestion-job' | 'raw-payload' | 'canonical-envelope' | 'data-quality-report' | 'export-draft' | 'digital-twin-sync-draft';
  providerId: string;
  tenant: RacingDataTenantMetadata;
  lineage: RacingDataLineageMetadata;
  upstreamRefs: string[];
  downstreamRefs: string[];
  license: RacingDataLicenseMetadata;
  evidenceRefs: string[];
  auditRefs: string[];
  eventRefs: string[];
  externalCallsPerformed: false;
  scrapingPerformed: false;
}

export interface RacingDataDraftResult {
  accepted: true;
  draftId: string;
  approvalRequired: true;
  audited: true;
  executionAllowed: false;
  externalCallsPerformed: false;
  scrapingPerformed: false;
  eventType: string;
  providerId?: string;
  jobId?: string;
  message: string;
  governance: {
    stateChangingOperation: true;
    draftOnly: true;
    licenseReviewRequired: true;
    humanApprovalRequired: true;
  };
  mock: false;
}

export interface RacingDataApiFacadeState {
  metadata: RacingDataApiHubServiceMetadata;
  providers: ProviderConfig[];
  statuses: ProviderStatus[];
  ingestionJobs: IngestionJob[];
  rawPayloads: Array<RawProviderPayload<Record<string, unknown>>>;
  canonical: {
    raceCards: CanonicalEnvelope[];
    races: CanonicalEnvelope[];
    horses: CanonicalEnvelope[];
    entries: CanonicalEnvelope[];
    results: CanonicalEnvelope[];
  };
  dataQualityReports: RacingDataDataQualityReport[];
  lineage: RacingDataLineageRecord[];
  governance: {
    stateChangingOperationsDraftOnly: true;
    externalCallsAllowed: false;
    scrapingAllowed: false;
    unsafeOperationsRequireApproval: true;
  };
}

export interface RacingDataLicenseDeniedBody {
  ok: false;
  error: { code: 'license_not_permitted'; message: string; details: string[] };
  providerId?: string;
  operation: string;
  license?: Pick<RacingDataLicenseMetadata, 'licenseStatus' | 'commercialUseAllowed' | 'redistributionAllowed' | 'usageScope' | 'evidenceRefs'>;
  externalCallsPerformed: false;
  scrapingPerformed: false;
}

const tenant: RacingDataTenantMetadata = {
  tenantId: 'trackmind',
  racetrackId: 'main-track',
  organizationId: 'org-trackmind',
  jurisdiction: 'state-racing-commission',
  dataBoundary: 'tenant',
};

const retention = {
  policyId: 'regulated-racing-data-7-year',
  retentionDays: 2555,
  legalBasis: 'regulated racing operations and audit evidence',
};

function license(status: RacingDataLicenseMetadata['licenseStatus'], usageScope: RacingDataUsageScope[], dataClasses: RacingDataClass[], commercialUseAllowed = false): RacingDataLicenseMetadata {
  return {
    licenseStatus: status,
    commercialUseAllowed,
    redistributionAllowed: false,
    attributionRequired: true,
    requiresAttribution: true,
    piiPresent: false,
    dataClasses,
    usageScope,
    retention,
    termsRef: `license://racing-data/${status}`,
    attributionText: 'Provider attribution required in governed Racing Data API Hub views.',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    evidenceRefs: [`license:${status}`, 'contract:racing-data-api-hub'],
  };
}

function lineage(sourceSystem: string, correlationId: string, ingestionJobId?: string, rawPayloadRefs: string[] = []): RacingDataLineageMetadata {
  return {
    sourceSystem,
    sourceRefs: [`provider:${sourceSystem}`],
    ingestionJobId,
    rawPayloadRefs,
    normalizedFromRefs: rawPayloadRefs,
    correlationId,
    causationIds: ingestionJobId ? [ingestionJobId] : [],
  };
}

function canonicalEnvelope(envelopeId: string, providerId: string, canonicalDataClass: RacingDataClass, payload: Record<string, unknown>, timestamp: string, sourcePayloadRefs: string[], itemLicense: RacingDataLicenseMetadata): CanonicalEnvelope {
  return {
    schemaVersion: racingDataApiHubSchemaVersion,
    envelopeId,
    providerId,
    tenant,
    jurisdiction: tenant.jurisdiction,
    canonicalDataClass,
    dataClasses: [canonicalDataClass],
    receivedAt: timestamp,
    normalizedAt: timestamp,
    payload,
    sourcePayloadRefs,
    license: itemLicense,
    usageScope: itemLicense.usageScope,
    retention: itemLicense.retention,
    piiPresent: itemLicense.piiPresent,
    lineage: lineage(providerId, `corr:${envelopeId}`, 'job-racing-hub-seed-1', sourcePayloadRefs),
    evidenceRefs: [`evidence:${envelopeId}`],
    auditRefs: [`audit:${envelopeId}`],
    eventRefs: [`event:${envelopeId}`],
  };
}

export function createRacingDataApiFacadeState(timestamp = new Date().toISOString()): RacingDataApiFacadeState {
  const activeLicense = license('active', ['internal-operations', 'race-day-operations', 'analytics', 'ai-training', 'compliance-reporting', 'commercial-product'], ['race-card', 'entries', 'results', 'horse-profile', 'track-condition'], true);
  const restrictedLicense = license('restricted', ['internal-operations'], ['odds', 'pools']);
  const providers: ProviderConfig[] = [
    {
      schemaVersion: racingDataApiHubSchemaVersion,
      providerId: 'provider-official-feed',
      displayName: 'Official Licensed Racing Feed',
      enabled: true,
      tenant,
      jurisdiction: tenant.jurisdiction,
      connectionType: 'rest',
      syncMode: 'pull',
      refreshInterval: 'PT5M',
      endpointRefs: ['contract://providers/official-feed/api'],
      credentialsRef: 'vault://racing-data/official-feed',
      dataClasses: activeLicense.dataClasses,
      usageScope: activeLicense.usageScope,
      license: activeLicense,
      lineage: lineage('provider-official-feed', 'corr:provider-official-feed'),
      evidenceRefs: ['contract:official-feed', 'license:active'],
      auditRefs: ['audit:provider-official-feed-configured'],
      eventRefs: ['event:provider.configured'],
      tags: ['licensed', 'official', 'no-scraping'],
    },
    {
      schemaVersion: racingDataApiHubSchemaVersion,
      providerId: 'provider-restricted-odds',
      displayName: 'Restricted Odds Snapshot',
      enabled: true,
      tenant,
      jurisdiction: tenant.jurisdiction,
      connectionType: 'file-drop',
      syncMode: 'manual',
      refreshInterval: 'manual',
      endpointRefs: ['contract://providers/restricted-odds/dropbox'],
      credentialsRef: 'vault://racing-data/restricted-odds',
      dataClasses: restrictedLicense.dataClasses,
      usageScope: restrictedLicense.usageScope,
      license: restrictedLicense,
      lineage: lineage('provider-restricted-odds', 'corr:provider-restricted-odds'),
      evidenceRefs: ['contract:restricted-odds', 'license:restricted'],
      auditRefs: ['audit:provider-restricted-odds-configured'],
      eventRefs: ['event:provider.configured'],
      tags: ['licensed-restricted', 'no-export', 'no-scraping'],
    },
  ];

  const statuses: ProviderStatus[] = providers.map((provider) => ({
    schemaVersion: racingDataApiHubSchemaVersion,
    providerId: provider.providerId,
    tenant: provider.tenant,
    status: provider.providerId === 'provider-official-feed' ? 'healthy' : 'suspended',
    connectionType: provider.connectionType,
    syncMode: provider.syncMode,
    refreshInterval: provider.refreshInterval,
    lastCheckedAt: timestamp,
    lastSuccessfulSyncAt: provider.providerId === 'provider-official-feed' ? timestamp : undefined,
    nextSyncAt: provider.providerId === 'provider-official-feed' ? timestamp : undefined,
    health: { latencyMs: provider.providerId === 'provider-official-feed' ? 118 : undefined, errorRate: 0, rateLimitRemaining: provider.providerId === 'provider-official-feed' ? 990 : 0, messages: provider.providerId === 'provider-official-feed' ? ['Licensed feed is healthy.'] : ['License restrictions block ingest, export, and sync drafts until reviewed.'] },
    licenseStatus: provider.license.licenseStatus,
    commercialUseAllowed: provider.license.commercialUseAllowed,
    redistributionAllowed: provider.license.redistributionAllowed,
    attributionRequired: provider.license.attributionRequired,
    requiresAttribution: provider.license.requiresAttribution,
    piiPresent: provider.license.piiPresent,
    dataClasses: provider.dataClasses,
    usageScope: provider.usageScope,
    evidenceRefs: provider.evidenceRefs,
    auditRefs: provider.auditRefs,
    eventRefs: provider.eventRefs,
  }));

  const ingestionJobs: IngestionJob[] = [{
    schemaVersion: racingDataApiHubSchemaVersion,
    jobId: 'job-racing-hub-seed-1',
    providerId: 'provider-official-feed',
    tenant,
    status: 'completed',
    connectionType: 'rest',
    syncMode: 'pull',
    refreshInterval: 'PT5M',
    requestedAt: timestamp,
    startedAt: timestamp,
    completedAt: timestamp,
    dataClasses: ['race-card', 'entries', 'results', 'horse-profile'],
    usageScope: activeLicense.usageScope,
    licenseSnapshot: activeLicense,
    counts: { received: 4, normalized: 4, rejected: 0 },
    rawPayloadRefs: ['raw-official-feed-race-7'],
    canonicalEnvelopeRefs: ['canonical-race-card-race-7', 'canonical-race-race-7', 'canonical-horse-horse-1', 'canonical-entry-race-7-horse-1', 'canonical-result-race-7'],
    errors: [],
    lineage: lineage('provider-official-feed', 'corr:job-racing-hub-seed-1', 'job-racing-hub-seed-1', ['raw-official-feed-race-7']),
    evidenceRefs: ['evidence:ingest-job:official-feed'],
    auditRefs: ['audit:ingest-job:official-feed'],
    eventRefs: ['event:racing-data.ingest.completed'],
  }];

  const rawPayloads: Array<RawProviderPayload<Record<string, unknown>>> = [{
    schemaVersion: racingDataApiHubSchemaVersion,
    payloadId: 'raw-official-feed-race-7',
    providerId: 'provider-official-feed',
    ingestionJobId: 'job-racing-hub-seed-1',
    tenant,
    receivedAt: timestamp,
    connectionType: 'rest',
    syncMode: 'pull',
    contentType: 'application/json',
    raw: { raceId: 'race-7', raceNumber: 7, horses: [{ id: 'horse-1', name: 'Lifecycle Runner' }], resultStatus: 'unofficial' },
    license: activeLicense,
    piiPresent: false,
    dataClasses: ['race-card', 'entries', 'results', 'horse-profile'],
    lineage: lineage('provider-official-feed', 'corr:raw-official-feed-race-7', 'job-racing-hub-seed-1'),
    evidenceRefs: ['evidence:raw-official-feed-race-7'],
    auditRefs: ['audit:raw-official-feed-race-7'],
    eventRefs: ['event:racing-data.raw-payload.received'],
  }];

  const raceCards = [canonicalEnvelope('canonical-race-card-race-7', 'provider-official-feed', 'race-card', { raceId: 'race-7', trackId: 'main-track', raceDate: timestamp.slice(0, 10), raceNumber: 7, scheduledPostTime: timestamp, status: 'watch' }, timestamp, ['raw-official-feed-race-7'], activeLicense)];
  const races = [canonicalEnvelope('canonical-race-race-7', 'provider-official-feed', 'race-card', { id: 'race-7', trackId: 'main-track', surface: 'dirt', distanceFurlongs: 8, condition: 'allowance', approvalRequired: true }, timestamp, ['raw-official-feed-race-7'], activeLicense)];
  const horses = [canonicalEnvelope('canonical-horse-horse-1', 'provider-official-feed', 'horse-profile', { id: 'horse-1', name: 'Lifecycle Runner', lifecycleStatus: 'active', eligibilityStatus: 'under-review', veterinarianReviewRequired: true }, timestamp, ['raw-official-feed-race-7'], activeLicense)];
  const entries = [canonicalEnvelope('canonical-entry-race-7-horse-1', 'provider-official-feed', 'entries', { id: 'entry-race-7-horse-1', raceId: 'race-7', horseId: 'horse-1', trainerId: 'trainer-1', postPosition: 1, declared: true }, timestamp, ['raw-official-feed-race-7'], activeLicense)];
  const results = [canonicalEnvelope('canonical-result-race-7', 'provider-official-feed', 'results', { raceId: 'race-7', status: 'unofficial', officialResultsLocked: true, stewardReviewRequired: true, finishOrder: [] }, timestamp, ['raw-official-feed-race-7'], activeLicense)];

  const dataQualityReports: RacingDataDataQualityReport[] = [{
    reportId: 'dq-racing-data-official-feed',
    generatedAt: timestamp,
    providerId: 'provider-official-feed',
    tenant,
    score: 0.97,
    status: 'pass',
    checks: [
      { checkId: 'license-active', label: 'License permits governed operational use', severity: 'info', passed: true, evidenceRefs: ['license:active'] },
      { checkId: 'lineage-present', label: 'Raw-to-canonical lineage is populated', severity: 'info', passed: true, evidenceRefs: ['audit:raw-official-feed-race-7'] },
      { checkId: 'no-scraping', label: 'No scraping or external runtime call was performed by facade reads', severity: 'info', passed: true, evidenceRefs: ['contract:racing-data-api-hub'] },
    ],
    licenseStatus: activeLicense.licenseStatus,
    lineageRefs: ['raw-official-feed-race-7', 'canonical-race-card-race-7'],
    evidenceRefs: ['evidence:dq-official-feed'],
    auditRefs: ['audit:dq-official-feed'],
    eventRefs: ['event:racing-data.quality.reported'],
    externalCallsPerformed: false,
    scrapingPerformed: false,
  }];

  const lineageRecords: RacingDataLineageRecord[] = [
    ...providers.map((provider): RacingDataLineageRecord => ({ artifactId: provider.providerId, artifactType: 'provider', providerId: provider.providerId, tenant, lineage: provider.lineage, upstreamRefs: provider.endpointRefs, downstreamRefs: ['job-racing-hub-seed-1'], license: provider.license, evidenceRefs: provider.evidenceRefs, auditRefs: provider.auditRefs, eventRefs: provider.eventRefs, externalCallsPerformed: false, scrapingPerformed: false })),
    ...ingestionJobs.map((job): RacingDataLineageRecord => ({ artifactId: job.jobId, artifactType: 'ingestion-job', providerId: job.providerId, tenant, lineage: job.lineage, upstreamRefs: job.rawPayloadRefs, downstreamRefs: job.canonicalEnvelopeRefs, license: job.licenseSnapshot, evidenceRefs: job.evidenceRefs, auditRefs: job.auditRefs, eventRefs: job.eventRefs, externalCallsPerformed: false, scrapingPerformed: false })),
    ...rawPayloads.map((payload): RacingDataLineageRecord => ({ artifactId: payload.payloadId, artifactType: 'raw-payload', providerId: payload.providerId, tenant, lineage: payload.lineage, upstreamRefs: payload.lineage.sourceRefs, downstreamRefs: ['canonical-race-card-race-7'], license: payload.license, evidenceRefs: payload.evidenceRefs, auditRefs: payload.auditRefs, eventRefs: payload.eventRefs, externalCallsPerformed: false, scrapingPerformed: false })),
    ...[...raceCards, ...races, ...horses, ...entries, ...results].map((envelope): RacingDataLineageRecord => ({ artifactId: envelope.envelopeId, artifactType: 'canonical-envelope', providerId: envelope.providerId, tenant, lineage: envelope.lineage, upstreamRefs: envelope.sourcePayloadRefs, downstreamRefs: [], license: envelope.license, evidenceRefs: envelope.evidenceRefs, auditRefs: envelope.auditRefs, eventRefs: envelope.eventRefs, externalCallsPerformed: false, scrapingPerformed: false })),
    ...dataQualityReports.map((report): RacingDataLineageRecord => ({ artifactId: report.reportId, artifactType: 'data-quality-report', providerId: report.providerId, tenant, lineage: lineage(report.providerId, `corr:${report.reportId}`, undefined, report.lineageRefs), upstreamRefs: report.lineageRefs, downstreamRefs: [], license: activeLicense, evidenceRefs: report.evidenceRefs, auditRefs: report.auditRefs, eventRefs: report.eventRefs, externalCallsPerformed: false, scrapingPerformed: false })),
  ];

  return {
    metadata: createRacingDataApiHubServiceMetadata(timestamp),
    providers,
    statuses,
    ingestionJobs,
    rawPayloads,
    canonical: { raceCards, races, horses, entries, results },
    dataQualityReports,
    lineage: lineageRecords,
    governance: { stateChangingOperationsDraftOnly: true, externalCallsAllowed: false, scrapingAllowed: false, unsafeOperationsRequireApproval: true },
  };
}

export function findRacingDataProvider(state: RacingDataApiFacadeState, providerId: string): ProviderConfig | undefined {
  return state.providers.find((provider) => provider.providerId === providerId);
}

export function findRacingDataStatus(state: RacingDataApiFacadeState, providerId: string): ProviderStatus | undefined {
  return state.statuses.find((status) => status.providerId === providerId);
}

export function isRacingDataLicenseAllowed(licenseMetadata: RacingDataLicenseMetadata, operation: string, requiredScopes: RacingDataUsageScope[] = []): { allowed: boolean; details: string[] } {
  const validation = validateRacingDataLicenseMetadata(licenseMetadata);
  const details = [...validation.errors];
  if (!['active', 'evaluation'].includes(licenseMetadata.licenseStatus)) details.push(`License status ${licenseMetadata.licenseStatus} is not permitted for ${operation}.`);
  for (const scope of requiredScopes) {
    if (!Array.isArray(licenseMetadata.usageScope) || !licenseMetadata.usageScope.includes(scope)) details.push(`License scope ${scope} is required for ${operation}.`);
  }
  return { allowed: details.length === 0, details };
}

export function createRacingDataLicenseDenied(operation: string, provider?: ProviderConfig, details: string[] = []): RacingDataLicenseDeniedBody {
  return {
    ok: false,
    error: {
      code: 'license_not_permitted',
      message: `Racing data ${operation} is blocked by provider license governance.`,
      details: details.length ? details : ['Provider license does not permit this governed operation.'],
    },
    providerId: provider?.providerId,
    operation,
    license: provider ? {
      licenseStatus: provider.license.licenseStatus,
      commercialUseAllowed: provider.license.commercialUseAllowed,
      redistributionAllowed: provider.license.redistributionAllowed,
      usageScope: provider.license.usageScope,
      evidenceRefs: provider.license.evidenceRefs,
    } : undefined,
    externalCallsPerformed: false,
    scrapingPerformed: false,
  };
}

export function createRacingDataDraftResult(operation: string, eventType: string, providerId?: string): RacingDataDraftResult {
  return {
    accepted: true,
    draftId: `racing-data-draft-${Date.now()}`,
    approvalRequired: true,
    audited: true,
    executionAllowed: false,
    externalCallsPerformed: false,
    scrapingPerformed: false,
    eventType,
    providerId,
    jobId: operation === 'ingest' && providerId ? `racing-data-ingest-draft-${Date.now()}` : undefined,
    message: `Racing Data API Hub ${operation} draft accepted for human approval and license review only. No scraping, external provider call, data export, Digital Twin mutation, or unsafe state change was performed.`,
    governance: { stateChangingOperation: true, draftOnly: true, licenseReviewRequired: true, humanApprovalRequired: true },
    mock: false,
  };
}
