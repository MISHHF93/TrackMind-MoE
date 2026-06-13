import type { ExpertDomain, ProtectedAction } from '@trackmind/shared';

export interface ExpertResult {
  domain: ExpertDomain;
  confidence: number;
  recommendation: string;
  evidence: string[];
  requiredApprovals: ProtectedAction[];
}

export interface StructuredRecommendation {
  id: string;
  request: string;
  domains: ExpertDomain[];
  confidence: number;
  expertResults: ExpertResult[];
  evidence: string[];
  requiredApprovals: ProtectedAction[];
  status: 'draft';
}

type ExpertStub = (request: string) => Promise<ExpertResult>;

const domainKeywords: Record<ExpertDomain, string[]> = {
  RaceOps: ['race', 'start', 'stop', 'schedule', 'post parade'],
  Stewarding: ['inquiry', 'objection', 'steward', 'results', 'disciplinary'],
  EquineSafety: ['horse', 'lameness', 'risk', 'workout', 'safety'],
  VetCompliance: ['vet', 'medication', 'scratch', 'clear flag'],
  TrackSurface: ['track', 'moisture', 'cushion', 'compaction', 'surface'],
  WeatherEnvironment: ['weather', 'rain', 'wind', 'lightning', 'temperature'],
  WageringIntegrity: ['wager', 'odds', 'integrity', 'pool', 'payout'],
  TicketingFanExperience: ['ticket', 'parking', 'crowd', 'fan', 'accessibility'],
  SecuritySOC: ['security', 'restricted', 'camera', 'emergency', 'suspicious'],
  FacilitiesIoT: ['sensor', 'gate', 'lighting', 'facility', 'iot'],
  FinanceRevenue: ['finance', 'revenue', 'refund', 'payout'],
  LegalRegulatory: ['rule', 'hisa', 'arci', 'commission', 'appeal'],
  ResponsibleAIGovernor: ['approval', 'governance', 'override', 'automation'],
};

const protectedActionKeywords: Array<[ProtectedAction, RegExp]> = [
  ['race-start', /\b(start|open)\b.*\brace\b|\brace\b.*\bstart\b/i],
  ['race-stop', /\bstop\b.*\brace\b|\brace\b.*\bstop\b/i],
  ['official-results', /official result|finali[sz]e result|publish result/i],
  ['scratch-horse', /scratch/i],
  ['medication-decision', /medication|drug|treatment/i],
  ['clear-vet-flag', /clear.*vet.*flag|vet.*flag.*clear/i],
  ['emergency-action', /emergency|evacuation|alert/i],
  ['payout', /payout|settle wager|pay/i],
  ['disciplinary-decision', /disciplinary|suspend|fine/i],
];

const makeExpert = (domain: ExpertDomain): ExpertStub => async (request) => ({
  domain,
  confidence: confidenceFor(domain, request),
  recommendation: `${domain} expert stub recommends review by the accountable human role before action.`,
  evidence: [`expert:${domain}`, `input:${request}`],
  requiredApprovals: requiredApprovalsFor(request),
});

const experts = Object.fromEntries((Object.keys(domainKeywords) as ExpertDomain[]).map((domain) => [domain, makeExpert(domain)])) as Record<ExpertDomain, ExpertStub>;

export function classifyRequest(request: string): ExpertDomain[] {
  const lower = request.toLowerCase();
  const matches = (Object.entries(domainKeywords) as Array<[ExpertDomain, string[]]>)
    .map(([domain, keywords]) => ({ domain, score: keywords.filter((keyword) => lower.includes(keyword)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ domain }) => domain);

  return matches.length > 0 ? matches.slice(0, 4) : ['ResponsibleAIGovernor'];
}

export function requiredApprovalsFor(request: string): ProtectedAction[] {
  return protectedActionKeywords.filter(([, regex]) => regex.test(request)).map(([action]) => action);
}

function confidenceFor(domain: ExpertDomain, request: string): number {
  const keywordHits = domainKeywords[domain].filter((keyword) => request.toLowerCase().includes(keyword)).length;
  return Math.min(0.95, 0.55 + keywordHits * 0.1);
}

export async function routeUserRequest(request: string, id = `rec-${Date.now()}`): Promise<StructuredRecommendation> {
  const domains = classifyRequest(request);
  const expertResults = await Promise.all(domains.map((domain) => experts[domain](request)));
  const confidence = Math.min(...expertResults.map((result) => result.confidence));
  return {
    id,
    request,
    domains,
    confidence,
    expertResults,
    evidence: [...new Set(expertResults.flatMap((result) => result.evidence))],
    requiredApprovals: [...new Set(expertResults.flatMap((result) => result.requiredApprovals))],
    status: 'draft',
  };
}
