import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendAudit,
  auditLogEntryToDto,
  createAuditPersistenceAdapter,
  createAuditVaultAdapter,
  ImmutableAuditLog,
  createApiFacadeState,
  handleApiRequest,
} from '../dist/index.js';

const adminHeaders = { 'x-trackmind-role': 'platform-super-admin' };
const exportHeaders = { 'x-trackmind-role': 'compliance-officer' };

test('audit vault adapter enforces WORM append-only semantics', () => {
  const ledger = new ImmutableAuditLog();
  const vault = createAuditVaultAdapter({ enabled: true, mock: true });
  const adapter = createAuditPersistenceAdapter(ledger);
  const target = { ledger, adapter, vault, mock: false };

  const dto = appendAudit(target, {
    id: 'audit-worm-1',
    type: 'user-action',
    actor: 'auditor-1',
    actorType: 'human',
    timestamp: '2026-06-21T12:00:00.000Z',
    action: 'audit.vault.test',
    actionClass: 'compliance',
    subjectId: 'case-1',
    payload: { caseId: 'case-1' },
    tenantId: 'trackmind',
    racetrackId: 'main-track',
  });

  assert.equal(vault.recordCount(), 1);
  assert.equal(dto.auditEventId, 'audit-worm-1');
  assert.throws(
    () => vault.appendRecord(dto),
    /WORM violation/,
  );
});

test('appendAudit mirrors mutations to vault while preserving in-process ledger', () => {
  const ledger = new ImmutableAuditLog();
  const vault = createAuditVaultAdapter({ enabled: true, mock: true });
  const adapter = createAuditPersistenceAdapter(ledger);
  const target = { ledger, adapter, vault, mock: false };

  appendAudit(target, {
    id: 'audit-mirror-1',
    type: 'approval',
    actor: 'chief-steward',
    actorType: 'human',
    timestamp: '2026-06-21T12:01:00.000Z',
    action: 'approval.approved',
    actionClass: 'approval',
    subjectId: 'approval-1',
    payload: { approvalId: 'approval-1' },
    tenantId: 'trackmind',
  });
  appendAudit(target, {
    id: 'audit-mirror-2',
    type: 'security-event',
    actor: 'security-operator',
    actorType: 'human',
    timestamp: '2026-06-21T12:02:00.000Z',
    action: 'incident.reported',
    actionClass: 'incident',
    subjectId: 'incident-1',
    payload: { incidentId: 'incident-1' },
    tenantId: 'trackmind',
  });

  assert.equal(ledger.all().length, 2);
  assert.equal(ledger.verify().valid, true);
  assert.equal(vault.recordCount(), 2);
  assert.equal(adapter.search({ domain: 'approval' }).length, 1);
});

test('audit vault creates sealed export packages with blob content', () => {
  const ledger = new ImmutableAuditLog();
  const vault = createAuditVaultAdapter({ enabled: true, mock: true });
  const events = [
    auditLogEntryToDto(ledger.append({
      id: 'audit-export-1',
      type: 'user-action',
      actor: 'auditor-1',
      actorType: 'human',
      timestamp: '2026-06-21T12:00:00.000Z',
      action: 'audit.read',
      actionClass: 'api',
      subjectId: 'audit-ledger',
      payload: { route: '/audit/events' },
      tenantId: 'trackmind',
    })),
    auditLogEntryToDto(ledger.append({
      id: 'audit-export-2',
      type: 'approval',
      actor: 'admin',
      actorType: 'human',
      timestamp: '2026-06-21T12:01:00.000Z',
      action: 'approval.approved',
      actionClass: 'approval',
      subjectId: 'approval-1',
      payload: { approvalId: 'approval-1' },
      tenantId: 'trackmind',
    })),
  ];

  const descriptor = vault.createExport({ domain: 'approval', generatedBy: 'compliance-officer' }, events);
  assert.ok(descriptor.exportId.startsWith('worm-export-'));
  assert.equal(descriptor.sealed, true);
  assert.equal(descriptor.recordCount, 1);
  assert.ok(descriptor.contentHash.startsWith('sha256:'));

  const blob = vault.getExportBlob(descriptor.exportId);
  assert.ok(blob);
  assert.equal(blob.mimeType, 'application/json');
  const parsed = JSON.parse(blob.content);
  assert.equal(parsed.recordCount, 1);
  assert.equal(parsed.records[0].auditEventId, 'audit-export-2');
});

test('disabled audit vault adapter skips append without affecting ledger', () => {
  const ledger = new ImmutableAuditLog();
  const vault = createAuditVaultAdapter({ enabled: false });
  const target = { ledger, vault, mock: false };

  appendAudit(target, {
    id: 'audit-disabled-vault',
    type: 'system-event',
    actor: 'trackmind-api',
    actorType: 'service',
    timestamp: '2026-06-21T12:03:00.000Z',
    action: 'api.started',
    actionClass: 'api',
    subjectId: 'api-facade',
    payload: {},
    tenantId: 'trackmind',
  });

  assert.equal(ledger.all().length, 1);
  assert.equal(vault.recordCount(), 0);
  assert.equal(vault.enabled, false);
});

test('GET /audit/exports lists vault exports and supports download', async () => {
  const state = createApiFacadeState();
  const initial = await handleApiRequest('GET', '/api/v1/audit/exports', undefined, state, exportHeaders);
  assert.equal(initial.status, 200);
  assert.equal(initial.body.vaultEnabled, true);
  assert.ok(initial.body.vaultRecordCount >= 1);
  assert.equal(initial.body.mock, true);

  const exportSearch = await handleApiRequest('GET', '/api/v1/audit/search?domain=approval&action=export', undefined, state, exportHeaders);
  assert.equal(exportSearch.status, 200);
  assert.equal(exportSearch.body.sealed, true);
  assert.ok(exportSearch.body.exportId);

  const listed = await handleApiRequest('GET', '/api/v1/audit/exports', undefined, state, exportHeaders);
  assert.ok(listed.body.exports.some((entry) => entry.exportId === exportSearch.body.exportId));

  const downloaded = await handleApiRequest(
    'GET',
    `/api/v1/audit/exports?exportId=${encodeURIComponent(exportSearch.body.exportId)}&download=true`,
    undefined,
    state,
    exportHeaders,
  );
  assert.equal(downloaded.status, 200);
  assert.match(String(downloaded.body), /"exportId"/);
});

test('incident mutations append to WORM vault through platform audit target', async () => {
  const state = createApiFacadeState();
  const before = state.auditVault.recordCount();
  const created = await handleApiRequest('POST', '/api/v1/incidents', {
    title: 'Vault wiring verification',
    description: 'Ensure incident audit rows reach the vault.',
    severity: 'medium',
    category: 'operational',
    reportedBy: 'auditor-1',
  }, state, adminHeaders);
  assert.equal(created.status, 201);
  assert.ok(state.auditVault.recordCount() > before);
  assert.equal(state.immutableAuditLedger.verify().valid, true);
});
