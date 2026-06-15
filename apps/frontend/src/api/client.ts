import { adapterSourceForPath, apiUrl, type ApiAdapterSource } from './paths';
import { defaultTenantContext } from '../domain/support';
import type { ApiResponse } from '@trackmind/shared';

export type AdapterStatus = 'loading' | 'ready' | 'empty' | 'error';
export type AdapterSource = ApiAdapterSource;

export interface AdapterResult<T> {
  status: AdapterStatus;
  source: AdapterSource;
  data?: T;
  message?: string;
  requestId?: string;
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
  const source = adapterSourceForPath(path);
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
      const body = await response.json().catch(() => undefined);
      const error = isRecord(body) && isRecord(body.error) ? body.error : undefined;
      const meta = isRecord(body) && isRecord(body.meta) ? body.meta : undefined;
      return {
        status: 'error',
        source,
        message: typeof error?.message === 'string' ? error.message : `${response.status} ${response.statusText}`,
        requestId: typeof error?.requestId === 'string' ? error.requestId : typeof meta?.requestId === 'string' ? meta.requestId : undefined,
      };
    }

    const body = await response.json();
    const data = isApiEnvelope<T>(body) ? body.data : body as T;
    if (Array.isArray(data) && data.length === 0) {
      return { status: 'empty', source, data, emptyReason: 'Backend returned an empty array.' };
    }

    return { status: 'ready', source, data };
  } catch (error) {
    return {
      status: 'error',
      source,
      message: error instanceof Error ? error.message : 'Unknown API adapter error',
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiEnvelope<T>(value: unknown): value is Extract<ApiResponse<T>, { ok: true }> {
  return typeof value === 'object' && value !== null && 'ok' in value && (value as { ok?: unknown }).ok === true && 'data' in value;
}
