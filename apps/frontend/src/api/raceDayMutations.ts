import type { RaceDayQuickEntryPayload, RaceDayQuickEntryResult } from '@trackmind/shared';
import { getTenantContext } from '@/auth/session';
import { postJson } from './client';
import { assertMutationOk } from './approvalPayload';
import { createControlledAction } from './mutations';
import { requestStartingGateRaceStartApproval } from './mutations';

function actorId(): string {
  const session = getTenantContext();
  return `${session.role}-operator`;
}

function evidence(tag: string): string[] {
  return ['race-day-quick-entry', tag];
}

async function postRaceDay<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return assertMutationOk(await postJson<T>(path, { ...body, actor: actorId(), evidence: evidence(path) }));
}

export async function submitRaceDayQuickEntry(payload: RaceDayQuickEntryPayload): Promise<RaceDayQuickEntryResult> {
  const { action, status, context, note, optionPayload = {} } = payload;
  const raceId = context.raceId;
  const horseId = context.horseId;
  const actor = actorId();

  if (action === 'paddock-check-in' && horseId) {
    const body = await postRaceDay<Record<string, unknown>>('/paddock-operations/assignments', {
      horseId,
      horseName: context.horseName,
      raceId,
      raceCardId: context.raceCardId,
      entryId: context.entryId,
      saddleCloth: context.saddleCloth ?? 0,
      paddockSlot: `SLOT-${context.saddleCloth ?? context.postPosition ?? 1}`,
      postPosition: context.postPosition,
      status,
      assignedAt: new Date().toISOString(),
    });
    return { accepted: true, message: `Check-in: ${status}`, auditId: body.auditId ? String(body.auditId) : undefined };
  }

  if (action === 'horse-arrival' && horseId) {
    const body = await postRaceDay<Record<string, unknown>>('/paddock-operations/arrivals', {
      horseId,
      horseName: context.horseName,
      raceId,
      expectedAt: new Date().toISOString(),
      arrivedAt: status === 'arrived' || status === 'late' ? new Date().toISOString() : undefined,
      fromLocation: optionPayload.fromLocation ?? 'barn',
      status,
    });
    return { accepted: true, message: `Arrival: ${status}`, auditId: body.auditId ? String(body.auditId) : undefined };
  }

  if (action === 'readiness-update') {
    const domain = String(optionPayload.domain ?? 'horse');
    const readinessStatus = status === 'gate-ready' ? 'ready' : status === 'parade-ready' ? 'ready' : status;
    const body = await postRaceDay<Record<string, unknown>>('/paddock-operations/readiness-checks', {
      horseId,
      raceId,
      checkedAt: new Date().toISOString(),
      checkedBy: actor,
      domain: domain === 'gate-ready' ? 'gate' : domain === 'parade-ready' ? 'parade' : domain,
      status: readinessStatus,
      score: Number(optionPayload.score ?? (readinessStatus === 'ready' ? 95 : readinessStatus === 'watch' ? 75 : 40)),
      blockers: readinessStatus === 'blocked' ? [note ?? 'Blocked by operator'] : [],
    });
    return { accepted: true, message: `Readiness: ${status}`, auditId: body.auditId ? String(body.auditId) : undefined };
  }

  if (action === 'incident-report') {
    const body = await postRaceDay<Record<string, unknown>>('/paddock-operations/incidents', {
      raceId,
      horseId,
      reportedAt: new Date().toISOString(),
      reportedBy: actor,
      severity: status,
      status: 'open',
      title: note?.trim() ? note.trim().slice(0, 120) : `Race-day incident (${status})`,
      summary: note?.trim() || `Incident reported from race-day console (${status}).`,
    });
    return { accepted: true, message: 'Incident reported', auditId: body.auditId ? String(body.auditId) : undefined };
  }

  if (action === 'steward-note') {
    if (status === 'inquiry' || status === 'ruling-pending') {
      const body = await postRaceDay<Record<string, unknown>>('/steward-operations/inquiries', {
        raceId,
        horseId,
        title: note?.trim() || `Steward ${status.replace('-', ' ')}`,
        summary: note?.trim() || `Quick steward note from race-day console (${status}).`,
        category: status,
      });
      return { accepted: true, message: 'Steward inquiry opened', auditId: body.auditId ? String(body.auditId) : undefined };
    }
    const body = await postRaceDay<Record<string, unknown>>('/data-entry/submit/audit-note', {
      mode: 'create',
      values: {
        entityId: horseId ?? raceId,
        entityKind: horseId ? 'horse' : 'race',
        note: note?.trim() || `Steward observation: ${status}`,
        classification: 'internal',
        reason: 'Race-day steward field note',
        tenantId: getTenantContext().tenantId,
        racetrackId: getTenantContext().racetrackId,
      },
    });
    return { accepted: true, message: 'Steward note recorded', auditId: body.auditId ? String(body.auditId) : undefined };
  }

  if (action === 'gate-delay') {
    const body = await postRaceDay<Record<string, unknown>>('/starting-gate-operations/delays', {
      raceId,
      reportedAt: new Date().toISOString(),
      reportedBy: actor,
      reason: note?.trim() || String(optionPayload.reason ?? 'Gate delay'),
      estimatedMinutes: Number(optionPayload.estimatedMinutes ?? 5),
      status: 'active',
    });
    return {
      accepted: true,
      message: 'Gate delay reported',
      auditId: body.auditId ? String(body.auditId) : undefined,
      approvalRequired: Boolean(body.approvalRequired),
      approvalRequestId: body.approvalRequestId ? String(body.approvalRequestId) : undefined,
    };
  }

  if (action === 'surface-observation') {
    const body = await postRaceDay<Record<string, unknown>>('/surface-intelligence/observations', {
      sectionId: 'stretch',
      observedAt: new Date().toISOString(),
      observerId: actor,
      role: getTenantContext().role,
      severity: Number(optionPayload.severity ?? 3),
      note: note?.trim() || String(optionPayload.note ?? `Surface: ${status}`),
    });
    return { accepted: true, message: `Surface: ${status}`, auditId: body.auditId ? String(body.auditId) : undefined };
  }

  if (action === 'compliance-flag' && horseId) {
    const body = await postRaceDay<Record<string, unknown>>('/paddock-operations/inspections', {
      horseId,
      raceId,
      inspectedAt: new Date().toISOString(),
      inspectorId: actor,
      inspectionType: optionPayload.inspectionType ?? 'general',
      status: optionPayload.status ?? 'failed',
      findings: [note?.trim() || `Compliance flag: ${status}`],
    });
    return { accepted: true, message: `Compliance flag: ${status}`, auditId: body.auditId ? String(body.auditId) : undefined };
  }

  if (action === 'approval-request') {
    const protectedAction = String(optionPayload.protectedAction ?? status);
    const target = horseId ?? raceId;
    if (protectedAction === 'race-start') {
      const body = await requestStartingGateRaceStartApproval(raceId, {
        reason: note?.trim() || 'Race start approval from race-day console',
        evidence: evidence('approval-race-start'),
      });
      return {
        accepted: true,
        message: body.message ?? 'Approval requested',
        approvalRequired: true,
        approvalRequestId: body.approvalRequestId,
      };
    }
    const response = await createControlledAction({
      action: protectedAction,
      target,
      reason: note?.trim() || `Race-day approval: ${protectedAction}`,
      evidence: evidence('approval-request'),
    });
    return {
      accepted: true,
      message: response.message ?? 'Approval requested',
      approvalRequired: true,
      approvalRequestId: response.approvalId,
    };
  }

  throw new Error(`Unable to submit ${action}`);
}
