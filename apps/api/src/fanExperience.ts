import type {
  FanExperienceOperationsDto,
  FanExperienceRequestResultDto,
  FanExperienceTicketingConnectorDto,
  TicketingAdapterRegistry,
} from '@trackmind/shared';
import type { FanExperiencePlatform } from './fanExperiencePlatform.js';
import type { ImmutableAuditLog } from './auditLog.js';

type HttpMethod = 'GET' | 'POST';
type HandlerResult = { status: number; body: unknown } | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const auditId = () => `audit-ticketing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface FanExperienceApiOptions {
  ticketing?: TicketingAdapterRegistry;
  auditLog?: ImmutableAuditLog;
}

function sourceLabel(degraded: boolean, connected: boolean): FanExperienceTicketingConnectorDto['inventorySource'] {
  if (!connected) return 'platform';
  return degraded ? 'degraded-connector' : 'connector';
}

function enrichWorkspaceWithTicketingConnector(
  workspace: FanExperienceOperationsDto,
  options: FanExperienceApiOptions | undefined,
  now: string,
): FanExperienceOperationsDto {
  const ticketing = options?.ticketing;
  if (!ticketing) {
    return {
      ...workspace,
      ticketingConnector: {
        overallStatus: 'disconnected',
        degraded: true,
        adapters: [],
        lastSyncAt: now,
        inventorySource: 'platform',
        attendanceSource: 'platform',
        syncAuditIds: [],
      },
    };
  }

  const snapshot = ticketing.syncAll(now);
  const syncAuditIds: string[] = [];
  const connected = snapshot.overallStatus === 'connected' || snapshot.overallStatus === 'degraded';
  const inventorySource = sourceLabel(snapshot.degraded, connected);
  const attendanceSource = sourceLabel(snapshot.degraded, connected);

  if (options?.auditLog) {
    const id = auditId();
    options.auditLog.append({
      id,
      type: 'data-change',
      actor: 'ticketing-connector',
      timestamp: now,
      subjectId: workspace.racetrackId,
      payload: {
        action: 'fan-experience.ticketing.sync',
        overallStatus: snapshot.overallStatus,
        degraded: snapshot.degraded,
        inventorySource,
        attendanceSource,
        adapters: snapshot.adapters.map((adapter) => adapter.adapterId),
      },
      tenantId: workspace.tenantId,
      severity: snapshot.degraded ? 'warning' : 'info',
      regulations: ['SOC-2'],
    });
    syncAuditIds.push(id);
  }

  let ticketInventory = workspace.ticketInventory;
  let attendance = workspace.attendance;
  let attendanceTracking = workspace.attendanceTracking;

  if (connected && snapshot.inventory) {
    ticketInventory = {
      available: snapshot.inventory.available,
      sold: snapshot.inventory.sold,
      held: snapshot.inventory.held,
    };
  }
  if (connected && snapshot.attendance) {
    const utilizationPercent = Math.round((snapshot.attendance.current / snapshot.attendance.capacity) * 100);
    attendance = {
      current: snapshot.attendance.current,
      capacity: snapshot.attendance.capacity,
      utilizationPercent,
    };
    attendanceTracking = {
      ...workspace.attendanceTracking,
      current: snapshot.attendance.current,
      capacity: snapshot.attendance.capacity,
      utilizationPercent,
    };
  }

  return {
    ...workspace,
    ticketInventory,
    attendance,
    attendanceTracking,
    ticketingConnector: {
      overallStatus: snapshot.overallStatus,
      degraded: snapshot.degraded,
      adapters: snapshot.adapters,
      lastSyncAt: snapshot.generatedAt,
      inventorySource,
      attendanceSource,
      syncAuditIds,
    },
  };
}

export type FanExperienceRequestType =
  | 'refund'
  | 'parking'
  | 'parking-pass'
  | 'crowd-density'
  | 'crowd-density-alert'
  | 'accessibility';

function guestServiceCategory(type: string): 'accessibility' | 'parking' | 'crowd-density' | 'refund' | 'guest-relations' {
  if (type === 'accessibility') return 'accessibility';
  if (type === 'parking' || type === 'parking-pass') return 'parking';
  if (type === 'crowd-density' || type === 'crowd-density-alert') return 'crowd-density';
  if (type === 'refund') return 'refund';
  return 'guest-relations';
}

export function handleFanExperienceRequest(
  service: FanExperiencePlatform,
  type: FanExperienceRequestType,
  payload: Record<string, unknown>,
  now: string,
  actor = 'ticketing-manager',
): FanExperienceRequestResultDto {
  const category = guestServiceCategory(type);
  const result = service.createGuestServiceRequest(
    {
      category,
      status: 'open',
      priority: category === 'refund' ? 'high' : 'medium',
      submittedAt: now,
      guestLabel: String(payload.guestLabel ?? 'Guest'),
      zone: payload.zone ? String(payload.zone) : undefined,
      waitMinutes: Number(payload.waitMinutes ?? 0),
      details: String(payload.details ?? `${type} request draft`),
    },
    actor,
  );
  return {
    ok: true,
    requestId: result.requestId ?? result.auditId,
    type,
    status: 'draft-created',
    mock: false,
  };
}

export function handleFanExperienceApiRequest(
  method: HttpMethod,
  path: string,
  body: unknown,
  service: FanExperiencePlatform,
  searchParams: URLSearchParams,
  now: () => string,
  options?: FanExperienceApiOptions,
): HandlerResult {
  if (method === 'GET' && path === '/fan-experience/workspace') {
    const workspace = enrichWorkspaceWithTicketingConnector(service.workspace(now()), options, now());
    return { status: 200, body: workspace };
  }
  if (method === 'GET' && path === '/fan-experience/dashboard') {
    const workspace = enrichWorkspaceWithTicketingConnector(service.workspace(now()), options, now());
    return { status: 200, body: workspace.dashboard };
  }
  if (method === 'GET' && path === '/fan-experience/audit-trail') {
    const eventId = searchParams.get('eventId') ?? undefined;
    return { status: 200, body: service.auditTrail(eventId, now()) };
  }
  if (method === 'GET' && path === '/fan-experience/attendance') {
    const workspace = enrichWorkspaceWithTicketingConnector(service.workspace(now()), options, now());
    return {
      status: 200,
      body: {
        generatedAt: workspace.generatedAt,
        attendance: workspace.attendance,
        attendanceTracking: workspace.attendanceTracking,
        crowdDensity: workspace.crowdDensity,
        ticketingConnector: workspace.ticketingConnector,
        mock: false,
      },
    };
  }
  if (method === 'GET' && path === '/fan-experience/capacity') {
    const workspace = enrichWorkspaceWithTicketingConnector(service.workspace(now()), options, now());
    return {
      status: 200,
      body: {
        generatedAt: workspace.generatedAt,
        capacity: workspace.attendance.capacity,
        current: workspace.attendance.current,
        utilizationPercent: workspace.attendance.utilizationPercent,
        ticketInventory: workspace.ticketInventory,
        zones: workspace.attendanceTracking.zones,
        ticketingConnector: workspace.ticketingConnector,
        mock: false,
      },
    };
  }
  if (method === 'POST' && path === '/fan-experience/attendance-snapshots') {
    const input = isRecord(body) ? body : {};
    return {
      status: 201,
      body: service.recordAttendanceSnapshot(
        {
          recordedAt: String(input.recordedAt ?? now()),
          current: Number(input.current ?? 0),
          capacity: Number(input.capacity ?? 12000),
          entryRatePerMinute: Number(input.entryRatePerMinute ?? 0),
        },
        String(input.actor ?? 'ticketing-manager'),
      ),
    };
  }
  if (method === 'POST' && path === '/fan-experience/guest-services') {
    const input = isRecord(body) ? body : {};
    return {
      status: 201,
      body: service.createGuestServiceRequest(
        {
          category: (input.category as 'guest-relations' | undefined) ?? 'guest-relations',
          status: (input.status as 'open' | undefined) ?? 'open',
          priority: (input.priority as 'medium' | undefined) ?? 'medium',
          submittedAt: String(input.submittedAt ?? now()),
          guestLabel: String(input.guestLabel ?? 'Guest'),
          zone: input.zone ? String(input.zone) : undefined,
          waitMinutes: Number(input.waitMinutes ?? 0),
          details: String(input.details ?? 'Guest service request'),
        },
        String(input.actor ?? 'ticketing-manager'),
      ),
    };
  }
  const guestServiceStatusMatch = path.match(/^\/fan-experience\/guest-services\/([^/]+)\/status$/);
  if (method === 'POST' && guestServiceStatusMatch) {
    const input = isRecord(body) ? body : {};
    return {
      status: 202,
      body: service.updateGuestServiceStatus(
        decodeURIComponent(guestServiceStatusMatch[1]),
        (input.status as 'in-progress' | undefined) ?? 'in-progress',
        String(input.actor ?? 'ticketing-manager'),
      ),
    };
  }
  if (method === 'POST' && path === '/fan-experience/satisfaction-surveys') {
    const input = isRecord(body) ? body : {};
    return {
      status: 201,
      body: service.recordSatisfactionSurvey(
        {
          eventId: String(input.eventId ?? 'race-day-main'),
          submittedAt: String(input.submittedAt ?? now()),
          overallRating: Number(input.overallRating ?? 4),
          categories: Array.isArray(input.categories) ? input.categories : [],
          comment: input.comment ? String(input.comment) : undefined,
        },
        String(input.actor ?? 'ticketing-manager'),
      ),
    };
  }
  const hospitalityIssueMatch = path.match(/^\/fan-experience\/hospitality\/([^/]+)\/issues$/);
  if (method === 'POST' && hospitalityIssueMatch) {
    const input = isRecord(body) ? body : {};
    return {
      status: 201,
      body: service.recordHospitalityIssue(
        decodeURIComponent(hospitalityIssueMatch[1]),
        String(input.issue ?? 'Hospitality issue reported'),
        String(input.actor ?? 'ticketing-manager'),
      ),
    };
  }
  const hospitalityResolveMatch = path.match(/^\/fan-experience\/hospitality\/([^/]+)\/resolve$/);
  if (method === 'POST' && hospitalityResolveMatch) {
    return {
      status: 202,
      body: service.resolveHospitalityIssue(
        decodeURIComponent(hospitalityResolveMatch[1]),
        String(isRecord(body) ? body.actor ?? 'ticketing-manager' : 'ticketing-manager'),
      ),
    };
  }
  const premiumSeatingMatch = path.match(/^\/fan-experience\/premium-seating\/([^/]+)$/);
  if (method === 'POST' && premiumSeatingMatch) {
    const input = isRecord(body) ? body : {};
    return {
      status: 202,
      body: service.updatePremiumSeating(
        decodeURIComponent(premiumSeatingMatch[1]),
        {
          seatsSold: input.seatsSold !== undefined ? Number(input.seatsSold) : undefined,
          seatsHeld: input.seatsHeld !== undefined ? Number(input.seatsHeld) : undefined,
          status: input.status as 'available' | 'sold-out' | 'held' | 'comp' | undefined,
          revenueToday: input.revenueToday !== undefined ? Number(input.revenueToday) : undefined,
        },
        String(input.actor ?? 'ticketing-manager'),
      ),
    };
  }
  if (method === 'POST' && path === '/fan-experience/requests') {
    const input = isRecord(body) ? body : {};
    const type = String(input.type ?? 'refund') as FanExperienceRequestType;
    return {
      status: 202,
      body: handleFanExperienceRequest(service, type, input, now(), String(input.actor ?? 'ticketing-manager')),
    };
  }
  return undefined;
}
