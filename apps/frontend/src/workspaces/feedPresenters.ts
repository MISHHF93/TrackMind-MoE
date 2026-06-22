import { isRecord } from '@/lib/utils';

export interface FlatKpiRow {
  id: string;
  label: string;
  value: string;
  target?: string;
  status?: string;
}

export function flattenKpiItems(items: unknown[]): FlatKpiRow[] {
  return items
    .filter(isRecord)
    .map((kpi, index) => {
      const snapshots = Array.isArray(kpi.historicalSnapshots) ? kpi.historicalSnapshots : [];
      const latest = snapshots.length && isRecord(snapshots[snapshots.length - 1])
        ? snapshots[snapshots.length - 1] as Record<string, unknown>
        : undefined;
      return {
        id: String(kpi.id ?? kpi.kpiId ?? index),
        label: String(kpi.label ?? kpi.name ?? 'KPI'),
        value: String(kpi.value ?? latest?.value ?? '—'),
        target: kpi.target != null ? String(kpi.target) : undefined,
        status: typeof kpi.status === 'string' ? kpi.status : undefined,
      };
    });
}

export interface FlatChecklistRow {
  id: string;
  item: string;
  status: string;
  owner?: string;
  completed: boolean;
}

export function flattenChecklistItems(items: unknown[]): FlatChecklistRow[] {
  return items
    .filter(isRecord)
    .map((entry, index) => ({
      id: String(entry.id ?? index),
      item: String(entry.item ?? entry.title ?? entry.name ?? 'Checklist item'),
      status: String(entry.status ?? (entry.completed ? 'done' : 'open')),
      owner: typeof entry.owner === 'string' ? entry.owner : typeof entry.assignee === 'string' ? entry.assignee : undefined,
      completed: Boolean(entry.completed) || String(entry.status).toLowerCase() === 'done',
    }));
}

export interface FlatEligibilityRule {
  id: string;
  rule: string;
  status: 'pass' | 'fail' | 'warn';
  detail?: string;
}

export function flattenEligibilityRules(data: unknown): FlatEligibilityRule[] {
  if (!isRecord(data)) return [];
  const failed = Array.isArray(data.failedRules) ? data.failedRules : [];
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  const passed = Array.isArray(data.passedRules) ? data.passedRules : [];
  const rules: FlatEligibilityRule[] = [];
  for (const [index, rule] of failed.entries()) {
    rules.push({
      id: `fail-${index}`,
      rule: typeof rule === 'string' ? rule : String((rule as Record<string, unknown>).rule ?? rule),
      status: 'fail',
    });
  }
  for (const [index, rule] of warnings.entries()) {
    rules.push({
      id: `warn-${index}`,
      rule: typeof rule === 'string' ? rule : String((rule as Record<string, unknown>).rule ?? rule),
      status: 'warn',
    });
  }
  for (const [index, rule] of passed.entries()) {
    rules.push({
      id: `pass-${index}`,
      rule: typeof rule === 'string' ? rule : String((rule as Record<string, unknown>).rule ?? rule),
      status: 'pass',
    });
  }
  if (rules.length === 0 && Array.isArray(data.rules)) {
    return (data.rules as unknown[]).filter(isRecord).map((rule, index) => ({
      id: String(rule.id ?? index),
      rule: String(rule.label ?? rule.rule ?? 'Rule'),
      status: (String(rule.status ?? 'pass') as FlatEligibilityRule['status']),
      detail: typeof rule.detail === 'string' ? rule.detail : undefined,
    }));
  }
  return rules;
}

export interface FlatEscalationRow {
  id: string;
  escalation: string;
  status: string;
  assignee?: string;
}

export function flattenEscalations(items: unknown[]): FlatEscalationRow[] {
  return items
    .filter(isRecord)
    .map((flow, index) => ({
      id: String(flow.id ?? index),
      escalation: String(flow.title ?? flow.summary ?? flow.id ?? 'Escalation'),
      status: String(flow.status ?? flow.state ?? 'open'),
      assignee: typeof flow.assignee === 'string' ? flow.assignee : typeof flow.owner === 'string' ? flow.owner : undefined,
    }));
}
