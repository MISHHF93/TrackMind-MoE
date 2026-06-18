import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CentralizedApprovalService,
  EquineIntelligencePlatform,
  ImmutableAuditLog,
  createSeededEquineWelfareIntelligence,
  createSeededHorseRegistry,
  createSeededJockeyManagement,
  createSeededRaceCardManagement,
  createSeededRacingKnowledgeGraph,
  createSeededTrainerManagement,
  HorseRegistryPlatform,
  RaceOperationsPlatform,
} from '../dist/index.js';
import { apiContractSchemas, validateContract } from '@trackmind/shared';

test('racing knowledge graph workspace connects horses races trainers jockeys incidents approvals audits facilities recommendations and KPIs', () => {
  const auditLog = new ImmutableAuditLog();
  const approvalService = new CentralizedApprovalService();
  const equinePlatform = new EquineIntelligencePlatform({ auditLog });
  const racePlatform = new RaceOperationsPlatform({ auditLog });
  const horseRegistryService = createSeededHorseRegistry({ equinePlatform, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' }, '2026-06-14T12:00:00.000Z');
  const trainerManagementService = createSeededTrainerManagement({ horseRegistry: horseRegistryService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' }, '2026-06-14T12:00:00.000Z');
  const raceCardManagementService = createSeededRaceCardManagement({ racePlatform, approvalService, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' }, '2026-06-14T12:00:00.000Z');
  const jockeyManagementService = createSeededJockeyManagement({ auditLog, tenantId: 'trackmind', racetrackId: 'main-track' }, '2026-06-14T12:00:00.000Z');
  const equineWelfareIntelligenceService = createSeededEquineWelfareIntelligence({ equinePlatform, auditLog, tenantId: 'trackmind', racetrackId: 'main-track' }, '2026-06-14T12:00:00.000Z');

  const platform = createSeededRacingKnowledgeGraph({
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    equineWorkspace: {
      horse: { horseId: 'horse-1', name: 'Lifecycle Runner' },
      relationships: [
        { id: 'horse-1:trainer:trainer-1', type: 'trained-by', fromId: 'horse-1', toId: 'trainer-1', evidence: ['license-registry'] },
        { id: 'horse-1:race:race-7', type: 'entered-in-race', fromId: 'horse-1', toId: 'race-7', evidence: ['race-office'] },
      ],
      aiRiskRecommendations: [{ id: 'ai-risk-1', summary: 'Advisory welfare review', advisoryOnly: true }],
      approvals: [{ id: 'approval-ai-risk-1', action: 'veterinary-clearance', status: 'pending' }],
      audit: [{ id: 'audit-equine-1', action: 'ai-recommendation-recorded' }],
      raceHistory: [{ raceId: 'race-7', status: 'entered' }],
    },
    horseRegistryService,
    trainerManagementService,
    jockeyManagementService,
    raceCardManagementService,
    approvalService,
    auditEvents: [{ id: 'audit-live-1', type: 'api.facade.started', action: 'api.facade.started' }],
    securityIncidents: [{ id: 'incident-credential-1', title: 'Credential review', status: 'open' }],
    stewardInquiries: [{ id: 'inq-1', raceId: 'race-7', status: 'open' }],
    facilitiesMaintenance: {
      assets: [{ assetId: 'GRANDSTAND_HVAC_01', name: 'Grandstand HVAC', assetType: 'HVAC', healthScore: 84 }],
      workOrders: [{ id: 'wo-1', assetId: 'GRANDSTAND_HVAC_01', title: 'Replace filters' }],
    },
    kpis: [{ kpiId: 'kpi-equine-welfare', name: 'Equine welfare intelligence score', description: 'Composite welfare score', domain: 'equine-welfare', value: 86, unit: 'score' }],
    aiRecommendations: [{ id: 'rec-harrow-7', recommendation: 'Advisory harrowing recommendation' }],
    equineWelfareIntelligenceService,
  });

  const workspace = platform.workspace('', '2026-06-14T12:00:00.000Z');
  assert.equal(workspace.schemaVersion, 'trackmind.racing-knowledge-graph.v1');
  assert.ok(workspace.nodes.length >= 10);
  assert.ok(workspace.edges.length >= 5);
  assert.ok(workspace.entityCounts.horses >= 1);
  assert.ok(workspace.entityCounts.trainers >= 1);
  assert.ok(workspace.entityCounts.jockeys >= 1);
  assert.ok(workspace.entityCounts.races >= 1);
  assert.ok(workspace.entityCounts.incidents >= 1);
  assert.ok(workspace.entityCounts.audits >= 1);
  assert.ok(workspace.entityCounts.facilities >= 1);
  assert.ok(workspace.entityCounts.recommendations >= 1);
  assert.ok(workspace.entityCounts.kpis >= 1);
  assert.equal(workspace.guardrails.readOnlyExploration, true);
  assert.deepEqual(validateContract('KnowledgeGraphWorkspaceDto', workspace, apiContractSchemas.KnowledgeGraphWorkspaceDto), { valid: true, errors: [] });
});

test('racing knowledge graph search and relationship exploration return neighborhoods', () => {
  const platform = createSeededRacingKnowledgeGraph({
    tenantId: 'trackmind',
    racetrackId: 'main-track',
    equineWorkspace: {
      horse: { horseId: 'horse-1', name: 'Lifecycle Runner' },
      relationships: [{ id: 'horse-1:trainer:trainer-1', type: 'trained-by', fromId: 'horse-1', toId: 'trainer-1', evidence: ['license-registry'] }],
    },
    trainerManagementService: createSeededTrainerManagement({ auditLog: new ImmutableAuditLog(), tenantId: 'trackmind', racetrackId: 'main-track' }),
  });

  const search = platform.search('horse-1');
  assert.ok(search.results.some((result) => result.nodeId === 'horse-1'));
  assert.ok(search.relatedNodes.length >= 1);

  const explore = platform.explore('horse-1', 2);
  assert.equal(explore.focusNodeId, 'horse-1');
  assert.ok(explore.nodes.length >= 1);
  assert.ok(explore.edges.length >= 0);
});
