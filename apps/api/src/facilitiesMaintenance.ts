import { predictMaintenance, type MaintainableAssetType } from './assetIntelligence.js';
import { ImmutableAuditLog, type AuditLogEntry } from './auditLog.js';
import { CentralizedApprovalService, type ApprovalToken, type ControlledActionRequest } from './approvals.js';
import { DigitalTwinRuntime, type DigitalTwinRuntimeTwin } from './digitalTwinRuntime.js';
import { type ApiServiceDefinition } from './enterpriseApiGateway.js';
import { UniversalEventBus, type RaceDayEvent } from './eventBus.js';
import { RacetrackAssetRegistryService, type AssetPrincipal, type MaintenanceStatus, type RegistryAsset } from './racetrackAssetRegistryService.js';
import { racetrackAssetControlRegistry, type AssetRiskLevel } from './racetrackControlRegistry.js';
import { WorkflowOrchestrationEngine, type WorkflowDefinition } from './workflowEngine.js';

export type FacilityReadinessStatus = 'ready' | 'watch' | 'blocked';
export type FacilityInspectionStatus = 'passed' | 'watch' | 'failed';
export type MaintenancePriority = 'low' | 'normal' | 'high' | 'critical';
export type WorkOrderStatus = 'draft' | 'approval-required' | 'approved' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type WorkOrderOperationalImpact = 'read-only' | 'operational-impact' | 'race-day-critical';

export interface FacilityInspectionRecord {
  id: string;
  assetId: string;
  inspectedBy: string;
  inspectedAt: string;
  checklist: string[];
  findings: string[];
  status: FacilityInspectionStatus;
  score: number;
  nextInspectionDueAt: string;
  eventId: string;
  auditId: string;
  twinId?: string;
}

export interface PreventiveMaintenancePlan {
  id: string;
  assetId: string;
  cadenceDays: number;
  checklist: string[];
  nextDueAt: string;
  lastCompletedAt?: string;
  approvalRequiredForExecution: true;
  predictiveHooks: string[];
}

export interface FacilityWorkOrder {
  id: string;
  assetId: string;
  title: string;
  priority: MaintenancePriority;
  status: WorkOrderStatus;
  operationalImpact: WorkOrderOperationalImpact;
  requestedBy: string;
  requestedAt: string;
  scheduledFor?: string;
  dueAt: string;
  tasks: string[];
  evidence: string[];
  approvalRequestId?: string;
  workflowInstanceId?: string;
  eventId: string;
  auditId: string;
  twinId?: string;
  completedAt?: string;
  completedBy?: string;
}

export interface FacilityAssetHealthSummary {
  assetId: string;
  name: string;
  assetType: string;
  riskLevel: AssetRiskLevel;
  maintenanceStatus: MaintenanceStatus;
  lifecycleStatus: RegistryAsset['lifecycleStatus'];
  healthScore: number;
  readinessStatus: FacilityReadinessStatus;
  predictedFailureRisk: number;
  predictivePriority: 'monitor' | 'planned' | 'urgent';
  nextInspectionDueAt?: string;
  lastInspectionAt?: string;
  openWorkOrderIds: string[];
  twinId?: string;
  controlsRequiringApproval: string[];
  sourceOfTruth: 'racetrack-asset-registry';
}

export interface FacilitiesMaintenanceWorkspace {
  generatedAt: string;
  readiness: { score: number; status: FacilityReadinessStatus; ready: number; watch: number; blocked: number; evidence: string[] };
  assets: FacilityAssetHealthSummary[];
  inspections: FacilityInspectionRecord[];
  preventiveMaintenance: PreventiveMaintenancePlan[];
  workOrders: FacilityWorkOrder[];
  predictiveHooks: Array<{ assetId: string; type: MaintainableAssetType; failureProbability: number; priority: 'monitor' | 'planned' | 'urgent'; evidence: string[] }>;
  approvals: ControlledActionRequest[];
  audit: AuditLogEntry[];
  events: RaceDayEvent[];
  twins: DigitalTwinRuntimeTwin[];
  observability: { serviceId: 'facilities-maintenance'; metrics: Array<{ name: string; value: number; unit: string }>; commandCenterWidgetIds: string[] };
  operationalActionsRequireApproval: true;
  integrations: { assetRegistry: true; digitalTwinRuntime: true; approvals: true; workflows: true; audit: true; eventBus: true; observability: true };
  mock: boolean;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString();
const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));
const assetRacetrackId = (asset: RegistryAsset): string => {
  const value = asset.location.racetrackId ?? asset.location.trackId ?? asset.location.track;
  return typeof value === 'string' && value.length > 0 ? value : asset.tenantId;
};
const riskPenalty: Record<AssetRiskLevel, number> = { low: 4, medium: 10, high: 18, critical: 30 };
const maintenancePenalty: Record<MaintenanceStatus, number> = { ok: 0, due: 12, overdue: 24, 'out-of-service': 45 };

export class FacilitiesMaintenanceService {
  private readonly inspections: FacilityInspectionRecord[] = [];
  private readonly preventivePlans = new Map<string, PreventiveMaintenancePlan>();
  private readonly workOrders = new Map<string, FacilityWorkOrder>();
  readonly assetRegistry: RacetrackAssetRegistryService;
  readonly twins: DigitalTwinRuntime;
  readonly approvals: CentralizedApprovalService;
  readonly workflows: WorkflowOrchestrationEngine;
  readonly eventBus: UniversalEventBus;
  readonly auditLog: ImmutableAuditLog;

  constructor(options: { assetRegistry?: RacetrackAssetRegistryService; twins?: DigitalTwinRuntime; approvals?: CentralizedApprovalService; workflows?: WorkflowOrchestrationEngine; eventBus?: UniversalEventBus; auditLog?: ImmutableAuditLog } = {}) {
    this.eventBus = options.eventBus ?? new UniversalEventBus();
    this.auditLog = options.auditLog ?? new ImmutableAuditLog();
    this.assetRegistry = options.assetRegistry ?? new RacetrackAssetRegistryService({ eventBus: this.eventBus, auditLog: this.auditLog });
    this.twins = options.twins ?? new DigitalTwinRuntime({ eventBus: this.eventBus, auditLog: this.auditLog });
    this.approvals = options.approvals ?? new CentralizedApprovalService({ eventBus: this.eventBus, auditLog: this.auditLog, workflow: options.workflows });
    this.workflows = options.workflows ?? new WorkflowOrchestrationEngine();
    this.registerEventSchemas();
  }

  async seedFacilityAssets(principal: AssetPrincipal, now = new Date().toISOString()): Promise<RegistryAsset[]> {
    const seeded: RegistryAsset[] = [];
    for (const asset of racetrackAssetControlRegistry.filter((candidate) => candidate.domain === 'facilities')) {
      const existing = this.assetRegistry.query({ assetIds: [asset.assetId] }, this.readPrincipal(principal)).assets[0];
      if (existing) {
        if (!this.preventivePlans.has(existing.assetId)) this.preventivePlans.set(existing.assetId, this.defaultPlan(existing, now));
        seeded.push(existing);
        continue;
      }
      const registryAsset = await this.assetRegistry.create({
        assetId: asset.assetId,
        externalIds: [`racr:${asset.assetId}`],
        name: this.displayName(asset.assetType, asset.assetId),
        assetType: asset.assetType,
        domain: asset.domain,
        riskLevel: asset.riskLevel,
        maintenance: { status: this.maintenanceFromState(asset.state), lastInspectionAt: String((asset.state as Record<string, unknown>).lastInspection ?? now), nextInspectionDueAt: addDays(now, asset.riskLevel === 'high' ? 7 : 14) },
        ownership: { ownerAgent: asset.ownerAgent, stewardTeam: 'facilities-maintenance' },
        location: asset.location,
        state: asset.state,
        controls: asset.controls,
        sensors: asset.sensors,
        regulations: asset.regulations,
        tags: ['facilities', asset.assetType.toLowerCase(), 'maintenance'],
        digitalTwin: { twinId: `twin:${asset.assetId}`, relationship: 'represents', modelVersion: `dtmi:trackmind:${asset.assetType};1`, synchronizedAt: now },
        approvalPolicyId: asset.riskLevel === 'high' || asset.riskLevel === 'critical' ? 'critical-asset-dual-control' : 'standard-asset-approval',
        metadata: { azureTwinModel: `dtmi:trackmind:${asset.assetType};1`, sourceRegistry: 'racetrack-asset-control-registry' },
      }, principal);
      this.preventivePlans.set(registryAsset.assetId, this.defaultPlan(registryAsset, now));
      seeded.push(registryAsset);
      await this.publish('facilities.asset.seeded', registryAsset.assetId, { assetId: registryAsset.assetId, tenantId: registryAsset.tenantId, actor: principal.id, twinId: registryAsset.digitalTwin?.twinId });
    }
    return seeded.map(clone);
  }

  seedFacilityAssetsSync(principal: AssetPrincipal, now = new Date().toISOString()): RegistryAsset[] {
    const seeded: RegistryAsset[] = [];
    for (const asset of racetrackAssetControlRegistry.filter((candidate) => candidate.domain === 'facilities')) {
      const existing = this.assetRegistry.query({ assetIds: [asset.assetId] }, this.readPrincipal(principal)).assets[0];
      if (existing) {
        if (!this.preventivePlans.has(existing.assetId)) this.preventivePlans.set(existing.assetId, this.defaultPlan(existing, now));
        seeded.push(existing);
        continue;
      }
      const maintenanceStatus = this.maintenanceFromState(asset.state);
      const registryAsset: RegistryAsset = {
        assetId: asset.assetId,
        tenantId: principal.tenantId ?? 'track-1',
        externalIds: [`racr:${asset.assetId}`],
        name: this.displayName(asset.assetType, asset.assetId),
        assetClass: 'physical',
        assetType: asset.assetType,
        domain: asset.domain,
        lifecycleStatus: 'active',
        riskLevel: asset.riskLevel,
        safetyCritical: asset.riskLevel === 'critical' || asset.controls.some((control) => control.executionMode === 'human-only' || Boolean(control.protectedAction)),
        maintenance: { status: maintenanceStatus, lastInspectionAt: String((asset.state as Record<string, unknown>).lastInspection ?? now), nextInspectionDueAt: addDays(now, asset.riskLevel === 'high' ? 7 : 14) },
        maintenanceHistory: [],
        ownership: { ownerAgent: asset.ownerAgent, stewardTeam: 'facilities-maintenance' },
        location: asset.location,
        state: asset.state,
        controls: asset.controls,
        sensors: asset.sensors,
        telemetryBindings: asset.sensors.map((sensor) => ({ bindingId: `binding:${asset.assetId}:${sensor.id}`, sourceId: sensor.id, sensorId: sensor.id, stream: `telemetry.${principal.tenantId ?? 'track-1'}.${sensor.type}`, schemaRef: `telemetry.${sensor.type}.v1`, required: sensor.required, metric: sensor.verifies[0] ?? sensor.type })),
        regulations: asset.regulations,
        complianceMappings: asset.regulations.map((regulation) => ({ framework: regulation.authority, controlId: regulation.reference, obligation: `Comply with ${regulation.reference}`, evidenceRefs: regulation.appliesTo.map((item) => `control:${item}`) })),
        lifecycleHistory: [{ status: 'active', changedAt: now, changedBy: principal.id, reason: 'service-backed API runtime seed' }],
        riskAssessments: [{ level: asset.riskLevel, assessedAt: now, assessedBy: principal.id, rationale: 'Initial runtime registry classification', safetyCritical: asset.riskLevel === 'critical', approvalRequired: asset.riskLevel === 'critical' || asset.riskLevel === 'high', evidence: ['racetrack-asset-control-registry'] }],
        tags: ['facilities', asset.assetType.toLowerCase(), 'maintenance'],
        digitalTwin: { twinId: `twin:${asset.assetId}`, relationship: 'represents', modelVersion: `dtmi:trackmind:${asset.assetType};1`, synchronizedAt: now },
        approvalPolicyId: asset.riskLevel === 'high' || asset.riskLevel === 'critical' ? 'critical-asset-dual-control' : 'standard-asset-approval',
        createdAt: now,
        updatedAt: now,
        version: 1,
        metadata: { azureTwinModel: `dtmi:trackmind:${asset.assetType};1`, sourceRegistry: 'racetrack-asset-control-registry', seededBy: 'facilities-maintenance-service' },
      };
      const saved = this.assetRegistry.repository.save(registryAsset);
      this.assetRegistry.cache.invalidate();
      this.twins.registerAsset(saved, principal.id, `seed:${asset.assetId}`);
      this.preventivePlans.set(saved.assetId, this.defaultPlan(saved, now));
      seeded.push(saved);
    }
    return seeded.map(clone);
  }

  recordInspectionSync(input: { assetId: string; inspectedBy: string; checklist: string[]; findings: string[]; score: number; nextInspectionDueAt?: string }, principal: AssetPrincipal, now = new Date().toISOString()): FacilityInspectionRecord {
    const asset = this.assetRegistry.get(input.assetId, this.readPrincipal(principal));
    const status = this.inspectionStatus(input.score);
    const maintenanceStatus: MaintenanceStatus = status === 'failed' ? 'out-of-service' : status === 'watch' ? 'due' : 'ok';
    const record: FacilityInspectionRecord = {
      id: id('inspection'),
      assetId: asset.assetId,
      inspectedBy: input.inspectedBy,
      inspectedAt: now,
      checklist: [...input.checklist],
      findings: [...input.findings],
      status,
      score: clampScore(input.score),
      nextInspectionDueAt: input.nextInspectionDueAt ?? addDays(now, status === 'failed' ? 1 : status === 'watch' ? 7 : 30),
      eventId: id('evt-facility-inspection'),
      auditId: id('audit-facility-inspection'),
      twinId: asset.digitalTwin?.twinId,
    };
    this.inspections.push(record);
    const updated = this.assetRegistry.repository.save({
      ...asset,
      maintenance: { ...asset.maintenance, status: maintenanceStatus, lastInspectionAt: now, lastInspector: input.inspectedBy, nextInspectionDueAt: record.nextInspectionDueAt, notes: input.findings.join('; ') },
      updatedAt: now,
      version: asset.version + 1,
    });
    this.assetRegistry.cache.invalidate();
    this.twins.registerAsset(updated, input.inspectedBy, record.eventId);
    this.auditLog.append({ id: record.auditId, type: 'workflow-action', actor: input.inspectedBy, timestamp: now, payload: record, subjectId: asset.assetId, tenantId: asset.tenantId, racetrackId: assetRacetrackId(asset), severity: status === 'failed' ? 'critical' : status === 'watch' ? 'warning' : 'info', regulations: asset.regulations.map((item) => item.authority), evidenceIds: record.findings });
    return clone(record);
  }

  async recordInspection(input: { assetId: string; inspectedBy: string; checklist: string[]; findings: string[]; score: number; nextInspectionDueAt?: string; approvalToken?: ApprovalToken }, principal: AssetPrincipal): Promise<FacilityInspectionRecord> {
    const asset = this.assetRegistry.get(input.assetId, this.readPrincipal(principal));
    const status = this.inspectionStatus(input.score);
    const maintenanceStatus: MaintenanceStatus = status === 'failed' ? 'out-of-service' : status === 'watch' ? 'due' : 'ok';
    const inspectedAt = new Date().toISOString();
    const auditId = id('audit-facility-inspection');
    const eventId = id('evt-facility-inspection');
    const record: FacilityInspectionRecord = {
      id: id('inspection'),
      assetId: asset.assetId,
      inspectedBy: input.inspectedBy,
      inspectedAt,
      checklist: [...input.checklist],
      findings: [...input.findings],
      status,
      score: clampScore(input.score),
      nextInspectionDueAt: input.nextInspectionDueAt ?? addDays(inspectedAt, status === 'failed' ? 1 : status === 'watch' ? 7 : 30),
      eventId,
      auditId,
      twinId: asset.digitalTwin?.twinId,
    };
    this.inspections.push(record);
    try {
      await this.assetRegistry.inspect(asset.assetId, { inspector: input.inspectedBy, status: maintenanceStatus, nextInspectionDueAt: record.nextInspectionDueAt, notes: input.findings.join('; ') }, principal, { approvalToken: input.approvalToken, reason: `Facility inspection ${record.id}` });
    } catch (error) {
      if (!(error instanceof Error) || !/requires approval token/.test(error.message)) throw error;
      this.approvals.createRequest({ tenantId: asset.tenantId, racetrackId: assetRacetrackId(asset), action: 'safety-critical-control', target: asset.assetId, requestedBy: input.inspectedBy, actorType: 'human', reason: `Approve RACR maintenance-state update for inspection ${record.id}`, evidence: ['human-approval-record', record.id, ...record.findings] });
    }
    this.auditLog.append({ id: auditId, type: 'workflow-action', actor: input.inspectedBy, timestamp: inspectedAt, payload: record, subjectId: asset.assetId, tenantId: asset.tenantId, racetrackId: assetRacetrackId(asset), severity: status === 'failed' ? 'critical' : status === 'watch' ? 'warning' : 'info', regulations: asset.regulations.map((item) => item.authority), evidenceIds: record.findings });
    await this.patchTwin(asset, { latestFacilityInspection: record, facilityHealthScore: record.score, maintenanceStatus }, input.inspectedBy, eventId);
    await this.publish('facilities.inspection.recorded', asset.assetId, { assetId: asset.assetId, tenantId: asset.tenantId, actor: input.inspectedBy, inspection: record });
    return clone(record);
  }

  createPreventiveMaintenancePlan(input: { assetId: string; cadenceDays: number; checklist: string[]; nextDueAt: string; predictiveHooks?: string[] }, principal: AssetPrincipal): PreventiveMaintenancePlan {
    const asset = this.assetRegistry.get(input.assetId, this.readPrincipal(principal));
    const plan: PreventiveMaintenancePlan = { id: id('pm'), assetId: asset.assetId, cadenceDays: input.cadenceDays, checklist: [...input.checklist], nextDueAt: input.nextDueAt, approvalRequiredForExecution: true, predictiveHooks: input.predictiveHooks ?? ['runtime-hours', 'fault-count-30d', 'required-telemetry-staleness'] };
    this.preventivePlans.set(asset.assetId, plan);
    this.auditLog.append({ id: id('audit-pm'), type: 'workflow-action', actor: principal.id, timestamp: new Date().toISOString(), payload: plan, subjectId: asset.assetId, tenantId: asset.tenantId, severity: 'info', regulations: asset.regulations.map((item) => item.authority) });
    void this.publish('facilities.preventive-maintenance.scheduled', asset.assetId, { assetId: asset.assetId, tenantId: asset.tenantId, actor: principal.id, plan });
    return clone(plan);
  }

  createWorkOrder(input: { assetId: string; title: string; priority: MaintenancePriority; requestedBy: string; dueAt: string; tasks: string[]; evidence: string[]; operationalImpact: WorkOrderOperationalImpact; scheduledFor?: string }, principal: AssetPrincipal): FacilityWorkOrder {
    const asset = this.assetRegistry.get(input.assetId, this.readPrincipal(principal));
    const now = new Date().toISOString();
    const requiresApproval = input.operationalImpact !== 'read-only';
    this.workflows.register(facilitiesMaintenanceWorkflow(asset.tenantId));
    const workflow = this.workflows.start('facilities-maintenance-work-order', { tenantId: asset.tenantId, priority: input.priority, digitalTwinRefs: asset.digitalTwin?.twinId ? [asset.digitalTwin.twinId] : [], payload: { assetId: asset.assetId, operationalImpact: input.operationalImpact } }, input.requestedBy, now);
    const approval = requiresApproval ? this.approvals.createRequest({ tenantId: asset.tenantId, racetrackId: assetRacetrackId(asset), action: 'facility-maintenance-execution', target: asset.assetId, requestedBy: input.requestedBy, actorType: 'human', reason: input.title, evidence: ['human-approval-record', ...input.evidence], workflowInstanceId: workflow.id }) : undefined;
    const order: FacilityWorkOrder = {
      id: id('wo'),
      assetId: asset.assetId,
      title: input.title,
      priority: input.priority,
      status: requiresApproval ? 'approval-required' : 'scheduled',
      operationalImpact: input.operationalImpact,
      requestedBy: input.requestedBy,
      requestedAt: now,
      scheduledFor: input.scheduledFor,
      dueAt: input.dueAt,
      tasks: [...input.tasks],
      evidence: [...input.evidence],
      approvalRequestId: approval?.id,
      workflowInstanceId: workflow.id,
      eventId: id('evt-facility-work-order'),
      auditId: id('audit-facility-work-order'),
      twinId: asset.digitalTwin?.twinId,
    };
    this.workOrders.set(order.id, order);
    this.auditLog.append({ id: order.auditId, type: 'workflow-action', actor: input.requestedBy, timestamp: now, payload: order, subjectId: asset.assetId, workflowId: workflow.id, tenantId: asset.tenantId, severity: input.priority === 'critical' ? 'critical' : input.priority === 'high' ? 'warning' : 'info', regulations: asset.regulations.map((item) => item.authority), evidenceIds: order.evidence });
    void this.patchTwin(asset, { openFacilityWorkOrder: order, maintenanceStatus: 'work-order-requested' }, input.requestedBy, order.eventId);
    void this.publish('facilities.work-order.requested', asset.assetId, { assetId: asset.assetId, tenantId: asset.tenantId, actor: input.requestedBy, workOrder: order, approvalRequestId: approval?.id, workflowInstanceId: workflow.id });
    return clone(order);
  }

  async completeWorkOrder(input: { workOrderId: string; completedBy: string; evidence: string[]; approvalToken?: ApprovalToken; assetApprovalToken?: ApprovalToken }, principal: AssetPrincipal): Promise<FacilityWorkOrder> {
    const order = this.requireWorkOrder(input.workOrderId);
    const asset = this.assetRegistry.get(order.assetId, this.readPrincipal(principal));
    if (order.operationalImpact !== 'read-only') this.approvals.assertAuthorized(input.approvalToken, 'facility-maintenance-execution', asset.assetId, asset.tenantId, assetRacetrackId(asset));
    const completed: FacilityWorkOrder = { ...order, status: 'completed', completedAt: new Date().toISOString(), completedBy: input.completedBy, evidence: [...new Set([...order.evidence, ...input.evidence])] };
    await this.assetRegistry.inspect(asset.assetId, { inspector: input.completedBy, status: 'ok', workOrderId: completed.id, notes: `Completed ${completed.title}` }, principal, { approvalToken: input.assetApprovalToken, reason: `Return ${completed.id} to service` });
    this.workOrders.set(completed.id, completed);
    this.auditLog.append({ id: id('audit-facility-complete'), type: 'workflow-action', actor: input.completedBy, timestamp: completed.completedAt!, payload: completed, subjectId: asset.assetId, workflowId: completed.workflowInstanceId, tenantId: asset.tenantId, severity: 'info', regulations: asset.regulations.map((item) => item.authority), evidenceIds: completed.evidence });
    await this.patchTwin(asset, { completedFacilityWorkOrder: completed, maintenanceStatus: 'ok', operationalReadiness: 'ready' }, input.completedBy, completed.eventId);
    await this.publish('facilities.work-order.completed', asset.assetId, { assetId: asset.assetId, tenantId: asset.tenantId, actor: input.completedBy, workOrder: completed });
    return clone(completed);
  }

  workspace(principal: AssetPrincipal): FacilitiesMaintenanceWorkspace {
    const assets = this.assetRegistry.query({ domain: 'facilities', sortBy: 'riskLevel' }, this.readPrincipal(principal)).assets;
    const summaries = assets.map((asset) => this.summarizeAsset(asset));
    const readiness = this.readiness(summaries);
    const assetIds = new Set(assets.map((asset) => asset.assetId));
    const predictiveHooks = assets.map((asset) => {
      const prediction = this.predict(asset);
      return { assetId: asset.assetId, type: this.predictiveType(asset), failureProbability: prediction.failureProbability, priority: prediction.priority, evidence: [`risk:${asset.riskLevel}`, `maintenance:${asset.maintenance.status}`, `runtime:${this.numberState(asset, 'runtimeHours')}`] };
    });
    return {
      generatedAt: new Date().toISOString(),
      readiness,
      assets: summaries,
      inspections: this.inspections.filter((inspection) => assetIds.has(inspection.assetId)).map(clone),
      preventiveMaintenance: [...this.preventivePlans.values()].filter((plan) => assetIds.has(plan.assetId)).map(clone),
      workOrders: [...this.workOrders.values()].filter((order) => assetIds.has(order.assetId)).map(clone),
      predictiveHooks,
      approvals: this.approvals.allRequests().filter((request) => assetIds.has(request.target)).map(clone),
      audit: this.auditLog.all().filter((entry) => Boolean(entry.subjectId && assetIds.has(entry.subjectId)) || (typeof entry.payload === 'object' && JSON.stringify(entry.payload).includes('facilities.'))),
      events: this.eventBus.events().filter((event) => String(event.type).startsWith('facilities.') || Boolean(event.lineage.aggregateId && assetIds.has(event.lineage.aggregateId))),
      twins: this.twins.queryTwins({ tenantId: principal.tenantId, domain: 'facilities' }),
      observability: { serviceId: 'facilities-maintenance', metrics: [{ name: 'facility_readiness_score', value: readiness.score, unit: 'score' }, { name: 'facility_open_work_orders', value: [...this.workOrders.values()].filter((order) => assetIds.has(order.assetId) && order.status !== 'completed').length, unit: 'count' }, { name: 'facility_predictive_urgent', value: predictiveHooks.filter((hook) => hook.priority === 'urgent').length, unit: 'count' }], commandCenterWidgetIds: ['facility-status', 'facility-readiness', 'asset-health'] },
      operationalActionsRequireApproval: true,
      integrations: { assetRegistry: true, digitalTwinRuntime: true, approvals: true, workflows: true, audit: true, eventBus: true, observability: true },
      mock: false,
    };
  }

  apiDefinition(): ApiServiceDefinition {
    return facilitiesMaintenanceApiDefinition();
  }

  private readPrincipal(principal: AssetPrincipal): AssetPrincipal { return { ...principal, scopes: [...new Set([...principal.scopes, 'assets:read'])] }; }
  private requireWorkOrder(workOrderId: string): FacilityWorkOrder { const order = this.workOrders.get(workOrderId); if (!order) throw new Error(`Unknown facility work order ${workOrderId}`); return order; }
  private displayName(assetType: string, assetId: string): string { return assetType.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (char) => char.toUpperCase()) + ` ${assetId.split('_').at(-1)}`; }
  private maintenanceFromState(state: Record<string, unknown>): MaintenanceStatus { const raw = String(state.maintenanceStatus ?? 'OK').toLowerCase().replace(/_/g, '-'); return raw === 'due' || raw === 'overdue' || raw === 'out-of-service' ? raw : 'ok'; }
  private defaultPlan(asset: RegistryAsset, now: string): PreventiveMaintenancePlan { return { id: `pm-${asset.assetId.toLowerCase()}`, assetId: asset.assetId, cadenceDays: asset.riskLevel === 'high' || asset.riskLevel === 'critical' ? 7 : 14, checklist: ['verify required telemetry', 'inspect safety controls', 'document lockout readiness', 'confirm return-to-service approval path'], nextDueAt: asset.maintenance.nextInspectionDueAt ?? addDays(now, 14), approvalRequiredForExecution: true, predictiveHooks: ['runtime-hours', 'fault-count-30d', 'risk-level', 'required-telemetry'] }; }
  private inspectionStatus(score: number): FacilityInspectionStatus { return score < 60 ? 'failed' : score < 82 ? 'watch' : 'passed'; }
  private readinessStatus(score: number): FacilityReadinessStatus { return score < 65 ? 'blocked' : score < 85 ? 'watch' : 'ready'; }
  private numberState(asset: RegistryAsset, key: string): number { const value = asset.state[key]; return typeof value === 'number' ? value : 0; }
  private predictiveType(asset: RegistryAsset): MaintainableAssetType { const raw = `${asset.assetType} ${asset.tags.join(' ')}`.toLowerCase(); if (raw.includes('hvac')) return 'hvac'; if (raw.includes('elevator')) return 'elevator'; if (raw.includes('generator')) return 'generator'; if (raw.includes('camera')) return 'camera'; if (raw.includes('lighting')) return 'lighting'; if (raw.includes('vehicle')) return 'vehicle'; if (raw.includes('communication')) return 'communications'; if (raw.includes('security')) return 'security'; if (raw.includes('gate')) return 'gate'; if (raw.includes('irrigation')) return 'irrigation'; return 'emergency-equipment'; }
  private faultCount(asset: RegistryAsset): number { return Math.max(this.numberState(asset, 'faultCount30d'), this.numberState(asset, 'doorFaults30d'), this.numberState(asset, 'alarmCount30d')); }
  private predict(asset: RegistryAsset) { return predictMaintenance({ assetId: asset.assetId, type: this.predictiveType(asset), ageDays: Math.max(1, Math.round((Date.now() - Date.parse(asset.createdAt)) / 86_400_000)), faultCount30d: this.faultCount(asset), runtimeHours: this.numberState(asset, 'runtimeHours'), criticality: riskPenalty[asset.riskLevel] / 10 }); }
  private summarizeAsset(asset: RegistryAsset): FacilityAssetHealthSummary {
    const prediction = this.predict(asset);
    const latestInspection = this.inspections.filter((inspection) => inspection.assetId === asset.assetId).at(-1);
    const base = latestInspection?.score ?? 100;
    const healthScore = clampScore(base - riskPenalty[asset.riskLevel] - maintenancePenalty[asset.maintenance.status] - prediction.failureProbability * 20);
    const openWorkOrderIds = [...this.workOrders.values()].filter((order) => order.assetId === asset.assetId && order.status !== 'completed' && order.status !== 'cancelled').map((order) => order.id);
    return { assetId: asset.assetId, name: asset.name, assetType: asset.assetType, riskLevel: asset.riskLevel, maintenanceStatus: asset.maintenance.status, lifecycleStatus: asset.lifecycleStatus, healthScore, readinessStatus: this.readinessStatus(healthScore), predictedFailureRisk: Math.round(prediction.failureProbability * 100), predictivePriority: prediction.priority, nextInspectionDueAt: asset.maintenance.nextInspectionDueAt, lastInspectionAt: asset.maintenance.lastInspectionAt, openWorkOrderIds, twinId: asset.digitalTwin?.twinId, controlsRequiringApproval: asset.controls.filter((control) => control.requiresApprovalFrom.length > 0 || control.executionMode !== 'automatic').map((control) => control.name), sourceOfTruth: 'racetrack-asset-registry' };
  }
  private readiness(assets: FacilityAssetHealthSummary[]): FacilitiesMaintenanceWorkspace['readiness'] {
    const score = assets.length ? clampScore(assets.reduce((sum, asset) => sum + asset.healthScore, 0) / assets.length) : 0;
    return { score, status: this.readinessStatus(score), ready: assets.filter((asset) => asset.readinessStatus === 'ready').length, watch: assets.filter((asset) => asset.readinessStatus === 'watch').length, blocked: assets.filter((asset) => asset.readinessStatus === 'blocked').length, evidence: assets.flatMap((asset) => [`${asset.assetId}:health=${asset.healthScore}`, `${asset.assetId}:twin=${asset.twinId ?? 'pending'}`]) };
  }
  private async patchTwin(asset: RegistryAsset, patch: Record<string, unknown>, actor: string, eventId: string): Promise<void> {
    if (!asset.digitalTwin?.twinId) return;
    await this.eventBus.publish({ id: `${eventId}:twin`, type: 'digital-twin.state.patch', aggregateId: asset.digitalTwin.twinId, producer: 'facilities-maintenance', payload: { twinId: asset.digitalTwin.twinId, patch, actor, observedAt: new Date().toISOString() }, metadata: { team: 'facilities-maintenance', accountableRole: 'track-superintendent', compliance: 'regulated' } });
  }
  private async publish(type: string, aggregateId: string, payload: Record<string, unknown>): Promise<RaceDayEvent> {
    return this.eventBus.publish({ type, aggregateId, producer: 'facilities-maintenance', payload, metadata: { team: 'facilities-maintenance', accountableRole: 'track-superintendent', compliance: 'regulated' } });
  }
  private registerEventSchemas(): void {
    ['facilities.asset.seeded', 'facilities.inspection.recorded', 'facilities.preventive-maintenance.scheduled', 'facilities.work-order.requested', 'facilities.work-order.completed', 'facilities.readiness.evaluated', 'facilities.predictive-maintenance.flagged'].forEach((type) => this.eventBus.registerEvent({ type, version: 1, description: `Facilities maintenance ${type}`, owner: { service: 'facilities-maintenance', team: 'facilities-maintenance', accountableRole: 'track-superintendent' }, payloadFields: ['assetId', 'tenantId', 'actor'], compliance: 'regulated' }));
  }
}

export function facilitiesMaintenanceWorkflow(tenantId: string): WorkflowDefinition {
  return {
    id: 'facilities-maintenance-work-order',
    name: 'Facilities Maintenance Work Order',
    domain: 'maintenance',
    version: '1.0.0',
    bpmnProcessId: 'Process_FacilitiesMaintenanceWorkOrder',
    startStepId: 'triage',
    ownerRole: 'track-superintendent',
    tenantId,
    triggerEvents: ['facilities.work-order.requested'],
    steps: [
      { id: 'triage', name: 'Triage facility asset health metadata', type: 'userTask', role: 'track-superintendent', sla: { minutes: 20, escalationRole: 'admin', severity: 'warning' }, digitalTwin: { refs: [], syncMode: 'read', statePatch: { maintenanceTriage: 'started' } }, next: ['approval'] },
      { id: 'approval', name: 'Approve operational maintenance impact', type: 'approvalTask', role: 'track-superintendent', approvalRoles: ['track-superintendent', 'admin'], requiredApprovals: 1, sla: { minutes: 45, escalationRole: 'admin', severity: 'critical' }, next: ['schedule'] },
      { id: 'schedule', name: 'Record crew and lockout-window metadata', type: 'userTask', role: 'track-superintendent', sla: { minutes: 60, escalationRole: 'admin', severity: 'warning' }, digitalTwin: { refs: [], syncMode: 'read', statePatch: { maintenanceScheduled: true } }, next: ['verify'] },
      { id: 'verify', name: 'Record repair verification metadata', type: 'userTask', role: 'track-superintendent', sla: { minutes: 60, escalationRole: 'admin', severity: 'critical' }, digitalTwin: { refs: [], syncMode: 'read', statePatch: { returnToServiceVerification: 'pending' } }, next: ['closed'] },
      { id: 'closed', name: 'Facilities work order metadata closed', type: 'endEvent' },
    ],
  };
}

export function facilitiesMaintenanceApiDefinition(): ApiServiceDefinition {
  return { id: 'facilities-maintenance', name: 'Facilities Maintenance', domain: 'facilities', version: 'v1', basePath: '/api/v1/facilities-maintenance', description: 'RACR-backed facilities read model for inspections, preventive maintenance plans, work order requests, predictive hooks, asset health scoring, readiness metadata, approvals, audit references, workflows, events, and Digital Twin references.', owner: { team: 'facilities-maintenance', productOwner: 'Director of Facilities', technicalOwner: 'Facilities Maintenance Service Owner', supportChannel: '#trackmind-facilities' }, lifecycle: 'active', auth: ['jwt', 'oauth2', 'mtls'], rateLimit: { requests: 600, perSeconds: 60, burst: 100 }, tags: ['facilities', 'maintenance', 'asset-registry', 'digital-twin', 'audit', 'approval'], slo: { availability: 99.9, latencyMs: 250 }, endpoints: [
    { method: 'GET', path: '/workspace', summary: 'Read facilities maintenance command workspace', scopes: ['assets:read'] },
  ] };
}

export function createFacilitiesMaintenanceService() {
  return new FacilitiesMaintenanceService();
}

export function createMockFacilitiesMaintenanceWorkspace(timestamp = new Date().toISOString()): FacilitiesMaintenanceWorkspace {
  const assets: FacilityAssetHealthSummary[] = [
    { assetId: 'GRANDSTAND_HVAC_01', name: 'Grandstand HVAC 01', assetType: 'HVACSystem', riskLevel: 'medium', maintenanceStatus: 'due', lifecycleStatus: 'active', healthScore: 78, readinessStatus: 'watch', predictedFailureRisk: 46, predictivePriority: 'planned', nextInspectionDueAt: '2026-06-15T12:00:00.000Z', lastInspectionAt: '2026-06-12T13:30:00.000Z', openWorkOrderIds: ['wo-hvac-filter'], twinId: 'twin:GRANDSTAND_HVAC_01', controlsRequiringApproval: ['adjust-hvac-setpoint', 'return-to-service'], sourceOfTruth: 'racetrack-asset-registry' },
    { assetId: 'BACKUP_GENERATOR_A', name: 'Backup Generator A', assetType: 'BackupGenerator', riskLevel: 'high', maintenanceStatus: 'ok', lifecycleStatus: 'active', healthScore: 88, readinessStatus: 'ready', predictedFailureRisk: 32, predictivePriority: 'monitor', nextInspectionDueAt: '2026-06-20T12:00:00.000Z', lastInspectionAt: '2026-06-13T07:15:00.000Z', openWorkOrderIds: [], twinId: 'twin:BACKUP_GENERATOR_A', controlsRequiringApproval: ['schedule-load-test', 'life-safety-power-transfer'], sourceOfTruth: 'racetrack-asset-registry' },
    { assetId: 'PATRON_ELEVATOR_A', name: 'Patron Elevator A', assetType: 'Elevator', riskLevel: 'high', maintenanceStatus: 'due', lifecycleStatus: 'active', healthScore: 69, readinessStatus: 'watch', predictedFailureRisk: 64, predictivePriority: 'planned', nextInspectionDueAt: '2026-06-14T12:00:00.000Z', lastInspectionAt: '2026-06-10T09:00:00.000Z', openWorkOrderIds: ['wo-elevator-door'], twinId: 'twin:PATRON_ELEVATOR_A', controlsRequiringApproval: ['create-elevator-work-order', 'remove-from-service'], sourceOfTruth: 'racetrack-asset-registry' },
  ];
  const inspections: FacilityInspectionRecord[] = [{ id: 'inspection-hvac-1', assetId: 'GRANDSTAND_HVAC_01', inspectedBy: 'track-superintendent', inspectedAt: timestamp, checklist: ['filter differential', 'motor temperature', 'patron-area airflow'], findings: ['filter pressure elevated'], status: 'watch', score: 78, nextInspectionDueAt: '2026-06-15T12:00:00.000Z', eventId: 'facilities.inspection.recorded', auditId: 'audit-facility-hvac-1', twinId: 'twin:GRANDSTAND_HVAC_01' }];
  const workOrders: FacilityWorkOrder[] = [{ id: 'wo-hvac-filter', assetId: 'GRANDSTAND_HVAC_01', title: 'Replace grandstand HVAC filters', priority: 'high', status: 'approval-required', operationalImpact: 'operational-impact', requestedBy: 'track-superintendent', requestedAt: timestamp, scheduledFor: '2026-06-14T18:00:00.000Z', dueAt: '2026-06-14T20:00:00.000Z', tasks: ['lockout unit', 'replace filters', 'verify airflow', 'record return-to-service verification'], evidence: ['telemetry:filterDeltaPressure=68', 'inspection-hvac-1'], approvalRequestId: 'approval-facility-hvac', workflowInstanceId: 'facilities-maintenance-work-order-1', eventId: 'facilities.work-order.requested', auditId: 'audit-wo-hvac', twinId: 'twin:GRANDSTAND_HVAC_01' }];
  const preventiveMaintenance: PreventiveMaintenancePlan[] = assets.map((asset) => ({ id: `pm-${asset.assetId.toLowerCase()}`, assetId: asset.assetId, cadenceDays: asset.riskLevel === 'high' ? 7 : 14, checklist: ['verify required telemetry', 'inspect safety controls', 'confirm approval path'], nextDueAt: asset.nextInspectionDueAt ?? timestamp, approvalRequiredForExecution: true, predictiveHooks: ['runtime-hours', 'fault-count-30d', 'required-telemetry'] }));
  const predictiveHooks = assets.map((asset) => ({ assetId: asset.assetId, type: asset.assetType === 'Elevator' ? 'elevator' as const : asset.assetType === 'BackupGenerator' ? 'generator' as const : 'hvac' as const, failureProbability: asset.predictedFailureRisk / 100, priority: asset.predictivePriority, evidence: [`${asset.assetId}:health=${asset.healthScore}`, `${asset.assetId}:maintenance=${asset.maintenanceStatus}`] }));
  const readiness = { score: 78, status: 'watch' as const, ready: 1, watch: 2, blocked: 0, evidence: assets.flatMap((asset) => [`${asset.assetId}:health=${asset.healthScore}`, `${asset.assetId}:twin=${asset.twinId}`]) };
  return { generatedAt: timestamp, readiness, assets, inspections, preventiveMaintenance, workOrders, predictiveHooks, approvals: [{ id: 'approval-facility-hvac', tenantId: 'saratoga', racetrackId: 'main-track', action: 'facility-maintenance-execution', target: 'GRANDSTAND_HVAC_01', requestedBy: 'track-superintendent', actorType: 'human', reason: 'Replace filters before patron load increases', evidence: ['human-approval-record', 'inspection-hvac-1'], createdAt: timestamp, expiresAt: '2026-06-14T20:45:00.000Z', status: 'pending', decisions: [], escalatedToRoles: [], workflowInstanceId: 'facilities-maintenance-work-order-1' }], audit: [], events: [], twins: [], observability: { serviceId: 'facilities-maintenance', metrics: [{ name: 'facility_readiness_score', value: readiness.score, unit: 'score' }, { name: 'facility_open_work_orders', value: workOrders.length, unit: 'count' }, { name: 'facility_predictive_urgent', value: 0, unit: 'count' }], commandCenterWidgetIds: ['facility-status', 'facility-readiness', 'asset-health'] }, operationalActionsRequireApproval: true, integrations: { assetRegistry: true, digitalTwinRuntime: true, approvals: true, workflows: true, audit: true, eventBus: true, observability: true }, mock: true };
}
