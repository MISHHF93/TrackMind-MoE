export interface ApiRequestPolicy {
  retries: number;
  retryDelayMs: number;
  staleAfterMs: number;
  timeoutMs: number;
}

export interface ApiFreshness {
  loadedAt: string;
  staleAt: string;
  stale: boolean;
  source: 'live' | 'mock';
}

export const defaultApiRequestPolicy: ApiRequestPolicy = {
  retries: 1,
  retryDelayMs: 250,
  staleAfterMs: 5 * 60 * 1000,
  timeoutMs: 10 * 1000,
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(load: () => Promise<T>, policy: Pick<ApiRequestPolicy, 'retries' | 'retryDelayMs'> = defaultApiRequestPolicy): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= policy.retries) {
    try {
      return await load();
    } catch (error) {
      lastError = error;
      if (attempt === policy.retries) break;
      await delay(policy.retryDelayMs * Math.max(1, attempt + 1));
    }
    attempt += 1;
  }
  throw lastError;
}

export function freshnessFor(source: ApiFreshness['source'], loadedAt = new Date().toISOString(), policy: Pick<ApiRequestPolicy, 'staleAfterMs'> = defaultApiRequestPolicy): ApiFreshness {
  const loaded = Date.parse(loadedAt);
  const staleAt = Number.isFinite(loaded) ? new Date(loaded + policy.staleAfterMs).toISOString() : loadedAt;
  return {
    loadedAt,
    staleAt,
    stale: Number.isFinite(loaded) ? Date.now() > loaded + policy.staleAfterMs : true,
    source,
  };
}
