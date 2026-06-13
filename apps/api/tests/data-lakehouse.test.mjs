import test from 'node:test';
import assert from 'node:assert/strict';
import { EnterpriseDataLakehouse, lakehouseReferenceArchitecture } from '../dist/index.js';

test('enterprise data lakehouse governs analytical datasets and knowledge fabric', () => {
  const lakehouse = new EnterpriseDataLakehouse();
  lakehouse.registerSource({ id: 'src-telemetry', name: 'Telemetry Mesh', domain: 'telemetry', systemOfRecord: 'event-hubs', refreshCadence: 'streaming', owner: 'platform-data', retentionYears: 7 });
  lakehouse.registerSource({ id: 'src-regulatory', name: 'Regulatory Corpus', domain: 'regulatory', systemOfRecord: 'document-vault', refreshCadence: 'daily', owner: 'compliance', retentionYears: 10 });

  const telemetry = lakehouse.ingest({
    id: 'ds-telemetry-silver',
    sourceId: 'src-telemetry',
    name: 'Conformed Telemetry',
    zone: 'silver',
    domain: 'telemetry',
    sensitivity: 'confidential',
    schema: ['tenantId', 'assetId', 'metric', 'observedAt'],
    partitions: ['tenantId', 'observedDate'],
    qualityScore: 91,
    lineage: ['quality:range-checks'],
    tags: ['encrypted', 'private-link', 'asset-telemetry'],
    rowCount: 2500000,
    updatedAt: '2026-06-13T00:00:00Z',
  });
  assert.ok(telemetry.lineage.includes('event-hubs'));

  lakehouse.addPolicy({ id: 'pol-confidential-analytics', appliesTo: ['telemetry', 'regulatory', 'compliance', 'security'], requiredTags: ['encrypted', 'private-link'], minQualityScore: 90, encryptionRequired: true, privateAccessRequired: true, evidenceRequired: ['lineage', 'access-review'] });
  assert.equal(lakehouse.compliance('ds-telemetry-silver').compliant, true);

  const gold = lakehouse.promote('ds-telemetry-silver', 'gold', 96, ['steward:data-quality-approval']);
  assert.equal(gold.zone, 'gold');
  assert.ok(gold.lineage.includes('promoted:silver->gold'));

  lakehouse.addDocument({ id: 'doc-hisa-rule', title: 'HISA maintenance evidence rule', domain: 'regulatory', text: 'Maintenance records and compliance evidence must be retained with audit lineage for regulated race operations.', citations: ['hisa:maintenance:2026'], effectiveDate: '2026-01-01', sensitivity: 'internal' });
  assert.equal(lakehouse.semanticSearch('maintenance compliance evidence', { domain: 'regulatory' })[0].id, 'doc-hisa-rule');

  lakehouse.publishProduct({ id: 'prod-executive-intelligence', name: 'Executive Intelligence Fabric', purpose: 'enterprise-intelligence', datasetIds: ['ds-telemetry-silver'], metrics: ['asset-health', 'surface-risk', 'compliance-evidence-coverage'], refreshCadence: '15m', consumers: ['executives', 'operations-command'] });
  const brief = lakehouse.intelligenceBrief();
  assert.equal(brief.sourceCount, 2);
  assert.equal(brief.governedDatasetCount, 1);
  assert.ok(brief.capabilities.includes('enterprise-intelligence'));
});

test('lakehouse reference architecture covers reporting, forecasting, ML, and search', () => {
  const architecture = lakehouseReferenceArchitecture();
  assert.ok(architecture.storageZones.includes('gold-curated'));
  assert.ok(architecture.intelligence.includes('ml-feature-engineering'));
  assert.ok(architecture.intelligence.includes('semantic-search'));
});
