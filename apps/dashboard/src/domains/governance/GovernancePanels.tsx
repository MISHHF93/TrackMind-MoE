import { ApprovalChip, CollaborationPanel, EvidenceList, GovernedActionButton, KpiTile, MetricStrip, MockDataBanner, RecordSourceLabel, RiskBadge, StatusCard, WorkspacePanel } from '../../components/nexus-ui.js';
import type { AIGovernanceWorkspaceDto, ComplianceControlLibraryDto } from '../../types.js';

type GovernanceControl = ComplianceControlLibraryDto['controls'][number];
type AIRecommendation = AIGovernanceWorkspaceDto['recommendationQueue'][number];
type AIBlockedAction = AIGovernanceWorkspaceDto['safetyBlockedActions'][number];

const controlPlanePipeline = [
  { stage: 'Inputs', detail: 'Telemetry, race-day readiness, surface readings, security, weather, steward, equine, facilities, and audit feeds enter through typed DTOs.' },
  { stage: 'Feature Store', detail: 'Governed features preserve lineage, evidence IDs, and tenant-scoped operational context.' },
  { stage: 'Model Registry', detail: 'Model cards, validation reports, risk levels, intended use, prohibited use, and evaluation status remain visible before recommendations are trusted.' },
  { stage: 'Expert Models', detail: 'Domain experts produce Insight, Recommendation, and Forecast artifacts only; simulations and drafts remain advisory evidence, not execution commands.' },
  { stage: 'AI Governor', detail: 'Safety policies, confidence calibration, approval requirements, and blocked-action rules prevent protected autonomous execution.' },
  { stage: 'Approved Outputs', detail: 'Recommendation artifacts may start backend human approval workflows, but no AI output artifact can autonomously execute race, gate, vet, steward, payout, emergency, surface, or Digital Twin controls.' },
];

const expertModules = [
  { name: 'Surface Risk', owner: 'Track Surface', scope: 'surface anomaly detection, maintenance recommendations, and race-readiness surface forecasts' },
  { name: 'Race Readiness', owner: 'Race Office', scope: 'race-day readiness summaries, blocker classification, and approval cues' },
  { name: 'Gate Position', owner: 'Race Control', scope: 'starting-gate position analysis and draft move packages' },
  { name: 'Equine Advisory', owner: 'Equine Safety', scope: 'horse welfare, eligibility, and veterinarian-review-required advisories' },
  { name: 'Security Anomaly', owner: 'Security Operations', scope: 'restricted-zone anomaly classification and investigation summaries' },
  { name: 'Weather Impact', owner: 'Emergency Operations', scope: 'weather risk forecasts and operational watch recommendations' },
  { name: 'Maintenance Forecast', owner: 'Facilities Maintenance', scope: 'asset health, predictive maintenance, and work-order draft support' },
  { name: 'Steward Evidence Assistant', owner: 'Steward Center', scope: 'evidence organization and rule-context summaries for human stewards' },
  { name: 'Executive Intelligence', owner: 'Executive Center', scope: 'read-only operational, compliance, platform, and AI briefing synthesis' },
];

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function approvalRolesForRecommendation(ai: AIGovernanceWorkspaceDto, recommendationId: string) {
  const roles = ai.approvalRequirements.filter((req) => req.recommendationId === recommendationId).flatMap((req) => req.requiredRoles);
  return Array.from(new Set(roles));
}

function confidenceBand(recommendation: AIRecommendation | AIBlockedAction) {
  return recommendation.confidenceScore?.band ?? 'uncalibrated';
}

function rawConfidence(recommendation: AIRecommendation | AIBlockedAction) {
  return recommendation.confidenceScore?.raw ?? recommendation.confidence;
}

function adjustedConfidence(recommendation: AIRecommendation | AIBlockedAction) {
  return recommendation.confidenceScore?.calibrated ?? recommendation.confidence;
}

function controlRisk(status: string): 'low' | 'medium' | 'high' | 'critical' {
  if (/deficient|overdue|critical/i.test(status)) return 'critical';
  if (/open|partial|in-progress|review|assessing/i.test(status)) return 'high';
  if (/implemented|watch/i.test(status)) return 'medium';
  return 'low';
}

function scoreRisk(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 90) return 'low';
  if (score >= 75) return 'medium';
  if (score >= 50) return 'high';
  return 'critical';
}

function aiPackageLinks(control: GovernanceControl, ai: AIGovernanceWorkspaceDto) {
  return ai.evidencePackages.filter((pkg) => control.evidenceIds.includes(pkg.id) || control.auditRecordIds.some((auditId) => ai.auditTrails.some((audit) => audit.id === auditId || audit.subject === pkg.recommendationId)));
}

export function CompliancePanel({ compliance, ai }: { compliance: ComplianceControlLibraryDto; ai: AIGovernanceWorkspaceDto }) {
  const pendingControls = compliance.controls.filter((control) => !/effective|implemented/i.test(control.status));
  const evidenceRecordIds = Array.from(new Set([
    ...compliance.controls.flatMap((control) => control.evidenceIds),
    ...(compliance.evidencePackages ?? []).flatMap((pkg) => pkg.evidenceIds),
    ...compliance.findings.flatMap((finding) => finding.evidenceIds ?? []),
  ]));
  const exportFields = ['frameworkId', 'controlId', 'ownerId', 'status', 'evidenceIds', 'auditRecordIds', 'approvalRequestIds', 'workflowInstanceIds', 'eventIds', 'digitalTwinRefs'];
  const correlationRefs = Array.from(new Set([
    ...(compliance.auditReadinessEvents ?? []).map((event) => event.auditRecordId),
    ...(compliance.evidencePackages ?? []).flatMap((pkg) => [...pkg.auditRefs, ...pkg.eventRefs, ...pkg.workflowInstanceIds, ...pkg.approvalRequestIds]),
  ])).filter(Boolean);
  const collaborationControl = pendingControls[0] ?? compliance.controls[0];
  const collaborationEvidencePackage = collaborationControl ? (compliance.evidencePackages ?? []).find((pkg) => pkg.controlIds.includes(collaborationControl.id) || pkg.source.controlId === collaborationControl.id) : undefined;

  return (
    <section aria-label="Compliance Control Library dashboard">
      <h2>Compliance Control Library</h2>
      <MockDataBanner active={compliance.mock} source="Compliance Control Library mock/live facade" />
      <p>Framework placeholders, controls, obligations, universal evidence packages, owners, assessments, findings, corrective actions, review cycles, and audit readiness scores are linked to audit records and workflow evidence collection.</p>
      <p>ISO 25010 is included with AI management, security, privacy, racing, and audit frameworks so software quality signals for model reliability, maintainability, and performance efficiency are reviewed with AI evidence packages.</p>
      <p>Evidence packages model readiness and reusable evidence only; this dashboard does not claim that external certification or accreditation has been completed.</p>
      <MetricStrip items={[
        { label: 'Audit readiness score', value: String(compliance.readiness.score), detail: `${compliance.readiness.evidenceCoverage}% evidence coverage` },
        { label: 'Controls', value: `${compliance.readiness.effectiveControls}/${compliance.readiness.totalControls}`, detail: `${compliance.readiness.openFindings} open findings` },
        { label: 'Evidence packages', value: String((compliance.evidencePackages ?? []).length), detail: `${(compliance.evidencePackages ?? []).filter((pkg) => pkg.sealed).length} sealed packages` },
        { label: 'Approvals linked', value: String((compliance.evidencePackages ?? []).flatMap((pkg) => pkg.approvalRequestIds).length), detail: 'Backend-owned approval records only' },
      ]} />
      <p>Audit readiness score: {compliance.readiness.score}; evidence coverage {compliance.readiness.evidenceCoverage}%.</p><KpiTile label="Audit readiness score" value={String(compliance.readiness.score)} trend={`${compliance.readiness.evidenceCoverage}% evidence coverage`} />

      <section aria-label="Compliance pending control queue">
        <h3>Pending control queue</h3>
        {pendingControls.length ? pendingControls.map((control) => <article key={`pending-${control.id}`}>
          <RiskBadge level={controlRisk(control.status)} />
          <strong>{control.id}: {control.title}</strong>
          <p>Status {control.status}; owner {control.ownerId}; approvals {(control.approvalRequestIds ?? []).join(', ') || 'none'}; workflows {control.workflowInstanceIds.join(', ') || 'none'}.</p>
        </article>) : <p role="status">No pending compliance controls in this route.</p>}
        {collaborationControl && <CollaborationPanel
          routeScope="compliance"
          title="Compliance Control Evidence Room"
          targetArtifactId={collaborationControl.id}
          targetArtifactType="compliance-control"
          tenantId={collaborationEvidencePackage?.tenantId ?? 'track-1'}
          racetrackId={collaborationEvidencePackage?.racetrackId ?? 'track-1'}
          workflowRef={collaborationControl.workflowInstanceIds[0] ?? collaborationEvidencePackage?.workflowInstanceIds[0]}
          approvalRef={collaborationControl.approvalRequestIds?.[0] ?? collaborationEvidencePackage?.approvalRequestIds[0]}
          auditRefs={collaborationControl.auditRecordIds}
          twinRefs={collaborationControl.digitalTwinRefs ?? collaborationEvidencePackage?.digitalTwinRefs ?? []}
          evidenceRefs={[...collaborationControl.evidenceIds, ...(collaborationEvidencePackage?.evidenceIds ?? [])]}
          variant="evidence-review"
          activityItems={[
            { id: `${collaborationControl.id}-status`, actor: 'compliance-library', message: `Control status ${collaborationControl.status}; owner ${collaborationControl.ownerId}.`, at: compliance.reviewCycles[0]?.periodEnd ?? 'review-cycle', tone: controlRisk(collaborationControl.status) },
            { id: `${collaborationControl.id}-evidence`, actor: 'evidence-service', message: `Evidence package ${collaborationEvidencePackage?.id ?? 'pending'} is attached to audit/workflow review.`, at: compliance.auditReadinessEvents?.[0]?.occurredAt ?? 'pending', tone: 'info' },
          ]}
        />}
      </section>

      <section aria-label="Compliance evidence record panels">
        <h3>Evidence records</h3>
        <EvidenceList items={evidenceRecordIds} label="Compliance route evidence record IDs" />
        <p>Evidence is export-ready only as linked records; source files and official filings stay owned by backend evidence services.</p>
      </section>

      <section aria-label="Compliance correlation and export panel">
        <h3>Correlation and export layout</h3>
        <p>Correlation records {correlationRefs.join(', ') || 'none linked'}.</p>
        <p>Export-ready fields <code>{exportFields.join(',')}</code>.</p>
      </section>

      {compliance.trackCertificationCandidate && <section aria-label="TrackMind Certified Track candidate">
        <h3>TrackMind Certified Track Candidate</h3>
        <p>{compliance.trackCertificationCandidate.candidateStatement}</p>
        <p>{compliance.trackCertificationCandidate.claimBoundary}</p>
        <MetricStrip items={[
          { label: 'Safety Score', value: String(compliance.trackCertificationCandidate.scorecard.safetyScore), detail: 'TrackMind readiness score' },
          { label: 'Compliance Score', value: String(compliance.trackCertificationCandidate.scorecard.complianceScore), detail: 'Control library readiness' },
          { label: 'Operational Score', value: String(compliance.trackCertificationCandidate.scorecard.operationalScore), detail: 'Race-day operating readiness' },
          { label: 'Accreditation Score', value: String(compliance.trackCertificationCandidate.scorecard.accreditationScore), detail: 'Internal accreditation readiness' },
        ]} />
        <section aria-label="Certified Track criteria">
          <h4>Criteria</h4>
          {compliance.trackCertificationCandidate.certificationCriteria.map((criterion) => <article key={criterion.id}>
            <RiskBadge level={scoreRisk(criterion.score)} />
            <strong>{criterion.label}</strong>
            <p>{criterion.status}; score {criterion.score}; controls {criterion.requiredControlRefs.join(', ') || 'pending'}; evidence {criterion.requiredEvidenceRefs.map((ref) => ref.id).join(', ') || 'pending'}.</p>
          </article>)}
        </section>
        <section aria-label="Franchise operating standards">
          <h4>Franchise operating standards</h4>
          {compliance.trackCertificationCandidate.operatingStandards.map((standard) => <p key={standard.id}>{standard.title}; owner {standard.ownerRole}; cadence {standard.cadence}; controls {standard.controlRefs.join(', ') || 'pending'}.</p>)}
        </section>
      </section>}

      <section aria-label="Compliance framework placeholders">
        <h3>Framework placeholders</h3>
        {compliance.frameworks.map((framework) => <article key={framework.id}>
          <RecordSourceLabel mock={framework.placeholder || compliance.mock} label="compliance framework" />
          <strong>{framework.id}</strong>
          <p>{framework.name}; placeholder: {String(framework.placeholder)}; authority {framework.authority}; artifact {framework.accreditationArtifact ?? 'pending'}.</p>
        </article>)}
      </section>

      <section aria-label="Compliance controls">
        <h3>Controls</h3>
        {compliance.controls.map((control) => <WorkspacePanel key={control.id} title={control.title} eyebrow={`Control ${control.id}`}>
          <RiskBadge level={controlRisk(control.status)} />
          <p>{control.status}; owner {control.ownerId}; cadence {control.reviewCadence ?? 'configured by obligations'}; frameworks {control.frameworkIds.join(', ')}</p>
          <EvidenceList items={control.evidenceIds} label={`Compliance evidence records for ${control.id}`} />
          <p>Audit records {control.auditRecordIds.join(', ')}; workflows {control.workflowInstanceIds.join(', ') || 'none'}; approvals {(control.approvalRequestIds ?? []).join(', ') || 'none'}.</p>
          <p>Affected assets and twins {(control.digitalTwinRefs ?? []).join(', ') || 'not linked'}; events {(control.eventIds ?? []).join(', ') || 'none'}.</p>
          <p>HISA oversight categories {(control.hisaOperationalOversightCategories ?? []).join(', ') || 'not categorized'}.</p>
        </WorkspacePanel>)}
      </section>

      <section aria-label="Compliance AI governance crosswalk">
        <h3>AI governance crosswalk</h3>
        {compliance.controls.filter((control) => control.frameworkIds.includes('ISO-42001') || control.frameworkIds.includes('ISO-25010') || aiPackageLinks(control, ai).length > 0).map((control) => <article key={control.id}>
          <strong>{control.id}: {control.title}</strong>
          <p>Frameworks {control.frameworkIds.join(', ')}; evidence packages {aiPackageLinks(control, ai).map((pkg) => pkg.id).join(', ') || 'pending package link'}.</p>
          <p>Findings {compliance.findings.filter((finding) => finding.controlId === control.id).map((finding) => finding.id).join(', ') || 'none'}; corrective actions {compliance.correctiveActions.filter((action) => compliance.findings.some((finding) => finding.controlId === control.id && finding.id === action.findingId)).map((action) => action.id).join(', ') || 'none'}.</p>
        </article>)}
      </section>

      <section aria-label="Compliance obligations"><h3>Obligations</h3>{compliance.obligations.map((obligation) => <p key={obligation.id}>{obligation.frameworkId}: {obligation.citation} - {obligation.summary}</p>)}</section>
      <section aria-label="Control owners and permissions"><h3>Control owners</h3>{compliance.owners.map((owner) => <p key={owner.id}>{owner.displayName}: {owner.role}; permissions {owner.permissions.join(', ')}</p>)}</section>
      <section aria-label="Compliance findings and corrective actions"><h3>Findings and corrective actions</h3>{compliance.findings.map((finding) => <article key={finding.id}><RiskBadge level={controlRisk(finding.severity)} /><strong>{finding.severity}: {finding.summary}</strong><p>Status {finding.status}; actions {finding.correctiveActionIds.join(', ')}</p><EvidenceList items={finding.evidenceIds ?? []} label={`Finding evidence records for ${finding.id}`} /></article>)}{compliance.correctiveActions.map((action) => <p key={action.id}>{action.action}; due {action.dueAt}; workflow {action.workflowInstanceId ?? 'none'}; approval {action.approvalRequestId ?? 'none'}</p>)}</section>
      <section aria-label="Compliance evidence packages and AI audit trails"><h3>Evidence packages and AI audit trails</h3>{ai.evidencePackages.map((pkg) => <article key={pkg.id}><strong>{pkg.id}</strong><p>Recommendation {pkg.recommendationId}; hash {pkg.hash}</p><EvidenceList items={pkg.evidence} label={`AI evidence records for ${pkg.id}`} /></article>)}{ai.auditTrails.map((audit) => <p key={audit.id}>{audit.id}: {audit.action}; subject {audit.subject}; evidence {audit.evidence.join(', ')}</p>)}</section>
      <section aria-label="Compliance review cycles"><h3>Review cycles</h3>{compliance.reviewCycles.map((cycle) => <p key={cycle.id}>{cycle.frameworkId} {cycle.periodStart}-{cycle.periodEnd}: {cycle.status}; score {cycle.readinessScore}</p>)}</section>
      <section aria-label="Audit readiness score by framework"><h3>Audit readiness by framework</h3>{compliance.readiness.byFramework.map((item) => <p key={item.frameworkId}>{item.frameworkId}: {item.score}% across {item.controls} controls</p>)}</section>
      <section aria-label="Compliance control assessments"><h3>Assessments</h3>{(compliance.assessments ?? []).map((assessment) => <article key={assessment.id}><strong>{assessment.controlId}: {assessment.rating}</strong><p>{assessment.notes}; evidence {assessment.evidenceIds.join(', ')}; findings {assessment.findingIds.join(', ') || 'none'}</p></article>)}</section>
      <section aria-label="Compliance framework mappings"><h3>Framework mappings</h3>{(compliance.frameworkMappings ?? []).map((mapping) => <article key={mapping.id}><strong>{mapping.frameworkId}: {mapping.citation}</strong><p>Maps to {mapping.mappedTo.map((item) => `${item.frameworkId} ${item.relationship}`).join(', ')}; commission rule {mapping.racingCommissionRule ?? 'n/a'}; controls {mapping.controlIds.join(', ')}</p></article>)}</section>
      <section aria-label="Compliance evidence packages"><h3>Evidence packages</h3>{(compliance.evidencePackages ?? []).map((pkg) => <article key={pkg.id}><strong>{pkg.title}</strong><p>Evidence {pkg.evidenceId}; tenant {pkg.tenantId}; racetrack {pkg.racetrackId}; source {pkg.source.objectType}:{pkg.source.objectId}; readiness {pkg.readiness}; sealed {String(pkg.sealed)}.</p><p>Frameworks {pkg.frameworkIds.join(', ')}; mappings {pkg.frameworkMappings.map((mapping) => `${mapping.frameworkId}:${mapping.evidenceUse}`).join(', ') || 'pending'}.</p><p>Owner {pkg.controlOwnerId}; cadence {pkg.reviewCadence}; AI recommendations {pkg.aiRecommendationRefs.join(', ') || 'none'}; HISA categories {pkg.hisaOperationalOversightCategories.join(', ')}.</p><p>Audits {pkg.auditRefs.join(', ') || pkg.auditRecordIds.length}; events {pkg.eventRefs.join(', ') || pkg.eventIds.length}; workflows {pkg.workflowInstanceIds.join(', ') || 'none'}; twins {pkg.digitalTwinRefs.join(', ')}</p><p>Accreditation readiness {pkg.accreditationReadiness.status}; score {pkg.accreditationReadiness.score}; external certification claimed {String(pkg.accreditationReadiness.externalCertificationClaimed)}. {pkg.accreditationReadiness.notes}</p></article>)}</section>
      <section aria-label="Accreditation readiness programs"><h3>Accreditation readiness</h3>{(compliance.accreditationPrograms ?? []).map((program) => <article key={program.id}><RiskBadge level={scoreRisk(program.readinessScore)} /><strong>{program.name}</strong><p>{program.status}; authority {program.authority}; jurisdiction {program.jurisdiction}; score {program.readinessScore}; next review {program.nextReviewAt}</p><p>Frameworks {program.frameworkIds.join(', ')}; evidence packages {program.evidencePackageIds.join(', ')}; readiness only {String(program.readinessOnly ?? true)}; external certification claimed {String(program.externalCertificationClaimed ?? false)}</p></article>)}</section>
      <section aria-label="Compliance audit readiness events"><h3>Audit readiness events</h3>{(compliance.auditReadinessEvents ?? []).map((event) => <article key={event.id}><strong>{event.type}</strong><p>Audit {event.auditRecordId}; event {event.eventId ?? 'pending'}; workflow {event.workflowInstanceId ?? 'n/a'}; approval {event.approvalRequestId ?? 'n/a'}</p></article>)}</section>
      <section aria-label="Compliance integration coverage"><h3>Integration coverage</h3><p>Audit {String(compliance.integrations?.audit)}; workflow {String(compliance.integrations?.workflow)}; approvals {String(compliance.integrations?.approvals)}; events {String(compliance.integrations?.events)}; API facade {String(compliance.integrations?.apiFacade)}; command center {String(compliance.integrations?.commandCenter)}; Digital Twin {String(compliance.integrations?.digitalTwin)}.</p></section>
      <section aria-label="Compliance approval gates"><h3>Approval gates</h3><GovernedActionButton label="Request compliance filing approval" approvalApi="POST /api/v1/approvals/controlled-actions" reason="Compliance filings and official evidence package transitions are backend approval workflows, not local UI mutations." /></section>
    </section>
  );
}

export function AIGovernancePanel({ ai }: { ai: AIGovernanceWorkspaceDto }) {
  const governorReviews = ai.governorReviews ?? ai.controlPlane?.governorReviews ?? [];
  const exportFields = ['recommendationId', 'agentId', 'modelVersionId', 'promptTemplateId', 'confidenceScore', 'riskLevel', 'affectedAssets', 'approvalRequirementId', 'auditIds', 'eventIds', 'evidencePackageId', 'blockedAutonomousExecution'];
  const collaborationRecommendation = ai.recommendationQueue[0];
  const collaborationApprovalRequirement = collaborationRecommendation ? ai.approvalRequirements.find((req) => req.recommendationId === collaborationRecommendation.id) : undefined;
  const collaborationEvidencePackage = collaborationRecommendation ? ai.evidencePackages.find((pkg) => pkg.recommendationId === collaborationRecommendation.id) : undefined;
  const collaborationTwinRefs = collaborationRecommendation ? (ai.digitalTwinImpacts ?? []).filter((impact) => impact.recommendationId === collaborationRecommendation.id).map((impact) => impact.twinId) : [];

  return (
    <section aria-label="AI Governance workspace">
      <h2>Unified AI/ML Control Plane</h2>
      <MockDataBanner active={ai.mock} source="AI Governance mock/live facade" />
      <p>Responsible AI workspace for governed inputs, feature-store metadata, model registry records, expert model selections, recommendation records, risk classifications, approval requirements, evidence packages, overrides, rollback records, monitoring metrics, events, and audit trails.</p>
      <p role="alert"><strong>AI control warning:</strong> AI may recommend/summarize/classify/forecast/simulate/draft only; no autonomous race/gate/vet/steward/payout/emergency controls. AI outputs are limited to Insight, Recommendation, and Forecast artifacts.</p>
      <p>Recommendations are advisory decision support only. Protected or operational actions stay blocked until a human approval token is issued by the approval service and captured in the audit trail. No direct local mutation of race, gate, veterinary, steward, payout, emergency, surface, facility, security, or Digital Twin state occurs in this frontend view.</p>
      <MetricStrip items={[
        { label: 'AI agents', value: String(ai.activeAgents.length), detail: `${ai.modelVersions.length} model versions; ${ai.promptTemplates.length} prompts` },
        { label: 'Recommendations', value: String(ai.recommendationQueue.length), detail: `${ai.safetyBlockedActions.length} blocked actions; approval gated` },
        { label: 'Evidence packages', value: String(ai.evidencePackages.length), detail: `${ai.overrides.length} overrides; ${ai.rollbackRecords.length} rollbacks` },
        { label: 'Monitoring signals', value: String((ai.observabilitySignals ?? []).length + ai.monitoringMetrics.length), detail: 'Confidence, drift, and blocked-action telemetry' },
      ]} />

      <section aria-label="AI Control Plane cards">
        <h3>Control Plane cards</h3>
        <WorkspacePanel title="Agent registry" eyebrow="AI control plane">
          <p>{ai.activeAgents.length} registered advisory agents; no protected action execution endpoint is exposed.</p>
        </WorkspacePanel>
        <WorkspacePanel title="Model registry" eyebrow="AI control plane">
          <p>{ai.modelVersions.length} model versions and {ai.promptTemplates.length} prompt templates with evidence, intended use, and prohibited use records.</p>
        </WorkspacePanel>
        <WorkspacePanel title="Recommendation queue" eyebrow="AI control plane">
          <p>{ai.recommendationQueue.length} recommendation cards; {ai.safetyBlockedActions.length} protected actions blocked or approval-routed.</p>
        </WorkspacePanel>
      </section>

      <section aria-label="Unified AI/ML Control Plane pipeline">
        <h3>Inputs -&gt; Feature Store -&gt; Model Registry -&gt; Expert Models -&gt; AI Governor -&gt; Approved Outputs</h3>
        <p>Inputs -&gt; Feature Store -&gt; Model Registry -&gt; Expert Models -&gt; AI Governor -&gt; Approved Outputs.</p>
        <ol>
          {controlPlanePipeline.map((stage) => <li key={stage.stage}><strong>{stage.stage}</strong><p>{stage.detail}</p></li>)}
        </ol>
      </section>

      <section aria-label="Expert module roster">
        <h3>Expert module roster</h3>
        {expertModules.map((module) => {
          const linkedAgent = ai.activeAgents.find((agent) => agent.name.toLowerCase().includes(module.name.split(' ')[0].toLowerCase()));
          return <StatusCard key={module.name} title={module.name} status={linkedAgent?.status ?? 'registered'} detail={`${module.owner}; ${module.scope}. ${linkedAgent ? `Agent ${linkedAgent.id}` : 'No autonomous execution permission exposed in frontend.'}`} tone={linkedAgent?.status === 'active' ? 'ok' : 'info'} />;
        })}
      </section>

      <section aria-label="ISO 42001 and NIST AI RMF governance anchors">
        <h3>Governance anchors</h3>
        <WorkspacePanel title="ISO 42001 AI management system" eyebrow="ISO 42001">
          <p>Anchor: accountable AI management controls, intended-use boundaries, evidence packages, audit trails, approval gates, human oversight, and continuous monitoring.</p>
        </WorkspacePanel>
        <WorkspacePanel title="NIST AI RMF Govern Map Measure Manage" eyebrow="NIST AI RMF">
          <p>Anchor: govern policy ownership, map operational context, measure confidence, drift, explainability, and safety impact, then manage risk through blocked actions and approval-required workflows.</p>
        </WorkspacePanel>
      </section>

      <section aria-label="Active AI agents"><h3>Active agents</h3>{ai.activeAgents.map((agent) => <article key={agent.id}><RecordSourceLabel mock={ai.mock} label="AI agent registry record" /><strong>{agent.name}</strong><p>{agent.status}; model {agent.modelVersionId}; prompt {agent.promptTemplateId}; activities {(agent.allowedActivities ?? []).join(', ') || 'registered advisory activities'}; restricted {agent.restrictedActions.join(', ')}</p><p>Allowed actions are advisory/draft only: {agent.allowedActions.join(', ')}. Digital Twin refs {(agent.digitalTwinRefs ?? []).join(', ') || 'none'}</p></article>)}</section>
      <section aria-label="AI model versions and prompt templates"><h3>Model versions and prompts</h3>{ai.modelVersions.map((model) => <article key={model.id}><RiskBadge level={model.riskLevel} /><strong>{model.name} {model.version}</strong><p>Status {model.status}; intended use {(model.intendedUse ?? []).join(', ') || 'n/a'}; prohibited use {(model.prohibitedUse ?? []).join(', ') || 'n/a'}</p><EvidenceList items={model.evidence} label={`Model evidence records for ${model.id}`} /><p>Lineage {model.lineage.join(' -> ')}</p></article>)}{ai.promptTemplates.map((prompt) => <article key={prompt.id}><strong>{prompt.name} {prompt.version}</strong><p>Status {prompt.status}; policy {prompt.safetyPolicyId ?? 'default'}; activities {(prompt.allowedActivities ?? []).join(', ') || 'registered advisory activities'}</p><EvidenceList items={prompt.evidence} label={`Prompt evidence records for ${prompt.id}`} /></article>)}</section>
      <section aria-label="AI recommendation queue">
        <h3>Recommendation queue</h3>
        <section aria-label="AI control plane recommendation cards">
          {ai.recommendationQueue.map((rec) => {
            const requiredRoles = approvalRolesForRecommendation(ai, rec.id);
            return <WorkspacePanel key={rec.id} title={rec.recommendation} eyebrow={`Recommendation ${rec.id}`}>
              <RecordSourceLabel mock={ai.mock} label="AI control-plane recommendation" />
              <RiskBadge level={rec.riskLevel} />
              <ApprovalChip status="pending-approval" />
              <p aria-label={`Confidence badge ${rec.id}`}>Confidence badge: {percent(rawConfidence(rec))} raw; adjusted confidence {percent(adjustedConfidence(rec))}; band {confidenceBand(rec)}.</p>
              <p>Risk level {rec.riskLevel}; affected assets {rec.affectedAssets.join(', ')}; approval policy {rec.approvalPolicy}; status {rec.status}; blockedAutonomousExecution: true.</p>
              <p>Approval-required roles: {requiredRoles.join(', ') || 'configured AI governance approver'}.</p>
              {rec.explainability && <p>Explainability {rec.explainability.method}: {rec.explainability.rationale} Human review required {String(rec.explainability.humanReviewRequired)}.</p>}
              <section aria-label={`Confidence and evidence panel for ${rec.id}`}>
                <h4>Confidence and evidence</h4>
                <EvidenceList items={rec.evidence} label={`Recommendation evidence records for ${rec.id}`} />
                <p>Lineage {rec.lineage.join(' -> ')}</p>
                <p>Confidence drivers {(rec.confidenceScore?.drivers ?? rec.evidence).join(', ')}</p>
              </section>
            </WorkspacePanel>;
          })}
        </section>
        {collaborationRecommendation && <CollaborationPanel
          routeScope="ai-governance"
          title="AI Recommendation Review"
          targetArtifactId={collaborationRecommendation.id}
          targetArtifactType="ai-recommendation"
          tenantId="track-1"
          racetrackId="track-1"
          workflowRef={collaborationApprovalRequirement?.workflowRecordId}
          approvalRef={collaborationApprovalRequirement?.approvalRequestId ?? collaborationApprovalRequirement?.id}
          auditRefs={[collaborationApprovalRequirement?.auditId, ...(collaborationEvidencePackage?.lineage ?? []), ...ai.auditTrails.filter((audit) => audit.subject === collaborationRecommendation.id).map((audit) => audit.id)].filter(Boolean) as string[]}
          twinRefs={collaborationTwinRefs}
          evidenceRefs={[...collaborationRecommendation.evidence, ...(collaborationApprovalRequirement?.evidence ?? []), ...(collaborationEvidencePackage?.evidence ?? [])]}
          variant="approval-discussion"
          activityItems={[
            { id: `${collaborationRecommendation.id}-generated`, actor: collaborationRecommendation.agentId, message: collaborationRecommendation.recommendation, at: ai.generatedAt, tone: collaborationRecommendation.riskLevel },
            { id: `${collaborationRecommendation.id}-governor`, actor: 'ai-governor', message: `Approval policy ${collaborationRecommendation.approvalPolicy}; blocked autonomous execution remains true.`, at: ai.generatedAt, tone: 'warning' },
          ]}
        />}
      </section>
      <section aria-label="Safety-blocked AI actions">
        <h3>Safety-blocked actions</h3>
        <section aria-label="Blocked-action log for protected controls">
          {ai.safetyBlockedActions.map((blocked) => <article key={blocked.id} role="alert">
            <RiskBadge level="critical" />
            <strong>{blocked.action}: {blocked.target}</strong>
            <p>{blocked.reason}; approval policy {blocked.approvalPolicy}; confidence {percent(rawConfidence(blocked))}; adjusted confidence {percent(adjustedConfidence(blocked))}; blockedAutonomousExecution: true.</p>
            {blocked.explainability && <p>Explainability {blocked.explainability.method}: {blocked.explainability.rationale}</p>}
            <EvidenceList items={blocked.evidence} label={`Blocked action evidence records for ${blocked.id}`} />
            <p>Affected assets {blocked.affectedAssets.join(', ')}</p>
          </article>)}
        </section>
      </section>
      <section aria-label="AI evaluation status"><h3>Evaluation status</h3>{ai.evaluationStatus.map((item) => <article key={item.modelVersionId}><strong>{item.modelVersionId}: {item.status}</strong><p>Deployable {String(item.readiness.deployable)}; gaps {(item.readiness.gaps ?? []).join(', ') || 'none'}; explainability {item.latestEvaluation?.explainabilityScore}</p></article>)}</section>
      <section aria-label="AI risk classifications"><h3>Risk classifications</h3>{ai.riskClassifications.map((risk) => <article key={risk.subjectId}><strong>{risk.subjectId}: {risk.level}</strong><p>Drivers {risk.drivers.join(', ')}</p></article>)}</section>
      <section aria-label="AI evidence packages"><h3>Evidence packages</h3>{ai.evidencePackages.map((pkg) => <article key={pkg.id}><code>{pkg.hash}</code><p>{pkg.recommendationId}; lineage {pkg.lineage.join(' -> ')}</p><EvidenceList items={pkg.evidence} label={`AI evidence package records for ${pkg.id}`} /></article>)}</section>
      <section aria-label="AI approval requirements"><h3>Approval requirements</h3>{ai.approvalRequirements.map((req) => <article key={req.id}><ApprovalChip status="pending-approval" /><strong>{req.policy}</strong><p>Roles {req.requiredRoles.join(', ')}; status {req.status}; recommendation {req.recommendationId}</p><EvidenceList items={req.evidence} label={`AI approval evidence records for ${req.id}`} /></article>)}</section>
      <section aria-label="AI Governor review records"><h3>Governor reviews</h3>{governorReviews.map((review) => <article key={review.id} role={review.blockedAutonomousExecution ? 'alert' : undefined}><RiskBadge level={review.riskLevel} /><strong>{review.decision ?? (review.canExecute ? 'approved' : 'blocked')}: {review.canonicalAction ?? review.action}</strong><p>Can execute {String(review.canExecute)}; policy allows automation {String(review.policyAllowsAutomation)}; governor approved {String(review.responsibleAIGovernorApproved)}; approval required {String(review.approvalRequired)}.</p><p>{review.reason}</p><p>Required roles {(review.requiredApproverRoles ?? []).join(', ') || 'none'}; audit {review.auditRef ?? 'pending'}; event {review.eventRef ?? 'pending'}.</p><EvidenceList items={review.policyEvidence ?? review.evidence} label={`AI Governor policy evidence for ${review.id}`} /></article>)}</section>
      <section aria-label="Approval-required workflows and human-in-the-loop policy">
        <h3>Approval-required workflows and human-in-the-loop policy</h3>
        <p>Human-in-the-loop policy: every recommendation that touches protected controls is routed to backend approval workflows, evidence capture, and immutable audit trails before any live service can act.</p>
        {ai.approvalRequirements.map((req) => <WorkspacePanel key={`workflow-${req.id}`} title={req.policy} eyebrow="Approval-required workflow">
          <ApprovalChip status="pending-approval" />
          <p>Recommendation {req.recommendationId}; controlled action {req.controlledAction ?? req.action ?? 'n/a'}; approval {req.approvalRequestId ?? 'pending'}; roles {req.requiredRoles.join(', ')}; status {req.status}.</p>
          <p>Audit {req.auditId ?? 'pending'}; event {req.eventId ?? 'pending'}; workflow record {req.workflowRecordId ?? 'pending'}.</p>
          <EvidenceList items={req.evidence} label={`AI approval evidence records for ${req.id}`} />
        </WorkspacePanel>)}
        {(ai.humanInLoopWorkflows ?? []).map((workflow) => <WorkspacePanel key={workflow.id} title={workflow.controlledAction ?? workflow.action} eyebrow="Human-in-the-loop workflow">
          <p>Recommendation {workflow.recommendationId}; approval {workflow.approvalRequestId ?? 'pending'}; roles {workflow.requiredRoles.join(', ')}; execution allowed {String(workflow.executionAllowed)}.</p>
          <p>Audit <code>{workflow.auditId}</code>; event <code>{workflow.eventId}</code>; draft work order {workflow.draftWorkOrderId ?? 'none'}.</p>
          <EvidenceList items={workflow.evidence} label={`Human review workflow evidence for ${workflow.id}`} />
        </WorkspacePanel>)}
        {(ai.draftWorkOrders ?? []).map((workOrder) => <WorkspacePanel key={workOrder.id} title={workOrder.summary} eyebrow="Draft work order">
          <p>{workOrder.controlledAction ?? workOrder.action} for {workOrder.target}; state {workOrder.executionState}; execution allowed {String(workOrder.executionAllowed)}.</p>
          <EvidenceList items={workOrder.evidence} label={`Draft work order evidence for ${workOrder.id}`} />
        </WorkspacePanel>)}
        {(ai.blockedAutonomousExecutionLogs ?? []).map((log) => <WorkspacePanel key={log.id} title={`${log.action}: ${log.target}`} eyebrow="Blocked autonomous execution">
          <RiskBadge level="critical" />
          <p>{log.reason}; actor {log.actor}; audit <code>{log.auditId}</code>; event <code>{log.eventId}</code>.</p>
          <EvidenceList items={log.evidence} label={`Blocked autonomous execution evidence for ${log.id}`} />
        </WorkspacePanel>)}
        {(ai.safetyPolicies ?? []).map((policy) => <WorkspacePanel key={`hitl-${policy.id}`} title={policy.id} eyebrow="Human-in-the-loop policy">
          <p>Allowed AI activities: {policy.allowedActivities.join(', ')} only. Automatic advisory actions {(policy.automaticAdvisoryActions ?? []).join(', ') || 'configured by AI Governor'}.</p>
          <p>Autonomous execution allowed for protected controls: false. Blocked autonomous actions {(policy.blockedActions ?? policy.prohibitedAutonomousActions).join(', ')}.</p>
          <p>Approval roles {Object.entries(policy.approvalRoles ?? {}).map(([action, roles]) => `${action}: ${roles.join('/')}`).join('; ') || 'configured by centralized approval policies'}.</p>
        </WorkspacePanel>)}
      </section>
      <section aria-label="AI safety policies"><h3>Safety policies</h3>{(ai.safetyPolicies ?? []).map((policy) => <article key={policy.id}><strong>{policy.id}</strong><p>AI may {policy.allowedActivities.join(', ')} only; automatic advisory actions {(policy.automaticAdvisoryActions ?? []).join(', ') || 'configured by AI Governor'}.</p><p>Blocked autonomous actions {(policy.blockedActions ?? policy.prohibitedAutonomousActions).join(', ')}; required evidence {policy.requiredEvidence.join(', ')}</p></article>)}</section>
      <section aria-label="AI Digital Twin impacts"><h3>Digital Twin impacts</h3>{(ai.digitalTwinImpacts ?? []).map((impact) => <article key={`${impact.recommendationId}-${impact.twinId}`}><strong>{impact.twinId}</strong><p>{impact.kind}; asset {impact.assetId}; approval required {String(impact.approvalRequired)}; event {impact.eventType}; audit {impact.auditId ?? 'pending'}</p><p>Patch keys {Object.keys(impact.patch).join(', ')}</p></article>)}</section>
      <section aria-label="AI observability signals"><h3>Observability signals</h3>{(ai.observabilitySignals ?? []).map((signal) => <article key={signal.id} data-status={signal.status}><strong>{signal.metric}: {signal.value}</strong><p>Subject {signal.subjectId}; threshold {signal.threshold ?? 'n/a'}; trace {signal.traceId}; observed {signal.observedAt}</p><EvidenceList items={signal.evidence} label={`AI observability evidence records for ${signal.id}`} /></article>)}</section>
      <section aria-label="AI governance export package layout">
        <h3>Export package layout</h3>
        <p>Export-ready fields <code>{exportFields.join(',')}</code>.</p>
        <p>Correlation references: audits {ai.auditTrails.map((audit) => audit.id).join(', ') || 'none'}; events {ai.events.map((event) => event.id).join(', ') || 'none'}; evidence packages {ai.evidencePackages.map((pkg) => pkg.id).join(', ') || 'none'}.</p>
      </section>
      <section aria-label="AI advisory approval gates"><h3>Advisory approval gates</h3><section aria-label="AI control plane approval controls"><GovernedActionButton label="Request AI recommendation approval" approvalApi="POST /api/v1/approvals/controlled-actions" reason="Recommendation approval is a backend human workflow; this frontend does not mutate local operational state." /><GovernedActionButton label="Request AI override approval" approvalApi="POST /api/v1/approvals/controlled-actions" reason="Override records require human approval evidence and audit capture." /><GovernedActionButton label="Request AI rollback approval" approvalApi="POST /api/v1/approvals/controlled-actions" reason="Rollback execution is protected and remains disabled here." /><GovernedActionButton label="Request AI protected action approval" approvalApi="POST /api/v1/approvals/controlled-actions" reason="Protected race, surface, veterinary, steward, emergency, or payout actions cannot be executed by AI." /></section><p>These controls only create approval workflow requests; no AI agent can execute protected race, gate, veterinary, steward, payout, emergency, surface, or Digital Twin actions directly.</p></section>
      <section aria-label="AI overrides and rollback records"><h3>Overrides and rollbacks</h3><section aria-label="AI override records">{ai.overrides.map((o) => <p key={o.id}>Override {o.recommendationId}: {o.reason}; actor {o.actor}; evidence {o.evidence.join(', ')}</p>)}</section><section aria-label="AI rollback records">{ai.rollbackRecords.map((r) => <p key={r.id}>Rollback {r.recommendationId} to {r.restoredVersionId}: {r.reason}; actor {r.actor}; evidence {r.evidence.join(', ')}</p>)}</section></section>
      <section aria-label="AI monitoring metrics"><h3>Monitoring metrics</h3>{ai.monitoringMetrics.map((m) => <article key={`${m.modelId}-${m.metric}`}><strong>{m.metric}</strong><p>{m.modelId}; value {m.value}; threshold {m.threshold}; evidence {m.evidence.join(', ')}</p></article>)}</section>
      <section aria-label="AI governance events"><h3>Governance events</h3>{ai.events.map((event) => <article key={event.id}><strong>{event.type}</strong><p>Subject {event.subjectId}; actor {event.actor ?? 'unknown'}; timestamp {event.timestamp}; evidence {(event.evidence ?? []).join(', ') || 'none'}</p></article>)}</section>
      <section aria-label="AI audit trails"><h3>Audit trails</h3>{ai.auditTrails.map((audit) => <article key={audit.id}><code>{audit.action}</code><p>{audit.actor}; subject {audit.subject}; evidence {audit.evidence.join(', ')}</p></article>)}</section>
    </section>
  );
}

