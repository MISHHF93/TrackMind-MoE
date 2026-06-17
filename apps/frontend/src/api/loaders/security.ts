import type { SecurityOperationsDto } from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsoleAction, ConsolePayload, OpsPosture, QueueItem } from '../../design/opsTypes';
import { countBarChart, postureBreakdownDonut } from './charts';
import { loadSharedContext } from './commonContext';
import { compactLifecycleLanes, recordsLifecycleLane } from './lifecycle';
import { countMetric, navAction, requireReady } from './util';

function severityPosture(severity: string): OpsPosture {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'watch';
  if (severity === 'medium') return 'advisory';
  return 'ready';
}

function reviewActions(detail: string, auditQuery?: { key: string; value: string }): ConsoleAction[] {
  const auditPath = auditQuery ? `/audit?${auditQuery.key}=${encodeURIComponent(auditQuery.value)}` : '/audit';
  return [
    navAction('Review approval context', '/approvals', detail),
    navAction('View audit', auditPath, `Review audit evidence. ${detail}`),
  ];
}

function cameraPosture(health: string): OpsPosture {
  if (health === 'offline') return 'critical';
  if (health === 'degraded') return 'watch';
  return 'ready';
}

export async function loadSecurityConsole(): Promise<ConsolePayload> {
  const [security, shared] = await Promise.all([
    getJson<SecurityOperationsDto>(apiPaths.security.workspace),
    loadSharedContext(),
  ]);
  const data = requireReady(security, 'Security operations workspace');
  const cameraHealth = data.dashboard.cameraHealth;
  const openInvestigations = data.investigations.filter((investigation) => investigation.status !== 'closed').length;
  const criticalIncidents = data.incidents.filter((incident) => incident.severity === 'critical').length;
  const offlineCameras = cameraHealth.offline ?? 0;

  let posture: OpsPosture = 'ready';
  if (criticalIncidents > 0 || offlineCameras > 0) posture = 'critical';
  else if (data.incidents.length > 0 || openInvestigations > 0 || (cameraHealth.degraded ?? 0) > 0) posture = 'watch';

  const incidentItems: QueueItem[] = data.incidents.slice(0, 6).map((incident, index) => ({
    id: incident.id || `security-incident-${index}`,
    title: incident.title,
    summary: `${incident.severity} incident in ${incident.zoneId}; status ${incident.status}. Masked facade metadata only.`,
    posture: severityPosture(incident.severity),
    evidence: [incident.auditId, ...incident.eventIds],
    actions: [
      ...reviewActions(`Review security incident ${incident.title}.`, { key: 'incident', value: incident.id }),
      navAction('Open incident command', '/incidents', 'Review merged incident and emergency command posture.'),
    ],
  }));

  const investigationItems: QueueItem[] = data.investigations.slice(0, 4).map((investigation) => ({
    id: investigation.id,
    title: `Investigation ${investigation.incidentId}`,
    summary: `Lead ${investigation.lead}; status ${investigation.status}. Investigation mutation is backend-governed.`,
    posture: investigation.status === 'open' ? 'watch' : 'advisory',
    evidence: investigation.evidence.length ? investigation.evidence : [investigation.auditId],
    actions: reviewActions(`Review investigation for incident ${investigation.incidentId}.`, { key: 'investigation', value: investigation.id }),
  }));

  const cameraItems: QueueItem[] = data.cameras.slice(0, 4).map((camera) => ({
    id: camera.id,
    title: camera.label,
    summary: `Camera health ${camera.health} in ${camera.zoneId}; privacy masking ${camera.privacyMasking ? 'enabled' : 'disabled'}.`,
    posture: cameraPosture(camera.health),
    evidence: ['SecurityOperationsDto', camera.lastHeartbeatAt],
    actions: reviewActions(`Review camera health record ${camera.label}.`, { key: 'camera', value: camera.id }),
  }));

  const accessItems: QueueItem[] = data.accessEvents.slice(0, 4).map((event) => ({
    id: event.id,
    title: `${event.personDisplayName} — ${event.decision}`,
    summary: `Access ${event.decision} in ${event.zoneId} at ${event.occurredAt}. Reason: ${event.reason}.`,
    posture: event.decision === 'deny' ? 'watch' : 'advisory',
    evidence: [event.eventId, event.auditId],
    actions: reviewActions(`Review access event in ${event.zoneId}.`, { key: 'access', value: event.id }),
  }));

  const incidentLifecycleLane = recordsLifecycleLane(
    'security-incident-lifecycle',
    'Security incident lifecycle',
    'Masked security incidents mapped by status — not card queue nodes.',
    data.incidents.slice(0, 10).map((incident, index) => ({
      id: incident.id || `security-incident-${index}`,
      label: incident.title,
      status: incident.status,
      summary: `${incident.severity} incident in ${incident.zoneId}.`,
      evidence: [incident.auditId, ...incident.eventIds],
      actions: [
        ...reviewActions(`Review security incident ${incident.title}.`, { key: 'incident', value: incident.id }),
        navAction('Open incident command', '/incidents', 'Review merged incident and emergency command posture.'),
      ],
    })),
  );

  const investigationLifecycleLane = recordsLifecycleLane(
    'security-investigation-lifecycle',
    'Investigation lifecycle',
    'Open investigations mapped by status from the security operations facade.',
    data.investigations.slice(0, 8).map((investigation) => ({
      id: investigation.id,
      label: `Investigation ${investigation.incidentId}`,
      status: investigation.status,
      summary: `Lead ${investigation.lead}; opened ${investigation.openedAt}.`,
      evidence: investigation.evidence.length ? investigation.evidence : [investigation.auditId],
      actions: reviewActions(`Review investigation for incident ${investigation.incidentId}.`, { key: 'investigation', value: investigation.id }),
    })),
  );

  const cameraPostureLane = recordsLifecycleLane(
    'camera-posture-lifecycle',
    'Camera posture lifecycle',
    'Camera health records mapped by heartbeat posture.',
    data.cameras.slice(0, 8).map((camera) => ({
      id: camera.id,
      label: camera.label,
      status: camera.health,
      summary: `Zone ${camera.zoneId}; privacy masking ${camera.privacyMasking ? 'enabled' : 'disabled'}.`,
      evidence: ['SecurityOperationsDto', camera.lastHeartbeatAt],
      actions: reviewActions(`Review camera health record ${camera.label}.`, { key: 'camera', value: camera.id }),
    })),
  );

  const statusCounts = [
    ...data.incidents.map((incident) => ({ label: `incident:${incident.status}`, posture: incident.status === 'open' ? 'watch' as OpsPosture : 'advisory' as OpsPosture })),
    ...data.investigations.map((investigation) => ({ label: `investigation:${investigation.status}`, posture: investigation.status === 'open' ? 'watch' as OpsPosture : 'advisory' as OpsPosture })),
  ].reduce<Record<string, number>>((counts, entry) => {
    counts[entry.label] = (counts[entry.label] ?? 0) + 1;
    return counts;
  }, {});

  return {
    routeId: 'security',
    title: 'Security Review',
    mission: 'Monitor zones, cameras, and investigations — escalate through incident command, never from autonomous controls.',
    posture,
    postureLabel: posture === 'critical' ? 'Security critical' : posture === 'watch' ? 'Active security review' : 'Nominal security posture',
    source: security.source,
    primaryActions: [
      navAction('Open incident command', '/incidents', 'Review merged incident and emergency command posture.'),
      navAction('Review approval queue', '/approvals', 'Open human approval records for security-sensitive actions.'),
      navAction('View audit ledger', '/audit', 'Review immutable audit evidence for security operations.'),
    ],
    lifecycleLanes: compactLifecycleLanes([incidentLifecycleLane, investigationLifecycleLane, cameraPostureLane]),
    charts: [
      countBarChart(
        'security-status-bar',
        'Incident and investigation status',
        'Status distribution for security incidents and investigations.',
        Object.entries(statusCounts).map(([label, value]) => ({
          id: label,
          label,
          value,
          posture: label.includes('open') ? 'watch' : 'advisory',
        })),
        'records',
        navAction('Open incident command', '/incidents', 'Review merged incident and emergency command posture.'),
      ),
      postureBreakdownDonut(
        'camera-health-donut',
        'Camera health',
        {
          online: cameraHealth.online ?? 0,
          degraded: cameraHealth.degraded ?? 0,
          offline: cameraHealth.offline ?? 0,
        },
        { online: 'ready', degraded: 'watch', offline: 'critical' },
        navAction('View audit ledger', '/audit', 'Review immutable audit evidence for security operations.'),
      ),
    ],
    queues: [
      {
        id: 'security-incidents',
        title: 'Masked incident queue',
        description: 'Role-gated security incidents from the security operations facade.',
        items: incidentItems,
      },
      {
        id: 'security-investigations',
        title: 'Investigation review queue',
        description: 'Open investigations with evidence references. No mutation or export from frontend.',
        items: investigationItems,
      },
      {
        id: 'camera-health',
        title: 'Camera health queue',
        description: 'Camera heartbeat and privacy masking posture for authorized roles.',
        items: cameraItems,
      },
      {
        id: 'access-events',
        title: 'Access event queue',
        description: 'Recent restricted-zone access decisions for review.',
        items: accessItems,
      },
    ],
    metrics: [
      countMetric('Incidents', data.incidents.length, 'Role-gated security incidents from /security-operations/workspace', data.incidents.length ? 'watch' : 'ready'),
      countMetric('Cameras online', cameraHealth.online ?? 0, 'Online camera count from security dashboard metadata', offlineCameras ? 'watch' : 'ready'),
      countMetric('Investigations open', openInvestigations, 'Security investigation records with open status', openInvestigations ? 'watch' : 'ready'),
      countMetric('Active alerts', data.dashboard.activeAlerts, 'Active alert count from security dashboard', data.dashboard.activeAlerts ? 'watch' : 'ready', navAction('View audit', '/audit', 'Review security alert audit evidence.')),
    ],
    advisories: shared.advisories,
    contextDegraded: shared.contextDegraded,
  };
}
