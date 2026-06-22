import type { IssueStewardFinalRulingRequestDto, KpiMutationDraftResultDto, ProviderAdapterInvokeResultDto, RacingDataDraftResultDto, StewardMutationResultDto } from '@trackmind/shared';
import { postJson } from './client';
import { apiPaths } from './paths';
import {
  assertMutationOk,
  buildApprovalDecisionBody,
  buildControlledActionBody,
  type ControlledActionInput,
} from './approvalPayload';
import { getTenantContext } from '@/auth/session';

export interface ControlledActionResponse {
  accepted?: boolean;
  approvalId?: string;
  action?: string;
  target?: string;
  status?: string;
  message?: string;
}

export async function createControlledAction(input: ControlledActionInput): Promise<ControlledActionResponse> {
  const result = await postJson<ControlledActionResponse>(
    '/approvals/controlled-actions',
    buildControlledActionBody(input),
  );
  return assertMutationOk(result);
}

export async function createApprovalDraft(input: ControlledActionInput): Promise<ControlledActionResponse> {
  const result = await postJson<ControlledActionResponse>(
    '/approvals/draft-requests',
    buildControlledActionBody(input),
  );
  return assertMutationOk(result);
}

export async function approveRequest(approvalId: string, reason?: string): Promise<ControlledActionResponse> {
  const result = await postJson<ControlledActionResponse>(
    `/approvals/${approvalId}/approve`,
    buildApprovalDecisionBody(reason),
  );
  return assertMutationOk(result);
}

export async function rejectRequest(approvalId: string, reason?: string): Promise<ControlledActionResponse> {
  const result = await postJson<ControlledActionResponse>(
    `/approvals/${approvalId}/reject`,
    buildApprovalDecisionBody(reason ?? 'Rejected from TrackMind approvals console'),
  );
  return assertMutationOk(result);
}

export async function requestKpiThresholdDraft(input: {
  kpiId: string;
  warning?: number;
  critical?: number;
  targetDirection: 'above' | 'below' | 'within-band';
  description: string;
  reason: string;
  evidence?: string[];
}): Promise<KpiMutationDraftResultDto> {
  const session = getTenantContext();
  const result = await postJson<KpiMutationDraftResultDto>(
    apiPaths.kpis.thresholdDraftRequests,
    {
      ...input,
      requestedBy: `${session.role}-operator`,
      evidence: input.evidence?.length ? input.evidence : ['kpi-threshold-draft-ui'],
    },
  );
  return assertMutationOk(result);
}

export async function draftEntityResolutionReview(input: {
  providerId: string;
  entityId: string;
  resolutionId?: string;
  rationale?: string;
}): Promise<RacingDataDraftResultDto> {
  const result = await postJson<RacingDataDraftResultDto>(
    '/racing-data/entity-resolution/review',
    input,
  );
  return assertMutationOk(result);
}

export async function invokeRacingDataProvider(providerId: string): Promise<ProviderAdapterInvokeResultDto> {
  const result = await postJson<ProviderAdapterInvokeResultDto>(
    `/racing-data/providers/${encodeURIComponent(providerId)}/invoke`,
    {},
  );
  return assertMutationOk(result);
}

export async function requestTrackConfigDraft(input: ControlledActionInput): Promise<ControlledActionResponse> {
  const result = await postJson<ControlledActionResponse>(
    '/track-configuration/draft-requests',
    buildControlledActionBody(input),
  );
  return assertMutationOk(result);
}

export async function requestStartingGateRaceStartApproval(
  raceId: string,
  input: { reason: string; evidence?: string[] },
): Promise<{ approvalRequestId?: string; message?: string }> {
  const session = getTenantContext();
  const result = await postJson<{ approvalRequestId?: string; message?: string }>(
    `/starting-gate-operations/races/${encodeURIComponent(raceId)}/race-start-approval`,
    {
      reason: input.reason,
      evidence: input.evidence?.length ? input.evidence : ['starting-gate-readiness', 'race-day-console'],
      requestedBy: `${session.role}-operator`,
      actor: `${session.role}-operator`,
    },
  );
  return assertMutationOk(result);
}

export async function requestRaceStart(
  raceId: string,
  body: { approvalToken: ApprovalTokenPayload; starterId?: string; justification?: string },
) {
  const session = getTenantContext();
  const result = await postJson(`/races/${encodeURIComponent(raceId)}/start`, {
    tenantId: session.tenantId,
    racetrackId: session.racetrackId,
    starterId: body.starterId ?? `${session.role}-operator`,
    actorId: body.starterId ?? `${session.role}-operator`,
    approvalToken: body.approvalToken,
    evidence_links: body.justification ? [`justification://${body.justification}`] : ['race-day-console'],
  });
  return assertMutationOk(result);
}

export async function requestRaceStop(raceId: string, body: { approvalId: string; justification?: string }) {
  return postJson(`/races/${raceId}/stop`, body);
}

export async function requestScratch(raceId: string, body: { approvalId: string; horseId: string; justification?: string }) {
  return postJson(`/races/${raceId}/scratches`, body);
}

export async function requestPayout(body: Record<string, unknown>) {
  return postJson('/services/finance/payouts', body);
}

export interface ApprovalTokenPayload {
  requestId: string;
  action: string;
  target: string;
  tenantId: string;
  racetrackId: string;
  issuedAt: string;
  expiresAt: string;
  approvedBy: string[];
  issuedTo?: string;
}

export async function authorizeApprovalExecution(approvalId: string): Promise<{ approvalToken?: ApprovalTokenPayload }> {
  const session = getTenantContext();
  const result = await postJson<{ approvalToken?: ApprovalTokenPayload }>(
    `/approvals/${approvalId}/authorize-execution`,
    buildApprovalDecisionBody('Authorize finance payout execution'),
  );
  return assertMutationOk(result);
}

export async function requestRacingFinancePayout(body: { amount: number; recipientLabel: string; actor?: string }) {
  const result = await postJson('/finance/payout-requests', body);
  return assertMutationOk(result);
}

export async function requestPurseRelease(purseId: string, body: { actor?: string; approvalToken?: ApprovalTokenPayload } = {}) {
  const result = await postJson(`/finance/purses/${encodeURIComponent(purseId)}/release`, body);
  return assertMutationOk(result);
}

export async function releaseFinancePayout(payoutId: string, approvalToken: ApprovalTokenPayload, actor = 'finance') {
  const result = await postJson(`/finance/payouts/${encodeURIComponent(payoutId)}/release`, { approvalToken, actor });
  return assertMutationOk(result);
}

export async function postComment(body: Record<string, unknown>) {
  return postJson('/collaboration/comments', body);
}

export async function postAssignment(body: Record<string, unknown>) {
  return postJson('/collaboration/assignments', body);
}

export async function postDecision(body: Record<string, unknown>) {
  return postJson('/collaboration/decisions', body);
}

export async function draftAiRecommendation(body: Record<string, unknown>) {
  return postJson('/ai-control-plane/recommendations/draft', body);
}

export async function evaluateAiRecommendation(body: Record<string, unknown>) {
  return postJson('/ai-control-plane/recommendations/evaluate', body);
}

export async function draftArtifactRegistration(body: Record<string, unknown>) {
  return postJson('/artifacts/registry/draft-registrations', body);
}

export interface AIModelRegistryMutationResponse {
  accepted?: boolean;
  registeredId?: string;
  eventType?: string;
  auditId?: string;
  audited?: boolean;
  message?: string;
}

export async function registerModelCard(body: {
  id: string;
  name: string;
  version: string;
  riskLevel: string;
  path: string;
  lastEvaluatedAt?: string;
  reason?: string;
}): Promise<AIModelRegistryMutationResponse> {
  const result = await postJson<AIModelRegistryMutationResponse>('/ai-governance/model-registry/models', body);
  return assertMutationOk(result);
}

export async function registerPromptCard(body: {
  id: string;
  name: string;
  version: string;
  path: string;
  lineage: string[];
  reason?: string;
}): Promise<AIModelRegistryMutationResponse> {
  const result = await postJson<AIModelRegistryMutationResponse>('/ai-governance/model-registry/prompts', body);
  return assertMutationOk(result);
}

export interface AIPromptLineageDraftResponse {
  accepted?: boolean;
  draftId?: string;
  promptId?: string;
  eventType?: string;
  draftOnly?: boolean;
  message?: string;
  auditEventIds?: string[];
}

export interface AIPromptLineagePublishResponse {
  accepted?: boolean;
  draftId?: string;
  registeredId?: string;
  eventType?: string;
  auditId?: string;
  audited?: boolean;
  message?: string;
}

export async function draftPromptLineage(body: {
  id: string;
  name: string;
  version: string;
  path: string;
  lineage: string[];
  reason?: string;
  requestedBy?: string;
}): Promise<AIPromptLineageDraftResponse> {
  const session = getTenantContext();
  const result = await postJson<AIPromptLineageDraftResponse>(apiPaths.settings.promptLineageDrafts, {
    ...body,
    requestedBy: body.requestedBy ?? `${session.role}-operator`,
  });
  return assertMutationOk(result);
}

export async function publishPromptLineage(draftId: string): Promise<AIPromptLineagePublishResponse> {
  const result = await postJson<AIPromptLineagePublishResponse>(
    apiPaths.settings.publishPromptLineage(draftId),
    {},
  );
  return assertMutationOk(result);
}

export async function activateEmergencyWorkflow(body: {
  id: string;
  planId: string;
  scenario: string;
  severity: string;
  location: string;
  activatedBy: string;
  roles?: string[];
}) {
  return postJson('/emergency-operations/workflows', body);
}

export async function completeEmergencyCommunication(workflowId: string, body: {
  itemId: string;
  actor: string;
}) {
  return postJson(`/emergency-operations/workflows/${workflowId}/communications`, body);
}

export async function scheduleEmergencyDrill(body: {
  id: string;
  scenario: string;
  participants: string[];
}) {
  return postJson('/emergency-operations/drills', body);
}

export async function completeEmergencyDrill(drillId: string, body: {
  actor: string;
  workflowId?: string;
  observations?: string[];
}) {
  return postJson(`/emergency-operations/drills/${drillId}/complete`, body);
}

export async function createEmergencyAfterActionReport(body: {
  incidentId: string;
  actor: string;
  workflowId?: string;
  findings: Array<{ finding: string; severity: string; owner: string }>;
}) {
  return postJson('/emergency-operations/after-action-reports', body);
}

export async function createFacilitiesMaintenanceSchedule(body: Record<string, unknown>) {
  return postJson('/facilities-maintenance/maintenance-schedules', body);
}

export async function reportFacilitiesIncident(body: Record<string, unknown>) {
  return postJson('/facilities-maintenance/incidents', body);
}

export async function issueStewardFinalRuling(
  inquiryId: string,
  body: Omit<IssueStewardFinalRulingRequestDto, 'approvalToken'> & { approvalToken: ApprovalTokenPayload },
): Promise<StewardMutationResultDto> {
  const result = await postJson<StewardMutationResultDto>(apiPaths.stewarding.finalRuling(inquiryId), body);
  return assertMutationOk(result);
}

export async function createComplianceCorrectiveAction(body: {
  findingId: string;
  ownerId: string;
  action: string;
  dueAt: string;
  startWorkflow?: boolean;
  approvalRequestId?: string;
  actor?: string;
}) {
  const result = await postJson('/compliance/corrective-actions', body);
  return assertMutationOk(result);
}

export async function updateComplianceCorrectiveAction(
  correctiveActionId: string,
  body: {
    ownerId?: string;
    action?: string;
    dueAt?: string;
    status?: string;
    approvalRequestId?: string;
    actor?: string;
  },
) {
  const result = await postJson(
    `/compliance/corrective-actions/${encodeURIComponent(correctiveActionId)}/updates`,
    body,
  );
  return assertMutationOk(result);
}

export async function closeComplianceCorrectiveAction(
  correctiveActionId: string,
  body: { actor?: string; approvalRequestId?: string } = {},
) {
  const result = await postJson(
    `/compliance/corrective-actions/${encodeURIComponent(correctiveActionId)}/close`,
    body,
  );
  return assertMutationOk(result);
}

export async function deleteComplianceCorrectiveAction(
  correctiveActionId: string,
  body: { actor?: string } = {},
) {
  const result = await postJson(
    `/compliance/corrective-actions/${encodeURIComponent(correctiveActionId)}/delete`,
    body,
  );
  return assertMutationOk(result);
}

export async function simulateApprovalEscalation() {
  const result = await postJson<{ simulated?: boolean; message?: string }>(
    '/approvals/escalation/simulate',
    { reason: 'Operator-triggered escalation review from TrackMind console' },
  );
  return assertMutationOk(result);
}

export async function generateComplianceEvidencePacket() {
  const session = getTenantContext();
  const result = await postJson('/compliance/evidence-packets/generate', {
    tenantId: session.tenantId,
    racetrackId: session.racetrackId,
    packageType: 'audit-readiness',
    actor: `${session.role}-operator`,
    reason: 'Operator-requested evidence packet from compliance console',
  });
  return assertMutationOk(result);
}

export async function requestSurfaceOperationalAction(body: {
  action: string;
  sectorId: string;
  reason: string;
}) {
  const session = getTenantContext();
  const result = await postJson('/surface-intelligence/operational-actions', {
    ...body,
    tenantId: session.tenantId,
    racetrackId: session.racetrackId,
    requestedBy: `${session.role}-operator`,
  });
  return assertMutationOk(result);
}

export async function updateHorseEligibility(body: {
  horseId: string;
  status: string;
  reason: string;
}) {
  const result = await postJson(`/horses/${encodeURIComponent(body.horseId)}/eligibility`, {
    status: body.status,
    reason: body.reason,
    actor: getTenantContext().role,
  });
  return assertMutationOk(result);
}

export async function dispatchNotification(body: { title: string; message: string; category: string }) {
  const session = getTenantContext();
  const result = await postJson('/notifications/dispatch', {
    ...body,
    tenantId: session.tenantId,
    racetrackId: session.racetrackId,
    actor: `${session.role}-operator`,
  });
  return assertMutationOk(result);
}

export async function acknowledgeNotification(notificationId?: string) {
  const result = await postJson('/notifications/acknowledge', {
    notificationId: notificationId ?? 'latest',
    actor: `${getTenantContext().role}-operator`,
  });
  return assertMutationOk(result);
}

export async function completeWorkforceTask(taskId?: string) {
  const session = getTenantContext();
  const result = await postJson('/collaboration/assignments', {
    assignmentId: taskId ?? `task-${Date.now()}`,
    assignee: `${session.role}-operator`,
    status: 'completed',
    actor: `${session.role}-operator`,
    reason: 'Workforce task marked complete from console',
  });
  return assertMutationOk(result);
}

export async function syncDigitalTwinState(assetId = 'twin:main-track') {
  const result = await postJson('/racing-data/sync/digital-twins', {
    entityId: assetId,
    rationale: 'Operator-triggered digital twin sync draft from console',
  });
  return assertMutationOk(result);
}

export async function completeEmergencyChecklistItem(body: {
  itemId: string;
  workflowId?: string;
  actor?: string;
}) {
  const session = getTenantContext();
  const workflowId = body.workflowId ?? 'wf-fire-1';
  const result = await postJson(`/emergency-operations/workflows/${encodeURIComponent(workflowId)}/communications`, {
    itemId: body.itemId,
    actor: body.actor ?? `${session.role}-operator`,
  });
  return assertMutationOk(result);
}

export async function patchSecurityEscalation(body: {
  escalationId: string;
  assignee?: string;
  status?: string;
}) {
  const session = getTenantContext();
  const result = await postJson('/security-operations/events', {
    eventType: 'escalation-request',
    escalationId: body.escalationId,
    assignee: body.assignee ?? `${session.role}-operator`,
    status: body.status ?? 'acknowledged',
    tenantId: session.tenantId,
    racetrackId: session.racetrackId,
    actor: `${session.role}-operator`,
    summary: `Escalation ${body.escalationId} updated from console`,
  });
  return assertMutationOk(result);
}
