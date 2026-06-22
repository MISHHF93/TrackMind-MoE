import type { RaceOperationsService } from '../application/raceOperationsService.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse => ({
  status,
  body,
  headers: { 'content-type': 'application/json', ...headers },
});

export function handleRaceOperationsRequest(
  method: HttpMethod,
  pathname: string,
  service: RaceOperationsService,
  startedAt: string,
): HttpResponse | undefined {
  if (method === 'GET' && pathname === '/health') {
    return json(200, { status: 'healthy', service: 'race-operations-service', checkedAt: startedAt });
  }
  if (method === 'GET' && pathname === '/ready') {
    return json(200, { status: 'ready', boundedContext: service.boundedContext, tenantScope: service.tenantScope, checkedAt: startedAt });
  }
  if (method === 'GET' && pathname === '/live') {
    return json(200, { status: 'alive', checkedAt: startedAt });
  }
  if (method === 'GET' && pathname === '/metrics') {
    return json(200, {
      service: 'race-operations-service',
      boundedContext: service.boundedContext,
      readModels: ['race-office', 'dashboard', 'races'],
      checkedAt: startedAt,
    });
  }
  if (method === 'GET' && pathname === '/race-office') {
    return json(200, service.raceOfficeWorkspace(startedAt, false));
  }
  if (method === 'GET' && pathname === '/dashboard') {
    return json(200, service.operationalDashboard(startedAt));
  }
  if (method === 'GET' && pathname === '/races') {
    return json(200, service.listRaces());
  }
  const raceReportMatch = pathname.match(/^\/races\/([^/]+)\/report$/);
  if (method === 'GET' && raceReportMatch) {
    return json(200, service.operationalReport(decodeURIComponent(raceReportMatch[1])));
  }
  const raceMatch = pathname.match(/^\/races\/([^/]+)$/);
  if (method === 'GET' && raceMatch) {
    return json(200, service.getRace(decodeURIComponent(raceMatch[1])));
  }
  return undefined;
}
