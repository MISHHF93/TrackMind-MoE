import type { WorkspacePanel } from '../domain/workspaceModel';

export type StructuredField = { label: string; value: string };

export function structuredPanel(input: {
  id: string;
  title: string;
  summary: string;
  status: WorkspacePanel['status'];
  evidence: string[];
  fields: StructuredField[];
  actions?: WorkspacePanel['actions'];
}): WorkspacePanel {
  return {
    id: input.id,
    title: input.title,
    body: input.summary,
    status: input.status,
    evidence: input.evidence,
    fields: input.fields,
    actions: input.actions,
  };
}

export function fieldsFromRecord(record: Record<string, unknown>, labels: Record<string, string>): StructuredField[] {
  return Object.entries(labels).map(([key, label]) => ({
    label,
    value: formatFieldValue(record[key]),
  }));
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return 'Unavailable';
  if (typeof value === 'string') return value.trim() || 'Unavailable';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((item) => String(item)).join(', ') : 'None';
  return String(value);
}
