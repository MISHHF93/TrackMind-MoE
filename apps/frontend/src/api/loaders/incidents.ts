import type { EmergencyOperationsDto, SecurityOperationsDto } from '@trackmind/shared';
import { getJson } from '../client';
import { apiPaths } from '../paths';
import type { ConsoleAction, ConsolePayload, OpsPosture, QueueItem } from '../../design/opsTypes';
import { countBarChart, liveEventTimeline } from './charts';
import { loadSharedContext } from './commonContext';
import { compactLifecycleLanes, recordsLifecycleLane } from './lifecycle';
import { countMetric, navAction, requireReady, textMetric } from './util';

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

function incidentPosture(security: SecurityOperationsDto, emergency: EmergencyOperationsDto): OpsPosture {
  const criticalIncidents = security.incidents.filter((incident) => incident.severity === 'critical').length;
  const highIncidents = security.incidents.filter((incident) => incident.severity === 'high').length;
  const emergencyCritical = emergency.activeEmergencyStatus.toLowerCase().includes('critical');
  if (emergencyCritical || criticalIncidents > 0) return 'critical';
  if (highIncidents > 0 || emergency.events.some((event) => event.severity === 'critical' || event.severity === 'high')) return 'watch';
  if (security.incidents.length > 0 || emergency.events.length > 0) return 'advisory';
  return 'ready';
}

export async function loadIncidentsConsole(): Promise<ConsolePayload> {
  const [security, emergency, shared] = await Promise.all([
    getJson<SecurityOperationsDto>(apiPaths.incidents.security),
    getJson<EmergencyOperationsDto>(apiPaths.incidents.emergency),
    loadSharedContext(),
  ]);
  const securityData = requireReady(security, 'Security operations workspace');
  const emergencyData = requireReady(emergency, 'Emergency operations workspace');
  const posture = incidentPosture(securityData, emergencyData);
  const emergencyCritical = emergencyData.activeEmergencyStatus.toLowerCase().includes('critical');

  const incidentItems: QueueItem[] = securityData.incidents.slice(0, 6).map((incident, index) => ({
    id: incident.id || `security-incident-${index}`,
    title: incident.title,
    summary: `${incident.severity} incident in ${incident.zoneId}; status ${incident.status}. Assigned to ${incident.assignedTo ?? 'unassigned'}.`,
    posture: severityPosture(incident.severity),
    evidence: [incident.auditId, ...incident.eventIds],
    actions: [
      ...reviewActions(`Review incident ${incident.title} approval boundary.`, { key: 'incident', value: incident.id }),
      navAction('Open security review', '/security', 'Review masked security workspace records for this incident.'),
    ],
  }));

  const emergencyEventItems: QueueItem[] = emergencyData.events.slice(0, 6).map((event, index) => ({
    id: event.id || `emergency-event-${index}`,
    title: event.type,
    summary: `${event.severity} emergency signal for ${event.subjectId} at ${event.timestamp}. Human command authority retained.`,
    posture: severityPosture(event.severity),
    evidence: [event.auditId, 'emergency-operations'],
    actions: reviewActions(`Review emergency event ${event.type}.`, { key: 'event', value: event.id }),
  }));

  const resourceItems: QueueItem[] = emergencyData.resources.slice(0, 4).map((resource) => ({
    id: resource.id,
    title: resource.label,
    summary: `${resource.kind} resource in ${resource.zoneId}; status ${resource.status}. Dispatch review only—no frontend execution.`,
    posture: resource.status === 'deployed' || resource.status === 'active' ? 'watch' : 'advisory',
    evidence: ['EmergencyOperationsDto', resource.id, resource.zoneId],
    actions: [
      navAction('Review resource dispatch context', '/incidents', 'Review emergency resource posture in incident command; dispatch is not executed from the frontend.'),
      ...reviewActions(`Review ${resource.label} dispatch approval boundary.`),
    ],
  }));

  const incidentLifecycleLane = recordsLifecycleLane(
    'incident-response-lifecycle',
    'Incident response lifecycle',
    'Security incidents mapped by status progression — open through resolved.',
    securityData.incidents.slice(0, 10).map((incident, index) => ({
      id: incident.id || `security-incident-${index}`,
      label: incident.title,
      status: incident.status,
      summary: `${incident.severity} incident in ${incident.zoneId}; assigned to ${incident.assignedTo ?? 'unassigned'}.`,
      evidence: [incident.auditId, ...incident.eventIds],
      actions: [
        ...reviewActions(`Review incident ${incident.title} approval boundary.`, { key: 'incident', value: incident.id }),
        navAction('Open security review', '/security', 'Review masked security workspace records for this incident.'),
      ],
    })),
  );

  const emergencyLifecycleLane = recordsLifecycleLane(
    'emergency-response-lifecycle',
    'Emergency response lifecycle',
    `Emergency posture ${emergencyData.activeEmergencyStatus} — events mapped for command review.`,
    emergencyData.events.slice(0, 10).map((event, index) => ({
      id: event.id || `emergency-event-${index}`,
      label: event.type,
      status: emergencyData.activeEmergencyStatus,
      summary: `${event.severity} signal for ${event.subjectId} at ${event.timestamp}.`,
      evidence: [event.auditId, 'emergency-operations'],
      actions: reviewActions(`Review emergency event ${event.type}.`, { key: 'event', value: event.id }),
    })),
  );

  const severityCounts = [...securityData.incidents, ...emergencyData.events].reduce<Record<string, number>>((counts, entry) => {
    counts[entry.severity] = (counts[entry.severity] ?? 0) + 1;
    return counts;
  }, {});
  const timelineEvents = [
    ...securityData.incidents.map((incident) => ({
      id: incident.id,
      summary: incident.title,
      severity: incident.severity,
      timestamp: incident.createdAt,
    })),
    ...emergencyData.events.map((event) => ({
      id: event.id,
      summary: event.type,
      severity: event.severity,
      timestamp: event.timestamp,
    })),
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));

  return {
    routeId: 'incidents',
    title: 'Incident Command',
    mission: 'Coordinate security and emergency response — dispatch stays human-commanded; this board routes operators to evidence and approvals.',
    posture,
    postureLabel: posture === 'critical' ? 'Critical incident posture' : posture === 'watch' ? 'Active incident review' : 'Nominal posture',
    source: security.source,
    primaryActions: [
      navAction('Review approval queue', '/approvals', 'Open human approval records for incident and emergency response.'),
      navAction('View audit ledger', '/audit', 'Review immutable audit evidence for incidents and emergency signals.'),
      navAction('Open security review', '/security', 'Review masked security incidents, cameras, and investigations.'),
    ],
    lifecycleLanes: compactLifecycleLanes([incidentLifecycleLane, emergencyLifecycleLane]),
    charts: [
      liveEventTimeline(timelineEvents, navAction('View audit ledger', '/audit', 'Review immutable audit evidence for incidents and emergency signals.')),
      countBarChart(
        'incident-severity-bar',
        'Severity distribution',
        'Security incidents and emergency events by severity.',
        Object.entries(severityCounts).map(([severity, value]) => ({
          id: `severity-${severity}`,
          label: severity,
          value,
          posture: severityPosture(severity),
        })),
        'signals',
        navAction('Open security review', '/security', 'Review masked security workspace records for active incidents.'),
      ),
    ],
    queues: [
      {
        id: 'incident-command',
        title: 'Incident command queue',
        description: 'Security incidents requiring human command review. No escalation or dispatch executes from this console.',
        items: incidentItems,
      },
      {
        id: 'emergency-signals',
        title: 'Emergency signal queue',
        description: 'Emergency operations events surfaced for command staff review.',
        items: emergencyEventItems,
      },
      {
        id: 'resource-dispatch-review',
        title: 'Emergency resource dispatch review',
        description: 'Response resources visible to command staff. Review posture only; dispatch remains backend-governed.',
        items: resourceItems,
      },
    ],
    metrics: [
      countMetric('Security incidents', securityData.incidents.length, 'Security incident rows from /security-operations/workspace', securityData.incidents.length ? 'watch' : 'ready'),
      textMetric('Emergency status', emergencyData.activeEmergencyStatus, 'Emergency workspace status remains human-commanded', emergencyCritical ? 'critical' : emergencyData.events.length ? 'watch' : 'ready'),
      countMetric('Emergency resources', emergencyData.resources.length, 'Response resources mapped for command review', emergencyData.resources.length ? 'watch' : 'ready'),
      countMetric('Pending approvals', shared.approvals.length, 'Governance approvals linked to incident response', shared.approvals.length ? 'watch' : 'ready', navAction('Review approval context', '/approvals', 'Open approval queue.')),
    ],
    advisories: shared.advisories,
    contextDegraded: shared.contextDegraded,
  };
}
