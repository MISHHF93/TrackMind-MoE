import type { ComplianceControlLibraryDto } from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsoleAction, ConsolePayload, OpsPosture, QueueItem } from '../../design/opsTypes';
import { countBarChart, postureBreakdownDonut } from './charts';
import { loadSharedContext } from './commonContext';
import { compactLifecycleLanes, recordsLifecycleLane } from './lifecycle';
import { countMetric, navAction, requireReady, textMetric } from './util';

function findingPosture(severity: string): OpsPosture {
  if (severity === 'critical' || severity === 'high') return 'critical';
  if (severity === 'medium') return 'watch';
  return 'advisory';
}

function controlPosture(status: string): OpsPosture {
  if (status === 'blocked' || status === 'ineffective') return 'critical';
  if (status === 'watch' || status === 'partial') return 'watch';
  return 'ready';
}

function reviewActions(detail: string, auditQuery?: { key: string; value: string }): ConsoleAction[] {
  const auditPath = auditQuery ? `/audit?${auditQuery.key}=${encodeURIComponent(auditQuery.value)}` : '/audit';
  return [
    navAction('Review approval context', '/approvals', detail),
    navAction('View audit', auditPath, `Review audit evidence. ${detail}`),
  ];
}

export async function loadComplianceConsole(): Promise<ConsolePayload> {
  const [library, shared] = await Promise.all([
    getJson<ComplianceControlLibraryDto>(apiPaths.compliance.library),
    loadSharedContext(),
  ]);
  const data = requireReady(library, 'Compliance control library');
  const openFindings = data.findings.filter((finding) => finding.status !== 'resolved');
  const overdueActions = data.correctiveActions.filter((action) => action.status !== 'completed');
  const readinessScore = data.readiness.score;
  let posture: OpsPosture = 'ready';
  if (readinessScore < 70 || openFindings.some((finding) => finding.severity === 'critical')) posture = 'critical';
  else if (readinessScore < 85 || openFindings.length > 0 || overdueActions.length > 0) posture = 'watch';

  const frameworkItems: QueueItem[] = data.frameworks.slice(0, 4).map((framework) => ({
    id: framework.id,
    title: framework.name,
    summary: `${framework.authority} framework mapped across ${framework.domains.join(', ') || 'declared domains'}. No external certification claimed.`,
    posture: 'advisory',
    evidence: framework.domains,
    actions: [
      ...reviewActions(`Review framework mapping for ${framework.name}.`),
      navAction('View audit', '/audit', 'Review compliance framework audit evidence.'),
    ],
  }));

  const controlItems: QueueItem[] = data.controls.slice(0, 6).map((control, index) => ({
    id: control.id || `control-${index}`,
    title: control.title || 'Control',
    summary: control.description || 'Mapped readiness control.',
    posture: controlPosture(control.status),
    evidence: control.evidenceIds.length ? control.evidenceIds : ['compliance-control-library'],
    actions: [
      ...reviewActions(`Review control ${control.title ?? control.id}.`, { key: 'control', value: control.id }),
      ...(control.approvalRequestIds?.length
        ? [navAction('Review approval context', '/approvals', `Control ${control.title ?? control.id} has linked approval requests.`)]
        : []),
    ],
  }));

  const findingItems: QueueItem[] = openFindings.slice(0, 4).map((finding) => ({
    id: finding.id,
    title: finding.summary,
    summary: `${finding.severity} finding for control ${finding.controlId}; status ${finding.status}.`,
    posture: findingPosture(finding.severity),
    evidence: finding.evidenceIds?.length ? finding.evidenceIds : finding.auditRecordIds ?? ['compliance-finding'],
    actions: reviewActions(`Review finding ${finding.summary}.`, { key: 'finding', value: finding.id }),
  }));

  const correctiveItems: QueueItem[] = overdueActions.slice(0, 4).map((action) => ({
    id: action.id,
    title: action.action,
    summary: `Owner ${action.ownerId}; due ${action.dueAt}; status ${action.status}. Corrective action execution is backend-governed.`,
    posture: action.status === 'overdue' ? 'critical' : 'watch',
    evidence: action.auditRecordIds ?? ['corrective-action'],
    actions: [
      ...reviewActions(`Review corrective action ${action.action}.`),
      ...(action.approvalRequestId
        ? [navAction('Review approval context', `/approvals?corrective=${encodeURIComponent(action.id)}`, 'Review approval linked to corrective action.')]
        : []),
    ],
  }));

  const controlLifecycleLane = recordsLifecycleLane(
    'compliance-control-lifecycle',
    'Control lifecycle',
    'Compliance controls mapped by readiness status — not card queue nodes.',
    data.controls.slice(0, 10).map((control, index) => ({
      id: control.id || `control-${index}`,
      label: control.title || 'Control',
      status: control.status,
      summary: control.description || 'Mapped readiness control.',
      evidence: control.evidenceIds.length ? control.evidenceIds : ['compliance-control-library'],
      actions: [
        ...reviewActions(`Review control ${control.title ?? control.id}.`, { key: 'control', value: control.id }),
        ...(control.approvalRequestIds?.length
          ? [navAction('Review approval context', '/approvals', `Control ${control.title ?? control.id} has linked approval requests.`)]
          : []),
      ],
    })),
  );

  const controlStatusCounts: Record<string, number> = {};
  const controlPostureMap: Record<string, OpsPosture> = {};
  for (const control of data.controls) {
    controlStatusCounts[control.status] = (controlStatusCounts[control.status] ?? 0) + 1;
    controlPostureMap[control.status] = controlPosture(control.status);
  }
  const findingSeverityCounts: Record<string, number> = {};
  for (const finding of openFindings) {
    findingSeverityCounts[finding.severity] = (findingSeverityCounts[finding.severity] ?? 0) + 1;
  }

  const findingLifecycleLane = recordsLifecycleLane(
    'compliance-finding-lifecycle',
    'Finding lifecycle',
    'Open compliance findings mapped by remediation status.',
    openFindings.slice(0, 8).map((finding) => ({
      id: finding.id,
      label: finding.summary,
      status: finding.status,
      summary: `${finding.severity} finding for control ${finding.controlId}.`,
      evidence: finding.evidenceIds?.length ? finding.evidenceIds : finding.auditRecordIds ?? ['compliance-finding'],
      actions: reviewActions(`Review finding ${finding.summary}.`, { key: 'finding', value: finding.id }),
    })),
  );

  return {
    routeId: 'compliance',
    title: 'Compliance',
    mission: 'Close control gaps and package evidence — external certification is never claimed from this console.',
    posture,
    postureLabel: posture === 'critical' ? 'Readiness action required' : posture === 'watch' ? 'Open findings' : 'Internal readiness nominal',
    postureScore: readinessScore,
    source: library.source,
    primaryActions: [
      navAction('Review approval queue', '/approvals', 'Open compliance-linked approval records.'),
      navAction('View audit ledger', '/audit', 'Review compliance and audit integrity evidence.'),
      navAction('Open data governance', '/data-hub', 'Review provider and export-control metadata supporting compliance posture.'),
    ],
    lifecycleLanes: compactLifecycleLanes([controlLifecycleLane, findingLifecycleLane]),
    charts: [
      postureBreakdownDonut(
        'control-status-donut',
        'Control status mix',
        controlStatusCounts,
        controlPostureMap,
        navAction('Review approval queue', '/approvals', 'Open compliance-linked approval records.'),
      ),
      countBarChart(
        'open-findings-bar',
        'Open findings',
        'Unresolved compliance findings by severity.',
        Object.entries(findingSeverityCounts).map(([label, value]) => ({
          id: `finding-${label}`,
          label,
          value,
          posture: findingPosture(label),
        })),
        'findings',
        navAction('View audit ledger', '/audit', 'Review compliance finding audit evidence.'),
      ),
    ],
    queues: [
      {
        id: 'compliance-frameworks',
        title: 'Framework mapping queue',
        description: 'Compliance frameworks mapped by the control library. Candidate evidence only.',
        items: frameworkItems,
      },
      {
        id: 'compliance-controls',
        title: 'Control review queue',
        description: 'Mapped controls with owners, obligations, and evidence references.',
        items: controlItems,
      },
      {
        id: 'compliance-findings',
        title: 'Open findings queue',
        description: 'Unresolved compliance findings requiring review.',
        items: findingItems,
      },
      {
        id: 'compliance-corrective-actions',
        title: 'Corrective action review queue',
        description: 'Corrective actions linked to findings. No regulator approval claimed from frontend.',
        items: correctiveItems,
      },
    ],
    metrics: [
      countMetric('Frameworks', data.frameworks.length, 'Compliance frameworks mapped by the control library', 'ready'),
      countMetric('Controls', data.controls.length, 'Compliance controls from backend facade', 'ready'),
      textMetric('Internal readiness', `${readinessScore}%`, `${data.readiness.openFindings} open finding(s), ${data.readiness.overdueActions} overdue action(s); no external certification claimed`, posture),
      countMetric('Open findings', openFindings.length, 'Unresolved compliance findings', openFindings.length ? 'watch' : 'ready', navAction('View audit', '/audit', 'Review compliance finding audit evidence.')),
    ],
    advisories: shared.advisories,
    contextDegraded: shared.contextDegraded,
  };
}
