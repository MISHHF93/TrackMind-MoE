import { loadCommandCenter } from '../App.js';
import { createNexusClient, type NexusApiClient, type NexusApiClientContext } from './client.js';
import { defaultApiRequestPolicy, freshnessFor, withRetry, type ApiFreshness, type ApiRequestPolicy } from './requestPolicy.js';

export interface TypedNexusApi {
  readonly client: NexusApiClient;
  readonly policy: ApiRequestPolicy;
  loadDashboard(): Promise<{ data: Awaited<ReturnType<typeof loadCommandCenter>>; freshness: ApiFreshness }>;
}

export interface TypedNexusApiOptions {
  live: boolean;
  baseUrl?: string;
  context?: NexusApiClientContext;
  policy?: Partial<ApiRequestPolicy>;
}

export function createTypedNexusApi(options: TypedNexusApiOptions): TypedNexusApi {
  const policy = { ...defaultApiRequestPolicy, ...(options.policy ?? {}) };
  const client = createNexusClient(options.live, options.baseUrl, options.context);
  return {
    client,
    policy,
    async loadDashboard() {
      const data = await withRetry(() => loadCommandCenter(client), policy);
      return {
        data,
        freshness: freshnessFor(data.mode, new Date().toISOString(), policy),
      };
    },
  };
}

export async function loadDashboardWithFallback(options: Omit<TypedNexusApiOptions, 'live'>) {
  try {
    return await createTypedNexusApi({ ...options, live: true }).loadDashboard();
  } catch {
    return createTypedNexusApi({ ...options, live: false, baseUrl: undefined }).loadDashboard();
  }
}
