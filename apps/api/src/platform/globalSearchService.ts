import type { GlobalSearchResponseDto, GlobalSearchResultDto } from '@trackmind/shared';

const now = () => new Date().toISOString();
const EMPTY_SEARCH_RESPONSE: GlobalSearchResponseDto = { query: '', results: [], generatedAt: '', mock: false };

function matchesQuery(value: string, q: string): boolean {
  return value.toLowerCase().includes(q);
}

export function globalSearch(query: string, sources: {
  horses?: Array<{ id: string; name: string }>;
  incidents?: Array<{ id: string; title: string }>;
  auditEvents?: Array<{ id: string; type: string; action: string }>;
  kpis?: Array<{ kpiId: string; label: string }>;
  assets?: Array<{ id: string; label: string }>;
  twins?: Array<{ id: string; label: string; twinType?: string }>;
  recommendations?: Array<{ id: string; title: string }>;
}): GlobalSearchResponseDto {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { ...EMPTY_SEARCH_RESPONSE, query, generatedAt: now() };
  }
  const results: GlobalSearchResultDto[] = [];

  for (const horse of sources.horses ?? []) {
    if (matchesQuery(horse.name, q) || matchesQuery(horse.id, q)) {
      results.push({ id: horse.id, kind: 'horse', title: horse.name, subtitle: horse.id, path: `/equine-intelligence/horses/${horse.id}`, score: 0.9, mock: false });
    }
  }
  for (const incident of sources.incidents ?? []) {
    if (matchesQuery(incident.title, q) || matchesQuery(incident.id, q)) {
      results.push({ id: incident.id, kind: 'incident', title: incident.title, path: `/incidents/${incident.id}`, score: 0.85, mock: false });
    }
  }
  for (const event of sources.auditEvents ?? []) {
    if (matchesQuery(event.type, q) || matchesQuery(event.action, q)) {
      results.push({ id: event.id, kind: 'audit', title: event.action, subtitle: event.type, path: `/audit/events/${event.id}`, score: 0.7, mock: false });
    }
  }
  for (const kpi of sources.kpis ?? []) {
    if (matchesQuery(kpi.label, q) || matchesQuery(kpi.kpiId, q)) {
      results.push({ id: kpi.kpiId, kind: 'kpi', title: kpi.label, path: `/kpis/${kpi.kpiId}`, score: 0.75, mock: false });
    }
  }
  for (const asset of sources.assets ?? []) {
    if (matchesQuery(asset.label, q) || matchesQuery(asset.id, q)) {
      results.push({ id: asset.id, kind: 'asset', title: asset.label, path: `/assets/${asset.id}`, score: 0.65, mock: false });
    }
  }
  for (const twin of sources.twins ?? []) {
    if (matchesQuery(twin.label, q) || matchesQuery(twin.id, q) || matchesQuery(twin.twinType ?? '', q)) {
      results.push({
        id: twin.id,
        kind: 'asset',
        title: twin.label,
        subtitle: twin.twinType,
        path: `/digital-twin/${twin.id}`,
        score: 0.8,
        mock: false,
      });
    }
  }
  for (const recommendation of sources.recommendations ?? []) {
    if (matchesQuery(recommendation.title, q) || matchesQuery(recommendation.id, q)) {
      results.push({
        id: recommendation.id,
        kind: 'recommendation',
        title: recommendation.title,
        path: `/ai-governance/recommendations/${recommendation.id}`,
        score: 0.72,
        mock: false,
      });
    }
  }

  return { query, results: results.sort((a, b) => b.score - a.score), generatedAt: now(), mock: false };
}
