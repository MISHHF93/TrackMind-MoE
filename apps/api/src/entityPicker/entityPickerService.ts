import type { Role } from '@trackmind/shared';
import {
  canAccessEntityPickerKind,
  filterEntityPickerItems,
  getEntityPickerKindDefinition,
  listAccessibleEntityPickerKinds,
  type EntityPickerItem,
  type EntityPickerKind,
  type EntityPickerSearchResponse,
} from '@trackmind/shared';
import type { CompliancePlatformService } from '../compliance/compliancePlatformService.js';
import type { IdentityService } from '../platform/identityService.js';
import type { RacingCalendarPlatform } from '../racingCalendarPlatform.js';
import type { RacingKnowledgeGraphPlatform } from '../racingKnowledgeGraphPlatform.js';
import { createFederationWorkspace } from '../federation.js';

const now = () => new Date().toISOString();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface EntityPickerServiceDeps {
  tenantId: string;
  racetrackId: string;
  knowledgeGraph: RacingKnowledgeGraphPlatform;
  racingCalendar?: RacingCalendarPlatform;
  identity?: IdentityService;
  compliancePlatform?: CompliancePlatformService;
  racingDataPolicies?: Record<string, unknown>;
  auditEvents?: Array<Record<string, unknown>>;
}

export class EntityPickerService {
  constructor(private readonly deps: EntityPickerServiceDeps) {}

  listKinds(role: Role) {
    return {
      schemaVersion: 'trackmind.entity-picker.v1' as const,
      kinds: listAccessibleEntityPickerKinds(role).map((definition) => ({
        kind: definition.kind,
        label: definition.label,
        pluralLabel: definition.pluralLabel,
        description: definition.description,
      })),
      generatedAt: now(),
    };
  }

  search(input: {
    kind: EntityPickerKind;
    query: string;
    role: Role;
    limit?: number;
  }): EntityPickerSearchResponse {
    const definition = getEntityPickerKindDefinition(input.kind);
    if (!canAccessEntityPickerKind(input.kind, input.role)) {
      return {
        schemaVersion: 'trackmind.entity-picker.v1',
        kind: input.kind,
        query: input.query,
        results: [],
        total: 0,
        generatedAt: now(),
        permissionDenied: true,
      };
    }

    const limit = Math.max(1, Math.min(input.limit ?? definition.browseLimit, 50));
    const items = this.collectItems(input.kind);
    const filtered = filterEntityPickerItems(items, input.query, limit);

    return {
      schemaVersion: 'trackmind.entity-picker.v1',
      kind: input.kind,
      query: input.query,
      results: filtered,
      total: filtered.length,
      generatedAt: now(),
    };
  }

  private collectItems(kind: EntityPickerKind): EntityPickerItem[] {
    const { tenantId, racetrackId } = this.deps;

    if (definitionUsesGraph(kind)) {
      const graphKind = getEntityPickerKindDefinition(kind).graphKind!;
      const graph = this.deps.knowledgeGraph.search('', now());
      return graph.results
        .filter((result) => result.kind === graphKind)
        .map((result) => ({
          id: result.nodeId,
          kind,
          label: result.label,
          subtitle: result.path,
          path: result.path,
          tenantId,
          racetrackId,
          score: result.score,
        }));
    }

    switch (kind) {
      case 'race-day':
        return this.collectRaceDays();
      case 'user':
        return this.collectUsers();
      case 'policy':
        return this.collectPolicies();
      case 'audit-record':
        return this.collectAuditRecords();
      case 'federation-participant':
        return this.collectFederationParticipants();
      case 'compliance-evidence':
        return this.collectComplianceEvidence();
      case 'security-event':
        return this.collectSecurityEvents();
      default:
        return [];
    }
  }

  private collectRaceDays(): EntityPickerItem[] {
    const { tenantId, racetrackId } = this.deps;
    const workspace = this.deps.racingCalendar?.workspace(now());
    const raceDays = isRecord(workspace) && Array.isArray(workspace.raceDays)
      ? workspace.raceDays as Array<{ id?: string; meetId?: string; racetrackId?: string; raceDate?: string; status?: string }>
      : [];
    return raceDays
      .filter((day) => String(day.racetrackId ?? racetrackId) === racetrackId)
      .map((day) => ({
        id: String(day.id ?? ''),
        kind: 'race-day' as const,
        label: String(day.raceDate ?? day.id ?? 'Race day'),
        subtitle: day.meetId ? `Meet ${String(day.meetId)}` : undefined,
        status: day.status != null ? String(day.status) : undefined,
        path: `/racing-calendar/race-days/${String(day.id ?? '')}`,
        tenantId,
        racetrackId: String(day.racetrackId ?? racetrackId),
        score: 0.7,
      }))
      .filter((item) => item.id);
  }

  private collectUsers(): EntityPickerItem[] {
    const { tenantId, racetrackId } = this.deps;
    const users = this.deps.identity?.listUsers(tenantId) ?? [];
    return users.map((user) => ({
      id: user.id,
      kind: 'user' as const,
      label: user.displayName,
      subtitle: user.email,
      status: user.status,
      path: `/identity/users/${user.id}`,
      tenantId: user.tenantId,
      racetrackId,
      score: 0.7,
    }));
  }

  private collectPolicies(): EntityPickerItem[] {
    const { tenantId, racetrackId } = this.deps;
    const items: EntityPickerItem[] = [];

    const compliancePolicies = this.deps.compliancePlatform?.policyRegistry() ?? [];
    for (const policy of compliancePolicies) {
      if (!isRecord(policy)) continue;
      items.push({
        id: String(policy.id ?? policy.controlId ?? policy.policyId ?? ''),
        kind: 'policy',
        label: String(policy.title ?? policy.name ?? policy.controlId ?? 'Policy'),
        subtitle: policy.frameworkId != null ? String(policy.frameworkId) : undefined,
        status: policy.status != null ? String(policy.status) : undefined,
        path: `/compliance/policies/${String(policy.id ?? policy.controlId ?? '')}`,
        tenantId,
        racetrackId,
        score: 0.72,
      });
    }

    const licensePolicies = isRecord(this.deps.racingDataPolicies) && Array.isArray(this.deps.racingDataPolicies.policies)
      ? this.deps.racingDataPolicies.policies as Array<Record<string, unknown>>
      : [];
    for (const policy of licensePolicies) {
      items.push({
        id: String(policy.policyId ?? policy.id ?? ''),
        kind: 'policy',
        label: String(policy.name ?? policy.policyId ?? 'License policy'),
        subtitle: policy.providerId != null ? String(policy.providerId) : 'Racing data license',
        status: policy.status != null ? String(policy.status) : undefined,
        path: `/racing-data/license-policies/${String(policy.policyId ?? policy.id ?? '')}`,
        tenantId,
        racetrackId,
        score: 0.68,
      });
    }

    return items.filter((item) => item.id);
  }

  private collectAuditRecords(): EntityPickerItem[] {
    const { tenantId, racetrackId } = this.deps;
    return (this.deps.auditEvents ?? []).map((event) => ({
      id: String(event.id ?? event.auditId ?? ''),
      kind: 'audit-record' as const,
      label: String(event.type ?? event.action ?? event.id ?? 'Audit event'),
      subtitle: event.actorId ? String(event.actorId) : undefined,
      status: event.severity ? String(event.severity) : undefined,
      path: `/audit/events/${String(event.id ?? '')}`,
      tenantId,
      racetrackId,
      score: 0.7,
    })).filter((item) => item.id);
  }

  private collectFederationParticipants(): EntityPickerItem[] {
    const { tenantId, racetrackId } = this.deps;
    const workspace = createFederationWorkspace();
    return workspace.tracks.map((track) => ({
      id: String(track.racetrackId),
      kind: 'federation-participant' as const,
      label: String(track.displayName),
      subtitle: String(track.sharingScope ?? 'tenant-only'),
      status: String(track.certificationStatus ?? 'candidate'),
      path: `/federation/tracks/${String(track.racetrackId)}`,
      tenantId: String(track.tenantId ?? tenantId),
      racetrackId: String(track.racetrackId ?? racetrackId),
      score: 0.72,
    }));
  }

  private collectComplianceEvidence(): EntityPickerItem[] {
    const { tenantId, racetrackId } = this.deps;
    const controls = this.deps.compliancePlatform?.policyRegistry?.() ?? [];
    const items: EntityPickerItem[] = [];
    for (const control of controls.slice(0, 24)) {
      if (!isRecord(control)) continue;
      const id = String(control.controlId ?? control.id ?? '');
      if (!id) continue;
      items.push({
        id,
        kind: 'compliance-evidence',
        label: String(control.title ?? control.name ?? id),
        subtitle: control.frameworkId ? String(control.frameworkId) : 'Control library',
        status: control.status ? String(control.status) : undefined,
        path: `/compliance/controls/${id}`,
        tenantId,
        racetrackId,
        score: 0.68,
      });
    }
    return items;
  }

  private collectSecurityEvents(): EntityPickerItem[] {
    const { tenantId, racetrackId } = this.deps;
    const graph = this.deps.knowledgeGraph.search('', now());
    return graph.results
      .filter((result) => result.kind === 'incident')
      .map((result) => ({
        id: result.nodeId,
        kind: 'security-event' as const,
        label: result.label,
        subtitle: 'Security-linked incident',
        path: result.path,
        tenantId,
        racetrackId,
        score: result.score,
      }));
  }
}

function definitionUsesGraph(kind: EntityPickerKind): boolean {
  return Boolean(getEntityPickerKindDefinition(kind).graphKind);
}

export function createEntityPickerService(deps: EntityPickerServiceDeps): EntityPickerService {
  return new EntityPickerService(deps);
}
