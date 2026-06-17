import type { FacilitiesMaintenanceWorkspaceDto } from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsoleAction, ConsolePayload, OpsPosture, QueueItem } from '../../design/opsTypes';
import { countBarChart, readinessGauge } from './charts';
import { loadSharedContext } from './commonContext';
import { compactLifecycleLanes, recordsLifecycleLane } from './lifecycle';
import { countMetric, navAction, requireReady, textMetric } from './util';

function readinessPosture(status: string): OpsPosture {
  if (status === 'blocked') return 'critical';
  if (status === 'watch') return 'watch';
  return 'ready';
}

function assetPosture(asset: FacilitiesMaintenanceWorkspaceDto['assets'][number]): OpsPosture {
  if (asset.readinessStatus === 'blocked' || asset.predictedFailureRisk >= 75) return 'critical';
  if (asset.readinessStatus === 'watch' || asset.predictedFailureRisk >= 50) return 'watch';
  return 'ready';
}

function reviewActions(detail: string, auditQuery?: { key: string; value: string }): ConsoleAction[] {
  const auditPath = auditQuery ? `/audit?${auditQuery.key}=${encodeURIComponent(auditQuery.value)}` : '/audit';
  return [
    navAction('Review approval context', '/approvals', detail),
    navAction('View audit', auditPath, `Review audit evidence. ${detail}`),
  ];
}

export async function loadFacilitiesConsole(): Promise<ConsolePayload> {
  const [facilities, shared] = await Promise.all([
    getJson<FacilitiesMaintenanceWorkspaceDto>(apiPaths.facilities.workspace),
    loadSharedContext(),
  ]);
  const data = requireReady(facilities, 'Facilities maintenance workspace');
  const openWorkOrders = data.workOrders.filter((order) => order.status !== 'completed');
  const blockedAssets = data.assets.filter((asset) => asset.readinessStatus === 'blocked').length;
  const posture = blockedAssets > 0 ? 'critical' : data.readiness.status === 'watch' ? 'watch' : 'ready';

  const assetItems: QueueItem[] = data.assets.slice(0, 6).map((asset) => ({
    id: asset.assetId,
    title: asset.name,
    summary: `${asset.readinessStatus} asset; health ${asset.healthScore}%, failure risk ${asset.predictedFailureRisk}%. Maintenance ${asset.maintenanceStatus}.`,
    posture: assetPosture(asset),
    evidence: [asset.sourceOfTruth, asset.twinId ?? 'digital-twin-pending', ...asset.openWorkOrderIds],
    actions: [
      ...reviewActions(`Review asset ${asset.name} maintenance boundary.`),
      ...(asset.controlsRequiringApproval.length
        ? [navAction('Review approval context', '/approvals', `Asset ${asset.name} has controls requiring approval before return-to-service.`)]
        : []),
    ],
  }));

  const workOrderItems: QueueItem[] = openWorkOrders.slice(0, 6).map((order) => ({
    id: order.id,
    title: order.title,
    summary: `${order.priority} priority work order; status ${order.status}. Operational impact ${order.operationalImpact}.`,
    posture: order.priority === 'critical' || order.priority === 'high' ? 'watch' : 'advisory',
    evidence: [order.workflowInstanceId ?? 'workflow-pending', order.auditId, ...order.evidence],
    actions: [
      ...reviewActions(`Review work order ${order.title}.`, { key: 'workOrder', value: order.id }),
      ...(order.approvalRequestId
        ? [navAction('Review approval context', `/approvals?workOrder=${encodeURIComponent(order.id)}`, 'Review approval request linked to this work order.')]
        : [navAction('Review approval context', '/approvals', 'Review general approval records for maintenance transitions.')]),
    ],
  }));

  const inspectionItems: QueueItem[] = data.inspections.slice(0, 4).map((inspection) => ({
    id: inspection.id,
    title: `Inspection ${inspection.assetId}`,
    summary: `Score ${inspection.score}%; status ${inspection.status}. Inspected by ${inspection.inspectedBy} at ${inspection.inspectedAt}.`,
    posture: inspection.status === 'failed' ? 'critical' : inspection.score < 80 ? 'watch' : 'ready',
    evidence: [inspection.auditId, inspection.eventId, ...(inspection.findings.length ? inspection.findings : [])],
    actions: reviewActions(`Review inspection for asset ${inspection.assetId}.`, { key: 'inspection', value: inspection.id }),
  }));

  const approvalItems: QueueItem[] = data.approvals.slice(0, 4).map((approval) => ({
    id: approval.id,
    title: approval.action,
    summary: `Approval for ${approval.target}; status ${approval.status}. Return-to-service transitions remain backend-governed.`,
    posture: String(approval.status).includes('pending') ? 'watch' : 'advisory',
    evidence: approval.evidence,
    actions: [
      navAction('Review approval context', `/approvals?approval=${encodeURIComponent(approval.id)}`, `Review approval request ${approval.action}.`),
      navAction('View audit', '/audit', `Review audit evidence for approval ${approval.id}.`),
    ],
  }));

  const assetLifecycleLane = recordsLifecycleLane(
    'asset-maintenance-lifecycle',
    'Asset maintenance lifecycle',
    'Facilities assets mapped by lifecycle and maintenance status — not card queue nodes.',
    data.assets.slice(0, 10).map((asset) => ({
      id: asset.assetId,
      label: asset.name,
      status: `${asset.lifecycleStatus} · ${asset.maintenanceStatus}`,
      summary: `Readiness ${asset.readinessStatus}; health ${asset.healthScore}%, failure risk ${asset.predictedFailureRisk}%.`,
      evidence: [asset.sourceOfTruth, asset.twinId ?? 'digital-twin-pending', ...asset.openWorkOrderIds],
      actions: reviewActions(`Review asset ${asset.name} maintenance boundary.`),
    })),
  );

  const maintenanceCounts: Record<string, number> = {};
  const lifecycleCounts: Record<string, number> = {};
  for (const asset of data.assets) {
    maintenanceCounts[asset.maintenanceStatus] = (maintenanceCounts[asset.maintenanceStatus] ?? 0) + 1;
    lifecycleCounts[asset.lifecycleStatus] = (lifecycleCounts[asset.lifecycleStatus] ?? 0) + 1;
  }
  const statusBarEntries = [
    ...Object.entries(maintenanceCounts).map(([label, value]) => ({
      id: `maintenance-${label}`,
      label: `Maint: ${label}`,
      value,
      posture: 'advisory' as OpsPosture,
    })),
    ...Object.entries(lifecycleCounts).map(([label, value]) => ({
      id: `lifecycle-${label}`,
      label: `Life: ${label}`,
      value,
      posture: 'advisory' as OpsPosture,
    })),
  ];

  const inspectionLifecycleLane = recordsLifecycleLane(
    'inspection-lifecycle',
    'Inspection lifecycle',
    'Recent asset inspections from the maintenance workspace.',
    data.inspections.slice(0, 8).map((inspection) => ({
      id: inspection.id,
      label: `Inspection ${inspection.assetId}`,
      status: inspection.status,
      summary: `Score ${inspection.score}%; inspected by ${inspection.inspectedBy} at ${inspection.inspectedAt}.`,
      evidence: [inspection.auditId, inspection.eventId, ...(inspection.findings.length ? inspection.findings : [])],
      actions: reviewActions(`Review inspection for asset ${inspection.assetId}.`, { key: 'inspection', value: inspection.id }),
    })),
  );

  return {
    routeId: 'facilities',
    title: 'Facilities Readiness',
    mission: 'Return assets to service through inspected work orders — maintenance execution stays approval-gated.',
    posture,
    postureLabel: posture === 'critical' ? 'Blocked assets' : posture === 'watch' ? 'Maintenance watch' : 'Facilities ready',
    generatedAt: data.generatedAt,
    source: facilities.source,
    primaryActions: [
      navAction('Review approval queue', '/approvals', 'Open maintenance and return-to-service approval records.'),
      navAction('View audit ledger', '/audit', 'Review facilities maintenance audit evidence.'),
      navAction('Open incident command', '/incidents', 'Review safety incident posture when maintenance affects operations.'),
    ],
    lifecycleLanes: compactLifecycleLanes([assetLifecycleLane, inspectionLifecycleLane]),
    charts: [
      countBarChart(
        'asset-status-bar',
        'Asset maintenance & lifecycle',
        'Facilities assets grouped by maintenance and lifecycle status.',
        statusBarEntries,
        'assets',
        navAction('Review approval queue', '/approvals', 'Open maintenance and return-to-service approval records.'),
      ),
      readinessGauge(
        data.readiness.score,
        readinessPosture(data.readiness.status),
        navAction('View audit ledger', '/audit', 'Review facilities maintenance audit evidence.'),
      ),
    ],
    queues: [
      {
        id: 'facilities-assets',
        title: 'Asset readiness queue',
        description: 'Live facilities assets with health scores and digital twin references.',
        items: assetItems,
      },
      {
        id: 'facilities-work-orders',
        title: 'Work order review queue',
        description: 'Approval-gated maintenance work orders. No return-to-service execution from frontend.',
        items: workOrderItems,
      },
      {
        id: 'facilities-inspections',
        title: 'Inspection review queue',
        description: 'Recent inspection findings and scores for track assets.',
        items: inspectionItems,
      },
      {
        id: 'facilities-approvals',
        title: 'Maintenance approval queue',
        description: 'Facilities approval records linked to maintenance transitions.',
        items: approvalItems,
      },
    ],
    metrics: [
      textMetric('Readiness', `${data.readiness.score}% ${data.readiness.status}`, 'Facilities readiness from RACR-backed assets', readinessPosture(data.readiness.status)),
      countMetric('Assets', data.assets.length, 'Facilities assets from the maintenance service', blockedAssets ? 'critical' : 'ready'),
      countMetric('Open work orders', openWorkOrders.length, 'Approval-gated maintenance work orders', openWorkOrders.length ? 'watch' : 'ready', navAction('Review approval context', '/approvals', 'Review maintenance approval records.')),
      countMetric('Inspections', data.inspections.length, 'Inspection records in the maintenance workspace', data.inspections.some((inspection) => inspection.status === 'failed') ? 'watch' : 'ready'),
    ],
    advisories: shared.advisories,
    contextDegraded: shared.contextDegraded,
  };
}
