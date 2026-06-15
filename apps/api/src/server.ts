import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createTrackMindIntelligenceCoreMetadata, createTrackMindNexusUpgradePackage, createUnifiedDataModelWorkspace, hasPermission, nexusApiBasePath, protectedActions, type AIControlPlaneDraftResultDto, type AIControlPlaneWorkspaceDto, type Permission, type Role, type RosFacadeStateDto, type TrackCertificationCandidateDto, type TrackMindIntelligenceCoreDto, type TrackMindNexusUpgradePackage, type TUSTwinStandardDto } from '@trackmind/shared';
import { listAIAgentRegistryRecords, listExpertModelRegistry } from './aiControlPlane.js';
import { createApiHubEventCatalog } from './apiHubAdapters.js';
import { CentralizedApprovalService, type ApprovalActor, type ApprovalToken, type ControlledAction } from './approvals.js';
import { createUniversalArtifactDraftRegistrationResult, createUniversalArtifactFrameworkState, type UniversalArtifactFrameworkState } from './artifacts.js';
import { ImmutableAuditLog, type RetentionPolicy } from './auditLog.js';
import { createSeededBarnOperationsService } from './barnOperations.js';
import { createCommandCenterContractSnapshot } from './commandCenterV1.js';
import { CollaborationService, type CollaborationActivityQuery, type CollaborationCreateAssignmentInput, type CollaborationCreateCommentInput, type CollaborationCreateDecisionInput, type CollaborationPrincipal, type CollaborationThreadQuery } from './collaborationService.js';
import { seededComplianceLibrary } from './complianceControlLibrary.js';
import { createComplianceReportingController, type ComplianceReportingController } from './compliance/index.js';
import { EmergencyOperationsPlatform } from './emergencyOperations.js';
import { createCqrsCommandHandler, type CqrsCommandHandler, type RaceStartCommandBody, type SafetyCriticalCommandBody } from './events/index.js';
import { createNexusEventCatalog } from './eventBus.js';
import { FacilitiesMaintenanceService } from './facilitiesMaintenance.js';
import { createFederationWorkspace } from './federation.js';
import { createTrackCertificationCandidate } from './franchiseCertification.js';
import { createKPIWorkspace, filterKPIWorkspace } from './kpiArtifacts.js';
import { createMockPlatformHealth } from './platformObservability.js';
import { createRacingDataApiFacadeState, createRacingDataDraftResult, createRacingDataLicenseDenied, findRacingDataProvider, findRacingDataStatus, isRacingDataLicenseAllowed, type RacingDataApiFacadeState } from './racingDataApiHub.js';
import { seededRacingDataLicensePolicyService } from './racingDataLicensePolicy.js';
import { RaceDayReadinessService } from './raceDayReadiness.js';
import { RaceOperationsPlatform, type RaceTelemetrySignal } from './raceOperationsPlatform.js';
import { ResponsibleAIGovernancePlatform } from './responsibleAiGovernor.js';
import { createSafetyIntelligenceController, type SafetyIntelligenceController } from './safetyIntelligence/index.js';
import { SecurityOperationsService, type SecurityActor } from './securityOps.js';
import { createApexDomainControllers, type ApexDomainControllers } from './services/controllers.js';
import { createEquineIntelligenceController, type EquineIntelligenceController } from './services/equine/index.js';
import { createRtkTelemetryController, type RtkTelemetryController } from './telemetry/index.js';
import { buildSurfaceIntelligenceWorkspace, type SurfaceIntelligenceInput } from './trackSurface.js';
import { listStewardInquiries } from './stewarding.js';
import { createTUSStandardizationWorkspace, legacyAssetToTUSAsset } from './tusStandardization.js';
import { workflowTemplateRegistry } from './workflowEngine.js';
import { seedWorkforceOperations } from './workforceOperations.js';

type HttpMethod = 'GET' | 'POST' | 'OPTIONS';
type JsonBody = unknown;
type SeededAIAgent = { id: string; name: string; owner: string; modelVersionId: string; promptTemplateId: string; allowedActivities?: string[]; restrictedActions: string[]; digitalTwinRefs?: string[] };
type SeededAIModelVersion = { id: string; lineage: string[] };
type SeededAIPolicy = { id: string; allowedActivities: string[]; protectedActions: string[]; prohibitedAutonomousActions: string[]; requiredEvidence: string[]; humanApprovalRequiredFor: string[] };
type SeededAIApproval = { id: string; recommendationId: string; policy: string; requiredRoles: string[]; status: string; evidence: string[]; approvalRequestId?: string; workflowRecordId?: string };
type SeededAIEvidencePackage = { id: string; recommendationId: string; evidence: string[] };
type SeededAIAuditTrail = { id: string; subject: string };
type SeededAIEvent = { id: string; subjectId: string };
type SeededAIDigitalTwinImpact = { twinId: string; recommendationId: string };
type SeededAIRecommendation = { id: string; agentId?: string; modelVersionId?: string; promptTemplateId?: string; createdAt?: string; approvalPolicy?: string; confidence: number; confidenceScore?: { calibrated?: number; band?: 'low' | 'medium' | 'high'; drivers?: string[] }; evidence?: string[]; affectedAssets?: string[]; riskLevel?: string; action?: string; target?: string; recommendation?: string; reason?: string; status?: string; activity?: string; lineage?: string[]; explainability?: { limitations: string[] } };
type SeededAIGovernanceWorkspace = { activeAgents: SeededAIAgent[]; modelVersions: SeededAIModelVersion[]; recommendationQueue: SeededAIRecommendation[]; safetyBlockedActions: SeededAIRecommendation[]; evaluationStatus: unknown; approvalRequirements: SeededAIApproval[]; safetyPolicies: SeededAIPolicy[]; evidencePackages: SeededAIEvidencePackage[]; auditTrails: SeededAIAuditTrail[]; events: SeededAIEvent[]; digitalTwinImpacts?: SeededAIDigitalTwinImpact[] };

const now = () => new Date().toISOString();
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, x-trackmind-request-id, x-trackmind-tenant-id, x-trackmind-racetrack-id, x-trackmind-organization-id, x-trackmind-role', 'access-control-allow-methods': 'GET, POST, OPTIONS' };

function createRequestId() {
  return `tm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestIdFromHeader(value: IncomingMessage['headers'][string]) {
  return Array.isArray(value) ? value[0] : value;
}

function apiErrorBody(input: { code: string; message: string; path: string; requestId?: string; details?: string[] }) {
  return { ok: false, error: { code: input.code, message: input.message, details: input.details ?? [], path: input.path, requestId: input.requestId ?? createRequestId(), timestamp: now() } };
}

function apiNotFound(message: string, path: string, requestId: string): { status: number; headers: Record<string, string>; body: JsonBody } {
  return { status: 404, headers: { 'x-trackmind-request-id': requestId }, body: apiErrorBody({ code: 'not_found', message, path, requestId }) };
}

function structuredLog(level: 'info' | 'error', event: string, fields: Record<string, unknown>) {
  const entry = JSON.stringify({ level, event, service: 'trackmind-api', timestamp: now(), ...fields });
  if (level === 'error') console.error(entry);
  else console.log(entry);
}

type AIApprovalRecord = { id?: string; policy?: string; approvalRequestId?: string; workflowRecordId?: string };

function aiRecommendationGovernanceMetadata(input: {
  id: string;
  modelVersionId?: string;
  fallbackModelVersion: string;
  createdAt?: string;
  fallbackGeneratedAt: string;
  approvalPolicy?: string;
  approval?: AIApprovalRecord;
  auditIds: string[];
  eventIds: string[];
  digitalTwinRefs: string[];
}) {
  const approvalReference = input.approval?.approvalRequestId ?? input.approval?.id;
  return {
    recommendationId: input.id,
    modelVersion: input.modelVersionId ?? input.fallbackModelVersion,
    generatedAt: input.createdAt ?? input.fallbackGeneratedAt,
    approvalRequirement: {
      required: Boolean(input.approval) || (input.approvalPolicy ?? 'none') !== 'none',
      policy: input.approval?.policy ?? input.approvalPolicy ?? 'none',
      requirementId: input.approval?.id,
      workflowId: input.approval?.workflowRecordId ?? input.approval?.approvalRequestId,
    },
    auditReference: {
      auditIds: [...input.auditIds],
      eventIds: [...input.eventIds],
      digitalTwinRefs: [...input.digitalTwinRefs],
      approvalReference,
    },
  };
}

function createSurfaceFacadeInput(timestamp: string): SurfaceIntelligenceInput {
  return {
    trackId: 'main-track',
    generatedAt: timestamp,
    telemetry: [
      { id: 'surface-live-1', sectionId: 'far-turn', surfaceType: 'dirt', latitude: 38.049, longitude: -76.944, moisture: 27, compaction: 276, drainageRate: 6, cushionDepth: 2.8, temperature: 83, rainfall: 3, observedAt: timestamp },
      { id: 'surface-live-2', sectionId: 'backstretch', surfaceType: 'dirt', latitude: 38.041, longitude: -76.958, moisture: 14, compaction: 205, drainageRate: 11, cushionDepth: 3.7, temperature: 82, rainfall: 1, observedAt: timestamp },
      { id: 'surface-live-3', sectionId: 'stretch', surfaceType: 'synthetic', latitude: 38.044, longitude: -76.949, moisture: 12, compaction: 212, drainageRate: 13, cushionDepth: 3.1, temperature: 80, rainfall: 1, observedAt: timestamp },
    ],
    inspections: [{ id: 'surface-inspection-live-1', sectionId: 'far-turn', inspectedAt: timestamp, inspector: 'track-superintendent', surfaceType: 'dirt', footingUniformity: 72, divots: 4, standingWater: true, railWear: 3, observations: ['standing water near inside lane'] }],
    weather: { observedAt: timestamp, rainfallMm: 5, forecastRainMm: 14, temperature: 83, windMph: 12 },
    maintenanceRecords: [
      { id: 'surface-maint-live-1', sectionId: 'far-turn', completedAt: timestamp, action: 'harrow', effectiveness: 6, notes: 'partial improvement before additional drainage review' },
      { id: 'surface-maint-live-2', sectionId: 'backstretch', completedAt: timestamp, action: 'water', effectiveness: 8, notes: 'routine moisture adjustment' },
    ],
    observations: [{ id: 'surface-observation-live-1', sectionId: 'far-turn', observedAt: timestamp, role: 'jockey', severity: 4, note: 'uneven footing on turn' }],
  };
}

function createServiceBackedFacilitiesWorkspace(timestamp: string): JsonBody {
  const service = new FacilitiesMaintenanceService();
  const principal = { id: 'facilities-supervisor', tenantId: 'track-1', scopes: ['assets:read', 'assets:write', 'assets:approve'] };
  service.seedFacilityAssetsSync(principal, timestamp);
  service.recordInspectionSync({
    assetId: 'GRANDSTAND_HVAC_01',
    inspectedBy: principal.id,
    checklist: ['filter pressure', 'airflow', 'motor temperature'],
    findings: ['filter pressure elevated', 'airflow verified for patron areas'],
    score: 84,
    nextInspectionDueAt: '2026-06-15T12:00:00.000Z',
  }, principal, timestamp);
  service.createPreventiveMaintenancePlan({
    assetId: 'GRANDSTAND_HVAC_01',
    cadenceDays: 7,
    checklist: ['replace filters', 'verify airflow', 'capture return-to-service evidence'],
    nextDueAt: '2026-06-15T12:00:00.000Z',
  }, principal);
  service.createWorkOrder({
    assetId: 'GRANDSTAND_HVAC_01',
    title: 'Replace grandstand HVAC filters',
    priority: 'high',
    requestedBy: principal.id,
    dueAt: '2026-06-14T20:00:00.000Z',
    tasks: ['lockout unit', 'replace filters', 'verify airflow'],
    evidence: ['inspection-hvac-live', 'telemetry:filterDeltaPressure=68'],
    operationalImpact: 'operational-impact',
    scheduledFor: '2026-06-14T18:00:00.000Z',
  }, principal);
  return service.workspace(principal);
}

function createServiceBackedEmergencyWorkspace(workforce: Record<string, any>, timestamp: string): JsonBody {
  const platform = new EmergencyOperationsPlatform();
  platform.registerWorkflowDefinitions('trackmind');
  platform.registerEmergencyPlan({ id: 'plan-fire', name: 'Barn fire and evacuation plan', scenarios: ['fire-incident', 'evacuation'], ownerRole: 'incident-commander', activationCriteria: ['alarm activation', 'smoke report', 'human commander declaration'], communicationChannels: ['radio', 'public-address', 'mass-notification'], evacuationZoneIds: ['zone-barn'], drillCadenceDays: 90 });
  platform.registerEmergencyPlan({ id: 'plan-weather', name: 'Severe weather shelter plan', scenarios: ['severe-weather'], ownerRole: 'weather-lead', activationCriteria: ['lightning within 10 miles', 'tornado warning', 'human weather lead override'], communicationChannels: ['radio', 'sms', 'public-address'], evacuationZoneIds: ['zone-grandstand'], drillCadenceDays: 60 });
  const workflow = platform.createEmergencyWorkflow({
    id: 'wf-fire-1',
    planId: 'plan-fire',
    activatedBy: 'Avery Chen',
    activatedByRoles: ['admin'],
    incident: { id: 'inc-100', scenario: 'fire-incident', severity: 'critical', location: 'Barn 2', reportedAt: timestamp, populationAtRisk: 40, affectedAssets: [{ assetId: 'barn:2', zone: 'zone-barn', risk: 'critical', dependencies: ['power-feed-2'] }, { assetId: 'grandstand', zone: 'zone-grandstand', risk: 'major' }], systems: [{ system: 'workflow-engine', status: 'online', dataFeeds: ['workflow-state'] }, { system: 'digital-twin-runtime', status: 'online', dataFeeds: ['asset-state', 'occupancy'] }, { system: 'access-control', status: 'degraded', dataFeeds: ['badges'] }, { system: 'platform-observability', status: 'online', dataFeeds: ['logs', 'metrics', 'traces'] }] },
    commandRoles: [{ id: 'role-ic', role: 'incident-commander', assignee: 'Avery Chen', permissions: ['activate-workflow', 'override-ai', 'dispatch-resource', 'send-communication', 'close-incident'] }, { id: 'role-med', role: 'medical-lead', assignee: 'Dr. Rivera', permissions: ['dispatch-resource', 'send-communication'] }, { id: 'role-fire', role: 'fire-lead', assignee: 'Captain Morgan', permissions: ['dispatch-resource', 'override-ai'] }, { id: 'role-weather', role: 'weather-lead', assignee: 'Sam Patel', permissions: ['send-communication', 'override-ai'] }, { id: 'role-evac', role: 'evacuation-lead', assignee: 'Jordan Lee', permissions: ['dispatch-resource', 'send-communication'] }],
    resources: [{ id: 'res-ambulance', kind: 'medical', label: 'EMS ambulance', status: 'assigned', zoneId: 'zone-grandstand', coordinates: { latitude: 38.044, longitude: -76.949 }, capacity: 2 }, { id: 'res-equine-ambulance', kind: 'medical', label: 'Equine ambulance', status: 'available', zoneId: 'zone-track', coordinates: { latitude: 38.052, longitude: -76.951 }, capacity: 1 }, { id: 'res-fire', kind: 'fire', label: 'Mutual-aid fire unit', status: 'assigned', zoneId: 'zone-barn', coordinates: { latitude: 38.061, longitude: -76.955 }, capacity: 4 }, { id: 'res-shelter', kind: 'shelter', label: 'Grandstand shelter level 1', status: 'available', zoneId: 'zone-grandstand', coordinates: { latitude: 38.043, longitude: -76.952 }, capacity: 900 }],
    workforceResources: workforce.emergencyResources ?? [],
    workforceReadiness: workforce.readiness,
    evacuationZones: [{ id: 'zone-barn', name: 'Barn zone', status: 'evacuating', route: ['north service gate', 'lot A'], assemblyArea: 'Lot A', capacity: 120 }, { id: 'zone-grandstand', name: 'Grandstand', status: 'open', route: ['main concourse', 'south plaza'], assemblyArea: 'South Plaza', capacity: 1200 }],
    communicationChecklist: [{ id: 'comm-radio', audience: 'field teams', channel: 'radio', message: 'Barn 2 evacuation in progress', completed: false }, { id: 'comm-pa', audience: 'patrons', channel: 'public-address', message: 'Avoid backstretch service road', completed: false }, { id: 'comm-regulator', audience: 'regulators', channel: 'email', message: 'Critical emergency workflow activated under human incident command', completed: false }],
    aiRecommendationId: 'ai-fire-advice-1',
    tenantId: 'trackmind',
    racetrackId: 'main-track',
  });
  platform.recordCommunication(workflow.id, 'comm-radio', 'Avery Chen');
  platform.runSimulationExercise('drill-weather-1', 'severe-weather', ['ops', 'security', 'facilities']);
  platform.completeDrill('drill-weather-1', 'Sam Patel', ['Shelter capacity reconciled with digital twin']);
  platform.afterActionReport('inc-100', [{ finding: 'Access-control feed failed over slowly', severity: 'major', owner: 'security' }]);
  return platform.workspace(false);
}

function createServiceBackedRaceOperations(timestamp: string) {
  const platform = new RaceOperationsPlatform({ approvalService: new CentralizedApprovalService(), tenantId: 'trackmind' });
  const actor = { id: 'racing-secretary-live', roles: ['racing-secretary'] as Role[], human: true };
  const raceDate = timestamp.slice(0, 10);
  const meet = platform.createMeet({ id: 'meet-2026', name: 'TrackMind Service-Backed Meet', trackId: 'main-track', startsOn: raceDate, endsOn: raceDate, status: 'open', officialConfig: { stewards: ['steward-live'], racingSecretary: actor.id, commission: 'state-racing-commission', rulesVersion: '2026.06', scratchDeadlineMinutes: 45, maxFieldSize: 14 } }, actor);
  const day = platform.createRaceDay({ id: 'day-live', meetId: meet.id, trackId: meet.trackId, raceDate, status: 'entries-open' }, actor);
  const race = platform.createRaceCard(day.id, { id: 'race-7', trackId: meet.trackId, raceDate, raceNumber: 7, scheduledPostTime: timestamp, conditions: { surface: 'dirt', distanceFurlongs: 8, classLevel: 'Allowance', purse: 85000, eligibility: ['three-year-olds-and-up'], medicationRules: ['HISA medication controls'], surfaceRequirements: ['track-superintendent-clearance'] } }, actor);
  platform.addEntry(race.id, { id: 'entry-rail-runner', horseId: 'horse-1', trainerId: 'trainer-1', ownerId: 'owner-1' }, actor.id);
  platform.addEntry(race.id, { id: 'entry-turn-signal', horseId: 'horse-2', trainerId: 'trainer-2', ownerId: 'owner-2' }, actor.id);
  platform.declareEntry(race.id, 'entry-rail-runner', 'jockey-1', 124, actor.id);
  platform.declareEntry(race.id, 'entry-turn-signal', 'jockey-2', 122, actor.id);
  platform.closeDeclarations(race.id, actor.id);
  platform.drawPostPositions(race.id, 7, actor.id);
  platform.assignGates(race.id, 'G', 'starter-live');
  platform.coordinateStaffing(race.id, { stewards: ['steward-live'], veterinarians: ['vet-live'], gateCrew: ['gate-crew-alpha'], outriders: ['outrider-1'], trackMaintenance: ['surface-team-alpha'], security: ['security-post-1'] }, 'operations');
  platform.allocateResources(race.id, [{ id: 'resource-gate-main', type: 'starting-gate', zone: 'backstretch', status: 'allocated' }, { id: 'resource-ambulance-eq', type: 'ambulance', zone: 'track', status: 'standby' }, { id: 'resource-camera-headon', type: 'camera', zone: 'finish', status: 'allocated' }], 'operations');
  const telemetry: RaceTelemetrySignal[] = [{ streamId: 'gate-status', type: 'gate', observedAt: timestamp, healthy: true, value: 'locked' }, { streamId: 'surface-condition', type: 'surface', observedAt: timestamp, healthy: true, value: 'good' }, { streamId: 'weather', type: 'weather', observedAt: timestamp, healthy: true, value: 'clear' }];
  platform.assessReadiness(race.id, telemetry, 'operations');
  return { platform, workspace: platform.raceOfficeWorkspace(timestamp, false) };
}

function createServiceBackedReadiness(input: { racePlatform: RaceOperationsPlatform; workforce: Record<string, any>; facilities: Record<string, any>; security: Record<string, any>; timestamp: string }): JsonBody {
  const service = new RaceDayReadinessService();
  const race = input.racePlatform.listRaces()[0];
  const workforceCheck = input.workforce.readiness?.raceDayCheck;
  const checks = [
    { domain: 'track', label: 'Track readiness', score: 92, status: 'ready', evidence: ['surface-condition:good'], blockers: [], updatedAt: input.timestamp, ownerRole: 'track-superintendent' },
    { domain: 'gate', label: 'Gate readiness', score: 90, status: 'ready', evidence: ['gate-status:locked'], blockers: [], updatedAt: input.timestamp, ownerRole: 'starter' },
    workforceCheck ?? { domain: 'staffing', label: 'Staffing readiness', score: input.workforce.readiness?.score ?? 80, status: input.workforce.readiness?.status ?? 'watch', evidence: input.workforce.readiness?.raceDayCheck?.evidence ?? ['workforce:service-backed'], blockers: input.workforce.readiness?.emergencyGaps ?? [], updatedAt: input.timestamp, ownerRole: 'operations' },
    { domain: 'veterinary', label: 'Veterinary readiness', score: 88, status: 'watch', evidence: ['vet-live:review-required'], blockers: ['veterinary clearance pending'], updatedAt: input.timestamp, approvalRequired: true, ownerRole: 'veterinarian' },
    { domain: 'stewards', label: 'Steward readiness', score: 94, status: 'ready', evidence: ['steward-live:on-duty'], blockers: [], updatedAt: input.timestamp, ownerRole: 'steward' },
    { domain: 'emergency', label: 'Emergency readiness', score: input.workforce.readiness?.status === 'blocked' ? 70 : 86, status: input.workforce.readiness?.status === 'blocked' ? 'blocked' : 'watch', evidence: ['emergency-workflow:wf-fire-1'], blockers: input.workforce.readiness?.emergencyGaps ?? ['active emergency workflow requires command review'], updatedAt: input.timestamp, approvalRequired: true, ownerRole: 'incident-commander' },
    { domain: 'security', label: 'Security readiness', score: input.security.incidents?.length ? 82 : 96, status: input.security.incidents?.length ? 'watch' : 'ready', evidence: input.security.incidents?.flatMap((incident: any) => incident.eventIds ?? []) ?? ['security:no-open-incidents'], blockers: input.security.incidents?.length ? ['security incidents under review'] : [], updatedAt: input.timestamp, ownerRole: 'security' },
    { domain: 'weather', label: 'Weather readiness', score: 90, status: 'ready', evidence: ['weather:operational'], blockers: [], updatedAt: input.timestamp, ownerRole: 'operations' },
    { domain: 'facility', label: 'Facility readiness', score: input.facilities.readiness?.score ?? 0, status: input.facilities.readiness?.status ?? 'blocked', evidence: input.facilities.readiness?.evidence ?? ['facilities:missing'], blockers: input.facilities.readiness?.status === 'ready' ? [] : ['facility maintenance watch'], updatedAt: input.timestamp, approvalRequired: input.facilities.readiness?.status !== 'ready', ownerRole: 'facilities-supervisor' },
  ] as any[];
  const assessment = service.evaluate({ raceId: race.id, trackId: race.trackId, postTime: race.scheduledPostTime, evaluatedAt: input.timestamp, checks, workforceReadiness: input.workforce.readiness }, 'race-day-readiness-service');
  const dashboard = service.dashboard(input.timestamp);
  return { ...dashboard, races: dashboard.races.map((row) => ({ raceId: row.raceId, trackId: row.trackId, postTime: row.postTime, score: row.score, status: row.status, warnings: row.warnings, approvals: row.approvals, mock: false })), latestAssessment: assessment, mock: false };
}

function createSeededAIGovernanceWorkspace(timestamp: string, mock: boolean): JsonBody {
  const platform = new ResponsibleAIGovernancePlatform({ approvalService: new CentralizedApprovalService() });
  const model = { id:'model-surface-advisor-v2', name:'Surface Advisor', version:'2.0.0', owner:'ai-governance', purpose:'Recommend safe track-surface interventions', criticality:'safety-critical' as const, dataClassification:'restricted' as const, intendedUse:['surface-maintenance-advice','race-readiness-prioritization'], prohibitedUse:['autonomous-track-closure','autonomous-race-start'], lineage:['dataset:surface-readings-v5','training-run:2026-06-01'], evidence:['ai/model-cards/surface-advisor-v2.md','ai/evaluations/surface-advisor-v2-readiness.md'], registeredAt:timestamp };
  platform.registerModel(model);
  platform.recordEvaluation({ modelId:model.id, evaluatedAt:timestamp, evaluator:'rai-lab', metrics:{ accuracy:.93, calibration:.91 }, explainability:{ method:'rationale-trace', score:.94, artifacts:['rationale-report'] }, safety:{ passed:true, controls:['human-approval','restricted-action-blocks','advisory-only-policy'], redTeamFindings:0 }, fairness:{ score:.9, segments:['race-type','surface'] }, privacy:{ personalDataUsed:false, controls:['minimization'] }, security:{ threatModelReviewed:true, vulnerabilitiesOpen:0 }, quality:{ reliability:.92, maintainability:.9, performanceEfficiency:.88 } });
  platform.assessRisk({ modelId:model.id, assessedAt:timestamp, assessor:'erm', impact:5, likelihood:3, mitigations:['human approval required','rollback runbook','monitor drift'] });
  platform.approveForDeployment(model.id, 'ai-governance-board', ['approval-minutes']);
  platform.publishPromptTemplate({ id:'prompt-surface-v4', name:'Surface intervention prompt', version:'4.0.0', owner:'prompt-review-board', template:'Recommend, summarize, classify, prioritize, forecast, simulate, or draft only with cited evidence and approvals.', evidence:['ai/prompt-cards/surface-intervention-v4.md'], status:'approved', allowedActivities:['recommend','summarize','classify','prioritize','forecast','simulate','create-draft-action'] });
  platform.registerAgent({ id:'agent-surface-ops', name:'Surface Ops Agent', owner:'track-superintendent', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', status:'active', allowedActions:['recommend-harrow','prioritize-maintenance','race-start'], restrictedActions:['race-start','close-track'], allowedActivities:['recommend','prioritize','forecast','simulate','create-draft-action'], digitalTwinRefs:['twin:sector:far-turn','twin:asset:sensor-44'] });
  platform.recordInputIngestion({ id:'input-surface-live-1', source:'surface-telemetry', actor:'surface-ingestion-service', tenantId:'trackmind', racetrackId:'main-track', correlationId:'corr-ai-facade', inputRef:'event:surface.reading.updated', inputHash:'sha256:surface-live-1', dataClassification:'restricted', evidence:['surface:moisture=19'], ingestedAt:timestamp, digitalTwinRefs:['twin:sector:far-turn'] });
  platform.recordFeatureBuild({ id:'features-surface-live-1', inputId:'input-surface-live-1', featureSetId:'surface-risk-v1', actor:'feature-builder', tenantId:'trackmind', racetrackId:'main-track', correlationId:'corr-ai-facade', causationId:'input-surface-live-1', features:['moistureDeviation','sensorWarning','readinessTrend'], evidence:['feature-store:surface-risk-v1'], builtAt:timestamp, digitalTwinRefs:['twin:sector:far-turn'] });
  platform.recordModelSelection({ id:'selection-surface-live-1', featureBuildId:'features-surface-live-1', modelVersionId:model.id, actor:'model-router', tenantId:'trackmind', racetrackId:'main-track', correlationId:'corr-ai-facade', causationId:'features-surface-live-1', candidateModelIds:[model.id], selectionReason:'Highest approved surface advisory model for track conditions.', evidence:['ai/model-cards/surface-advisor-v2.md','ai/evaluations/surface-advisor-v2-readiness.md'], selectedAt:timestamp, digitalTwinRefs:['twin:sector:far-turn'] });
  const rec = platform.recordRecommendation({ id:'rec-harrow-7', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', tenantId:'trackmind', racetrackId:'main-track', correlationId:'corr-ai-facade', causationId:'selection-surface-live-1', activity:'recommend', action:'recommend-harrow', target:'sector:far-turn', recommendation:'Dispatch a human-approved harrow pass before Race 7.', confidence:.86, affectedAssets:['sector:far-turn','asset:sensor-44'], evidence:['surface:moisture=19','sensor-44:warning'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4','event:surface.reading.updated'], approvalPolicy:'single-human', riskLevel:'high', createdAt:timestamp, digitalTwinRefs:['twin:sector:far-turn','twin:asset:sensor-44'] });
  platform.recordRecommendation({ id:'rec-maintenance-priority', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', tenantId:'trackmind', racetrackId:'main-track', correlationId:'corr-ai-facade-maintenance', causationId:'selection-surface-live-1', activity:'prioritize', action:'prioritize-maintenance', target:'sector:far-turn', recommendation:'Prioritize far-turn maintenance review in the next human superintendent workflow.', confidence:.82, affectedAssets:['sector:far-turn','work-order:surface-review'], evidence:['surface:compaction=276','inspection:standing-water'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4','event:surface.inspection.recorded'], approvalPolicy:'single-human', riskLevel:'high', createdAt:timestamp, digitalTwinRefs:['twin:sector:far-turn'] });
  platform.recordRecommendation({ id:'rec-race-start', agentId:'agent-surface-ops', modelVersionId:model.id, promptTemplateId:'prompt-surface-v4', tenantId:'trackmind', racetrackId:'main-track', correlationId:'corr-ai-facade-blocked', causationId:'selection-surface-live-1', activity:'create-draft-action', action:'race-start', target:'race-7', recommendation:'Draft race-start readiness package for human steward, race office, and veterinarian review only.', confidence:.91, affectedAssets:['race:race-7','gate:1','approval:race-start'], evidence:['readiness:watch','gate:gps-verified'], lineage:['agent:agent-surface-ops','model:model-surface-advisor-v2','prompt:prompt-surface-v4','policy:protected-action'], approvalPolicy:'none', riskLevel:'critical', createdAt:timestamp, digitalTwinRefs:['twin:race-7','twin:gate-1'] });
  platform.recordDashboardUpdate({ id:'dashboard-ai-facade-1', dashboardId:'ai-governance', actor:'trackmind-api', tenantId:'trackmind', racetrackId:'main-track', correlationId:'corr-ai-facade-dashboard', causationId:'rec-harrow-7', summary:'AI governance facade refreshed advisory queues and blocked actions.', metrics:{ recommendations:3, blockedActions:1, approvalsRequired:2 }, evidence:['api-facade'], updatedAt:timestamp, digitalTwinRefs:['twin:sector:far-turn'] });
  platform.recordOverride({ id:'override-1', recommendationId:rec.id, actor:'track-superintendent', reason:'Delay until lightning watch clears', evidence:['weather:cell-west-18mi'], createdAt:timestamp });
  platform.recordRollback({ id:'rollback-1', recommendationId:rec.id, actor:'ai-governance-board', reason:'Prompt drift review', restoredVersionId:'prompt-surface-v3', evidence:['drift:metric-9'], createdAt:timestamp });
  platform.ingestMonitoring({ modelId:model.id, observedAt:timestamp, metric:'drift', value:.12, threshold:.2, evidence:['monitor:drift-window-1'] });
  const workspace = platform.governanceWorkspace() as SeededAIGovernanceWorkspace;
  const enrichRecommendation = (rec: SeededAIRecommendation) => {
    const agent = workspace.activeAgents.find((item) => item.id === rec.agentId) ?? workspace.activeAgents[0];
    const approval = workspace.approvalRequirements.find((item) => item.recommendationId === rec.id);
    const audits = workspace.auditTrails.filter((audit) => audit.subject === rec.id).map((audit) => audit.id);
    const events = workspace.events.filter((event) => event.subjectId === rec.id).map((event) => event.id);
    const digitalTwinRefs = (workspace.digitalTwinImpacts ?? []).filter((impact) => impact.recommendationId === rec.id).map((impact) => impact.twinId);
    return { ...rec, ...aiRecommendationGovernanceMetadata({ id: rec.id, modelVersionId: rec.modelVersionId, fallbackModelVersion: agent.modelVersionId, createdAt: rec.createdAt, fallbackGeneratedAt: timestamp, approvalPolicy: rec.approvalPolicy, approval, auditIds: audits, eventIds: events, digitalTwinRefs }) };
  };
  return {
    generatedAt: timestamp,
    ...workspace,
    recommendationQueue: workspace.recommendationQueue.map(enrichRecommendation),
    safetyBlockedActions: workspace.safetyBlockedActions.map((blocked) => ({ ...enrichRecommendation(blocked), reason: blocked.explainability?.limitations.join(' ') ?? blocked.reason ?? 'AI safety policy blocked autonomous protected action.' })),
    unifiedAIControlPlane: {
      modelRegistry: listExpertModelRegistry(),
      agentRegistry: listAIAgentRegistryRecords(timestamp),
      advisoryOnly: true,
      protectedControlExecutionAllowed: false,
    },
    mock,
  };
}

function createSeededAIControlPlaneWorkspace(timestamp: string, mock: boolean): JsonBody {
  const ai = createSeededAIGovernanceWorkspace(timestamp, mock) as SeededAIGovernanceWorkspace;
  const policySource = ai.safetyPolicies?.[0];
  const policy = {
    policyId: policySource?.id ?? 'trackmind-ai-advisory-only-v1',
    allowedActivities: policySource?.allowedActivities ?? [],
    protectedActions: policySource?.protectedActions ?? [],
    prohibitedAutonomousActions: policySource?.prohibitedAutonomousActions ?? [],
    requiredEvidence: policySource?.requiredEvidence ?? [],
    humanApprovalRequiredFor: policySource?.humanApprovalRequiredFor ?? [],
    executionEndpointsAvailable: false,
    draftOnlyStateChanges: true,
    governanceMapping: [
      { framework: 'ISO-42001', controls: ['AI policy', 'impact assessment', 'model lifecycle control'], evidence: ai.evidencePackages.map((pkg) => pkg.id) },
      { framework: 'NIST-AI-RMF', controls: ['govern', 'map', 'measure', 'manage'], evidence: ai.auditTrails.map((audit) => audit.id) },
    ],
    mock,
  };
  const expertModules = ai.activeAgents.map((agent) => ({ id: agent.id, name: agent.name, owner: agent.owner, modelVersionId: agent.modelVersionId, promptTemplateId: agent.promptTemplateId, allowedActivities: agent.allowedActivities ?? policy.allowedActivities, restrictedActions: agent.restrictedActions, digitalTwinRefs: agent.digitalTwinRefs ?? [] }));
  const featureStore = { datasets: ['dataset:surface-readings-v5'], telemetryStreams: ['surface.reading.updated', 'gate-status', 'weather'], lineageRefs: ai.modelVersions.flatMap((model) => model.lineage), evidenceRefs: ai.evidencePackages.flatMap((pkg) => pkg.evidence) };
  const toRecommendation = (rec: SeededAIRecommendation, blocked = false) => {
    const agent = ai.activeAgents.find((item) => item.id === rec.agentId) ?? ai.activeAgents[0];
    const approval = ai.approvalRequirements.find((item) => item.recommendationId === rec.id);
    const evidencePackage = ai.evidencePackages.find((pkg) => pkg.recommendationId === rec.id);
    const events = ai.events.filter((event) => event.subjectId === rec.id);
    const audits = ai.auditTrails.filter((audit) => audit.subject === rec.id);
    const twins = (ai.digitalTwinImpacts ?? []).filter((impact) => impact.recommendationId === rec.id);
    const auditIds = audits.map((audit) => audit.id);
    const eventIds = events.map((event) => event.id);
    const digitalTwinRefs = twins.map((impact) => impact.twinId);
    const calibrated = rec.confidenceScore?.calibrated ?? rec.confidence;
    return {
      id: rec.id,
      ...aiRecommendationGovernanceMetadata({ id: rec.id, modelVersionId: rec.modelVersionId, fallbackModelVersion: agent.modelVersionId, createdAt: rec.createdAt, fallbackGeneratedAt: timestamp, approvalPolicy: rec.approvalPolicy, approval, auditIds, eventIds, digitalTwinRefs }),
      agentId: rec.agentId ?? agent.id,
      modelVersionId: rec.modelVersionId ?? agent.modelVersionId,
      promptTemplateId: rec.promptTemplateId ?? agent.promptTemplateId,
      action: rec.action ?? 'recommend-harrow',
      target: rec.target ?? 'sector:far-turn',
      recommendation: rec.recommendation ?? rec.reason,
      status: blocked ? 'safety-blocked' : rec.status,
      activity: rec.activity,
      confidence: { raw: rec.confidence, calibrated, band: rec.confidenceScore?.band ?? (calibrated >= 0.8 ? 'high' : 'medium'), drivers: rec.confidenceScore?.drivers ?? [`raw:${rec.confidence}`] },
      evidence: rec.evidence,
      affectedAssets: rec.affectedAssets ?? [],
      risk: { level: blocked ? 'critical' : rec.riskLevel, drivers: [rec.action ?? 'protected-action', rec.approvalPolicy, ...(rec.affectedAssets ?? [])], humanReviewRequired: true },
      governorDecision: { allowed: false, reason: blocked ? rec.reason : 'Human approval required before any protected or operational action.', approvalRequired: true, approvalPolicy: rec.approvalPolicy, approvalRequirementId: approval?.id },
      approvalWorkflow: approval ? { id: approval.id, requiredRoles: approval.requiredRoles, status: approval.status, evidence: approval.evidence, draftOnly: true } : undefined,
      references: { auditIds, eventIds, digitalTwinRefs, evidencePackageId: evidencePackage?.id },
      mock,
    };
  };
  const recommendations = ai.recommendationQueue.map((rec) => toRecommendation(rec));
  const blockedActions = ai.safetyBlockedActions.map((rec) => toRecommendation(rec, true));
  return {
    generatedAt: timestamp,
    inputsSummary: { telemetryStreams: featureStore.telemetryStreams, evidenceRefs: featureStore.evidenceRefs, affectedAssets: [...new Set([...recommendations, ...blockedActions].flatMap((rec) => rec.affectedAssets))], protectedIntents: policy.protectedActions },
    featureStoreSummary: featureStore,
    modelRegistry: { models: [...ai.modelVersions, ...listExpertModelRegistry()], evaluations: ai.evaluationStatus, expertModules, featureStore, mock },
    expertModules,
    recommendations,
    blockedActions,
    policy,
    approvalRequiredWorkflows: [...recommendations, ...blockedActions].flatMap((rec) => rec.approvalWorkflow ? [rec.approvalWorkflow] : []),
    auditEventTwinReferences: { auditIds: ai.auditTrails.map((audit) => audit.id), eventIds: ai.events.map((event) => event.id), digitalTwinRefs: (ai.digitalTwinImpacts ?? []).map((impact) => impact.twinId) },
    events: ai.events,
    mock,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function createAIControlPlaneFeatureRecords(aiControlPlane: JsonBody, timestamp: string): JsonBody {
  const featureStore = ((aiControlPlane as any)?.featureStoreSummary ?? {}) as { telemetryStreams?: string[]; datasets?: string[]; evidenceRefs?: string[]; lineageRefs?: string[] };
  const streams = featureStore.telemetryStreams?.length ? featureStore.telemetryStreams : ['surface.reading.updated'];
  const evidence = unique([...(featureStore.evidenceRefs ?? []), ...(featureStore.datasets ?? []), ...(featureStore.lineageRefs ?? [])]);
  return streams.map((stream, index) => ({
    id: `feature-record-${stream.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    schemaVersion: 'trackmind.feature-store.v1',
    metadata: {
      tenantId: 'trackmind',
      racetrackId: 'main-track',
      domain: stream.includes('gate') ? 'gate' : stream.includes('weather') ? 'weather' : 'surface',
      correlationId: `corr-ai-feature-${index + 1}`,
      asOf: timestamp,
      source: 'ai-control-plane-feature-store',
      assetId: stream.includes('gate') ? 'gate:main' : stream.includes('weather') ? 'track:main' : 'sector:far-turn',
    },
    features: {
      telemetryStream: stream,
      advisoryOnly: true,
      autonomousExecutionAllowed: false,
    },
    scores: {
      readiness: 0.86,
      evidenceCoverage: evidence.length > 0 ? 0.9 : 0.5,
      policyCoverage: 1,
    },
    dataQuality: {
      score: 0.88,
      completenessScore: 0.9,
      freshnessScore: 0.86,
      outlierScore: 0.08,
      outlierQualityScore: 0.92,
      missingFields: [],
      staleAfterMinutes: 15,
    },
    evidence: evidence.length ? evidence : ['feature-store:seeded-control-plane'],
    placeholder: true,
  }));
}

function createAIRecommendationDtos(aiGovernance: JsonBody): JsonBody {
  const workspace = aiGovernance as SeededAIGovernanceWorkspace;
  const recommendations = [...(workspace.recommendationQueue ?? []), ...(workspace.safetyBlockedActions ?? [])];
  return recommendations.map((recommendation) => {
    const auditReference = (recommendation as any).auditReference ?? { auditIds: [], eventIds: [], digitalTwinRefs: [] };
    const auditIds = Array.isArray(auditReference.auditIds) ? auditReference.auditIds : [];
    const eventIds = Array.isArray(auditReference.eventIds) ? auditReference.eventIds : [];
    const digitalTwinRefs = Array.isArray(auditReference.digitalTwinRefs) ? auditReference.digitalTwinRefs : recommendation.affectedAssets?.filter((asset) => asset.startsWith('twin:')) ?? [];
    const approvalRequirement = (recommendation as any).approvalRequirement ?? { required: recommendation.approvalPolicy !== 'none', policy: recommendation.approvalPolicy ?? 'none' };
    return {
      id: recommendation.id,
      recommendationId: (recommendation as any).recommendationId ?? recommendation.id,
      recommendation: recommendation.recommendation ?? recommendation.reason ?? 'AI recommendation requires human review.',
      confidence: recommendation.confidenceScore?.calibrated ?? recommendation.confidence,
      evidence: recommendation.evidence ?? [],
      modelVersion: (recommendation as any).modelVersion ?? recommendation.modelVersionId ?? 'unknown-model',
      generatedAt: (recommendation as any).generatedAt ?? recommendation.createdAt ?? now(),
      approvalRequirement,
      auditReference,
      requiresApproval: Boolean(approvalRequirement.required),
      eventId: eventIds[0] ?? `event:${recommendation.id}`,
      auditId: auditIds[0] ?? `audit:${recommendation.id}`,
      tenantId: (recommendation as any).tenantId ?? 'trackmind',
      racetrackId: (recommendation as any).racetrackId ?? 'main-track',
      correlationId: (recommendation as any).correlationId ?? recommendation.id,
      causationId: (recommendation as any).causationId,
      digitalTwinRefs,
      riskLevel: recommendation.riskLevel,
      mock: false,
    };
  });
}

function createAIControlPlaneDraftResult(path: string, body: unknown): AIControlPlaneDraftResultDto {
  const input = (body ?? {}) as { recommendationId?: string; action?: string };
  const evaluated = path.endsWith('/evaluate');
  return {
    accepted: true,
    draftId: `ai-control-plane-draft-${Date.now()}`,
    recommendationId: input.recommendationId ?? `draft-${Date.now()}`,
    approvalRequired: true,
    eventType: evaluated ? 'ai.recommendation.evaluated' : 'ai.recommendation.draft.created',
    audited: true,
    executionAllowed: false,
    message: `AI control plane ${evaluated ? 'evaluation' : 'draft'} accepted for ${input.action ?? 'recommendation'} review. Protected controls remain locked behind human approval; no autonomous execution endpoint was invoked.`,
    mock: false,
  };
}

function createSecurityOperationsFacade(timestamp: string): JsonBody {
  const service = new SecurityOperationsService(() => timestamp);
  const commander: SecurityActor = { id: 'sec-commander', roles: ['security'], tenantId: 'trackmind', human: true, permissions: ['security:read', 'security:write', 'security:escalate', 'security:investigate'] };
  service.checkCredential(commander, { credentialId: 'cred-live-1', holderDisplayName: 'Contractor A', holderLegalName: 'Contractor Alpha', zoneId: 'zone-backstretch-medication', status: 'expired' });
  const access = service.recordAccessEvent(commander, { zoneId: 'zone-backstretch-medication', credentialId: 'cred-live-1', personDisplayName: 'Contractor A', personLegalName: 'Contractor Alpha', decision: 'denied', reason: 'Credential expired', occurredAt: timestamp });
  const incident = service.getWorkspace({ ...commander, permissions: ['security:read'] }).incidents[0];
  if (incident) {
    service.openInvestigation(commander, incident.id, 'investigator-1', ['video://cam-med-1/clip-1', access.eventId]);
    service.escalateIncident(commander, incident.id);
  }
  service.logVisitor(commander, { visitorDisplayName: 'Vendor Escort', visitorLegalName: 'Vendor Escort Legal', host: 'facilities-manager', zoneId: 'zone-paddock', credentialId: 'cred-visitor-1', credentialStatus: 'valid' });
  service.updateCameraHealth(commander, 'cam-pad-1', 'offline', timestamp);
  const workspace = service.getWorkspace({ id: 'dashboard-security-reader', roles: ['security'], tenantId: 'trackmind', permissions: ['security:read'] });
  return { ...workspace, mock: false };
}

function createAuditLedgerFacade(timestamp: string, facadeEvents: Array<{ id: string; type: string; actor: string; subjectId?: string }>): JsonBody {
  const ledger = new ImmutableAuditLog();
  ledger.append({ id: 'audit-api-read-1', type: 'user-action', actor: 'auditor-ui', actorType: 'api', timestamp, action: 'audit.read', actionClass: 'api', apiRoute: '/api/v1/audit/events', subjectId: 'audit-ledger', correlationId: 'audit-facade', sourceService: 'trackmind-api', evidenceIds: ['api-contract:listAuditEvents'], regulations: ['SOC-2', 'ISO-27001'], payload: { sourceEvents: facadeEvents.map((event) => event.id) } });
  ledger.append({ id: 'audit-approval-1', type: 'approval', actor: 'centralized-approval-service', actorType: 'service', timestamp, action: 'approval.requested', actionClass: 'approval', subjectId: 'race-7', correlationId: 'audit-facade', sourceService: 'approval-engine', evidenceIds: ['human-approval-record'], regulations: ['HISA', 'ARCI'], payload: { action: 'race-start', target: 'race-7', evidence: ['human-approval-record'] } });
  ledger.append({ id: 'audit-twin-1', type: 'digital-twin-update', actor: 'digital-twin-runtime', actorType: 'service', timestamp, action: 'digital-twin.state.patch', actionClass: 'twin', subjectId: 'twin:race-7', correlationId: 'audit-facade', sourceService: 'digital-twin-runtime', evidenceIds: ['evt-twin-race-7'], regulations: ['HISA'], payload: { twinId: 'twin:race-7', patch: { status: 'watch' }, sourceEventId: 'evt-twin-race-7' } });
  const incident = ledger.append({ id: 'audit-incident-1', type: 'security-event', actor: 'security-operator', actorType: 'human', timestamp, action: 'incident.investigation.opened', actionClass: 'incident', subjectId: 'incident:surface-review', correlationId: 'audit-facade', evidence: [{ id: 'ev-video-1', uri: 'evidence://video/head-on', description: 'Head-on camera clip', source: 'camera-12', collectedAt: timestamp }], regulations: ['SOC-2', 'HISA'], payload: { incidentId: 'incident:surface-review', severity: 'warning' } });
  ledger.placeLegalHold([incident.id], 'compliance-officer', timestamp, 'Regulator-facing surface review');
  const retentionPolicies: RetentionPolicy[] = [{ id: 'regulated-7-year', eventTypes: ['approval', 'digital-twin-update', 'security-event'], retainForDays: 2555, regulatoryBasis: 'regulated-racing-records' }];
  return {
    generatedAt: timestamp,
    verification: ledger.verify(),
    coverage: ledger.coverageReport(undefined, timestamp),
    evidencePath: ledger.evidencePath(),
    forensicReconstruction: ledger.reconstruct({ correlationId: 'audit-facade' }),
    complianceExport: ledger.exportCompliancePackage({ regulations: ['SOC-2', 'HISA'], generatedBy: 'trackmind-api', generatedAt: timestamp, retentionPolicies }),
    legalHolds: [...ledger.activeLegalHolds().entries()].map(([recordId, hold]) => ({ recordId, ...hold })),
    mock: false,
  };
}

function createTUSStandardizationFacade(timestamp: string): JsonBody {
  const context = { tenantId: 'trackmind', racetrackId: 'main-track', generatedAt: timestamp, mock: false };
  const assetSeed = [
    { assetId: 'GATE_MAIN_01', name: 'Main Starting Gate', assetType: 'StartingGate', assetClass: 'physical' as const, lifecycleStatus: 'active', riskLevel: 'high' as const, safetyCritical: true, location: { sectorId: 'backstretch', railPositionMeters: 0 }, state: { stalls: 14, locked: true, lifecycleStatus: 'active' }, maintenanceStatus: 'ok', healthScore: 84, telemetryBindings: [{ sourceId: 'gate-status-01', stream: 'telemetry.gate.status', schemaRef: 'telemetry.gate.v1', metric: 'locked', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-gate-move', policyId: 'critical-asset-dual-control', status: 'required', requiredApprovers: ['Starter', 'Steward'], reason: 'Starting gate movement and release controls are safety critical.', evidence: ['gps-fix', 'human-approval-record'], updatedAt: timestamp }], audit: [{ id: 'audit-gate-01', action: 'asset-standardized', actor: 'api-facade', timestamp, evidence: ['registry:gate'] }], twinId: 'twin:gate:main-01' },
    { assetId: 'CAM_PADDOCK_01', name: 'Paddock Camera 01', assetType: 'Camera', assetClass: 'digital' as const, lifecycleStatus: 'active', riskLevel: 'medium' as const, safetyCritical: false, location: { zoneId: 'paddock' }, state: { privacyMasking: true, status: 'online' }, maintenanceStatus: 'ok', healthScore: 92, telemetryBindings: [{ sourceId: 'cam-paddock-heartbeat', stream: 'telemetry.camera.heartbeat', metric: 'heartbeat', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-camera-sensitive-read', status: 'required', requiredApprovers: ['SecuritySupervisor'], reason: 'Sensitive security footage access requires approval.', evidence: ['security-policy'], updatedAt: timestamp }], audit: [{ id: 'audit-camera-01', action: 'asset-standardized', actor: 'api-facade', timestamp, evidence: ['security-camera'] }], twinId: 'twin:camera:paddock-01' },
    { assetId: 'GEN_BACKUP_A', name: 'Backup Generator A', assetType: 'Generator', assetClass: 'physical' as const, lifecycleStatus: 'active', riskLevel: 'high' as const, safetyCritical: true, location: { facilityId: 'maintenance-yard' }, state: { loadTestStatus: 'passed', fuelPct: 74 }, maintenanceStatus: 'due', healthScore: 78, telemetryBindings: [{ sourceId: 'generator-load-a', stream: 'telemetry.facility.power', metric: 'loadPct', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-generator-transfer', status: 'required', requiredApprovers: ['FacilitiesLead'], reason: 'Life-safety power transfer is approval-gated.', evidence: ['load-test'], updatedAt: timestamp }], audit: [{ id: 'audit-generator-a', action: 'inspection-recorded', actor: 'facilities-supervisor', timestamp, evidence: ['work-order:generator-a'] }], twinId: 'twin:facility:generator-a' },
    { assetId: 'LIGHT_POLE_12', name: 'Light Pole 12', assetType: 'LightPole', assetClass: 'physical' as const, lifecycleStatus: 'active', riskLevel: 'medium' as const, safetyCritical: false, location: { zoneId: 'parking-north' }, state: { lumensPct: 88 }, maintenanceStatus: 'ok', healthScore: 88, telemetryBindings: [{ sourceId: 'light-pole-12-power', stream: 'telemetry.facility.lighting', metric: 'powerDraw', required: false, lastObservedAt: timestamp }], audit: [{ id: 'audit-light-pole-12', action: 'asset-standardized', actor: 'api-facade', timestamp, evidence: ['facilities-registry'] }], twinId: 'twin:facility:light-pole-12' },
    { assetId: 'IRRIGATION_ZONE_FAR_TURN', name: 'Far Turn Irrigation Zone', assetType: 'IrrigationZone', assetClass: 'physical' as const, lifecycleStatus: 'active', riskLevel: 'high' as const, safetyCritical: true, location: { sectorId: 'far-turn' }, state: { waterMm: 0, valveState: 'locked' }, maintenanceStatus: 'ok', healthScore: 80, telemetryBindings: [{ sourceId: 'irrigation-far-turn-flow', stream: 'telemetry.surface.irrigation', metric: 'flowRate', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-irrigation-far-turn', status: 'required', requiredApprovers: ['TrackSuperintendent'], reason: 'Surface irrigation changes remain human-approved.', evidence: ['surface-telemetry'], updatedAt: timestamp }], audit: [{ id: 'audit-irrigation-far-turn', action: 'approval-required', actor: 'surface-service', timestamp, evidence: ['surface-risk'] }], twinId: 'twin:track:irrigation-far-turn' },
    { assetId: 'TRACK_SECTOR_FAR_TURN', name: 'Far Turn Track Sector', assetType: 'TrackSector', assetClass: 'physical' as const, lifecycleStatus: 'maintenance', riskLevel: 'high' as const, safetyCritical: true, location: { sectorId: 'far-turn', startMeters: 900, endMeters: 1250 }, state: { condition: 'watch', moisture: 27, compaction: 276 }, maintenanceStatus: 'due', healthScore: 58, telemetryBindings: [{ sourceId: 'surface-probe-44', stream: 'telemetry.surface.measurement', metric: 'moisture', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-surface-harrow', status: 'pending', requiredApprovers: ['TrackSuperintendent'], reason: 'Harrow pass remains approval-gated.', evidence: ['surface:moisture=27'], updatedAt: timestamp }], audit: [{ id: 'audit-track-sector-far-turn', action: 'risk-classified', actor: 'surface-service', timestamp, evidence: ['surface-inspection'] }], twinId: 'twin:track:far-turn' },
    { assetId: 'AMBULANCE_EQ_01', name: 'Equine Ambulance 01', assetType: 'Ambulance', assetClass: 'physical' as const, lifecycleStatus: 'active', riskLevel: 'critical' as const, safetyCritical: true, location: { zoneId: 'zone-track' }, state: { status: 'available', crew: 'vet-response' }, maintenanceStatus: 'ok', healthScore: 93, telemetryBindings: [{ sourceId: 'ambulance-eq-01-location', stream: 'telemetry.emergency.location', metric: 'position', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-emergency-resource-dispatch', status: 'post-action-evidence', requiredApprovers: ['IncidentCommander'], reason: 'Emergency personnel can dispatch immediately; evidence is collected after action.', evidence: ['emergency-authority'], updatedAt: timestamp }], audit: [{ id: 'audit-ambulance-eq-01', action: 'resource-readiness-checked', actor: 'emergency-operations', timestamp, evidence: ['emergency-plan'] }], twinId: 'twin:facility:ambulance-eq-01' },
    { assetId: 'STALL_BARN2_12A', name: 'Horse Stall 12A', assetType: 'HorseStall', assetClass: 'physical' as const, lifecycleStatus: 'active', riskLevel: 'medium' as const, safetyCritical: false, location: { barnId: 'barn-2', stallId: '12A' }, state: { occupancyHorseId: 'horse-1', status: 'occupied' }, maintenanceStatus: 'ok', healthScore: 90, telemetryBindings: [{ sourceId: 'stall-12a-environment', stream: 'telemetry.barn.environment', metric: 'temperature', required: false, lastObservedAt: timestamp }], audit: [{ id: 'audit-stall-12a', action: 'occupancy-linked', actor: 'barn-operations', timestamp, evidence: ['horse:horse-1'] }], twinId: 'twin:facility:stall-12a' },
    { assetId: 'BARN_02', name: 'Barn 2', assetType: 'Barn', assetClass: 'physical' as const, lifecycleStatus: 'active', riskLevel: 'high' as const, safetyCritical: true, location: { barnId: 'barn-2' }, state: { capacity: 40, occupied: 32, emergencyStatus: 'normal' }, maintenanceStatus: 'ok', healthScore: 86, telemetryBindings: [{ sourceId: 'barn-2-fire-panel', stream: 'telemetry.barn.safety', metric: 'alarmStatus', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-barn-access-restriction', status: 'required', requiredApprovers: ['SecuritySupervisor'], reason: 'Barn restriction changes require human review.', evidence: ['barn-access-policy'], updatedAt: timestamp }], audit: [{ id: 'audit-barn-02', action: 'readiness-assessed', actor: 'barn-operations', timestamp, evidence: ['barn-readiness'] }], twinId: 'twin:facility:barn-02' },
  ];
  const assets = assetSeed.map((asset) => legacyAssetToTUSAsset(asset, context));
  const twinBase = (twin: Omit<TUSTwinStandardDto, 'schemaVersion' | 'tenantId' | 'racetrackId' | 'context' | 'source'>): TUSTwinStandardDto => ({
    schemaVersion: 'trackmind.tus.twin.v1',
    tenantId: context.tenantId,
    racetrackId: context.racetrackId,
    context: { tenantId: context.tenantId, racetrackId: context.racetrackId },
    source: { system: 'api-facade-tus-standardization', version: 1, mock: false },
    ...twin,
  });
  const twins = [
    twinBase({ twinId: 'twin:horse:horse-1', twinType: 'horse', twinCategory: 'biological', displayName: 'Horse Twin - Lifecycle Runner', assetId: 'HORSE_LIFECYCLE_RUNNER', assetType: 'Horse', location: { barnId: 'barn-2', stallId: '12A' }, state: { lifecycleStatus: 'active', welfareLevel: 'acceptable', eligibility: 'under-review' }, health: { status: 'healthy', score: 92, indicators: [{ name: 'welfare', status: 'ok', value: 92, updatedAt: timestamp }] }, risk: { level: 'medium', score: 35, drivers: ['vet-review-pending'], evidence: ['equine-ai-risk'] }, telemetry: [{ sourceId: 'wearable:horse-1', metric: 'heartRate', stream: 'telemetry.equine.biometrics', required: false, lastObservedAt: timestamp }], approvals: [{ id: 'approval-ai-risk-1', status: 'pending', requiredApprovers: ['Veterinarian'], reason: 'Veterinarian clearance is required before operational health changes.', evidence: ['vet-review-pending'], updatedAt: timestamp }], audit: [{ id: 'audit-equine-1', action: 'ai-recommendation-recorded', actor: 'ai-health-1', timestamp, evidence: ['equine-ai-risk'] }], relationships: [{ targetId: 'STALL_BARN2_12A', type: 'LOCATED_AT', evidence: ['barn-assignment'], updatedAt: timestamp }] }),
    twinBase({ twinId: 'twin:track:main-track', twinType: 'track', twinCategory: 'track', displayName: 'Track Twin - Main Track', assetId: 'TRACK_MAIN', assetType: 'Track', location: { trackId: 'main-track' }, state: { readiness: 'watch', farTurnRisk: 'high' }, health: { status: 'degraded', score: 72, indicators: [{ name: 'surface-score', status: 'watch', value: 72, updatedAt: timestamp }] }, risk: { level: 'high', score: 65, drivers: ['far-turn-moisture', 'surface-maintenance'], evidence: ['surface-inspection'] }, telemetry: [{ sourceId: 'surface-probe-44', metric: 'moisture', stream: 'telemetry.surface.measurement', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-surface-harrow', status: 'pending', requiredApprovers: ['TrackSuperintendent'], reason: 'Surface intervention requires approval.', evidence: ['surface:moisture=27'], updatedAt: timestamp }], audit: [{ id: 'audit-twin-track-main', action: 'state-synchronized', actor: 'digital-twin-runtime', timestamp, evidence: ['evt-twin-far-turn'] }], relationships: [{ targetId: 'TRACK_SECTOR_FAR_TURN', type: 'COMPOSED_OF', evidence: ['track-configuration'], updatedAt: timestamp }] }),
    twinBase({ twinId: 'twin:gate:main-01', twinType: 'gate', twinCategory: 'asset', displayName: 'Gate Twin - Main Starting Gate', assetId: 'GATE_MAIN_01', assetType: 'StartingGate', location: { sectorId: 'backstretch' }, state: { locked: true, stalls: 14 }, health: { status: 'degraded', score: 84, indicators: [{ name: 'telemetry-freshness', status: 'ok', value: 'fresh', updatedAt: timestamp }] }, risk: { level: 'high', score: 65, drivers: ['starting-gate-move'], evidence: ['gps-fix'] }, telemetry: [{ sourceId: 'gate-status-01', metric: 'locked', stream: 'telemetry.gate.status', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-gate-move', status: 'required', requiredApprovers: ['Starter', 'Steward'], reason: 'Starting gate commands are controlled.', evidence: ['human-approval-record'], updatedAt: timestamp }], audit: [{ id: 'audit-gate-twin', action: 'asset-synchronized', actor: 'asset-registry', timestamp, evidence: ['registry:gate'] }], relationships: [{ targetId: 'GATE_MAIN_01', type: 'REPRESENTS', evidence: ['asset-registry'], updatedAt: timestamp }] }),
    twinBase({ twinId: 'twin:facility:barn-02', twinType: 'facility', twinCategory: 'facility', displayName: 'Facility Twin - Barn 2', assetId: 'BARN_02', assetType: 'Barn', location: { barnId: 'barn-2' }, state: { occupied: 32, capacity: 40 }, health: { status: 'healthy', score: 86, indicators: [{ name: 'readiness', status: 'ok', value: 'ready', updatedAt: timestamp }] }, risk: { level: 'high', score: 65, drivers: ['restricted-area', 'animal-area'], evidence: ['barn-readiness'] }, telemetry: [{ sourceId: 'barn-2-fire-panel', metric: 'alarmStatus', stream: 'telemetry.barn.safety', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-barn-access-restriction', status: 'required', requiredApprovers: ['SecuritySupervisor'], reason: 'Restricted barn operations require review.', evidence: ['barn-access-policy'], updatedAt: timestamp }], audit: [{ id: 'audit-barn-twin', action: 'readiness-synchronized', actor: 'barn-operations', timestamp, evidence: ['barn-readiness'] }], relationships: [{ targetId: 'STALL_BARN2_12A', type: 'CONTAINS', evidence: ['barn-operations'], updatedAt: timestamp }] }),
    twinBase({ twinId: 'twin:race:race-7', twinType: 'race', twinCategory: 'operation', displayName: 'Race Twin - Race 7', assetId: 'RACE_7_OPERATION', assetType: 'RaceEvent', location: { trackId: 'main-track' }, state: { status: 'watch', postTime: timestamp }, health: { status: 'degraded', score: 78, indicators: [{ name: 'readiness', status: 'watch', value: 'watch', updatedAt: timestamp }] }, risk: { level: 'high', score: 65, drivers: ['race-start-protected-action'], evidence: ['readiness-watch'] }, telemetry: [{ sourceId: 'gate-status-01', metric: 'ready', stream: 'telemetry.race.readiness', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'mock-approval-race-start', status: 'pending', requiredApprovers: ['Steward', 'Veterinarian'], reason: 'Race start is protected.', evidence: ['readiness-watch'], updatedAt: timestamp }], audit: [{ id: 'audit-race-twin', action: 'readiness-assessed', actor: 'race-office', timestamp, evidence: ['readiness-watch'] }], relationships: [{ targetId: 'GATE_MAIN_01', type: 'DEPENDS_ON', evidence: ['race-day-readiness'], updatedAt: timestamp }] }),
    twinBase({ twinId: 'twin:employee:staff-vet-tech', twinType: 'employee', twinCategory: 'workforce', displayName: 'Employee Twin - Veterinary Technician', assetId: 'EMP_102', assetType: 'Employee', location: { zoneId: 'zone-track' }, state: { role: 'veterinary-response', status: 'checked-in' }, health: { status: 'healthy', score: 100, indicators: [{ name: 'certification', status: 'ok', value: 'active', updatedAt: timestamp }] }, risk: { level: 'low', score: 15, drivers: ['credentialed', 'checked-in'], evidence: ['cert:vet-tech-license'] }, telemetry: [{ sourceId: 'workforce-checkin', metric: 'checkedIn', stream: 'workforce.assignment.changed', required: true, lastObservedAt: timestamp }], approvals: [], audit: [{ id: 'audit-workforce-assign-vet', action: 'assignment-changed', actor: 'workforce-coordinator', timestamp, evidence: ['cert:vet-tech-license'] }], relationships: [{ targetId: 'AMBULANCE_EQ_01', type: 'OPERATES', evidence: ['workforce-assignment'], updatedAt: timestamp }] }),
    twinBase({ twinId: 'twin:ai:surface-ops', twinType: 'ai', twinCategory: 'ai-agent', displayName: 'AI Twin - Surface Ops Agent', assetId: 'AI_AGENT_SURFACE_01', assetType: 'AIAgent', location: { serviceId: 'ai-governance' }, state: { status: 'active', advisoryOnly: true, executionAllowed: false }, health: { status: 'healthy', score: 94, indicators: [{ name: 'safety-evaluation', status: 'ok', value: 'passed', updatedAt: timestamp }] }, risk: { level: 'high', score: 65, drivers: ['protected-action-recommendations', 'human-review-required'], evidence: ['model-card', 'validation-report'] }, telemetry: [{ sourceId: 'ai-monitoring', metric: 'confidence', stream: 'ai.recommendation.recorded', required: true, lastObservedAt: timestamp }], approvals: [{ id: 'approval-rec-harrow-7', status: 'pending', requiredApprovers: ['TrackSuperintendent'], reason: 'AI recommendations are advisory and require human approval.', evidence: ['surface:moisture=27'], updatedAt: timestamp }], audit: [{ id: 'audit-ai-1', action: 'ai-recommendation-recorded', actor: 'agent-surface-ops', timestamp, evidence: ['model-card'] }], relationships: [{ targetId: 'twin:track:main-track', type: 'OBSERVES', evidence: ['digital-twin-impact'], updatedAt: timestamp }] }),
  ];
  return createTUSStandardizationWorkspace({ assets, twins, context });
}

function createRosMetadataEnvelope(timestamp: string) {
  return {
    generatedAt: timestamp,
    schemaVersion: 'trackmind.ros.metadata.v1' as const,
    readOnly: true as const,
    executionEndpointsAvailable: false as const,
    source: 'trackmind-nexus-upgrade-package' as const,
    mock: false,
  };
}

function createRosMetadataFacade(timestamp: string, nexusUpgrade: TrackMindNexusUpgradePackage, aiControlPlane: AIControlPlaneWorkspaceDto, tusStandardization: JsonBody, trackCertification: TrackCertificationCandidateDto): RosFacadeStateDto {
  const envelope = createRosMetadataEnvelope(timestamp);
  const eventStandards = { tenantScoped: true, correlationRequired: true, auditRequired: true, replayable: true, digitalTwinReferenceExpected: true };
  const apiContracts = nexusUpgrade.workspaces.map((workspace) => workspace.apiPath);
  const eventTypes = nexusUpgrade.eventContracts.map((event) => event.eventType);
  const certifiedTrackCandidate = trackCertification;
  const tus = tusStandardization as { assets?: unknown[]; twins?: unknown[]; coverage?: Record<string, unknown> };
  return {
    universalSchema: {
      ...envelope,
      standard: 'TrackMind Universal Schema',
      domains: nexusUpgrade.workspaces.map((workspace) => workspace.id),
      entityKinds: nexusUpgrade.digitalTwinAssetKinds,
      requiredMetadata: ['tenantId', 'racetrackId', 'correlationId', 'causationId', 'auditRef', 'digitalTwinRef', 'actor', 'subject', 'evidence'],
      eventSchemaRefs: eventTypes,
      complianceFrameworks: nexusUpgrade.complianceFrameworks,
      safetyControls: nexusUpgrade.safetyControls.map((control) => ({ action: control.normalizedAction, autonomousExecutionAllowed: false, requiredRoles: control.requiredRoles, evidenceRequired: control.evidenceRequired })),
    },
    standardizationFramework: {
      ...envelope,
      workflowStandards: [
        { id: 'approval-gated-workflow', name: 'Approval-gated operational workflow', requiredStates: ['draft', 'pending-approval', 'approved', 'rejected', 'expired'], protectedActions: nexusUpgrade.safetyControls.map((control) => control.normalizedAction), evidenceRequired: ['human-approval-record', 'auditRef', 'digitalTwinRef'] },
        { id: 'tus-metadata-workflow', name: 'TUS metadata normalization workflow', requiredStates: ['ingested', 'standardized', 'validated', 'published'], protectedActions: [], evidenceRequired: ['source.system', 'schemaVersion', 'lineageRefs'] },
      ],
      eventStandards,
      complianceMappings: aiControlPlane.policy.governanceMapping,
    },
    saasTiers: {
      ...envelope,
      tiers: [
        { id: 'starter', name: 'ROS Starter', intendedFor: 'Single-track command center metadata', includedWorkspaces: ['operations', 'approvals', 'audit', 'platform-health'], complianceFrameworks: ['SOC-2', 'HISA'], federationEnabled: false, executionEndpointsAvailable: false },
        { id: 'professional', name: 'ROS Professional', intendedFor: 'Race-day operations and TUS standardization', includedWorkspaces: ['operations', 'race-office', 'surface', 'assets', 'digital-twin', 'compliance'], complianceFrameworks: ['SOC-2', 'HISA', 'ARCI', 'ISO-25010'], federationEnabled: false, executionEndpointsAvailable: false },
        { id: 'enterprise', name: 'ROS Enterprise', intendedFor: 'Full Nexus workspace coverage with governance and observability metadata', includedWorkspaces: nexusUpgrade.workspaces.map((workspace) => workspace.id), complianceFrameworks: nexusUpgrade.complianceFrameworks, federationEnabled: false, executionEndpointsAvailable: false },
        { id: 'federated', name: 'ROS Federated Network', intendedFor: 'Multi-operator metadata federation with aggregate analytics only', includedWorkspaces: nexusUpgrade.workspaces.map((workspace) => workspace.id), complianceFrameworks: nexusUpgrade.complianceFrameworks, federationEnabled: true, executionEndpointsAvailable: false },
      ],
    },
    certifiedTrack: { ...envelope, candidate: certifiedTrackCandidate, certificationCriteria: certifiedTrackCandidate.certificationCriteria, scorecard: certifiedTrackCandidate.scorecard, operatingStandards: certifiedTrackCandidate.operatingStandards },
    dataModel: {
      ...envelope,
      stores: [
        { id: 'tus-assets', purpose: 'Normalized asset metadata views', domains: ['assets', 'facilities', 'surface', 'emergency'], lineageRequired: true, auditRequired: true },
        { id: 'tus-twins', purpose: 'Normalized Digital Twin metadata views', domains: ['digital-twin', 'race', 'horse', 'facility', 'ai-agent'], lineageRequired: true, auditRequired: true },
        { id: 'event-catalog', purpose: 'Replayable event schema metadata', domains: nexusUpgrade.workspaces.map((workspace) => workspace.id), lineageRequired: true, auditRequired: true },
        { id: 'feature-store', purpose: 'AI feature, score, and evidence metadata', domains: ['surface', 'gate', 'race', 'horse', 'security', 'weather', 'operations'], lineageRequired: true, auditRequired: true },
      ],
      digitalTwinKinds: nexusUpgrade.digitalTwinAssetKinds,
      eventTypes,
      apiContracts,
      dataBoundaries: [`assets:${tus.assets?.length ?? 0}`, `twins:${tus.twins?.length ?? 0}`, `coverage:${Object.keys(tus.coverage ?? {}).join(',')}`],
    },
    intelligenceCore: {
      ...envelope,
      intelligenceModules: nexusUpgrade.aiControlPlane.modules.map((module) => ({ id: module.id, title: module.title, stage: module.stage, workspaceId: module.workspaceId, governanceAnchors: module.governanceAnchors, safetyControls: module.safetyControls, observabilityMetrics: module.observabilityMetrics })),
      featureStore: aiControlPlane.featureStoreSummary,
      modelRegistry: aiControlPlane.modelRegistry,
      governor: aiControlPlane.policy,
      protectedControlExecutionAllowed: false,
    },
    federation: {
      ...envelope,
      federationBoundaries: [
        { id: 'tenant-boundary', scope: 'tenant', dataResidency: 'tenant-configured', allowedSharing: ['schema metadata', 'aggregate readiness scores'], prohibitedSharing: ['personal data', 'veterinary records', 'credential identifiers'], approvalRequired: true },
        { id: 'racetrack-boundary', scope: 'racetrack', dataResidency: 'track jurisdiction', allowedSharing: ['TUS schema coverage', 'de-identified operating standards'], prohibitedSharing: ['live control commands', 'race-start authorization tokens'], approvalRequired: true },
        { id: 'jurisdiction-boundary', scope: 'jurisdiction', dataResidency: 'racing commission configured region', allowedSharing: ['compliance mappings', 'audit package references'], prohibitedSharing: ['sealed evidence payloads without approval'], approvalRequired: true },
        { id: 'operator-network-boundary', scope: 'operator-network', dataResidency: 'aggregate metadata plane', allowedSharing: ['benchmark bands', 'schema versions', 'capability availability'], prohibitedSharing: ['state-changing execution', 'protected operational commands'], approvalRequired: true },
      ],
      tenantIsolation: true,
      crossTrackAnalytics: 'aggregated-metadata-only',
      unsafeExecutionAcrossBoundaryAllowed: false,
      exportedSchemas: ['trackmind.ros.metadata.v1', 'trackmind.tus.asset.v1', 'trackmind.tus.twin.v1', ...eventTypes],
    },
  };
}

export interface ApiFacadeState {
  approvals: JsonBody;
  auditEvents: JsonBody;
  auditLedger: JsonBody;
  trackMap: JsonBody;
  assetRegistry: JsonBody;
  operations: JsonBody;
  readiness: JsonBody;
  raceOffice: JsonBody;
  surface: JsonBody;
  equine: JsonBody;
  barn: JsonBody;
  facilitiesMaintenance: JsonBody;
  steward: JsonBody;
  security: JsonBody;
  emergency: JsonBody;
  workforce: JsonBody;
  compliance: JsonBody;
  federation: JsonBody;
  kpis: JsonBody;
  racingData: RacingDataApiFacadeState;
  racingDataPolicies: JsonBody;
  aiGovernance: JsonBody;
  aiControlPlane: JsonBody;
  intelligenceCore: JsonBody;
  trackCertification: JsonBody;
  tusStandardization: JsonBody;
  unifiedDataModel: JsonBody;
  workflowTemplates: JsonBody;
  eventCatalog: JsonBody;
  platformHealth: JsonBody;
  nexusUpgrade: JsonBody;
  ros: RosFacadeStateDto;
  artifacts: UniversalArtifactFrameworkState;
  collaboration: CollaborationService;
  apex: ApexDomainControllers;
  approvalService: CentralizedApprovalService;
  cqrs: CqrsCommandHandler;
  complianceReporting: ComplianceReportingController;
  equinePrivacy: EquineIntelligenceController;
  rtkTelemetry: RtkTelemetryController;
  safetyIntelligence: SafetyIntelligenceController;
}

export function createApiFacadeState(): ApiFacadeState {
  const contract = createCommandCenterContractSnapshot();
  const timestamp = now();
  const artifacts = createUniversalArtifactFrameworkState(timestamp);
  const barnOperations = createSeededBarnOperationsService().snapshot();
  const workforce = seedWorkforceOperations({}, 'track-1', timestamp).dashboard(timestamp);
  const facilitiesMaintenance = createServiceBackedFacilitiesWorkspace(timestamp) as any;
  const compliance = seededComplianceLibrary().dashboard();
  const racingData = createRacingDataApiFacadeState(timestamp);
  const racingDataPolicyAudit = new ImmutableAuditLog();
  const racingDataPolicies = seededRacingDataLicensePolicyService(timestamp, { auditLog: racingDataPolicyAudit }).workspace(timestamp);
  const aiGovernance = createSeededAIGovernanceWorkspace(timestamp, false);
  const aiControlPlane = createSeededAIControlPlaneWorkspace(timestamp, false) as unknown as AIControlPlaneWorkspaceDto;
  const intelligenceCore = { ...createTrackMindIntelligenceCoreMetadata(), generatedAt: timestamp, mock: false } satisfies TrackMindIntelligenceCoreDto;
  const platformHealth = { ...createMockPlatformHealth(), generatedAt: timestamp };
  const auditLedger = createAuditLedgerFacade(timestamp, contract.auditEvents) as unknown as { verification?: { valid?: boolean }; complianceExport?: { records?: unknown[] } };
  const surfaceWorkspace = buildSurfaceIntelligenceWorkspace(createSurfaceFacadeInput(timestamp));
  const stewardCenter = { inquiries: listStewardInquiries(), permissions: { canRead: true, canDraft: true, canFinalize: false, canExportAppeal: true }, mock: false };
  const security = createSecurityOperationsFacade(timestamp) as any;
  const emergency = createServiceBackedEmergencyWorkspace(workforce, timestamp) as any;
  const raceOperations = createServiceBackedRaceOperations(timestamp);
  const raceOffice = raceOperations.workspace as any;
  const readinessDashboard = createServiceBackedReadiness({ racePlatform: raceOperations.platform, workforce, facilities: facilitiesMaintenance, security, timestamp }) as any;
  const certificationReadiness = {
    averageScore: readinessDashboard.averageScore,
    domainScores: readinessDashboard.domainScores,
    auditRecords: readinessDashboard.auditRecords,
    events: readinessDashboard.events,
  };
  const trackCertification = createTrackCertificationCandidate({ trackId: 'main-track', generatedAt: timestamp, compliance, readiness: certificationReadiness, platformHealth: platformHealth as Parameters<typeof createTrackCertificationCandidate>[0]['platformHealth'], aiGovernance: aiGovernance as any, digitalTwinState: contract.digitalTwinState, auditLedger, mock: false });
  const tusStandardization = createTUSStandardizationFacade(timestamp);
  const nexusUpgrade = createTrackMindNexusUpgradePackage(timestamp);
  const federation = createFederationWorkspace(timestamp, false);
  const kpis = createKPIWorkspace({ generatedAt: timestamp, tenantId: 'trackmind', organizationId: 'org-trackmind-network', racetrackId: 'main-track' });
  const ros = createRosMetadataFacade(timestamp, nexusUpgrade, aiControlPlane as AIControlPlaneWorkspaceDto, tusStandardization, trackCertification);
  const approvalService = new CentralizedApprovalService();
  const apex = createApexDomainControllers();
  const cqrs = createCqrsCommandHandler();
  const complianceReporting = createComplianceReportingController();
  const equinePrivacy = createEquineIntelligenceController();
  const rtkTelemetry = createRtkTelemetryController(cqrs);
  const safetyIntelligence = createSafetyIntelligenceController();
  const equineWorkspace = {
    horse: { horseId: 'horse-1', tenantId: 'tenant-1', name: 'Lifecycle Runner', lifecycleStatus: 'active', microchipId: '985141001' },
    ownership: [{ ownerId: 'owner-1', ownerName: 'Stable A', percentage: 100, effectiveFrom: '2026-01-01' }],
    trainerAssignments: [{ trainerId: 'trainer-1', trainerName: 'Trainer A', licenseStatus: 'active', effectiveFrom: '2026-02-01' }],
    raceHistory: [{ raceId: 'race-7', date: '2026-06-13', trackId: 'main-track', status: 'entered' }],
    workoutHistory: [{ workoutId: 'work-1', date: '2026-06-01', trackId: 'main-track', distanceFurlongs: 4, timeSeconds: 48.4, surface: 'dirt' }],
    transportationRecords: [{ tripId: 'trip-1', from: 'receiving barn', to: 'barn-2', departedAt: '2026-06-12T10:00:00.000Z', arrivedAt: '2026-06-12T12:00:00.000Z', transporter: 'licensed-equine-van', welfareChecks: ['water offered', 'temperature checked'] }],
    veterinaryStatus: { status: 'pending-exam', summary: 'Veterinarian review required before operational change.', requiresVeterinarian: true },
    eligibilityStatus: { eligible: false, complianceStatus: 'under-review', flags: ['vet-review-pending'], failedRules: ['veterinarian-review-required', 'no-unreviewed-health-ai'] },
    eligibilityRules: [{ id: 'active-lifecycle', description: 'Horse must be active', passed: true, failureStatus: 'ineligible' }, { id: 'no-unreviewed-health-ai', description: 'Health AI remains advisory until veterinarian review', passed: false, failureStatus: 'under-review' }],
    welfareStatus: { level: 'acceptable', latestScore: 92, interventions: [] },
    welfareRecords: [{ recordId: 'welfare-1', observedAt: timestamp, observerId: 'welfare-officer', score: 92, notes: 'Bright and alert', interventions: [] }],
    barnAssignment: { barnId: 'barn-2', stallId: 'stall-12A', assignedAt: timestamp },
    digitalTwinReferences: [{ twinId: 'equine:horse-1', twinType: 'horse', sourceSystem: 'trackmind-api', relationship: 'primary', readOnly: true }],
    relationships: [
      { id: 'horse-1:owner:owner-1', type: 'owned-by', fromId: 'horse-1', toId: 'owner-1', effectiveFrom: '2026-01-01', evidence: ['ownership-registry'] },
      { id: 'horse-1:trainer:trainer-1', type: 'trained-by', fromId: 'horse-1', toId: 'trainer-1', effectiveFrom: '2026-02-01', evidence: ['license-registry'] },
      { id: 'horse-1:race:race-7', type: 'entered-in-race', fromId: 'horse-1', toId: 'race-7', effectiveFrom: '2026-06-13', evidence: ['race-office'] },
      { id: 'horse-1:workout:work-1', type: 'worked-at-track', fromId: 'horse-1', toId: 'main-track', effectiveFrom: '2026-06-01', evidence: ['work-1', 'clockers'] },
      { id: 'horse-1:transport:trip-1', type: 'transported-by', fromId: 'horse-1', toId: 'licensed-equine-van', effectiveFrom: '2026-06-12T10:00:00.000Z', effectiveTo: '2026-06-12T12:00:00.000Z', evidence: ['water offered', 'temperature checked'] },
      { id: `horse-1:barn:barn-2:${timestamp}`, type: 'assigned-to-barn', fromId: 'horse-1', toId: 'barn-2', effectiveFrom: timestamp, evidence: ['barn.horse.assigned', 'audit-barn-1', 'stall-12A'] },
      { id: 'horse-1:twin:equine:horse-1', type: 'mirrored-by-digital-twin', fromId: 'horse-1', toId: 'equine:horse-1', effectiveFrom: timestamp, evidence: ['trackmind-api'] },
    ],
    aiRiskRecommendations: [{ id: 'ai-risk-1', summary: 'Advisory only pending veterinarian review.', advisoryOnly: true, veterinarianReviewRequired: true, status: 'pending-veterinarian-review', proposedOperationalAction: 'add-veterinary-restriction' }],
    approvals: [{ id: 'approval-ai-risk-1', action: 'veterinary-clearance', status: 'pending', requiredRole: 'veterinarian' }],
    audit: [{ id: 'audit-equine-1', actor: 'ai-health-1', action: 'ai-recommendation-recorded', timestamp }],
    events: [{ eventId: 'event-equine-1', type: 'equine.ai.recommendation.recorded', auditId: 'audit-equine-1' }],
    observability: { pendingVeterinarianReviews: 1, openApprovals: 1, auditRecords: 1, eventCount: 1, twinStates: 1, advisoryRecommendations: 1 },
    integrations: { barn: true, raceOffice: true, audit: true, eventBus: true, approvals: true, digitalTwin: true, observability: true },
    privacy: { tenantId: 'tenant-1', veterinaryRecordsVisible: 0, veterinaryRecordsRedacted: 1 },
    mock: false,
  };
  return {
    approvals: contract.approvals,
    auditEvents: contract.auditEvents.length ? contract.auditEvents : [{ id: 'audit-live-1', type: 'api.facade.started', actor: 'trackmind-api', timestamp, severity: 'info', previousHash: 'genesis', hash: 'sha256:api-facade', mock: false }],
    auditLedger,
    trackMap: {
      trackId: 'main-track',
      distanceMeters: 1609,
      startingGate: { sectorId: contract.gatePosition.sectorId, metersFromStart: contract.gatePosition.metersFromStart },
      sectors: [{ id: 'chute', name: 'Chute', startMeters: 0, endMeters: 300, condition: 'good' }, { id: 'backstretch', name: 'Backstretch', startMeters: 300, endMeters: 900, condition: 'fast' }, { id: 'far-turn', name: 'Far Turn', startMeters: 900, endMeters: 1250, condition: 'maintenance' }, { id: 'stretch', name: 'Home Stretch', startMeters: 1250, endMeters: 1609, condition: 'good' }],
      measurements: contract.surfaceMeasurements,
      assets: contract.assets,
      trackConfiguration: {
        changeId: 'chg-race-7-track-config',
        raceDistance: { advertisedMeters: 1609, measuredMeters: 1614.4, varianceMeters: 5.4, regulatoryFlags: ['rail-adjustment-applied', 'distance-variance-review'] },
        railPosition: { railId: 'portable-rail-b', offsetMeters: 6, protectedTurns: ['clubhouse', 'far-turn'] },
        turfConfiguration: { lane: 'B', going: 'good', irrigationMillimeters: 2, mowingHeightMillimeters: 110, resting: false },
        approvalRequirements: ['racing-secretary', 'track-superintendent', 'steward', 'timer', 'course-superintendent', 'regulatory-compliance'],
        workOrders: [
          { id: 'chg-race-7-track-config-gate', crew: 'gate-crew', status: 'approval-blocked', tasks: ['verify 1609m race distance', 'place gate gate-1', 'capture post-placement GPS proof'], evidenceRequired: ['gps-fix', 'photo', 'crew-attestation', 'distance-calculation-sheet'], dueAt: timestamp },
          { id: 'chg-race-7-track-config-rail', crew: 'rail-crew', status: 'approval-blocked', tasks: ['set rail portable-rail-b to 6m', 'inspect protected turns'], evidenceRequired: ['rail-measurement', 'inspection-report'], dueAt: timestamp },
          { id: 'chg-race-7-track-config-turf', crew: 'turf-crew', status: 'approval-blocked', tasks: ['prepare turf lane B', 'confirm going good'], evidenceRequired: ['going-stick-reading', 'irrigation-log', 'mowing-log'], dueAt: timestamp },
        ],
        verificationWorkflow: { id: 'chg-race-7-track-config-verification', status: 'approval-blocked', digitalTwinSync: 'blocked-until-approved', requiredRoles: ['racing-secretary', 'track-superintendent', 'steward'], actuatorControlAvailable: false },
        events: ['track.configuration.change.requested', 'track.configuration.approval.required', 'track.configuration.work-order.issued', 'track.configuration.verified', 'digital-twin.state.patch'],
        auditIds: ['audit-track-config-submit', 'audit-track-config-approval'],
        digitalTwinSync: { twinId: 'race-setup:race-7', status: 'approval-required' },
        noLiveActuatorControl: true,
      },
      geospatial: {
        viewport: { center: { latitude: 38.045, longitude: -76.95 }, zoom: 16, bounds: { north: 38.07, south: 38.03, east: -76.93, west: -76.97 } },
        overlays: ['sector','gate','rail','barn','stall','facility','camera','emergency','measurement','incident','maintenance','workforce','twin','simulation'].map((layer) => ({ id: layer, name: layer, layer, visible: true, opacity: 1 })),
        features: [
          ...contract.assets.map((asset, index) => ({ id: asset.id, layer: asset.type === 'gate' ? 'gate' : asset.type === 'camera' ? 'camera' : 'measurement', label: asset.label, status: asset.status === 'warning' ? 'warning' : 'nominal', source: asset.twinId ? 'digital-twin' : 'asset-registry', coordinates: { latitude: 38.04 + index / 1000, longitude: -76.95 - index / 1000 }, properties: { sectorId: asset.sectorId } })),
          ...facilitiesMaintenance.assets.map((asset: any, index: number) => ({ id: `facility:${asset.assetId}`, layer: 'facility', label: asset.name, status: asset.readinessStatus === 'ready' ? 'nominal' : asset.readinessStatus === 'watch' ? 'warning' : 'critical', source: 'asset-registry', coordinates: { latitude: 38.043 + index / 1000, longitude: -76.952 - index / 1000 }, properties: { assetId: asset.assetId, twinId: asset.twinId, healthScore: asset.healthScore } })),
          { id: 'rail:portable', layer: 'rail', label: 'Portable Rail B', status: 'nominal', source: 'track-configuration', coordinates: { latitude: 38.047, longitude: -76.946 }, properties: { offsetMeters: 6 } },
          { id: 'barn:2', layer: 'barn', label: 'Barn 2', status: 'nominal', source: 'asset-registry', coordinates: { latitude: 38.061, longitude: -76.955 }, properties: { capacity: 40 } },
          { id: 'stall:12A', layer: 'stall', label: 'Stall 12A', status: 'standby', source: 'asset-registry', coordinates: { latitude: 38.0605, longitude: -76.9545 }, properties: { barnId: 'barn-2', occupancyHorseId: 'horse-1' } },
          { id: 'incident:credential', layer: 'incident', label: 'Backstretch credential exception', status: 'warning', source: 'event-service', coordinates: { latitude: 38.058, longitude: -76.956 }, properties: { severity: 'advisory' } },
          { id: 'maintenance:harrow', layer: 'maintenance', label: 'Far-turn harrow pass', status: 'in-progress', source: 'event-service', coordinates: { latitude: 38.049, longitude: -76.944 }, properties: { workOrder: 'wo-7' } },
          { id: 'workforce:gate-crew', layer: 'workforce', label: 'Gate Crew Alpha', status: 'nominal', source: 'event-service', coordinates: { latitude: 38.041, longitude: -76.958 }, properties: { checkedIn: 6 } },
        ],
        playback: [{ at: timestamp, featureIds: contract.assets.map((asset) => asset.id), summary: 'API facade initialized command-center map' }],
        simulationOverlays: [{ id: 'sim:gate-move', scenario: 'Starting gate move readiness', featureIds: ['gate-1'], riskDelta: 24, approvalRequired: true }],
        digitalTwinState: contract.digitalTwinState.map((twin) => ({ ...twin, relationshipCount: 3, dependencyCount: 1, historyEvents: twin.version, approvalRequired: twin.state?.approvalRequired === true || twin.assetId === 'gate-1' })),
        controls: { zoom: { current: 16, presets: [12,14,16,18,20] }, filters: ['layer','status','source','time','search'], overlayModes: ['current-state','historical-playback','simulation','digital-twin-health'], playbackEnabled: true },
      },
      mock: false,
    },
    assetRegistry: {
      generatedAt: timestamp,
      total: contract.assets.length + 4,
      assets: [
        ...contract.assets.map((asset) => ({
          assetId: asset.id,
          tenantId: 'main-track',
          name: asset.label,
          assetClass: asset.type === 'camera' ? 'digital' : 'physical',
          assetType: asset.type,
          lifecycleStatus: asset.status === 'warning' ? 'maintenance' : 'active',
          riskLevel: asset.status === 'warning' ? 'high' : 'medium',
          safetyCritical: asset.type === 'gate',
          owner: asset.type === 'camera' ? 'SecuritySOC' : 'RaceOps',
          telemetryBindings: asset.twinId ? [{ sourceId: asset.twinId, stream: 'digital-twin.state', required: true }] : [],
          maintenanceHistory: [],
          complianceMappings: ['TrackPolicy'],
          twinId: asset.twinId,
        })),
        { assetId: 'HORSE_LIFECYCLE_RUNNER', tenantId: 'main-track', name: 'Lifecycle Runner', assetClass: 'biological', assetType: 'Horse', lifecycleStatus: 'active', riskLevel: 'medium', safetyCritical: false, owner: 'EquineSafety', telemetryBindings: [{ sourceId: 'wearable:horse-1', stream: 'equine.biometrics', required: false }], maintenanceHistory: [], complianceMappings: ['HISA'], twinId: 'equine:horse-1' },
        { assetId: 'WAGERING_CORE', tenantId: 'main-track', name: 'Wagering Core', assetClass: 'digital', assetType: 'WageringSystem', lifecycleStatus: 'active', riskLevel: 'critical', safetyCritical: true, owner: 'WageringIntegrity', telemetryBindings: [{ sourceId: 'wagering-ledger', stream: 'wagering.integrity', required: true }], maintenanceHistory: [], complianceMappings: ['PCI-DSS', 'SOC2'], twinId: 'twin:wagering-core' },
        { assetId: 'RACE_7_OPERATION', tenantId: 'main-track', name: 'Race 7 Operation', assetClass: 'operational', assetType: 'RaceEvent', lifecycleStatus: 'pending-approval', riskLevel: 'high', safetyCritical: true, owner: 'RaceOps', telemetryBindings: [], maintenanceHistory: [], complianceMappings: ['StateRacingCommission'], twinId: 'twin:race-7' },
        { assetId: 'COMPLIANCE_HISA_001', tenantId: 'main-track', name: 'HISA Compliance Record', assetClass: 'regulatory', assetType: 'RegulatoryRecord', lifecycleStatus: 'active', riskLevel: 'high', safetyCritical: false, owner: 'LegalRegulatory', telemetryBindings: [], maintenanceHistory: [], complianceMappings: ['HISA'], twinId: 'twin:compliance-hisa-001' },
      ],
      facets: { assetClasses: ['physical','digital','biological','operational','regulatory'], lifecycleStatuses: ['draft','pending-approval','active','maintenance','retired','archived'], riskLevels: ['low','medium','high','critical'] },
      api: { search: '/api/v1/assets/search', approvalRequests: '/api/v1/assets/{assetId}/approval-requests', telemetryBindings: '/api/v1/assets/{assetId}/telemetry-bindings', maintenanceHistory: '/api/v1/assets/{assetId}/maintenance-history' },
      mock: false,
    },
    operations: {
      generatedAt: timestamp,
      activeLayoutId: 'race-day-commander',
      widgets: [
        { id: 'race-readiness', title: 'Race readiness', domain: 'race-office', status: readinessDashboard.blocked > 0 ? 'critical' : readinessDashboard.watch > 0 ? 'warning' : 'nominal', value: `Race 7 ${readinessDashboard.races[0]?.status ?? 'watch'}`, detail: 'Race office and readiness widgets are backed by RaceOperationsPlatform and RaceDayReadinessService.', source: 'service', drillDownPath: '/race-office', roleView: 'all', configurable: true },
        { id: 'surface-conditions', title: 'Surface conditions', domain: 'surface', status: surfaceWorkspace.overallScore >= 80 ? 'nominal' : surfaceWorkspace.overallScore >= 60 ? 'warning' : 'critical', value: `${surfaceWorkspace.overallScore} surface score`, detail: `${surfaceWorkspace.recommendations.length} approval-gated recommendations from /api/v1/surface-intelligence/workspace.`, source: 'service', drillDownPath: '/surface', roleView: 'all', configurable: true },
        { id: 'weather-status', title: 'Weather status', domain: 'weather', status: surfaceWorkspace.weatherObservation.forecastRainMm > 10 ? 'warning' : 'advisory', value: `${surfaceWorkspace.weatherObservation.forecastRainMm}mm forecast rain`, detail: 'Weather is currently surfaced through the Surface Intelligence facade; no separate live weather service is claimed.', source: 'service', drillDownPath: '/surface', roleView: 'all', configurable: true },
        { id: 'active-incidents', title: 'Active incidents', domain: 'security', status: security.incidents.length ? 'warning' : 'nominal', value: `${security.incidents.length} active incident`, detail: `Security incidents load from /api/v1/security-operations/workspace; open escalations ${security.dashboard.openEscalations ?? 0}.`, source: 'service', drillDownPath: '/security', roleView: 'all', configurable: true },
        { id: 'pending-approvals', title: 'Pending approvals', domain: 'approvals', status: contract.approvals.length ? 'warning' : 'nominal', value: `${contract.approvals.length} pending approval`, detail: 'Approval queue loads from /api/v1/approvals/requests; protected controls stay locked without a live approval token.', source: 'service', drillDownPath: '/approvals', roleView: 'all', configurable: true },
        { id: 'steward-inquiries', title: 'Steward inquiries', domain: 'stewards', status: stewardCenter.inquiries.length ? 'warning' : 'nominal', value: `${stewardCenter.inquiries.length} inquiry under review`, detail: 'Steward Center loads inquiry evidence, audit, events, and approval refs; official results stay locked.', source: 'service', drillDownPath: '/stewards', roleView: ['admin', 'steward'], configurable: true },
        { id: 'workforce-readiness', title: 'Workforce readiness', domain: 'workforce', status: workforce.readiness.status === 'ready' ? 'nominal' : workforce.readiness.status === 'watch' ? 'warning' : 'critical', value: `${workforce.readiness.coveragePct}% covered`, detail: `${workforce.readiness.checkedIn}/${workforce.readiness.demand} checked in; compliance ${workforce.compliance.status}.`, source: 'service', drillDownPath: '/workforce', roleView: 'all', configurable: true },
        { id: 'asset-health', title: 'Asset health', domain: 'assets', status: 'warning', value: `${contract.assets.length} assets`, detail: 'Asset and twin records are exposed through /api/v1/assets and /api/v1/digital-twin/state.', source: 'digital-twin', drillDownPath: '/assets', roleView: 'all', configurable: true },
        { id: 'facility-readiness', title: 'Facility readiness', domain: 'facilities', status: facilitiesMaintenance.readiness.status === 'ready' ? 'nominal' : 'warning', value: `${facilitiesMaintenance.readiness.score}% ready`, detail: 'Facilities maintenance reads RACR assets, Digital Twins, approvals, work orders, and predictive hooks.', source: 'service', drillDownPath: '/facilities', roleView: 'all', configurable: true },
        { id: 'emergency-resources', title: 'Emergency resources', domain: 'emergency', status: emergency.events.length ? 'warning' : 'nominal', value: `${emergency.resources.length} resources`, detail: `EmergencyOperationsPlatform exposes ${emergency.workflowIntegrations.length} workflow integrations and an active human command checklist; AI may block ${String(emergency.emergencyActions.aiMayBlock)}.`, source: 'service', drillDownPath: '/emergency', roleView: 'all', configurable: true },
        { id: 'ai-recommendations', title: 'AI recommendations', domain: 'ai-governance', status: 'advisory', value: `${contract.aiRecommendations.length} governed recommendation`, detail: 'AI output remains recommendation-only and approval-aware.', source: 'service', drillDownPath: '/ai-governance', roleView: ['admin'], configurable: true },
        { id: 'audit-activity', title: 'Audit activity', domain: 'audit', status: 'nominal', value: `${contract.auditEvents.length || 1} visible audit rows`, detail: 'Audit activity loads from /api/v1/audit/events with hash-chain references; platform totals remain separate observability metrics.', source: 'service', drillDownPath: '/audit', roleView: ['admin', 'read-only-auditor'], configurable: true },
        { id: 'event-timeline', title: 'Event timeline', domain: 'platform', status: 'advisory', value: 'Event stream ready', detail: 'Timeline combines OperationsCommandCenterDto.liveEvents with readiness, emergency, and AI events; stream is telemetry only.', source: 'event-stream', drillDownPath: '/operations', roleView: 'all', configurable: true },
      ],
      savedLayouts: [{ id: 'race-day-commander', name: 'Race Day Commander', role: 'admin', widgetIds: ['race-readiness','surface-conditions','weather-status','active-incidents','pending-approvals','steward-inquiries','asset-health','workforce-readiness','emergency-resources','facility-readiness','ai-recommendations','audit-activity','event-timeline'] }, { id: 'steward-view', name: 'Steward Inquiry View', role: 'steward', widgetIds: ['race-readiness','steward-inquiries','pending-approvals','event-timeline'] }, { id: 'facilities-view', name: 'Facilities and Maintenance', role: 'track-superintendent', widgetIds: ['facility-readiness','asset-health','workforce-readiness','emergency-resources'] }],
      liveEvents: [{ id: 'evt-live-api', timestamp, type: 'nexus.api.facade.started', domain: 'platform', summary: 'Runtime API facade is serving command-center contracts.', severity: 'info', source: 'event-stream' }, { id: 'evt-surface-live', timestamp, type: 'surface.reading.updated', domain: 'surface', summary: `Surface score ${surfaceWorkspace.overallScore}; weather forecast ${surfaceWorkspace.weatherObservation.forecastRainMm}mm rain.`, severity: surfaceWorkspace.weatherObservation.forecastRainMm > 10 ? 'warning' : 'info', source: 'service' }, { id: 'evt-security-live', timestamp, type: 'security.incident.summary', domain: 'security', summary: `${security.incidents.length} security incidents loaded for command center.`, severity: security.incidents.length ? 'warning' : 'info', source: 'service' }, { id: 'evt-workforce-live', timestamp, type: 'workforce.readiness.evaluated', domain: 'operations', summary: `Workforce readiness ${workforce.readiness.status} at ${workforce.readiness.score}.`, severity: workforce.readiness.status === 'blocked' ? 'critical' : workforce.readiness.status === 'watch' ? 'warning' : 'info', source: 'service' }, { id: 'evt-facility-readiness', timestamp, type: 'facilities.readiness.evaluated', domain: 'facilities', summary: `Facilities readiness ${facilitiesMaintenance.readiness.score}% with approval-gated work orders.`, severity: 'warning', source: 'service' }],
      alerts: [{ id: 'alert-approval', title: 'Protected actions remain approval-gated', severity: 'advisory', acknowledged: false, actionPath: '/approvals', evidence: ['centralized-approval-service'] }, { id: 'alert-security', title: 'Security incident watch', severity: security.incidents.length ? 'warning' : 'advisory', acknowledged: false, actionPath: '/security', evidence: security.incidents.flatMap((incident: any) => incident.eventIds) }, { id: 'alert-facilities', title: 'Facilities maintenance watch', severity: 'warning', acknowledged: false, actionPath: '/facilities', evidence: ['facilities-maintenance', 'racr:GRANDSTAND_HVAC_01'] }],
      aiRecommendations: contract.aiRecommendations.map((rec) => ({ id: rec.id, recommendationId: rec.recommendationId, recommendation: rec.recommendation, confidence: rec.confidence, evidence: rec.evidence, modelVersion: rec.modelVersion, generatedAt: rec.generatedAt, approvalRequirement: rec.approvalRequirement, auditReference: rec.auditReference, requiresApproval: rec.requiresApproval, actionPath: rec.actionPath })),
      dataLineage: [{ domain: 'readiness', source: 'service', reference: '/api/v1/race-day-readiness/dashboard' }, { domain: 'surface-weather', source: 'service', reference: '/api/v1/surface-intelligence/workspace' }, { domain: 'security-incidents', source: 'service', reference: '/api/v1/security-operations/workspace' }, { domain: 'approvals', source: 'service', reference: '/api/v1/approvals/requests' }, { domain: 'stewards', source: 'service', reference: '/api/v1/stewarding/inquiries' }, { domain: 'assets', source: 'digital-twin', reference: '/api/v1/digital-twin/state' }, { domain: 'workforce', source: 'service', reference: '/api/v1/workforce-operations/workspace' }, { domain: 'emergency', source: 'service', reference: '/api/v1/emergency-operations/workspace' }, { domain: 'facilities', source: 'service', reference: '/api/v1/facilities-maintenance/workspace' }, { domain: 'ai', source: 'service', reference: '/api/v1/ai-governance/workspace' }, { domain: 'audit', source: 'service', reference: '/api/v1/audit/events' }, { domain: 'events', source: 'event-stream', reference: '/api/v1/events/stream' }],
      mock: false,
    },
    readiness: readinessDashboard,
    raceOffice,
    surface: { ...surfaceWorkspace, mock: false },
    equine: equineWorkspace,
    barn: { ...barnOperations, mock: false },
    facilitiesMaintenance: { ...facilitiesMaintenance, mock: false },
    steward: stewardCenter,
    security,
    emergency,
    workforce: { ...workforce, mock: false },
    compliance: { ...compliance, trackCertificationCandidate: trackCertification, franchiseOperatingStandards: trackCertification.operatingStandards, mock: false },
    federation,
    kpis,
    racingData,
    racingDataPolicies: { ...racingDataPolicies, mock: false },
    aiGovernance,
    aiControlPlane,
    intelligenceCore,
    trackCertification,
    tusStandardization,
    unifiedDataModel: createUnifiedDataModelWorkspace(timestamp, { tenantId: 'trackmind', racetrackId: 'main-track' }),
    workflowTemplates: { ...workflowTemplateRegistry('trackmind', timestamp), mock: false },
    eventCatalog: {
      generatedAt: timestamp,
      standards: { tenantScoped: true, correlationRequired: true, auditRequired: true, replayable: true, deadLetterHandling: true, requiredReferences: ['tenantId','racetrackId','correlationId','auditRef','digitalTwinRef','actor','subject','evidence'] },
      events: [...createNexusEventCatalog(), ...createApiHubEventCatalog()].map((event) => ({ type: event.type, version: event.version, schemaRef: event.type, owner: event.owner, payloadFields: event.payloadFields, compliance: event.compliance, standards: event.standards, operationalMetadata: event.operationalMetadata })),
      integrations: ['audit-ledger','approval-governance','workflow-engine','digital-twin-runtime','api-hub','platform-observability','frontend-workspaces'],
      mock: false,
    },
    platformHealth,
    nexusUpgrade,
    ros,
    artifacts,
    collaboration: new CollaborationService(),
    apex,
    approvalService,
    cqrs,
    complianceReporting,
    equinePrivacy,
    rtkTelemetry,
    safetyIntelligence,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const knownRoles: Role[] = ['admin','steward','veterinarian','track-superintendent','security','ticketing-manager','finance','racing-secretary','compliance-officer','read-only-auditor'];

function headerValue(headers: IncomingMessage['headers'] | undefined, name: string): string | undefined {
  const value = headers?.[name.toLowerCase()];
  return stringValue(Array.isArray(value) ? value[0] : value);
}

function filterOperationsForRole(operations: JsonBody, role?: Role): JsonBody {
  if (!isRecord(operations)) return operations;
  const roleCanView = (roleView: unknown) => roleView === 'all' || !Array.isArray(roleView) || Boolean(role && roleView.includes(role));
  const widgets = Array.isArray(operations.widgets) ? operations.widgets.filter((widget) => isRecord(widget) && roleCanView(widget.roleView)) : operations.widgets;
  const savedLayouts = Array.isArray(operations.savedLayouts) ? operations.savedLayouts.filter((layout) => isRecord(layout) && roleCanView(layout.role)) : operations.savedLayouts;
  return { ...operations, widgets, savedLayouts };
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function collaborationQuery(params: URLSearchParams): CollaborationThreadQuery & CollaborationActivityQuery {
  return {
    tenantId: stringValue(params.get('tenantId')),
    racetrackId: stringValue(params.get('racetrackId')),
    targetArtifactId: stringValue(params.get('targetArtifactId')),
    targetArtifactType: stringValue(params.get('targetArtifactType')),
    threadId: stringValue(params.get('threadId')),
    approvalRef: stringValue(params.get('approvalRef')),
    limit: numberValue(params.get('limit')),
    offset: numberValue(params.get('offset')),
  };
}

function kpiPrincipal(params: URLSearchParams, headers?: IncomingMessage['headers']): { tenantId?: string; racetrackId?: string; role?: Role } {
  const headerRole = headerValue(headers, 'x-trackmind-role');
  const role = headerRole && knownRoles.includes(headerRole as Role) ? headerRole as Role : undefined;
  return {
    tenantId: stringValue(params.get('tenantId')) ?? headerValue(headers, 'x-trackmind-tenant-id'),
    racetrackId: stringValue(params.get('racetrackId')) ?? headerValue(headers, 'x-trackmind-racetrack-id'),
    role,
  };
}

function kpiScopeMismatch(params: URLSearchParams, headers?: IncomingMessage['headers']): string | undefined {
  const checks = [
    ['tenantId', 'x-trackmind-tenant-id'],
    ['racetrackId', 'x-trackmind-racetrack-id'],
    ['organizationId', 'x-trackmind-organization-id'],
  ] as const;
  for (const [paramName, headerName] of checks) {
    const queryValue = stringValue(params.get(paramName));
    const scopedHeader = headerValue(headers, headerName);
    if (queryValue && scopedHeader && queryValue !== scopedHeader) return `${paramName} query/header scope mismatch`;
  }
  return undefined;
}

function collaborationPrincipal(input: Record<string, unknown>, scope: 'collaboration:read' | 'collaboration:write'): CollaborationPrincipal {
  return {
    id: stringValue(input.actorId) ?? stringValue(input.createdBy) ?? stringValue(input.requestedBy) ?? 'api-collaboration-user',
    tenantId: stringValue(input.tenantId),
    racetrackId: stringValue(input.racetrackId),
    scopes: [scope],
    actorType: stringValue(input.actorType) as CollaborationPrincipal['actorType'] | undefined,
  };
}

function collaborationError(error: unknown): { status: number; body: JsonBody } {
  const message = error instanceof Error ? error.message : String(error);
  const status = /authentication required/i.test(message) ? 401 : /scope|isolation violation/i.test(message) ? 403 : 400;
  return { status, body: { ok: false, error: { code: status === 403 ? 'forbidden' : status === 401 ? 'unauthorized' : 'bad_request', message } } };
}

const controlledActionPermissions: Partial<Record<string, Permission[]>> = {
  'race-start': ['race:request-start'],
  'race-stop': ['incident:manage'],
  'race-cancellation': ['race:request-start'],
  'official-results': ['race:finalize-results'],
  'modify-official-results': ['race:finalize-results'],
  'scratch-horse': ['horse:scratch', 'vet:review'],
  'race-office-scratch': ['horse:scratch', 'vet:review'],
  'clear-vet-flag': ['vet:clear-flag'],
  'veterinary-clearance': ['vet:clear-flag'],
  'steward-ruling': ['discipline:issue'],
  'steward-decision': ['discipline:issue'],
  payout: ['finance:payout'],
  'emergency-action': ['incident:manage'],
  'emergency-personnel-override': ['incident:manage'],
  'starting-gate-move': ['race:request-start', 'track:readings'],
  'race-distance-configuration': ['race:request-start', 'track:readings'],
  'race-status-change': ['race:request-start'],
  'race-office-configuration': ['race:request-start'],
  'surface-irrigation': ['track:readings'],
  'surface-harrowing': ['track:readings'],
  'surface-rolling': ['track:readings'],
  'surface-track-closure-recommendation': ['track:readings', 'incident:manage'],
  'track-closure': ['track:readings', 'incident:manage'],
  'track-reopen': ['track:readings', 'incident:manage'],
  'safety-critical-control': ['incident:manage', 'track:readings', 'security:manage'],
  'facility-maintenance-execution': ['track:readings'],
  'compliance-filing-approval': ['compliance:audit'],
};

function badRequest(message: string): { status: number; body: JsonBody } {
  return { status: 400, body: { ok: false, error: { code: 'bad_request', message } } };
}

function forbidden(message: string): { status: number; body: JsonBody } {
  return { status: 403, body: { ok: false, error: { code: 'forbidden', message } } };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()) : [];
}

function approvalBoundaryContext(body: unknown): { input?: Record<string, unknown>; error?: { status: number; body: JsonBody } } {
  if (!isRecord(body)) return { error: badRequest('JSON object body is required') };
  const missing = ['tenantId', 'racetrackId', 'action', 'target', 'reason'].filter((field) => !stringValue(body[field]));
  const evidence = stringArray(body.evidence);
  if (evidence.length === 0) missing.push('evidence');
  if (missing.length > 0) return { error: badRequest(`Approval boundary context missing: ${missing.join(', ')}`) };
  return { input: body };
}

function actorRoles(input: Record<string, unknown>): Role[] {
  return stringArray(input.roles).filter((role): role is Role => ['admin','steward','veterinarian','track-superintendent','security','ticketing-manager','finance','racing-secretary','compliance-officer','read-only-auditor'].includes(role));
}

function actorTypeFrom(input: Record<string, unknown>): 'human' | 'ai-agent' | 'service' {
  const actorType = stringValue(input.actorType) ?? 'human';
  if (actorType === 'ai-agent' || actorType === 'service') return actorType;
  return 'human';
}

function validateProtectedApprovalBoundary(body: unknown, approvalService: CentralizedApprovalService, options: { requireHumanActor: boolean; fallbackEventType: string; message: string }): { status: number; body: JsonBody } {
  const context = approvalBoundaryContext(body);
  if (context.error) return context.error;
  const input = context.input!;
  const actor = stringValue(input.actorId) ?? stringValue(input.actor);
  if (!actor) return badRequest('Approval boundary context missing: actorId');
  const actorType = actorTypeFrom(input);
  if (options.requireHumanActor && actorType !== 'human') return forbidden('Controlled action requests require an authenticated human actor; AI agents and services may create drafts only.');
  const action = stringValue(input.action)!;
  const normalizedAction = action === 'execute-gate-move' ? 'starting-gate-move' : action;
  const isProtected = protectedActions.includes(normalizedAction as (typeof protectedActions)[number]) || normalizedAction in controlledActionPermissions;
  if (!isProtected) return badRequest(`Unsupported controlled action: ${action}`);
  const roles = actorRoles(input);
  if (roles.length === 0) return forbidden('Controlled action requests require actor roles for RBAC enforcement.');
  const requiredPermissions = controlledActionPermissions[normalizedAction] ?? ['incident:manage'];
  if (!roles.some((role) => requiredPermissions.some((permission) => hasPermission(role, permission)))) {
    return forbidden(`Actor lacks required role permission for ${normalizedAction}`);
  }
  let request;
  try {
    request = approvalService.createRequest({
      tenantId: stringValue(input.tenantId)!,
      racetrackId: stringValue(input.racetrackId)!,
      action: normalizedAction as ControlledAction,
      target: stringValue(input.target)!,
      requestedBy: actor,
      actorType,
      reason: stringValue(input.reason)!,
      evidence: stringArray(input.evidence),
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Approval request could not be created');
  }
  return {
    status: 202,
    body: {
      accepted: true,
      approvalId: request.id,
      eventType: options.fallbackEventType,
      audited: true,
      tenantId: request.tenantId,
      racetrackId: request.racetrackId,
      action: request.action,
      target: request.target,
      status: request.status,
      expiresAt: request.expiresAt,
      message: options.message,
      mock: false,
    },
  };
}

function isApprovalToken(value: unknown): value is ApprovalToken {
  return isRecord(value)
    && Boolean(stringValue(value.requestId))
    && Boolean(stringValue(value.action))
    && Boolean(stringValue(value.target))
    && Boolean(stringValue(value.tenantId))
    && Boolean(stringValue(value.racetrackId))
    && Boolean(stringValue(value.issuedAt))
    && Boolean(stringValue(value.expiresAt))
    && Array.isArray(value.approvedBy);
}

function approvalFailure(message: string): { status: number; body: JsonBody } {
  return { status: 403, body: { accepted: false, blockedReason: message } };
}

function verifiedCqrsCommandBody<T extends Record<string, unknown>>(body: unknown, approvalService: CentralizedApprovalService, action: ControlledAction, target: string, requiredFields: string[]): { input?: T; error?: { status: number; body: JsonBody } } {
  if (!isRecord(body)) return { error: badRequest('JSON object body is required') };
  const missing = ['tenantId', 'racetrackId', ...requiredFields].filter((field) => !stringValue(body[field]));
  if (missing.length > 0) return { error: badRequest(`Safety-critical command missing: ${missing.join(', ')}`) };
  if (!isApprovalToken(body.approvalToken)) return { error: approvalFailure('Safety-critical command requires verified approvalToken') };
  try {
    approvalService.assertAuthorized(body.approvalToken, action, target, stringValue(body.tenantId)!, stringValue(body.racetrackId)!);
  } catch (error) {
    return { error: approvalFailure(error instanceof Error ? error.message : 'Approval token verification failed') };
  }
  const approverId = body.approvalToken.issuedTo ?? body.approvalToken.approvedBy[body.approvalToken.approvedBy.length - 1] ?? 'approved-human';
  return {
    input: {
      ...body,
      approval_id: body.approvalToken.requestId,
      approver_id: approverId,
      approval_timestamp: body.approvalToken.issuedAt,
      evidence_links: unique([...stringArray(body.evidence_links), `approval://${body.approvalToken.requestId}`]),
    } as unknown as T,
  };
}

function racingDataRawPayloadReviews(racingData: RacingDataApiFacadeState): JsonBody[] {
  return racingData.rawPayloads.map((payload) => ({
    payload: {
      ...payload,
      originalPayloadHash: payload.evidenceRefs[0] ?? payload.payloadId,
      sourceFormat: payload.contentType.includes('json') ? 'json' : payload.contentType,
      licenseContext: { ...payload.license, licenseId: payload.license.termsRef },
    },
    originalPayloadHash: payload.evidenceRefs[0] ?? payload.payloadId,
    sourceFormat: payload.contentType.includes('json') ? 'json' : payload.contentType,
    licenseContext: { ...payload.license, licenseId: payload.license.termsRef },
    review: {
      status: payload.piiPresent ? 'pending-review' : 'approved-for-normalization',
      reasons: payload.piiPresent ? ['PII review required before normalization'] : ['Payload retained with license context and source lineage'],
      piiReviewRequired: payload.piiPresent,
      licenseReviewRequired: !['active', 'evaluation'].includes(payload.license.licenseStatus),
      safetyCriticalMutationAllowed: false,
    },
    mock: false,
  }));
}

function racingDataLineageReport(racingData: RacingDataApiFacadeState, generatedAt = now()): JsonBody {
  const edges = racingData.lineage.flatMap((record) => [
    ...record.upstreamRefs.map((from) => ({ from, to: record.artifactId, relationship: record.artifactType === 'raw-payload' ? 'ingested' : 'normalized' })),
    ...record.downstreamRefs.map((to) => ({ from: record.artifactId, to, relationship: record.artifactType === 'canonical-envelope' ? 'registered' : 'exported' })),
  ]);
  return {
    generatedAt,
    nodes: racingData.lineage.map((record) => ({ id: record.artifactId, kind: record.artifactType === 'canonical-envelope' ? 'canonical-envelope' : record.artifactType, label: record.artifactId })),
    edges,
    paths: racingData.lineage.map((record) => ({
      lineageId: record.artifactId,
      rawPayloadRef: record.upstreamRefs[0] ?? record.artifactId,
      normalizedArtifactRef: record.artifactId,
      registryRef: record.providerId,
      twinRefs: [],
      eventRefs: record.eventRefs,
      auditRefs: record.auditRefs,
      featureRefs: [],
      exportRefs: record.downstreamRefs,
      evidenceRefs: record.evidenceRefs,
    })),
    auditRefs: unique(racingData.lineage.flatMap((record) => record.auditRefs)),
    eventRefs: unique(racingData.lineage.flatMap((record) => record.eventRefs)),
    evidenceRefs: unique(racingData.lineage.flatMap((record) => record.evidenceRefs)),
    mock: false,
  };
}

function racingDataLicensePolicies(racingData: RacingDataApiFacadeState): JsonBody[] {
  return racingData.providers.map((provider) => ({
    policyId: `policy-${provider.providerId}`,
    providerId: provider.providerId,
    status: provider.license.licenseStatus,
    dataClasses: provider.dataClasses,
    usageScope: provider.usageScope,
    commercialUseAllowed: provider.license.commercialUseAllowed,
    redistributionAllowed: provider.license.redistributionAllowed,
    attributionRequired: provider.license.attributionRequired,
    retention: provider.license.retention,
    evidenceRefs: provider.license.evidenceRefs,
    mock: false,
  }));
}

function racingDataQualityReports(racingData: RacingDataApiFacadeState): JsonBody[] {
  return racingData.dataQualityReports.map((report) => {
    const provider = findRacingDataProvider(racingData, report.providerId);
    const score = report.score <= 1 ? Math.round(report.score * 100) : Math.round(report.score);
    const severity = report.status === 'blocked' ? 'error' : report.status === 'watch' || score < 90 ? 'warning' : 'info';
    const licenseRestricted = report.licenseStatus !== 'active' || report.checks.some((check) => /license|scraping|redistribution/i.test(check.checkId) && !check.passed);
    return {
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      providerId: report.providerId,
      targetRef: report.lineageRefs[0] ?? report.reportId,
      dataClass: provider?.dataClasses[0] ?? 'race-card',
      score,
      severity,
      checks: report.checks.map((check) => ({
        ruleId: check.checkId,
        label: check.label,
        status: check.passed ? 'passed' : check.severity === 'error' ? 'failed' : 'warning',
        score: check.passed ? 100 : check.severity === 'error' ? 40 : 70,
        severity: check.severity,
        passed: check.passed,
        message: check.passed ? `${check.label} passed.` : `${check.label} requires review.`,
        evidenceRefs: check.evidenceRefs,
        licenseImpact: /license|scraping|redistribution/i.test(check.checkId) ? 'License impact: provider terms, attribution, and redistribution controls remain enforced.' : 'No additional license restriction.',
        dataQualityImpact: check.passed ? 'Data quality impact: check passed for the current canonical view.' : 'Data quality impact: downstream promotion remains review-only until the check passes.',
      })),
      licenseImpactSummary: licenseRestricted ? 'License impact: provider terms, attribution, scraping, and redistribution controls remain enforced.' : 'License impact: no additional restriction beyond the active provider policy.',
      dataQualityImpactSummary: report.status === 'pass' ? 'Data quality impact: canonical data is ready for governed read-only use.' : 'Data quality impact: review is required before export promotion.',
      reviewRequired: report.status !== 'pass' || score < 90 || licenseRestricted,
      lineage: provider?.lineage ?? { sourceSystem: report.providerId, sourceRefs: report.lineageRefs, correlationId: `corr:${report.reportId}`, causationIds: [] },
      mock: false,
    };
  });
}

function racingDataPolicyCenter(racingData: RacingDataApiFacadeState): JsonBody[] {
  return racingData.providers.map((provider) => {
    const modelTrainingAllowed = provider.license.usageScope.includes('ai-training') && provider.license.licenseStatus === 'active';
    const blockedExportReasons = [
      ...(!provider.license.redistributionAllowed ? ['Public redistribution blocked: redistributionAllowed=false for provider license.'] : []),
      ...(!provider.license.commercialUseAllowed ? ['Commercial use blocked: commercialUseAllowed=false.'] : []),
      ...(!modelTrainingAllowed ? ['Blocked unlicensed model training: license omits active ai-training scope.'] : []),
      ...(provider.license.licenseStatus !== 'active' ? [`License ${provider.license.licenseStatus} requires review before export.`] : []),
    ];
    return {
      policyId: `policy-${provider.providerId}-usage`,
      providerId: provider.providerId,
      licenseStatus: provider.license.licenseStatus,
      dataClasses: provider.dataClasses,
      allowedUses: provider.usageScope,
      restrictedUses: blockedExportReasons.length ? ['public redistribution', 'raw provider replay', 'external customer API resale', 'unapproved commercial products'] : [],
      attribution: { required: provider.license.attributionRequired, text: provider.license.attributionText },
      retentionDays: provider.license.retention.retentionDays,
      exportAllowed: provider.license.licenseStatus === 'active',
      redistributionAllowed: provider.license.redistributionAllowed,
      commercialUseAllowed: provider.license.commercialUseAllowed,
      privacyClassification: provider.license.licenseStatus === 'active' ? 'confidential' : 'restricted',
      modelTraining: {
        allowed: modelTrainingAllowed,
        restrictions: modelTrainingAllowed ? ['Training requires lineage, attribution, retention, and approval evidence.'] : ['Unlicensed model training blocked until an active license includes ai-training scope.'],
        unlicensedBlocked: !modelTrainingAllowed,
      },
      blockedExportReasons,
      evidenceRefs: provider.license.evidenceRefs,
      mock: false,
    };
  });
}

function racingDataExportManifests(racingData: RacingDataApiFacadeState, generatedAt: string): { featureStoreExports: JsonBody[]; dataLakeExports: JsonBody[] } {
  const featureStoreExports = racingData.providers.map((provider) => {
    const modelTrainingAllowed = provider.license.licenseStatus === 'active' && provider.license.usageScope.includes('ai-training');
    const blockedReasons = [
      ...(!modelTrainingAllowed ? ['Blocked unlicensed model training: license omits active ai-training scope.'] : ['Draft-only until backend export approval returns backendAllowed=true.']),
      ...(!provider.license.redistributionAllowed ? ['Public redistribution blocked: redistributionAllowed=false for provider license.'] : []),
    ];
    return {
      manifestId: `manifest-feature-store-${provider.providerId}`,
      surface: 'feature-store',
      title: `${provider.displayName} governed feature export draft`,
      providerId: provider.providerId,
      dataClasses: provider.dataClasses,
      destination: `feature-store://${provider.tenant.racetrackId}/${provider.providerId}/draft`,
      format: 'parquet',
      requestedAt: generatedAt,
      generatedAt,
      retentionDays: provider.license.retention.retentionDays,
      privacyClassification: provider.license.licenseStatus === 'active' ? 'confidential' : 'restricted',
      licenseStatus: provider.license.licenseStatus,
      exportAllowed: modelTrainingAllowed,
      backendAllowed: false,
      redistributionAllowed: provider.license.redistributionAllowed,
      commercialUseAllowed: provider.license.commercialUseAllowed,
      modelTrainingAllowed,
      attributionRequired: provider.license.attributionRequired,
      draftOnly: true,
      blockedReasons,
      objectRefs: racingData.canonical.entries.map((entry) => `feature://${String(entry.payload.id ?? entry.envelopeId)}`),
      rowCount: racingData.canonical.entries.length,
      schemaRef: 'schema://racing-data/features/v1',
      checksum: `sha256:${provider.providerId}-feature-store-draft`,
      auditRefs: provider.auditRefs,
      evidenceRefs: provider.evidenceRefs,
    };
  });
  const dataLakeExports = racingData.providers.map((provider) => {
    const exportAllowed = provider.license.licenseStatus === 'active' && provider.license.redistributionAllowed && provider.license.commercialUseAllowed;
    const blockedReasons = [
      ...(!provider.license.redistributionAllowed ? ['Public redistribution blocked: redistributionAllowed=false for provider license.'] : []),
      ...(!provider.license.commercialUseAllowed ? ['Commercial use blocked: commercialUseAllowed=false.'] : []),
      ...(!exportAllowed ? ['Data lake export remains draft-only until license approval returns backendAllowed=true.'] : []),
    ];
    return {
      manifestId: `manifest-data-lake-${provider.providerId}`,
      surface: 'data-lake',
      title: `${provider.displayName} governed data lake export draft`,
      providerId: provider.providerId,
      dataClasses: provider.dataClasses,
      destination: `lakehouse://${provider.tenant.racetrackId}/${provider.providerId}/draft`,
      format: 'delta',
      requestedAt: generatedAt,
      generatedAt,
      retentionDays: provider.license.retention.retentionDays,
      privacyClassification: provider.license.licenseStatus === 'active' ? 'confidential' : 'restricted',
      licenseStatus: provider.license.licenseStatus,
      exportAllowed,
      backendAllowed: false,
      redistributionAllowed: provider.license.redistributionAllowed,
      commercialUseAllowed: provider.license.commercialUseAllowed,
      modelTrainingAllowed: false,
      attributionRequired: provider.license.attributionRequired,
      draftOnly: true,
      blockedReasons,
      objectRefs: racingData.canonical.results.map((result) => `lake://${String(result.payload.raceId ?? result.envelopeId)}`),
      rowCount: racingData.canonical.results.length,
      schemaRef: 'schema://racing-data/data-lake/v1',
      checksum: `sha256:${provider.providerId}-data-lake-draft`,
      auditRefs: provider.auditRefs,
      evidenceRefs: provider.evidenceRefs,
    };
  });
  return { featureStoreExports, dataLakeExports };
}

function racingDataExportControls(featureStoreExports: JsonBody[], dataLakeExports: JsonBody[]): JsonBody[] {
  return [...featureStoreExports, ...dataLakeExports].filter(isRecord).map((manifest) => ({
    id: `control-${String(manifest.manifestId)}`,
    label: manifest.backendAllowed === true && manifest.draftOnly !== true ? `Export ${String(manifest.title)}` : `Draft ${String(manifest.title)}`,
    surface: manifest.surface,
    manifestId: manifest.manifestId,
    backendAllowed: manifest.backendAllowed,
    draftOnly: manifest.draftOnly,
    disabledReason: Array.isArray(manifest.blockedReasons) ? manifest.blockedReasons.join(' ') : 'Export remains disabled until backend approval returns backendAllowed=true.',
    approvalApi: manifest.surface === 'feature-store' ? 'POST /api/v1/racing-data/exports/feature-store' : 'POST /api/v1/racing-data/exports/data-lake',
  }));
}

function racingDataReviewActions(): JsonBody[] {
  return [
    { id: 'review-racing-data-entity-resolution', label: 'Draft entity resolution review', target: 'racing-data:entity-resolution', decision: 'draft', draftOnly: true, approvalRequired: true, approvalApi: 'POST /api/v1/approvals/draft-requests', disabledReason: 'Creates a resolution draft only; canonical racing data is not mutated locally.' },
    { id: 'review-racing-data-quality', label: 'Request quality exception approval', target: 'racing-data:data-quality', decision: 'approval', draftOnly: true, approvalRequired: true, approvalApi: 'POST /api/v1/approvals/controlled-actions', disabledReason: 'Quality exception approval is backend-owned and cannot mark official records valid in the frontend.' },
    { id: 'review-racing-data-export', label: 'Draft export approval', target: 'racing-data:exports', decision: 'draft', draftOnly: true, approvalRequired: true, approvalApi: 'POST /api/v1/approvals/draft-requests', disabledReason: 'Exports remain draft-only until license, quality, and backend approval evidence is recorded.' },
  ];
}

function racingDataConnectors(racingData: RacingDataApiFacadeState): JsonBody[] {
  const schemaVersion = racingData.metadata.schemaVersion;
  return [{
    schemaVersion,
    connectorId: 'provider-agnostic-racing-data-facade',
    title: 'Provider-agnostic Racing Data facade connector',
    description: 'Read-only facade metadata for licensed Racing Data API Hub sources.',
    providerAgnostic: true,
    hardCodedProviderBehaviorAllowed: false,
    supportedConnectionTypes: unique(racingData.providers.map((provider) => provider.connectionType)),
    supportedSyncModes: unique(racingData.providers.map((provider) => provider.syncMode)),
    supportedDataClasses: unique(racingData.providers.flatMap((provider) => provider.dataClasses)),
    credentialRequirements: [{ name: 'providerCredentialRef', required: true, secret: true }],
    healthCheck: { supported: true, interval: 'PT5M', auditAction: 'racing-data.provider-status.read' },
    emits: ['racing-data.provider.checked'],
    audits: ['racing-data.connector.read', 'racing-data.provider-status.read'],
    evidenceRefs: ['contract:racing-data-api-hub'],
  }];
}

function racingDataNormalizationMappings(racingData: RacingDataApiFacadeState): JsonBody[] {
  const provider = racingData.providers[0];
  if (!provider) return [];
  const schemaVersion = racingData.metadata.schemaVersion;
  return [{
    schemaVersion,
    mappingId: `mapping-${provider.providerId}-facade`,
    providerId: provider.providerId,
    tenant: provider.tenant,
    status: 'active',
    sourceSchemaRef: provider.endpointRefs[0] ?? `provider:${provider.providerId}`,
    targetSchemaVersion: schemaVersion,
    dataClass: provider.dataClasses[0] ?? 'race-card',
    fieldMappings: [{ sourcePath: 'providerPayload', targetPath: 'canonicalEnvelope.payload', required: true }],
    qualityRules: [{ ruleId: 'source-lineage-required', path: 'lineage.sourceRefs', severity: 'warning', description: 'Provider lineage must be retained for every normalized envelope.' }],
    piiPaths: [],
    license: provider.license,
    lineage: provider.lineage,
    evidenceRefs: provider.evidenceRefs,
    auditRefs: provider.auditRefs,
    eventRefs: provider.eventRefs,
  }];
}

function racingDataEntityResolution(racingData: RacingDataApiFacadeState, generatedAt = now()): JsonBody {
  const horse = racingData.canonical.horses[0];
  return {
    generatedAt,
    clusters: horse ? [{
      resolutionId: `resolution-${String(horse.payload.horseId ?? horse.envelopeId)}`,
      entityType: 'horse',
      canonicalId: String(horse.payload.horseId ?? horse.envelopeId),
      candidateExternalIds: horse.sourcePayloadRefs,
      sourceRefs: horse.sourcePayloadRefs,
      confidence: 0.98,
      matchConfidence: 0.98,
      decision: 'approved',
      reviewRequired: false,
      status: 'auto-linked',
      evidence: horse.evidenceRefs,
      evidenceRefs: horse.evidenceRefs,
    }] : [],
    approvalRequiredForMerges: true,
    directMutationAllowed: false,
    mock: false,
  };
}

function racingDataDigitalTwinSyncDescriptor(racingData: RacingDataApiFacadeState, generatedAt = now()): JsonBody {
  const envelopes = [...racingData.canonical.raceCards, ...racingData.canonical.races, ...racingData.canonical.horses, ...racingData.canonical.entries, ...racingData.canonical.results];
  const targetTwinRefs = unique([
    ...envelopes.flatMap((envelope) => envelope.lineage.sourceRefs.filter((ref) => ref.startsWith('twin:'))),
    ...envelopes.flatMap((envelope) => {
      const subjectId = envelope.payload.raceId ?? envelope.payload.id ?? envelope.payload.horseId;
      return typeof subjectId === 'string' && subjectId.length > 0 ? [`twin:${envelope.canonicalDataClass}:${subjectId}`] : [];
    }),
  ]);
  return {
    descriptorId: 'racing-data-digital-twin-sync-facade',
    generatedAt,
    targetTwinRefs,
    sourceEnvelopeIds: envelopes.map((envelope) => envelope.envelopeId),
    syncMode: 'approval-required',
    draftApprovalApi: '/api/v1/racing-data/digital-twin/sync-draft-requests',
    directMutationAllowed: false,
    safetyCriticalStateMutationAllowed: false,
    lineage: racingData.lineage[0]?.lineage ?? envelopes[0]?.lineage,
    mock: false,
  };
}

function racingDataWorkspace(racingData: RacingDataApiFacadeState): JsonBody {
  const generatedAt = now();
  const entityResolution = racingDataEntityResolution(racingData, generatedAt);
  const canonicalEnvelopes = [...racingData.canonical.raceCards, ...racingData.canonical.races, ...racingData.canonical.horses, ...racingData.canonical.entries, ...racingData.canonical.results];
  const { featureStoreExports, dataLakeExports } = racingDataExportManifests(racingData, generatedAt);
  return {
    generatedAt,
    metadata: racingData.metadata,
    providers: racingData.providers,
    statuses: racingData.statuses,
    connectors: racingDataConnectors(racingData),
    normalizationMappings: racingDataNormalizationMappings(racingData),
    ingestionJobs: racingData.ingestionJobs,
    rawPayloadReviews: racingDataRawPayloadReviews(racingData),
    canonical: { ...racingData.canonical, envelopes: canonicalEnvelopes },
    entityResolution,
    entityResolutionQueue: isRecord(entityResolution) && Array.isArray(entityResolution.clusters) ? entityResolution.clusters : [],
    qualityReports: racingDataQualityReports(racingData),
    lineage: racingDataLineageReport(racingData, generatedAt),
    licensePolicies: racingDataLicensePolicies(racingData),
    digitalTwinSync: racingDataDigitalTwinSyncDescriptor(racingData, generatedAt),
    policyCenter: racingDataPolicyCenter(racingData),
    featureStoreExports,
    dataLakeExports,
    exportControls: racingDataExportControls(featureStoreExports, dataLakeExports),
    reviewActions: racingDataReviewActions(),
    governance: racingData.governance,
    mock: false,
  };
}

function findRacingDataRawPayloadReview(racingData: RacingDataApiFacadeState, payloadId: string): JsonBody | undefined {
  return racingDataRawPayloadReviews(racingData).find((review) => isRecord(review) && isRecord(review.payload) && review.payload.payloadId === payloadId);
}

export async function handleApiRequest(method: HttpMethod, pathname: string, body?: unknown, state = createApiFacadeState(), headers?: IncomingMessage['headers']): Promise<{ status: number; headers?: Record<string, string>; body: JsonBody }> {
  if (method === 'OPTIONS') return { status: 204, body: null };
  const requestUrl = new URL(pathname, 'http://localhost');
  const path = requestUrl.pathname.startsWith(nexusApiBasePath) ? requestUrl.pathname.slice(nexusApiBasePath.length) || '/' : requestUrl.pathname;
  const requestId = requestUrl.searchParams.get('requestId') ?? createRequestId();
  if (method === 'GET' && path === '/health') return { status: 200, headers: { 'x-trackmind-request-id': requestId }, body: { ok: true, service: 'trackmind-api', status: 'healthy', time: now(), requestId, observability: { structuredLogs: true, requestIdHeader: 'x-trackmind-request-id', serviceHealthEndpoint: `${nexusApiBasePath}/platform/health`, eventStreamEndpoint: `${nexusApiBasePath}/events/stream` } } };
  if (method === 'GET' && path === '/approvals/requests') return { status: 200, body: state.approvals };
  const apexResponse = await state.apex.handle(method, path, body);
  if (apexResponse) return apexResponse;
  const raceStartMatch = path.match(/^\/races\/([^/]+)\/start$/);
  if (method === 'POST' && raceStartMatch) {
    const raceId = decodeURIComponent(raceStartMatch[1]);
    const verified = verifiedCqrsCommandBody<RaceStartCommandBody & Record<string, unknown>>(body, state.approvalService, 'race-start', raceId, ['starterId']);
    if (verified.error) return verified.error;
    const input = verified.input!;
    const result = await state.cqrs.startRace(raceId, input, { tenantId: stringValue(input.tenantId), racetrackId: stringValue(input.racetrackId), actorId: stringValue(input.actorId) ?? stringValue(input.starterId) });
    return { status: result.accepted ? 202 : 403, body: result };
  }
  const raceStopMatch = path.match(/^\/races\/([^/]+)\/stop$/);
  if (method === 'POST' && raceStopMatch) {
    const raceId = decodeURIComponent(raceStopMatch[1]);
    const verified = verifiedCqrsCommandBody<SafetyCriticalCommandBody & Record<string, unknown>>(body, state.approvalService, 'race-stop', raceId, ['actorId', 'reason']);
    if (verified.error) return verified.error;
    const input = verified.input!;
    const result = await state.cqrs.stopRace(raceId, input, { tenantId: stringValue(input.tenantId), racetrackId: stringValue(input.racetrackId), actorId: stringValue(input.actorId) });
    return { status: result.accepted ? 202 : 403, body: result };
  }
  const raceScratchMatch = path.match(/^\/races\/([^/]+)\/scratches$/);
  if (method === 'POST' && raceScratchMatch) {
    const raceId = decodeURIComponent(raceScratchMatch[1]);
    const inputBody = isRecord(body) ? body : {};
    const horseId = stringValue(inputBody.horseId);
    const verified = verifiedCqrsCommandBody<SafetyCriticalCommandBody & Record<string, unknown>>(body, state.approvalService, 'scratch-horse', horseId ?? raceId, ['actorId', 'horseId', 'reason']);
    if (verified.error) return verified.error;
    const input = verified.input!;
    const result = await state.cqrs.scratchHorse(raceId, input, { tenantId: stringValue(input.tenantId), racetrackId: stringValue(input.racetrackId), actorId: stringValue(input.actorId) });
    return { status: result.accepted ? 202 : 403, body: result };
  }
  const horseMedicationMatch = path.match(/^\/horses\/([^/]+)\/medications\/administer$/);
  if (method === 'POST' && horseMedicationMatch) {
    const horseId = decodeURIComponent(horseMedicationMatch[1]);
    const verified = verifiedCqrsCommandBody<SafetyCriticalCommandBody & Record<string, unknown>>(body, state.approvalService, 'medication-decision', horseId, ['actorId', 'medication', 'dose', 'reason']);
    if (verified.error) return verified.error;
    const input = verified.input!;
    const result = await state.cqrs.administerMedication(horseId, input, { tenantId: stringValue(input.tenantId), racetrackId: stringValue(input.racetrackId), actorId: stringValue(input.actorId) });
    return { status: result.accepted ? 202 : 403, body: result };
  }
  if (method === 'GET' && path === '/events/cqrs') return { status: 200, body: state.cqrs.events() };
  if (method === 'GET' && path === '/events/cqrs/projections') return { status: 200, body: state.cqrs.rebuildProjections() };
  if (method === 'GET' && path === '/events/cqrs/hash-chain') return { status: 200, body: state.cqrs.verifyHashChain() };
  const rtkTelemetryResponse = await state.rtkTelemetry.handle(method, path, body, requestUrl.searchParams);
  if (rtkTelemetryResponse) return rtkTelemetryResponse;
  const safetyIntelligenceResponse = await state.safetyIntelligence.handle(method, path, body);
  if (safetyIntelligenceResponse) return safetyIntelligenceResponse;
  const complianceResponse = state.complianceReporting.handle(method, path);
  if (complianceResponse) return complianceResponse;
  const equinePrivacyResponse = state.equinePrivacy.handle(method, path, body, requestUrl.searchParams);
  if (equinePrivacyResponse) return equinePrivacyResponse;
  if (method === 'GET' && path === '/workflows/templates') return { status: 200, body: state.workflowTemplates };
  if (method === 'GET' && path === '/audit/events') return { status: 200, body: state.auditEvents };
  if (method === 'GET' && path === '/audit/verification') return { status: 200, body: (state.auditLedger as any).verification };
  if (method === 'GET' && path === '/audit/evidence-path') return { status: 200, body: (state.auditLedger as any).evidencePath };
  if (method === 'GET' && path === '/audit/forensic-reconstruction') return { status: 200, body: (state.auditLedger as any).forensicReconstruction };
  if (method === 'GET' && path === '/audit/compliance-export') return { status: 200, body: (state.auditLedger as any).complianceExport };
  if (method === 'GET' && path === '/audit/legal-holds') return { status: 200, body: (state.auditLedger as any).legalHolds };
  if (method === 'GET' && path === '/track-configuration/map') return { status: 200, body: state.trackMap };
  if (method === 'GET' && path === '/track-surface/measurements') return { status: 200, body: createCommandCenterContractSnapshot().surfaceMeasurements };
  if (method === 'GET' && path === '/operations/command-center') return { status: 200, body: state.operations };
  if (method === 'GET' && path === '/races') return { status: 200, body: (state.readiness as any).races ?? [] };
  if (method === 'GET' && path === '/race-day-readiness/dashboard') return { status: 200, body: state.readiness };
  if (method === 'GET' && path === '/assets/search') return { status: 200, body: state.assetRegistry };
  if (method === 'GET' && path === '/assets/standard') return { status: 200, body: (state.tusStandardization as any).assets };
  if (method === 'GET' && path === '/assets') return { status: 200, body: (state.trackMap as any).assets };
  if (method === 'GET' && path === '/track-sectors') return { status: 200, body: (state.trackMap as any).sectors };
  if (method === 'GET' && path === '/starting-gate/position') return { status: 200, body: createCommandCenterContractSnapshot().gatePosition };
  if (method === 'GET' && path === '/race-distance/configuration') return { status: 200, body: createCommandCenterContractSnapshot().raceDistanceConfiguration };
  if (method === 'GET' && path === '/digital-twin/state') return { status: 200, body: createCommandCenterContractSnapshot().digitalTwinState };
  if (method === 'GET' && path === '/digital-twin/standard') return { status: 200, body: (state.tusStandardization as any).twins };
  if (method === 'GET' && path === '/tus/standardization') return { status: 200, body: state.tusStandardization };
  if (method === 'GET' && path === '/tus/data-model') return { status: 200, body: state.unifiedDataModel };
  if (method === 'GET' && path === '/race-operations/race-office') return { status: 200, body: state.raceOffice };
  if (method === 'GET' && path === '/surface-intelligence/workspace') return { status: 200, body: state.surface };
  const equineIntelligenceMatch = path.match(/^\/equine-intelligence\/horses\/([^/]+)$/);
  if (method === 'GET' && equineIntelligenceMatch) {
    const horseId = decodeURIComponent(equineIntelligenceMatch[1]);
    return horseId === (state.equine as any).horse?.horseId ? { status: 200, body: state.equine } : apiNotFound(`No equine intelligence profile for ${horseId}`, path, requestId);
  }
  if (method === 'GET' && path === '/barn-operations/workspace') return { status: 200, body: state.barn };
  if (method === 'GET' && path === '/facilities-maintenance/workspace') return { status: 200, body: state.facilitiesMaintenance };
  if (method === 'GET' && path === '/stewarding/inquiries') return { status: 200, body: state.steward };
  if (method === 'GET' && path === '/security-operations/workspace') return { status: 200, body: state.security };
  if (method === 'GET' && path === '/emergency-operations/workspace') return { status: 200, body: state.emergency };
  if (method === 'GET' && path === '/workforce-operations/workspace') return { status: 200, body: state.workforce };
  if (method === 'GET' && path === '/compliance/control-library') return { status: 200, body: state.compliance };
  if (method === 'GET' && path === '/federation/workspace') return { status: 200, body: state.federation };
  const kpiScopeError = path.startsWith('/kpis') || path.startsWith('/artifacts/kpis') ? kpiScopeMismatch(requestUrl.searchParams, headers) : undefined;
  if (kpiScopeError) return { status: 403, body: apiErrorBody({ code: 'forbidden', message: kpiScopeError, path, requestId }) };
  if (method === 'GET' && (path === '/kpis' || path === '/artifacts/kpis')) return { status: 200, body: filterKPIWorkspace(state.kpis as ReturnType<typeof createKPIWorkspace>, kpiPrincipal(requestUrl.searchParams, headers)) };
  if (method === 'GET' && (path === '/kpis/model-context' || path === '/artifacts/kpis/model-context')) return { status: 200, body: filterKPIWorkspace(state.kpis as ReturnType<typeof createKPIWorkspace>, kpiPrincipal(requestUrl.searchParams, headers)).modelReadableContext };
  const kpiSnapshotMatch = path.match(/^\/(?:artifacts\/)?kpis\/([^/]+)\/snapshots$/);
  if (method === 'GET' && kpiSnapshotMatch) {
    const workspace = filterKPIWorkspace(state.kpis as ReturnType<typeof createKPIWorkspace>, kpiPrincipal(requestUrl.searchParams, headers));
    const kpiId = decodeURIComponent(kpiSnapshotMatch[1]);
    const kpi = workspace.kpis.find((item) => item.kpiId === kpiId);
    return kpi ? { status: 200, body: kpi.historicalSnapshots } : apiNotFound(`No KPI artifact for ${kpiId}`, path, requestId);
  }
  const kpiDetailMatch = path.match(/^\/(?:artifacts\/)?kpis\/([^/]+)$/);
  if (method === 'GET' && kpiDetailMatch) {
    const workspace = filterKPIWorkspace(state.kpis as ReturnType<typeof createKPIWorkspace>, kpiPrincipal(requestUrl.searchParams, headers));
    const kpiId = decodeURIComponent(kpiDetailMatch[1]);
    const kpi = workspace.kpis.find((item) => item.kpiId === kpiId);
    return kpi ? { status: 200, body: kpi } : apiNotFound(`No KPI artifact for ${kpiId}`, path, requestId);
  }
  if (method === 'GET' && path === '/racing-data') return { status: 200, body: racingDataWorkspace(state.racingData) };
  if (method === 'GET' && path === '/racing-data/providers') return { status: 200, body: state.racingData.providers };
  if (method === 'GET' && path === '/racing-data/providers/statuses') return { status: 200, body: state.racingData.statuses };
  if (method === 'GET' && path.startsWith('/racing-data/providers/') && path.endsWith('/status')) {
    const providerId = decodeURIComponent(path.slice('/racing-data/providers/'.length, -'/status'.length));
    const status = findRacingDataStatus(state.racingData, providerId);
    return status ? { status: 200, body: status } : apiNotFound(`No racing data provider status for ${providerId}`, path, requestId);
  }
  if (method === 'GET' && path.startsWith('/racing-data/providers/')) {
    const providerId = decodeURIComponent(path.slice('/racing-data/providers/'.length));
    const provider = findRacingDataProvider(state.racingData, providerId);
    return provider ? { status: 200, body: provider } : apiNotFound(`No racing data provider for ${providerId}`, path, requestId);
  }
  if (method === 'GET' && path === '/racing-data/connectors') return { status: 200, body: racingDataConnectors(state.racingData) };
  if (method === 'GET' && path === '/racing-data/normalization-mappings') return { status: 200, body: racingDataNormalizationMappings(state.racingData) };
  if (method === 'GET' && path === '/racing-data/ingestion-jobs') return { status: 200, body: state.racingData.ingestionJobs };
  if (method === 'GET' && path.startsWith('/racing-data/ingestion-jobs/')) {
    const jobId = decodeURIComponent(path.slice('/racing-data/ingestion-jobs/'.length));
    const job = state.racingData.ingestionJobs.find((item) => item.jobId === jobId);
    return job ? { status: 200, body: job } : apiNotFound(`No racing data ingestion job for ${jobId}`, path, requestId);
  }
  if (method === 'GET' && path.startsWith('/racing-data/ingest/jobs/')) {
    const jobId = decodeURIComponent(path.slice('/racing-data/ingest/jobs/'.length));
    const job = state.racingData.ingestionJobs.find((item) => item.jobId === jobId);
    return job ? { status: 200, body: job } : apiNotFound(`No racing data ingestion job for ${jobId}`, path, requestId);
  }
  if (method === 'GET' && path === '/racing-data/raw-payloads/review') return { status: 200, body: racingDataRawPayloadReviews(state.racingData) };
  if (method === 'GET' && path.startsWith('/racing-data/raw-payloads/review/')) {
    const payloadId = decodeURIComponent(path.slice('/racing-data/raw-payloads/review/'.length));
    const review = findRacingDataRawPayloadReview(state.racingData, payloadId);
    return review ? { status: 200, body: review } : apiNotFound(`No racing data raw payload review for ${payloadId}`, path, requestId);
  }
  if (method === 'GET' && path.startsWith('/racing-data/raw-payloads/')) {
    const payloadId = decodeURIComponent(path.slice('/racing-data/raw-payloads/'.length));
    const payload = state.racingData.rawPayloads.find((item) => item.payloadId === payloadId);
    return payload ? { status: 200, body: payload } : apiNotFound(`No racing data raw payload for ${payloadId}`, path, requestId);
  }
  if (method === 'GET' && path === '/racing-data/canonical/race-cards') return { status: 200, body: state.racingData.canonical.raceCards };
  if (method === 'GET' && path === '/racing-data/canonical/races') return { status: 200, body: state.racingData.canonical.races };
  if (method === 'GET' && path.startsWith('/racing-data/canonical/races/')) {
    const raceId = decodeURIComponent(path.slice('/racing-data/canonical/races/'.length));
    const race = state.racingData.canonical.races.find((item) => item.payload.id === raceId || item.payload.raceId === raceId);
    return race ? { status: 200, body: race } : apiNotFound(`No canonical racing data race for ${raceId}`, path, requestId);
  }
  if (method === 'GET' && path === '/racing-data/canonical/horses') return { status: 200, body: state.racingData.canonical.horses };
  if (method === 'GET' && path.startsWith('/racing-data/canonical/horses/')) {
    const horseId = decodeURIComponent(path.slice('/racing-data/canonical/horses/'.length));
    const horse = state.racingData.canonical.horses.find((item) => item.payload.id === horseId || item.payload.horseId === horseId);
    return horse ? { status: 200, body: horse } : apiNotFound(`No canonical racing data horse for ${horseId}`, path, requestId);
  }
  if (method === 'GET' && path === '/racing-data/canonical/entries') return { status: 200, body: state.racingData.canonical.entries };
  if (method === 'GET' && path === '/racing-data/canonical/results') return { status: 200, body: state.racingData.canonical.results };
  if (method === 'GET' && path === '/racing-data/entity-resolution') return { status: 200, body: racingDataEntityResolution(state.racingData) };
  if (method === 'GET' && path === '/racing-data/quality-reports') return { status: 200, body: state.racingData.dataQualityReports };
  if (method === 'GET' && path === '/racing-data/data-quality/reports') return { status: 200, body: state.racingData.dataQualityReports };
  if (method === 'GET' && path === '/racing-data/lineage') return { status: 200, body: racingDataLineageReport(state.racingData) };
  if (method === 'GET' && path.startsWith('/racing-data/lineage/')) {
    const artifactId = decodeURIComponent(path.slice('/racing-data/lineage/'.length));
    const lineage = state.racingData.lineage.find((item) => item.artifactId === artifactId);
    return lineage ? { status: 200, body: lineage } : apiNotFound(`No racing data lineage for ${artifactId}`, path, requestId);
  }
  if (method === 'GET' && path === '/racing-data/digital-twin/sync-descriptor') return { status: 200, body: racingDataDigitalTwinSyncDescriptor(state.racingData) };
  if (method === 'GET' && (path === '/racing-data/license-policies' || path === '/data-usage-policies')) return { status: 200, body: state.racingDataPolicies };
  if (method === 'GET' && (path === '/racing-data/license-policies/supported-operations' || path === '/data-usage-policies/supported-operations')) return { status: 200, body: (state.racingDataPolicies as any).supportedOperations };
  if (method === 'GET' && path === '/compliance/track-certification-candidate') return { status: 200, body: state.trackCertification };
  if (method === 'GET' && path === '/ai-governance/workspace') return { status: 200, body: state.aiGovernance };
  if (method === 'GET' && path === '/ai/recommendations') return { status: 200, body: createAIRecommendationDtos(state.aiGovernance) };
  if (method === 'GET' && path === '/ai-control-plane/workspace') return { status: 200, body: state.aiControlPlane };
  if (method === 'GET' && path === '/ai-control-plane/policy') return { status: 200, body: (state.aiControlPlane as any).policy };
  if (method === 'GET' && path === '/ai-control-plane/models') return { status: 200, body: (state.aiControlPlane as any).modelRegistry };
  if (method === 'GET' && path === '/ai-control-plane/features') return { status: 200, body: createAIControlPlaneFeatureRecords(state.aiControlPlane, now()) };
  if (method === 'GET' && path === '/ai-control-plane/recommendations') return { status: 200, body: (state.aiControlPlane as any).recommendations };
  if (method === 'GET' && path === '/ai-control-plane/blocked-actions') return { status: 200, body: (state.aiControlPlane as any).blockedActions };
  if (method === 'GET' && path === '/ai-control-plane/events') return { status: 200, body: (state.aiControlPlane as any).events };
  if (method === 'GET' && path === '/intelligence-core/metadata') return { status: 200, body: state.intelligenceCore };
  if (method === 'GET' && path === '/events/catalog') return { status: 200, body: state.eventCatalog };
  if (method === 'GET' && path === '/platform/health') return { status: 200, body: state.platformHealth };
  if (method === 'GET' && path === '/platform/nexus-upgrade') return { status: 200, body: state.nexusUpgrade };
  if (method === 'GET' && path === '/collaboration/threads') {
    const query = collaborationQuery(requestUrl.searchParams);
    try { return { status: 200, body: state.collaboration.queryThreads(query, collaborationPrincipal(query as Record<string, unknown>, 'collaboration:read')) }; }
    catch (error) { return collaborationError(error); }
  }
  if (method === 'GET' && path === '/collaboration/activity') {
    const query = collaborationQuery(requestUrl.searchParams);
    try { return { status: 200, body: state.collaboration.activity(query, collaborationPrincipal(query as Record<string, unknown>, 'collaboration:read')) }; }
    catch (error) { return collaborationError(error); }
  }
  if (method === 'GET' && path === '/artifacts/registry') return { status: 200, body: state.artifacts.registry };
  if (method === 'GET' && path === '/artifacts/schemas') return { status: 200, body: state.artifacts.schemas };
  if (method === 'GET' && path === '/artifacts/training-inputs') return { status: 200, body: state.artifacts.trainingInputs };
  if (method === 'GET' && path === '/artifacts/storage-map') return { status: 200, body: state.artifacts.storageMap };
  if (method === 'GET' && path === '/ros/universal-schema') return { status: 200, body: state.ros.universalSchema };
  if (method === 'GET' && path === '/ros/standardization-framework') return { status: 200, body: state.ros.standardizationFramework };
  if (method === 'GET' && path === '/ros/saas-tiers') return { status: 200, body: state.ros.saasTiers };
  if (method === 'GET' && path === '/ros/certified-track') return { status: 200, body: state.ros.certifiedTrack };
  if (method === 'GET' && path === '/ros/data-model') return { status: 200, body: state.ros.dataModel };
  if (method === 'GET' && path === '/ros/intelligence-core') return { status: 200, body: state.ros.intelligenceCore };
  if (method === 'GET' && path === '/ros/federation') return { status: 200, body: state.ros.federation };
  if (method === 'GET' && path === '/events/stream') return { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'x-trackmind-request-id': requestId }, body: `event: heartbeat\ndata: ${JSON.stringify({ time: now(), service: 'trackmind-api', requestId })}\n\n` };
  if (method === 'POST' && path === '/racing-data/providers') {
    const input = (body ?? {}) as Record<string, any>;
    if (input.license) {
      const licenseDecision = isRacingDataLicenseAllowed(input.license, 'provider registration', ['internal-operations']);
      if (!licenseDecision.allowed) return { status: 403, body: createRacingDataLicenseDenied('provider registration', undefined, licenseDecision.details) };
    }
    return { status: 202, body: createRacingDataDraftResult('provider registration', 'racing-data.provider.registration.draft.created', input.providerId) };
  }
  if (method === 'POST' && path === '/racing-data/ingestion-jobs/draft-requests') {
    const input = (body ?? {}) as Record<string, any>;
    const providerId = input.providerId ?? 'provider-official-feed';
    const provider = findRacingDataProvider(state.racingData, providerId);
    if (!provider) return apiNotFound(`No racing data provider for ${providerId}`, path, requestId);
    const licenseDecision = isRacingDataLicenseAllowed(provider.license, 'ingest', ['race-day-operations']);
    if (!licenseDecision.allowed) return { status: 403, body: createRacingDataLicenseDenied('ingest', provider, licenseDecision.details) };
    return { status: 202, body: createRacingDataDraftResult('ingest', 'racing-data.ingestion-job.draft.created', providerId) };
  }
  if (method === 'POST' && path.startsWith('/racing-data/ingest/')) {
    const providerId = decodeURIComponent(path.slice('/racing-data/ingest/'.length));
    const provider = findRacingDataProvider(state.racingData, providerId);
    if (!provider) return apiNotFound(`No racing data provider for ${providerId}`, path, requestId);
    const licenseDecision = isRacingDataLicenseAllowed(provider.license, 'ingest', ['race-day-operations']);
    if (!licenseDecision.allowed) return { status: 403, body: createRacingDataLicenseDenied('ingest', provider, licenseDecision.details) };
    return { status: 202, body: createRacingDataDraftResult('ingest', 'racing-data.ingest.draft.created', providerId) };
  }
  if (method === 'POST' && path === '/racing-data/entity-resolution/review') return { status: 202, body: createRacingDataDraftResult('entity-resolution review', 'racing-data.entity-resolution.review.draft.created', (body as any)?.providerId) };
  if (method === 'POST' && (path === '/racing-data/feature-store/exports/draft-requests' || path === '/racing-data/data-lake/exports/draft-requests')) {
    const input = (body ?? {}) as Record<string, any>;
    const providerId = input.providerId ?? 'provider-official-feed';
    const provider = findRacingDataProvider(state.racingData, providerId);
    if (!provider) return apiNotFound(`No racing data provider for ${providerId}`, path, requestId);
    const featureStore = path.includes('/feature-store/');
    const operation = featureStore ? 'feature-store export' : 'data-lake export';
    const requiredScopes = featureStore ? ['ai-training' as const] : ['analytics' as const];
    const licenseDecision = isRacingDataLicenseAllowed(provider.license, operation, requiredScopes);
    if (!licenseDecision.allowed) return { status: 403, body: createRacingDataLicenseDenied(operation, provider, licenseDecision.details) };
    return { status: 202, body: createRacingDataDraftResult(operation, featureStore ? 'racing-data.feature-store-export.draft.created' : 'racing-data.data-lake-export.draft.created', providerId) };
  }
  if (method === 'POST' && (path === '/racing-data/exports/feature-store' || path === '/racing-data/exports/data-lake' || path === '/racing-data/sync/digital-twins' || path === '/racing-data/digital-twin/sync-draft-requests')) {
    const input = (body ?? {}) as Record<string, any>;
    const providerId = input.providerId ?? 'provider-official-feed';
    const provider = findRacingDataProvider(state.racingData, providerId);
    if (!provider) return apiNotFound(`No racing data provider for ${providerId}`, path, requestId);
    const operation = path.endsWith('/feature-store') ? 'feature-store export' : path.endsWith('/data-lake') ? 'data-lake export' : 'digital-twin sync';
    const requiredScopes = path.endsWith('/feature-store') ? ['ai-training' as const] : path.endsWith('/data-lake') ? ['analytics' as const] : ['race-day-operations' as const];
    const licenseDecision = isRacingDataLicenseAllowed(provider.license, operation, requiredScopes);
    if (!licenseDecision.allowed) return { status: 403, body: createRacingDataLicenseDenied(operation, provider, licenseDecision.details) };
    return { status: 202, body: createRacingDataDraftResult(operation, path.endsWith('/feature-store') ? 'racing-data.export.feature-store.draft.created' : path.endsWith('/data-lake') ? 'racing-data.export.data-lake.draft.created' : 'racing-data.digital-twin-sync.draft.created', providerId) };
  }
  if (method === 'POST' && path === '/track-configuration/draft-requests') {
    const eventType = 'track.configuration.change.requested';
    const message = 'Track configuration draft accepted. Work orders, verification, and Digital Twin sync remain locked until authorized human approvals are complete; no live actuator command was issued.';
    return validateProtectedApprovalBoundary(body, state.approvalService, { requireHumanActor: false, fallbackEventType: eventType, message });
  }
  if (method === 'POST' && (path === '/ai-control-plane/recommendations/draft' || path === '/ai-control-plane/recommendations/evaluate')) return { status: 202, body: createAIControlPlaneDraftResult(path, body) };
  if (method === 'POST' && (path === '/racing-data/license-policies/check' || path === '/data-usage-policies/check')) {
    const input = (body ?? {}) as Record<string, any>;
    if (!input.providerId || !input.operation) return { status: 400, body: { ok: false, error: { code: 'bad_request', message: 'providerId and operation are required' } } };
    const checkedAt = input.requestedAt ?? now();
    const auditLog = new ImmutableAuditLog();
    const service = seededRacingDataLicensePolicyService(checkedAt, { auditLog });
    const decision = service.checkUsage({ ...input, requestedAt: checkedAt } as Parameters<typeof service.checkUsage>[0]);
    return { status: decision.allowed ? 200 : 403, body: { ...decision, auditRecords: auditLog.all(), mock: false } };
  }
  if (method === 'POST' && path === '/collaboration/comments') {
    if (!isRecord(body)) return { status: 400, body: { ok: false, error: { code: 'bad_request', message: 'JSON object body is required' } } };
    try {
      const result = await state.collaboration.createComment(body as unknown as CollaborationCreateCommentInput, collaborationPrincipal(body, 'collaboration:write'));
      return { status: 201, body: { accepted: true, artifact: result.comment, thread: result.thread, metadata: result.metadata, audit: { id: result.audit.id, hash: result.audit.hash }, event: { id: result.event.id, type: result.event.type, correlationId: result.event.correlationId }, mock: false } };
    } catch (error) { return collaborationError(error); }
  }
  if (method === 'POST' && path === '/collaboration/assignments') {
    if (!isRecord(body)) return { status: 400, body: { ok: false, error: { code: 'bad_request', message: 'JSON object body is required' } } };
    try {
      const result = await state.collaboration.createAssignment(body as unknown as CollaborationCreateAssignmentInput, collaborationPrincipal(body, 'collaboration:write'));
      return { status: 201, body: { accepted: true, artifact: result.assignment, thread: result.thread, metadata: result.metadata, audit: { id: result.audit.id, hash: result.audit.hash }, event: { id: result.event.id, type: result.event.type, correlationId: result.event.correlationId }, mock: false } };
    } catch (error) { return collaborationError(error); }
  }
  if (method === 'POST' && path === '/collaboration/decisions') {
    if (!isRecord(body)) return { status: 400, body: { ok: false, error: { code: 'bad_request', message: 'JSON object body is required' } } };
    try {
      const result = await state.collaboration.recordDecision(body as unknown as CollaborationCreateDecisionInput, collaborationPrincipal(body, 'collaboration:write'));
      return { status: 201, body: { accepted: true, artifact: result.decision, thread: result.thread, metadata: result.metadata, audit: { id: result.audit.id, hash: result.audit.hash }, event: { id: result.event.id, type: result.event.type, correlationId: result.event.correlationId }, mock: false } };
    } catch (error) { return collaborationError(error); }
  }
  if (method === 'POST' && path === '/artifacts/registry/draft-registrations') return { status: 202, body: createUniversalArtifactDraftRegistrationResult(body) };
  if (method === 'POST' && path === '/assets/safety-critical-changes') return validateProtectedApprovalBoundary(body, state.approvalService, { requireHumanActor: true, fallbackEventType: 'racetrack.asset.approval-requested', message: 'Safety-critical asset change accepted for approval review. Execution remains locked until authorized.' });
  if (method === 'POST' && path === '/approvals/draft-requests') {
    const eventType = 'approval.requested';
    const message = 'Approval draft request accepted. Execution remains locked until authorized.';
    return validateProtectedApprovalBoundary(body, state.approvalService, { requireHumanActor: false, fallbackEventType: eventType, message });
  }
  if (method === 'POST' && path === '/approvals/controlled-actions') {
    const eventType = 'approval.requested';
    const message = 'Approval request accepted. Execution remains locked until authorized.';
    return validateProtectedApprovalBoundary(body, state.approvalService, { requireHumanActor: true, fallbackEventType: eventType, message });
  }
  return { status: 404, headers: { 'x-trackmind-request-id': requestId }, body: apiErrorBody({ code: 'not_found', message: `No TrackMind API route for ${method} ${pathname}`, path, requestId }) };
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
}

export function createTrackMindApiServer() {
  const state = createApiFacadeState();
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const requestId = requestIdFromHeader(req.headers['x-trackmind-request-id']) ?? createRequestId();
    const startedAt = Date.now();
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      url.searchParams.set('requestId', requestId);
      const result = await handleApiRequest((req.method ?? 'GET') as HttpMethod, `${url.pathname}${url.search}`, await readBody(req), state, req.headers);
      res.writeHead(result.status, { ...jsonHeaders, 'x-trackmind-request-id': requestId, ...(result.headers ?? {}) });
      res.end(typeof result.body === 'string' && result.headers?.['content-type']?.startsWith('text/event-stream') ? result.body : JSON.stringify(result.body));
      structuredLog('info', 'api.request.completed', { requestId, method: req.method ?? 'GET', path: url.pathname, status: result.status, durationMs: Date.now() - startedAt });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      const badJson = error instanceof SyntaxError;
      const status = badJson ? 400 : 500;
      const code = badJson ? 'bad_json' : 'internal_error';
      const path = req.url ?? '/';
      structuredLog('error', 'api.request.failed', { requestId, method: req.method ?? 'GET', path, status, code, durationMs: Date.now() - startedAt, message: rawMessage });
      res.writeHead(status, { ...jsonHeaders, 'x-trackmind-request-id': requestId });
      res.end(JSON.stringify(apiErrorBody({ code, message: badJson ? 'Invalid JSON request body' : 'TrackMind API request failed', path, requestId, details: badJson ? [rawMessage] : [] })));
    }
  });
}

export function startTrackMindApiServer(port = Number(process.env.PORT ?? 4000), host = process.env.HOST ?? '127.0.0.1') {
  const server = createTrackMindApiServer();
  server.listen(port, host, () => console.log(`TrackMind API listening on http://${host}:${port}${nexusApiBasePath}`));
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) startTrackMindApiServer();
