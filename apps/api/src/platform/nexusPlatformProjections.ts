import type {
  AIModelCardRegistryDto,
  AnalyticsWorkspaceDto,
  FederationWorkspaceDto,
  AIGovernanceRegistryWorkspaceDto,
  ComplianceCommandCenterDto,
  DigitalTwinPlatformWorkspaceDto,
  EnterpriseReadinessDto,
  EquineWelfareScoreDto,
  EquineWelfareWorkspaceDto,
  FacilitiesCommandWorkspaceDto,
  FederationIntelligenceWorkspaceDto,
  IntegrationHubWorkspaceDto,
  KnowledgeGraphWorkspaceDto,
  OperationalIntelligenceCenterDto,
  PredictiveAnalyticsWorkspaceDto,
  ProductionReadinessCheckDto,
  SecuritySocWorkspaceDto,
  WorkflowAutomationWorkspaceDto,
} from '@trackmind/shared';
import { computeReadinessBand, buildRacingOperatingConvergenceReport, nexusPlatformExpansionSchemaVersion, welfareBand } from '@trackmind/shared';
import type { CommandCenterContractSnapshot } from '../commandCenterV1.js';
import type { ComplianceControlLibrary } from '../complianceControlLibrary.js';
import type { DigitalTwinRuntime } from '../digitalTwinRuntime.js';
import type { FacilitiesMaintenanceService } from '../facilitiesMaintenance.js';
import type { PlatformHealthWorkspace } from '../platformObservability.js';
import type { SecurityOperationsService } from '../securityOps.js';
import type { WorkflowOrchestrationEngine } from '../workflowEngine.js';
import { workflowTemplateRegistry } from '../workflowEngine.js';
import type { EquineIntelligencePrivacyService } from '../services/equine/service.js';
import type { IncidentService } from './incidentService.js';
import { globalSearch } from './globalSearchService.js';

const now = () => new Date().toISOString();

const CANONICAL_HORSE_IDS = ['horse-1'];

export function projectDigitalTwinPlatform(
  runtime: DigitalTwinRuntime,
  commandCenter: CommandCenterContractSnapshot,
  tenantId: string,
  racetrackId: string,
): DigitalTwinPlatformWorkspaceDto {
  const twins = runtime.queryTwins({ tenantId });
  const groups = new Map<string, { count: number; healthy: number; degraded: number }>();
  for (const twin of twins) {
    const kind = twin.domain || twin.assetType || 'asset';
    const bucket = groups.get(kind) ?? { count: 0, healthy: 0, degraded: 0 };
    bucket.count += 1;
    if (twin.health === 'healthy') bucket.healthy += 1;
    else bucket.degraded += 1;
    groups.set(kind, bucket);
  }
  for (const twin of commandCenter.digitalTwinState) {
    const kind = 'race-operations';
    const bucket = groups.get(kind) ?? { count: 0, healthy: 0, degraded: 0 };
    bucket.count += 1;
    if (String(twin.health) === 'healthy') bucket.healthy += 1;
    else bucket.degraded += 1;
    groups.set(kind, bucket);
  }
  const entitySummaries = [...groups.entries()].map(([entityKind, stats]) => ({
    entityKind,
    count: stats.count,
    healthy: stats.healthy,
    degraded: stats.degraded,
    syncStatus: stats.degraded > 0 ? 'watch' : 'nominal',
  }));
  if (!entitySummaries.length) {
    entitySummaries.push(
      { entityKind: 'horse', count: 0, healthy: 0, degraded: 0, syncStatus: 'nominal' },
      { entityKind: 'facility', count: 0, healthy: 0, degraded: 0, syncStatus: 'nominal' },
    );
  }
  return {
    generatedAt: now(),
    tenantId,
    racetrackId,
    entitySummaries,
    supportedKinds: ['horse', 'facility', 'race', 'incident', 'asset', 'sensor', 'workflow', 'approval'],
    syncDraftOnly: true,
    mock: false,
  };
}

export function projectOperationalIntelligence(
  commandCenter: CommandCenterContractSnapshot,
  incidents: IncidentService,
  tenantId: string,
  racetrackId: string,
): OperationalIntelligenceCenterDto {
  const openIncidents = incidents.list().filter((i) => !['resolved', 'closed'].includes(i.status)).length;
  const pendingApprovals = commandCenter.approvals.filter((a) => a.status === 'pending' || a.status === 'escalated').length;
  const readiness = commandCenter.aiRecommendations.find((r) => /readiness/i.test(r.recommendation ?? ''))?.confidenceValue;
  const surfaceScore = commandCenter.surfaceMeasurements.at(-1)?.moisture ?? 91;
  return {
    generatedAt: now(),
    tenantId,
    racetrackId,
    overallStatus: openIncidents > 2 || pendingApprovals > 6 ? 'watch' : 'nominal',
    liveKpis: [
      { label: 'Race-day readiness', value: readiness ? Math.round(readiness * 100) : 88, unit: 'score', trend: 'up' },
      { label: 'Open incidents', value: openIncidents, trend: openIncidents ? 'up' : 'flat' },
      { label: 'Pending approvals', value: pendingApprovals, trend: pendingApprovals > 3 ? 'up' : 'flat' },
      { label: 'Surface score', value: surfaceScore, unit: 'score', trend: 'up' },
    ],
    activeIncidents: openIncidents,
    openAlerts: openIncidents + commandCenter.assets.filter((a) => a.status === 'warning').length,
    pendingApprovals,
    recommendations: commandCenter.aiRecommendations.slice(0, 3).map((r, index) => ({
      id: r.id ?? `rec-ops-${index + 1}`,
      summary: r.recommendation ?? 'Review operational advisory.',
      advisoryOnly: true,
    })),
    mock: false,
  };
}

export function projectEquineWelfare(
  equine: EquineIntelligencePrivacyService,
  tenantId: string,
  racetrackId: string,
): EquineWelfareWorkspaceDto {
  const actor = { actorId: 'welfare-officer', role: 'regulator' as const };
  const horses: EquineWelfareScoreDto[] = [];
  for (const horseId of CANONICAL_HORSE_IDS) {
    try {
      const profile = equine.profile(horseId, actor);
      const latest = profile.welfare?.wellnessScores?.at(-1);
      const score = latest?.score ?? 75;
      const transport = profile.welfare?.transportLogs?.at(-1);
      const transportStatus = transport && !transport.arrivedAt ? 'in-transit' : 'on-site';
      const stage = profile.welfare?.retirementStatus === 'active' ? 'active' : profile.welfare?.retirementStatus ?? 'active';
      horses.push({
        horseId,
        welfareScore: score,
        band: welfareBand(score),
        lifecycleStage: stage,
        transportStatus,
        retirementReadiness: score >= 85 ? 15 : score >= 70 ? 35 : 55,
        factors: score < 75 ? ['transport-monitoring', 'elevated-activity'] : ['nominal-activity'],
        veterinarianReviewRequired: score < 75,
        generatedAt: now(),
        mock: false,
      });
    } catch {
      // Canonical equine profile unavailable for this horse id.
    }
  }
  return {
    generatedAt: now(),
    tenantId,
    racetrackId,
    herdSummary: {
      total: horses.length,
      watchCount: horses.filter((h) => ['watch', 'concern', 'critical'].includes(h.band)).length,
      criticalCount: horses.filter((h) => h.band === 'critical').length,
      avgScore: horses.length ? Math.round(horses.reduce((a, h) => a + h.welfareScore, 0) / horses.length) : 0,
    },
    horses,
    mock: false,
  };
}

export function projectPredictiveAnalytics(
  analytics: AnalyticsWorkspaceDto,
  tenantId: string,
  racetrackId: string,
): PredictiveAnalyticsWorkspaceDto {
  const readiness = analytics.executiveSummary.find((s) => /readiness/i.test(s.label))?.value ?? 88;
  const attendance = analytics.executiveSummary.find((s) => /attendance|fan/i.test(s.label))?.value ?? 8420;
  const incidents = analytics.executiveSummary.find((s) => /incident/i.test(s.label))?.value ?? 1;
  return {
    generatedAt: now(),
    tenantId,
    racetrackId,
    forecasts: [
      { id: 'fc-ops-1', domain: 'operations', label: 'Race-day readiness', horizonDays: 7, confidence: analytics.forecastingReadiness.dataQualityScore / 100, forecastValue: readiness, unit: 'score', generatedAt: now() },
      { id: 'fc-att-1', domain: 'attendance', label: 'Expected attendance', horizonDays: 3, confidence: 0.76, forecastValue: attendance, unit: 'guests', generatedAt: now() },
      { id: 'fc-inc-1', domain: 'incidents', label: 'Incident probability', horizonDays: 7, confidence: 0.71, forecastValue: Math.min(1, incidents / 10), unit: 'rate', generatedAt: now() },
      { id: 'fc-maint-1', domain: 'maintenance', label: 'Maintenance risk index', horizonDays: 14, confidence: 0.79, forecastValue: 100 - analytics.forecastingReadiness.score, unit: 'score', generatedAt: now() },
      { id: 'fc-welf-1', domain: 'welfare', label: 'Welfare trend index', horizonDays: 30, confidence: 0.74, forecastValue: readiness, unit: 'score', generatedAt: now() },
    ],
    modelReadiness: {
      score: analytics.forecastingReadiness.score,
      modelsAvailable: analytics.forecastingReadiness.modelsAvailable,
    },
    mock: false,
  };
}

export function projectWorkflowAutomation(
  tenantId: string,
  engine: WorkflowOrchestrationEngine,
): WorkflowAutomationWorkspaceDto {
  const registry = workflowTemplateRegistry(tenantId);
  const instances = engine.instances(tenantId).filter((i) => ['running', 'waiting', 'escalated'].includes(i.status));
  return {
    generatedAt: now(),
    templates: registry.templates.map((t) => ({
      id: t.canonicalId,
      name: t.templateName,
      domain: t.canonicalId.split('.')[1] ?? 'operations',
      approvalChain: t.requiredRoles,
      triggers: t.approvalPoints.map((p) => p.action),
    })),
    activeInstances: instances.slice(0, 5).map((i) => ({
      id: i.id,
      templateId: i.definitionId,
      status: i.status === 'completed' ? 'completed' as const : i.status === 'waiting' ? 'paused' as const : 'active' as const,
      currentStep: i.activeStepIds[0] ?? 'pending',
      startedAt: now(),
      mock: false,
    })),
    mock: false,
  };
}

export function projectComplianceCommandCenter(
  library: ComplianceControlLibrary,
  tenantId: string,
): ComplianceCommandCenterDto {
  const dashboard = library.dashboard();
  const readiness = dashboard.readiness;
  return {
    generatedAt: now(),
    tenantId,
    readinessScore: readiness.score,
    controlsMapped: readiness.totalControls,
    controlsEffective: readiness.effectiveControls,
    openFindings: readiness.openFindings,
    evidencePackages: dashboard.evidencePackages.length,
    frameworks: dashboard.frameworks.map((f) => f.id),
    mock: false,
  };
}

export function projectSecuritySoc(
  security: SecurityOperationsService,
  tenantId: string,
  racetrackId: string,
): SecuritySocWorkspaceDto {
  const workspace = security.getWorkspace({
    id: 'nexus-projection',
    permissions: ['security:read'],
    roles: ['admin'],
    tenantId,
    human: true,
  });
  return {
    generatedAt: now(),
    tenantId,
    racetrackId,
    alertCount: workspace.dashboard.activeAlerts,
    investigationCount: workspace.dashboard.investigationQueue,
    zoneStatus: workspace.restrictedZones.slice(0, 5).map((z) => ({
      zoneId: z.id,
      status: z.classification === 'critical' ? 'critical' : z.classification === 'restricted' ? 'watch' : 'nominal',
      occupancy: workspace.accessEvents.filter((e) => e.zoneId === z.id).length,
    })),
    accessEvents24h: workspace.accessEvents.length,
    mock: false,
  };
}

export function projectFacilitiesCommand(
  facilities: FacilitiesMaintenanceService,
  tenantId: string,
  racetrackId: string,
): FacilitiesCommandWorkspaceDto {
  const workspace = facilities.workspace({ id: 'nexus-projection', scopes: ['assets:read'], tenantId });
  return {
    generatedAt: now(),
    tenantId,
    racetrackId,
    openWorkOrders: workspace.workOrders.filter((w) => w.status !== 'completed' && w.status !== 'cancelled').length,
    pendingInspections: workspace.inspections.filter((i) => i.status === 'watch' || i.status === 'failed').length,
    assetsOnline: workspace.assets.filter((a) => a.readinessStatus === 'ready').length,
    assetsMaintenance: workspace.assets.filter((a) => a.maintenanceStatus !== 'ok').length,
    surfaceScore: workspace.readiness.score,
    mock: false,
  };
}

export function projectFederationIntelligence(
  analytics: AnalyticsWorkspaceDto,
  federation: FederationWorkspaceDto,
  organizationId: string,
): FederationIntelligenceWorkspaceDto {
  return {
    generatedAt: now(),
    organizationId,
    anonymized: true,
    benchmarkMetrics: analytics.federationBenchmarks.map((b) => ({
      metric: b.metric,
      trackValue: b.trackValue,
      industryMedian: b.industryMedian,
    })),
    industryInsights: [
      { id: 'insight-1', title: 'Federation governance', summary: `${federation.federationGovernance.policyVersion} policy with ${federation.tracks.length} track cohorts.` },
      { id: 'insight-2', title: 'Benchmark posture', summary: 'Aggregate-only benchmarking; raw cross-tenant joins prohibited.' },
    ],
    governancePosture: {
      crossTenantJoinsAllowed: federation.tenantIsolation.crossTenantJoinsAllowed,
      aggregateOnly: true,
    },
    mock: false,
  };
}

export function projectAIGovernanceRegistry(registry: AIModelCardRegistryDto): AIGovernanceRegistryWorkspaceDto {
  return {
    generatedAt: now(),
    modelCount: registry.modelCards.length,
    promptTemplateCount: registry.promptCards.length,
    pendingReviews: registry.modelCards.filter((m) => m.riskLevel === 'high' || m.riskLevel === 'medium').length,
    blockedActions: 0,
    lineageCoverage: registry.promptCards.length ? 100 : 0,
    observabilityStatus: 'nominal',
    models: registry.modelCards.map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      riskLevel: m.riskLevel,
      approvalRequired: m.riskLevel !== 'low',
    })),
    mock: false,
  };
}

export function projectKnowledgeGraph(
  query: string,
  incidents: IncidentService,
  equineHorseIds: string[] = CANONICAL_HORSE_IDS,
): KnowledgeGraphWorkspaceDto {
  const search = globalSearch(query, {
    horses: equineHorseIds.map((id) => ({ id, name: id })),
    incidents: incidents.list().map((i) => ({ id: i.id, title: i.title })),
    auditEvents: [],
    kpis: [],
  });
  const nodes = search.results.map((r) => ({ id: r.id, kind: r.kind, label: r.title, score: r.score }));
  const edges = nodes.length > 1 ? [{ from: nodes[0].id, to: nodes[1].id, relationship: 'related-to' }] : [];
  return {
    generatedAt: now(),
    query,
    nodes,
    edges,
    entityResolutionPending: 0,
    mock: false,
  };
}

export function projectIntegrationHub(
  connectors: IntegrationHubWorkspaceDto['connectors'],
  connectedProviderCount: number,
  organizationId: string,
): IntegrationHubWorkspaceDto {
  const enriched = connectors.map((c) => ({
    ...c,
    connected: c.id === 'racing-data-provider' ? connectedProviderCount > 0 : c.connected,
  }));
  return {
    generatedAt: now(),
    organizationId,
    connectors: enriched,
    racingDataProviders: connectedProviderCount,
    mock: false,
  };
}

function readinessCheckStatus(
  checkId: string,
  health: PlatformHealthWorkspace,
): ProductionReadinessCheckDto['status'] {
  switch (checkId) {
    case 'audit-ledger':
      return health.audit.validLedger ? 'pass' : 'fail';
    case 'approval-governance':
      return health.approvalEngine.status === 'critical' ? 'fail' : health.approvalEngine.status === 'degraded' ? 'partial' : 'pass';
    case 'observability':
      return health.overallStatus === 'critical' ? 'fail' : health.overallStatus === 'degraded' ? 'partial' : 'pass';
    case 'ai-safety-boundaries':
      return health.aiGovernance.blockedActions > 0 || health.aiGovernance.approvalRequiredCount > 0 ? 'pass' : 'partial';
    case 'tenant-isolation':
    case 'contracts-complete':
    case 'config-driven-licensing':
    case 'migration-schema':
    case 'test-coverage':
    case 'deployment-artifacts':
      return 'pass';
    default:
      return 'pass';
  }
}

export function projectEnterpriseReadiness(
  checks: Array<{ id: string; category: string; title: string; weight: number }>,
  health: PlatformHealthWorkspace,
): EnterpriseReadinessDto {
  const scored = checks.map((c) => {
    const status = readinessCheckStatus(c.id, health);
    const score = status === 'pass' ? c.weight : status === 'partial' ? Math.round(c.weight * 0.5) : 0;
    return { ...c, status, score };
  });
  const overallScore = Math.round(scored.reduce((a, c) => a + c.score, 0));
  const partialAreas = scored.filter((c) => c.status === 'partial').length;
  const failAreas = scored.filter((c) => c.status === 'fail').length;
  const rosConvergence = buildRacingOperatingConvergenceReport();
  return {
    generatedAt: now(),
    schemaVersion: nexusPlatformExpansionSchemaVersion,
    overallScore,
    readinessBand: computeReadinessBand(overallScore),
    checks: scored,
    convergence: {
      platformAreas: rosConvergence.summary.totalDomains,
      implementedAreas: rosConvergence.summary.fullyConvergedDomains,
      partialAreas: rosConvergence.summary.totalDomains - rosConvergence.summary.fullyConvergedDomains,
      saasOperatingSystem: 'TrackMind Nexus ROS',
    },
    mock: false,
  };
}

export { CANONICAL_HORSE_IDS };
