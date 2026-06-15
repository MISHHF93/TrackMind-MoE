import { apiUrl } from './paths';
import { defaultTenantContext } from '../domain/support';

export type AdapterStatus = 'loading' | 'ready' | 'empty' | 'error';
export type AdapterSource = 'live-api' | 'facade-api' | 'documented-stub' | 'mock-adapter';

export interface AdapterResult<T> {
  status: AdapterStatus;
  source: AdapterSource;
  data?: T;
  message?: string;
  emptyReason?: string;
}

function scopedPath(path: string): string {
  const url = new URL(path, 'https://trackmind.local');
  if (!url.searchParams.has('tenantId')) url.searchParams.set('tenantId', defaultTenantContext.tenantId);
  if (!url.searchParams.has('racetrackId')) url.searchParams.set('racetrackId', defaultTenantContext.racetrackId);
  if (!url.searchParams.has('organizationId')) url.searchParams.set('organizationId', defaultTenantContext.organizationId);
  return `${url.pathname}${url.search}`;
}

export async function getJson<T>(path: string, init?: RequestInit): Promise<AdapterResult<T>> {
  try {
    const response = await fetch(apiUrl(scopedPath(path)), {
      ...init,
      headers: {
        Accept: 'application/json',
        'x-trackmind-request-id': `frontend-${Date.now()}`,
        'x-trackmind-tenant-id': defaultTenantContext.tenantId,
        'x-trackmind-racetrack-id': defaultTenantContext.racetrackId,
        'x-trackmind-organization-id': defaultTenantContext.organizationId,
        'x-trackmind-role': defaultTenantContext.role,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      return { status: 'error', source: 'live-api', message: `${response.status} ${response.statusText}` };
    }

    const data = (await response.json()) as T;
    if (Array.isArray(data) && data.length === 0) {
      return { status: 'empty', source: 'live-api', data, emptyReason: 'Backend returned an empty array.' };
    }

    return { status: 'ready', source: 'live-api', data };
  } catch (error) {
    return {
      status: 'error',
      source: 'live-api',
      message: error instanceof Error ? error.message : 'Unknown API adapter error',
    };
  }
}

export function ready<T>(source: AdapterSource, data: T): AdapterResult<T> {
  return { status: Array.isArray(data) && data.length === 0 ? 'empty' : 'ready', source, data };
}
