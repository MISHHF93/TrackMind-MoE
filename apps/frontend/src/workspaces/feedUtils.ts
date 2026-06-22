import type { WorkspaceDataResult } from '@/hooks/useWorkspaceData';
import { extractArray } from '@/hooks/useWorkspaceData';
import { isRecord } from '@/lib/utils';

export function feedByPath(results: WorkspaceDataResult[], fragment: string): WorkspaceDataResult | undefined {
  return results.find((item) => item.path.includes(fragment) && item.status === 'ready');
}

export function feedData<T = Record<string, unknown>>(results: WorkspaceDataResult[], fragment: string): T | undefined {
  const feed = feedByPath(results, fragment);
  return feed?.data as T | undefined;
}

export function indexWorkspaceFeeds(results: WorkspaceDataResult[]): ReadonlyMap<string, unknown> {
  const index = new Map<string, unknown>();
  for (const item of results) {
    if (item.status === 'ready') index.set(item.path, item.data);
  }
  return index;
}

export function feedFromIndex<T = Record<string, unknown>>(index: ReadonlyMap<string, unknown>, path: string): T | undefined {
  return index.get(path) as T | undefined;
}

export function recordsFromFeeds(results: WorkspaceDataResult[], keys: string[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const result of results) {
    if (result.status !== 'ready') continue;
    for (const key of keys) {
      rows.push(...extractArray<Record<string, unknown>>(result.data, key));
    }
  }
  return rows;
}

export function extractAllRecommendations(results: WorkspaceDataResult[]): Record<string, unknown>[] {
  const keys = ['recommendations', 'aiRecommendations', 'recommendationQueue', 'safetyBlockedActions', 'aiRiskRecommendations'];
  return recordsFromFeeds(results, keys);
}

export function extractAllWarnings(results: WorkspaceDataResult[]): Record<string, unknown>[] {
  return recordsFromFeeds(results, ['warnings', 'anomalies', 'alerts']);
}

export function extractAllIncidents(results: WorkspaceDataResult[]): Record<string, unknown>[] {
  return recordsFromFeeds(results, ['incidents', 'investigations', 'escalations']);
}

export function numericField(data: unknown, key: string): number | undefined {
  if (!isRecord(data)) return undefined;
  const value = data[key];
  return typeof value === 'number' ? value : undefined;
}

export function formatCents(cents: unknown): string {
  if (typeof cents !== 'number') return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}
