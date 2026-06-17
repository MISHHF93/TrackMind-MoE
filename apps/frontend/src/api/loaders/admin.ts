import type { PlatformHealthWorkspaceDto } from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsolePayload, QueueItem } from '../../design/opsTypes';
import { enrichConsoleWithSharedContext, loadSharedContext } from './commonContext';
import { approvalEngineDonut, serviceLatencyBar } from './charts';
import { platformHealthLifecycleLanes } from './lifecycle';
import { countMetric, navAction, postureFromHealth, requireReady, textMetric } from './util';

export async function loadAdminConsole(): Promise<ConsolePayload> {
  const [health, shared] = await Promise.all([
    getJson<PlatformHealthWorkspaceDto>(apiPaths.admin.platformHealth),
    loadSharedContext('admin'),
  ]);
  const data = requireReady(health, 'Platform health');
  const services = Array.isArray(data.services) ? data.services : [];
  const approvalEngine = data.approvalEngine ?? { pending: 0 };
  const deploymentBoundary = data.deploymentBoundary ?? { claim: 'Deployment boundary not reported by facade.', assumptions: [] };
  const posture = postureFromHealth(data.overallStatus);

  const serviceItems: QueueItem[] = services.slice(0, 6).map((service) => {
    const dependencies = Array.isArray(service.dependencies) ? service.dependencies : [];
    return {
      id: service.serviceId,
      title: service.serviceId,
      summary: `${service.status} service record with ${dependencies.length} declared dependencies.`,
      posture: service.status === 'critical' ? 'critical' : service.status === 'degraded' ? 'watch' : 'ready',
      evidence: dependencies.map((dependency) => `${dependency.id}:${dependency.status}`),
      actions: [
        navAction('View audit evidence', '/audit', 'Review audit ledger metadata for platform operations.'),
        navAction('Review approvals', '/approvals', 'Review approval queue when service degradation affects protected actions.'),
      ],
    };
  });

  const boundaryItems: QueueItem[] = [{
    id: 'deployment-boundary',
    title: 'Deployment boundary',
    summary: deploymentBoundary.claim,
    posture: 'advisory',
    evidence: Array.isArray(deploymentBoundary.assumptions) ? deploymentBoundary.assumptions : [],
    actions: [
      navAction('Review AI guardrails', '/settings', 'Inspect read-only AI guardrail and deployment boundary context.'),
      navAction('View audit evidence', '/audit', 'Review audit ledger metadata for deployment readiness evidence.'),
    ],
  }];

  const base: ConsolePayload = {
    routeId: 'admin',
    title: 'Service Status',
    mission: 'Monitor reference platform health, dependency declarations, and deployment boundary assumptions.',
    posture,
    postureLabel: data.overallStatus === 'healthy' ? 'Platform nominal' : 'Platform watch',
    generatedAt: data.generatedAt,
    source: health.source,
    primaryActions: [
      navAction('View audit evidence', '/audit', 'Verify immutable audit trail for platform operations.', 'primary'),
      navAction('Review approvals', '/approvals', 'Review approval engine backlog metadata.'),
      navAction('Review AI guardrails', '/settings', 'Inspect read-only AI guardrail posture.'),
    ],
    lifecycleLanes: platformHealthLifecycleLanes(services),
    charts: [
      serviceLatencyBar(services, navAction('View audit evidence', '/audit', 'Review platform audit evidence.')),
      approvalEngineDonut(approvalEngine, navAction('Review approvals', '/approvals', 'Open approval review console.')),
    ],
    queues: [
      {
        id: 'platform-services',
        title: 'Service health queue',
        description: 'Facade-level service health records, latency, and dependency posture.',
        items: serviceItems.length ? serviceItems : [{
          id: 'platform-services-empty',
          title: 'No service records returned',
          summary: 'Platform health facade returned no service rows for this tenant scope.',
          posture: 'watch',
          evidence: ['PlatformHealthWorkspaceDto', apiPaths.admin.platformHealth],
          actions: [navAction('View audit evidence', '/audit', 'Review audit ledger metadata.')],
        }],
      },
      {
        id: 'deployment-boundary-queue',
        title: 'Deployment boundary review',
        description: 'Declared deployment assumptions; not deployed infrastructure attestation.',
        items: boundaryItems,
      },
    ],
    metrics: [
      textMetric(
        'Platform status',
        data.overallStatus,
        'Facade-level platform health metadata from /platform/health',
        posture,
      ),
      countMetric('Services', services.length, 'Facade-level service health records'),
      countMetric(
        'Pending approvals',
        approvalEngine.pending ?? 0,
        'Approval engine queue metadata from platform health',
        (approvalEngine.pending ?? 0) > 0 ? 'watch' : 'ready',
        navAction('Review approvals', '/approvals', 'Open approval review console.'),
      ),
    ],
  };

  return enrichConsoleWithSharedContext(base, shared);
}
