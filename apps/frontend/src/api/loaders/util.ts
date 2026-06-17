import type { AdapterResult } from '../client';
import type { ConsoleAction, ConsoleMetric, OpsPosture } from '../../design/opsTypes';

export function requireReady<T>(result: AdapterResult<T>, label: string): T {
  if (result.status === 'error') throw new Error(`${label} failed: ${result.message ?? 'unknown error'}`);
  if (result.data === undefined) throw new Error(`${label} returned no data.`);
  return result.data;
}

export function postureFromHealth(status: string | undefined): OpsPosture {
  if (status === 'critical' || status === 'unhealthy') return 'critical';
  if (status === 'degraded' || status === 'watch') return 'watch';
  if (status === 'blocked') return 'blocked';
  return 'ready';
}

export function countMetric(label: string, value: number, detail: string, posture: OpsPosture = 'ready', action?: ConsoleAction): ConsoleMetric {
  return { label, value: String(value), detail, posture, action };
}

export function textMetric(label: string, value: string, detail: string, posture: OpsPosture = 'ready', action?: ConsoleAction): ConsoleMetric {
  return { label, value, detail, posture, action };
}

export function navAction(label: string, path: string, detail: string, tone: ConsoleAction['tone'] = 'secondary'): ConsoleAction {
  return { label, path, detail, tone };
}

export function formatCurrency(cents: unknown): string {
  return typeof cents === 'number' && Number.isFinite(cents)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
    : 'Unavailable';
}
