import type { TenantRacetrackContext } from '@trackmind/shared';
import { apiUrl } from './paths';
import { getTenantContext } from '@/auth/session';
import { isRecord } from '@/lib/utils';
import type { ApiAdapterSource } from './paths';
import { adapterSourceForPath } from './paths';

export type AdapterStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface AdapterResult<T> {
  status: AdapterStatus;
  source: ApiAdapterSource;
  data?: T;
  message?: string;
  requestId?: string;
  emptyReason?: string;
}

export interface ApiErrorBody {
  message: string;
  requestId?: string;
  status?: number;
}

const defaultRequestTimeoutMs = 8000;

function scopedPath(path: string): string {
  const tenantContext = getTenantContext();
  const url = new URL(path, 'https://trackmind.local');
  if (!url.searchParams.has('tenantId')) url.searchParams.set('tenantId', tenantContext.tenantId);
  if (!url.searchParams.has('racetrackId')) url.searchParams.set('racetrackId', tenantContext.racetrackId);
  if (!url.searchParams.has('organizationId')) url.searchParams.set('organizationId', tenantContext.organizationId);
  return `${url.pathname}${url.search}`;
}

function scopeHeaders(tenantContext: TenantRacetrackContext, init?: RequestInit): HeadersInit {
  return {
    Accept: 'application/json',
    'x-trackmind-request-id': `frontend-${Date.now()}`,
    'x-trackmind-tenant-id': tenantContext.tenantId,
    'x-trackmind-racetrack-id': tenantContext.racetrackId,
    'x-trackmind-organization-id': tenantContext.organizationId,
    'x-trackmind-role': tenantContext.role,
    ...(init?.headers ?? {}),
  };
}

function isApiEnvelope<T>(body: unknown): body is { data: T } {
  return isRecord(body) && 'data' in body;
}

function parseError(body: unknown, response: Response): ApiErrorBody {
  const error = isRecord(body) && isRecord(body.error) ? body.error : undefined;
  const meta = isRecord(body) && isRecord(body.meta) ? body.meta : undefined;
  return {
    message: typeof error?.message === 'string' ? error.message : `${response.status} ${response.statusText}`,
    requestId: typeof error?.requestId === 'string' ? error.requestId : typeof meta?.requestId === 'string' ? meta.requestId : undefined,
    status: response.status,
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<AdapterResult<T>> {
  const tenantContext = getTenantContext();
  const source = adapterSourceForPath(path);
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new Error(`Request timed out after ${defaultRequestTimeoutMs}ms`)), defaultRequestTimeoutMs);
  const abortFromCaller = () => timeoutController.abort(init?.signal?.reason);
  if (init?.signal?.aborted) abortFromCaller();
  init?.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(apiUrl(scopedPath(path)), {
      ...init,
      signal: timeoutController.signal,
      headers: scopeHeaders(tenantContext, init),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      const error = parseError(body, response);
      return { status: 'error', source, message: error.message, requestId: error.requestId };
    }

    const body = await response.json();
    const data = isApiEnvelope<T>(body) ? body.data : (body as T);
    if (Array.isArray(data) && data.length === 0) {
      return { status: 'empty', source, data, emptyReason: 'Backend returned an empty array.' };
    }
    return { status: 'ready', source, data };
  } catch (error) {
    return {
      status: 'error',
      source,
      message: timeoutController.signal.aborted && !init?.signal?.aborted
        ? `Backend unavailable or timed out after ${defaultRequestTimeoutMs}ms`
        : error instanceof Error ? error.message : 'Unknown API adapter error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getJson<T>(path: string, init?: RequestInit): Promise<AdapterResult<T>> {
  return requestJson<T>(path, { ...init, method: 'GET' });
}

export async function postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<AdapterResult<T>> {
  return requestJson<T>(path, {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
  });
}

export async function patchJson<T>(path: string, body: unknown, init?: RequestInit): Promise<AdapterResult<T>> {
  return requestJson<T>(path, {
    ...init,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
  });
}

