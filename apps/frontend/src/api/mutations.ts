import { postJson } from './client';
import {
  assertMutationOk,
  buildApprovalDecisionBody,
  buildControlledActionBody,
  type ControlledActionInput,
} from './approvalPayload';

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

export async function requestTrackConfigDraft(input: ControlledActionInput): Promise<ControlledActionResponse> {
  const result = await postJson<ControlledActionResponse>(
    '/track-configuration/draft-requests',
    buildControlledActionBody(input),
  );
  return assertMutationOk(result);
}

export async function requestRaceStart(raceId: string, body: { approvalId: string; justification?: string }) {
  return postJson(`/races/${raceId}/start`, body);
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

export async function registerModelCard(body: {
  id: string;
  name: string;
  version: string;
  riskLevel: string;
  path: string;
  lastEvaluatedAt?: string;
}) {
  return postJson('/ai-governance/model-registry/models', body);
}

export async function registerPromptCard(body: {
  id: string;
  name: string;
  version: string;
  path: string;
  lineage: string[];
}) {
  return postJson('/ai-governance/model-registry/prompts', body);
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
