export type LakehouseDomain =
  | 'operations'
  | 'telemetry'
  | 'digital-twin'
  | 'regulatory'
  | 'maintenance'
  | 'security-manager'
  | 'compliance'
  | 'race-operations'
  | 'ai-recommendations'
  | 'workflow-history';

export type LakehouseZone = 'landing' | 'bronze' | 'silver' | 'gold' | 'semantic' | 'feature';
export type DataSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

export interface LakehouseSource {
  id: string;
  name: string;
  domain: LakehouseDomain;
  systemOfRecord: string;
  refreshCadence: 'streaming' | 'hourly' | 'daily' | 'on-demand';
  owner: string;
  containsPii?: boolean;
  retentionYears: number;
}

export interface LakehouseDataset {
  id: string;
  sourceId: string;
  name: string;
  zone: LakehouseZone;
  domain: LakehouseDomain;
  sensitivity: DataSensitivity;
  schema: string[];
  partitions: string[];
  qualityScore: number;
  lineage: string[];
  tags: string[];
  rowCount: number;
  updatedAt: string;
}

export interface GovernancePolicy {
  id: string;
  appliesTo: LakehouseDomain[];
  requiredTags: string[];
  minQualityScore: number;
  encryptionRequired: boolean;
  privateAccessRequired: boolean;
  evidenceRequired: string[];
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  domain: LakehouseDomain;
  text: string;
  citations: string[];
  effectiveDate: string;
  sensitivity: DataSensitivity;
}

export interface AnalyticsProduct {
  id: string;
  name: string;
  purpose: 'reporting' | 'forecasting' | 'machine-learning' | 'semantic-search' | 'enterprise-intelligence';
  datasetIds: string[];
  metrics: string[];
  refreshCadence: string;
  consumers: string[];
}

export class EnterpriseDataLakehouse {
  private readonly sources = new Map<string, LakehouseSource>();
  private readonly datasets = new Map<string, LakehouseDataset>();
  private readonly policies = new Map<string, GovernancePolicy>();
  private readonly documents = new Map<string, KnowledgeDocument>();
  private readonly products = new Map<string, AnalyticsProduct>();

  registerSource(source: LakehouseSource) {
    this.sources.set(source.id, { ...source });
    return this.sources.get(source.id)!;
  }

  ingest(dataset: LakehouseDataset) {
    if (!this.sources.has(dataset.sourceId)) throw new Error('Lakehouse source must be registered before ingestion');
    const source = this.sources.get(dataset.sourceId)!;
    const normalized: LakehouseDataset = {
      ...dataset,
      domain: dataset.domain ?? source.domain,
      schema: [...dataset.schema],
      partitions: [...dataset.partitions],
      lineage: [...new Set([source.systemOfRecord, ...dataset.lineage])],
      tags: [...new Set([...dataset.tags, source.domain, dataset.zone])],
    };
    this.datasets.set(dataset.id, normalized);
    return { ...normalized, schema: [...normalized.schema], partitions: [...normalized.partitions], lineage: [...normalized.lineage], tags: [...normalized.tags] };
  }

  promote(datasetId: string, zone: LakehouseZone, qualityScore: number, evidence: string[]) {
    const current = this.datasets.get(datasetId);
    if (!current) throw new Error('Dataset not found');
    const promoted = {
      ...current,
      zone,
      qualityScore,
      lineage: [...current.lineage, `promoted:${current.zone}->${zone}`, ...evidence],
      tags: [...new Set([...current.tags, zone])],
    };
    this.datasets.set(datasetId, promoted);
    return { ...promoted, schema: [...promoted.schema], partitions: [...promoted.partitions], lineage: [...promoted.lineage], tags: [...promoted.tags] };
  }

  addPolicy(policy: GovernancePolicy) {
    this.policies.set(policy.id, { ...policy, appliesTo: [...policy.appliesTo], requiredTags: [...policy.requiredTags], evidenceRequired: [...policy.evidenceRequired] });
    return this.policies.get(policy.id)!;
  }

  compliance(datasetId: string) {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) throw new Error('Dataset not found');
    const applicable = [...this.policies.values()].filter((policy) => policy.appliesTo.includes(dataset.domain));
    const findings = applicable.flatMap((policy) => {
      const missingTags = policy.requiredTags.filter((tag) => !dataset.tags.includes(tag));
      const qualityOk = dataset.qualityScore >= policy.minQualityScore;
      const encryptionOk = !policy.encryptionRequired || dataset.tags.includes('encrypted');
      const privateAccessOk = !policy.privateAccessRequired || dataset.tags.includes('private-link');
      return missingTags.map((tag) => `missing-tag:${tag}`).concat(qualityOk ? [] : [`quality-below:${policy.minQualityScore}`], encryptionOk ? [] : ['encryption-required'], privateAccessOk ? [] : ['private-access-required']);
    });
    return { datasetId, governed: applicable.length > 0, compliant: findings.length === 0, findings, policies: applicable.map((policy) => policy.id) };
  }

  addDocument(document: KnowledgeDocument) {
    this.documents.set(document.id, { ...document, citations: [...document.citations] });
    return this.documents.get(document.id)!;
  }

  semanticSearch(query: string, options: { domain?: LakehouseDomain; limit?: number } = {}) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return [...this.documents.values()]
      .filter((document) => !options.domain || document.domain === options.domain)
      .map((document) => ({
        ...document,
        citations: [...document.citations],
        score: terms.reduce((score, term) => score + (document.title.toLowerCase().includes(term) ? 2 : 0) + (document.text.toLowerCase().includes(term) ? 1 : 0), 0),
      }))
      .filter((document) => document.score > 0)
      .sort((a, b) => b.score - a.score || a.effectiveDate.localeCompare(b.effectiveDate))
      .slice(0, options.limit ?? 5);
  }

  publishProduct(product: AnalyticsProduct) {
    const missing = product.datasetIds.filter((id) => !this.datasets.has(id));
    if (missing.length > 0) throw new Error(`Analytics product references missing datasets: ${missing.join(',')}`);
    this.products.set(product.id, { ...product, datasetIds: [...product.datasetIds], metrics: [...product.metrics], consumers: [...product.consumers] });
    return this.products.get(product.id)!;
  }

  intelligenceBrief() {
    const datasets = [...this.datasets.values()];
    const products = [...this.products.values()];
    return {
      sourceCount: this.sources.size,
      datasetCount: datasets.length,
      documentCount: this.documents.size,
      productCount: products.length,
      governedDatasetCount: datasets.filter((dataset) => this.compliance(dataset.id).governed).length,
      averageQualityScore: Math.round(datasets.reduce((sum, dataset) => sum + dataset.qualityScore, 0) / Math.max(1, datasets.length)),
      domains: [...new Set(datasets.map((dataset) => dataset.domain))].sort(),
      capabilities: [...new Set(products.map((product) => product.purpose))].sort(),
    };
  }
}

export function lakehouseReferenceArchitecture() {
  return {
    ingestion: ['event-hubs-streaming', 'api-change-data-capture', 'document-intelligence', 'batch-ingestion', 'workflow-event-sourcing'],
    storageZones: ['landing', 'bronze-raw', 'silver-conformed', 'gold-curated', 'semantic-index', 'feature-store'],
    governance: ['catalog', 'lineage', 'quality-rules', 'retention', 'private-link', 'encryption', 'rbac-abac', 'audit-evidence'],
    intelligence: ['power-bi-reporting', 'forecasting', 'ml-feature-engineering', 'semantic-search', 'executive-briefings'],
  } as const;
}
