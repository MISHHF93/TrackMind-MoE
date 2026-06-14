import { ActionRail, ApprovalChip, DataFreshness, DataTable, EvidenceList, KpiTile, MetricStrip, MockDataBanner, RecordSourceLabel, RiskBadge, StatusCard, WorkspacePanel } from '../../components/nexus-ui.js';
import type { AdapterMode, RacingDataApiHubWorkspaceDto } from '../../types.js';

const qualityRisk = (score: number, severity: string) => {
  if (severity === 'critical' || score < 50) return 'critical';
  if (severity === 'error' || score < 75) return 'high';
  if (severity === 'warning' || score < 90) return 'medium';
  return 'low';
};

const reviewActions = (workspace: RacingDataApiHubWorkspaceDto) => (workspace.reviewActions ?? []).map((action) => ({
  id: action.id,
  label: action.label,
  detail: `${action.disabledReason} Decision mode: ${action.decision}; draftOnly ${String(action.draftOnly)}; approvalRequired ${String(action.approvalRequired)}.`,
  approvalApi: action.approvalApi,
  locked: true,
}));

function licenseWarningLabels(status: { licenseStatus: string; commercialUseAllowed: boolean; redistributionAllowed: boolean; attributionRequired: boolean; piiPresent: boolean }) {
  return [
    status.licenseStatus !== 'active' ? `License ${status.licenseStatus}` : undefined,
    !status.commercialUseAllowed ? 'Commercial use blocked' : undefined,
    !status.redistributionAllowed ? 'Redistribution blocked' : undefined,
    status.attributionRequired ? 'Attribution required' : undefined,
    status.piiPresent ? 'PII present' : undefined,
  ].filter((label): label is string => Boolean(label));
}

function payloadLicenseContext(review: RacingDataApiHubWorkspaceDto['rawPayloadReviews'][number]) {
  const context = review.licenseContext ?? review.payload.licenseContext ?? review.payload.license;
  return `${context.licenseStatus}; commercialUseAllowed=${String(context.commercialUseAllowed)}; redistributionAllowed=${String(context.redistributionAllowed)}; attributionRequired=${String(context.attributionRequired)}; piiPresent=${String(context.piiPresent)}; licenseId=${'licenseId' in context ? context.licenseId ?? 'not reported' : 'not reported'}`;
}

export function ApiHubPanel({ workspace, mode }: { workspace: RacingDataApiHubWorkspaceDto; mode: AdapterMode }) {
  const resolutionQueue = workspace.entityResolutionQueue ?? workspace.entityResolution.clusters;
  const lineagePaths = workspace.lineage.paths ?? [];
  const lowQualityReports = workspace.qualityReports.filter((report) => report.score < 75 || report.severity === 'error' || report.severity === 'critical');
  const providerName = (providerId: string) => workspace.providers.find((provider) => provider.providerId === providerId)?.displayName ?? providerId;
  const policyCenter = workspace.policyCenter ?? workspace.licensePolicies.map((policy) => ({
    policyId: policy.policyId,
    providerId: policy.providerId,
    licenseStatus: policy.status,
    dataClasses: policy.dataClasses,
    allowedUses: policy.usageScope,
    restrictedUses: policy.redistributionAllowed ? [] : ['public redistribution'],
    attribution: { required: policy.attributionRequired },
    retentionDays: policy.retention.retentionDays,
    exportAllowed: policy.status === 'active',
    redistributionAllowed: policy.redistributionAllowed,
    commercialUseAllowed: policy.commercialUseAllowed,
    privacyClassification: policy.status === 'active' ? 'confidential' as const : 'restricted' as const,
    modelTraining: { allowed: policy.usageScope.includes('ai-training'), restrictions: policy.usageScope.includes('ai-training') ? ['Training requires lineage, attribution, retention, and approval evidence.'] : ['Unlicensed model training blocked until ai-training scope is present.'], unlicensedBlocked: !policy.usageScope.includes('ai-training') },
    blockedExportReasons: policy.redistributionAllowed ? [] : ['Public redistribution blocked: redistributionAllowed=false for provider license.'],
    evidenceRefs: policy.evidenceRefs,
    mock: policy.mock,
  }));
  const featureStoreExports = workspace.featureStoreExports ?? [];
  const dataLakeExports = workspace.dataLakeExports ?? [];
  const exportControls = workspace.exportControls ?? [...featureStoreExports, ...dataLakeExports].map((manifest) => ({
    id: `control-${manifest.manifestId}`,
    label: `Draft ${manifest.title}`,
    surface: manifest.surface,
    manifestId: manifest.manifestId,
    backendAllowed: manifest.backendAllowed,
    draftOnly: manifest.draftOnly,
    disabledReason: manifest.blockedReasons.join(' '),
    approvalApi: manifest.surface === 'feature-store' ? 'POST /api/v1/racing-data/feature-store/exports/draft-requests' : 'POST /api/v1/racing-data/data-lake/exports/draft-requests',
  }));
  const controlByManifest = new Map(exportControls.map((control) => [control.manifestId, control]));
  const exportButtonForManifest = (manifestId: string) => {
    const control = controlByManifest.get(manifestId);
    const disabled = !control?.backendAllowed || control.draftOnly;
    return <article aria-label={`API Hub export control ${manifestId}`} data-api-hub-export-control={manifestId}>
      <button type="button" disabled={disabled} aria-disabled={disabled} data-draft-only={control?.draftOnly ?? true} aria-label={`${control?.label ?? `Draft export ${manifestId}`} export button`}>{control?.backendAllowed && !control.draftOnly ? 'Run backend-approved export' : 'Draft-only export disabled'}</button>
      <p>{control?.disabledReason ?? 'Export remains disabled until the backend returns backendAllowed=true.'}</p>
      <code>{control?.approvalApi ?? 'POST /api/v1/racing-data/exports/draft-requests'}</code>
    </article>;
  };

  return <section aria-label="Racing Data API Hub workspace">
    <h2>Racing Data API Hub</h2>
    <DataFreshness label="Racing Data API Hub" timestamp={workspace.metadata.generatedAt} mode={mode} />
    <MockDataBanner active={workspace.mock || mode === 'mock'} source="Racing Data API Hub mock/live facade" />
    <p>Provider-agnostic ingestion, normalization, quality, license, entity resolution, and lineage views are read-only. Review actions create drafts or approvals only and never mutate official records locally.</p>
    <RecordSourceLabel mock={workspace.mock} label="racing data API hub workspace" />
    <MetricStrip items={[
      { label: 'Providers', value: String(workspace.providers.length), detail: `${workspace.statuses.length} statuses; ${workspace.connectors.length} connectors` },
      { label: 'Ingestion jobs', value: String(workspace.ingestionJobs.length), detail: workspace.ingestionJobs.map((job) => `${job.jobId}:${job.status}`).join(', ') || 'none' },
      { label: 'Resolution queue', value: String(resolutionQueue.filter((item) => item.reviewRequired).length), detail: 'Canonical identity merges require draft or approval review' },
      { label: 'Quality score', value: String(Math.round(workspace.qualityReports.reduce((sum, report) => sum + report.score, 0) / Math.max(workspace.qualityReports.length, 1))), detail: `${lowQualityReports.length} low quality warnings` },
      { label: 'License impact', value: workspace.licensePolicies.some((policy) => !policy.commercialUseAllowed || !policy.redistributionAllowed) ? 'restricted' : 'clear', detail: workspace.licensePolicies.map((policy) => `${policy.providerId}:${policy.status}`).join(', ') },
    ]} />

    <section aria-label="Provider Registry">
      <h3>Provider Registry</h3>
      <p>Provider records are licensed, configured data connections only. The API Hub does not expose a scraping workflow or instruct operators to collect data outside provider terms.</p>
      <DataTable label="Provider registry table" rows={workspace.statuses} getRowKey={(row) => row.providerId} columns={[
        { key: 'provider', header: 'Provider', render: (row) => row.displayName ?? providerName(row.providerId) },
        { key: 'licenseStatus', header: 'licenseStatus', render: (row) => <StatusCard title={row.providerId} status={row.licenseStatus} detail={licenseWarningLabels(row).join(', ') || 'License clear for configured scope'} /> },
        { key: 'connectionType', header: 'connectionType', render: (row) => row.connectionType },
        { key: 'dataClasses', header: 'dataClasses', render: (row) => row.dataClasses.join(', ') },
        { key: 'commercialUseAllowed', header: 'commercialUseAllowed', render: (row) => String(row.commercialUseAllowed) },
        { key: 'redistributionAllowed', header: 'redistributionAllowed', render: (row) => String(row.redistributionAllowed) },
        { key: 'attributionRequired', header: 'attributionRequired', render: (row) => String(row.attributionRequired) },
        { key: 'piiPresent', header: 'piiPresent', render: (row) => String(row.piiPresent) },
        { key: 'warningLabels', header: 'License warning labels', render: (row) => licenseWarningLabels(row).join(', ') || 'None' },
      ]} />
    </section>

    <section aria-label="Ingestion Jobs">
      <h3>Ingestion Jobs</h3>
      <p>Ingestion status is read-only: validation, normalization, event, and audit references are displayed for review without triggering provider calls from the frontend.</p>
      <DataTable label="Ingestion jobs table" rows={workspace.ingestionJobs} getRowKey={(row) => row.jobId} columns={[
        { key: 'job', header: 'Job', render: (row) => <code>{row.jobId}</code> },
        { key: 'provider', header: 'Provider', render: (row) => providerName(row.providerId) },
        { key: 'status', header: 'status', render: (row) => <ApprovalChip status={row.status === 'completed' ? 'approved' : row.status === 'failed' ? 'rejected' : 'pending-approval'} /> },
        { key: 'rawPayloadRefs', header: 'Raw payload IDs', render: (row) => row.rawPayloadRefs.join(', ') || 'none' },
        { key: 'validationStatus', header: 'validationStatus', render: (row) => row.validationStatus ?? (row.errors.length ? 'warning' : 'valid') },
        { key: 'normalizationStatus', header: 'normalizationStatus', render: (row) => row.normalizationStatus ?? (row.canonicalEnvelopeRefs.length ? 'normalized' : 'pending') },
        { key: 'eventRefs', header: 'event refs', render: (row) => row.eventRefs.join(', ') || 'none' },
        { key: 'auditRefs', header: 'audit refs', render: (row) => row.auditRefs.join(', ') || 'none' },
      ]} />
    </section>

    <section aria-label="API Hub License and Usage Policy Center">
      <h3>License and Usage Policy Center</h3>
      <p>Allowed uses: {policyCenter.flatMap((policy) => policy.allowedUses).join(', ') || 'none'}</p>
      <p>Restricted uses: {policyCenter.flatMap((policy) => policy.restrictedUses).join(', ') || 'none'}</p>
      <DataTable label="API Hub usage policy table" rows={policyCenter} getRowKey={(row) => row.policyId} columns={[
        { key: 'policy', header: 'Policy', render: (row) => <code>{row.policyId}</code> },
        { key: 'provider', header: 'Provider', render: (row) => providerName(row.providerId) },
        { key: 'retentionDays', header: 'retentionDays', render: (row) => String(row.retentionDays) },
        { key: 'exportAllowed', header: 'exportAllowed', render: (row) => String(row.exportAllowed) },
        { key: 'redistributionAllowed', header: 'redistributionAllowed', render: (row) => String(row.redistributionAllowed) },
        { key: 'commercialUseAllowed', header: 'commercialUseAllowed', render: (row) => String(row.commercialUseAllowed) },
        { key: 'privacyClassification', header: 'privacyClassification', render: (row) => row.privacyClassification },
        { key: 'modelTraining', header: 'Model training', render: (row) => `Model training allowed ${String(row.modelTraining.allowed)}; unlicensedBlocked ${String(row.modelTraining.unlicensedBlocked)}; ${row.modelTraining.restrictions.join(', ')}` },
        { key: 'blocked', header: 'Blocked export reasons', render: (row) => row.blockedExportReasons.join(' ') || 'none' },
      ]} />
    </section>

    <section aria-label="API Hub Feature Store Exports">
      <h3>Feature Store Exports</h3>
      <p>Feature exports are draft-only in the frontend. Backend approval must return an executable export token before any manifest can run.</p>
      <DataTable label="API Hub feature store export manifests" rows={featureStoreExports} getRowKey={(row) => row.manifestId} columns={[
        { key: 'manifest', header: 'Manifest', render: (row) => <code>{row.manifestId}</code> },
        { key: 'title', header: 'Title', render: (row) => row.title },
        { key: 'destination', header: 'Destination', render: (row) => row.destination },
        { key: 'exportAllowed', header: 'exportAllowed', render: (row) => String(row.exportAllowed) },
        { key: 'modelTrainingAllowed', header: 'modelTrainingAllowed', render: (row) => String(row.modelTrainingAllowed) },
        { key: 'blocked', header: 'Blocked reasons', render: (row) => row.blockedReasons.join(' ') || 'none' },
        { key: 'checksum', header: 'Checksum', render: (row) => row.checksum },
        { key: 'control', header: 'Control', render: (row) => exportButtonForManifest(row.manifestId) },
      ]} />
    </section>

    <section aria-label="API Hub Data Lake Exports">
      <h3>Data Lake Exports</h3>
      <p>Data lake exports remain disabled where provider licenses block public redistribution, commercial product use, or bulk replay.</p>
      <DataTable label="API Hub data lake export manifests" rows={dataLakeExports} getRowKey={(row) => row.manifestId} columns={[
        { key: 'manifest', header: 'Manifest', render: (row) => <code>{row.manifestId}</code> },
        { key: 'title', header: 'Title', render: (row) => row.title },
        { key: 'destination', header: 'Destination', render: (row) => row.destination },
        { key: 'exportAllowed', header: 'exportAllowed', render: (row) => String(row.exportAllowed) },
        { key: 'redistributionAllowed', header: 'redistributionAllowed', render: (row) => String(row.redistributionAllowed) },
        { key: 'blocked', header: 'Blocked reasons', render: (row) => row.blockedReasons.join(' ') || 'none' },
        { key: 'checksum', header: 'Checksum', render: (row) => row.checksum },
        { key: 'control', header: 'Control', render: (row) => exportButtonForManifest(row.manifestId) },
      ]} />
    </section>

    <section aria-label="Raw Payload Review">
      <h3>Raw Payload Review</h3>
      <p>Original payload hash, source format, and license context are preserved before normalization. Raw payload review is limited to licensed provider/API uploads and manual governed imports; no scraping path is provided.</p>
      <DataTable label="Raw payload review table" rows={workspace.rawPayloadReviews} getRowKey={(row) => row.payload.payloadId} columns={[
        { key: 'payloadId', header: 'Raw payload ID', render: (row) => <code>{row.payload.payloadId}</code> },
        { key: 'provider', header: 'Provider', render: (row) => providerName(row.payload.providerId) },
        { key: 'originalPayloadHash', header: 'originalPayloadHash', render: (row) => <code>{row.originalPayloadHash ?? row.payload.originalPayloadHash ?? 'hash missing'}</code> },
        { key: 'sourceFormat', header: 'sourceFormat', render: (row) => row.sourceFormat ?? row.payload.sourceFormat ?? row.payload.contentType },
        { key: 'licenseContext', header: 'licenseContext', render: (row) => payloadLicenseContext(row) },
        { key: 'review', header: 'Review', render: (row) => `${row.review.status}; ${row.review.reasons.join(', ')}` },
      ]} />
    </section>

    <section aria-label="Entity Resolution Queue">
      <h3>Entity Resolution Queue</h3>
      <p>Canonical identity decisions are advisory until a backend draft or approval workflow records human review.</p>
      <DataTable label="Entity resolution queue" rows={resolutionQueue} getRowKey={(row) => row.resolutionId} columns={[
        { key: 'canonicalId', header: 'canonicalId', render: (row) => <code>{row.canonicalId}</code> },
        { key: 'candidateExternalIds', header: 'candidateExternalIds', render: (row) => row.candidateExternalIds.join(', ') },
        { key: 'matchConfidence', header: 'matchConfidence', align: 'right', render: (row) => `${Math.round(row.matchConfidence * 100)}%` },
        { key: 'decision', header: 'decision', render: (row) => <ApprovalChip status={row.decision === 'approved' ? 'approved' : 'pending-approval'} /> },
        { key: 'reviewRequired', header: 'reviewRequired', render: (row) => String(row.reviewRequired) },
        { key: 'evidence', header: 'evidence', render: (row) => row.evidence.join(', ') },
      ]} />
    </section>

    <section aria-label="Data Quality Center">
      <h3>Data Quality Center</h3>
      {lowQualityReports.length ? <p role="alert">{`Low quality warning: ${lowQualityReports.map((report) => `${report.targetRef} score ${report.score} severity ${report.severity}`).join('; ')}. License and downstream quality impacts require review before export.`}</p> : <p role="status">No low quality warnings in the loaded reports.</p>}
      {workspace.qualityReports.map((report) => <WorkspacePanel key={report.reportId} title={`${report.targetRef} quality report`} eyebrow={report.providerId ?? 'provider'}>
        <RiskBadge level={qualityRisk(report.score, report.severity)} />
        <KpiTile label="Report score" value={String(report.score)} trend={`severity ${report.severity}; reviewRequired ${String(report.reviewRequired)}`} tone={qualityRisk(report.score, report.severity)} />
        <p>License impact: {report.licenseImpactSummary}</p>
        <p>Data quality impact: {report.dataQualityImpactSummary}</p>
        <DataTable label={`${report.reportId} quality checks`} rows={report.checks} getRowKey={(check) => check.ruleId} columns={[
          { key: 'check', header: 'Check', render: (check) => check.label },
          { key: 'severity', header: 'Severity', render: (check) => <StatusCard title={check.ruleId} status={check.severity} detail={`${check.status}; score ${check.score}`} /> },
          { key: 'message', header: 'Message', render: (check) => check.message },
          { key: 'impacts', header: 'License / data quality impacts', render: (check) => `${check.licenseImpact}; ${check.dataQualityImpact}` },
        ]} />
      </WorkspacePanel>)}
    </section>

    <section aria-label="Lineage Explorer">
      <h3>Lineage Explorer</h3>
      <p>{'RAW PAYLOAD -> NORMALIZED ARTIFACT -> REGISTRY -> TWIN/EVENT/AUDIT/FEATURE/EXPORT REFS'}</p>
      <p>{'raw:payload-race-7-entries -> artifact:normalized-race-7-entries -> registry:canonical-race-7-entries'}</p>
      {lineagePaths.map((path) => <article key={path.lineageId} aria-label={`Lineage graph ${path.lineageId}`}>
        <strong>{`${path.rawPayloadRef} -> ${path.normalizedArtifactRef} -> ${path.registryRef}`}</strong>
        <p>{`Twin refs: ${path.twinRefs.join(', ') || 'none'}`}</p>
        <p>{`Event refs: ${path.eventRefs.join(', ') || 'none'}`}</p>
        <p>{`Audit refs: ${path.auditRefs.join(', ') || 'none'}`}</p>
        <p>{`Feature refs: ${path.featureRefs.join(', ') || 'none'}`}</p>
        <p>{`Export refs: ${path.exportRefs.join(', ') || 'none'}`}</p>
        <EvidenceList items={path.evidenceRefs} label={`${path.lineageId} lineage evidence`} />
      </article>)}
      <DataTable label="Lineage graph labels" rows={workspace.lineage.nodes} getRowKey={(node) => node.id} columns={[
        { key: 'kind', header: 'Kind', render: (node) => node.kind },
        { key: 'label', header: 'Label', render: (node) => node.label },
      ]} />
    </section>

    <section aria-label="API Hub disabled review controls">
      <h3>Disabled Review Controls</h3>
      <p>Review controls are draft/approval-aware only. They do not mutate canonical entities, official results, provider payloads, registry records, Digital Twins, feature-store exports, or data-lake exports locally.</p>
      <ActionRail actions={reviewActions(workspace)} />
    </section>
  </section>;
}
