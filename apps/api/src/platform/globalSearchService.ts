import type { GlobalSearchResponseDto, GlobalSearchResultDto } from '@trackmind/shared';

const now = () => new Date().toISOString();

export function globalSearch(query: string, sources: {
  horses?: Array<{ id: string; name: string }>;
  incidents?: Array<{ id: string; title: string }>;
  auditEvents?: Array<{ id: string; type: string; action: string }>;
  kpis?: Array<{ kpiId: string; label: string }>;
  assets?: Array<{ id: string; label: string }>;
}): GlobalSearchResponseDto {
  const q = query.trim().toLowerCase();
  const results: GlobalSearchResultDto[] = [];

  for (const horse of sources.horses ?? []) {
    if (horse.name.toLowerCase().includes(q) || horse.id.toLowerCase().includes(q)) {
      results.push({ id: horse.id, kind: 'horse', title: horse.name, subtitle: horse.id, path: `/equine-intelligence/horses/${horse.id}`, score: 0.9, mock: false });
    }
  }
  for (const incident of sources.incidents ?? []) {
    if (incident.title.toLowerCase().includes(q) || incident.id.toLowerCase().includes(q)) {
      results.push({ id: incident.id, kind: 'incident', title: incident.title, path: `/incidents/${incident.id}`, score: 0.85, mock: false });
    }
  }
  for (const event of sources.auditEvents ?? []) {
    if (event.type.toLowerCase().includes(q) || event.action.toLowerCase().includes(q)) {
      results.push({ id: event.id, kind: 'audit', title: event.action, subtitle: event.type, path: `/audit/events/${event.id}`, score: 0.7, mock: false });
    }
  }
  for (const kpi of sources.kpis ?? []) {
    if (kpi.label.toLowerCase().includes(q) || kpi.kpiId.toLowerCase().includes(q)) {
      results.push({ id: kpi.kpiId, kind: 'kpi', title: kpi.label, path: `/kpis/${kpi.kpiId}`, score: 0.75, mock: false });
    }
  }
  for (const asset of sources.assets ?? []) {
    if (asset.label.toLowerCase().includes(q) || asset.id.toLowerCase().includes(q)) {
      results.push({ id: asset.id, kind: 'asset', title: asset.label, path: `/assets/${asset.id}`, score: 0.65, mock: false });
    }
  }

  return { query, results: results.sort((a, b) => b.score - a.score), generatedAt: now(), mock: false };
}
