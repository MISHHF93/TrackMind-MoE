import test from 'node:test';
import assert from 'node:assert/strict';
import { addStewardEvidence, addStewardRuleReference, canAccessStewardCenter, CentralizedApprovalService, createStewardInquiry, exportAppealPackage, generateStewardTimeline, ImmutableAuditLog, InMemoryEventBus, issueFinalRuling, investigationWorkflow, listStewardInquiries, openStewardInvestigation, organizeEvidenceForStewards, requestStewardFinalApproval, saveDecisionDraft, summarizeEvidenceForStewards, validateStewardAuditTrail, WorkflowOrchestrationEngine } from '../dist/index.js';

function fixture() { return createStewardInquiry({ id:'inq-1', raceId:'race-7', openedAt:'2026-06-13T21:00:00Z', openedBy:'steward-1', involvedHorses:[{ horseId:'h1', name:'One', programNumber:'1', officialResultLocked:true }], involvedJockeys:[{ jockeyId:'j1', name:'J One', licenseId:'L1', horseId:'h1' }], evidenceReferences:[{ id:'ev1', kind:'video', uri:'s3://clip', capturedAt:'2026-06-13T21:00:00Z', addedBy:'steward-1', description:'pan replay', hash:'sha256:clip' }], ruleReferences:[{ id:'r1', jurisdiction:'NY', rulebook:'rules', section:'1', citation:'interference', summary:'review interference' }] }); }

test('AI can summarize and draft recommendations but cannot issue official rulings', () => { const inquiry = fixture(); const aiDraft = summarizeEvidenceForStewards(inquiry); assert.equal(aiDraft.aiGenerated, true); assert.equal(aiDraft.officialRuling, false); assert.throws(() => issueFinalRuling(inquiry, { id:'final-ai', issuedBy:'ai-agent', issuedByRole:'read-only-auditor', issuedAt:'2026-06-13T21:10:00Z', decision:'make official', rationale:'bad', penalties:[], officialResultsModified:false, evidenceIds:['ev1'], ruleIds:['r1'] }), /authorized human steward/); assert.equal(inquiry.finalRuling, undefined); });

test('final rulings are human-only and cannot modify official results', () => { const inquiry = fixture(); assert.throws(() => issueFinalRuling(inquiry, { id:'final-1', issuedBy:'steward-1', issuedByRole:'steward', issuedAt:'2026-06-13T21:12:00Z', decision:'no change', rationale:'reviewed', penalties:[], officialResultsModified:true, evidenceIds:['ev1'], ruleIds:['r1'] }), /may not modify official results/); const ruling = issueFinalRuling(inquiry, { id:'final-2', issuedBy:'steward-1', issuedByRole:'steward', issuedAt:'2026-06-13T21:13:00Z', decision:'objection dismissed; results unchanged', rationale:'insufficient impact', penalties:[], officialResultsModified:false, evidenceIds:['ev1'], ruleIds:['r1'] }); assert.equal(ruling.officialResultsModified, false); assert.equal(inquiry.status, 'finalized'); });

test('audit trail is complete across drafts, final ruling, and appeal package', () => { const inquiry = fixture(); saveDecisionDraft(inquiry, { id:'draft-human', authorId:'steward-2', authorRole:'steward', createdAt:'2026-06-13T21:08:00Z', recommendation:'dismiss objection', rationale:'horse maintained path', evidenceIds:['ev1'], ruleIds:['r1'], aiGenerated:false }); issueFinalRuling(inquiry, { id:'final-1', issuedBy:'steward-1', issuedByRole:'steward', issuedAt:'2026-06-13T21:13:00Z', decision:'official ruling recorded without result mutation', rationale:'panel reviewed all evidence', penalties:[], officialResultsModified:false, evidenceIds:['ev1'], ruleIds:['r1'] }); const pkg = exportAppealPackage(inquiry, 'clerk-1'); assert.ok(pkg.contents.auditRecordIds.includes('audit-1')); const validation = validateStewardAuditTrail(inquiry); assert.equal(validation.complete, true); assert.ok(validation.recordCount >= 4); });

test('role-based access separates read, draft, appeal, and finalization duties', () => { assert.equal(canAccessStewardCenter(['read-only-auditor'], 'read'), true); assert.equal(canAccessStewardCenter(['read-only-auditor'], 'draft'), false); assert.equal(canAccessStewardCenter(['compliance-officer'], 'appeal'), true); assert.equal(canAccessStewardCenter(['compliance-officer'], 'finalize'), false); assert.equal(canAccessStewardCenter(['steward'], 'finalize'), true); });

test('steward center manages evidence, investigations, timelines, and appeal packages without AI rulings', () => {
  const inquiry = fixture();
  addStewardEvidence(inquiry, { id:'ev2', kind:'sensor', uri:'sensor://lane-delta', capturedAt:'2026-06-13T21:02:00Z', addedBy:'steward-1', description:'lane delta telemetry', twinContextIds:['twin:race-7'], tags:['telemetry'] });
  addStewardRuleReference(inquiry, { id:'r2', jurisdiction:'NY', rulebook:'rules', section:'2', citation:'placing change standard', summary:'human steward placing decision standard' }, 'steward-1', '2026-06-13T21:03:00Z');
  const investigation = openStewardInvestigation(inquiry, { id:'investigation-1', openedAt:'2026-06-13T21:04:00Z', leadStewardId:'steward-1', status:'evidence-collection', focus:'final furlong objection', taskIds:['collect-evidence'], evidenceIds:['ev1','ev2'], ruleIds:['r1','r2'], digitalTwinRefs:['twin:race-7'] });
  assert.equal(investigation.status, 'evidence-collection');

  const organized = organizeEvidenceForStewards(inquiry, { actorId:'steward-ai', generatedAt:'2026-06-13T21:05:00Z' });
  assert.equal(organized.officialRuling, false);
  assert.equal(organized.mayModifyOfficialResults, false);
  assert.ok(organized.limitations.some((line) => /did not decide/i.test(line)));
  assert.throws(() => saveDecisionDraft(inquiry, { id:'draft-ai-bad', authorId:'steward-ai', authorRole:'ai-agent', createdAt:'2026-06-13T21:06:00Z', recommendation:'uphold objection', rationale:'AI ruling', evidenceIds:['ev1'], ruleIds:['r1'], aiGenerated:true }), /AI may only summarize or organize/);

  const timeline = generateStewardTimeline(inquiry, { actorId:'steward-1', at:'2026-06-13T21:07:00Z' });
  assert.ok(timeline.some((entry) => entry.source === 'ai-organization'));
  const appeal = exportAppealPackage(inquiry, 'clerk-1');
  assert.ok(appeal.contents.evidenceHashes.length >= 2);
  assert.ok(appeal.contents.aiOrganizationIds.includes(organized.id));
  assert.match(appeal.contents.guardrailStatement, /AI may summarize and organize evidence only/);
  assert.equal(validateStewardAuditTrail(inquiry).complete, true);
});

test('steward center integrates with audit, events, approvals, workflow, evidence vault, and observability', async () => {
  const auditLog = new ImmutableAuditLog();
  const eventBus = new InMemoryEventBus();
  const approvals = new CentralizedApprovalService({ auditLog, eventBus });
  const workflow = new WorkflowOrchestrationEngine();
  workflow.register(investigationWorkflow('track-1'));
  const evidenceVault = { collected: [], collect(item) { this.collected.push(item); return { id:item.id, recordId:item.recordId, uri:item.uri, hash:'sha256:vault', collectedBy:item.collectedBy, collectedAt:item.collectedAt, description:item.description, legalHold:item.legalHold }; } };
  const observed = [];
  const deps = { auditLog, eventBus, approvals, workflow, evidenceVault, observability:{ recordSignal: (signal) => observed.push(signal) } };
  const inquiry = createStewardInquiry({ id:'inq-integrated', raceId:'race-8', openedAt:'2026-06-13T22:00:00Z', openedBy:'steward-1', involvedHorses:[{ horseId:'h1', name:'One', programNumber:'1', officialResultLocked:true }], involvedJockeys:[{ jockeyId:'j1', name:'J One', licenseId:'L1', horseId:'h1' }], evidenceReferences:[], ruleReferences:[] }, deps);
  addStewardEvidence(inquiry, { id:'ev-integrated', kind:'video', uri:'s3://clip2', capturedAt:'2026-06-13T22:01:00Z', addedBy:'steward-1', description:'patrol replay', content:{ frame:'clip' } }, deps);
  addStewardRuleReference(inquiry, { id:'rule-integrated', jurisdiction:'NY', rulebook:'rules', section:'3', citation:'review standard', summary:'steward review standard' }, 'steward-1', '2026-06-13T22:02:00Z', deps);
  const investigation = openStewardInvestigation(inquiry, { id:'investigation-integrated', openedAt:'2026-06-13T22:03:00Z', leadStewardId:'steward-1', status:'evidence-collection', focus:'integrated review', taskIds:['preserve-evidence'], evidenceIds:['ev-integrated'], ruleIds:['rule-integrated'], digitalTwinRefs:['twin:race-8'], workflowDefinitionId:'steward-investigation', tenantId:'track-1' }, deps);
  const approval = requestStewardFinalApproval(inquiry, { tenantId:'track-1', requestedBy:'workflow-engine', actorType:'service', reason:'panel review ready', evidence:['ev-integrated'], workflowInstanceId:investigation.workflowInstanceId, now:'2026-06-13T22:04:00Z' }, deps);
  assert.equal(approval.action, 'steward-decision');
  assert.ok(inquiry.integrations.workflowInstanceIds.includes(investigation.workflowInstanceId));
  assert.ok(inquiry.integrations.approvalRequestIds.includes(approval.id));
  assert.ok(inquiry.integrations.eventTypes.includes('steward.approval.requested'));
  assert.ok(inquiry.integrations.evidenceVaultRecordIds.includes('ev-integrated'));
  assert.ok(auditLog.all().some((entry) => entry.type === 'regulatory-activity'));
  assert.ok(eventBus.events({ type:'steward.evidence.added' }).length >= 1);
  assert.ok(observed.some((signal) => signal.name === 'steward.evidence.added'));
});

test('seeded steward center read model carries connected queues, references, appeals, and AI advisory labels', () => {
  const [inquiry] = listStewardInquiries();
  assert.equal(inquiry.aiGuardrails.advisoryOnly, true);
  assert.equal(inquiry.aiGuardrails.mayIssueOfficialRuling, false);
  assert.equal(inquiry.aiGuardrails.mayModifyOfficialResults, false);
  assert.ok(inquiry.objections.some((objection) => objection.status === 'accepted-for-review'));
  assert.ok(inquiry.involvedHorses.every((horse) => horse.officialResultLocked));
  assert.ok(inquiry.evidenceReferences.every((evidence) => evidence.hash && evidence.auditRecordId && evidence.custody?.legalHold));
  assert.ok(inquiry.evidenceReferences.some((evidence) => evidence.kind === 'ai-summary' && evidence.aiGenerated === true && evidence.tags.includes('advisory-only')));
  assert.ok(inquiry.ruleReferences.every((rule) => rule.auditRecordId));
  assert.ok(inquiry.investigations.some((investigation) => investigation.workflowInstanceId && investigation.approvalRequestId === 'approval-steward-decision-r7'));
  assert.ok(inquiry.integrations.approvalRequestIds.includes('approval-steward-decision-r7'));
  assert.ok(inquiry.integrations.evidenceVaultRecordIds.includes('ev-headon'));
  assert.ok(inquiry.integrations.eventTypes.includes('steward.approval.requested'));
  assert.ok(inquiry.integrations.workflowInstanceIds.some((id) => id.startsWith('steward-investigation-')));
  assert.equal(inquiry.appealPackages.length, 1);
  assert.ok(inquiry.appealPackages[0].contents.aiOrganizationIds.includes('ai-org-1'));
  assert.match(inquiry.appealPackages[0].contents.guardrailStatement, /AI may summarize and organize evidence only/);
  assert.equal(inquiry.finalRuling, undefined);
  assert.equal(validateStewardAuditTrail(inquiry).complete, true);
});
